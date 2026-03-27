# graduation-paper-management-hub

## Quick setup

### 1) Install dependencies

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 2) Enable local git hooks

```bash
git config core.hooksPath .githooks
```

### 3) Create integration branch

```bash
git branch develop main
```

### 4) Run local stack with Docker Compose

```bash
docker compose up --build
```

## Branching model

- `main`: production
- `develop`: integration
- `feature/*`: new features
- `hotfix/*`: urgent fixes from production

## Automated local flow (except push)

### Task-level commit

```powershell
./scripts/task-complete.ps1 -Type feat -Scope frontend -Description "add dashboard topic data grid"
```

### Phase-level commit

```powershell
./scripts/phase-complete.ps1 -Phase "03-frontend" -Description "finish phase 03 frontend"
```

Both commands run checks and create conventional commits.
Push remains manual by design.

## Do I need gh?

- You do not need `gh` for normal development flow.
- `git` is enough if you push manually and open PR on GitHub web.
- `gh` is optional for automating remote operations (branch protection/PR from CLI).

See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) and [.github/branch-protection-rules.md](.github/branch-protection-rules.md) for full process and branch protection requirements.
