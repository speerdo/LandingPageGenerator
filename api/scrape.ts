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
