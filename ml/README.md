# ML Pipeline - ASL Citizen LSTM Training

End-to-end pipeline for ASL sign language recognition using MediaPipe hand landmarks and a bidirectional LSTM classifier, trained on the [ASL Citizen](https://huggingface.co/datasets/asl-citizen/aslcitizen) dataset (83K+ videos, 2,748 sign classes).

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
│   └── train_asl_citizen.ipynb      # Training notebook (alternative to CLI)
├── scripts/
│   ├── setup_dataset.py             # Step 1: Setup directories and copy splits
│   ├── extract_landmarks.py         # Step 2: Extract hand landmarks from videos
│   ├── asl_dataset.py               # PyTorch dataset loader
│   ├── train_asl_lstm.py            # Step 3: Train LSTM classifier
│   ├── run_full_training.bat        # One-click full pipeline (Windows)
│   └── run_full_training.sh         # One-click full pipeline (Linux/Mac)
├── trained_models/                  # Saved model checkpoints (generated)
├── logs/                            # Training logs (generated)
├── requirements.txt
├── setup_venv.bat
└── README.md
```

## Pipeline Overview

### Step 1: Setup Dataset

```bash
cd ml/scripts
python setup_dataset.py
```

Copies the official ASL Citizen split CSVs into `data/data_csv/` and creates the output directory for extracted poses.

### Step 2: Extract Hand Landmarks

```bash
python extract_landmarks.py --split train
python extract_landmarks.py --split val
python extract_landmarks.py --split test
```

Processes each video with MediaPipe Hands and saves a `.npy` file per video:
- **42 keypoints** (21 per hand) x **3 coordinates** (x, y, z) = **126 features** per frame
- Output: `data/processed/pose_per_files/<video_id>.npy`
- Estimated time: ~10-20 hours for the training split (CPU-bound)

### Step 3: Train LSTM

```bash
python train_asl_lstm.py \
    --epochs 100 \
    --batch-size 32 \
    --hidden-size 256 \
    --num-layers 2 \
    --lr 1e-3 \
    --max-frames 30 \
    --save-every 5
```

Or run the entire pipeline end-to-end:

```bash
# Windows
run_full_training.bat

# Linux/Mac
bash run_full_training.sh
```

## Model Architecture

```
ASLLSTMClassifier
├── Bidirectional LSTM (2 layers)
│   ├── input_size:  126  (42 hand keypoints x 3 coords)
│   ├── hidden_size: 256
│   └── dropout:     0.3
├── FC1: Linear(512 -> 256) + ReLU + Dropout(0.3)
└── FC2: Linear(256 -> 2,748 classes)
```

| Detail       | Value                     |
|--------------|---------------------------|
| Input shape  | `(batch, 30, 126)`        |
| Output shape | `(batch, 2748)`           |
| Optimizer    | Adam (lr=1e-3)            |
| Scheduler    | CosineAnnealingLR (T=10)  |
| Loss         | CrossEntropyLoss          |

## Dataset Stats

| Split        | Samples    |
|--------------|------------|
| Train        | 40,154     |
| Validation   | 10,304     |
| Test         | 32,941     |
| **Total**    | **83,399** |
| **Classes**  | **2,748**  |

## CLI Arguments

| Argument              | Default            | Description                          |
|-----------------------|--------------------|--------------------------------------|
| `--max-frames`        | `30`               | Max frames sampled per video         |
| `--batch-size`        | `32`               | Training batch size                  |
| `--num-workers`       | `4`                | Data loading workers                 |
| `--use-test`          | `false`            | Include test set evaluation          |
| `--hidden-size`       | `256`              | LSTM hidden units                    |
| `--num-layers`        | `2`                | Number of LSTM layers                |
| `--dropout`           | `0.3`              | Dropout rate                         |
| `--epochs`            | `100`              | Training epochs                      |
| `--lr`                | `1e-3`             | Learning rate                        |
| `--scheduler-t-max`   | `10`               | Cosine annealing T_max               |
| `--save-dir`          | `ml/trained_models`| Model checkpoint directory           |
| `--log-dir`           | `ml/logs`          | Training log directory               |
| `--save-every`        | `5`                | Save checkpoint every N epochs       |

## Outputs

After training, checkpoints are saved to `ml/trained_models/`:

```
trained_models/
├── best_model.pt                  # Best validation accuracy
├── model_epoch_005_acc_X.XXXX.pt  # Periodic checkpoints
├── model_epoch_010_acc_X.XXXX.pt
└── gloss_dict.json                # Class index -> sign name mapping
```

To deploy, copy `best_model.pt` and `gloss_dict.json` to `backend/trained_models/`.

## Troubleshooting

**MediaPipe import error** — Newer versions changed the API. Pin `mediapipe==0.10.32` or use the version in `requirements.txt`.

**Out of memory** — Reduce `--batch-size` to 16 or 8, or reduce `--hidden-size` to 128.

**Slow landmark extraction** — This is CPU-bound. Process splits individually with `--split` and run overnight.

**NoneType .exists() error** — Fixed. The `pose_map_test` variable is `None` when `--use-test` is not passed; the null check now guards against this.
