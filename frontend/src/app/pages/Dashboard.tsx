import { useEffect, useCallback, useRef, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router";
import { GlassPanel, GlassButton } from "@/app/components/ui/liquid-glass";
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
  LayoutDashboard,
  Languages,
  Globe,
  Flag,
  Hand,
} from "lucide-react";
import { toast } from "sonner";
import { ExpandableTabs } from "@/app/components/ui/expandable-tabs";
import { useAuthStore } from "@/lib/stores/authStore";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarTrigger,
  SidebarRail,
  SidebarSeparator,
} from "@/app/components/ui/sidebar";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { useRecognitionStore } from "@/lib/stores/recognitionStore";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { useCamera } from "@/lib/hooks/useCamera";
import { useLandmarkOverlay } from "@/lib/hooks/useLandmarkOverlay";
import { useAudioPlayer } from "@/lib/hooks/useAudioPlayer";
import type { Language, TranscriptEntry, Translation } from "@/types";
import { LANGUAGE_LABELS } from "@/types";

const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
);

const LANGUAGES: Language[] = ["en", "fr", "es"];

const LANGUAGE_TABS = [
  { title: "English", icon: Languages },
  { title: "Français", icon: Globe },
  { title: "Español", icon: Flag },
];

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
    bufferProgress,
    autoPlayUrl,
    setActiveLanguage,
    clearTranscript,
    setIsRecording,
    setAutoPlayUrl,
  } = useRecognitionStore();

  const { connect, disconnect, sendFrame, endSentence, setLanguage, setSession } = useWebSocket();
  const audioPlayer = useAudioPlayer();

  useEffect(() => {
    if (autoPlayUrl) {
      audioPlayer.play(autoPlayUrl);
      setAutoPlayUrl(null);
    }
  }, [autoPlayUrl, audioPlayer, setAutoPlayUrl]);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isShaderHovered, setIsShaderHovered] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // sendFrame() already gates on ws.readyState === OPEN, so no need to
  // capture connectionStatus here (which causes stale-closure frame drops).
  const handleFrame = useCallback(
    (frameBase64: string) => {
      console.log(`[FRAME-GATE] isRecording=${isRecording}, payload=${frameBase64.length} bytes`);
      if (isRecording) {
        sendFrame(frameBase64);
      }
    },
    [isRecording, sendFrame]
  );

  const { videoRef, isCameraOn, error: cameraError, permissionDenied, startCamera, stopCamera } = useCamera({
    onFrame: handleFrame,
    fps: 10,
    enabled: isRecording,
  });

  const { canvasRef, isReady: landmarksReady, error: landmarksError } = useLandmarkOverlay({
    videoRef,
    enabled: showLandmarks && isCameraOn,
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
      // Set recording BEFORE connect so onclose sees isRecording=true and reconnects
      setIsRecording(true);
      if (connectionStatus !== "connected") connect();

      if (!activeSessionId) {
        try {
          const session = await createSession(activeLanguage);
          if (connectionStatus === "connected") setSession(session.id);
        } catch {
          toast.error("Failed to create session");
          setIsRecording(false);
          return;
        }
      }
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
    connecting: "text-brand-forsytha",
    reconnecting: "text-brand-forsytha",
    disconnected: "text-brand-mystic",
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
    <SidebarProvider defaultOpen={false} className="h-screen bg-brand-oceanic-deep">
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-brand-nocturnal !p-0">
          <div className="flex items-center gap-3 px-4 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center transition-all duration-200">
            <div className="w-8 h-8 bg-brand-forsytha rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-brand-oceanic" />
            </div>
            <span className="font-medium text-sidebar-foreground whitespace-nowrap overflow-hidden group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 transition-all duration-200">
              Sign Language Bridge
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent className="custom-scrollbar">
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip="Dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Settings" onClick={() => navigate("/settings")}>
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Sessions</SidebarGroupLabel>
            <SidebarMenu>
              {sessionsLoading && sessions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-sidebar-primary animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 px-3 group-data-[collapsible=icon]:hidden">
                  <MessageSquare className="w-8 h-8 text-sidebar-foreground/30 mx-auto mb-2" />
                  <p className="text-sidebar-foreground/70 text-xs">No sessions yet</p>
                  <p className="text-sidebar-foreground/50 text-xs">Start signing to begin</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      isActive={session.id === activeSessionId}
                      tooltip={session.title}
                      onClick={() => handleSelectSession(session.id)}
                    >
                      <Video />
                      <span>{session.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      onClick={(e) => handleDeleteSession(session.id, e as React.MouseEvent)}
                    >
                      {deletingSessionId === session.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-brand-nocturnal">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Download Transcript" onClick={handleDownloadSession} disabled={!activeSessionId}>
                <Download />
                <span>Download Transcript</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Transcripts">
                <FileText />
                <span>Transcripts</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Logout" onClick={handleLogout}>
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col overflow-hidden relative"
        onMouseEnter={() => setIsShaderHovered(true)}
        onMouseLeave={() => setIsShaderHovered(false)}
      >
        {/* Shader background layer */}
        <Suspense fallback={<div className="absolute inset-0 bg-muted/20" />}>
          <div className="absolute inset-0 z-0 pointer-events-none opacity-30 mix-blend-screen">
            <Dithering
              colorBack="#00000000"
              colorFront="#FFC801"
              shape="warp"
              type="4x4"
              speed={isShaderHovered ? 0.6 : 0.2}
              className="size-full"
              minPixelRatio={1}
            />
          </div>
        </Suspense>

        {/* Existing content */}
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-brand-nocturnal/30">
          {/* Left: Sidebar trigger + New Chat + Connection */}
          <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden text-brand-arctic" />
            <GlassButton
              onClick={handleNewChat}
              className="rounded-full px-4 py-2 text-sm text-brand-arctic"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </GlassButton>
            <div className="flex items-center gap-2 text-sm">
              {connectionStatus === "connected" ? (
                <Wifi className={`w-4 h-4 ${connectionColor}`} />
              ) : (
                <WifiOff className={`w-4 h-4 ${connectionColor}`} />
              )}
              <span className={`hidden md:inline text-xs ${connectionColor}`}>{connectionLabel}</span>
            </div>
          </div>

          {/* Center: Language toggles */}
          <ExpandableTabs
            tabs={LANGUAGE_TABS}
            activeIndex={LANGUAGES.indexOf(activeLanguage)}
            onChange={(index) => handleLanguageChange(LANGUAGES[index])}
          />

          {/* Right: User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 text-brand-arctic hover:text-brand-forsytha rounded-lg transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="text-sm hidden md:inline">{user?.display_name || "User"}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-brand-nocturnal border border-brand-forsytha/20 rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="p-3 border-b border-brand-oceanic">
                    <div className="text-brand-arctic text-sm">{user?.display_name || "User"}</div>
                    <div className="text-brand-mystic text-xs">{user?.email || ""}</div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate("/settings");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-brand-mystic hover:text-brand-forsytha hover:bg-brand-nocturnal-hover/50 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <div className="h-px bg-brand-oceanic my-2" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-brand-mystic hover:text-brand-saffron hover:bg-brand-nocturnal-hover/50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-[3fr_2fr] gap-6 p-8 overflow-hidden">
          {/* Left: Video + Controls */}
          <div className="space-y-4">
            {/* Video Feed */}
            <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-brand-forsytha shadow-lg shadow-brand-forsytha/10">
              {/* Glass background layers */}
              <div className="absolute inset-0 z-0" style={{ backdropFilter: "blur(8px)", filter: "url(#glass-distortion)", isolation: "isolate" }} />
              <div className="absolute inset-0 z-0" style={{ background: "rgba(255, 255, 255, 0.08)" }} />
              <div className="absolute inset-0 z-0" style={{ boxShadow: "inset 2px 2px 1px 0 rgba(255,255,255,0.15), inset -1px -1px 1px 1px rgba(255,255,255,0.1)" }} />

              <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover ${isCameraOn ? "" : "hidden"}`}
                autoPlay
                playsInline
                muted
              />

              {/* MediaPipe Landmark Overlay (troubleshooting) */}
              {showLandmarks && isCameraOn && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  style={{ objectFit: "cover" }}
                />
              )}
              {showLandmarks && landmarksError && (
                <div className="absolute bottom-20 left-4 right-4 px-3 py-2 bg-brand-error/90 rounded-lg text-white text-xs z-20">
                  Landmarks: {landmarksError}
                </div>
              )}

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
                        <div className="w-24 h-24 bg-brand-forsytha/10 rounded-full flex items-center justify-center mx-auto">
                          <Video className="w-12 h-12 text-brand-forsytha" />
                        </div>
                        <div className="text-brand-mystic">
                          {cameraError || "Click Start Recording to begin"}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Current Sign Overlay */}
              {currentSign && isCameraOn && (
                <div className="absolute bottom-4 left-4 right-4 px-4 py-3 bg-brand-oceanic-deep/90 backdrop-blur-sm rounded-lg border border-brand-forsytha/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-brand-forsytha text-lg font-semibold">{currentSign.sign}</span>
                      {currentSign.cached && (
                        <span className="ml-2 text-xs text-brand-mystic">(cached)</span>
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
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-brand-oceanic-deep/90 backdrop-blur-sm rounded-lg border border-brand-forsytha/30">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus === "connected" ? "bg-green-400" : connectionStatus === "error" ? "bg-brand-error" : "bg-brand-forsytha"
                    }`}
                  />
                  <span className={`text-xs ${connectionColor}`}>{connectionLabel}</span>
                </div>
              </div>

              {/* Gloss Buffer */}
              {glossBuffer.length > 0 && (
                <div className="absolute top-4 left-4 right-20 px-3 py-1.5 bg-brand-oceanic-deep/80 backdrop-blur-sm rounded-lg">
                  <span className="text-brand-forsytha text-xs">
                    {glossBuffer.join(" → ")}
                  </span>
                </div>
              )}

              {/* Buffer Progress */}
              {isRecording && isCameraOn && bufferProgress && bufferProgress.frames < bufferProgress.required && (
                <div className="absolute bottom-4 left-4 right-4 px-4 py-2 bg-brand-oceanic-deep/90 backdrop-blur-sm rounded-lg border border-brand-forsytha/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-brand-mystic text-xs">
                      {bufferProgress.demo ? "Demo mode — " : ""}Collecting frames...
                    </span>
                    <span className="text-brand-forsytha text-xs font-mono">
                      {bufferProgress.frames}/{bufferProgress.required}
                    </span>
                  </div>
                  <div className="h-1.5 bg-brand-oceanic rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-forsytha rounded-full transition-all duration-200"
                      style={{ width: `${Math.min(100, (bufferProgress.frames / bufferProgress.required) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex items-center gap-3">
              <GlassButton
                onClick={handleToggleRecording}
                className={`flex-1 justify-center px-4 py-3 rounded-xl ${
                  isRecording ? "text-brand-error" : "text-brand-arctic"
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
              </GlassButton>

              {isRecording && glossBuffer.length > 0 && (
                <button
                  onClick={handleEndSentence}
                  className="flex items-center gap-2 px-4 py-3 bg-brand-forsytha text-brand-oceanic rounded-xl hover:bg-brand-forsytha-light transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  End Sentence
                </button>
              )}

              {isCameraOn && (
                <button
                  onClick={() => setShowLandmarks((v) => !v)}
                  title={showLandmarks ? "Hide landmarks" : "Show landmarks (troubleshooting)"}
                  aria-label={showLandmarks ? "Hide landmarks" : "Show landmarks"}
                  className={`px-4 py-3 rounded-xl border transition-colors ${
                    showLandmarks
                      ? "bg-brand-forsytha/20 text-brand-forsytha border-brand-forsytha/50"
                      : "text-brand-mystic hover:text-brand-forsytha border-brand-nocturnal"
                  }`}
                >
                  <Hand className="w-5 h-5" />
                </button>
              )}
              {isCameraOn && !isRecording && (
                <button
                  onClick={stopCamera}
                  title="Stop Camera"
                  aria-label="Stop Camera"
                  className="px-4 py-3 text-brand-mystic hover:text-brand-error border border-brand-nocturnal rounded-xl transition-colors"
                >
                  <VideoOff className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Audio Player */}
            <GlassPanel className="rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => audioPlayer.togglePlay()}
                  className="w-12 h-12 bg-brand-saffron hover:bg-brand-saffron-dark rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                >
                  {audioPlayer.isPlaying ? (
                    <Pause className="w-5 h-5 text-brand-arctic" />
                  ) : (
                    <Play className="w-5 h-5 text-brand-arctic ml-0.5" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-brand-mystic mb-2">
                    <span>Audio Playback</span>
                    <span>
                      {audioPlayer.formatTime(audioPlayer.currentTime)} / {audioPlayer.formatTime(audioPlayer.duration)}
                    </span>
                  </div>
                  <div
                    className="h-2 bg-brand-oceanic rounded-full overflow-hidden cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const percent = ((e.clientX - rect.left) / rect.width) * 100;
                      audioPlayer.seek(percent);
                    }}
                  >
                    <div
                      className="h-full bg-brand-forsytha transition-all"
                      style={{ width: `${audioPlayer.progress}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => audioPlayer.changeVolume(audioPlayer.volume > 0 ? 0 : 1)}
                  className="p-2 hover:bg-brand-nocturnal-hover rounded-lg transition-colors flex-shrink-0"
                >
                  {audioPlayer.volume > 0 ? (
                    <Volume2 className="w-5 h-5 text-brand-forsytha" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-brand-mystic" />
                  )}
                </button>
              </div>
              {audioPlayer.error && (
                <p className="text-brand-error text-xs mt-2">{audioPlayer.error}</p>
              )}
            </GlassPanel>
          </div>

          {/* Right: Transcript & Translation Panel */}
          <GlassPanel className="flex flex-col overflow-hidden rounded-xl border border-white/10 p-4">
            <div className="mb-4">
              <h3 className="text-brand-arctic mb-1">Live Translation</h3>
              <p className="text-brand-mystic text-sm">
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
                  <div className="text-brand-mystic">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start signing to begin translation</p>
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>
          </GlassPanel>
        </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(23, 43, 54, 0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 200, 1, 0.5); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 200, 1, 0.7); }
      `}</style>
    </SidebarProvider>
  );
}

// ── Subcomponents ────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 85) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-forsytha/10 border border-brand-forsytha/30 rounded text-xs text-brand-forsytha">
        <CheckCircle2 className="w-3 h-3" />
        {confidence}%
      </div>
    );
  }
  if (confidence >= 70) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-forsytha/10 border border-brand-forsytha/20 rounded text-xs text-brand-forsytha/70">
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
    <div className="bg-brand-nocturnal border border-brand-oceanic rounded-xl p-4 hover:border-brand-forsytha/30 transition-colors space-y-4">
      {/* Gloss sequence */}
      {entry.glossSequence.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.glossSequence.map((g, i) => (
            <span key={i} className="px-2 py-0.5 bg-brand-oceanic rounded text-xs text-brand-forsytha font-mono">
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Recognized English */}
      <div>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-forsytha" />
            <span className="text-brand-mystic text-xs uppercase tracking-wider">
              Recognized (English)
            </span>
            <span className="text-brand-mystic text-xs">{time}</span>
          </div>
          <div className="flex items-center gap-2">
            {entry.audioUrl && (
              <button
                onClick={() => onPlayAudio(entry.audioUrl!)}
                className="p-1 hover:bg-brand-forsytha/10 rounded transition-colors"
                title="Play audio"
              >
                <Volume2 className="w-3.5 h-3.5 text-brand-forsytha" />
              </button>
            )}
            <ConfidenceBadge confidence={confidence} />
          </div>
        </div>
        <p className="text-brand-arctic">{entry.sourceText}</p>
      </div>

      {/* Translation */}
      {targetLanguage !== "en" && entry.translatedText && (
        <div className="pt-3 border-t border-brand-forsytha/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-brand-saffron" />
            <span className="text-brand-mystic text-xs uppercase tracking-wider">
              Translated ({LANGUAGE_LABELS[targetLanguage]})
            </span>
          </div>
          <p className="text-brand-arctic">{entry.translatedText}</p>
        </div>
      )}

      {targetLanguage === "en" && !entry.translatedText && (
        <div className="pt-2 text-brand-mystic/50 text-xs italic">
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
