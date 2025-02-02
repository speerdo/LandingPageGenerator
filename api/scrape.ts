import { type NextRequest } from 'next/server';
import { chromium } from '@playwright/test';

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

  let browser;
  try {
    const requestUrl = new URL(req.url);
    const url = requestUrl.searchParams.get('url');

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing URL parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Block unnecessary resources
    await page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    const title = await page.title();
    const description = await page.$eval('meta[name="description"]', el => el.getAttribute('content') || '');

    await browser.close();
    
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
    if (browser) {
      await browser.close();
    }
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
