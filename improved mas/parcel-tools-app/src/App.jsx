import React, { useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import MainMenu from './pages/MainMenu';
import ParcelCalculator from './pages/ParcelCalculator';
import DataFiles from './pages/DataFiles';
import WorkMode from './pages/WorkMode';
import Plotting from './pages/Plotting';
import BackgroundEffects from './components/BackgroundEffects';
import Assistant from './pages/Assistant';
import LicensePage from './pages/LicensePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DxfImport from './pages/DxfImport';
import LicenseGuard from './components/LicenseGuard';
import TitleBar from './components/TitleBar';
import AdminPanel from './pages/AdminPanel';

// ── Inner component with routing + file-open handling ────────────────────────
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const toast = useToast();
  const {
    loadProjectData, setProjectPath
  } = useProject();

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // Append is-electron class to body when in Electron mode
  useEffect(() => {
    if (isElectron) {
      document.body.classList.add('is-electron');
    } else {
      document.body.classList.remove('is-electron');
    }
  }, [isElectron]);

  // Redirect to login if not authenticated (both demo and premium require login)
  useEffect(() => {
    if (!loading && !user) {
      const publicPaths = ['/login', '/signup'];
      if (!publicPaths.includes(location.pathname)) {
        navigate('/login');
      }
    }
  }, [user, loading, location.pathname, navigate]);

  // Wire up Electron file-open IPC
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const handleLoadFile = async (filePath) => {
      try {
        const res = await fetch('http://localhost:5000/api/project/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Failed to load project');
        }
        const { projectData } = await res.json();

        loadProjectData(projectData, filePath);

        const hasCad = Boolean(projectData.cadFilePath || (projectData.cadEntities && projectData.cadEntities.length > 0) || projectData.cadFileName);
        navigate(hasCad ? '/dxf-import' : '/parcel-calculator');
        toast.success(`✅ Opened: ${projectData.projectName || 'Untitled'}`);

        setTimeout(() => {
          const inp = document.querySelector('input[placeholder="Enter parcel number"]');
          if (inp) { inp.focus(); inp.select(); }
        }, 500);
      } catch (err) {
        toast.error(`❌ Could not open project: ${err.message}`);
      }
    };

    if (window.electronAPI.onLoadProjectFile) {
      window.electronAPI.onLoadProjectFile(handleLoadFile);
    }

    return () => {
      if (window.electronAPI.removeLoadProjectFileListener) {
        window.electronAPI.removeLoadProjectFileListener();
      }
    };
  }, [navigate, toast, loadProjectData]);

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      {isElectron && <TitleBar />}
      <div className="flex-1 overflow-hidden relative w-full">
        <BackgroundEffects />
        <Routes>
          {/* Public routes */}
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/license" element={<LicensePage />} />

          {/* Admin route — accessible to admin users */}
          <Route path="/admin" element={
            user && (user.isAdmin || user.email === 'nsayegh2003@yahoo.com') ? <AdminPanel /> : <Navigate to="/" replace />
          } />

          {/* Protected routes — wrapped in LicenseGuard */}
          <Route path="/" element={
            <LicenseGuard><MainMenu /></LicenseGuard>
          } />
          <Route path="/assistant" element={
            <LicenseGuard><Assistant /></LicenseGuard>
          } />
          <Route path="/parcel-calculator" element={
            <LicenseGuard><ParcelCalculator /></LicenseGuard>
          } />
          <Route path="/data-files" element={
            <LicenseGuard><DataFiles /></LicenseGuard>
          } />
          <Route path="/work-mode" element={
            <LicenseGuard><WorkMode /></LicenseGuard>
          } />
          <Route path="/plotting" element={
            <LicenseGuard><Plotting /></LicenseGuard>
          } />
          <Route path="/dxf-import" element={
            <LicenseGuard><DxfImport /></LicenseGuard>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

// ── Loading screen ───────────────────────────────────────────────────────────
function SplashScreen() {
  return (
    <div className="page-container items-center justify-center bg-dark-900">
      <div className="flex flex-col items-center gap-5">
        {/* Animated logo */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-dark
                          flex items-center justify-center shadow-glow animate-pulse-glow">
            <span className="text-4xl">📐</span>
          </div>
          {/* Rotating ring */}
          <div className="absolute -inset-2 rounded-[20px] border-2 border-primary/30
                          border-t-primary animate-spin" style={{ animationDuration: '1.5s' }} />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold gradient-text">PARCEL TOOLS</h1>
          <p className="text-dark-400 text-sm mt-1">Professional Surveying Software</p>
        </div>

        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map(i => (
            <div key={i}
              className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root App ────────────────────────────────────────────────────────────────
function App() {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const Router = isElectron ? HashRouter : BrowserRouter;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Give the backend a moment to boot up
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return <SplashScreen />;

  return (
    <AuthProvider>
      <ToastProvider>
        <ProjectProvider>
          <Router>
            <AppContent />
          </Router>
        </ProjectProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
