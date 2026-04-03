/**
 * import-from-teacher-sheet.ts — Phase 0C
 * ─────────────────────────────────────────────────────────────────────────────
 * Migrate dữ liệu từ teacher's Google Sheet sang App Spreadsheet (schema v3.2).
 *
 * Flow:
 *   1. Đọc từng tab của teacher sheet
 *   2. Map email → UUID (sinh UUIDs mới nếu chưa có, hoặc dùng lại nếu đã seed)
 *   3. Ghi vào app spreadsheet với đầy đủ teacher cols + app cols
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/import-from-teacher-sheet.ts
 *
 * Env vars (dùng chung với seed-sheets):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *   GOOGLE_SPREADSHEET_ID        ← App spreadsheet (target)
 *   TEACHER_SPREADSHEET_ID       ← Teacher's spreadsheet (source)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';
import { randomUUID } from 'crypto';

// ─── Auth ─────────────────────────────────────────────────────────────────────
const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';
const RAW_KEY = process.env.GOOGLE_PRIVATE_KEY ?? '';
const APP_SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? '';
const TEACHER_SHEET_ID = process.env.TEACHER_SPREADSHEET_ID ?? '';

if (!EMAIL || !RAW_KEY || !APP_SHEET_ID) {
  console.error('❌  Missing: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SPREADSHEET_ID');
  process.exit(1);
}

if (!TEACHER_SHEET_ID) {
  console.warn('⚠️   TEACHER_SPREADSHEET_ID not set — will import from APP_SHEET_ID only (re-populate app cols)');
}

const privateKey = RAW_KEY.replace(/\\n/g, '\n');
const auth = new google.auth.JWT(EMAIL, undefined, privateKey, [
  'https://www.googleapis.com/auth/spreadsheets',
]);
const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth });

// ─── Type helpers ─────────────────────────────────────────────────────────────
type RowValues = (string | number | boolean | null)[];

/** Read all data rows (skip header row 1) from a sheet tab */
async function readRows(spreadsheetId: string, sheetName: string): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A2:ZZ`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    return ((res.data.values ?? []) as string[][]).filter((r) => r.length > 0 && r[0] !== '');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠️   Could not read '${sheetName}': ${msg}`);
    return [];
  }
}

/** Clear data rows (keep header row 1) */
async function clearRows(spreadsheetId: string, sheetName: string): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetName}'!A2:ZZ`,
  });
}

/** Append rows to a sheet */
async function appendRows(spreadsheetId: string, sheetName: string, rows: RowValues[]): Promise<void> {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

/** Ensure tab has the correct header */
async function ensureHeader(spreadsheetId: string, sheetName: string, headers: string[]): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (spreadsheet.data.sheets ?? []).map((s) => s.properties?.title ?? '');
  if (!existing.some((t) => t === sheetName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
    console.log(`    📋  Created tab: ${sheetName}`);
  }
  const lastCol = columnName(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1:${lastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers] },
  });
}

function columnName(n: number): string {
  let name = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    name = String.fromCharCode(65 + m) + name;
    n = Math.floor((n - m) / 26);
  }
  return name || 'A';
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function now(): string {
  return new Date().toISOString();
}

// ─── UUID Registry ────────────────────────────────────────────────────────────
/**
 * Global in-memory registry: email → user UUID
 * Populated during Data tab import and reused for foreign key resolution.
 */
const emailToUserId = new Map<string, string>();
const emailToName = new Map<string, string>();
const emailToMs = new Map<string, string>();    // SV: MSSV; GV: MaGV
const emailToRole = new Map<string, string>();  // 'SV' | 'GV' | 'TBM'

/** Get or generate a UUID for an email */
function getUserId(email: string): string {
  const norm = email.toLowerCase().trim();
  if (!emailToUserId.has(norm)) {
    emailToUserId.set(norm, randomUUID());
  }
  return emailToUserId.get(norm)!;
}

/** Teacher role → App role mapping */
function mapRole(teacherRole: string): string {
  const r = str(teacherRole).toUpperCase();
  if (r === 'SV') return 'STUDENT';
  if (r === 'GV') return 'LECTURER';
  if (r === 'TBM') return 'TBM';
  return r; // pass-through
}

/** Teacher topicRole → App TopicRole mapping */
function mapTopicRole(teacherRole: string): string {
  const r = str(teacherRole).toUpperCase();
  const map: Record<string, string> = {
    'GVHD': 'GVHD',
    'GVPB': 'GVPB',
    'CTHD': 'CT_HD',
    'TVHD': 'TV_HD',
    'THUKYHD': 'TK_HD',
    'CT_HD': 'CT_HD',
    'TV_HD': 'TV_HD',
    'TK_HD': 'TK_HD',
  };
  return map[r] ?? r;
}

// ─── Tab Importers ────────────────────────────────────────────────────────────

/**
 * Import Data tab (Users):
 * Teacher cols: Email, MS, Ten, Role, Major, HeDaoTao
 * App cols:     id, phone, completedBcttScore, totalQuota, quotaUsed, expertise, isActive, createdAt
 */
async function importDataTab(sourceId: string, targetId: string): Promise<void> {
  console.log('\n📋  Importing Data tab (Users)...');
  const rows = await readRows(sourceId, 'Data');
  console.log(`    Found ${rows.length} rows in source`);

  if (rows.length === 0) {
    console.log('    ⏭  No data to import');
    return;
  }

  const N = now();
  const outputRows: RowValues[] = rows.map((r) => {
    const email = str(r[0]).toLowerCase();
    const ms    = str(r[1]);
    const name  = str(r[2]);
    const role  = str(r[3]);
    const major = str(r[4]);
    const hdt   = str(r[5]);

    // Register in registry
    const id = getUserId(email);
    emailToName.set(email, name);
    emailToMs.set(email, ms);
    emailToRole.set(email, role);

    // App cols (try to preserve existing app data from cols 6+)
    const phone               = str(r[6])  || '';
    const completedBcttScore  = str(r[7])  || '';
    const totalQuota          = str(r[8])  || '';
    const quotaUsed           = str(r[9])  || '';
    const expertise           = str(r[10]) || '';
    const isActive            = str(r[11]) || 'TRUE';
    const createdAt           = str(r[12]) || N;

    return [
      // Teacher cols (positions 0-5)
      email, ms, name, role, major, hdt,
      // App cols (positions 6-13)
      id, phone, completedBcttScore, totalQuota, quotaUsed, expertise, isActive, createdAt,
    ];
  });

  await clearRows(targetId, 'Data');
  await appendRows(targetId, 'Data', outputRows);
  console.log(`    ✅  Wrote ${outputRows.length} rows → Data`);
}

/**
 * Import Dot tab (Periods):
 * Teacher cols: StartReg, EndReg, Loaidetai, Major, Dot, Active, StartEx, EndEx
 * App cols:     id, createdAt, updatedAt
 */
async function importDotTab(sourceId: string, targetId: string): Promise<void> {
  console.log('\n📋  Importing Dot tab (Periods)...');
  const rows = await readRows(sourceId, 'Dot');
  console.log(`    Found ${rows.length} rows in source`);

  if (rows.length === 0) {
    console.log('    ⏭  No data to import');
    return;
  }

  const N = now();
  const outputRows: RowValues[] = rows.map((r) => {
    const startReg  = str(r[0]);
    const endReg    = str(r[1]);
    const loaidetai = str(r[2]);
    const major     = str(r[3]);
    const dot       = str(r[4]);
    const active    = str(r[5]) || 'TRUE';
    const startEx   = str(r[6]);
    const endEx     = str(r[7]);

    // App cols: try to preserve, or generate
    const id        = str(r[8])  || randomUUID();
    const createdAt = str(r[9])  || N;
    const updatedAt = str(r[10]) || N;

    return [startReg, endReg, loaidetai, major, dot, active, startEx, endEx, id, createdAt, updatedAt];
  });

  await clearRows(targetId, 'Dot');
  await appendRows(targetId, 'Dot', outputRows);
  console.log(`    ✅  Wrote ${outputRows.length} rows → Dot`);
}

/**
 * Import Trangthaidetai tab (Assignments):
 * Teacher cols: EmailSV, EmailGV, Role, Diadiem, Diem, End
 * App cols:     id, topicId, userId, status, assignedAt, revokedAt
 *
 * Note: topicId will be empty unless Topics tab is populated first.
 * This import preserves teacher data and fills app col IDs.
 */
async function importTrangthaidetaiTab(sourceId: string, targetId: string): Promise<void> {
  console.log('\n📋  Importing Trangthaidetai tab (Assignments)...');
  const rows = await readRows(sourceId, 'Trangthaidetai');
  console.log(`    Found ${rows.length} rows in source`);

  if (rows.length === 0) {
    console.log('    ⏭  No data to import');
    return;
  }

  const N = now();
  const outputRows: RowValues[] = rows.map((r) => {
    const emailSV  = str(r[0]).toLowerCase();
    const emailGV  = str(r[1]).toLowerCase();
    const role     = str(r[2]);  // GVHD | GVPB | CTHD | TVHD | ThukyHD
    const diadiem  = str(r[3]);
    const diem     = str(r[4]);
    const end      = str(r[5]);

    // App cols: resolve userId from registry, generate assignment id
    const id         = str(r[6])  || randomUUID();
    const topicId    = str(r[7])  || '';  // Will be linked later via Topics import
    const userId     = str(r[8])  || (emailGV ? getUserId(emailGV) : '');
    const status     = str(r[9])  || 'ACTIVE';
    const assignedAt = str(r[10]) || N;
    const revokedAt  = str(r[11]) || '';

    return [emailSV, emailGV, role, diadiem, diem, end, id, topicId, userId, status, assignedAt, revokedAt];
  });

  await clearRows(targetId, 'Trangthaidetai');
  await appendRows(targetId, 'Trangthaidetai', outputRows);
  console.log(`    ✅  Wrote ${outputRows.length} rows → Trangthaidetai`);
}

/**
 * Import Điểm tab (Scores):
 * Teacher cols: Email, Tên SV, MSSV, Tên Đề tài, GV, Role, TC1..TC10
 * App cols:     id, topicId, scorerUserId, scorerRole, status, totalScore, rubricData,
 *               allowDefense, questions, submittedAt, updatedAt
 */
async function importDiemTab(sourceId: string, targetId: string): Promise<void> {
  console.log('\n📋  Importing Điểm tab (Scores)...');

  // Try Vietnamese tab name first, fallback to ascii
  let rows = await readRows(sourceId, 'Điểm');
  if (rows.length === 0) {
    rows = await readRows(sourceId, 'Diem');
  }
  console.log(`    Found ${rows.length} rows in source`);

  if (rows.length === 0) {
    console.log('    ⏭  No data to import');
    return;
  }

  const N = now();
  const outputRows: RowValues[] = rows.map((r) => {
    // Teacher cols [0-15]
    const email    = str(r[0]).toLowerCase();
    const tenSV    = str(r[1]);
    const mssv     = str(r[2]);
    const tenDetai = str(r[3]);
    const gv       = str(r[4]).toLowerCase();
    const role     = str(r[5]);
    const tc: string[] = [];
    for (let i = 0; i < 10; i++) {
      tc.push(str(r[6 + i]));
    }

    // App cols [16-26]: try to preserve, or generate
    const id           = str(r[16]) || randomUUID();
    const topicId      = str(r[17]) || '';
    const scorerUserId = str(r[18]) || (gv ? getUserId(gv) : '');
    const scorerRole   = str(r[19]) || mapTopicRole(role);
    const status       = str(r[20]) || 'DRAFT';

    // Compute totalScore from TC values if not set
    const tcNums = tc.map(t => parseFloat(t)).filter(n => !isNaN(n));
    const computedTotal = tcNums.length > 0 ? tcNums.reduce((a, b) => a + b, 0) : 0;
    const totalScore    = str(r[21]) || (computedTotal > 0 ? String(computedTotal) : '');

    // Build rubricData JSON from TC values if not set
    const existingRubric = str(r[22]);
    const rubricData = existingRubric || JSON.stringify(
      tc.map((score, i) => ({ code: `TC${i + 1}`, score: parseFloat(score) || 0 }))
    );

    const allowDefense = str(r[23]) || 'FALSE';
    const questions    = str(r[24]) || '';
    const submittedAt  = str(r[25]) || '';
    const updatedAt    = str(r[26]) || N;

    return [
      // Teacher cols
      email, tenSV, mssv, tenDetai, gv, role,
      ...tc,
      // App cols
      id, topicId, scorerUserId, scorerRole, status,
      totalScore, rubricData, allowDefense, questions, submittedAt, updatedAt,
    ];
  });

  await clearRows(targetId, 'Điểm');
  await appendRows(targetId, 'Điểm', outputRows);
  console.log(`    ✅  Wrote ${outputRows.length} rows → Điểm`);
}

/**
 * Import TenDetai tab (Submissions):
 * Teacher cols: EmailSV, Tendetai, DotHK, Loaidetai, Version, Linkbai
 * App cols:     id, topicId, uploaderUserId, fileType, revisionRoundId, revisionRoundNumber,
 *               versionNumber, versionLabel, status, deadlineAt, confirmedAt, isLocked,
 *               canReplace, driveFileId, uploadedAt, originalFileName, fileSize
 */
async function importTenDetaiTab(sourceId: string, targetId: string): Promise<void> {
  console.log('\n📋  Importing TenDetai tab (Submissions)...');
  const rows = await readRows(sourceId, 'TenDetai');
  console.log(`    Found ${rows.length} rows in source`);

  if (rows.length === 0) {
    console.log('    ⏭  No data to import');
    return;
  }

  const N = now();
  const outputRows: RowValues[] = rows.map((r) => {
    // Teacher cols [0-5]
    const emailSV  = str(r[0]).toLowerCase();
    const tendetai = str(r[1]);
    const dotHK    = str(r[2]);
    const loait    = str(r[3]);
    const version  = str(r[4]);
    const linkbai  = str(r[5]);

    // App cols [6-22]: try to preserve, or generate
    const id                  = str(r[6])  || randomUUID();
    const topicId             = str(r[7])  || '';
    const uploaderUserId      = str(r[8])  || (emailSV ? getUserId(emailSV) : '');
    const fileType            = str(r[9])  || 'REPORT';
    const revisionRoundId     = str(r[10]) || '';
    const revisionRoundNumber = str(r[11]) || '1';
    const versionNumber       = str(r[12]) || version || '1';
    const versionLabel        = str(r[13]) || `V${versionNumber}`;
    const status              = str(r[14]) || (linkbai ? 'CONFIRMED' : 'PENDING');
    const deadlineAt          = str(r[15]) || '';
    const confirmedAt         = str(r[16]) || (linkbai ? N : '');
    const isLocked            = str(r[17]) || (linkbai ? 'TRUE' : 'FALSE');
    const canReplace          = str(r[18]) || 'FALSE';
    const driveFileId         = str(r[19]) || '';
    const uploadedAt          = str(r[20]) || (linkbai ? N : '');
    const originalFileName    = str(r[21]) || '';
    const fileSize            = str(r[22]) || '';

    return [
      // Teacher cols
      emailSV, tendetai, dotHK, loait, version, linkbai,
      // App cols
      id, topicId, uploaderUserId, fileType,
      revisionRoundId, revisionRoundNumber, versionNumber, versionLabel, status,
      deadlineAt, confirmedAt, isLocked, canReplace,
      driveFileId, uploadedAt, originalFileName, fileSize,
    ];
  });

  await clearRows(targetId, 'TenDetai');
  await appendRows(targetId, 'TenDetai', outputRows);
  console.log(`    ✅  Wrote ${outputRows.length} rows → TenDetai`);
}

/**
 * Import Bienban tab (ExportFiles):
 * Teacher cols: Email, Bienban
 * App cols:     id, topicId, exportType, status, driveFileId, driveLink,
 *               downloadUrl, fileName, mimeType, errorMessage, requestedBy, createdAt, completedAt
 */
async function importBienbanTab(sourceId: string, targetId: string): Promise<void> {
  console.log('\n📋  Importing Bienban tab (ExportFiles)...');
  const rows = await readRows(sourceId, 'Bienban');
  console.log(`    Found ${rows.length} rows in source`);

  if (rows.length === 0) {
    console.log('    ⏭  No data to import');
    return;
  }

  const N = now();
  const outputRows: RowValues[] = rows.map((r) => {
    // Teacher cols [0-1]
    const email   = str(r[0]).toLowerCase();
    const bienban = str(r[1]);

    // App cols [2-14]
    const id           = str(r[2])  || randomUUID();
    const topicId      = str(r[3])  || '';
    const exportType   = str(r[4])  || 'MINUTES';
    const status       = str(r[5])  || (bienban ? 'COMPLETED' : 'PENDING');
    const driveFileId  = str(r[6])  || '';
    const driveLink    = str(r[7])  || bienban;
    const downloadUrl  = str(r[8])  || bienban;
    const fileName     = str(r[9])  || '';
    const mimeType     = str(r[10]) || 'application/pdf';
    const errorMessage = str(r[11]) || '';
    const requestedBy  = str(r[12]) || (email ? getUserId(email) : '');
    const createdAt    = str(r[13]) || N;
    const completedAt  = str(r[14]) || (bienban ? N : '');

    return [
      email, bienban,
      id, topicId, exportType, status, driveFileId, driveLink,
      downloadUrl, fileName, mimeType, errorMessage, requestedBy, createdAt, completedAt,
    ];
  });

  await clearRows(targetId, 'Bienban');
  await appendRows(targetId, 'Bienban', outputRows);
  console.log(`    ✅  Wrote ${outputRows.length} rows → Bienban`);
}

/**
 * Import BB rubric tabs (all 5):
 * Teacher cols: Tên TC, Điểm tối đa / Mô tả
 * App cols:     id, code, order, scorerRole
 */
async function importBBTabs(sourceId: string, targetId: string): Promise<void> {
  const tabs: Array<{ name: string; scorerRole: string; hasMaxScore: boolean }> = [
    { name: 'BB GVHD - Ứng dụng', scorerRole: 'GVHD', hasMaxScore: true },
    { name: 'BB GVHD - NC',        scorerRole: 'GVHD', hasMaxScore: true },
    { name: 'BB GVPB - Ứng dụng', scorerRole: 'GVPB', hasMaxScore: true },
    { name: 'BB GVPB - NC',        scorerRole: 'GVPB', hasMaxScore: true },
    { name: 'Chấm điểm của HĐồng', scorerRole: 'TV_HD', hasMaxScore: false },
  ];

  for (const tab of tabs) {
    console.log(`\n📋  Importing rubric tab: ${tab.name}...`);
    const rows = await readRows(sourceId, tab.name);
    console.log(`    Found ${rows.length} rows in source`);

    if (rows.length === 0) {
      console.log('    ⏭  No data to import');
      continue;
    }

    const outputRows: RowValues[] = rows.map((r, idx) => {
      const tenTC    = str(r[0]);
      const col2     = str(r[1]); // Điểm tối đa OR Mô tả

      // App cols: try to preserve, or generate
      const id         = str(r[2]) || randomUUID();
      const code       = str(r[3]) || `TC${idx + 1}`;
      const order      = str(r[4]) || String(idx + 1);
      const scorerRole = str(r[5]) || tab.scorerRole;

      return [tenTC, col2, id, code, order, scorerRole];
    });

    await clearRows(targetId, tab.name);
    await appendRows(targetId, tab.name, outputRows);
    console.log(`    ✅  Wrote ${outputRows.length} rows → ${tab.name}`);
  }
}

/**
 * Import Detaigoiy tab (SuggestedTopics):
 * Teacher cols: Email, Tendetai, Dot
 * App cols:     id, lecturerUserId, createdAt
 */
async function importDetaigoiyTab(sourceId: string, targetId: string): Promise<void> {
  console.log('\n📋  Importing Detaigoiy tab (SuggestedTopics)...');
  const rows = await readRows(sourceId, 'Detaigoiy');
  console.log(`    Found ${rows.length} rows in source`);

  if (rows.length === 0) {
    console.log('    ⏭  No data to import');
    return;
  }

  const N = now();
  const outputRows: RowValues[] = rows.map((r) => {
    const email    = str(r[0]).toLowerCase();
    const tendetai = str(r[1]);
    const dot      = str(r[2]);

    const id              = str(r[3]) || randomUUID();
    const lecturerUserId  = str(r[4]) || (email ? getUserId(email) : '');
    const createdAt       = str(r[5]) || N;

    return [email, tendetai, dot, id, lecturerUserId, createdAt];
  });

  await clearRows(targetId, 'Detaigoiy');
  await appendRows(targetId, 'Detaigoiy', outputRows);
  console.log(`    ✅  Wrote ${outputRows.length} rows → Detaigoiy`);
}

/**
 * Import Quota and Major tabs (read-only reference — just copy teacher data as-is)
 */
async function importReadOnlyTabs(sourceId: string, targetId: string): Promise<void> {
  const tabs = [
    { name: 'Quota', cols: ['Email', 'Major', 'HeDaoTao', 'Quota'] },
    { name: 'Major', cols: ['Email', 'Major', 'Field'] },
  ];

  for (const tab of tabs) {
    console.log(`\n📋  Importing read-only tab: ${tab.name}...`);
    const rows = await readRows(sourceId, tab.name);
    console.log(`    Found ${rows.length} rows in source`);

    if (rows.length === 0) continue;

    const outputRows: RowValues[] = rows.map((r) => r.map(v => str(v)));
    await clearRows(targetId, tab.name);
    await appendRows(targetId, tab.name, outputRows);
    console.log(`    ✅  Wrote ${outputRows.length} rows → ${tab.name}`);
  }
}

/** Print email→UUID registry summary */
function printRegistry(): void {
  console.log('\n📊  User UUID Registry:');
  let i = 0;
  for (const [email, id] of emailToUserId.entries()) {
    const name = emailToName.get(email) ?? '';
    const role = emailToRole.get(email) ?? '';
    const ms   = emailToMs.get(email) ?? '';
    console.log(`  [${String(++i).padStart(2)}] ${role.padEnd(4)} ${ms.padEnd(8)} ${name.padEnd(25)} ${email.padEnd(40)} → ${id}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sourceId = TEACHER_SHEET_ID || APP_SHEET_ID;
  const targetId = APP_SHEET_ID;

  console.log('\n🚀  KLTN Import Script — Phase 0C');
  console.log(`  Source spreadsheet: ${sourceId}`);
  console.log(`  Target spreadsheet: ${targetId}`);
  console.log(`  ${sourceId === targetId ? '(Re-populating app columns in same sheet)' : '(Cross-sheet migration)'}\n`);

  // Step 1: Data (Users) — must be first to populate emailToUserId registry
  await importDataTab(sourceId, targetId);

  // Step 2: Dot (Periods)
  await importDotTab(sourceId, targetId);

  // Step 3: Trangthaidetai (Assignments)
  await importTrangthaidetaiTab(sourceId, targetId);

  // Step 4: Điểm (Scores)
  await importDiemTab(sourceId, targetId);

  // Step 5: TenDetai (Submissions)
  await importTenDetaiTab(sourceId, targetId);

  // Step 6: Bienban (ExportFiles)
  await importBienbanTab(sourceId, targetId);

  // Step 7: BB/HĐồng rubric criteria
  await importBBTabs(sourceId, targetId);

  // Step 8: Detaigoiy
  await importDetaigoiyTab(sourceId, targetId);

  // Step 9: Read-only reference tabs
  await importReadOnlyTabs(sourceId, targetId);

  // Summary
  printRegistry();

  console.log('\n✅  Import complete!\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run seed:sheets:validate  → verify row counts');
  console.log('  2. Manually link Topics IDs in Trangthaidetai/TenDetai/Điểm if needed');
  console.log('  3. Check Bienban — driveLink populated from teacher Bienban column\n');
}

main().catch((err) => {
  console.error('❌  Import failed:', err);
  process.exit(1);
});
