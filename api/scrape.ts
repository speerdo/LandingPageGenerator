import { type NextRequest } from 'next/server';
import * as cheerio from 'cheerio';

// Add edge runtime directive
export const config = {
  runtime: 'edge'
};

export default async function handler(req: NextRequest) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fix: Use URL object to get search params
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing URL parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const apiKey = process.env.VITE_SCRAPINGBEE_API_KEY;
    if (!apiKey) {
      throw new Error('ScrapingBee API key is not configured');
    }

    // Basic ScrapingBee request
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false`;
    
    console.log('[Scraping API] Fetching:', url);
    const response = await fetch(scrapingBeeUrl);
    const html = await response.text();

    if (!response.ok) {
      throw new Error(`ScrapingBee API failed: ${response.status} - ${html}`);
    }

    // Basic extraction with cheerio
    const $ = cheerio.load(html);
    
    // Extract just basic information first
    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content') || '';
    
    return new Response(JSON.stringify({
      title,
      description,
      url,
      status: 'success'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Scraping API] Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to scrape website',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
