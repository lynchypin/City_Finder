import React, { useState } from 'react';

interface ApiKeySetupProps {
  onSubmit: (data: { apiKey: string, sheetId: string, openAiApiKey: string }) => void;
}

const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onSubmit }) => {
  const [apiKey, setApiKey] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [openAiApiKey, setOpenAiApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim() && sheetId.trim()) {
      onSubmit({ apiKey: apiKey.trim(), sheetId: sheetId.trim(), openAiApiKey: openAiApiKey.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-dark font-sans flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-gray-medium rounded-lg shadow-xl p-6 md:p-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-brand-primary dark:text-brand-light mb-2">
            Welcome to the Client Matcher
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            To get started, please provide your settings.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="gemini-key" className="block mb-1 text-sm font-medium text-gray-900 dark:text-white text-left">Gemini API Key (Required)</label>
              <input
                id="gemini-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                aria-label="Gemini API Key"
                required
              />
            </div>
            <div>
              <label htmlFor="sheet-id" className="block mb-1 text-sm font-medium text-gray-900 dark:text-white text-left">Google Sheet ID (Required)</label>
              <input
                id="sheet-id"
                type="text"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="Enter your Google Sheet ID"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                aria-label="Google Sheet ID"
                required
              />
            </div>
            <div>
              <label htmlFor="openai-key" className="block mb-1 text-sm font-medium text-gray-900 dark:text-white text-left">OpenAI API Key (Optional)</label>
              <input
                id="openai-key"
                type="password"
                value={openAiApiKey}
                onChange={(e) => setOpenAiApiKey(e.target.value)}
                placeholder="For retrying failed searches"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                aria-label="OpenAI API Key"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-brand-primary hover:bg-brand-dark text-white font-bold py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary disabled:opacity-50"
              disabled={!apiKey.trim() || !sheetId.trim()}
            >
              Save Settings & Start
            </button>
          </form>
          <div className="mt-6 text-sm text-left space-y-2">
            <p className="text-gray-500 dark:text-gray-400">
              <strong className="text-gray-700 dark:text-gray-300">API Keys:</strong> Keys are stored in your browser and are required for the AI search.
               <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-secondary hover:underline font-medium ml-1">
                Get Gemini Key &rarr;
              </a>
            </p>
             <p className="text-gray-500 dark:text-gray-400">
              <strong className="text-gray-700 dark:text-gray-300">Sheet ID:</strong> The ID is the long string of characters in your Google Sheet's URL. For example, in `.../d/THIS_IS_THE_ID/edit`, "THIS_IS_THE_ID" is the ID.
            </p>
             <p className="text-gray-500 dark:text-gray-400">
              <strong className="text-gray-700 dark:text-gray-300">Sheet Permissions:</strong> Remember to set your sheet's sharing to "Anyone with the link" can "View".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySetup;
