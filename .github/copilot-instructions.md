# GitHub Copilot Instructions

These instructions apply to all agent sessions in this repository.

## 1) Project Context

- Product: HCM-UTE graduation workflow platform (BCTT and KLTN).
- Architecture: modular monolith backend + role-based Next.js frontend.
- Data source: Google Sheets only (source of truth).
- File storage: Google Drive.
- Auth: Google OAuth2 + JWT.
- Deployment target: Render (production deploy triggered by push to main).
- Planning docs are maintained at workspace level: ../../docs/02-backend.

## 2) Tech Stack and Versions

- Runtime and tooling:
  - Node.js: 22.x for CI, 20+ compatible runtime.
  - TypeScript: 5.4.x.
  - Package manager: npm.
- Backend:
  - NestJS: 10.3.x.
  - Passport JWT and Google OAuth strategy.
  - Validation: class-validator + class-transformer.
  - API style: REST under /api/v1.
- Frontend:
  - Next.js: 14.2.x (App Router).
  - React: 18.3.x.
  - SWR for fetching.
  - Tailwind CSS: 3.4.x.
- Integrations:
  - Google Sheets API v4.
  - Google Drive API v3.

## 3) Repository Structure

- backend/
  - src/common: shared decorators, guards, filters, DTOs, types.
  - src/modules: domain modules (auth, topics, submissions, scores, assignments, etc.).
  - src/infrastructure: Google integrations.
- frontend/
  - app/: route groups (admin, lecturer, student, auth).
  - components/: UI and feature components.
  - lib/: API client and shared frontend utilities.
- .github/workflows/: CI/CD pipelines.

## 4) Coding Conventions

### TypeScript and formatting

- Use 2 spaces for indentation.
- Use single quotes.
- Keep semicolons.
- Prefer explicit types at module boundaries.
- Keep strict mode compatibility (no implicit any).

### Naming

- Files: kebab-case (example: score-summary.service.ts).
- Classes: PascalCase.
- Interfaces and types: PascalCase.
- Constants: UPPER_SNAKE_CASE.
- Variables/functions: camelCase.

### Module boundaries

- Keep business logic in services.
- Keep controllers thin: validate input, call service, return response.
- Keep external calls in infrastructure adapters/repositories.

## 5) Error Handling Pattern

- Use RFC 7807 problem details shape from common filter.
- Throw NestJS HttpException subclasses in services/controllers.
- Do not leak raw stack traces or provider secrets in responses.
- Validation errors must map to status 400 with stable field messages.

Expected error shape:

{
"type": "https://.../errors/{status}",
"title": "Error title",
"status": 400,
"detail": "Readable message",
"instance": "/api/v1/...",
"errors": [{ "field": "name", "message": "Required" }]
}

## 6) Auth and Authorization Pattern

- Authentication flow:
  - Google OAuth2 login.
  - Access token via JWT.
  - Refresh flow handled by auth module/session layer.
- Authorization is layered:
  - Account role: STUDENT, LECTURER, TBM.
  - Topic role: GVHD, GVPB, TV_HD, CT_HD, TK_HD.
  - State-based action gating per workflow state.
- Use JwtAuthGuard + RolesGuard.
- Use @Public() for explicitly public endpoints only.

## 7) Testing Requirements

- Unit tests:
  - Target line coverage >= 85%.
  - Target branch coverage >= 80%.
- Integration tests:
  - Cover all P0 workflow transitions and auth gates.
- E2E tests:
  - Cover login, topic flow milestones, and score visibility gates.
- Test naming:
  - Use behavior-first naming.
  - Pattern: should*<expected_behavior>\_when*<condition>.

## 8) Agents Must Never Do

- Never use var.
- Never use wildcard imports (import \* as ...) unless platform-mandated.
- Never hardcode secrets, tokens, private keys, spreadsheet IDs, or drive IDs.
- Never bypass guards for protected endpoints.
- Never change data-source design away from Google Sheets unless explicitly requested.
- Never introduce breaking API contracts without updating shared DTO/types and docs.
- Never merge unrelated formatting-only changes with functional PRs.

## 9) Common Patterns to Follow

### Controller pattern

- Validate DTO input.
- Delegate to service.
- Return typed response.

### Service pattern

- Guard business preconditions early.
- Execute state transition logic atomically.
- Emit domain notifications/events after successful state change.

### Repository pattern

- Keep Sheets access isolated from business logic.
- Return normalized domain objects.
- Map external provider errors to stable domain errors.

### Guard and decorator pattern

- Keep role requirements declarative in decorators.
- Keep guard logic generic and reusable.

## 10) Delivery Discipline for Agents

- Prefer minimal, focused diffs.
- Update tests with behavior changes.
- Keep CI green: typecheck, test, build.
- Release flow: develop is integration branch, merge develop into main to release.
- CD must keep main auto-deploy behavior for production on Render.
- For multi-agent work, honor strict folder boundaries and shared contracts in backend/src/common.
