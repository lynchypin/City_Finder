# Sales Navigator Client Matcher

An intelligent tool to help you find clients from a Google Sheet and enrich their contact information with their current city and job title using AI. This app uses Google Gemini with search grounding (and optionally OpenAI) to refine research and provide up-to-date information, saving you hours of manual work.

![Sales Navigator Client Matcher Screenshot](https://storage.googleapis.com/aistudio-public-images/readme_screenshots/sales-navigator-client-matcher.png)

## ✨ Features

- **Google Sheet Integration:** Easily import your client list from any Google Sheet.
- **AI-Powered Contact Research:**
  - Leverages **Google Gemini** with search grounding to find the most up-to-date city and job title for each contact.
  - Optional integration with **OpenAI's GPT-4o** for retrying failed lookups or as an alternative research engine.
- **Efficient Batch Processing:** Processes clients in batches to respect API rate limits and provide a smooth user experience.
- **Smart Skipping:** Automatically skips processing rows that already have a city identified in the source Google Sheet, saving time and API costs.
- **Manual Override:** Full control to manually edit any information directly in the results table.
- **Progress Auto-Save:** All your work is automatically saved to your browser's local storage, so you can close the tab and resume your session later.
- **CSV Export:** Download your enriched client list as a CSV file, ready for import into other systems.
- **Privacy-Focused:** API keys and client data are stored locally in your browser and are never sent to any server except the respective AI provider's.

## 🚀 Getting Started

Follow these steps to get the application up and running.

### Prerequisites

1.  **Google Gemini API Key:** You'll need an API key from Google to use the core AI features.
2.  **(Optional) OpenAI API Key:** If you want to use the "Retry with OpenAI" feature, you'll need an API key from OpenAI.
3.  **A Google Sheet with Client Data:** This sheet will be the source of your client list.

### Setup Instructions

#### 1. Prepare Your Google Sheet

- Create a new Google Sheet.
- Your sheet **must** contain the following columns (headers can be in any order):
  - `Client first name`
  - `Client second name`
  - `Job Title`
  - `Company`
- **CRITICAL:** You must update the sharing permissions.
  - Click the **Share** button in the top-right corner.
  - Under "General access," change "Restricted" to **"Anyone with the link"**.
  - Ensure the role is set to **"Viewer"**. This is necessary for the application to read the data.
- Copy the **Sheet ID** from your browser's URL bar. It's the long string of random characters in the middle of the URL: `https://docs.google.com/spreadsheets/d/`**`[THIS_IS_THE_SHEET_ID]`**`/edit`

#### 2. Get Your API Keys

- **Google Gemini:** Visit [**Google AI Studio**](https://aistudio.google.com/app/apikey) to generate your free API key.
- **OpenAI (Optional):** Visit the [**OpenAI Platform**](https://platform.openai.com/api-keys) to create an API key if you don't already have one.

#### 3. Run the Application

- Open the `index.html` file in a modern web browser (like Chrome, Firefox, or Edge).
- You will be greeted with a setup screen.
- Enter your **Gemini API Key** and your **Google Sheet ID**.
- If you have one, enter your **OpenAI API Key** in the optional field.
- Click **"Save Settings & Start"**.

## 📖 How to Use

1.  **Loading Data:** The application will automatically fetch and display the clients from your Google Sheet.
2.  **Finding Cities & Titles:**
    - Click **`Find All (Gemini)`** to start the primary research process. The app will process all clients that don't yet have a city in batches.
    - If you provided an OpenAI key, you can use **`Find All (OpenAI)`** as an alternative primary search.
    - If some clients result in an error or are marked as "Not Found," the **`Retry Failed with OpenAI`** button will appear. This is a powerful feature that uses a different AI model to find difficult-to-locate contacts.
3.  **Review and Edit:**
    - As results come in, they will populate the "Identified City" and "Job Title" columns.
    - You can click into any "Identified City" cell to make manual corrections. Changes are saved automatically.
4.  **Downloading Results:**
    - Once you're satisfied with the enriched list, click **`Download CSV`**. This will save a `client_locations.csv` file to your computer with all the updated information.

## 🛠️ Technical Stack

- **Frontend:** React, TypeScript
- **Styling:** Tailwind CSS
- **AI Services:** Google Gemini API, OpenAI API

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to check the [issues page](https://github.com/your-username/your-repo/issues) if you want to contribute.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
