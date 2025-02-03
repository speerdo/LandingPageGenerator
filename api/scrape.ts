import express, { Request, Response } from 'express';
import { type NextRequest } from 'next/server';
import * as cheerio from 'cheerio';

export const config = {
  runtime: 'edge'
};

// Helper function to resolve URLs
function resolveUrl(base: string, url: string): string {
  try {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
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

// Helper function to extract CSS values
function extractCssValue(style: string, property: string): string {
  const match = new RegExp(`${property}:\\s*([^;]+)`, 'i').exec(style);
  return match ? match[1].trim() : '';
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

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract all inline styles and classes
    const styleElements = $('style').map((_, el) => $(el).html()).get().join(' ');
    const inlineStyles = new Set<string>();
    $('[style]').each((_, el) => inlineStyles.add($(el).attr('style') || ''));

    // Extract colors from both inline styles and style tags
    const colors = new Set<string>();
    const colorRegex = /#[0-9a-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/gi;
    
    // From style tags
    const styleColors = styleElements.match(colorRegex) || [];
    styleColors.forEach(color => colors.add(color));

    // From inline styles
    inlineStyles.forEach(style => {
      const matches = style.match(colorRegex) || [];
      matches.forEach(color => colors.add(color));
    });

    // Extract fonts
    const fonts = new Set<string>();
    $('[style*="font-family"]').each((_, el) => {
      const fontFamily = extractCssValue($(el).attr('style') || '', 'font-family');
      if (fontFamily) fonts.add(fontFamily.replace(/['"]/g, '').split(',')[0].trim());
    });

    // Extract images with dimensions and positions
    const images = new Set<{url: string; width: string; height: string; position: string}>();
    $('img').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      if (src) {
        images.add({
          url: resolveUrl(url, src),
          width: $el.attr('width') || extractCssValue($el.attr('style') || '', 'width') || '',
          height: $el.attr('height') || extractCssValue($el.attr('style') || '', 'height') || '',
          position: 'content' // Could be 'header', 'footer', 'hero', etc. based on position
        });
      }
    });

    // Extract layout information
    const layout = {
      header: {
        height: $('header').first().attr('style')?.match(/height:\s*([^;]+)/)?.[1] || '',
        backgroundColor: extractCssValue($('header').first().attr('style') || '', 'background-color') || ''
      },
      footer: {
        height: $('footer').first().attr('style')?.match(/height:\s*([^;]+)/)?.[1] || '',
        backgroundColor: extractCssValue($('footer').first().attr('style') || '', 'background-color') || ''
      },
      mainContent: {
        maxWidth: extractCssValue($('main').first().attr('style') || '', 'max-width') || '1200px',
        padding: extractCssValue($('main').first().attr('style') || '', 'padding') || '1rem'
      }
    };

    // Extract button styles with more detail
    const buttonStyles = new Set<string>();
    $('button, .button, [class*="btn"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const buttonStyle = {
        backgroundColor: extractCssValue(style, 'background-color') || '#4F46E5',
        color: extractCssValue(style, 'color') || '#FFFFFF',
        padding: extractCssValue(style, 'padding') || '0.75rem 1.5rem',
        borderRadius: extractCssValue(style, 'border-radius') || '0.375rem',
        border: extractCssValue(style, 'border') || 'none',
        fontSize: extractCssValue(style, 'font-size') || '1rem',
        fontWeight: extractCssValue(style, 'font-weight') || '500',
        text: $(el).text().trim()
      };
      buttonStyles.add(JSON.stringify(buttonStyle));
    });

    // Extract typography system
    const typography = {
      headings: [] as Array<{
        tag: string;
        fontSize: string;
        fontWeight: string;
        color: string;
        marginBottom: string;
        text: string;
      }>,
      paragraphs: [] as Array<{
        fontSize: string;
        lineHeight: string;
        color: string;
      }>
    };

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';
      const tagName = ($el.prop('tagName') || '').toLowerCase();
      typography.headings.push({
        tag: tagName,
        fontSize: extractCssValue(style, 'font-size') || '',
        fontWeight: extractCssValue(style, 'font-weight') || '',
        color: extractCssValue(style, 'color') || '',
        marginBottom: extractCssValue(style, 'margin-bottom') || '',
        text: $el.text().trim()
      });
    });

    return new Response(JSON.stringify({
      colors: Array.from(colors),
      fonts: Array.from(fonts),
      images: Array.from(images),
      layout,
      typography,
      buttons: Array.from(buttonStyles).map(s => JSON.parse(s)),
      meta: {
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content') || '',
        viewport: $('meta[name="viewport"]').attr('content') || '',
        themeColor: $('meta[name="theme-color"]').attr('content') || ''
      }
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
