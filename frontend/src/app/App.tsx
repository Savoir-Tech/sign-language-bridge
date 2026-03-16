import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { useAuthStore } from "@/lib/stores/authStore";
import { Toaster } from "sonner";
import { GlassFilter } from "@/app/components/ui/liquid-glass";

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <>
      <GlassFilter />
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: {
            background: "var(--brand-nocturnal)",
            border: "1px solid rgba(255, 200, 1, 0.2)",
            color: "var(--brand-arctic)",
          },
        }}
      />
    </>
  );
}
