// Import required modules
import fs from "fs";
import path from "path";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI();

// Store all transcriptions in an object where keys are file names
const transcriptions = {};

async function processAudioFiles() {
    try {
        // Define the directory path
        const directoryPath = "D:/AI_devs/S02E01/audio";

        // Read all files from the directory
        const files = fs.readdirSync(directoryPath);

        // Filter only .m4a files
        const audioFiles = files.filter(file => path.extname(file).toLowerCase() === '.m4a');

        console.log(`Found ${audioFiles.length} .m4a files to process`);

        // Process each audio file
        for (const file of audioFiles) {
            try {
                // Get the base name of the file without extension to use as variable name
                const variableName = path.basename(file, '.m4a');
                
                console.log(`Processing ${file}...`);

                // Create the full file path
                const filePath = path.join(directoryPath, file);

                // Get transcription from OpenAI
                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(filePath),
                    model: "whisper-1",
                });

                // Store the transcription in our object using the file name as key
                transcriptions[variableName] = transcription.text;

                console.log(`✓ Completed transcription for ${file}`);
            } catch (error) {
                console.error(`Error processing file ${file}:`, error.message);
            }
        }

        // Log all transcriptions
        console.log("\nTranscriptions:");
        for (const [filename, text] of Object.entries(transcriptions)) {
            console.log(`\n${filename}:`);
            console.log(text);
        }

        // Optionally, save transcriptions to a JSON file for later use
        fs.writeFileSync(
            path.join(directoryPath, 'transcriptions.json'), 
            JSON.stringify(transcriptions, null, 2)
        );
        console.log('\nTranscriptions have been saved to transcriptions.json');

    } catch (error) {
        console.error("Error accessing directory:", error.message);
    }
}

// Run the main process
processAudioFiles();