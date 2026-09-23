Unicode true
Name "PoolIndex"
Caption "PoolIndex Setup"
OutFile "dist\PoolIndex-0.1.0-win.exe"
InstallDir "$LOCALAPPDATA\Programs\PoolIndex"
InstallDirRegKey HKCU "Software\PoolIndex" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "PoolIndex Closed Beta"

!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\PoolIndex.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch PoolIndex"

VIProductVersion "0.1.0.0"
VIAddVersionKey "ProductName" "PoolIndex"
VIAddVersionKey "ProductVersion" "0.1.0"
VIAddVersionKey "FileVersion" "0.1.0"
VIAddVersionKey "FileDescription" "PoolIndex Windows installer"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Lior Elbaz, Israel. All rights reserved."
VIAddVersionKey "CompanyName" "Lior Elbaz"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "dist\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\PoolIndex" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "DisplayName" "PoolIndex"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "DisplayVersion" "0.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "Publisher" "Lior Elbaz"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex" "DisplayIcon" "$INSTDIR\PoolIndex.exe"
  CreateDirectory "$SMPROGRAMS\PoolIndex"
  CreateShortCut "$SMPROGRAMS\PoolIndex\PoolIndex.lnk" "$INSTDIR\PoolIndex.exe"
  CreateShortCut "$DESKTOP\PoolIndex.lnk" "$INSTDIR\PoolIndex.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\PoolIndex.lnk"
  RMDir /r "$SMPROGRAMS\PoolIndex"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\PoolIndex"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PoolIndex"
SectionEnd
