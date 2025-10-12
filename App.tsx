import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from './types';
import { fetchClients } from './services/googleSheetService';
import { initializeGemini, findClientCitiesBatch } from './services/geminiService';
import Header from './components/Header';
import ClientTable from './components/ClientTable';
import Loader from './components/Loader';
import ApiKeySetup from './components/ApiKeySetup';

const BATCH_SIZE = 5; // Process 5 clients per API call
const RPM_DELAY = 10000; // 10 seconds. Increased delay for a safer margin under 10 RPM.
const LOCAL_STORAGE_KEY_CLIENTS = 'client-city-data';
const LOCAL_STORAGE_KEY_API_KEY = 'gemini-api-key';
const LOCAL_STORAGE_KEY_SHEET_ID = 'google-sheet-id';


// Creates a stable, unique key for a client based on their core details.
const getClientUniqueKey = (client: Pick<Client, 'firstName' | 'lastName' | 'company'>): string => {
  return `${client.firstName}|${client.lastName}|${client.company}`.toLowerCase().trim();
};


const App: React.FC = () => {
  // Initialize state directly from localStorage. This is more robust and prevents race conditions on load.
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY) || ''
  );
  const [sheetId, setSheetId] = useState<string>(
    () => localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_ID) || ''
  );
  
  const [clients, setClients] = useState<Client[]>([]);
  // Start in a loading state only if the app is already configured.
  const [isLoading, setIsLoading] = useState<boolean>(() => !!(apiKey && sheetId));
  const [error, setError] = useState<boolean>(false);
  const [isFindingAll, setIsFindingAll] = useState<boolean>(false);
  const [rateLimitMessage, setRateLimitMessage] = useState<string>('');
  const [showDailyLimitWarning, setShowDailyLimitWarning] = useState<boolean>(false);
  const rateLimitHistory = useRef<number[]>([]);

  // Derived state to determine if the app is configured.
  const isConfigured = !!apiKey && !!sheetId;

  const handleSetupSubmit = (data: { apiKey: string; sheetId: string }) => {
    if (data.apiKey.trim() && data.sheetId.trim()) {
      const newApiKey = data.apiKey.trim();
      const newSheetId = data.sheetId.trim();
      localStorage.setItem(LOCAL_STORAGE_KEY_API_KEY, newApiKey);
      localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_ID, newSheetId);
      setApiKey(newApiKey);
      setSheetId(newSheetId);
      setIsLoading(true); // Start loading clients after setup
    }
  };

  const handleResetSettings = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY_API_KEY);
    localStorage.removeItem(LOCAL_STORAGE_KEY_SHEET_ID);
    localStorage.removeItem(LOCAL_STORAGE_KEY_CLIENTS);
    setApiKey('');
    setSheetId('');
    setClients([]);
    setIsLoading(false); // Not configured, so not loading
    setError(false); // Reset any previous errors
  };

  const loadClients = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(false);
      const fetchedClients = await fetchClients(id);
      
      const savedDataRaw = localStorage.getItem(LOCAL_STORAGE_KEY_CLIENTS);
      const savedData: Record<string, { city: string; cityStatus: Client['cityStatus'] }> = savedDataRaw ? JSON.parse(savedDataRaw) : {};

      const mergedClients = fetchedClients.map(client => {
        const key = getClientUniqueKey(client);
        const savedClient = savedData[key];
        if (savedClient) {
          return { ...client, city: savedClient.city, cityStatus: savedClient.cityStatus };
        }
        return client;
      });

      setClients(mergedClients);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effect to initialize the app and load clients once it's configured.
  useEffect(() => {
    if (isConfigured) {
      try {
        initializeGemini(apiKey);
        loadClients(sheetId);
      } catch (e) {
        console.error("Failed to initialize with stored settings. Clearing invalid key.", e);
        handleResetSettings();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured, apiKey, sheetId]); // loadClients is stable and doesn't need to be in deps

  // Effect to save client data to localStorage whenever it changes
  useEffect(() => {
    if (isLoading || clients.length === 0 || !isConfigured) {
      return;
    }
    const dataToStore: Record<string, { city: string; cityStatus: Client['cityStatus'] }> = {};
    clients.forEach(client => {
      if (client.cityStatus !== 'idle' || client.city) {
        const key = getClientUniqueKey(client);
        dataToStore[key] = {
          city: client.city,
          cityStatus: client.cityStatus,
        };
      }
    });
    localStorage.setItem(LOCAL_STORAGE_KEY_CLIENTS, JSON.stringify(dataToStore));
  }, [clients, isLoading, isConfigured]);


  const handleCityChange = useCallback((id: number, city: string) => {
    setClients(prevClients =>
      prevClients.map(client =>
        client.id === id ? { ...client, city, cityStatus: city ? 'found' : 'idle' } : client
      )
    );
  }, []);
  
  const processApiResult = (resultMap: Map<number, string>) => {
     // A successful API call will have a result that is not a recognized error string.
     // This resets the consecutive rate limit counter.
     const firstResult = resultMap.values().next().value;
     if (firstResult && !['Invalid API Key', 'Rate Limit Exceeded', 'API Error'].includes(firstResult)) {
       rateLimitHistory.current = [];
     }

     for (const [id, foundCity] of resultMap.entries()) {
        if (foundCity === 'Invalid API Key') {
            setRateLimitMessage("The provided API Key is invalid. Resetting settings.");
            handleResetSettings();
            return 'STOP';
        }

        if (foundCity === 'Rate Limit Exceeded') {
            setRateLimitMessage("API rate limit reached. Paused processing. Please wait a minute and try again.");
            
            const now = Date.now();
            rateLimitHistory.current.push(now);
            if (rateLimitHistory.current.length >= 2) {
              const history = rateLimitHistory.current;
              const timeOfLastError = history[history.length - 1];
              const timeOfPreviousError = history[history.length - 2];
              if (timeOfLastError - timeOfPreviousError > 60000) { // More than 1 minute apart
                setShowDailyLimitWarning(true);
              }
            }
            
            setClients(prev => prev.map(c => 
                resultMap.has(c.id)
                ? { ...c, cityStatus: 'error', city: 'Rate Limited' } 
                : c
            ));
            return 'STOP';
        }

        setClients(prevClients =>
            prevClients.map(client =>
                client.id === id ? { 
                    ...client, 
                    city: foundCity, 
                    cityStatus: foundCity.toLowerCase() === 'not found' ? 'not_found' : 'found' 
                } : client
            )
        );
     }
     return 'CONTINUE';
  };

  const handleFindCity = useCallback(async (id: number) => {
    const clientToFind = clients.find(c => c.id === id);
    if (!clientToFind) return;

    setRateLimitMessage('');
    setClients(prevClients =>
      prevClients.map(client =>
        client.id === id ? { ...client, cityStatus: 'finding' } : client
      )
    );

    const resultMap = await findClientCitiesBatch([clientToFind]);
    processApiResult(resultMap);
  }, [clients]);
  
  const handleFindAllCities = useCallback(async () => {
    const clientsToFind = clients.filter(c => !c.city || c.cityStatus === 'error' || c.cityStatus === 'not_found');
    if (clientsToFind.length === 0) return;
  
    setIsFindingAll(true);
    setRateLimitMessage('');
  
    setClients(prevClients =>
      prevClients.map(c =>
        clientsToFind.some(ctf => ctf.id === c.id) ? { ...c, cityStatus: 'finding' } : c
      )
    );
  
    for (let i = 0; i < clientsToFind.length; i += BATCH_SIZE) {
        const batch = clientsToFind.slice(i, i + BATCH_SIZE);
        const resultMap = await findClientCitiesBatch(batch);
        const status = processApiResult(resultMap);
        
        if (status === 'STOP') {
            const remainingClientIds = clientsToFind.slice(i).map(c => c.id);
            setClients(prev => prev.map(c =>
                remainingClientIds.includes(c.id) ? { ...c, cityStatus: 'error', city: c.city || 'Not Processed' } : c
            ));
            break;
        }

        if (i + BATCH_SIZE < clientsToFind.length) {
            await new Promise(resolve => setTimeout(resolve, RPM_DELAY));
        }
    }
  
    setIsFindingAll(false);
  }, [clients]);

  const handleDownloadCSV = () => {
    const headers = ["Client first name", "Client second name", "Job Title", "Company", "Identified City"];
    
    const formatCsvField = (field: string) => {
      const str = String(field || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(','),
      ...clients.map(client => 
        [
          formatCsvField(client.firstName),
          formatCsvField(client.lastName),
          formatCsvField(client.jobTitle),
          formatCsvField(client.company),
          formatCsvField(client.city)
        ].join(',')
      )
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'client_locations.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const ErrorDisplay = () => (
    <div className="bg-white dark:bg-gray-medium rounded-lg shadow-xl p-6 md:p-8 max-w-3xl mx-auto my-10 border-t-4 border-red-500">
      <div className="flex items-start mb-4">
        <svg className="h-8 w-8 text-red-500 mr-4 flex-shrink-0 mt-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h2 className="text-2xl font-bold text-red-700 dark:text-red-400">Action Required: Cannot Access Google Sheet</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            The app received an "Unauthorized" error. Please check the Sheet ID and sharing settings.
          </p>
        </div>
      </div>
      <div className="text-gray-700 dark:text-gray-300 space-y-4">
        <p>To fix this, you must set your Google Sheet to be viewable by "Anyone with the link". Follow these steps exactly:</p>
        <ol className="list-decimal list-inside pl-4 space-y-2">
          <li>Double-check that you have entered the correct <strong>Sheet ID</strong>.</li>
          <li>In your Google Sheet, click the blue/green <strong>Share</strong> button in the top-right corner.</li>
          <li>Under the <strong>"General access"</strong> section, click the dropdown menu.</li>
          <li>If it says "Restricted", change it to <strong>"Anyone with the link"</strong>.</li>
          <li>Ensure the role on the right is set to <strong>"Viewer"</strong>.</li>
        </ol>
        <p>Once you've updated the sharing settings, click the button below to try again.</p>
      </div>
      <div className="mt-6 text-center">
        <button
          onClick={() => loadClients(sheetId)}
          className="bg-brand-primary hover:bg-brand-dark text-white font-bold py-2 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );
  
  if (!isConfigured) {
    return <ApiKeySetup onSubmit={handleSetupSubmit} />;
  }

  const clientsToFindCount = clients.filter(c => !c.city || c.cityStatus === 'error' || c.cityStatus === 'not_found').length;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-dark font-sans">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader />
          </div>
        ) : error ? (
          <ErrorDisplay />
        ) : (
          <>
            {showDailyLimitWarning && (
              <div className="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md mb-6 relative" role="alert">
                <div className="flex">
                  <div className="py-1">
                    <svg className="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 011-1h0a1 1 0 011 1v4a1 1 0 01-2 0V9zm1-4a1 1 0 110 2 1 1 0 010-2z"/></svg>
                  </div>
                  <div>
                    <p className="font-bold">Daily API Limit Likely Reached</p>
                    <p className="text-sm">The API returned rate limit errors more than a minute apart, which suggests you may have used your entire daily quota. Please try again tomorrow or check your Google AI Studio account.</p>
                  </div>
                </div>
                <button onClick={() => setShowDailyLimitWarning(false)} className="absolute top-2 right-2 p-1.5 text-red-500 hover:bg-red-200 dark:hover:bg-red-800/50 rounded-lg">
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                </button>
              </div>
            )}
            <div className="mb-6 bg-white dark:bg-gray-medium p-4 rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row justify-between items-start">
                    <div className="text-gray-700 dark:text-gray-300 text-left mb-4 md:mb-0">
                        <h3 className="font-bold text-lg">Instructions:</h3>
                        <ol className="list-decimal list-inside">
                          <li><strong>Find All Cities:</strong> Click 'Find All' to process all clients at once.</li>
                          <li><strong>Review & Edit:</strong> Manually correct any cities as needed.</li>
                          <li><strong>Download CSV:</strong> Save your updated list when you're done.</li>
                          <li><strong>Auto-Save:</strong> Your work is automatically saved in this browser.</li>
                        </ol>
                    </div>
                    <div className="w-full md:w-auto flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
                        <button
                          onClick={handleResetSettings}
                          className="w-full md:w-auto text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                          title="Reset API Key and Sheet ID"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Reset Settings
                        </button>
                        <button
                            onClick={handleFindAllCities}
                            disabled={isFindingAll || clientsToFindCount === 0}
                            className="w-full md:w-auto bg-brand-primary hover:bg-brand-dark text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isFindingAll ? (
                               <>
                               <Loader size="sm" />
                               <span className="ml-2">Finding All...</span>
                               </>
                            ) : `Find All Cities (${clientsToFindCount})`}
                        </button>
                        <button
                          onClick={handleDownloadCSV}
                          disabled={clients.length === 0}
                          className="w-full md:w-auto bg-brand-secondary hover:bg-brand-dark text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Download Results as CSV
                        </button>
                    </div>
                </div>
                {rateLimitMessage && (
                    <div className="mt-4 text-center bg-amber-100 dark:bg-amber-900/50 border-l-4 border-amber-500 text-amber-700 dark:text-amber-300 p-3 rounded-md" role="alert">
                        <p className="font-bold">Processing Paused</p>
                        <p>{rateLimitMessage}</p>
                    </div>
                )}
            </div>
            <ClientTable
                clients={clients}
                onCityChange={handleCityChange}
                onFindCity={handleFindCity}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;