"""Quick smoke test: load model + run dummy inference (independent of WebSocket)."""
import numpy as np

from src.services.model_service import ModelService

svc = ModelService()
svc.load_model("trained_models/best_model.pt", "trained_models/sign_vocab.json")

print(f"loaded={svc.model_loaded}  demo={svc.demo_mode}  seq_len={svc.sequence_length}")
print(f"vocab_size={len(svc.vocab)}  signs={list(svc.vocab.keys())[:10]}")

if svc.demo_mode:
    print("\n⚠ Model is in DEMO mode — .pt file not found at runtime path!")
    print("Check that you're running from the backend/ directory.")
else:
    # Dummy frames: seq_len frames of random (75, 2) landmarks
    frames = [np.random.rand(75, 2) for _ in range(svc.sequence_length)]
    result = svc.predict(frames)
    print(f"\nprediction: sign={result['sign']}  confidence={result['confidence']:.4f}")
    if result["confidence"] < 0.75:
        print("⚠ Confidence below 0.75 threshold — predictions would be silently filtered!")
