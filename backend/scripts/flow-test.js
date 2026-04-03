#!/usr/bin/env node
/**
 * flow-test.js — Full end-to-end multi-role flow test (no browser).
 * Simulates real user actions in sequence, exactly as each role would do.
 *
 * Usage:
 *   node scripts/flow-test.js                       # student flow only
 *   node scripts/flow-test.js --flow student         # student only
 *   node scripts/flow-test.js --flow gvhd            # GVHD only
 *   node scripts/flow-test.js --flow tbm             # TBM only
 *   node scripts/flow-test.js --flow council         # Council only
 *   node scripts/flow-test.js --flow all             # ALL roles sequentially
 *
 * State machine:
 *   DRAFT → PENDING_GV → CONFIRMED → IN_PROGRESS → GRADING → COMPLETED (BCTT)
 *   DRAFT → PENDING_GV → CONFIRMED → IN_PROGRESS → PENDING_CONFIRM → DEFENSE → SCORING → COMPLETED (KLTN)
 *
 * Actions: SUBMIT_TO_GV, APPROVE, REJECT, START_PROGRESS, MOVE_TO_GRADING,
 *          REQUEST_CONFIRM, CONFIRM_DEFENSE, START_SCORING, COMPLETE, CANCEL
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { google } = require('googleapis');
const { sign } = require('jsonwebtoken');
const http = require('http');

const BASE = 'http://localhost:3001/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_TTL = Number(process.env.JWT_ACCESS_TTL || '3600'); // 1h for tests

const KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const gAuth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, undefined, KEY,
  ['https://www.googleapis.com/auth/spreadsheets.readonly'],
);
const sheets = google.sheets({ version: 'v4', auth: gAuth });
const SID = process.env.GOOGLE_SPREADSHEET_ID;

// ─── Known users ───────────────────────────────────────────────────────────────
const USERS = {
  student1:   'haitrann218@gmail.com',
  student2:   'nguyen.van.an@student.hcmute.edu.vn',
  student3:   'tran.thi.bich@student.hcmute.edu.vn',
  gvhd1:      'phan.van.duc@hcmute.edu.vn',     // u-gv-001, GVHD
  gvhd2:      'hoang.van.phu@hcmute.edu.vn',     // u-gv-003
  gvpb:       'nguyen.thi.em@hcmute.edu.vn',     // u-gv-002
  gv4:        'vo.thi.giang@hcmute.edu.vn',      // u-gv-004
  tbm:        'tbm.cnpm@hcmute.edu.vn',          // u-tbm-001
};

// ─── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flow = args[args.indexOf('--flow') + 1] || 'student';

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
function request(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const url = new URL(BASE + urlPath);
    const r = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method, headers },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
          catch { resolve({ status: res.statusCode, body: { raw: b } }); }
        });
      },
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const GET = (p, tok) => request('GET', p, tok);
const POST = (p, tok, body) => request('POST', p, tok, body);
const PATCH = (p, tok, body) => request('PATCH', p, tok, body);

// ─── Token mint ────────────────────────────────────────────────────────────────
const ROLE_MAP = { SV: 'STUDENT', GV: 'LECTURER', TBM: 'TBM', STUDENT: 'STUDENT', LECTURER: 'LECTURER' };
let _cachedRows = null;

async function _loadUsers() {
  if (_cachedRows) return _cachedRows;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SID, range: 'Data!A1:P100', valueRenderOption: 'UNFORMATTED_VALUE',
  });
  _cachedRows = (res.data.values || []).slice(1);
  return _cachedRows;
}

async function mintToken(email) {
  const rows = await _loadUsers();
  const row = rows.find((r) => (r[0] || '').toString().toLowerCase() === email.toLowerCase());
  if (!row) {
    const list = rows.filter((r) => r[0]).map((r) => `    ${r[0]}  (${r[3]})`).join('\n');
    throw new Error(`User not found: ${email}\nAvailable:\n${list}`);
  }
  const id = String(row[6] || '').trim();
  const role = ROLE_MAP[String(row[3] || '').toUpperCase()] || 'STUDENT';
  if (!id) throw new Error(`User ${email} has no ID in sheet`);
  return {
    token: sign({ sub: id, email: email.toLowerCase(), role }, JWT_SECRET, { expiresIn: JWT_TTL }),
    id, role, name: String(row[2] || email), email,
  };
}

// ─── Logging ──────────────────────────────────────────────────────────────────
let stepNum = 0;
let passCount = 0;
let failCount = 0;

function resetSteps() { stepNum = 0; }
function step(title) { stepNum++; console.log(`\n[Step ${stepNum}] ${title}`); }
function ok(msg, detail = '') { passCount++; console.log(`  ✅ ${msg}${detail ? '  →  ' + detail : ''}`); }
function fail(msg, detail = '') { failCount++; console.log(`  ❌ ${msg}${detail ? '  →  ' + detail : ''}`); }
function info(msg) { console.log(`     ℹ️  ${msg}`); }
function warn(msg) { console.log(`     ⚠️  ${msg}`); }

function assert(label, cond, detail = '') {
  if (cond) ok(label, detail); else fail(label, detail);
  return cond;
}

function expectStatus(label, res, expected) {
  const s = res.status === expected;
  if (s) ok(label, `HTTP ${res.status}`);
  else fail(label, `Expected ${expected}, got ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return s;
}

function expectOneOf(label, res, expectedStatuses) {
  const s = expectedStatuses.includes(res.status);
  if (s) ok(label, `HTTP ${res.status}`);
  else fail(label, `Expected one of [${expectedStatuses}], got ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return s;
}

function banner(icon, title, email) {
  console.log('\n' + '═'.repeat(65));
  console.log(`  ${icon} ${title} — ${email}`);
  console.log('═'.repeat(65));
  resetSteps();
}

function footer(title) {
  console.log('\n' + '─'.repeat(40));
  console.log(`  ${title} complete!`);
  console.log('─'.repeat(40));
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT FLOW
// ═══════════════════════════════════════════════════════════════════════════════
async function runStudentFlow(email) {
  banner('🎓', 'STUDENT FLOW', email);

  step('Health check + login');
  const health = await GET('/health');
  if (!expectStatus('Health', health, 200)) return {};
  const user = await mintToken(email);
  ok(`Token: ${user.name}`, `role=${user.role} id=${user.id}`);
  const T = user.token;

  step('Xem thông tin sinh viên (/users/me)');
  const me = await GET('/users/me', T);
  if (expectStatus('GET /users/me', me, 200)) {
    const d = me.body.data;
    info(`${d.fullName} | ${d.email} | MSSV=${d.studentId}`);
    info(`Tín chỉ: ${d.earnedCredits}/${d.requiredCredits} | KL: canRegister=${d.canRegisterKltn} (${d.kltnEligibilityReason})`);
    assert('earnedCredits exists', typeof d.earnedCredits === 'number');
  }

  step('Xem danh sách đề tài');
  const myTopics = await GET('/topics?role=student&page=1&size=50', T);
  expectStatus('GET /topics?role=student', myTopics, 200);
  const existing = myTopics.body?.data || [];
  info(`Đề tài hiện có: ${existing.length}`);
  existing.forEach((t) => info(`  [${t.type}] ${t.id} "${t.title}" [${t.state}]`));
  const activeTopic = existing.find((t) => !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(t.state));

  step('Load trang đăng ký (periods + supervisors)');
  const [periods, supervisors] = await Promise.all([
    GET('/periods?page=1&size=100', T),
    GET('/users/supervisors/options', T),
  ]);
  expectStatus('GET /periods', periods, 200);
  expectStatus('GET /users/supervisors/options', supervisors, 200);
  const openPeriods = (periods.body?.data || []).filter((p) => p.status === 'OPEN');
  const svList = supervisors.body?.data || [];
  info(`OPEN periods: ${openPeriods.length} | Supervisors: ${svList.length}`);

  step('Gợi ý đề tài (type "AI" → autocomplete)');
  const sugg = await GET('/topics/suggestions?q=AI', T);
  if (expectStatus('GET /topics/suggestions?q=AI', sugg, 200)) {
    const items = sugg.body?.data || [];
    info(`${items.length} gợi ý`);
    items.forEach((s) => info(`  "${s.title}" — GV: ${s.supervisorEmail}`));
    assert('Có gợi ý', items.length >= 1);
  }

  // Đăng ký hoặc dùng topic hiện có
  let topicId = activeTopic?.id;
  let topicState = activeTopic?.state;

  if (!activeTopic) {
    step('Đăng ký đề tài BCTT (POST /topics)');
    const bcttPeriod = openPeriods.find((p) => p.type === 'BCTT');
    const avSv = svList.find((s) => (s.totalQuota - s.quotaUsed) > 0);
    if (!bcttPeriod || !avSv) {
      warn(`Ko đủ DK: period=${!!bcttPeriod} supervisor=${!!avSv}`);
    } else {
      const reg = await POST('/topics', T, {
        title: 'Ứng dụng AI trong quản lý sinh viên thực tập',
        domain: 'CNPM', type: 'BCTT',
        periodId: bcttPeriod.id, supervisorUserId: avSv.id,
      });
      if (expectStatus('POST /topics (register)', reg, 201)) {
        topicId = reg.body?.data?.id;
        topicState = reg.body?.data?.state;
        ok(`Topic created: ${topicId} [${topicState}]`);
      }
    }
  } else {
    step('Đã có topic active — skip đăng ký');
    info(`${activeTopic.id} "${activeTopic.title}" [${activeTopic.state}]`);
  }

  if (!topicId) { warn('Không có topic — dừng'); return {}; }

  step(`Xem chi tiết topic ${topicId}`);
  const detail = await GET(`/topics/${topicId}`, T);
  if (expectStatus('GET /topics/:id', detail, 200)) {
    const d = detail.body?.data;
    info(`Title: ${d.title} | Type: ${d.type} | State: ${d.state}`);
    info(`Submit: ${d.submitStartAt || 'N/A'} → ${d.submitEndAt || 'N/A'}`);
    topicState = d.state;
  }

  if (topicState === 'DRAFT' || topicState === 'PENDING_GV') {
    step(`Edit title (PATCH /topics/${topicId})`);
    const edit = await PATCH(`/topics/${topicId}`, T, { title: 'Ứng dụng AI - quản lý SVTT (v2)' });
    expectStatus('PATCH title', edit, 200);
  }

  step('Xem lịch sử nộp bài');
  const subs = await GET(`/topics/${topicId}/submissions`, T);
  if (expectStatus('GET submissions', subs, 200)) {
    const items = subs.body?.data || [];
    info(`${items.length} submissions`);
    if (items.length > 0) {
      const latest = items[0];
      info(`Latest: [${latest.fileType}] v${latest.versionNumber} isLocked=${latest.isLocked} canReplace=${latest.canReplace}`);
      assert('isLocked field', 'isLocked' in latest);
      assert('canReplace field', 'canReplace' in latest);
      assert('versionLabel', !!latest.versionLabel);
    }
  }

  step('Xem thông báo');
  const notifs = await GET('/notifications?page=1&size=20', T);
  if (expectStatus('GET notifications', notifs, 200)) {
    info(`${(notifs.body?.data || []).length} thông báo`);
  }

  step('Xem điểm');
  const scores = await GET(`/topics/${topicId}/scores/summary`, T);
  if ([200, 403, 404, 409, 422].includes(scores.status)) {
    ok('Scores endpoint reachable', `HTTP ${scores.status} (${scores.status === 403 ? 'chưa publish' : scores.status === 200 ? 'có điểm' : 'chưa có'})`);
  } else {
    fail('Scores', `HTTP ${scores.status}`);
  }

  footer('Student flow');
  return { topicId, topicState, supervisorUserId: detail.body?.data?.supervisorUserId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GVHD FLOW
// ═══════════════════════════════════════════════════════════════════════════════
async function runGvhdFlow(email, topicIdFromStudent) {
  banner('👨‍🏫', 'GVHD FLOW', email);

  step('Login');
  const user = await mintToken(email);
  ok(`Token: ${user.name}`, `role=${user.role}`);
  const T = user.token;

  step('Xem profile');
  const me = await GET('/users/me', T);
  expectStatus('GET /users/me', me, 200);
  if (me.status === 200) info(`${me.body.data.fullName} [${me.body.data.accountRole}]`);

  step('Xem đề tài đang hướng dẫn (GET /topics?role=gvhd)');
  const topics = await GET('/topics?role=gvhd&page=1&size=50', T);
  expectStatus('GET /topics?role=gvhd', topics, 200);
  const items = topics.body?.data || [];
  info(`Đề tài đang HD: ${items.length}`);
  items.forEach((t) => info(`  [${t.type}] ${t.id} "${t.title}" [${t.state}]`));

  // Tìm pending
  const pendingTopic = items.find((t) => t.state === 'PENDING_GV');

  if (pendingTopic) {
    step(`Duyệt đề tài ${pendingTopic.id} (POST /topics/:id/approve)`);
    const approveRes = await POST(`/topics/${pendingTopic.id}/approve`, T, { note: 'Đề tài phù hợp, đồng ý hướng dẫn' });
    expectOneOf('POST /topics/:id/approve', approveRes, [200, 409]);
    if (approveRes.status === 200) {
      info(`State sau approve: ${approveRes.body?.data?.state}`);
    }
  } else if (topicIdFromStudent) {
    step(`Duyệt đề tài từ student flow: ${topicIdFromStudent}`);
    const approveRes = await POST(`/topics/${topicIdFromStudent}/approve`, T, { note: 'OK' });
    expectOneOf('POST /topics/:id/approve', approveRes, [200, 403, 409]);
    if (approveRes.status === 200) info(`State: ${approveRes.body?.data?.state}`);
    else info(`Có thể không phải GVHD của topic này — ${approveRes.status}`);
  } else {
    step('Không có topic PENDING_GV để duyệt');
    info('Skip approve step');
  }

  // Xem topic CONFIRMED → chuyển START_PROGRESS
  const confirmedTopic = items.find((t) => t.state === 'CONFIRMED');
  if (confirmedTopic) {
    step(`Chuyển IN_PROGRESS (POST /topics/${confirmedTopic.id}/transition action=START_PROGRESS)`);
    const sp = await POST(`/topics/${confirmedTopic.id}/transition`, T, { action: 'START_PROGRESS' });
    expectOneOf('START_PROGRESS', sp, [200, 409, 403]);
    if (sp.status === 200) info(`State: ${sp.body?.data?.state}`);
  }

  // Set deadline
  const ipTopic = items.find((t) => t.state === 'IN_PROGRESS') || (confirmedTopic && confirmedTopic);
  if (ipTopic) {
    step(`Set deadline cho ${ipTopic.id}`);
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const dl = await POST(`/topics/${ipTopic.id}/deadline`, T, {
      submitStartAt: new Date().toISOString(),
      submitEndAt: future,
    });
    expectOneOf('POST /topics/:id/deadline', dl, [200, 409, 400, 403]);
    if (dl.status === 200) info(`Deadline set: submitEndAt=${dl.body?.data?.submitEndAt}`);
  }

  // Xem submissions
  const anyTopic = items[0];
  if (anyTopic) {
    step(`Xem submissions cho ${anyTopic.id}`);
    const subs = await GET(`/topics/${anyTopic.id}/submissions`, T);
    expectStatus('GET submissions (GVHD view)', subs, 200);
    info(`${(subs.body?.data || []).length} submissions`);

    step(`Xem assignments cho ${anyTopic.id}`);
    const asgn = await GET(`/topics/${anyTopic.id}/assignments`, T);
    expectStatus('GET assignments (GVHD view)', asgn, 200);
    const assignments = asgn.body?.data || [];
    info(`${assignments.length} assignments`);
    assignments.forEach((a) => info(`  ${a.topicRole} → userId=${a.userId}`));
  }

  // ─── Chấm điểm GVHD (nếu topic ở GRADING/IN_PROGRESS) ───────────────────
  const gradableTopic = items.find((t) => ['GRADING', 'IN_PROGRESS', 'SCORING'].includes(t.state));
  if (gradableTopic) {
    step(`Chấm điểm GVHD cho topic ${gradableTopic.id}`);
    const draftRes = await POST(`/topics/${gradableTopic.id}/scores/draft`, T, {
      scorerRole: 'GVHD',
      rubricData: [
        { criterion: 'Nội dung', score: 7, max: 10 },
        { criterion: 'Hình thức', score: 8, max: 10 },
      ],
    });
    expectOneOf('POST scores/draft (GVHD)', draftRes, [200, 409, 403]);
    if (draftRes.status === 200) {
      info(`Draft score: id=${draftRes.body?.data?.scoreId} total=${draftRes.body?.data?.totalScore}`);

      step(`Submit điểm GVHD`);
      const submitRes = await POST(`/scores/${draftRes.body.data.scoreId}/submit`, T, { confirm: true });
      expectOneOf('POST scores/submit', submitRes, [200, 409]);
    }
  }

  footer('GVHD flow');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TBM FLOW
// ═══════════════════════════════════════════════════════════════════════════════
async function runTbmFlow(email) {
  banner('🏛️', 'TBM FLOW', email);

  step('Login');
  const user = await mintToken(email);
  ok(`Token: ${user.name}`, `role=${user.role}`);
  const T = user.token;

  step('Xem tất cả đề tài (GET /topics?role=tbm)');
  const allTopics = await GET('/topics?page=1&size=100', T);
  expectStatus('GET /topics (TBM view all)', allTopics, 200);
  const items = allTopics.body?.data || [];
  info(`Tổng đề tài: ${items.length}`);
  const byState = {};
  items.forEach((t) => { byState[t.state] = (byState[t.state] || 0) + 1; });
  Object.entries(byState).forEach(([s, c]) => info(`  ${s}: ${c}`));

  // Phân công GVPB cho topics CONFIRMED/IN_PROGRESS
  const assignable = items.find((t) => ['CONFIRMED', 'IN_PROGRESS', 'GRADING'].includes(t.state));
  if (assignable) {
    step(`Phân công GVPB cho topic ${assignable.id}`);
    const assignRes = await POST(`/topics/${assignable.id}/assignments/gvpb`, T, {
      userId: 'u-gv-002', // nguyen.thi.em — GVPB
    });
    expectOneOf('POST assignments/gvpb', assignRes, [201, 200, 409, 400, 403]);
    if ([200, 201].includes(assignRes.status)) {
      info(`GVPB assigned: ${JSON.stringify(assignRes.body?.data)}`);
    } else {
      info(`GVPB assign result: HTTP ${assignRes.status} — ${JSON.stringify(assignRes.body).slice(0, 100)}`);
    }

    step(`Phân công HĐ bảo vệ cho topic ${assignable.id}`);
    const councilRes = await POST(`/topics/${assignable.id}/assignments/council`, T, {
      chairUserId: 'u-gv-001',      // CT_HD (Phan Văn Đức)
      secretaryUserId: 'u-gv-004',  // TK_HD (Võ Thị Giang)
      memberUserIds: ['u-gv-003', 'u-gv-002', 'u-gv-001'], // TV_HD — min 3
    });
    expectOneOf('POST assignments/council', councilRes, [201, 200, 409, 400, 403]);
    if ([200, 201].includes(councilRes.status)) {
      info(`Council assigned`);
    } else {
      info(`Council assign: HTTP ${councilRes.status}`);
    }

    step(`Xem tất cả assignments cho topic ${assignable.id}`);
    const assignments = await GET(`/topics/${assignable.id}/assignments`, T);
    expectStatus('GET assignments (TBM)', assignments, 200);
    (assignments.body?.data || []).forEach((a) => info(`  ${a.topicRole} → ${a.userId}`));
  }

  // Chuyển state cho topic nếu cần
  const ipTopic = items.find((t) => t.state === 'IN_PROGRESS' && t.type === 'BCTT');
  if (ipTopic) {
    step(`Chuyển BCTT → GRADING (${ipTopic.id})`);
    const tr = await POST(`/topics/${ipTopic.id}/transition`, T, { action: 'MOVE_TO_GRADING' });
    expectOneOf('MOVE_TO_GRADING', tr, [200, 409, 400, 403]);
  }

  // Mở revision round
  if (assignable) {
    step(`Mở revision round cho topic ${assignable.id}`);
    const round = await POST(`/topics/${assignable.id}/revisions/rounds`, T, {
      deadline: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      note: 'Chỉnh sửa theo yêu cầu của GVHD',
    });
    expectOneOf('POST revisions/rounds', round, [201, 200, 409, 400, 403]);
    if ([200, 201].includes(round.status)) {
      info(`Round created: ${JSON.stringify(round.body?.data)}`);
    }

    step(`Xem revision rounds cho topic ${assignable.id}`);
    const rounds = await GET(`/topics/${assignable.id}/revisions/rounds`, T);
    expectStatus('GET revisions/rounds', rounds, 200);
    (rounds.body?.data || []).forEach((rr) => info(`  Round ${rr.roundNumber}: status=${rr.status} deadline=${rr.deadline}`));
  }

  // Xem scores
  const gradedTopic = items.find((t) => ['GRADING', 'SCORING', 'COMPLETED'].includes(t.state));
  if (gradedTopic) {
    step(`Xem score summary cho topic ${gradedTopic.id}`);
    const sum = await GET(`/topics/${gradedTopic.id}/scores/summary`, T);
    expectOneOf('GET scores/summary (TBM)', sum, [200, 409, 404, 403]);
    if (sum.status === 200) {
      const d = sum.body?.data;
      info(`Final: ${d.finalScore} | Result: ${d.result} | Published: ${d.published}`);
    }
  }

  footer('TBM flow');
}

// ═══════════════════════════════════════════════════════════════════════════════
// GVPB FLOW
// ═══════════════════════════════════════════════════════════════════════════════
async function runGvpbFlow(email) {
  banner('📝', 'GVPB FLOW', email);

  step('Login');
  const user = await mintToken(email);
  ok(`Token: ${user.name}`, `role=${user.role}`);
  const T = user.token;

  step('Xem đề tài phản biện (GET /topics?role=gvpb)');
  const topics = await GET('/topics?role=gvpb&page=1&size=50', T);
  expectStatus('GET /topics?role=gvpb', topics, 200);
  const items = topics.body?.data || [];
  info(`Đề tài phản biện: ${items.length}`);
  items.forEach((t) => info(`  [${t.type}] ${t.id} "${t.title}" [${t.state}]`));

  const scorable = items.find((t) => ['GRADING', 'SCORING', 'IN_PROGRESS'].includes(t.state));
  if (scorable) {
    step(`Xem submissions của topic ${scorable.id}`);
    const subs = await GET(`/topics/${scorable.id}/submissions`, T);
    expectStatus('GET submissions (GVPB view)', subs, 200);

    step(`Chấm điểm GVPB cho topic ${scorable.id}`);
    const draft = await POST(`/topics/${scorable.id}/scores/draft`, T, {
      scorerRole: 'GVPB',
      rubricData: [
        { criterion: 'Phương pháp', score: 6.5, max: 10 },
        { criterion: 'Trình bày', score: 7, max: 10 },
      ],
    });
    expectOneOf('POST scores/draft (GVPB)', draft, [200, 409, 403]);
    if (draft.status === 200) {
      info(`Draft: id=${draft.body?.data?.scoreId} total=${draft.body?.data?.totalScore}`);
      const submit = await POST(`/scores/${draft.body.data.scoreId}/submit`, T, { confirm: true });
      expectOneOf('Submit GVPB score', submit, [200, 409]);
    }
  }

  footer('GVPB flow');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNCIL (TV_HD / CT_HD) FLOW
// ═══════════════════════════════════════════════════════════════════════════════
async function runCouncilFlow(memberEmail, role) {
  banner('⚖️', `COUNCIL (${role}) FLOW`, memberEmail);

  step('Login');
  const user = await mintToken(memberEmail);
  ok(`Token: ${user.name}`, `role=${user.role}`);
  const T = user.token;

  step('Xem đề tài hội đồng');
  const topics = await GET(`/topics?role=${role.toLowerCase()}&page=1&size=50`, T);
  // Có thể chưa có filter role cho TV_HD — fallback get all
  if (topics.status !== 200) {
    const fallback = await GET('/topics?page=1&size=50', T);
    expectStatus('GET /topics (fallback)', fallback, 200);
    const items = fallback.body?.data || [];
    info(`${items.length} topics (fallback, no role filter)`);
  } else {
    const items = topics.body?.data || [];
    info(`${items.length} topics assigned as ${role}`);
    items.forEach((t) => info(`  [${t.type}] ${t.id} "${t.title}" [${t.state}]`));

    const scorable = items.find((t) => ['SCORING', 'DEFENSE', 'GRADING'].includes(t.state));
    if (scorable && role === 'TV_HD') {
      step(`Chấm điểm TV_HD cho topic ${scorable.id}`);
      const draft = await POST(`/topics/${scorable.id}/scores/draft`, T, {
        scorerRole: 'TV_HD',
        rubricData: [
          { criterion: 'Nội dung KL', score: 7, max: 10 },
          { criterion: 'Bảo vệ', score: 8, max: 10 },
        ],
      });
      expectOneOf('POST scores/draft (TV_HD)', draft, [200, 409, 403]);
      if (draft.status === 200 && draft.body?.data?.scoreId) {
        const submit = await POST(`/scores/${draft.body.data.scoreId}/submit`, T, { confirm: true });
        expectOneOf('Submit TV_HD score', submit, [200, 409]);
      }
    }

    if (scorable && role === 'CT_HD') {
      step(`CT_HD confirm score cho topic ${scorable.id}`);
      const confirm = await POST(`/topics/${scorable.id}/scores/confirm`, T, { role: 'CT_HD' });
      expectOneOf('POST scores/confirm (CT_HD)', confirm, [200, 409, 403]);
    }
  }

  footer(`Council ${role} flow`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY & MAIN
// ═══════════════════════════════════════════════════════════════════════════════
function printSummary() {
  console.log('\n' + '═'.repeat(65));
  console.log(`  📊 KẾT QUẢ TỔNG QUAN`);
  console.log('═'.repeat(65));
  console.log(`  ✅ PASSED : ${passCount}`);
  console.log(`  ❌ FAILED : ${failCount}`);
  console.log(`  Total    : ${passCount + failCount}`);
  console.log('═'.repeat(65) + '\n');
}

async function main() {
  console.log('\n🔬 KLTN Flow Test — giả lập thao tác người dùng qua API');
  console.log(`   Flow: ${flow} | Time: ${new Date().toLocaleString('vi-VN')}`);

  try {
    const h = await GET('/health');
    if (h.status !== 200) throw new Error('not 200');
    console.log(`   Backend: ✅ running at ${BASE}`);
  } catch {
    console.error(`\n❌ Backend không chạy tại ${BASE}.`);
    process.exit(1);
  }

  let studentCtx = {};

  if (flow === 'student' || flow === 'all') {
    studentCtx = await runStudentFlow(USERS.student1);
  }

  if (flow === 'gvhd' || flow === 'all') {
    await runGvhdFlow(USERS.gvhd1, studentCtx.topicId).catch((e) => warn(`GVHD: ${e.message}`));
  }

  if (flow === 'gvpb' || flow === 'all') {
    await runGvpbFlow(USERS.gvpb).catch((e) => warn(`GVPB: ${e.message}`));
  }

  if (flow === 'tbm' || flow === 'all') {
    await runTbmFlow(USERS.tbm).catch((e) => warn(`TBM: ${e.message}`));
  }

  if (flow === 'council' || flow === 'all') {
    await runCouncilFlow(USERS.gvhd2, 'TV_HD').catch((e) => warn(`TV_HD: ${e.message}`));
    await runCouncilFlow(USERS.gvhd1, 'CT_HD').catch((e) => warn(`CT_HD: ${e.message}`));
  }

  printSummary();
  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error('\n💥 Fatal:', e.message);
  process.exit(1);
});
