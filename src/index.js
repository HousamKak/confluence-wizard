import Resolver from '@forge/resolver';
import { config } from 'dotenv';
import tfidf from 'node-tfidf';
import { createLogger, format as _format, transports as _transports } from 'winston';
import { fetch } from '@forge/api';
import { api, route } from '@forge/bridge';

// Load environment variables from .env file
config();

// Initialize an instance of TF-IDF
const tfidfInstance = new tfidf();

// Set up a logger
const logger = createLogger({
  level: 'info',
  format: _format.json(),
  transports: [
    new _transports.File({ filename: 'error.log', level: 'error' }),
    new _transports.File({ filename: 'combined.log' }),
  ],
});

const resolver = new Resolver();

// Initialize a variable to store our knowledge base data
let knowledgeBase = [];

// Define a function to traverse the Atlas Doc format and extract content
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
  console.log(`Fetching all Confluence data for spaceKey: ${spaceKey}`);
  let allPages = [];
  let start = 0;
  let limit = 25;
  let hasMoreData = true;

  while (hasMoreData) {
    console.log(`Fetching pages with start index: ${start}`);
    const response = await api.asUser().requestConfluence(route`/wiki/rest/api/content?spaceKey=${spaceKey}&start=${start}&limit=${limit}`);
    const data = await response.json();

    console.log(`Fetched ${data.results.length} pages`);
    allPages = allPages.concat(data.results);

    if (data.size < limit) {
      console.log("No more pages left to fetch.");
      hasMoreData = false;
    }
  }
  // Fetch body content for each page and store in an array
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
    // Use your fetchAllConfluenceData function to get the data
    const fetchedData = await fetchAllConfluenceData(req.data.spaceKey);

    if (!fetchedData || fetchedData.length === 0) {
      logger.error('No data fetched from Confluence');
      return { error: 'No data fetched from Confluence', status: 400 };
    }

    knowledgeBase = fetchedData;
    knowledgeBase.forEach(document => {
      tfidfInstance.addDocument(document);
    });

    logger.info('Data indexed successfully');
    return { status: 'Data indexed successfully', status_code: 200 };
  } catch (error) {
    logger.error(`Failed to fetch and index Confluence data: ${error.message}`);
    return { error: `Failed to fetch and index Confluence data: ${error.message}`, status: 500 };
  }
});

resolver.define('question_to_gpt', async (req) => {
  if (typeof req.data.question !== 'string' || req.data.question.length === 0) {
    logger.error('Invalid question format');
    return { error: 'Invalid question format', status: 400 };
  }

  const question = req.data.question;
  const scores = [];

  tfidfInstance.tfidfs(question, function (i, measure) {
    scores.push({ index: i, score: measure });
  });

  const topDocs = scores.sort((a, b) => b.score - a.score).slice(0, 5).map(doc => knowledgeBase[doc.index]).join(' ');

  try {
    const url = "https://api.openai.com/v1/chat/completions";
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

    const response = await fetch(url, config);
    const data = await response.json();  // Parsing the JSON data from the response

    console.log(data);
    const answer = data['choices'][0]['message']['content'];
    logger.info('question answered successfully');
    return { answer, status: 200 };

  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    logger.error(`Failed to question GPT-3.5: ${errorMessage}`);
    return { error: `Failed to question GPT-3.5: ${errorMessage}`, status: 500 };
  }
});

export const handler = resolver.getDefinitions();

// import Resolver from '@forge/resolver';

// const resolver = new Resolver();

// resolver.define('getText', (req) => {
//   console.log(req);

//   return 'Hello, world!';
// });

// export const handler = resolver.getDefinitions();