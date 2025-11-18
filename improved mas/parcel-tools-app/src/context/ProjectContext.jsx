import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const ProjectContext = createContext();

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
};

export const ProjectProvider = ({ children }) => {
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
            
            // Recalculate all parcel areas using ref to get latest value
            const currentParcels = savedParcelsRef.current;
            if (currentParcels.length > 0) {
              await recalculateAllParcels(pointsObj, currentParcels);
            }
            
            alert(`🔄 Points file updated!\n\nReloaded ${result.count} points.\n${currentParcels.length} parcels recalculated.`);
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

  // Recalculate all parcel areas when points change
  const recalculateAllParcels = async (newPoints, parcelsToRecalculate) => {
    try {
      const parcels = parcelsToRecalculate || savedParcelsRef.current;
      
      const updatedParcels = await Promise.all(
        parcels.map(async (parcel) => {
          const points = parcel.ids.map(id => ({
            x: newPoints[id]?.x || 0,
            y: newPoints[id]?.y || 0
          }));

          const response = await fetch('http://localhost:5000/api/calculate-area', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points }),
          });

          if (response.ok) {
            const data = await response.json();
            return {
              ...parcel,
              area: data.area,
              perimeter: data.perimeter
            };
          }
          return parcel;
        })
      );

      setSavedParcels(updatedParcels);
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Error recalculating parcels:', error);
    }
  };

  const value = {
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
  };

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

