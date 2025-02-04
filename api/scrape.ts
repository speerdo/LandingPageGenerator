import { NextApiRequest, NextApiResponse } from 'next';

// Example: Adjust these to match your needs
const SCRAPINGBEE_API_KEY = process.env.VITE_SCRAPINGBEE_API_KEY || '';

/**
 * Helper function to resolve relative URLs, matching your old Cheerio code.
 */
function resolveUrl(base: string, relative: string): string {
  try {
    if (!relative) return '';
    if (relative.startsWith('data:')) return '';
    if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
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
     * 1) Build JS scenario with an "evaluate" step that replicates the Cheerio logic:
     *    - Gather colors, fonts, buttonStyles, headerStyles, images, etc. using window.getComputedStyle.
     *    - Return the final object so ScrapingBee places it in evaluate_results[0].
     */
    const scenario = {
      strict: false,
      instructions: [
        {
          evaluate: `
            (function() {
              // Helper to push non-transparent items into a Set
              function addIfValid(set, val) {
                if (val && val !== 'transparent') {
                  set.add(val);
                }
              }

              // We replicate the Cheerio-based logic with DOM calls:
              const colors = new Set();
              const fonts = new Set();
              const images = new Set();
              const sectionBackgroundColors = new Set();

              // We'll store button and header styles.
              const buttonStylesSet = new Set();
              const buttonStyles = [];
              const headerStylesSet = new Set();
              const headerStyles = [];

              // Query all elements
              document.querySelectorAll('*').forEach(el => {
                const style = window.getComputedStyle(el);

                // Colors
                addIfValid(colors, style.color);
                addIfValid(colors, style.backgroundColor);

                // Fonts
                if (style.fontFamily) {
                  fonts.add(style.fontFamily.replace(/['"]/g, ''));
                }

                // If it's an <img>, gather its raw src
                if (el.tagName.toLowerCase() === 'img') {
                  const src = el.getAttribute('src') || '';
                  images.add(src);
                }

                // Button-like elements => record style
                // (adjust selectors to match your old code as needed)
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

                // Header elements (h1-h6) => record style
                if (/^h[1-6]$/i.test(el.tagName)) {
                  const fontSize = style.fontSize || '1rem';
                  const fontWeight = style.fontWeight || '600';
                  const colorVal = style.color || '#111827';
                  let fontFamily = style.fontFamily || 'system-ui';
                  fontFamily = fontFamily.replace(/['"]/g, '');

                  const styleObj = { fontSize, fontWeight, color: colorVal, fontFamily };
                  const key = JSON.stringify(styleObj);
                  if (!headerStylesSet.has(key)) {
                    headerStylesSet.add(key);
                    headerStyles.push(styleObj);
                  }
                }

                // If it's a <section> or class includes 'section', gather background color
                if (
                  el.tagName.toLowerCase() === 'section' ||
                  el.className.includes('section')
                ) {
                  addIfValid(sectionBackgroundColors, style.backgroundColor);
                }
              });

              // Attempt to find a logo
              let logo = '';
              const logoImage = document.querySelector('img[src*="logo"], a[href="/"] img');
              if (logoImage) {
                logo = logoImage.getAttribute('src') || '';
              }

              // Header & Footer background colors
              const headerEl = document.querySelector('header');
              const footerEl = document.querySelector('footer');
              const headerBackgroundColor = headerEl ? window.getComputedStyle(headerEl).backgroundColor : '';
              const footerBackgroundColor = footerEl ? window.getComputedStyle(footerEl).backgroundColor : '';
              const footerLogoEl = footerEl ? footerEl.querySelector('img[src*="logo"]') : null;
              const footerLogo = footerLogoEl ? footerLogoEl.getAttribute('src') : '';

              // Build the "styles" object
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

              // Return final result. We replicate your old JSON shape:
              return {
                colors: Array.from(colors),
                fonts: Array.from(fonts),
                images: Array.from(images),
                headings: [],  // or adapt if you want actual heading text
                logo,
                styles,
                headerBackgroundColor,
                footerBackgroundColor,
                footerLogo,
                sectionBackgroundColors: Array.from(sectionBackgroundColors)
              };
            })();
          `,
        }
      ],
    };

    /**
     * 2) Construct query parameters for ScrapingBee:
     *    - "render_js=true" loads external CSS
     *    - "json_response=true" => we get a JSON with "evaluate_results"
     *    - "js_scenario" => the scenario above
     */
    const baseParams: Record<string, string> = {
      api_key: SCRAPINGBEE_API_KEY,
      url,
      render_js: 'true',
      block_resources: 'false',
      timeout: '20000', // Increase if site is large
      json_response: 'true',
      js_scenario: JSON.stringify(scenario),
    };

    // Build final request URL
    const queryParams = new URLSearchParams(baseParams);
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?${queryParams.toString()}`;

    // 3) Call ScrapingBee
    const response = await fetch(scrapingBeeUrl);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ScrapingBee error: ${response.status} - ${body}`);
    }

    /**
     * 4) The returned JSON can look like:
     *    {
     *      "body": "<fully rendered HTML>",
     *      "evaluate_results": [
     *         {
     *           "colors": [...],
     *           "fonts": [...],
     *           ...
     *         }
     *      ],
     *      "js_scenario_report": [...]
     *    }
     */
    const scrapingBeeJson = await response.json();
    console.log('[ScrapingBee response]', JSON.stringify(scrapingBeeJson, null, 2));

    // 5) Final data is in "evaluate_results[0]"
    const finalData = scrapingBeeJson.evaluate_results?.[0];
    if (!finalData) {
      throw new Error(`No data found in evaluate_results. Raw: ${JSON.stringify(scrapingBeeJson)}`);
    }

    // 6) Fix up relative image URLs or footerLogo
    finalData.images = finalData.images.map((src: string) => resolveUrl(url, src));
    if (finalData.footerLogo) {
      finalData.footerLogo = resolveUrl(url, finalData.footerLogo);
    }
    // If you want to do the same for "logo", do so here:
    if (finalData.logo) {
      finalData.logo = resolveUrl(url, finalData.logo);
    }

    // 7) Return the final JSON the same way your old Cheerio code did
    return res.status(200).json(finalData);
  } catch (error) {
    console.error('[Scraping API] Error:', error);
    return res.status(500).json({
      error: 'Failed to scrape website',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
