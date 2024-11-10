const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs').promises;
const axios = require('axios');

const requiredEnvVars = {
    'JSON_PATH': process.env.JSON_PATH,
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'SERVER_URL': process.env.SERVER_URL,
    'APIKEY': process.env.APIKEY
};

// Validate all required environment variables
Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
});

function validateArithmetic(jsonContent) {
    let changedLines = 0;
    
    // Process each entry in test-data array
    for (const entry of jsonContent['test-data']) {
        if (entry.question && entry.answer !== undefined) {
            // Extract numbers from question
            const numbers = entry.question.match(/\d+/g).map(Number);
            
            // Calculate the sum
            const correctSum = numbers.reduce((a, b) => a + b, 0);
            
            // Compare with the given answer
            if (entry.answer !== correctSum) {
                console.log(`Found incorrect sum in question: "${entry.question}"`);
                console.log(`Given answer: ${entry.answer}, Correct sum: ${correctSum}`);
                entry.answer = correctSum;
                changedLines++;
            }
        }
    }
    
    console.log(`\nArithmetic validation complete:`);
    console.log(`- Fixed ${changedLines} incorrect sums`);
    
    return changedLines;
}

class OpenAIHandler {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }
        this.apiKey = apiKey;
        this.model = 'gpt-4o-mini';
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async getAnswer(question) {
        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: this.model,
                    messages: [
                        {
                            role: "system",
                            content: `You are a precise assistant that only returns single values as answers. 
                            - Return only numbers, dates, or single words without any additional text
                            - Do not include explanations or full sentences
                            - If the question asks for a year, return only the year number
                            - If the question asks for a date, return only the date in format YYYY-MM-DD
                            - If the question asks for a number, return only the number
                            Examples:
                            Q: "What is the capital city of France??" A: "Paris"
                            Q: "name of the 2020 USA president?" A: "Biden"
                            Q: "What is the capital city of Germany?" A: "Berlin"
                            Q: "What is the capital city of Poland?" A: "Warsaw"`
                        },
                        {
                            role: "user",
                            content: question
                        }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0].message.content.trim();
        } catch (error) {
            console.error('Error getting answer from OpenAI:', error.message);
            if (error.response) {
                console.error('OpenAI API response:', error.response.data);
            }
            throw error;
        }
    }
}

function restructureJson(jsonContent, apiKey) {
    const originalContent = { ...jsonContent };
    
    // Create new structure
    return {
        task: "JSON",
        apikey: apiKey,
        answer: {
            apikey: apiKey,
            description: originalContent.description,
            copyright: originalContent.copyright,
            "test-data": originalContent["test-data"]
        }
    };
}

async function sendToServer(jsonContent) {
    try {
        console.log('\nSending data to server...');
        const response = await axios.post(requiredEnvVars.SERVER_URL, jsonContent, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Server response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending data to server:', error.message);
        if (error.response) {
            console.error('Server response:', error.response.data);
        }
        throw error;
    }
}

async function processJsonFile() {
    try {
        const data = await fs.readFile(requiredEnvVars.JSON_PATH, 'utf8');
        let jsonContent = JSON.parse(data);
        const openAI = new OpenAIHandler(requiredEnvVars.OPENAI_API_KEY);
        let questionsProcessed = 0;

        // First validate and fix arithmetic
        const fixedSums = validateArithmetic(jsonContent);
        console.log(`Fixed ${fixedSums} arithmetic errors`);

        // Then process OpenAI questions
        for (let i = 0; i < jsonContent['test-data'].length; i++) {
            const entry = jsonContent['test-data'][i];
            
            if (entry.test && entry.test.q && entry.test.a === "???") {
                try {
                    // Get answer from OpenAI
                    const question = entry.test.q;
                    console.log('\nProcessing question:', question);
                    
                    const answer = await openAI.getAnswer(question);
                    console.log('Received answer:', answer);
                    
                    // Update the answer in the JSON
                    entry.test.a = answer;
                    questionsProcessed++;
                    
                    // Add a small delay to respect API rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Failed to process question at index ${i}:`, error.message);
                }
            }
        }

        // Restructure the JSON with the new format and API key
        const restructuredJson = restructureJson(jsonContent, requiredEnvVars.APIKEY);

        // Save updated JSON to new file
        const outputPath = path.join(path.dirname(requiredEnvVars.JSON_PATH), 'JsonAnswers.json');
        await fs.writeFile(
            outputPath,
            JSON.stringify(restructuredJson, null, 4),
            'utf8'
        );

        console.log(`\nProcessing complete:`);
        console.log(`- Arithmetic errors fixed: ${fixedSums}`);
        console.log(`- OpenAI questions processed: ${questionsProcessed}`);
        console.log(`- Updated JSON saved to: JsonAnswers.json`);

        // Send to server
        await sendToServer(restructuredJson);

        return { fixedSums, questionsProcessed };

    } catch (error) {
        console.error('Error processing file:', error);
        throw error;
    }
}

// Execute the processing
processJsonFile()
    .then(result => {
        console.log(`\nProcessing summary:`);
        console.log(`- Fixed ${result.fixedSums} arithmetic errors`);
        console.log(`- Processed ${result.questionsProcessed} OpenAI questions`);
    })
    .catch(error => {
        console.error('Processing failed:', error);
        process.exit(1);
    });