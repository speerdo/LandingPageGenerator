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

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // Enhanced color extraction
    const colors = new Set<string>();
    $('*').each((_, el) => {
      const computedStyle = $(el).css(['color', 'background-color', 'border-color']);
      Object.values(computedStyle).forEach(color => {
        if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
          colors.add(color);
        }
      });
    });

    // Enhanced font extraction
    const fonts = new Set<string>();
    $('*').each((_, el) => {
      const fontFamily = $(el).css('font-family');
      if (fontFamily) {
        fonts.add(fontFamily.replace(/['"]/g, '').split(',')[0].trim());
      }
    });

    // Enhanced logo detection
    const possibleLogoSelectors = [
      'img[src*="logo"]',
      'a[href="/"] img',
      'header img',
      '.logo img',
      '#logo img',
      '[class*="logo"] img',
      '[id*="logo"] img'
    ];
    
    const logo = $(possibleLogoSelectors.join(', ')).first().attr('src');
    const resolvedLogo = logo ? resolveUrl(url, logo) : '';

    // Enhanced header/footer detection
    const headerBg = $('header').first().css('background-color') || 
                    $('.header').first().css('background-color') || 
                    $('[class*="header"]').first().css('background-color');
                    
    const footerBg = $('footer').first().css('background-color') || 
                    $('.footer').first().css('background-color') || 
                    $('[class*="footer"]').first().css('background-color');

    // Extract section backgrounds
    const sectionBgs = new Set<string>();
    $('section, [class*="section"], .container, .wrapper, [class*="container"], [class*="wrapper"]')
      .each((_, el) => {
        const bg = $(el).css('background-color');
        if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
          sectionBgs.add(bg);
        }
      });

    // Enhanced button styles
    const buttonStyles = new Set<string>();
    $('button, .button, [class*="btn"], a[href]:not([href^="#"])').each((_, el) => {
      const style = {
        backgroundColor: $(el).css('background-color') || '#4F46E5',
        color: $(el).css('color') || '#FFFFFF',
        padding: $(el).css('padding') || '0.75rem 1.5rem',
        borderRadius: $(el).css('border-radius') || '0.375rem',
        borderColor: $(el).css('border-color'),
        fontSize: $(el).css('font-size'),
        fontWeight: $(el).css('font-weight')
      };
      buttonStyles.add(JSON.stringify(style));
    });

    // Enhanced heading styles
    const headingStyles = new Set<string>();
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const $el = $(el);
      const style = {
        tag: $(el).get(0).tagName,
        fontSize: $el.css('font-size'),
        fontWeight: $el.css('font-weight'),
        color: $el.css('color'),
        fontFamily: $el.css('font-family'),
        lineHeight: $el.css('line-height'),
        marginBottom: $el.css('margin-bottom'),
        text: $el.text().trim()
      };
      headingStyles.add(JSON.stringify(style));
    });

    return new Response(JSON.stringify({
      colors: Array.from(colors),
      fonts: Array.from(fonts),
      images: Array.from($('img').map((_, img) => resolveUrl(url, $(img).attr('src') || '')).get()),
      headings: Array.from(headingStyles).map(s => JSON.parse(s)),
      logo: resolvedLogo,
      styles: {
        spacing: ['0.5rem', '1rem', '1.5rem', '2rem'],
        borderRadius: ['0.25rem', '0.5rem', '0.75rem'],
        shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
        gradients: [],
        buttonStyles: Array.from(buttonStyles).map(s => JSON.parse(s)),
        headerStyles: Array.from(headingStyles).map(s => JSON.parse(s)),
        layout: {
          maxWidth: $('main, .container, .wrapper').first().css('max-width') || '1200px',
          containerPadding: $('main, .container, .wrapper').first().css('padding') || '1rem',
          gridGap: '1rem'
        }
      },
      headerBackgroundColor: headerBg || '',
      footerBackgroundColor: footerBg || '',
      footerLogo: resolveUrl(url, $('footer img[src*="logo"]').first().attr('src') || ''),
      sectionBackgroundColors: Array.from(sectionBgs)
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