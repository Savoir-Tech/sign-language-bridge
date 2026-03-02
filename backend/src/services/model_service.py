"""
Real-time ASL sign language recognition service.

Uses an ST-GCN model with MediaPipe Holistic (mp.solutions.holistic)
for skeleton-based sign language recognition over a webcam stream.
"""

import base64
import json
import logging
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import torch

from ..architecture import STGCN, FC, Network

logger = logging.getLogger(__name__)

mp_holistic = mp.solutions.holistic

# ---------------------------------------------------------------------------
# ST-GCN graph configuration (must match ml/config.py exactly)
# ---------------------------------------------------------------------------
GRAPH_ARGS = {
    "num_nodes": 27,
    "center": 0,
    "inward_edges": [
        [2, 0], [1, 0], [0, 3], [0, 4], [3, 5],
        [4, 6], [5, 7], [6, 17], [7, 8], [7, 9],
        [9, 10], [7, 11], [11, 12], [7, 13], [13, 14],
        [7, 15], [15, 16], [17, 18], [17, 19], [19, 20],
        [17, 21], [21, 22], [17, 23], [23, 24], [17, 25], [25, 26],
    ],
}

IN_CHANNELS = 2
N_OUT_FEATURES = 256
DROPOUT_RATIO = 0.05
MAX_FRAMES = 128

NUM_POSE = 33
NUM_HAND = 21

SELECTED_KEYPOINTS = [
    0, 2, 5, 11, 12, 13, 14,
    33, 37, 38, 41, 42, 45, 46, 49, 50, 53,
    54, 58, 59, 62, 63, 66, 67, 70, 71, 74,
]

# ---------------------------------------------------------------------------
# MediaPipe Holistic — lazy init
# ---------------------------------------------------------------------------
_holistic = None


def _get_holistic():
    global _holistic
    if _holistic is None:
        _holistic = mp_holistic.Holistic(
            static_image_mode=True,
            min_detection_confidence=0.5,
        )
        logger.info("MediaPipe Holistic initialised")
    return _holistic


# ---------------------------------------------------------------------------
# ModelService
# ---------------------------------------------------------------------------
class ModelService:
    def __init__(self):
        self.model = None
        self.vocab = None
        self.idx_to_sign = None
        self.frame_buffer: list[np.ndarray] = []
        self.sequence_length = MAX_FRAMES

    def load_model(self, model_path: str, vocab_path: str):
        with open(vocab_path, "r") as f:
            self.vocab = json.load(f)

        self.idx_to_sign = {v: k for k, v in self.vocab.items()}
        num_classes = len(self.vocab)

        stgcn = STGCN(
            in_channels=IN_CHANNELS,
            graph_args=GRAPH_ARGS,
            edge_importance_weighting=True,
            n_out_features=N_OUT_FEATURES,
        )
        fc = FC(n_features=N_OUT_FEATURES, num_class=num_classes, dropout_ratio=DROPOUT_RATIO)
        self.model = Network(encoder=stgcn, decoder=fc)

        state = torch.load(model_path, map_location="cpu")
        self.model.load_state_dict(state)
        self.model.eval()
        torch.set_default_dtype(torch.float64)
        logger.info(f"ST-GCN model loaded: {num_classes} signs")

    def extract_landmarks(self, frame_b64: str) -> np.ndarray | None:
        """Decode a base64 JPEG frame and return (75, 2) landmarks."""
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return None

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        holistic = _get_holistic()
        results = holistic.process(rgb)

        landmarks = np.zeros((NUM_POSE + 2 * NUM_HAND, 2))

        if results.pose_landmarks:
            for i in range(NUM_POSE):
                landmarks[i, 0] = results.pose_landmarks.landmark[i].x
                landmarks[i, 1] = results.pose_landmarks.landmark[i].y

        if results.right_hand_landmarks:
            j = NUM_POSE  # 33
            for i in range(NUM_HAND):
                landmarks[i + j, 0] = results.right_hand_landmarks.landmark[i].x
                landmarks[i + j, 1] = results.right_hand_landmarks.landmark[i].y

        if results.left_hand_landmarks:
            j = NUM_POSE + NUM_HAND  # 54
            for i in range(NUM_HAND):
                landmarks[i + j, 0] = results.left_hand_landmarks.landmark[i].x
                landmarks[i + j, 1] = results.left_hand_landmarks.landmark[i].y

        return landmarks

    def _preprocess_sequence(self, frames: list[np.ndarray]) -> torch.Tensor:
        """Convert buffered (75,2) frames into a (1, 2, 128, 27) tensor."""
        data = np.stack(frames)  # (T, 75, 2)

        shoulder_l = data[:, 11, :]
        shoulder_r = data[:, 12, :]
        center = np.mean((shoulder_l + shoulder_r) / 2, axis=0)
        mean_dist = np.mean(np.sqrt(((shoulder_l - shoulder_r) ** 2).sum(-1)))
        if mean_dist > 0:
            data = (data - center) / mean_dist

        pose = data[:, :NUM_POSE, :]
        rh = data[:, NUM_POSE:NUM_POSE + NUM_HAND, :]
        lh = data[:, NUM_POSE + NUM_HAND:, :]
        data = np.concatenate([pose, lh, rh], axis=1)

        data = data[:, SELECTED_KEYPOINTS, :]
        data = np.transpose(data, (2, 0, 1))  # (2, 128, 27)

        return torch.from_numpy(data).unsqueeze(0).double()

    def predict(self, frames: list[np.ndarray]) -> dict:
        tensor = self._preprocess_sequence(frames)
        with torch.no_grad():
            output = self.model(tensor)
            probs = torch.softmax(output, dim=1)
            confidence, idx = probs.max(1)

        return {
            "sign": self.idx_to_sign[idx.item()],
            "confidence": round(confidence.item(), 4),
        }

    def process_frame(self, frame_b64: str) -> dict | None:
        landmarks = self.extract_landmarks(frame_b64)
        if landmarks is None:
            return None

        self.frame_buffer.append(landmarks)

        if len(self.frame_buffer) >= self.sequence_length:
            sequence = self.frame_buffer[-self.sequence_length:]
            self.frame_buffer = self.frame_buffer[-(self.sequence_length // 2):]
            return self.predict(sequence)

        return None
