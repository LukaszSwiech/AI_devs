/**
 * Handles interactions with OpenAI API
 * @class OpenAIHandler
 */
class OpenAIHandler {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.model = 'gpt-4o-mini';
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    }

    /**
     * Gets answer for a question using GPT-4o-mini
     * @param {string} question - The question to answer
     * @returns {Promise<string>} The model's answer
     */
    async getAnswer(question) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: `You are a precise assistant that only returns single values as answers. 
                            - Return only numbers, dates, or single words without any additional text
                            - Do not include explanations or full sentences
                            - If the question asks for a year, return only the year number
                            - If the question asks for a date, return only the date in format YYYY-MM-DD
                            - If the question asks for a number, return only the number
                            Examples:
                            Q: "What year was World War II started?" A: "1939"
                            Q: "When was the first iPhone released?" A: "2007"
                            Q: "How many planets are in the solar system?" A: "8"`
                        },
                        { role: 'user', content: question }
                    ],
                    temperature: 0.1  // Lower temperature for more focused answers
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`OpenAI API Error: ${data.error?.message || 'Unknown error'}`);
            }

            // Get the raw answer
            let answer = data.choices[0].message.content.trim();
            
            // Remove any quotes if they exist
            answer = answer.replace(/^["']|["']$/g, '');
            
            console.log('Raw GPT Answer:', answer);
            return answer;
        } catch (error) {
            console.error('Error getting answer from OpenAI:', error);
            throw error;
        }
    }
}

module.exports = OpenAIHandler;