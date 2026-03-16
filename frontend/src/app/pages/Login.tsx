import { useState, Suspense, lazy } from "react";
import { useNavigate, Navigate } from "react-router";
import { MessageSquare, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";

const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
);
import { useAuthStore } from "@/lib/stores/authStore";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, token } = useAuthStore();

  const [isHovered, setIsHovered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (token) {
    return <Navigate to="/app" replace />;
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) clearError();
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => formData.email.trim() && formData.password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await login(formData.email, formData.password);
      toast.success("Welcome back!");
    } catch {
      // Error is set in the store
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Brand Story */}
      <div
        className="hidden lg:flex lg:w-[60%] bg-gradient-to-br from-brand-oceanic to-brand-nocturnal relative overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="mb-12">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand-forsytha rounded-xl flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-brand-oceanic" />
              </div>
              <span className="text-brand-arctic text-xl">Sign Language Bridge</span>
            </div>
          </div>

          <h1 className="text-brand-arctic text-5xl xl:text-6xl mb-6 leading-tight">
            Welcome Back.
          </h1>

          <p className="text-brand-arctic/80 text-lg xl:text-xl leading-relaxed max-w-xl">
            Sign in to continue using real-time sign language recognition
            and translation — built for healthcare, emergency services, and
            critical communication.
          </p>

          <div className="mt-12 flex gap-2">
            <div className="w-16 h-1 bg-brand-forsytha rounded-full" />
            <div className="w-8 h-1 bg-brand-forsytha/50 rounded-full" />
            <div className="w-4 h-1 bg-brand-forsytha/30 rounded-full" />
          </div>

          <div className="mt-12 p-6 bg-brand-nocturnal/30 backdrop-blur-sm rounded-xl border border-brand-forsytha/20">
            <p className="text-brand-arctic/70 text-sm leading-relaxed">
              "Accessibility is not a feature — it's a fundamental right. We're building
              the infrastructure for truly inclusive communication."
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 lg:w-[40%] bg-brand-arctic flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("/")}
            className="lg:hidden flex items-center gap-2 text-brand-oceanic mb-8 hover:text-brand-forsytha transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to home</span>
          </button>

          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-forsytha rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-brand-oceanic" />
              </div>
              <span className="text-brand-oceanic">Sign Language Bridge</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-brand-oceanic/10 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-brand-oceanic text-2xl sm:text-3xl mb-2">
                Welcome Back
              </h2>
              <p className="text-brand-oceanic/60 text-sm">
                Don't have an account?{" "}
                <button
                  onClick={() => navigate("/auth")}
                  className="text-brand-forsytha hover:text-brand-saffron transition-colors font-medium"
                >
                  Create account
                </button>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-brand-error/10 border border-brand-error/30 rounded-lg">
                <p className="text-brand-error text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-brand-oceanic text-sm mb-2">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.email
                      ? "border-brand-error focus:border-brand-error"
                      : "border-brand-oceanic/20 focus:border-brand-forsytha"
                  } focus:outline-none focus:ring-2 focus:ring-brand-forsytha/20 transition-all`}
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
                {errors.email && <p className="text-brand-error text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-brand-oceanic text-sm mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={`w-full px-4 py-3 pr-12 rounded-xl border ${
                      errors.password
                        ? "border-brand-error focus:border-brand-error"
                        : "border-brand-oceanic/20 focus:border-brand-forsytha"
                    } focus:outline-none focus:ring-2 focus:ring-brand-forsytha/20 transition-all`}
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-oceanic/40 hover:text-brand-forsytha transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-brand-error text-xs mt-1">{errors.password}</p>}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-brand-forsytha hover:text-brand-saffron text-sm transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={!isFormValid() || isLoading}
                className={`w-full py-3.5 rounded-xl text-brand-arctic transition-all flex items-center justify-center gap-2 ${
                  isFormValid() && !isLoading
                    ? "bg-brand-saffron hover:bg-brand-saffron-dark shadow-lg shadow-brand-saffron/20"
                    : "bg-brand-oceanic/30 cursor-not-allowed"
                }`}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Log In
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-brand-oceanic/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-white text-brand-oceanic/50">OR</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-brand-oceanic/20 rounded-xl hover:bg-brand-arctic/50 hover:border-brand-forsytha/50 transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-brand-oceanic text-sm">Continue with Google</span>
                </button>
              </div>
            </form>
          </div>

          <div className="hidden lg:block mt-6 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-brand-oceanic/60 hover:text-brand-forsytha text-sm transition-colors"
            >
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
