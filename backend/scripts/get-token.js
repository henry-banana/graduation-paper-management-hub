#!/usr/bin/env node
/**
 * get-token.js — Mint a real JWT access token for any user in the system sheet.
 * Usage: node scripts/get-token.js <email>
 * Example: node scripts/get-token.js haitrann218@gmail.com
 *
 * Uses the SAME JWT_SECRET as the backend, so the token is fully valid.
 * Only reads Google Sheets (read-only), never writes anything.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { google } = require('googleapis');
const { sign } = require('jsonwebtoken');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/get-token.js <email>');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET not found in .env');
  process.exit(1);
}

const JWT_ACCESS_TTL_SECONDS = Number(process.env.JWT_ACCESS_TTL || '900'); // default 15min

const KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  undefined,
  KEY,
  ['https://www.googleapis.com/auth/spreadsheets.readonly'],
);
const sheets = google.sheets({ version: 'v4', auth });
const SID = process.env.GOOGLE_SPREADSHEET_ID;

// Data tab column layout:
// [0]=Email [1]=MS [2]=Ten [3]=Role [4]=Major [5]=HeDaoTao
// [6]=id [7]=phone [8]=completedBcttScore [9]=totalQuota [10]=quotaUsed
// [11]=expertise [12]=isActive [13]=createdAt [14]=earnedCredits [15]=requiredCredits

const ROLE_MAP = {
  SV: 'STUDENT',
  GV: 'LECTURER',
  TBM: 'TBM',
  STUDENT: 'STUDENT',
  LECTURER: 'LECTURER',
};

async function main() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SID,
    range: 'Data!A1:P100',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  // skip header row
  const userRow = rows.slice(1).find(
    (r) => (r[0] || '').toString().toLowerCase().trim() === email.toLowerCase().trim(),
  );

  if (!userRow) {
    // list existing users for convenience
    const existing = rows.slice(1)
      .filter((r) => r[0])
      .map((r) => `  ${r[0]} (${r[3] || '?'})`)
      .join('\n');
    console.error(`❌  User not found: ${email}`);
    console.error('Available users:\n' + existing);
    process.exit(1);
  }

  const userId = (userRow[6] || '').toString().trim();
  const rawRole = (userRow[3] || 'STUDENT').toString().trim().toUpperCase();
  const role = ROLE_MAP[rawRole] || 'STUDENT';
  const name = (userRow[2] || email).toString().trim();

  if (!userId) {
    console.error(`❌  User "${email}" found but has no ID (col G is empty). Add an ID to the sheet first.`);
    process.exit(1);
  }

  const payload = {
    sub: userId,
    email: email.toLowerCase().trim(),
    role,
  };

  const token = sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_TTL_SECONDS });

  const expiresAt = new Date(Date.now() + JWT_ACCESS_TTL_SECONDS * 1000).toISOString();

  console.log('');
  console.log(`✅  Token minted for: ${name} <${email}>`);
  console.log(`   userId : ${userId}`);
  console.log(`   role   : ${role}`);
  console.log(`   expires: ${expiresAt}`);
  console.log('');
  console.log('ACCESS_TOKEN:');
  console.log(token);
  console.log('');
  // Also print as env-var for easy copy-paste into shell
  console.log(`# Copy-paste shortcut:`);
  console.log(`TOKEN="${token}"`);
  console.log('');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
