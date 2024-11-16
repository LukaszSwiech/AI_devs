// Import required modules using ES module syntax
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file path (ES modules replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Function to detect if text is in English and translate if needed
async function translateIfEnglish(text) {
    try {
        // First, check if text needs translation
        const languageCheckResponse = await openai.chat.completions.create({
            model: "gpt-4-0125-preview",
            messages: [
                {
                    role: "user",
                    content: `Is this text in English? Only respond with 'yes' or 'no': "${text}"`
                }
            ],
            max_tokens: 10
        });

        const isEnglish = languageCheckResponse.choices[0].message.content.toLowerCase().includes('yes');

        // If text is in English, translate it
        if (isEnglish) {
            console.log('Detected English text, translating...');
            const translationResponse = await openai.chat.completions.create({
                model: "gpt-4-0125-preview",
                messages: [
                    {
                        role: "user",
                        content: `Translate this text to Polish: "${text}"`
                    }
                ],
                max_tokens: 500
            });
            return translationResponse.choices[0].message.content;
        }
        
        // If not English, return original text
        return text;
    } catch (error) {
        console.error('Error in translation:', error);
        return text; // Return original text in case of error
    }
}

// Main function to process directory
async function processDirectory(directoryPath) {
    try {
        // Read all files in the directory
        const files = fs.readdirSync(directoryPath);
        
        // Create array to store results
        const results = [];
        
        // Process each file
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const fileType = path.extname(file).toLowerCase();
            
            // Create base result object
            const result = {
                "file name": file,
                "text": "",
                "verification": false
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

                // Translate to Polish if the text is in English
                if (result.text) {
                    result.text = await translateIfEnglish(result.text);
                }
                
                // Mark as verified if we got text
                result.verification = result.text.length > 0;
                
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
            
            results.push(result);
        }
        
        // Display results in console
        console.table(results);
        return results;
        
    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
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
            max_tokens: 500
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