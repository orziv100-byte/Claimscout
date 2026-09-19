# Append-only snapshot of the Poolindex working copy on the Windows control PC.
# Does not copy node_modules, .next, or secret env files.
param(
  [string]$Root = "",
  [string]$BackupRoot = ""
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scripts = Split-Path -Parent $here
if (-not $Root) {
  $Root = (Resolve-Path (Join-Path $scripts "..\..")).Path
}
if (-not $BackupRoot) {
  $BackupRoot = Join-Path $env:USERPROFILE "poolindex-backups"
}

& (Join-Path $here "Check-Resources.ps1")

$excludeFile = Join-Path $scripts "exclude.txt"
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$dest = Join-Path $BackupRoot "snapshots\$stamp"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$exclude = @()
if (Test-Path $excludeFile) {
  $exclude = Get-Content $excludeFile | Where-Object { $_ -and -not $_.StartsWith("#") }
}

$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if (-not $tar) {
  throw "tar.exe is required (Windows 10+)."
}

$tarArgs = @("-C", $Root, "-czf", (Join-Path $dest "tree.tar.gz"))
foreach ($e in $exclude) {
  $tarArgs += "--exclude=./$e"
}
$tarArgs += "."
& tar.exe @tarArgs

$archive = Join-Path $dest "tree.tar.gz"
$hash = (Get-FileHash -Algorithm SHA256 $archive).Hash.ToLower()
Set-Content -Path (Join-Path $dest "tree.tar.gz.sha256") -Value "$hash  tree.tar.gz"

$gitHead = "untracked"
$gitBranch = "unknown"
if (Test-Path (Join-Path $Root ".git")) {
  $gitHead = (git -C $Root rev-parse HEAD).Trim()
  $gitBranch = (git -C $Root rev-parse --abbrev-ref HEAD).Trim()
  Set-Content (Join-Path $dest "GIT-HEAD") $gitHead
  Set-Content (Join-Path $dest "GIT-BRANCH") $gitBranch
}

$fileCount = (& tar.exe -tzf $archive | Measure-Object).Count
$manifest = @{
  schema = 1
  created_utc = (Get-Date).ToUniversalTime().ToString("o")
  hostname = $env:COMPUTERNAME
  role = "windows"
  source_root = $Root
  git_head = $gitHead
  git_branch = $gitBranch
  file_count = $fileCount
  archive_bytes = (Get-Item $archive).Length
  archive_sha256 = $hash
  verified = $true
} | ConvertTo-Json
Set-Content (Join-Path $dest "MANIFEST.json") $manifest

$current = Join-Path $BackupRoot "current"
if (Test-Path $current) { Remove-Item $current -Force }
cmd /c "mklink /J `"$current`" `"$dest`"" | Out-Null
Write-Output "snapshot: wrote $dest files=$fileCount sha256=$hash"
