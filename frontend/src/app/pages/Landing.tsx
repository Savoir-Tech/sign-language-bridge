import { useNavigate } from "react-router";
import { MessageSquare, Sparkles, Globe, Accessibility } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-teal to-brand-teal-light text-brand-neutral-light">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-brand-teal" />
          </div>
          <span className="text-xl">Sign Language Bridge</span>
        </div>
        <button
          onClick={() => navigate("/auth")}
          className="px-6 py-2.5 rounded-xl border-2 border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors"
        >
          Login
        </button>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-block px-4 py-2 rounded-full bg-brand-gold/10 border border-brand-gold/30">
            <span className="text-brand-gold">Real-time AI Translation</span>
          </div>

          <h1 className="text-5xl tracking-tight">
            Breaking Communication Barriers
            <br />
            <span className="text-brand-gold">Through AI-Powered Sign Language</span>
          </h1>

          <p className="text-xl text-brand-neutral-muted max-w-2xl mx-auto">
            A professional accessibility tool for real-time sign language recognition and translation. 
            Built for healthcare, emergency services, and critical communication needs.
          </p>

          <div className="flex gap-4 justify-center pt-6">
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-4 bg-brand-orange hover:bg-brand-orange-dark text-brand-neutral-light rounded-xl shadow-lg transition-colors"
            >
              Create Account
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-4 rounded-xl border-2 border-brand-gold text-brand-gold hover:bg-brand-gold/10 transition-colors"
            >
              Watch Demo
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-24">
          <FeatureCard
            icon={<Sparkles className="w-8 h-8" />}
            title="AI Recognition"
            description="Advanced machine learning models for accurate sign language detection"
          />
          <FeatureCard
            icon={<Globe className="w-8 h-8" />}
            title="Multi-Language Support"
            description="Translation between ASL, BSL, and spoken languages in real-time"
          />
          <FeatureCard
            icon={<Accessibility className="w-8 h-8" />}
            title="Enterprise Ready"
            description="HIPAA-compliant infrastructure for healthcare and emergency services"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-brand-gold/20 max-w-5xl mx-auto mt-24 mb-12" />

        {/* Footer */}
        <div className="text-center text-brand-neutral-muted">
          <p className="text-sm">
            Designed for accessibility. Built with trust. Powered by AI.
          </p>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-brand-teal-light border border-brand-gold/20 rounded-xl p-6 hover:border-brand-gold/40 transition-colors group">
      <div className="text-brand-gold mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-brand-neutral-light mb-2">{title}</h3>
      <p className="text-brand-neutral-muted text-sm">{description}</p>
    </div>
  );
}