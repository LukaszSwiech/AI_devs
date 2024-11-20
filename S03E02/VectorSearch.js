import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

global.fetch = fetch;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ 
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

const COLLECTION_NAME = 'weapons_reports';

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
    encoding_format: "float"
  });
  return response.data[0].embedding;
}

async function recreateCollection() {
  try {
    const collections = await qdrant.getCollections();
    if (collections.collections.some(c => c.name === COLLECTION_NAME)) {
      await qdrant.deleteCollection(COLLECTION_NAME);
      console.log('Deleted existing collection');
    }

    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 3072,
        distance: 'Cosine'
      }
    });
    console.log('Collection created successfully');
  } catch (error) {
    console.error('Error with collection:', error);
    throw error;
  }
}

async function processFiles() {
  try {
    await recreateCollection();
    const files = await fs.readdir('D:/AI_devs/S03E02/weapons');
    const points = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await fs.readFile(path.join('D:/AI_devs/S03E02/weapons', file), 'utf8');
      const date = file.split('.')[0]; // Get date from filename (2024_01_08)
      
      // Create structured text with metadata
      const structuredContent = `Date: ${date}\nContent: ${content}`;
      console.log(`Processing ${file} with date ${date}`);
      
      const embedding = await getEmbedding(structuredContent);

      points.push({
        id: i + 1,
        vector: embedding,
        payload: {
          date: date.replace(/_/g, '-'), // Convert 2024_01_08 to 2024-01-08
          content
        }
      });
    }

    console.log('Inserting points:', points.length);
    await qdrant.upsert(COLLECTION_NAME, {
      points: points
    });
    console.log('Points inserted successfully');

    const queryText = "W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?";
    const queryEmbedding = await getEmbedding(queryText);
    
    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: 1
    });

    if (!searchResults || searchResults.length === 0) {
      throw new Error('No search results found');
    }

    console.log('Search results:', JSON.stringify(searchResults, null, 2));
    const relevantDate = searchResults[0].payload.date;
    console.log('Found date:', relevantDate);

    const requestBody = {
      task: "wektory",
      apikey: process.env.APIKEY,
      answer: relevantDate
    };

    console.log('Sending request to server:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(process.env.SERVER_URL + '/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    console.log('Server response:', result);

  } catch (error) {
    console.error('Error:', error);
    if (error.data) {
      console.error('Error details:', error.data);
    }
    throw error;
  }
}

processFiles();