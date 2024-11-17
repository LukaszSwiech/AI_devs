// Import required modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs-extra';

// Setup directory path and load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Setup directories
const dataDir = path.join(dirname(__dirname), 'data');
const markdownDir = path.join(dataDir, 'markdown');
const paragraphsDir = path.join(markdownDir, 'paragraphs');
fs.ensureDirSync(paragraphsDir);

function extractParagraphs(content) {
    // Split content by newlines to process line by line
    const lines = content.split('\n');
    let paragraphs = [];
    let currentParagraph = '';
    let currentTitle = '';
    let isCollecting = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1] || '';

        // Check for paragraph title (a line followed by dashes)
        if (nextLine && nextLine.trim().match(/^-+$/)) {
            if (currentParagraph && currentTitle) {
                // Save previous paragraph if exists
                paragraphs.push({
                    title: currentTitle,
                    content: currentParagraph.trim()
                });
            }
            currentTitle = line.trim();
            currentParagraph = '';
            isCollecting = true;
            i++; // Skip the dashes line
            continue;
        }

        if (isCollecting) {
            currentParagraph += line + '\n';
        }
    }

    // Add the last paragraph if exists
    if (currentParagraph && currentTitle) {
        paragraphs.push({
            title: currentTitle,
            content: currentParagraph.trim()
        });
    }

    return paragraphs;
}

async function processParagraphs() {
    try {
        // Read the main markdown file
        const markdownPath = path.join(markdownDir, 'arxiv-draft.md');
        console.log('Reading markdown file from:', markdownPath);
        const content = await fs.readFile(markdownPath, 'utf8');

        // Extract paragraphs
        const paragraphs = extractParagraphs(content);
        console.log(`Found ${paragraphs.length} paragraphs`);

        // Save each paragraph to a separate file
        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            const safeTitle = paragraph.title
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '')
                .trim();
            
            const fileName = `${String(i + 1).padStart(2, '0')}_${safeTitle}.md`;
            const filePath = path.join(paragraphsDir, fileName);

            // Save with title and content
            const fileContent = `${paragraph.title}\n${'-'.repeat(paragraph.title.length)}\n\n${paragraph.content}`;
            await fs.writeFile(filePath, fileContent, 'utf8');
            console.log(`Saved paragraph to: ${fileName}`);
        }

        // Create an index file with all paragraph titles
        const index = paragraphs.map((p, i) => {
            const num = String(i + 1).padStart(2, '0');
            return `${num}. ${p.title}`;
        }).join('\n');
        await fs.writeFile(path.join(paragraphsDir, '00_index.md'), index, 'utf8');
        
        return paragraphsDir;
    } catch (error) {
        console.error('Error processing paragraphs:', error);
        throw error;
    }
}

// Execute the main function
processParagraphs()
    .then(dirPath => {
        console.log('Script completed successfully.');
        console.log('Paragraphs saved in:', dirPath);
    })
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });