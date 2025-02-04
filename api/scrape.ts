import type { NextApiRequest, NextApiResponse } from 'next';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

// Global resolveUrl helper – available for use outside of page.evaluate if needed.
export function resolveUrl(base: string, relative: string): string {
  try {
    if (!relative) return '';
    if (relative.startsWith('data:')) return '';
    if (relative.startsWith('http')) return relative;
    if (relative.startsWith('//')) {
      const baseUrl = new URL(base);
      return `${baseUrl.protocol}${relative}`;
    }
    return new URL(relative, base).href;
  } catch {
    return '';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.query;
    if (typeof url !== 'string' || !url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }
    
    // Launch Puppeteer in the Node.js (Serverless) environment.
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });
    
    const page = await browser.newPage();
    // Navigate with "networkidle2" to ensure stylesheets and external assets are loaded.
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Use page.evaluate to extract data in the browser context.
    // Note: We re-define a local resolveUrl inside evaluate to resolve relative URLs.
    const extractedData = await page.evaluate(() => {
      const baseUrl = document.baseURI;
      // Local resolveUrl function replicated from our global version.
      const resolveUrl = (relative: string): string => {
        try {
          if (!relative) return '';
          if (relative.startsWith('data:')) return '';
          if (relative.startsWith('http')) return relative;
          if (relative.startsWith('//')) {
            return window.location.protocol + relative;
          }
          return new URL(relative, baseUrl).href;
        } catch {
          return '';
        }
      };

      // Extract colors from style tags and inline styles.
      const colorsSet = new Set<string>();
      document.querySelectorAll('style').forEach(styleEl => {
        const text = styleEl.innerText;
        const regex = /(#[0-9A-Fa-f]{3,8}|rgb\([^)]+\)|rgba\([^)]+\))/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          colorsSet.add(match[1]);
        }
      });
      document.querySelectorAll('[style]').forEach(el => {
        const style = el.getAttribute('style') || '';
        const regex = /(#[0-9A-Fa-f]{3,8}|rgb\([^)]+\)|rgba\([^)]+\))/g;
        let m;
        while ((m = regex.exec(style)) !== null) {
          colorsSet.add(m[1]);
        }
      });
      const colors = Array.from(colorsSet).filter(c => c && c !== 'transparent' && c !== 'inherit');

      // Extract fonts from inline styles and computed font on the body.
      const fontsSet = new Set<string>();
      document.querySelectorAll('[style*="font-family"]').forEach(el => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/font-family:\s*([^;}]+)[;}]/);
        if (match && match[1]) {
          fontsSet.add(match[1].trim());
        }
      });
      const bodyFont = window.getComputedStyle(document.body).getPropertyValue('font-family') || '';
      bodyFont.split(',').forEach(f => fontsSet.add(f.trim()));
      const fonts = Array.from(fontsSet);
      if (!fonts.length) fonts.push('system-ui');

      // Extract image URLs from all <img> elements and deduplicate.
      const images = Array.from(document.querySelectorAll('img[src]')).map(img => {
        const src = img.getAttribute('src') || '';
        return resolveUrl(src);
      });
      const imagesUnique = Array.from(new Set(images.filter(Boolean)));

      // Determine the logo: first image whose src contains "logo".
      const logoEl = document.querySelector('img[src*="logo"]');
      const logo = logoEl ? logoEl.getAttribute('src') : '';

      // Extract button styles using computed styles.
      const buttonEls = Array.from(document.querySelectorAll('button, .button, [class*="btn"]'));
      const buttonStyles = buttonEls.map(btn => {
        const computed = window.getComputedStyle(btn);
        return {
          backgroundColor: computed.backgroundColor || '#4F46E5',
          color: computed.color || '#FFFFFF',
          padding: computed.padding || '0.75rem 1.5rem',
          borderRadius: computed.borderRadius || '0.375rem'
        };
      });
      const uniqueButtonStyles = Array.from(new Set(buttonStyles.map(s => JSON.stringify(s)))).map(s => JSON.parse(s));

      // Extract header styles from h1-h6 elements.
      const headerEls = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const headerStyles = headerEls.map(el => {
        const computed = window.getComputedStyle(el);
        return {
          fontSize: computed.fontSize || '1rem',
          fontWeight: computed.fontWeight || '600',
          color: computed.color || '#111827',
          fontFamily: computed.fontFamily || 'system-ui'
        };
      });
      const uniqueHeaderStyles = Array.from(new Set(headerStyles.map(s => JSON.stringify(s)))).map(s => JSON.parse(s));
      
      // Extract layout details from the first container-like element.
      const container = document.querySelector('main, .container, [class*="container"]');
      const layout = container ? {
        maxWidth: window.getComputedStyle(container).maxWidth || '1200px',
        containerPadding: window.getComputedStyle(container).padding || '1rem',
        gridGap: '1rem'
      } : { maxWidth: '1200px', containerPadding: '1rem', gridGap: '1rem' };

      // Extract header and footer information.
      const headerBg = document.querySelector('header') ? window.getComputedStyle(document.querySelector('header') as Element).backgroundColor : '';
      const footerBg = document.querySelector('footer') ? window.getComputedStyle(document.querySelector('footer') as Element).backgroundColor : '';
      const footerLogoEl = document.querySelector('footer img[src*="logo"]');
      const footerLogo = footerLogoEl ? footerLogoEl.getAttribute('src') : '';
      const sectionBgColors = Array.from(document.querySelectorAll('section')).map(el => window.getComputedStyle(el).backgroundColor);

      return {
        colors,
        fonts,
        images: imagesUnique,
        logo,
        styles: {
          // Additional style extractions (spacing, borderRadius, shadows, gradients) can be added as needed.
          spacing: [],
          borderRadius: [],
          shadows: [],
          gradients: [],
          buttonStyles: uniqueButtonStyles,
          headerStyles: uniqueHeaderStyles,
          layout
        },
        headerBackgroundColor: headerBg,
        footerBackgroundColor: footerBg,
        footerLogo,
        sectionBackgroundColors: sectionBgColors
      };
    });
    
    await browser.close();
    return res.status(200).json(extractedData);
  } catch (error) {
    console.error('[Scraping API] Error:', error);
    return res.status(500).json({
      error: 'Failed to scrape website',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
