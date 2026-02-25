import base64
import json
import logging

import cv2
import numpy as np
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)

# MediaPipe lazy init — newer versions changed API
_mp_hands = None


def _get_mp_hands():
    global _mp_hands
    if _mp_hands is None:
        try:
            import mediapipe as mp

            _mp_hands = mp.solutions.hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        except AttributeError:
            # Newer mediapipe API
            from mediapipe.tasks.python.vision import HandLandmarker

            logger.warning("Using newer MediaPipe API — hand landmarker may differ")
            _mp_hands = None
        except Exception as e:
            logger.error(f"MediaPipe init failed: {e}")
            _mp_hands = None
    return _mp_hands


class ASLClassifier(nn.Module):
    def __init__(self, input_size=126, hidden_size=256, num_classes=100, num_layers=2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.3,
            bidirectional=True,
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        return self.fc(lstm_out[:, -1, :])


class ModelService:
    def __init__(self):
        self.model = None
        self.vocab = None
        self.idx_to_sign = None
        self.frame_buffer = []
        self.sequence_length = 30

    def load_model(self, model_path: str, vocab_path: str):
        with open(vocab_path, "r") as f:
            self.vocab = json.load(f)

        self.idx_to_sign = {v: k for k, v in self.vocab.items()}
        num_classes = len(self.vocab)

        self.model = ASLClassifier(num_classes=num_classes)
        self.model.load_state_dict(torch.load(model_path, map_location="cpu"))
        self.model.eval()
        logger.info(f"Model loaded: {num_classes} signs")

    def extract_landmarks(self, frame_b64: str) -> np.ndarray:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_hands = _get_mp_hands()
        if mp_hands is None:
            return landmarks
        results = mp_hands.process(rgb)
        landmarks = np.zeros(126)

        if results.multi_hand_landmarks:
            for i, hand in enumerate(results.multi_hand_landmarks):
                if i >= 2:
                    break
                offset = i * 63
                for j, lm in enumerate(hand.landmark):
                    landmarks[offset + j * 3] = lm.x
                    landmarks[offset + j * 3 + 1] = lm.y
                    landmarks[offset + j * 3 + 2] = lm.z

        return landmarks

    def predict(self, landmarks_sequence: np.ndarray) -> dict:
        with torch.no_grad():
            tensor = torch.FloatTensor(landmarks_sequence).unsqueeze(0)
            output = self.model(tensor)
            probs = torch.softmax(output, dim=1)
            confidence, idx = probs.max(1)

            return {
                "sign": self.idx_to_sign[idx.item()],
                "confidence": round(confidence.item(), 4),
            }

    def process_frame(self, frame_b64: str) -> dict | None:
        landmarks = self.extract_landmarks(frame_b64)
        self.frame_buffer.append(landmarks)

        if len(self.frame_buffer) >= self.sequence_length:
            sequence = np.array(self.frame_buffer[-self.sequence_length :])
            self.frame_buffer = self.frame_buffer[-15:]  # Keep overlap
            return self.predict(sequence)

        return None