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

See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) and [.github/branch-protection-rules.md](.github/branch-protection-rules.md) for full process and branch protection requirements.
