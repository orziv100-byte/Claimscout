# Register a 30-minute Task Scheduler job on the Windows control PC.
param(
  [string]$TaskName = "ClaimScout-Backup"
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $here "New-Snapshot.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Description "Append-only Claim Scout snapshot on the Windows control PC" -Force | Out-Null
Write-Output "install: scheduled task $TaskName every 30 minutes"
Write-Output "install: this never deletes Linux snapshots. After SSH is set, also run Send-Snapshot.ps1."
