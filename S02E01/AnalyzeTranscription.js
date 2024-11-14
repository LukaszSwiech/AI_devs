// Import required modules
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // You might need to install this: npm install node-fetch

// Setup __dirname equivalent for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize OpenAI client
const openai = new OpenAI();

async function sendToServer(answer) {
    // Get server URL from environment variables
    const serverUrl = process.env.SERVER_URL || 'https://centrala.ag3nts.org/report';
    
    try {
        // Prepare the request body
        const requestBody = {
            task: "mp3",
            apikey: process.env.APIKEY,
            answer: answer
        };

        // Make the POST request
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        // Parse and log the response
        const responseData = await response.json();
        console.log('\nServer Response:', responseData);

        return responseData;
    } catch (error) {
        console.error('Error sending data to server:', error);
        throw error;
    }
}

async function analyzeTranscriptions() {
    try {
        // Define the path to transcriptions.json
        const filePath = "D:/AI_devs/S02E01/audio/transcriptions.json";

        // Read and parse the JSON file
        const transcriptionsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Combine all transcriptions into a single text
        const allTranscriptions = Object.entries(transcriptionsData)
            .map(([filename, text]) => `Zeznanie z nagrania ${filename}:\n${text}`)
            .join('\n\n');

        // Construct the prompt with the question and transcriptions
        const prompt = `Na jakiej ulicy znajduje się uczelnia, na której wykłada Andrzej Maj. Poniżej znajdziesz zeznania kilku osób:

${allTranscriptions}`;

        // Make the API call to GPT-4
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0, // Using 0 for more focused, deterministic response
        });

        // Extract the response
        const gptResponse = completion.choices[0].message.content;
        
        console.log("\nPytanie:");
        console.log("Na jakiej ulicy znajduje się uczelnia, na której wykłada Andrzej Maj?");
        console.log("\nOdpowiedź GPT-4:");
        console.log(gptResponse);

        // Send the response to the server
        console.log("\nWysyłanie odpowiedzi do serwera...");
        await sendToServer(gptResponse);

    } catch (error) {
        // Handle potential errors
        if (error.code === 'ENOENT') {
            console.error("Nie znaleziono pliku transcriptions.json");
        } else {
            console.error("Wystąpił błąd:", error.message);
        }
    }
}

// Run the analysis
analyzeTranscriptions();