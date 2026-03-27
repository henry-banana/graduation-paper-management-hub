param(
  [Parameter(Mandatory = $false)]
  [string]$Owner = "henry-banana",

  [Parameter(Mandatory = $false)]
  [string]$Repo = "graduation-paper-management-hub"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Set-Protection {
  param(
    [string]$Branch,
    [int]$Approvals
  )

  $body = @{
    required_status_checks = @{
      strict = $true
      contexts = @("backend", "frontend", "validate-branch-name")
    }
    enforce_admins = $true
    required_pull_request_reviews = @{
      dismiss_stale_reviews = $true
      required_approving_review_count = $Approvals
    }
    restrictions = $null
    required_linear_history = $true
    allow_force_pushes = $false
    allow_deletions = $false
  } | ConvertTo-Json -Depth 10

  $tempFile = [System.IO.Path]::GetTempFileName()
  try {
    Set-Content -Path $tempFile -Value $body -Encoding UTF8
    gh api "/repos/$Owner/$Repo/branches/$Branch/protection" `
      --method PUT `
      --header "Accept: application/vnd.github+json" `
      --input $tempFile | Out-Null
  }
  finally {
    Remove-Item -Path $tempFile -ErrorAction SilentlyContinue
  }

  Write-Host "Applied protection for branch: $Branch"
}

Write-Host "Applying branch protection rules for $Owner/$Repo ..."
Set-Protection -Branch "main" -Approvals 1
Set-Protection -Branch "develop" -Approvals 1
Write-Host "Done."
