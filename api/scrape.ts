import { type NextRequest } from 'next/server';
import * as cheerio from 'cheerio';

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

  try {
    const requestUrl = new URL(req.url);
    const url = requestUrl.searchParams.get('url');

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing URL parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = process.env.VITE_SCRAPINGBEE_API_KEY;
    if (!apiKey) {
      throw new Error('ScrapingBee API key is not configured');
    }

    // First try without premium features (1 credit)
    const baseParams = {
      'api_key': apiKey,
      'url': url,
      'render_js': 'false',
      'block_ads': 'true',
      'block_resources': 'true',
      'timeout': '10000'
    };
    const scrapingBeeParams = new URLSearchParams(baseParams);

    let scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?${scrapingBeeParams.toString()}`;
    console.log('[Scraping API] First attempt:', url);
    let response = await fetch(scrapingBeeUrl);

    // If failed, retry with premium proxy (10 credits)
    if (!response.ok) {
      console.log('[Scraping API] Retrying with premium proxy');
      scrapingBeeParams.set('premium_proxy', 'true');
      scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?${scrapingBeeParams.toString()}`;
      response = await fetch(scrapingBeeUrl);
    }

    // If still failed, retry with JS rendering (15 credits)
    if (!response.ok) {
      console.log('[Scraping API] Retrying with JS rendering');
      scrapingBeeParams.set('render_js', 'true');
      scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?${scrapingBeeParams.toString()}`;
      response = await fetch(scrapingBeeUrl);
    }

    const html = await response.text();

    if (!response.ok) {
      throw new Error(`ScrapingBee API failed: ${response.status} - ${html}`);
    }

    const $ = cheerio.load(html);
    
    const title = $('title').text().trim();
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
