const fs = require('fs').promises;
const path = require('path');

const REPORTS_DIR = path.join('D:', 'AI_devs', 'S03E01', 'data', 'reports');
const FACTS_DIR = path.join('D:', 'AI_devs', 'S03E01', 'data', 'facts');

// Helper function to read and parse keywords from a file
async function readKeywords(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        // Split by comma and trim each keyword
        return content.split(',').map(keyword => keyword.trim());
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return [];
    }
}

// Helper function to find matching keywords between two arrays
function hasMatchingKeywords(reportKeywords, factKeywords) {
    return reportKeywords.some(keyword => factKeywords.includes(keyword));
}

// Helper function to get new keywords that aren't in the report
function getNewKeywords(reportKeywords, factKeywords) {
    return factKeywords.filter(keyword => !reportKeywords.includes(keyword));
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
            console.log(`Initial keywords: ${reportKeywords.join(', ')}`);

            let enrichedKeywords = [...reportKeywords];

            // Check each fact file for matching keywords
            for (const factFile of factFiles) {
                const factPath = path.join(FACTS_DIR, factFile);
                const factKeywords = await readKeywords(factPath);

                // If there are matching keywords, add new keywords from the fact
                if (hasMatchingKeywords(reportKeywords, factKeywords)) {
                    const newKeywords = getNewKeywords(enrichedKeywords, factKeywords);
                    
                    if (newKeywords.length > 0) {
                        console.log(`Found matching keywords in ${factFile}, adding: ${newKeywords.join(', ')}`);
                        enrichedKeywords = [...enrichedKeywords, ...newKeywords];
                    }
                }
            }

            // Save enriched keywords if they've changed
            if (enrichedKeywords.length > reportKeywords.length) {
                const enrichedContent = enrichedKeywords.join(', ');
                await fs.writeFile(reportPath, enrichedContent, 'utf8');
                console.log(`Updated ${reportFile} with enriched keywords`);
            } else {
                console.log(`No new keywords found for ${reportFile}`);
            }
        }

        console.log('\nKeyword enrichment process completed successfully!');

    } catch (error) {
        console.error('Error during keyword enrichment process:', error);
    }
}

// Run the script
enrichReportKeywords()
    .then(() => console.log('Script execution completed.'))
    .catch(error => console.error('Script execution failed:', error));