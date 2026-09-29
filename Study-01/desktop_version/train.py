# MNIST 손글씨 숫자 데이터로 신경망(MLP) 모델을 학습하고 파일로 저장하는 스크립트
import time

import joblib
import numpy as np
from sklearn.datasets import fetch_openml
from sklearn.neural_network import MLPClassifier

# 학습된 모델을 저장할 파일 경로
MODEL_PATH = "mnist_mlp.joblib"


def main():
    # MNIST 데이터셋(28x28 흑백 이미지 70,000장) 다운로드
    print("MNIST 데이터 다운로드 중... (처음 한 번만 시간이 걸립니다)")
    X, y = fetch_openml("mnist_784", version=1, return_X_y=True, as_frame=False, parser="liac-arff")

    # 픽셀 값을 0~1 범위로 정규화
    X = X.astype(np.float32) / 255.0
    y = y.astype(int)

    # 앞의 60,000장은 학습용, 나머지 10,000장은 테스트용으로 분리
    X_train, X_test = X[:60000], X[60000:]
    y_train, y_test = y[:60000], y[60000:]

    # 은닉층 2개(256, 128 뉴런)를 가진 다층 퍼셉트론 모델 정의
    model = MLPClassifier(
        hidden_layer_sizes=(256, 128),
        alpha=1e-4,             # 과적합을 막기 위한 L2 규제 강도
        batch_size=128,
        learning_rate_init=1e-3,
        max_iter=20,            # 최대 학습 반복(에포크) 수
        early_stopping=True,    # 검증 성능이 더 이상 좋아지지 않으면 조기 종료
        random_state=42,
        verbose=True,
    )

    # 모델 학습
    print("모델 학습 시작...")
    start = time.time()
    model.fit(X_train, y_train)
    print(f"학습 완료: {time.time() - start:.1f}초 소요")

    # 테스트 데이터로 정확도 평가
    accuracy = model.score(X_test, y_test)
    print(f"테스트 정확도: {accuracy * 100:.2f}%")

    # 학습된 모델을 파일로 저장
    joblib.dump(model, MODEL_PATH)
    print(f"모델 저장 완료: {MODEL_PATH}")


if __name__ == "__main__":
    main()
