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

async function analyzeImage(imageUrl, paragraphTitle, paragraphContent) {
    try {
        const base64Image = await getImageAsBase64(imageUrl);
        if (!base64Image) return 'BŁĄD OBRAZU';

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Szukasz informacji o owocu użytym podczas pierwszej próby transmisji materii w czasie. Przeanalizuj dokładnie kontekst i obraz. Jeśli znajdziesz tę informację, odpowiedz pełnym zdaniem. Jeśli nie ma tej informacji, odpowiedz 'BRAK INFORMACJI'."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analizuję fragment tekstu i powiązany z nim obraz.\n\nTytuł sekcji: ${paragraphTitle}\n\nKontekst:\n${paragraphContent}\n\nObraz znajduje się pod adresem: ${imageUrl}\n\nCzy na podstawie powyższego kontekstu i obrazu można znaleźć informację o owocu użytym podczas pierwszej próby transmisji materii w czasie?`
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
            max_tokens: 150
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error analyzing image:', error);
        return 'BŁĄD ANALIZY';
    }
}

// And in the analyzeParagraph function, modify the image analysis part:
async function analyzeParagraph(content, paragraphTitle) {
    try {
        // First analyze text content
        const textResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Szukasz informacji o owocu użytym podczas pierwszej próby transmisji materii w czasie. Jeśli znajdziesz tę informację w tekście, odpowiedz pełnym zdaniem. Jeśli nie ma tej informacji, odpowiedz 'BRAK INFORMACJI'."
                },
                {
                    role: "user",
                    content: `Analizowany fragment (${paragraphTitle}):\n\n${content}`
                }
            ],
            temperature: 0.7,
            max_tokens: 150
        });

        const textAnswer = textResponse.choices[0].message.content.trim();
        
        // Then check for and analyze images with full context
        const imageUrls = extractImageUrls(content);
        const imageAnswers = [];

        for (const imageUrl of imageUrls) {
            console.log(`Analyzing image in ${paragraphTitle}:`, imageUrl);
            const imageAnswer = await analyzeImage(imageUrl, paragraphTitle, content);
            if (imageAnswer !== 'BRAK INFORMACJI' && imageAnswer !== 'BŁĄD OBRAZU' && imageAnswer !== 'BŁĄD ANALIZY') {
                imageAnswers.push(`[Obraz+Kontekst]: ${imageAnswer}`);
            }
        }

        // Combine text and image answers
        const answers = [];
        if (textAnswer !== 'BRAK INFORMACJI') {
            answers.push(`[Tekst]: ${textAnswer}`);
        }
        answers.push(...imageAnswers);

        return answers;
    } catch (error) {
        console.error('Error analyzing paragraph:', error);
        throw error;
    }
}

async function getFinalAnswer(relevantAnswers) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Na podstawie zebranych informacji, utwórz jedno krótkie i precyzyjne zdanie o tym, jakiego owocu użyto podczas pierwszej próby transmisji materii w czasie."
                },
                {
                    role: "user",
                    content: `Znalezione informacje:\n\n${relevantAnswers.join('\n')}\n\nUtwórz jedno krótkie zdanie z odpowiedzią.`
                }
            ],
            temperature: 0.7,
            max_tokens: 100
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error getting final answer:', error);
        throw error;
    }
}

async function processQuestion() {
    try {
        // Get list of all paragraph files
        const files = await fs.readdir(paragraphsDir);
        const paragraphFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('00_'));

        console.log(`Found ${paragraphFiles.length} paragraph files to process`);

        // Analyze each paragraph
        const allFindings = [];
        for (const file of paragraphFiles) {
            console.log(`Processing ${file}...`);
            const content = await fs.readFile(path.join(paragraphsDir, file), 'utf8');
            const paragraphTitle = content.split('\n')[0]; // First line is the title
            
            const answers = await analyzeParagraph(content, paragraphTitle);
            if (answers.length > 0) {
                console.log(`Found relevant information in ${file}`);
                allFindings.push(`[${paragraphTitle}]:`);
                allFindings.push(...answers.map(a => `  ${a}`));
            }
        }

        if (allFindings.length === 0) {
            console.log('No relevant information found in any paragraph or image');
            return null;
        }

        // Get final synthesized answer
        console.log('Synthesizing final answer...');
        const finalAnswer = await getFinalAnswer(allFindings);
        console.log('Final answer:', finalAnswer);

        // Save the answer
        const answerObj = {
            questionId: "01",
            answer: finalAnswer,
            supporting_info: allFindings
        };

        const answerPath = path.join(answersDir, 'answer01.json');
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