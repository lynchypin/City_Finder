import { Client } from '../types';

// A more robust CSV parser that handles quoted fields and finds the header row dynamically.
const parseCSV = (csvText: string): Client[] => {
  // BOM (Byte Order Mark) can be present in files and cause issues with parsing the first header.
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.substring(1);
  }

  const lines = csvText.trim().split(/\r?\n/);

  // Dynamically find the header row instead of assuming it's the first line.
  // This makes the parser resilient to empty leading lines or metadata from the export.
  const headerRowIndex = lines.findIndex(line =>
    line.toLowerCase().includes('client first name') &&
    line.toLowerCase().includes('client second name')
  );

  if (headerRowIndex === -1) {
    // This is a more informative error. It suggests the content received is not the expected CSV.
    throw new Error('CSV headers are missing or incorrect. Expected at least "Client first name" and "Client second name".');
  }

  // Helper to parse a single line, handling quoted commas.
  const parseLine = (line: string): string[] => {
    // Regex to split by comma but ignore commas inside double quotes
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/g);
    // Clean up values: remove surrounding quotes and trim whitespace
    return values.map(val => val.trim().replace(/^"|"$/g, '').trim());
  };

  const headers = parseLine(lines[headerRowIndex]).map(h => h.trim().toLowerCase());
  const firstNameIndex = headers.indexOf('client first name');
  const lastNameIndex = headers.indexOf('client second name');
  const jobTitleIndex = headers.indexOf('job title');
  const companyIndex = headers.indexOf('company');
  const cityHeaderOptions = ['identified city', 'city'];
  const cityIndex = headers.findIndex(h => cityHeaderOptions.includes(h));


  if (firstNameIndex === -1 || lastNameIndex === -1) {
    throw new Error(`Could not map all required CSV columns. Found headers: [${headers.join(', ')}]`);
  }

  const dataLines = lines.slice(headerRowIndex + 1);

  return dataLines.map((line, index): Client | null => {
    // Skip any empty lines in the CSV
    if (!line.trim()) {
      return null;
    }
    const values = parseLine(line);

    // If a city column exists and has data, skip this row from being processed.
    if (cityIndex > -1 && values[cityIndex] && values[cityIndex].trim() !== '') {
      return null;
    }
    
    return {
      id: index,
      firstName: values[firstNameIndex] || '',
      lastName: values[lastNameIndex] || '',
      jobTitle: jobTitleIndex > -1 ? values[jobTitleIndex] || '' : '',
      company: companyIndex > -1 ? values[companyIndex] || '' : '',
      city: '',
      cityStatus: 'idle',
    };
  }).filter((client): client is Client => client !== null); // Filter out null entries from empty or skipped lines
};

export const fetchClients = async (sheetId: string): Promise<Client[]> => {
  // Use the direct CSV export URL. This is more reliable than trying to guess a "published" URL.
  const directExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
  
  // This direct link requires a CORS proxy to be fetched from a browser.
  // `corsproxy.io` is a modern and reliable option.
  const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(directExportUrl)}`;

  try {
    const response = await fetch(proxiedUrl);

    if (!response.ok) {
      // If it fails, it is now most likely a permissions issue on the sheet.
      throw new Error(`Failed to fetch sheet via proxy. Status: ${response.status}. Ensure the sheet's sharing is set to 'Anyone with the link'.`);
    }

    const csvText = await response.text();

    if (!csvText || typeof csvText !== 'string' || csvText.trim().length === 0) {
        throw new Error('Received empty data from the sheet. The sheet might be empty or inaccessible.');
    }
    
    return parseCSV(csvText);
  } catch (error) {
     console.error("Error fetching or parsing Google Sheet data:", error);
     // Re-throw the error to be handled by the UI component, which will show instructions.
     throw error;
  }
};
