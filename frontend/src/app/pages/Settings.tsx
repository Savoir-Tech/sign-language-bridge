import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Sun, Moon, MessageSquare, AlertTriangle, X } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleDeactivateAccount = () => {
    // Handle account deactivation logic
    console.log("Account deactivated");
    setShowDeactivateModal(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/app")}
              className="p-2 hover:bg-accent/10 rounded-lg transition-colors"
            >
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

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application preferences and appearance
          </p>
        </div>

        <div className="space-y-6">
          {/* Theme Settings */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-4">Appearance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-foreground mb-1">Theme Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Choose between light and dark mode
                  </div>
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

          {/* Color System Info */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-foreground mb-4">Color System</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <ColorSwatch
                  color="bg-brand-teal"
                  label="Deep Teal"
                  description="Primary Background"
                />
                <ColorSwatch
                  color="bg-brand-gold"
                  label="Accent Gold"
                  description="Connection & Highlights"
                />
                <ColorSwatch
                  color="bg-brand-orange"
                  label="Action Orange"
                  description="CTAs & Active States"
                />
              </div>
              <div className="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                <p className="text-sm text-foreground">
                  <strong>Design Philosophy:</strong> This color system emphasizes trust, calm, 
                  and precision. The restrained palette (80% Deep Teal, 15% Neutral Light, 5% Accent) 
                  reflects the serious nature of this accessibility tool.
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
              <p>
                Built for healthcare, emergency services, and critical communication infrastructure.
              </p>
              <div className="pt-4 border-t border-border mt-4">
                <p className="text-xs">Version 1.0.0 • February 2026</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Deactivate Account Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-brand-error/30 rounded-xl max-w-md w-full shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand-error/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-brand-error" />
                </div>
                <div>
                  <h3 className="text-foreground mb-1">Deactivate Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to proceed?
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="p-1 hover:bg-muted/10 rounded transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="bg-brand-error/5 border border-brand-error/20 rounded-lg p-4">
                <p className="text-sm text-foreground">
                  <strong>This action is permanent and cannot be undone.</strong>
                </p>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Deactivating your account will permanently delete:
              </p>
              
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
                <li className="flex items-start gap-2">
                  <span className="text-brand-error mt-1">•</span>
                  <span>Access to all saved configurations</span>
                </li>
              </ul>
            </div>

            {/* Modal Actions */}
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

function ColorSwatch({
  color,
  label,
  description,
}: {
  color: string;
  label: string;
  description: string;
}) {
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