import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { DocumentView } from "./pages/DocumentView";
import { ApprovalView } from "./pages/ApprovalView";
import { AdminRules } from "./pages/AdminRules";
import { AdminUsers } from "./pages/AdminUsers";
import { Settings } from "./pages/Settings";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.some((role) => hasRole(role as "admin" | "transcriptor" | "aprobador"))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/document/:id" element={<DocumentView />} />
        <Route path="/approval/:id" element={<ApprovalView />} />
        <Route
          path="/admin/rules"
          element={
            <PrivateRoute roles={["admin"]}>
              <AdminRules />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <PrivateRoute roles={["admin"]}>
              <AdminUsers />
            </PrivateRoute>
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
