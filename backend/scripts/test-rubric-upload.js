/**
 * test-rubric-upload.js
 * Quick end-to-end test: generate all 4 rubric types from templates and upload to Drive.
 *
 * Usage:
 *   node scripts/test-rubric-upload.js
 *
 * Prerequisites:
 *   - .env has GOOGLE_DRIVE_RUBRIC_FOLDER_ID set (or we use GOOGLE_DRIVE_FOLDER_ID as fallback)
 *   - Google credentials in .env (service account or OAuth refresh token)
 *   - docx-templates are placed in resources/docx-templates/
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// ── Load .env manually ────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

// ── Load docxtemplater ────────────────────────────────────────────────────────
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

// ── Config ────────────────────────────────────────────────────────────────────
const TEMPLATE_DIR = path.join(__dirname, '..', 'resources', 'docx-templates');
const RUBRIC_FOLDER_ID =
  process.env.GOOGLE_DRIVE_RUBRIC_FOLDER_ID ||
  process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!RUBRIC_FOLDER_ID) {
  console.error('❌ Neither GOOGLE_DRIVE_RUBRIC_FOLDER_ID nor GOOGLE_DRIVE_FOLDER_ID is set in .env');
  process.exit(1);
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ── Sample data for each rubric type ─────────────────────────────────────────

const TODAY = new Date();
const DD = TODAY.getDate();
const MM = TODAY.getMonth() + 1;
const YYYY = TODAY.getFullYear();
const ACADEMIC_YEAR = MM >= 9 ? `${YYYY}-${YYYY+1}` : `${YYYY-1}-${YYYY}`;

const COMMON_HEADER = {
  studentName: 'Nguyễn Văn Test',
  studentId: 'SV21001',
  studentClass: 'CNTT21A',
  major: 'Công nghệ Thông tin',
  course: '2021',
  period: 'HK2-2025-2026',
  academicYear: ACADEMIC_YEAR,
  ngay: String(DD),
  thang: String(MM),
  nam: String(YYYY),
  ngayCham: `${DD}/${MM}/${YYYY}`,
};

const RUBRIC_CONFIGS = [
  {
    type: 'BCTT',
    templateFile: 'bctt-rubric-template.docx',
    outputPrefix: 'test_rubric_bctt',
    data: {
      ...COMMON_HEADER,
      advisorName: 'TS. Trần Thị Hướng Dẫn',
      company: 'Công ty TNHH Test',
      topicTitle: 'Báo cáo thực tập tại Công ty TNHH Test',
      scores: { thaido: 1.8, hinhthuc: 0.8, modau: 0.7, noidung: 4.2, ketluan: 0.8 },
      totalScore: 8.3,
      totalScoreFixed: '8.30',
      allowDefense: true,
      cho_bao_ve_mark: '☑',
      khong_bao_ve_mark: '☐',
      diem1: '1.8', diem2: '0.8', diem3: '0.7', diem4: '4.2', diem5: '0.8',
    },
  },
  {
    type: 'KLTN_GVHD',
    templateFile: 'kltn-gvhd-rubric-template.docx',
    outputPrefix: 'test_rubric_kltn_gvhd',
    data: {
      ...COMMON_HEADER,
      advisorName: 'TS. Trần Thị Hướng Dẫn',
      topicTitle: 'Xây dựng hệ thống quản lý KLTN - Test',
      scores: { xacdinhvande: 0.9, noidung: 2.8, ketqua: 2.7, hinhthuc: 0.8, tinhthan: 1.7 },
      totalScore: 8.9,
      totalScoreFixed: '8.90',
      allowDefense: true,
      cho_bao_ve_mark: '☑',
      khong_bao_ve_mark: '☐',
      conclusion: 'Sinh viên thực hiện tốt, đề tài có tính ứng dụng cao.',
      diem1: '0.9', diem2: '2.8', diem3: '2.7', diem4: '0.8', diem5: '1.7',
    },
  },
  {
    type: 'KLTN_GVPB',
    templateFile: 'kltn-gvpb-rubric-template.docx',
    outputPrefix: 'test_rubric_kltn_gvpb',
    data: {
      ...COMMON_HEADER,
      advisorName: 'TS. Trần Thị Hướng Dẫn',
      reviewerName: 'ThS. Lê Văn Phản Biện',
      topicTitle: 'Xây dựng hệ thống quản lý KLTN - Test',
      scores: { xacdinhvande: 0.8, noidung: 2.5, ketqua: 2.6, hinhthuc: 0.7, traloi: 1.6 },
      totalScore: 8.2,
      totalScoreFixed: '8.20',
      allowDefense: true,
      cho_bao_ve_mark: '☑',
      khong_bao_ve_mark: '☐',
      conclusion: 'Bài làm đạt yêu cầu, cần bổ sung phần kết luận.',
      questions: ['Phương pháp nghiên cứu sử dụng là gì?', 'Hướng phát triển tiếp theo?'],
      questionsText: 'Phương pháp nghiên cứu sử dụng là gì?\nHướng phát triển tiếp theo?',
      diem1: '0.8', diem2: '2.5', diem3: '2.6', diem4: '0.7', diem5: '1.6',
    },
  },
  {
    type: 'KLTN_COUNCIL',
    templateFile: 'kltn-council-rubric-template.docx',
    outputPrefix: 'test_rubric_kltn_hd',
    data: {
      ...COMMON_HEADER,
      advisorName: 'TS. Trần Thị Hướng Dẫn',
      memberName: 'PGS. TS. Nguyễn Văn Chủ Tịch',
      memberRole: 'CT_HD',
      topicTitle: 'Xây dựng hệ thống quản lý KLTN - Test',
      scores: { noidung: 3.5, trinh_bay: 1.7, traloi: 2.6, hinhthuc: 0.8 },
      totalScore: 8.6,
      totalScoreFixed: '8.60',
      diem1: '3.5', diem2: '1.7', diem3: '2.6', diem4: '0.8',
    },
  },
];

// ── Build Google Auth ─────────────────────────────────────────────────────────
function buildAuth() {
  const authMode = process.env.GOOGLE_DRIVE_AUTH_MODE || 'service_account';

  if (authMode === 'oauth_user') {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    return oauth2;
  }

  // Default: service account
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

// ── Generate .docx from template ─────────────────────────────────────────────
function renderDocx(templateFile, data) {
  const templatePath = path.join(TEMPLATE_DIR, templateFile);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const templateBinary = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(templateBinary);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  return Buffer.from(buf);
}

// ── Upload to Drive ───────────────────────────────────────────────────────────
async function uploadToDrive(driveClient, buffer, filename, folderId) {
  const { Readable } = require('stream');
  const readable = Readable.from(buffer);

  const res = await driveClient.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: DOCX_MIME,
      body: readable,
    },
    fields: 'id,webViewLink,name',
  });

  return res.data;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting rubric upload test...');
  console.log(`📁 Target folder: ${RUBRIC_FOLDER_ID}`);
  console.log(`📅 Academic year: ${ACADEMIC_YEAR}`);
  console.log('');

  const auth = buildAuth();
  const drive = google.drive({ version: 'v3', auth });

  // Create a test subfolder under RUBRIC_FOLDER_ID
  let testFolderId = RUBRIC_FOLDER_ID;
  try {
    const folderRes = await drive.files.create({
      requestBody: {
        name: `test_upload_${Date.now()}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [RUBRIC_FOLDER_ID],
      },
      fields: 'id,webViewLink',
    });
    testFolderId = folderRes.data.id;
    console.log(`📂 Created test subfolder: https://drive.google.com/drive/folders/${testFolderId}`);
    console.log('');
  } catch (e) {
    console.warn(`⚠️  Could not create subfolder (${e.message}), uploading to root folder`);
  }

  const results = [];

  for (const config of RUBRIC_CONFIGS) {
    process.stdout.write(`  ⏳ ${config.type} ... `);
    try {
      const buffer = renderDocx(config.templateFile, config.data);
      const filename = `${config.outputPrefix}_${Date.now()}.docx`;
      const file = await uploadToDrive(drive, buffer, filename, testFolderId);
      console.log(`✅ OK`);
      console.log(`     📄 ${file.name}`);
      console.log(`     🔗 ${file.webViewLink}`);
      results.push({ type: config.type, status: 'OK', link: file.webViewLink });
    } catch (e) {
      console.log(`❌ FAILED`);
      console.log(`     Error: ${e.message}`);
      // If docxtemplater error, show details
      if (e.properties && e.properties.errors) {
        for (const err of e.properties.errors) {
          console.log(`     Template error: ${JSON.stringify(err.properties)}`);
        }
      }
      results.push({ type: config.type, status: 'FAILED', error: e.message });
    }
    console.log('');
  }

  // Summary
  const passed = results.filter(r => r.status === 'OK').length;
  console.log('─'.repeat(60));
  console.log(`📊 Results: ${passed}/${results.length} passed`);
  for (const r of results) {
    const icon = r.status === 'OK' ? '✅' : '❌';
    console.log(`  ${icon} ${r.type}`);
    if (r.link) console.log(`     ${r.link}`);
    if (r.error) console.log(`     ${r.error}`);
  }

  if (passed < results.length) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
