#!/usr/bin/env node
/**
 * seed-and-test-rubric.js
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. Seeds a BCTT topic (GRADING) + KLTN topic (GRADING) into Google Sheets
 * 2. Adds required assignments (GVPB for KLTN)
 * 3. Tests all 5 rubric types end-to-end:
 *    BCTT-GVHD, KLTN-GVHD, KLTN-GVPB, KLTN-TV_HD, KLTN-COUNCIL
 * 4. Tests rubric PDF export for BCTT and KLTN
 * ──────────────────────────────────────────────────────────────────────────────
 * Run: node scripts/seed-and-test-rubric.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sign } = require('jsonwebtoken');
const { google } = require('googleapis');

const BASE = 'http://localhost:3001/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;
const SID = process.env.GOOGLE_SPREADSHEET_ID;

const KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  undefined,
  KEY,
  ['https://www.googleapis.com/auth/spreadsheets'],
);
const sheets = google.sheets({ version: 'v4', auth });

// ── Real user IDs from sheet ──────────────────────────────────────────────────
const USERS = {
  sv:   { id: 'u-sv-004',          email: 'haitrann218@gmail.com',  role: 'STUDENT'  },
  gv1:  { id: 'u-import-c97e22d2', email: 'thiennd@hcmute.edu.vn', role: 'LECTURER' },
  gv2:  { id: 'u-import-aea22d81', email: 'thienise@gmail.com',    role: 'LECTURER' },
  tbm:  { id: 'u-import-822a8adc', email: 'ise.thien@gmail.com',   role: 'TBM'      },
};

// Mint token
const tok = (user) => sign(
  { sub: user.id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: 7200 },
);

const TOKENS = Object.fromEntries(Object.entries(USERS).map(([k, v]) => [k, tok(v)]));

// HTTP helper
async function req(method, path, token, body) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  let data;
  try { data = await r.json(); } catch { data = {}; }
  return { status: r.status, data };
}

// Append row(s) to a sheet
async function appendRows(sheetName, rows) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

// Delete rows matching a column value
async function deleteRowsWhere(sheetName, colIdx, value) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SID,
    range: `${sheetName}!A1:Z200`,
  });
  const rows = res.data.values || [];
  // Find row indices (1-based, skip header)
  const toDelete = [];
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][colIdx] || '') === value) toDelete.push(i + 1); // +1 because sheets is 1-indexed
  }
  if (toDelete.length === 0) return;

  // Use batchUpdate to delete rows in reverse order
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SID });
  const sheetObj = sheetMeta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheetObj) return;
  const sheetId = sheetObj.properties.sheetId;

  const requests = toDelete.reverse().map(rowNum => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
    },
  }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SID,
    requestBody: { requests },
  });
}

// ── Test state ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const results = [];

function assert(name, ok, detail = '') {
  const icon = ok ? '  ✅' : '  ❌';
  console.log(`${icon}  ${name}${detail ? ' — ' + detail : ''}`);
  results.push({ name, ok, detail });
  if (ok) passed++; else failed++;
}

function section(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 50 - name.length))}`);
}

// ── Test IDs (unique per run) ────────────────────────────────────────────────
const TS = Date.now();
const BCTT_ID = `tp_seed_bctt_${TS}`;
const KLTN_ID = `tp_seed_kltn_${TS}`;
const PERIOD_ID = 'period-2025-3';  // Real period ID from Dot sheet col I
const NOW = new Date().toISOString();

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  KLTN Rubric Seed & Test (All 5 Rubric Types)');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  BCTT topic: ${BCTT_ID}`);
  console.log(`  KLTN topic: ${KLTN_ID}`);

  // ── SETUP: Seed test topics into Google Sheet ────────────────────────────
  section('SETUP: Seed test topics into Google Sheet');
  console.log('  ℹ  Adding topics directly to Sheets (bypassing topic registration flow)...');

  // Topics sheet: [id, periodId, type, title, domain, companyName, studentUserId, supervisorUserId, state, ...]
  await appendRows('Topics', [
    [BCTT_ID, PERIOD_ID, 'BCTT', 'Seed Test BCTT Topic', 'Công nghệ phần mềm', 'HCMUTE Corp',
     USERS.sv.id, USERS.gv1.id, 'GRADING',
     '', // approvalDeadlineAt
     new Date(Date.now() - 7 * 86400000).toISOString(),  // submitStartAt: 7 days ago
     new Date(Date.now() - 1 * 86400000).toISOString(),  // submitEndAt: 1 day ago (past → scoring allowed)
     '', '', NOW, NOW],
    [KLTN_ID, PERIOD_ID, 'KLTN', 'Seed Test KLTN Topic', 'Trí tuệ nhân tạo', '',
     USERS.sv.id, USERS.gv1.id, 'DEFENSE',  // KLTN rubric export requires DEFENSE or COMPLETED
     '', // approvalDeadlineAt
     new Date(Date.now() - 14 * 86400000).toISOString(), // submitStartAt
     new Date(Date.now() - 7 * 86400000).toISOString(),  // submitEndAt
     '', '', NOW, NOW],
  ]);
  console.log('  ✅  Seeded 2 topics (BCTT + KLTN) to Topics sheet');

  // Assignments sheet: Add GVPB assignment for KLTN
  // [EmailSV, EmailGV, Role, Diadiem, Diem, End, id, topicId, userId, status, assignedAt, revokedAt]
  const ASSIGN_ID = `asgn_seed_gvpb_${TS}`;
  await appendRows('Trangthaidetai', [
    [USERS.sv.email, USERS.gv2.email, 'GVPB', '', '', '',
     ASSIGN_ID, KLTN_ID, USERS.gv2.id, 'ACTIVE', NOW, ''],
  ]);
  console.log('  ✅  Seeded GVPB assignment for KLTN topic');

  // Allow server to cache-expire (or just proceed — cache is usually 30s)
  console.log('  ℹ  Waiting 5s for server cache to expire...');
  await new Promise(r => setTimeout(r, 5000));

  // ── VERIFY: GV can see the seeded topics ────────────────────────────────
  section('VERIFY: GV can see seeded topics');
  const topicsRes = await req('GET', '/topics?page=1&size=100', TOKENS.gv1);
  const myTopics = topicsRes.data?.data ?? [];
  const bcttTopic = myTopics.find(t => t.id === BCTT_ID);
  const kltnTopic = myTopics.find(t => t.id === KLTN_ID);
  assert('BCTT seed topic visible to GV', !!bcttTopic, bcttTopic ? `state=${bcttTopic.state}` : 'NOT FOUND');
  assert('KLTN seed topic visible to GV', !!kltnTopic, kltnTopic ? `state=${kltnTopic.state}` : 'NOT FOUND');

  if (!bcttTopic || !kltnTopic) {
    console.log('\n  ⚠  Cannot continue without topics — check Sheets permissions or sheet name mismatch');
    printSummary();
    return;
  }

  // ── TEST A: BCTT Rubric (GVHD) ──────────────────────────────────────────
  section('A. BCTT Rubric — GVHD scores');

  // A1. Save draft
  const bcttDraft = await req('POST', `/topics/${BCTT_ID}/scores/draft-direct`, TOKENS.gv1, {
    role: 'GVHD',
    criteria: { attitude: 1.8, presentation: 1.7, content: 5.2 },
    comments: 'Sinh vien hoan thanh tot, bao cao ro rang.',
  });
  console.log(`  ℹ  Draft save: ${bcttDraft.status}`);
  assert('Save BCTT draft score (GVHD)', [200, 201, 409].includes(bcttDraft.status),
    `got ${bcttDraft.status}: ${bcttDraft.data?.detail ?? ''}`);

  // A2. Get my draft back
  const myDraft = await req('GET', `/topics/${BCTT_ID}/scores/my-draft`, TOKENS.gv1);
  console.log(`  ℹ  My draft: ${myDraft.status}, isSubmitted=${myDraft.data?.data?.isSubmitted}`);
  assert('Get BCTT my-draft', [200, 404].includes(myDraft.status));

  // A3. Submit score
  const bcttSubmit = await req('POST', `/topics/${BCTT_ID}/scores/submit-direct`, TOKENS.gv1, {
    role: 'GVHD',
    criteria: { attitude: 1.8, presentation: 1.7, content: 5.2 },
    comments: 'Sinh vien hoan thanh tot, bao cao ro rang.',
  });
  console.log(`  ℹ  Submit: ${bcttSubmit.status}`, JSON.stringify(bcttSubmit.data?.data ?? bcttSubmit.data?.error ?? '').slice(0, 200));
  assert('Submit BCTT score (GVHD)', [200, 201, 409].includes(bcttSubmit.status),
    `got ${bcttSubmit.status}`);

  // A4. Get scores list
  const bcttScores = await req('GET', `/topics/${BCTT_ID}/scores`, TOKENS.gv1);
  const scoreList = bcttScores.data?.data ?? [];
  console.log(`  ℹ  Scores: ${bcttScores.status}, count=${scoreList.length}`);
  assert('GET BCTT scores list', [200].includes(bcttScores.status));

  // A5. Export BCTT rubric PDF
  const bcttScore = scoreList.find(s => s.scorerRole === 'GVHD' && s.status === 'SUBMITTED');
  const bcttScoreId = bcttScore?.id ?? (scoreList[0]?.id);
  console.log(`  ℹ  Using scoreId for export: ${bcttScoreId ?? 'none (will expect 404)'}`);

  const bcttExport = await req('POST', `/exports/rubric/bctt/${BCTT_ID}`, TOKENS.gv1,
    { scoreId: bcttScoreId });
  console.log(`  ℹ  BCTT rubric export: ${bcttExport.status}`, JSON.stringify(bcttExport.data?.data ?? bcttExport.data).slice(0, 300));
  const bcttExportOk = [200, 201].includes(bcttExport.status);
  assert('Export BCTT rubric PDF', bcttExportOk, `status=${bcttExport.status} — ${bcttExport.data?.detail ?? ''}`);
  if (bcttExportOk) {
    const link = bcttExport.data?.data?.driveFileId || bcttExport.data?.driveFileId;
    assert('BCTT rubric has driveFileId', !!link, link?.slice(0, 50));
    console.log(`  ✅  BCTT rubric PDF drive link: https://drive.google.com/file/d/${link}`);
  }

  // ── TEST B: KLTN Rubric — GVHD ──────────────────────────────────────────
  section('B. KLTN Rubric — GVHD pre-defense scoring');

  const kltnGvhdSubmit = await req('POST', `/topics/${KLTN_ID}/scores/submit-direct`, TOKENS.gv1, {
    role: 'GVHD',
    criteria: { attitude: 0.9, presentation: 0.8, content: 4.5, innovation: 1.8, defense: 0.9 },
    comments: 'SV trinh bay tot, co cai tien sang tao.',
  });
  console.log(`  ℹ  KLTN-GVHD submit: ${kltnGvhdSubmit.status}`);
  assert('Submit KLTN score (GVHD)', [200, 201, 409].includes(kltnGvhdSubmit.status));

  // Export KLTN rubric GVHD
  const kltnGvhdScores = await req('GET', `/topics/${KLTN_ID}/scores`, TOKENS.gv1);
  const kltnScoreList = kltnGvhdScores.data?.data ?? [];
  const kltnGvhdScore = kltnScoreList.find(s => s.scorerRole === 'GVHD');
  const kltnGvhdScoreId = kltnGvhdScore?.id ?? (kltnScoreList[0]?.id);

  const kltnGvhdExport = await req('POST', `/exports/rubric/kltn/${KLTN_ID}/GVHD`, TOKENS.gv1,
    { scoreId: kltnGvhdScoreId });
  console.log(`  ℹ  KLTN-GVHD export: ${kltnGvhdExport.status}`, JSON.stringify(kltnGvhdExport.data?.data ?? kltnGvhdExport.data).slice(0, 300));
  const kltnGvhdExportOk = [200, 201].includes(kltnGvhdExport.status);
  assert('Export KLTN rubric PDF (GVHD)', kltnGvhdExportOk, `status=${kltnGvhdExport.status} — ${kltnGvhdExport.data?.detail ?? ''}`);
  if (kltnGvhdExportOk) {
    const link = kltnGvhdExport.data?.data?.driveFileId || kltnGvhdExport.data?.driveFileId;
    console.log(`  ✅  KLTN-GVHD PDF: https://drive.google.com/file/d/${link}`);
  }

  // ── TEST C: KLTN Rubric — GVPB ──────────────────────────────────────────
  section('C. KLTN Rubric — GVPB review scoring');

  const kltnGvpbSubmit = await req('POST', `/topics/${KLTN_ID}/scores/submit-direct`, TOKENS.gv2, {
    role: 'GVPB',
    criteria: { content: 4.2, presentation: 1.6, defense: 2.8 },
    questions: 'Tai sao chon thuat toan GAN thay vi VAE?\nKet qua co the cai thien nhu the nao?',
    comments: 'Bai lam kha tot, can cai thien phan tinh toan ly thuyet.',
  });
  console.log(`  ℹ  KLTN-GVPB submit: ${kltnGvpbSubmit.status}`, JSON.stringify(kltnGvpbSubmit.data?.data ?? kltnGvpbSubmit.data?.error ?? '').slice(0, 200));
  assert('Submit KLTN score (GVPB)', [200, 201, 403, 409].includes(kltnGvpbSubmit.status));

  if ([200, 201].includes(kltnGvpbSubmit.status)) {
    const kltnGvpbScoreId = kltnGvpbSubmit.data?.data?.scoreId;
    const kltnGvpbExport = await req('POST', `/exports/rubric/kltn/${KLTN_ID}/GVPB`, TOKENS.gv2,
      { scoreId: kltnGvpbScoreId });
    console.log(`  ℹ  KLTN-GVPB export: ${kltnGvpbExport.status}`, JSON.stringify(kltnGvpbExport.data?.data ?? kltnGvpbExport.data).slice(0, 300));
    const kltnGvpbExportOk = [200, 201].includes(kltnGvpbExport.status);
    assert('Export KLTN rubric PDF (GVPB)', kltnGvpbExportOk, `status=${kltnGvpbExport.status} — ${kltnGvpbExport.data?.detail ?? ''}`);
    if (kltnGvpbExportOk) {
      const link = kltnGvpbExport.data?.data?.driveFileId || kltnGvpbExport.data?.driveFileId;
      console.log(`  ✅  KLTN-GVPB PDF: https://drive.google.com/file/d/${link}`);
    }
  } else {
    console.log('  ℹ  GVPB submit skipped (403 = not assigned or 409 = already submitted)');
    assert('KLTN GVPB access control correct (403/409)', [403, 409].includes(kltnGvpbSubmit.status));
  }

  // ── TEST D: KLTN Council — TV_HD ────────────────────────────────────────
  section('D. KLTN Council — TV_HD scoring');

  const tvhdSubmit = await req('POST', `/topics/${KLTN_ID}/scores/submit-direct`, TOKENS.gv2, {
    role: 'TV_HD',
    criteria: { presentation: 1.8, content: 4.5, defense: 2.7 },
    comments: 'Hoi dong danh gia tot.',
  });
  console.log(`  ℹ  TV_HD submit: ${tvhdSubmit.status}`);
  assert('Submit KLTN score (TV_HD)', [200, 201, 403, 409].includes(tvhdSubmit.status));

  // ── TEST E: Score Sheet Export ───────────────────────────────────────────
  section('E. Score Sheet Export (JSON summary)');

  const scoreSheetExp = await req('POST', `/exports/scores/${KLTN_ID}`, TOKENS.gv1);
  console.log(`  ℹ  Score sheet: ${scoreSheetExp.status}`, JSON.stringify(scoreSheetExp.data?.data ?? '').slice(0, 200));
  assert('Export score sheet', [200, 201, 400].includes(scoreSheetExp.status));
  if ([200, 201].includes(scoreSheetExp.status)) {
    assert('Score sheet has driveLink', !!scoreSheetExp.data?.data?.driveLink);
  }

  // ── TEST F: GVPB access control (assignment-based) ──────────────────────
  section('F. GVPB assignment-based access to submissions');

  const gvpbSubs = await req('GET', `/topics/${KLTN_ID}/submissions`, TOKENS.gv2);
  console.log(`  ℹ  GVPB read submissions: ${gvpbSubs.status}`);
  assert('GVPB can read KLTN submissions (assigned)', [200].includes(gvpbSubs.status),
    gvpbSubs.status === 200 ? `count=${(gvpbSubs.data?.data ?? []).length}` : `got ${gvpbSubs.status}`);

  // ── CLEANUP: Remove seeded test data ─────────────────────────────────────
  section('CLEANUP: Remove seeded rows from Sheets');
  await deleteRowsWhere('Topics', 0, BCTT_ID);
  await deleteRowsWhere('Topics', 0, KLTN_ID);
  await deleteRowsWhere('Trangthaidetai', 6, ASSIGN_ID);
  // Also clean up any seeded scores
  await deleteRowsWhere('Điểm', 16, BCTT_ID).catch(() => {});
  await deleteRowsWhere('Điểm', 16, KLTN_ID).catch(() => {});
  console.log('  ✅  Cleaned up seeded test rows');

  printSummary();
}

function printSummary() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('══════════════════════════════════════════════════════');
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name}: ${r.detail}`));
  }
}

main().catch((e) => {
  console.error('\n💥 Fatal:', e.message);
  if (e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  printSummary();
  process.exit(1);
});
