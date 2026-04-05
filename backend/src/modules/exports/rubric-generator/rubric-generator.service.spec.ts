import { beforeEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import Docxtemplater = require('docxtemplater');
import PizZip = require('pizzip');
import { generateKltnCouncilRubricDocx } from './kltn-council-rubric.generator';
import { RubricGeneratorService } from './rubric-generator.service';

describe('RubricGeneratorService (legacy template fill)', () => {
  let service: RubricGeneratorService;

  beforeEach(() => {
    service = new RubricGeneratorService();
  });

  it('fills dotted legacy fields for KLTN_GVPB template labels', () => {
    const xml = [
      '<w:p>',
      '<w:r><w:t>Sinh viên thực hiện: ..................................................</w:t></w:r>',
      '<w:r><w:t>MSSV: .............................................</w:t></w:r>',
      '<w:r><w:t>Tên KLTN</w:t></w:r>',
      '<w:r><w:t>: </w:t></w:r>',
      '<w:r><w:t>....................................................................</w:t></w:r>',
      '<w:r><w:t>Yêu cầu SV chỉnh sửa: ...............................................</w:t></w:r>',
      '<w:r><w:t>Câu hỏi: ...........................................................</w:t></w:r>',
      '<w:r><w:t>Ngày</w:t></w:r>',
      '</w:p>',
    ].join('');

    const output = (service as any).applyLegacyDottedMarkers('KLTN_GVPB', xml, {
      studentName: 'Nguyen Van A',
      studentId: '20110001',
      topicTitle: 'De tai AI',
      conclusion: 'Can bo sung benchmark voi bo du lieu lon hon',
      questions: ['Dong gop moi la gi?', 'Huong mo rong tiep theo?'],
    }) as string | null;

    expect(output).not.toBeNull();
    expect(output).toContain('Sinh viên thực hiện: Nguyen Van A');
    expect(output).toContain('MSSV: 20110001');
    expect(output).toContain('De tai AI');
    expect(output).toContain(
      'Yêu cầu SV chỉnh sửa: Can bo sung benchmark voi bo du lieu lon hon',
    );
    expect(output).toContain(
      'Câu hỏi: Dong gop moi la gi? | Huong mo rong tiep theo?',
    );
  });

  it('fills both student name and MSSV when council template stores both in one run', () => {
    const xml =
      '<w:p><w:r><w:t xml:space="preserve">Sinh viên thực hiện: ..................................................................MSSV:  ......................................................</w:t></w:r></w:p>';

    const output = (service as any).applyLegacyDottedMarkers('KLTN_COUNCIL', xml, {
      studentName: 'Pham Thi B',
      studentId: '20119999',
    }) as string | null;

    expect(output).not.toBeNull();
    expect(output).toContain('Sinh viên thực hiện: Pham Thi B');
    expect(output).toContain('MSSV:  20119999');
  });

  it('returns null when no legacy dotted fields are replaced', () => {
    const xml = '<w:p><w:r><w:t>Template without any fillable field</w:t></w:r></w:p>';

    const output = (service as any).applyLegacyDottedMarkers('BCTT', xml, {
      studentName: 'A',
      studentId: 'B',
    }) as string | null;

    expect(output).toBeNull();
  });

  it('injects score placeholder for BCTT rows that use range-scale cells', () => {
    const xml = [
      '<w:tr>',
      '  <w:tc><w:p><w:r><w:t>Thái độ</w:t></w:r></w:p></w:tc>',
      '  <w:tc><w:p><w:r><w:t>0 - 0,4</w:t></w:r></w:p></w:tc>',
      '  <w:tc><w:p><w:r><w:t>0,5 - 1,0</w:t></w:r></w:p></w:tc>',
      '  <w:tc><w:p><w:r><w:t>1,1 - 1,6</w:t></w:r></w:p></w:tc>',
      '  <w:tc><w:p><w:r><w:t>1,7 - 2,0</w:t></w:r></w:p></w:tc>',
      '  <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>',
      '</w:tr>',
    ].join('');

    const output = (service as any).injectPlaceholders(xml, 'BCTT') as string;

    expect(output).toContain('{{score_thaido}}');
  });

  it('injects SVTH/MSSV placeholders with spacing when both labels share one text run', () => {
    const xml =
      '<w:p><w:r><w:t xml:space="preserve">SVTH: …………………………………MSSV: ……………Lớp: …………………</w:t></w:r></w:p>';

    const output = (service as any).injectHeaderFields(xml) as string;

    expect(output).toMatch(
      /SVTH:\s*\{\{studentName\}\}\s+MSSV:\s*\{\{studentId\}\}\s+Lớp:\s*\{\{studentClass\}\}/,
    );
  });

  it('injects topicTitle placeholder when label uses spaced colon format', () => {
    const xml =
      '<w:p><w:r><w:t xml:space="preserve">Tên KLTN : .............................................</w:t></w:r></w:p>';

    const output = (service as any).injectHeaderFields(xml) as string;

    expect(output).toContain('{{topicTitle}}');
  });

  it('includes normalized topic title in generated export filename', async () => {
    const renderSpy = jest
      .spyOn(service as any, 'renderTemplateIfPossible')
      .mockReturnValue(null);

    const output = await (service as any).generateByType(
      'BCTT',
      '2112345',
      { topicTitle: 'Đề tài AI thử nghiệm' },
      async () => Buffer.from('ok'),
      'rubric_bctt',
    );

    expect(output.filename).toMatch(
      /^rubric_bctt_2112345_de-tai-ai-thu-nghiem_\d+\.docx$/,
    );

    renderSpy.mockRestore();
  });

  it('returns null and skips Path C when injected docxtemplater render fails on non-placeholder template', () => {
    const zip = new PizZip();
    zip.file(
      'word/document.xml',
      '<w:document><w:body><w:p><w:r><w:t>No placeholders here</w:t></w:r></w:p></w:body></w:document>',
    );
    const templateBinary = zip.generate({ type: 'string' }) as string;

    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(templateBinary);
    const injectSpy = jest
      .spyOn(service as any, 'injectPlaceholders')
      .mockReturnValue(
        '<w:document><w:body><w:p><w:r><w:t>{{studentName}}</w:t></w:r></w:p></w:body></w:document>',
      );
    const legacySpy = jest
      .spyOn(service as any, 'renderLegacyTemplateIfPossible')
      .mockReturnValue(Buffer.from('legacy'));
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    const renderSpy = jest
      .spyOn((Docxtemplater as unknown as { prototype: { render: (payload: Record<string, unknown>) => void } }).prototype, 'render')
      .mockImplementation(() => {
        throw new Error('duplicate_open_tag');
      });

    const output = (service as any).renderTemplateIfPossible('BCTT', {
      studentName: 'Nguyen Van A',
      studentId: '20110001',
      topicTitle: 'De tai',
    }) as Buffer | null;

    expect(output).toBeNull();
    expect(legacySpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping Path C for safety and falling back to deterministic generator.'),
    );

    renderSpy.mockRestore();
    warnSpy.mockRestore();
    legacySpy.mockRestore();
    injectSpy.mockRestore();
    readSpy.mockRestore();
    existsSpy.mockRestore();
  });

  it('defaults to deterministic fallback generator when template mode is not explicitly enabled', async () => {
    const renderSpy = jest
      .spyOn(service as any, 'renderTemplateIfPossible')
      .mockReturnValue(Buffer.from('template'));
    const fallbackGenerator = jest.fn(async () => Buffer.from('fallback'));

    const output = await (service as any).generateByType(
      'KLTN_COUNCIL',
      '20110001',
      { topicTitle: 'De tai test' },
      fallbackGenerator,
      'rubric_kltn_hd',
    );

    expect(renderSpy).not.toHaveBeenCalled();
    expect(fallbackGenerator).toHaveBeenCalledTimes(1);
    expect(output.buffer.equals(Buffer.from('fallback'))).toBe(true);

    renderSpy.mockRestore();
  });

  it('generates fixed-layout grid widths for council rubric to avoid collapsed columns', async () => {
    const buffer = await generateKltnCouncilRubricDocx({
      studentName: 'Nguyen Van A',
      studentId: 'SV21001',
      studentClass: '21DTHA1',
      advisorName: 'GV A',
      major: 'CNTT',
      course: 'K2021',
      topicTitle: 'KLTN Test',
      period: '2026.1',
      memberName: 'TV HD',
      memberRole: 'TV_HD',
      scores: {
        noidung: 3.5,
        trinh_bay: 1.8,
        traloi: 2.4,
        hinhthuc: 0.9,
      },
      totalScore: 8.6,
      comments: 'Dat',
      evaluationDate: '2026-04-05',
    });

    const xml = new PizZip(buffer).file('word/document.xml')?.asText() ?? '';

    expect(xml).toContain('<w:tblLayout w:type="fixed"/>');
    expect(xml).toContain('<w:gridCol w:w="700"/>');
    expect(xml).toContain('<w:gridCol w:w="5300"/>');
  });
});
