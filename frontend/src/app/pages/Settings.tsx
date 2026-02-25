import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Sun, Moon, MessageSquare, AlertTriangle, X, Loader2, Globe, Save } from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";
import { toast } from "sonner";
import type { Language } from "@/types";
import { LANGUAGE_LABELS } from "@/types";

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/app")} aria-label="Back to Dashboard" className="p-2 hover:bg-accent/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-brand-teal" />
              </div>
              <span className="text-foreground">Sign Language Bridge</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account, preferences, and appearance</p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-4">Profile</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-sm text-foreground mb-2">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-input-background text-foreground focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all"
                />
              </div>

              <div>
                <label htmlFor="userEmail" className="block text-sm text-foreground mb-2">Email</label>
                <input
                  id="userEmail"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-muted/10 text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm text-foreground mb-2">
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
                          ? "bg-brand-orange text-white border-brand-orange"
                          : "border-border text-foreground hover:border-brand-gold/50"
                      }`}
                    >
                      {LANGUAGE_LABELS[lang]}
                    </button>
                  ))}
                </div>
              </div>

              {hasChanges && (
                <button
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              )}
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-4">Appearance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-foreground mb-1">Theme Mode</div>
                  <div className="text-sm text-muted-foreground">Choose between light and dark mode</div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
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
                </button>
              </div>
            </div>
          </div>

          {/* Color System */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-4">Color System</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <ColorSwatch color="bg-brand-teal" label="Deep Teal" description="Primary Background" />
                <ColorSwatch color="bg-brand-gold" label="Accent Gold" description="Connection & Highlights" />
                <ColorSwatch color="bg-brand-orange" label="Action Orange" description="CTAs & Active States" />
              </div>
              <div className="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                <p className="text-sm text-foreground">
                  <strong>Design Philosophy:</strong> This color system emphasizes trust, calm,
                  and precision. The restrained palette reflects the serious nature of this accessibility tool.
                </p>
              </div>
            </div>
          </div>

          {/* Account Management */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-4">Account Management</h3>
            <div className="space-y-4">
              <div className="p-4 bg-muted/10 border border-muted/30 rounded-lg">
                <p className="text-sm text-foreground mb-4">
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
          </div>

          {/* About */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-4">About</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Sign Language Bridge</strong> is a professional
                accessibility tool for real-time sign language recognition and translation.
              </p>
              <p>Built for healthcare, emergency services, and critical communication infrastructure.</p>
              <div className="pt-4 border-t border-border mt-4">
                <p className="text-xs">Version 1.0.0 · February 2026</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-brand-error/30 rounded-xl max-w-md w-full shadow-2xl">
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand-error/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-brand-error" />
                </div>
                <div>
                  <h3 className="text-foreground mb-1">Deactivate Account</h3>
                  <p className="text-sm text-muted-foreground">Are you sure you want to proceed?</p>
                </div>
              </div>
              <button onClick={() => setShowDeactivateModal(false)} aria-label="Close dialog" className="p-1 hover:bg-muted/10 rounded transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-brand-error/5 border border-brand-error/20 rounded-lg p-4">
                <p className="text-sm text-foreground">
                  <strong>This action is permanent and cannot be undone.</strong>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Deactivating your account will permanently delete:</p>
              <ul className="text-sm text-muted-foreground space-y-2 ml-4">
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

            <div className="flex gap-3 p-6 border-t border-border">
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="flex-1 px-4 py-2.5 bg-muted/10 border border-muted/30 text-foreground hover:bg-muted/20 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateAccount}
                className="flex-1 px-4 py-2.5 bg-brand-error text-brand-neutral-light hover:bg-brand-error/90 rounded-lg transition-colors"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorSwatch({ color, label, description }: { color: string; label: string; description: string }) {
  return (
    <div>
      <div className={`w-full h-20 ${color} rounded-lg border border-border mb-2`} />
      <div className="text-sm">
        <div className="text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
