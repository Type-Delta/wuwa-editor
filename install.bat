@echo off

pushd "%~dp0"
set currentPath=%~dp0


where wt>nul 2>nul
if %ERRORLEVEL% NEQ 0 (
   set noWt=true
   echo Windows Terminal is not installed,
   echo it's highly recommended to use this program with Windows Terminal for the best experience.
   pause

   :: reset error level
   set ERRORLEVEL=0
)

echo Installing dependencies...
call npm install

echo creating launch script...
echo :: Auto-generated launch script for wuwa-editor> wuwa-editor.bat
echo :: Run "install.bat" to update this file>> wuwa-editor.bat
echo @echo off>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo pushd "%%~dp0">> wuwa-editor.bat
echo set programPath=%currentPath%>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo :: check path>> wuwa-editor.bat
echo if not exist anchor.wuwa-editor ^(>> wuwa-editor.bat
echo cd "%%programPath%%">> wuwa-editor.bat
echo if not exist anchor.wuwa-editor ^(>> wuwa-editor.bat
echo echo Can't find anchor file, did you change the program's location?>> wuwa-editor.bat
echo echo if so, please run "install.bat" again.>> wuwa-editor.bat
echo echo Current Dir: %%~dp0>> wuwa-editor.bat
echo pause>> wuwa-editor.bat
echo goto EOF>> wuwa-editor.bat
echo ^)>> wuwa-editor.bat
echo ^)>> wuwa-editor.bat
echo npm run start>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo :EOF>> wuwa-editor.bat

echo this file tells the launch script it's in the correct directory> anchor.wuwa-editor
echo DO NOT REMOVE!>> anchor.wuwa-editor

echo creating shortcut...
:: create shortcut that always run as admin
:: @from https://stackoverflow.com/a/29002207
powershell "$WshShell = New-Object -comObject WScript.Shell;$Shortcut = $WshShell.CreateShortcut('launcher.lnk');$Shortcut.TargetPath = '%currentPath%wuwa-editor.bat';$Shortcut.Save();$bytes = [System.IO.File]::ReadAllBytes('launcher.lnk');$bytes[0x15] = $bytes[0x15] -bor 0x20;[System.IO.File]::WriteAllBytes('launcher.lnk', $bytes)"
echo Shortcut created at: "%currentPath%launcher.lnk"


if %ERRORLEVEL% EQU 0 (
   echo all done!
   echo.
   echo you can now run the program by double-clicking the created Shortcut ^(file named "launcher"^)
   echo Tip: you can copy the shortcut to your desktop ^(or any where you see fit^) to for easy access
) else (
   echo something went wrong, please check the error message above ^(if any^)
   echo if you can't figure it out, please report the issue on the GitHub page
)

pause