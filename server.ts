import * as express from 'express';
import scrapeRouter from './api/scrape';
import * as cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port: number = parseInt(process.env.PORT || '3000', 10);

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware for logging requests
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});

// Enable CORS for specific origins
app.use(cors.default({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true
}));

// Mount the scraping endpoint under /api/scrape
app.use('/api/scrape', scrapeRouter);

// Initialize OpenAI client once
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.error('OPENAI_API_KEY is not set in the environment');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
  // Remove 'dangerouslyAllowBrowser' as it's not a standard option
});

// Endpoint to fetch available OpenAI models
app.get('/api/models', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const response = await openai.models.list();
    const modelIds = response.data.map(model => model.id);
    res.json({ models: modelIds });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({ error: 'Failed to fetch OpenAI models' });
  }
});

// Health check endpoint
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 