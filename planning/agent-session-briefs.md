# Agent Session Briefs

Use one brief per agent session. Do not cross file boundaries unless a dependency explicitly requires it.

## Shared Context for all sessions

- Project: HCM-UTE graduation workflow MVP
- Stack:
  - Backend: NestJS 10 + TypeScript 5.4
  - Frontend: Next.js 14 App Router + React 18
  - Data source: Google Sheets only
  - File storage: Google Drive
- Global conventions: .github/copilot-instructions.md
- Shared contracts:
  - backend/src/common/types/
  - backend/src/common/dto/
  - backend/src/common/filters/problem-details.filter.ts
  - backend/src/common/guards/base-auth.guard.ts
  - backend/src/common/guards/topic-roles.guard.ts
  - backend/src/common/decorators/topic-roles.decorator.ts

---

## Session 01 - Foundation Contracts

1. Context

- Maintain shared contract baseline for all other sessions.

2. Scope (strict)

- backend/src/common/\*\*

3. Task

- Finalize common types/DTOs/filters/guards/decorators and export barrels.
- Acceptance criteria:
  - Given role/response/error definitions, when modules import contracts, then duplicate local definitions are not needed.

4. Shared contracts available

- All files under backend/src/common/types and backend/src/common/dto.

5. Tests to write

- Unit tests for ProblemDetailsFilter and TopicRolesGuard.

6. Definition of Done

- Contracts compile and are imported by at least one backend module.

7. Instruction push

- Khi xong, git add backend/src/common, commit, push feature/session-01-foundation-contracts

---

## Session 02 - Topic Workflow Engine

1. Context

- Implement topic state machine and transition policies.

2. Scope (strict)

- backend/src/modules/topics/\*\*

3. Task

- Add/complete state transitions for BCTT and KLTN.
- Acceptance criteria:
  - Given invalid transition, when requested, then return 409 problem details.

4. Shared contracts available

- AuthUser, AccountRole, TopicRole, IdParamDto, PaginationQueryDto.

5. Tests to write

- Unit tests for policy matrix.
- Integration tests for key transitions.

6. Definition of Done

- All transition endpoints pass tests and enforce policy.

7. Instruction push

- Khi xong, git add backend/src/modules/topics, commit, push feature/session-02-topic-workflow

---

## Session 03 - Submissions and Drive

1. Context

- Implement file submissions and Drive adapter integration.

2. Scope (strict)

- backend/src/modules/submissions/\*\*
- backend/src/infrastructure/google-drive/\*\*

3. Task

- Validate upload input and persist submission metadata.
- Acceptance criteria:
  - Given valid PDF, when uploaded, then Drive file id is returned and stored.

4. Shared contracts available

- BaseResponseDto, ProblemDetails.

5. Tests to write

- Unit tests for validators/versioning.
- Integration tests for upload/list endpoints.

6. Definition of Done

- Submission endpoints work for happy path and invalid file path.

7. Instruction push

- Khi xong, git add backend/src/modules/submissions backend/src/infrastructure/google-drive, commit, push feature/session-03-submissions-drive

---

## Session 04 - Scoring and Export

1. Context

- Implement scoring lock rules and export behavior.

2. Scope (strict)

- backend/src/modules/scores/\*\*
- backend/src/modules/exports/\*\*

3. Task

- Implement draft/submit lock and summary gate logic.
- Acceptance criteria:
  - Given submitted score, when update is attempted, then update is rejected.

4. Shared contracts available

- ApiResponse, ProblemDetails, TopicRole.

5. Tests to write

- Unit tests for lock policy and summary calculation.
- Integration tests for scoring endpoints.

6. Definition of Done

- Score lifecycle and visibility constraints are enforced.

7. Instruction push

- Khi xong, git add backend/src/modules/scores backend/src/modules/exports, commit, push feature/session-04-scoring-export

---

## Session 05 - Assignment and Scheduling

1. Context

- Implement TBM assignment and defense scheduling constraints.

2. Scope (strict)

- backend/src/modules/assignments/\*\*
- backend/src/modules/schedules/\*\*

3. Task

- Build council composition and schedule conflict checks.
- Acceptance criteria:
  - Given conflict role/time, when assignment or schedule is submitted, then request is blocked with clear error.

4. Shared contracts available

- TopicRole, IdParamDto, ProblemDetails.

5. Tests to write

- Unit tests for conflict validators.
- Integration tests for assignment and schedule endpoints.

6. Definition of Done

- TBM flow blocks invalid states and conflicts.

7. Instruction push

- Khi xong, git add backend/src/modules/assignments backend/src/modules/schedules, commit, push feature/session-05-assignments-scheduling

---

## Session 06 - Notifications and Jobs

1. Context

- Implement notification events, deep-links, reminder jobs.

2. Scope (strict)

- backend/src/modules/notifications/\*\*
- backend/src/jobs/\*\*

3. Task

- Emit notifications on workflow events and schedule jobs.
- Acceptance criteria:
  - Given state change/deadline event, when event fires, then notification is created with deep-link.

4. Shared contracts available

- AuthUser, ApiResponse, ProblemDetails.

5. Tests to write

- Unit tests for template/deeplink mapping.
- Integration tests for list/read notification APIs.

6. Definition of Done

- Notification and job flows are test-covered and stable.

7. Instruction push

- Khi xong, git add backend/src/modules/notifications backend/src/jobs, commit, push feature/session-06-notifications-jobs

---

## Session 07 - Frontend Student

1. Context

- Build student pages and flows for topic progress and submissions.

2. Scope (strict)

- frontend/app/(student)/\*\*
- frontend/components/features/\*\*
- frontend/lib/api.ts (only if endpoint wiring required)

3. Task

- Implement student topic screens, upload flow, score visibility.
- Acceptance criteria:
  - Given score is not fully published, when student opens score view, then restricted view is shown.

4. Shared contracts available

- Shared API response and problem details shape from backend common contracts.

5. Tests to write

- Unit tests for student components.
- E2E tests for student happy path.

6. Definition of Done

- Student flow follows backend state constraints.

7. Instruction push

- Khi xong, git add frontend/app/(student) frontend/components/features frontend/lib/api.ts, commit, push feature/session-07-frontend-student

---

## Session 08 - Frontend Lecturer and Admin

1. Context

- Build lecturer and TBM workflow screens.

2. Scope (strict)

- frontend/app/(lecturer)/\*\*
- frontend/app/(admin)/\*\*
- frontend/components/features/\*\*

3. Task

- Add review, scoring, assignment, and schedule management UI.
- Acceptance criteria:
  - Given invalid assignment/schedule conflict, when user submits, then UI displays backend conflict message and blocks progress.

4. Shared contracts available

- Shared API response and error patterns from backend common contracts.

5. Tests to write

- Unit tests for role-based pages/forms.
- E2E tests for lecturer and TBM critical paths.

6. Definition of Done

- Lecturer/TBM flows complete with validation and error handling.

7. Instruction push

- Khi xong, git add frontend/app/(lecturer) frontend/app/(admin) frontend/components/features, commit, push feature/session-08-frontend-lecturer-admin

---

## Session 09 - DevOps, Reviewer, Tester Gate

1. Context

- Final quality gate for CI/CD, Docker, deployment health, and test artifacts.

2. Scope (strict)

- .github/workflows/\*\*
- docker-compose.yml
- docker-compose.prod.yml
- backend/Dockerfile
- frontend/Dockerfile
- frontend/playwright.config.ts
- frontend/tests/e2e/\*\*

3. Task

- Validate CI jobs, CD rollback, and smoke tests.
- Acceptance criteria:
  - Given a failing e2e/deploy health check, when pipeline fails, then artifacts are uploaded and rollback path executes.

4. Shared contracts available

- N/A (infra-focused), but API health endpoint contract must remain stable.

5. Tests to write

- CI dry run via workflow_dispatch.
- E2E smoke test using Playwright.

6. Definition of Done

- Pipelines are reproducible and deployment guardrails are active.

7. Instruction push

- Khi xong, git add .github/workflows docker-compose.yml docker-compose.prod.yml backend/Dockerfile frontend/Dockerfile frontend/playwright.config.ts frontend/tests/e2e, commit, push feature/session-09-devops-gate
