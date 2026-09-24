; Close only PoolIndex-owned processes before install/uninstall overwrite.
; Never kill chrome.exe, electron.exe, or other apps.
; Never use /T (would kill this installer if launched from PoolIndex).
; Never wait for a graceful close — taskkill without /F hangs if PoolIndex ignores WM_CLOSE.
; Never Ignore locked files — abort with a clear message instead.

!ifndef CLOSE_POOLINDEX_INCLUDED
!define CLOSE_POOLINDEX_INCLUDED

!macro KillPoolIndexImage _IMAGE
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /IM "${_IMAGE}"`
  Pop $R7
!macroend

!macro ClosePoolIndexOrAbort
  DetailPrint "Closing PoolIndex if it is running..."
  !insertmacro KillPoolIndexImage "PoolIndex.exe"
  !insertmacro KillPoolIndexImage "PoolIndex Helper.exe"
  !insertmacro KillPoolIndexImage "PoolIndex Helper (GPU).exe"
  !insertmacro KillPoolIndexImage "PoolIndex Helper (Renderer).exe"
  !insertmacro KillPoolIndexImage "PoolIndex Helper (Plugin).exe"
  !insertmacro KillPoolIndexImage "PoolIndex Helper (Utility).exe"
  Sleep 500
  !insertmacro KillPoolIndexImage "PoolIndex.exe"
  Sleep 500
!macroend

!ifndef BUILD_UNINSTALLER
Function ProbePoolIndexRuntimeFile
  Exch $R0
  StrCpy $R9 0
probe_try:
  IfFileExists "$INSTDIR\$R0" 0 probe_ok
  ClearErrors
  Delete "$INSTDIR\$R0.poolindex-write-test"
  Rename "$INSTDIR\$R0" "$INSTDIR\$R0.poolindex-write-test"
  IfErrors probe_retry
  Rename "$INSTDIR\$R0.poolindex-write-test" "$INSTDIR\$R0"
  IfErrors probe_retry
  Goto probe_ok
probe_retry:
  Delete "$INSTDIR\$R0.poolindex-write-test"
  IntOp $R9 $R9 + 1
  IntCmp $R9 3 probe_fail
  !insertmacro KillPoolIndexImage "PoolIndex.exe"
  Sleep 500
  Goto probe_try
probe_fail:
  Delete "$INSTDIR\$R0.poolindex-write-test"
  MessageBox MB_OK|MB_ICONSTOP "Could not update $INSTDIR\$R0 because PoolIndex still has that file open.$\r$\n$\r$\nClose PoolIndex in Task Manager (end task on PoolIndex.exe), then run this installer again.$\r$\n$\r$\nסגור את PoolIndex במנהל המשימות ואז הרץ שוב את קובץ ההתקנה.$\r$\nDo not Ignore locked files."
  Abort
probe_ok:
  Pop $R0
FunctionEnd

!macro ProbePoolIndexRuntimeWritable
  Push "PoolIndex.exe"
  Call ProbePoolIndexRuntimeFile
  Push "d3dcompiler_47.dll"
  Call ProbePoolIndexRuntimeFile
  Push "ffmpeg.dll"
  Call ProbePoolIndexRuntimeFile
  Push "icudtl.dat"
  Call ProbePoolIndexRuntimeFile
  Push "libEGL.dll"
  Call ProbePoolIndexRuntimeFile
  Push "libGLESv2.dll"
  Call ProbePoolIndexRuntimeFile
  Push "resources.pak"
  Call ProbePoolIndexRuntimeFile
!macroend
!endif

!endif
