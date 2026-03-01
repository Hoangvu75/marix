; Force-close stale Marix processes before electron-builder's default
; app-running checks. This avoids false-positive "Marix cannot be closed"
; prompts during upgrades/reinstalls.
!macro customCheckAppRunning
  DetailPrint "Closing running Marix processes..."

  nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" >nul 2>nul`
  Pop $0
  Sleep 400

  nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" >nul 2>nul`
  Pop $0
  Sleep 400

  nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" >nul 2>nul`
  Pop $0
  Sleep 600
!macroend
