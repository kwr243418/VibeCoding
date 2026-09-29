@echo off
chcp 65001 >nul
rem 작성: 2026-09-30 00:05
rem Windows에서 더블클릭하면 이 창에서 웹 서버를 켜고 브라우저를 여는 스크립트
rem 이 창을 닫거나 Ctrl+C를 누르면 서버가 꺼진다

rem 이 파일이 있는 web_version 폴더로 이동
cd /d "%~dp0"
set "URL=http://127.0.0.1:8000"

rem 가상환경은 웹/데스크톱 버전이 함께 쓰도록 상위(Study-01) 폴더에 둔다
set "VENV=..\.venv"

rem 가상환경이 없으면 새로 만들고 필요한 패키지 설치 (처음 한 번만)
if not exist "%VENV%\Scripts\python.exe" (
  echo 가상환경을 만들고 패키지를 설치합니다... 처음 한 번만 몇 분 걸립니다.
  where py >nul 2>nul && (py -3 -m venv "%VENV%") || (python -m venv "%VENV%")
  if not exist "%VENV%\Scripts\python.exe" (
    echo.
    echo [오류] 가상환경을 만들지 못했습니다. Python 3.11 이상을 설치했는지 확인하세요.
    echo        https://www.python.org/downloads/ 에서 설치할 때 "Add python.exe to PATH"를 체크하세요.
    pause
    exit /b 1
  )
  "%VENV%\Scripts\python.exe" -m pip install -q -r ..\requirements.txt
  if errorlevel 1 (
    echo.
    echo [오류] 패키지 설치에 실패했습니다. 위 메시지를 확인하세요.
    rmdir /s /q "%VENV%"
    pause
    exit /b 1
  )
)

rem 다른 창에서 서버가 이미 실행 중이면 브라우저만 열기
netstat -ano | findstr /r /c:"127.0.0.1:8000 .*LISTENING" >nul
if not errorlevel 1 (
  echo 서버가 이미 다른 창에서 실행 중입니다. 브라우저만 엽니다.
  start "" "%URL%"
  timeout /t 3 >nul
  exit /b 0
)

rem 서버를 이 창에서 실행하고, 준비되면 브라우저 자동 열기
echo 웹 서버를 실행합니다: %URL%
echo 서버를 끄려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo.
"%VENV%\Scripts\python.exe" app.py --open-browser
if errorlevel 1 pause
