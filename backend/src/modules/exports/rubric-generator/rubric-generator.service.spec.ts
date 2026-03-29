import { beforeEach, describe, expect, it } from '@jest/globals';
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
});
