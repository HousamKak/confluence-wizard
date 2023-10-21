import Resolver from '@forge/resolver';
import OpenAIApi from "openai";
import { config } from 'dotenv';
import tfidf from 'node-tfidf';
import { createLogger, format as _format, transports as _transports } from 'winston';

// Load environment variables from .env file
config();

// Initialize OpenAI API client with credentials from environment variables
const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORGANIZATION,
});

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

resolver.define('index_and_train', async (req) => {
  if (!Array.isArray(req.data)) {
    logger.error('Invalid data format');
    return { error: 'Invalid data format', status: 400 };
  }

  knowledgeBase = req.data;
  knowledgeBase.forEach(document => {
    tfidfInstance.addDocument(document);
  });

  logger.info('Data indexed successfully');
  return { status: 'Data indexed successfully', status_code: 200 };
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
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert in the knowledge base that I provide you with. Answer any question from the information available in the knowledge base I provide." },
        { role: "user", content: `knowledge base: ${topDocs}\n\nQuestion: ${question}` }
      ],
    });

    const answer = response['choices'][0]['message']['content'];
    logger.info('question answered successfully');
    return { answer, status: 200 };

  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    logger.error(`Failed to question GPT-3.5: ${errorMessage}`);
    return { error: `Failed to question GPT-3.5: ${errorMessage}`, status: 500 };
  }
});

export const handler = resolver.getDefinitions();
