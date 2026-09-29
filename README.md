<!-- 작성: 2026-09-29 23:50 -->
# 손글씨 숫자 인식

마우스나 터치로 0~9 숫자를 그리면 인식해서 보여 주는 프로그램입니다. MNIST 손글씨 데이터로 학습한 신경망(scikit-learn `MLPClassifier`)을 사용하며, **데스크톱 버전**과 **웹 버전** 두 가지로 실행할 수 있습니다.

- 숫자를 그리고 펜을 떼면 잠시 뒤 자동으로 인식합니다.
- 인식된 숫자와 함께 0~9 각각의 확률을 막대로 보여 줍니다.
- 모델 정확도: MNIST 테스트 데이터 10,000장 기준 **97.95%**

## 폴더 구성

```
├── requirements.txt       두 버전의 패키지를 한 번에 설치
├── desktop_version/       데스크톱 앱 (PySide6)
│   ├── digit_app.py       프로그램 본체
│   ├── train.py           모델 학습 스크립트
│   ├── mnist_mlp.joblib   학습된 모델
│   └── 숫자인식.app        macOS에서 더블클릭으로 실행
└── web_version/           웹 앱 (Flask)
    ├── app.py             웹 서버
    ├── templates/index.html  그림판 화면
    ├── train.py           모델 학습 스크립트
    ├── mnist_mlp.joblib   학습된 모델
    └── 숫자인식(웹).command  macOS에서 더블클릭으로 실행
```

두 버전은 서로 독립적이어서 한쪽 폴더만 있어도 실행됩니다.

## 설치

Python 3.13에서 개발했습니다.

```bash
git clone <저장소 주소>
cd <저장소 폴더>

# 프로젝트 폴더 안에 가상환경을 만들고 패키지 설치
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Windows에서는 `.venv/bin/` 대신 `.venv\Scripts\`를 사용하세요.

한 버전만 쓸 경우 `desktop_version/requirements.txt` 또는 `web_version/requirements.txt`만 설치해도 됩니다.

> macOS에서 `숫자인식.app`이나 `숫자인식(웹).command`로 실행하면 가상환경이 없을 때 위 설치 과정을 자동으로 진행합니다.

## 실행

### 데스크톱 버전

```bash
cd desktop_version
../.venv/bin/python digit_app.py
```

macOS에서는 Finder에서 `desktop_version/숫자인식.app`을 더블클릭해도 됩니다. 창에 숫자를 그리면 오른쪽에 결과가 나오고, **지우기**로 다시 그릴 수 있습니다.

### 웹 버전

```bash
cd web_version
../.venv/bin/python app.py
```

서버가 켜지면 브라우저에서 <http://127.0.0.1:8000>에 접속하세요. 서버는 터미널에서 `Ctrl+C`를 누르면 꺼집니다.

macOS에서는 Finder에서 `web_version/숫자인식(웹).command`를 더블클릭하면 터미널 창에서 서버가 켜지고 브라우저가 자동으로 열립니다. 그 터미널 창을 닫으면 서버가 꺼집니다.

## 모델 다시 학습하기

```bash
cd desktop_version   # 또는 web_version
../.venv/bin/python train.py
```

MNIST 데이터(70,000장)를 내려받아 학습한 뒤 `mnist_mlp.joblib`으로 저장합니다. 처음에는 데이터 다운로드 때문에 시간이 걸립니다. 모델 파일이 없는 상태에서 프로그램을 실행하면 학습부터 자동으로 진행합니다.

저장된 모델은 scikit-learn 1.9.1로 학습했기 때문에 `requirements.txt`에서 이 버전으로 고정해 두었습니다. scikit-learn 버전을 바꾸려면 모델을 다시 학습하세요.

## 인식 원리

그린 그림을 MNIST 데이터와 같은 형태로 바꾼 뒤 모델에 넣습니다.

1. 글씨가 있는 부분만 잘라냅니다.
2. 비율을 유지하며 긴 변을 20픽셀로 줄입니다.
3. 28×28 크기의 가운데에 놓고, 글씨의 무게중심을 정중앙으로 옮깁니다.
4. 픽셀 값을 0~1로 바꿔 784개의 숫자로 펼친 뒤 모델에 넣습니다.

모델은 은닉층 2개(256, 128개 뉴런)를 가진 다층 퍼셉트론입니다.
