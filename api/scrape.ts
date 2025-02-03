import express, { Request, Response } from 'express';
import * as cheerio from 'cheerio';
import type { ParamsDictionary } from 'express-serve-static-core';

const router = express.Router();

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

router.get('/', async (req: Request<ParamsDictionary, unknown, unknown, { url: string; brand?: string }>, res: Response) => {
  try {
    const url = req.query.url;

    if (!url) {
      res.status(400).json({ error: 'Missing URL parameter' });
      return;
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

    // Extract colors (improved to get computed styles)
    const colors = new Set<string>();
    $('*').each((_, el) => {
      const color = $(el).css('color');
      const backgroundColor = $(el).css('background-color');
      if (color && color !== 'transparent') colors.add(color);
      if (backgroundColor && backgroundColor !== 'transparent') colors.add(backgroundColor);
    });

    // Extract fonts (improved to include computed styles)
    const fonts = new Set<string>();
    $('*').each((_, el) => {
      const fontFamily = $(el).css('font-family');
      if (fontFamily) fonts.add(fontFamily.replace(/['"]/g, ''));
    });

    // Deduplicate button styles
    const buttonStylesSet = new Set<string>();
    const buttonStyles: ButtonStyle[] = [];
    $('button, .button, [class*="btn"], a[href]:not([href^="#"])').each((_, el) => {
      const backgroundColor = $(el).css('background-color');
      const color = $(el).css('color');
      const padding = $(el).css('padding');
      const borderRadius = $(el).css('border-radius');
      
      const styleKey = JSON.stringify({
        backgroundColor: backgroundColor || '#4F46E5',
        color: color || '#FFFFFF',
        padding: padding || '0.75rem 1.5rem',
        borderRadius: borderRadius || '0.375rem'
      });
      
      if (!buttonStylesSet.has(styleKey)) {
        buttonStylesSet.add(styleKey);
        buttonStyles.push(JSON.parse(styleKey));
      }
    });

    // Extract header styles with actual values
    const headerStylesSet = new Set<string>();
    const headerStyles: HeaderStyle[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const computedStyle = {
        fontSize: $(el).css('font-size'),
        fontWeight: $(el).css('font-weight'),
        color: $(el).css('color'),
        fontFamily: $(el).css('font-family')
      };
      const styleKey = JSON.stringify({
        fontSize: computedStyle.fontSize || '1rem',
        fontWeight: computedStyle.fontWeight || '600',
        color: computedStyle.color || '#111827',
        fontFamily: (computedStyle.fontFamily || 'system-ui').replace(/['"]/g, '')
      });
      
      if (!headerStylesSet.has(styleKey)) {
        headerStylesSet.add(styleKey);
        headerStyles.push(JSON.parse(styleKey));
      }
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

    // Update the styles object
    const styles = {
      spacing: ['0.5rem', '1rem', '1.5rem', '2rem'],
      borderRadius: ['0.25rem', '0.5rem', '0.75rem'],
      shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
      gradients: [] as string[],
      buttonStyles,
      headerStyles,
      layout: {
        maxWidth: '1200px',
        containerPadding: '1rem',
        gridGap: '1rem'
      }
    };

    res.json({
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
    });

  } catch (error) {
    console.error('[Scraping API] Error:', error);
    res.status(500).json({ error: 'Failed to scrape website' });
  }
});

export default router;

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
