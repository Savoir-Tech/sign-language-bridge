"""
Export a trained ST-GCN model for backend deployment.

Copies the model weights and gloss dictionary to the backend's
trained_models/ directory in the format expected by model_service.

Usage:
    python export_model.py --checkpoint trained_models/best_model.pt
    python export_model.py --checkpoint trained_models/best_model.pt --gloss-dict trained_models/gloss_dict.json
"""

import argparse
import json
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
BACKEND_MODELS_DIR = PROJECT_ROOT / "backend" / "trained_models"


def main():
    parser = argparse.ArgumentParser(description="Export ST-GCN model for backend")
    parser.add_argument("--checkpoint", type=str, required=True,
                        help="Path to the .pt model checkpoint")
    parser.add_argument("--gloss-dict", type=str,
                        default=str(BASE_DIR / "trained_models" / "gloss_dict.json"),
                        help="Path to gloss_dict.json")
    parser.add_argument("--output-dir", type=str, default=str(BACKEND_MODELS_DIR))
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Copy model weights
    dst_model = output_dir / "asl_stgcn.pt"
    shutil.copy2(args.checkpoint, dst_model)
    print(f"Model weights saved to {dst_model}")

    # Copy / convert gloss dict to sign_vocab.json format
    with open(args.gloss_dict, "r") as f:
        gloss_dict = json.load(f)

    dst_vocab = output_dir / "sign_vocab.json"
    with open(dst_vocab, "w") as f:
        json.dump(gloss_dict, f, indent=2)
    print(f"Vocabulary saved to {dst_vocab}  ({len(gloss_dict)} classes)")

    print("\nExport complete. Backend can now load the model.")


if __name__ == "__main__":
    main()
