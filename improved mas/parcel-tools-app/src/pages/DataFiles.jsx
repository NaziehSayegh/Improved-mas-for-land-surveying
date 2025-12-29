import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderOpen, File, Plus, Trash2, Edit2, Upload, Save, FileText, RefreshCw } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';

const DataFiles = () => {
  const navigate = useNavigate();

  // Shared context
  const {
    pointsFileName,
    setPointsFileName,
    pointsFilePath,
    setPointsFilePath,
    loadedPoints,
    setLoadedPoints,
    setHasUnsavedChanges,
    setProjectName,
    setSavedParcels,
    fileHeading: globalFileHeading,
    setFileHeading: setGlobalFileHeading
  } = useProject();

  // Local state for editing
  const [editMode, setEditMode] = useState(false);
  const [editingPoints, setEditingPoints] = useState({});
  const [newPointId, setNewPointId] = useState('');
  const [newPointX, setNewPointX] = useState('');
  const [newPointY, setNewPointY] = useState('');
  const [editingPointId, setEditingPointId] = useState(null);

  // File heading
  const [showHeadingDialog, setShowHeadingDialog] = useState(false);
  const [localHeading, setLocalHeading] = useState(globalFileHeading || {
    block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
  });

  // Saved projects
  const [savedProjects, setSavedProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [activeTab, setActiveTab] = useState('points'); // 'points' or 'projects'

  // Sync with global heading
  useEffect(() => {
    setLocalHeading(globalFileHeading);
  }, [globalFileHeading]);

  // Track unsaved changes for points editing
  const hasUnsavedPoints = editMode && Object.keys(editingPoints).length > 0;

  // Helper function to show unsaved changes dialog
  const showUnsavedChangesDialog = (message) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.75);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 24px;
        max-width: 450px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      `;

      dialog.innerHTML = `
        <h2 style="color: #c9d1d9; font-size: 20px; font-weight: bold; margin-bottom: 12px;">
          ⚠️ Unsaved Changes
        </h2>
        <p style="color: #8b949e; margin-bottom: 24px; line-height: 1.5;">
          ${message}
        </p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="unsaved-cancel" style="
            background: #21262d;
            border: 1px solid #30363d;
            color: #c9d1d9;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">Cancel</button>
          <button id="unsaved-discard" style="
            background: #da3633;
            border: 1px solid #da3633;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">Discard</button>
          <button id="unsaved-save" style="
            background: #238636;
            border: 1px solid #238636;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">Save</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const handleResult = (result) => {
        document.body.removeChild(overlay);
        resolve(result);
      };

      document.getElementById('unsaved-save').onclick = () => handleResult('save');
      document.getElementById('unsaved-discard').onclick = () => handleResult('discard');
      document.getElementById('unsaved-cancel').onclick = () => handleResult('cancel');

      overlay.onclick = (e) => {
        if (e.target === overlay) {
          handleResult('cancel');
        }
      };

      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          handleResult('cancel');
          window.removeEventListener('keydown', handleEsc);
        }
      };
      window.addEventListener('keydown', handleEsc);
    });
  };

  // Close project - clears editing state but STAYS on the page (doesn't navigate)
  const handleCloseProject = async () => {
    // Auto-save points file if there are unsaved changes (without asking)
    if (hasUnsavedPoints && pointsFileName) {
      try {
        await handleAutoSavePoints();
        console.log('✅ Points file auto-saved on close');
      } catch (error) {
        console.error('Error auto-saving points file on close:', error);
        // Continue closing even if save fails
      }
    }

    // Clear editing state but STAY on the data files page
    // Clear pointsFilePath FIRST to stop file watching
    setPointsFilePath('');
    setPointsFileName('');
    setEditMode(false);
    setEditingPoints({});
    setNewPointId('');
    setNewPointX('');
    setNewPointY('');
    setEditingPointId(null);

    // Also clear the loaded points from context
    setLoadedPoints({});

    // Small delay to ensure all state updates are processed
    setTimeout(() => {
      // Show confirmation
      toast.success('✅ Project closed. You can now load a new file or start editing.');
    }, 100);
  };

  // ESC key to go to main menu (only if no dialogs are open)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && !showHeadingDialog) {
        e.preventDefault();
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate, showHeadingDialog]);

  // Track when points are first loaded to sync only on initial load
  const [pointsSynced, setPointsSynced] = useState(false);

  // Sync loaded points to editing state (only on initial load, not when user is editing)
  useEffect(() => {
    // Only sync if we're on the points tab
    if (activeTab === 'points') {
      if (Object.keys(loadedPoints).length > 0 && pointsFileName) {
        // Only sync on initial load - if editingPoints is empty or if points haven't been synced yet
        if (Object.keys(editingPoints).length === 0 || !pointsSynced) {
          setEditingPoints({ ...loadedPoints });
          setPointsSynced(true);
        }
        // Enable edit mode if we have points and it's not already enabled
        if (!editMode && Object.keys(loadedPoints).length > 0) {
          setEditMode(true);
        }
      } else if (Object.keys(loadedPoints).length === 0 && !pointsFileName) {
        // If both are cleared, also clear editing state
        if (editMode) {
          setEditMode(false);
          setEditingPoints({});
          setPointsSynced(false);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPoints, pointsFileName, activeTab]);

  // Reset sync flag when a new file is loaded
  useEffect(() => {
    if (pointsFileName && Object.keys(loadedPoints).length > 0) {
      setPointsSynced(false);
    }
  }, [pointsFileName]);

  // Load saved projects list
  const loadSavedProjects = async (scanFull = false) => {
    setLoadingProjects(true);
    try {
      // Force refresh by adding timestamp to avoid cache
      const scanParam = scanFull ? '&scan=full' : '';
      const response = await fetch(`http://localhost:5000/api/projects?t=${Date.now()}${scanParam}`);
      if (response.ok) {
        const projects = await response.json();
        // Filter out any projects that might have been deleted since the last check
        setSavedProjects(projects.filter(p => p.filePath && p.fileName)); // Basic validation
      } else {
        console.error('Failed to load projects:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setSavedProjects([]); // Clear on error
    } finally {
      setLoadingProjects(false);
    }
  };

  // Scan computer for all .prcl files
  const handleScanComputer = async () => {
    const confirmed = confirm('🔍 Scan your computer for .prcl files?\n\nThis will search in:\n• Documents\n• Desktop\n• Downloads\n• Home folder\n\nThis may take a minute...');
    if (!confirmed) return;

    await loadSavedProjects(true);

    // Show success toast
    const toast = document.createElement('div');
    toast.innerHTML = `✅ Scan complete! Found ${savedProjects.length} projects.`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  // Load projects on mount and when switching to projects tab
  useEffect(() => {
    if (activeTab === 'projects') {
      console.log('[DataFiles] Switching to projects tab, loading projects...');
      loadSavedProjects();
    }
  }, [activeTab]);

  // Also load projects on mount and whenever we navigate back to this page
  useEffect(() => {
    console.log('[DataFiles] Component mounted/refreshed, loading projects...');
    loadSavedProjects();

    // Set up interval to refresh every 3 seconds when on projects tab
    const refreshInterval = setInterval(() => {
      if (activeTab === 'projects') {
        console.log('[DataFiles] Auto-refreshing projects list...');
        loadSavedProjects();
      }
    }, 3000);

    return () => clearInterval(refreshInterval);
  }, []);

  // Refresh projects when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (activeTab === 'projects') {
        console.log('[DataFiles] Window gained focus, refreshing projects...');
        loadSavedProjects();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeTab]);

  // Open and load a project file
  const handleOpenProject = async (projectFile) => {
    try {
      // Read the project file
      const response = await fetch(`http://localhost:5000/api/projects`);
      if (!response.ok) throw new Error('Failed to fetch projects');

      // Use file input to load the project
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.prcl';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const fileContent = event.target.result;

            const loadResponse = await fetch('http://localhost:5000/api/project/load', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileContent }),
            });

            if (!loadResponse.ok) throw new Error('Load failed');

            const result = await loadResponse.json();
            const projectData = result.projectData;

            // IMPORTANT: Clear ALL current state FIRST to ensure complete isolation
            setProjectName('');
            setPointsFileName('');
            setPointsFilePath('');
            setLoadedPoints({});
            setSavedParcels([]);
            setGlobalFileHeading({
              block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
            });

            // Also clear local editing state
            setEditMode(false);
            setEditingPoints({});
            setNewPointId('');
            setNewPointX('');
            setNewPointY('');
            setEditingPointId(null);

            // Now load the NEW project's data - completely replace everything
            setProjectName(projectData.projectName || '');
            setPointsFileName(projectData.pointsFileName || '');
            setPointsFilePath(projectData.pointsFilePath || '');
            setLoadedPoints(projectData.loadedPoints || {});
            setSavedParcels(projectData.savedParcels || []);
            setGlobalFileHeading(projectData.fileHeading || {
              block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
            });

            // Navigate to Parcel Calculator
            navigate('/parcel-calculator');
          } catch (error) {
            console.error('Error loading project:', error);
            toast.error('Error loading project: ' + error.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    } catch (error) {
      console.error('Error opening project:', error);
      toast.error('Error opening project: ' + error.message);
    }
  };

  // Load project from backend/data directory or custom path
  const handleOpenProjectFromList = async (projectItem) => {
    try {
      // Use filePath if available (for custom Save As paths), otherwise use fileName
      const loadResponse = await fetch('http://localhost:5000/api/project/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          projectItem.filePath
            ? { filePath: projectItem.filePath }
            : { fileName: projectItem.fileName }
        ),
      });

      if (!loadResponse.ok) {
        const errorData = await loadResponse.json();
        throw new Error(errorData.error || 'Load failed');
      }

      const result = await loadResponse.json();
      const projectData = result.projectData;

      // IMPORTANT: Clear ALL current state FIRST to ensure complete isolation
      setProjectName('');
      setPointsFileName('');
      setPointsFilePath('');
      setLoadedPoints({});
      setSavedParcels([]);
      setGlobalFileHeading({
        block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
      });
      setHasUnsavedChanges(false);

      // Also clear local editing state
      setEditMode(false);
      setEditingPoints({});
      setNewPointId('');
      setNewPointX('');
      setNewPointY('');
      setEditingPointId(null);

      // Now load the NEW project's data - completely replace everything
      setProjectName(projectData.projectName || '');
      setPointsFileName(projectData.pointsFileName || '');
      setPointsFilePath(projectData.pointsFilePath || '');
      setLoadedPoints(projectData.loadedPoints || {});
      setSavedParcels(projectData.savedParcels || []);
      setGlobalFileHeading(projectData.fileHeading || {
        block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
      });
      setHasUnsavedChanges(false);

      // Refresh projects list after loading to clean up any deleted files
      setTimeout(() => {
        loadSavedProjects();
      }, 500);

      // Show success toast
      const toast = document.createElement('div');
      toast.innerHTML = `✅ Project "${projectData.projectName}" loaded!<br/>Redirecting to calculator...`;
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #238636;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
        navigate('/parcel-calculator');
      }, 1500);
    } catch (error) {
      console.error('Error loading project:', error);
      const errorToast = document.createElement('div');
      errorToast.innerHTML = `❌ Error loading project: ${error.message}`;
      errorToast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #da3633;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      `;
      document.body.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 4000);
    }
  };

  // Auto-save points file when changes made
  useEffect(() => {
    if (!pointsFileName || Object.keys(editingPoints).length === 0) return;

    // Check if points actually changed
    const pointsChanged = JSON.stringify(editingPoints) !== JSON.stringify(loadedPoints);
    if (!pointsChanged) return;

    // Auto-save after 3 seconds of inactivity
    const autoSaveTimer = setTimeout(() => {
      handleAutoSavePoints();
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [editingPoints]);

  // Auto-save points file
  const handleAutoSavePoints = async () => {
    if (!pointsFileName) return;

    try {
      // Convert points to text format
      const lines = [];
      lines.push('# Points File');
      lines.push(`# Auto-saved: ${new Date().toLocaleString()}`);
      lines.push('# Format: ID, X, Y');
      lines.push('');

      const sortedIds = Object.keys(editingPoints).sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
      });

      sortedIds.forEach(id => {
        const pt = editingPoints[id];
        lines.push(`${id}, ${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}`);
      });

      const textData = lines.join('\n');

      const response = await fetch('http://localhost:5000/api/save-points-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: pointsFileName,
          content: textData,
          filePath: pointsFilePath
        }),
      });

      if (response.ok) {
        setLoadedPoints({ ...editingPoints });
        console.log('✅ Auto-saved points file:', pointsFileName);
      }
    } catch (error) {
      console.error('Auto-save points failed:', error);
    }
  };

  // Open/Create new points file
  const handleOpenPointsFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const filePath = file.path || file.name;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const textData = e.target.result;

        const response = await fetch('http://localhost:5000/api/import-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: textData }),
        });

        if (!response.ok) throw new Error('Failed to import points');

        const result = await response.json();

        if (result.points && result.points.length > 0) {
          const pointsObj = {};
          result.points.forEach(p => {
            pointsObj[p.id] = { x: p.x, y: p.y };
          });

          // Set all state first, then enable edit mode
          setPointsFileName(file.name);
          setPointsFilePath(filePath);
          setLoadedPoints(pointsObj);
          setEditingPoints({ ...pointsObj });
          setPointsSynced(true); // Mark as synced since we just loaded

          // Switch to points tab and enable edit mode
          setActiveTab('points');

          // Use setTimeout to ensure state updates complete before setting edit mode
          setTimeout(() => {
            setEditMode(true);
          }, 50);

          toast.success(`✅ Opened: ${file.name} - ${result.count} points loaded for editing`);
        } else {
          toast.warning('No valid points found in file');
        }
      } catch (error) {
        console.error('Error loading file:', error);
        toast.error('Error loading file');
      }
    };
    reader.readAsText(file);
  };

  // Add new point
  const handleAddPoint = () => {
    if (!newPointId || !newPointX || !newPointY) {
      toast.warning('Fill all fields: ID, X, Y');
      return;
    }

    if (editingPoints[newPointId]) {
      if (!confirm(`Point ID "${newPointId}" already exists. Replace it?`)) {
        return;
      }
    }

    const updatedPoints = {
      ...editingPoints,
      [newPointId]: {
        x: parseFloat(newPointX),
        y: parseFloat(newPointY)
      }
    };

    setEditingPoints(updatedPoints);

    // Also update loadedPoints to keep them in sync
    setLoadedPoints(updatedPoints);

    setNewPointId('');
    setNewPointX('');
    setNewPointY('');

    toast.success('✅ Point added! 💾 Auto-saving in 3 seconds...');
  };

  // Edit point
  const handleEditPoint = (id) => {
    setEditingPointId(id);
    setNewPointId(id);
    setNewPointX(editingPoints[id].x.toString());
    setNewPointY(editingPoints[id].y.toString());
  };

  // Update edited point
  const handleUpdatePoint = () => {
    if (!newPointId || !newPointX || !newPointY) {
      toast.warning('Fill all fields');
      return;
    }

    const updated = { ...editingPoints };

    // If ID changed, delete old and add new
    if (editingPointId && editingPointId !== newPointId) {
      delete updated[editingPointId];
    }

    updated[newPointId] = {
      x: parseFloat(newPointX),
      y: parseFloat(newPointY)
    };

    setEditingPoints(updated);
    // Also update loadedPoints to keep them in sync
    setLoadedPoints(updated);

    setEditingPointId(null);
    setNewPointId('');
    setNewPointX('');
    setNewPointY('');

    toast.success('✅ Point updated! 💾 Auto-saving in 3 seconds...');
  };

  // Delete point
  const handleDeletePoint = (id) => {
    if (confirm(`Delete point ${id}?`)) {
      const updated = { ...editingPoints };
      delete updated[id];
      setEditingPoints(updated);
      // Also update loadedPoints to keep them in sync
      setLoadedPoints(updated);
      toast.success(`✅ Point ${id} deleted! 💾 Auto-saving in 3 seconds...`);
    }
  };

  // Save changes back to .pnt file
  const handleSavePointsFile = async (forceSaveAs = false) => {
    try {
      // Convert points object to text format
      const lines = [];
      lines.push('# Points File');
      lines.push(`# Edited: ${new Date().toLocaleString()}`);
      lines.push('# Format: ID, X, Y');
      lines.push('');

      // Sort by ID for consistency
      const sortedIds = Object.keys(editingPoints).sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
      });

      sortedIds.forEach(id => {
        const pt = editingPoints[id];
        lines.push(`${id}, ${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}`);
      });

      const textData = lines.join('\n');

      let fileNameToUse = pointsFileName;
      let filePathToUse = pointsFilePath;

      // If no filename or Save As requested, show dialog
      if (!pointsFileName || forceSaveAs) {
        let savePath = null;

        // Use Electron dialog if available
        if (window.electronAPI && window.electronAPI.showSaveDialog) {
          const defaultName = pointsFileName || 'points.pnt';
          const dialogResult = await window.electronAPI.showSaveDialog({
            title: 'Save Points File As',
            defaultPath: defaultName,
            filters: [
              { name: 'Points Files', extensions: ['pnt', 'txt'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          });

          if (dialogResult.canceled) {
            return; // User cancelled
          }

          if (dialogResult.error) {
            toast.error('Error opening save dialog: ' + dialogResult.error);
            return;
          }

          savePath = dialogResult.filePath;
          // Extract filename from path
          const pathParts = savePath.split(/[/\\]/);
          fileNameToUse = pathParts[pathParts.length - 1];
          if (!fileNameToUse.includes('.')) {
            fileNameToUse += '.pnt';
          }
          filePathToUse = savePath;

          // Update state
          setPointsFileName(fileNameToUse);
          setPointsFilePath(filePathToUse);
        } else {
          // Fallback: show error if Electron dialog not available
          toast.warning('⚠️ Save As dialog not available. Please ensure you are running the app in Electron. Using default filename...');
          fileNameToUse = pointsFileName || 'points.pnt';
          if (!fileNameToUse.endsWith('.pnt') && !fileNameToUse.endsWith('.txt')) {
            fileNameToUse += '.pnt';
          }
          setPointsFileName(fileNameToUse);
        }
      }

      const response = await fetch('http://localhost:5000/api/save-points-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileNameToUse,
          content: textData,
          filePath: filePathToUse
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Save failed');
      }

      const result = await response.json();

      // Update shared context
      setLoadedPoints({ ...editingPoints });
      setHasUnsavedChanges(false);

      const location = filePathToUse ? `\nLocation: ${filePathToUse}` : `\nLocation: backend/data/${result.fileName}`;
      toast.success(`✅ Saved ${Object.keys(editingPoints).length} points to ${result.fileName}. File is being watched for external changes!`);
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error('Error saving file: ' + error.message);
    }
  };

  // Save As handler
  const handleSavePointsAs = () => {
    handleSavePointsFile(true);
  };

  // Save file heading
  const handleSaveHeading = () => {
    setGlobalFileHeading(localHeading);
    setShowHeadingDialog(false);
    setHasUnsavedChanges(true);
    toast.success('✅ File heading saved! It will be included in PDF exports. Don\'t forget to save your project!');
  };

  return (
    <div className="min-h-screen p-8 relative z-10">
      {/* File Heading Dialog */}
      {showHeadingDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-800 border-2 border-primary rounded-2xl p-8 max-w-2xl w-full mx-4"
          >
            <h2 className="text-3xl font-bold text-primary mb-6">📝 File Heading</h2>
            <p className="text-dark-300 mb-6">This heading will appear on PDF exports</p>

            <div className="space-y-4">
              <div>
                <label className="block text-dark-300 font-semibold mb-2">Block:</label>
                <input
                  type="text"
                  value={localHeading.block}
                  onChange={(e) => setLocalHeading({ ...localHeading, block: e.target.value })}
                  className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary w-full"
                  placeholder="e.g., 12345"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-dark-300 font-semibold mb-2">Quarter:</label>
                <input
                  type="text"
                  value={localHeading.quarter}
                  onChange={(e) => setLocalHeading({ ...localHeading, quarter: e.target.value })}
                  className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary w-full"
                  placeholder="e.g., Northwest"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-dark-300 font-semibold mb-2">Parcels:</label>
                <input
                  type="text"
                  value={localHeading.parcels}
                  onChange={(e) => setLocalHeading({ ...localHeading, parcels: e.target.value })}
                  className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary w-full"
                  placeholder="e.g., 101-110"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-dark-300 font-semibold mb-2">Place:</label>
                <input
                  type="text"
                  value={localHeading.place}
                  onChange={(e) => setLocalHeading({ ...localHeading, place: e.target.value })}
                  className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary w-full"
                  placeholder="e.g., Downtown District"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-dark-300 font-semibold mb-2">Additional Info:</label>
                <textarea
                  value={localHeading.additionalInfo}
                  onChange={(e) => setLocalHeading({ ...localHeading, additionalInfo: e.target.value })}
                  className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary w-full"
                  placeholder="Any additional information..."
                  rows="3"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowHeadingDialog(false)} className="btn-secondary flex-1 py-3">
                Cancel
              </button>
              <button onClick={handleSaveHeading} className="btn-primary flex-1 py-3">
                ✅ Save Heading
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex gap-2 mb-6">
            <button onClick={() => navigate('/')} className="btn-secondary flex items-center gap-2 group">
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              ↩ MAIN MENU
            </button>
            <button onClick={handleCloseProject} className="btn-secondary flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border-red-600/50 text-red-400">
              ❌ Close Project
            </button>
          </div>

          <div className="glass-effect rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <FolderOpen className="w-10 h-10 text-primary" />
              <div>
                <h1 className="text-4xl font-bold gradient-text">📁 Data Files Manager</h1>
                <p className="text-dark-300 mt-2">Edit points files, manage projects, set file heading</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('points')}
                className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${activeTab === 'points'
                  ? 'bg-dark-800 text-primary border-t-2 border-primary'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                  }`}
              >
                📝 Points Files
              </button>
              <button
                onClick={() => { setActiveTab('projects'); loadSavedProjects(); }}
                className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${activeTab === 'projects'
                  ? 'bg-dark-800 text-primary border-t-2 border-primary'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                  }`}
              >
                📁 Saved Projects
              </button>
            </div>

            {/* Toolbar - Points Files Tab */}
            {activeTab === 'points' && (
              <div className="flex gap-2 flex-wrap">
                <input type="file" accept=".pnt,.txt,.csv" onChange={handleOpenPointsFile} style={{ display: 'none' }} id="open-points" />
                <label htmlFor="open-points" className="btn-primary py-2 px-4 text-sm cursor-pointer flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Open Points File
                </label>

                <button onClick={() => handleSavePointsFile(false)} disabled={!editMode} className="btn-success py-2 px-4 text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Now (Auto-save: ON)
                </button>

                <button onClick={handleSavePointsAs} disabled={!editMode} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save As...
                </button>

                <button onClick={() => setShowHeadingDialog(true)} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  File Heading
                </button>
              </div>
            )}

            {/* Toolbar - Projects Tab */}
            {activeTab === 'projects' && (
              <div className="flex gap-2 flex-wrap">
                <input type="file" accept=".prcl" onChange={handleOpenProject} style={{ display: 'none' }} id="open-project" />
                <label htmlFor="open-project" className="btn-primary py-2 px-4 text-sm cursor-pointer flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Open Project File
                </label>

                <button onClick={loadSavedProjects} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Refresh List
                </button>
              </div>
            )}

            {/* File info */}
            {pointsFileName && (
              <div className="mt-4 p-3 bg-primary/10 border border-primary rounded-lg flex items-center justify-between">
                <p className="text-primary font-semibold">
                  📄 Editing: {pointsFileName} ({Object.keys(editingPoints).length} points)
                </p>
                <div className="flex items-center gap-2 text-success text-sm">
                  <span className="animate-pulse">💾</span>
                  <span>Auto-save: ON</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Add/Edit Point Form - Only show on Points Files tab */}
        {activeTab === 'points' && editMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mb-6">
            <h2 className="text-2xl font-bold text-primary mb-4">
              {editingPointId ? `✏️ Edit Point ${editingPointId}` : '➕ Add New Point'}
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-dark-300 font-semibold mb-2">Point ID:</label>
                <input
                  type="text"
                  value={newPointId}
                  onChange={(e) => setNewPointId(e.target.value)}
                  className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary w-full"
                  placeholder="e.g., 1"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-dark-300 font-semibold mb-2">X Coordinate:</label>
                <input
                  type="number"
                  step="0.01"
                  value={newPointX}
                  onChange={(e) => setNewPointX(e.target.value)}
                  className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary w-full"
                  placeholder="0.00"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-dark-300 font-semibold mb-2">Y Coordinate:</label>
                <input
                  type="number"
                  step="0.01"
                  value={newPointY}
                  onChange={(e) => setNewPointY(e.target.value)}
                  className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary w-full"
                  placeholder="0.00"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            <div className="flex gap-4">
              {editingPointId ? (
                <>
                  <button onClick={handleUpdatePoint} className="btn-primary flex items-center gap-2">
                    <Save className="w-5 h-5" />
                    Update Point
                  </button>
                  <button
                    onClick={() => {
                      setEditingPointId(null);
                      setNewPointId('');
                      setNewPointX('');
                      setNewPointY('');
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={handleAddPoint} className="btn-primary flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Point
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Points List */}
        {editMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-dark-50">Points in File ({Object.keys(editingPoints).length})</h2>
              <button onClick={() => handleSavePointsFile(false)} className="btn-success flex items-center gap-2">
                <Save className="w-5 h-5" />
                Save All Changes
              </button>

              <button onClick={handleSavePointsAs} className="btn-secondary flex items-center gap-2">
                <Save className="w-5 h-5" />
                Save As...
              </button>
            </div>

            <div className="bg-dark-700 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                {Object.keys(editingPoints)
                  .sort((a, b) => {
                    const numA = parseInt(a) || 0;
                    const numB = parseInt(b) || 0;
                    return numA - numB;
                  })
                  .map((id) => (
                    <div
                      key={id}
                      className="bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 flex items-center justify-between hover:border-primary/50 transition-all group"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <span className="text-primary font-bold text-lg w-20">{id}</span>
                        <span className="text-dark-300">
                          X: <span className="text-white font-mono">{editingPoints[id].x.toFixed(2)}</span>
                        </span>
                        <span className="text-dark-300">
                          Y: <span className="text-white font-mono">{editingPoints[id].y.toFixed(2)}</span>
                        </span>
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditPoint(id)}
                          className="p-2 hover:bg-primary/20 rounded-lg text-primary"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePoint(id)}
                          className="p-2 hover:bg-danger/20 rounded-lg text-danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="mt-4 p-3 bg-success/10 border border-success rounded-lg">
              <p className="text-success text-sm flex items-center gap-2">
                <span className="animate-pulse">💾</span>
                <span>Auto-save enabled! Changes save automatically after 3 seconds.</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Saved Projects Tab Content */}
        {activeTab === 'projects' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-dark-50">Saved Projects ({savedProjects.length})</h2>
              <div className="flex gap-2">
                <button onClick={() => loadSavedProjects(false)} disabled={loadingProjects} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${loadingProjects ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button onClick={handleScanComputer} disabled={loadingProjects} className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
                  🔍 Scan Computer
                </button>
              </div>
            </div>

            {loadingProjects ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                <p className="text-dark-300">Loading projects...</p>
              </div>
            ) : savedProjects.length === 0 ? (
              <div className="text-center py-12">
                <File className="w-20 h-20 mx-auto mb-4 text-dark-600" />
                <h3 className="text-2xl font-bold text-dark-300 mb-2">No Projects Found</h3>
                <p className="text-dark-400 mb-6">Save a project from the Parcel Calculator to see it here</p>
                <button onClick={() => navigate('/parcel-calculator')} className="btn-primary inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Go to Calculator
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {savedProjects.map((project, index) => {
                  // Show file path for custom locations, filename for DATA_DIR projects
                  const displayPath = project.filePath && !project.filePath.includes('backend/data')
                    ? project.filePath
                    : project.fileName;
                  const isEmpty = project.savedParcels === 0;

                  return (
                    <div
                      key={index}
                      className="glass-effect rounded-lg p-5 hover:border-primary/50 transition-all group cursor-pointer"
                      onClick={() => handleOpenProjectFromList(project)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-primary">
                              {project.projectName}
                            </h3>
                            {isEmpty && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-dark-700 text-dark-300 border border-dark-600">
                                Empty
                              </span>
                            )}
                          </div>
                          <div className="flex gap-6 text-sm text-dark-300">
                            <span>📄 File: <strong>{displayPath}</strong></span>
                            <span>📐 Parcels: <strong className={isEmpty ? 'text-dark-500' : ''}>{project.savedParcels}</strong></span>
                            <span>📁 Points: <strong>{project.pointsFile}</strong></span>
                            <span>🕒 {new Date(project.lastModified * 1000).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProjectFromList(project);
                            }}
                            className="p-2 hover:bg-primary/20 rounded-lg text-primary"
                            title="Open and edit this project"
                          >
                            <FolderOpen className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State - Points Files Tab */}
        {activeTab === 'points' && !editMode && (
          <div className="card text-center py-12">
            <FolderOpen className="w-20 h-20 mx-auto mb-4 text-dark-600" />
            <h3 className="text-2xl font-bold text-dark-300 mb-2">No File Loaded</h3>
            <p className="text-dark-400 mb-6">Open a points file to start editing</p>
            <label htmlFor="open-points" className="btn-primary inline-flex items-center gap-2 cursor-pointer">
              <FolderOpen className="w-5 h-5" />
              Open Points File
            </label>
          </div>
        )}

        {/* Help */}
        <div className="mt-6 p-4 bg-dark-800/50 rounded-lg text-dark-400 text-sm">
          <p className="font-semibold text-primary mb-2">💡 How to Use Data Files:</p>
          <ul className="space-y-1">
            <li>1. <strong>Open Points File</strong> - Load your .pnt/.txt/.csv file</li>
            <li>2. <strong>Add/Edit/Delete</strong> - Modify points as needed</li>
            <li>3. <strong>Save Points File</strong> - Writes back to the .pnt file (keeps format!)</li>
            <li>4. <strong>File Heading</strong> - Set block, quarter, parcels info (for PDF)</li>
            <li>5. <strong>Auto-sync</strong> - Changes sync with Area Calculator automatically</li>
            <li>6. <strong>Auto-watch</strong> - File monitored for external changes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DataFiles;
