Unicode true
Name "PoolIndex"
Caption "PoolIndex"
OutFile "dist\PoolIndex-0.1.3-win.exe"
InstallDir "$LOCALAPPDATA\Programs\PoolIndex"
InstallDirRegKey HKCU "Software\PoolIndex" "InstallDir"
RequestExecutionLevel user
SetCompressor lzma
SetOverwrite on
BrandingText "PoolIndex 0.1.3"
ShowInstDetails show

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "build\close-poolindex.nsh"
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_BGCOLOR 0B0F14
!define MUI_TEXTCOLOR F5F7FA
!define MUI_INSTFILESPAGE_COLORS "F5F7FA 0B0F14"
!define MUI_FINISHPAGE_RUN "$INSTDIR\PoolIndex.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch PoolIndex"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_PAGE_CUSTOMFUNCTION_PRE skipDir
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
FunctionEnd

Function skipDir
FunctionEnd

VIProductVersion "0.1.3.0"
VIAddVersionKey "ProductName" "PoolIndex"
VIAddVersionKey "ProductVersion" "0.1.3"
VIAddVersionKey "FileVersion" "0.1.3"
VIAddVersionKey "FileDescription" "PoolIndex Windows installer"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Lior Elbaz, Israel. All rights reserved."
VIAddVersionKey "CompanyName" "Lior Elbaz"

Section "Install"
  !insertmacro ClosePoolIndexOrAbort
  !insertmacro ProbePoolIndexRuntimeWritable
  SetOutPath "$INSTDIR"
  File /r "dist\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\PoolIndex" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "DisplayName" "PoolIndex"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "DisplayVersion" "0.1.3"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "Publisher" "Lior Elbaz"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "DisplayIcon" "$INSTDIR\PoolIndex.exe"
  CreateDirectory "$SMPROGRAMS\PoolIndex"
  CreateShortCut "$SMPROGRAMS\PoolIndex\PoolIndex.lnk" "$INSTDIR\PoolIndex.exe"
  CreateShortCut "$DESKTOP\PoolIndex.lnk" "$INSTDIR\PoolIndex.exe"
SectionEnd

Section "Uninstall"
  !insertmacro ClosePoolIndexOrAbort
  Delete "$DESKTOP\PoolIndex.lnk"
  RMDir /r "$SMPROGRAMS\PoolIndex"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\PoolIndex"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex"
  ; Keep %APPDATA%\PoolIndex and updater cache. Do not delete account/session data.
SectionEnd
