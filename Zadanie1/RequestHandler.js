/**
 * Class responsible for handling HTTP requests and coordinating with OpenAI
 * @class RequestHandler
 */
class RequestHandler {
    /**
     * Creates a new RequestHandler instance
     * @param {string} baseUrl - The base URL for making requests
     * @param {OpenAIHandler} openaiHandler - Instance of OpenAIHandler for GPT interactions
     */
    constructor(baseUrl, openaiHandler) {
        this.baseUrl = baseUrl;
        this.openaiHandler = openaiHandler;
        this.question = null;
        this.answer = null;
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
     */
    parseQuestion(htmlText) {
        const lines = htmlText.split('\n');
        const questionLine = lines.find(line => line.includes('human-question'));
        
        if (!questionLine) {
            throw new Error('Question not found in response');
        }

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
     * Gets answer from GPT-4o-mini for the current question
     * @returns {Promise<string>} The answer from GPT
     */
    async getGPTAnswer() {
        try {
            if (!this.question) {
                throw new Error('No question available to answer');
            }
            this.answer = await this.openaiHandler.getAnswer(this.question);
            console.log('GPT Answer:', this.answer);
            return this.answer;
        } catch (error) {
            console.error('Error getting GPT answer:', error);
            throw error;
        }
    }

    /**
     * Submits an answer to the server
     * @returns {Promise<string>} The server's response
     */
    async submitAnswer() {
        try {
            if (!this.answer) {
                throw new Error('No answer available to submit');
            }

            const params = {
                username: 'tester',
                password: '574e112a',
                answer: this.answer
            };

            const response = await this.makeRequest('POST', params);
            console.log('Submit response:', response);
            return response;
        } catch (error) {
            console.error('Error submitting answer:', error);
            throw error;
        }
    }

    /**
     * Handles the complete process:
     * 1. Get question from server
     * 2. Get answer from GPT
     * 3. Submit answer back to server
     * @returns {Promise<string>} The final response from the server
     */
    async processQuestionAndAnswer() {
        try {
            await this.getQuestion();
            await this.getGPTAnswer();
            return await this.submitAnswer();
        } catch (error) {
            console.error('Error in process:', error);
            throw error;
        }
    }
}

module.exports = RequestHandler;