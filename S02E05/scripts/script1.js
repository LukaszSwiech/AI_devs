// Import required modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import axios from 'axios';
import OpenAI from 'openai';

// Setup directory path and load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Create necessary directories
const dataDir = path.join(dirname(__dirname), 'data');
const markdownDir = path.join(dataDir, 'markdown');
fs.ensureDirSync(markdownDir);

async function findMp3Link(content) {
    // Regular expression to find URLs that start with https://centrala.ag3nts.org and end with .mp3
    const regex = /https:\/\/centrala\.ag3nts\.org[^\s"')]*\.mp3/g;
    const matches = content.match(regex);
    return matches ? matches[0] : null;
}

async function getTranscription(audioUrl) {
    try {
        // First, download the audio file
        const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        const audioBuffer = Buffer.from(response.data);

        // Create a temporary file to store the audio
        const tempFilePath = path.join(dataDir, 'temp_audio.mp3');
        await fs.writeFile(tempFilePath, audioBuffer);

        // Use OpenAI's Whisper model through GPT-4 to get transcription
        const audioFile = await fs.readFile(tempFilePath);
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: "pl"
        });

        // Clean up temporary file
        await fs.remove(tempFilePath);

        return transcription.text;
    } catch (error) {
        console.error('Error getting transcription:', error);
        throw error;
    }
}

async function downloadAndSaveContent() {
    try {
        // Construct the URL using environment variables
        const baseUrl = `${process.env.SERVER_URL}/dane/arxiv-draft.html`;
        const url = `https://r.jina.ai/${baseUrl}`;
        
        console.log('Downloading content from:', url);
        
        // Make the HTTP request to get the content
        const response = await axios.get(url);
        let markdownContent = response.data;
        
        // Find MP3 link
        const mp3Link = await findMp3Link(markdownContent);
        if (mp3Link) {
            console.log('Found MP3 link:', mp3Link);
            
            // Get transcription
            console.log('Getting transcription...');
            const transcription = await getTranscription(mp3Link);
            console.log('Transcription received:', transcription);
            
            // Add transcription above the MP3 link
            markdownContent = markdownContent.replace(
                mp3Link,
                `\n\nTranskrypcja nagrania:\n${transcription}\n\n${mp3Link}`
            );
        }
        
        // Define the output file path
        const outputFile = path.join(markdownDir, 'arxiv-draft.md');
        
        // Save the updated content to a markdown file
        await fs.writeFile(outputFile, markdownContent, 'utf8');
        
        console.log('Content successfully downloaded and saved to:', outputFile);
        
        return outputFile;
    } catch (error) {
        console.error('Error downloading or saving content:', error);
        throw error;
    }
}

// Execute the main function
downloadAndSaveContent()
    .then(filePath => console.log('Script completed successfully. File saved at:', filePath))
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });