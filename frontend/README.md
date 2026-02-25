# Sign Language Bridge — Frontend

React 18 SPA for real-time ASL sign recognition, translation, and text-to-speech playback.

## Stack

- **React 18** + TypeScript (strict mode)
- **Vite 6** — dev server and bundler
- **Tailwind CSS v4** — utility-first styling with custom brand theme
- **Zustand** — lightweight state management (auth, sessions, recognition)
- **Axios** — REST API client with JWT interceptors
- **Radix UI** — accessible component primitives (40+ components)
- **Sonner** — toast notifications
- **Lucide React** — icon library

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Type-check only
npm run type-check
```

## Environment Variables

Create a `.env` file (or copy `.env.example`):

```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## Project Structure

```
src/
├── main.tsx                        # Entry point
├── app/
│   ├── App.tsx                     # Root (auth init, toast provider)
│   ├── routes.tsx                  # React Router with protected routes
│   ├── pages/
│   │   ├── Landing.tsx             # Public landing page
│   │   ├── Auth.tsx                # Login / register (JWT)
│   │   ├── Dashboard.tsx           # Main app (webcam, transcript, sessions)
│   │   └── Settings.tsx            # Profile, preferences, theme
│   └── components/
│       ├── ProtectedRoute.tsx      # Auth guard
│       ├── ErrorBoundary.tsx       # Error boundary with retry
│       └── ui/                     # Radix UI primitives
├── lib/
│   ├── api/
│   │   ├── client.ts              # Axios + JWT interceptors + WS URL
│   │   ├── auth.ts                # register, login, getMe, updateProfile
│   │   ├── sessions.ts            # CRUD sessions + translation history
│   │   └── translate.ts           # translate, tts, health
│   ├── hooks/
│   │   ├── useWebSocket.ts        # WS with exponential backoff reconnection
│   │   ├── useCamera.ts           # getUserMedia + JPEG frame capture
│   │   └── useAudioPlayer.ts      # Audio playback controls
│   └── stores/
│       ├── authStore.ts           # User, token, login/logout
│       ├── sessionStore.ts        # Sessions, translations
│       └── recognitionStore.ts    # WS status, signs, transcript
├── types/
│   └── index.ts                   # TypeScript types for all features
└── styles/
    ├── index.css                  # CSS entry
    ├── tailwind.css               # Tailwind imports
    └── theme.css                  # Brand colors + dark mode
```

## Key Features

- **Real-time webcam capture** at 640×480 @ 10fps with JPEG encoding
- **WebSocket pipeline** — sends frames, receives sign predictions and sentence translations
- **Exponential backoff reconnection** — 1s → 30s delays, max 10 attempts
- **Session sidebar** — ChatGPT-style session history with CRUD operations
- **Language switching** — English, Spanish, French toggle with live WS notification
- **Audio playback** — TTS output with play/pause/seek/volume controls
- **Transcript download** — formatted `.txt` export of session history
- **Auth flow** — JWT-based login/register with protected routes
- **Error handling** — error boundary, toast notifications, camera permission errors
- **Accessibility** — ARIA labels, keyboard navigation, high-contrast design
