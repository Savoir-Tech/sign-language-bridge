import { useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router";
import { MessageSquare, Sparkles, Globe, Accessibility } from "lucide-react";

const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
);

export default function Landing() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative overflow-hidden min-h-screen bg-gradient-to-br from-brand-oceanic to-brand-nocturnal text-brand-arctic"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Dithering Shader Background */}
      <Suspense fallback={<div className="absolute inset-0 bg-muted/20" />}>
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 mix-blend-screen">
          <Dithering
            colorBack="#00000000"
            colorFront="#FFC801"
            shape="warp"
            type="4x4"
            speed={isHovered ? 0.6 : 0.2}
            className="size-full"
            minPixelRatio={1}
          />
        </div>
      </Suspense>

      {/* Header */}
      <header className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-forsytha rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-brand-oceanic" />
          </div>
          <span className="text-xl">Sign Language Bridge</span>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-2.5 rounded-xl border-2 border-brand-forsytha text-brand-forsytha hover:bg-brand-forsytha/10 transition-colors"
        >
          Login
        </button>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-block px-4 py-2 rounded-full bg-brand-forsytha/10 border border-brand-forsytha/30">
            <span className="text-brand-forsytha">Real-time AI Translation</span>
          </div>

          <h1 className="text-5xl tracking-tight">
            Breaking Communication Barriers
            <br />
            <span className="text-brand-forsytha">Through AI-Powered Sign Language</span>
          </h1>

          <p className="text-xl text-brand-mystic max-w-2xl mx-auto">
            A professional accessibility tool for real-time sign language recognition and translation. 
            Built for healthcare, emergency services, and critical communication needs.
          </p>

          <div className="flex gap-4 justify-center pt-6">
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-4 bg-brand-saffron hover:bg-brand-saffron-dark text-brand-arctic rounded-xl shadow-lg transition-colors"
            >
              Create Account
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="px-8 py-4 rounded-xl border-2 border-brand-forsytha text-brand-forsytha hover:bg-brand-forsytha/10 transition-colors"
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
        <div className="h-px bg-brand-forsytha/20 max-w-5xl mx-auto mt-24 mb-12" />

        {/* Footer */}
        <div className="text-center text-brand-mystic">
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
    <div className="bg-brand-nocturnal border border-brand-forsytha/20 rounded-xl p-6 hover:border-brand-forsytha/40 transition-colors group">
      <div className="text-brand-forsytha mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-brand-arctic mb-2">{title}</h3>
      <p className="text-brand-mystic text-sm">{description}</p>
    </div>
  );
}
