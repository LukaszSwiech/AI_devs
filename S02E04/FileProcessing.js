// Import required modules
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// First set up the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Then use it to configure dotenv
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Add classification function
async function classifyText(text) {
    try {
        const classificationPrompt = `As a security and maintenance data analyst, you need to strictly classify text for evidence of either human infiltrators or confirmed hardware repairs. 

CLASSIFICATION RULES:

1. "PEOPLE" category - If text contains ANY of these:
   - Confirmation of captured/arrested individuals
   - Physical evidence of identified intruders (even if not caught)
   - Confirmed traces of specific individuals (like matched fingerprints)
   - Clear evidence linking human infiltration to specific persons
   DO NOT classify as PEOPLE if:
   - People were only searched for but nothing was found
   - Text just mentions regular staff or workers
   - General human activity without evidence of infiltration

2. "HARDWARE" category - ONLY if text contains:
   - Confirmed physical repairs of equipment
   - Fixed hardware malfunctions
   - Completed hardware maintenance
   DO NOT classify as HARDWARE if:
   - Equipment was only tampered with but not repaired
   - Software-related issues
   - Planned or future repairs
   - General equipment mentions without repairs

3. "BOTH" - ONLY if BOTH conditions are met:
   - Evidence of human infiltration or captures AND
   - Confirmed hardware repairs

4. "IRRELEVANT" - Use for everything else, including:
   - Failed searches without evidence
   - General observations
   - Software issues
   - Planned activities
   - General staff communications

Respond with a JSON object in the following format:
{
    "category": "PEOPLE" | "HARDWARE" | "BOTH" | "IRRELEVANT",
    "explanation": "Brief explanation of why this classification was chosen"
}

The text to analyze: "${text}"`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a strict security analyst that always responds in JSON format and follows classification rules exactly."
                },
                {
                    role: "user",
                    content: classificationPrompt
                }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
            max_tokens: 500
        });

        const result = JSON.parse(response.choices[0].message.content);
        return result.category;
    } catch (error) {
        console.error('Error in classification:', error);
        return 'IRRELEVANT';
    }
}

// Function to send results to centrala
async function sendToCentrala(results) {
    try {
        // Create categorized lists
        const categorizedFiles = {
            people: results
                .filter(result => result.verification === 'PEOPLE' || result.verification === 'BOTH')
                .map(result => result["file name"])
                .sort(),
            hardware: results
                .filter(result => result.verification === 'HARDWARE' || result.verification === 'BOTH')
                .map(result => result["file name"])
                .sort()
        };

        // Create final payload
        const payload = {
            task: "kategorie",
            apikey: process.env.APIKEY,
            answer: categorizedFiles
        };

        console.log('\nSending payload to centrala:', JSON.stringify(payload, null, 2));
        console.log('Server URL:', process.env.SERVER_URL);

        // Send to centrala
        const response = await fetch(process.env.SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // Log the response status and headers
        console.log('\nResponse status:', response.status);
        console.log('Response headers:', response.headers);

        // Get the response text once
        const responseText = await response.text();
        
        console.log('\nRaw response from server:', responseText);  // Added this line

        // Check if response is ok
        if (!response.ok) {
            console.error('Error response body:', responseText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Try to parse JSON response
        try {
            const responseData = JSON.parse(responseText);
            console.log('\n=== Response from centrala ===');
            console.log('Status:', response.status);
            console.log('Response:', JSON.stringify(responseData, null, 2));
            console.log('===========================\n');
            return responseData;
        } catch (parseError) {
            console.error('Failed to parse JSON response. Raw response:', responseText);
            throw new Error('Invalid JSON response from server');
        }

    } catch (error) {
        console.error('Error sending to centrala:', error);
        console.error('Full error details:', error.message);
        throw error;
    }
}

// Main function to process directory
async function processDirectory(directoryPath) {
    try {
        const files = fs.readdirSync(directoryPath);
        const results = [];
        
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const fileType = path.extname(file).toLowerCase();
            
            const result = {
                "file name": file,
                "text": "",
                "verification": "IRRELEVANT" // Default value
            };

            try {
                // Process based on file type
                switch (fileType) {
                    case '.txt':
                        result.text = await processTxtFile(filePath);
                        break;
                    case '.mp3':
                        result.text = await processAudioFile(filePath);
                        break;
                    case '.png':
                        result.text = await processImageFile(filePath);
                        break;
                    default:
                        console.log(`Unsupported file type: ${fileType}`);
                        continue;
                }

                // Translate if English
                if (result.text) {
                    // Classify the translated text
                    result.verification = await classifyText(result.text);
                }
                
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
            
            results.push(result);
        }
        
        // Display results
        console.log('\nProcessed Files Results:');
        console.log('======================\n');
        
        results.forEach((result, index) => {
            console.log(`File ${index + 1}: ${result["file name"]}`);
            console.log('Text:', result.text);
            console.log('Category:', result.verification);
            console.log('----------------------\n');
        });

        // Send results to centrala
        await sendToCentrala(results);
        
    } catch (error) {
        console.error('Error in processing:', error);
        throw error;
    }
}

// Function to process text files
async function processTxtFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error('Error reading text file:', error);
        return '';
    }
}

// Function to process audio files using Whisper
async function processAudioFile(filePath) {
    try {
        const audioFile = fs.createReadStream(filePath);
        
        const transcript = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
        });
        
        return transcript.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        return '';
    }
}

// Function to process image files using GPT-4o
async function processImageFile(filePath) {
    try {
        // Read image file and convert to base64
        const imageBuffer = fs.readFileSync(filePath);
        const base64Image = imageBuffer.toString('base64');
        
        // Create API request with GPT-4o
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Extract the content of the 'REPAIR NOTE' without extracting FROM and APPROVED BY parts. If text is written in English then translate it to Polish language"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000
        });
        
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error processing image:', error);
        return '';
    }
}

// Execute the script
const directoryPath = 'D:\\AI_devs\\S02E04\\PLIKI_Z_FABRYKI';
processDirectory(directoryPath)
    .then(() => console.log('Processing complete'))
    .catch(error => console.error('Error:', error));