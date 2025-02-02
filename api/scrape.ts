import express from 'express';
import serverless from 'serverless-http';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

// A simple helper to resolve relative URLs against a base URL.
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

const asyncHandler = (fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>) =>
  async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };

const router = express.Router();

// GET /api/scrape?url=<encoded-url>
router.get('/', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { url, brand } = req.query;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid URL parameter' });
    return;
  }

  console.log(`[Scraping API] Launching Puppeteer for ${url}`);
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
  
  try {
    // Ensure the page loads fully
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    // Optional: log the beginning of the fetched HTML (first 200 characters)
    const html = await page.content();
    console.log('[Scraping API] Fetched HTML snippet:', html.substring(0, 200));

    // Log the body background color for extra debugging
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    console.log('[Scraping API] Body background color:', bodyBg);

    // Use Cheerio to parse HTML and list all image sources
    const $ = cheerio.load(html);
    const allImages = $('img').map((i, el) => $(el).attr('src')).get();
    console.log('[Scraping API] All image srcs:', allImages);

    // Extract images from <img> tags
    const imgTagImages = Array.from($('img')).map(img => {
      const src = $(img).attr('src');
      return src ? resolveUrl(url, src) : '';
    }).filter(Boolean);
    
    // Also extract background images from computed styles
    const bgImages = await page.evaluate(() => {
      const bgSet = new Set<string>();
      const elements = document.querySelectorAll('*');
      elements.forEach(el => {
         const bg = window.getComputedStyle(el).getPropertyValue('background-image');
         if (bg && bg !== 'none' && bg !== 'initial') {
           const matches = bg.match(/url\(["']?([^"']+)["']?\)/);
           if (matches && matches[1]) {
              bgSet.add(matches[1]);
           }
         }
      });
      return Array.from(bgSet);
    });
    console.log('[Scraping API] Background image srcs:', bgImages);
    
    // Combine images from <img> tags and background images
    const images = Array.from(new Set([...imgTagImages, ...bgImages]));

    // Extract logo candidates from <img> tags
    console.log('[Scraping API] Starting to extract logo candidates from <img> tags');
    const logoCandidates = $('img')
      .filter((_, img) => {
        const src = $(img).attr('src')?.toLowerCase() || '';
        const alt = $(img).attr('alt')?.toLowerCase() || '';
        const className = $(img).attr('class')?.toLowerCase() || '';
        console.log('[Scraping API] Checking image candidate:', { src, alt, className });
        return (
          src.includes('logo') ||
          alt.includes('logo') ||
          className.includes('logo') ||
          src.includes('brand') ||
          alt.includes('brand') ||
          className.includes('brand')
        );
      })
      .map((_, img) => $(img).attr('src') || '')
      .get();

    let logo = '';
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Prefer the candidate whose resolved URL hostname matches the page's hostname.
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
      console.log('[Scraping API] Domain matched logo candidate:', logo);
    } else {
      // Fallback: if a brand is provided, match that first.
      if (brand && typeof brand === 'string') {
        const brandLower = brand.toLowerCase();
        const brandCandidates = logoCandidates.filter(src =>
          src.toLowerCase().includes(brandLower)
        );
        if (brandCandidates.length > 0) {
          logo = brandCandidates[0];
          console.log('[Scraping API] Selected logo based on provided brand candidate:', logo);
        }
      }
      // If still not determined, default to the first candidate.
      if (!logo) {
        logo = logoCandidates[0];
        console.log('[Scraping API] Using first logo candidate as fallback:', logo);
      }
    }
    logo = resolveUrl(url, logo);
    console.log('[Scraping API] Final selected logo:', logo);

    // Extract primary background colors from key sections only
    const colors = await page.evaluate(() => {
      const colorSet = new Set<string>();
      const selectors = ['body', 'header', 'main', 'footer'];
      selectors.forEach(sel => {
         const el = document.querySelector(sel);
         if (el) {
            const style = window.getComputedStyle(el);
            const bgColor = style.backgroundColor;
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
               colorSet.add(bgColor);
            }
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
               const matches = bgImage.match(/(rgb[a]?\([^)]+\))/g);
               if (matches) {
                  matches.forEach(match => colorSet.add(match));
               }
            }
         }
      });
      return Array.from(colorSet);
    });

    // Extract fonts
    const fonts = await page.evaluate(() => {
      const fontSet = new Set<string>();
      const elements = document.querySelectorAll('*');
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const fontFamily = style.fontFamily;
        if (fontFamily) fontSet.add(fontFamily.split(',')[0].trim());
      });
      return Array.from(fontSet);
    });

    // Omit header data to prevent interference with placeholder content
    const headings: string[] = [];

    // Extract basic styles
    const styles = {
      spacing: ['0.5rem', '1rem', '1.5rem', '2rem'],
      borderRadius: ['0.25rem', '0.5rem', '0.75rem'],
      shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
      gradients: [],
      buttonStyles: await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, .button, [class*="btn"]');
        return Array.from(buttons).map(btn => {
          const style = window.getComputedStyle(btn);
          return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            padding: style.padding,
            borderRadius: style.borderRadius
          };
        });
      }),
      headerStyles: await page.evaluate(() => {
        const headers = document.querySelectorAll('h1, h2');
        return Array.from(headers).map(header => {
          const style = window.getComputedStyle(header);
          return {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            fontFamily: style.fontFamily.split(',')[0].trim()
          };
        });
      }),
      layout: {
        maxWidth: '1200px',
        containerPadding: '1rem',
        gridGap: '1rem'
      }
    };

    // After your existing extractions, add:
    const headerBackgroundColor = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? window.getComputedStyle(header).backgroundColor : '';
    });

    const footerBackgroundColor = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      return footer ? window.getComputedStyle(footer).backgroundColor : '';
    });

    const footerLogo = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      const img = footer ? footer.querySelector('img') : null;
      return img ? img.src : '';
    });

    const sectionBackgroundColors = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));
      return sections
        .map(section => window.getComputedStyle(section).backgroundColor)
        .filter(color => color && color !== 'rgba(0, 0, 0, 0)'); // Filter out transparent/default values
    });

    await browser.close();
    
    res.json({
      colors,
      fonts,
      images,
      headings,
      logo,
      styles,
      headerBackgroundColor,
      footerBackgroundColor,
      footerLogo,
      sectionBackgroundColors
    });

  } catch (error) {
    await browser.close();
    console.error('[Scraping API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to scrape website',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// Create an Express app, attach the router, and export via serverless-http.
const app = express();
app.use('/', router);

export default serverless(app);
