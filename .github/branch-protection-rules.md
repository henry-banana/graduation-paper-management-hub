# Branch Protection Rules

This repository follows Git Flow:

- `main` = production
- `develop` = integration
- `feature/*` = new features
- `hotfix/*` = urgent production fixes

## Recommended protection for `main`

- Require pull request before merging
- Require at least 1 approving review
- Dismiss stale approvals on new commits
- Require status checks to pass:
  - `backend`
  - `frontend`
  - `validate-branch-name`
- Require branches to be up to date before merging
- Restrict direct pushes (admins included if your policy requires)
- Require linear history (optional, recommended)

## Recommended protection for `develop`

- Require pull request before merging
- Require at least 1 approving review
- Require status checks to pass:
  - `backend`
  - `frontend`
  - `validate-branch-name`
- Restrict direct pushes

## Merge policy

- Feature flow:
  1. branch from `develop` -> `feature/*`
  2. open PR to `develop`
  3. merge after review approval
- Release flow:
  1. QA pass on `develop`
  2. PR from `develop` -> `main`
  3. merge when checks pass
- Hotfix flow:
  1. branch from `main` -> `hotfix/*`
  2. PR to `main`
  3. merge hotfix back to `develop`

## Note

Branch protection cannot be fully enforced from local Git. Apply these rules in GitHub repository settings or via GitHub API/CLI.
