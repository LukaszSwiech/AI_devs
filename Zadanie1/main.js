// Load environment variables from .env file
require('dotenv').config();

const RequestHandler = require('./RequestHandler');
const OpenAIHandler = require('./OpenAIHandler');

/**
 * Main function to execute the complete question-answer process
 */
async function main() {
    try {
        // Use API key from environment variables
        const openaiHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        
        // Create RequestHandler with OpenAI handler
        const handler = new RequestHandler(process.env.SERVER_URL, openaiHandler);
        // Process the complete flow
        const result = await handler.processQuestionAndAnswer();
        console.log('Process completed:', result);
    } catch (error) {
        console.error('Process failed:', error);
    }
}

main();