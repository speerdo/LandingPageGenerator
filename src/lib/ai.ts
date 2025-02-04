/// <reference types="vite/client" />
import OpenAI from 'openai';
import type { WebsiteStyle as BaseWebsiteStyle } from '../types/database';

export type ExtendedWebsiteStyle = BaseWebsiteStyle & {
  headerBackgroundColor?: string;
  footerBackgroundColor?: string;
  footerLogo?: string;
  sectionBackgroundColors?: string[];
};

interface AIPromptResponse {
  html: string;
  css: string;
  error?: string;
}

let openaiClient: OpenAI | null = null;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 20000; // 20 seconds between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  return openaiClient;
}

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Improved fallback template with better styling and structure
export function getFallbackTemplate(assets: Partial<ExtendedWebsiteStyle>): string {
  const primaryColor = assets.colors?.[0] || '#4F46E5';
  const textColor = assets.colors?.[1] || '#1F2937';
  const backgroundColor = assets.colors?.[2] || '#F9FAFB';
  const fontFamily = assets.fonts?.[0] || 'system-ui, -apple-system, sans-serif';
  const logo = assets.logo;
  const images = assets.images || [];
  const headerStyle = assets.styles?.headerStyles?.[0] || {
    fontSize: '2.25rem',
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'system-ui'
  };
  const buttonStyle = assets.styles?.buttonStyles?.[0] || {
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem'
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Landing Page</title>
    <style>
        :root {
            --primary-color: ${primaryColor};
            --text-color: ${textColor};
            --bg-color: ${backgroundColor};
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            font-family: ${fontFamily};
            color: var(--text-color);
            background-color: var(--bg-color);
            line-height: 1.5;
        }
        
        .container {
            max-width: ${assets.styles?.layout?.maxWidth || '1200px'};
            margin: 0 auto;
            padding: ${assets.styles?.layout?.containerPadding || '2rem'};
        }
        
        .hero {
            text-align: center;
            padding: 4rem 2rem;
            background: ${assets.styles?.gradients?.[0] || 'transparent'};
        }
        
        .hero h1 {
            font-size: ${headerStyle.fontSize};
            font-weight: ${headerStyle.fontWeight};
            color: ${headerStyle.color};
            margin-bottom: 1.5rem;
            line-height: 1.2;
        }
        
        .hero p {
            font-size: 1.25rem;
            margin-bottom: 2rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .button {
            display: inline-block;
            background-color: ${buttonStyle.backgroundColor};
            color: ${buttonStyle.color};
            padding: ${buttonStyle.padding};
            border-radius: ${buttonStyle.borderRadius};
            text-decoration: none;
            transition: opacity 0.2s, transform 0.2s;
            box-shadow: ${assets.styles?.shadows?.[0] || '0 1px 3px rgba(0,0,0,0.1)'};
        }
        
        .button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        .logo {
            max-width: 200px;
            margin-bottom: 2rem;
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: ${assets.styles?.layout?.gridGap || '2rem'};
            padding: 4rem 0;
        }
        
        .feature {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: ${assets.styles?.borderRadius?.[0] || '0.5rem'};
            box-shadow: ${assets.styles?.shadows?.[0] || '0 1px 3px rgba(0,0,0,0.1)'};
        }
        
        .feature img {
            width: 100%;
            max-width: 300px;
            height: 200px;
            object-fit: cover;
            border-radius: ${assets.styles?.borderRadius?.[0] || '0.5rem'};
            margin-bottom: 1.5rem;
        }
        
        @media (max-width: 768px) {
            .hero h1 {
                font-size: calc(${headerStyle.fontSize} * 0.75);
            }
            .hero p {
                font-size: 1rem;
            }
            .features {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="hero">
        <div class="container">
            ${logo ? `<img src="${logo}" alt="Logo" class="logo">` : ''}
            <h1>Welcome to Our Landing Page</h1>
            <p>We're currently experiencing high demand. Please try again in a few moments.</p>
            <a href="#" class="button">Get Started</a>
        </div>
    </div>
    
    <div class="container">
        <div class="features">
            ${images.slice(0, 3).map((img, i) => `
            <div class="feature">
                <img src="${img}" alt="Feature ${i + 1}">
                <h3>Feature ${i + 1}</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
}

export async function generateLandingPage(
  prompt: string,
  style?: ExtendedWebsiteStyle
): Promise<AIPromptResponse> {
  let retries = 0;
  let lastError: Error | null = null;

  while (retries < MAX_RETRIES) {
    try {
      await waitForRateLimit();
      const openai = getOpenAIClient();
      
      const fullPrompt = `Create a modern, responsive, single page landing page that matches this exact style guide:

      Brand Colors (use these exact values):
      ${style?.colors?.map((color, i) => `${i === 0 ? 'Primary: ' : i === 1 ? 'Text: ' : 'Background: '}${color}`).join('\n')}

      Typography:
      Fonts: ${style?.fonts?.join(', ') || 'system-ui, -apple-system, sans-serif'}
      Headings: ${style?.styles?.headerStyles?.map(h => 
        `- Font: ${h.fontFamily}, Size: ${h.fontSize}, Weight: ${h.fontWeight}, Color: ${h.color}`
      ).join('\n')}

      Buttons:
      ${style?.styles?.buttonStyles?.map(btn => 
        `- Background: ${btn.backgroundColor}
        Text Color: ${btn.color}
        Padding: ${btn.padding}
        Border Radius: ${btn.borderRadius}`
      ).join('\n')}

      Layout:
      - Container Width: ${style?.styles?.layout?.maxWidth}
      - Padding: ${style?.styles?.layout?.containerPadding}
      - Grid Gap: ${style?.styles?.layout?.gridGap}

      Visual Details:
      Header Background Color: ${style?.headerBackgroundColor || 'N/A'}
      Footer Background Color: ${style?.footerBackgroundColor || 'N/A'}
      Footer Logo: ${style?.footerLogo || 'N/A'}
      Section Background Colors: ${style?.sectionBackgroundColors?.join(', ') || 'N/A'}

      Visual Effects:
      ${style?.styles?.gradients?.length ? `Gradients:\n${style?.styles?.gradients.map(g => `- ${g}`).join('\n')}` : ''}
      ${style?.styles?.shadows?.length ? `Shadows:\n${style?.styles?.shadows.map(s => `- ${s}`).join('\n')}` : ''}
      Border Radius: ${style?.styles?.borderRadius?.join(', ')}

      Assets:
      ${style?.logo ? `Logo: ${style.logo}` : ''}
      ${style?.images?.length ? `Images:\n${style.images.map(img => `- ${img}`).join('\n')}` : ''}
      ${style?.metaDescription ? `Meta Description: ${style.metaDescription}` : ''}

      Requirements:
      1. Use ONLY the exact colors, fonts, and styles specified above
      2. Create a responsive layout that works on all devices using semantic HTML5 elements
      3. Include hover states for interactive elements
      4. Ensure accessibility compliance
      5. Use provided background colors and images
      6. Include the logo and images in appropriate sections
      7. Follow the exact spacing and layout values provided
      8. Make sure any years are updated to the current year ${new Date().getFullYear()}
      9. Make sure that unless specified below, do not include any navigation or links in the header other than the logo
      10. Use Lorem Ipsum for all text content unless otherwise specified below.

      Additional Content Requirements:
      ${prompt}

      Respond ONLY with the complete HTML code including embedded CSS. Do not include any explanations or markdown.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: 'system', content: 'You are a helpful assistant specialized in web development and design.' },
          { role: 'user', content: fullPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      const generatedCode = completion.choices[0].message.content;

      if (!generatedCode) {
        throw new Error('Failed to generate landing page content');
      }

      return {
        html: generatedCode,
        css: '',
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Check if the error is retryable
      const isRetryable = 
        lastError.message.includes('rate_limit') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('network') ||
        lastError.message.includes('internal_error');

      if (!isRetryable) {
        break;
      }

      retries++;
      if (retries < MAX_RETRIES) {
        await delay(RETRY_DELAY * retries); // Exponential backoff
        continue;
      }
    }
  }

  // Return fallback template with appropriate error message
  return {
    html: getFallbackTemplate(style || {}),
    css: '',
    error: lastError?.message || 'Failed to generate content'
  };
}