// Import required dependencies
import OpenAI from 'openai';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

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
 * Analyzes an image using OpenAI's Vision model
 * @param {string} imagePath - Path to the image file
 * @param {string} prompt - Question or prompt about the image
 * @returns {Promise<Object>} OpenAI API response
 */
async function analyzeImage(imagePath, prompt = "This image shows a picture of a piece of map. It is probably from some Polish city. You can read the names of the streets, and some other info like bus stops, cementary etc. Which city is this piece of map from? Return only the name of the city.") {
    try {
        // Get base64 encoded image
        const base64Image = await encodeImage(imagePath);

        // Create the API request
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",  // Current model name for vision tasks
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 300
        });

        return response.choices[0].message.content;  // Return just the content for simplicity
    } catch (error) {
        console.error('Error analyzing image:', error);
        throw error;
    }
}

// Example usage with proper error handling
const main = async () => {
    try {
        // Update this path to point to your actual image
        const imagePath = "S02E02/map1.png";
        console.log('Analyzing image:', imagePath);
        
        const result = await analyzeImage(imagePath);
        console.log('Analysis result:', result);
    } catch (error) {
        console.error('Main execution error:', error);
        process.exit(1);
    }
};

// Check if this file is being run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export { analyzeImage, encodeImage };