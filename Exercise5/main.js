const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Axios instance with default config
const axiosInstance = axios.create({
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APIKEY}` // Add Authorization header
    }
});

// Add retry logic
axiosInstance.interceptors.response.use(undefined, async (err) => {
    const { config } = err;
    if (!config || !config.retry) {
        return Promise.reject(err);
    }
    config.retry -= 1;
    const delayRetry = new Promise(resolve => setTimeout(resolve, 1000));
    await delayRetry;
    return axiosInstance(config);
});

class OpenAIHandler {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }
        this.apiKey = apiKey;
        this.model = 'gpt-4o-mini';
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async processText(text) {
        try {
            const response = await axiosInstance.post(
                this.apiUrl,
                {
                    model: this.model,
                    messages: [{
                        role: 'user',
                        content: `Replace any sensitive data (name + surname, street name + number, city, age of the person with the word 'CENZURA'. If there are two sensitive words in a row then insert only one 'CENZURA' for both of them. Take care of every full stop, comma, space, etc. You must not rewrite the text.\n\n${text}`
                    }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    retry: 3
                }
            );
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Error processing text with OpenAI:', error.response?.data || error.message);
            throw error;
        }
    }
}

async function fetchInitialData() {
    try {
        // Construct URL using URL class for better safety and encoding
        const baseUrl = 'https://centrala.ag3nts.org/data';
        const url = `${baseUrl}/${encodeURIComponent(process.env.APIKEY)}/cenzura.txt`;
        
        console.log('Fetching data from:', url.replace(process.env.APIKEY, '****')); // Log URL with hidden APIKEY
        
        const response = await axiosInstance.get(
            url,
            {
                retry: 3,
                headers: {
                    'Accept': 'text/plain',
                    'X-Custom-Auth': process.env.CUSTOM_AUTH_TOKEN,
                    'X-Client-ID': process.env.CLIENT_ID
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching initial data:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers
        });
        throw error;
    }
}

async function sendFinalData(data) {
    try {
        console.log('\nPreparing to send final data to server...');
        console.log('Server URL:', process.env.SERVER_URL);
        console.log('Final Request Payload:', JSON.stringify(data, null, 2));
        const response = await axiosInstance.post(
            process.env.SERVER_URL,
            data,
            {
                retry: 3,
                headers: {
                    'X-Custom-Auth': process.env.CUSTOM_AUTH_TOKEN,
                    'X-Client-ID': process.env.CLIENT_ID
                }
            }
        );
        
        // Log the server response
        console.log('\n------ Server Response ------');
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Headers:', JSON.stringify(response.headers, null, 2));
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
        console.log('--------------------------');
        
        return response.data;
    } catch (error) {
        console.error('Error sending final data:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers
        });
        throw error;
    }
}

async function main() {
    try {
        // Fetch initial data
        console.log('Fetching initial data...');
        const initialText = await fetchInitialData();
        console.log('Initial data received');

        // Process text with OpenAI
        console.log('Processing text with OpenAI...');
        const openAIHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        const processedText = await openAIHandler.processText(initialText);
        console.log('Text processing completed');

        // Prepare final JSON
        const finalJson = {
            "task": "CENZURA",
            "apikey": process.env.APIKEY,
            "answer": processedText
        };

        // Send to SERVER_URL
        console.log('Sending final data...');
        await sendFinalData(finalJson);
        console.log('Process completed successfully');
    } catch (error) {
        console.error('Error in main process:', error.message);
        throw error;
    }
}

// Example .env file content:
/*
OPENAI_API_KEY=your_openai_api_key_here
SERVER_URL=your_server_url_here
APIKEY=your_api_key_here
CUSTOM_AUTH_TOKEN=your_custom_auth_token_here
CLIENT_ID=your_client_id_here
*/

main().catch(console.error);