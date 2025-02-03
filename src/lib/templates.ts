import type { ExtendedWebsiteStyle, ButtonStyle, ScrapedImage } from '../types/website';

export function getFallbackTemplate(assets: Partial<ExtendedWebsiteStyle>): string {
  const primaryColor = assets.colors?.[0] || '#4F46E5';
  const textColor = assets.colors?.[1] || '#1F2937';
  const backgroundColor = assets.colors?.[2] || '#F9FAFB';
  const fontFamily = assets.styles?.headerStyles?.[0]?.fontFamily || 'system-ui, -apple-system, sans-serif';
  const logo = assets.logo;
  const images: ScrapedImage[] = assets.images || [];

  const mainContentMaxWidth = assets.styles?.layout?.maxWidth || '1200px';
  const mainContentPadding = assets.styles?.layout?.containerPadding || '1rem';

  const buttons: ButtonStyle[] = (assets.styles?.buttonStyles || []).map(btn => ({
    ...btn,
    text: 'Button'
  }));

  const buttonStyles = buttons.map(btn => `
    .button-${btn.text.replace(/\s+/g, '-').toLowerCase()} {
      background-color: ${btn.backgroundColor};
      color: ${btn.color};
      padding: ${btn.padding};
      border-radius: ${btn.borderRadius};
      font-size: 1rem;
      border: none;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }

    .button-${btn.text.replace(/\s+/g, '-').toLowerCase()}:hover {
      opacity: 0.9;
    }
  `).join('\n');

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
        
        .header {
            height: 60px;
            background-color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 1rem;
        }

        ${buttonStyles}
        
        .container {
            max-width: ${mainContentMaxWidth};
            margin: 0 auto;
            padding: ${mainContentPadding};
        }
        
        .hero {
            text-align: center;
            padding: 4rem 2rem;
            background: transparent;
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
            padding: 4rem 0;
        }
        
        .feature {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .feature img {
            width: 100%;
            max-width: 300px;
            height: 200px;
            object-fit: cover;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
        }
        
        @media (max-width: 768px) {
            .hero h1 {
                font-size: calc(2.25rem * 0.75);
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
    <div class="header">
        ${logo ? `<img src="${logo}" alt="Logo" class="logo" />` : ''}
    </div>
    
    <div class="hero">
        <div class="container">
            <h1>Welcome to Our Landing Page</h1>
            <p>We're currently experiencing high demand. Please try again in a few moments.</p>
            ${buttons.map(btn => `<a href="#" class="button-${btn.text.replace(/\s+/g, '-').toLowerCase()}">${btn.text}</a>`).join(' ')}
        </div>
    </div>
    
    <div class="container">
        <div class="features">
            ${images.slice(0, 3).map((img, i) => `
            <div class="feature">
                <img src="${img.src}" alt="Feature ${i + 1}" width="${img.width || '300'}" height="${img.height || '200'}">
                <h3>Feature ${i + 1}</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            </div>
            `).join('')}
        </div>
    </div>

    <div class="footer">
        <div class="container">
            <p>&copy; 2023 Your Company. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
}