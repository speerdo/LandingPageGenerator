import { supabase } from './supabase';
import type { ScrapedAssets } from '../types/scraper';

interface ScrapingLog {
  timestamp: string;
  url: string;
  success: boolean;
  assets_found: {
    colors: number;
    fonts: number;
    images: number;
    logo: boolean;
    styles: boolean;
  };
  errors?: string[];
  duration_ms: number;
}

async function logScrapingResult(
  projectId: string, 
  log: ScrapingLog
): Promise<void> {
  try {
    await supabase.from('scraping_logs').insert({
      project_id: projectId,
      url: log.url,
      success: log.success,
      assets_found: log.assets_found,
      errors: log.errors,
      duration_ms: log.duration_ms
    });
  } catch (error) {
    console.error('Failed to store scraping log:', error);
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function scrapeWebsite(url: string, projectId: string, brand?: string): Promise<ScrapedAssets> {
  const startTime = Date.now();
  
  try {
    console.log(`[Scraping] Starting scrape of ${url}`);
    const brandParam = brand ? `&brand=${encodeURIComponent(brand)}` : '';
    console.log(`[Scraping] Making request to: ${API_URL}/api/scrape?url=${encodeURIComponent(url)}${brandParam}`);
    const response = await fetch(
      `/api/scrape?url=${encodeURIComponent(url)}${
        brand ? `&brand=${encodeURIComponent(brand)}` : ""
      }`
    );
    
    console.log(`[Scraping] API Response status:`, response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Scraping] Error response:', errorText);
      throw new Error(`Failed to scrape URL: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Scraping] Raw API Response:', data);

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response data received from scraping API');
    }

    const processedData: ScrapedAssets = {
      colors: Array.isArray(data.colors) ? data.colors : [],
      fonts: Array.isArray(data.fonts) ? data.fonts : [],
      images: Array.isArray(data.images) ? data.images : [],
      headings: Array.isArray(data.headings) ? data.headings : [],
      logo: data.logo || undefined,
      styles: data.styles || {
        spacing: [],
        borderRadius: [],
        shadows: [],
        gradients: [],
        buttonStyles: [],
        headerStyles: [],
        layout: {
          maxWidth: '1200px',
          containerPadding: '1rem',
          gridGap: '1rem'
        }
      }
    };

    const duration = Date.now() - startTime;

    await logScrapingResult(projectId, {
      timestamp: new Date().toISOString(),
      url,
      success: true,
      assets_found: {
        colors: processedData.colors.length,
        fonts: processedData.fonts.length,
        images: processedData.images.length,
        logo: !!processedData.logo,
        styles: true
      },
      duration_ms: duration
    });

    return processedData;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Scraping] Error:', errorMessage);
    
    await logScrapingResult(projectId, {
      timestamp: new Date().toISOString(),
      url,
      success: false,
      assets_found: {
        colors: 0,
        fonts: 0,
        images: 0,
        logo: false,
        styles: false
      },
      errors: [errorMessage],
      duration_ms: duration
    });

    return getFallbackAssets();
  }
}

function getFallbackAssets(): ScrapedAssets {
  return {
    colors: ['#1a1a1a', '#ffffff', '#3b82f6'],
    fonts: ['system-ui', '-apple-system', 'sans-serif'],
    images: [
      'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=1200&q=80',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
      'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80'
    ],
    headings: [],
    styles: {
      spacing: ['0.5rem', '1rem', '1.5rem', '2rem'],
      borderRadius: ['0.25rem', '0.5rem', '0.75rem'],
      shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
      gradients: [],
      buttonStyles: [{
        backgroundColor: '#4F46E5',
        color: '#FFFFFF',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.375rem'
      }],
      headerStyles: [{
        fontSize: '2.25rem',
        fontWeight: '700',
        color: '#1F2937',
        fontFamily: 'system-ui'
      }],
      layout: {
        maxWidth: '1200px',
        containerPadding: '2rem',
        gridGap: '2rem'
      }
    }
  };
}