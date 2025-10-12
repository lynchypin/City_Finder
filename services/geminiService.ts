import { GoogleGenAI } from "@google/genai";
import { Client } from '../types';

let ai: GoogleGenAI | null = null;

export const initializeGemini = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("A valid API Key is required to initialize the Gemini service.");
  }
  ai = new GoogleGenAI({ apiKey });
};

export const findClientCitiesBatch = async (clients: Client[]): Promise<Map<number, string>> => {
  if (!ai) {
    throw new Error("Gemini service has not been initialized. Please configure the API key.");
  }
  if (clients.length === 0) {
    return new Map();
  }

  const clientDataForPrompt = clients.map(client => {
    const { id, firstName, lastName, jobTitle, company } = client;
    const personIdentifier = [firstName, lastName].filter(Boolean).join(' ');
    let professionalContext = '';
    if (jobTitle && company) {
      professionalContext = `${jobTitle} at ${company}`;
    } else if (jobTitle || company) {
      professionalContext = jobTitle || company;
    }
    return { id, person: personIdentifier, context: professionalContext };
  });

  const prompt = `
    You are an expert researcher. Your goal is to find the current city for each professional in the provided JSON array.

    Use the following process:
    1. For each person, use Google Search to find their current city. Your primary sources should be professional social media profiles (like LinkedIn) or official company websites.
    2. If an initial, precise search fails (e.g., "John Doe, CEO at ACME Inc"), you MUST try broader searches (e.g., "John Doe ACME Inc LinkedIn"). Be resourceful.
    3. Analyze the search results to determine the most likely current city. The 'city' value should be a string like "San Francisco, CA" or "London, UK".
    4. If, after multiple reasonable attempts, no location can be reliably found, the 'city' value MUST be the exact string "Not Found".

    INPUT JSON:
    ${JSON.stringify(clientDataForPrompt, null, 2)}

    CRITICAL OUTPUT RULES:
    - Your entire response MUST BE ONLY the raw JSON array.
    - The array must contain an object for every person from the input.
    - Each object must have the original 'id' (number) and the found 'city' (string).
    - DO NOT write any introduction, explanation, or apologies.
    - DO NOT wrap the JSON in markdown backticks or any other formatting.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    const resultMap = new Map<number, string>();
    
    let responseText = response.text.trim();
    const jsonStartIndex = responseText.indexOf('[');
    const jsonEndIndex = responseText.lastIndexOf(']');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
        console.error("Could not find a valid JSON array in the API response. Response text:", responseText);
        for (const client of clients) {
            resultMap.set(client.id, "Error: Malformed Response");
        }
        return resultMap;
    }

    const jsonString = responseText.substring(jsonStartIndex, jsonEndIndex + 1);
    const jsonResponse = JSON.parse(jsonString);

    if (Array.isArray(jsonResponse)) {
      for (const item of jsonResponse) {
        if (typeof item.id === 'number' && typeof item.city === 'string') {
          resultMap.set(item.id, item.city.trim() || "Not Found");
        }
      }
    }
    
    for(const client of clients) {
        if (!resultMap.has(client.id)) {
            resultMap.set(client.id, "Error: No result from AI");
        }
    }

    return resultMap;

  } catch (error) {
    console.error("Error calling Gemini API with Google Search:", error);
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);

    const errorMap = new Map<number, string>();
    let errorType = "API Error";

    if (errorMessage.includes('API key not valid') || errorMessage.includes('permission_denied')) {
      errorType = "Invalid API Key";
    } else if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      errorType = "Rate Limit Exceeded";
    }
    
    clients.forEach(c => errorMap.set(c.id, errorType));
    return errorMap;
  }
};