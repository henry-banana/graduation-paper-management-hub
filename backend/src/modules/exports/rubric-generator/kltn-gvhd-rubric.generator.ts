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
  VerticalAlign,
} from 'docx';

export interface KltnGvhdRubricData {
  studentName: string;
  studentId: string;
  studentClass: string;
  advisorName: string;
  major: string;
  course: string;
  topicTitle: string;
  period: string;
  scores: {
    xacdinhvande: number;   // Xác định vấn đề (1đ)
    noidung: number;        // Nội dung & phương pháp (3đ)
    ketqua: number;         // Kết quả & ứng dụng (3đ)
    hinhthuc: number;       // Hình thức báo cáo (1đ)
    tinhthan: number;       // Thái độ / tinh thần (2đ)
  };
  totalScore: number;
  allowDefense: boolean;
  conclusion: string;
  comments?: string;
  evaluationDate?: string;
}

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

function hCell(text: string): TableCell {
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
  });
}

function dCell(text: string, bold = false): TableCell {
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

function lCell(text: string, bold = false): TableCell {
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

export async function generateKltnGvhdRubricDocx(
  data: KltnGvhdRubricData,
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP.HCM',
                bold: true,
                size: 24,
                color: '0070C0',
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'PHIẾU CHẤM ĐIỂM KHÓA LUẬN TỐT NGHIỆP — GIÁO VIÊN HƯỚNG DẪN',
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),

          // Info table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  lCell('Họ và tên SV:', true),
                  lCell(data.studentName),
                  lCell('MSSV:', true),
                  lCell(data.studentId),
                ],
              }),
              new TableRow({
                children: [
                  lCell('Lớp:', true),
                  lCell(data.studentClass),
                  lCell('Ngành:', true),
                  lCell(data.major),
                ],
              }),
              new TableRow({
                children: [
                  lCell('Khóa:', true),
                  lCell(data.course),
                  lCell('Đợt:', true),
                  lCell(data.period),
                ],
              }),
              new TableRow({
                children: [
                  lCell('Tên đề tài:', true),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: data.topicTitle, size: 22 })],
                      }),
                    ],
                    columnSpan: 3,
                    borders: thinBorder(),
                  }),
                ],
              }),
              new TableRow({
                children: [
                  lCell('GVHD:', true),
                  lCell(data.advisorName),
                  lCell('Ngày chấm:', true),
                  lCell(
                    data.evaluationDate
                      ? new Date(data.evaluationDate).toLocaleDateString('vi-VN')
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
              new TableRow({
                children: [
                  hCell('STT'),
                  hCell('TIÊU CHÍ ĐÁNH GIÁ'),
                  hCell('ĐIỂM TỐI ĐA'),
                  hCell('ĐIỂM CHẤM'),
                ],
              }),
              new TableRow({
                children: [
                  dCell('1'),
                  lCell('Xác định vấn đề nghiên cứu / đặt vấn đề'),
                  dCell('1'),
                  dCell(String(data.scores.xacdinhvande)),
                ],
              }),
              new TableRow({
                children: [
                  dCell('2'),
                  lCell('Nội dung nghiên cứu & phương pháp thực hiện'),
                  dCell('3'),
                  dCell(String(data.scores.noidung)),
                ],
              }),
              new TableRow({
                children: [
                  dCell('3'),
                  lCell('Kết quả đạt được & khả năng ứng dụng'),
                  dCell('3'),
                  dCell(String(data.scores.ketqua)),
                ],
              }),
              new TableRow({
                children: [
                  dCell('4'),
                  lCell('Hình thức luận văn (cấu trúc, ngôn ngữ, tài liệu)'),
                  dCell('1'),
                  dCell(String(data.scores.hinhthuc)),
                ],
              }),
              new TableRow({
                children: [
                  dCell('5'),
                  lCell('Thái độ / tinh thần trong quá trình nghiên cứu'),
                  dCell('2'),
                  dCell(String(data.scores.tinhthan)),
                ],
              }),
              // Total
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'TỔNG ĐIỂM', bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    columnSpan: 2,
                    borders: thinBorder(),
                    shading: { type: ShadingType.CLEAR, fill: 'FFF2CC' },
                  }),
                  dCell('10'),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: data.totalScore.toFixed(2),
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
              // Defense decision
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `KẾT LUẬN: ${data.allowDefense ? '✔ ĐỒNG Ý CHO BẢO VỆ' : '✘ CHƯA ĐỦ ĐIỀU KIỆN BẢO VỆ'}`,
                            bold: true,
                            size: 24,
                            color: data.allowDefense ? '00B050' : 'FF0000',
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    columnSpan: 4,
                    borders: thinBorder(),
                    shading: {
                      type: ShadingType.CLEAR,
                      fill: data.allowDefense ? 'E2EFDA' : 'FFE0E0',
                    },
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { before: 200 } }),

          // Conclusion notes
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'NỘI DUNG CẦN SỬA CHỮA / NHẬN XÉT:',
                            bold: true,
                            size: 22,
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: data.conclusion || data.comments || '', size: 22 }),
                        ],
                      }),
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
                    children: [new Paragraph({ text: '' })],
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
                          new TextRun({ text: 'GIÁO VIÊN HƯỚNG DẪN', bold: true, size: 22 }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 20 }),
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
