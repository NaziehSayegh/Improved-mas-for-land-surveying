import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FolderOpen, File, Plus, Trash2, Edit2, Save, FileText, RefreshCw, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';
import { customConfirm } from '../utils/dialogs';
import { safeHtml } from '../utils/safeHtml';
import BackButton from '../components/BackButton';

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
    savedParcels,
    setSavedParcels,
    projectPath,
    setProjectPath,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    setProjectName,
    fileHeading: globalFileHeading,
    setFileHeading: setGlobalFileHeading,
    recalculateAllParcels,
    saveActiveProject,
    closeProject,
    removePointsFile,
    setCurrentParcel,
    loadProjectData
  } = useProject();
  const toast = useToast();

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
  const [pointSearch, setPointSearch] = useState('');
  const [pointSort, setPointSort] = useState('id');           // id | x | y
  const [pointPage, setPointPage] = useState(1);
  const POINTS_PER_PAGE = 100;

  // Sync with global heading
  useEffect(() => {
    setLocalHeading(globalFileHeading);
  }, [globalFileHeading]);

  // Track unsaved changes for points editing
  const hasUnsavedPoints = editMode && Object.keys(editingPoints).length > 0;


  // Close project - auto-saves and resets state
  const handleCloseProject = async () => {
    // Auto-save project if path is set
    if (projectPath && typeof saveActiveProject === 'function') {
      try {
        await saveActiveProject();
      } catch (err) {
        console.warn('Auto-save on close project:', err);
      }
    }

    // Auto-save points file if there are unsaved point edits
    if (hasUnsavedPoints && pointsFileName) {
      try {
        await handleAutoSavePoints();
      } catch (error) {
        console.error('Error auto-saving points on close:', error);
      }
    }

    // Full atomic reset via context helper
    closeProject();

    // Also clear local DataFiles editing state
    setEditMode(false);
    setEditingPoints({});
    setNewPointId('');
    setNewPointX('');
    setNewPointY('');
    setEditingPointId(null);

    toast.success('✅ Project closed.');
    navigate('/');
  };

  const handleBackToMainMenu = useCallback(async () => {
    if (hasUnsavedChanges && projectPath && typeof saveActiveProject === 'function') {
      try {
        await saveActiveProject();
      } catch (err) {
        console.warn('Auto-save on back to main menu:', err);
      }
    }
    navigate('/');
  }, [navigate, hasUnsavedChanges, projectPath, saveActiveProject]);

  // ESC key to go to main menu (only if no dialogs are open)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && !showHeadingDialog) {
        e.preventDefault();
        handleBackToMainMenu();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleBackToMainMenu, showHeadingDialog]);

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
    const confirmed = await customConfirm('🔍 Scan your computer for .prcl files?\n\nThis will search in:\n• Documents\n• Desktop\n• Downloads\n• Home folder\n\nThis may take a minute...');
    if (!confirmed) return;

    await loadSavedProjects(true);

    // Show success toast
    const domToast = document.createElement('div');
    domToast.innerHTML = safeHtml(`✅ Scan complete! Found ${savedProjects.length} projects.`);
    domToast.style.cssText = `
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
    document.body.appendChild(domToast);
    setTimeout(() => domToast.remove(), 3000);
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
      input.accept = '.prcl,.parproj,.json';
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
              body: JSON.stringify({ fileContent, filePath: file.path, fileName: file.name }),
            });

            if (!loadResponse.ok) {
              const errData = await loadResponse.json().catch(() => ({}));
              throw new Error(errData.error || 'Load failed');
            }

            const result = await loadResponse.json();
            const projectData = result.projectData;

            // Clear local editing state
            setEditMode(false);
            setEditingPoints({});
            setNewPointId('');
            setNewPointX('');
            setNewPointY('');
            setEditingPointId(null);

            loadProjectData(projectData, result.filePath || file.path || '');

            const hasCad = Boolean(projectData.cadFilePath || (projectData.cadEntities && projectData.cadEntities.length > 0) || projectData.cadFileName);
            navigate(hasCad ? '/dxf-import' : '/parcel-calculator');
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
        const errorData = await loadResponse.json().catch(() => ({}));
        if (loadResponse.status === 404 || (errorData.error && errorData.error.toLowerCase().includes('not found'))) {
          loadSavedProjects();
          toast.warning(`⚠️ Project file "${projectItem.projectName || projectItem.fileName}" was not found at its saved location. It may have been moved or deleted.`);
          return;
        }
        throw new Error(errorData.error || 'Load failed');
      }

      const result = await loadResponse.json();
      const projectData = result.projectData;

      // Clear local editing state
      setEditMode(false);
      setEditingPoints({});
      setNewPointId('');
      setNewPointX('');
      setNewPointY('');
      setEditingPointId(null);

      loadProjectData(projectData, result.filePath || projectItem.filePath || '');

      // Refresh projects list after loading to clean up any deleted files
      setTimeout(() => {
        loadSavedProjects();
      }, 500);

      const hasCad = Boolean(projectData.cadFilePath || (projectData.cadEntities && projectData.cadEntities.length > 0) || projectData.cadFileName);
      const targetPage = hasCad ? '/dxf-import' : '/parcel-calculator';
      const targetName = hasCad ? 'CAD map...' : 'calculator...';

      // Show success toast
      const domToast = document.createElement('div');
      domToast.innerHTML = safeHtml(`✅ Project "${projectData.projectName}" loaded!<br/>Redirecting to ${targetName}`);
      domToast.style.cssText = `
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
      document.body.appendChild(domToast);
      setTimeout(() => {
        domToast.remove();
        navigate(targetPage);
      }, 1500);
    } catch (error) {
      console.error('Error loading project:', error);
      const errorToast = document.createElement('div');
      errorToast.innerHTML = safeHtml(`❌ Error loading project: ${error.message}`);
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
        lines.push(`${id}, ${pt.x}, ${pt.y}`);
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
        
        // If a project is open, recalculate and save project too to keep them in sync
        if (projectPath) {
          const recalculated = await recalculateAllParcels(editingPoints, savedParcels);
          await saveActiveProject(projectPath, recalculated, editingPoints);
        }
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

          // Set all state for the new file (preserving saved parcels in the project)
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
  const handleAddPoint = async () => {
    if (!newPointId || !newPointX || !newPointY) {
      toast.warning('Fill all fields: ID, X, Y');
      return;
    }

    if (editingPoints[newPointId]) {
      if (!(await customConfirm(`Point ID "${newPointId}" already exists. Replace it?`))) {
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

    // If ID changed, delete old, add new, and rename references in all saved parcels
    if (editingPointId && editingPointId !== newPointId) {
      delete updated[editingPointId];
      
      const renamedParcels = (savedParcels || []).map(parcel => {
        let parcelChanged = false;
        
        // Update point IDs list
        const updatedIds = (parcel.ids || []).map(id => {
          if (id === editingPointId) {
            parcelChanged = true;
            return newPointId;
          }
          return id;
        });
        
        // Update curve references
        const updatedCurves = (parcel.curves || []).map(curve => {
          let curveChanged = false;
          const newCurve = { ...curve };
          if (curve.from === editingPointId) {
            newCurve.from = newPointId;
            curveChanged = true;
          }
          if (curve.to === editingPointId) {
            newCurve.to = newPointId;
            curveChanged = true;
          }
          if (curveChanged) {
            parcelChanged = true;
          }
          return newCurve;
        });
        
        if (parcelChanged) {
          return {
            ...parcel,
            ids: updatedIds,
            curves: updatedCurves
          };
        }
        return parcel;
      });
      
      setSavedParcels(renamedParcels);
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
  const handleDeletePoint = async (id) => {
    if (await customConfirm(`Delete point ${id}?`)) {
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
        lines.push(`${id}, ${pt.x}, ${pt.y}`);
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
      
      // If a project is open, recalculate and save project too to keep them in sync
      if (projectPath) {
        const recalculated = await recalculateAllParcels(editingPoints, savedParcels);
        await saveActiveProject(projectPath, recalculated, editingPoints);
      } else {
        setHasUnsavedChanges(false);
      }

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

  // ── Points table: search, sort, paging ──────────────────────────────────
  const pointIds = Object.keys(editingPoints);
  const pointCount = pointIds.length;
  const bounds = pointCount ? pointIds.reduce((b, id) => {
    const { x, y } = editingPoints[id];
    return { minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minY: Math.min(b.minY, y), maxY: Math.max(b.maxY, y) };
  }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }) : null;
  const searchText = pointSearch.trim().toLowerCase();
  const filteredIds = pointIds
    .filter((id) => !searchText || id.toLowerCase().includes(searchText)
      || String(editingPoints[id].x.toFixed(2)).includes(searchText) || String(editingPoints[id].y.toFixed(2)).includes(searchText))
    .sort((a, b) => {
      if (pointSort === 'x') return editingPoints[a].x - editingPoints[b].x;
      if (pointSort === 'y') return editingPoints[a].y - editingPoints[b].y;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  const pointPageCount = Math.max(1, Math.ceil(filteredIds.length / POINTS_PER_PAGE));
  const currentPointPage = Math.min(pointPage, pointPageCount);
  const pagePointIds = filteredIds.slice((currentPointPage - 1) * POINTS_PER_PAGE, currentPointPage * POINTS_PER_PAGE);

  const handleRemovePointsFile = async () => {
    if (await customConfirm(`Remove "${pointsFileName}" from this project?\n\nAll saved parcels will stay in your project and will recoordinate when you load a new points file.`)) {
      removePointsFile();
      setEditingPoints({});
      setEditMode(false);
      toast.success('🗑️ Points file removed while keeping your saved parcels.');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-dark-900 relative z-10">
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

      <header className="page-topbar">
        <BackButton onClick={handleBackToMainMenu} compact />
        <h1 className="text-base font-bold text-dark-100 flex-1 truncate">Data Files</h1>
        <button onClick={handleCloseProject} className="btn-ghost py-1.5 px-3 text-sm text-red-400 hover:text-red-300 border border-red-600/30 flex-shrink-0">
          Close Project
        </button>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">
        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 px-4 border-b border-dark-800 flex-shrink-0 overflow-x-auto">
          {[['points', <FileText key="i" className="w-4 h-4" />, 'Points file'], ['projects', <FolderOpen key="i" className="w-4 h-4" />, 'Saved projects']].map(([id, icon, label]) => (
            <button key={id}
              onClick={() => { setActiveTab(id); if (id === 'projects') loadSavedProjects(); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                ${activeTab === id ? 'border-primary text-primary' : 'border-transparent text-dark-400 hover:text-dark-200'}`}>
              {icon}{label}
              {id === 'points' && editMode && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-dark-700 text-dark-300 font-bold">{pointCount}</span>}
              {id === 'projects' && savedProjects.length > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-dark-700 text-dark-300 font-bold">{savedProjects.length}</span>}
            </button>
          ))}
          <input type="file" accept=".pnt,.txt,.csv" onChange={handleOpenPointsFile} style={{ display: 'none' }} id="open-points" />
          <input type="file" accept=".prcl" onChange={handleOpenProject} style={{ display: 'none' }} id="open-project" />
        </div>

        {/* ═════════ POINTS TAB ═════════ */}
        {activeTab === 'points' && !editMode && (
          <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-6 flex items-center justify-center">
            <div className="max-w-xl w-full text-center border-2 border-dashed border-dark-700 rounded-2xl p-10 bg-dark-900/40">
              <FolderOpen className="w-14 h-14 mx-auto mb-4 text-primary/70" />
              <h2 className="text-xl font-bold text-dark-100 mb-1">No points file loaded</h2>
              <p className="text-sm text-dark-400 mb-6">Open the file with your survey points (<span className="font-mono">.pnt</span>, <span className="font-mono">.txt</span> or <span className="font-mono">.csv</span>) to view and edit it here. Each line is: <span className="font-mono">ID  X  Y</span>.</p>
              <label htmlFor="open-points" className="btn-primary inline-flex items-center gap-2 cursor-pointer px-6 py-3">
                <FolderOpen className="w-5 h-5" /> Open points file
              </label>
              <p className="text-xs text-dark-500 mt-5">Changes are saved back to the same file automatically, and the Area Calculator, Plotting and CAD Import see them straight away.</p>
            </div>
          </div>
        )}

        {activeTab === 'points' && editMode && (
          <div className="flex-1 min-h-0 overflow-y-auto min-[960px]:overflow-hidden scroll-area p-4">
            <div className="min-[960px]:h-full grid gap-4 min-[960px]:grid-cols-[340px_1fr] max-w-[1500px] mx-auto">

              {/* ── Left: file + add/edit point ── */}
              <div className="flex flex-col gap-4 min-[960px]:overflow-y-auto scroll-area min-[960px]:pr-1">
                <div className="rounded-2xl border border-dark-800 bg-dark-900/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-dark-100 truncate" title={pointsFileName}>{pointsFileName || 'Unnamed file'}</div>
                      <div className="text-xs text-dark-400 mt-0.5">{pointCount} points</div>
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] text-green-400 flex-shrink-0" title="Changes are saved automatically 3 seconds after you stop editing">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Auto-save
                    </span>
                  </div>
                  {bounds && (
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-[11px] font-mono text-dark-400">
                      <dt className="text-dark-500">X from</dt><dd className="text-right text-dark-300">{bounds.minX.toFixed(2)}</dd>
                      <dt className="text-dark-500">X to</dt><dd className="text-right text-dark-300">{bounds.maxX.toFixed(2)}</dd>
                      <dt className="text-dark-500">Y from</dt><dd className="text-right text-dark-300">{bounds.minY.toFixed(2)}</dd>
                      <dt className="text-dark-500">Y to</dt><dd className="text-right text-dark-300">{bounds.maxY.toFixed(2)}</dd>
                    </dl>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={() => handleSavePointsFile(false)} className="btn-success py-2 px-3 text-xs col-span-2 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save now</button>
                    <button onClick={handleSavePointsAs} className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-2"><Save className="w-3.5 h-3.5" /> Save as…</button>
                    <button onClick={() => setShowHeadingDialog(true)} className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-2"><FileText className="w-3.5 h-3.5" /> File heading</button>
                    <label htmlFor="open-points" className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-2 cursor-pointer"><FolderOpen className="w-3.5 h-3.5" /> Replace file</label>
                    <button onClick={handleRemovePointsFile} className="btn-secondary py-2 px-3 text-xs flex items-center justify-center gap-2 text-red-400 border-red-600/30 hover:bg-red-600/10" title="Remove the points file but keep all saved parcels"><Trash2 className="w-3.5 h-3.5" /> Remove file</button>
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${editingPointId ? 'border-amber-600/50 bg-amber-950/10' : 'border-dark-800 bg-dark-900/50'}`}>
                  <h2 className="text-sm font-bold text-dark-100 mb-3 flex items-center gap-2">
                    {editingPointId ? <><Edit2 className="w-4 h-4 text-amber-400" /> Edit point {editingPointId}</> : <><Plus className="w-4 h-4 text-primary" /> Add a point</>}
                  </h2>
                  <form onSubmit={(e) => { e.preventDefault(); editingPointId ? handleUpdatePoint() : handleAddPoint(); }} className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-400">Point ID</span>
                      <input type="text" value={newPointId} onChange={(e) => setNewPointId(e.target.value)} placeholder="e.g. 26" className="bg-dark-800 border border-dark-700 focus:border-primary outline-none rounded-lg px-3 py-2 text-sm text-white" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-400">X</span>
                        <input type="number" step="0.01" value={newPointX} onChange={(e) => setNewPointX(e.target.value)} placeholder="0.00" className="bg-dark-800 border border-dark-700 focus:border-primary outline-none rounded-lg px-3 py-2 text-sm font-mono text-white" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-400">Y</span>
                        <input type="number" step="0.01" value={newPointY} onChange={(e) => setNewPointY(e.target.value)} placeholder="0.00" className="bg-dark-800 border border-dark-700 focus:border-primary outline-none rounded-lg px-3 py-2 text-sm font-mono text-white" />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="btn-primary py-2 px-4 text-sm flex-1 flex items-center justify-center gap-2">
                        {editingPointId ? <><Save className="w-4 h-4" /> Update point</> : <><Plus className="w-4 h-4" /> Add point</>}
                      </button>
                      {editingPointId && (
                        <button type="button" onClick={() => { setEditingPointId(null); setNewPointId(''); setNewPointX(''); setNewPointY(''); }} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
                      )}
                    </div>
                  </form>
                </div>

                <details className="rounded-2xl border border-dark-800 bg-dark-900/30 p-4 text-xs text-dark-400">
                  <summary className="cursor-pointer font-semibold text-dark-300">How this page works</summary>
                  <ul className="mt-2 space-y-1 list-disc pl-4">
                    <li>Edits are written back to your points file automatically, keeping its format.</li>
                    <li>The Area Calculator, Plotting and CAD Import use these points straight away.</li>
                    <li>The file is watched: changes made in another program are picked up.</li>
                    <li><strong>File heading</strong> (block, quarter, place…) appears on exported PDFs.</li>
                  </ul>
                </details>
              </div>

              {/* ── Right: points table ── */}
              <div className="min-h-[420px] min-[960px]:min-h-0 rounded-2xl border border-dark-800 bg-dark-900/40 flex flex-col overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 p-3 border-b border-dark-800 flex-shrink-0">
                  <h2 className="text-sm font-bold text-dark-100 mr-1">Points <span className="text-dark-500 font-normal">({filteredIds.length}{filteredIds.length !== pointCount ? ` of ${pointCount}` : ''})</span></h2>
                  <div className="relative flex-1 min-w-[160px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
                    <input type="text" value={pointSearch} onChange={(e) => { setPointSearch(e.target.value); setPointPage(1); }} placeholder="Find a point or coordinate…"
                      className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg bg-dark-800 border border-dark-700 focus:border-primary outline-none text-dark-100" />
                    {pointSearch && <button onClick={() => setPointSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-200"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-dark-500">Sort
                    <select value={pointSort} onChange={(e) => setPointSort(e.target.value)} className="bg-dark-800 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-dark-200">
                      <option value="id">ID</option><option value="x">X</option><option value="y">Y</option>
                    </select>
                  </label>
                </div>

                <div className="flex-1 min-h-0 overflow-auto scroll-area">
                  {filteredIds.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-dark-500 py-12">
                      <Search className="w-8 h-8 text-dark-600" />
                      <span className="text-sm">{pointCount === 0 ? 'This file has no points yet. Add the first one on the left.' : 'No point matches your search.'}</span>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-dark-900 z-10 border-b border-dark-800">
                        <tr className="text-[11px] font-semibold uppercase tracking-wider text-dark-400">
                          <th className="px-4 py-2.5 w-32">ID</th>
                          <th className="px-4 py-2.5 w-44 text-right">X</th>
                          <th className="px-4 py-2.5 w-44 text-right">Y</th>
                          <th className="px-3 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-800/50 font-mono text-sm">
                        {pagePointIds.map((id) => (
                          <tr key={id} className={`hover:bg-dark-800/40 ${editingPointId === id ? 'bg-amber-950/20' : ''}`}>
                            <td className="px-4 py-1.5 font-bold text-primary">{id}</td>
                            <td className="px-4 py-1.5 text-right text-dark-100">{editingPoints[id].x.toFixed(2)}</td>
                            <td className="px-4 py-1.5 text-right text-dark-100">{editingPoints[id].y.toFixed(2)}</td>
                            <td className="px-3 py-1 text-right whitespace-nowrap">
                              <button onClick={() => handleEditPoint(id)} title="Edit this point" className="p-1.5 rounded-lg text-dark-400 hover:text-primary hover:bg-primary/10"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeletePoint(id)} title="Delete this point" className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-dark-800 text-xs text-dark-500 flex-shrink-0">
                  <span>{filteredIds.length === 0 ? '0' : `${(currentPointPage - 1) * POINTS_PER_PAGE + 1}–${Math.min(currentPointPage * POINTS_PER_PAGE, filteredIds.length)}`} of {filteredIds.length}</span>
                  {pointPageCount > 1 && (
                    <div className="flex items-center gap-2">
                      <button disabled={currentPointPage <= 1} onClick={() => setPointPage(currentPointPage - 1)} className="p-1.5 rounded-md border border-dark-800 disabled:opacity-30 hover:bg-dark-800"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="text-dark-300">Page {currentPointPage} / {pointPageCount}</span>
                      <button disabled={currentPointPage >= pointPageCount} onClick={() => setPointPage(currentPointPage + 1)} className="p-1.5 rounded-md border border-dark-800 disabled:opacity-30 hover:bg-dark-800"><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═════════ PROJECTS TAB ═════════ */}
        {activeTab === 'projects' && (
          <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-4">
            <div className="max-w-6xl mx-auto rounded-2xl border border-dark-800 bg-dark-900/40 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 p-3 border-b border-dark-800">
                <h2 className="text-sm font-bold text-dark-100 mr-auto">Saved projects <span className="text-dark-500 font-normal">({savedProjects.length})</span></h2>
                <label htmlFor="open-project" className="btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5" /> Open project file</label>
                <button onClick={() => loadSavedProjects(false)} disabled={loadingProjects} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-2"><RefreshCw className={`w-3.5 h-3.5 ${loadingProjects ? 'animate-spin' : ''}`} /> Refresh</button>
                <button onClick={handleScanComputer} disabled={loadingProjects} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-2" title="Search this computer for project files"><Search className="w-3.5 h-3.5" /> Scan computer</button>
              </div>

              {loadingProjects ? (
                <div className="text-center py-14"><RefreshCw className="w-9 h-9 mx-auto mb-3 text-primary animate-spin" /><p className="text-sm text-dark-300">Loading projects…</p></div>
              ) : savedProjects.length === 0 ? (
                <div className="text-center py-14 px-4">
                  <File className="w-14 h-14 mx-auto mb-3 text-dark-600" />
                  <h3 className="text-lg font-bold text-dark-200 mb-1">No projects found</h3>
                  <p className="text-sm text-dark-400 mb-5">Save a project from the Area Calculator, or open a <span className="font-mono">.prcl</span> file.</p>
                  <button onClick={() => navigate('/parcel-calculator')} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus className="w-4 h-4" /> Go to calculator</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead className="bg-dark-900 border-b border-dark-800">
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-dark-400">
                        <th className="px-4 py-2.5">Project</th><th className="px-4 py-2.5">Parcels</th><th className="px-4 py-2.5">Points file</th><th className="px-4 py-2.5">Last saved</th><th className="px-4 py-2.5 w-24" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800/50">
                      {savedProjects.map((project, index) => {
                        const displayPath = project.filePath && !project.filePath.includes('backend/data') ? project.filePath : project.fileName;
                        const isEmpty = project.savedParcels === 0;
                        return (
                          <tr key={index} onClick={() => handleOpenProjectFromList(project)} className="cursor-pointer hover:bg-dark-800/40 group">
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-dark-100 flex items-center gap-2">{project.projectName}{isEmpty && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-dark-700 text-dark-300 border border-dark-600">Empty</span>}</div>
                              <div className="text-[11px] text-dark-500 font-mono truncate max-w-[420px]" title={displayPath}>{displayPath}</div>
                            </td>
                            <td className={`px-4 py-3 text-sm font-mono ${isEmpty ? 'text-dark-500' : 'text-dark-200'}`}>{project.savedParcels}</td>
                            <td className="px-4 py-3 text-sm text-dark-300 truncate max-w-[200px]" title={project.pointsFile}>{project.pointsFile || '—'}</td>
                            <td className="px-4 py-3 text-xs text-dark-400 whitespace-nowrap">{new Date(project.lastModified * 1000).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-70 group-hover:opacity-100"><FolderOpen className="w-4 h-4" /> Open</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataFiles;
