import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import AppShell from "./components/layout/AppShell";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Resumes from "./pages/Resumes";
import ResumeMatch from "./pages/ResumeMatch";
import Jobs from "./pages/Jobs";
import ATSScore from "./pages/ATSScore";
import Profile from "./pages/Profile";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={
        <ProtectedRoute><AppShell /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="resumes" element={<Resumes />} />
        <Route path="resume-match" element={<ResumeMatch />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="ats-score" element={<ATSScore />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      {/* Backwards compatibility for existing links */}
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/resumes" element={<Navigate to="/app/resumes" replace />} />
      <Route path="/resume-match" element={<Navigate to="/app/resume-match" replace />} />
      <Route path="/jobs" element={<Navigate to="/app/jobs" replace />} />
      <Route path="/ats-score" element={<Navigate to="/app/ats-score" replace />} />
      <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useTheme();
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)", fontSize: 14 },
            success: { iconTheme: { primary: "var(--success)", secondary: "var(--bg-card)" } },
            error: { iconTheme: { primary: "var(--danger)", secondary: "var(--bg-card)" } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
