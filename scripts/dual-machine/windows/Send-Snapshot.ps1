# Send the latest Windows snapshot to claimscoutserver as a NEW incoming folder.
# Never mirrors or deletes the Linux live tree.
param(
  [string]$PeerHost = $env:CLAIM_SCOUT_PEER_HOST,
  [string]$PeerUser = $env:CLAIM_SCOUT_PEER_USER,
  [string]$PeerPath = $env:CLAIM_SCOUT_PEER_PATH,
  [string]$BackupRoot = ""
)
$ErrorActionPreference = "Stop"
if (-not $BackupRoot) { $BackupRoot = Join-Path $env:USERPROFILE "claimscout-backups" }
if (-not $PeerHost) { throw "Set CLAIM_SCOUT_PEER_HOST (e.g. claimscoutserver) or pass -PeerHost." }
if (-not $PeerPath) { $PeerPath = "~/claimscout-backups/incoming" }

& (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "Check-Resources.ps1")
& (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "New-Snapshot.ps1") -BackupRoot $BackupRoot

$current = Join-Path $BackupRoot "current"
if (-not (Test-Path $current)) { throw "No current snapshot" }
$name = Split-Path (Get-Item $current).Target -Leaf
$remote = $PeerHost
if ($PeerUser) { $remote = "$PeerUser@$PeerHost" }

$scp = Get-Command scp.exe -ErrorAction SilentlyContinue
if (-not $scp) { throw "scp.exe not found. Install OpenSSH Client on Windows." }

ssh.exe -o BatchMode=yes $remote "mkdir -p $PeerPath"
scp.exe -o BatchMode=yes -r $current "${remote}:${PeerPath}/${name}"
Write-Output "send: ${current} -> ${remote}:${PeerPath}/${name}"
Write-Output "send: on Linux run scripts/dual-machine/receive-snapshot.sh"
