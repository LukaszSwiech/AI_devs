// Suppress the specific punycode deprecation warning
process.removeListener('warning', console.warn);
process.on('warning', (warning) => {
    if (warning.name !== 'DeprecationWarning' || !warning.message.includes('punycode')) {
        console.warn(warning);
    }
});

// Import required dependencies
import OpenAI from 'openai';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Initialize OpenAI client
const client = new OpenAI();

/**
 * Converts an image file to base64 string
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} Base64 encoded image string
 */
async function encodeImage(imagePath) {
    try {
        // Read the image file as a buffer
        const imageBuffer = await fs.readFile(imagePath);
        // Convert buffer to base64 string
        return imageBuffer.toString('base64');
    } catch (error) {
        console.error('Error reading image:', error);
        throw error;
    }
}

/**
 * Analyzes multiple images in a single API call
 * @param {string[]} imagePaths - Array of paths to image files
 * @returns {Promise<string>} OpenAI API response
 */
async function analyzeImages(imagePaths) {
    try {
        // Encode all images
        console.log('Encoding images...');
        const encodedImages = await Promise.all(
            imagePaths.map(async (imagePath) => {
                const base64Image = await encodeImage(imagePath);
                return {
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`
                    }
                };
            })
        );

        // Create content array with prompt and all images
        const content = [
            {
                type: "text",
                text: "Na podstawie dostarczonych fragmentów mapy, określ, z jakiego miasta one pochodzą. Trzy z nich dotycza tego samego miasta. Czwarty znalazl sie tam przypadkiem i pochodzi\
                 z innego miasta, ktore nas nie interesuje. W tym miescie ktorego szukamy sa jakies spichlerze i twierdze.\
                 Przed zwroceniem odpowiedzi, sprawdz, czy na pewno w wybranym miescie wystepuja wszystkie ulice odczytane z map. Sprawdz czy na pewno sie one przecinaja, dokladnie tak samo jak\
                 zaprezentowano na mapie. \
                 Sprawdz czy wystepuja wszystkie obiekty opisane na mapie (takie jak cmentarz, lewiatan itp). Zwroc nazwe miasta, z ktorego pochodza trzy z czterech prezentowanych fragmentow. Zaprezentuj swoj sposob myslenia."
            },
            ...encodedImages
        ];

        console.log('Sending request to OpenAI...');
        // Create the API request with all images
        const response = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ],
            max_tokens: 1000
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error analyzing images:', error);
        throw error;
    }
}

// Example usage with proper error handling
const main = async () => {
    try {
        // Define all image paths
        const imagePaths = [
            'S02E02/map1.png',
            'S02E02/map2.png',
            'S02E02/map3.png',
            'S02E02/map4.png'
        ];
        
        console.log('Starting batch analysis of maps...\n');
        const result = await analyzeImages(imagePaths);
        
        // Print results
        console.log('\nAnalysis Results:');
        console.log(result);
        
    } catch (error) {
        console.error('Main execution error:', error);
        process.exit(1);
    }
};

// Check if this file is being run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export { analyzeImages, encodeImage };