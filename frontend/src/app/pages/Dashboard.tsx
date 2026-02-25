import { useEffect, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  MessageSquare,
  Video,
  VideoOff,
  Settings,
  FileText,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Plus,
  User,
  LogOut,
  ChevronDown,
  Download,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  StopCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/authStore";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { useRecognitionStore } from "@/lib/stores/recognitionStore";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { useCamera } from "@/lib/hooks/useCamera";
import { useAudioPlayer } from "@/lib/hooks/useAudioPlayer";
import type { Language, TranscriptEntry, Translation } from "@/types";
import { LANGUAGE_LABELS } from "@/types";

const LANGUAGES: Language[] = ["en", "fr", "es"];

export default function Dashboard() {
  const navigate = useNavigate();

  const { user, logout } = useAuthStore();
  const {
    sessions,
    activeSessionId,
    activeTranslations,
    isLoading: sessionsLoading,
    fetchSessions,
    createSession,
    selectSession,
    deleteSession,
    addTranslation,
    clearActiveSession,
  } = useSessionStore();

  const {
    connectionStatus,
    activeLanguage,
    currentSign,
    glossBuffer,
    liveTranscript,
    isRecording,
    setActiveLanguage,
    clearTranscript,
    setIsRecording,
  } = useRecognitionStore();

  const { connect, disconnect, sendFrame, endSentence, setLanguage, setSession } = useWebSocket();
  const audioPlayer = useAudioPlayer();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const handleFrame = useCallback(
    (frameBase64: string) => {
      if (isRecording && connectionStatus === "connected") {
        sendFrame(frameBase64);
      }
    },
    [isRecording, connectionStatus, sendFrame]
  );

  const { videoRef, isCameraOn, error: cameraError, permissionDenied, startCamera, stopCamera } = useCamera({
    onFrame: handleFrame,
    fps: 10,
    enabled: isRecording,
  });

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveTranscript, activeTranslations]);

  const handleNewChat = async () => {
    try {
      const session = await createSession(activeLanguage);
      clearTranscript();
      if (connectionStatus === "connected") {
        setSession(session.id);
      }
      toast.success("New session created");
    } catch {
      toast.error("Failed to create session");
    }
  };

  const handleSelectSession = async (id: string) => {
    await selectSession(id);
    if (connectionStatus === "connected") {
      setSession(id);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingSessionId(id);
    try {
      await deleteSession(id);
      toast.success("Session deleted");
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setActiveLanguage(lang);
    if (connectionStatus === "connected") {
      setLanguage(lang);
    }
  };

  const handleToggleRecording = async () => {
    if (!isRecording) {
      if (!isCameraOn) await startCamera();
      if (connectionStatus !== "connected") connect();

      if (!activeSessionId) {
        try {
          const session = await createSession(activeLanguage);
          if (connectionStatus === "connected") setSession(session.id);
        } catch {
          toast.error("Failed to create session");
          return;
        }
      }
      setIsRecording(true);
      toast.success("Recording started");
    } else {
      setIsRecording(false);
      if (glossBuffer.length > 0) {
        endSentence();
      }
      toast.info("Recording paused");
    }
  };

  const handleEndSentence = () => {
    if (glossBuffer.length > 0) {
      endSentence();
    }
  };

  const handleLogout = () => {
    disconnect();
    stopCamera();
    logout();
    navigate("/");
  };

  const handleDownloadSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    const entries = activeTranslations.length > 0 ? activeTranslations : [];
    if (entries.length === 0) {
      toast.info("No translations to download");
      return;
    }

    const activeSession = sessions.find((s) => s.id === activeSessionId);
    let text = `Sign Language Bridge - Session Transcript\n${"=".repeat(50)}\n\n`;
    text += `Session: ${activeSession?.title || "Untitled"}\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n`;
    text += `Language: ${LANGUAGE_LABELS[activeLanguage]}\n\n${"=".repeat(50)}\n\n`;

    entries.forEach((entry) => {
      text += `[${new Date(entry.created_at).toLocaleTimeString()}] - Confidence: ${Math.round(entry.confidence_avg * 100)}%\n`;
      text += `Gloss: ${entry.gloss_sequence.join(" ")}\n`;
      text += `English: ${entry.source_text}\n`;
      if (entry.translated_text) {
        text += `Translated: ${entry.translated_text}\n`;
      }
      text += `\n${"-".repeat(50)}\n\n`;
    });

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(activeSession?.title || "session").replace(/\s+/g, "_")}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const connectionColor = {
    connected: "text-green-400",
    connecting: "text-brand-gold",
    reconnecting: "text-brand-gold",
    disconnected: "text-brand-neutral-muted",
    error: "text-brand-error",
  }[connectionStatus];

  const connectionLabel = {
    connected: "Connected",
    connecting: "Connecting...",
    reconnecting: "Reconnecting...",
    disconnected: "Disconnected",
    error: "Connection Error",
  }[connectionStatus];

  const allTranscriptEntries: TranscriptEntry[] = [
    ...activeTranslations.map(translationToTranscriptEntry),
    ...liveTranscript,
  ];

  return (
    <div className="h-screen flex bg-brand-teal-panel">
      {/* Sidebar */}
      <aside className="w-72 bg-brand-teal border-r border-brand-teal-light flex flex-col">
        <div className="p-6 border-b border-brand-teal-light">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-brand-teal" />
            </div>
            <span className="text-brand-neutral-light">Sign Language Bridge</span>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          <div className="mb-6">
            <div className="text-brand-neutral-muted text-xs uppercase tracking-wider mb-3 px-3">
              Sessions
            </div>
            {sessionsLoading && sessions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-brand-gold animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 px-3">
                <MessageSquare className="w-8 h-8 text-brand-neutral-muted/30 mx-auto mb-2" />
                <p className="text-brand-neutral-muted text-xs">No sessions yet</p>
                <p className="text-brand-neutral-muted/60 text-xs">Start signing to begin</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`group relative rounded-lg transition-all cursor-pointer ${
                      session.id === activeSessionId
                        ? "bg-brand-teal-hover border-l-2 border-brand-gold"
                        : "hover:bg-brand-teal-hover/50 hover:border-l-2 hover:border-brand-gold/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 px-3 py-3">
                      <Video className="w-4 h-4 text-brand-gold flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-brand-neutral-light text-sm truncate">{session.title}</div>
                        <div className="text-brand-neutral-muted text-xs">
                          {formatSessionDate(session.updated_at)} · {session.translation_count} translations
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        disabled={deletingSessionId === session.id}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-brand-error/10 rounded transition-all flex-shrink-0"
                        title="Delete session"
                      >
                        {deletingSessionId === session.id ? (
                          <Loader2 className="w-4 h-4 text-brand-neutral-muted animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-brand-error/70" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-brand-teal-light space-y-2">
          <button
            onClick={handleDownloadSession}
            disabled={!activeSessionId}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-brand-neutral-muted hover:text-brand-gold hover:bg-brand-teal-hover/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            <span>Download Transcript</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-brand-neutral-muted hover:text-brand-gold hover:bg-brand-teal-hover/50 rounded-lg transition-colors">
            <FileText className="w-5 h-5" />
            <span>Transcripts</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-brand-teal border-b border-brand-teal-light px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 px-4 py-2 bg-brand-teal-light border border-brand-gold/30 text-brand-neutral-light hover:bg-brand-orange hover:border-brand-orange rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>

              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {connectionStatus === "connected" ? (
                  <Wifi className={`w-4 h-4 ${connectionColor}`} />
                ) : (
                  <WifiOff className={`w-4 h-4 ${connectionColor}`} />
                )}
                <span className={`text-xs ${connectionColor}`}>{connectionLabel}</span>
              </div>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center gap-2 bg-brand-teal-panel rounded-xl p-1 border border-brand-teal-light">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={`px-6 py-2 rounded-lg transition-colors ${
                    activeLanguage === lang
                      ? "bg-brand-orange text-brand-neutral-light"
                      : "text-brand-neutral-muted hover:border hover:border-brand-gold/50"
                  }`}
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 text-brand-neutral-light hover:bg-brand-teal-hover rounded-lg transition-colors"
              >
                <User className="w-5 h-5" />
                <span className="text-sm hidden md:inline">{user?.display_name || "User"}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-brand-teal-light border border-brand-gold/20 rounded-xl shadow-lg overflow-hidden z-50">
                    <div className="p-3 border-b border-brand-teal">
                      <div className="text-brand-neutral-light text-sm">{user?.display_name || "User"}</div>
                      <div className="text-brand-neutral-muted text-xs">{user?.email || ""}</div>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate("/settings");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-brand-neutral-muted hover:text-brand-gold hover:bg-brand-teal-hover/50 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                      <div className="h-px bg-brand-teal my-2" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-brand-neutral-muted hover:text-brand-orange hover:bg-brand-teal-hover/50 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-2 gap-6 p-8 overflow-hidden">
          {/* Left: Video + Controls */}
          <div className="space-y-4">
            {/* Video Feed */}
            <div className="relative aspect-video bg-brand-teal rounded-xl overflow-hidden border-2 border-brand-gold shadow-lg shadow-brand-gold/10">
              <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover ${isCameraOn ? "" : "hidden"}`}
                playsInline
                muted
              />

              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    {permissionDenied ? (
                      <>
                        <div className="w-24 h-24 bg-brand-error/10 rounded-full flex items-center justify-center mx-auto">
                          <VideoOff className="w-12 h-12 text-brand-error" />
                        </div>
                        <div className="text-brand-error text-sm max-w-xs">{cameraError}</div>
                      </>
                    ) : (
                      <>
                        <div className="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto">
                          <Video className="w-12 h-12 text-brand-gold" />
                        </div>
                        <div className="text-brand-neutral-muted">
                          {cameraError || "Click Start Recording to begin"}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Current Sign Overlay */}
              {currentSign && isCameraOn && (
                <div className="absolute bottom-4 left-4 right-4 px-4 py-3 bg-brand-teal-panel/90 backdrop-blur-sm rounded-lg border border-brand-gold/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-brand-gold text-lg font-semibold">{currentSign.sign}</span>
                      {currentSign.cached && (
                        <span className="ml-2 text-xs text-brand-neutral-muted">(cached)</span>
                      )}
                    </div>
                    <ConfidenceBadge confidence={Math.round(currentSign.confidence * 100)} />
                  </div>
                </div>
              )}

              {/* Recording Indicator */}
              {isRecording && isCameraOn && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-brand-error/90 backdrop-blur-sm rounded-lg">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-xs font-medium">REC</span>
                </div>
              )}

              {/* Connection Status Badge */}
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-brand-teal-panel/90 backdrop-blur-sm rounded-lg border border-brand-gold/30">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus === "connected" ? "bg-green-400" : connectionStatus === "error" ? "bg-brand-error" : "bg-brand-gold"
                    }`}
                  />
                  <span className={`text-xs ${connectionColor}`}>{connectionLabel}</span>
                </div>
              </div>

              {/* Gloss Buffer */}
              {glossBuffer.length > 0 && (
                <div className="absolute top-4 left-4 right-20 px-3 py-1.5 bg-brand-teal-panel/80 backdrop-blur-sm rounded-lg">
                  <span className="text-brand-gold text-xs">
                    {glossBuffer.join(" → ")}
                  </span>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleRecording}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                  isRecording
                    ? "bg-brand-error text-white hover:bg-brand-error/90"
                    : "bg-brand-orange text-brand-neutral-light hover:bg-brand-orange-dark"
                }`}
              >
                {isRecording ? (
                  <>
                    <StopCircle className="w-5 h-5" />
                    Pause Recognition
                  </>
                ) : (
                  <>
                    <Video className="w-5 h-5" />
                    Start Recording
                  </>
                )}
              </button>

              {isRecording && glossBuffer.length > 0 && (
                <button
                  onClick={handleEndSentence}
                  className="flex items-center gap-2 px-4 py-3 bg-brand-gold text-brand-teal rounded-xl hover:bg-brand-gold-light transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  End Sentence
                </button>
              )}

              {isCameraOn && !isRecording && (
                <button
                  onClick={stopCamera}
                  title="Stop Camera"
                  aria-label="Stop Camera"
                  className="px-4 py-3 text-brand-neutral-muted hover:text-brand-error border border-brand-teal-light rounded-xl transition-colors"
                >
                  <VideoOff className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Audio Player */}
            <div className="bg-brand-teal-light border border-brand-gold/20 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => audioPlayer.togglePlay()}
                  className="w-12 h-12 bg-brand-orange hover:bg-brand-orange-dark rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                >
                  {audioPlayer.isPlaying ? (
                    <Pause className="w-5 h-5 text-brand-neutral-light" />
                  ) : (
                    <Play className="w-5 h-5 text-brand-neutral-light ml-0.5" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-brand-neutral-muted mb-2">
                    <span>Audio Playback</span>
                    <span>
                      {audioPlayer.formatTime(audioPlayer.currentTime)} / {audioPlayer.formatTime(audioPlayer.duration)}
                    </span>
                  </div>
                  <div
                    className="h-2 bg-brand-teal rounded-full overflow-hidden cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const percent = ((e.clientX - rect.left) / rect.width) * 100;
                      audioPlayer.seek(percent);
                    }}
                  >
                    <div
                      className="h-full bg-brand-gold transition-all"
                      style={{ width: `${audioPlayer.progress}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => audioPlayer.changeVolume(audioPlayer.volume > 0 ? 0 : 1)}
                  className="p-2 hover:bg-brand-teal-hover rounded-lg transition-colors flex-shrink-0"
                >
                  {audioPlayer.volume > 0 ? (
                    <Volume2 className="w-5 h-5 text-brand-gold" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-brand-neutral-muted" />
                  )}
                </button>
              </div>
              {audioPlayer.error && (
                <p className="text-brand-error text-xs mt-2">{audioPlayer.error}</p>
              )}
            </div>
          </div>

          {/* Right: Transcript & Translation Panel */}
          <div className="flex flex-col overflow-hidden">
            <div className="mb-4">
              <h3 className="text-brand-neutral-light mb-1">Live Translation</h3>
              <p className="text-brand-neutral-muted text-sm">
                ASL → English{activeLanguage !== "en" ? ` → ${LANGUAGE_LABELS[activeLanguage]}` : ""}
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {allTranscriptEntries.map((entry) => (
                <TranscriptCard
                  key={entry.id}
                  entry={entry}
                  targetLanguage={activeLanguage}
                  onPlayAudio={(url) => audioPlayer.play(url)}
                />
              ))}

              {allTranscriptEntries.length === 0 && (
                <div className="flex items-center justify-center h-full text-center">
                  <div className="text-brand-neutral-muted">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start signing to begin translation</p>
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(31, 58, 68, 0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(216, 154, 61, 0.5); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(216, 154, 61, 0.7); }
      `}</style>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 85) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-gold/10 border border-brand-gold/30 rounded text-xs text-brand-gold">
        <CheckCircle2 className="w-3 h-3" />
        {confidence}%
      </div>
    );
  }
  if (confidence >= 70) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-gold/10 border border-brand-gold/20 rounded text-xs text-brand-gold/70">
        <Clock className="w-3 h-3" />
        {confidence}%
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-error/10 border border-brand-error/30 rounded text-xs text-brand-error/80">
      <AlertCircle className="w-3 h-3" />
      {confidence}%
    </div>
  );
}

function TranscriptCard({
  entry,
  targetLanguage,
  onPlayAudio,
}: {
  entry: TranscriptEntry;
  targetLanguage: Language;
  onPlayAudio: (url: string) => void;
}) {
  const confidence = entry.confidence > 1 ? entry.confidence : Math.round(entry.confidence * 100);
  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="bg-brand-teal-light border border-brand-teal rounded-xl p-4 hover:border-brand-gold/30 transition-colors space-y-4">
      {/* Gloss sequence */}
      {entry.glossSequence.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.glossSequence.map((g, i) => (
            <span key={i} className="px-2 py-0.5 bg-brand-teal rounded text-xs text-brand-gold font-mono">
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Recognized English */}
      <div>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-gold" />
            <span className="text-brand-neutral-muted text-xs uppercase tracking-wider">
              Recognized (English)
            </span>
            <span className="text-brand-neutral-muted text-xs">{time}</span>
          </div>
          <div className="flex items-center gap-2">
            {entry.audioUrl && (
              <button
                onClick={() => onPlayAudio(entry.audioUrl!)}
                className="p-1 hover:bg-brand-gold/10 rounded transition-colors"
                title="Play audio"
              >
                <Volume2 className="w-3.5 h-3.5 text-brand-gold" />
              </button>
            )}
            <ConfidenceBadge confidence={confidence} />
          </div>
        </div>
        <p className="text-brand-neutral-light">{entry.sourceText}</p>
      </div>

      {/* Translation */}
      {targetLanguage !== "en" && entry.translatedText && (
        <div className="pt-3 border-t border-brand-gold/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-brand-orange" />
            <span className="text-brand-neutral-muted text-xs uppercase tracking-wider">
              Translated ({LANGUAGE_LABELS[targetLanguage]})
            </span>
          </div>
          <p className="text-brand-neutral-light">{entry.translatedText}</p>
        </div>
      )}

      {targetLanguage === "en" && !entry.translatedText && (
        <div className="pt-2 text-brand-neutral-muted/50 text-xs italic">
          English is the source language
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function translationToTranscriptEntry(t: Translation): TranscriptEntry {
  return {
    id: t.id,
    sourceText: t.source_text,
    translatedText: t.translated_text,
    glossSequence: t.gloss_sequence,
    confidence: t.confidence_avg,
    language: t.target_lang,
    timestamp: t.created_at,
    audioUrl: null,
  };
}

function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
