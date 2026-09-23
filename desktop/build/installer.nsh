; PoolIndex branded NSIS extras. electron-builder still generates the installer.
; Closed Beta: unsigned. No secrets.

!define MUI_BGCOLOR "0B0F14"
!define MUI_TEXTCOLOR "F5F7FA"
!define MUI_INSTFILESPAGE_COLORS "F5F7FA 0B0F14"
BrandingText "PoolIndex Closed Beta"

!include "${__FILEDIR__}\close-poolindex.nsh"

!macro customCheckAppRunning
  !insertmacro ClosePoolIndexOrAbort
  !ifndef BUILD_UNINSTALLER
    !insertmacro ProbePoolIndexRuntimeWritable
  !endif
!macroend
