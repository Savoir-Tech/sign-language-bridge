# Sign Language Bridge

[![AWS Nova](https://img.shields.io/badge/AWS-Nova%20Sonic%20%2B%20Micro-FF9900?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com/bedrock/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **Real-time ASL interpretation powered by Amazon Nova — breaking communication barriers for 11+ million ASL users**

Sign Language Bridge captures American Sign Language through your webcam, classifies signs using an ST-GCN model trained on the ASL Citizen dataset, and converts them to text and spoken audio in English, Spanish, or French using Amazon Nova Sonic. Frequently used signs are cached in Redis for instant lookup, and all translation history is persisted in PostgreSQL.

---

## The Problem

Deaf and hard-of-hearing individuals face communication barriers across emergency services, telehealth, and customer support. Human interpreters cost $100-150/hour with wait times of 2-24 hours. Existing solutions are either text-only (losing ASL nuance), phone-bound (Video Relay Service), or require expensive hardware.

## Our Solution

Sign Language Bridge provides **real-time ASL-to-speech translation** in three languages:

1. **Sign to webcam** — MediaPipe Holistic extracts skeleton landmarks from the video feed
2. **AI classifies** — ST-GCN model (trained on ASL Citizen dataset) identifies the sign
3. **Redis caches** — Frequent signs are cached for instant lookup (~60-70% hit rate)
4. **Nova translates** — Amazon Nova Micro translates text to Spanish or French
5. **Nova speaks** — Amazon Nova Sonic converts text to spoken audio in real-time
6. **Postgres persists** — Users, sessions, and translation history are stored in PostgreSQL

---

## Core Pipeline

```
Webcam (10fps) → MediaPipe Holistic → ST-GCN Classifier → Redis Cache
                  (Skeleton)          (ASL Citizen)        ↓
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

| Layer                | Technology                                                      | Purpose                                                       |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| **Frontend**         | React 18 + TypeScript + Vite + Tailwind v4 + Zustand + Radix UI | Webcam capture, sign display, transcript UI, state management |
| **Backend**          | Python 3.11 + FastAPI                                           | WebSocket server, ML inference, API routes                    |
| **ML Model**         | PyTorch (ST-GCN)                                                | Skeleton-based sign classification via graph convolution      |
| **Pose Tracking**    | MediaPipe Holistic                                              | Extract 27-node skeleton (pose + hands, x/y coordinates)      |
| **Database**         | PostgreSQL 16                                                   | Users, sessions, translation history                          |
| **Cache**            | Redis 7                                                         | Frequent sign lookup, translation cache, TTS audio cache      |
| **Auth**             | JWT (PyJWT)                                                     | User authentication and session management                    |
| **Translation**      | Amazon Nova Micro (Bedrock)                                     | EN → ES/FR text translation                                   |
| **Text-to-Speech**   | Amazon Nova Sonic (Bedrock)                                     | Multilingual speech synthesis                                 |
| **Training Data**    | ASL Citizen Dataset                                             | Large-scale crowdsourced ASL videos from Deaf signers         |
| **Containerization** | Docker Compose                                                  | Single-command local deployment                               |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React + Zustand)                    │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Webcam Feed  │  │ Transcript    │  │ Language   │  │ Audio     │  │
│  │ (useCamera)  │  │ Panel         │  │ Switcher   │  │ Player    │  │
│  └──────┬───────┘  └───────────────┘  └────────────┘  └───────────┘  │
│         │  frames (base64 JPEG @ 10fps)                              │
│         ▼                                                            │
│  ┌──────────────────────┐   ┌─────────────────────────────────────┐  │
│  │ useWebSocket         │   │ Zustand Stores                      │  │
│  │ (exp. backoff        │──▶│ • authStore (JWT, user)            │  │
│  │  reconnection)       │   │ • sessionStore (CRUD, history)      │  │
│  └──────────┬───────────┘   │ • recognitionStore (signs, status)  │  │
│             │               └─────────────────────────────────────┘  │
│  ┌──────────┴───────────┐   ┌─────────────────────────────────────┐  │
│  │ REST Client (Axios)  │──▶│ /api/auth/* · /api/sessions/*      │  │
│  │ + JWT interceptors   │   │ /api/translate · /api/tts           │  │
│  └──────────┬───────────┘   └─────────────────────────────────────┘  │
└─────────────┼────────────────────────────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI :8000)                       │
│                                                                   │
│  ┌───────────────┐    ┌───────────────┐    ┌──────────────────┐   │
│  │ MediaPipe     │───▶│ ASL Classifier│───▶│ Gloss → Text    │   │
│  │ (Holistic)    │    │ (ST-GCN)      │    │ Converter        │   │
│  └───────────────┘    └───────┬───────┘    └────────┬─────────┘   │
│                               │                     │             │
│                               ▼                     ▼             │
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
│   │   │   ├── model_service.py           # ST-GCN model + MediaPipe Holistic inference
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
│   │   ├── main.tsx                       # App entry point
│   │   ├── app/
│   │   │   ├── App.tsx                    # Root component (auth init, toast provider)
│   │   │   ├── routes.tsx                 # React Router config (protected routes)
│   │   │   ├── pages/
│   │   │   │   ├── Landing.tsx            # Public landing page
│   │   │   │   ├── Auth.tsx               # Login/register with JWT auth
│   │   │   │   ├── Dashboard.tsx          # Main app: webcam, transcript, sessions
│   │   │   │   └── Settings.tsx           # User profile, preferences, theme
│   │   │   └── components/
│   │   │       ├── ProtectedRoute.tsx     # Auth guard (redirects to /auth)
│   │   │       ├── ErrorBoundary.tsx      # React error boundary with retry
│   │   │       ├── figma/                 # Figma-generated helpers
│   │   │       └── ui/                    # Radix UI primitives (40+ components)
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── client.ts             # Axios instance + JWT interceptors
│   │   │   │   ├── auth.ts               # register(), login(), getMe()
│   │   │   │   ├── sessions.ts           # Session CRUD + translation history
│   │   │   │   └── translate.ts          # translate(), tts(), health()
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts       # WS connection + reconnection (exp backoff)
│   │   │   │   ├── useCamera.ts          # getUserMedia + JPEG frame capture
│   │   │   │   └── useAudioPlayer.ts     # HTML5 Audio playback controls
│   │   │   └── stores/
│   │   │       ├── authStore.ts          # Zustand: user, token, login/logout
│   │   │       ├── sessionStore.ts       # Zustand: sessions, translations
│   │   │       └── recognitionStore.ts   # Zustand: WS status, signs, transcript
│   │   ├── styles/
│   │   │   ├── index.css                 # CSS entry (fonts, tailwind, theme)
│   │   │   ├── tailwind.css              # Tailwind v4 imports
│   │   │   └── theme.css                 # Brand colors + dark mode variables
│   │   └── types/
│   │       └── index.ts                  # Full TypeScript types for all features
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.app.json                 # TS strict mode + @/ path alias
│   └── package.json
├── ml/                                # Model training (ST-GCN)
│   ├── config.py                          # Graph topology + hyperparameters
│   ├── architecture/                      # ST-GCN model definition
│   │   ├── st_gcn.py                      #   Spatial-temporal graph convolution
│   │   ├── graph_utils.py                 #   Adjacency matrix construction
│   │   ├── fc.py                          #   Classification head
│   │   └── network.py                     #   Encoder-decoder wrapper
│   ├── extract_poses.py                   # MediaPipe Holistic keypoint extraction
│   ├── pose_transforms.py                 # Data augmentation (shear, rotation)
│   ├── dataset.py                         # ASLCitizenDataset (PyTorch)
│   ├── train.py                           # Training script
│   ├── test.py                            # Evaluation (top-K, DCG, MRR)
│   ├── export_model.py                    # Export model for backend
│   ├── trained_models/                    # Training outputs
│   │   ├── best_model.pt
│   │   └── gloss_dict.json
│   └── data/                              # gitignored
│       ├── ASL_Citizen/                   # Raw dataset (videos + splits)
│       └── processed/pose_files/          # Extracted .npy pose files
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

### REST

| Method | Endpoint            | Description                                |
| ------ | ------------------- | ------------------------------------------ |
| `GET`  | `/api/health`       | Service health (Postgres + Redis + model)  |
| `GET`  | `/api/signs`        | List supported sign vocabulary             |
| `POST` | `/api/translate`    | Translate text (EN → ES/FR via Nova Micro) |
| `POST` | `/api/tts`          | Text-to-speech (via Nova Sonic)            |
| `POST` | `/api/register`     | Register a new user                        |
| `POST` | `/api/login`        | Login and receive JWT token                |
| `GET`  | `/api/me`           | Get current user profile (auth required)   |
| `PUT`  | `/api/me`           | Update user profile (auth required)        |
| `POST` | `/api/sessions`     | Create a translation session               |
| `GET`  | `/api/sessions`     | List user sessions                         |
| `GET`  | `/api/sessions/:id` | Get session with translation history       |
| `GET`  | `/api/cache/stats`  | Redis cache hit/miss statistics            |

## Caching Strategy

Redis caches three things to minimize latency and API costs:

| Cache Type       | Key Pattern               | TTL      | Purpose                                  |
| ---------------- | ------------------------- | -------- | ---------------------------------------- |
| Sign predictions | `sign:<landmark_hash>`    | 1 hour   | Skip ST-GCN inference for repeated signs |
| Translations     | `translation:<text_hash>` | 24 hours | Skip Nova Micro API call                 |
| TTS audio        | `tts:<text_lang_hash>`    | 24 hours | Skip Nova Sonic API call                 |


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

### Design System

- **Colors**: Deep Teal (#1F3A44) primary, Accent Gold (#D89A3D), Action Orange (#E2582D)
- **Fonts**: Space Mono (display), DM Sans (body), JetBrains Mono (code)
- **Components**: 40+ Radix UI primitives styled with Tailwind
- **Theme**: Dark mode default, light mode supported via CSS custom properties

### Frontend Scripts

```bash
cd frontend
npm run dev           # Start Vite dev server (http://localhost:5173)
npm run build         # Type-check + production build
npm run preview       # Preview production build locally
npm run type-check    # TypeScript type checking only
```

## Demo Flow

```
1. Visit http://localhost:5173 → click "Create Account" → register
2. Dashboard loads → click "Start Recording" → grant camera access
3. A new session is created automatically in the sidebar
4. Sign "HELLO" → current sign overlay shows "HELLO" with 94% confidence
5. Sign "NAME" → "WHAT" → gloss buffer shows "HELLO → NAME → WHAT"
6. Click "End Sentence" → transcript card appears: "Hello, what is your name?"
7. Switch language to Spanish → transcript shows translated text below
8. Audio player plays the TTS output: "Hola, ¿cómo te llamas?"
9. Click a past session in the sidebar → full translation history loads
10. Click "Download Transcript" → formatted .txt file downloads
```

---

## Acknowledgments

- **Amazon Nova Team** — Nova Micro (translation) + Nova Sonic (TTS)
- **ASL Citizen Dataset** — Large-scale crowdsourced ASL data from Deaf community members
- **MediaPipe** — Real-time hand landmark detection
- **PyTorch** — ST-GCN model training and inference
- **OpenHands** — ST-GCN architecture reference implementation

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.