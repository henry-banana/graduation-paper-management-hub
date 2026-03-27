# Git Flow Process

## Branch model

- `main`: production branch
- `develop`: integration branch
- `feature/*`: new feature branches (from `develop`)
- `hotfix/*`: urgent production fixes (from `main`)

## Push and merge rules

- After each task is done -> create a conventional commit
- After each phase is done -> push branch and create PR
- After review approval -> merge into `develop`
- After QA pass -> merge `develop` into `main`
- Hotfix:
  1. create from `main`
  2. fix and PR to `main`
  3. merge the same fix back into `develop`

## Commit format

Use Conventional Commits:

- `feat(scope): ...`
- `fix(scope): ...`
- `docs(scope): ...`
- `chore(scope): ...`

## Hooks and automation

- Local hooks path: `.githooks`
- `commit-msg`: validates conventional commit format
- `pre-commit`: blocks secrets and merge conflict markers
- `pre-push`: runs project checks before pushing
- GitHub Actions:
  - `ci.yml`: backend and frontend quality checks
  - `branch-name-check.yml`: enforces branch naming patterns

## Branch naming examples

- `feature/topic-dashboard-filters`
- `feature/notifications-unread-badge`
- `hotfix/jwt-expiry-validation`
- `release/1.0.0`
