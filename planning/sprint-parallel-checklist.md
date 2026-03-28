# Sprint Parallel Checklist (Implementer + Reviewer + Tester)

## Sprint Goal

Deliver MVP workflow foundation for BCTT/KLTN with Google Sheets as the only data source and Google Drive for files, ready for staging deployment.

## Shared Contracts Available (from backend/src/common)

- Auth user type: AuthUser, AccountRole, TopicRole
- Base response shape: ApiResponse, BaseResponseDto
- Error types: ProblemDetails, ProblemDetailsError
- Common DTOs: IdParamDto, PaginationQueryDto
- Common guards/decorators: BaseAuthGuard, TopicRolesGuard, TopicRoles, RequestId

## Size Definition

- S: < 1 hour
- M: 1-3 hours
- L: 3-6 hours
- XL: must split

## Execution Waves

- Wave 1 (parallel): T01, T02, T03, T04
- Wave 2 (parallel): T05, T06, T07, T08
- Wave 3 (parallel): T09, T10, T11
- Wave 4 (sequential): T12 after T09+T10+T11

## Task Checklist

### T01 - Backend contracts hardening

- Size: S
- Scope folder: backend/src/common/
- Dependencies: none
- Parallel: yes (Wave 1)
- Acceptance criteria:
  - Given shared contracts exist, when backend modules import common types, then no duplicated role/response/error type definitions are introduced.
  - Given RFC 7807 response, when validation errors occur, then shape remains stable across modules.
- Tests:
  - Unit: filter and guard behavior tests.
  - E2E: unauthorized route returns problem details shape.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T02 - Topic workflow state engine

- Size: L
- Scope folder: backend/src/modules/topics/
- Dependencies: T01
- Parallel: yes (Wave 1)
- Acceptance criteria:
  - Given a topic in PENDING_GV, when GVHD approves, then state becomes CONFIRMED and audit row is created.
  - Given invalid transition, when API is called, then returns 409 problem details.
- Tests:
  - Unit: transition policy matrix.
  - E2E: create topic -> pending -> approve path.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T03 - Submission and Drive integration

- Size: M
- Scope folder: backend/src/modules/submissions/, backend/src/infrastructure/google-drive/
- Dependencies: T01
- Parallel: yes (Wave 1)
- Acceptance criteria:
  - Given valid PDF upload, when student submits, then file is stored in Drive and metadata row is created.
  - Given invalid file type, when upload occurs, then 400 is returned.
- Tests:
  - Unit: file validator and version increment logic.
  - E2E: upload PDF and list submission history.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T04 - CI and local container baseline

- Size: M
- Scope folder: .github/workflows/, docker-compose.yml, docker-compose.prod.yml
- Dependencies: none
- Parallel: yes (Wave 1)
- Acceptance criteria:
  - Given PR to main/develop, when workflow runs, then backend/frontend/e2e jobs execute in order.
  - Given e2e failure, when workflow fails, then artifacts are uploaded.
- Tests:
  - Unit: N/A
  - E2E: CI dry run in branch using workflow_dispatch.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T05 - BCTT scoring and export

- Size: L
- Scope folder: backend/src/modules/scores/, backend/src/modules/exports/
- Dependencies: T02, T03
- Parallel: yes (Wave 2)
- Acceptance criteria:
  - Given GRADING state, when GVHD submits rubric, then score is locked and export document is generated.
  - Given student role, when score is fetched, then only total score is visible.
- Tests:
  - Unit: score calculator and lock policy.
  - E2E: grading to completed flow.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T06 - KLTN eligibility and pre-defense

- Size: L
- Scope folder: backend/src/modules/topics/, backend/src/modules/reviews/
- Dependencies: T02, T03
- Parallel: yes (Wave 2)
- Acceptance criteria:
  - Given student without completed BCTT > 5, when KLTN create is requested, then 422 is returned.
  - Given GVHD uploaded Turnitin, when confirm is submitted, then state moves to PENDING_CONFIRM.
- Tests:
  - Unit: eligibility policy cases.
  - E2E: reject loop PENDING_CONFIRM -> IN_PROGRESS.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T07 - Assignment and schedule conflict checks

- Size: XL (split)
- Scope folder: backend/src/modules/assignments/, backend/src/modules/schedules/
- Dependencies: T02
- Parallel: yes (Wave 2)
- Split:
  - T07A (M): assignment + council composition validators
  - T07B (M): schedule conflict + room availability + API wiring
- Acceptance criteria:
  - Given conflict role assignment, when TBM assigns council, then 409/422 is returned with clear reason.
  - Given occupied room or duplicate timeslot, when schedule is created, then conflict is blocked.
- Tests:
  - Unit: validators and conflict checker.
  - E2E: TBM assignment flow with conflict case.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T08 - Notification core and jobs

- Size: L
- Scope folder: backend/src/modules/notifications/, backend/src/jobs/
- Dependencies: T02, T05, T06
- Parallel: yes (Wave 2)
- Acceptance criteria:
  - Given topic state changes, when transition succeeds, then notification with deep-link is created.
  - Given deadline approaching, when scheduler runs, then reminder notifications are emitted.
- Tests:
  - Unit: deep-link builder and template mapper.
  - E2E: unread count and mark-read workflow.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T09 - Frontend student experience

- Size: L
- Scope folder: frontend/app/(student)/, frontend/components/features/
- Dependencies: T02, T03, T05
- Parallel: yes (Wave 3)
- Acceptance criteria:
  - Given student has a topic, when opening dashboard, then progress and actions reflect backend state.
  - Given score published gate not reached, when student opens score page, then details remain hidden.
- Tests:
  - Unit: component interaction tests.
  - E2E: student topic + upload + score visibility.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T10 - Frontend lecturer and TBM experience

- Size: XL (split)
- Scope folder: frontend/app/(lecturer)/, frontend/app/(admin)/, frontend/components/features/
- Dependencies: T02, T06, T07A, T07B
- Parallel: yes (Wave 3)
- Split:
  - T10A (L): lecturer approvals, review, scoring forms
  - T10B (L): TBM assignments, council setup, schedule forms
- Acceptance criteria:
  - Given lecturer responsibilities, when opening lecturer pages, then only assigned actions are available.
  - Given TBM scheduling action, when conflicts exist, then UI blocks and displays conflict reason.
- Tests:
  - Unit: role-based view guards and form validation.
  - E2E: lecturer review path and TBM scheduling path.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T11 - CD deployment workflow

- Size: M
- Scope folder: .github/workflows/cd.yml
- Dependencies: T04
- Parallel: yes (Wave 3)
- Acceptance criteria:
  - Given push to main, when build completes, then staging deploy runs automatically.
  - Given manual production dispatch, when environment approval is granted, then production deploy executes.
  - Given health check fails after deploy, when retries exhausted, then rollback restores previous images and job fails.
- Tests:
  - Unit: N/A
  - E2E: workflow_dispatch dry run to staging.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

### T12 - Integrated quality gate

- Size: M
- Scope folder: backend/, frontend/, .github/workflows/
- Dependencies: T05, T06, T07A, T07B, T08, T09, T10A, T10B, T11
- Parallel: no (Wave 4)
- Acceptance criteria:
  - Given all module work merged, when CI runs, then backend/frontend/e2e are green.
  - Given smoke deployment to staging, when executed, then health endpoint and login flow are healthy.
- Tests:
  - Unit: targeted regression per changed module.
  - E2E: smoke suite for auth + topic + notification.
- Implementer: [ ]
- Reviewer: [ ]
- Tester: [ ]

## Final Go/No-Go Before Worktree Sprint

- [ ] Secrets rotated and re-injected in local + GitHub environments
- [ ] Google Sheets API and Google Drive API both enabled
- [ ] Service account has Sheets + Drive permissions for target assets
- [ ] CI pipeline green on main and develop
- [ ] Staging CD dry run successful
- [ ] Shared contracts imported by at least one module as proof of use
