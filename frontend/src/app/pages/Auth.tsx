import { useState } from "react";
import { useNavigate } from "react-router";
import { MessageSquare, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/authStore";
import { toast } from "sonner";

type AuthMode = "signup" | "login";

export default function Auth() {
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError, token } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (token) {
    navigate("/app", { replace: true });
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    if (error) clearError();
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (mode === "signup") {
      if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
      if (!formData.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Please enter a valid email";
      }
      if (!formData.password) {
        newErrors.password = "Password is required";
      } else if (formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters";
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    } else {
      if (!formData.email.trim()) newErrors.email = "Email is required";
      if (!formData.password) newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (mode === "signup") {
        await register(formData.email, formData.password, formData.fullName);
        toast.success("Account created successfully!");
      } else {
        await login(formData.email, formData.password);
        toast.success("Welcome back!");
      }
      navigate("/app");
    } catch {
      // Error is set in the store
    }
  };

  const switchMode = () => {
    setMode(mode === "signup" ? "login" : "signup");
    setErrors({});
    clearError();
  };

  const isFormValid = () => {
    if (mode === "signup") {
      return (
        formData.fullName.trim() &&
        formData.email.trim() &&
        formData.password &&
        formData.confirmPassword &&
        formData.password === formData.confirmPassword
      );
    }
    return formData.email.trim() && formData.password;
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Brand Story */}
      <div className="hidden lg:flex lg:w-[60%] bg-gradient-to-br from-brand-teal to-brand-teal-light relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-gold rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-brand-gold rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="mb-12">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand-gold rounded-xl flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-brand-teal" />
              </div>
              <span className="text-brand-neutral-light text-xl">Sign Language Bridge</span>
            </div>
          </div>

          <h1 className="text-brand-neutral-light text-5xl xl:text-6xl mb-6 leading-tight">
            Break Communication<br />Barriers.
          </h1>

          <p className="text-brand-neutral-light/80 text-lg xl:text-xl leading-relaxed max-w-xl">
            Real-time sign language recognition and translation built for healthcare professionals,
            emergency services, and critical communication infrastructure.
          </p>

          <div className="mt-12 flex gap-2">
            <div className="w-16 h-1 bg-brand-gold rounded-full" />
            <div className="w-8 h-1 bg-brand-gold/50 rounded-full" />
            <div className="w-4 h-1 bg-brand-gold/30 rounded-full" />
          </div>

          <div className="mt-12 p-6 bg-brand-teal-light/30 backdrop-blur-sm rounded-xl border border-brand-gold/20">
            <p className="text-brand-neutral-light/70 text-sm leading-relaxed">
              "Accessibility is not a feature — it's a fundamental right. We're building
              the infrastructure for truly inclusive communication."
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Authentication Form */}
      <div className="flex-1 lg:w-[40%] bg-brand-neutral-light flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("/")}
            className="lg:hidden flex items-center gap-2 text-brand-teal mb-8 hover:text-brand-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to home</span>
          </button>

          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-brand-teal" />
              </div>
              <span className="text-brand-teal">Sign Language Bridge</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-brand-teal/10 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-brand-teal text-2xl sm:text-3xl mb-2">
                {mode === "signup" ? "Create Your Account" : "Welcome Back"}
              </h2>
              <p className="text-brand-teal/60 text-sm">
                {mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button onClick={switchMode} className="text-brand-gold hover:text-brand-orange transition-colors font-medium">
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{" "}
                    <button onClick={switchMode} className="text-brand-gold hover:text-brand-orange transition-colors font-medium">
                      Create account
                    </button>
                  </>
                )}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-brand-error/10 border border-brand-error/30 rounded-lg">
                <p className="text-brand-error text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "signup" && (
                <div>
                  <label className="block text-brand-teal text-sm mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      errors.fullName ? "border-brand-error focus:border-brand-error" : "border-brand-teal/20 focus:border-brand-gold"
                    } focus:outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all`}
                    placeholder="Enter your full name"
                    disabled={isLoading}
                  />
                  {errors.fullName && <p className="text-brand-error text-xs mt-1">{errors.fullName}</p>}
                </div>
              )}

              <div>
                <label className="block text-brand-teal text-sm mb-2">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.email ? "border-brand-error focus:border-brand-error" : "border-brand-teal/20 focus:border-brand-gold"
                  } focus:outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all`}
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
                {errors.email && <p className="text-brand-error text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-brand-teal text-sm mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={`w-full px-4 py-3 pr-12 rounded-xl border ${
                      errors.password ? "border-brand-error focus:border-brand-error" : "border-brand-teal/20 focus:border-brand-gold"
                    } focus:outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all`}
                    placeholder={mode === "signup" ? "Create a password (min. 8 characters)" : "Enter your password"}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-teal/40 hover:text-brand-gold transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-brand-error text-xs mt-1">{errors.password}</p>}
              </div>

              {mode === "signup" && (
                <div>
                  <label className="block text-brand-teal text-sm mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className={`w-full px-4 py-3 pr-12 rounded-xl border ${
                        errors.confirmPassword ? "border-brand-error focus:border-brand-error" : "border-brand-teal/20 focus:border-brand-gold"
                      } focus:outline-none focus:ring-2 focus:ring-brand-gold/20 transition-all`}
                      placeholder="Re-enter your password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-teal/40 hover:text-brand-gold transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-brand-error text-xs mt-1">{errors.confirmPassword}</p>}
                </div>
              )}

              {mode === "login" && (
                <div className="flex justify-end">
                  <button type="button" className="text-brand-gold hover:text-brand-orange text-sm transition-colors">
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={!isFormValid() || isLoading}
                className={`w-full py-3.5 rounded-xl text-brand-neutral-light transition-all flex items-center justify-center gap-2 ${
                  isFormValid() && !isLoading
                    ? "bg-brand-orange hover:bg-brand-orange-dark shadow-lg shadow-brand-orange/20"
                    : "bg-brand-teal/30 cursor-not-allowed"
                }`}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === "signup" ? "Create Account" : "Log In"}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-brand-teal/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-white text-brand-teal/50">OR</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-brand-teal/20 rounded-xl hover:bg-brand-neutral-light/50 hover:border-brand-gold/50 transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-brand-teal text-sm">Continue with Google</span>
                </button>
              </div>

              {mode === "signup" && (
                <p className="text-brand-teal/50 text-xs text-center leading-relaxed pt-2">
                  By creating an account, you agree to our{" "}
                  <button type="button" className="text-brand-gold hover:underline">Terms of Service</button>{" "}
                  and{" "}
                  <button type="button" className="text-brand-gold hover:underline">Privacy Policy</button>.
                </p>
              )}
            </form>
          </div>

          <div className="hidden lg:block mt-6 text-center">
            <button onClick={() => navigate("/")} className="text-brand-teal/60 hover:text-brand-gold text-sm transition-colors">
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
