@echo off
set currentPath=%~dp0


where wt>nul 2>nul
if %ERRORLEVEL% NEQ 0 (
   set noWt=true
   echo Windows Terminal is not installed,
   echo it's highly recommended to install it before running this program.
   pause
)


echo Installing dependencies...
@REM npm install

echo creating launch script...
echo :: Auto-generated launch script for wuwa-editor> wuwa-editor.bat
echo :: Run "install.bat" to update this file>> wuwa-editor.bat
echo @echo off>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo pushd "%%~dp0">> wuwa-editor.bat
echo set programPath=%currentPath%>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo :: check path>> wuwa-editor.bat
echo if not exist wuwa-editor.anchor ^(>> wuwa-editor.bat
echo cd "%%programPath%%">> wuwa-editor.bat
echo if not exist wuwa-editor.anchor ^(>> wuwa-editor.bat
echo echo Can't find anchor file, did you change the program's location?>> wuwa-editor.bat
echo echo if so, please run "install.bat" again.>> wuwa-editor.bat
echo pause>> wuwa-editor.bat
echo ^)>> wuwa-editor.bat
echo ^)>> wuwa-editor.bat
echo npm run start>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo.>> wuwa-editor.bat
echo :EOF>> wuwa-editor.bat

echo this file tells the launch script it's in the currect directory> wuwa-editor.anchor
echo DO NOT REMOVE!>> wuwa-editor.anchor

echo creating shortcut...
src\module\createShortcut.bat %currentPath%\wuwa-editor.bat

echo all done!
