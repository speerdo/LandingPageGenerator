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

// Add helper function for font extraction
function extractFonts($: cheerio.CheerioAPI): string[] {
  const fonts = new Set<string>();  

  // Check common elements with computed styles
  $('body, h1, h2, h3, h4, h5, h6, p, span, div').each((_, el) => {
    // Try getting font-family from inline style first
    const inlineStyle = $(el).attr('style');
    if (inlineStyle) {
      const fontMatch = inlineStyle.match(/font-family:\s*([^;}]+)[;}]/);
      if (fontMatch?.[1]) {
        fonts.add(fontMatch[1].trim());
      }
    }

    // Also check any class-based styles
    const classes = $(el).attr('class');
    if (classes) {
      const classNames = classes.split(' ');
      classNames.forEach(className => {
        $(`style:contains(.${className})`).each((_, styleEl) => {
          const styleContent = $(styleEl).html() || '';
          const fontMatches = styleContent.match(new RegExp(`\\.${className}[^}]*font-family:\\s*([^;}]+)[;}]`));
          if (fontMatches?.[1]) {
            fonts.add(fontMatches[1].trim());
          }
        });
      });
    }
  });

  // Check style tags
  $('style').each((_, el) => {
    const styleContent = $(el).html() || '';
    const fontFamilyMatches = styleContent.match(/font-family:\s*([^;}]+)[;}]/g);
    if (fontFamilyMatches) {
      fontFamilyMatches.forEach(match => {
        const font = match.replace('font-family:', '').replace(';', '').trim();
        fonts.add(font);
      });
    }
  });

  // Check inline styles
  $('[style*="font-family"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const fontMatch = style.match(/font-family:\s*([^;}]+)[;}]/);
    if (fontMatch?.[1]) {
      fonts.add(fontMatch[1].trim());
    }
  });

  return Array.from(fonts)
    .filter(font => font && font !== 'inherit')
    .map(font => font.replace(/['"]/g, ''));
}

// Add helper function for color extraction
function extractColors($: cheerio.CheerioAPI): string[] {
  const colors = new Set<string>();
  
  // Check style tags
  $('style').each((_, el) => {
    const styleContent = $(el).html() || '';
    const colorMatches = styleContent.match(/(#[0-9A-Fa-f]{3,8}|rgb\([^)]+\)|rgba\([^)]+\))/g);
    if (colorMatches) {
      colorMatches.forEach(color => colors.add(color));
    }
  });

  // Check elements with background-color or color
  $('[style*="color"], [style*="background"], [style*="background-color"]').each((_, el) => {
    const bgColor = $(el).css('background-color');
    const color = $(el).css('color');
    if (bgColor && bgColor !== 'transparent') colors.add(bgColor);
    if (color) colors.add(color);
  });
  return Array.from(colors).filter(color => color && color !== 'transparent' && color !== 'inherit');
}

export default async function handler(req: NextRequest) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
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

    const $ = cheerio.load(html) as cheerio.CheerioAPI;
    
    // Extract data using enhanced helpers
    const extractedData = {
      colors: extractColors($),
      fonts: extractFonts($),
      images: $('img[src]').map((_, el) => {
        const src = $(el).attr('src') || '';
        return resolveUrl(url, src);
      }).get().filter(Boolean),
      logo: $('img[src*="logo"]').first().attr('src') || '',
      styles: {
        spacing: Array.from(new Set([
          ...($('[style*="margin"]').map((_, el) => $(el).css('margin')).get()),
          ...($('[style*="padding"]').map((_, el) => $(el).css('padding')).get())
        ])).filter(Boolean),
        borderRadius: Array.from(new Set(
          $('[style*="border-radius"]').map((_, el) => $(el).css('border-radius')).get()
        )).filter(Boolean),
        shadows: Array.from(new Set(
          $('[style*="box-shadow"]').map((_, el) => $(el).css('box-shadow')).get()
        )).filter(Boolean),
        gradients: Array.from(new Set(
          $('[style*="gradient"]').map((_, el) => $(el).css('background-image')).get()
        )).filter(val => val?.includes('gradient')),
        buttonStyles: $('button, .button, [class*="btn"]').map((_, el) => ({
          backgroundColor: $(el).css('background-color') || '#4F46E5',
          color: $(el).css('color') || '#FFFFFF',
          padding: $(el).css('padding') || '0.75rem 1.5rem',
          borderRadius: $(el).css('border-radius') || '0.375rem'
        })).get(),
        headerStyles: $('h1, h2, h3, h4, h5, h6').map((_, el) => ({
          fontSize: $(el).css('font-size') || '1rem',
          fontWeight: $(el).css('font-weight') || '600',
          color: $(el).css('color') || '#111827',
          fontFamily: $(el).css('font-family') || 'system-ui'
        })).get(),
        layout: {
          maxWidth: $('main, .container, [class*="container"]').first().css('max-width') || '1200px',
          containerPadding: $('main, .container, [class*="container"]').first().css('padding') || '1rem',
          gridGap: '1rem'
        }
      },
      headerBackgroundColor: $('header').first().css('background-color') || '',
      footerBackgroundColor: $('footer').first().css('background-color') || '',
      footerLogo: $('footer img[src*="logo"]').first().attr('src') || '',
      sectionBackgroundColors: $('section').map((_, el) => $(el).css('background-color')).get()
    };

    return new Response(JSON.stringify(extractedData), {
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
