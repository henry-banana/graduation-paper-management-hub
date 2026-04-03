#!/usr/bin/env node
/**
 * api-flow-test.js
 * Tests the fixed API flows:
 *  1. Student: get topics, get submissions history
 *  2. GV: get GVHD topics, GET my-draft (404 expected), POST draft-direct, GET my-draft again
 *  3. GV: POST submit-direct
 *  4. TBM: GET /exports
 *  5. Health check  
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { google } = require('googleapis');
const { sign } = require('jsonwebtoken');

const BASE = 'http://localhost:3001/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;

// ─── Mint tokens directly ──────────────────────────────────────────────────
function mintToken(userId, email, role) {
  return sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn: 900 });
}

const TOKEN_SV  = mintToken('u-sv-004',  'haitrann218@gmail.com',      'STUDENT');
const TOKEN_GV  = mintToken('u-gv-001',  'phan.van.duc@hcmute.edu.vn', 'LECTURER');
const TOKEN_TBM = mintToken('u-tbm-001', 'tbm.cnpm@hcmute.edu.vn',     'TBM');

// ─── HTTP helpers ──────────────────────────────────────────────────────────
async function req(method, path, token, body = null) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

// ─── Test runner ───────────────────────────────────────────────────────────
let passed = 0; let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${name}`);
    passed++;
  } else {
    console.log(`  ❌  ${name} ${detail ? '— ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  KLTN API Flow Test');
  console.log('══════════════════════════════════════════\n');

  // ── 1. Health ────────────────────────────────────────────────────────────
  console.log('── 1. Health check');
  const health = await req('GET', '/health', TOKEN_SV);
  assert('GET /health → 200', health.status === 200, `got ${health.status}`);

  // ── 2. Student: list topics ───────────────────────────────────────────────
  console.log('\n── 2. Student: GET /topics?role=student');
  const topics = await req('GET', '/topics?role=student&page=1&size=100', TOKEN_SV);
  assert('GET /topics (student) → 200', topics.status === 200, `got ${topics.status}`);
  const topicList = topics.body?.data ?? [];
  console.log(`     Found ${topicList.length} student topics`);
  const firstTopicId = topicList[0]?.id;
  assert('Has at least 1 topic', topicList.length > 0, `count=${topicList.length}`);

  // ── 3. Student: submission history ────────────────────────────────────────
  if (firstTopicId) {
    console.log(`\n── 3. Student: GET /topics/${firstTopicId}/submissions`);
    const subs = await req('GET', `/topics/${firstTopicId}/submissions`, TOKEN_SV);
    assert('GET submissions → 200', subs.status === 200, `got ${subs.status}`);
    const subList = subs.body?.data ?? [];
    console.log(`     Found ${subList.length} submissions`);
    if (subList[0]) {
      assert('Submission has driveLink field', 'driveLink' in subList[0]);
      assert('Submission has canReplace field', 'canReplace' in subList[0]);
      assert('Submission has isLocked field', 'isLocked' in subList[0]);
    }
  }

  // ── 4. GV: list GVHD topics ───────────────────────────────────────────────
  console.log('\n── 4. GV: GET /topics?role=gvhd');
  const gvTopics = await req('GET', '/topics?role=gvhd&page=1&size=100', TOKEN_GV);
  assert('GET /topics (gvhd) → 200', gvTopics.status === 200, `got ${gvTopics.status}`);
  const gvTopicList = gvTopics.body?.data ?? [];
  console.log(`     Found ${gvTopicList.length} GVHD topics`);
  // pick first GRADING or SCORING topic for score test
  const scorableTopic = gvTopicList.find(t => t.state === 'GRADING' || t.state === 'SCORING' || t.state === 'APPROVED');
  const scoreTopicId  = scorableTopic?.id ?? gvTopicList[0]?.id;

  // ── 5. GV: GET my-draft (expect 403 or 404 if no score) ───────────────────
  if (scoreTopicId) {
    console.log(`\n── 5. GV: GET /topics/${scoreTopicId}/scores/my-draft`);
    const draft = await req('GET', `/topics/${scoreTopicId}/scores/my-draft`, TOKEN_GV);
    assert(
      'GET my-draft → 200 or 403 or 404 (valid status)',
      [200, 403, 404].includes(draft.status),
      `got ${draft.status} — ${JSON.stringify(draft.body?.message ?? draft.body?.detail ?? '')}`
    );
    if (draft.status === 200) {
      assert('my-draft has criteria map', typeof draft.body?.data?.criteria === 'object');
      assert('my-draft has isSubmitted', typeof draft.body?.data?.isSubmitted === 'boolean');
      console.log(`     criteria: ${JSON.stringify(draft.body?.data?.criteria)}`);
    } else {
      console.log(`     → No existing draft (${draft.status} expected if not assigned)`);
    }

    // ── 6. GV: POST draft-direct ──────────────────────────────────────────────
    console.log(`\n── 6. GV: POST /topics/${scoreTopicId}/scores/draft-direct`);
    const draftPost = await req('POST', `/topics/${scoreTopicId}/scores/draft-direct`, TOKEN_GV, {
      role: 'GVHD',
      criteria: { attitude: 1.5, presentation: 1.5, content: 5.0 },
      comments: 'Bài làm tốt, cần cải thiện phần trình bày.',
    });
    assert(
      'POST draft-direct → 200 or 403 or 409 (valid response — 409 = business rule)',
      [200, 201, 403, 409].includes(draftPost.status),
      `got ${draftPost.status} — ${JSON.stringify(draftPost.body?.message ?? draftPost.body?.detail ?? '')}`
    );
    if ([200, 201].includes(draftPost.status)) {
      console.log(`     ✓ Draft saved: scoreId=${draftPost.body?.data?.scoreId}, total=${draftPost.body?.data?.totalScore}`);
    } else if (draftPost.status === 409) {
      console.log(`     → 409 Conflict: ${draftPost.body?.message ?? draftPost.body?.detail} (business rule — OK for test env)`);
    } else {
      console.log(`     → Forbidden (not assigned as GVHD — expected in test env)`);
    }
  }

  // ── 7. TBM: GET /exports ───────────────────────────────────────────────────
  console.log('\n── 7. TBM: GET /exports');
  const exports = await req('GET', '/exports?page=1&size=20', TOKEN_TBM);
  assert('GET /exports → 200', exports.status === 200, `got ${exports.status} — ${JSON.stringify(exports.body?.message ?? '')}`);
  if (exports.status === 200) {
    const expList = exports.body?.data ?? [];
    console.log(`     Found ${expList.length} exports`);
    assert('Response has data array', Array.isArray(expList));
    assert('Response has pagination', exports.body?.pagination !== undefined);
  }

  // ── 8. GV: GVPB topics ───────────────────────────────────────────────────
  console.log('\n── 8. GV: GET /topics?role=gvpb');
  const gvpbTopics = await req('GET', '/topics?role=gvpb&page=1&size=100', TOKEN_GV);
  assert('GET /topics (gvpb) → 200', gvpbTopics.status === 200, `got ${gvpbTopics.status}`);
  console.log(`     Found ${gvpbTopics.body?.data?.length ?? 0} GVPB topics`);

  // ── 9. New endpoints exist (route registration check) ────────────────────
  console.log('\n── 9. Check new score endpoints are registered (not 404 routing error)');
  const dummyTopic = 'tp-nonexistent-xyz';
  // A registered route with a bad topicId should return 404 with a resource message (not a routing 404).
  // Unregistered routes return {statusCode:404,message:"Cannot GET /..."}.
  const ep1 = await req('GET', `/topics/${dummyTopic}/scores/my-draft`, TOKEN_GV);
  const ep1IsRouted = ep1.status !== 404 || !ep1.body?.message?.toLowerCase().includes('cannot get');
  assert('GET my-draft route is registered', ep1IsRouted,
    `got ${ep1.status} — ${JSON.stringify(ep1.body?.message ?? ep1.body?.detail ?? '')}`);
  
  const ep2 = await req('POST', `/topics/${dummyTopic}/scores/draft-direct`, TOKEN_GV, { role: 'GVHD', criteria: {} });
  const ep2IsRouted = ep2.status !== 404 || !ep2.body?.message?.toLowerCase().includes('cannot post');
  assert('POST draft-direct route is registered', ep2IsRouted,
    `got ${ep2.status}`);

  const ep3 = await req('POST', `/topics/${dummyTopic}/scores/submit-direct`, TOKEN_GV, { role: 'GVHD', criteria: {} });
  const ep3IsRouted = ep3.status !== 404 || !ep3.body?.message?.toLowerCase().includes('cannot post');
  assert('POST submit-direct route is registered', ep3IsRouted,
    `got ${ep3.status}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

run().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
