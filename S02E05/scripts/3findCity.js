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

async function findRelevantParagraph(paragraphsWithImages) {
    try {
        const results = [];
        
        for (const para of paragraphsWithImages) {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",  // Using gpt-4o-mini
                messages: [
                    {
                        role: "system",
                        content: "Przeanalizuj tekst i oceń, czy może zawierać odpowiedź na pytanie o miasto, w którym wykonano testową fotografię użytą podczas testu przesyłania multimediów. Odpowiedz tylko: 'TAK - PRAWDOPODOBNIE TUTAJ JEST ODPOWIEDŹ' lub 'NIE - BRAK INFORMACJI'."
                    },
                    {
                        role: "user",
                        content: `Tytuł sekcji: ${para.title}\n\nTreść:\n${para.content}`
                    }
                ],
                temperature: 0.5,
                max_tokens: 1000
            });

            const answer = response.choices[0].message.content.trim();
            
            if (answer.startsWith('TAK')) {
                results.push({
                    ...para,
                    confidence: answer
                });
            }
        }

        // Return the most promising paragraph or null if none found
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        console.error('Error finding relevant paragraph:', error);
        throw error;
    }
}

async function getAnswerFromParagraph(paragraph) {
    try {
        // Extract the first image URL
        const imageUrls = extractImageUrls(paragraph.content);
        if (imageUrls.length === 0) {
            throw new Error('No images found in the paragraph');
        }

        const firstImageUrl = imageUrls[0];
        const base64Image = await getImageAsBase64(firstImageUrl);

        if (!base64Image) {
            throw new Error('Failed to download image');
        }

        // Get answer using GPT-4 with image and context
        const response = await openai.chat.completions.create({
            model: "gpt-4o",  // Using gpt-4 for image analysis as requested
            messages: [
                {
                    role: "system",
                    content: "Przeanalizuj obraz i kontekst, aby odpowiedzieć na pytanie o miasto, w którym wykonano testową fotografię. Odpowiedz jednym krótkim zdaniem."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Kontekst:\n${paragraph.content}\n\nPytanie: Na rynku którego miasta wykonano testową fotografię użytą podczas testu przesyłania multimediów?`
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

        // Filter paragraphs that contain PNG images
        const paragraphsWithImages = [];
        for (const file of paragraphFiles) {
            const content = await fs.readFile(path.join(paragraphsDir, file), 'utf8');
            const imageUrls = extractImageUrls(content);
            
            if (imageUrls.length > 0) {
                const title = content.split('\n')[0]; // First line is the title
                paragraphsWithImages.push({
                    title,
                    content,
                    file
                });
            }
        }

        console.log(`Found ${paragraphsWithImages.length} paragraphs with images`);

        // Find the most relevant paragraph
        const relevantParagraph = await findRelevantParagraph(paragraphsWithImages);

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
            questionId: "02",
            answer: answer,
            source_file: relevantParagraph.file
        };

        const answerPath = path.join(answersDir, 'answer02.json');
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