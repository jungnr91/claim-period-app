Unicode true
Name "법령나침반 교육용"
OutFile "..\dist\claim-period-reference-setup-0.2.0.exe"
InstallDir "$LOCALAPPDATA\Programs\LawCompassTraining"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "..\assets\icon.ico"
UninstallIcon "..\assets\icon.ico"
VIProductVersion "0.2.0.0"
VIAddVersionKey "ProductName" "법령나침반 교육용"
VIAddVersionKey "FileDescription" "국가채권 규정 탐색 및 기간 참고 교육용 설치 프로그램"
VIAddVersionKey "FileVersion" "0.2.0"
VIAddVersionKey "LegalCopyright" "교육용 시제품"

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"

Section "설치"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "..\dist\win-unpacked\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\법령나침반 교육용"
  CreateShortCut "$SMPROGRAMS\법령나침반 교육용\법령나침반 교육용.lnk" "$INSTDIR\법령나침반 교육용.exe"
  CreateShortCut "$DESKTOP\법령나침반 교육용.lnk" "$INSTDIR\법령나침반 교육용.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LawCompassTraining" "DisplayName" "법령나침반 교육용"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LawCompassTraining" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LawCompassTraining" "InstallLocation" "$INSTDIR"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\법령나침반 교육용.lnk"
  Delete "$SMPROGRAMS\법령나침반 교육용\법령나침반 교육용.lnk"
  RMDir "$SMPROGRAMS\법령나침반 교육용"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LawCompassTraining"
  RMDir /r "$INSTDIR"
SectionEnd
