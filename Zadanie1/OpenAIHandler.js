/**
 * Handles interactions with OpenAI API
 * @class OpenAIHandler
 */
class OpenAIHandler {
    /**
     * Creates a new OpenAIHandler instance
     * @param {string} apiKey - OpenAI API key
     */
    constructor(apiKey) {
        this.apiKey = process.env.OPENAI_API_KEY;
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
                        { role: 'system', content: 'You are a helpful assistant.' },
                        { role: 'user', content: question }
                    ]
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(`OpenAI API Error: ${data.error?.message || 'Unknown error'}`);
            }

            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('Error getting answer from OpenAI:', error);
            throw error;
        }
    }
}

module.exports = OpenAIHandler;
