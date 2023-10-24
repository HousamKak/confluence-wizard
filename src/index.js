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


// import TfIdf from './tfidf.js'

// const tfidfInstance = new TfIdf();
// const fetchedData = ["Lysandra was born under the emerald canopy of the Whispering Woods, where every leaf tells a tale and every breeze carries a secret. With hair as dark as the raven's wing and eyes that shimmer like twilight, she commands the spirits of the forest with a gentle hum. Chosen as the guardian of ancient lore, Lysandra roams the woodland paths, ensuring that the stories of old are neither forgotten nor misused.", 
// "In a realm beyond the reach of mortals, where stars waltz and galaxies serenade, Seraphel graces the cosmic stage. With a gown spun from moonbeams and a crown of comets, she dances to the rhythm of pulsars. Her ethereal beauty is said to inspire poets on distant planets, and her legend transcends the boundaries of space and time, captivating all who look up at the night sky with hope and wonder.",
// "From the bustling towns of the east to the desolate dunes of the west, tales of Brevin's ingenious creations are shared around campfires. A nomad by choice and an inventor by passion, Brevin carries a bag bursting with peculiar gadgets, each with its own unique tale. With a twinkle in his azure eyes and a constantly whirring mind, he finds wonder in the mundane and crafts marvels from mere scraps.","Car engines have evolved significantly over the years, diversifying in design, function, and efficiency to meet various demands. The most common type is the internal combustion engine (ICE), which primarily includes gasoline and diesel engines. Gasoline engines, typically found in most passenger vehicles, utilize spark plugs to ignite the air-fuel mixture, whereas diesel engines rely on compression for ignition, often leading to greater efficiency and torque. There are also rotary engines, like the Wankel, which use a rotor instead of pistons for combustion. With environmental concerns rising, alternative power sources have gained traction. Electric engines, which use electrical energy stored in batteries to drive a motor, have become increasingly popular due to zero tailpipe emissions. Hybrid engines combine traditional ICE with electric motors to enhance efficiency. Then there's the hydrogen fuel cell, which generates electricity on-board by combining hydrogen with oxygen, emitting only water as a byproduct. As technology progresses, the diversity and efficiency of car engines are bound to expand even further."]

// const question="who is lysandra"
// fetchedData.forEach((document, index) => {
//     tfidfInstance.addDocument(document, index);
// });
// console.log(tfidfInstance)
// const scores = [];

// tfidfInstance.tfidfs(question, function (i, measure) {
//   scores.push({ index: i, score: measure });
// });

// // console.log(tfidfInstance)
// console.log(scores)
// const topDocs = scores.sort((a, b) => b.score - a.score).slice(0, 5).map(doc => fetchedData[doc.index]).join(' ');
// console.log('Top documents based on TF-IDF:', topDocs);