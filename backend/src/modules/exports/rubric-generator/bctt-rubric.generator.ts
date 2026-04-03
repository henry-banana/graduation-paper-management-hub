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

function dataCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 22 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    borders: thinBorder(),
    verticalAlign: VerticalAlign.CENTER,
  });
}

function leftCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 22 })],
        alignment: AlignmentType.LEFT,
      }),
    ],
    borders: thinBorder(),
    verticalAlign: VerticalAlign.CENTER,
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
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('THÔNG TIN SINH VIÊN', 4000),
                  headerCell('', 4000),
                  headerCell('THÔNG TIN ĐỀ TÀI', 4000),
                  headerCell('', 4000),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('Họ và tên SV:', true),
                  leftCell(data.studentName),
                  leftCell('Tên đề tài:', true),
                  leftCell(data.topicTitle),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('MSSV:', true),
                  leftCell(data.studentId),
                  leftCell('GVHD:', true),
                  leftCell(data.advisorName),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('Lớp:', true),
                  leftCell(data.studentClass),
                  leftCell('Ngành:', true),
                  leftCell(data.major),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('Công ty:', true),
                  leftCell(data.company),
                  leftCell('Khóa:', true),
                  leftCell(data.course),
                ],
              }),
              new TableRow({
                children: [
                  leftCell('Đợt đánh giá:', true),
                  leftCell(data.period),
                  leftCell('Ngày chấm:', true),
                  leftCell(
                    data.evaluationDate
                      ? new Date(data.evaluationDate).toLocaleDateString(
                          'vi-VN',
                        )
                      : '',
                  ),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { before: 200, after: 100 } }),

          // Score table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Header
              new TableRow({
                children: [
                  headerCell('STT', 600),
                  headerCell('TIÊU CHÍ ĐÁNH GIÁ', 5000),
                  headerCell('ĐIỂM TỐI ĐA', 1500),
                  headerCell('ĐIỂM CHẤM', 1500),
                ],
              }),
              // Criteria rows
              new TableRow({
                children: [
                  dataCell('1'),
                  leftCell('Thái độ, tinh thần (chuyên cần, trách nhiệm)'),
                  dataCell('2'),
                  dataCell(String(data.scores.thaido)),
                ],
              }),
              new TableRow({
                children: [
                  dataCell('2'),
                  leftCell('Hình thức báo cáo (trình bày, logic)'),
                  dataCell('1'),
                  dataCell(String(data.scores.hinhthuc)),
                ],
              }),
              new TableRow({
                children: [
                  dataCell('3'),
                  leftCell(
                    'Mở đầu / Giới thiệu công ty, vị trí thực tập, mục tiêu',
                  ),
                  dataCell('1'),
                  dataCell(String(data.scores.modau)),
                ],
              }),
              new TableRow({
                children: [
                  dataCell('4'),
                  leftCell(
                    'Nội dung chính (công việc thực hiện, kiến thức áp dụng, thành quả)',
                  ),
                  dataCell('5'),
                  dataCell(String(data.scores.noidung)),
                ],
              }),
              new TableRow({
                children: [
                  dataCell('5'),
                  leftCell(
                    'Kết luận / Đề nghị (đánh giá bản thân, bài học, đề xuất)',
                  ),
                  dataCell('1'),
                  dataCell(String(data.scores.ketluan)),
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
                    borders: thinBorder(),
                    shading: { type: ShadingType.CLEAR, fill: 'FFF2CC' },
                  }),
                  dataCell('10'),
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
            width: { size: 100, type: WidthType.PERCENTAGE },
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
                    borders: thinBorder(),
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { before: 400 } }),

          // Signature
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
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
                    width: { size: 5000, type: WidthType.DXA },
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
                    width: { size: 5000, type: WidthType.DXA },
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
