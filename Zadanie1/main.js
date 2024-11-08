// Import the RequestHandler class from the other file
const RequestHandler = require('./RequestHandler');

/**
 * Main function to execute the question-answer process
 * This is the entry point of our application
 */
async function main() {
    try {
        // Create a new instance of RequestHandler with the target URL
        const handler = new RequestHandler('https://xyz.ag3nts.org/');

        // Process the complete flow of getting question and submitting answer
        const result = await handler.processQuestionAndAnswer();
        console.log('Process completed:', result);
    } catch (error) {
        // Handle any errors that occur during the process
        console.error('Process failed:', error);
    }
}

// Execute the main function
main();