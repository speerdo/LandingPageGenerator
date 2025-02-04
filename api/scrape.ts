import type { NextApiRequest, NextApiResponse } from 'next';
import puppeteer from 'puppeteer-core';
import chrome from 'chrome-aws-lambda';

// Global resolveUrl helper – available for use outside of page.evaluate if needed.
export function resolveUrl(base: string, relative: string): string {
  try {
    if (!relative) return '';
    if (relative.startsWith('data:')) return '';
    if (relative.startsWith('http')) return relative;
    if (relative.startsWith('//')) {
      const baseUrl = new URL(base);
      return `${baseUrl.protocol}${relative}`;
    }
    return new URL(relative, base).href;
  } catch {
    return '';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.query;
    if (typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid url parameter' });
    }

    // Launch headless Chromium optimized for AWS Lambda (works on Vercel, too)
    const browser = await puppeteer.launch({
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: chrome.headless,
      defaultViewport: chrome.defaultViewport,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Example scraping: get outer HTML
    const html = await page.content();
    await browser.close();

    return res.status(200).json({ success: true, html });
  } catch (error) {
    console.error('Scrape error:', error);
    return res.status(500).json({ error: 'Failed to scrape website' });
  }
}
