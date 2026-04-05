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

## Google OAuth Redirect URI (Production)

For deployed environments, `GOOGLE_CALLBACK_URL` must use the public backend domain.

Correct example:

```text
https://graduation-paper-management-hub.onrender.com/api/v1/auth/google/callback
```

Incorrect example (causes `redirect_uri_mismatch`):

```text
http://localhost:3001/api/v1/auth/google/callback
```

If `GOOGLE_CALLBACK_URL` is not set, backend falls back to `RENDER_EXTERNAL_URL` (Render only) and appends `/api/v1/auth/google/callback`.

In Google Cloud Console, add exactly the same callback URL to Authorized redirect URIs.

## Seed Sample Data

`npm run seed:sheets` seeds canonical sample rows into Google Sheets tabs used by the system
(for example: `Data`, `Dot`, `Trangthaidetai`, `Điểm`, `TenDetai`, `Topics`, `RevisionRounds`,
`ScoreSummaries`, `Notifications`, ...).

This script clears existing data rows on app-managed tabs and reseeds from scratch (idempotent for dev/staging).
Teacher-managed reference tabs (`Quota`, `Major`) are preserved.

`npm run seed:sheets:validate` runs read-only validation (schema + row counts) and fails closed if
header/structure mismatches are detected.

`npm run seed:sheets:reset` clears data rows (keeps headers) and then seeds again from canonical
sample data. Current reset flow preserves teacher reference tabs (`Quota`, `Major`).

`npm run seed:sheets:reseed` is the recommended clean reset command for local/staging:

1. Runs `seed:sheets:reset`
2. Runs `seed:sheets:validate`
3. Retries validate automatically when Google Sheets quota returns `429/rateLimitExceeded`

`npm run seed:sheets:rollback -- --file <snapshot.json>` restores app tabs from a previously exported
preview snapshot file (for example `.tmp/sheet-preview-pre-reseed-YYYYMMDD-HHMMSS.json`).

`npm run seed` remains an alias for checklist compatibility.

Use `npm run inspect:sheets` to print row counts and sample IDs from each tab after seeding.
Use `npm run preview:sheets` to export live Google Sheets data into `.tmp/sheet-preview.json` with impact checks for backend logic (topic/score/export readiness, reference integrity).

Recommended reseed/rollback safety flow:

1. Export pre-change snapshot: `npm run preview:sheets`
2. Run reseed: `npm run seed:sheets:reseed`
3. Validate app smoke checks
4. If rollback needed: `npm run seed:sheets:rollback -- --file <pre-change-snapshot.json>`
5. Export snapshot again and compare key row counts pre/post rollback

Sample seeded IDs for rubric export smoke tests:

- BCTT: topic `topic-bctt-done`, score `score-bctt-done-gvhd` (role `GVHD`)
- KLTN: topic `topic-kltn-demo`, score `score-kltn-gvhd` (GVHD), `score-kltn-gvpb` (GVPB)

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
	-d '{"scoreId":"score-bctt-done-gvhd"}' \
	"http://localhost:3001/api/v1/exports/rubric/bctt/topic-bctt-done"

# KLTN rubric export by role (GVHD/GVPB/TV_HD)
curl -s -X POST \
	-H "Authorization: Bearer <JWT_LECTURER_OR_TBM>" \
	-H "Content-Type: application/json" \
	-d '{"scoreId":"score-kltn-gvpb"}' \
	"http://localhost:3001/api/v1/exports/rubric/kltn/topic-kltn-demo/GVPB"
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
