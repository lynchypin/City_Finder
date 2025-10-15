import { Client } from '../types';

let openAiApiKey: string | null = null;

export const initializeOpenAI = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("A valid OpenAI API Key is required to initialize the service.");
  }
  openAiApiKey = apiKey;
};

export const findClientCitiesBatchOpenAI = async (clients: Client[]): Promise<Map<number, { city: string; jobTitle: string } | string>> => {
  if (!openAiApiKey) {
    throw new Error("OpenAI service has not been initialized. Please configure the API key.");
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
    Your function is to find the current city and job title for each professional in the INPUT_DATA array.
    Use your internal knowledge and search capabilities to find the most likely details for each person.

    RULES:
    1. Primary sources should be professional social media profiles or official company websites.
    2. Be resourceful. If a precise search fails, try broader searches.
    3. The 'city' should be a string (e.g., "San Francisco, CA", "London, UK"). If no city is found, it MUST be "Not Found".
    4. The 'jobTitle' should be the most current job title found. If no job title is found, it MUST be an empty string "".

    CRITICAL OUTPUT FORMAT:
    Your entire response must be a single JSON object. This object must contain one key: "results". The value of "results" must be a JSON array. Each object in the array must correspond to a person from the input and contain their original 'id' (number), the found 'city' (string), and the found 'jobTitle' (string).

    INPUT_DATA:
    ${JSON.stringify(clientDataForPrompt, null, 2)}
  `;
  
  const resultMap = new Map<number, { city: string; jobTitle: string } | string>();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            const errorText = await response.text();
            const finalError = `API Error: Status ${response.status} - ${errorText || 'No response body'}`;
            clients.forEach(c => resultMap.set(c.id, finalError));
            return resultMap;
        }

        console.error("OpenAI API Error:", JSON.stringify(errorData, null, 2));
        const specificMessage = errorData?.error?.message || "An unknown API error occurred.";
        let errorType = `API Error: ${specificMessage}`;
        
        if (errorData?.error?.code === 'insufficient_quota') {
            errorType = "Insufficient Quota";
        } else if (response.status === 401) {
            errorType = "Invalid API Key";
        } else if (response.status === 429) {
            errorType = "Rate Limit Exceeded";
        }
        
        clients.forEach(c => resultMap.set(c.id, errorType));
        return resultMap;
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    
    if (content && Array.isArray(content.results)) {
        for (const item of content.results) {
            if (typeof item.id === 'number' && typeof item.city === 'string' && typeof item.jobTitle === 'string') {
                resultMap.set(item.id, {
                  city: item.city.trim() || "Not Found",
                  jobTitle: item.jobTitle.trim()
                });
            }
        }
    }

    // Ensure all clients get a result, even if missing from the response
    for (const client of clients) {
        if (!resultMap.has(client.id)) {
            resultMap.set(client.id, "Error: No result from AI");
        }
    }

    return resultMap;

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    let errorMessage = "An unexpected network or parsing error occurred.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    const finalError = `API Error: ${errorMessage}`;
    clients.forEach(c => resultMap.set(c.id, finalError));
    return resultMap;
  }
};
