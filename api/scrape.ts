import { type NextRequest } from 'next/server';
import * as cheerio from 'cheerio';

export const config = {
  runtime: 'edge'
};

// Helper function to resolve URLs
function resolveUrl(base: string, url: string): string {
  try {
    if (!url) return '';
    if (url.startsWith('data:')) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) {
      const baseUrl = new URL(base);
      return `${baseUrl.protocol}${url}`;
    }
    return new URL(url, base).href;
  } catch {
    return '';
  }
}

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

    if (!response.ok) {
      console.log('[Scraping API] Retrying with premium proxy');
      scrapingBeeParams.set('premium_proxy', 'true');
      scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?${scrapingBeeParams.toString()}`;
      response = await fetch(scrapingBeeUrl);
    }

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

    // Extract colors
    const colors = new Set<string>();
    $('[style*="color"], [style*="background"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const color = style.match(/color:\s*([^;]+)/i)?.[1];
      const bgColor = style.match(/background(?:-color)?:\s*([^;]+)/i)?.[1];
      if (color) colors.add(color);
      if (bgColor) colors.add(bgColor);
    });

    // Extract fonts
    const fonts = new Set<string>();
    $('[style*="font-family"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const font = style.match(/font-family:\s*([^;]+)/i)?.[1];
      if (font) fonts.add(font);
    });

    // Extract images
    const images = new Set<string>();
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src) images.add(resolveUrl(url, src));
    });

    // Extract logo
    const logo = $('img[src*="logo"], a[href="/"] img').first().attr('src') || '';

    // Extract header and footer colors
    const headerBackgroundColor = $('header').first().css('background-color') || '';
    const footerBackgroundColor = $('footer').first().css('background-color') || '';
    const footerLogo = $('footer img[src*="logo"]').first().attr('src') || '';

    // Extract section background colors
    const sectionBackgroundColors = new Set<string>();
    $('section, div[class*="section"]').each((_, el) => {
      const bgColor = $(el).css('background-color');
      if (bgColor) sectionBackgroundColors.add(bgColor);
    });

    // Extract styles
    const styles = {
      spacing: ['0.5rem', '1rem', '1.5rem', '2rem'],
      borderRadius: ['0.25rem', '0.5rem', '0.75rem'],
      shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
      gradients: [] as string[],
      buttonStyles: [] as ButtonStyle[],
      headerStyles: [] as HeaderStyle[],
      layout: {
        maxWidth: '1200px',
        containerPadding: '1rem',
        gridGap: '1rem'
      }
    };

    // Extract button styles
    $('button, .button, [class*="btn"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      styles.buttonStyles.push({
        backgroundColor: style.match(/background-color:\s*([^;]+)/i)?.[1] || '#4F46E5',
        color: style.match(/color:\s*([^;]+)/i)?.[1] || '#FFFFFF',
        padding: style.match(/padding:\s*([^;]+)/i)?.[1] || '0.75rem 1.5rem',
        borderRadius: style.match(/border-radius:\s*([^;]+)/i)?.[1] || '0.375rem'
      });
    });

    // Extract header styles
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const style = $(el).attr('style') || '';
      styles.headerStyles.push({
        fontSize: style.match(/font-size:\s*([^;]+)/i)?.[1] || '1rem',
        fontWeight: style.match(/font-weight:\s*([^;]+)/i)?.[1] || '600',
        color: style.match(/color:\s*([^;]+)/i)?.[1] || '#111827',
        fontFamily: style.match(/font-family:\s*([^;]+)/i)?.[1] || 'system-ui'
      });
    });

    return new Response(JSON.stringify({
      colors: Array.from(colors),
      fonts: Array.from(fonts),
      images: Array.from(images),
      headings: [],
      logo,
      styles,
      headerBackgroundColor,
      footerBackgroundColor,
      footerLogo: resolveUrl(url, footerLogo),
      sectionBackgroundColors: Array.from(sectionBackgroundColors)
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

interface ButtonStyle {
  backgroundColor: string;
  color: string;
  padding: string;
  borderRadius: string;
}

interface HeaderStyle {
  fontSize: string;
  fontWeight: string;
  color: string;
  fontFamily: string;
}
