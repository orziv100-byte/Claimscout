# Main Windows PC — resource check before any heavy Poolindex job.
$ErrorActionPreference = "Stop"
$minRamMb = 3072
$maxDiskPct = 88

$os = Get-CimInstance Win32_OperatingSystem
$freeMb = [int]($os.FreePhysicalMemory / 1024)
$totalMb = [int]($os.TotalVisibleMemorySize / 1024)
$usedPct = [math]::Round(100 - (100.0 * $freeMb / [math]::Max($totalMb, 1)), 1)
$cpu = Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average
$disk = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | Sort-Object Used -Descending | Select-Object -First 1
$diskPct = 0
if ($disk -and ($disk.Used + $disk.Free) -gt 0) {
  $diskPct = [math]::Round(100.0 * $disk.Used / ($disk.Used + $disk.Free), 1)
}

Write-Output "ram_available_mb=$freeMb ram_used_pct=$usedPct cpu_load_pct=$($cpu.Average) disk_used_pct=$diskPct"
if ($freeMb -lt $minRamMb) {
  Write-Error "REFUSE: RAM available ${freeMb}MB < ${minRamMb}MB. Move independent work to poolindexserver."
  exit 2
}
if ($diskPct -ge $maxDiskPct) {
  Write-Error "REFUSE: disk ${diskPct}% >= ${maxDiskPct}%"
  exit 2
}
Write-Output "OK: Windows control machine has enough headroom for light work."
exit 0
