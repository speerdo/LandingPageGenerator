export interface ScrapedImage {
  src: string;
  width?: string;
  height?: string;
}

export interface ButtonStyle {
  backgroundColor: string;
  color: string;
  padding: string;
  borderRadius: string;
  text: string;
}

export interface Section {
  id?: string;
  className?: string;
  backgroundColor?: string;
  firstHeading?: string;
  images: string[];
}

export interface MetaInfo {
  title: string;
  description: string;
  viewport: string;
  themeColor: string;
}

export interface Layout {
  header: {
    height?: string;
    backgroundColor?: string;
  };
  footer: {
    height?: string;
    backgroundColor?: string;
  };
  mainContent: {
    maxWidth?: string;
    padding?: string;
  };
}

export interface AIPromptResponse {
  html: string;
  css: string;
  error?: string;
}

export interface WebsiteStyle {
  colors: string[];
  fonts: string[];
  images: ScrapedImage[];
  logo?: string;
  metaDescription?: string;
  headings?: string[];
  styles: {
    layout: {
      maxWidth: string;
      containerPadding: string;
      gridGap: string;
    };
    buttonStyles: {
      backgroundColor: string;
      color: string;
      padding: string;
      borderRadius: string;
    }[];
    headerStyles: {
      fontFamily: string;
      fontSize: string;
      fontWeight: string;
      color: string;
    }[];
    gradients: string[];
    shadows: string[];
    borderRadius: string[];
  };
}

export type ExtendedWebsiteStyle = WebsiteStyle & {
  headerBackgroundColor?: string;
  footerBackgroundColor?: string;
  footerLogo?: string;
  sectionBackgroundColors?: string[];
  sections?: {
    id?: string;
    className?: string;
    firstHeading?: string;
    backgroundColor?: string;
    images?: string[];
  }[];
}; 