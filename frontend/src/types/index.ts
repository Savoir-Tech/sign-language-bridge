// ── Auth ─────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string;
  preferred_lang: Language;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  display_name: string;
  preferred_lang?: Language;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// ── Sessions ─────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  language: Language;
  created_at: string;
  updated_at: string;
  translation_count: number;
  is_active: boolean;
}

export interface Translation {
  id: string;
  gloss_sequence: string[];
  source_text: string;
  translated_text: string | null;
  source_lang: Language;
  target_lang: Language;
  confidence_avg: number;
  created_at: string;
}

export interface SessionDetail {
  session: Session;
  translations: Translation[];
}

// ── WebSocket Messages ───────────────────────────────────

export interface WsFrameMessage {
  type: "frame";
  data: string;
  timestamp: number;
}

export interface WsSetLanguageMessage {
  type: "set_language";
  language: Language;
}

export interface WsEndSentenceMessage {
  type: "end_sentence";
}

export interface WsSetSessionMessage {
  type: "set_session";
  session_id: string;
}

export type WsClientMessage =
  | WsFrameMessage
  | WsSetLanguageMessage
  | WsEndSentenceMessage
  | WsSetSessionMessage;

export interface WsPrediction {
  type: "prediction";
  sign: string;
  confidence: number;
  language: Language;
  cached: boolean;
  timestamp: number;
}

export interface WsSentence {
  type: "sentence";
  signs: string[];
  text: string;
  translated: string;
  language: Language;
  audio_url: string;
}

export interface WsLanguageSet {
  type: "language_set";
  language: Language;
}

export interface WsError {
  type: "error";
  message: string;
}

export type WsServerMessage = WsPrediction | WsSentence | WsLanguageSet | WsError;

// ── Recognition ──────────────────────────────────────────

export interface RecognizedSign {
  sign: string;
  confidence: number;
  timestamp: number;
  cached: boolean;
}

export interface TranscriptEntry {
  id: string;
  sourceText: string;
  translatedText: string | null;
  glossSequence: string[];
  confidence: number;
  language: Language;
  timestamp: string;
  audioUrl: string | null;
}

// ── Translation & TTS ────────────────────────────────────

export interface TranslateRequest {
  text: string;
  source: Language;
  target: Language;
}

export interface TranslateResponse {
  original: string;
  translated: string;
  source: Language;
  target: Language;
}

export interface TtsRequest {
  text: string;
  language: Language;
  voice?: string;
}

export interface TtsResponse {
  audio_id: string;
  audio_url: string;
  duration_ms: number;
  language: Language;
}

// ── Common ───────────────────────────────────────────────

export type Language = "en" | "es" | "fr";

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
};

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export interface HealthCheck {
  status: "healthy" | "degraded";
  checks: {
    redis: string;
    model: string;
    nova_sonic?: string;
  };
  model_info: {
    vocabulary_size: number;
    model_version: string;
  };
}
