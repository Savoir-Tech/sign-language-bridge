import { useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Sun, Moon, MessageSquare, AlertTriangle, X, Loader2, Globe, Save } from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";
import { toast } from "sonner";
import type { Language } from "@/types";
import { LANGUAGE_LABELS } from "@/types";
import { GlassPanel, GlassButton } from "@/app/components/ui/liquid-glass";

const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
);

const LANGUAGES: Language[] = ["en", "es", "fr"];

export default function Settings() {
  const navigate = useNavigate();
  const { user, updateUser, logout, isLoading } = useAuthStore();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [preferredLang, setPreferredLang] = useState<Language>(user?.preferred_lang || "en");
  const [hasChanges, setHasChanges] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleSaveProfile = async () => {
    const updates: Record<string, string> = {};
    if (displayName !== user?.display_name) updates.display_name = displayName;
    if (preferredLang !== user?.preferred_lang) updates.preferred_lang = preferredLang;

    if (Object.keys(updates).length === 0) return;

    await updateUser(updates as any);
    setHasChanges(false);
    toast.success("Profile updated successfully");
  };

  const handleDeactivateAccount = () => {
    logout();
    setShowDeactivateModal(false);
    toast.success("Account deactivated");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-brand-oceanic-deep relative overflow-hidden">
      {/* Shader background */}
      <Suspense fallback={<div className="absolute inset-0 bg-muted/20" />}>
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 mix-blend-screen">
          <Dithering
            colorBack="#00000000"
            colorFront="#FFC801"
            shape="warp"
            type="4x4"
            speed={0.2}
            className="size-full"
            minPixelRatio={1}
          />
        </div>
      </Suspense>

      <div className="relative z-10">
      <header className="border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/app")} aria-label="Back to Dashboard" className="p-2 hover:bg-accent/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-brand-arctic" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-forsytha rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-brand-oceanic" />
              </div>
              <span className="text-brand-arctic">Sign Language Bridge</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-brand-arctic mb-2">Settings</h1>
          <p className="text-brand-mystic">Manage your account, preferences, and appearance</p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <GlassPanel className="rounded-xl p-6 border border-white/10">
            <h3 className="text-brand-arctic mb-4">Profile</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-sm text-brand-arctic mb-2">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-input-background text-brand-arctic focus:border-brand-forsytha focus:outline-none focus:ring-2 focus:ring-brand-forsytha/20 transition-all"
                />
              </div>

              <div>
                <label htmlFor="userEmail" className="block text-sm text-brand-arctic mb-2">Email</label>
                <input
                  id="userEmail"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-muted/10 text-brand-mystic cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm text-brand-arctic mb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Preferred Translation Language
                  </div>
                </label>
                <div className="flex gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setPreferredLang(lang);
                        setHasChanges(true);
                      }}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        preferredLang === lang
                          ? "bg-brand-saffron text-white border-brand-saffron"
                          : "border-border text-brand-arctic hover:border-brand-forsytha/50"
                      }`}
                    >
                      {LANGUAGE_LABELS[lang]}
                    </button>
                  ))}
                </div>
              </div>

              {hasChanges && (
                <GlassButton
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="rounded-lg px-4 py-2 text-brand-arctic"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </GlassButton>
              )}
            </div>
          </GlassPanel>

          {/* Theme Settings */}
          <GlassPanel className="rounded-xl p-6 border border-white/10">
            <h3 className="text-brand-arctic mb-4">Appearance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-brand-arctic mb-1">Theme Mode</div>
                  <div className="text-sm text-brand-mystic">Choose between light and dark mode</div>
                </div>
                <GlassButton
                  onClick={toggleTheme}
                  className="rounded-lg px-4 py-2 text-brand-arctic"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="w-4 h-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4" />
                      Dark Mode
                    </>
                  )}
                </GlassButton>
              </div>
            </div>
          </GlassPanel>

          {/* Color System */}
          <GlassPanel className="rounded-xl p-6 border border-white/10">
            <h3 className="text-brand-arctic mb-4">Color System</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <ColorSwatch color="bg-brand-oceanic" label="Oceanic Noir" description="Primary Background" />
                <ColorSwatch color="bg-brand-forsytha" label="Forsytha" description="Primary Accent" />
                <ColorSwatch color="bg-brand-saffron" label="Deep Saffron" description="CTAs & Active States" />
              </div>
              <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                <p className="text-sm text-brand-arctic">
                  <strong>Design Philosophy:</strong> This color system emphasizes trust, calm,
                  and precision. The restrained palette reflects the serious nature of this accessibility tool.
                </p>
              </div>
            </div>
          </GlassPanel>

          {/* Account Management */}
          <GlassPanel className="rounded-xl p-6 border border-white/10">
            <h3 className="text-brand-arctic mb-4">Account Management</h3>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <p className="text-sm text-brand-arctic mb-4">
                  Deactivating your account will permanently delete all your sessions,
                  translation history, and personal data. This action cannot be undone.
                </p>
                <button
                  onClick={() => setShowDeactivateModal(true)}
                  className="px-4 py-2 bg-brand-error/10 border border-brand-error/30 text-brand-error hover:bg-brand-error/20 rounded-lg transition-colors text-sm"
                >
                  Deactivate Account
                </button>
              </div>
            </div>
          </GlassPanel>

          {/* About */}
          <GlassPanel className="rounded-xl p-6 border border-white/10">
            <h3 className="text-brand-arctic mb-4">About</h3>
            <div className="space-y-2 text-sm text-brand-mystic">
              <p>
                <strong className="text-brand-arctic">Sign Language Bridge</strong> is a professional
                accessibility tool for real-time sign language recognition and translation.
              </p>
              <p>Built for healthcare, emergency services, and critical communication infrastructure.</p>
              <div className="pt-4 border-t border-white/10 mt-4">
                <p className="text-xs">Version 1.0.0 · February 2026</p>
              </div>
            </div>
          </GlassPanel>
        </div>
      </main>
      </div>

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassPanel className="rounded-xl max-w-md w-full shadow-2xl border border-brand-error/30">
            <div className="flex items-start justify-between p-6 border-b border-white/10">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand-error/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-brand-error" />
                </div>
                <div>
                  <h3 className="text-brand-arctic mb-1">Deactivate Account</h3>
                  <p className="text-sm text-brand-mystic">Are you sure you want to proceed?</p>
                </div>
              </div>
              <button onClick={() => setShowDeactivateModal(false)} aria-label="Close dialog" className="p-1 hover:bg-white/10 rounded transition-colors">
                <X className="w-5 h-5 text-brand-mystic" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-brand-error/5 border border-brand-error/20 rounded-lg p-4">
                <p className="text-sm text-brand-arctic">
                  <strong>This action is permanent and cannot be undone.</strong>
                </p>
              </div>
              <p className="text-sm text-brand-mystic">Deactivating your account will permanently delete:</p>
              <ul className="text-sm text-brand-mystic space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-brand-error mt-1">•</span>
                  <span>All translation sessions and recordings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-error mt-1">•</span>
                  <span>Complete translation history and transcripts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-error mt-1">•</span>
                  <span>Personal account data and preferences</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 p-6 border-t border-white/10">
              <GlassButton
                onClick={() => setShowDeactivateModal(false)}
                className="flex-1 justify-center rounded-lg px-4 py-2.5 text-brand-arctic"
              >
                Cancel
              </GlassButton>
              <button
                onClick={handleDeactivateAccount}
                className="flex-1 px-4 py-2.5 bg-brand-error text-brand-arctic hover:bg-brand-error/90 rounded-lg transition-colors"
              >
                Deactivate Account
              </button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

function ColorSwatch({ color, label, description }: { color: string; label: string; description: string }) {
  return (
    <div>
      <div className={`w-full h-20 ${color} rounded-lg border border-white/10 mb-2`} />
      <div className="text-sm">
        <div className="text-brand-arctic">{label}</div>
        <div className="text-xs text-brand-mystic">{description}</div>
      </div>
    </div>
  );
}
