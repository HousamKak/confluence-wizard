import Resolver from '@forge/resolver';
import TFIDF from './tfidf.js';
import api, { storage, fetch, route } from '@forge/api';
import { createLogger, format as _format, transports as _transports } from 'winston';

// Initialize an instance of TF-IDF, a machine learning algorithm to find the importance of words
const tfidfInstance = new TFIDF();

const logger = createLogger({
  level: 'info',
  format: _format.json(),
  transports: [
    new _transports.File({ filename: 'error.log', level: 'error' }),
    new _transports.File({ filename: 'combined.log' }),
  ],
});

const resolver = new Resolver();
let knowledgeBase = [];

function extractContentFromAtlasDoc(node) {
  if (node.type === 'text') {
    return node.text;
  }

  if (node.content) {
    return node.content.map(extractContentFromAtlasDoc).join('');
  }

  return '';
}

async function fetchAllConfluenceData(spaceKey) {
  let allPages = [];
  let start = 0;
  let limit = 25;
  let hasMoreData = true;

  while (hasMoreData) {
    const response = await api.asUser().requestConfluence(route`/wiki/rest/api/content?spaceKey=${spaceKey}&start=${start}&limit=${limit}`);
    const data = await response.json();
    allPages = allPages.concat(data.results);

    if (data.results.length < limit) {
      hasMoreData = false;
    } else {
      start += limit;  // Increment the start index for the next batch of pages
    }
  }

  const bodyContents = [];
  for (const page of allPages) {
    const pageId = page.id;
    const bodyResponse = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    const bodyData = await bodyResponse.json();

    if (bodyData && bodyData.body.atlas_doc_format.value) {
      const parsedAtlasDoc = JSON.parse(bodyData.body.atlas_doc_format.value);
      const content = extractContentFromAtlasDoc(parsedAtlasDoc);
      bodyContents.push(content);
    }
  }

  return bodyContents;
}

// In your backend code

resolver.define('store_openai_key', async ({ payload }) => {
  try {
    if (payload && payload.openaiKey) {
      await storage.setSecret("OPENAI_API_KEY", payload.openaiKey);
      return { success: true };
    }
    return { success: false, error: "No OpenAI API Key provided." };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

resolver.define('check_openai_key', async () => {
  try {
    const apiKey = await storage.getSecret("OPENAI_API_KEY");
    if (apiKey) {
      return { hasKey: true };
    } else {
      return { hasKey: false };
    }
  } catch (error) {
    return { hasKey: false, error: error.message };
  }
});

resolver.define('get_and_index', async ({ payload }) => {
  console.log('get_and_index called ', payload);
  try {
    const fetchedData = await fetchAllConfluenceData(payload.spaceKey);
    console.log('Fetched data from Confluence:', fetchedData);

    if (!fetchedData || fetchedData.length === 0) {
      logger.error('No data fetched from Confluence');
      console.error('No data fetched from Confluence');
      return { sucess: false, error: 'No data fetched from Confluence', status_code: 400 };
    }

    knowledgeBase = fetchedData;
    knowledgeBase.forEach(document => {
      tfidfInstance.addDocument(document);
    });

    tfidfInstance.computeIDF();  // Compute the IDF values
    console.log("Term Frequencies:", tfidfInstance.termFrequency);  // Log added here
    console.log("Inverse Document Frequencies:", tfidfInstance.inverseDocumentFrequency);  // Log added here

    logger.info('Data indexed successfully');
    console.log('Data indexed successfully');

    return { success: true, status: 'Data indexed successfully', status_code: 200 };

  } catch (error) {
    logger.error(`Failed to fetch and index Confluence data: ${error.message}`);
    console.error(`Failed to fetch and index Confluence data: ${error.message}`);
    return { success: false, error: `Failed to fetch and index Confluence data: ${error.message}`, status_code: 500 };
  }
});

resolver.define('question_to_gpt', async ({ payload }) => {
  console.log('question_to_gpt called with payload:', payload);

  if (typeof payload.question !== 'string' || payload.question.length === 0) {
    logger.error('Invalid question format');
    console.log('Invalid question format');
    return { answer: 'Invalid question format', status_code: 400 };
  }

  const question = payload.question;
  console.log('Question received:', question);
  const scores = [];


  console.log("Preprocessed Question:", tfidfInstance.preprocess(question));  // Log added here

  tfidfInstance.tfidfs(question, function (i, measure) {
    scores.push({ index: i, score: measure });
  });

  console.log("TF-IDF Scores:", scores);  // Log added here
  const topDocs = scores.sort((a, b) => b.score - a.score).slice(0, 5).map(doc => knowledgeBase[doc.index]).join(' ');
  console.log('Top documents based on TF-IDF:', topDocs);

  try {
    const url = 'https://api.openai.com/v1/chat/completions';
    const params = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert in the knowledge base that I provide you with. You have to answer any question that I ask you strictly from the information available in the knowledge base I provide." },
        { role: "user", content: `knowledge base: ${topDocs}\n\nQuestion: ${question}` }
      ],
    };

    console.log('Sending request to OpenAI with params:', params);

    const apiKey = await storage.getSecret("OPENAI_API_KEY");
    if (!apiKey) {
      logger.error('OpenAI API key not found in storage');
      console.error('OpenAI API key not found in storage');
      return { error: 'OpenAI API key not found in storage', status_code: 500 };
    }

    const config = {
      method: 'POST',
      headers: {
        Authorization: "Bearer " + apiKey,
        'Content-Type': "application/json",
      },
      body: JSON.stringify(params)
    };

    const response = await fetch(url, config);
    console.log(response)
    if (!response.ok) {
      throw new Error('OpenAI API call failed');
    }

    const data = await response.json();
    const answer = data['choices'][0]['message']['content'];

    logger.info('Question answered successfully');
    console.log('OpenAI Response:', answer);
    return { answer, status_code: 200 };

  } catch (error) {
    const errorMessage = error.message;
    logger.error(`Failed to question GPT-3.5: ${errorMessage}`);
    console.error(`Failed to question GPT-3.5: ${errorMessage}`);
    return { error: `Failed to question GPT-3.5: ${errorMessage}`, status_code: 500 };
  }
});

export const handler = resolver.getDefinitions();