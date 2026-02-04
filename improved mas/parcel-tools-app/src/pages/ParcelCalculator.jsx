import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Save, FileDown, Plus, Trash2, Edit, RefreshCw } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const ParcelCalculator = () => {
  const navigate = useNavigate();

  // Use shared project context
  const {
    projectName: globalProjectName,
    setProjectName: setGlobalProjectName,
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
    setSavedErrorCalculations
  } = useProject();

  // Store the last saved file path locally
  const [lastSavedPath, setLastSavedPath] = useState(projectPath || null);

  // Local state
  const [parcelNumber, setParcelNumber] = useState('');
  const [pointId, setPointId] = useState('');
  const [enteredIds, setEnteredIds] = useState([]);
  const [area, setArea] = useState(null);
  const [perimeter, setPerimeter] = useState(null);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'saved', 'all', or 'errors'

  // Error calculations state
  const [selectedParcelsForError, setSelectedParcelsForError] = useState([]); // Array of parcel IDs
  const [totalRegisteredArea, setTotalRegisteredArea] = useState(''); // Single registered area for all selected parcels
  const [errorResults, setErrorResults] = useState(null); // Single result object for all parcels
  const [curves, setCurves] = useState([]); // { from: id, to: id, M: number, sign: +1/-1 }
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [showCurvesDialog, setShowCurvesDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });
  const [tempArea, setTempArea] = useState(null);
  const [tempPerimeter, setTempPerimeter] = useState(null);
  const [curveFrom, setCurveFrom] = useState('');
  const [curveTo, setCurveTo] = useState('');
  const [curveM, setCurveM] = useState('');
  const [curveSign, setCurveSign] = useState('+');
  const [liveAreaWithCurves, setLiveAreaWithCurves] = useState(null);
  const [editingCurveIndex, setEditingCurveIndex] = useState(null); // Index of curve being edited

  // Editing saved parcel state
  const [editingParcelId, setEditingParcelId] = useState(null); // ID of parcel being edited
  const [insertPointAfterIndex, setInsertPointAfterIndex] = useState(null); // Index to insert point after
  const [editingPointIndex, setEditingPointIndex] = useState(null); // Index of point being edited

  // Duplicate parcel dialog state
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateParcel, setDuplicateParcel] = useState(null);
  const [pendingParcelNumber, setPendingParcelNumber] = useState('');

  // ESC key to go to main menu (only if no dialogs are open) or close duplicate dialog
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        // Close duplicate dialog if open
        if (showDuplicateDialog) {
          e.preventDefault();
          setShowDuplicateDialog(false);
          setDuplicateParcel(null);
          setPendingParcelNumber('');
          return;
        }
        // Only navigate if no dialogs are open
        if (!showAreaDialog && !showCurvesDialog) {
          e.preventDefault();
          navigate('/');
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate, showAreaDialog, showCurvesDialog, showDuplicateDialog]);

  // Handle window close/refresh - ask before closing with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        const message = 'You have unsaved changes. Are you sure you want to close?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Check for duplicate parcel number when parcel number changes (informational only, don't block)
  useEffect(() => {
    // Only check if parcel number is not empty, not currently editing, and user is typing (not programmatically set)
    if (parcelNumber.trim() && !editingParcelId && savedParcels.length > 0) {
      // Check if this parcel number already exists (and it's not the one we're currently editing)
      const existingParcels = savedParcels.filter(p =>
        p.number.trim().toLowerCase() === parcelNumber.trim().toLowerCase() &&
        p.id !== editingParcelId
      );

      if (existingParcels.length > 0) {
        // Use a delay to avoid showing dialog while user is still typing
        const checkTimer = setTimeout(() => {
          // Double-check the parcel number still matches
          const currentParcels = savedParcels.filter(p =>
            p.number.trim().toLowerCase() === parcelNumber.trim().toLowerCase() &&
            p.id !== editingParcelId
          );
          if (currentParcels.length > 0 && parcelNumber.trim() === currentParcels[0].number.trim() && !editingParcelId) {
            // Only show dialog if it's not already showing for this parcel number
            if (!showDuplicateDialog || pendingParcelNumber.trim().toLowerCase() !== parcelNumber.trim().toLowerCase()) {
              setDuplicateParcel(currentParcels[0]); // Show first duplicate as example
              setPendingParcelNumber(parcelNumber);
              setShowDuplicateDialog(true);
            }
          }
        }, 1000); // Wait 1 second after user stops typing

        return () => clearTimeout(checkTimer);
      } else {
        // No duplicate found, close dialog if it was open
        if (showDuplicateDialog) {
          setShowDuplicateDialog(false);
          setDuplicateParcel(null);
          setPendingParcelNumber('');
        }
      }
    } else if (!parcelNumber.trim() && showDuplicateDialog) {
      // If parcel number is cleared, close dialog
      setShowDuplicateDialog(false);
      setDuplicateParcel(null);
      setPendingParcelNumber('');
    }
  }, [parcelNumber, savedParcels, editingParcelId]);

  // Load points file
  const handleLoadFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Get full path using webkitRelativePath or FileReader
    // In Electron, file.path should be available
    const filePath = file.path || file.webkitRelativePath || file.name;

    // Reset the input so the same file can be loaded again
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const textData = e.target.result;

        const response = await fetch('http://localhost:5000/api/import-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: textData }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to import points');
        }

        const result = await response.json();

        if (result.points && result.points.length > 0) {
          // Convert array to object: { id: {x, y} }
          const pointsObj = {};
          result.points.forEach(p => {
            pointsObj[p.id] = { x: p.x, y: p.y };
          });
          setLoadedPoints(pointsObj);
          setPointsFileName(file.name);
          // Only set file path if it's a valid absolute path (for file watching)
          // In Electron, file.path should be available
          if (file.path && (file.path.includes('\\') || file.path.includes('/'))) {
            setPointsFilePath(file.path);
          } else {
            // If no valid path, set to empty string so file watching won't start
            setPointsFilePath('');
          }
          setHasUnsavedChanges(true);
          showSuccessToast(`✅ Loaded ${result.count} points from ${file.name}<br/><br/>${file.path ? '🔄 File is now being watched for changes!' : '⚠️ File watching unavailable (no file path)'}`);

          // Focus the parcel number input after file loads
          setTimeout(() => {
            const parcelInput = document.querySelector('input[placeholder="Enter parcel number"]');
            if (parcelInput) {
              parcelInput.focus();
            }
          }, 100);

          // FORCE Save As dialog if project hasn't been saved yet
          setTimeout(async () => {
            if (!lastSavedPath && !projectPath) {
              showSuccessToast('📁 Please choose where to save your project...');

              // Wait a moment for the toast to show
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Trigger Save As dialog
              const projectName = globalProjectName || 'New Project';
              const saved = await handleSaveProject(true, {
                projectNameOverride: projectName,
                skipExistingPath: true
              });

              if (saved) {
                showSuccessToast('✅ Project saved! All changes will now auto-save.');
              } else {
                showErrorToast('⚠️ Project not saved. Please save manually to enable auto-save.');
              }

              // CRITICAL: Restore focus to parcel number input after dialog
              setTimeout(() => {
                const parcelInput = document.querySelector('input[placeholder="Enter parcel number"]');
                if (parcelInput) {
                  parcelInput.focus();
                  parcelInput.select();
                }
              }, 300);
            }
          }, 1500);
        } else {
          showErrorToast('No valid points found in file');
        }
      } catch (error) {
        console.error('Error loading file:', error);
        showErrorToast(`Error loading file: ${error.message}<br/><br/>Check format (.pnt, .txt, .csv)`);
      }
    };

    reader.onerror = () => {
      console.error('FileReader error');
      showErrorToast('❌ Error reading file. Please try again.');
      event.target.value = ''; // Reset input
    };

    reader.readAsText(file);
  };

  // Helper function to show error toast
  const showErrorToast = (message) => {
    const toast = document.createElement('div');
    toast.innerHTML = message;
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
      max-width: 400px;
      line-height: 1.5;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // Helper function to show success toast
  const showSuccessToast = (message) => {
    const toast = document.createElement('div');
    toast.innerHTML = message;
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
      max-width: 400px;
      line-height: 1.5;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // Helper function to show confirmation dialog (non-blocking)
  const showConfirmDialog = (title, message) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        onConfirm: (result) => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          resolve(result);
        }
      });
    });
  };

  // Add point ID
  const handleAddPoint = () => {
    // Make sure dialogs are closed
    if (showAreaDialog || showCurvesDialog) {
      setShowAreaDialog(false);
      setShowCurvesDialog(false);
    }

    if (!pointId.trim()) return;
    if (Object.keys(loadedPoints).length === 0) {
      showErrorToast('⚠️ Load points file first!');
      // Re-focus input after error
      setTimeout(() => {
        const pointInput = document.getElementById('point-id-input');
        if (pointInput) {
          pointInput.focus();
          pointInput.select();
        }
      }, 100);
      return;
    }
    if (!loadedPoints[pointId]) {
      const availableIds = Object.keys(loadedPoints).slice(0, 20).join(', ');
      showErrorToast(`❌ Point ID "${pointId}" not found!<br/><br/>Available IDs: ${availableIds}${Object.keys(loadedPoints).length > 20 ? '...' : ''}`);
      // Clear the invalid input and re-focus
      setPointId('');
      setTimeout(() => {
        const pointInput = document.getElementById('point-id-input');
        if (pointInput) {
          pointInput.focus();
          pointInput.placeholder = 'Type point ID';
        }
      }, 100);
      return;
    }

    // If editing a point ID
    if (editingPointIndex !== null) {
      handleUpdatePointId(editingPointIndex, pointId);
      return;
    }

    // If inserting after a specific index
    if (insertPointAfterIndex !== null) {
      const newIds = [...enteredIds];
      newIds.splice(insertPointAfterIndex + 1, 0, pointId);
      setEnteredIds(newIds);
      setInsertPointAfterIndex(null);
      setPointId('');
      setArea(null); // Recalculate
      setPerimeter(null);

      // Auto-focus back to point ID input
      setTimeout(() => {
        const pointInput = document.getElementById('point-id-input');
        if (pointInput) {
          pointInput.focus();
          pointInput.placeholder = 'Type point ID';
        }
      }, 50);
      return;
    }

    // Check if polygon closed (first ID re-entered)
    if (enteredIds.length > 2 && pointId === enteredIds[0]) {
      // Close polygon and calculate
      calculateArea([...enteredIds]);
      setPointId('');
      return;
    }

    setEnteredIds([...enteredIds, pointId]);
    setPointId('');

    // Auto-focus back to point ID input for next entry
    setTimeout(() => {
      const pointInput = document.getElementById('point-id-input');
      if (pointInput) {
        pointInput.focus();
        pointInput.placeholder = 'Type point ID';
      }
    }, 50);
  };

  // Calculate area when polygon closed
  const calculateArea = async (ids) => {
    try {
      const points = ids.map(id => ({
        x: loadedPoints[id].x,
        y: loadedPoints[id].y
      }));

      const response = await fetch('http://localhost:5000/api/calculate-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });

      if (!response.ok) throw new Error('Calculation failed');

      const data = await response.json();
      setTempArea(data.area);
      setTempPerimeter(data.perimeter);
      setShowAreaDialog(true); // Show dialog to user
    } catch (error) {
      console.error('Error calculating area:', error);
      showErrorToast('Error calculating area');
    }
  };

  // User confirms area - ask about curves
  const handleConfirmArea = () => {
    setShowAreaDialog(false);
    setShowCurvesDialog(true);
  };

  // User wants to edit
  const handleEditArea = () => {
    setShowAreaDialog(false);
    setTempArea(null);
    setTempPerimeter(null);
    // Keep points so they can edit
  };

  // User done with curves - recalculate with curves and show confirmation
  const handleFinalizeCurves = async () => {
    setShowCurvesDialog(false);

    // Recalculate area WITH curves
    try {
      const pointsData = enteredIds.map((id, index) => ({
        x: loadedPoints[id].x,
        y: loadedPoints[id].y
      }));

      // Add curve indices
      const curvesWithIndices = curves.map(curve => {
        const fromIndex = enteredIds.findIndex(id => id === curve.from);
        const toIndex = enteredIds.findIndex(id => id === curve.to);
        return {
          ...curve,
          fromIndex,
          toIndex
        };
      });

      const response = await fetch('http://localhost:5000/api/calculate-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: pointsData,
          curves: curvesWithIndices
        }),
      });

      if (!response.ok) throw new Error('Calculation failed');

      const data = await response.json();

      const finalCalculatedArea = data.area;
      const finalPerimeter = data.perimeter;

      // Show final confirmation
      const curveAdjText = data.curveAdjustment !== 0
        ? `\nCurve Adjustment: ${data.curveAdjustment > 0 ? '+' : ''}${data.curveAdjustment.toFixed(4)} m²`
        : '';

      const confirmed = await showConfirmDialog(
        `✅ Area Calculated with ${curves.length} Curve(s)!`,
        `Base Area: ${data.baseArea.toFixed(4)} m²${curveAdjText.replace(/\\n/g, '<br/>')}<br/>━━━━━━━━━━━━━━━━━━━━━━<br/>Final Area: ${finalCalculatedArea.toFixed(4)} m²<br/><br/>Is this correct?<br/><br/>OK = Save Parcel | Cancel = Go Back to Edit`
      );

      if (confirmed) {
        // User confirmed - save parcel with CURVE-ADJUSTED AREA
        setShowCurvesDialog(false);
        autoSaveCurrentParcelWithArea(finalCalculatedArea, finalPerimeter);
      } else {
        // User wants to edit - keep dialog open with current values
        setTempArea(finalCalculatedArea);
        setTempPerimeter(finalPerimeter);
        // Dialog stays open
      }
    } catch (error) {
      console.error('Error calculating with curves:', error);
      showErrorToast('❌ Error calculating area with curves');
    }
  };

  // Recalculate area when curves change
  useEffect(() => {
    if (showCurvesDialog && curves.length > 0) {
      calculateAreaWithCurves();
    } else {
      setLiveAreaWithCurves(tempArea);
    }
  }, [curves, showCurvesDialog]);

  // Calculate area with current curves
  const calculateAreaWithCurves = async () => {
    try {
      const pointsData = enteredIds.map((id) => ({
        x: loadedPoints[id].x,
        y: loadedPoints[id].y
      }));

      const curvesWithIndices = curves.map(curve => {
        const fromIndex = enteredIds.findIndex(id => id === curve.from);
        const toIndex = enteredIds.findIndex(id => id === curve.to);
        return {
          ...curve,
          fromIndex,
          toIndex
        };
      });

      const response = await fetch('http://localhost:5000/api/calculate-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: pointsData,
          curves: curvesWithIndices
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLiveAreaWithCurves(data.area);
      }
    } catch (error) {
      console.error('Error calculating with curves:', error);
    }
  };

  // Add curve
  const handleAddCurve = () => {
    if (!curveFrom || !curveTo || !curveM) {
      showErrorToast('Fill all curve fields!');
      return;
    }

    // If editing, update instead
    if (editingCurveIndex !== null) {
      handleUpdateCurve();
      return;
    }

    const newCurve = {
      from: curveFrom,
      to: curveTo,
      M: parseFloat(curveM),
      sign: curveSign === '+' ? 1 : -1
    };

    setCurves([...curves, newCurve]);
    setCurveFrom('');
    setCurveTo('');
    setCurveM('');

    // Auto-focus back to "From" for rapid entry
    setTimeout(() => {
      const fromInput = document.getElementById('curve-from');
      if (fromInput) fromInput.focus();
    }, 50);
  };

  // Start editing a curve
  const handleStartEditCurve = (index) => {
    const curve = curves[index];
    setCurveFrom(curve.from);
    setCurveTo(curve.to);
    setCurveM(curve.M.toString());
    setCurveSign(curve.sign === 1 ? '+' : '-');
    setEditingCurveIndex(index);

    // Focus "From" input
    setTimeout(() => {
      const fromInput = document.getElementById('curve-from');
      if (fromInput) {
        fromInput.focus();
        fromInput.select();
      }
    }, 50);
  };

  // Update existing curve
  const handleUpdateCurve = () => {
    if (editingCurveIndex === null) return;

    if (!curveFrom || !curveTo || !curveM) {
      showErrorToast('Fill all curve fields!');
      return;
    }

    const updatedCurves = [...curves];
    updatedCurves[editingCurveIndex] = {
      from: curveFrom,
      to: curveTo,
      M: parseFloat(curveM),
      sign: curveSign === '+' ? 1 : -1
    };

    setCurves(updatedCurves);
    handleCancelEdit(); // Reset form
    showSuccessToast('✅ Curve updated');
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingCurveIndex(null);
    setCurveFrom('');
    setCurveTo('');
    setCurveM('');
    setCurveSign('+');
  };

  // Handle Enter key navigation
  const handleCurveInputKeyDown = (e, nextFieldId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldId) {
        const nextInput = document.getElementById(nextFieldId);
        if (nextInput) {
          nextInput.focus();
          if (nextInput.select) nextInput.select();
        }
      } else {
        // If no next field, it means we are submitting (M input)
        handleAddCurve();
      }
    }
  };

  const handleSkipCurves = async () => {
    // Show final confirmation
    const confirmed = await showConfirmDialog(
      '✅ Area Without Curves',
      `Final Area: ${tempArea.toFixed(4)} m²<br/>Perimeter: ${tempPerimeter.toFixed(4)} m<br/>Points: ${enteredIds.length}<br/><br/>Is this correct?<br/><br/>OK = Save Parcel | Cancel = Go Back to Edit`
    );

    if (confirmed) {
      // User confirmed - auto-save and close dialog
      setShowCurvesDialog(false);
      autoSaveCurrentParcelWithArea(tempArea, tempPerimeter);
    }
    // If user cancels, dialog stays open (no need to reopen)
  };

  // Auto-save current parcel with specific area value
  const autoSaveCurrentParcelWithArea = (finalArea, finalPerimeter) => {
    if (!parcelNumber.trim()) {
      showErrorToast('⚠️ Enter a parcel number first!');
      return;
    }
    if (enteredIds.length < 3) {
      showErrorToast('⚠️ Need at least 3 points!');
      return;
    }

    const currentParcelNum = parcelNumber; // Save before resetting

    // Check if we are updating an existing parcel
    if (editingParcelId) {
      const updatedParcels = savedParcels.map(p => {
        if (p.id === editingParcelId) {
          return {
            ...p,
            number: currentParcelNum,
            ids: [...enteredIds],
            area: finalArea,
            perimeter: finalPerimeter,
            curves: [...curves],
            pointCount: enteredIds.length
          };
        }
        return p;
      });

      setSavedParcels(updatedParcels);
      setHasUnsavedChanges(true);

      // Show update toast
      const toast = document.createElement('div');
      toast.innerHTML = `✅ Updated Parcel #${currentParcelNum}! 💾`;
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

      // Clear editing state
      setEditingParcelId(null);
    } else {
      // Create NEW parcel
      const parcel = {
        id: Date.now(),
        number: currentParcelNum,
        ids: [...enteredIds],
        area: finalArea,  // Use the FINAL calculated area (with curves!)
        perimeter: finalPerimeter,
        curves: [...curves],
        pointCount: enteredIds.length
      };

      setSavedParcels([...savedParcels, parcel]);
      setHasUnsavedChanges(true);

      // Show save toast
      const toast = document.createElement('div');
      const saveText = (lastSavedPath || projectPath) ? '💾 Auto-saving...' : '⚠️ Please Save Project!';
      toast.innerHTML = `✅ Parcel ${currentParcelNum} saved! ${saveText}`;
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
    }

    // Close all dialogs first
    setShowAreaDialog(false);
    setShowCurvesDialog(false);

    // Reset ALL state for next parcel
    setParcelNumber('');
    setPointId(''); // Clear point ID input
    setEnteredIds([]);
    setArea(null);
    setPerimeter(null);
    setCurves([]);
    setTempArea(null);
    setTempPerimeter(null);
    setLiveAreaWithCurves(null);

    // Reset curve form fields
    setCurveFrom('');
    setCurveTo('');
    setCurveM('');
    setCurveSign('+');

    // Re-focus to parcel number input (no alert blocking!)
    setTimeout(() => {
      const parcelInput = document.querySelector('input[placeholder="Enter parcel number"]');
      if (parcelInput) {
        parcelInput.focus();
        parcelInput.select();
      }
    }, 200);
  };

  // Save parcel
  const handleSaveParcel = () => {
    if (!parcelNumber.trim()) {
      showErrorToast('⚠️ Enter parcel number!');
      return;
    }
    if (enteredIds.length < 3) {
      showErrorToast('⚠️ Need at least 3 points!');
      return;
    }
    if (!area) {
      showErrorToast('⚠️ Calculate area first (close polygon by re-entering first ID)');
      return;
    }

    const parcel = {
      id: Date.now(),
      number: parcelNumber,
      ids: [...enteredIds],
      area: area,
      perimeter: perimeter,
      curves: [...curves],
      pointCount: enteredIds.length
    };

    setSavedParcels([...savedParcels, parcel]);
    setHasUnsavedChanges(true);

    // Reset for next parcel
    setParcelNumber('');
    setEnteredIds([]);
    setArea(null);
    setPerimeter(null);
    setCurves([]);

    const saveText = (lastSavedPath || projectPath) ? '💾 Auto-saving project...' : '⚠️ Please Save Project!';
    showSuccessToast(`✅ Saved parcel ${parcel.number}<br/><br/>${saveText}`);

    // Focus parcel number input for next entry
    setTimeout(() => {
      const parcelInput = document.querySelector('input[placeholder="Enter parcel number"]');
      if (parcelInput) {
        parcelInput.focus();
      }
    }, 100);
  };

  // Delete last point
  const handleUndo = () => {
    if (enteredIds.length > 0) {
      setEnteredIds(enteredIds.slice(0, -1));
      setArea(null);
      setPerimeter(null);
    }
  };

  // Reset all
  const handleReset = async () => {
    const result = await showConfirmDialog('Reset all entered points?', 'This will clear all points, area, and curves for the current parcel.');
    if (result) {
      setEnteredIds([]);
      setArea(null);
      setPerimeter(null);
      setCurves([]);
      setParcelNumber('');
      showSuccessToast('✅ Points reset');
    }
  };

  // Delete point at index
  const handleDeletePoint = (index) => {
    const newIds = enteredIds.filter((_, i) => i !== index);
    setEnteredIds(newIds);
    setArea(null);
    setPerimeter(null);
  };

  // Load saved parcel for editing
  // Load saved parcel for editing
  const handleLoadSavedParcel = async (parcel) => {
    setParcelNumber(parcel.number);
    setEnteredIds([...parcel.ids]);
    setCurves([...parcel.curves]);
    setArea(parcel.area);
    setPerimeter(parcel.perimeter);
    setEditingParcelId(parcel.id); // Track which parcel we're editing
    setActiveTab('editor');
    // Close duplicate dialog if open
    setShowDuplicateDialog(false);
    setDuplicateParcel(null);
    setPendingParcelNumber('');

    // Calculate base area (without curves) so we can edit curves correctly
    try {
      // We need loadedPoints to be available
      if (loadedPoints && parcel.ids.length > 0) {
        const pointsData = parcel.ids.map(id => {
          if (!loadedPoints[id]) return { x: 0, y: 0 };
          return {
            x: loadedPoints[id].x,
            y: loadedPoints[id].y
          };
        });

        const response = await fetch('http://localhost:5000/api/calculate-area', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: pointsData
            // No curves sent = base area
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setTempArea(data.area);
          setTempPerimeter(data.perimeter);
          console.log('Calculated base area for editing:', data.area);
        }
      }
    } catch (error) {
      console.error('Error calculating base area for editing:', error);
    }
  };

  // Handle duplicate parcel dialog - Replace option
  const handleReplaceDuplicate = () => {
    if (duplicateParcel) {
      // Load the existing parcel for editing
      handleLoadSavedParcel(duplicateParcel);
      // Close dialog
      setShowDuplicateDialog(false);
      setDuplicateParcel(null);
      setPendingParcelNumber('');

      // Show toast notification
      const toast = document.createElement('div');
      toast.innerHTML = `📝 Loaded parcel "${duplicateParcel.number}" for editing`;
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1f6feb;
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
    }
  };

  // Handle duplicate parcel dialog - Create New option
  const handleCreateNewDuplicate = () => {
    // Allow duplicate parcel number - just close the dialog and let user continue
    setShowDuplicateDialog(false);
    setDuplicateParcel(null);
    setPendingParcelNumber('');

    // Show info toast that duplicate will be saved separately
    const toast = document.createElement('div');
    toast.innerHTML = `✅ Duplicate allowed! This parcel will be saved separately.<br/>Check "All Parcels" tab to see all versions.`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      right: auto;
      text-align: center;
      background: #1f6feb;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      animation: slideIn 0.3s ease-out;
      max-width: 400px;
      line-height: 1.5;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);

    // Keep the parcel number as is, user can continue
    // Re-focus the input to ensure it's not stuck
    setTimeout(() => {
      const parcelInput = document.querySelector('input[placeholder="Enter parcel number"]');
      if (parcelInput) {
        parcelInput.focus();
        parcelInput.select();
      }
    }, 100);
  };

  // Handle duplicate parcel dialog - Cancel option
  const handleCancelDuplicate = () => {
    // Clear the parcel number and close dialog
    setParcelNumber('');
    setShowDuplicateDialog(false);
    setDuplicateParcel(null);
    setPendingParcelNumber('');

    // Re-focus the input
    setTimeout(() => {
      const parcelInput = document.querySelector('input[placeholder="Enter parcel number"]');
      if (parcelInput) {
        parcelInput.focus();
      }
    }, 100);
  };

  // Insert point between two points (in editor mode)
  const handleInsertPointAt = (afterIndex) => {
    if (afterIndex === null || afterIndex < 0 || afterIndex >= enteredIds.length) return;

    setInsertPointAfterIndex(afterIndex);
    setPointId(''); // Clear point ID input
    // Focus on point ID input
    setTimeout(() => {
      const pointInput = document.getElementById('point-id-input');
      if (pointInput) {
        pointInput.focus();
        pointInput.placeholder = `Insert point after ${enteredIds[afterIndex]}`;
      }
    }, 100);
  };

  // Insert point in saved parcel
  const handleInsertPointInSavedParcel = (parcel, afterIndex) => {
    // Load parcel into editor
    handleLoadSavedParcel(parcel);
    setInsertPointAfterIndex(afterIndex);
    setPointId('');
    setTimeout(() => {
      const pointInput = document.getElementById('point-id-input');
      if (pointInput) {
        pointInput.focus();
        pointInput.placeholder = `Insert point after ${parcel.ids[afterIndex]}`;
      }
    }, 100);
  };

  // Edit point ID in saved parcel
  const handleEditPointIdInSavedParcel = (parcel, pointIndex) => {
    // Load parcel into editor
    handleLoadSavedParcel(parcel);
    setEditingPointIndex(pointIndex);
    setPointId(parcel.ids[pointIndex]);
    setTimeout(() => {
      const pointInput = document.getElementById('point-id-input');
      if (pointInput) {
        pointInput.focus();
        pointInput.select();
        pointInput.placeholder = `Edit point ${parcel.ids[pointIndex]}`;
      }
    }, 100);
  };

  // Update point ID in place
  const handleUpdatePointId = (index, newId) => {
    if (!newId || !loadedPoints[newId]) {
      showErrorToast(`❌ Point ID "${newId}" not found in loaded points!`);
      // Clear the invalid input and re-focus
      setPointId('');
      setTimeout(() => {
        const pointInput = document.getElementById('point-id-input');
        if (pointInput) {
          pointInput.focus();
          pointInput.placeholder = 'Type point ID';
        }
      }, 100);
      return;
    }

    const newIds = [...enteredIds];
    newIds[index] = newId;
    setEnteredIds(newIds);
    setEditingPointIndex(null);
    setPointId('');
    setArea(null); // Recalculate area
    setPerimeter(null);

    // Re-focus input after successful update
    setTimeout(() => {
      const pointInput = document.getElementById('point-id-input');
      if (pointInput) {
        pointInput.focus();
        pointInput.placeholder = 'Type point ID';
      }
    }, 50);
  };

  // Update saved parcel with current editor state
  const handleUpdateSavedParcel = async () => {
    if (!editingParcelId) {
      showErrorToast('⚠️ No parcel selected for editing!');
      return;
    }

    if (enteredIds.length < 3) {
      showErrorToast('⚠️ Need at least 3 points!');
      return;
    }

    // Recalculate area if polygon is closed
    let finalArea = area;
    let finalPerimeter = perimeter;

    if (enteredIds.length >= 3) {
      try {
        const pointsData = enteredIds.map(id => ({
          x: loadedPoints[id].x,
          y: loadedPoints[id].y
        }));

        // Add curve indices
        const curvesWithIndices = curves.map(curve => {
          const fromIndex = enteredIds.findIndex(id => id === curve.from);
          const toIndex = enteredIds.findIndex(id => id === curve.to);
          return {
            ...curve,
            fromIndex,
            toIndex
          };
        });

        const response = await fetch('http://localhost:5000/api/calculate-area', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: pointsData,
            curves: curvesWithIndices
          }),
        });

        if (response.ok) {
          const data = await response.json();
          finalArea = data.area;
          finalPerimeter = data.perimeter;
        }
      } catch (error) {
        console.error('Error recalculating area:', error);
      }
    }

    // Update the saved parcel
    const updatedParcels = savedParcels.map(p => {
      if (p.id === editingParcelId) {
        return {
          ...p,
          number: parcelNumber,
          ids: [...enteredIds],
          area: finalArea || p.area,
          perimeter: finalPerimeter || p.perimeter,
          curves: [...curves],
          pointCount: enteredIds.length
        };
      }
      return p;
    });

    setSavedParcels(updatedParcels);
    setHasUnsavedChanges(true);
    setEditingParcelId(null);
    setInsertPointAfterIndex(null);
    setEditingPointIndex(null);
    setArea(finalArea);
    setPerimeter(finalPerimeter);

    // Show success toast
    const toast = document.createElement('div');
    const saveText = (lastSavedPath || projectPath) ? '💾 Auto-saving...' : '⚠️ Remember to save!';
    toast.innerHTML = `✅ Parcel ${parcelNumber} updated! ${saveText}`;
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
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // Delete saved parcel
  const handleDeleteSaved = async (id) => {
    const confirmed = await showConfirmDialog(
      'Delete this parcel?',
      'This action cannot be undone. The parcel will be permanently removed.'
    );

    if (confirmed) {
      setSavedParcels(savedParcels.filter(p => p.id !== id));
      setHasUnsavedChanges(true);
      showSuccessToast('✅ Parcel deleted');
    }
  };

  const buildProjectDataPayload = (projectNameValue) => {
    const effectiveName = projectNameValue || globalProjectName || 'Untitled Project';
    return {
      projectName: effectiveName,
      pointsFileName: pointsFileName || '',
      pointsFilePath: pointsFilePath || '',
      loadedPoints: loadedPoints || {},
      savedParcels: (savedParcels || []).map(parcel => ({
        ...parcel,
        ids: parcel.ids || [],
        area: parcel.area || 0,
        perimeter: parcel.perimeter || 0,
        curves: parcel.curves || [],
        pointCount: parcel.pointCount || (parcel.ids ? parcel.ids.length : 0),
        points: parcel.ids ? parcel.ids.map(id => ({
          id,
          x: loadedPoints[id]?.x || 0,
          y: loadedPoints[id]?.y || 0
        })) : []
      })),
      fileHeading: fileHeading || {
        block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
      },
      currentParcel: {
        parcelNumber: parcelNumber || '',
        enteredIds: enteredIds || [],
        curves: curves || []
      },
      savedErrorCalculations: savedErrorCalculations || [],
      savedAt: new Date().toISOString(),
      // Add metadata to indicate if project is empty
      isEmpty: !savedParcels || savedParcels.length === 0,
      pointsCount: Object.keys(loadedPoints || {}).length
    };
  };

  // Save project (manual save or first-time save)
  const handleSaveProject = async (forceSaveAs = false, options = {}) => {
    const {
      projectNameOverride,
      preferredPath,
      skipExistingPath = false
    } = options;

    try {
      let savePath = typeof preferredPath === 'string'
        ? preferredPath
        : (skipExistingPath ? null : (lastSavedPath || projectPath || null));
      let projectName = projectNameOverride ?? globalProjectName ?? 'Untitled Project';

      // ALWAYS show dialog if: user clicked "Save As", OR no saved path exists
      // Never save to app directory - user must always pick a location
      const shouldShowDialog = forceSaveAs || !savePath;

      if (shouldShowDialog) {
        // Check if Electron API is available
        // Try multiple ways to access it (sometimes it takes a moment to load)
        let electronAPI = null;

        // Check if available immediately
        if (window.electronAPI && typeof window.electronAPI.showSaveDialog === 'function') {
          electronAPI = window.electronAPI;
        } else {
          // Wait longer for preload script to load (up to 2 seconds)
          for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (window.electronAPI && typeof window.electronAPI.showSaveDialog === 'function') {
              electronAPI = window.electronAPI;
              console.log('Electron API found after', (i + 1) * 100, 'ms');
              break;
            }
          }
        }

        if (!electronAPI || typeof electronAPI.showSaveDialog !== 'function') {
          // Electron dialog not available - provide helpful error message
          console.error('Electron API not available:', {
            hasWindow: typeof window !== 'undefined',
            hasElectronAPI: !!window.electronAPI,
            electronAPIType: typeof window.electronAPI,
            hasShowSaveDialog: !!(window.electronAPI && window.electronAPI.showSaveDialog),
            showSaveDialogType: window.electronAPI ? typeof window.electronAPI.showSaveDialog : 'N/A'
          });
          showErrorToast('❌ Save dialog not available. Please ensure you are running the app in Electron.');
          return false; // Don't save to wrong location
        } else {
          // Use Electron dialog - suggest Desktop or Documents, not backend folder
          // Generate a good default name based on project state
          let defaultName = projectName;
          if (!defaultName || defaultName === 'Untitled Project') {
            // Generate name based on content or date
            const hasData = savedParcels?.length > 0 || Object.keys(loadedPoints || {}).length > 0;
            if (hasData) {
              const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
              defaultName = `Project_${timestamp}`;
            } else {
              defaultName = 'New_Project';
            }
          }

          // Try to get user's home directory for better default location
          let defaultDir = '';
          try {
            // Use last saved path directory, or suggest Desktop/Documents
            if (savePath && savePath.includes('/') || savePath.includes('\\')) {
              const pathSep = savePath.includes('/') ? '/' : '\\';
              const parts = savePath.split(pathSep);
              parts.pop(); // Remove filename
              defaultDir = parts.join(pathSep) + pathSep;
            }
          } catch (e) {
            // Fallback to just filename in current directory
          }

          const defaultPath = defaultDir ? `${defaultDir}${defaultName}.prcl` : `${defaultName}.prcl`;

          const dialogResult = await electronAPI.showSaveDialog({
            title: 'Save Project As',
            defaultPath: defaultPath,
            filters: [
              { name: 'Project Files', extensions: ['prcl'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          });

          if (dialogResult.canceled) {
            return false; // User cancelled
          }

          if (dialogResult.error) {
            showErrorToast('❌ Error opening save dialog: ' + dialogResult.error);
            return false;
          }

          savePath = dialogResult.filePath;
          // Ensure .prcl extension
          if (!savePath.toLowerCase().endsWith('.prcl')) {
            savePath += '.prcl';
          }
          // Extract project name from file path
          const pathParts = savePath.split(/[/\\]/);
          const fileName = pathParts[pathParts.length - 1];
          projectName = fileName.replace('.prcl', '');
          setGlobalProjectName(projectName);
          // Remember this path for future saves
          setLastSavedPath(savePath);
          setProjectPath(savePath);
        }
      }

      // If we still don't have a path after dialog, we can't save
      if (!savePath) {
        showErrorToast('❌ Cannot save: No file location selected. Please choose a save location.');
        return false;
      }

      const projectData = buildProjectDataPayload(projectName);

      const response = await fetch('http://localhost:5000/api/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: projectName,
          projectData: projectData,
          filePath: savePath // Include custom path if from Save As dialog
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Save failed');
      }

      const result = await response.json();

      // Remember the save path for future "Save Now" operations
      if (result.filePath) {
        setLastSavedPath(result.filePath);
        setProjectPath(result.filePath);
      }

      setHasUnsavedChanges(false);

      // Show non-blocking toast notification
      const location = result.filePath || savePath || result.fileName;
      const parcelCount = savedParcels?.length || 0;
      const pointsCount = Object.keys(loadedPoints || {}).length;
      const isEmptyProject = parcelCount === 0 && pointsCount === 0;

      const toast = document.createElement('div');
      toast.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">✅ Project "${projectName}" saved!</div>
        <div style="font-size: 12px; opacity: 0.9;">
          <div>File: ${result.fileName}</div>
          <div style="margin-top: 4px;">Location: ${location}</div>
          <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
            ${isEmptyProject
          ? '📝 Empty project saved - ready for data!'
          : `💾 Saved: ${parcelCount} Parcel(s) | ${pointsCount} Point(s)`
        }
          </div>
        </div>
      `;
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        right: auto;
        text-align: center;
        background: #238636;
        color: white;
        padding: 20px 24px;
        border-radius: 12px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }, 5000);

      console.log(`✅ Project "${projectName}" saved to: ${location}`);
      return true;
    } catch (error) {
      console.error('Error saving project:', error);

      // Show error toast instead of blocking alert
      const errorToast = document.createElement('div');
      errorToast.innerHTML = `❌ Error saving project: ${error.message}`;
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
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(errorToast);

      setTimeout(() => {
        errorToast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => errorToast.remove(), 300);
      }, 4000);
      return false;
    }
  };

  // Smart Save handler - tries to auto-save to derived path, falls back to Save As
  const handleSmartSave = async () => {
    // If we already have a save path, regular save
    if (lastSavedPath || projectPath) {
      handleSaveProject(false);
      return;
    }

    // If we have a points file path, try to derive project path from it
    if (pointsFilePath) {
      let newPath = pointsFilePath;
      // Replace file extension
      const lastDot = newPath.lastIndexOf('.');
      if (lastDot > 0) {
        newPath = newPath.substring(0, lastDot) + '.prcl';
      } else {
        newPath = newPath + '.prcl';
      }

      console.log('[Smart Save] Auto-deriving path:', newPath);

      // Try to save to this path immediately (skip dialog)
      const success = await handleSaveProject(false, {
        preferredPath: newPath,
        projectNameOverride: globalProjectName || pointsFileName?.replace(/\.[^/.]+$/, "") || 'New Project'
      });

      if (success) {
        return;
      }
    }

    // Fallback to Save As dialog
    console.log('[Smart Save] Fallback to Save As dialog');
    handleSaveAs();
  };

  // Save As handler (Explicit)
  const handleSaveAs = async () => {
    // First, check if API is available and log detailed info
    console.log('[Save As] Button clicked');
    if (typeof window !== 'undefined' && window.electronAPI) {
      // API check passed
    } else {
      console.error('[Save As] ❌ Electron API not available!');
    }

    try {
      await handleSaveProject(true);
    } catch (error) {
      console.error('Error in Save As:', error);
      showErrorToast(`❌ Error saving project: ${error.message}`);
    }
  };

  // Load project
  const handleLoadProject = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Get the file path if available (Electron provides this)
    const filePath = file.path || null;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileContent = e.target.result;

        const response = await fetch('http://localhost:5000/api/project/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileContent, filePath: filePath }),
        });

        if (!response.ok) throw new Error('Load failed');

        const result = await response.json();
        const projectData = result.projectData;

        // IMPORTANT: Clear ALL current state FIRST to ensure complete isolation
        setGlobalProjectName('');
        setPointsFileName('');
        setPointsFilePath('');
        setLoadedPoints({});
        setSavedParcels([]);
        setFileHeading({
          block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
        });
        setSavedErrorCalculations([]);
        setParcelNumber('');
        setEnteredIds([]);
        setArea(null);
        setPerimeter(null);
        setCurves([]);
        setHasUnsavedChanges(false);

        // Now load the NEW project's data - completely replace everything
        setGlobalProjectName(projectData.projectName || '');
        // Remember the file path for future saves
        if (filePath) {
          setLastSavedPath(filePath);
          setProjectPath(filePath);
        }
        setPointsFileName(projectData.pointsFileName || '');
        setPointsFilePath(projectData.pointsFilePath || '');
        setLoadedPoints(projectData.loadedPoints || {});
        setSavedParcels(projectData.savedParcels || []);
        setFileHeading(projectData.fileHeading || {
          block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
        });
        setSavedErrorCalculations(projectData.savedErrorCalculations || []);

        // Load current parcel state if it exists
        if (projectData.currentParcel) {
          setParcelNumber(projectData.currentParcel.parcelNumber || '');
          setEnteredIds(projectData.currentParcel.enteredIds || []);
          setCurves(projectData.currentParcel.curves || []);
        } else {
          // Clear current parcel if not in project
          setParcelNumber('');
          setEnteredIds([]);
          setCurves([]);
        }

        setHasUnsavedChanges(false);

        showSuccessToast(`✅ Project "${projectData.projectName}" loaded successfully!<br/><br/>Parcels: ${projectData.savedParcels?.length || 0}<br/>Points: ${Object.keys(projectData.loadedPoints || {}).length}<br/><br/>🔄 Points file is being watched for changes!`);

        // Focus the parcel number input after project loads
        setTimeout(() => {
          const parcelInput = document.querySelector('input[placeholder="Enter parcel number"]');
          if (parcelInput) {
            parcelInput.focus();
            parcelInput.select(); // Also select the text for immediate typing
          }
        }, 500); // Increased timeout to ensure DOM is ready
      } catch (error) {
        console.error('Error loading project:', error);
        showErrorToast('Error loading project. Check file format.');
      }
    };
    reader.readAsText(file);
  };

  // New project
  const handleNewProject = async () => {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Create new project?')) {
      return false;
    }

    // Reset project state
    setPointsFilePath('');
    setPointsFileName('');
    setLoadedPoints({});
    setParcelNumber('');
    setEnteredIds([]);
    setArea(null);
    setPerimeter(null);
    setSavedParcels([]);
    setCurves([]);
    setFileHeading({
      block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
    });
    setSavedErrorCalculations([]);
    setProjectPath('');
    setLastSavedPath(null);

    // Ask user for project name before saving
    const defaultSuggestion = globalProjectName
      ? `${globalProjectName}-copy`
      : 'New Project';
    const nameInput = prompt('Name your new project:', defaultSuggestion) ?? '';
    const sanitizedName = nameInput.trim() || 'Untitled Project';

    setGlobalProjectName(sanitizedName);
    setHasUnsavedChanges(true);

    const saved = await handleSaveProject(true, {
      projectNameOverride: sanitizedName,
      skipExistingPath: true
    });

    if (saved) {
      showSuccessToast(`✅ New project "${sanitizedName}" created and saved!`);
    } else {
      showSuccessToast('✅ New project created. Remember to choose Save when you are ready.');
    }

    return saved;
  };

  // Close/Exit project - clears everything but STAYS on the page (doesn't navigate)
  const handleCloseProject = async () => {
    const currentProjectPath = lastSavedPath || projectPath;

    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      const result = await showUnsavedChangesDialog(
        globalProjectName
          ? `Save changes to "${globalProjectName}"?`
          : 'Save changes before closing project?'
      );

      if (result === 'save') {
        try {
          // If we have a path, save to it; otherwise show Save As
          const saved = await handleSaveProject(!currentProjectPath);
          if (!saved) {
            // User cancelled save dialog - don't close
            return;
          }
        } catch (error) {
          console.log('Save cancelled or failed');
          return; // Don't close if save was cancelled or failed
        }
      } else if (result === 'cancel') {
        // User cancelled - don't close
        return;
      }
      // If discard, continue to close
    } else if (currentProjectPath && globalProjectName) {
      // No unsaved changes but has a path - quick auto-save
      try {
        const projectData = buildProjectDataPayload(globalProjectName);
        await fetch('http://localhost:5000/api/project/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: globalProjectName,
            projectData: projectData,
            filePath: currentProjectPath
          }),
        });
      } catch (saveError) {
        console.error('Error auto-saving:', saveError);
      }
    }

    // Clear all project data but STAY on the calculator page
    // Clear pointsFilePath FIRST to stop file watching, then clear everything else
    setPointsFilePath('');
    setPointsFileName('');
    setLoadedPoints({});
    setParcelNumber('');
    setEnteredIds([]);
    setArea(null);
    setPerimeter(null);
    setSavedParcels([]);
    setCurves([]);
    setFileHeading({
      block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
    });
    setSavedErrorCalculations([]);
    setHasUnsavedChanges(false);
    setLastSavedPath(null);
    setProjectPath('');

    // Clear project name LAST, after everything else is cleared
    setTimeout(() => {
      setGlobalProjectName('');
      // Show confirmation
      showSuccessToast('✅ Project closed. You can now start a new project or load an existing one.');
    }, 100);
  };

  // Helper function to show unsaved changes dialog (same as in hook)
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
        max-width: min(500px, 90vw);
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        margin: 16px;
      `;

      dialog.innerHTML = `
        <h2 style="color: #c9d1d9; font-size: 20px; font-weight: bold; margin-bottom: 12px;">
          💾 Save Project
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

  // Auto-save project when data changes
  useEffect(() => {
    if (!globalProjectName) return;
    if (!hasUnsavedChanges) return;

    // Auto-save after 2 seconds of inactivity
    const autoSaveTimer = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    return () => clearTimeout(autoSaveTimer);
  }, [
    globalProjectName,
    hasUnsavedChanges,
    savedParcels,
    loadedPoints,
    enteredIds,
    parcelNumber,
    curves,
    fileHeading,
    pointsFileName,
    pointsFilePath,
    projectPath,
    lastSavedPath
  ]);

  // Auto-save function
  const handleAutoSave = async () => {
    if (!globalProjectName) return;

    const targetPath = lastSavedPath || projectPath;
    if (!targetPath) {
      console.warn('Auto-save skipped: no saved location yet.');
      return;
    }

    try {
      const projectData = buildProjectDataPayload(globalProjectName);

      const response = await fetch('http://localhost:5000/api/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: globalProjectName,
          projectData: projectData,
          filePath: targetPath
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.filePath) {
          setLastSavedPath(result.filePath);
          setProjectPath(result.filePath);
        }
        setHasUnsavedChanges(false);
        console.log('✅ Auto-saved project:', globalProjectName);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Calculate error for selected parcels using the correct surveying formula
  // Formula: Permissible Error = 0.8 * sqrt(Registered Area) + 0.002 * Registered Area
  const handleCalculateErrors = () => {
    if (selectedParcelsForError.length === 0) {
      showErrorToast('⚠️ Please select at least one parcel!');
      return;
    }

    const registeredAreaNum = parseFloat(totalRegisteredArea);
    if (!registeredAreaNum || registeredAreaNum <= 0) {
      showErrorToast('⚠️ Please enter the total registered area!');
      return;
    }

    // Calculate total calculated area from all selected parcels
    let totalCalculatedArea = 0;
    const parcelData = [];

    for (const parcelId of selectedParcelsForError) {
      const parcel = savedParcels.find(p => p.id === parcelId);
      if (!parcel) continue;

      totalCalculatedArea += parcel.area;
      parcelData.push({
        parcelId,
        parcel
      });
    }

    if (parcelData.length === 0) {
      showErrorToast('⚠️ No valid parcels selected!');
      return;
    }

    // Calculate absolute difference and permissible error using the correct formula
    const absoluteDifference = Math.abs(totalCalculatedArea - registeredAreaNum);
    const permissibleError = (0.8 * Math.sqrt(registeredAreaNum)) + (0.002 * registeredAreaNum);
    const exceedsLimit = absoluteDifference > permissibleError;

    // Calculate adjusted areas for each parcel
    const parcelResults = parcelData.map(({ parcelId, parcel }) => {
      const calculatedArea = parcel.area;
      let adjustedArea = calculatedArea;
      let roundedArea = Math.round(calculatedArea);

      // If within permissible error, adjust proportionally
      if (!exceedsLimit) {
        adjustedArea = (registeredAreaNum / totalCalculatedArea) * calculatedArea;
        roundedArea = Math.round(adjustedArea);
      }

      return {
        parcelId,
        parcelNumber: parcel.number,
        calculatedArea: calculatedArea,
        adjustedArea: adjustedArea,
        roundedArea: roundedArea,
        pointCount: parcel.ids.length
      };
    });

    setErrorResults({
      totalRegisteredArea: registeredAreaNum,
      totalCalculatedArea: totalCalculatedArea,
      absoluteDifference: absoluteDifference,
      permissibleError: permissibleError,
      exceedsLimit: exceedsLimit,
      parcelResults: parcelResults
    });


    const toast = document.createElement('div');
    const statusText = exceedsLimit
      ? '⚠️ Error exceeds permissible limits - using original areas'
      : '✅ Within permissible limits - areas adjusted proportionally';
    toast.innerHTML = `✅ Error calculations completed!<br/>${statusText}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      right: auto;
      text-align: center;
      background: ${exceedsLimit ? '#da3633' : '#238636'};
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      animation: slideIn 0.3s ease-out;
      max-width: 400px;
      line-height: 1.5;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // Save current error calculation
  const handleSaveErrorCalculation = () => {
    if (!errorResults) return;

    const newCalculation = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      name: `Calculation #${savedErrorCalculations.length + 1}`,
      ...errorResults
    };

    setSavedErrorCalculations([...savedErrorCalculations, newCalculation]);
    setHasUnsavedChanges(true);

    // Create toast manually to avoid dependencies
    const toast = document.createElement('div');
    toast.innerHTML = `✅ Error calculation saved!`;
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
    }, 3000);
  };

  // Delete saved error calculation
  const handleDeleteErrorCalculation = (id) => {
    if (confirm('Are you sure you want to delete this saved calculation?')) {
      const updatedCalculations = savedErrorCalculations.filter(c => c.id !== id);
      setSavedErrorCalculations(updatedCalculations);
      setHasUnsavedChanges(true);
    }
  };

  // Toggle parcel selection for error calculations
  const toggleParcelSelection = (parcelId) => {
    setSelectedParcelsForError(prev => {
      if (prev.includes(parcelId)) {
        return prev.filter(id => id !== parcelId);
      } else {
        return [...prev, parcelId];
      }
    });
  };

  // Export single parcel to PDF with optional heading
  const handleExportSingle = async (parcel) => {
    try {
      // Create custom dialog for heading input
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
        padding: 16px;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 24px;
        max-width: min(600px, 90vw);
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      `;

      dialog.innerHTML = `
        <h2 style="color: #c9d1d9; font-size: 20px; font-weight: bold; margin-bottom: 16px;">
          📄 Export Parcel #${parcel.number}
        </h2>
        <div style="margin-bottom: 20px;">
          <label style="display: flex; align-items: center; color: #c9d1d9; cursor: pointer;">
            <input type="checkbox" id="include-heading-check" style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;" />
            <span style="font-weight: 500;">Include heading information</span>
          </label>
        </div>
        <div id="heading-fields" style="display: none; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <div style="margin-bottom: 12px;">
            <label style="display: block; color: #8b949e; font-size: 12px; margin-bottom: 4px;">Block</label>
            <input type="text" id="heading-block" value="${fileHeading.block || ''}" style="width: 100%; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 8px; color: #c9d1d9; font-size: 14px;" />
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; color: #8b949e; font-size: 12px; margin-bottom: 4px;">Quarter</label>
            <input type="text" id="heading-quarter" value="${fileHeading.quarter || ''}" style="width: 100%; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 8px; color: #c9d1d9; font-size: 14px;" />
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; color: #8b949e; font-size: 12px; margin-bottom: 4px;">Parcels</label>
            <input type="text" id="heading-parcels" value="${fileHeading.parcels || ''}" style="width: 100%; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 8px; color: #c9d1d9; font-size: 14px;" />
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; color: #8b949e; font-size: 12px; margin-bottom: 4px;">Place</label>
            <input type="text" id="heading-place" value="${fileHeading.place || ''}" style="width: 100%; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 8px; color: #c9d1d9; font-size: 14px;" />
          </div>
          <div>
            <label style="display: block; color: #8b949e; font-size: 12px; margin-bottom: 4px;">Additional Info</label>
            <input type="text" id="heading-additional" value="${fileHeading.additionalInfo || ''}" style="width: 100%; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 8px; color: #c9d1d9; font-size: 14px;" />
          </div>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="export-cancel" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
            Cancel
          </button>
          <button id="export-confirm" style="background: #238636; border: 1px solid #238636; color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
            📄 Export PDF
          </button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Toggle heading fields visibility
      const checkbox = document.getElementById('include-heading-check');
      const headingFields = document.getElementById('heading-fields');
      checkbox.addEventListener('change', () => {
        headingFields.style.display = checkbox.checked ? 'block' : 'none';
      });

      // Wait for user action
      const userChoice = await new Promise((resolve) => {
        document.getElementById('export-confirm').onclick = () => {
          const includeHeading = checkbox.checked;
          const heading = includeHeading ? {
            block: document.getElementById('heading-block').value,
            quarter: document.getElementById('heading-quarter').value,
            parcels: document.getElementById('heading-parcels').value,
            place: document.getElementById('heading-place').value,
            additionalInfo: document.getElementById('heading-additional').value
          } : null;
          document.body.removeChild(overlay);
          resolve({ confirmed: true, heading });
        };
        document.getElementById('export-cancel').onclick = () => {
          document.body.removeChild(overlay);
          resolve({ confirmed: false });
        };
        overlay.onclick = (e) => {
          if (e.target === overlay) {
            document.body.removeChild(overlay);
            resolve({ confirmed: false });
          }
        };
      });

      if (!userChoice.confirmed) return;

      // Export the parcel
      const response = await fetch('http://localhost:5000/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcels: [parcel],
          points: loadedPoints,
          fileHeading: userChoice.heading,
          errorResults: null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes('ReportLab')) {
          showErrorToast('❌ ReportLab not installed! Install it with: pip install reportlab');
          return;
        }
        throw new Error('Export failed');
      }

      const result = await response.json();

      if (result.error) {
        showErrorToast(`❌ ${result.error}`);
        return;
      }

      // Use Electron API to save and open PDF
      if (window.electronAPI && window.electronAPI.saveAndOpenPDF) {
        const saveResult = await window.electronAPI.saveAndOpenPDF(result.pdfData, `Parcel_${parcel.number}.pdf`);
        if (saveResult && saveResult.success) {
          showSuccessToast(`✅ Exported Parcel #${parcel.number} to PDF!`);
        }
      }
    } catch (error) {
      console.error('Error exporting parcel:', error);
      showErrorToast(`❌ Error exporting parcel: ${error.message}`);
    }
  };

  // Export all parcels to PDF (including error calculations if available)
  const handleExportAll = async () => {
    if (savedParcels.length === 0) {
      showErrorToast('⚠️ No saved parcels to export!');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcels: savedParcels,
          points: loadedPoints,
          fileHeading: fileHeading,
          errorResults: errorResults,  // Keeping this for backward compatibility or current view
          savedErrorCalculations: savedErrorCalculations // Sending all saved calculations
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes('ReportLab')) {
          showErrorToast('❌ ReportLab not installed! Install it with: pip install reportlab<br/>Then restart the app.');
          return;
        }
        throw new Error('Export failed');
      }

      const result = await response.json();

      if (result.error) {
        showErrorToast(`❌ ${result.error}`);
        return;
      }

      // Use Electron API to save and open PDF if available
      let electronAPI = null;
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAndOpenPDF === 'function') {
        electronAPI = window.electronAPI;
      } else {
        // Wait a bit for Electron API to load
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAndOpenPDF === 'function') {
            electronAPI = window.electronAPI;
            break;
          }
        }
      }

      if (electronAPI && electronAPI.saveAndOpenPDF) {
        try {
          console.log('[Renderer] Calling saveAndOpenPDF...');
          const saveResult = await electronAPI.saveAndOpenPDF(result.pdfData, result.fileName);
          console.log('[Renderer] saveResult:', saveResult);

          if (saveResult && saveResult.canceled) {
            console.log('[Renderer] User canceled save dialog');
            return; // User canceled the save dialog
          }

          if (saveResult && saveResult.success) {
            // Show success toast
            const toast = document.createElement('div');
            const errorText = errorResults ? '<br/>📊 Error calculations included!' : '';
            toast.innerHTML = `✅ Exported ${savedParcels.length} parcels to PDF!${errorText}<br/>Opening PDF...`;
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
              toast.style.animation = 'slideOut 0.3s ease-out';
              setTimeout(() => toast.remove(), 300);
            }, 3000);
            return;
          } else {
            console.warn('[Renderer] PDF save failed:', saveResult?.error);
            // Still try to open the file if it was saved but opening failed
            if (saveResult && saveResult.filePath) {
              console.log('[Renderer] File was saved but opening failed, filePath:', saveResult.filePath);
            }
            // Fall through to blob download
          }
        } catch (error) {
          console.error('[Renderer] Error using Electron PDF save:', error);
          console.error('[Renderer] Error details:', error.stack);
          // Fall through to blob download
        }
      } else {
        console.log('[Renderer] Electron API not available, using blob download');
      }

      // Fallback: Download the PDF via blob (web browser)
      const pdfData = atob(result.pdfData);
      const bytes = new Uint8Array(pdfData.length);
      for (let i = 0; i < pdfData.length; i++) {
        bytes[i] = pdfData.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      const errorText = errorResults ? '\n📊 Error calculations included!' : '';
      showSuccessToast(`✅ Exported ${savedParcels.length} parcels to PDF successfully!${errorText}`);
    } catch (error) {
      console.error('Error exporting:', error);
      showErrorToast(`❌ Error exporting parcels: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen p-6 relative z-10 bg-dark-900">
      {/* Duplicate Parcel Dialog - Non-blocking */}
      {showDuplicateDialog && duplicateParcel && createPortal(
        <div
          className="fixed inset-0 z-50 p-4"
          style={{
            pointerEvents: 'none',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, x: 20 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            className="bg-dark-800 border-2 border-warning rounded-2xl p-8 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              pointerEvents: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
              maxWidth: '450px'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-3xl font-bold text-warning">⚠️ Duplicate Parcel Number</h2>
              <button
                onClick={() => {
                  setShowDuplicateDialog(false);
                  setDuplicateParcel(null);
                  setPendingParcelNumber('');
                }}
                className="text-dark-400 hover:text-white text-2xl font-bold leading-none"
                title="Close (or click outside)"
              >
                ×
              </button>
            </div>
            <p className="text-dark-300 mb-6">
              Parcel number <strong className="text-primary">"{pendingParcelNumber}"</strong> already exists!
            </p>

            <div className="bg-dark-700 rounded-xl p-4 mb-6 border border-dark-600">
              <p className="text-dark-400 text-sm mb-2">Existing Parcel Details:</p>
              <div className="text-dark-50">
                <p><strong>Parcel #{duplicateParcel.number}</strong></p>
                <p className="text-sm text-dark-300 mt-1">
                  📐 Area: {duplicateParcel.area?.toFixed(4) || 'N/A'} m² |
                  📍 Points: {duplicateParcel.pointCount || duplicateParcel.ids?.length || 0}
                </p>
              </div>
            </div>

            <p className="text-dark-300 mb-6">What would you like to do?</p>
            <p className="text-dark-400 text-sm mb-4 italic">
              💡 Note: Duplicates will be saved separately and shown in the "All Parcels" tab
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleReplaceDuplicate}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                ✏️ Replace & Edit Existing
              </button>
              <button
                onClick={handleCreateNewDuplicate}
                className="btn-success w-full py-3 flex items-center justify-center gap-2"
              >
                ➕ Create New (Allow Duplicate)
              </button>
              <button
                onClick={handleCancelDuplicate}
                className="btn-secondary w-full py-3 flex items-center justify-center gap-2 border-danger/50 text-danger hover:bg-danger/20"
              >
                ❌ Cancel
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 10000,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && confirmDialog.onConfirm) confirmDialog.onConfirm(false);
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-800 border-2 border-warning rounded-2xl p-8 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ margin: 0 }}
          >
            <h2 className="text-2xl font-bold text-white mb-4">⚠️ {confirmDialog.title}</h2>
            <p className="text-dark-300 mb-6 font-medium">{confirmDialog.message}</p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm(false)}
                className="px-6 py-2 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm(true)}
                className="px-6 py-2 rounded-lg bg-success text-white hover:bg-success/90 transition-colors font-bold shadow-lg shadow-success/20"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Area Confirmation Dialog */}
      {showAreaDialog && createPortal(
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) e.stopPropagation();
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-800 border-2 border-primary rounded-2xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <h2 className="text-3xl font-bold text-primary mb-4">✅ Polygon Closed!</h2>
            <p className="text-dark-300 mb-6">Area has been calculated:</p>

            <div className="bg-dark-900 rounded-xl p-6 mb-6 border-2 border-success">
              <div className="text-center">
                <p className="text-dark-400 text-sm mb-2">Area</p>
                <p className="text-5xl font-bold text-success mb-2">{tempArea?.toFixed(4)}</p>
                <p className="text-dark-400 text-sm">square meters</p>
              </div>
              <div className="mt-4 pt-4 border-t border-dark-700">
                <p className="text-dark-400 text-sm">Perimeter: {tempPerimeter?.toFixed(4)} m</p>
                <p className="text-dark-400 text-sm">Points: {enteredIds.length}</p>
              </div>
            </div>

            <p className="text-dark-300 mb-6">Do you want to continue or edit?</p>

            <div className="flex gap-4">
              <button onClick={handleEditArea} className="btn-secondary flex-1 py-3">
                ✏️ Edit Points
              </button>
              <button onClick={handleConfirmArea} className="btn-primary flex-1 py-3">
                ✅ Continue
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Curves Dialog */}
      {showCurvesDialog && createPortal(
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflowY: 'auto'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { /* Don't close */ } }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-800 border-2 border-primary rounded-2xl p-8 max-w-2xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '700px',
              maxHeight: '90vh',
              overflowY: 'auto',
              pointerEvents: 'auto'
            }}
          >
            <h2 className="text-3xl font-bold text-primary mb-4">📐 Curves Adjustment</h2>
            <p className="text-dark-300 mb-6">Do you want to add or subtract curves? (Middle Ordinate Method)</p>

            {/* Current area - shows live updates */}
            <div className="bg-dark-900 rounded-xl p-4 mb-6 border-2 border-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-xs mb-1">Base Area:</p>
                  <p className="text-dark-300 font-bold text-lg">{tempArea?.toFixed(4)} m²</p>
                </div>
                {curves.length > 0 && liveAreaWithCurves && (
                  <>
                    <div className="text-center">
                      <p className="text-dark-400 text-xs mb-1">Adjustment:</p>
                      <p className={`font-bold text-lg ${(liveAreaWithCurves - tempArea) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(liveAreaWithCurves - tempArea) >= 0 ? '+' : ''}{(liveAreaWithCurves - tempArea).toFixed(4)} m²
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs mb-1">Final Area:</p>
                      <p className="text-primary font-bold text-2xl">{liveAreaWithCurves?.toFixed(4)} m²</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Add curve form */}
            <div className="bg-dark-700 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-dark-50 mb-4">Add Curve:</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-dark-300 text-sm mb-2">From Point ID:</label>
                  <input
                    id="curve-from"
                    type="text"
                    value={curveFrom}
                    onChange={(e) => setCurveFrom(e.target.value)}
                    onKeyDown={(e) => handleCurveInputKeyDown(e, 'curve-to')}
                    onFocus={(e) => e.target.select()}
                    className="input-field w-full"
                    placeholder="e.g. 1"
                    autoComplete="off"
                    readOnly={false}
                    disabled={false}
                    style={{ pointerEvents: 'auto', cursor: 'text' }}
                  />
                </div>
                <div>
                  <label className="block text-dark-300 text-sm mb-2">To Point ID:</label>
                  <input
                    id="curve-to"
                    type="text"
                    value={curveTo}
                    onChange={(e) => setCurveTo(e.target.value)}
                    onKeyDown={(e) => handleCurveInputKeyDown(e, 'curve-m')}
                    onFocus={(e) => e.target.select()}
                    className="input-field w-full"
                    placeholder="e.g. 2"
                    autoComplete="off"
                    readOnly={false}
                    disabled={false}
                    style={{ pointerEvents: 'auto', cursor: 'text' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-dark-300 text-sm mb-2">Middle Ordinate (M):</label>
                  <input
                    id="curve-m"
                    type="number"
                    step="0.01"
                    value={curveM}
                    onChange={(e) => setCurveM(e.target.value)}
                    onKeyDown={(e) => handleCurveInputKeyDown(e)}
                    onFocus={(e) => e.target.select()}
                    className="input-field w-full"
                    placeholder="0.00"
                    autoComplete="off"
                    readOnly={false}
                    disabled={false}
                    style={{ pointerEvents: 'auto', cursor: 'text' }}
                  />
                </div>
                <div>
                  <label className="block text-dark-300 text-sm mb-2">Add or Subtract:</label>
                  <select
                    value={curveSign}
                    onChange={(e) => setCurveSign(e.target.value)}
                    className="input-field w-full"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <option value="+">+ Add to Area</option>
                    <option value="-">− Subtract from Area</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                {editingCurveIndex !== null && (
                  <button onClick={handleCancelEdit} className="btn-secondary w-1/3 border-danger/50 text-danger hover:bg-danger/20">
                    ✖ Cancel
                  </button>
                )}
                <button onClick={handleAddCurve} className={`btn-primary w-full ${editingCurveIndex !== null ? 'bg-warning border-warning text-dark-900 hover:bg-warning/90' : ''}`}>
                  {editingCurveIndex !== null ? '🖊️ Update Curve' : '➕ Add Curve'}
                </button>
              </div>
            </div>

            {/* List of added curves */}
            {curves.length > 0 && (
              <div className="bg-dark-700 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-bold text-dark-50 mb-4">Added Curves ({curves.length}):</h3>
                <div className="space-y-2">
                  {curves.map((curve, index) => (
                    <div key={index} className="flex items-center justify-between bg-dark-800 rounded-lg p-3">
                      <span className={curve.sign === 1 ? 'text-success' : 'text-danger'}>
                        {curve.from} → {curve.to}: M = {curve.M} <strong>{curve.sign === 1 ? '(+Add Area)' : '(−Subtract Area)'}</strong>
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStartEditCurve(index)}
                          className="text-warning hover:text-warning-light"
                          title="Edit Curve"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCurves(curves.filter((_, i) => i !== index))}
                          className="text-danger hover:text-danger-light"
                          title="Delete Curve"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={handleSkipCurves} className="btn-secondary flex-1 py-3">
                Skip (No Curves)
              </button>
              <button onClick={handleFinalizeCurves} className="btn-success flex-1 py-3">
                ✅ Finalize Area
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex gap-2 mb-4">
            <button onClick={() => navigate('/')} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              ↩ MAIN MENU
            </button>
            <button onClick={handleCloseProject} className="btn-secondary flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border-red-600/50 text-red-400">
              ❌ Close Project
            </button>
          </div>

          <div className="glass-effect rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">📐 Parcel Area Calculator</h1>
                <p className="text-dark-300">Professional Surveying Tool</p>
              </div>
              <div className="text-success font-bold">● Ready</div>
            </div>

            {/* Toolbar */}
            <div className="flex gap-2 flex-wrap items-center">
              {(globalProjectName || (pointsFileName && Object.keys(loadedPoints).length > 0)) && (
                <div className="px-3 py-2 bg-primary/20 border border-primary rounded-lg text-primary font-semibold text-sm flex items-center gap-2">
                  📁 {globalProjectName || `Working: ${pointsFileName}`}
                  {globalProjectName && (
                    <>
                      {hasUnsavedChanges ? (
                        (lastSavedPath || projectPath) ? (
                          <span className="text-warning animate-pulse">💾 Saving...</span>
                        ) : (
                          <button
                            onClick={handleSmartSave}
                            className="text-warning hover:text-warning/80 hover:underline text-left font-bold"
                            title="Click to save project (auto-saves to points file location if possible)"
                          >
                            ⚠️ Unsaved Setup (Click to Save)
                          </button>
                        )
                      ) : (
                        <span className="text-success">✓ Saved</span>
                      )}
                    </>
                  )}
                  {isWatchingFile && <span className="text-success text-xs">🔄 Auto-Watch</span>}
                  {!globalProjectName && pointsFileName && (
                    <span className="text-dark-300 text-xs">(Points File Only)</span>
                  )}
                </div>
              )}

              <button onClick={handleNewProject} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New
              </button>

              <input type="file" accept=".prcl" onChange={handleLoadProject} style={{ display: 'none' }} id="load-project" />
              <label htmlFor="load-project" className="btn-secondary py-2 px-4 text-sm cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Open Project
              </label>

              <button
                onClick={handleSaveAs}
                title="Save project"
                className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                onMouseEnter={() => {
                  // Quick check when hovering
                  if (typeof window !== 'undefined' && !window.electronAPI) {
                    console.warn('[UI] ⚠️ Electron API not available on button hover');
                  }
                }}
              >
                <Save className="w-4 h-4" />
                Save As... {hasUnsavedChanges && <span className="animate-pulse">💾</span>}
              </button>

              <div className="mx-2 h-6 w-px bg-dark-600"></div>

              <input type="file" accept=".pnt,.txt,.csv" onChange={handleLoadFile} style={{ display: 'none' }} id="load-points" />
              <label htmlFor="load-points" className="btn-secondary py-2 px-4 text-sm cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Load Points
              </label>

              <button onClick={handleExportAll} disabled={savedParcels.length === 0} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                <FileDown className="w-4 h-4" />
                Export PDF
              </button>
            </div>

            {/* File status */}
            {pointsFileName && (
              <div className="mt-4 p-3 bg-success/10 border border-success rounded-lg flex items-center justify-between">
                <p className="text-success font-semibold">
                  📁 Loaded: {pointsFileName} ({Object.keys(loadedPoints).length} points)
                </p>
                {isWatchingFile && (
                  <div className="flex items-center gap-2 text-success text-sm">
                    <span className="animate-pulse">🔄</span>
                    <span>Auto-watching for changes</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Input Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="card mb-6"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-primary font-semibold">
              📝 STEP 1: Enter parcel number → STEP 2: Add point IDs one by one
            </p>
          </div>

          <div className="flex gap-4 items-end flex-wrap" style={{ pointerEvents: 'auto' }}>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-dark-300 font-semibold mb-2">Parcel #:</label>
              <input
                type="text"
                value={parcelNumber}
                onChange={(e) => {
                  // Ensure input is always enabled and functional
                  setParcelNumber(e.target.value);
                  // Close duplicate dialog if user changes the number
                  if (showDuplicateDialog) {
                    setShowDuplicateDialog(false);
                    setDuplicateParcel(null);
                    setPendingParcelNumber('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Don't proceed if duplicate dialog is open
                    if (!showDuplicateDialog) {
                      const pointInput = document.getElementById('point-id-input');
                      if (pointInput) {
                        pointInput.focus();
                      }
                    }
                  }
                }}
                onFocus={(e) => {
                  e.target.select();
                  // Ensure input is enabled when focused
                  e.target.readOnly = false;
                  e.target.disabled = false;
                }}
                onBlur={(e) => {
                  // Ensure input stays enabled even after blur
                  e.target.readOnly = false;
                  e.target.disabled = false;
                }}
                className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all w-full"
                placeholder="Enter parcel number"
                style={{ fontSize: '16px', cursor: 'text', pointerEvents: 'auto' }}
                autoComplete="off"
                readOnly={false}
                disabled={false}
                tabIndex="1"
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-dark-300 font-semibold mb-2">Point ID:</label>
              <input
                id="point-id-input"
                type="text"
                value={pointId}
                onChange={(e) => {
                  // Ensure input is always enabled and functional
                  setPointId(e.target.value);
                }}
                onKeyDown={(e) => {
                  // Allow all keys to work normally
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPoint();
                  }
                  // Don't prevent default for other keys - allow normal typing
                }}
                onFocus={(e) => {
                  e.target.select();
                  // Ensure input is enabled when focused
                  e.target.readOnly = false;
                  e.target.disabled = false;
                }}
                onBlur={(e) => {
                  // Ensure input stays enabled even after blur
                  e.target.readOnly = false;
                  e.target.disabled = false;
                }}
                className="bg-dark-700 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all w-full"
                placeholder="Type point ID"
                style={{ fontSize: '16px', cursor: 'text', pointerEvents: 'auto' }}
                autoComplete="off"
                readOnly={false}
                disabled={false}
                tabIndex="2"
              />
            </div>

            <button onClick={handleAddPoint} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              ADD POINT
            </button>

            <button onClick={handleUndo} className="btn-secondary flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Undo
            </button>

            <button onClick={handleReset} className="btn-secondary flex items-center gap-2 hover:bg-danger hover:border-danger">
              <Trash2 className="w-5 h-5" />
              Reset
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${activeTab === 'editor'
              ? 'bg-dark-800 text-primary border-t-2 border-primary'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${activeTab === 'saved'
              ? 'bg-dark-800 text-primary border-t-2 border-primary'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
          >
            Saved Parcels ({(() => {
              // Count unique parcel numbers only
              const uniqueNumbers = new Set(savedParcels.map(p => p.number.trim().toLowerCase()));
              return uniqueNumbers.size;
            })()})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${activeTab === 'all'
              ? 'bg-dark-800 text-primary border-t-2 border-primary'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
          >
            All Parcels ({savedParcels.length})
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${activeTab === 'errors'
              ? 'bg-dark-800 text-primary border-t-2 border-primary'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
          >
            Error Calculations
          </button>
        </div>

        {/* Editor Tab */}
        {activeTab === 'editor' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-dark-50">YOUR POINTS:</h2>
              <span className="text-primary font-semibold">{enteredIds.length} points</span>
            </div>

            {/* Points Display - Horizontal with Insert/Edit buttons */}
            <div className="bg-dark-700 rounded-lg p-4 mb-4 min-h-[120px] max-h-[200px] overflow-auto">
              {enteredIds.length === 0 ? (
                <p className="text-dark-400 text-center py-8">No points entered yet. Add point IDs above.</p>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  {enteredIds.map((id, index) => (
                    <React.Fragment key={index}>
                      {/* Insert button before this point (except first) */}
                      {index > 0 && (
                        <button
                          onClick={() => handleInsertPointAt(index - 1)}
                          className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity text-primary hover:text-primary/80"
                          title={`Insert point between ${enteredIds[index - 1]} and ${id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}

                      {/* Point display */}
                      <div
                        className={`bg-dark-800 border-2 rounded-lg px-4 py-4 flex items-center justify-center hover:border-primary transition-all group aspect-square min-w-[60px] w-[60px] h-[60px] relative ${editingPointIndex === index ? 'border-warning' : 'border-primary/50'
                          }`}
                      >
                        <span className="text-primary font-bold text-lg">{id}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1">
                          <button
                            onClick={() => {
                              setEditingPointIndex(index);
                              setPointId(id);
                              setInsertPointAfterIndex(null);
                              document.getElementById('point-id-input')?.focus();
                            }}
                            className="text-warning hover:text-warning/80"
                            title="Edit this point ID"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeletePoint(index)}
                            className="text-danger hover:text-danger/80"
                            title="Delete this point"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-dark-400 text-sm">
                💡 Click ✏️ to EDIT point | Click ➕ to INSERT between points | Click 🗑️ to DELETE | Close polygon by re-entering first ID
              </p>
              {editingParcelId && (
                <button onClick={handleUpdateSavedParcel} className="btn-success flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Update Saved Parcel
                </button>
              )}
            </div>

            {/* Area Result */}
            {area !== null && (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-success/20 to-success/10 border-2 border-success rounded-xl p-6 mb-4">
                <h3 className="text-success font-bold text-lg mb-3">✅ Polygon Closed - Area Calculated</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-dark-400 text-sm">Area</p>
                    <p className="text-3xl font-bold text-success">{area.toFixed(4)}</p>
                    <p className="text-dark-400 text-xs">square meters</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-sm">Perimeter</p>
                    <p className="text-2xl font-bold text-dark-50">{perimeter.toFixed(4)}</p>
                    <p className="text-dark-400 text-xs">meters</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-sm">Points</p>
                    <p className="text-2xl font-bold text-dark-50">{enteredIds.length}</p>
                    <p className="text-dark-400 text-xs">corners</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex gap-4 justify-between items-center pt-4 border-t border-dark-600">
              <div className="text-dark-400 text-sm">
                {editingParcelId ? (
                  <span className="text-warning">✏️ Editing saved parcel: {parcelNumber}</span>
                ) : area ? (
                  <span className="text-success">✅ Parcel saved! Ready for next parcel.</span>
                ) : enteredIds.length > 0 ? (
                  <span>Enter <strong className="text-primary">"{enteredIds[0]}"</strong> again to close polygon</span>
                ) : (
                  'Start by entering point IDs'
                )}
              </div>
              <div className="flex gap-2">
                {editingParcelId && (
                  <button
                    onClick={handleUpdateSavedParcel}
                    className="btn-success flex items-center gap-2 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    Update Parcel
                  </button>
                )}
                {area && !editingParcelId && (
                  <button
                    onClick={handleSaveParcel}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Manually Save Again
                  </button>
                )}
                {editingParcelId && (
                  <button
                    onClick={() => {
                      setEditingParcelId(null);
                      setInsertPointAfterIndex(null);
                      setEditingPointIndex(null);
                      setParcelNumber('');
                      setEnteredIds([]);
                      setArea(null);
                      setPerimeter(null);
                      setCurves([]);
                      setPointId('');
                      const pointInput = document.getElementById('point-id-input');
                      if (pointInput) {
                        pointInput.placeholder = 'Type point ID';
                      }
                    }}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Saved Parcels Tab - Only Unique Parcel Numbers */}
        {activeTab === 'saved' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <h2 className="text-xl font-bold text-dark-50 mb-2">Saved Parcels (Unique Only)</h2>
            <p className="text-dark-400 text-sm mb-4">
              Showing one parcel per number. Check "All Parcels" tab to see duplicates.
            </p>

            {/* Memoized List for Unique Parcels */}
            <UniqueParcelsList
              savedParcels={savedParcels}
              onEdit={(parcel) => {
                handleLoadSavedParcel(parcel);
                setActiveTab('editor');
              }}
              onDelete={handleDeleteSaved}
              onExport={handleExportSingle} // Not used in unique view but consistent prop
            />

            {savedParcels.length > 0 && (
              <div className="mt-6 pt-4 border-t border-dark-600">
                <button onClick={handleExportAll} className="btn-primary w-full flex items-center justify-center gap-2">
                  <FileDown className="w-5 h-5" />
                  Export All Parcels ({savedParcels.length})
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* All Parcels Tab - Shows All Including Duplicates */}
        {activeTab === 'all' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <h2 className="text-xl font-bold text-dark-50 mb-2">All Parcels (Including Duplicates)</h2>
            <p className="text-dark-400 text-sm mb-4">
              Showing all saved parcels. Duplicates are allowed and shown separately.
            </p>

            {/* Memoized List for All Parcels */}
            <AllParcelsList
              savedParcels={savedParcels}
              onEdit={(parcel) => {
                handleLoadSavedParcel(parcel);
                setActiveTab('editor');
              }}
              onDelete={handleDeleteSaved}
              onExport={handleExportSingle}
            />

            {savedParcels.length > 0 && (
              <div className="mt-6 pt-4 border-t border-dark-600">
                <button onClick={handleExportAll} className="btn-primary w-full flex items-center justify-center gap-2">
                  <FileDown className="w-5 h-5" />
                  Export All Parcels ({savedParcels.length})
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Error Calculations Tab */}
        {activeTab === 'errors' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <h2 className="text-xl font-bold text-dark-50 mb-4">📊 Error Calculations</h2>
            <p className="text-dark-400 text-sm mb-6">
              Select multiple parcels, then enter ONE registered area for the total. Calculate error using surveying formula:<br />
              <strong className="text-primary">Permissible Error = 0.8 × √(Registered Area) + 0.002 × Registered Area</strong><br />
              If within limits, areas are adjusted proportionally. If exceeds, original areas are used.
            </p>

            {/* Total Registered Area Input */}
            <div className="mb-6 p-4 bg-dark-700 rounded-lg">
              <label className="block text-dark-300 font-semibold mb-2">
                Total Registered Area (for all selected parcels):
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={totalRegisteredArea}
                  onChange={(e) => setTotalRegisteredArea(e.target.value)}
                  className="bg-dark-800 border-2 border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                  style={{ width: '200px', fontSize: '16px' }}
                  placeholder="Enter total m²"
                />
                <span className="text-dark-300">m² (from registry)</span>
              </div>
              <p className="text-dark-400 text-xs mt-2">
                Enter the total registered area for all selected parcels combined
              </p>
            </div>

            {/* Parcel Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-dark-50">
                  Select Parcels ({selectedParcelsForError.length} selected)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedParcelsForError(savedParcels.map(p => p.id))}
                    className="btn-secondary text-sm py-1 px-3"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => {
                      setSelectedParcelsForError([]);
                      setTotalRegisteredArea('');
                      setErrorResults(null);
                    }}
                    className="btn-secondary text-sm py-1 px-3"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleCalculateErrors}
                    disabled={selectedParcelsForError.length === 0 || !totalRegisteredArea}
                    className="btn-primary text-sm py-1 px-3 flex items-center gap-2"
                  >
                    Calculate Errors
                  </button>
                </div>
              </div>

              {savedParcels.length === 0 ? (
                <p className="text-dark-400 text-center py-8">No saved parcels to calculate errors for.</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {savedParcels.map((parcel) => {
                    const isSelected = selectedParcelsForError.includes(parcel.id);

                    return (
                      <div
                        key={parcel.id}
                        onClick={() => toggleParcelSelection(parcel.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                          ? 'bg-primary/20 border-primary'
                          : 'bg-dark-700 border-dark-600 hover:border-dark-500'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-bold text-primary mb-1">
                              Parcel #{parcel.number}
                              {isSelected && <span className="ml-2 text-success">✓ Selected</span>}
                            </h4>
                            <p className="text-sm text-dark-300">
                              Calculated Area: <strong className="text-success">{parcel.area.toFixed(4)} m²</strong> | Points: {parcel.pointCount}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error Results */}
            {errorResults && (
              <div className="mt-6 pt-6 border-t border-dark-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-dark-50">Current Calculation Results</h3>
                  <button
                    onClick={handleSaveErrorCalculation}
                    className="btn-success py-2 px-4 text-sm flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save This Calculation
                  </button>
                </div>

                {/* Overall Summary */}
                <div className="mb-6 p-6 bg-dark-700 rounded-lg border-2 border-primary/50">
                  <h4 className="text-primary font-bold text-lg mb-4">📊 Overall Calculation Summary:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-dark-400 mb-1">Total Registered Area</p>
                      <p className="text-xl font-bold text-primary">{errorResults.totalRegisteredArea.toFixed(4)} m²</p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-400 mb-1">Total Calculated Area</p>
                      <p className="text-xl font-bold text-success">{errorResults.totalCalculatedArea.toFixed(4)} m²</p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-400 mb-1">Absolute Difference</p>
                      <p className="text-xl font-bold text-warning">{errorResults.absoluteDifference.toFixed(4)} m²</p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-400 mb-1">Permissible Error</p>
                      <p className="text-xl font-bold text-primary">{errorResults.permissibleError.toFixed(4)} m²</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-dark-600">
                    <p className={`text-base font-bold mb-2 ${errorResults.exceedsLimit ? 'text-danger' : 'text-success'}`}>
                      {errorResults.exceedsLimit
                        ? '⚠️ ERROR EXCEEDS PERMISSIBLE LIMITS - Using original calculated areas'
                        : '✅ WITHIN PERMISSIBLE LIMITS - Areas adjusted proportionally'}
                    </p>
                    <p className="text-xs text-dark-400">
                      Formula: Permissible Error = 0.8 × √({errorResults.totalRegisteredArea.toFixed(2)}) + 0.002 × {errorResults.totalRegisteredArea.toFixed(2)} = {errorResults.permissibleError.toFixed(4)} m²
                    </p>
                  </div>
                </div>

                {/* Individual Parcel Results Table */}
                <div className="bg-dark-700 rounded-lg p-6 border border-primary/30">
                  <h4 className="text-lg font-bold text-primary mb-4">Parcel Results:</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-dark-800 border-b-2 border-dark-600">
                          <th className="px-4 py-3 text-left text-dark-300 font-semibold">Parcel #</th>
                          <th className="px-4 py-3 text-right text-dark-300 font-semibold">Original Calculated (m²)</th>
                          <th className="px-4 py-3 text-right text-dark-300 font-semibold">Adjusted Area (m²)</th>
                          <th className="px-4 py-3 text-right text-dark-300 font-semibold">Rounded Area (m²)</th>
                          <th className="px-4 py-3 text-right text-dark-300 font-semibold">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorResults.parcelResults.map((parcelResult, index) => (
                          <tr key={parcelResult.parcelId} className={`border-b border-dark-600 ${index % 2 === 0 ? 'bg-dark-800/50' : ''}`}>
                            <td className="px-4 py-3 text-primary font-semibold">{parcelResult.parcelNumber}</td>
                            <td className="px-4 py-3 text-right text-success">{parcelResult.calculatedArea.toFixed(4)}</td>
                            <td className="px-4 py-3 text-right text-warning">
                              {parcelResult.adjustedArea.toFixed(4)}
                              {!errorResults.exceedsLimit && (
                                <span className="ml-2 text-xs text-success">✓</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-primary font-bold">{parcelResult.roundedArea}</td>
                            <td className="px-4 py-3 text-right text-dark-300">{parcelResult.pointCount}</td>
                          </tr>
                        ))}
                        <tr className="bg-dark-800 border-t-2 border-primary font-bold">
                          <td className="px-4 py-3 text-primary">TOTAL:</td>
                          <td className="px-4 py-3 text-right text-success">
                            {errorResults.parcelResults.reduce((sum, p) => sum + p.calculatedArea, 0).toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-right text-warning">
                            {errorResults.parcelResults.reduce((sum, p) => sum + p.adjustedArea, 0).toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-right text-primary">
                            {errorResults.parcelResults.reduce((sum, p) => sum + p.roundedArea, 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-dark-300">
                            {errorResults.parcelResults.reduce((sum, p) => sum + p.pointCount, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {/* Saved Calculations History */}
            {savedErrorCalculations.length > 0 && (
              <div className="mt-8 pt-6 border-t-2 border-dark-600">
                <h3 className="text-xl font-bold text-dark-50 mb-4">📜 Saved Calculations History ({savedErrorCalculations.length})</h3>
                <div className="space-y-4">
                  {savedErrorCalculations.map((calc, index) => (
                    <div key={calc.id} className="bg-dark-800 rounded-lg p-6 border border-dark-600">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-primary">
                            {calc.name} <span className="text-sm text-dark-400 font-normal">({new Date(calc.timestamp).toLocaleString()})</span>
                          </h4>
                          <p className="text-sm text-dark-300">
                            Registered: {calc.totalRegisteredArea} m² | Calculated: {calc.totalCalculatedArea.toFixed(4)} m²
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${calc.exceedsLimit ? 'bg-danger/20 text-danger border-danger' : 'bg-success/20 text-success border-success'}`}>
                            {calc.exceedsLimit ? 'Exceeds Limit' : 'Within Limit'}
                          </div>
                          <button
                            onClick={() => handleDeleteErrorCalculation(calc.id)}
                            className="p-2 hover:bg-danger/20 rounded-lg text-danger transition-colors"
                            title="Delete Calculation"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Mini Results Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-dark-900 border-b border-dark-700">
                              <th className="px-3 py-2 text-left text-dark-400">Parcel</th>
                              <th className="px-3 py-2 text-right text-dark-400">Orig. Area</th>
                              <th className="px-3 py-2 text-right text-dark-400">Adj. Area</th>
                              <th className="px-3 py-2 text-right text-dark-400">Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calc.parcelResults.map((p, i) => (
                              <tr key={i} className="border-b border-dark-700/50">
                                <td className="px-3 py-1 text-primary">{p.parcelNumber}</td>
                                <td className="px-3 py-1 text-right text-dark-300">{p.calculatedArea.toFixed(3)}</td>
                                <td className="px-3 py-1 text-right text-warning">{p.adjustedArea.toFixed(3)}</td>
                                <td className="px-3 py-1 text-right text-success font-bold">{p.roundedArea}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-dark-800/50 rounded-lg text-dark-400 text-sm">
          <p className="font-semibold text-primary mb-2">📘 How to Use:</p>
          <ul className="space-y-1">
            <li>1. Load points file (.pnt, .txt, .csv)</li>
            <li>2. Enter parcel number, press Enter</li>
            <li>3. Type point IDs one by one, press Enter after each</li>
            <li>4. Re-enter first ID to close polygon → Area dialog appears</li>
            <li>5. Click "Continue" → Add curves or skip</li>
            <li>6. Click "Finalize" → <strong className="text-success">Parcel AUTO-SAVES! ✨</strong></li>
            <li>7. Cursor returns to parcel number → Ready for next parcel!</li>
            <li>8. Everything auto-saves to project file every 2 seconds 💾</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
// Memoized list for unique parcels to prevent re-renders when typing
const UniqueParcelsList = React.memo(({ savedParcels, onEdit, onDelete, onExport }) => {
  if (savedParcels.length === 0) {
    return <p className="text-dark-400 text-center py-12">No saved parcels yet.</p>;
  }

  // Get unique parcels (first occurrence of each parcel number)
  const seen = new Set();
  const uniqueParcels = savedParcels.filter(parcel => {
    const key = parcel.number.trim().toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  if (uniqueParcels.length === 0) {
    return <p className="text-dark-400 text-center py-12">No unique parcels found.</p>;
  }

  return (
    <div className="space-y-3">
      {uniqueParcels.map((parcel) => {
        // Count how many duplicates exist for this parcel number
        const duplicateCount = savedParcels.filter(p =>
          p.number.trim().toLowerCase() === parcel.number.trim().toLowerCase()
        ).length;

        return (
          <div
            key={parcel.id}
            className="glass-effect rounded-lg p-5 hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-primary mb-2">
                  Parcel #{parcel.number}
                  {duplicateCount > 1 && (
                    <span className="ml-2 text-xs px-2 py-1 bg-blue-600/20 border border-blue-500 rounded text-blue-400">
                      📋 {duplicateCount} version(s)
                    </span>
                  )}
                  {parcel.curves && parcel.curves.length > 0 && (
                    <span className="ml-2 text-xs px-2 py-1 bg-warning/20 border border-warning rounded text-warning">
                      📐 {parcel.curves.length} Curve(s)
                    </span>
                  )}
                </h3>
                <div className="flex gap-6 text-sm text-dark-300">
                  <span>📐 Area: <strong className="text-success">{parcel.area.toFixed(4)} m²</strong></span>
                  <span>📍 Points: {parcel.pointCount}</span>
                </div>
                {parcel.curves && parcel.curves.length > 0 && (
                  <div className="mt-2 text-xs text-warning">
                    {parcel.curves.map((c, i) => (
                      <span key={i} className="mr-3">
                        {c.from}→{c.to}: M={c.M}{c.sign === 1 ? '(+)' : '(−)'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(parcel)}
                  className="p-2 hover:bg-primary/20 rounded-lg text-primary"
                  title="Load into editor"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(parcel.id);
                  }}
                  className="p-2 hover:bg-danger/20 rounded-lg text-danger"
                  title="Delete parcel"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Points list - read only view */}
            <div className="mt-3 pt-3 border-t border-dark-600">
              <div className="flex flex-wrap gap-2 items-center">
                {parcel.ids.map((id, idx) => (
                  <div key={idx} className="bg-dark-800 border border-primary/30 rounded-lg px-3 py-2 text-primary font-semibold text-sm">
                    {id}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// Memoized list for ALL parcels (including duplicates)
const AllParcelsList = React.memo(({ savedParcels, onEdit, onDelete, onExport }) => {
  if (savedParcels.length === 0) {
    return <p className="text-dark-400 text-center py-12">No saved parcels yet.</p>;
  }

  return (
    <div className="space-y-3">
      {savedParcels.map((parcel, index) => {
        // Check if this parcel number has duplicates
        const duplicateCount = savedParcels.filter(p =>
          p.number.trim().toLowerCase() === parcel.number.trim().toLowerCase()
        ).length;
        const isDuplicate = duplicateCount > 1 && savedParcels.findIndex(p =>
          p.number.trim().toLowerCase() === parcel.number.trim().toLowerCase()
        ) !== index;

        return (
          <div
            key={parcel.id}
            className={`glass-effect rounded-lg p-5 hover:border-primary/50 transition-all group ${isDuplicate ? 'border-l-4 border-blue-500' : ''
              }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-primary mb-2">
                  Parcel #{parcel.number}
                  {isDuplicate && (
                    <span className="ml-2 text-xs px-2 py-1 bg-blue-600/20 border border-blue-500 rounded text-blue-400">
                      🔄 Duplicate #{savedParcels.filter(p =>
                        p.number.trim().toLowerCase() === parcel.number.trim().toLowerCase() &&
                        savedParcels.indexOf(p) <= index
                      ).length} of {duplicateCount}
                    </span>
                  )}
                  {parcel.curves && parcel.curves.length > 0 && (
                    <span className="ml-2 text-xs px-2 py-1 bg-warning/20 border border-warning rounded text-warning">
                      📐 {parcel.curves.length} Curve(s)
                    </span>
                  )}
                </h3>
                <div className="flex gap-6 text-sm text-dark-300">
                  <span>📐 Area: <strong className="text-success">{parcel.area.toFixed(4)} m²</strong></span>
                  <span>📍 Points: {parcel.pointCount}</span>
                </div>
                {parcel.curves && parcel.curves.length > 0 && (
                  <div className="mt-2 text-xs text-warning">
                    {parcel.curves.map((c, i) => (
                      <span key={i} className="mr-3">
                        {c.from}→{c.to}: M={c.M}{c.sign === 1 ? '(+)' : '(−)'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(parcel)}
                  className="p-2 hover:bg-primary/20 rounded-lg text-primary"
                  title="Load into editor"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(parcel);
                  }}
                  className="p-2 hover:bg-success/20 rounded-lg text-success"
                  title="Export as PDF"
                >
                  <FileDown className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(parcel.id);
                  }}
                  className="p-2 hover:bg-danger/20 rounded-lg text-danger"
                  title="Delete parcel"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// Main Component Function End
export default ParcelCalculator;
