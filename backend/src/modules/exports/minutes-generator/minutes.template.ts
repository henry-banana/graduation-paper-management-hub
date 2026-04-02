/**
 * HTML Template cho Biên bản họp hội đồng bảo vệ KLTN
 * Render → Puppeteer → PDF A4
 */

export interface MinutesTemplateData {
  // Đề tài
  topicTitle: string;
  topicType: 'BCTT' | 'KLTN';
  period: string; // e.g. HK1-2024-2025

  // Sinh viên
  studentName: string;
  studentId: string;
  studentClass?: string;

  // Hội đồng
  chairName: string;       // CT_HD
  secretaryName: string;   // TK_HD
  supervisorName: string;  // GVHD
  reviewerName?: string;   // GVPB (optional)
  councilMembers?: string[]; // TV_HD extra

  // Thời gian & địa điểm
  defenseDate: string;
  defenseLocation?: string;

  // Nhận xét & điểm
  supervisorComments?: string;    // Nhận xét của GVHD
  chairComments?: string;         // Nhận xét của CT_HD
  revisionRequirements?: string;  // Yêu cầu chỉnh sửa
  finalScore?: number;
  result?: 'PASS' | 'FAIL' | 'PENDING';
  revisionDeadline?: string;      // Hạn chỉnh sửa (nếu có)
}

export function renderMinutesHtml(data: MinutesTemplateData): string {
  const {
    topicTitle,
    topicType,
    period,
    studentName,
    studentId,
    studentClass = '',
    chairName,
    secretaryName,
    supervisorName,
    reviewerName = '',
    councilMembers = [],
    defenseDate,
    defenseLocation = 'Trường ĐH Công nghệ Kỹ thuật TP.HCM',
    supervisorComments = '',
    chairComments = '',
    revisionRequirements = '',
    finalScore,
    result = 'PENDING',
    revisionDeadline = '',
  } = data;

  const typeLabel = topicType === 'KLTN' ? 'Khóa luận tốt nghiệp (KLTN)' : 'Báo cáo chuyên đề tốt nghiệp (BCTT)';
  const resultText = result === 'PASS' ? 'Đạt' : result === 'FAIL' ? 'Không đạt' : 'Chưa xác định';
  const resultColor = result === 'PASS' ? '#16a34a' : result === 'FAIL' ? '#dc2626' : '#d97706';

  const allCouncilRows = [
    { role: 'Chủ tịch HĐ (CT_HD)', name: chairName },
    { role: 'Thư ký HĐ (TK_HD)', name: secretaryName },
    { role: 'Giảng viên hướng dẫn (GVHD)', name: supervisorName },
    ...(reviewerName ? [{ role: 'Giảng viên phản biện (GVPB)', name: reviewerName }] : []),
    ...councilMembers.map((m, i) => ({ role: `Thành viên HĐ ${i + 1} (TV_HD)`, name: m })),
  ];

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Biên bản họp hội đồng bảo vệ ${typeLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 13pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 2cm 2.5cm;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .header-left {
      font-size: 11pt;
      line-height: 1.4;
    }

    .header-right {
      font-size: 11pt;
      text-align: center;
      line-height: 1.4;
    }

    .doc-title {
      text-align: center;
      margin: 20px 0 8px 0;
    }

    .doc-title h1 {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .doc-title h2 {
      font-size: 13pt;
      font-weight: normal;
      font-style: italic;
    }

    .underline-center {
      text-align: center;
      margin: 2px 0 16px 0;
    }

    .underline-center span {
      display: inline-block;
      border-bottom: 1px solid #000;
      width: 80px;
    }

    .meta-info {
      margin: 12px 0;
      font-size: 13pt;
    }

    .meta-info p { margin: 6px 0; }

    .section-title {
      font-size: 13pt;
      font-weight: bold;
      margin: 16px 0 8px 0;
      text-transform: uppercase;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 16px 0;
      font-size: 12pt;
    }

    th, td {
      border: 1px solid #000;
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
    }

    .field-block {
      margin: 12px 0;
    }

    .field-block label {
      font-weight: bold;
    }

    .field-value {
      min-height: 60px;
      border: 1px solid #999;
      border-radius: 2px;
      padding: 8px;
      margin-top: 4px;
      background: #fafafa;
      white-space: pre-wrap;
    }

    .result-box {
      display: flex;
      align-items: center;
      gap: 24px;
      margin: 16px 0;
      padding: 12px 16px;
      border: 2px solid ${resultColor};
      border-radius: 4px;
    }

    .result-label {
      font-weight: bold;
      font-size: 13pt;
    }

    .result-value {
      font-size: 15pt;
      font-weight: bold;
      color: ${resultColor};
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
    }

    .signature-block {
      text-align: center;
      width: 40%;
    }

    .signature-block .sig-label {
      font-weight: bold;
      margin-bottom: 60px;
    }

    .signature-block .sig-name {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-style: italic;
    }

    .footer {
      margin-top: 32px;
      font-size: 10pt;
      color: #666;
      text-align: center;
      border-top: 1px solid #ccc;
      padding-top: 8px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <strong>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM</strong><br/>
      <strong>KHOA CÔNG NGHỆ THÔNG TIN</strong>
    </div>
    <div class="header-right">
      <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
      Độc lập – Tự do – Hạnh phúc
    </div>
  </div>

  <div class="doc-title">
    <h1>Biên bản họp hội đồng bảo vệ</h1>
    <h2>${typeLabel}</h2>
  </div>

  <div class="underline-center"><span></span></div>

  <div class="meta-info">
    <p><strong>Đợt:</strong> ${period}</p>
    <p><strong>Thời gian:</strong> ${defenseDate}</p>
    <p><strong>Địa điểm:</strong> ${defenseLocation}</p>
  </div>

  <div class="section-title">I. Thông tin đề tài</div>
  <table>
    <tr>
      <th width="35%">Thông tin</th>
      <th>Chi tiết</th>
    </tr>
    <tr>
      <td>Tên đề tài</td>
      <td><strong>${topicTitle}</strong></td>
    </tr>
    <tr>
      <td>Sinh viên thực hiện</td>
      <td>${studentName}${studentId ? ' — MSSV: ' + studentId : ''}${studentClass ? ' — Lớp: ' + studentClass : ''}</td>
    </tr>
    <tr>
      <td>Loại đề tài</td>
      <td>${typeLabel}</td>
    </tr>
  </table>

  <div class="section-title">II. Thành phần hội đồng</div>
  <table>
    <tr>
      <th width="10%">STT</th>
      <th width="45%">Vai trò</th>
      <th>Họ và tên</th>
    </tr>
    ${allCouncilRows.map((m, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${m.role}</td>
      <td>${m.name}</td>
    </tr>`).join('')}
  </table>

  <div class="section-title">III. Nhận xét & đánh giá</div>

  <div class="field-block">
    <label>Nhận xét của Giảng viên hướng dẫn (GVHD):</label>
    <div class="field-value">${supervisorComments || '&nbsp;'}</div>
  </div>

  <div class="field-block">
    <label>Nhận xét của Chủ tịch hội đồng (CT_HD):</label>
    <div class="field-value">${chairComments || '&nbsp;'}</div>
  </div>

  <div class="field-block">
    <label>Yêu cầu chỉnh sửa (nếu có):</label>
    <div class="field-value">${revisionRequirements || 'Không có yêu cầu chỉnh sửa.'}</div>
    ${revisionDeadline ? `<p style="margin-top:6px;font-style:italic">⏰ Hạn chỉnh sửa: <strong>${revisionDeadline}</strong></p>` : ''}
  </div>

  <div class="section-title">IV. Kết quả</div>
  <div class="result-box">
    <div>
      <div class="result-label">Điểm tổng kết:</div>
      <div>${finalScore !== undefined ? `<span class="result-value">${finalScore.toFixed(1)}</span> / 10.0` : '<em>Chưa xác định</em>'}</div>
    </div>
    <div>
      <div class="result-label">Kết quả:</div>
      <div class="result-value">${resultText}</div>
    </div>
  </div>

  <div class="signatures">
    <div class="signature-block">
      <div class="sig-label">THƯ KÝ HỘI ĐỒNG<br/>(Ký và ghi rõ họ tên)</div>
      <div class="sig-name">${secretaryName}</div>
    </div>
    <div class="signature-block">
      <div class="sig-label">CHỦ TỊCH HỘI ĐỒNG<br/>(Ký và ghi rõ họ tên)</div>
      <div class="sig-name">${chairName}</div>
    </div>
  </div>

  <div class="footer">
    Tài liệu được tạo tự động bởi Hệ thống Quản lý KLTN — Khoa CNTT, Trường ĐHSPKT TP.HCM
  </div>

</body>
</html>`;
}
