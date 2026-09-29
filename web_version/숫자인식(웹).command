#!/bin/zsh
# 작성: 2026-09-29 23:36 / 수정: 2026-09-29 23:44 (requirements.txt로 설치)
# 터미널 창에서 웹 서버를 실행하는 스크립트 (이 터미널 창을 닫거나 Ctrl+C를 누르면 서버가 꺼짐)

# 이 스크립트가 있는 web_version 폴더로 이동
cd "$(dirname "$0")"

# 가상환경은 웹/데스크톱 버전이 함께 쓰도록 상위(프로젝트 루트) 폴더에 둔다
VENV="../.venv"
PORT=8000
URL="http://127.0.0.1:$PORT"

# 가상환경이 없으면 새로 만들고 필요한 패키지 설치
if [ ! -x "$VENV/bin/python" ]; then
  echo "가상환경을 만들고 패키지를 설치합니다... (처음 한 번만)"
  # Homebrew 파이썬이 있으면 쓰고, 없으면 macOS 기본 python3 사용
  PY=/opt/homebrew/bin/python3; [ -x "$PY" ] || PY=/usr/bin/python3
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install -q -r ../requirements.txt
fi

# 이미 서버가 실행 중인 경우
PID=$(/usr/sbin/lsof -tiTCP:$PORT -sTCP:LISTEN)
if [ -n "$PID" ]; then
  if [ "$(ps -o tty= -p $PID | tr -d ' ')" = "??" ]; then
    # 터미널 없이 백그라운드로 떠 있는 서버는 끌 방법이 없으므로 종료하고 이 창에서 다시 실행
    echo "백그라운드에서 실행 중이던 서버(PID $PID)를 종료하고 이 창에서 다시 실행합니다."
    kill $PID
    sleep 1
  else
    # 다른 터미널 창에서 이미 실행 중이면 브라우저만 열기
    echo "서버가 이미 다른 터미널 창에서 실행 중입니다. 브라우저만 엽니다."
    /usr/bin/open "$URL"
    exit 0
  fi
fi

# 서버가 응답하면 기본 브라우저로 페이지 열기 (백그라운드에서 대기)
# 모델이 없으면 학습부터 하므로 최대 10분까지 기다림
(
  for i in {1..1200}; do
    /usr/bin/curl -s -o /dev/null "$URL" && { /usr/bin/open "$URL"; break; }
    sleep 0.5
  done
) &!

# 서버를 이 터미널 창에서 실행
echo "웹 서버를 실행합니다: $URL"
echo "서버를 끄려면 이 창을 닫거나 Ctrl+C를 누르세요."
echo
exec "$VENV/bin/python" app.py
