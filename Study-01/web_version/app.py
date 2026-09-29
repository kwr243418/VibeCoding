# 작성: 2026-09-29 23:26 / 수정: 2026-09-30 00:05 (--open-browser 옵션)
# 브라우저에서 그린 손글씨 숫자를 인식하는 웹 서버 (Flask)
import base64
import io
import os
import sys
import threading
import time
import urllib.request
import webbrowser

import joblib
import numpy as np
from flask import Flask, jsonify, render_template, request
from PIL import Image
from scipy import ndimage

# 이 파일이 있는 폴더를 기준으로 동작하도록 작업 폴더 변경
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from train import MODEL_PATH, main as train_model  # noqa: E402

# 브라우저 캔버스 크기 (index.html의 canvas 크기와 같아야 함)
CANVAS_SIZE = 280

app = Flask(__name__)


def preprocess(img: np.ndarray):
    """캔버스 이미지(검은 배경, 흰 글씨)를 MNIST와 같은 형태(28x28, 가운데 정렬)로 변환한다."""
    img = img.astype(np.float32)

    # 글씨가 있는 영역만 찾기
    ys, xs = np.nonzero(img > 30)
    if len(xs) == 0:
        return None  # 아무것도 그리지 않은 경우

    # 글씨 영역만 잘라내기
    img = img[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]

    # MNIST처럼 가로세로 비율을 유지하며 긴 변을 20픽셀로 축소
    h, w = img.shape
    scale = 20.0 / max(h, w)
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    small = Image.fromarray(img.astype(np.uint8)).resize((new_w, new_h), Image.LANCZOS)

    # 28x28 검은 바탕의 가운데에 붙이기
    canvas = np.zeros((28, 28), dtype=np.float32)
    top, left = (28 - new_h) // 2, (28 - new_w) // 2
    canvas[top: top + new_h, left: left + new_w] = np.array(small, dtype=np.float32)

    # 무게중심이 이미지 정중앙에 오도록 이동 (MNIST 전처리 방식과 동일)
    cy, cx = ndimage.center_of_mass(canvas)
    canvas = ndimage.shift(canvas, (14 - cy, 14 - cx), mode="constant")

    # 0~1 범위로 정규화한 뒤 1차원(784)으로 펼치기
    return (np.clip(canvas, 0, 255) / 255.0).reshape(1, -1)


def decode_image(data_url: str) -> np.ndarray:
    """브라우저가 보낸 PNG data URL을 280x280 흑백 numpy 배열로 변환한다."""
    png_bytes = base64.b64decode(data_url.split(",", 1)[1])
    img = Image.open(io.BytesIO(png_bytes)).convert("L")
    if img.size != (CANVAS_SIZE, CANVAS_SIZE):
        img = img.resize((CANVAS_SIZE, CANVAS_SIZE))
    return np.array(img)


@app.get("/")
def index():
    # 그림판 페이지 보여주기
    return render_template("index.html", canvas_size=CANVAS_SIZE)


@app.post("/predict")
def predict():
    # 캔버스 이미지를 받아 숫자와 0~9 확률을 돌려주기
    data = request.get_json(silent=True) or {}
    try:
        img = decode_image(data["image"])
    except (KeyError, IndexError, ValueError, OSError):
        return jsonify(error="이미지를 읽을 수 없습니다."), 400

    x = preprocess(img)
    if x is None:
        return jsonify(digit=None, probs=[0.0] * 10)
    probs = model.predict_proba(x)[0]
    return jsonify(digit=int(np.argmax(probs)), probs=[float(p) for p in probs])


# 저장된 모델이 없으면 먼저 학습부터 진행
if not os.path.exists(MODEL_PATH):
    train_model()
model = joblib.load(MODEL_PATH)


def open_browser_when_ready(url: str):
    """서버가 응답하기 시작하면 기본 브라우저로 페이지를 연다. (Windows용 .bat에서 사용)"""
    for _ in range(100):
        try:
            urllib.request.urlopen(url, timeout=1)
            webbrowser.open(url)
            return
        except OSError:
            time.sleep(0.2)


if __name__ == "__main__":
    # --open-browser 옵션을 주면 서버가 켜진 뒤 브라우저를 자동으로 연다
    if "--open-browser" in sys.argv:
        threading.Thread(target=open_browser_when_ready, args=("http://127.0.0.1:8000",), daemon=True).start()
    app.run(host="127.0.0.1", port=8000, debug=False)
