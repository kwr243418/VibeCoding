<!-- 작성: 2026-09-29 23:19 / 수정: 2026-09-30 00:05 (Windows .bat) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

공통 규칙(한국어 주석, 파일 상단 날짜·시간 주석, 공용 `.venv`)은 상위 폴더의 `../CLAUDE.md`를 따른다.

## 개요

scikit-learn `MLPClassifier`로 학습한 MNIST 모델을 PySide6 GUI에서 사용하는 데스크톱 앱. 테스트·린트 설정은 없다.

## 명령어

```bash
# desktop_version/ 에서 실행
../.venv/bin/python train.py        # 모델 학습 → mnist_mlp.joblib 생성 (첫 실행 시 OpenML에서 MNIST 다운로드)
../.venv/bin/python digit_app.py    # GUI 실행 (모델 파일이 없으면 자동으로 학습부터 진행)
```

Finder에서 `숫자인식.app`을 더블클릭해도 실행된다. 번들의 `Contents/MacOS/launcher`(zsh 스크립트)가 `desktop_version/`으로 이동해 `../.venv`가 없으면 생성·설치한 뒤 `digit_app.py`를 실행하며, stderr는 `error.log`로 보낸다. 앱이 조용히 종료되면 `error.log`를 확인할 것. 앱 번들은 반드시 `digit_app.py`와 같은 폴더에 있어야 한다.

Windows용 `숫자인식.bat`는 `chcp 65001`을 쓰는 UTF-8 배치 파일이며 CRLF 줄바꿈이어야 한다(저장소 루트 `.gitattributes`가 `*.bat`을 CRLF로 체크아웃). 새로 쓰거나 고칠 때 LF로 저장하지 말 것. 이 Mac에서는 실행해 볼 수 없어 Windows 동작은 검증되지 않았다. 가상환경이 없으면 `py -3`(없으면 `python`)으로 `../.venv`를 만들고 `../requirements.txt`를 설치한다.

`error.log`에는 macOS 접근 제한 속성(`com.apple.macl`)이 붙어, 파일을 다른 경로로 옮기면 런처가 쓰지 못해 앱이 조용히 종료된다. 번들이나 로그를 옮긴 뒤 "응용 프로그램을 열 수 없습니다"가 뜨거나 실행이 안 되면 `error.log`를 지우고 `lsregister -f 숫자인식.app`으로 다시 등록한다(`lsregister` 경로는 `../web_version/CLAUDE.md` 참고).

## 구조

- `train.py` — `MODEL_PATH`와 `main()`(학습 후 `joblib.dump`)을 정의. `digit_app.py`가 이 둘을 import하므로 이름을 바꾸면 양쪽을 함께 수정해야 한다.
- `digit_app.py` — import 시점에 `os.chdir`로 스크립트 폴더로 이동하므로 상대 경로 `MODEL_PATH`가 어디서 실행하든 동작한다(이 때문에 `train` import가 `chdir` 뒤에 위치).
  - `DrawingCanvas`: 280×280 `Format_Grayscale8` `QImage`에 검은 바탕/흰 펜으로 그린다. 획이 끝나면 콜백 → `MainWindow`의 400ms single-shot `QTimer`가 자동 인식을 트리거.
  - `preprocess()`: 모델 정확도의 핵심. MNIST 원본 전처리를 재현한다 — 글씨 bounding box 크롭 → 긴 변 20px로 비율 유지 축소 → 28×28 중앙 배치 → 무게중심을 (14,14)로 이동 → 0~1 정규화 후 (1, 784)로 flatten. 학습 입력(`train.py`의 `/255.0`)과 형식이 반드시 일치해야 한다.
- `mnist_mlp.joblib` — 학습 산출물(바이너리). 학습 파라미터를 바꾸면 이 파일을 삭제/재생성해야 앱에 반영된다.
