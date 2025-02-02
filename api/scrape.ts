import { type NextRequest } from 'next/server';
import puppeteer from 'puppeteer-core';
import chrome from '@sparticuz/chromium-min';

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

    // Configure Chrome for Edge runtime
    browser = await puppeteer.launch({
      args: chrome.args,
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    const data = await page.evaluate(() => {
      const title = document.title;
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      
      return {
        title,
        description
      };
    });

    await browser.close();
    
    return new Response(JSON.stringify({
      ...data,
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
