#!/usr/bin/env node
/**
 * test-api.js — End-to-end API test runner (no browser needed).
 *
 * Usage:
 *   node scripts/test-api.js [--user <email>] [--suite <suite>]
 *
 * Suites: student | suggestions | submissions | all
 * Default: all
 *
 * Pre-requisites: backend must be running on localhost:3001
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { google } = require('googleapis');
const { sign } = require('jsonwebtoken');
const http = require('http');

const BASE = 'http://localhost:3001/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || '900');

const KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  undefined,
  KEY,
  ['https://www.googleapis.com/auth/spreadsheets.readonly'],
);
const sheets = google.sheets({ version: 'v4', auth });
const SID = process.env.GOOGLE_SPREADSHEET_ID;

// ─── ARGS ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const userArg = args[args.indexOf('--user') + 1] || 'haitrann218@gmail.com';
const suite = args[args.indexOf('--suite') + 1] || 'all';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const ROLE_MAP = { SV: 'STUDENT', GV: 'LECTURER', TBM: 'TBM', STUDENT: 'STUDENT', LECTURER: 'LECTURER' };

async function getUserToken(email) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SID, range: 'Data!A1:P100', valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = (res.data.values || []).slice(1);
  const row = rows.find((r) => (r[0] || '').toString().toLowerCase() === email.toLowerCase());
  if (!row) throw new Error(`User not found in sheet: ${email}`);
  const userId = String(row[6] || '').trim();
  const role = ROLE_MAP[String(row[3] || '').toUpperCase()] || 'STUDENT';
  if (!userId) throw new Error(`User ${email} has no ID`);
  return {
    token: sign({ sub: userId, email: email.toLowerCase(), role }, JWT_SECRET, { expiresIn: JWT_ACCESS_TTL }),
    userId, role, name: String(row[2] || email),
  };
}

function req(path, method = 'GET', token = null, data = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const options = new URL(BASE + path);
    const r = http.request(
      { hostname: options.hostname, port: options.port, path: options.pathname + options.search, method, headers },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(b), raw: b }); }
          catch { resolve({ status: res.statusCode, body: null, raw: b }); }
        });
      },
    );
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

let pass = 0;
let fail = 0;

function check(label, status, body, expectedStatus = 200) {
  const ok = status === expectedStatus;
  const icon = ok ? '✅' : '❌';
  const detail = ok ? '' : ` → got ${status}, body: ${JSON.stringify(body).slice(0, 120)}`;
  console.log(`  ${icon} ${label}${detail}`);
  if (ok) pass++; else fail++;
  return ok;
}

// ─── SUITES ───────────────────────────────────────────────────────────────────

async function runSuggestionsTests(token) {
  console.log('\n📋 Suite: Topic Suggestions API');

  const r1 = await req('/topics/suggestions?q=AI', 'GET', token);
  check('GET /topics/suggestions?q=AI → 200', r1.status, r1.body, 200);
  if (r1.status === 200) {
    const items = r1.body?.data || [];
    console.log(`     → ${items.length} suggestions:`, items.map((s) => s.title).join(', '));
  }

  const r2 = await req('/topics/suggestions?q=A', 'GET', token);
  check('GET /topics/suggestions?q=A (too short) → 200 empty', r2.status, r2.body, 200);
  if (r2.status === 200) {
    const items = r2.body?.data || [];
    console.log(`     → ${items.length} items (should be 0)`);
  }

  const r3 = await req('/topics/suggestions?q=AI&supervisorEmail=thiennd@hcmute.edu.vn', 'GET', token);
  check('GET /topics/suggestions?q=AI&supervisorEmail=... → 200', r3.status, r3.body, 200);
  if (r3.status === 200) {
    const items = r3.body?.data || [];
    console.log(`     → ${items.length} suggestions for that supervisor:`, items.map((s) => s.title).join(', '));
  }
}

async function runStudentProfileTests(token) {
  console.log('\n👤 Suite: Student Profile & Credits');

  const r1 = await req('/users/me', 'GET', token);
  check('GET /users/me → 200', r1.status, r1.body, 200);
  if (r1.status === 200) {
    const d = r1.body?.data || {};
    console.log(`     → name=${d.fullName} role=${d.accountRole}`);
  }

  const r2 = await req('/users/profile', 'GET', token);
  check('GET /users/profile → 200', r2.status, r2.body, 200);
  if (r2.status === 200) {
    const d = r2.body?.data || {};
    console.log(`     → earnedCredits=${d.earnedCredits} requiredCredits=${d.requiredCredits} canRegisterKltn=${d.canRegisterKltn}`);
  }
}

async function runPeriodsTests(token) {
  console.log('\n📅 Suite: Periods');

  const r1 = await req('/periods?page=1&size=20', 'GET', token);
  check('GET /periods → 200', r1.status, r1.body, 200);
  if (r1.status === 200) {
    const items = r1.body?.data || [];
    console.log(`     → ${items.length} periods:`);
    items.forEach((p) => console.log(`        [${p.type}] ${p.code} | status=${p.status} | open=${p.openDate}→${p.closeDate}`));
  }
}

async function runTopicsTests(token) {
  console.log('\n📚 Suite: Student Topics');

  const r1 = await req('/topics?role=student&page=1&size=10', 'GET', token);
  check('GET /topics?role=student → 200', r1.status, r1.body, 200);
  if (r1.status === 200) {
    const items = r1.body?.data || [];
    console.log(`     → ${items.length} topics:`);
    items.forEach((t) => console.log(`        [${t.type}] ${t.id} "${t.title}" state=${t.state}`));
    return items;
  }
  return [];
}

async function runSubmissionsTests(token, topicId) {
  console.log(`\n📤 Suite: Submissions for topic ${topicId}`);

  const r1 = await req(`/topics/${topicId}/submissions`, 'GET', token);
  check(`GET /topics/${topicId}/submissions → 200`, r1.status, r1.body, 200);
  if (r1.status === 200) {
    const items = r1.body?.data || [];
    console.log(`     → ${items.length} submissions:`);
    items.forEach((s) => {
      console.log(`        [${s.fileType}] v${s.versionNumber} label=${s.versionLabel} isLocked=${s.isLocked} canReplace=${s.canReplace} status=${s.status}`);
    });
    if (items.length > 0) {
      const latest = items[0];
      console.log(`     → Latest: isLocked=${latest.isLocked}, canReplace=${latest.canReplace}`);
    }
  }
}

async function runSupervisorsTests(token) {
  console.log('\n👨‍🏫 Suite: Supervisors Options');

  const r1 = await req('/users/supervisors/options', 'GET', token);
  check('GET /users/supervisors/options → 200', r1.status, r1.body, 200);
  if (r1.status === 200) {
    const items = r1.body?.data || [];
    console.log(`     → ${items.length} supervisors:`);
    items.slice(0, 5).forEach((s) => console.log(`        ${s.fullName} quota=${s.quotaUsed}/${s.totalQuota}`));
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 KLTN API Test Runner`);
  console.log(`   User    : ${userArg}`);
  console.log(`   Suite   : ${suite}`);
  console.log(`   Backend : ${BASE}`);

  // Health check
  const health = await req('/health', 'GET');
  if (health.status !== 200) {
    console.error(`\n❌ Backend not reachable at ${BASE}`);
    process.exit(1);
  }
  console.log(`   Health  : ✅ OK`);

  // Mint token
  const user = await getUserToken(userArg);
  console.log(`   Token   : minted for ${user.name} [${user.role}]`);
  const { token } = user;

  // Run suites
  if (suite === 'all' || suite === 'suggestions') await runSuggestionsTests(token);
  if (suite === 'all' || suite === 'profile')    await runStudentProfileTests(token);
  if (suite === 'all' || suite === 'periods')    await runPeriodsTests(token);
  if (suite === 'all' || suite === 'topics') {
    const topics = await runTopicsTests(token);
    if (topics.length > 0) {
      await runSubmissionsTests(token, topics[0].id);
    }
  }
  if (suite === 'all' || suite === 'supervisors') await runSupervisorsTests(token);

  console.log(`\n─────────────────────────────────────`);
  console.log(`  PASSED: ${pass}  FAILED: ${fail}`);
  console.log(`─────────────────────────────────────\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
