import express, { Request, Response, NextFunction } from 'express';
import scrapeRouter from './api/scrape';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Add body parsing middleware
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});

// Enable CORS for your Vite dev server
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true
}));

// Mount the scraping endpoint under /api/scrape
app.use('/api/scrape', scrapeRouter);

// Add a GET endpoint to fetch available OpenAI models
app.get('/api/models', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'VITE_OPENAI_API_KEY is not set in the environment' });
      return;
    }
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: false });
    const response = await openai.models.list();
    const modelIds = response.data.map(model => model.id);
    res.json({ models: modelIds });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    next(error);
  }
});

// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 