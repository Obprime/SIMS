import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SubmitPage from "./pages/SubmitPage";
import AdminPage from "./pages/AdminPage";

function App() {
  const { user, role, loading, firebaseConfigError } = useAuth();

  const homePath = role === "manager" || role === "gm" || role === "admin"
    ? "/manager/dashboard"
    : "/branch/dashboard";

  if (firebaseConfigError) {
    return (
      <main className="screen-center">
        <section className="auth-card">
          <p className="eyebrow">Configuration Required</p>
          <h1>Firebase Not Configured</h1>
          <p className="auth-help">
            Add real Firebase values to your .env file, then restart the dev server.
          </p>
          <p className="form-message error">{firebaseConfigError}</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="screen-center">
        <p className="loading">Loading portal...</p>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <LoginPage />} />

      <Route
        path="/submit"
        element={
          <ProtectedRoute>
            <SubmitPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mobile-scan"
        element={
          <ProtectedRoute>
            <SubmitPage mobileMode />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mobile-scan"
        element={
          <ProtectedRoute>
            <SubmitPage mobileMode />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agent/dashboard"
        element={
          <ProtectedRoute>
            <SubmitPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/branch/dashboard"
        element={
          <ProtectedRoute>
            <SubmitPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/head/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/gm/dashboard"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />

      <Route
        path="/manager/dashboard"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />

      <Route path="*" element={<Navigate to={user ? homePath : "/login"} replace />} />
    </Routes>
  );
}

export default App;
