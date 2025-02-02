import { type NextRequest } from 'next/server';
import * as cheerio from 'cheerio';

// Add edge runtime directive
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

// Define the interface for button styles
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

export default async function handler(req: NextRequest) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = req.nextUrl.searchParams.get('url');
  const brand = req.nextUrl.searchParams.get('brand');

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing URL parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const apiKey = process.env.VITE_SCRAPINGBEE_API_KEY;
    if (!apiKey) {
      throw new Error('ScrapingBee API key is not configured');
    }

    const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
    scrapingBeeUrl.searchParams.append('api_key', apiKey);
    scrapingBeeUrl.searchParams.append('url', url);
    scrapingBeeUrl.searchParams.append('render_js', 'false');
    scrapingBeeUrl.searchParams.append('timeout', '10000');
    scrapingBeeUrl.searchParams.append('premium_proxy', 'true');

    console.log('[Scraping API] Fetching:', url);
    const response = await fetch(scrapingBeeUrl.toString());

    if (!response.ok) {
      throw new Error(`ScrapingBee API failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract images
    const images = new Set<string>();
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        const resolvedUrl = resolveUrl(url, src);
        if (resolvedUrl) images.add(resolvedUrl);
      }
    });

    // Extract logo
    const logoCandidates = $('img').filter((_, el) => {
      const src = $(el).attr('src')?.toLowerCase() || '';
      const alt = $(el).attr('alt')?.toLowerCase() || '';
      const className = $(el).attr('class')?.toLowerCase() || '';
      return (
        src.includes('logo') ||
        alt.includes('logo') ||
        className.includes('logo') ||
        src.includes('brand') ||
        alt.includes('brand') ||
        className.includes('brand')
      );
    }).map((_, el) => $(el).attr('src')).get();

    let logo = '';
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Logo selection logic
    const domainCandidate = logoCandidates.find(src => {
      const resolved = resolveUrl(url, src);
      try {
        return new URL(resolved).hostname === domain;
      } catch {
        return false;
      }
    });

    if (domainCandidate) {
      logo = domainCandidate;
    } else if (brand && typeof brand === 'string') {
      const brandLower = brand.toLowerCase();
      const brandCandidate = logoCandidates.find(src => 
        src.toLowerCase().includes(brandLower)
      );
      if (brandCandidate) logo = brandCandidate;
    }
    
    if (!logo && logoCandidates.length > 0) {
      logo = logoCandidates[0];
    }
    
    logo = resolveUrl(url, logo);

    // Extract colors
    const colors = new Set<string>();
    $('*').each((_, el) => {
      const style = $(el).attr('style');
      if (style) {
        const colorMatch = style.match(/(?:color|background-color):\s*(#[0-9a-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\))/gi);
        if (colorMatch) {
          colorMatch.forEach(color => colors.add(color.split(':')[1].trim()));
        }
      }
    });

    // Extract fonts
    const fonts = new Set<string>();
    $('*').each((_, el) => {
      const style = $(el).attr('style');
      if (style) {
        const fontMatch = style.match(/font-family:\s*([^;]+)/i);
        if (fontMatch) {
          const fontFamily = fontMatch[1].split(',')[0].trim().replace(/['"]/g, '');
          fonts.add(fontFamily);
        }
      }
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
    $('h1, h2').each((_, el) => {
      const style = $(el).attr('style') || '';
      styles.headerStyles.push({
        fontSize: style.match(/font-size:\s*([^;]+)/i)?.[1] || '2.25rem',
        fontWeight: style.match(/font-weight:\s*([^;]+)/i)?.[1] || '700',
        color: style.match(/color:\s*([^;]+)/i)?.[1] || '#1F2937',
        fontFamily: (style.match(/font-family:\s*([^;]+)/i)?.[1] || 'system-ui').split(',')[0].trim()
      });
    });

    // Extract header and footer details
    const headerBackgroundColor = $('header').attr('style')?.match(/background-color:\s*([^;]+)/i)?.[1] || '';
    const footerBackgroundColor = $('footer').attr('style')?.match(/background-color:\s*([^;]+)/i)?.[1] || '';
    const footerLogo = $('footer img').attr('src') || '';
    
    // Extract section background colors
    const sectionBackgroundColors: string[] = [];
    $('section').each((_, el) => {
      const bgColor = $(el).attr('style')?.match(/background-color:\s*([^;]+)/i)?.[1];
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
        sectionBackgroundColors.push(bgColor);
      }
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
      sectionBackgroundColors
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
