// Local Express version
import express, { Request, Response } from 'express';
import * as cheerio from 'cheerio';

const router = express.Router();

router.get('/', async (req: Request<object, unknown, unknown, { url: string }>, res: Response) => {
  try {
    const urlParam = req.query.url;
    console.log('[Server] URL parameter:', urlParam);
    if (!urlParam) {
      console.log('[Server] Missing URL parameter');
      res.status(400).json({ error: 'Missing URL parameter' });
      return;
    }

    const response = await fetch(urlParam, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract colors
    const colors = new Set<string>();
    $('[style*="color"], [style*="background"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const color = style.match(/color:\s*([^;]+)/i)?.[1];
      const bgColor = style.match(/background(?:-color)?:\s*([^;]+)/i)?.[1];
      if (color && color !== 'transparent') colors.add(color);
      if (bgColor && bgColor !== 'transparent') colors.add(bgColor);
    });

    // Extract fonts
    const fonts = new Set<string>();
    $('[style*="font-family"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const font = style.match(/font-family:\s*([^;]+)/i)?.[1];
      if (font) fonts.add(font.replace(/['"]/g, ''));
    });

    // Extract images
    const images = new Set<string>();
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        try {
          const fullUrl = new URL(src, urlParam).href;
          images.add(fullUrl);
        } catch (e) {
          console.warn('Invalid image URL:', src);
          console.log(e);
        }
      }
    });

    // Extract logo
    let logo = '';
    const logoImg = $('img[src*="logo"], a[href="/"] img').first().attr('src');
    if (logoImg) {
      try {
        logo = new URL(logoImg, urlParam).href;
      } catch (e) {
        console.warn('Invalid logo URL:', logoImg);
        console.log(e);
      }
    }

    // Extract styles
    const buttonStyles = new Set<string>();
    const headerStyles = new Set<string>();

    $('button, .button, [class*="btn"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const buttonStyle = {
        backgroundColor: style.match(/background-color:\s*([^;]+)/i)?.[1] || '#4F46E5',
        color: style.match(/color:\s*([^;]+)/i)?.[1] || '#FFFFFF',
        padding: style.match(/padding:\s*([^;]+)/i)?.[1] || '0.75rem 1.5rem',
        borderRadius: style.match(/border-radius:\s*([^;]+)/i)?.[1] || '0.375rem'
      };
      buttonStyles.add(JSON.stringify(buttonStyle));
    });

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const style = $(el).attr('style') || '';
      const headerStyle = {
        fontSize: style.match(/font-size:\s*([^;]+)/i)?.[1] || '1rem',
        fontWeight: style.match(/font-weight:\s*([^;]+)/i)?.[1] || '600',
        color: style.match(/color:\s*([^;]+)/i)?.[1] || '#111827',
        fontFamily: style.match(/font-family:\s*([^;]+)/i)?.[1] || 'system-ui'
      };
      headerStyles.add(JSON.stringify(headerStyle));
    });

    const styles = {
      spacing: ['0.5rem', '1rem', '1.5rem', '2rem'],
      borderRadius: ['0.25rem', '0.5rem', '0.75rem'],
      shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
      gradients: [] as string[],
      buttonStyles: Array.from(buttonStyles).map(s => JSON.parse(s)),
      headerStyles: Array.from(headerStyles).map(s => JSON.parse(s)),
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
      logo,
      styles,
      headerBackgroundColor: '',
      footerBackgroundColor: '',
      footerLogo: '',
      sectionBackgroundColors: []
    });

  } catch (error) {
    console.error('[Scraping API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;