export interface ScrapedAssets {
  colors: string[];
  fonts: string[];
  images: string[];
  logo?: string;
  headings: string[];
  styles: {
    spacing: string[];
    borderRadius: string[];
    shadows: string[];
    gradients: string[];
    buttonStyles: {
      backgroundColor: string;
      color: string;
      padding: string;
      borderRadius: string;
    }[];
    headerStyles: {
      fontSize: string;
      fontWeight: string;
      color: string;
      fontFamily: string;
    }[];
    layout: {
      maxWidth: string;
      containerPadding: string;
      gridGap: string;
    };
  };
} 