# Sign Language Bridge

[![AWS Nova](https://img.shields.io/badge/AWS-Nova%20Sonic%20%2B%20Micro-FF9900?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com/bedrock/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **Real-time ASL interpretation powered by Amazon Nova — breaking communication barriers for 11+ million ASL users**

Sign Language Bridge captures American Sign Language through your webcam, classifies signs using an LSTM model trained on the ASL Citizen dataset, and converts them to text and spoken audio in English, Spanish, or French using Amazon Nova Sonic. Frequently used signs are cached in Redis for instant lookup, and all translation history is persisted in PostgreSQL.

---

## The Problem

Deaf and hard-of-hearing individuals face communication barriers across emergency services, telehealth, and customer support. Human interpreters cost $100-150/hour with wait times of 2-24 hours. Existing solutions are either text-only (losing ASL nuance), phone-bound (Video Relay Service), or require expensive hardware.

## Our Solution

Sign Language Bridge provides **real-time ASL-to-speech translation** in three languages:

1. **Sign to webcam** — MediaPipe extracts hand landmarks from the video feed
2. **AI classifies** — LSTM model (trained on ASL Citizen dataset) identifies the sign
3. **Redis caches** — Frequent signs are cached for instant lookup (~60-70% hit rate)
4. **Nova translates** — Amazon Nova Micro translates text to Spanish or French
5. **Nova speaks** — Amazon Nova Sonic converts text to spoken audio in real-time
6. **Postgres persists** — Users, sessions, and translation history are stored in PostgreSQL

---

## Core Pipeline

```
Webcam (10fps) → MediaPipe Hands → LSTM Classifier → Redis Cache
                  (Landmarks)       (ASL Citizen)      ↓
                                                   Gloss → Text
                                                       ↓
                                                  Nova Micro (Translate EN→ES/FR)
                                                       ↓
                                                  Nova Sonic (Text-to-Speech)
                                                       ↓
                                                  Audio Output
                                                       ↓
                                                  PostgreSQL (History)
```

---

## Tech Stack

| Layer                | Technology                                  | Purpose                                                  |
| -------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **Frontend**         | React 18 + TypeScript + Vite + Tailwind CSS | Webcam capture, sign display, transcript UI              |
| **Backend**          | Python 3.11 + FastAPI                       | WebSocket server, ML inference, API routes               |
| **ML Model**         | PyTorch (Bidirectional LSTM)                | Sign classification from landmark sequences              |
| **Hand Tracking**    | MediaPipe Hands                             | Extract 21 hand landmarks per hand (126 values)          |
| **Database**         | PostgreSQL 16                               | Users, sessions, translation history                     |
| **Cache**            | Redis 7                                     | Frequent sign lookup, translation cache, TTS audio cache |
| **Auth**             | JWT (PyJWT)                                 | User authentication and session management               |
| **Translation**      | Amazon Nova Micro (Bedrock)                 | EN → ES/FR text translation                              |
| **Text-to-Speech**   | Amazon Nova Sonic (Bedrock)                 | Multilingual speech synthesis                            |
| **Training Data**    | ASL Citizen Dataset                         | Large-scale crowdsourced ASL videos from Deaf signers    |
| **Containerization** | Docker Compose                              | Single-command local deployment                          |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                          │
│                                                                 │
│  ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────────┐   │
│  │ Webcam   │  │ Transcript  │  │ Language │  │ Audio       │   │
│  │ Feed     │  │ Panel       │  │ Switcher │  │ Player      │   │
│  └────┬─────┘  └─────────────┘  └──────────┘  └─────────────┘   │
│       │  frames (base64 JPEG @ 10fps)                           │
│       ▼                                                         │
│  ┌────────────────────────┐                                     │
│  │ WebSocket Client       │                                     │
│  └────────────┬───────────┘                                     │
└───────────────┼─────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI :8000)                       │
│                                                                   │
│  ┌───────────────┐    ┌───────────────┐    ┌──────────────────┐   │
│  │ MediaPipe     │───▶│ ASL Classifier│───▶│ Gloss → Text    │   │
│  │ (Landmarks)   │    │ (LSTM Model)  │    │ Converter        │   │
│  └───────────────┘    └───────┬───────┘    └────────┬─────────┘   │
│                               │                      │            │
│                               ▼                      ▼            │
│                      ┌────────────────┐    ┌──────────────────┐   │
│                      │  Redis Cache   │    │ Amazon Nova      │   │
│                      │  :6379         │    │ Micro (Translate)│   │
│                      │                │    └────────┬─────────┘   │
│                      │ • Sign cache   │             │             │
│                      │ • TTS cache    │             ▼             │
│                      │ • Translation  │    ┌──────────────────┐   │
│                      │   cache        │    │ Amazon Nova      │   │
│                      └────────────────┘    │ Sonic (TTS)      │   │
│                                            │ → Audio Stream   │   │
│                      ┌────────────────┐    └──────────────────┘   │
│                      │ PostgreSQL     │                           │
│                      │ :5432          │                           │
│                      │                │                           │
│                      │ • Users        │                           │
│                      │ • Sessions     │                           │
│                      │ • Translations │                           │
│                      └────────────────┘                           │
└───────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
sign-language-bridge/
├── docker-compose.yml
├── .env
├── sql/                               # Database schema
│   └── init.sql                           # PostgreSQL init (users, sessions, translations)
├── backend/                           # Python FastAPI server
│   ├── src/
│   │   ├── main.py                        # App entrypoint + lifespan
│   │   ├── config.py                      # Pydantic settings
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── health.py              # GET /api/health
│   │   │       ├── signs.py               # GET /api/signs
│   │   │       ├── translate.py           # POST /api/translate
│   │   │       ├── tts.py                 # POST /api/tts
│   │   │       ├── auth.py                # POST /api/register, /api/login, /api/me
│   │   │       ├── sessions.py            # CRUD /api/sessions
│   │   │       └── websocket.py           # WS /ws/recognize
│   │   ├── services/
│   │   │   ├── model_service.py           # LSTM model + MediaPipe inference
│   │   │   ├── cache_service.py           # Redis caching layer
│   │   │   ├── gloss_service.py           # Gloss → natural text conversion
│   │   │   ├── translation_service.py     # Nova Micro EN → ES/FR
│   │   │   ├── tts_service.py             # Nova Sonic text-to-speech
│   │   │   ├── auth_service.py            # JWT token + password hashing
│   │   │   └── db_service.py              # PostgreSQL connection pool (asyncpg)
│   │   └── utils/
│   │       └── logger.py
│   ├── trained_models/
│   │   └── sign_vocab.json                # Sign label → index mapping
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                          # React SPA
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── ui/                        # Button, Card, Badge
│   │   │   ├── features/
│   │   │   │   ├── VideoCapture.tsx       # Webcam + landmark overlay
│   │   │   │   ├── SignDisplay.tsx        # Current sign + confidence
│   │   │   │   ├── TranscriptPanel.tsx    # Running sentence transcript
│   │   │   │   ├── LanguageSwitcher.tsx   # EN/ES/FR toggle
│   │   │   │   └── AudioPlayer.tsx        # TTS playback controls
│   │   │   └── layouts/
│   │   │       └── MainLayout.tsx
│   │   ├── lib/
│   │   │   ├── api/client.ts              # REST + WebSocket client
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   └── useCamera.ts
│   │   │   └── stores/appStore.ts         # Zustand state
│   │   ├── styles/globals.css
│   │   └── types/index.ts
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── ml/                                # Model training
│   ├── notebooks/
│   │   └── train_asl_citizen.ipynb
│   ├── scripts/
│   │   ├── asl_dataset.py                 # Dataset loader
│   │   ├── extract_landmarks.py           # MediaPipe landmark extraction
│   │   ├── setup_dataset.py               # Dataset download/setup
│   │   ├── train_asl_lstm.py              # LSTM training script
│   │   ├── run_full_training.sh           # Full pipeline runner (Linux/Mac)
│   │   └── run_full_training.bat          # Full pipeline runner (Windows)
│   ├── trained_models/                    # Training outputs
│   │   ├── best_model.pt
│   │   └── gloss_dict.json
│   └── data/                              # gitignored
│       ├── ASL_Citizen/                   # Raw dataset (videos + splits)
│       └── processed/                     # Extracted landmarks
├── ASL-citizen-code-main/             # Reference ASL Citizen codebase (I3D, ST-GCN)
├── scripts/
│   ├── demo.sh
│   └── test_pipeline.py
└── docs/
    ├── AGENTS.md
    ├── ASL_CITIZEN_SETUP.md
    ├── SETUP_VENV.md
    └── TRAINING_GUIDE.md
```

---

## Quick Start

### Prerequisites

- Docker Desktop (4GB+ RAM allocated)
- Python 3.11+
- Node.js 20 LTS
- AWS CLI configured with Bedrock access (`aws configure`)
- Git

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/sign-language-bridge.git
cd sign-language-bridge
```

### 2. Environment Variables

Create `.env` in the project root:

```bash
# Backend
BACKEND_PORT=8000
ENVIRONMENT=development

# PostgreSQL
DATABASE_URL=postgresql://admin:password@postgres:5432/signbridge

# Redis
REDIS_URL=redis://redis:6379

# AWS (for Nova Micro + Nova Sonic)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Auth (JWT)
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRY_HOURS=24

# Model
MODEL_PATH=trained_models/asl_classifier.pth
VOCAB_PATH=trained_models/sign_vocab.json
CONFIDENCE_THRESHOLD=0.75

# Cache TTLs (seconds)
SIGN_CACHE_TTL=3600
TRANSLATION_CACHE_TTL=86400
TTS_CACHE_TTL=86400

# Translation
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,es,fr
```

### 3. Start with Docker Compose

```bash
docker-compose up -d
```

This boots four services:

- **backend** — FastAPI on `http://localhost:8000`
- **frontend** — React on `http://localhost:5173`
- **postgres** — PostgreSQL on `localhost:5432` (auto-initializes schema from `sql/init.sql`)
- **redis** — Cache on `localhost:6379`

### 4. Verify

```bash
# Health check
curl http://localhost:8000/api/health | jq .

# PostgreSQL
docker exec -it sign-language-bridge-postgres-1 psql -U admin -d signbridge -c '\dt'

# Redis
docker exec -it sign-language-bridge-redis-1 redis-cli PING
```

Visit `http://localhost:5173` — grant camera access and start signing.

---

## API Endpoints

### WebSocket (Real-Time Recognition)

```
WS /ws/recognize
```

Send base64-encoded JPEG frames, receive sign predictions:

```json
// Client → Server
{ "type": "frame", "data": "<base64_jpeg>", "timestamp": 1708070400000 }

// Server → Client
{ "type": "prediction", "sign": "HELLO", "confidence": 0.94, "cached": true }

// Client → Server (end a sentence)
{ "type": "end_sentence" }

// Server → Client (full sentence with translation + audio)
{
  "type": "sentence",
  "signs": ["HELLO", "NAME", "WHAT"],
  "text": "Hello, what is your name?",
  "translated": "Hola, ¿cómo te llamas?",
  "language": "es",
  "audio_url": "/api/tts/audio/abc123.wav"
}
```

### REST

| Method   | Endpoint           | Description                                |
| -------- | ------------------ | ------------------------------------------ |
| `GET`    | `/api/health`      | Service health (Postgres + Redis + model)  |
| `GET`    | `/api/signs`       | List supported sign vocabulary             |
| `POST`   | `/api/translate`   | Translate text (EN → ES/FR via Nova Micro) |
| `POST`   | `/api/tts`         | Text-to-speech (via Nova Sonic)            |
| `POST`   | `/api/register`    | Register a new user                        |
| `POST`   | `/api/login`       | Login and receive JWT token                |
| `GET`    | `/api/me`          | Get current user profile (auth required)   |
| `PUT`    | `/api/me`          | Update user profile (auth required)        |
| `POST`   | `/api/sessions`    | Create a translation session               |
| `GET`    | `/api/sessions`    | List user sessions                         |
| `GET`    | `/api/sessions/:id`| Get session with translation history       |
| `GET`    | `/api/cache/stats` | Redis cache hit/miss statistics            |

---

## Model Training

The LSTM classifier is trained on the **ASL Citizen** dataset — a large-scale, crowdsourced dataset collected by Deaf participants.

### Pipeline

```
ASL Citizen Videos → Frame Extraction → MediaPipe Hands → Landmark Sequences → LSTM Training
```

1. **Extract landmarks** — MediaPipe extracts 21 hand landmarks per hand (126 values for both hands) from each video frame
2. **Build sequences** — Pad/truncate to 30-frame sequences per sign
3. **Train LSTM** — Bidirectional LSTM with dropout → softmax over sign vocabulary
4. **Export** — Save model weights + gloss dictionary to `ml/trained_models/`

```bash
# Run training (full pipeline)
cd ml
./scripts/run_full_training.sh        # Linux/Mac
scripts\run_full_training.bat          # Windows

# Or run steps individually
python scripts/setup_dataset.py
python scripts/extract_landmarks.py
python scripts/train_asl_lstm.py

# Or use the notebook
jupyter notebook notebooks/train_asl_citizen.ipynb
```

See [docs/TRAINING_GUIDE.md](docs/TRAINING_GUIDE.md) and [docs/ASL_CITIZEN_SETUP.md](docs/ASL_CITIZEN_SETUP.md) for detailed instructions.

### Target Vocabulary (MVP)

50-100 most common signs prioritized for practical use:

- **Greetings**: HELLO, GOODBYE, THANK-YOU, PLEASE, SORRY
- **Questions**: WHAT, WHERE, WHEN, WHO, HOW, WHY
- **Common**: YES, NO, HELP, WANT, NEED, NAME, UNDERSTAND
- **Emergency**: EMERGENCY, PAIN, DOCTOR, HOSPITAL, CALL
- **Fingerspelling**: A-Z (26 static hand shapes)

---

## Caching Strategy

Redis caches three things to minimize latency and API costs:

| Cache Type       | Key Pattern               | TTL      | Purpose                                |
| ---------------- | ------------------------- | -------- | -------------------------------------- |
| Sign predictions | `sign:<landmark_hash>`    | 1 hour   | Skip LSTM inference for repeated signs |
| Translations     | `translation:<text_hash>` | 24 hours | Skip Nova Micro API call               |
| TTS audio        | `tts:<text_lang_hash>`    | 24 hours | Skip Nova Sonic API call               |

Frequent signs (HELLO, YES, NO, THANK-YOU) account for ~60-70% of all signing — caching these makes a major difference in response time.

```bash
# Monitor cache performance
curl http://localhost:8000/api/cache/stats
# → { "hits": 1542, "misses": 389, "hit_rate": 0.7986 }

# Inspect Redis directly
docker exec -it sign-language-bridge-redis-1 redis-cli
> KEYS sign:*
> GET stats:cache_hits
```

---

## Database Schema

PostgreSQL stores user accounts, sessions, and translation history:

| Table          | Purpose                                         |
| -------------- | ----------------------------------------------- |
| `users`        | User accounts (email, password hash, preferences) |
| `sessions`     | Translation sessions per user                   |
| `translations` | Individual translations with gloss sequences    |

Schema is auto-initialized via `sql/init.sql` when the Postgres container starts.

---

## Amazon Nova Integration

### Nova Micro — Translation

Translates recognized English text to Spanish or French. Nova Micro is the fastest and cheapest model in the Nova family, optimized for all three of our target languages.

```
"Hello, what is your name?" → Nova Micro → "Hola, ¿cómo te llamas?"
```

### Nova Sonic — Text-to-Speech

Converts the final translated text into spoken audio. Supports English, Spanish, and French voices.

```
"Hola, ¿cómo te llamas?" → Nova Sonic →  audio output
```

Both services are accessed through Amazon Bedrock via `boto3`. All responses are cached in Redis to avoid repeated API calls for the same text.

---

## Development

### Run Without Docker

```bash
# Terminal 1: PostgreSQL + Redis
docker run -d -p 5432:5432 -e POSTGRES_DB=signbridge -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=password postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine

# Initialize database schema
psql -h localhost -U admin -d signbridge -f sql/init.sql

# Terminal 2: Backend
cd backend
source venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3: Frontend
cd frontend
npm run dev
```

### Test the Pipeline

```bash
# WebSocket test
npx wscat -c ws://localhost:8000/ws/recognize

# Translation test
curl -X POST http://localhost:8000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I need help", "source": "en", "target": "es"}'

# TTS test
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "language": "en"}'

# Register a user
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "secret", "display_name": "Test User"}'
```

## Demo Flow

```
1. Open browser → grant camera access
2. Sign "HELLO" → system displays "HELLO" with 94% confidence
3. Sign "NAME" → "WHAT" → press End Sentence
4. System outputs: "Hello, what is your name?"
5. Switch language to Spanish (ES)
6. Audio plays: "Hola, ¿cómo te llamas?"
7. Show cache stats: 79% hit rate
```

---

## Acknowledgments

- **Amazon Nova Team** — Nova Micro (translation) + Nova Sonic (TTS)
- **ASL Citizen Dataset** — Large-scale crowdsourced ASL data from Deaf community members
- **MediaPipe** — Real-time hand landmark detection
- **PyTorch** — LSTM model training and inference

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for accessibility**

[Report Bug](https://github.com/yourusername/sign-language-bridge/issues) | [Request Feature](https://github.com/yourusername/sign-language-bridge/issues)

</div>
