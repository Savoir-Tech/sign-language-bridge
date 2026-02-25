# Technical Design Document: Sign Language Bridge

## How We'll Build It

### Recommended Approach: Docker Compose Local Stack + AWS Nova Sonic API

This is a **hackathon project** — every decision prioritizes getting a working demo fast. The core flow: webcam captures user signing → MediaPipe extracts hand landmarks → trained model classifies the sign → Redis caches frequent signs → text is generated in English/Spanish/French → Amazon Nova Sonic converts text to speech in real-time.

**Primary Stack: Python (FastAPI) + React Frontend + PostgreSQL + Redis + MediaPipe + Amazon Nova Sonic**

- **Why it's perfect:**
  - Single `docker-compose up` boots the entire system (API, PostgreSQL, Redis, frontend)
  - Python end-to-end for ML pipeline means no language-switching overhead
  - FastAPI gives us WebSocket support out of the box for real-time streaming
  - PostgreSQL stores user accounts and persistent translation history (ChatGPT-like sessions)
  - Redis for caching frequent signs avoids re-inference on common gestures
  - Amazon Nova Sonic handles the heavy lifting of text-to-speech (no custom TTS needed)

---

## Core Pipeline

```
┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Webcam     │───▶│  MediaPipe Hands│───▶│  ASL Classifier │
│  (Browser)   │    │  (Landmark       │    │  (Trained on    │
│              │    │   Extraction)    │    │   ASL Citizen)  │
└──────────────┘    └──────────────────┘    └────────┬────────┘
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │   Redis Cache   │
                                            │  (Frequent Sign │
                                            │   Lookup)       │
                                            └────────┬────────┘
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │  Text Generation│
                                            │  (Gloss → Text) │
                                            └────────┬────────┘
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │  Amazon Nova    │
                                            │  Micro          │
                                            │  (EN → ES/FR)   │
                                            └────────┬────────┘
                                                      │
                                            ┌─────────┴─────────┐
                                            │                   │
                                            ▼                   ▼
                                  ┌─────────────────┐  ┌────────────────┐
                                  │  Amazon Nova    │  │  PostgreSQL    │
                                  │  Sonic (TTS)    │  │  (Save to      │
                                  │  → Speaker Out  │  │   History)     │
                                  └─────────────────┘  └────────────────┘
```

---

## Model Training: ASL Citizen Dataset

### Dataset Overview

**ASL Citizen** is a large-scale, crowdsourced ASL dataset collected by Deaf participants. It's ideal for this project because it contains isolated sign videos with natural variation from real signers.

### Training Pipeline (Jupyter Notebook)

The model training follows this flow:

1. **Data Preparation**
   - Download ASL Citizen dataset (video clips of isolated signs)
   - Extract frames from each video clip
   - Run MediaPipe Hands on each frame to extract 21 hand landmarks (x, y, z per landmark = 63 values per hand, 126 for both hands)
   - Normalize landmarks relative to wrist position (translation invariance)
   - Pad/truncate sequences to fixed length (e.g., 30 frames)

2. **Feature Engineering**
   ```python
   import mediapipe as mp
   import numpy as np

   mp_hands = mp.solutions.hands.Hands(
       static_image_mode=True,
       max_num_hands=2,
       min_detection_confidence=0.5
   )

   def extract_landmarks(frame):
       """Extract hand landmarks from a single frame."""
       results = mp_hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
       if not results.multi_hand_landmarks:
           return np.zeros(126)  # 2 hands × 21 landmarks × 3 coords

       landmarks = []
       for hand in results.multi_hand_landmarks:
           for lm in hand.landmark:
               landmarks.extend([lm.x, lm.y, lm.z])

       # Pad if only one hand detected
       while len(landmarks) < 126:
           landmarks.extend([0.0] * 3)

       return np.array(landmarks[:126])
   ```

3. **Model Architecture**
   - Input: Sequence of landmark frames (shape: `[batch, 30, 126]`)
   - Architecture: LSTM or 1D-CNN for temporal sequence classification
   - Output: Softmax over sign vocabulary

   ```python
   import torch
   import torch.nn as nn

   class ASLClassifier(nn.Module):
       def __init__(self, input_size=126, hidden_size=256, num_classes=100, num_layers=2):
           super().__init__()
           self.lstm = nn.LSTM(
               input_size=input_size,
               hidden_size=hidden_size,
               num_layers=num_layers,
               batch_first=True,
               dropout=0.3,
               bidirectional=True
           )
           self.fc = nn.Sequential(
               nn.Linear(hidden_size * 2, 128),
               nn.ReLU(),
               nn.Dropout(0.3),
               nn.Linear(128, num_classes)
           )

       def forward(self, x):
           lstm_out, _ = self.lstm(x)
           # Use last timestep output
           out = lstm_out[:, -1, :]
           return self.fc(out)
   ```

4. **Training Loop**
   ```python
   model = ASLClassifier(num_classes=len(sign_vocab))
   optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
   criterion = nn.CrossEntropyLoss()
   scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3)

   for epoch in range(50):
       model.train()
       for landmarks_seq, labels in train_loader:
           optimizer.zero_grad()
           outputs = model(landmarks_seq)
           loss = criterion(outputs, labels)
           loss.backward()
           optimizer.step()

       # Validate
       model.eval()
       val_loss, correct, total = 0, 0, 0
       with torch.no_grad():
           for landmarks_seq, labels in val_loader:
               outputs = model(landmarks_seq)
               val_loss += criterion(outputs, labels).item()
               _, predicted = outputs.max(1)
               correct += predicted.eq(labels).sum().item()
               total += labels.size(0)

       accuracy = correct / total
       scheduler.step(val_loss)
       print(f"Epoch {epoch}: Val Accuracy = {accuracy:.4f}")
   ```

5. **Export for Inference**
   ```python
   # Save model weights
   torch.save(model.state_dict(), "models/asl_classifier.pth")

   # Save vocabulary mapping
   import json
   with open("models/sign_vocab.json", "w") as f:
       json.dump(sign_vocab, f)  # {"HELLO": 0, "THANK_YOU": 1, ...}
   ```

### Target Vocabulary (MVP)

Start with 50-100 most common signs from ASL Citizen. Prioritize:
- Greetings: HELLO, GOODBYE, THANK-YOU, PLEASE, SORRY
- Questions: WHAT, WHERE, WHEN, WHO, HOW, WHY
- Common words: YES, NO, HELP, WANT, NEED, NAME, UNDERSTAND
- Emergency: EMERGENCY, PAIN, DOCTOR, HOSPITAL, CALL
- Fingerspelling: A-Z (26 static hand shapes)

---

## API Design

### Endpoints

#### Real-Time Recognition (WebSocket)
```
WS  /ws/recognize                    # Bidirectional: send frames, receive predictions
```

#### REST Endpoints
```
GET    /api/health                   # Health check (Redis + model loaded)
GET    /api/signs                    # List supported sign vocabulary
POST   /api/translate                # Translate text to target language
POST   /api/tts                      # Text-to-speech via Nova Sonic
GET    /api/cache/stats              # Redis cache hit/miss stats
```

### WebSocket Message Flow

#### Client → Server: Video Frame
```json
{
  "type": "frame",
  "data": "<base64_encoded_jpeg>",
  "timestamp": 1708070400000
}
```

#### Server → Client: Recognition Result
```json
{
  "type": "prediction",
  "sign": "HELLO",
  "confidence": 0.94,
  "text": "Hello",
  "language": "en",
  "cached": true,
  "timestamp": 1708070400050
}
```

#### Client → Server: Language Switch
```json
{
  "type": "set_language",
  "language": "es"
}
```

#### Server → Client: Sentence Complete
```json
{
  "type": "sentence",
  "signs": ["HELLO", "NAME", "WHAT"],
  "text": "Hello, what is your name?",
  "translated": "Hola, ¿cómo te llamas?",
  "language": "es",
  "audio_url": "/api/tts/audio/abc123.wav"
}
```

### Request/Response Examples

#### Translate Text
```json
POST /api/translate
{
  "text": "Hello, what is your name?",
  "source": "en",
  "target": "es"
}

Response: 200 OK
{
  "original": "Hello, what is your name?",
  "translated": "Hola, ¿cómo te llamas?",
  "source": "en",
  "target": "es"
}
```

#### Text-to-Speech
```json
POST /api/tts
{
  "text": "Hello, what is your name?",
  "language": "en",
  "voice": "default"
}

Response: 200 OK
{
  "audio_id": "abc123",
  "audio_url": "/api/tts/audio/abc123.wav",
  "duration_ms": 2100,
  "language": "en"
}
```

#### Health Check
```json
GET /api/health

Response: 200 OK
{
  "status": "healthy",
  "checks": {
    "redis": "ok",
    "model": "ok",
    "nova_sonic": "ok"
  },
  "model_info": {
    "vocabulary_size": 100,
    "model_version": "v1.0"
  }
}
```

---

## Redis Caching Strategy

### Why Redis?

Frequently signed words (HELLO, YES, NO, THANK-YOU) account for ~60-70% of all signs in typical conversation. Caching these avoids running the full LSTM inference pipeline every time.

### Cache Architecture

```
┌─────────────────────────────────────────────────┐
│                  Redis Cache                    │
│                                                 │
│  sign:landmarks:<hash>  →  {"sign": "HELLO",    │
│                              "confidence": 0.96}│
│                                                 │
│  tts:audio:<text_hash>  →  <audio_bytes>        │
│                                                 │
│  translation:<text>:<lang> → "Hola"             │
│                                                 │
│  stats:cache_hits        →  1542                │
│  stats:cache_misses      →  389                 │
└─────────────────────────────────────────────────┘
```

### Cache Logic

```python
import redis
import hashlib
import json
import numpy as np

redis_client = redis.Redis(host="redis", port=6379, decode_responses=True)

def get_or_classify_sign(landmarks: np.ndarray) -> dict:
    """Check Redis cache first, fall back to model inference."""

    # Hash the landmark vector for cache key
    landmark_bytes = landmarks.tobytes()
    # Quantize to reduce key space (round to 2 decimal places)
    quantized = np.round(landmarks, 2).tobytes()
    cache_key = f"sign:{hashlib.md5(quantized).hexdigest()}"

    # Check cache
    cached = redis_client.get(cache_key)
    if cached:
        redis_client.incr("stats:cache_hits")
        result = json.loads(cached)
        result["cached"] = True
        return result

    # Cache miss — run model inference
    redis_client.incr("stats:cache_misses")
    prediction = model.predict(landmarks)

    result = {
        "sign": prediction["sign"],
        "confidence": prediction["confidence"],
        "cached": False
    }

    # Cache if high confidence
    if prediction["confidence"] > 0.85:
        redis_client.setex(cache_key, 3600, json.dumps(result))  # 1hr TTL

    return result
```

### Cache TTL Strategy

| Cache Type | TTL | Reason |
|---|---|---|
| Sign landmarks → gloss | 1 hour | Same signer, same sign varies slightly |
| Translation cache | 24 hours | Translations don't change |
| TTS audio cache | 24 hours | Same text = same audio |
| Session data | 30 minutes | Active conversation window |

---

## Data Layer: PostgreSQL (Users + Translation History)

### Why PostgreSQL?

Redis is perfect for ephemeral caching (sign lookups, TTS audio), but user accounts and translation history need **persistent, relational storage**. Users should be able to log in, see all their past sessions organized by day, click into any session, and review every translation — exactly like ChatGPT's conversation sidebar.

### Database Schema

#### `users` — User Accounts

Stores all registered user information.

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    preferred_lang  VARCHAR(5) DEFAULT 'en',       -- en, es, fr
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users (email);
```

#### `sessions` — Conversation Sessions (ChatGPT-like)

Each session is a named conversation container. Users start a new session when they begin signing, and can return to it later.

```sql
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) DEFAULT 'New Conversation',  -- Auto-generated from first sign
    language        VARCHAR(5) DEFAULT 'en',                  -- Target language for this session
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),                -- Updated on every new translation
    is_active       BOOLEAN DEFAULT TRUE                      -- Soft delete
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_updated_at ON sessions (updated_at DESC);
CREATE INDEX idx_sessions_user_date ON sessions (user_id, created_at DESC);
```

#### `translations` — Translation History Log

Every translation generated for a user is logged here, tied to its session. Stores the raw gloss from the model, the generated English text, and the final translated output.

```sql
CREATE TABLE translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gloss_sequence  TEXT[] NOT NULL,                     -- ["HELLO", "NAME", "WHAT"]
    source_text     VARCHAR(1000) NOT NULL,              -- "Hello, what is your name?"
    translated_text VARCHAR(1000),                       -- "Hola, ¿cómo te llamas?"
    source_lang     VARCHAR(5) DEFAULT 'en',
    target_lang     VARCHAR(5) DEFAULT 'en',
    confidence_avg  FLOAT,                               -- Average model confidence for this sentence
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_translations_session_id ON translations (session_id);
CREATE INDEX idx_translations_user_id ON translations (user_id);
CREATE INDEX idx_translations_created_at ON translations (created_at DESC);
CREATE INDEX idx_translations_user_date ON translations (user_id, created_at DESC);
```

### Schema Relationships

```
users (1) ──────< sessions (many)
  │                    │
  │                    └──────< translations (many)
  │                                  │
  └──────────────────────────────────┘
         (user_id FK on both for fast queries)
```

### Session Flow (ChatGPT-like UX)

```
1. User logs in → GET /api/sessions → sidebar shows past sessions grouped by date
2. User clicks "New Conversation" → POST /api/sessions → new session created
3. User signs → predictions flow in real-time via WebSocket
4. User ends sentence → translation saved to `translations` table
5. Session title auto-updates to first phrase (e.g., "Hello, what is your name?")
6. User returns later → clicks session in sidebar → GET /api/sessions/{id}/translations
7. Full history loads: every gloss, source text, and translated text with timestamps
```

### API Endpoints — User Management

```
POST   /api/auth/register                    # Create new account
POST   /api/auth/login                       # Login → returns JWT token
GET    /api/auth/me                          # Get current user profile
PUT    /api/auth/me                          # Update profile (display name, preferred language)
```

### API Endpoints — Session & History

```
GET    /api/sessions                         # List all sessions for current user (sorted by date)
POST   /api/sessions                         # Create new session
GET    /api/sessions/{id}                    # Get session details
PUT    /api/sessions/{id}                    # Update session (rename, change language)
DELETE /api/sessions/{id}                    # Soft-delete session
GET    /api/sessions/{id}/translations       # Get all translations in a session
```

### Request/Response Examples

#### Register
```json
POST /api/auth/register
{
  "email": "maya@example.com",
  "password": "securepassword",
  "display_name": "Maya Rodriguez",
  "preferred_lang": "es"
}

Response: 201 Created
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "maya@example.com",
  "display_name": "Maya Rodriguez",
  "preferred_lang": "es",
  "created_at": "2026-02-21T10:00:00Z"
}
```

#### Login
```json
POST /api/auth/login
{
  "email": "maya@example.com",
  "password": "securepassword"
}

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "display_name": "Maya Rodriguez",
    "preferred_lang": "es"
  }
}
```

#### List Sessions (sidebar data)
```json
GET /api/sessions
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Response: 200 OK
{
  "sessions": [
    {
      "id": "sess-001",
      "title": "Hello, what is your name?",
      "language": "es",
      "created_at": "2026-02-21T10:30:00Z",
      "updated_at": "2026-02-21T10:45:00Z",
      "translation_count": 8
    },
    {
      "id": "sess-002",
      "title": "I need a doctor",
      "language": "fr",
      "created_at": "2026-02-20T14:00:00Z",
      "updated_at": "2026-02-20T14:22:00Z",
      "translation_count": 5
    }
  ]
}
```

#### Get Session Translations (conversation history)
```json
GET /api/sessions/sess-001/translations
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Response: 200 OK
{
  "session": {
    "id": "sess-001",
    "title": "Hello, what is your name?",
    "language": "es",
    "created_at": "2026-02-21T10:30:00Z"
  },
  "translations": [
    {
      "id": "trans-001",
      "gloss_sequence": ["HELLO", "NAME", "WHAT"],
      "source_text": "Hello, what is your name?",
      "translated_text": "Hola, ¿cómo te llamas?",
      "source_lang": "en",
      "target_lang": "es",
      "confidence_avg": 0.91,
      "created_at": "2026-02-21T10:31:00Z"
    },
    {
      "id": "trans-002",
      "gloss_sequence": ["MY", "NAME", "M-A-Y-A"],
      "source_text": "My name is Maya",
      "translated_text": "Mi nombre es Maya",
      "source_lang": "en",
      "target_lang": "es",
      "confidence_avg": 0.88,
      "created_at": "2026-02-21T10:32:00Z"
    }
  ]
}
```

### Database Service — `backend/src/services/db_service.py`

```python
import asyncpg
import logging
from uuid import UUID

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self):
        self.pool = None

    async def connect(self, database_url: str):
        self.pool = await asyncpg.create_pool(database_url, min_size=5, max_size=20)
        logger.info("PostgreSQL connected")

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    # ── Users ──────────────────────────────────────────────

    async def create_user(self, email: str, password_hash: str, display_name: str,
                          preferred_lang: str = "en") -> dict:
        row = await self.pool.fetchrow(
            """INSERT INTO users (email, password_hash, display_name, preferred_lang)
               VALUES ($1, $2, $3, $4) RETURNING *""",
            email, password_hash, display_name, preferred_lang
        )
        return dict(row)

    async def get_user_by_email(self, email: str) -> dict | None:
        row = await self.pool.fetchrow("SELECT * FROM users WHERE email = $1", email)
        return dict(row) if row else None

    async def get_user_by_id(self, user_id: UUID) -> dict | None:
        row = await self.pool.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(row) if row else None

    async def update_last_login(self, user_id: UUID):
        await self.pool.execute(
            "UPDATE users SET last_login_at = NOW() WHERE id = $1", user_id
        )

    # ── Sessions ───────────────────────────────────────────

    async def create_session(self, user_id: UUID, language: str = "en") -> dict:
        row = await self.pool.fetchrow(
            """INSERT INTO sessions (user_id, language)
               VALUES ($1, $2) RETURNING *""",
            user_id, language
        )
        return dict(row)

    async def get_sessions_for_user(self, user_id: UUID) -> list[dict]:
        rows = await self.pool.fetch(
            """SELECT s.*, COUNT(t.id) AS translation_count
               FROM sessions s
               LEFT JOIN translations t ON t.session_id = s.id
               WHERE s.user_id = $1 AND s.is_active = TRUE
               GROUP BY s.id
               ORDER BY s.updated_at DESC""",
            user_id
        )
        return [dict(r) for r in rows]

    async def get_session(self, session_id: UUID, user_id: UUID) -> dict | None:
        row = await self.pool.fetchrow(
            "SELECT * FROM sessions WHERE id = $1 AND user_id = $2",
            session_id, user_id
        )
        return dict(row) if row else None

    async def update_session_title(self, session_id: UUID, title: str):
        await self.pool.execute(
            """UPDATE sessions SET title = $1, updated_at = NOW()
               WHERE id = $2""",
            title, session_id
        )

    async def soft_delete_session(self, session_id: UUID, user_id: UUID):
        await self.pool.execute(
            """UPDATE sessions SET is_active = FALSE
               WHERE id = $1 AND user_id = $2""",
            session_id, user_id
        )

    # ── Translations ───────────────────────────────────────

    async def save_translation(self, session_id: UUID, user_id: UUID,
                                gloss_sequence: list[str], source_text: str,
                                translated_text: str | None, source_lang: str,
                                target_lang: str, confidence_avg: float) -> dict:
        row = await self.pool.fetchrow(
            """INSERT INTO translations
               (session_id, user_id, gloss_sequence, source_text, translated_text,
                source_lang, target_lang, confidence_avg)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *""",
            session_id, user_id, gloss_sequence, source_text, translated_text,
            source_lang, target_lang, confidence_avg
        )
        # Update session timestamp + auto-title if first translation
        await self.pool.execute(
            """UPDATE sessions SET updated_at = NOW(),
               title = CASE WHEN title = 'New Conversation' THEN $1 ELSE title END
               WHERE id = $2""",
            source_text[:100], session_id
        )
        return dict(row)

    async def get_translations_for_session(self, session_id: UUID) -> list[dict]:
        rows = await self.pool.fetch(
            """SELECT * FROM translations
               WHERE session_id = $1
               ORDER BY created_at ASC""",
            session_id
        )
        return [dict(r) for r in rows]
```

### Database Init Script — `sql/init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    preferred_lang  VARCHAR(5) DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_users_email ON users (email);

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) DEFAULT 'New Conversation',
    language        VARCHAR(5) DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_updated_at ON sessions (updated_at DESC);

CREATE TABLE translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gloss_sequence  TEXT[] NOT NULL,
    source_text     VARCHAR(1000) NOT NULL,
    translated_text VARCHAR(1000),
    source_lang     VARCHAR(5) DEFAULT 'en',
    target_lang     VARCHAR(5) DEFAULT 'en',
    confidence_avg  FLOAT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_translations_session_id ON translations (session_id);
CREATE INDEX idx_translations_user_id ON translations (user_id);
CREATE INDEX idx_translations_created_at ON translations (created_at DESC);

-- Seed demo user
INSERT INTO users (email, password_hash, display_name, preferred_lang)
VALUES ('demo@signbridge.app', '$2b$12$demo_hash_placeholder', 'Demo User', 'en');
```

---

## Translation Layer (Amazon Nova Micro)

### Why Nova Micro for Translation?

Amazon Nova Micro is a text-only model optimized for translation, language understanding, and reasoning. It's the fastest and cheapest model in the Nova family — perfect for real-time translation in a hackathon setting. It's especially proficient in English, Spanish, and French (our three target languages), and keeps the entire AI pipeline within the Amazon Nova ecosystem alongside Nova Sonic for TTS.

### Supported Languages (MVP)

| Language | Code | Nova Micro Support |
|---|---|---|
| English | `en` | Optimized (top-15 language) |
| Spanish | `es` | Optimized (top-15 language) |
| French | `fr` | Optimized (top-15 language) |

### Translation Service

```python
import boto3
import json
import hashlib

bedrock_client = boto3.client("bedrock-runtime", region_name="us-east-1")

LANGUAGE_NAMES = {"en": "English", "es": "Spanish", "fr": "French"}

def translate_text(text: str, source: str = "en", target: str = "en") -> str:
    """Translate text using Amazon Nova Micro via Bedrock."""
    if source == target:
        return text

    # Check Redis cache first
    cache_key = f"translation:{hashlib.md5(f'{text}:{source}:{target}'.encode()).hexdigest()}"
    cached = redis_client.get(cache_key)
    if cached:
        return cached

    source_name = LANGUAGE_NAMES.get(source, "English")
    target_name = LANGUAGE_NAMES.get(target, "English")

    response = bedrock_client.invoke_model(
        modelId="amazon.nova-micro-v1:0",
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"Translate the following text from {source_name} to {target_name}. "
                        f"Return ONLY the translated text, nothing else.\n\n"
                        f"{text}"
                    )
                }
            ],
            "max_tokens": 200,
            "temperature": 0.1  # Low temp for accurate translation
        })
    )

    result = json.loads(response["body"].read())
    translated = result["output"]["message"]["content"][0]["text"].strip()

    # Cache the translation (24hr TTL)
    redis_client.setex(cache_key, 86400, translated)
    return translated
```

### Why Not a Dedicated Translation API?

| Option | Pros | Cons |
|---|---|---|
| **Amazon Nova Micro** ✅ | Same ecosystem as Nova Sonic, handles context/nuance well, optimized for our languages | Slightly higher latency than dedicated APIs |
| Amazon Translate | Purpose-built, very fast | Extra AWS service to configure, no contextual understanding |
| Google Translate API | Free tier available | External dependency, API key management, rate limits |
| `deep-translator` lib | Zero cost, no API key | Unreliable (scrapes Google), breaks frequently |

Nova Micro wins for hackathon simplicity: one Bedrock client handles both translation AND you could extend it for gloss-to-text conversion later.

---

## Amazon Nova Sonic Integration (Text-to-Speech)

### Role in the Pipeline

Nova Sonic is the **voice output engine**. When the user signs a sentence, the system:
1. Classifies each sign → builds a gloss sequence
2. Converts gloss to natural text (rule-based for MVP)
3. Translates to target language if needed
4. Sends text to Nova Sonic → generates spoken audio
5. Streams audio back to the hearing party

### Integration Code

```python
import boto3
import json

bedrock_client = boto3.client(
    "bedrock-runtime",
    region_name="us-east-1"
)

async def text_to_speech(text: str, language: str = "en") -> bytes:
    """Convert text to speech using Amazon Nova Sonic."""

    # Check audio cache
    cache_key = f"tts:{hashlib.md5(f'{text}:{language}'.encode()).hexdigest()}"
    cached_audio = redis_client.get(cache_key)
    if cached_audio:
        return cached_audio

    # Map language codes to Nova Sonic voice IDs
    voice_map = {
        "en": "tiffany",    # English voice
        "es": "lucia",      # Spanish voice
        "fr": "lea",        # French voice
    }

    response = bedrock_client.invoke_model(
        modelId="amazon.nova-sonic-v1:0",
        contentType="application/json",
        accept="audio/wav",
        body=json.dumps({
            "text": text,
            "voice": voice_map.get(language, "tiffany"),
            "language": language
        })
    )

    audio_bytes = response["body"].read()

    # Cache the audio (24hr TTL)
    redis_client.setex(cache_key, 86400, audio_bytes)

    return audio_bytes
```

### Gloss-to-Natural-Text Conversion

```python
# Simple rule-based conversion for MVP
GLOSS_TO_TEXT_RULES = {
    ("HELLO",): "Hello",
    ("HELLO", "NAME", "WHAT"): "Hello, what is your name?",
    ("THANK", "YOU"): "Thank you",
    ("HELP", "NEED"): "I need help",
    ("DOCTOR", "NEED"): "I need a doctor",
    ("EMERGENCY",): "This is an emergency",
    ("YES",): "Yes",
    ("NO",): "No",
}

def gloss_to_text(gloss_sequence: list[str]) -> str:
    """Convert ASL gloss sequence to natural English."""
    # Try exact match first
    key = tuple(gloss_sequence)
    if key in GLOSS_TO_TEXT_RULES:
        return GLOSS_TO_TEXT_RULES[key]

    # Fallback: join glosses with spaces (basic)
    return " ".join(word.capitalize() for word in gloss_sequence)
```

---

## Project Setup Checklist

### Step 1: Install Prerequisites (30 mins)

- [ ] **Docker Desktop** — https://www.docker.com/products/docker-desktop
  - Verify: `docker --version` (should be 20.10+)
  - Allocate 4GB+ RAM in Docker settings

- [ ] **Python 3.11+** — https://www.python.org/downloads/
  - Verify: `python3 --version`

- [ ] **Node.js 20 LTS** — https://nodejs.org
  - Verify: `node --version`

- [ ] **AWS CLI** — https://aws.amazon.com/cli/
  - Configure: `aws configure` (need access key for Bedrock/Nova Sonic)

- [ ] **Git** — https://git-scm.com/downloads
  - Verify: `git --version`

### Step 2: Project Initialization (30 mins)

```bash
mkdir sign-language-bridge && cd sign-language-bridge

mkdir -p backend/src/{api/routes,services,models,config,utils}
mkdir -p backend/trained_models
mkdir -p frontend/src/{components/{ui,features,layouts},lib/{api,hooks,stores},styles,types}
mkdir -p ml/{notebooks,data,scripts}
mkdir -p scripts
mkdir -p docs

# Python backend
cd backend && python3 -m venv venv && source venv/bin/activate
pip install fastapi uvicorn websockets mediapipe opencv-python-headless numpy torch redis boto3 python-dotenv pydantic-settings
pip freeze > requirements.txt
cd ..

# React frontend
cd frontend && npm create vite@latest . -- --template react-ts
npm install axios zustand
npm install -D tailwindcss @tailwindcss/vite
cd ..

git init
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.log
__pycache__/
venv/
*.pth
*.pt
ml/data/
EOF
```

### Step 3: Docker Compose Setup (30 mins)

Create `docker-compose.yml`:

```yaml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./backend:/app
      - ./backend/trained_models:/app/trained_models
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: signbridge
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d signbridge"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### Step 4: Environment Variables

Create `.env`:

```bash
# Backend
BACKEND_PORT=8000
ENVIRONMENT=development

# PostgreSQL
DATABASE_URL=postgresql://admin:password@postgres:5432/signbridge

# Redis
REDIS_URL=redis://redis:6379

# AWS (for Nova Sonic TTS)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Auth (JWT)
JWT_SECRET=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# Model
MODEL_PATH=trained_models/asl_classifier.pth
VOCAB_PATH=trained_models/sign_vocab.json
CONFIDENCE_THRESHOLD=0.75

# Cache
SIGN_CACHE_TTL=3600
TRANSLATION_CACHE_TTL=86400
TTS_CACHE_TTL=86400

# Translation
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,es,fr
```

### Step 5: Backend Implementation (Day 2-3)

#### Backend Entrypoint — `backend/src/main.py`

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .config import settings
from .services.model_service import ModelService
from .services.cache_service import CacheService
from .api.routes import health, signs, translate, tts
from .api.routes.websocket import router as ws_router

model_service = ModelService()
cache_service = CacheService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load model + connect Redis
    model_service.load_model(settings.MODEL_PATH, settings.VOCAB_PATH)
    cache_service.connect(settings.REDIS_URL)
    yield
    # Shutdown
    cache_service.disconnect()

app = FastAPI(title="Sign Language Bridge", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(signs.router, prefix="/api")
app.include_router(translate.router, prefix="/api")
app.include_router(tts.router, prefix="/api")
app.include_router(ws_router)
```

#### Config — `backend/src/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    BACKEND_PORT: int = 8000
    ENVIRONMENT: str = "development"
    REDIS_URL: str = "redis://localhost:6379"
    AWS_REGION: str = "us-east-1"
    MODEL_PATH: str = "trained_models/asl_classifier.pth"
    VOCAB_PATH: str = "trained_models/sign_vocab.json"
    CONFIDENCE_THRESHOLD: float = 0.75
    SIGN_CACHE_TTL: int = 3600
    TRANSLATION_CACHE_TTL: int = 86400
    TTS_CACHE_TTL: int = 86400
    DEFAULT_LANGUAGE: str = "en"
    SUPPORTED_LANGUAGES: str = "en,es,fr"

    class Config:
        env_file = ".env"

settings = Settings()
```

#### Model Service — `backend/src/services/model_service.py`

```python
import torch
import numpy as np
import json
import mediapipe as mp
import cv2
import base64
import logging

logger = logging.getLogger(__name__)

class ASLClassifier(torch.nn.Module):
    def __init__(self, input_size=126, hidden_size=256, num_classes=100, num_layers=2):
        super().__init__()
        self.lstm = torch.nn.LSTM(
            input_size=input_size, hidden_size=hidden_size,
            num_layers=num_layers, batch_first=True,
            dropout=0.3, bidirectional=True
        )
        self.fc = torch.nn.Sequential(
            torch.nn.Linear(hidden_size * 2, 128),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.3),
            torch.nn.Linear(128, num_classes)
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        return self.fc(lstm_out[:, -1, :])


class ModelService:
    def __init__(self):
        self.model = None
        self.vocab = None
        self.idx_to_sign = None
        self.mp_hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.frame_buffer = []  # Accumulate frames for sequence classification
        self.sequence_length = 30

    def load_model(self, model_path: str, vocab_path: str):
        """Load trained model and vocabulary."""
        with open(vocab_path, "r") as f:
            self.vocab = json.load(f)

        self.idx_to_sign = {v: k for k, v in self.vocab.items()}
        num_classes = len(self.vocab)

        self.model = ASLClassifier(num_classes=num_classes)
        self.model.load_state_dict(torch.load(model_path, map_location="cpu"))
        self.model.eval()
        logger.info(f"Model loaded: {num_classes} signs")

    def extract_landmarks(self, frame_b64: str) -> np.ndarray:
        """Extract hand landmarks from a base64-encoded frame."""
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = self.mp_hands.process(rgb)
        landmarks = np.zeros(126)

        if results.multi_hand_landmarks:
            for i, hand in enumerate(results.multi_hand_landmarks):
                if i >= 2:
                    break
                offset = i * 63
                for j, lm in enumerate(hand.landmark):
                    landmarks[offset + j*3] = lm.x
                    landmarks[offset + j*3 + 1] = lm.y
                    landmarks[offset + j*3 + 2] = lm.z

        return landmarks

    def predict(self, landmarks_sequence: np.ndarray) -> dict:
        """Run inference on a sequence of landmark frames."""
        with torch.no_grad():
            tensor = torch.FloatTensor(landmarks_sequence).unsqueeze(0)
            output = self.model(tensor)
            probs = torch.softmax(output, dim=1)
            confidence, idx = probs.max(1)

            return {
                "sign": self.idx_to_sign[idx.item()],
                "confidence": round(confidence.item(), 4)
            }

    def process_frame(self, frame_b64: str) -> dict | None:
        """Add frame to buffer, classify when buffer is full."""
        landmarks = self.extract_landmarks(frame_b64)
        self.frame_buffer.append(landmarks)

        if len(self.frame_buffer) >= self.sequence_length:
            sequence = np.array(self.frame_buffer[-self.sequence_length:])
            self.frame_buffer = self.frame_buffer[-15:]  # Keep overlap
            return self.predict(sequence)

        return None  # Not enough frames yet
```

#### Cache Service — `backend/src/services/cache_service.py`

```python
import redis
import json
import hashlib
import logging

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        self.client = None

    def connect(self, redis_url: str):
        self.client = redis.from_url(redis_url, decode_responses=True)
        logger.info("Redis connected")

    def disconnect(self):
        if self.client:
            self.client.close()

    def get_sign(self, landmark_hash: str) -> dict | None:
        cached = self.client.get(f"sign:{landmark_hash}")
        if cached:
            self.client.incr("stats:cache_hits")
            return json.loads(cached)
        self.client.incr("stats:cache_misses")
        return None

    def set_sign(self, landmark_hash: str, result: dict, ttl: int = 3600):
        self.client.setex(f"sign:{landmark_hash}", ttl, json.dumps(result))

    def get_translation(self, text: str, target: str) -> str | None:
        key = f"translation:{hashlib.md5(f'{text}:{target}'.encode()).hexdigest()}"
        return self.client.get(key)

    def set_translation(self, text: str, target: str, translated: str, ttl: int = 86400):
        key = f"translation:{hashlib.md5(f'{text}:{target}'.encode()).hexdigest()}"
        self.client.setex(key, ttl, translated)

    def get_stats(self) -> dict:
        hits = int(self.client.get("stats:cache_hits") or 0)
        misses = int(self.client.get("stats:cache_misses") or 0)
        total = hits + misses
        return {
            "hits": hits,
            "misses": misses,
            "total": total,
            "hit_rate": round(hits / total, 4) if total > 0 else 0
        }
```

#### WebSocket Route — `backend/src/api/routes/websocket.py`

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/ws/recognize")
async def websocket_recognize(ws: WebSocket):
    await ws.accept()
    language = "en"
    gloss_buffer = []

    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)

            if message["type"] == "set_language":
                language = message["language"]
                await ws.send_json({"type": "language_set", "language": language})
                continue

            if message["type"] == "frame":
                # Import services (initialized at app startup)
                from ..main import model_service, cache_service

                frame_b64 = message["data"]
                result = model_service.process_frame(frame_b64)

                if result and result["confidence"] > 0.75:
                    gloss_buffer.append(result["sign"])

                    await ws.send_json({
                        "type": "prediction",
                        "sign": result["sign"],
                        "confidence": result["confidence"],
                        "language": language,
                        "cached": result.get("cached", False),
                    })

            if message["type"] == "end_sentence":
                if gloss_buffer:
                    from .services.gloss_service import gloss_to_text
                    from .services.translation_service import translate_text
                    from .services.tts_service import text_to_speech

                    text = gloss_to_text(gloss_buffer)
                    translated = translate_text(text, "en", language)
                    audio_id = await text_to_speech(translated, language)

                    await ws.send_json({
                        "type": "sentence",
                        "signs": gloss_buffer,
                        "text": text,
                        "translated": translated,
                        "language": language,
                        "audio_url": f"/api/tts/audio/{audio_id}"
                    })
                    gloss_buffer = []

    except WebSocketDisconnect:
        logger.info("Client disconnected")
```

#### REST Routes — `backend/src/api/routes/health.py`

```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    from ...main import model_service, cache_service
    checks = {}

    try:
        cache_service.client.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    checks["model"] = "ok" if model_service.model is not None else "error"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
        "model_info": {
            "vocabulary_size": len(model_service.vocab) if model_service.vocab else 0,
            "model_version": "v1.0"
        }
    }
```

#### Dockerfile — `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 6: Frontend Implementation (Day 3)

Key components to build:

- **VideoCapture**: Webcam feed with MediaPipe hand landmark overlay
- **SignDisplay**: Shows current recognized sign with confidence bar
- **TranscriptPanel**: Running transcript of recognized sentences
- **LanguageSwitcher**: Toggle between EN/ES/FR
- **AudioPlayer**: Plays TTS output from Nova Sonic

### Step 7: Integration Testing (Day 4)

```bash
# Start everything
docker-compose up -d

# Verify all services
curl http://localhost:8000/api/health | jq .

# Verify PostgreSQL tables
docker exec -it sign-language-bridge-postgres-1 \
  psql -U admin -d signbridge -c "\dt"

# Verify Redis
docker exec -it sign-language-bridge-redis-1 redis-cli PING

# Test auth flow
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"pass123","display_name":"Test"}' | jq .

curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass123"}' | jq .
# Save the access_token from response

# Create a session
curl -X POST http://localhost:8000/api/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"language":"es"}' | jq .

# List sessions (sidebar data)
curl http://localhost:8000/api/sessions \
  -H "Authorization: Bearer <token>" | jq .

# Get session with translations
curl http://localhost:8000/api/sessions/<session_id> \
  -H "Authorization: Bearer <token>" | jq .

# Test WebSocket (use wscat or browser console)
npx wscat -c ws://localhost:8000/ws/recognize

# Check cache stats
curl http://localhost:8000/api/cache/stats | jq .

# Verify translations persisted in PostgreSQL
docker exec -it sign-language-bridge-postgres-1 \
  psql -U admin -d signbridge \
  -c "SELECT s.title, t.gloss_sequence, t.raw_text, t.translated_text, t.created_at
      FROM translations t JOIN sessions s ON t.session_id = s.id
      ORDER BY t.created_at DESC LIMIT 10;"

# Monitor Redis
docker exec -it sign-language-bridge-redis-1 redis-cli
> KEYS *
> GET stats:cache_hits
> GET stats:cache_misses
```

---

## Component Design

### Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **API Server** | Python + FastAPI | Native ML integration, async WebSocket support, fast dev |
| **Frontend** | React + Vite + Tailwind CSS | Fast dev loop, clean UI, handles webcam well |
| **ML Framework** | PyTorch + MediaPipe | Industry standard for CV + hand tracking |
| **Database** | PostgreSQL 16 | User accounts, session history, translation logs (persistent) |
| **Cache** | Redis 7 | Sub-ms lookups for frequent signs, audio cache (ephemeral) |
| **TTS Engine** | Amazon Nova Sonic | High-quality multilingual speech synthesis |
| **Translation** | Amazon Nova Micro (Bedrock) | Fastest Nova model, optimized for EN/ES/FR, same ecosystem |
| **Auth** | JWT (pyjwt + passlib) | Stateless auth, bcrypt password hashing |
| **Containerization** | Docker Compose | One command to run the full stack locally |
| **Dataset** | ASL Citizen | Large-scale, crowdsourced, real Deaf signers |

---

## Project Structure

### Monorepo Layout

```
sign-language-bridge/
├── docker-compose.yml
├── .env
├── backend/                    # Python FastAPI server
│   ├── src/
│   │   ├── main.py                  # App entrypoint + lifespan
│   │   ├── config.py                # Pydantic settings
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── health.py        # GET /api/health
│   │   │       ├── signs.py         # GET /api/signs
│   │   │       ├── translate.py     # POST /api/translate
│   │   │       ├── tts.py           # POST /api/tts
│   │   │       └── websocket.py     # WS /ws/recognize
│   │   ├── services/
│   │   │   ├── model_service.py     # LSTM model + MediaPipe inference
│   │   │   ├── cache_service.py     # Redis caching layer
│   │   │   ├── gloss_service.py     # Gloss → natural text conversion
│   │   │   ├── translation_service.py  # EN → ES/FR translation
│   │   │   └── tts_service.py       # Amazon Nova Sonic TTS
│   │   └── utils/
│   │       └── logger.py            # Structured logging
│   ├── trained_models/
│   │   ├── asl_classifier.pth       # Trained PyTorch weights
│   │   └── sign_vocab.json          # Sign label → index mapping
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── ui/                  # Button, Card, Badge
│   │   │   ├── features/
│   │   │   │   ├── VideoCapture.tsx    # Webcam + landmark overlay
│   │   │   │   ├── SignDisplay.tsx     # Current sign + confidence
│   │   │   │   ├── TranscriptPanel.tsx # Running sentence transcript
│   │   │   │   ├── LanguageSwitcher.tsx # EN/ES/FR toggle
│   │   │   │   └── AudioPlayer.tsx     # TTS playback controls
│   │   │   └── layouts/
│   │   │       └── MainLayout.tsx
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   └── client.ts        # REST + WebSocket client
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts   # WebSocket connection hook
│   │   │   │   └── useCamera.ts      # Webcam access hook
│   │   │   └── stores/
│   │   │       └── appStore.ts       # Zustand state management
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── types/
│   │       └── index.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── ml/                         # Model training
│   ├── notebooks/
│   │   └── train_asl_citizen.ipynb  # Training notebook
│   ├── scripts/
│   │   ├── download_dataset.py      # Download ASL Citizen data
│   │   ├── extract_landmarks.py     # Preprocess videos → landmarks
│   │   └── train_model.py           # Training script (CLI version)
│   └── data/                        # Raw/processed data (gitignored)
├── scripts/
│   ├── demo.sh                      # Quick demo script
│   └── test_pipeline.py             # End-to-end test
└── docs/
    ├── project_plan.md              # This document
    └── demo_script.md               # Hackathon demo script
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React)                             │
│                                                                      │
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────────┐   │
│  │ Session    │  │ Webcam   │  │ Transcript  │  │ Language     │   │
│  │ Sidebar   │  │ Feed     │  │ Panel       │  │ Switcher     │   │
│  │ (History) │  └────┬─────┘  └─────────────┘  └──────────────┘   │
│  └────────────┘       │                                              │
│                       │  frames (base64 JPEG @ 10fps)               │
│                       ▼                                              │
│  ┌──────────────────────────────┐                                    │
│  │ WebSocket Client + Auth      │                                    │
│  │ ws://localhost:8000          │                                    │
│  └──────────────┬───────────────┘                                    │
└─────────────────┼────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND (FastAPI :8000)                        │
│                                                                      │
│  ┌───────────────┐    ┌───────────────┐    ┌──────────────────┐     │
│  │ MediaPipe     │───▶│ ASL Classifier│───▶│ Gloss → Text     │     │
│  │ (Landmarks)   │    │ (LSTM Model)  │    │ Converter        │     │
│  └───────────────┘    └───────┬───────┘    └────────┬─────────┘     │
│                               │                      │               │
│                               ▼                      ▼               │
│  ┌────────────────┐  ┌────────────────┐    ┌──────────────────┐     │
│  │ PostgreSQL     │  │  Redis Cache   │    │ Amazon Nova      │     │
│  │ :5432          │  │  :6379         │    │ Micro (Translate)│     │
│  │                │  │                │    └────────┬─────────┘     │
│  │ • users        │  │ • Sign cache   │             │               │
│  │ • sessions     │  │ • TTS cache    │             ▼               │
│  │ • translations │  │ • Translation  │    ┌──────────────────┐     │
│  │   (persistent) │  │   cache        │    │ Amazon Nova      │     │
│  └────────────────┘  └────────────────┘    │ Sonic (TTS)      │     │
│                                            │ → Audio Stream   │     │
│                                            └──────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Event Flow: Sign Recognition → Speech Output

```
1. User logs in → JWT token issued → frontend stores in memory
2. User creates or resumes a session → session_id sent over WebSocket
3. Browser captures webcam frame (640×480 @ 10fps)
4. Frame encoded as base64 JPEG, sent over WebSocket
5. FastAPI receives frame, runs MediaPipe → extracts 126 landmark values
6. Landmarks added to frame buffer (accumulates 30 frames = 3 seconds)
7. When buffer full:
   a. Hash quantized landmarks → check Redis cache
   b. Cache hit → return cached sign immediately
   c. Cache miss → run LSTM classifier → get sign + confidence
   d. If confidence > 0.75, cache the result (1hr TTL)
8. Send prediction back to client: {"sign": "HELLO", "confidence": 0.94}
9. Client displays sign in real-time
10. When user signals "end sentence":
    a. Gloss buffer ["HELLO", "NAME", "WHAT"] → "Hello, what is your name?"
    b. Translate to target language via Nova Micro if needed → "Hola, ¿cómo te llamas?"
    c. Send to Nova Sonic → generate audio
    d. Cache audio in Redis (24hr TTL)
    e. ✅ PERSIST to PostgreSQL: save translation record (gloss, text, translation, audio_url)
    f. ✅ UPDATE session: touch updated_at, auto-title if first translation
    g. Stream audio back to client
11. Hearing party hears the spoken translation
12. User can close browser, return later, load session from sidebar → all translations preserved
```

---

## Build Order (4-Day Game Plan)

### Day 1: Model Training + Infrastructure
1. **Download ASL Citizen dataset** — run `download_dataset.py`
2. **Extract landmarks** — preprocess all videos through MediaPipe
3. **Train LSTM model** — run training notebook, target 80%+ accuracy
4. **Export model** — save `.pth` weights + `sign_vocab.json`
5. **Docker Compose** — get PostgreSQL + Redis containers running, verify connectivity
6. **Database schema** — create `sql/init.sql`, verify tables with `\dt`

### Day 2: Backend Core + Auth + Data Layer
1. **FastAPI skeleton** — health check, config, logging
2. **Database service** — PostgreSQL connection, user CRUD, session CRUD, translation persistence
3. **Auth service** — JWT tokens, password hashing (bcrypt), login/register endpoints
4. **Model service** — load trained model, run inference on frames
5. **Redis cache service** — sign caching, stats tracking
6. **WebSocket endpoint** — receive frames, return predictions, persist translations
7. **Test with Postman/wscat** — verify auth → session → frame → prediction → persist

### Day 3: Translation + TTS + Frontend
1. **Translation service** — EN → ES/FR via Amazon Nova Micro (Bedrock)
2. **Gloss-to-text** — rule-based conversion for common phrases
3. **Nova Sonic TTS** — integrate Bedrock API, cache audio
4. **React frontend** — LoginForm, RegisterForm, VideoCapture, SignDisplay, TranscriptPanel
5. **Session sidebar** — ChatGPT-like session list, load past conversations, continue sessions
6. **WebSocket hook** — connect frontend to backend WS with auth token + session_id

### Day 4: Integration + Demo Polish
1. **End-to-end testing** — register → login → create session → sign → translate → speech → persist
2. **Session history** — verify past sessions load correctly, translations display in order
3. **Language switching** — verify ES/FR flows work and persist correctly
4. **Cache verification** — confirm Redis hit rates, check PostgreSQL has all translations
5. **UI polish** — confidence indicators, loading states, error handling, session renaming
6. **Demo script** — prepare 2-minute live demo flow (show session history as a feature)
7. **README** — setup instructions for judges

---

## Key Differences from Original TDD

| Original (12-week plan) | Hackathon (4-day plan) |
|---|---|
| AWS Lambda + API Gateway + DynamoDB | Local Docker + FastAPI + PostgreSQL + Redis |
| Cognito auth + JWT tokens | JWT auth (pyjwt + passlib/bcrypt) |
| Three.js 3D avatar for sign output | Text + TTS only (no avatar) |
| Nova Embeddings for similarity search | Direct LSTM classification |
| WLASL + I3D on ECS Fargate | ASL Citizen + LSTM on CPU |
| WebSocket via API Gateway | WebSocket via FastAPI native |
| DynamoDB session management | PostgreSQL (users + sessions + translation history) |
| No persistent translation history | ChatGPT-like session replay with full gloss/translation logs |
| 100 signs + fingerspelling | 50-100 signs (dataset dependent) |
| Bidirectional (ASL ↔ Speech) | Unidirectional (ASL → Speech) with translation |
| $0.065/min operating cost | Free locally (only Bedrock API costs for Nova Micro + Sonic) |