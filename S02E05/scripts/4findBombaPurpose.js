// Import required modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import OpenAI from 'openai';

// Setup directory path and load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Setup directories
const dataDir = path.join(dirname(__dirname), 'data');
const markdownDir = path.join(dataDir, 'markdown');
const paragraphsDir = path.join(markdownDir, 'paragraphs');
const answersDir = path.join(dataDir, 'answers');
fs.ensureDirSync(answersDir);

async function findRelevantParagraph(paragraphsWithBomba) {
    try {
        const results = [];
        
        // Analyze all paragraphs and collect their relevance scores
        for (const para of paragraphsWithBomba) {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",  // Using gpt-4o
                messages: [
                    {
                        role: "system",
                        content: "Przeanalizuj tekst i oceń w skali 0-10, na ile prawdopodobne jest że zawiera on odpowiedź na pytanie o to, co Bomba chciał znaleźć w Grudziądzu. Dodatkowo krótko uzasadnij ocenę. Odpowiedz w formacie: 'OCENA: [liczba 0-10]\nUZASADNIENIE: [krótkie uzasadnienie]'"
                    },
                    {
                        role: "user",
                        content: `Tytuł sekcji: ${para.title}\n\nTreść:\n${para.content}`
                    }
                ],
                temperature: 0.5,
                max_tokens: 200
            });

            const answer = response.choices[0].message.content.trim();
            
            // Extract score from the response
            const scoreMatch = answer.match(/OCENA:\s*(\d+)/);
            if (scoreMatch) {
                const score = parseInt(scoreMatch[1]);
                if (score > 0) {  // If there's any relevance at all
                    results.push({
                        ...para,
                        score: score,
                        analysis: answer
                    });
                    console.log(`Found potentially relevant paragraph (score ${score}/10):`);
                    console.log(`File: ${para.file}`);
                    console.log(`Analysis: ${answer}\n`);
                }
            }
        }

        // Sort results by score in descending order
        results.sort((a, b) => b.score - a.score);

        // Return the paragraph with highest score or null if none found
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error('Error finding relevant paragraph:', error);
        throw error;
    }
}

async function getAnswerFromParagraph(paragraph) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",  // Using gpt-4o
            messages: [
                {
                    role: "system",
                    content: "Odpowiedz jednym krótkim zdaniem na pytanie, co Bomba chciał znaleźć w Grudziądzu, bazując na podanym tekście."
                },
                {
                    role: "user",
                    content: `Kontekst:\n${paragraph.content}\n\nPytanie: Co Bomba chciał znaleźć w Grudziądzu?`
                }
            ],
            temperature: 0.1,
            max_tokens: 100
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error getting answer from paragraph:', error);
        throw error;
    }
}

async function processQuestion() {
    try {
        // Get list of all paragraph files
        const files = await fs.readdir(paragraphsDir);
        const paragraphFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('00_'));

        console.log(`Analyzing ${paragraphFiles.length} paragraphs...`);

        // Filter paragraphs that contain word "Bomba"
        const paragraphsWithBomba = [];
        for (const file of paragraphFiles) {
            const content = await fs.readFile(path.join(paragraphsDir, file), 'utf8');
            
            if (content.includes('Bomba')) {
                const title = content.split('\n')[0]; // First line is the title
                paragraphsWithBomba.push({
                    title,
                    content,
                    file
                });
            }
        }

        console.log(`Found ${paragraphsWithBomba.length} paragraphs containing "Bomba"`);

        // Find the most relevant paragraph
        const relevantParagraph = await findRelevantParagraph(paragraphsWithBomba);

        if (!relevantParagraph) {
            console.log('No relevant paragraph found');
            return null;
        }

        console.log(`Found relevant paragraph in file: ${relevantParagraph.file}`);

        // Get final answer
        const answer = await getAnswerFromParagraph(relevantParagraph);
        console.log('Final answer:', answer);

        // Save the answer
        const answerObj = {
            questionId: "03",
            answer: answer,
            source_file: relevantParagraph.file
        };

        const answerPath = path.join(answersDir, 'answer03.json');
        await fs.writeJson(answerPath, answerObj, { spaces: 2 });
        console.log('Answer saved to:', answerPath);

        return answerPath;
    } catch (error) {
        console.error('Error processing question:', error);
        throw error;
    }
}

// Execute the main function
processQuestion()
    .then(filePath => {
        if (filePath) {
            console.log('Script completed successfully. Answer saved at:', filePath);
        } else {
            console.log('Script completed but no relevant information was found.');
        }
    })
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });