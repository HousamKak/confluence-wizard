import Resolver from '@forge/resolver';
import TFIDF from './tfidf.js';
import api, { fetch as forgeFetch,route } from '@forge/api';
import { createLogger, format as _format, transports as _transports } from 'winston';

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
    const bodyResponse = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`, {
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

resolver.define('get_and_index', async (req) => {
  try {
    const fetchedData = await fetchAllConfluenceData(req.data.spaceKey);
    if (!fetchedData || fetchedData.length === 0) {
      logger.error('No data fetched from Confluence');
      return { error: 'No data fetched from Confluence', status_code: 400 };
    }

    knowledgeBase = fetchedData;
    knowledgeBase.forEach(document => {
      tfidfInstance.addDocument(document);
    });

    tfidfInstance.computeIDF();  // Compute the IDF values

    logger.info('Data indexed successfully');
    return { status: 'Data indexed successfully', status_code: 200 };

  } catch (error) {
    logger.error(`Failed to fetch and index Confluence data: ${error.message}`);
    return { error: `Failed to fetch and index Confluence data: ${error.message}`, status_code: 500 };
  }
});

resolver.define('question_to_gpt', async (req) => {
  if (typeof req.data.question !== 'string' || req.data.question.length === 0) {
    logger.error('Invalid question format');
    return { error: 'Invalid question format', status_code: 400 };
  }

  const question = req.data.question;
  const scores = [];

  tfidfInstance.tfidfs(question, function (i, measure) {
    scores.push({ index: i, score: measure });
  });

  const topDocs = scores.sort((a, b) => b.score - a.score).slice(0, 5).map(doc => knowledgeBase[doc.index]).join(' ');

  try {
    const url = "";
    const params = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert in the knowledge base that I provide you with. You have to answer any question that I ask you strictly from the information available in the knowledge base I provide." },
        { role: "user", content: `knowledge base: ${topDocs}\n\nQuestion: ${question}` }
      ],
    };

    const config = {
      method: 'POST',
      headers: {
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
        'Content-Type': "application/json",
      },
      body: JSON.stringify(params)
    };

    const response = await forgeFetch(url, config);
    if (!response.ok) {
      throw new Error('OpenAI API call failed');
    }

    const data = await response.json();
    const answer = data['choices'][0]['message']['content'];

    logger.info('Question answered successfully');
    return { answer, status_code: 200 };

  } catch (error) {
    const errorMessage = error.message;
    logger.error(`Failed to question GPT-3.5: ${errorMessage}`);
    return { error: `Failed to question GPT-3.5: ${errorMessage}`, status_code: 500 };
  }
});

export const handler = resolver.getDefinitions();
