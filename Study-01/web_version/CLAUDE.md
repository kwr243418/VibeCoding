<!-- 작성: 2026-09-29 23:19 / 수정: 2026-09-29 23:26 (웹 버전 구현), 2026-09-29 23:29 (Finder 실행용 앱 번들), 2026-09-29 23:40 (.command 방식으로 변경), 2026-09-30 00:05 (Windows .bat) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

공통 규칙(한국어 주석, 파일 상단 날짜·시간 주석, 공용 `.venv`)은 상위 폴더의 `../CLAUDE.md`를 따른다.

## 개요

손글씨 숫자 인식의 웹 버전. **Flask 서버 + 브라우저 HTML 캔버스** 방식이다. 테스트·린트 설정은 없다.

## 명령어

```bash
# web_version/ 에서 실행 → http://127.0.0.1:8000 (macOS는 5000번을 AirPlay가 쓰므로 8000번 사용)
../.venv/bin/python app.py      # 모델 파일이 없으면 자동으로 학습부터 진행
../.venv/bin/python train.py    # 모델만 다시 학습 → mnist_mlp.joblib
```

Finder에서 `숫자인식(웹).command`를 더블클릭해도 실행된다. Terminal 창이 열리고 그 창의 foreground에서 서버가 돌며(`exec`), 서버가 응답하면 기본 브라우저로 페이지를 연다. 창을 닫거나 Ctrl+C를 누르면(SIGHUP/SIGINT) 서버가 꺼진다. 포트가 이미 쓰이는 경우 터미널 없는(tty가 `??`) 서버면 종료 후 다시 실행하고, 다른 터미널 창에서 도는 서버면 브라우저만 연다.

Windows용 `숫자인식(웹).bat`는 `chcp 65001`을 쓰는 UTF-8 배치 파일이며 CRLF 줄바꿈이어야 한다(저장소 루트 `.gitattributes`가 `*.bat`을 CRLF로 체크아웃). 새로 쓰거나 고칠 때 LF로 저장하지 말 것. 이 Mac에서는 실행해 볼 수 없어 Windows 동작은 검증되지 않았다. 서버는 창에서 `app.py --open-browser`로 실행하며(창을 닫으면 종료), 브라우저 열기는 배치 파일이 아니라 `app.py`의 `open_browser_when_ready()` 스레드가 한다. 8000번이 이미 LISTENING이면 브라우저만 연다.

`.app` 번들 방식은 쓰지 않는다. 서명 없는 백그라운드 앱의 런처에서 `open -a Terminal x.command`를 호출하면 macOS가 오류 없이 요청을 무시해 Terminal 창이 열리지 않았다(`open`의 종료 코드는 0).

## 구조

- `app.py` — Flask 서버. `GET /`는 `templates/index.html`을 렌더링, `POST /predict`는 `{"image": "<PNG data URL>"}`을 받아 `{"digit": int|null, "probs": [10개]}`를 돌려준다(빈 캔버스는 `digit: null`, 잘못된 요청은 400). 모델은 모듈 로드 시 한 번 읽는다.
- `templates/index.html` — 캔버스·버튼·확률 막대와 JS가 모두 들어 있는 단일 파일. Pointer Events로 마우스·터치를 함께 처리하고, 획이 끝나면 400ms 뒤 자동으로 `/predict`를 호출한다. 캔버스는 CSS 크기와 실제 픽셀 크기를 모두 `CANVAS_SIZE`(280)로 맞춰 서버 전처리와 일치시킨다(템플릿 변수 `canvas_size`로 전달).
- `train.py`, `mnist_mlp.joblib` — 데스크톱 버전에서 복사한 것.

## 데스크톱 버전과의 관계

`web_version/`은 독립 폴더이므로 `../desktop_version`의 파일을 import하지 않는다. 학습 스크립트·모델·전처리는 복사본을 이 폴더에 둔다.

- 전처리: `app.py`의 `preprocess()`는 `../desktop_version/digit_app.py`의 것과 동일한 복사본이다. 인식 정확도를 좌우하므로 한쪽을 고치면 다른 쪽도 맞출지 검토할 것 — bounding box 크롭 → 긴 변 20px 축소 → 28×28 중앙 배치 → 무게중심 (14,14) 이동 → 0~1 정규화, (1, 784) flatten.
- 캔버스는 검은 바탕·흰 글씨(MNIST와 동일)여야 한다. 흰 바탕으로 바꾸면 서버에서 반전해야 한다.
