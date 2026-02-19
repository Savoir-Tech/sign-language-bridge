# ML Training Pipeline - ASL Citizen Dataset

Complete training pipeline for ASL sign language recognition using MediaPipe Hands and PyTorch LSTM.

## 📁 Directory Structure

```
ml/
├── data/
│   ├── raw/                    # Raw video files (organized by sign)
│   ├── processed/              # Extracted landmark sequences (.npy files)
│   └── sign_vocab.json         # Vocabulary mapping
├── notebooks/
│   └── train_asl_citizen.ipynb # Training notebook
└── scripts/
    ├── download_dataset.py     # Download/setup ASL Citizen dataset
    └── extract_landmarks.py    # Extract hand landmarks from videos
```

## 🚀 Quick Start

### Step 1: Download Dataset

```bash
# Setup dataset structure (creates directories for 50 signs)
python ml/scripts/download_dataset.py --num-signs 50

# View dataset collection options
python ml/scripts/download_dataset.py --sample-info
```

This creates:
- `ml/data/raw/<SIGN_NAME>/` directories for each sign
- `ml/data/sign_vocab.json` vocabulary mapping

**Note**: You'll need to add video files manually or collect your own data. For a hackathon MVP, recording 30 videos per sign (20-30 signs) is recommended.

### Step 2: Add Video Data

Place your ASL sign videos in the corresponding directories:

```
ml/data/raw/
├── HELLO/
│   ├── video_001.mp4
│   ├── video_002.mp4
│   └── ...
├── GOODBYE/
│   ├── video_001.mp4
│   └── ...
└── ...
```

**Recommended for MVP**:
- 20-30 sign classes
- 30 videos per sign
- Total: ~600-900 videos
- This provides enough data for training and demo

### Step 3: Extract Landmarks

```bash
# Extract hand landmarks from all videos
python ml/scripts/extract_landmarks.py --num-signs 50

# With custom parameters
python ml/scripts/extract_landmarks.py \
    --num-signs 30 \
    --sequence-length 30 \
    --confidence 0.5
```

This processes each video:
- Extracts 30 frames uniformly from each video
- Runs MediaPipe Hands to get landmarks
- Saves as `.npy` files in `ml/data/processed/`

**Output format**: Each `.npy` file contains a `(30, 126)` array:
- 30 frames per video
- 126 features: 2 hands × 21 landmarks × 3 coords (x, y, z)

### Step 4: Train Model

Open and run the training notebook:

```bash
jupyter notebook ml/notebooks/train_asl_citizen.ipynb
```

Or use Jupyter Lab:

```bash
jupyter lab ml/notebooks/train_asl_citizen.ipynb
```

The notebook will:
1. Load processed landmarks
2. Train bidirectional LSTM classifier
3. Evaluate on test set
4. Save model to `backend/trained_models/asl_classifier.pth`
5. Save vocabulary to `backend/trained_models/sign_vocab.json`

## 🧠 Model Architecture

```python
ASLClassifier(
    input_size=126,      # Hand landmarks
    hidden_size=256,     # LSTM hidden units
    num_layers=2,        # Bidirectional LSTM layers
    num_classes=50,      # Number of signs
    dropout=0.3
)
```

**Architecture**:
- Input: (batch, 30, 126) - 30 frames × 126 hand landmarks
- LSTM: 2 layers, bidirectional, hidden_size=256
- Output: (batch, num_classes) - sign probabilities

**Training**:
- Optimizer: Adam (lr=0.001)
- Loss: CrossEntropyLoss
- Scheduler: ReduceLROnPlateau
- Train/Val/Test split: 80/10/10

## 📊 Expected Results

For a well-collected dataset with 30 samples per sign:
- **Training accuracy**: 90-95% (after 20-30 epochs)
- **Validation accuracy**: 85-90%
- **Test accuracy**: 80-85%

Lower accuracy is expected with:
- Fewer training samples (<20 per sign)
- More sign classes (>50)
- Similar-looking signs (e.g., "M" vs "N")

## 🎯 Vocabulary (MVP - 50 Signs)

### Greetings (6)
HELLO, GOODBYE, THANK-YOU, PLEASE, SORRY, WELCOME

### Questions (6)
WHAT, WHERE, WHEN, WHO, HOW, WHY

### Common Words (14)
YES, NO, HELP, WANT, NEED, NAME, UNDERSTAND, GOOD, BAD, MORE, STOP, GO, COME, SIT

### Emergency (6)
EMERGENCY, PAIN, DOCTOR, HOSPITAL, CALL, AMBULANCE

### Numbers (11)
ZERO, ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, TEN

### Family (6)
MOTHER, FATHER, FAMILY, FRIEND, BROTHER, SISTER

### Daily Life (12)
EAT, DRINK, SLEEP, WORK, SCHOOL, HOME, BATHROOM, WATER, FOOD, MONEY, TIME, DAY

### Emotions (6)
HAPPY, SAD, ANGRY, TIRED, SICK, FINE

### Actions (6)
SEE, HEAR, SPEAK, READ, WRITE, LEARN

## 🔧 Configuration

Edit hyperparameters in the notebook (Cell 2):

```python
INPUT_SIZE = 126          # Don't change (hand landmarks)
HIDDEN_SIZE = 256         # LSTM hidden units
NUM_LAYERS = 2            # LSTM layers
SEQUENCE_LENGTH = 30      # Frames per video
BATCH_SIZE = 32           # Batch size
LEARNING_RATE = 0.001     # Learning rate
NUM_EPOCHS = 50           # Training epochs
DROPOUT = 0.3             # Dropout probability
```

## 🐛 Troubleshooting

### "No data found for sign 'XXX'"
- Check that videos are in `ml/data/raw/XXX/` directory
- Ensure video files have extensions: `.mp4`, `.avi`, or `.mov`

### "Could not open video: XXX"
- Verify video file is not corrupted
- Try re-encoding with: `ffmpeg -i input.mp4 -c:v libx264 output.mp4`

### Low accuracy (<60%)
- **Collect more data**: Aim for 30+ samples per sign
- **Check video quality**: Ensure hands are clearly visible
- **Reduce num_classes**: Start with 10-20 signs
- **Increase epochs**: Train for 100+ epochs
- **Data augmentation**: Add slight rotations/translations

### Out of memory errors
- Reduce `BATCH_SIZE` (try 16 or 8)
- Reduce `HIDDEN_SIZE` (try 128)
- Use CPU instead of GPU (if GPU memory limited)

## 📈 Next Steps After Training

1. **Test the trained model**:
   ```bash
   # Start backend services
   docker-compose up

   # Test health endpoint
   curl http://localhost:8000/api/health
   ```

2. **Integrate with backend**: Model is automatically saved to `backend/trained_models/`

3. **Build frontend**: Create video capture component

4. **Add AWS features**: Translation (Nova Micro) + TTS (Nova Sonic)

## 📝 Notes

- **Hackathon tip**: Start with 10-20 signs, train quickly, then expand
- **Data collection**: Recording your own data is faster than downloading for MVP
- **Performance**: CPU training is fine for <1000 samples, use GPU for larger datasets
- **Deployment**: Model size is ~5-10 MB, suitable for Docker deployment

## 🎥 Alternative Data Sources

If you can't collect your own data:

1. **ASL Alphabet (Kaggle)**: 87,000 images of fingerspelling
   - https://www.kaggle.com/datasets/grassknoted/asl-alphabet

2. **WLASL (Word-Level ASL)**: 2,000 words, 21,000 videos
   - https://www.kaggle.com/datasets/risangbaskoro/wlasl-processed

3. **ASL Citizen (Hugging Face)**: 2.7M videos, 2,700+ signs
   - https://huggingface.co/datasets/asl-citizen/aslcitizen
