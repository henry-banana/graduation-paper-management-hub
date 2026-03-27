param(
  [Parameter(Mandatory = $true)]
  [string]$Phase,

  [Parameter(Mandatory = $true)]
  [string]$Description,

  [Parameter(Mandatory = $false)]
  [string]$Type = "chore",

  [Parameter(Mandatory = $false)]
  [string]$Scope = "workflow",

  [Parameter(Mandatory = $false)]
  [switch]$SkipChecks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Description.Length -gt 72) {
  throw "Description must be <= 72 chars for conventional commits."
}

Write-Host "Staging all changes for phase completion..."
git add -A

$staged = git diff --cached --name-only
if ([string]::IsNullOrWhiteSpace($staged)) {
  throw "No staged changes."
}

if (-not $SkipChecks) {
  if (Test-Path "backend/package.json") {
    Write-Host "Running backend checks..."
    npm --prefix backend run test
    npm --prefix backend run build
  }

  if (Test-Path "frontend/package.json") {
    Write-Host "Running frontend checks..."
    npm --prefix frontend run lint
    npm --prefix frontend run build
  }
}

$header = "{0}({1}): {2}" -f $Type, $Scope, $Description
Write-Host "Creating phase commit: $header"
git commit -m $header

$branch = git rev-parse --abbrev-ref HEAD
Write-Host "Phase [$Phase] commit done on branch: $branch"
Write-Host "No push performed."
Write-Host "Next manual steps:"
Write-Host "1) git push -u origin $branch"
Write-Host "2) Create PR to develop (or main for release/hotfix)"
