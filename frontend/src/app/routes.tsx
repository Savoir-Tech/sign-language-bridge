import { createBrowserRouter } from "react-router";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/auth",
    Component: Auth,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/app",
    lazy: async () => {
      const ProtectedRoute = (await import("./components/ProtectedRoute")).default;
      return {
        Component: () => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      };
    },
  },
  {
    path: "/settings",
    lazy: async () => {
      const ProtectedRoute = (await import("./components/ProtectedRoute")).default;
      return {
        Component: () => (
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        ),
      };
    },
  },
]);
