
set target=%~1
powershell "$WshShell = New-Object -comObject WScript.Shell;$Shortcut = $WshShell.CreateShortcut('wuwa-editor.lnk');$Shortcut.TargetPath = '%target%';$Shortcut.Save();$bytes = [System.IO.File]::ReadAllBytes('wuwa-editor.lnk');$bytes[0x15] = $bytes[0x15] -bor 0x20;[System.IO.File]::WriteAllBytes('wuwa-editor.lnk', $bytes)"