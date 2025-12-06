import React, { useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ProjectProvider, useProject } from './context/ProjectContext';
import MainMenu from './pages/MainMenu';
import ParcelCalculator from './pages/ParcelCalculator';
import DataFiles from './pages/DataFiles';
import WorkMode from './pages/WorkMode';
import Plotting from './pages/Plotting';
import BackgroundEffects from './components/BackgroundEffects';
import Assistant from './pages/Assistant';
import LicensePage from './pages/LicensePage';

// Inner component to handle file loading with access to context and navigation
function AppContent() {
  const navigate = useNavigate();
  const {
    setProjectName,
    setPointsFileName,
    setPointsFilePath,
    setLoadedPoints,
    setSavedParcels,
    setFileHeading,
    setHasUnsavedChanges,
    setProjectPath
  } = useProject();

  useEffect(() => {
    // Check if Electron API is available
    console.log('[App] Checking for Electron API...');
    console.log('[App] window.electronAPI exists:', typeof window !== 'undefined' && !!window.electronAPI);
    if (typeof window !== 'undefined' && window.electronAPI) {
      console.log('[App] ✅ Electron API is available');
      console.log('[App] Available methods:', Object.keys(window.electronAPI));

      // Set up listener for file open events
      if (window.electronAPI.onLoadProjectFile) {
        window.electronAPI.onLoadProjectFile(async (filePath) => {
          console.log('[App] Loading project from file:', filePath);

          try {
            // Load the project from the file path
            const response = await fetch('http://localhost:5000/api/project/load', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath }),
            });

            if (!response.ok) {
              let errorMessage = 'Failed to load project';
              try {
                const errorData = await response.json();
                if (errorData?.error) {
                  errorMessage = errorData.error;
                }
              } catch (parseError) {
                console.warn('[App] Could not parse load error response', parseError);
              }
              throw new Error(errorMessage);
            }

            const result = await response.json();
            const projectData = result.projectData;

            // Clear existing state
            setProjectName('');
            setPointsFileName('');
            setPointsFilePath('');
            setLoadedPoints({});
            setSavedParcels([]);
            setFileHeading({
              block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
            });

            // Load new project data
            setProjectName(projectData.projectName || '');
            setPointsFileName(projectData.pointsFileName || '');
            setPointsFilePath(projectData.pointsFilePath || '');
            setLoadedPoints(projectData.loadedPoints || {});
            setSavedParcels(projectData.savedParcels || []);
            setFileHeading(projectData.fileHeading || {
              block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
            });
            setProjectPath(filePath);
            setHasUnsavedChanges(false);

            // Navigate to parcel calculator page
            navigate('/parcel-calculator');

            // Show success message using non-blocking toast
            setTimeout(() => {
              // Create success toast
              const toast = document.createElement('div');
              toast.innerHTML = `✅ Opened project: ${projectData.projectName || 'Untitled'}`;
              toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                right: auto;
                text-align: center;
                background: #238636;
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                animation: slideIn 0.3s ease-out;
              `;
              document.body.appendChild(toast);
              setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => toast.remove(), 300);
              }, 3000);

              // CRITICAL: Focus parcel number input after file loads
              setTimeout(() => {
                const parcelInput = document.querySelector('input[placeholder="Enter parcel number"]');
                if (parcelInput) {
                  parcelInput.focus();
                  parcelInput.select();
                }
              }, 500);
            }, 300);
          } catch (error) {
            console.error('[App] Error loading project:', error);
            // Show error toast instead of blocking alert
            setTimeout(() => {
              const toast = document.createElement('div');
              toast.innerHTML = `❌ Error loading project: ${error.message}`;
              toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                right: auto;
                text-align: center;
                background: #da3633;
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                animation: slideIn 0.3s ease-out;
              `;
              document.body.appendChild(toast);
              setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => toast.remove(), 300);
              }, 4000);
            }, 300);
          }
        });
      }
    } else {
      console.warn('[App] ⚠️ Electron API is NOT available - Save As will not work');
      console.warn('[App] Make sure you are running in Electron, not a browser');
    }

    // Cleanup listener on unmount
    return () => {
      if (window.electronAPI && window.electronAPI.removeLoadProjectFileListener) {
        window.electronAPI.removeLoadProjectFileListener();
      }
    };
  }, [navigate, setProjectName, setPointsFileName, setPointsFilePath, setLoadedPoints, setSavedParcels, setFileHeading, setHasUnsavedChanges, setProjectPath]);

  return (
    <>
      <BackgroundEffects />
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/license" element={<LicensePage />} />
        <Route path="/parcel-calculator" element={<ParcelCalculator />} />
        <Route path="/data-files" element={<DataFiles />} />
        <Route path="/work-mode" element={<WorkMode />} />
        <Route path="/plotting" element={<Plotting />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const RouterComponent = isElectron ? HashRouter : BrowserRouter;

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Quick loading - go straight to main menu
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-dark-900">
        <div className="text-center">
          <div className="text-6xl mb-4">📐</div>
          <h2 className="text-2xl font-bold text-primary">PARCEL TOOLS</h2>
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider>
      <RouterComponent>
        <AppContent />
      </RouterComponent>
    </ProjectProvider>
  );
}

export default App;


