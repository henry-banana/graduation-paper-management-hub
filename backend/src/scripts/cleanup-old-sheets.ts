/**
 * cleanup-old-sheets.ts
 * Xóa tất cả các tab KHÔNG thuộc schema v3.2 khỏi spreadsheet.
 * Chạy: npx ts-node --transpile-only src/scripts/cleanup-old-sheets.ts
 */
import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';
import { SHEET_NAMES } from '../infrastructure/google-sheets/sheets.constants';

const EMAIL   = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';
const RAW_KEY = process.env.GOOGLE_PRIVATE_KEY ?? '';
const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? '';

if (!EMAIL || !RAW_KEY || !SHEET_ID) {
  console.error('❌  Missing env: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SPREADSHEET_ID');
  process.exit(1);
}

const auth = new google.auth.JWT(EMAIL, undefined, RAW_KEY.replace(/\\n/g, '\n'), [
  'https://www.googleapis.com/auth/spreadsheets',
]);
const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth });

/** Tất cả tên tab hợp lệ theo schema v3.2 */
const VALID_TABS = new Set<string>(Object.values(SHEET_NAMES));

async function main() {
  console.log('\n🧹  Cleanup Old Sheets — Schema v3.2');
  console.log(`  Spreadsheet: ${SHEET_ID}\n`);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const allSheets = spreadsheet.data.sheets ?? [];

  const toDelete = allSheets.filter((s) => {
    const title = s.properties?.title ?? '';
    return !VALID_TABS.has(title);
  });

  if (toDelete.length === 0) {
    console.log('✅  Không có tab cũ nào cần xóa.\n');
    return;
  }

  // Google Sheets yêu cầu ít nhất 1 sheet còn lại — nếu chỉ còn 1 tab valid thì skip
  const validCount = allSheets.length - toDelete.length;
  if (validCount === 0) {
    console.error('❌  Không thể xóa tất cả tab — cần giữ ít nhất 1 tab.');
    process.exit(1);
  }

  console.log(`🗑️   Sẽ xóa ${toDelete.length} tab cũ:\n`);
  toDelete.forEach((s) => {
    const title = s.properties?.title ?? '';
    const sheetId = s.properties?.sheetId;
    console.log(`    - "${title}" (sheetId: ${sheetId})`);
  });

  console.log('\n  Đang xóa...');

  // Xóa từng tab (phải xóa tuần tự do API constraint)
  for (const s of toDelete) {
    const title = s.properties?.title ?? '';
    const sheetId = s.properties?.sheetId;
    if (sheetId === undefined) continue;

    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{ deleteSheet: { sheetId } }],
        },
      });
      console.log(`    ✅  Đã xóa: "${title}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ❌  Lỗi xóa "${title}": ${msg}`);
    }

    // Tránh rate limit
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n✅  Cleanup hoàn tất!\n');

  // In lại danh sách tab còn lại
  const after = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const remaining = (after.data.sheets ?? []).map((s) => s.properties?.title ?? '');
  console.log(`📋  ${remaining.length} tabs còn lại:`);
  remaining.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));
  console.log();
}

main().catch((err) => {
  console.error('❌  Cleanup failed:', err);
  process.exit(1);
});
