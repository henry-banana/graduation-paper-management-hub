import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateBcttRubricDocx,
  BcttRubricData,
} from './bctt-rubric.generator';
import {
  generateKltnGvhdRubricDocx,
  KltnGvhdRubricData,
} from './kltn-gvhd-rubric.generator';
import {
  generateKltnGvpbRubricDocx,
  KltnGvpbRubricData,
} from './kltn-gvpb-rubric.generator';
import {
  generateKltnCouncilRubricDocx,
  KltnCouncilRubricData,
} from './kltn-council-rubric.generator';
import Docxtemplater = require('docxtemplater');
import PizZip = require('pizzip');

export type RubricType = 'BCTT' | 'KLTN_GVHD' | 'KLTN_GVPB' | 'KLTN_COUNCIL';

export interface GeneratedDocument {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

const RUBRIC_TEMPLATE_FILE_MAP: Record<RubricType, string> = {
  BCTT: 'bctt-rubric-template.docx',
  KLTN_GVHD: 'kltn-gvhd-rubric-template.docx',
  KLTN_GVPB: 'kltn-gvpb-rubric-template.docx',
  KLTN_COUNCIL: 'kltn-council-rubric-template.docx',
};

const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Score placeholder injection config:
 * Each entry defines which score key fills which template score row,
 * identified by finding the "max score" text in the row.
 */
interface ScorePlaceholderConfig {
  /** Text found in the max-score column cell (e.g. "2", "1", "0.5") */
  maxScoreText: string;
  /** Keyword to identify the criterion row (found in criterion cell text) */
  criterionKeyword: string;
  /** The placeholder key to inject (maps to payload key score_xxx) */
  placeholderKey: string;
}

const SCORE_INJECTION_MAP: Record<RubricType, ScorePlaceholderConfig[]> = {
  BCTT: [
    { maxScoreText: '2', criterionKeyword: 'thái độ', placeholderKey: 'score_thaido' },
    { maxScoreText: '1', criterionKeyword: 'hình thức', placeholderKey: 'score_hinhthuc' },
    { maxScoreText: '1', criterionKeyword: 'mở đầu', placeholderKey: 'score_modau' },
    { maxScoreText: '5', criterionKeyword: 'nội dung', placeholderKey: 'score_noidung' },
    { maxScoreText: '1', criterionKeyword: 'kết luận', placeholderKey: 'score_ketluan' },
  ],
  KLTN_GVHD: [
    { maxScoreText: '1', criterionKeyword: 'xác định', placeholderKey: 'score_xacdinhvande' },
    { maxScoreText: '3', criterionKeyword: 'nội dung', placeholderKey: 'score_noidung' },
    { maxScoreText: '3', criterionKeyword: 'kết quả', placeholderKey: 'score_ketqua' },
    { maxScoreText: '1', criterionKeyword: 'hình thức', placeholderKey: 'score_hinhthuc' },
    { maxScoreText: '2', criterionKeyword: 'thái độ', placeholderKey: 'score_tinhthan' },
  ],
  KLTN_GVPB: [
    { maxScoreText: '1', criterionKeyword: 'xác định', placeholderKey: 'score_xacdinhvande' },
    { maxScoreText: '3', criterionKeyword: 'nội dung', placeholderKey: 'score_noidung' },
    { maxScoreText: '3', criterionKeyword: 'kết quả', placeholderKey: 'score_ketqua' },
    { maxScoreText: '1', criterionKeyword: 'hình thức', placeholderKey: 'score_hinhthuc' },
    { maxScoreText: '2', criterionKeyword: 'trả lời', placeholderKey: 'score_traloi' },
  ],
  KLTN_COUNCIL: [
    { maxScoreText: '4', criterionKeyword: 'nội dung', placeholderKey: 'score_noidung' },
    { maxScoreText: '2', criterionKeyword: 'trình bày', placeholderKey: 'score_trinh_bay' },
    { maxScoreText: '3', criterionKeyword: 'trả lời', placeholderKey: 'score_traloi' },
    { maxScoreText: '1', criterionKeyword: 'hình thức', placeholderKey: 'score_hinhthuc' },
  ],
};

@Injectable()
export class RubricGeneratorService {
  private readonly logger = new Logger(RubricGeneratorService.name);
  private readonly templateDir = path.join(
    process.cwd(),
    'resources',
    'docx-templates',
  );

  async generateBctt(data: BcttRubricData): Promise<GeneratedDocument> {
    this.logger.log(`Generating BCTT rubric for student ${data.studentId}`);

    const fallbackGenerator = async () => generateBcttRubricDocx(data);
    return this.generateByType(
      'BCTT',
      data.studentId,
      this.toPayloadRecord(data),
      fallbackGenerator,
      'rubric_bctt',
    );
  }

  async generateKltnGvhd(data: KltnGvhdRubricData): Promise<GeneratedDocument> {
    this.logger.log(`Generating KLTN GVHD rubric for student ${data.studentId}`);

    const fallbackGenerator = async () => generateKltnGvhdRubricDocx(data);
    return this.generateByType(
      'KLTN_GVHD',
      data.studentId,
      this.toPayloadRecord(data),
      fallbackGenerator,
      'rubric_kltn_gvhd',
    );
  }

  async generateKltnGvpb(data: KltnGvpbRubricData): Promise<GeneratedDocument> {
    this.logger.log(`Generating KLTN GVPB rubric for student ${data.studentId}`);

    const fallbackGenerator = async () => generateKltnGvpbRubricDocx(data);
    return this.generateByType(
      'KLTN_GVPB',
      data.studentId,
      this.toPayloadRecord(data),
      fallbackGenerator,
      'rubric_kltn_gvpb',
    );
  }

  async generateKltnCouncil(
    data: KltnCouncilRubricData,
  ): Promise<GeneratedDocument> {
    this.logger.log(
      `Generating KLTN council rubric for student ${data.studentId} by ${data.memberName}`,
    );

    const fallbackGenerator = async () => generateKltnCouncilRubricDocx(data);
    return this.generateByType(
      'KLTN_COUNCIL',
      data.studentId,
      this.toPayloadRecord(data),
      fallbackGenerator,
      `rubric_kltn_hd_${data.memberRole.toLowerCase()}`,
    );
  }

  private toPayloadRecord(value: unknown): Record<string, unknown> {
    return value as unknown as Record<string, unknown>;
  }

  private async generateByType(
    rubricType: RubricType,
    studentId: string,
    payload: Record<string, unknown>,
    fallbackGenerator: () => Promise<Buffer>,
    filePrefix: string,
  ): Promise<GeneratedDocument> {
    const renderedFromTemplate = this.renderTemplateIfPossible(rubricType, payload);
    const buffer = renderedFromTemplate ?? (await fallbackGenerator());

    return {
      buffer,
      filename: `${filePrefix}_${studentId}_${Date.now()}.docx`,
      mimeType: DOCX_MIME_TYPE,
    };
  }

  private renderTemplateIfPossible(
    rubricType: RubricType,
    payload: Record<string, unknown>,
  ): Buffer | null {
    const templatePath = path.join(
      this.templateDir,
      RUBRIC_TEMPLATE_FILE_MAP[rubricType],
    );

    if (!fs.existsSync(templatePath)) {
      this.logger.warn(
        `Template not found for ${rubricType}: ${templatePath}. Falling back to generator.`,
      );
      return null;
    }

    try {
      const templateBinary = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(templateBinary);
      const documentXml = zip.file('word/document.xml')?.asText() ?? '';

      // ── Path A: template already has {{placeholders}} ──────────────────────
      // Just render directly — no XML injection needed.
      if (this.hasPlaceholder(documentXml)) {
        const templatePayload = this.buildTemplatePayload(payload);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });
        doc.render(templatePayload);
        const rendered = doc
          .getZip()
          .generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
        this.logger.log(`Template rendered (placeholder mode) for ${rubricType}`);
        return Buffer.from(rendered);
      }

      // ── Path B: legacy template with dotted (.....) markers ────────────────
      // Inject {{placeholders}} at runtime into the XML, then render.
      const templatePayload = this.buildTemplatePayload(payload);
      const injectedXml = this.injectPlaceholders(documentXml, rubricType);

      if (this.hasPlaceholder(injectedXml)) {
        // Keep injected render isolated so Path B failures on non-placeholder
        // templates do not continue to unsafe Path C dotted replacement.
        try {
          zip.file('word/document.xml', injectedXml);
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
          });
          doc.render(templatePayload);
          const rendered = doc
            .getZip()
            .generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
          this.logger.log(`Template rendered (injected mode) for ${rubricType}`);
          return Buffer.from(rendered);
        } catch (pathBError) {
          const msg = pathBError instanceof Error ? pathBError.message : 'unknown';
          this.logger.warn(
            `Path B (injected docxtemplater) failed for ${rubricType}: ${msg}. Unsafe to continue with Path C on non-placeholder template. Skipping Path C for safety and falling back to deterministic generator.`,
          );
          return null;
        }
      }

      // ── Path C: legacy dotted replacement (last resort) ───────────────────
      const legacyRendered = this.renderLegacyTemplateIfPossible(
        zip,
        rubricType,
        documentXml,
        templatePayload,
      );
      if (legacyRendered) {
        return legacyRendered;
      }

      this.logger.warn(
        `Template ${path.basename(templatePath)} has no supported markers. Falling back to generator.`,
      );
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Template rendering failed for ${rubricType}: ${message}. Falling back to generator.`,
      );
      return null;
    }
  }

  /**
   * Inject {{mustache}} placeholders into the raw document XML.
   * This allows docxtemplater to fill in dynamic values even when
   * the original .docx template was created without placeholders.
   *
   * Strategy:
   * 1. Find score cells (column "Điểm") in rubric rows → inject {{score_xxx}}
   * 2. Find "Tổng điểm" cell → inject {{totalScoreFixed}}
   * 3. Find "Cho SV bảo vệ" checkbox text → prefix with {{cho_bao_ve_mark}}
   * 4. Find "Không cho SV bảo vệ" checkbox text → prefix with {{khong_bao_ve_mark}}
   * 5. Find date pattern "Ngày ….tháng…..năm" → replace with formatted date
   */
  private injectPlaceholders(xml: string, rubricType: RubricType): string {
    let result = xml;

    // ── 1. Score cells injection ─────────────────────────────────────────────
    // Tables in OOXML: each <w:tr> is a row, each <w:tc> is a cell.
    // The score cells (rightmost "Điểm" column) are typically empty <w:tc>
    // at the end of criterion rows. We identify rows by their criterion text
    // (normalized) and inject the correct placeholder into the last empty cell.
    const configs = SCORE_INJECTION_MAP[rubricType] ?? [];

    for (const config of configs) {
      result = this.injectScoreCellPlaceholder(result, config);
    }

    // ── 2. Tổng điểm cell injection ──────────────────────────────────────────
    result = this.injectTotalScorePlaceholder(result);

    // ── 3 & 4. Defense checkbox marks ────────────────────────────────────────
    result = this.injectDefenseCheckboxMarks(result);

    // ── 5. Date injection ─────────────────────────────────────────────────────
    result = this.injectDatePlaceholders(result);

    // ── 6. Student name / MSSV / topic (fill blank dotted areas) ─────────────
    result = this.injectHeaderFields(result, rubricType);

    return result;
  }

  /**
   * Find a table row containing a criterion keyword and inject a score
   * placeholder into its last (score) cell if it is empty.
   */
  private injectScoreCellPlaceholder(
    xml: string,
    config: ScorePlaceholderConfig,
  ): string {
    // Match <w:tr>...</w:tr> table rows
    const rowPattern = /(<w:tr[ >][\s\S]*?<\/w:tr>)/g;
    const normalizedKeyword = this.normalizeVietnamese(config.criterionKeyword);

    return xml.replace(rowPattern, (row) => {
      const rowText = (row.replace(/<[^>]+>/g, ' ') + ' ').toLowerCase();
      const normalizedRowText = this.normalizeVietnamese(rowText);

      // Check if this row contains the criterion keyword
      if (!normalizedRowText.includes(normalizedKeyword)) {
        return row;
      }

      // Check if row contains the max score text (to avoid matching header row)
      // The max score cell contains just the number like "1", "2", "3"
      const cellTexts = this.extractCellTexts(row);
      const hasMaxScore = cellTexts.some(
        (t) => t.trim() === config.maxScoreText,
      );
      if (!hasMaxScore) {
        return row;
      }

      // Find the last <w:tc> (score cell) and inject placeholder if empty
      return this.injectIntoLastEmptyCell(row, `{{${config.placeholderKey}}}`);
    });
  }

  /**
   * Find the "Tổng điểm" row and inject {{totalScoreFixed}} into its last cell.
   */
  private injectTotalScorePlaceholder(xml: string): string {
    const rowPattern = /(<w:tr[ >][\s\S]*?<\/w:tr>)/g;

    return xml.replace(rowPattern, (row) => {
      const rowText = row.replace(/<[^>]+>/g, ' ');
      const normalized = this.normalizeVietnamese(rowText);

      if (
        !normalized.includes('tong diem') &&
        !normalized.includes('tổng điểm')
      ) {
        return row;
      }

      return this.injectIntoLastEmptyCell(row, '{{totalScoreFixed}}');
    });
  }

  /**
   * Inject ☑/☐ markers before "Cho SV bảo vệ" and "Không cho SV bảo vệ" text.
   * We replace the checkbox area text with {{cho_bao_ve_mark}} and {{khong_bao_ve_mark}}
   * which will be filled from the payload.
   */
  private injectDefenseCheckboxMarks(xml: string): string {
    // Match the text run containing "Cho SV bảo vệ" (with or without "Không")
    // Strategy: replace the dotted checkbox area / spacing before these texts

    // Pattern for "□ Cho SV bảo vệ trước hội đồng" area
    // The template has checkbox chars (□ = U+25A1) before the text, or just spaces
    let result = xml;

    // Replace "Cho SV bảo vệ trước hội đồng" text node (without "Không" prefix)
    // We look for the text content in <w:t>
    result = result.replace(
      /(<w:t[^>]*>)(\s*(?:□\s*)?Cho SV bảo vệ trước hội đồng\s*)(<\/w:t>)/g,
      '$1{{cho_bao_ve_mark}} Cho SV bảo vệ trước hội đồng$3',
    );

    result = result.replace(
      /(<w:t[^>]*>)(\s*(?:□\s*)?Không cho SV bảo vệ trước hội đồng\s*)(<\/w:t>)/g,
      '$1{{khong_bao_ve_mark}} Không cho SV bảo vệ trước hội đồng$3',
    );

    return result;
  }

  /**
   * Replace "Ngày ….tháng…..năm ……" date pattern with {{ngayCham}} placeholder.
   */
  private injectDatePlaceholders(xml: string): string {
    // Match various Vietnamese date patterns in template
    let result = xml;

    // Pattern: "Ngày ....tháng.....năm ......" (dots as placeholders)
    result = result.replace(
      /(<w:t[^>]*>)([^<]*Ngày\s*[.…\u2026]+\s*tháng\s*[.…\u2026]+\s*năm\s*[.…\u2026]*[^<]*)(<\/w:t>)/gi,
      '$1Ngày {{ngay}} tháng {{thang}} năm {{nam}}$3',
    );

    return result;
  }

  /**
   * Inject header field placeholders for student name, MSSV, and topic title.
   * These replace the existing dotted (.....) patterns in the template.
   */
  private injectHeaderFields(xml: string, rubricType: RubricType): string {
    let result = xml;

    // Unified: both ASCII dots (.....) and Unicode ellipsis (… U+2026)
    const D = '[.\u2026]{2,}';

    // "Sinh viên thực hiện: …" OR "SVTH: ……" (BCTT template) → studentName
    result = result.replace(
      new RegExp(`(<w:t[^>]*>)([^<]*(?:Sinh vi\u00ean th\u1ef1c hi\u1ec7n|SVTH):\\s*)(${D})([^<]*)(<\/w:t>)`, 'gi'),
      '$1$2{{studentName}}$4$5',
    );

    // MSSV: …… → studentId
    result = result.replace(
      new RegExp(`(<w:t[^>]*>)([^<]*MSSV:\\s*)(${D})([^<]*)(<\/w:t>)`, 'gi'),
      '$1$2{{studentId}}$4$5',
    );

    // Lớp: …… → studentClass (BCTT specific)
    result = result.replace(
      new RegExp(`(<w:t[^>]*>)([^<]*L\u1edbp:\\s*)(${D})([^<]*)(<\/w:t>)`, 'gi'),
      '$1$2{{studentClass}}$4$5',
    );

    // NGÀNH: ……………… → major (BCTT specific)
    result = result.replace(
      new RegExp(`(<w:t[^>]*>)([^<]*(?:NG\u00c0NH|Ng\u00e0nh):\\s*)(${D})([^<]*)(<\/w:t>)`, 'gi'),
      '$1$2{{major}}$4$5',
    );

    // Topic title: "Tên KLTN: …" / "Tên đề tài: …" / "Tên BCTT: …"
    result = result.replace(
      new RegExp(`(<w:t[^>]*>)([^<]*(?:T\u00ean KLTN|T\u00ean \u0111\u1ec1 t\u00e0i|T\u00ean KL|T\u00ean BCTT):\\s*)(${D})([^<]*)(<\/w:t>)`, 'gi'),
      '$1$2{{topicTitle}}$4$5',
    );

    return result;
  }

  // ─── XML Utility Helpers ──────────────────────────────────────────────────

  private extractCellTexts(rowXml: string): string[] {
    const cellPattern = /<w:tc[ >][\s\S]*?<\/w:tc>/g;
    const texts: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = cellPattern.exec(rowXml)) !== null) {
      const cellText = match[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      texts.push(cellText);
    }

    return texts;
  }

  /**
   * Inject a placeholder into the last <w:t> element of the last <w:tc> in a row,
   * but only if that cell currently appears empty (no meaningful text).
   */
  private injectIntoLastEmptyCell(rowXml: string, placeholder: string): string {
    const cellMatches = [...rowXml.matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)];
    if (cellMatches.length === 0) return rowXml;

    const lastCellMatch = cellMatches[cellMatches.length - 1];
    const lastCell = lastCellMatch[0];
    const lastCellText = lastCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Only inject if the cell is empty or contains only whitespace/dots
    if (lastCellText && !/^[.\s]*$/.test(lastCellText)) {
      return rowXml;
    }

    // Find the <w:t> element in the last cell and inject placeholder
    const injected = lastCell.replace(
      /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/,
      (_, open, content, close) => {
        return `${open}${content.trim() ? content : ''}${placeholder}${close}`;
      },
    );

    // If no <w:t> found (cell has no text run), add one
    const result =
      injected === lastCell
        ? lastCell.replace(
            /<\/w:tc>/,
            `<w:p><w:r><w:t>${placeholder}</w:t></w:r></w:p></w:tc>`,
          )
        : injected;

    return (
      rowXml.slice(0, lastCellMatch.index) +
      result +
      rowXml.slice(lastCellMatch.index + lastCellMatch[0].length)
    );
  }

  private normalizeVietnamese(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd');
  }

  private hasPlaceholder(xmlContent: string): boolean {
    if (!xmlContent) {
      return false;
    }

    const markerPatterns = [
      /\{\{[^{}]+\}\}/,
      /\$\{[^{}]+\}/,
      /<<[^<>]+>>/,
      /\[\[[^\[\]]+\]\]/,
      /\{%[^%]+%\}/,
    ];

    return markerPatterns.some((pattern) => pattern.test(xmlContent));
  }

  private renderLegacyTemplateIfPossible(
    zip: typeof PizZip.prototype,
    rubricType: RubricType,
    documentXml: string,
    payload: Record<string, unknown>,
  ): Buffer | null {
    const updatedXml = this.applyLegacyDottedMarkers(
      rubricType,
      documentXml,
      payload,
    );
    if (!updatedXml) {
      return null;
    }

    zip.file('word/document.xml', updatedXml);
    const rendered = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    }) as Buffer;

    return Buffer.from(rendered);
  }

  private applyLegacyDottedMarkers(
    rubricType: RubricType,
    documentXml: string,
    payload: Record<string, unknown>,
  ): string | null {
    // Match both ASCII dots (....) and Unicode ellipsis (… U+2026)
    if (!/[.\u2026]{2,}/.test(documentXml)) {
      return null;
    }

    let updatedXml = documentXml;
    let replacedCount = 0;
    const fieldSpecs = this.buildLegacyDottedFieldSpecs(rubricType, payload);

    for (const fieldSpec of fieldSpecs) {
      if (!fieldSpec.value) {
        continue;
      }

      const replacementResult = this.replaceDottedFieldBlock(
        updatedXml,
        fieldSpec,
      );
      if (replacementResult.replaced) {
        replacedCount += 1;
        updatedXml = replacementResult.xml;
      }
    }

    return replacedCount > 0 ? updatedXml : null;
  }

  private buildLegacyDottedFieldSpecs(
    rubricType: RubricType,
    payload: Record<string, unknown>,
  ): Array<{ startLabelPattern: RegExp; endLabelPattern?: RegExp; maxSpanChars?: number; value: string }> {
    const studentName = this.pickStringValue(payload, ['studentName']);
    const studentId = this.pickStringValue(payload, ['studentId']);
    const topicTitle = this.pickStringValue(payload, ['topicTitle']);
    const conclusion = this.pickStringValue(payload, ['conclusion', 'comments']);
    const questionsText = this.pickQuestionsText(payload);

    const commonSpecs = [
      {
        startLabelPattern: /(Sinh viên thực hiện|Sinh vien thuc hien)/iu,
        endLabelPattern: /MSSV/iu,
        maxSpanChars: 1200,
        value: studentName,
      },
      {
        startLabelPattern: /MSSV/iu,
        endLabelPattern: /(Tên KLTN|Ten KLTN|Tên đề tài|Ten de tai|Tiêu chí|Tieu chi)/iu,
        maxSpanChars: 1200,
        value: studentId,
      },
    ];

    if (rubricType === 'KLTN_GVHD') {
      return [
        ...commonSpecs,
        {
          startLabelPattern: /(Tên KLTN|Ten KLTN|Tên đề tài|Ten de tai)/iu,
          endLabelPattern: /(Tiêu chí|Tieu chi|Ngày|Ngay)/iu,
          maxSpanChars: 2400,
          value: topicTitle,
        },
      ];
    }

    if (rubricType === 'KLTN_GVPB') {
      return [
        ...commonSpecs,
        {
          startLabelPattern: /(Tên KLTN|Ten KLTN|Tên đề tài|Ten de tai)/iu,
          endLabelPattern: /(Tiêu chí|Tieu chi|Yêu cầu SV chỉnh sửa|Yeu cau SV chinh sua|Ngày|Ngay)/iu,
          maxSpanChars: 2600,
          value: topicTitle,
        },
        {
          startLabelPattern: /(Yêu cầu SV chỉnh sửa|Yeu cau SV chinh sua)/iu,
          endLabelPattern: /(Câu hỏi|Cau hoi|Ngày|Ngay)/iu,
          maxSpanChars: 3600,
          value: conclusion,
        },
        {
          startLabelPattern: /(Câu hỏi|Cau hoi)/iu,
          endLabelPattern: /(Ngày|Ngay|Giảng viên|Giang vien|Người chấm|Nguoi cham)/iu,
          maxSpanChars: 3600,
          value: questionsText,
        },
      ];
    }

    if (rubricType === 'KLTN_COUNCIL') {
      return commonSpecs;
    }


    if (rubricType === 'BCTT') {
      return [
        {
          // BCTT template uses "SVTH:" label, not "Sinh viên thực hiện:"
          startLabelPattern: /SVTH/iu,
          endLabelPattern: /MSSV/iu,
          maxSpanChars: 1200,
          value: studentName,
        },
        {
          startLabelPattern: /MSSV/iu,
          endLabelPattern: /(Lớp|NGÀNH|Nganh)/iu,
          maxSpanChars: 1000,
          value: studentId,
        },
        {
          startLabelPattern: /(Tên đề tài|BCTT)/iu,
          endLabelPattern: /(Tiêu chí|STT|Ngày)/iu,
          maxSpanChars: 2400,
          value: topicTitle,
        },
      ];
    }
    return [];
  }

  private replaceDottedFieldBlock(
    documentXml: string,
    fieldSpec: { startLabelPattern: RegExp; endLabelPattern?: RegExp; maxSpanChars?: number; value: string },
  ): { xml: string; replaced: boolean } {
    const startMatch = fieldSpec.startLabelPattern.exec(documentXml);
    if (!startMatch || startMatch.index === undefined) {
      return { xml: documentXml, replaced: false };
    }

    const startIndex = startMatch.index;
    const afterStartIndex = startIndex + startMatch[0].length;
    const maxSpanChars = fieldSpec.maxSpanChars ?? 1400;
    const boundedSearchEnd = Math.min(
      documentXml.length,
      afterStartIndex + maxSpanChars,
    );
    const boundedTail = documentXml.slice(afterStartIndex, boundedSearchEnd);

    let segmentEndRelative = boundedTail.length;
    if (fieldSpec.endLabelPattern) {
      const endMatch = fieldSpec.endLabelPattern.exec(boundedTail);
      if (endMatch && endMatch.index !== undefined) {
        segmentEndRelative = endMatch.index;
      }
    }

    const segmentEndIndex = afterStartIndex + segmentEndRelative;
    const segment = documentXml.slice(startIndex, segmentEndIndex);
    if (!/[.\u2026]{2,}/.test(segment)) {
      return { xml: documentXml, replaced: false };
    }

    const escapedValue = this.escapeXmlText(fieldSpec.value);
    let inserted = false;
    const replacedSegment = segment.replace(/[.\u2026]{2,}/g, () => {
      if (!inserted) {
        inserted = true;
        return escapedValue;
      }
      return '';
    });

    if (!inserted) {
      return { xml: documentXml, replaced: false };
    }

    return {
      xml:
        documentXml.slice(0, startIndex) +
        replacedSegment +
        documentXml.slice(segmentEndIndex),
      replaced: true,
    };
  }

  private pickStringValue(
    payload: Record<string, unknown>,
    keys: string[],
  ): string {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }

    return '';
  }

  private pickQuestionsText(payload: Record<string, unknown>): string {
    const directText = this.pickStringValue(payload, ['questionsText']);
    if (directText) {
      return directText;
    }

    const questions = payload.questions;
    if (Array.isArray(questions)) {
      const normalized = questions
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (normalized.length > 0) {
        return normalized.join(' | ');
      }
    }

    return '';
  }

  private escapeXmlText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Build the full payload object that docxtemplater will use to fill placeholders.
   *
   * Exported keys (in addition to all raw payload fields):
   *  - score_xxx       → named score keys (legacy SCORE_INJECTION_MAP compat)
   *  - diem1..diemN   → POSITIONAL score aliases in declaration order
   *                      (matches {{diem1}}, {{diem2}}… used inside Word templates)
   *  - totalScoreFixed → formatted total (e.g. "8.50")
   *  - cho_bao_ve_mark / khong_bao_ve_mark → ☑ or ☐ chars
   *  - ngay / thang / nam → date parts
   *  - academicYear    → e.g. "2025-2026"
   *  - questionsText   → joined questions array
   */
  private buildTemplatePayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const templatePayload: Record<string, unknown> = {
      ...payload,
      generatedAt: new Date().toISOString(),
    };

    // ── Flatten scores → named (score_xxx) AND positional (diem1..N) ─────────
    const scoresValue = payload.scores;
    if (scoresValue && typeof scoresValue === 'object' && !Array.isArray(scoresValue)) {
      const scoreEntries = Object.entries(scoresValue as Record<string, unknown>);
      scoreEntries.forEach(([key, value], idx) => {
        // Named: score_thaido, score_noidung, etc. (legacy compat)
        templatePayload[`score_${key}`] =
          typeof value === 'number' ? value.toFixed(2).replace(/\.00$/, '') : String(value ?? '');
        // Positional: diem1, diem2, … (used by the actual .docx templates)
        templatePayload[`diem${idx + 1}`] =
          typeof value === 'number' ? value.toFixed(2).replace(/\.00$/, '') : String(value ?? '');
      });
    }

    // ── Questions ────────────────────────────────────────────────────────────
    const questions = payload.questions;
    if (Array.isArray(questions)) {
      templatePayload.questionsText = questions.join('\n');
    }

    // ── Total score formatted ────────────────────────────────────────────────
    const totalScore = payload.totalScore;
    if (typeof totalScore === 'number' && Number.isFinite(totalScore)) {
      templatePayload.totalScoreFixed = totalScore.toFixed(2);
    }

    // ── allowDefense checkbox marks ──────────────────────────────────────────
    const allowDefense = payload.allowDefense;
    if (typeof allowDefense === 'boolean') {
      templatePayload.allowDefenseLabel = allowDefense
        ? 'Đồng ý cho bảo vệ'
        : 'Không đồng ý cho bảo vệ';
      // Checkbox marks: ☑ = checked, ☐ = unchecked
      templatePayload.cho_bao_ve_mark = allowDefense ? '☑' : '☐';
      templatePayload.khong_bao_ve_mark = allowDefense ? '☐' : '☑';
    } else {
      templatePayload.cho_bao_ve_mark = '☐';
      templatePayload.khong_bao_ve_mark = '☐';
    }

    // ── Date parts from evaluationDate ───────────────────────────────────────
    const evaluationDate = payload.evaluationDate;
    let dateObj: Date | null = null;

    if (typeof evaluationDate === 'string' && evaluationDate) {
      dateObj = new Date(evaluationDate);
      if (isNaN(dateObj.getTime())) dateObj = null;
    }
    if (!dateObj) dateObj = new Date();

    templatePayload.ngay = String(dateObj.getDate());
    templatePayload.thang = String(dateObj.getMonth() + 1);
    templatePayload.nam = String(dateObj.getFullYear());
    templatePayload.ngayCham = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

    // Academic year derived: e.g. evaluationDate in 2025 → "2025-2026"
    // (semester starting Sept onwards = current year, else current-1)
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1; // 1-based
    const academicStartYear = month >= 9 ? year : year - 1;
    templatePayload.academicYear = `${academicStartYear}-${academicStartYear + 1}`;

    // ── Reviewer / advisor fallback aliases ──────────────────────────────────
    // Some templates use {{reviewerName}}, others {{advisorName}}, some both.
    if (!templatePayload.reviewerName && templatePayload.advisorName) {
      templatePayload.reviewerName = templatePayload.advisorName;
    }
    if (!templatePayload.advisorName && templatePayload.reviewerName) {
      templatePayload.advisorName = templatePayload.reviewerName;
    }

    return templatePayload;
  }
}
