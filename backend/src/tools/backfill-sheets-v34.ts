import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';

type Row = string[];

interface UserInfo {
  id: string;
  email: string;
  name: string;
  studentId?: string;
  lecturerId?: string;
}

interface TopicInfo {
  id: string;
  title: string;
  studentUserId: string;
  supervisorUserId: string;
}

const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';
const RAW_KEY = process.env.GOOGLE_PRIVATE_KEY ?? '';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? '';

if (!EMAIL || !RAW_KEY || !SPREADSHEET_ID) {
  console.error(
    'Missing env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SPREADSHEET_ID',
  );
  process.exit(1);
}

const auth = new google.auth.JWT(
  EMAIL,
  undefined,
  RAW_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/spreadsheets'],
);
const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth });

const nonEmpty = (value: string | undefined): boolean =>
  !!value && value.trim().length > 0;

const withLength = (row: Row, length: number): Row => {
  const next = [...row];
  while (next.length < length) {
    next.push('');
  }
  return next.slice(0, length);
};

async function getRows(range: string): Promise<Row[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return (response.data.values ?? []) as Row[];
}

async function updateRows(range: string, rows: Row[]): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
}

async function run(): Promise<void> {
  console.log('Starting v3.4 backfill...');

  const [dataRows, topicRows, assignmentRows, scoreRows, summaryRows] =
    await Promise.all([
      getRows(`'Data'!A2:P`),
      getRows(`'Topics'!A2:P`),
      getRows(`'Trangthaidetai'!A2:L`),
      getRows(`'Điểm'!A2:AA`),
      getRows(`'ScoreSummaries'!A2:W`),
    ]);

  const usersById = new Map<string, UserInfo>();
  for (const row of dataRows) {
    const id = row[6]?.trim();
    if (!id) continue;
    usersById.set(id, {
      id,
      email: row[0]?.trim() ?? '',
      name: row[2]?.trim() ?? '',
      studentId: row[1]?.trim() || undefined,
      lecturerId: row[1]?.trim() || undefined,
    });
  }

  const topicsById = new Map<string, TopicInfo>();
  for (const row of topicRows) {
    const id = row[0]?.trim();
    if (!id) continue;
    topicsById.set(id, {
      id,
      title: row[3]?.trim() ?? '',
      studentUserId: row[6]?.trim() ?? '',
      supervisorUserId: row[7]?.trim() ?? '',
    });
  }

  let assignmentChanged = 0;
  const normalizedAssignments: Row[] = assignmentRows.map((raw) => {
    const row = withLength(raw, 12);
    const topicId = row[7]?.trim();
    const lecturerId = row[8]?.trim();
    const topic = topicId ? topicsById.get(topicId) : undefined;
    const student = topic?.studentUserId
      ? usersById.get(topic.studentUserId)
      : undefined;
    const lecturer = lecturerId ? usersById.get(lecturerId) : undefined;

    let changed = false;
    if (!nonEmpty(row[0]) && nonEmpty(student?.email)) {
      row[0] = student!.email;
      changed = true;
    }
    if (!nonEmpty(row[1]) && nonEmpty(lecturer?.email)) {
      row[1] = lecturer!.email;
      changed = true;
    }

    if (changed) assignmentChanged += 1;
    return row;
  });

  let scoreChanged = 0;
  const normalizedScores: Row[] = scoreRows.map((raw) => {
    const row = withLength(raw, 27);
    const topicId = row[17]?.trim();
    const scorerId = row[18]?.trim();
    const topic = topicId ? topicsById.get(topicId) : undefined;
    const student = topic?.studentUserId
      ? usersById.get(topic.studentUserId)
      : undefined;
    const scorer = scorerId ? usersById.get(scorerId) : undefined;

    let changed = false;
    if (!nonEmpty(row[0]) && nonEmpty(student?.email)) {
      row[0] = student!.email;
      changed = true;
    }
    if (!nonEmpty(row[1]) && nonEmpty(student?.name)) {
      row[1] = student!.name;
      changed = true;
    }
    if (!nonEmpty(row[2]) && nonEmpty(student?.studentId)) {
      row[2] = student!.studentId!;
      changed = true;
    }
    if (!nonEmpty(row[3]) && nonEmpty(topic?.title)) {
      row[3] = topic!.title;
      changed = true;
    }
    if (!nonEmpty(row[4])) {
      const scorerDisplay = scorer?.name || scorer?.email || '';
      if (nonEmpty(scorerDisplay)) {
        row[4] = scorerDisplay;
        changed = true;
      }
    }

    if (changed) scoreChanged += 1;
    return row;
  });

  const normalizedSummaries: Row[] = summaryRows.map((raw) => withLength(raw, 23));
  const summaryExtended = normalizedSummaries.filter((row) => row.length >= 23).length;

  if (assignmentRows.length > 0) {
    await updateRows(
      `'Trangthaidetai'!A2:L${assignmentRows.length + 1}`,
      normalizedAssignments,
    );
  }
  if (scoreRows.length > 0) {
    await updateRows(`'Điểm'!A2:AA${scoreRows.length + 1}`, normalizedScores);
  }
  if (summaryRows.length > 0) {
    await updateRows(
      `'ScoreSummaries'!A2:W${summaryRows.length + 1}`,
      normalizedSummaries,
    );
  }

  console.log(`Assignments normalized: ${assignmentChanged}`);
  console.log(`Scores normalized: ${scoreChanged}`);
  console.log(`ScoreSummaries rows extended to 23 columns: ${summaryExtended}`);
  console.log('Backfill completed.');
}

void run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
