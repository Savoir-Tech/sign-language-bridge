"""
Real-time ASL sign language recognition service.

Uses an ST-GCN model with MediaPipe Holistic (mp.solutions.holistic)
for skeleton-based sign language recognition over a webcam stream.

When the trained model file is not available the service falls back to a
"demo mode" that uses MediaPipe hand-presence detection and returns
vocabulary entries so the full pipeline can be exercised end-to-end.
"""

import base64
import hashlib
import json
import logging
import random
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
DEMO_FRAMES = 30  # shorter window for demo mode (~3 s at 10 FPS)

NUM_POSE = 33
NUM_HAND = 21

SELECTED_KEYPOINTS = [
    0, 2, 5, 11, 12, 13, 14,
    33, 37, 38, 41, 42, 45, 46, 49, 50, 53,
    54, 58, 59, 62, 63, 66, 67, 70, 71, 74,
]

DEMO_SIGNS = [
    "HELLO", "THANK YOU", "PLEASE", "YES", "NO",
    "HELP", "SORRY", "GOODBYE", "WANT", "NEED",
    "UNDERSTAND", "NAME", "WATER", "FOOD", "FRIEND",
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
        self._demo_mode = False

    @property
    def model_loaded(self) -> bool:
        return self.model is not None

    @property
    def demo_mode(self) -> bool:
        return self._demo_mode

    @property
    def sequence_length(self) -> int:
        return DEMO_FRAMES if self._demo_mode else MAX_FRAMES

    def load_model(self, model_path: str, vocab_path: str):
        with open(vocab_path, "r") as f:
            self.vocab = json.load(f)

        self.idx_to_sign = {v: k for k, v in self.vocab.items()}
        num_classes = len(self.vocab)

        if not Path(model_path).exists():
            logger.warning(
                f"Model file not found at {model_path} — running in DEMO mode. "
                "Hand presence will trigger vocabulary samples instead of real inference."
            )
            self._demo_mode = True
            return

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
        logger.info(f"ST-GCN model loaded: {num_classes} signs")

    # ------------------------------------------------------------------
    # Landmark extraction
    # ------------------------------------------------------------------
    def extract_landmarks(self, frame_b64: str) -> tuple[np.ndarray | None, bool]:
        """Decode a base64 JPEG frame and return ((75, 2) landmarks, hands_detected)."""
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return None, False

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        holistic = _get_holistic()
        results = holistic.process(rgb)

        logger.info(
            "LANDMARKS pose=%s rhand=%s lhand=%s frame_shape=%s",
            results.pose_landmarks is not None,
            results.right_hand_landmarks is not None,
            results.left_hand_landmarks is not None,
            frame.shape if frame is not None else "None",
        )

        landmarks = np.zeros((NUM_POSE + 2 * NUM_HAND, 2))
        hands_detected = False

        if results.pose_landmarks:
            for i in range(NUM_POSE):
                landmarks[i, 0] = results.pose_landmarks.landmark[i].x
                landmarks[i, 1] = results.pose_landmarks.landmark[i].y

        if results.right_hand_landmarks:
            hands_detected = True
            j = NUM_POSE  # 33
            for i in range(NUM_HAND):
                landmarks[i + j, 0] = results.right_hand_landmarks.landmark[i].x
                landmarks[i + j, 1] = results.right_hand_landmarks.landmark[i].y

        if results.left_hand_landmarks:
            hands_detected = True
            j = NUM_POSE + NUM_HAND  # 54
            for i in range(NUM_HAND):
                landmarks[i + j, 0] = results.left_hand_landmarks.landmark[i].x
                landmarks[i + j, 1] = results.left_hand_landmarks.landmark[i].y

        return landmarks, hands_detected

    # ------------------------------------------------------------------
    # Preprocessing & inference (real model)
    # ------------------------------------------------------------------
    def _preprocess_sequence(self, frames: list[np.ndarray]) -> torch.Tensor:
        """Convert buffered (75,2) frames into a (1, 2, T, 27) tensor."""
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
        data = np.transpose(data, (2, 0, 1))  # (2, T, 27)

        return torch.from_numpy(data).unsqueeze(0).float()

    def predict(self, frames: list[np.ndarray]) -> dict:
        if not self.model_loaded:
            raise RuntimeError("Model not loaded — cannot run inference")
        tensor = self._preprocess_sequence(frames)
        with torch.no_grad():
            output = self.model(tensor)
            probs = torch.softmax(output, dim=1)
            confidence, idx = probs.max(1)

        logger.info(
            "INFERENCE sign=%s confidence=%.4f threshold=0.75 PASS=%s",
            self.idx_to_sign[idx.item()],
            confidence.item(),
            confidence.item() > 0.75,
        )

        return {
            "sign": self.idx_to_sign[idx.item()],
            "confidence": round(confidence.item(), 4),
        }

    # ------------------------------------------------------------------
    # Demo mode: deterministic pick based on landmark hash
    # ------------------------------------------------------------------
    def _demo_predict(self, frames: list[np.ndarray]) -> dict:
        digest = hashlib.md5(frames[-1].tobytes()).hexdigest()
        idx = int(digest, 16) % len(DEMO_SIGNS)
        return {
            "sign": DEMO_SIGNS[idx],
            "confidence": round(random.uniform(0.78, 0.97), 4),
            "demo": True,
        }

    # ------------------------------------------------------------------
    # Per-connection frame processing (buffer is owned by caller)
    # ------------------------------------------------------------------
    def process_frame(
        self, frame_b64: str, frame_buffer: list[np.ndarray],
        hands_seen_count: list[int] | None = None,
    ) -> tuple[dict | None, int]:
        """Process a single frame using the caller-owned *frame_buffer*.

        *hands_seen_count* is a single-element list [count] owned by the caller
        to track how many frames had hands detected across the buffer window.

        Returns (prediction_or_None, current_buffer_length).
        """
        landmarks, hands_detected = self.extract_landmarks(frame_b64)
        if landmarks is None:
            return None, len(frame_buffer)

        frame_buffer.append(landmarks)

        # Track hands across the window
        if hands_seen_count is not None and hands_detected:
            hands_seen_count[0] += 1

        logger.info(
            "BUFFER len=%d/%d hands_detected=%s hands_total=%d",
            len(frame_buffer), self.sequence_length,
            hands_detected,
            hands_seen_count[0] if hands_seen_count else -1,
        )

        seq_len = self.sequence_length
        if len(frame_buffer) >= seq_len:
            sequence = frame_buffer[-seq_len:]
            # sliding window: keep the most recent half
            half = seq_len // 2
            del frame_buffer[: len(frame_buffer) - half]

            if self._demo_mode:
                # Require hands in at least 30% of frames, not just the last one
                threshold = int(seq_len * 0.3)
                seen = hands_seen_count[0] if hands_seen_count else (1 if hands_detected else 0)
                if seen >= threshold:
                    if hands_seen_count is not None:
                        hands_seen_count[0] = max(0, hands_seen_count[0] - half)
                    return self._demo_predict(sequence), len(frame_buffer)
                if hands_seen_count is not None:
                    hands_seen_count[0] = max(0, hands_seen_count[0] - half)
                return None, len(frame_buffer)

            return self.predict(sequence), len(frame_buffer)

        return None, len(frame_buffer)
