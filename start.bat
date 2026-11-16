@echo off
setlocal
title BookmarkHub Launcher

set "BOOKMARKHUB_ROOT=%~dp0"
set "BOOKMARKHUB_PORT=4399"
set "BOOKMARKHUB_URL=http://localhost:%BOOKMARKHUB_PORT%"
cd /d "%BOOKMARKHUB_ROOT%"

node -v >nul 2>&1
if errorlevel 1 goto NO_NODE

call :CHECK_RUNNING
if not errorlevel 1 goto OPEN_BROWSER

echo ======================================================
echo          BookmarkHub Windows Launcher
echo ======================================================
echo.

if not exist "node_modules\.bin\tsc.cmd" goto RUN_INSTALL
goto CHECK_BUILD

:RUN_INSTALL
set "FIRST_RUN=1"
echo [INFO] Installing missing dependencies...
echo [INFO] This may take a few minutes.
call npm.cmd install
if errorlevel 1 goto INSTALL_FAILED

:CHECK_BUILD
if not exist "apps\web\.next\BUILD_ID" goto RUN_BUILD
if "%FIRST_RUN%"=="1" goto RUN_BUILD
goto START_SERVICE

:RUN_BUILD
echo [INFO] Creating the production build...
call npm.cmd run build
if errorlevel 1 goto BUILD_FAILED

:START_SERVICE
echo [INFO] Starting the BookmarkHub production server in a minimized window...
echo [INFO] The browser will open as soon as the local port is ready.
start "BookmarkHub Service" /min "%ComSpec%" /d /k "call npm.cmd run start"
call :WAIT_FOR_SERVICE
if errorlevel 1 goto START_FAILED

:OPEN_BROWSER
echo [INFO] Opening %BOOKMARKHUB_URL%
start "" "%BOOKMARKHUB_URL%"
endlocal
exit /b 0

:CHECK_RUNNING
node -e "var net=require('net'),socket=net.connect(%BOOKMARKHUB_PORT%,'127.0.0.1');socket.setTimeout(1000);socket.on('connect',function(){socket.destroy();process.exit(0)});socket.on('timeout',function(){socket.destroy();process.exit(1)});socket.on('error',function(){process.exit(1)})" >nul 2>&1
exit /b %errorlevel%

:WAIT_FOR_SERVICE
set /a "BOOKMARKHUB_ATTEMPTS=0"
:WAIT_LOOP
call :CHECK_RUNNING
if not errorlevel 1 exit /b 0
set /a "BOOKMARKHUB_ATTEMPTS+=1"
if %BOOKMARKHUB_ATTEMPTS% GEQ 120 exit /b 1
ping.exe 127.0.0.1 -n 2 >nul
goto WAIT_LOOP

:NO_NODE
echo [ERROR] Node.js 18 or newer is required.
start "" "https://nodejs.org/"
pause
endlocal
exit /b 1

:INSTALL_FAILED
echo [ERROR] npm install failed. Check the network connection and try again.
pause
endlocal
exit /b 1

:BUILD_FAILED
echo [ERROR] The core package build failed.
pause
endlocal
exit /b 1

:START_FAILED
echo [ERROR] BookmarkHub did not become ready within two minutes.
echo [INFO] Restore the minimized "BookmarkHub Service" window to inspect the error.
pause
endlocal
exit /b 1