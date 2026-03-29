import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

type HttpMethod = 'GET' | 'POST' | 'PATCH';

type InvokeApiOptions = {
  name: string;
  method: HttpMethod;
  path: string;
  token?: string;
  body?: unknown;
  formData?: FormData;
  contentType?: string;
};

type SweepResult = {
  name: string;
  method: HttpMethod;
  path: string;
  status: number | null;
  ok: boolean;
  error: string;
  snippet: string;
};

type JsonObject = Record<string, unknown>;

type SweepOutput = {
  generatedAt: string;
  baseUrl: string;
  startedServer: boolean;
  summary: {
    total: number;
    ok: number;
    failed: number;
  };
  failedEndpoints: SweepResult[];
  results: SweepResult[];
};

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';
const HEALTH_URL = `${BASE_URL}/health`;
const TMP_DIR = '.tmp';
const RESULTS_JSON = join(TMP_DIR, 'full-curl-sweep.json');
const SERVER_OUT_LOG = join(TMP_DIR, 'curl-sweep-server.out.log');
const SERVER_ERR_LOG = join(TMP_DIR, 'curl-sweep-server.err.log');

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function newFakeIdToken(email: string, name: string): string {
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    email,
    name,
    sub: `sub_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`,
  };

  return `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}.sig`;
}

function isTransientConnectionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('econnrefused') ||
    normalized.includes('fetch failed') ||
    normalized.includes('unable to connect') ||
    normalized.includes('socket hang up') ||
    normalized.includes('timed out') ||
    normalized.includes('connection reset')
  );
}

async function waitApiReady(timeoutSeconds: number): Promise<boolean> {
  for (let i = 0; i < timeoutSeconds; i += 1) {
    try {
      const resp = await fetch(HEALTH_URL, { method: 'GET' });
      if (resp.status === 200) {
        return true;
      }
    } catch {
      // Wait and retry.
    }
    await sleep(1000);
  }
  return false;
}

async function removeIfExists(filePath: string): Promise<void> {
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // Ignore best-effort cleanup.
  }
}

async function startServerIfNeeded(cwd: string): Promise<{
  started: boolean;
  process: ChildProcess | null;
}> {
  if (await waitApiReady(2)) {
    return { started: false, process: null };
  }

  await fs.mkdir(join(cwd, TMP_DIR), { recursive: true });

  const outLog = join(cwd, SERVER_OUT_LOG);
  const errLog = join(cwd, SERVER_ERR_LOG);
  await removeIfExists(outLog);
  await removeIfExists(errLog);

  const child =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev'], {
          cwd,
          env: process.env,
          windowsHide: true,
          stdio: 'pipe',
        })
      : spawn('npm', ['run', 'dev'], {
          cwd,
          env: process.env,
          windowsHide: true,
          stdio: 'pipe',
        });

  await new Promise<void>((resolve, reject) => {
    child.once('spawn', () => resolve());
    child.once('error', (error) => reject(error));
  });

  const outStream = createWriteStream(outLog, { flags: 'a' });
  const errStream = createWriteStream(errLog, { flags: 'a' });

  child.stdout.pipe(outStream);
  child.stderr.pipe(errStream);

  const ready = await waitApiReady(90);
  if (!ready) {
    throw new Error('Backend did not become ready on /health within timeout');
  }

  return { started: true, process: child };
}

function stopServerIfStarted(
  child: ChildProcess | null,
  started: boolean,
): void {
  if (!started || !child || child.killed) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
    });
    return;
  }

  child.kill('SIGTERM');
}

async function parseJsonSafe<T>(raw: string): Promise<T | null> {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function getAccessToken(email: string, name: string): Promise<string> {
  const idToken = newFakeIdToken(email, name);
  const response = await fetch(`${BASE_URL}/auth/google/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to get token for ${email}: HTTP ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    data?: {
      accessToken?: string;
    };
  };

  const accessToken = payload.data?.accessToken;
  if (!accessToken) {
    throw new Error(`Token payload missing accessToken for ${email}`);
  }

  return accessToken;
}

async function invokeApi(
  options: InvokeApiOptions,
  results: SweepResult[],
): Promise<SweepResult> {
  const {
    name,
    method,
    path,
    token,
    body,
    formData,
    contentType = 'application/json',
  } = options;

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let status: number | null = null;
  let content = '';
  let errorMessage = '';

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    status = null;
    content = '';
    errorMessage = '';

    try {
      const requestHeaders: Record<string, string> = { ...headers };
      let requestBody: BodyInit | undefined;

      if (formData) {
        requestBody = formData;
      } else if (body !== undefined) {
        if (contentType === 'application/json') {
          requestHeaders['Content-Type'] = 'application/json';
          requestBody =
            typeof body === 'string' ? body : JSON.stringify(body as JsonObject);
        } else {
          requestHeaders['Content-Type'] = contentType;
          requestBody = body as BodyInit;
        }
      }

      const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: requestHeaders,
        body: requestBody,
      });

      status = response.status;
      content = await response.text();
      break;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      const transient = isTransientConnectionError(errorMessage);
      if (attempt < maxAttempts && transient) {
        await sleep(900 * attempt);
        continue;
      }
      break;
    }
  }

  const snippet = content.slice(0, 240);
  const ok = status !== null ? status >= 200 && status < 500 : false;

  const result: SweepResult = {
    name,
    method,
    path,
    status,
    ok,
    error: errorMessage,
    snippet,
  };

  results.push(result);
  await sleep(350);
  return result;
}

function printSummary(output: SweepOutput): void {
  const { total, ok, failed } = output.summary;
  // Keep console output concise but readable in terminal and CI logs.
  console.log('=== FULL CURL SWEEP SUMMARY ===');
  console.log(`Base URL: ${output.baseUrl}`);
  console.log(`Total: ${total} | OK: ${ok} | Failed: ${failed}`);
  console.log(`Result JSON: ${join(process.cwd(), RESULTS_JSON)}`);
  console.log('');

  const tableData = output.results.map((item) => ({
    method: item.method,
    path: item.path,
    status: item.status,
    ok: item.ok,
    error: item.error,
  }));

  console.log('=== ENDPOINT TABLE ===');
  console.table(tableData);

  if (failed > 0) {
    console.log('=== FAILED ENDPOINTS ===');
    for (const endpoint of output.failedEndpoints) {
      console.log(
        `${endpoint.method} ${endpoint.path} | status=${endpoint.status ?? 'N/A'} | error=${endpoint.error}`,
      );
    }
  }
}

async function run(): Promise<void> {
  const cwd = process.cwd();
  const results: SweepResult[] = [];

  await fs.mkdir(join(cwd, TMP_DIR), { recursive: true });

  let startedByScript = false;
  let serverProcess: ChildProcess | null = null;

  try {
    const server = await startServerIfNeeded(cwd);
    startedByScript = server.started;
    serverProcess = server.process;

    const studentToken = await getAccessToken('student1@hcmute.edu.vn', 'Student One');
    const lecturerToken = await getAccessToken('gvhd1@hcmute.edu.vn', 'Lecturer One');
    const tbmToken = await getAccessToken('tbm@hcmute.edu.vn', 'TBM One');

    let notifId = 'nt_001';
    const notificationsList = await invokeApi(
      {
        name: 'notifications.prefetch',
        method: 'GET',
        path: '/notifications?page=1&size=5',
        token: studentToken,
      },
      [],
    );
    if (notificationsList.status === 200 && notificationsList.snippet) {
      const parsed = await parseJsonSafe<{ data?: Array<{ id?: string }> }>(
        notificationsList.snippet,
      );
      if (parsed?.data?.[0]?.id) {
        notifId = parsed.data[0].id;
      }
    }

    let assignmentId = 'as_001';
    const assignmentList = await invokeApi(
      {
        name: 'assignments.prefetch',
        method: 'GET',
        path: '/topics/tp_001/assignments',
        token: tbmToken,
      },
      [],
    );
    if (assignmentList.status === 200 && assignmentList.snippet) {
      const parsed = await parseJsonSafe<{ data?: Array<{ id?: string }> }>(
        assignmentList.snippet,
      );
      if (parsed?.data?.[0]?.id) {
        assignmentId = parsed.data[0].id;
      }
    }

    let exportId = 'exp_001';
    const exportList = await invokeApi(
      {
        name: 'exports.prefetch',
        method: 'GET',
        path: '/exports?page=1&size=5',
        token: lecturerToken,
      },
      [],
    );
    if (exportList.status === 200 && exportList.snippet) {
      const parsed = await parseJsonSafe<{ data?: Array<{ id?: string }> }>(
        exportList.snippet,
      );
      if (parsed?.data?.[0]?.id) {
        exportId = parsed.data[0].id;
      }
    }

    await invokeApi({ name: 'health.get', method: 'GET', path: '/health' }, results);
    await invokeApi(
      { name: 'health.ready.get', method: 'GET', path: '/health/ready' },
      results,
    );
    await invokeApi(
      { name: 'health.live.get', method: 'GET', path: '/health/live' },
      results,
    );
    await invokeApi(
      { name: 'auth.health.get', method: 'GET', path: '/auth/health' },
      results,
    );
    await invokeApi(
      {
        name: 'auth.callback.post.student',
        method: 'POST',
        path: '/auth/google/callback',
        body: {
          idToken: newFakeIdToken('student1@hcmute.edu.vn', 'Student One'),
        },
      },
      results,
    );
    await invokeApi(
      {
        name: 'auth.refresh.post.invalid',
        method: 'POST',
        path: '/auth/refresh',
        body: { refreshToken: 'invalid_refresh_token' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'auth.logout.post',
        method: 'POST',
        path: '/auth/logout',
        token: studentToken,
        body: { refreshToken: 'invalid_refresh_token' },
      },
      results,
    );
    await invokeApi(
      { name: 'auth.me.get', method: 'GET', path: '/auth/me', token: studentToken },
      results,
    );

    await invokeApi(
      { name: 'users.me.get', method: 'GET', path: '/users/me', token: studentToken },
      results,
    );
    await invokeApi(
      {
        name: 'users.list.get',
        method: 'GET',
        path: '/users?page=1&size=5',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'users.detail.get',
        method: 'GET',
        path: '/users/USR001',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'users.profile.patch',
        method: 'PATCH',
        path: '/users/USR001/profile',
        token: studentToken,
        body: { fullName: 'Nguyen Van A', phone: '0901234567' },
      },
      results,
    );

    await invokeApi(
      {
        name: 'periods.list.get',
        method: 'GET',
        path: '/periods?page=1&size=5',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'periods.detail.get',
        method: 'GET',
        path: '/periods/prd_2026_hk1_bctt',
        token: tbmToken,
      },
      results,
    );

    const newPeriodCode = `AUTO-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
    const createPeriod = await invokeApi(
      {
        name: 'periods.create.post',
        method: 'POST',
        path: '/periods',
        token: tbmToken,
        body: {
          code: newPeriodCode,
          type: 'BCTT',
          openDate: '2027-01-01',
          closeDate: '2027-01-15',
        },
      },
      results,
    );

    let newPeriodId = 'prd_2026_hk1_kltn';
    if (createPeriod.status === 201 && createPeriod.snippet) {
      const parsed = await parseJsonSafe<{ data?: { id?: string } }>(
        createPeriod.snippet,
      );
      if (parsed?.data?.id) {
        newPeriodId = parsed.data.id;
      }
    }

    await invokeApi(
      {
        name: 'periods.update.patch',
        method: 'PATCH',
        path: `/periods/${newPeriodId}`,
        token: tbmToken,
        body: { code: `${newPeriodCode}-U` },
      },
      results,
    );
    await invokeApi(
      {
        name: 'periods.open.post',
        method: 'POST',
        path: `/periods/${newPeriodId}/open`,
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'periods.close.post',
        method: 'POST',
        path: `/periods/${newPeriodId}/close`,
        token: tbmToken,
      },
      results,
    );

    await invokeApi(
      {
        name: 'topics.list.get',
        method: 'GET',
        path: '/topics?page=1&size=5',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'topics.detail.get',
        method: 'GET',
        path: '/topics/tp_001',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'topics.create.post.student',
        method: 'POST',
        path: '/topics',
        token: studentToken,
        body: {
          type: 'KLTN',
          title: 'Auto Test Topic',
          domain: 'Software Engineering',
          periodId: 'prd_2026_hk1_kltn',
          supervisorUserId: 'USR002',
          companyName: 'UTE LAB',
        },
      },
      results,
    );
    await invokeApi(
      {
        name: 'topics.update.patch',
        method: 'PATCH',
        path: '/topics/tp_001',
        token: tbmToken,
        body: { title: 'Ung dung AI trong quan ly hoc tap' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'topics.approve.post',
        method: 'POST',
        path: '/topics/tp_002/approve',
        token: lecturerToken,
        body: { note: 'Approved by curl sweep' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'topics.reject.post',
        method: 'POST',
        path: '/topics/tp_002/reject',
        token: lecturerToken,
        body: { reason: 'Rejected by curl sweep' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'topics.deadline.post',
        method: 'POST',
        path: '/topics/tp_001/deadline',
        token: lecturerToken,
        body: {
          submitStartAt: '2030-01-01T00:00:00Z',
          submitEndAt: '2030-01-10T23:59:59Z',
          action: 'SET_OR_EXTEND',
        },
      },
      results,
    );
    await invokeApi(
      {
        name: 'topics.transition.post',
        method: 'POST',
        path: '/topics/tp_001/transition',
        token: lecturerToken,
        body: { action: 'MOVE_TO_GRADING' },
      },
      results,
    );

    await invokeApi(
      {
        name: 'assignments.topic.list.get',
        method: 'GET',
        path: '/topics/tp_001/assignments',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'assignments.gvpb.post',
        method: 'POST',
        path: '/topics/tp_001/assignments/gvpb',
        token: tbmToken,
        body: { reviewerUserId: 'USR006' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'assignments.council.post',
        method: 'POST',
        path: '/topics/tp_001/assignments/council',
        token: tbmToken,
        body: {
          chairUserId: 'USR007',
          secretaryUserId: 'USR008',
          memberUserIds: ['USR009', 'USR010', 'USR011'],
        },
      },
      results,
    );
    await invokeApi(
      {
        name: 'assignments.detail.get',
        method: 'GET',
        path: `/assignments/${assignmentId}`,
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'assignments.replace.patch',
        method: 'PATCH',
        path: `/assignments/${assignmentId}/replace`,
        token: tbmToken,
        body: { newUserId: 'USR010', reason: 'rotation' },
      },
      results,
    );

    await invokeApi(
      {
        name: 'submissions.topic.list.get',
        method: 'GET',
        path: '/topics/tp_001/submissions',
        token: tbmToken,
      },
      results,
    );

    const uploadForm = new FormData();
    uploadForm.append('fileType', 'REPORT');
    uploadForm.append(
      'file',
      new Blob(
        [
          Buffer.from(
            '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF',
            'ascii',
          ),
        ],
        { type: 'application/pdf' },
      ),
      'curl-upload.pdf',
    );

    await invokeApi(
      {
        name: 'submissions.upload.post',
        method: 'POST',
        path: '/topics/tp_001/submissions',
        token: studentToken,
        formData: uploadForm,
      },
      results,
    );
    await invokeApi(
      {
        name: 'submissions.detail.get',
        method: 'GET',
        path: '/submissions/sub_001',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'submissions.download.get',
        method: 'GET',
        path: '/submissions/sub_001/download',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'submissions.latest.get',
        method: 'GET',
        path: '/topics/tp_001/submissions/latest/REPORT',
        token: tbmToken,
      },
      results,
    );

    await invokeApi(
      {
        name: 'scores.topic.list.get',
        method: 'GET',
        path: '/topics/tp_001/scores',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'scores.detail.get',
        method: 'GET',
        path: '/scores/sc_001',
        token: tbmToken,
      },
      results,
    );

    const draft = await invokeApi(
      {
        name: 'scores.draft.post',
        method: 'POST',
        path: '/topics/tp_001/scores/draft',
        token: lecturerToken,
        body: {
          scorerRole: 'GVHD',
          rubricData: [
            { criterion: 'quality', score: 2.0, max: 2.5 },
            { criterion: 'implementation', score: 3.0, max: 4.0 },
          ],
        },
      },
      results,
    );

    let draftScoreId = 'sc_001';
    if (draft.status === 200 && draft.snippet) {
      const parsedDraft = await parseJsonSafe<{ data?: { scoreId?: string } }>(
        draft.snippet,
      );
      if (parsedDraft?.data?.scoreId) {
        draftScoreId = parsedDraft.data.scoreId;
      }
    }

    await invokeApi(
      {
        name: 'scores.submit.post',
        method: 'POST',
        path: `/scores/${draftScoreId}/submit`,
        token: lecturerToken,
        body: { confirm: true },
      },
      results,
    );
    await invokeApi(
      {
        name: 'scores.summary.post',
        method: 'POST',
        path: '/topics/tp_001/scores/summary',
        token: lecturerToken,
        body: { requestedByRole: 'TK_HD' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'scores.summary.get',
        method: 'GET',
        path: '/topics/tp_001/scores/summary',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'scores.confirm.post',
        method: 'POST',
        path: '/topics/tp_001/scores/confirm',
        token: lecturerToken,
        body: { role: 'GVHD' },
      },
      results,
    );

    const expBctt = await invokeApi(
      {
        name: 'exports.rubric.bctt.post',
        method: 'POST',
        path: '/exports/rubric/bctt/tp_002',
        token: lecturerToken,
        body: { scoreId: 'sc_006' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'exports.rubric.kltn.post',
        method: 'POST',
        path: '/exports/rubric/kltn/tp_001/GVPB',
        token: lecturerToken,
        body: { scoreId: 'sc_002' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'exports.scores.post',
        method: 'POST',
        path: '/exports/scores/tp_001',
        token: lecturerToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'exports.topics.post',
        method: 'POST',
        path: '/exports/topics',
        token: tbmToken,
        body: { periodId: 'prd_2026_hk1_kltn' },
      },
      results,
    );
    await invokeApi(
      {
        name: 'exports.list.get',
        method: 'GET',
        path: '/exports?page=1&size=5',
        token: lecturerToken,
      },
      results,
    );

    if (expBctt.status === 201 && expBctt.snippet) {
      const parsedExp = await parseJsonSafe<{ data?: { exportId?: string } }>(
        expBctt.snippet,
      );
      if (parsedExp?.data?.exportId) {
        exportId = parsedExp.data.exportId;
      }
    }

    await invokeApi(
      {
        name: 'exports.detail.get',
        method: 'GET',
        path: `/exports/${exportId}`,
        token: lecturerToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'exports.download.get',
        method: 'GET',
        path: `/exports/${exportId}/download`,
        token: lecturerToken,
      },
      results,
    );

    await invokeApi(
      {
        name: 'notifications.list.get',
        method: 'GET',
        path: '/notifications?page=1&size=5',
        token: studentToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'notifications.unread.get',
        method: 'GET',
        path: '/notifications/unread-count',
        token: studentToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'notifications.detail.get',
        method: 'GET',
        path: `/notifications/${notifId}`,
        token: studentToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'notifications.read.patch',
        method: 'PATCH',
        path: `/notifications/${notifId}/read`,
        token: studentToken,
        body: { isRead: true },
      },
      results,
    );
    await invokeApi(
      {
        name: 'notifications.readbulk.post',
        method: 'POST',
        path: '/notifications/read-bulk',
        token: studentToken,
        body: { notificationIds: [notifId] },
      },
      results,
    );

    await invokeApi(
      {
        name: 'schedules.get',
        method: 'GET',
        path: '/topics/tp_001/schedule',
        token: tbmToken,
      },
      results,
    );
    const defenseAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await invokeApi(
      {
        name: 'schedules.create.post',
        method: 'POST',
        path: '/topics/tp_001/schedule',
        token: tbmToken,
        body: {
          defenseAt,
          locationType: 'OFFLINE',
          locationDetail: 'A3-201',
          notes: 'curl sweep create',
        },
      },
      results,
    );
    await invokeApi(
      {
        name: 'schedules.update.patch',
        method: 'PATCH',
        path: '/topics/tp_001/schedule',
        token: tbmToken,
        body: {
          locationDetail: 'A3-202',
          notes: 'curl sweep update',
        },
      },
      results,
    );

    await invokeApi(
      {
        name: 'audit.list.get',
        method: 'GET',
        path: '/audit?limit=5',
        token: tbmToken,
      },
      results,
    );
    await invokeApi(
      {
        name: 'audit.topic.get',
        method: 'GET',
        path: '/audit/topics/tp_001',
        token: tbmToken,
      },
      results,
    );

    const failedEndpoints = results.filter((item) => !item.ok);
    const output: SweepOutput = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      startedServer: startedByScript,
      summary: {
        total: results.length,
        ok: results.length - failedEndpoints.length,
        failed: failedEndpoints.length,
      },
      failedEndpoints,
      results,
    };

    await fs.writeFile(join(cwd, RESULTS_JSON), JSON.stringify(output, null, 2), 'utf8');
    printSummary(output);
  } finally {
    stopServerIfStarted(serverProcess, startedByScript);
  }
}

void run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Sweep failed: ${message}`);
  process.exitCode = 1;
});
