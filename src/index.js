import Resolver from '@forge/resolver';
import TfIdf from './tfidf.js'
import api, { storage, fetch, route } from '@forge/api';
import { createLogger, format as _format, transports as _transports } from 'winston';

// Initialize an instance of TF-IDF, a machine learning algorithm to find the importance of words
const tfidfInstance = new TfIdf();

const logger = createLogger({
  level: 'info',
  format: _format.json(),
  transports: [
    new _transports.File({ filename: 'error.log', level: 'error' }),
    new _transports.File({ filename: 'combined.log' }),
  ],
});

const resolver = new Resolver();

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

// Methods for Storing and Retrieving Knowledge Base
async function storeKnowledgeBase(data) {
  try {
    await storage.set("knowledgeBase", JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error(`Failed to store knowledge base: ${error.message}`);
    console.error(`Failed to store knowledge base: ${error.message}`);
    return false;
  }
}

async function getKnowledgeBase() {
  try {
    const data = await storage.get("knowledgeBase");
    return JSON.parse(data || '[]');
  } catch (error) {
    logger.error(`Failed to retrieve knowledge base: ${error.message}`);
    console.error(`Failed to retrieve knowledge base: ${error.message}`);
    return [];
  }
}

resolver.define('check_data_preloaded', async () => {
  try {
    const knowledgeBase = await getKnowledgeBase();

    if (knowledgeBase && knowledgeBase.length > 0) {
      return { preloaded: true };
    } else {
      return { preloaded: false };
    }
  } catch (error) {
    logger.error(`Failed to check if data is preloaded: ${error.message}`);
    console.error(`Failed to check if data is preloaded: ${error.message}`);
    return { preloaded: false, error: error.message };
  }
});

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

resolver.define('delete_openai_key', async () => {
  try {
    await storage.deleteSecret("OPENAI_API_KEY");
    return { success: true, message: "OpenAI API Key deleted successfully." };
  } catch (error) {
    logger.error(`Failed to delete OpenAI API Key: ${error.message}`);
    console.error(`Failed to delete OpenAI API Key: ${error.message}`);
    return { success: false, error: `Failed to delete OpenAI API Key: ${error.message}`, status_code: 500 };
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

    await storeKnowledgeBase(fetchedData);
    fetchedData.forEach((document, index) => {
      tfidfInstance.addDocument(document, index);
    });

    const serializedTfidfData = tfidfInstance.serialize();
    await storage.set("tfidfData", serializedTfidfData);

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
  console.log('question_to_gpt called with question:', payload);

  const serializedTfidfData = await storage.get("tfidfData");
  const reconstructedTfidf = TfIdf.deserialize(serializedTfidfData || '{}');

  const knowledgeBase = await getKnowledgeBase();
  console.log('this is the knowledge base --->>', knowledgeBase);

  if (typeof payload.question !== 'string' || payload.question.length === 0) {
    logger.error('Invalid question format');
    console.log('Invalid question format');
    return { answer: 'Invalid question format', status_code: 400 };
  }

  const question = payload.question;
  console.log('Question received:', question);
  const scores = [];
  console.log(reconstructedTfidf)
  reconstructedTfidf.tfidfs(question, function (i, measure) {
    scores.push({ index: i, score: measure });
  });

  const topDocs = scores.sort((a, b) => b.score - a.score).slice(0, 5).map(doc => knowledgeBase[doc.index]).join(' ');


  try {
    const url = 'https://api.openai.com/v1/chat/completions';
    const params = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert in the knowledge base that I provide you with. You have to answer any question that I ask you strictly from the information available in the knowledge base I provide." },
        { role: "user", content: `knowledge base: ${topDocs}\n\nQuestion: ${question}` }
      ],
    };

    const apiKey = await storage.getSecret("OPENAI_API_KEY");
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message.content) {
      const answer = data.choices[0].message.content;
      logger.info('Answer generated by GPT-3:', answer);
      console.log('Answer generated by GPT-3:', answer);
      return { answer: answer, status_code: 200 };
    } else {
      throw new Error('GPT-3 did not return a valid response.');
    }
  } catch (error) {
    logger.error(`Failed to get answer from GPT-3: ${error.message}`);
    console.error(`Failed to get answer from GPT-3: ${error.message}`);
    return { answer: `Failed to get answer from GPT-3: ${error.message}`, status_code: 500 };
  }
});

export const handler = resolver.getDefinitions();
