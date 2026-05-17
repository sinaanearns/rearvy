!include "LogicLib.nsh"

!define MUI_COMPONENTSPAGE_TEXT_TOP "Select the additional tasks you would like Setup to perform while installing Rearvy, then click Next."
!define MUI_STARTMENUPAGE_DEFAULTFOLDER "Rearvy"
!define MUI_STARTMENUPAGE_REGISTRY_ROOT "HKCU"
!define MUI_STARTMENUPAGE_REGISTRY_KEY "Software\Rearvy"
!define MUI_STARTMENUPAGE_REGISTRY_VALUENAME "StartMenuFolder"

; Define Application-specific start menu macros expected by MUI when a named page is used
!define MUI_STARTMENUPAGE_Application_DEFAULTFOLDER "Rearvy"
!define MUI_STARTMENUPAGE_Application_REGISTRY_ROOT "HKCU"
!define MUI_STARTMENUPAGE_Application_REGISTRY_KEY "Software\Rearvy"
!define MUI_STARTMENUPAGE_Application_REGISTRY_VALUENAME "StartMenuFolder"

Var StartMenuFolder

!macro customHeader
  ; MUI_HEADERIMAGE is passed by electron-builder via command line; no duplicate define needed.
!macroend

!macro customWelcomePage
  ; Cursor-style assisted installer pages after the license page.
  !insertmacro MUI_PAGE_DIRECTORY
  !insertmacro MUI_PAGE_STARTMENU Application $StartMenuFolder
  !insertmacro MUI_PAGE_COMPONENTS
!macroend

!macro customInit
  ; Per-user install with a friendly default location.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Rearvy"
!macroend

Section /o "Create a desktop icon" SecDesktopIcon
  CreateShortCut "$DESKTOP\Rearvy.lnk" "$INSTDIR\Rearvy.exe"
SectionEnd

Section /o 'Add "Open with Rearvy" action to Windows Explorer file context menu' SecFileContext
  WriteRegStr HKCU "Software\Classes\*\shell\Open with Rearvy" "" "Open with Rearvy"
  WriteRegStr HKCU "Software\Classes\*\shell\Open with Rearvy" "Icon" "$INSTDIR\Rearvy.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\Open with Rearvy\command" "" '"$INSTDIR\Rearvy.exe" "%1"'
SectionEnd

Section /o 'Add "Open with Rearvy" action to Windows Explorer directory context menu' SecDirectoryContext
  WriteRegStr HKCU "Software\Classes\Directory\shell\Open with Rearvy" "" "Open with Rearvy"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Open with Rearvy" "Icon" "$INSTDIR\Rearvy.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\Open with Rearvy\command" "" '"$INSTDIR\Rearvy.exe" "%V"'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Open with Rearvy" "" "Open with Rearvy"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Open with Rearvy" "Icon" "$INSTDIR\Rearvy.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\Open with Rearvy\command" "" '"$INSTDIR\Rearvy.exe" "%V"'
SectionEnd

Section "Register Rearvy as an editor for supported file types" SecAssoc
  WriteRegStr HKCU "Software\Classes\.rvy" "" "RearvyFile"
  WriteRegStr HKCU "Software\Classes\.rearvy" "" "RearvyFile"
  WriteRegStr HKCU "Software\Classes\RearvyFile" "" "Rearvy file"
  WriteRegStr HKCU "Software\Classes\RearvyFile\DefaultIcon" "" "$INSTDIR\Rearvy.exe,0"
  WriteRegStr HKCU "Software\Classes\RearvyFile\Shell\Open\Command" "" '"$INSTDIR\Rearvy.exe" "%1"'
SectionEnd

Section "Add to PATH (requires shell restart)" SecAddPath
  Call AddRearvyToPath
SectionEnd

Function WriteRearvyCommandShim
  FileOpen $0 "$INSTDIR\rearvy.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "start $\"$\" $\"%~dp0Rearvy.exe$\" %*$\r$\n"
  FileClose $0
FunctionEnd

Function AddRearvyToPath
  Call WriteRearvyCommandShim
FunctionEnd

Function un.RemoveRearvyFromPath
FunctionEnd

!macro customInstall
  Call WriteRearvyCommandShim
  !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
    CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
    CreateShortCut "$SMPROGRAMS\$StartMenuFolder\Rearvy.lnk" "$INSTDIR\Rearvy.exe"
  !insertmacro MUI_STARTMENU_WRITE_END
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Rearvy.lnk"
  Delete "$INSTDIR\rearvy.cmd"

  !insertmacro MUI_STARTMENU_GETFOLDER Application $StartMenuFolder
  Delete "$SMPROGRAMS\$StartMenuFolder\Rearvy.lnk"
  RMDir "$SMPROGRAMS\$StartMenuFolder"

  DeleteRegKey HKCU "Software\Classes\*\shell\Open with Rearvy"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Open with Rearvy"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Open with Rearvy"
  DeleteRegKey HKCU "Software\Classes\.rvy"
  DeleteRegKey HKCU "Software\Classes\.rearvy"
  DeleteRegKey HKCU "Software\Classes\RearvyFile"

  Call un.RemoveRearvyFromPath
!macroend
