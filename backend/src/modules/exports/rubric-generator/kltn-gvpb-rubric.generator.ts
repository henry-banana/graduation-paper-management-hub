import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer,
  ShadingType,
  TableLayoutType,
  VerticalAlign,
} from 'docx';

export interface KltnGvpbRubricData {
  studentName: string;
  studentId: string;
  studentClass: string;
  advisorName: string;
  reviewerName: string;
  major: string;
  course: string;
  topicTitle: string;
  period: string;
  scores: {
    xacdinhvande: number;   // (1đ)
    noidung: number;        // (3đ)
    ketqua: number;         // (3đ)
    hinhthuc: number;       // (1đ)
    traloi: number;         // Trả lời câu hỏi (2đ)
  };
  totalScore: number;
  allowDefense: boolean;
  questions: string[];        // min 2 câu hỏi (optional per Q&A)
  conclusion: string;
  comments?: string;
  evaluationDate?: string;
}

const FULL_TABLE_WIDTH_DXA = 9000;
const HALF_TABLE_WIDTH_DXA = 4500;
const INFO_COL_WIDTHS = [1500, 3000, 1500, 3000] as const;
const SCORE_COL_WIDTHS = [700, 5300, 1500, 1500] as const;

function thinBorder() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  };
}

function noBorder() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };
}

function hCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 22 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { type: ShadingType.CLEAR, fill: 'FCE4D6' },
    borders: thinBorder(),
    verticalAlign: VerticalAlign.CENTER,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
  });
}

function dCell(text: string, bold = false, width?: number): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 22 })], alignment: AlignmentType.CENTER })],
    borders: thinBorder(),
    verticalAlign: VerticalAlign.CENTER,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
  });
}

function lCell(text: string, bold = false, width?: number): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 22 })] })],
    borders: thinBorder(),
    verticalAlign: VerticalAlign.CENTER,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
  });
}

export async function generateKltnGvpbRubricDocx(data: KltnGvpbRubricData): Promise<Buffer> {
  const questionRows = data.questions.length > 0
    ? data.questions.map((q, i) =>
        new TableRow({
          children: [
            dCell(String(i + 1), false, SCORE_COL_WIDTHS[0]),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: q, size: 22 })] })],
              columnSpan: 3,
              width: {
                size: SCORE_COL_WIDTHS[1] + SCORE_COL_WIDTHS[2] + SCORE_COL_WIDTHS[3],
                type: WidthType.DXA,
              },
              borders: thinBorder(),
            }),
          ],
        }),
      )
    : [
        new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: '(Không có câu hỏi được ghi nhận)', italics: true, size: 20 })],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  columnSpan: 4,
                  width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
                  borders: thinBorder(),
                }),
              ],
        }),
      ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM', bold: true, size: 24, color: '0070C0' })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: 'PHIẾU CHẤM ĐIỂM KHÓA LUẬN TỐT NGHIỆP — GIÁO VIÊN PHẢN BIỆN', bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),

          // Info table
          new Table({
            width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [...INFO_COL_WIDTHS],
            rows: [
              new TableRow({ children: [lCell('Họ và tên SV:', true, INFO_COL_WIDTHS[0]), lCell(data.studentName, false, INFO_COL_WIDTHS[1]), lCell('MSSV:', true, INFO_COL_WIDTHS[2]), lCell(data.studentId, false, INFO_COL_WIDTHS[3])] }),
              new TableRow({ children: [lCell('Lớp:', true, INFO_COL_WIDTHS[0]), lCell(data.studentClass, false, INFO_COL_WIDTHS[1]), lCell('Ngành:', true, INFO_COL_WIDTHS[2]), lCell(data.major, false, INFO_COL_WIDTHS[3])] }),
              new TableRow({ children: [lCell('Khóa:', true, INFO_COL_WIDTHS[0]), lCell(data.course, false, INFO_COL_WIDTHS[1]), lCell('Đợt:', true, INFO_COL_WIDTHS[2]), lCell(data.period, false, INFO_COL_WIDTHS[3])] }),
              new TableRow({
                children: [
                  lCell('Tên đề tài:', true, INFO_COL_WIDTHS[0]),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: data.topicTitle, size: 22 })] })],
                    columnSpan: 3,
                    width: {
                      size: INFO_COL_WIDTHS[1] + INFO_COL_WIDTHS[2] + INFO_COL_WIDTHS[3],
                      type: WidthType.DXA,
                    },
                    borders: thinBorder(),
                  }),
                ],
              }),
              new TableRow({ children: [lCell('GVHD:', true, INFO_COL_WIDTHS[0]), lCell(data.advisorName, false, INFO_COL_WIDTHS[1]), lCell('GVPB:', true, INFO_COL_WIDTHS[2]), lCell(data.reviewerName, false, INFO_COL_WIDTHS[3])] }),
              new TableRow({
                children: [
                  lCell('Ngày chấm:', true, INFO_COL_WIDTHS[0]),
                  lCell(data.evaluationDate ? new Date(data.evaluationDate).toLocaleDateString('vi-VN') : '', false, INFO_COL_WIDTHS[1]),
                  lCell('', false, INFO_COL_WIDTHS[2]),
                  lCell('', false, INFO_COL_WIDTHS[3]),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { before: 200, after: 100 } }),

          // Score table
          new Table({
            width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [...SCORE_COL_WIDTHS],
            rows: [
              new TableRow({ children: [hCell('STT', SCORE_COL_WIDTHS[0]), hCell('TIÊU CHÍ ĐÁNH GIÁ', SCORE_COL_WIDTHS[1]), hCell('ĐIỂM TỐI ĐA', SCORE_COL_WIDTHS[2]), hCell('ĐIỂM CHẤM', SCORE_COL_WIDTHS[3])] }),
              new TableRow({ children: [dCell('1', false, SCORE_COL_WIDTHS[0]), lCell('Xác định vấn đề nghiên cứu', false, SCORE_COL_WIDTHS[1]), dCell('1', false, SCORE_COL_WIDTHS[2]), dCell(String(data.scores.xacdinhvande), false, SCORE_COL_WIDTHS[3])] }),
              new TableRow({ children: [dCell('2', false, SCORE_COL_WIDTHS[0]), lCell('Nội dung nghiên cứu & phương pháp', false, SCORE_COL_WIDTHS[1]), dCell('3', false, SCORE_COL_WIDTHS[2]), dCell(String(data.scores.noidung), false, SCORE_COL_WIDTHS[3])] }),
              new TableRow({ children: [dCell('3', false, SCORE_COL_WIDTHS[0]), lCell('Kết quả đạt được & khả năng ứng dụng', false, SCORE_COL_WIDTHS[1]), dCell('3', false, SCORE_COL_WIDTHS[2]), dCell(String(data.scores.ketqua), false, SCORE_COL_WIDTHS[3])] }),
              new TableRow({ children: [dCell('4', false, SCORE_COL_WIDTHS[0]), lCell('Hình thức luận văn', false, SCORE_COL_WIDTHS[1]), dCell('1', false, SCORE_COL_WIDTHS[2]), dCell(String(data.scores.hinhthuc), false, SCORE_COL_WIDTHS[3])] }),
              new TableRow({ children: [dCell('5', false, SCORE_COL_WIDTHS[0]), lCell('Trả lời câu hỏi phản biện', false, SCORE_COL_WIDTHS[1]), dCell('2', false, SCORE_COL_WIDTHS[2]), dCell(String(data.scores.traloi), false, SCORE_COL_WIDTHS[3])] }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'TỔNG ĐIỂM', bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                    columnSpan: 2,
                    width: {
                      size: SCORE_COL_WIDTHS[0] + SCORE_COL_WIDTHS[1],
                      type: WidthType.DXA,
                    },
                    borders: thinBorder(),
                    shading: { type: ShadingType.CLEAR, fill: 'FFF2CC' },
                  }),
                  dCell('10', false, SCORE_COL_WIDTHS[2]),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: data.totalScore.toFixed(2), bold: true, size: 24, color: data.totalScore >= 5 ? '00B050' : 'FF0000' })], alignment: AlignmentType.CENTER })],
                    width: { size: SCORE_COL_WIDTHS[3], type: WidthType.DXA },
                    borders: thinBorder(),
                    shading: { type: ShadingType.CLEAR, fill: 'FFF2CC' },
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `KẾT LUẬN: ${data.allowDefense ? '✔ ĐỒNG Ý CHO BẢO VỆ' : '✘ KHÔNG CHO BẢO VỆ'}`, bold: true, size: 24, color: data.allowDefense ? '00B050' : 'FF0000' })], alignment: AlignmentType.CENTER })],
                    columnSpan: 4,
                    width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
                    borders: thinBorder(),
                    shading: { type: ShadingType.CLEAR, fill: data.allowDefense ? 'E2EFDA' : 'FFE0E0' },
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { before: 200 } }),

          // Questions
          new Table({
            width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [...SCORE_COL_WIDTHS],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'CÂU HỎI PHẢN BIỆN:', bold: true, size: 22 })] })],
                    columnSpan: 4,
                    width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
                    borders: thinBorder(),
                    shading: { type: ShadingType.CLEAR, fill: 'FCE4D6' },
                  }),
                ],
              }),
              ...questionRows,
            ],
          }),

          new Paragraph({ text: '', spacing: { before: 200 } }),

          // Conclusion
          new Table({
            width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [FULL_TABLE_WIDTH_DXA],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'NHẬN XÉT / YÊU CẦU CHỈNH SỬA:', bold: true, size: 22 })] }),
                      new Paragraph({ children: [new TextRun({ text: data.conclusion || data.comments || '', size: 22 })] }),
                      new Paragraph({ text: '' }),
                      new Paragraph({ text: '' }),
                    ],
                    width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
                    borders: thinBorder(),
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { before: 400 } }),

          // Signature
          new Table({
            width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [HALF_TABLE_WIDTH_DXA, HALF_TABLE_WIDTH_DXA],
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '' })], borders: noBorder(), width: { size: HALF_TABLE_WIDTH_DXA, type: WidthType.DXA } }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: `TP. Hồ Chí Minh, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`, italics: true, size: 20 })], alignment: AlignmentType.CENTER }),
                      new Paragraph({ children: [new TextRun({ text: 'GIÁO VIÊN PHẢN BIỆN', bold: true, size: 22 })], alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
                      new Paragraph({ children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 20 })], alignment: AlignmentType.CENTER }),
                      new Paragraph({ text: '', spacing: { before: 600 } }),
                      new Paragraph({ children: [new TextRun({ text: data.reviewerName, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
                    ],
                    borders: noBorder(),
                    width: { size: HALF_TABLE_WIDTH_DXA, type: WidthType.DXA },
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
