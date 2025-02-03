import { type NextRequest } from 'next/server';
import * as cheerio from 'cheerio';
import { ScrapedImage } from '../src/types/website';

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
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      redirect: 'follow',
      credentials: 'omit'
    });

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    
    // Early detection of protection pages
    if (html.includes('Just a moment...') || 
        html.includes('DDoS protection by') ||
        html.includes('Please Wait...') ||
        html.includes('Checking your browser')) {
      throw new Error('Website is protected by Cloudflare or similar service');
    }

    const $ = cheerio.load(html);

    // Extract all inline styles and classes
    const styleElements = $('style').map((_, el) => $(el).html()).get().join(' ');
    const inlineStyles = new Set<string>();
    $('[style]').each((_, el) => inlineStyles.add($(el).attr('style') || ''));

    // Extract colors more aggressively
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

    // From color attributes
    $('[color], [bgcolor]').each((_, el) => {
      const color = $(el).attr('color') || $(el).attr('bgcolor');
      if (color?.match(colorRegex)) colors.add(color);
    });

    // Extract fonts more thoroughly
    const fonts = new Set<string>();
    $('[style*="font-family"]').each((_, el) => {
      const fontFamily = extractCssValue($(el).attr('style') || '', 'font-family');
      if (fontFamily) fonts.add(fontFamily.replace(/['"]/g, '').split(',')[0].trim());
    });
    // Also check computed styles in style tags
    const fontRegex = /font-family:\s*([^;}]+)/g;
    const styleTagFonts = styleElements.match(fontRegex) || [];
    styleTagFonts.forEach(font => {
      const fontFamily = font.replace('font-family:', '').trim();
      fonts.add(fontFamily.replace(/['"]/g, '').split(',')[0].trim());
    });

    // Extract images with better validation
    const images = new Set<ScrapedImage>();
    $('img[src]').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      if (src && !src.startsWith('data:') && !src.includes('captcha')) {
        const resolvedSrc = resolveUrl(url, src);
        if (resolvedSrc) {
          images.add({
            src: resolvedSrc,
            width: $el.attr('width') || extractCssValue($el.attr('style') || '', 'width') || '',
            height: $el.attr('height') || extractCssValue($el.attr('style') || '', 'height') || ''
          });
        }
      }
    });

    // Extract layout with fallbacks
    const layout = {
      header: {
        height: $('header').first().css('height') || 
               extractCssValue($('header').first().attr('style') || '', 'height') || 
               '60px',
        backgroundColor: $('header').first().css('background-color') || 
                        extractCssValue($('header').first().attr('style') || '', 'background-color') || 
                        '#ffffff'
      },
      footer: {
        height: $('footer').first().css('height') || 
               extractCssValue($('footer').first().attr('style') || '', 'height') || 
               '60px',
        backgroundColor: $('footer').first().css('background-color') || 
                        extractCssValue($('footer').first().attr('style') || '', 'background-color') || 
                        '#ffffff'
      },
      mainContent: {
        maxWidth: $('main, .main, #main').first().css('max-width') || '1200px',
        padding: $('main, .main, #main').first().css('padding') || '1rem'
      }
    };

    // Extract typography with validation
    const typography = {
      headings: $('h1, h2, h3, h4, h5, h6').map((_, el) => {
        const $el = $(el);
        const style = $el.attr('style') || '';
        return {
          tag: $el.get(0)?.tagName?.toLowerCase() || '',
          fontSize: extractCssValue(style, 'font-size') || '',
          fontWeight: extractCssValue(style, 'font-weight') || '',
          color: extractCssValue(style, 'color') || '',
          marginBottom: extractCssValue(style, 'margin-bottom') || ''
        };
      }).get(),
      paragraphs: $('p').map((_, el) => {
        const $el = $(el);
        const style = $el.attr('style') || '';
        return {
          fontSize: extractCssValue(style, 'font-size') || '',
          lineHeight: extractCssValue(style, 'line-height') || '',
          color: extractCssValue(style, 'color') || ''
        };
      }).get()
    };

    // Extract button styles with validation
    const buttons = $('button, .button, [class*="btn"]').map((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';
      return {
        backgroundColor: extractCssValue(style, 'background-color') || '#4F46E5',
        color: extractCssValue(style, 'color') || '#FFFFFF',
        padding: extractCssValue(style, 'padding') || '0.75rem 1.5rem',
        borderRadius: extractCssValue(style, 'border-radius') || '0.375rem',
        text: $el.text().trim()
      };
    }).get();

    return new Response(JSON.stringify({
      colors: Array.from(colors),
      fonts: Array.from(fonts),
      images: Array.from(images),
      layout,
      typography,
      buttons,
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
