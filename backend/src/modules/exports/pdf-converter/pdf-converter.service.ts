import { Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import * as puppeteer from 'puppeteer-core';
import * as chromium from 'chromium';

export interface ConversionResult {
  pdfBuffer: Buffer;
  originalFilename: string;
  pdfFilename: string;
}

@Injectable()
export class PdfConverterService {
  private readonly logger = new Logger(PdfConverterService.name);

  /**
   * Convert DOCX buffer to PDF buffer
   * Process: DOCX → HTML → PDF
   */
  async convertDocxToPdf(
    docxBuffer: Buffer,
    originalFilename: string,
  ): Promise<ConversionResult> {
    this.logger.log(`Converting ${originalFilename} from DOCX to PDF`);

    try {
      // Step 1: DOCX → HTML using mammoth
      const htmlResult = await this.convertDocxToHtml(docxBuffer);

      // Step 2: HTML → PDF using Puppeteer
      const pdfBuffer = await this.convertHtmlToPdf(htmlResult.html);

      // Generate PDF filename
      const pdfFilename = originalFilename.replace(/\.docx$/i, '.pdf');

      this.logger.log(`Successfully converted ${originalFilename} to PDF`);

      return {
        pdfBuffer,
        originalFilename,
        pdfFilename,
      };
    } catch (error) {
      this.logger.error(`Failed to convert ${originalFilename} to PDF:`, error);
      throw error;
    }
  }

  /**
   * Convert DOCX buffer to HTML string
   */
  private async convertDocxToHtml(docxBuffer: Buffer): Promise<{ html: string }> {
    try {
      const result = await mammoth.convertToHtml(
        { buffer: docxBuffer },
        {
          // Style mapping for better PDF rendering
          styleMap: [
            // Preserve heading styles
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            // Preserve table styles
            'table => table.rubric-table',
            // Preserve bold/italic
            'b => strong',
            'i => em',
          ],
        },
      );

      if (result.messages.length > 0) {
        this.logger.warn('Mammoth conversion warnings:', result.messages);
      }

      // Wrap HTML in a complete document with print-optimized CSS
      const fullHtml = this.wrapHtmlWithStyles(result.value);

      return { html: fullHtml };
    } catch (error) {
      this.logger.error('Failed to convert DOCX to HTML:', error);
      throw error;
    }
  }

  /**
   * Wrap HTML content with print-optimized styles
   */
  private wrapHtmlWithStyles(bodyContent: string): string {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rubric Document</title>
  <style>
    /* Page setup */
    @page {
      size: A4;
      margin: 2cm 1.5cm;
    }

    /* Base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 13pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
    }

    /* Headings */
    h1 {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      margin: 1em 0 0.5em;
      text-transform: uppercase;
    }

    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin: 0.8em 0 0.4em;
    }

    h3 {
      font-size: 13pt;
      font-weight: bold;
      margin: 0.6em 0 0.3em;
    }

    /* Paragraphs */
    p {
      margin: 0.3em 0;
      text-align: justify;
    }

    /* Tables */
    table, .rubric-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      page-break-inside: avoid;
    }

    table th, table td,
    .rubric-table th, .rubric-table td {
      border: 1px solid #000;
      padding: 0.4em 0.6em;
      text-align: left;
      vertical-align: top;
    }

    table th, .rubric-table th {
      background-color: #f0f0f0;
      font-weight: bold;
      text-align: center;
    }

    /* Lists */
    ul, ol {
      margin: 0.5em 0 0.5em 2em;
    }

    li {
      margin: 0.2em 0;
    }

    /* Text formatting */
    strong {
      font-weight: bold;
    }

    em {
      font-style: italic;
    }

    /* Print optimizations */
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      table, .rubric-table {
        page-break-inside: avoid;
      }

      h1, h2, h3 {
        page-break-after: avoid;
      }
    }

    /* Signature section */
    .signature-section {
      margin-top: 2em;
      page-break-inside: avoid;
    }

    .signature-row {
      display: flex;
      justify-content: space-between;
      margin-top: 1em;
    }

    .signature-box {
      text-align: center;
      width: 45%;
    }

    .signature-box p {
      text-align: center;
      margin: 0.5em 0;
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>
    `.trim();
  }

  /**
   * Convert HTML string to PDF buffer using Puppeteer
   */
  private async convertHtmlToPdf(html: string): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;

    try {
      browser = await puppeteer.launch({
        executablePath: chromium.path,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        headless: true,
      });

      const page = await browser.newPage();

      // Set content with UTF-8 encoding
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // Generate PDF with A4 format
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '2cm',
          right: '1.5cm',
          bottom: '2cm',
          left: '1.5cm',
        },
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error('Failed to convert HTML to PDF:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Check if a filename is a DOCX file
   */
  isDocxFile(filename: string): boolean {
    return filename.toLowerCase().endsWith('.docx');
  }

  /**
   * Generate PDF filename from DOCX filename
   */
  getPdfFilename(docxFilename: string): string {
    return docxFilename.replace(/\.docx$/i, '.pdf');
  }
}
