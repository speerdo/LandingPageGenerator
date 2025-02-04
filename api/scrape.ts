import { NextApiRequest, NextApiResponse } from 'next';

// Example: Adjust these to match your needs
const SCRAPINGBEE_API_KEY = process.env.VITE_SCRAPINGBEE_API_KEY || '';

// A helper to sanitize URLs in TypeScript (similar to your old resolveUrl)
function resolveUrl(base: string, relative: string): string {
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

// We replicate the old shape: colors, fonts, images, logo, styles, etc.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.query;
    if (typeof url !== 'string' || !url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    if (!SCRAPINGBEE_API_KEY) {
      throw new Error('ScrapingBee API key is not configured');
    }

    /**
     * 1. Build a JavaScript snippet that runs in the remote browser.
     *    - We do everything that old cheerio code did in "page.evaluate()" style:
     *      - Gather colors, fonts, images, etc.
     *      - Use window.getComputedStyle(...) for real final styles.
     *      - Construct a JSON object (the old "extractedData") and store it in window.__SCRAPE_RESULT__.
     */
    const script = `
      (function(){
        // Utility to safely push non-empty items
        function addIfValid(set, value) {
          if (value && value !== 'transparent') {
            set.add(value);
          }
        }

        // For the sake of demonstration, we replicate your old logic in plain DOM calls:
        const colors = new Set();
        const fonts = new Set();
        const images = new Set();
        const sectionBgColors = new Set();

        // Extract button & header styles as arrays (similar to your old code)
        const buttonStylesSet = new Set();
        const buttonStyles = [];
        const headerStylesSet = new Set();
        const headerStyles = [];

        // Query all elements
        const allEls = Array.from(document.querySelectorAll('*'));
        allEls.forEach(el => {
          const style = window.getComputedStyle(el);

          // Colors
          addIfValid(colors, style.color);
          addIfValid(colors, style.backgroundColor);

          // Fonts
          if (style.fontFamily) {
            fonts.add(style.fontFamily.replace(/['"]/g, ''));
          }

          // If it's a button-like element => record button style
          if (
            el.tagName.toLowerCase() === 'button' ||
            el.className.includes('button') ||
            el.className.includes('btn')
          ) {
            const backgroundColor = style.backgroundColor || '#4F46E5';
            const color = style.color || '#FFFFFF';
            const padding = style.padding || '0.75rem 1.5rem';
            const borderRadius = style.borderRadius || '0.375rem';
            const styleObj = { backgroundColor, color, padding, borderRadius };
            const key = JSON.stringify(styleObj);
            if (!buttonStylesSet.has(key)) {
              buttonStylesSet.add(key);
              buttonStyles.push(styleObj);
            }
          }

          // If it's a header (h1-h6) => record header style
          if (/^h[1-6]$/i.test(el.tagName)) {
            const fontSize = style.fontSize || '1rem';
            const fontWeight = style.fontWeight || '600';
            const color = style.color || '#111827';
            let fontFamily = style.fontFamily || 'system-ui';
            fontFamily = fontFamily.replace(/['"]/g, '');

            const styleObj = { fontSize, fontWeight, color, fontFamily };
            const key = JSON.stringify(styleObj);
            if (!headerStylesSet.has(key)) {
              headerStylesSet.add(key);
              headerStyles.push(styleObj);
            }
          }

          // If it is a <section> or class includes 'section', gather background color
          if (
            el.tagName.toLowerCase() === 'section' ||
            el.className.includes('section')
          ) {
            addIfValid(sectionBgColors, style.backgroundColor);
          }

          // If it's an <img>, store resolved image src
          if (el.tagName.toLowerCase() === 'img') {
            const src = el.getAttribute('src') || '';
            // We'll do final resolution outside
            images.add(src);
          }
        });

        // Attempt to find a "logo"
        let logo = '';
        const logoImage = document.querySelector('img[src*="logo"], a[href="/"] img');
        if (logoImage) {
          logo = logoImage.getAttribute('src') || '';
        }

        // Try to find header & footer background colors
        const headerEl = document.querySelector('header');
        const footerEl = document.querySelector('footer');
        const headerBg = headerEl ? window.getComputedStyle(headerEl).backgroundColor : '';
        const footerBg = footerEl ? window.getComputedStyle(footerEl).backgroundColor : '';
        const footerLogoEl = footerEl ? footerEl.querySelector('img[src*="logo"]') : null;
        const footerLogo = footerLogoEl ? footerLogoEl.getAttribute('src') : '';

        // Build a "styles" object
        const styles = {
          spacing: ['0.5rem', '1rem', '1.5rem', '2rem'],
          borderRadius: ['0.25rem', '0.5rem', '0.75rem'],
          shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
          gradients: [],
          buttonStyles,
          headerStyles,
          layout: {
            maxWidth: '1200px',
            containerPadding: '1rem',
            gridGap: '1rem'
          }
        };

        // Save results on a global variable
        window.__SCRAPE_RESULT__ = JSON.stringify({
          colors: Array.from(colors),
          fonts: Array.from(fonts),
          images: Array.from(images),
          headings: [], // leftover from old code if needed
          logo,
          styles,
          headerBackgroundColor: headerBg,
          footerBackgroundColor: footerBg,
          footerLogo,
          sectionBackgroundColors: Array.from(sectionBgColors)
        });
      })();
    `;

    /**
     * 2. Use ScrapingBee "extract_rules" to retrieve window.__SCRAPE_RESULT__ as JSON
     *    plus "execute_script" to run the snippet.
     */
    const extractRules = {
      // We'll store the final data JSON in a field called "extracted"
      extracted: 'window.__SCRAPE_RESULT__'
    };

    // Since we want real computed styles from external CSS, be sure to set render_js=true
    const baseParams: Record<string, string> = {
      api_key: SCRAPINGBEE_API_KEY,
      url: url.toString(),
      render_js: 'true',
      block_resources: 'false',
      timeout: '20000', // bump if site is large
      js_snippet: script,
      extract_rules: JSON.stringify(extractRules),
      // you can also set "premium_proxy": "true" if you want
    };

    const queryParams = new URLSearchParams(baseParams);
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?${queryParams.toString()}`;

    // 3. Call ScrapingBee
    const response = await fetch(scrapingBeeUrl);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ScrapingBee error: ${response.status} - ${body}`);
    }

    /**
     * 4. The response from ScrapingBee is JSON that looks like:
     *    {
     *      "extracted": "stringified JSON from window.__SCRAPE_RESULT__"
     *    }
     */
    const scrapingBeeJson = await response.json();
    if (!scrapingBeeJson.extracted) {
      throw new Error(`No "extracted" data returned, raw response: ${JSON.stringify(scrapingBeeJson)}`);
    }

    // 5. Parse the stringified JSON from window.__SCRAPE_RESULT__
    const resultString = scrapingBeeJson.extracted;
    const finalData = JSON.parse(resultString);
    console.log('finalData', finalData);

    // 6. We still need to fix up image or footerLogo URLs with "resolveUrl"
    //    because the snippet just grabbed their raw "src"
    finalData.images = finalData.images.map((src: string) => resolveUrl(url, src));
    if (finalData.footerLogo) {
      finalData.footerLogo = resolveUrl(url, finalData.footerLogo);
    }

    return res.status(200).json(finalData);
  } catch (error) {
    console.error('[Scraping API] Error:', error);
    return res.status(500).json({
      error: 'Failed to scrape website',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
