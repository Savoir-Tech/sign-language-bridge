# Sign Language Bridge — ML (ST-GCN)

ASL sign recognition using **Spatial Temporal Graph Convolutional Networks (ST-GCN)** with **MediaPipe Holistic** (`mp.solutions.holistic`) pose extraction, trained on the [ASL Citizen](https://www.microsoft.com/en-us/research/project/asl-citizen/) dataset.

**Requires Python 3.10** — MediaPipe `mp.solutions.holistic` is only available in older MediaPipe releases that target Python 3.10.

## Architecture

The model uses a 27-node skeleton graph built from MediaPipe Holistic landmarks:

- **7 pose keypoints** — nose, eyes, shoulders, elbows
- **10 left hand keypoints** — wrist, fingertips, MCPs
- **10 right hand keypoints** — same as left hand

The ST-GCN backbone (10 blocks, output dimension 256) is followed by a fully-connected classification head. Input tensors are `(batch, 2, 128, 27)` — 2 channels (x, y), 128 frames, 27 graph nodes.

The architecture is sourced from [OpenHands](https://github.com/AI4Bharat/OpenHands) and adapted for the ASL Citizen dataset.

## Directory Structure

```
ml/
├── config.py                  # Graph topology, keypoint selection, hyperparameters
├── architecture/              # ST-GCN model definition
│   ├── st_gcn.py              #   Spatial-temporal graph convolution blocks
│   ├── graph_utils.py         #   Adjacency matrix construction
│   ├── fc.py                  #   Fully-connected classification head
│   └── network.py             #   Encoder-decoder wrapper
├── extract_poses.py           # MediaPipe Holistic keypoint extraction
├── pose_transforms.py         # Data augmentation (shear, rotation)
├── dataset.py                 # ASLCitizenDataset (PyTorch)
├── train.py                   # Training script
├── test.py                    # Evaluation script (top-K accuracy, DCG, MRR)
├── export_model.py            # Export model for backend deployment
├── requirements.txt           # Pinned dependencies (Python 3.10)
├── setup_venv.bat             # Creates Python 3.10 venv and installs deps
├── run_training.bat           # Automates the full pipeline
├── data/
│   ├── data_csv/              # Split CSVs and pose map files
│   ├── ASL_Citizen/videos/    # Raw video files (user-provided)
│   └── processed/pose_files/  # Extracted .npy pose files
├── trained_models/            # Saved checkpoints and gloss dict
├── results/                   # Test evaluation output
└── logs/                      # Per-epoch training logs
```

## Setup

### 1. Install Python 3.10

Download Python 3.10 from [python.org](https://www.python.org/downloads/release/python-31011/) and ensure `py -3.10` works from the command line.

### 2. Create Virtual Environment

```bash
# Windows — creates a Python 3.10 venv automatically
setup_venv.bat

# Linux / macOS
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Prepare Data

Download the ASL Citizen dataset from [Microsoft Research](https://www.microsoft.com/en-us/research/project/asl-citizen/) and place videos in `data/ASL_Citizen/videos/`. Place the split CSVs (`train.csv`, `val.csv`, `test.csv`) in `data/data_csv/`.

### 4. Extract Poses

Extract MediaPipe Holistic keypoints from all videos. Each video produces a `.npy` array of shape `(num_frames, 543, 2)` — matching the reference ST-GCN pipeline exactly.

```bash
python extract_poses.py --split train
python extract_poses.py --split val
python extract_poses.py --split test
```

Use `--num-videos N` for testing with a subset.

### 5. Train

```bash
python train.py
```

Key arguments:

| Flag | Default | Description |
|------|---------|-------------|
| `--epochs` | 100 | Maximum training epochs |
| `--batch-size` | 32 | Batch size |
| `--lr` | 1e-3 | Learning rate |
| `--max-frames` | 128 | Temporal sequence length |
| `--device` | auto | `cuda` or `cpu` |

Training saves checkpoints to `trained_models/` and logs to `logs/`.

### 6. Evaluate

```bash
python test.py --checkpoint trained_models/best_model.pt
```

Outputs top-1/5/10/20 accuracy, DCG, MRR, confusion matrices, and per-user statistics to `results/`.

### 7. Export for Backend

```bash
python export_model.py --checkpoint trained_models/best_model.pt
```

This copies the model weights and vocabulary to `backend/trained_models/` where the API server can load them at startup.

### Automated Pipeline

Run the entire pipeline (extract, train, evaluate) with a single command:

```bash
run_training.bat
```

## Data Flow

```
Raw MP4 videos
    │  extract_poses.py (mp.solutions.holistic)
    ▼
.npy files (num_frames, 543, 2)
    │  dataset.py (ASLCitizenDataset)
    │  - Downsample/pad to 128 frames
    │  - Normalize by shoulder distance
    │  - Select 27 keypoints, reorder to [pose, LH, RH]
    │  - Transpose to (C, T, V) = (2, 128, 27)
    ▼
ST-GCN backbone → 256-dim embedding → FC head → class logits
```

## Real-Time Inference (Backend)

The backend (`backend/src/services/model_service.py`) performs the same pipeline in real-time:

1. Webcam frames arrive via WebSocket as base64 JPEG
2. `mp.solutions.holistic` extracts landmarks per frame
3. A 128-frame sliding window buffers the landmarks
4. The ST-GCN model predicts the sign
5. The prediction is sent back to the frontend

See `backend/` for the API server implementation.

## Dependency Versions

All dependencies are pinned to versions known to work with Python 3.10 and the `mp.solutions.holistic` API:

- `mediapipe==0.10.5` — last stable release with `mp.solutions.holistic`
- `torch==2.0.1` — PyTorch with CUDA 11.x support
- `numpy==1.24.3` — compatible with both PyTorch and MediaPipe
- `opencv-python==4.8.0.76`

See `requirements.txt` for the full list.
