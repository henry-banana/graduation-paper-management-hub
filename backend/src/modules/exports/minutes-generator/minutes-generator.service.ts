import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer-core';
import { renderMinutesHtml, MinutesTemplateData } from './minutes.template';
import chromium = require('chromium');
import { existsSync } from 'node:fs';


export interface GeneratedPdf {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/**
 * MinutesGeneratorService
 *
 * Renders biên bản họp hội đồng as a PDF using Puppeteer + Chromium.
 * Uses the bundled `chromium` npm package for consistent rendering
 * across environments (avoids needing a system Chrome install).
 *
 * Usage:
 *   const pdf = await minutesGeneratorService.generatePdf(data);
 *   // pdf.buffer → upload to Google Drive
 */
@Injectable()
export class MinutesGeneratorService {
  private readonly logger = new Logger(MinutesGeneratorService.name);
  private readonly fallbackExecutablePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  async generatePdf(data: MinutesTemplateData): Promise<GeneratedPdf> {
    this.logger.log(`Generating minutes PDF for topic: "${data.topicTitle}"`);

    const html = renderMinutesHtml(data);

    let browser: puppeteer.Browser | null = null;
    try {
      const executablePath = this.resolveExecutablePath();
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1240, height: 1754 }); // A4 at 150dpi

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '2cm',
          bottom: '2cm',
          left: '2.5cm',
          right: '2cm',
        },
        preferCSSPageSize: false,
      });

      const safeTitle = data.topicTitle
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 40);

      const filename = `bienban_${safeTitle}_${Date.now()}.pdf`;

      this.logger.log(`PDF generated: ${filename} (${pdfBuffer.byteLength} bytes)`);

      return {
        buffer: Buffer.from(pdfBuffer),
        filename,
        mimeType: 'application/pdf',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`PDF generation failed: ${msg}`);
      throw new Error(`Không thể tạo PDF biên bản: ${msg}`);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Generate a preview (returns HTML string for debugging)
   */
  renderPreviewHtml(data: MinutesTemplateData): string {
    return renderMinutesHtml(data);
  }

  private resolveExecutablePath(): string {
    const candidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      process.env.CHROME_PATH,
      chromium.path,
      ...this.fallbackExecutablePaths,
    ].filter((candidate): candidate is string => !!candidate && candidate.trim().length > 0);

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      'No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install chromium in runtime environment.',
    );
  }
}
