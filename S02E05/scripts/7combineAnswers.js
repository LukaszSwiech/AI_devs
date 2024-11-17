// Import required modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import axios from 'axios';

// Setup directory path and load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(dirname(__dirname), '.env') });

// Setup directories
const dataDir = path.join(dirname(__dirname), 'data');
const answersDir = path.join(dataDir, 'answers');

async function collectAnswers() {
    try {
        // Read all answer files
        const answers = {};
        for (let i = 1; i <= 5; i++) {
            const paddedNum = String(i).padStart(2, '0');
            const filePath = path.join(answersDir, `answer${paddedNum}.json`);
            
            console.log(`Reading answer file: ${filePath}`);
            const answerData = await fs.readJson(filePath);
            answers[paddedNum] = answerData.answer;
        }

        return answers;
    } catch (error) {
        console.error('Error collecting answers:', error);
        throw error;
    }
}

async function sendReport(answers) {
    try {
        // Prepare the final report structure
        const report = {
            task: "arxiv",
            apikey: process.env.APIKEY,
            answer: answers
        };

        console.log('Prepared report:', JSON.stringify(report, null, 2));

        // Send the report to the server
        const response = await axios.post(`${process.env.SERVER_URL}/report`, report);
        
        console.log('Server response:', response.data);
        
        // Save the report locally for reference
        const reportPath = path.join(dataDir, 'final_report.json');
        await fs.writeJson(reportPath, report, { spaces: 2 });
        console.log('Report saved locally at:', reportPath);

        return response.data;
    } catch (error) {
        console.error('Error sending report:', error);
        throw error;
    }
}

// Execute the main function
async function main() {
    try {
        // Collect all answers
        console.log('Collecting answers...');
        const answers = await collectAnswers();
        
        // Send the report
        console.log('Sending report...');
        const result = await sendReport(answers);
        
        return result;
    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    }
}

// Run the script
main()
    .then(result => {
        console.log('Script completed successfully.');
        console.log('Final result:', result);
    })
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });