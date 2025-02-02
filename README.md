# AI Landing Page Generator

An intelligent web application that generates custom landing pages by analyzing and adapting existing website styles and content. This project leverages AI to create visually appealing, responsive landing pages tailored to a brand's unique design language.

## Overview

The AI Landing Page Generator allows you to:
- **Extract visual assets**:
  - Scrape target websites to capture brand colors, fonts, images, logos, and style details.
  - Extract layout and design properties such as header/footer background colors and section styling.
- **Generate tailored landing pages**:
  - Use OpenAI to generate complete HTML/CSS code for a landing page that matches the extracted style.
  - Optionally generate landing pages with Lorem Ipsum placeholder text.
- **Manage projects and versions**:
  - Create projects associated with a website URL.
  - Save different versions of the generated landing page for review and further customization.

## Features

- **Visual Style Extraction**:
  - Uses Puppeteer (with extra stealth plugins) and Cheerio to scrape and extract visual properties, including:
    - Colors and fonts
    - Button, header, and footer styling
    - Logo assets (with intelligent domain matching)
    - Background colors from sections to simulate a "visual screenshot."
- **AI-Powered Page Generation**:
  - Constructs a detailed text prompt for the OpenAI API based on the scraped website style.
  - Generates responsive HTML/CSS that closely matches the design of the reference website.
  - Provides an option to generate content with Lorem Ipsum text.
- **Project Management**:
  - Create a new project that saves the target URL and extracted visual assets.
  - Manage project settings and create new versions as the design is iteratively refined.
- **Responsive and Accessible**:
  - Generated pages are built using semantic HTML5.
  - Designs are responsive and aim to meet accessibility guidelines.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend/Database**: Supabase
- **AI Integration**: OpenAI
- **Web Scraping**: Puppeteer, Cheerio
- **Icons**: Lucide React

## Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/ai-landing-page-generator.git
   cd ai-landing-page-generator
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   - Create a `.env` file based on the provided `.env.example` file:
     ```bash
     cp .env.example .env
     ```
   - Add your API keys and endpoint URLs in the `.env` file:
     ```env
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     VITE_OPENAI_API_KEY=your_openai_api_key
     VITE_SCRAPINGBEE_API_KEY=your_scrapingbee_api_key
     ```

4. **Run the App**:
   ```bash
   npm run dev
   ```

## Usage

1. **Create a New Project**:
   - Enter the website URL you want to analyze.
   - Optionally provide a project name and select a brand.
   - The app will scrape the target website to collect visual assets and design details.

2. **Generate Landing Page Content**:
   - Choose between using real content or Lorem Ipsum placeholder text.
   - Optionally add additional marketing instructions.
   - The AI engine will generate the complete HTML/CSS landing page using the extracted style details.

3. **Review and Export**:
   - Preview the generated landing page.
   - Save different versions and iterate on the design as needed.

## Contributing

Contributions are welcome! If you'd like to add features or fix bugs, please follow these steps:

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push your branch:
   ```bash
   git push origin feature/your-feature
   ```
5. Open a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- **OpenAI** for providing the AI engine.
- **Supabase** for backend and authentication.
- **Puppeteer & Cheerio** for web scraping capabilities.
- **Lucide React** for the icon set.

---

Enjoy building and generating unique landing pages with AI!
