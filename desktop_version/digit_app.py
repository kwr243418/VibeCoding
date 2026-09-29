# 내 컴퓨터에서 바로 실행되는 손글씨 숫자 인식 프로그램 (PySide6 데스크톱 앱)
import os
import sys

import joblib
import numpy as np
from PIL import Image
from PySide6.QtCore import QPoint, Qt, QTimer
from PySide6.QtGui import QColor, QFont, QImage, QPainter, QPen
from PySide6.QtWidgets import (QApplication, QGridLayout, QHBoxLayout, QLabel,
                               QProgressBar, QPushButton, QVBoxLayout, QWidget)
from scipy import ndimage

# 이 파일이 있는 폴더를 기준으로 동작하도록 작업 폴더 변경
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from train import MODEL_PATH, main as train_model  # noqa: E402

# 캔버스 크기와 펜 굵기
CANVAS_SIZE = 280
PEN_WIDTH = 20


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


class DrawingCanvas(QWidget):
    """마우스로 숫자를 그리는 캔버스 위젯"""

    def __init__(self, on_stroke_end):
        super().__init__()
        self.setFixedSize(CANVAS_SIZE, CANVAS_SIZE)
        self.setCursor(Qt.CrossCursor)
        # 실제 그림이 저장되는 흑백 이미지
        self.image = QImage(CANVAS_SIZE, CANVAS_SIZE, QImage.Format_Grayscale8)
        self.last_point = None
        self.on_stroke_end = on_stroke_end  # 한 획을 다 그렸을 때 호출할 함수
        self.clear()

    def clear(self):
        # 캔버스를 검은색으로 초기화
        self.image.fill(QColor("black"))
        self.update()

    def to_array(self) -> np.ndarray:
        # QImage를 numpy 배열(280x280)로 변환
        ptr = self.image.constBits()
        arr = np.frombuffer(ptr, dtype=np.uint8).reshape(CANVAS_SIZE, self.image.bytesPerLine())
        return arr[:, :CANVAS_SIZE].copy()

    def draw_line(self, start: QPoint, end: QPoint):
        # 흰색 둥근 펜으로 선 그리기
        painter = QPainter(self.image)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setPen(QPen(QColor("white"), PEN_WIDTH, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin))
        painter.drawLine(start, end)
        painter.end()
        self.update()

    def mousePressEvent(self, event):
        # 마우스를 누르면 점을 찍고 그리기 시작
        if event.button() == Qt.LeftButton:
            self.last_point = event.position().toPoint()
            self.draw_line(self.last_point, self.last_point)

    def mouseMoveEvent(self, event):
        # 마우스를 누른 채 움직이면 선을 이어서 그리기
        if self.last_point is not None:
            point = event.position().toPoint()
            self.draw_line(self.last_point, point)
            self.last_point = point

    def mouseReleaseEvent(self, event):
        # 마우스를 떼면 한 획이 끝났음을 알림
        if event.button() == Qt.LeftButton and self.last_point is not None:
            self.last_point = None
            self.on_stroke_end()

    def paintEvent(self, event):
        # 저장된 이미지를 화면에 표시
        painter = QPainter(self)
        painter.drawImage(0, 0, self.image)


class MainWindow(QWidget):
    """캔버스, 버튼, 인식 결과를 담은 메인 창"""

    def __init__(self, model):
        super().__init__()
        self.model = model
        self.setWindowTitle("손글씨 숫자 인식")

        # 획을 그린 뒤 잠시 기다렸다가 자동 인식하기 위한 타이머
        self.timer = QTimer(self)
        self.timer.setSingleShot(True)
        self.timer.setInterval(400)
        self.timer.timeout.connect(self.predict)

        # 왼쪽: 캔버스와 버튼
        self.canvas = DrawingCanvas(on_stroke_end=self.timer.start)
        predict_btn = QPushButton("인식하기")
        predict_btn.clicked.connect(self.predict)
        clear_btn = QPushButton("지우기")
        clear_btn.clicked.connect(self.clear)
        buttons = QHBoxLayout()
        buttons.addWidget(predict_btn)
        buttons.addWidget(clear_btn)
        left = QVBoxLayout()
        left.addWidget(self.canvas)
        left.addLayout(buttons)

        # 오른쪽: 인식된 숫자와 0~9 확률 막대
        self.digit_label = QLabel("?")
        self.digit_label.setAlignment(Qt.AlignCenter)
        self.digit_label.setFont(QFont("", 72, QFont.Bold))
        grid = QGridLayout()
        self.bars, self.pcts = [], []
        for i in range(10):
            bar = QProgressBar()
            bar.setRange(0, 1000)
            bar.setTextVisible(False)
            pct = QLabel("-")
            pct.setMinimumWidth(50)
            pct.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
            grid.addWidget(QLabel(str(i)), i, 0)
            grid.addWidget(bar, i, 1)
            grid.addWidget(pct, i, 2)
            self.bars.append(bar)
            self.pcts.append(pct)
        right = QVBoxLayout()
        right.addWidget(self.digit_label)
        right.addLayout(grid)
        right.addStretch()

        # 전체 배치
        layout = QHBoxLayout(self)
        layout.addLayout(left)
        layout.addSpacing(20)
        layout.addLayout(right, 1)
        self.resize(640, 360)

    def clear(self):
        # 캔버스와 결과 초기화
        self.timer.stop()
        self.canvas.clear()
        self.digit_label.setText("?")
        for bar, pct in zip(self.bars, self.pcts):
            bar.setValue(0)
            pct.setText("-")

    def predict(self):
        # 캔버스 그림을 전처리한 뒤 모델로 숫자 예측
        x = preprocess(self.canvas.to_array())
        if x is None:
            return
        probs = self.model.predict_proba(x)[0]
        self.digit_label.setText(str(int(np.argmax(probs))))
        for bar, pct, p in zip(self.bars, self.pcts, probs):
            bar.setValue(int(p * 1000))
            pct.setText(f"{p * 100:.1f}%")


def main():
    # 저장된 모델이 없으면 먼저 학습부터 진행
    if not os.path.exists(MODEL_PATH):
        train_model()
    model = joblib.load(MODEL_PATH)

    app = QApplication(sys.argv)
    window = MainWindow(model)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
