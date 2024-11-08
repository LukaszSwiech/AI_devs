/**
 * Class responsible for handling HTTP requests to get questions and submit answers
 * @class RequestHandler
 */
class RequestHandler {
    /**
     * Creates a new RequestHandler instance
     * @param {string} baseUrl - The base URL for making requests (e.g., 'https://xyz.ag3nts.org/')
     */
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.question = null; // Stores the latest fetched question
    }

    /**
     * Makes an HTTP request to the specified URL
     * @param {string} method - The HTTP method to use ('GET' or 'POST')
     * @param {Object} params - Parameters to send with the request (for POST)
     * @returns {Promise<string>} The response text from the server
     */
    async makeRequest(method = 'GET', params = null) {
        try {
            // Prepare request options
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            };

            // Add body parameters for POST requests
            if (method === 'POST' && params) {
                options.body = new URLSearchParams(params);
            }

            // Make the request and get response
            const response = await fetch(this.baseUrl, options);
            return await response.text();

        } catch (error) {
            console.error(`Error making ${method} request:`, error);
            throw error;
        }
    }

    /**
     * Extracts the question text from HTML response
     * @param {string} htmlText - The HTML text to parse
     * @returns {string} The extracted question
     * @throws {Error} If question cannot be found or parsed
     */
    parseQuestion(htmlText) {
        // Split HTML into lines and find the line with question
        const lines = htmlText.split('\n');
        const questionLine = lines.find(line => line.includes('human-question'));
        
        if (!questionLine) {
            throw new Error('Question not found in response');
        }

        // Extract question text using regex
        const match = questionLine.match(/Question:<br \/>(.*?)<\/p>/);
        if (!match || !match[1]) {
            throw new Error('Could not parse question text');
        }

        return match[1].trim();
    }

    /**
     * Fetches and stores the question from the server
     * @returns {Promise<string>} The fetched question
     */
    async getQuestion() {
        try {
            // Get HTML response and parse question
            const htmlText = await this.makeRequest('GET');
            this.question = this.parseQuestion(htmlText);
            console.log('Fetched question:', this.question);
            return this.question;
        } catch (error) {
            console.error('Error getting question:', error);
            throw error;
        }
    }

    /**
     * Submits an answer to the server
     * @param {string} answer - The answer to submit
     * @returns {Promise<string>} The server's response
     */
    async submitAnswer(answer) {
        try {
            // Prepare parameters for submission
            const params = {
                username: 'tester',
                password: '574e112a',
                answer: answer
            };

            // Send POST request with answer
            const response = await this.makeRequest('POST', params);
            console.log('Submit response:', response);
            return response;
        } catch (error) {
            console.error('Error submitting answer:', error);
            throw error;
        }
    }

    /**
     * Handles the complete process of getting a question and submitting an answer
     * @returns {Promise<string>} The final response from the server
     */
    async processQuestionAndAnswer() {
        try {
            // Get the question first
            await this.getQuestion();
            // Then submit the answer
            // Note: '$answer' should be replaced with actual answer processing
            return await this.submitAnswer('$answer');
        } catch (error) {
            console.error('Error in process:', error);
            throw error;
        }
    }
}

// Export the class for use in other files
module.exports = RequestHandler;