const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// System prompt we created earlier
const systemPrompt = `Twoim zadaniem jest generowanie słów kluczowych z podanych tekstów. Przestrzegaj następujących zasad:

1. Generuj słowa kluczowe zawsze w formie mianownika liczby pojedynczej (np. "nauczyciel" zamiast "nauczycielem")
2. Uwzględniaj:
   - Osoby (imiona i nazwiska w oryginalnej formie)
   - Miejsca i lokalizacje
   - Role i zawody
   - Wydarzenia i działania
   - Organizacje i instytucje
   - Technologie i narzędzia
   - Istotne koncepcje i tematy

3. Format odpowiedzi: lista słów kluczowych oddzielonych przecinkami

4. Unikaj:
   - Powtórzeń i synonimów
   - Form innych niż mianownik
   - Nieistotnych szczegółów`;

async function processFactFiles() {
    const factsDir = path.join('D:', 'AI_devs', 'S03E01', 'data');
    
    try {
        // Read all files in the facts directory
        const files = await fs.readdir(factsDir);
        
        // Filter for .txt files that don't end with _tags.txt
        const factFiles = files.filter(file => 
            file.endsWith('.txt')
        );

        console.log(`Found ${factFiles.length} fact files to process.`);

        // Process each file
        for (const file of factFiles) {
            console.log(`Processing ${file}...`);
            
            try {
                // Read the content of the fact file
                const filePath = path.join(factsDir, file);
                const content = await fs.readFile(filePath, 'utf8');

                // Get keywords from GPT-4
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: content
                        }
                    ],
                    temperature: 0.7,
                });

                // Get the keywords from the response
                const keywords = completion.choices[0].message.content;

                // Create the tags filename
                const tagsFile = file;
                const tagsPath = path.join(factsDir, 'reports', tagsFile);

                // Save the keywords to the tags file
                await fs.writeFile(tagsPath, keywords, 'utf8');
                console.log(`Saved keywords for ${file} to ${tagsFile}`);

            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }

        console.log('All files processed successfully!');

    } catch (err) {
        console.error('Error reading facts directory:', err);
    }
}

// Run the script
processFactFiles().catch(console.error);