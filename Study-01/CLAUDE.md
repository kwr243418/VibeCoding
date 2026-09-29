<!-- 작성: 2026-09-29 23:16 / 수정: 2026-09-29 23:19 (웹·데스크톱 버전 분리), 2026-09-29 23:44 (requirements.txt) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

MNIST 손글씨 숫자 인식 프로그램. 두 버전으로 나누어 개발한다. 각 폴더에 버전별 CLAUDE.md가 있다.

- `desktop_version/` — PySide6 데스크톱 앱 (완성된 기존 코드)
- `web_version/` — Flask 서버 + 브라우저 HTML 캔버스

두 버전은 서로의 파일을 import하지 않는 독립 폴더다. 공유하는 것은 루트의 `.venv` 하나뿐이다.

## 공용 가상환경

```bash
# 프로젝트 루트에서 (Python 3.13, Homebrew python3 기반)
/opt/homebrew/bin/python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

루트 `requirements.txt`는 `desktop_version/requirements.txt`와 `web_version/requirements.txt`를 `-r`로 합친 것이다. 패키지를 추가하면 해당 버전 폴더의 파일에 적는다. `scikit-learn`은 `mnist_mlp.joblib`을 학습한 버전으로 고정(`==`)되어 있으므로, 올릴 때는 두 폴더의 모델을 다시 학습해야 한다. pandas는 코드에서 쓰지 않아 넣지 않았다(`fetch_openml`을 `as_frame=False`, `parser="liac-arff"`로 호출하므로 불필요). 두 실행 파일(`숫자인식.app` 런처, `숫자인식(웹).command`)도 `.venv`가 없으면 이 파일로 설치한다.

`.venv`는 경로를 옮기면 pip 등 스크립트가 깨지므로 루트에 그대로 둔다. `desktop_version/숫자인식.app` 런처도 `../.venv`를 참조한다.

## 컨벤션

코드 주석과 UI 문자열은 한국어로 작성한다. 기존 파일처럼 각 블록 위에 짧은 한국어 설명 주석을 다는 스타일을 따른다.

새로 만드는 모든 파일의 맨 위에는 생성 날짜와 시간을 해당 언어의 주석 문법으로 표시한다(예: Python `# 작성: 2026-09-29 23:16`, Markdown/HTML `<!-- 작성: ... -->`). 시간은 추측하지 말고 `date '+%Y-%m-%d %H:%M'`로 확인한다. shebang(`#!`)이 있는 파일은 그 다음 줄에 넣고, JSON처럼 주석을 쓸 수 없는 형식은 예외로 한다.
