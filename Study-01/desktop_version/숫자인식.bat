@echo off
chcp 65001 >nul
rem 작성: 2026-09-30 00:05
rem Windows에서 더블클릭하면 데스크톱 버전 손글씨 숫자 인식 프로그램을 실행하는 스크립트

rem 이 파일이 있는 desktop_version 폴더로 이동
cd /d "%~dp0"

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

rem 데스크톱 프로그램 실행 (프로그램 창을 닫으면 이 창도 닫힘)
"%VENV%\Scripts\python.exe" digit_app.py
if errorlevel 1 pause
