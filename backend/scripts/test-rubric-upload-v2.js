/**
 * test-rubric-upload-v2.js
 * 
 * Uses direct XML text replacement instead of docxtemplater to avoid
 * the duplicate_open_tag issue caused by Word's XML formatting.
 * 
 * Strategy: after extracting document.xml from the .docx zip,
 * find each {{placeholder}} text in any <w:t> element and replace it
 * with the actual value using simple string replace.
 * 
 * Usage: node scripts/test-rubric-upload-v2.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

const PizZip = require('pizzip');
const TEMPLATE_DIR = path.join(__dirname, '..', 'resources', 'docx-templates');
const RUBRIC_FOLDER_ID = process.env.GOOGLE_DRIVE_RUBRIC_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const TODAY = new Date();
const DD = TODAY.getDate(), MM = TODAY.getMonth() + 1, YYYY = TODAY.getFullYear();
const ACADEMIC_YEAR = MM >= 9 ? `${YYYY}-${YYYY+1}` : `${YYYY-1}-${YYYY}`;

const COMMON = {
  studentName: 'Nguyễn Văn Test',
  studentId: 'SV21001',
  studentClass: 'CNTT21A',
  major: 'Công nghệ Thông tin',
  course: '2021',
  period: 'HK2-2025-2026',
  academicYear: ACADEMIC_YEAR,
  ngay: String(DD), thang: String(MM), nam: String(YYYY),
  ngayCham: `${DD}/${MM}/${YYYY}`,
  totalScoreFixed: '8.50',
  cho_bao_ve_mark: '☑',
  khong_bao_ve_mark: '☐',
};

const RUBRIC_CONFIGS = [
  {
    type: 'BCTT', templateFile: 'bctt-rubric-template.docx', prefix: 'test_bctt',
    data: { ...COMMON, advisorName: 'TS. Trần Thị GVHD', company: 'Công ty Test',
      topicTitle: 'Báo cáo thực tập Test', diem1: '1.8', diem2: '0.8', diem3: '0.7', diem4: '4.2', diem5: '0.8' },
  },
  {
    type: 'KLTN_GVHD', templateFile: 'kltn-gvhd-rubric-template.docx', prefix: 'test_kltn_gvhd',
    data: { ...COMMON, advisorName: 'TS. Trần Thị GVHD', topicTitle: 'Hệ thống quản lý KLTN Test',
      diem1: '0.9', diem2: '2.8', diem3: '2.7', diem4: '0.8', diem5: '1.7' },
  },
  {
    type: 'KLTN_GVPB', templateFile: 'kltn-gvpb-rubric-template.docx', prefix: 'test_kltn_gvpb',
    data: { ...COMMON, advisorName: 'TS. Trần Thị GVHD', reviewerName: 'ThS. Lê Văn GVPB',
      topicTitle: 'Hệ thống quản lý KLTN Test', diem1: '0.8', diem2: '2.5', diem3: '2.6', diem4: '0.7', diem5: '1.6' },
  },
  {
    type: 'KLTN_COUNCIL', templateFile: 'kltn-council-rubric-template.docx', prefix: 'test_kltn_hd',
    data: { ...COMMON, advisorName: 'TS. Trần Thị GVHD', memberName: 'PGS.TS. Chủ Tịch',
      topicTitle: 'Hệ thống quản lý KLTN Test', diem1: '3.5', diem2: '1.7', diem3: '2.6', diem4: '0.8', diem5: '0' },
  },
];

/**
 * Render docx by doing direct XML string replacement.
 * Finds {{key}} in <w:t> elements and replaces with value.
 * This bypasses docxtemplater's XML parser entirely.
 */
function renderByDirectReplace(templateFile, data) {
  const tp = path.join(TEMPLATE_DIR, templateFile);
  const zip = new PizZip(fs.readFileSync(tp, 'binary'));
  let xml = zip.file('word/document.xml').asText();

  // Replace each {{key}} with escaped value
  for (const [key, value] of Object.entries(data)) {
    const tag = `{{${key}}}`;
    const escaped = String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Replace ALL occurrences
    while (xml.includes(tag)) {
      xml = xml.replace(tag, escaped);
    }
  }

  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  return Buffer.from(buf);
}

function buildAuth() {
  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return oauth2;
}

async function uploadFile(drive, buffer, filename, folderId) {
  const { Readable } = require('stream');
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: DOCX_MIME, body: Readable.from(buffer) },
    fields: 'id,webViewLink,name',
  });
  return res.data;
}

async function main() {
  console.log('🚀 Test rubric upload (direct XML replace mode)');
  console.log(`📁 Folder: ${RUBRIC_FOLDER_ID}\n`);

  const auth = buildAuth();
  const drive = google.drive({ version: 'v3', auth });

  // Create test subfolder
  let folderId = RUBRIC_FOLDER_ID;
  try {
    const res = await drive.files.create({
      requestBody: { name: `test_rubrics_${Date.now()}`, mimeType: 'application/vnd.google-apps.folder', parents: [RUBRIC_FOLDER_ID] },
      fields: 'id',
    });
    folderId = res.data.id;
    console.log(`📂 Subfolder: https://drive.google.com/drive/folders/${folderId}\n`);
  } catch(e) { console.warn('⚠️  Using root folder\n'); }

  const results = [];
  for (const cfg of RUBRIC_CONFIGS) {
    process.stdout.write(`  ⏳ ${cfg.type} ... `);
    try {
      const buf = renderByDirectReplace(cfg.templateFile, cfg.data);
      const file = await uploadFile(drive, buf, `${cfg.prefix}_${Date.now()}.docx`, folderId);
      console.log(`✅ ${file.name}`);
      console.log(`     🔗 ${file.webViewLink}`);
      results.push({ type: cfg.type, ok: true, link: file.webViewLink });
    } catch(e) {
      console.log(`❌ ${e.message}`);
      results.push({ type: cfg.type, ok: false, err: e.message });
    }
  }

  console.log('\n' + '─'.repeat(60));
  const ok = results.filter(r => r.ok).length;
  console.log(`📊 ${ok}/${results.length} passed`);
  process.exit(ok === results.length ? 0 : 1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
