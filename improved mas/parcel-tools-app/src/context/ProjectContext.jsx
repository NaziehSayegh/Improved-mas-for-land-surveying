import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useToast } from './ToastContext';

const ProjectContext = createContext();

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
};

export const ProjectProvider = ({ children }) => {
  const toast = useToast();
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [pointsFileName, setPointsFileName] = useState('');
  const [pointsFilePath, setPointsFilePath] = useState('');
  const [loadedPoints, setLoadedPoints] = useState({});
  const [savedParcels, setSavedParcels] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isWatchingFile, setIsWatchingFile] = useState(false);
  const [fileHeading, setFileHeading] = useState({
    block: '',
    quarter: '',
    parcels: '',
    place: '',
    additionalInfo: ''
  });
  const [savedErrorCalculations, setSavedErrorCalculations] = useState([]);
  const [currentParcel, setCurrentParcel] = useState({
    parcelNumber: '',
    enteredIds: [],
    curves: []
  });
  const [cadFilePath, setCadFilePath] = useState('');
  const [cadFileName, setCadFileName] = useState('');
  const [cadEntities, setCadEntities] = useState([]);
  const [cadLayers, setCadLayers] = useState([]);
  const [cadVisibleLayers, setCadVisibleLayers] = useState({});

  // Refs to always have the latest CAD values in saveActiveProject callbacks
  const cadFilePathRef = useRef('');
  const cadFileNameRef = useRef('');
  const cadEntitiesRef = useRef([]);
  const cadLayersRef = useRef([]);
  const cadVisibleLayersRef = useRef({});

  // Keep refs in sync with state
  useEffect(() => { cadFilePathRef.current = cadFilePath; }, [cadFilePath]);
  useEffect(() => { cadFileNameRef.current = cadFileName; }, [cadFileName]);
  useEffect(() => { cadEntitiesRef.current = cadEntities; }, [cadEntities]);
  useEffect(() => { cadLayersRef.current = cadLayers; }, [cadLayers]);
  useEffect(() => { cadVisibleLayersRef.current = cadVisibleLayers; }, [cadVisibleLayers]);

  // Wrapper setters that update both state and ref synchronously
  const setCadFilePathSynced = React.useCallback((v) => { cadFilePathRef.current = v; setCadFilePath(v); }, []);
  const setCadFileNameSynced = React.useCallback((v) => { cadFileNameRef.current = v; setCadFileName(v); }, []);
  const setCadEntitiesSynced = React.useCallback((v) => { cadEntitiesRef.current = v; setCadEntities(v); }, []);
  const setCadLayersSynced = React.useCallback((v) => { cadLayersRef.current = v; setCadLayers(v); }, []);
  const setCadVisibleLayersSynced = React.useCallback((v) => { cadVisibleLayersRef.current = v; setCadVisibleLayers(v); }, []);

  // Use ref to access latest savedParcels without triggering re-renders
  const savedParcelsRef = useRef(savedParcels);
  useEffect(() => {
    savedParcelsRef.current = savedParcels;
  }, [savedParcels]);

  // Auto-watch points file for changes
  useEffect(() => {
    if (!pointsFilePath) {
      setIsWatchingFile(false);
      return;
    }

    // Check if file path is valid (should be an absolute path, not just filename)
    // In Electron, file.path should be available, but if not, we can't watch it
    const isValidPath = pointsFilePath && pointsFilePath.trim() !== '' &&
      (pointsFilePath.includes('\\') || pointsFilePath.includes('/') || pointsFilePath.startsWith('C:') || pointsFilePath.startsWith('/'));

    if (!isValidPath) {
      // If it's just a filename, don't start watching (file might not be accessible)
      setIsWatchingFile(false);
      return;
    }

    let watchInterval;
    let lastModified = null;
    let isReloading = false; // Prevent concurrent reloads

    const checkFileChanges = async () => {
      // Don't check if no file path or if already reloading
      if (!pointsFilePath || isReloading) return;

      try {
        const response = await fetch('http://localhost:5000/api/check-file-modified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: pointsFilePath }),
        });

        if (response.ok) {
          const data = await response.json();

          if (lastModified && data.modified > lastModified) {
            console.log('Points file changed! Reloading...');
            await reloadPointsFile();
          }

          lastModified = data.modified;
        } else if (response.status === 404) {
          // File not found - stop watching silently
          console.log('File no longer exists, stopping watch');
          if (watchInterval) {
            clearInterval(watchInterval);
          }
          setIsWatchingFile(false);
          return;
        }
      } catch (error) {
        // Silently handle errors - file might be inaccessible or backend not ready
        // Only log if it's not a network error
        if (!error.message.includes('Failed to fetch') && !error.message.includes('NetworkError')) {
          console.error('Error checking file:', error);
        }
      }
    };

    const reloadPointsFile = async () => {
      if (isReloading) return; // Prevent concurrent reloads
      isReloading = true;

      try {
        const response = await fetch('http://localhost:5000/api/reload-points-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: pointsFilePath }),
        });

        if (response.ok) {
          const result = await response.json();

          if (result.points) {
            const pointsObj = {};
            result.points.forEach(p => {
              pointsObj[p.id] = { x: p.x, y: p.y };
            });

            setLoadedPoints(pointsObj);
            toast.success(`🔄 Points file updated! Reloaded ${result.count} points.`);
          }
        }
      } catch (error) {
        console.error('Error reloading file:', error);
      } finally {
        isReloading = false;
      }
    };

    // Start watching
    watchInterval = setInterval(checkFileChanges, 2000);
    setIsWatchingFile(true);

    return () => {
      if (watchInterval) {
        clearInterval(watchInterval);
      }
      setIsWatchingFile(false);
    };
  }, [pointsFilePath]); // Removed savedParcels from dependencies to prevent infinite loop

  // Recalculate all parcel areas when points change - OPTIMIZED WITH BATCHING
  const recalculateAllParcels = React.useCallback(async (newPoints, parcelsToRecalculate) => {
    try {
      const parcels = parcelsToRecalculate || savedParcelsRef.current;

      if (parcels.length === 0) return [];

      console.time('Batch Recalculation');

      // Use the new batch endpoint to calculate all at once
      const response = await fetch('http://localhost:5000/api/calculate-batch-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcels: parcels,
          points: newPoints
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Map results back to parcels
        // We create a map for O(1) lookup
        const resultMap = new Map();
        if (data.results) {
          data.results.forEach(res => resultMap.set(res.id, res));
        }

        let hasAnyChanges = false;
        const updatedParcels = parcels.map(parcel => {
          const result = resultMap.get(parcel.id);
          if (result) {
            const areaDiff = Math.abs((parcel.area || 0) - result.area);
            const perimeterDiff = Math.abs((parcel.perimeter || 0) - result.perimeter);
            if (areaDiff > 0.0001 || perimeterDiff > 0.01) {
              hasAnyChanges = true;
            }
            return {
              ...parcel,
              area: result.area,
              perimeter: result.perimeter
            };
          }
          return parcel;
        });

        if (hasAnyChanges) {
          setSavedParcels(updatedParcels);
          setHasUnsavedChanges(true);
        }
        console.timeEnd('Batch Recalculation');
        return updatedParcels;
      }

      console.timeEnd('Batch Recalculation');
      return parcels;
    } catch (error) {
      console.error('Error recalculating parcels:', error);
      return parcelsToRecalculate || savedParcelsRef.current || [];
    }
  }, []);

  // Automatically recalculate saved parcels when loadedPoints changes
  useEffect(() => {
    const currentParcels = savedParcelsRef.current;
    if (currentParcels.length > 0 && Object.keys(loadedPoints).length > 0) {
      recalculateAllParcels(loadedPoints, currentParcels);
    }
  }, [loadedPoints, recalculateAllParcels]);

  // Unified save project function accessible globally
  const saveActiveProject = React.useCallback(async (overridePath = null, overrideParcels = null, overridePoints = null) => {
    const path = overridePath || projectPath;
    if (!path) {
      console.warn('saveActiveProject skipped: no project path set');
      return false;
    }

    try {
      const name = projectName || 'Untitled Project';
      const parcels = overrideParcels || savedParcels;
      const points = overridePoints || loadedPoints;

      const projectData = {
        projectName: name,
        pointsFileName: pointsFileName || '',
        pointsFilePath: pointsFilePath || '',
        loadedPoints: points || {},
        savedParcels: (parcels || []).map(parcel => ({
          ...parcel,
          ids: parcel.ids || [],
          area: parcel.area || 0,
          perimeter: parcel.perimeter || 0,
          curves: parcel.curves || [],
          pointCount: parcel.pointCount || (parcel.ids ? parcel.ids.length : 0),
          points: parcel.ids ? parcel.ids.map(id => ({
            id,
            x: points[id]?.x || 0,
            y: points[id]?.y || 0
          })) : []
        })),
        fileHeading: fileHeading || {
          block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
        },
        currentParcel: currentParcel || {
          parcelNumber: '', enteredIds: [], curves: []
        },
        savedErrorCalculations: savedErrorCalculations || [],
        cadFilePath: cadFilePathRef.current || '',
        cadFileName: cadFileNameRef.current || '',
        cadEntities: cadEntitiesRef.current || [],
        cadLayers: cadLayersRef.current || [],
        cadVisibleLayers: cadVisibleLayersRef.current || {},
        savedAt: new Date().toISOString(),
        isEmpty: !parcels || parcels.length === 0,
        pointsCount: Object.keys(points || {}).length,
        version: '2.0.3'
      };

      const response = await fetch('http://localhost:5000/api/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: name,
          projectData: projectData,
          filePath: path
        }),
      });

      if (response.ok) {
        setHasUnsavedChanges(false);
        console.log('✅ Synchronized project file on disk:', path);
        return true;
      }
    } catch (error) {
      console.error('saveActiveProject failed:', error);
    }
    return false;
  }, [projectPath, projectName, savedParcels, loadedPoints, pointsFileName, pointsFilePath, fileHeading, savedErrorCalculations, currentParcel, cadFilePath, cadFileName, cadEntities, cadLayers, cadVisibleLayers]);

  // Reset all project state to empty defaults — the single source of truth for teardown
  const closeProject = React.useCallback(() => {
    setProjectName('');
    setProjectPath('');
    setPointsFileName('');
    setPointsFilePath('');
    setLoadedPoints({});
    setSavedParcels([]);
    setHasUnsavedChanges(false);
    setFileHeading({ block: '', quarter: '', parcels: '', place: '', additionalInfo: '' });
    setSavedErrorCalculations([]);
    setCurrentParcel({
      parcelNumber: '',
      enteredIds: [],
      curves: []
    });
    setCadFilePath('');
    setCadFileName('');
    setCadEntities([]);
    setCadLayers([]);
    setCadVisibleLayers({});
  }, []);

  // Centralized helper to completely replace all project state with newly loaded projectData
  const loadProjectData = React.useCallback((projectData, filePath) => {
    setProjectName(projectData.projectName || '');
    if (filePath) setProjectPath(filePath);
    else if (projectData.projectPath) setProjectPath(projectData.projectPath);
    setPointsFileName(projectData.pointsFileName || '');
    setPointsFilePath(projectData.pointsFilePath || '');
    setLoadedPoints(projectData.loadedPoints || {});
    setSavedParcels(projectData.savedParcels || []);
    setFileHeading(projectData.fileHeading || { block: '', quarter: '', parcels: '', place: '', additionalInfo: '' });
    setSavedErrorCalculations(projectData.savedErrorCalculations || []);
    if (projectData.currentParcel) {
      setCurrentParcel(projectData.currentParcel);
    } else {
      setCurrentParcel({ parcelNumber: '', enteredIds: [], curves: [] });
    }
    setCadFilePathSynced(projectData.cadFilePath || '');
    setCadFileNameSynced(projectData.cadFileName || '');
    setCadEntitiesSynced(projectData.cadEntities || []);
    setCadLayersSynced(projectData.cadLayers || []);
    setCadVisibleLayersSynced(projectData.cadVisibleLayers || {});
    setHasUnsavedChanges(false);
  }, [setCadFilePathSynced, setCadFileNameSynced, setCadEntitiesSynced, setCadLayersSynced, setCadVisibleLayersSynced]);

  // Memoize context value to prevent unnecessary re-renders in consumers
  const value = React.useMemo(() => ({
    projectName,
    setProjectName,
    projectPath,
    setProjectPath,
    pointsFileName,
    setPointsFileName,
    pointsFilePath,
    setPointsFilePath,
    loadedPoints,
    setLoadedPoints,
    savedParcels,
    setSavedParcels,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    isWatchingFile,
    fileHeading,
    setFileHeading,
    savedErrorCalculations,
    setSavedErrorCalculations,
    recalculateAllParcels,
    saveActiveProject,
    closeProject,
    loadProjectData,
    currentParcel,
    setCurrentParcel,
    cadFilePath,
    setCadFilePath: setCadFilePathSynced,
    cadFileName,
    setCadFileName: setCadFileNameSynced,
    cadEntities,
    setCadEntities: setCadEntitiesSynced,
    cadLayers,
    setCadLayers: setCadLayersSynced,
    cadVisibleLayers,
    setCadVisibleLayers: setCadVisibleLayersSynced
  }), [
    projectName,
    projectPath,
    pointsFileName,
    pointsFilePath,
    loadedPoints,
    savedParcels,
    hasUnsavedChanges,
    isWatchingFile,
    fileHeading,
    savedErrorCalculations,
    closeProject,
    loadProjectData,
    currentParcel,
    cadFilePath,
    cadFileName,
    cadEntities,
    cadLayers,
    cadVisibleLayers
  ]);

  // Expose context globally for quick save utility
  useEffect(() => {
    window.__PROJECT_CONTEXT__ = value;
    return () => {
      delete window.__PROJECT_CONTEXT__;
    };
  }, [value]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

