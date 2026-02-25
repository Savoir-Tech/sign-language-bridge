# ML Pipeline - ASL Citizen Two-Phase LSTM Training

Two-phase transfer learning pipeline for ASL sign language recognition using MediaPipe hand landmarks and a bidirectional LSTM classifier, trained on the [ASL Citizen](https://huggingface.co/datasets/asl-citizen/aslcitizen) dataset (83K+ videos, 2,748 sign classes).

## Directory Structure

```
ml/
├── data/
│   ├── ASL_Citizen/
│   │   ├── splits/                  # Official train/val/test CSV splits
│   │   └── videos/                  # Raw MP4 videos (~83K files)
│   ├── data_csv/                    # Processed CSVs with pose mappings
│   │   ├── train.csv                # 40,154 training samples
│   │   ├── val.csv                  # 10,304 validation samples
│   │   ├── test.csv                 # 32,941 test samples
│   │   ├── pose_map_train.csv       # Video-to-pose file mappings
│   │   ├── pose_map_val.csv
│   │   └── pose_map_test.csv
│   ├── processed/
│   │   └── pose_per_files/          # Extracted hand landmark .npy files (~83K)
│   └── sign_vocab.json              # Vocabulary: 2,748 sign classes
├── notebooks/
│   └── train_asl_citizen.ipynb      # Training notebook (alternative)
├── scripts/
│   ├── setup_dataset.py             # Step 1: Setup directories and copy splits
│   ├── extract_landmarks.py         # Steps 2-4: Extract hand landmarks from videos
│   ├── asl_dataset.py               # PyTorch dataset loader (shared)
│   ├── train_phase1.py              # Step 5: Train on top-N frequent classes
│   ├── train_phase2.py              # Step 6: Fine-tune on all classes
│   ├── run_full_training.bat        # One-click full pipeline (Windows)
│   └── run_full_training.sh         # One-click full pipeline (Linux/Mac)
├── trained_models/
│   ├── phase1/                      # Phase 1 checkpoints (generated)
│   └── phase2/                      # Phase 2 checkpoints (generated)
├── logs/                            # Training logs (generated)
├── requirements.txt
├── setup_venv.bat
└── README.md
```

## Training Strategy

With 2,748 classes and only ~14 samples per class on average, training directly on the full dataset leads to overfitting. The two-phase approach solves this:

**Phase 1** — Train on the top-N most frequent classes (~150) where there's enough data per class to learn strong LSTM representations.

**Phase 2** — Transfer those learned representations to all 2,748 classes using gradual unfreezing:
- Stage A: Freeze LSTM + fc1, train only the new fc2 head
- Stage B: Unfreeze fc1, keep LSTM frozen
- Stage C: Unfreeze everything, fine-tune end-to-end with low LR

## Pipeline

### Step 1: Setup Dataset

```bash
cd ml/scripts
python setup_dataset.py
```

Copies official ASL Citizen split CSVs into `data/data_csv/` and creates output directories.

### Steps 2-4: Extract Hand Landmarks

```bash
python extract_landmarks.py --split train
python extract_landmarks.py --split val
python extract_landmarks.py --split test
```

Processes each video with MediaPipe Hands and saves a `.npy` file per video:
- **42 keypoints** (21 per hand) x **3 coordinates** (x, y, z) = **126 features** per frame
- Output: `data/processed/pose_per_files/<video_id>.npy`
- Estimated time: ~10-20 hours for train, ~3-5 hours for val, ~8-15 hours for test

### Step 5: Phase 1 — Top-N Class Training

```bash
python train_phase1.py \
    --top-n 150 \
    --epochs 100 \
    --batch-size 32 \
    --hidden-size 256 \
    --num-layers 2 \
    --dropout 0.3 \
    --lr 3e-4 \
    --max-frames 30
```

Filters the dataset to the 150 most frequent classes, trains from scratch, and saves the best checkpoint to `ml/trained_models/phase1/phase1_best.pt`.

### Step 6: Phase 2 — Full Fine-Tuning

```bash
python train_phase2.py \
    --phase1-checkpoint ../trained_models/phase1/phase1_best.pt \
    --epochs-stage-a 10 \
    --epochs-stage-b 10 \
    --epochs-stage-c 80 \
    --lr-stage-a 1e-3 \
    --lr-stage-b 3e-4 \
    --lr-stage-c 5e-5
```

Loads Phase 1 weights, replaces fc2 for 2,748 classes, and trains in three stages with gradual unfreezing. Best model saved to `ml/trained_models/phase2/phase2_best.pt`.

### One-Click Full Pipeline

```bash
# Windows
run_full_training.bat

# Linux/Mac
bash run_full_training.sh
```

Runs all six steps sequentially.

## Model Architecture

```
ASLLSTMClassifier
├── Bidirectional LSTM (2 layers)
│   ├── input_size:  126  (42 hand keypoints x 3 coords)
│   ├── hidden_size: 256
│   └── dropout:     0.3
├── FC1: Linear(512 -> 256) + ReLU + Dropout(0.3)
└── FC2: Linear(256 -> num_classes)
```

| Detail       | Value                          |
|--------------|--------------------------------|
| Input shape  | `(batch, 30, 126)`             |
| Output shape | `(batch, num_classes)`         |
| Optimizer    | Adam (weight_decay=1e-4)       |
| Scheduler    | CosineAnnealingLR              |
| Loss         | CrossEntropyLoss               |
| Early stop   | Patience = 10 epochs           |

## Dataset Stats

| Split        | Samples    |
|--------------|------------|
| Train        | 40,154     |
| Validation   | 10,304     |
| Test         | 32,941     |
| **Total**    | **83,399** |
| **Classes**  | **2,748**  |

## CLI Arguments

### train_phase1.py

| Argument              | Default  | Description                          |
|-----------------------|----------|--------------------------------------|
| `--top-n`             | `150`    | Number of most frequent classes      |
| `--max-frames`        | `30`     | Max frames sampled per video         |
| `--batch-size`        | `32`     | Training batch size                  |
| `--num-workers`       | `4`      | Data loading workers                 |
| `--hidden-size`       | `256`    | LSTM hidden units                    |
| `--num-layers`        | `2`      | Number of LSTM layers                |
| `--dropout`           | `0.3`    | Dropout rate                         |
| `--epochs`            | `100`    | Training epochs                      |
| `--lr`                | `3e-4`   | Learning rate                        |
| `--scheduler-t-max`   | `10`     | Cosine annealing T_max               |
| `--save-every`        | `5`      | Save checkpoint every N epochs       |

### train_phase2.py

| Argument                  | Default  | Description                          |
|---------------------------|----------|--------------------------------------|
| `--phase1-checkpoint`     | required | Path to Phase 1 `.pt` file           |
| `--max-frames`            | `30`     | Max frames sampled per video         |
| `--batch-size`            | `32`     | Training batch size                  |
| `--num-workers`           | `4`      | Data loading workers                 |
| `--epochs-stage-a`        | `10`     | Epochs for Stage A (fc2 only)        |
| `--epochs-stage-b`        | `10`     | Epochs for Stage B (fc1 + fc2)       |
| `--epochs-stage-c`        | `80`     | Epochs for Stage C (full model)      |
| `--lr-stage-a`            | `1e-3`   | LR for Stage A                       |
| `--lr-stage-b`            | `3e-4`   | LR for Stage B                       |
| `--lr-stage-c`            | `5e-5`   | LR for Stage C                       |
| `--save-every`            | `5`      | Save checkpoint every N epochs       |

## Outputs

```
trained_models/
├── phase1/
│   ├── phase1_best.pt                      # Best Phase 1 model
│   ├── phase1_epoch_005_acc_X.XXXX.pt      # Periodic checkpoints
│   ├── gloss_dict_phase1.json              # Phase 1 class mapping
│   ├── filtered_train.csv                  # Filtered training CSV
│   └── filtered_val.csv                    # Filtered validation CSV
└── phase2/
    ├── phase2_best.pt                      # Best Phase 2 model (deploy this)
    ├── phase2_stageA_epoch_XXX_acc_X.pt    # Stage A checkpoints
    ├── phase2_stageB_epoch_XXX_acc_X.pt    # Stage B checkpoints
    ├── phase2_stageC_epoch_XXX_acc_X.pt    # Stage C checkpoints
    └── gloss_dict_full.json                # Full 2,748-class mapping
```

To deploy, copy to the backend:
```bash
cp ml/trained_models/phase2/phase2_best.pt backend/trained_models/asl_classifier.pth
cp ml/trained_models/phase2/gloss_dict_full.json backend/trained_models/sign_vocab.json
```

## Troubleshooting

**MediaPipe import error** — Newer versions changed the API. Pin `mediapipe==0.10.32` or use the version in `requirements.txt`.

**Out of memory** — Reduce `--batch-size` to 16 or 8, or reduce `--hidden-size` to 128.

**Slow landmark extraction** — This is CPU-bound. Process splits individually with `--split` and run overnight.

**Phase 1 accuracy too low** — Try reducing `--top-n` (e.g., 100 or 50) to give more samples per class. Aim for 60-70%+ before moving to Phase 2.

**Phase 2 diverges** — Lower `--lr-stage-c` further (e.g., `1e-5`). The LSTM weights from Phase 1 should mostly be preserved.
