declare module "pdfjs-dist/build/pdf.mjs" {
  export interface PDFTextItem {
    str: string;
  }

  export interface PDFMarkedContentItem {
    type: string;
    id?: string;
  }

  export interface PDFTextContent {
    items: (PDFTextItem | PDFMarkedContentItem)[];
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<PDFTextContent>;
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(source: { data: Uint8Array }): {
    promise: Promise<PDFDocumentProxy>;
  };
}
