/// <reference types="vite/client" />
import OpenAI from 'openai';
import type { ExtendedWebsiteStyle, AIPromptResponse } from '../types/website';
import { getFallbackTemplate } from './templates';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

let openaiClient: OpenAI | null = null;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 20000; // 20 seconds between requests

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: false
    });
  }
  return openaiClient;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
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
      
      const fullPrompt = `Create a modern, responsive landing page that matches this exact style guide:

      Brand Identity:
      ${style?.logo ? `Logo: ${style.logo}` : ''}
      Colors: ${style?.colors?.join(', ')}
      Typography: ${style?.fonts?.join(', ')}

      Layout & Structure:
      Max Width: ${style?.styles?.layout?.maxWidth}
      Padding: ${style?.styles?.layout?.containerPadding}
      Grid Gap: ${style?.styles?.layout?.gridGap}

      Visual Effects:
      ${style?.styles?.gradients?.length ? `Gradients: ${style?.styles?.gradients?.join(', ')}` : ''}
      ${style?.styles?.shadows?.length ? `Shadows: ${style?.styles?.shadows?.join(', ')}` : ''}
      ${style?.styles?.borderRadius?.length ? `Border Radius Styles: ${style?.styles?.borderRadius?.join(', ')}` : ''}

      Sections:
      ${style?.sections?.map(section => `
      Section: ${section.id || section.className}
      Heading: ${section.firstHeading}
      Background: ${section.backgroundColor}
      ${section.images?.length ? `Images: ${section.images.join(', ')}` : ''}
      `).join('\n')}

      Components:
      Buttons: ${style?.styles?.buttonStyles?.map((btn) => 
        `${btn.backgroundColor}, ${btn.color}, ${btn.padding}, ${btn.borderRadius}`
      ).join(', ')}

      Headers: ${style?.styles?.headerStyles?.map(header => 
        `${header.fontFamily} ${header.fontSize} ${header.fontWeight} ${header.color}`
      ).join(', ')}

      Meta Information:
      ${style?.metaDescription || ''}

      Requirements:
      1. Use ONLY the exact colors, fonts, and styles specified above
      2. Create a responsive, mobile-first layout that works on all devices using semantic HTML5 elements
      3. Include hover states for interactive elements
      4. Ensure accessibility compliance
      5. Use provided background colors and images
      6. Include the logo and images in appropriate sections
      7. Follow the exact spacing and layout values provided
      8. Make sure any years are updated to the current year ${new Date().getFullYear()}
      9. Make sure unless specified below, do not include any navigation or links in the header other than the logo
      10. This is a single page website, a landing page so let that guide the layout

      Additional Requirements:
      ${prompt}

      Generate complete HTML with embedded CSS. No explanations needed.`;

      const completion = await openai.chat.completions.create({
        model: "o1-mini",
        messages: [{ role: "user", content: fullPrompt }],
        temperature: 1,
        max_tokens: 8000,
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
        await delay(RETRY_DELAY * retries);
        continue;
      }
    }
  }

  return {
    html: getFallbackTemplate(style || {}),
    css: '',
    error: lastError?.message || 'Failed to generate content'
  };
}