param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert")]
  [string]$Type,

  [Parameter(Mandatory = $true)]
  [string]$Scope,

  [Parameter(Mandatory = $true)]
  [string]$Description,

  [Parameter(Mandatory = $false)]
  [string[]]$Paths,

  [Parameter(Mandatory = $false)]
  [switch]$SkipChecks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Description.Length -gt 72) {
  throw "Description must be <= 72 chars for conventional commits."
}

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
  Write-Host "No changes detected. Nothing to commit."
  exit 0
}

if ($Paths -and $Paths.Count -gt 0) {
  Write-Host "Staging selected paths..."
  git add -- @Paths
} else {
  Write-Host "Staging all changes..."
  git add -A
}

$staged = git diff --cached --name-only
if ([string]::IsNullOrWhiteSpace($staged)) {
  throw "No staged changes."
}

$touchBackend = $false
$touchFrontend = $false
foreach ($file in ($staged -split "`n")) {
  if ($file.StartsWith("backend/")) { $touchBackend = $true }
  if ($file.StartsWith("frontend/")) { $touchFrontend = $true }
}

if (-not $SkipChecks) {
  if ($touchBackend -and (Test-Path "backend/package.json")) {
    Write-Host "Running backend checks..."
    npm --prefix backend run test
    npm --prefix backend run build
  }

  if ($touchFrontend -and (Test-Path "frontend/package.json")) {
    Write-Host "Running frontend checks..."
    npm --prefix frontend run lint
    npm --prefix frontend run build
  }
}

$header = "{0}({1}): {2}" -f $Type, $Scope, $Description
Write-Host "Creating commit: $header"
git commit -m $header

Write-Host "Done. Commit created. No push performed."
