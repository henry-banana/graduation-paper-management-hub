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
  HeadingLevel,
  Packer,
  ShadingType,
  TableLayoutType,
  VerticalAlign,
} from 'docx';

export interface BcttRubricData {
  // Header info
  studentName: string;
  studentId: string;
  studentClass: string;
  advisorName: string;
  major: string;
  course: string;
  company: string;
  topicTitle: string;
  period: string;
  // Scores (0-10 per criterion)
  scores: {
    thaido: number; // Thái độ, tinh thần (2đ)
    hinhthuc: number; // Hình thức báo cáo (1đ)
    modau: number; // Mở đầu / Giới thiệu (1đ)
    noidung: number; // Nội dung chính (5đ)
    ketluan: number; // Kết luận / Đề nghị (1đ)
  };
  totalScore: number;
  comments?: string;
  evaluationDate?: string;
}

const FULL_TABLE_WIDTH_DXA = 9000;
const HALF_TABLE_WIDTH_DXA = 4500;
const INFO_COL_WIDTHS = [1500, 3000, 1500, 3000] as const;
const SCORE_COL_WIDTHS = [700, 5300, 1500, 1500] as const;

function noBorder() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };
}

function thinBorder() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  };
}

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 22 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { type: ShadingType.CLEAR, fill: 'D9E1F2' },
    borders: thinBorder(),
    verticalAlign: VerticalAlign.CENTER,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
  });
}

function dataCell(text: string, bold = false, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 22 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    borders: thinBorder(),
    verticalAlign: VerticalAlign.CENTER,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
  });
}

function leftCell(text: string, bold = false, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 22 })],
        alignment: AlignmentType.LEFT,
      }),
    ],
    borders: thinBorder(),
    verticalAlign: VerticalAlign.CENTER,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
  });
}

export async function generateBcttRubricDocx(
  data: BcttRubricData,
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM',
                bold: true,
                size: 24,
                color: '0070C0',
              }),
            ],
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'PHIẾU CHẤM ĐIỂM BÁO CÁO THỰC TẬP (BCTT)',
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),

          // Student info table
          new Table({
            width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [...INFO_COL_WIDTHS],
            rows: [
              new TableRow({
                children: [
                  headerCell('THÔNG TIN SINH VIÊN', INFO_COL_WIDTHS[0]),
                  headerCell('', INFO_COL_WIDTHS[1]),
                  headerCell('THÔNG TIN ĐỀ TÀI', INFO_COL_WIDTHS[2]),
                  headerCell('', INFO_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('Họ và tên SV:', true, INFO_COL_WIDTHS[0]),
                  leftCell(data.studentName, false, INFO_COL_WIDTHS[1]),
                  leftCell('Tên đề tài:', true, INFO_COL_WIDTHS[2]),
                  leftCell(data.topicTitle, false, INFO_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('MSSV:', true, INFO_COL_WIDTHS[0]),
                  leftCell(data.studentId, false, INFO_COL_WIDTHS[1]),
                  leftCell('GVHD:', true, INFO_COL_WIDTHS[2]),
                  leftCell(data.advisorName, false, INFO_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('Lớp:', true, INFO_COL_WIDTHS[0]),
                  leftCell(data.studentClass, false, INFO_COL_WIDTHS[1]),
                  leftCell('Ngành:', true, INFO_COL_WIDTHS[2]),
                  leftCell(data.major, false, INFO_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('Công ty:', true, INFO_COL_WIDTHS[0]),
                  leftCell(data.company, false, INFO_COL_WIDTHS[1]),
                  leftCell('Khóa:', true, INFO_COL_WIDTHS[2]),
                  leftCell(data.course, false, INFO_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('Đợt đánh giá:', true, INFO_COL_WIDTHS[0]),
                  leftCell(data.period, false, INFO_COL_WIDTHS[1]),
                  leftCell('Ngày chấm:', true, INFO_COL_WIDTHS[2]),
                  leftCell(
                    data.evaluationDate
                      ? new Date(data.evaluationDate).toLocaleDateString(
                          'vi-VN',
                        )
                      : '',
                    false,
                    INFO_COL_WIDTHS[3],
                  ),
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
              // Header
              new TableRow({
                children: [
                  headerCell('STT', SCORE_COL_WIDTHS[0]),
                  headerCell('TIÊU CHÍ ĐÁNH GIÁ', SCORE_COL_WIDTHS[1]),
                  headerCell('ĐIỂM TỐI ĐA', SCORE_COL_WIDTHS[2]),
                  headerCell('ĐIỂM CHẤM', SCORE_COL_WIDTHS[3]),
                ],
              }),
              // Criteria rows
              new TableRow({
                children: [
                  dataCell('1', false, SCORE_COL_WIDTHS[0]),
                  leftCell('Thái độ, tinh thần (chuyên cần, trách nhiệm)', false, SCORE_COL_WIDTHS[1]),
                  dataCell('2', false, SCORE_COL_WIDTHS[2]),
                  dataCell(String(data.scores.thaido), false, SCORE_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  dataCell('2', false, SCORE_COL_WIDTHS[0]),
                  leftCell('Hình thức báo cáo (trình bày, logic)', false, SCORE_COL_WIDTHS[1]),
                  dataCell('1', false, SCORE_COL_WIDTHS[2]),
                  dataCell(String(data.scores.hinhthuc), false, SCORE_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  dataCell('3', false, SCORE_COL_WIDTHS[0]),
                  leftCell(
                    'Mở đầu / Giới thiệu công ty, vị trí thực tập, mục tiêu',
                    false,
                    SCORE_COL_WIDTHS[1],
                  ),
                  dataCell('1', false, SCORE_COL_WIDTHS[2]),
                  dataCell(String(data.scores.modau), false, SCORE_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  dataCell('4', false, SCORE_COL_WIDTHS[0]),
                  leftCell(
                    'Nội dung chính (công việc thực hiện, kiến thức áp dụng, thành quả)',
                    false,
                    SCORE_COL_WIDTHS[1],
                  ),
                  dataCell('5', false, SCORE_COL_WIDTHS[2]),
                  dataCell(String(data.scores.noidung), false, SCORE_COL_WIDTHS[3]),
                ],
              }),
              new TableRow({
                children: [
                  dataCell('5', false, SCORE_COL_WIDTHS[0]),
                  leftCell(
                    'Kết luận / Đề nghị (đánh giá bản thân, bài học, đề xuất)',
                    false,
                    SCORE_COL_WIDTHS[1],
                  ),
                  dataCell('1', false, SCORE_COL_WIDTHS[2]),
                  dataCell(String(data.scores.ketluan), false, SCORE_COL_WIDTHS[3]),
                ],
              }),
              // Total row
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'TỔNG ĐIỂM', bold: true, size: 22 }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    columnSpan: 2,
                    width: {
                      size: SCORE_COL_WIDTHS[0] + SCORE_COL_WIDTHS[1],
                      type: WidthType.DXA,
                    },
                    borders: thinBorder(),
                    shading: { type: ShadingType.CLEAR, fill: 'FFF2CC' },
                  }),
                  dataCell('10', false, SCORE_COL_WIDTHS[2]),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: String(data.totalScore.toFixed(2)),
                            bold: true,
                            size: 24,
                            color: data.totalScore >= 5 ? '00B050' : 'FF0000',
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: SCORE_COL_WIDTHS[3], type: WidthType.DXA },
                    borders: thinBorder(),
                    shading: { type: ShadingType.CLEAR, fill: 'FFF2CC' },
                  }),
                ],
              }),
              // Pass/Fail
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `KẾT QUẢ: ${data.totalScore >= 5 ? '✔ ĐẠT' : '✘ KHÔNG ĐẠT'}`,
                            bold: true,
                            size: 24,
                            color: data.totalScore >= 5 ? '00B050' : 'FF0000',
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    columnSpan: 4,
                    width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
                    borders: thinBorder(),
                    shading: {
                      type: ShadingType.CLEAR,
                      fill: data.totalScore >= 5 ? 'E2EFDA' : 'FFE0E0',
                    },
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { before: 200, after: 100 } }),

          // Comments
          new Table({
            width: { size: FULL_TABLE_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [FULL_TABLE_WIDTH_DXA],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'NHẬN XÉT CỦA GVHD:', bold: true, size: 22 }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: data.comments || '', size: 22 }),
                        ],
                      }),
                      new Paragraph({ text: '' }),
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
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: '', size: 20 })],
                      }),
                    ],
                    borders: noBorder(),
                    width: { size: HALF_TABLE_WIDTH_DXA, type: WidthType.DXA },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `TP. Hồ Chí Minh, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`,
                            italics: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'GIÁO VIÊN HƯỚNG DẪN',
                            bold: true,
                            size: 22,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: '(Ký và ghi rõ họ tên)',
                            italics: true,
                            size: 20,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({ text: '', spacing: { before: 600 } }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: data.advisorName, bold: true, size: 22 }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
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
