import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { useAuthStore } from "@/lib/stores/authStore";
import { Toaster } from "sonner";

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
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: {
            background: "var(--brand-teal-light)",
            border: "1px solid rgba(216, 154, 61, 0.2)",
            color: "var(--brand-neutral-light)",
          },
        }}
      />
    </>
  );
}
