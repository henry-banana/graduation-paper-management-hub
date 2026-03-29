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

// Use CommonJS require for compatibility with strict TS projects.
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

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

interface LegacyDottedFieldSpec {
  startLabelPattern: RegExp;
  endLabelPattern?: RegExp;
  maxSpanChars?: number;
  value: string;
}

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
      const templatePayload = this.buildTemplatePayload(payload);

      if (this.hasPlaceholder(documentXml)) {
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });

        doc.render(templatePayload);
        const rendered = doc
          .getZip()
          .generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;

        return Buffer.from(rendered);
      }

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
    if (!/\.{5,}/.test(documentXml)) {
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
  ): LegacyDottedFieldSpec[] {
    const studentName = this.pickStringValue(payload, ['studentName']);
    const studentId = this.pickStringValue(payload, ['studentId']);
    const topicTitle = this.pickStringValue(payload, ['topicTitle']);
    const conclusion = this.pickStringValue(payload, ['conclusion', 'comments']);
    const questionsText = this.pickQuestionsText(payload);

    const commonSpecs: LegacyDottedFieldSpec[] = [
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

    return [];
  }

  private replaceDottedFieldBlock(
    documentXml: string,
    fieldSpec: LegacyDottedFieldSpec,
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
    if (!/\.{5,}/.test(segment)) {
      return { xml: documentXml, replaced: false };
    }

    const escapedValue = this.escapeXmlText(fieldSpec.value);
    let inserted = false;
    const replacedSegment = segment.replace(/\.{5,}/g, () => {
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

  private buildTemplatePayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const templatePayload: Record<string, unknown> = {
      ...payload,
      generatedAt: new Date().toISOString(),
    };

    const scoresValue = payload.scores;
    if (scoresValue && typeof scoresValue === 'object' && !Array.isArray(scoresValue)) {
      const scoreEntries = Object.entries(scoresValue as Record<string, unknown>);
      for (const [key, value] of scoreEntries) {
        templatePayload[`score_${key}`] = value;
      }
    }

    const questions = payload.questions;
    if (Array.isArray(questions)) {
      templatePayload.questionsText = questions.join('\n');
    }

    const totalScore = payload.totalScore;
    if (typeof totalScore === 'number' && Number.isFinite(totalScore)) {
      templatePayload.totalScoreFixed = totalScore.toFixed(2);
    }

    const allowDefense = payload.allowDefense;
    if (typeof allowDefense === 'boolean') {
      templatePayload.allowDefenseLabel = allowDefense
        ? 'Dong y cho bao ve'
        : 'Khong dong y cho bao ve';
    }

    return templatePayload;
  }
}
