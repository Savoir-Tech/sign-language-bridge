import { useState } from "react";
import { useNavigate } from "react-router";
import {
  MessageSquare,
  Video,
  Settings,
  FileText,
  Volume2,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  User,
  LogOut,
  ChevronDown,
  Download,
} from "lucide-react";

type Session = {
  id: string;
  name: string;
  timestamp: string;
  active?: boolean;
};

type TranscriptEntry = {
  id: string;
  englishText: string;
  timestamp: string;
  confidence: number;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeLanguage, setActiveLanguage] = useState<"english" | "french" | "spanish">("english");
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    {
      id: "1",
      englishText: "I need help with my medication",
      timestamp: "10:45:12",
      confidence: 92,
    },
    {
      id: "2",
      englishText: "Can you tell me which medication?",
      timestamp: "10:45:18",
      confidence: 100,
    },
    {
      id: "3",
      englishText: "The prescription from last week",
      timestamp: "10:45:24",
      confidence: 88,
    },
  ]);

  const sessions: Session[] = [
    { id: "1", name: "Emergency Call #2847", timestamp: "10:45 AM", active: true },
    { id: "2", name: "Patient Consultation", timestamp: "9:30 AM" },
    { id: "3", name: "General Session", timestamp: "Yesterday" },
  ];

  const handleNewChat = () => {
    setTranscript([]);
    setActiveLanguage("english");
    // Reset session state
  };

  const handleLogout = () => {
    // Handle logout logic
    navigate("/");
  };

  const handleDownloadSession = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent session selection when clicking download
    
    // Generate transcript content for download
    const sessionData = {
      sessionName: session.name,
      timestamp: session.timestamp,
      date: new Date().toLocaleDateString(),
      targetLanguage: activeLanguage,
      transcript: transcript.map((entry) => ({
        timestamp: entry.timestamp,
        recognizedEnglish: entry.englishText,
        translation: activeLanguage !== "english" 
          ? getTranslation(entry.englishText, activeLanguage as "french" | "spanish")
          : null,
        confidence: entry.confidence,
      })),
    };

    // Create formatted text version
    let textContent = `Sign Language Bridge - Session Transcript\n`;
    textContent += `${"=".repeat(50)}\n\n`;
    textContent += `Session: ${sessionData.sessionName}\n`;
    textContent += `Date: ${sessionData.date}\n`;
    textContent += `Time: ${sessionData.timestamp}\n`;
    textContent += `Translation Language: ${activeLanguage.charAt(0).toUpperCase() + activeLanguage.slice(1)}\n\n`;
    textContent += `${"=".repeat(50)}\n\n`;

    sessionData.transcript.forEach((entry, index) => {
      textContent += `[${entry.timestamp}] - Confidence: ${entry.confidence}%\n`;
      textContent += `Recognized (English): ${entry.recognizedEnglish}\n`;
      if (entry.translation) {
        textContent += `Translated (${activeLanguage}): ${entry.translation}\n`;
      }
      textContent += `\n${"-".repeat(50)}\n\n`;
    });

    // Create and download the file
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${session.name.replace(/\s+/g, "_")}_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Mock translation function
  const getTranslation = (text: string, targetLang: "french" | "spanish") => {
    const translations: Record<string, Record<string, string>> = {
      "I need help with my medication": {
        french: "J'ai besoin d'aide avec mes médicaments",
        spanish: "Necesito ayuda con mi medicación",
      },
      "Can you tell me which medication?": {
        french: "Pouvez-vous me dire quel médicament?",
        spanish: "¿Puedes decirme qué medicamento?",
      },
      "The prescription from last week": {
        french: "L'ordonnance de la semaine dernière",
        spanish: "La receta de la semana pasada",
      },
    };
    return translations[text]?.[targetLang] || text;
  };

  return (
    <div className="h-screen flex bg-brand-teal-panel">
      {/* Sidebar */}
      <aside className="w-72 bg-brand-teal border-r border-brand-teal-light flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-brand-teal-light">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-brand-teal" />
            </div>
            <span className="text-brand-neutral-light">Sign Language Bridge</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="mb-6">
            <div className="text-brand-neutral-muted text-xs uppercase tracking-wider mb-3 px-3">
              Sessions
            </div>
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative rounded-lg transition-all ${
                    session.active
                      ? "bg-brand-teal-hover border-l-2 border-brand-gold"
                      : "hover:bg-brand-teal-hover/50 hover:border-l-2 hover:border-brand-gold/50"
                  }`}
                >
                  <div className="flex items-center gap-3 px-3 py-3">
                    <Video className="w-4 h-4 text-brand-gold flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-brand-neutral-light text-sm truncate">
                        {session.name}
                      </div>
                      <div className="text-brand-neutral-muted text-xs">
                        {session.timestamp}
                      </div>
                    </div>
                    {/* Download Button */}
                    <button
                      onClick={(e) => handleDownloadSession(session, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-brand-gold/10 rounded transition-all flex-shrink-0"
                      title="Download transcript"
                    >
                      <Download className="w-4 h-4 text-brand-gold" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-brand-teal-light space-y-2">
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
            {/* Left: New Chat */}
            <div>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 px-4 py-2 bg-brand-teal-light border border-brand-gold/30 text-brand-neutral-light hover:bg-brand-orange hover:border-brand-orange rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            {/* Center: Language Toggle */}
            <div className="flex items-center gap-2 bg-brand-teal-panel rounded-xl p-1 border border-brand-teal-light">
              <button
                onClick={() => setActiveLanguage("english")}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  activeLanguage === "english"
                    ? "bg-brand-orange text-brand-neutral-light"
                    : "text-brand-neutral-muted hover:border hover:border-brand-gold/50"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setActiveLanguage("french")}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  activeLanguage === "french"
                    ? "bg-brand-orange text-brand-neutral-light"
                    : "text-brand-neutral-muted hover:border hover:border-brand-gold/50"
                }`}
              >
                French
              </button>
              <button
                onClick={() => setActiveLanguage("spanish")}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  activeLanguage === "spanish"
                    ? "bg-brand-orange text-brand-neutral-light"
                    : "text-brand-neutral-muted hover:border hover:border-brand-gold/50"
                }`}
              >
                Spanish
              </button>
            </div>

            {/* Right: Settings & User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 text-brand-neutral-light hover:bg-brand-teal-hover rounded-lg transition-colors"
              >
                <User className="w-5 h-5" />
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-brand-teal-light border border-brand-gold/20 rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="p-3 border-b border-brand-teal">
                    <div className="text-brand-neutral-light text-sm">User Account</div>
                    <div className="text-brand-neutral-muted text-xs">user@example.com</div>
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
              )}
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-2 gap-6 p-8 overflow-hidden">
          {/* Video Frame */}
          <div className="space-y-4">
            <div className="relative aspect-video bg-brand-teal rounded-xl overflow-hidden border-2 border-brand-gold shadow-lg shadow-brand-gold/10">
              {/* Simulated video feed */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto">
                    <Video className="w-12 h-12 text-brand-gold" />
                  </div>
                  <div className="text-brand-neutral-muted">Camera Feed Active</div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse" />
                    <span className="text-brand-gold text-sm">Recognizing ASL...</span>
                  </div>
                </div>
              </div>

              {/* Recognition Status */}
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-brand-teal-panel/90 backdrop-blur-sm rounded-lg border border-brand-gold/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-brand-gold rounded-full" />
                  <span className="text-brand-gold text-xs">High Confidence</span>
                </div>
              </div>
            </div>

            {/* Audio Player */}
            <div className="bg-brand-teal-light border border-brand-gold/20 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 bg-brand-orange hover:bg-brand-orange-dark rounded-full flex items-center justify-center transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-brand-neutral-light" />
                  ) : (
                    <Play className="w-5 h-5 text-brand-neutral-light ml-0.5" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-brand-neutral-muted mb-2">
                    <span>Audio Playback</span>
                    <span>00:12:34</span>
                  </div>
                  <div className="h-2 bg-brand-teal rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-gold transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <button className="p-2 hover:bg-brand-teal-hover rounded-lg transition-colors">
                  <Volume2 className="w-5 h-5 text-brand-gold" />
                </button>
              </div>
            </div>
          </div>

          {/* Transcript & Translation Panel */}
          <div className="flex flex-col overflow-hidden">
            <div className="mb-4">
              <h3 className="text-brand-neutral-light mb-1">Live Translation</h3>
              <p className="text-brand-neutral-muted text-sm">
                ASL → English → {activeLanguage === "french" ? "French" : activeLanguage === "spanish" ? "Spanish" : "English"}
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {transcript.map((entry) => (
                <TranscriptCard
                  key={entry.id}
                  entry={entry}
                  targetLanguage={activeLanguage}
                  getTranslation={getTranslation}
                />
              ))}

              {transcript.length === 0 && (
                <div className="flex items-center justify-center h-full text-center">
                  <div className="text-brand-neutral-muted">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start signing to begin translation</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 58, 68, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(216, 154, 61, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(216, 154, 61, 0.7);
        }
      `}</style>
    </div>
  );
}

function TranscriptCard({
  entry,
  targetLanguage,
  getTranslation,
}: {
  entry: TranscriptEntry;
  targetLanguage: "english" | "french" | "spanish";
  getTranslation: (text: string, lang: "french" | "spanish") => string;
}) {
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 85) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-gold/10 border border-brand-gold/30 rounded text-xs text-brand-gold">
          <CheckCircle2 className="w-3 h-3" />
          {confidence}%
        </div>
      );
    } else if (confidence >= 70) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-gold/10 border border-brand-gold/20 rounded text-xs text-brand-gold/70">
          <Clock className="w-3 h-3" />
          {confidence}%
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-error/10 border border-brand-error/30 rounded text-xs text-brand-error/80">
          <AlertCircle className="w-3 h-3" />
          {confidence}%
        </div>
      );
    }
  };

  return (
    <div className="bg-brand-teal-light border border-brand-teal rounded-xl p-4 hover:border-brand-gold/30 transition-colors space-y-4">
      {/* Section A: Recognized English Text */}
      <div>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-gold" />
            <span className="text-brand-neutral-muted text-xs uppercase tracking-wider">
              Recognized (English)
            </span>
            <span className="text-brand-neutral-muted text-xs">{entry.timestamp}</span>
          </div>
          {getConfidenceBadge(entry.confidence)}
        </div>
        <p className="text-brand-neutral-light">{entry.englishText}</p>
      </div>

      {/* Section B: Translated Output */}
      {targetLanguage !== "english" && (
        <div className="pt-3 border-t border-brand-gold/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-brand-orange" />
            <span className="text-brand-neutral-muted text-xs uppercase tracking-wider">
              Translated ({targetLanguage === "french" ? "French" : "Spanish"})
            </span>
          </div>
          <p className="text-brand-neutral-light">
            {getTranslation(entry.englishText, targetLanguage as "french" | "spanish")}
          </p>
        </div>
      )}

      {/* Note when English is selected */}
      {targetLanguage === "english" && (
        <div className="pt-2 text-brand-neutral-muted/50 text-xs italic">
          English is the source language
        </div>
      )}
    </div>
  );
}