import { Navigate } from "react-router";
import { useAuthStore } from "@/lib/stores/authStore";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-oceanic">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-brand-forsytha animate-spin mx-auto" />
          <p className="text-brand-mystic text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
