// Import required modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import OpenAI from 'openai';
import axios from 'axios';

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

// Function to extract image URLs from text
function extractImageUrls(content) {
    const regex = /https:\/\/centrala\.ag3nts\.org[^\s"')]*\.png/g;
    return content.match(regex) || [];
}

// Function to convert image URL to base64
async function getImageAsBase64(imageUrl) {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer'
        });
        const base64 = Buffer.from(response.data).toString('base64');
        return base64;
    } catch (error) {
        console.error('Error downloading image:', error);
        return null;
    }
}

async function findRelevantParagraphs(paragraphsWithResztki) {
    try {
        const results = [];
        
        // Only analyze multiple paragraphs if we have more than one
        if (paragraphsWithResztki.length > 1) {
            for (const para of paragraphsWithResztki) {
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "Przeanalizuj tekst i oceń w skali 0-10, na ile prawdopodobne jest że zawiera on odpowiedź na pytanie o to, jakie resztki dania zostały pozostawione przez Rafała. Odpowiedz w formacie: 'OCENA: [liczba 0-10]\nUZASADNIENIE: [krótkie uzasadnienie]'"
                        },
                        {
                            role: "user",
                            content: `Tytuł sekcji: ${para.title}\n\nTreść:\n${para.content}`
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 100
                });

                const answer = response.choices[0].message.content.trim();
                
                const scoreMatch = answer.match(/OCENA:\s*(\d+)/);
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1]);
                    if (score > 0) {
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
            return results.length > 0 ? results[0] : null;
        } else {
            // If only one paragraph, return it directly
            return paragraphsWithResztki[0];
        }
    } catch (error) {
        console.error('Error finding relevant paragraph:', error);
        throw error;
    }
}

async function getAnswerFromParagraph(paragraph) {
    try {
        // Check for images in the paragraph
        const imageUrls = extractImageUrls(paragraph.content);
        
        if (imageUrls.length > 0) {
            // If there's an image, use it with context
            const base64Image = await getImageAsBase64(imageUrls[0]);
            
            if (!base64Image) {
                throw new Error('Failed to download image');
            }

            const response = await openai.chat.completions.create({
                model: "gpt-4o",  // Using gpt-4o
                messages: [
                    {
                        role: "system",
                        content: "Przeanalizuj obraz i kontekst, aby odpowiedzieć na pytanie o resztki dania pozostawione przez Rafała. Odpowiedz jednym krótkim zdaniem."
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Kontekst:\n${paragraph.content}\n\nPytanie: Resztki jakiego dania zostały pozostawione przez Rafała?`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500
            });

            return response.choices[0].message.content.trim();
        } else {
            // If no image, just analyze text
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Odpowiedz jednym krótkim zdaniem na pytanie o resztki dania pozostawione przez Rafała."
                    },
                    {
                        role: "user",
                        content: `Kontekst:\n${paragraph.content}\n\nPytanie: Resztki jakiego dania zostały pozostawione przez Rafała?`
                    }
                ],
                temperature: 0.1,
                max_tokens: 100
            });

            return response.choices[0].message.content.trim();
        }
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

        // Filter paragraphs that contain word "resztki"
        const paragraphsWithResztki = [];
        for (const file of paragraphFiles) {
            const content = await fs.readFile(path.join(paragraphsDir, file), 'utf8');
            
            if (content.toLowerCase().includes('resztki')) {
                const title = content.split('\n')[0]; // First line is the title
                paragraphsWithResztki.push({
                    title,
                    content,
                    file
                });
            }
        }

        console.log(`Found ${paragraphsWithResztki.length} paragraphs containing "resztki"`);

        if (paragraphsWithResztki.length === 0) {
            console.log('No paragraphs found containing "resztki"');
            return null;
        }

        // Find the most relevant paragraph
        const relevantParagraph = await findRelevantParagraphs(paragraphsWithResztki);

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
            questionId: "04",
            answer: answer,
            source_file: relevantParagraph.file
        };

        const answerPath = path.join(answersDir, 'answer04.json');
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