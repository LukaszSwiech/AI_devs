const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

require('dotenv').config({ path: path.join('D:', 'AI_devs', 'S03E01', '.env') });

const SERVER_URL = process.env.SERVER_URL;
const APIKEY = process.env.APIKEY;
const REPORTS_DIR = path.join('D:', 'AI_devs', 'S03E01', 'data', 'reports');
const FACTS_DIR = path.join('D:', 'AI_devs', 'S03E01', 'data', 'facts');

// System prompt for semantic matching
const SYSTEM_PROMPT = `Twoim zadaniem jest analiza dwóch list słów kluczowych i określenie wszelkich powiązań między nimi.
Zwróć te słowa kluczowe z drugiej listy, których nie ma w pierwszej liście, jeśli występuje choć jeden z poniższych przypadków:

Semantyczne powiązanie między słowami (np. robot-maszyna, awaria-naprawa)
Występowanie osób (imion, nazwisk) w którejkolwiek z list
Powiązane miejsca lub instytucje
Powiązane role lub zawody
Powiązane wydarzenia lub działania

Przykład 1:
Lista 1: "robot, fabryka, awaria, maszyna"
Lista 2: "maszyna, naprawa, mechanik, Aleksander Ragowski, nauczyciel języka angielskiego, Szkoła Podstawowa nr 9"
Odpowiedź: naprawa, mechanik, Aleksander Ragowski, nauczyciel języka angielskiego, Szkoła Podstawowa nr 9
(Dodajemy tylko te słowa z listy 2, których nie ma w liście 1)
Przykład 2:
Lista 1: "aplikacja, programowanie, Java, Adam Gospodarczyk"
Lista 2: "Adam Gospodarczyk, programista, komputer"
Odpowiedź: programista, komputer
(Dodajemy tylko nowe słowa, pomijamy "Adam Gospodarczyk", bo już jest w pierwszej liście)
WAŻNE:

Dodawaj tylko te słowa z listy 2, których NIE MA w liście 1
Zawsze sprawdzaj każde słowo pod kątem duplikacji
Odpowiadaj tylko listą słów oddzielonych przecinkami lub pustym stringiem
Nie używaj cudzysłowów w odpowiedzi`;

// Helper function to read keywords from a file
async function readKeywords(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return content.split(',').map(keyword => keyword.trim());
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return [];
    }
}

async function generateAndSubmitReport() {
    try {
        const reportFiles = await fs.readdir(REPORTS_DIR);
        const answer = {};

        for (const reportFile of reportFiles) {
            const reportPath = path.join(REPORTS_DIR, reportFile);
            const content = await fs.readFile(reportPath, 'utf8');
            answer[reportFile] = content;
        }

        const payload = {
            task: "dokumenty",
            apikey: APIKEY,
            answer: answer
        };

        console.log('Sending payload:', JSON.stringify(payload, null, 2));
        
        const url = new URL('/report', SERVER_URL).toString();
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response:', response.data);

    } catch (error) {
        console.error('Full error:', error.response?.data || error.message);
    }
}

// Function to check semantic relationship using GPT-4
async function findRelatedKeywords(reportKeywords, factKeywords) {
    try {
        const userMessage = `Lista 1: "${reportKeywords.join(', ')}"\nLista 2: "${factKeywords.join(', ')}"`;
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: 0.3,
        });

        const response = completion.choices[0].message.content.trim();
        return response ? response.split(',').map(keyword => keyword.trim()) : [];

    } catch (error) {
        console.error('Error calling GPT-4:', error);
        return [];
    }
}

function extractSector(filename) {
    const match = filename.match(/sektor_([A-Z]\d)/);
    return match ? `sektor ${match[1]}` : '';
}

async function enrichReportKeywords() {
    try {
        // Get all report files
        const reportFiles = await fs.readdir(REPORTS_DIR);
       // Get all fact tag files
        const factFiles = (await fs.readdir(FACTS_DIR))
            .filter(file => file.endsWith('_tags.txt'));

        console.log(`Found ${reportFiles.length} reports and ${factFiles.length} fact files.`);

        // Process each report
        for (const reportFile of reportFiles) {
            console.log(`\nProcessing report: ${reportFile}`);
            
            // Read report keywords
            const reportPath = path.join(REPORTS_DIR, reportFile);
            const reportKeywords = await readKeywords(reportPath);
            const sector = extractSector(reportFile);
            
            console.log(`Initial keywords: ${reportKeywords.join(', ')}`);
            console.log(`Sector: ${sector}`);

            let enrichedKeywords = new Set([...reportKeywords, sector]);

            // Check each fact file for semantically related keywords
            for (const factFile of factFiles) {
                const factPath = path.join(FACTS_DIR, factFile);
                const factKeywords = await readKeywords(factPath);

                console.log(`Checking semantic relationship with ${factFile}`);
                const newKeywords = await findRelatedKeywords([...enrichedKeywords], factKeywords);

                if (newKeywords.length > 0) {
                    console.log(`Found related keywords in ${factFile}, adding: ${newKeywords.join(', ')}`);
                    newKeywords.forEach(keyword => enrichedKeywords.add(keyword));
                }
            }

            // Convert Set back to array and join with commas
            const finalKeywords = Array.from(enrichedKeywords);

            // Save enriched keywords if they've changed
            if (finalKeywords.length > reportKeywords.length) {
                const enrichedContent = finalKeywords.join(', ');
                await fs.writeFile(reportPath, enrichedContent, 'utf8');
                console.log(`Updated ${reportFile} with enriched keywords: ${enrichedContent}`);
            } else {
                console.log(`No new keywords found for ${reportFile}`);
            }
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\nKeyword enrichment process completed successfully!');
        await generateAndSubmitReport();

    } catch (error) {
        console.error('Error during keyword enrichment process:', error);
    }
}

// Run the script
enrichReportKeywords()
    .then(() => console.log('Script execution completed.'))
    .catch(error => console.error('Script execution failed:', error));