# KLTN Backend

NestJS API for HCM-UTE Graduation Management System.

## Setup

```bash
npm install
cp .env.example .env.local
npm run seed
npm run seed:sheets
npm run dev
```

## Runtime Access Logs

Backend prints one access log line for every HTTP request at runtime:

```text
METHOD /path status durationMs ip
```

Example:

```text
GET /api/v1/health 200 4ms 127.0.0.1
```

Set `ACCESS_LOG_ENABLED=false` to disable per-request logging.

## Seed Sample Data

`npm run seed:sheets` upserts sample rows into all required Google Sheets tabs:

- `Users`, `Periods`, `Topics`, `Assignments`, `Submissions`
- `Scores`, `ScoreSummaries`, `Notifications`
- `ExportFiles`, `Schedules`, `AuditLogs`

This script does not hard-delete existing rows; it updates by `id` if row already exists.

`npm run seed` is an alias for checklist compatibility and executes the same sheet seeding flow.

Use `npm run inspect:sheets` to print row counts and sample IDs from each tab after seeding.
Use `npm run preview:sheets` to export live Google Sheets data into `.tmp/sheet-preview.json` with impact checks for backend logic (topic/score/export readiness, reference integrity).

Sample seeded score IDs for rubric export smoke tests:

- BCTT: topic `tp_002`, score `sc_006` (role `GVHD`)
- KLTN: topic `tp_001`, score `sc_001` (GVHD), `sc_002` (GVPB), `sc_003` (TV_HD)

## DOCX Template Files

Rubric template files are loaded from:

- `resources/docx-templates/bctt-rubric-template.docx`
- `resources/docx-templates/kltn-gvhd-rubric-template.docx`
- `resources/docx-templates/kltn-gvpb-rubric-template.docx`
- `resources/docx-templates/kltn-council-rubric-template.docx`

Runtime behavior:

- Service selects template by export feature/type (BCTT, KLTN GVHD/GVPB/HOI_DONG)
- If template contains placeholder markers (for example `{{field}}`), data is rendered into template
- If template has no placeholders or rendering fails, backend falls back to the existing generator logic so export still succeeds

## Quick Curl Verification

After backend starts, verify a few representative endpoints:

```bash
curl -s http://localhost:3001/api/v1/health
curl -s http://localhost:3001/api/v1/health/ready
```

For protected APIs, use a valid JWT and pass header:

```bash
curl -s -H "Authorization: Bearer <JWT>" \
	"http://localhost:3001/api/v1/topics?page=1&size=10"

# BCTT rubric export (DOCX generated, converted to PDF, uploaded to Drive)
curl -s -X POST \
	-H "Authorization: Bearer <JWT_LECTURER_OR_TBM>" \
	-H "Content-Type: application/json" \
	-d '{"scoreId":"sc_006"}' \
	"http://localhost:3001/api/v1/exports/rubric/bctt/tp_002"

# KLTN rubric export by role (GVHD/GVPB/TV_HD)
curl -s -X POST \
	-H "Authorization: Bearer <JWT_LECTURER_OR_TBM>" \
	-H "Content-Type: application/json" \
	-d '{"scoreId":"sc_002"}' \
	"http://localhost:3001/api/v1/exports/rubric/kltn/tp_001/GVPB"
```

Run full API sweep (auto-start backend if needed, then write result JSON):

```bash
npm run sweep:api
```

Output file:

- `.tmp/full-curl-sweep.json`
- Optional runtime logs when script starts backend: `.tmp/curl-sweep-server.out.log`, `.tmp/curl-sweep-server.err.log`

Run shell smoke test (when backend is running):

```bash
bash scripts/smoke-test.sh
```

Run backend service with local Docker compose:

```bash
docker compose -f docker-compose.yml up --build
```

## Google Drive Upload Auth Modes

Personal Gmail accounts do not support Shared Drives, and service accounts have no storage quota.
If upload returns quota errors, use OAuth user credentials for Drive upload:

- Set `GOOGLE_DRIVE_AUTH_MODE=oauth_user`
- Set `GOOGLE_OAUTH_REFRESH_TOKEN=<your_refresh_token>`
- Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`

Notes:

- `GOOGLE_DRIVE_AUTH_MODE=auto` (default) prefers OAuth user mode when refresh token exists, otherwise falls back to service account mode.
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` can be omitted if `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are already configured.

## Template Behavior

Rubric export selects template by feature/type:

- `RUBRIC_BCTT` -> `bctt-rubric-template.docx`
- `RUBRIC_KLTN (GVHD)` -> `kltn-gvhd-rubric-template.docx`
- `RUBRIC_KLTN (GVPB)` -> `kltn-gvpb-rubric-template.docx`
- `RUBRIC_KLTN (TV_HD / council)` -> `kltn-council-rubric-template.docx`

If template contains placeholder markers (`{{...}}`, `${...}`, `<<...>>`, `[[...]]`, `{%...%}`), backend renders data into template then exports PDF.
If template has no placeholder markers, backend falls back to the built-in generator to keep export flow successful.

DOCX helper scripts for local template inspection:

- `scripts/docx-tools/inspect-docx-markers.ps1`
- `scripts/docx-tools/analyze-docx-placeholders.ps1`

## API Docs

Base URL: `http://localhost:3001/api/v1`

See `../docs/PROJECT_ARCHITECTURE.md` for full API documentation.
