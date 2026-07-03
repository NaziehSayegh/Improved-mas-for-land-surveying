import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Save, FileDown, Plus, Trash2, Edit, RefreshCw, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { customConfirm, customPrompt } from '../utils/dialogs';

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
    setSavedErrorCalculations,
    currentParcel,
    setCurrentParcel,
    loadProjectData,
    cadFilePath,
    cadFileName,
    cadEntities,
    cadLayers,
    cadVisibleLayers
  } = useProject();

  // Store the last saved file path locally
  const [lastSavedPath, setLastSavedPath] = useState(projectPath || null);
  const [selectEditParcelMode, setSelectEditParcelMode] = useState(false);
  const selectEditParcelModeRef = useRef(selectEditParcelMode);
  

  // Local state
  const [parcelNumber, setParcelNumber] = useState('');
  const [pointId, setPointId] = useState('');
  const [enteredIds, setEnteredIds] = useState([]);
  const [curves, setCurves] = useState([]); // { from: id, to: id, M: number, sign: +1/-1 }
  const [area, setArea] = useState(null);
  const [perimeter, setPerimeter] = useState(null);
  const [activeTab, setActiveTab] = useState('map'); // default to visual map tab for instant feedback

  // Error calculations state
  const [selectedParcelsForError, setSelectedParcelsForError] = useState([]); // Array of parcel IDs
  const [totalRegisteredArea, setTotalRegisteredArea] = useState(''); // Single registered area for all selected parcels
  const [errorResults, setErrorResults] = useState(null); // Single result object for all parcels
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });
  const [curveFrom, setCurveFrom] = useState('');
  const [curveTo, setCurveTo] = useState('');
  const [curveM, setCurveM] = useState('');
  const [curveSign, setCurveSign] = useState('+');
  const [editingCurveIndex, setEditingCurveIndex] = useState(null); // Index of curve being edited

  // Editing saved parcel state
  const [editingParcelId, setEditingParcelId] = useState(null); // ID of parcel being edited
  const [insertPointAfterIndex, setInsertPointAfterIndex] = useState(null); // Index to insert point after
  const [editingPointIndex, setEditingPointIndex] = useState(null); // Index of point being edited

  // Duplicate parcel dialog state
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateParcel, setDuplicateParcel] = useState(null);
  const [pendingParcelNumber, setPendingParcelNumber] = useState('');

  // --- Canvas Drawing Hooks & State ---
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [zoomDisplay, setZoomDisplay] = useState(1);
  const [showPointLabels, setShowPointLabels] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [showSavedParcelsMap, setShowSavedParcelsMap] = useState(true);
  const [isClosed, setIsClosed] = useState(false);
  
  // Mirror state to refs for callback stability
  const showPointLabelsRef = useRef(showPointLabels);
  const showCoordinatesRef = useRef(showCoordinates);
  const showSavedParcelsMapRef = useRef(showSavedParcelsMap);
  const curvesRef = useRef(curves);
  const enteredIdsRef = useRef(enteredIds);
  const loadedPointsRef = useRef(loadedPoints);
  const savedParcelsRef = useRef(savedParcels);
  const areaRef = useRef(area);
  const parcelNumberRef = useRef(parcelNumber);
  const isClosedRef = useRef(isClosed);

  useEffect(() => { showPointLabelsRef.current = showPointLabels; }, [showPointLabels]);
  useEffect(() => { showCoordinatesRef.current = showCoordinates; }, [showCoordinates]);
  useEffect(() => { showSavedParcelsMapRef.current = showSavedParcelsMap; }, [showSavedParcelsMap]);
  useEffect(() => { curvesRef.current = curves; }, [curves]);
  useEffect(() => { enteredIdsRef.current = enteredIds; }, [enteredIds]);
  useEffect(() => { loadedPointsRef.current = loadedPoints; }, [loadedPoints]);
  useEffect(() => { savedParcelsRef.current = savedParcels; }, [savedParcels]);
  useEffect(() => { areaRef.current = area; }, [area]);
  useEffect(() => { parcelNumberRef.current = parcelNumber; }, [parcelNumber]);
  useEffect(() => { isClosedRef.current = isClosed; }, [isClosed]);

  // Sync context projectPath with local lastSavedPath
  useEffect(() => {
    if (projectPath) {
      setLastSavedPath(projectPath);
    }
  }, [projectPath]);

  // Sync local parcel fields to context currentParcel state
  useEffect(() => {
    setCurrentParcel({
      parcelNumber,
      enteredIds,
      curves
    });
  }, [parcelNumber, enteredIds, curves, setCurrentParcel]);

  // Initialize/sync local parcel fields from context currentParcel state when project loads
  useEffect(() => {
    if (currentParcel) {
      setParcelNumber(currentParcel.parcelNumber || '');
      setEnteredIds(currentParcel.enteredIds || []);
      setCurves(currentParcel.curves || []);
    }
  }, [projectPath]);

  // Helper function to show error toast
  const showErrorToast = useCallback((message) => {
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
  }, []);

  // Helper function to show success toast
  const showSuccessToast = useCallback((message) => {
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
  }, []);

  // Helper function to show confirmation dialog (non-blocking)
  const showConfirmDialog = useCallback((title, message) => {
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
  }, []);

  // Calculate area with active curves
  const updateCalculatedArea = useCallback(async (ids = enteredIds, activeCurves = curves) => {
    if (ids.length < 3) return;
    try {
      const pointsData = ids.map(id => ({
        x: loadedPoints[id].x,
        y: loadedPoints[id].y
      }));

      const curvesWithIndices = activeCurves.map(curve => {
        const fromIndex = ids.findIndex(id => id === curve.from);
        const toIndex = ids.findIndex(id => id === curve.to);
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
        setArea(data.area);
        setPerimeter(data.perimeter);
      } else {
        throw new Error('Calculation failed');
      }
    } catch (error) {
      console.error('Error calculating area:', error);
      showErrorToast('❌ Error calculating area');
    }
  }, [loadedPoints, enteredIds, curves]);



  // Coordinate Conversion Helpers
  const worldToScreen = useCallback((wx, wy) => {
    return {
      x: wx * zoomRef.current + panRef.current.x,
      y: -wy * zoomRef.current + panRef.current.y
    };
  }, []);

  const screenToWorld = useCallback((sx, sy) => {
    return {
      x: (sx - panRef.current.x) / zoomRef.current,
      y: -(sy - panRef.current.y) / zoomRef.current
    };
  }, []);

  const getCentroid = useCallback((pts) => {
    if (!pts || pts.length === 0) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    pts.forEach(p => {
      sx += p.x;
      sy += p.y;
    });
    return { x: sx / pts.length, y: sy / pts.length };
  }, []);

  const isPolygonCCW = useCallback((pts) => {
    if (pts.length < 3) return true;
    let sum = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      if (p1 && p2) {
        sum += p1.x * p2.y - p2.x * p1.y;
      }
    }
    return sum > 0;
  }, []);

  const isPointInPolygon = useCallback((pt, polygon) => {
    const x = pt.x, y = pt.y;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }, []);

  const getArcPoints = useCallback((A, B, M, sign, isCCW) => {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const C = Math.hypot(dx, dy);
    
    if (C < 0.001 || M <= 0) {
      return [A, B];
    }
    
    const R = (C * C) / (8 * M) + M / 2;
    const M_mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    
    // Left normal vector to the chord (pointing to the left of A -> B)
    const nx = -dy / C;
    const ny = dx / C;
    
    // If CCW, addition (+1) is to the right (-normal), subtraction (-1) is to the left (+normal)
    // If CW, addition (+1) is to the left (+normal), subtraction (-1) is to the right (-normal)
    const factor = isCCW ? -sign : sign;
    const dx_arc = nx * factor;
    const dy_arc = ny * factor;
    
    const cx = M_mid.x - (R - M) * dx_arc;
    const cy = M_mid.y - (R - M) * dy_arc;
    
    const angleA = Math.atan2(A.y - cy, A.x - cx);
    const angleB = Math.atan2(B.y - cy, B.x - cx);
    
    let diff = angleB - angleA;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    
    const pts = [];
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = angleA + diff * t;
      pts.push({
        x: cx + R * Math.cos(angle),
        y: cy + R * Math.sin(angle)
      });
    }
    return pts;
  }, []);

  const getBounds = useCallback(() => {
    const points = loadedPointsRef.current;
    if (!points || Object.keys(points).length === 0) return null;
    
    const pts = Object.entries(points).map(([id, pt]) => ({
      id,
      x: pt.x,
      y: pt.y
    }));
    
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    
    return {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      points: pts
    };
  }, []);

  const drawGrid = useCallback((ctx, w, h) => {
    const zoom = zoomRef.current;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const step = 50 / zoom;
    const sw = screenToWorld(0, 0), ew = screenToWorld(w, h);
    const minX = Math.min(sw.x, ew.x), maxX = Math.max(sw.x, ew.x);
    const minY = Math.min(sw.y, ew.y), maxY = Math.max(sw.y, ew.y);
    for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
      const sx = worldToScreen(x, 0).x;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
    }
    for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
      const sy = worldToScreen(0, y).y;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
    }
  }, [screenToWorld, worldToScreen]);

  const drawParcel = useCallback((ctx, parcel, index, isActive = false) => {
    if (!parcel.ids || parcel.ids.length < 2) return;
    const points = loadedPointsRef.current;
    
    let color = '#38bdf8'; // Sky blue for saved
    if (isActive) {
      color = '#a78bfa'; // Purple for active
    } else {
      const colors = ['#34d399', '#f87171', '#fbbf24', '#94a3b8', '#fb923c'];
      color = colors[index % colors.length];
    }
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color + (isActive ? '25' : '08');
    ctx.lineWidth = isActive ? 3 : 1.5;
    ctx.beginPath();
    
    const parcelPts = parcel.ids.map(id => points[id]).filter(Boolean);
    const isCCW = isPolygonCCW(parcelPts);

    for (let i = 0; i < parcel.ids.length; i++) {
      const id1 = parcel.ids[i];
      const id2 = parcel.ids[(i + 1) % parcel.ids.length];
      const pt1 = points[id1];
      const pt2 = points[id2];
      if (!pt1 || !pt2) continue;

      const curve = parcel.curves?.find(c => 
        (c.from === id1 && c.to === id2) || 
        (c.from === id2 && c.to === id1)
      );

      if (curve && curve.M > 0) {
        const isReversed = curve.from === id2 && curve.to === id1;
        const drawSign = isReversed ? -curve.sign : curve.sign;
        const arcPts = getArcPoints(pt1, pt2, curve.M, drawSign, isCCW);
        arcPts.forEach((ap, api) => {
          const s = worldToScreen(ap.x, ap.y);
          if (i === 0 && api === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
      } else {
        const s1 = worldToScreen(pt1.x, pt1.y);
        const s2 = worldToScreen(pt2.x, pt2.y);
        if (i === 0) ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
      }
    }
    
    if (parcel.ids.length > 2) {
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    
    if (parcel.number) {
      let sx = 0, sy = 0, cnt = 0;
      parcel.ids.forEach(id => {
        const pt = points[id];
        if (pt) { sx += pt.x; sy += pt.y; cnt++; }
      });
      if (cnt > 0) {
        const s = worldToScreen(sx / cnt, sy / cnt);
        ctx.fillStyle = color;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Parcel ${parcel.number}`, s.x, s.y);
      }
    }
  }, [worldToScreen, getArcPoints, isPolygonCCW]);

  const drawActiveParcelLines = useCallback((ctx) => {
    const activeIds = enteredIdsRef.current;
    const points = loadedPointsRef.current;
    const activeCurves = curvesRef.current;
    if (activeIds.length === 0) return;
    
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    let activePathClosed = false;
    if (activeIds.length > 2) {
      if (activeIds[activeIds.length - 1] === activeIds[0] || isClosed || area !== null) {
        activePathClosed = true;
      }
    }
    
    const activePts = activeIds.map(id => points[id]).filter(Boolean);
    const isCCW = isPolygonCCW(activePts);

    const numPoints = activeIds.length;
    const isExplicitlyClosed = numPoints > 2 && activeIds[numPoints - 1] === activeIds[0];
    const limit = (activePathClosed && !isExplicitlyClosed) ? numPoints : numPoints - 1;

    for (let i = 0; i < limit; i++) {
      const id1 = activeIds[i];
      const id2 = activeIds[(i + 1) % numPoints];
      const pt1 = points[id1];
      const pt2 = points[id2];
      if (!pt1 || !pt2) continue;

      const curve = activeCurves?.find(c => 
        (c.from === id1 && c.to === id2) || 
        (c.from === id2 && c.to === id1)
      );

      if (curve && curve.M > 0) {
        const isReversed = curve.from === id2 && curve.to === id1;
        const drawSign = isReversed ? -curve.sign : curve.sign;
        const arcPts = getArcPoints(pt1, pt2, curve.M, drawSign, isCCW);
        arcPts.forEach((ap, api) => {
          const s = worldToScreen(ap.x, ap.y);
          if (i === 0 && api === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
      } else {
        const s1 = worldToScreen(pt1.x, pt1.y);
        const s2 = worldToScreen(pt2.x, pt2.y);
        if (i === 0) ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
      }
    }
    
    if (activePathClosed) {
      ctx.fillStyle = 'rgba(167, 139, 250, 0.15)';
      ctx.fill();
    }
    ctx.stroke();
  }, [worldToScreen, getArcPoints, isPolygonCCW, area, isClosed]);

  const drawPoint = useCallback((ctx, id, pt) => {
    const activeIds = enteredIdsRef.current;
    const s = worldToScreen(pt.x, pt.y);
    const isActivePoint = activeIds.includes(id);
    
    ctx.beginPath();
    ctx.arc(s.x, s.y, isActivePoint ? 7 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isActivePoint ? '#a78bfa' : '#475569';
    ctx.fill();
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = isActivePoint ? 1.5 : 1;
    ctx.stroke();
    
    if (showPointLabelsRef.current) {
      ctx.fillStyle = isActivePoint ? '#e9d5ff' : '#94a3b8';
      ctx.font = isActivePoint ? 'bold 11px Inter, monospace' : '9px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(id, s.x, s.y - (isActivePoint ? 10 : 8));
    }
    
    if (showCoordinatesRef.current) {
      ctx.font = '8px monospace';
      ctx.fillStyle = '#6e7681';
      ctx.fillText(`(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`, s.x, s.y + 15);
    }
  }, [worldToScreen]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bounds = getBounds();
    
    ctx.fillStyle = '#0f172a'; // Deep slate background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!bounds || bounds.points.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No points loaded. Load a points file (.pnt/.txt) to begin visual mapping.', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    drawGrid(ctx, canvas.width, canvas.height);
    
    // Draw saved parcels
    if (showSavedParcelsMapRef.current) {
      const parcels = savedParcelsRef.current;
      parcels.forEach((p, index) => {
        drawParcel(ctx, p, index, false);
      });
    }
    
    // Draw active parcel lines
    drawActiveParcelLines(ctx);
    
    // Draw all points
    bounds.points.forEach(p => {
      drawPoint(ctx, p.id, loadedPointsRef.current[p.id]);
    });
  }, [getBounds, drawGrid, drawParcel, drawActiveParcelLines, drawPoint]);

  useEffect(() => {
    selectEditParcelModeRef.current = selectEditParcelMode;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = selectEditParcelMode ? 'pointer' : 'crosshair';
    }
    drawCanvas();
  }, [selectEditParcelMode, drawCanvas]);

  const resetView = useCallback(() => {
    const bounds = getBounds();
    const canvas = canvasRef.current;
    if (!bounds || !canvas) return;
    const padding = 60;
    const scaleX = (canvas.width - padding * 2) / Math.max(bounds.width, 1);
    const scaleY = (canvas.height - padding * 2) / Math.max(bounds.height, 1);
    const scale = Math.min(scaleX, scaleY, 100);
    zoomRef.current = scale;
    panRef.current = {
      x: canvas.width / 2 - bounds.centerX * scale,
      y: canvas.height / 2 + bounds.centerY * scale
    };
    setZoomDisplay(scale);
    drawCanvas();
  }, [getBounds, drawCanvas]);



  // Redraw when data changes
  useEffect(() => {
    if (activeTab === 'map') {
      drawCanvas();
    }
  }, [loadedPoints, savedParcels, enteredIds, area, isClosed, showPointLabels, showCoordinates, showSavedParcelsMap, activeTab, drawCanvas]);

  // Enter/ESC keyboard shortcut listeners for the confirm dialog
  useEffect(() => {
    if (!confirmDialog.isOpen) return;

    const handleConfirmKeys = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmDialog.onConfirm?.(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        confirmDialog.onConfirm?.(false);
      }
    };

    window.addEventListener('keydown', handleConfirmKeys);
    return () => window.removeEventListener('keydown', handleConfirmKeys);
  }, [confirmDialog]);

  // Auto-fit view when points are loaded
  const hasPoints = Object.keys(loadedPoints).length > 0;
  useEffect(() => {
    if (hasPoints && activeTab === 'map') {
      setTimeout(resetView, 100);
    }
  }, [hasPoints, activeTab]);


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
          if (currentParcels.length > 0 && parcelNumber.trim().toLowerCase() === currentParcels[0].number.trim().toLowerCase() && !editingParcelId) {
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



  // Add point ID
  const handleAddPoint = () => {
    if (isClosed || area !== null) {
      showErrorToast('⚠️ Boundary is already closed! Save or clear the active parcel first.');
      return;
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
      closePolygonAndPrompt(enteredIds);
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



  // Recalculate area when curves change (if the area is calculated / loop closed)
  useEffect(() => {
    if (area !== null && enteredIds.length >= 3) {
      updateCalculatedArea(enteredIds, curves);
    }
  }, [curves]);

  // Add curve
  const handleAddCurve = () => {
    if (!curveFrom || !curveTo || !curveM) {
      showErrorToast('Fill all curve fields!');
      return;
    }

    const mValue = parseFloat(curveM);
    if (isNaN(mValue) || mValue <= 0) {
      showErrorToast('Ordinate (M) must be a positive number!');
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
      M: mValue,
      sign: curveSign === '+' ? 1 : -1
    };

    setCurves([...curves, newCurve]);
    setCurveFrom('');
    setCurveTo('');
    setCurveM('');

    // Auto-focus back to "From" for rapid entry
    setTimeout(() => {
      const fromInput = document.getElementById('sidebar-curve-from');
      if (fromInput) {
        fromInput.focus();
        fromInput.select?.();
      }
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
      const fromInput = document.getElementById('sidebar-curve-from');
      if (fromInput) {
        fromInput.focus();
        fromInput.select?.();
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

    const mValue = parseFloat(curveM);
    if (isNaN(mValue) || mValue <= 0) {
      showErrorToast('Ordinate (M) must be a positive number!');
      return;
    }

    const updatedCurves = [...curves];
    updatedCurves[editingCurveIndex] = {
      from: curveFrom,
      to: curveTo,
      M: mValue,
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
    setIsClosed(false);

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
      setIsClosed(false);
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
      setIsClosed(false);
      showSuccessToast('✅ Points reset');
    }
  };

  // Delete point at index
  const handleDeletePoint = (index) => {
    const newIds = enteredIds.filter((_, i) => i !== index);
    setEnteredIds(newIds);
    setArea(null);
    setPerimeter(null);
    setIsClosed(false);
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
    setIsClosed(true);
    setActiveTab('map');
    // Close duplicate dialog if open
    setShowDuplicateDialog(false);
    setDuplicateParcel(null);
    setPendingParcelNumber('');
  };

  // Handle duplicate parcel dialog - Replace option
  const handleReplaceDuplicate = () => {
    if (duplicateParcel) {
      if (enteredIds.length >= 3 && area) {
        // We have a newly drawn parcel in the editor! Overwrite/replace the existing duplicate parcel with this data.
        const updatedParcels = savedParcels.map(p => {
          if (p.id === duplicateParcel.id) {
            return {
              ...p,
              number: pendingParcelNumber || parcelNumber,
              ids: [...enteredIds],
              area: area || p.area,
              perimeter: perimeter || p.perimeter,
              curves: [...curves],
              pointCount: enteredIds.length
            };
          }
          return p;
        });

        setSavedParcels(updatedParcels);
        setHasUnsavedChanges(true);

        // Reset editor state
        setEditingParcelId(null);
        setParcelNumber('');
        setEnteredIds([]);
        setArea(null);
        setPerimeter(null);
        setCurves([]);
        setIsClosed(false);
        setShowDuplicateDialog(false);
        setDuplicateParcel(null);
        setPendingParcelNumber('');

        // Show toast notification
        const toast = document.createElement('div');
        toast.innerHTML = `✅ Overwrote existing parcel "${duplicateParcel.number}" with new drawing!`;
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
          animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.style.animation = 'slideOut 0.3s ease-out';
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      } else {
        // Load the existing parcel for editing
        handleLoadSavedParcel(duplicateParcel);
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
    setParcelNumber('');
    setEnteredIds([]);
    setArea(null);
    setPerimeter(null);
    setCurves([]);
    setIsClosed(false);

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

  // Helper to close polygon, calculate, and prompt for curves
  const closePolygonAndPrompt = useCallback(async (ids) => {
    setIsClosed(true);
    // 1. Calculate area and perimeter
    await updateCalculatedArea(ids, curves);

    // 2. Ask user if there are any curves
    const hasCurves = await showConfirmDialog(
      'Curves Adjustment',
      'Boundary closed successfully! Are there any curves to adjust on this parcel?'
    );

    if (hasCurves) {
      // Focus "From Pt" input
      setTimeout(() => {
        const fromInput = document.getElementById('sidebar-curve-from');
        if (fromInput) {
          fromInput.focus();
          fromInput.select?.();
        }
      }, 150);
    } else {
      // Ask if they want to save the parcel now
      const shouldSave = await showConfirmDialog(
        'Save Parcel',
        'Would you like to save this parcel now?'
      );
      if (shouldSave) {
        if (!parcelNumberRef.current || !parcelNumberRef.current.trim()) {
          showErrorToast('⚠️ Please enter a parcel number first!');
          setTimeout(() => {
            const numInput = document.getElementById('parcel-number-input');
            if (numInput) {
              numInput.focus();
            }
          }, 150);
        } else {
          if (editingParcelId) {
            handleUpdateSavedParcel();
          } else {
            handleSaveParcel();
          }
        }
      } else {
        // Focus "Save/Update Parcel" button
        setTimeout(() => {
          const saveBtn = document.getElementById('save-parcel-btn');
          if (saveBtn) {
            saveBtn.focus();
          }
        }, 150);
      }
    }
  }, [curves, updateCalculatedArea, showConfirmDialog, handleSaveParcel, handleUpdateSavedParcel, editingParcelId, showErrorToast]);

  // Setup canvas listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container || activeTab !== 'map') return;
    
    const resize = () => {
      const r = container.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
      drawCanvas();
    };
    
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const oldZ = zoomRef.current;
      const newZ = Math.max(0.01, Math.min(200, oldZ * delta));
      const scale = newZ / oldZ;
      panRef.current = {
        x: mx - (mx - panRef.current.x) * scale,
        y: my - (my - panRef.current.y) * scale
      };
      zoomRef.current = newZ;
      setZoomDisplay(newZ);
      drawCanvas();
    };
    
    const onDown = (e) => {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };
    
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      panRef.current = {
        x: panRef.current.x + (e.clientX - dragStartRef.current.x),
        y: panRef.current.y + (e.clientY - dragStartRef.current.y)
      };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      drawCanvas();
    };
    
    const onMouseUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = selectEditParcelModeRef.current ? 'pointer' : 'crosshair';
    };
    
    const onClick = async (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      
      if (selectEditParcelModeRef.current) {
        // SELECT/EDIT PARCEL MODE: check if clicked a parcel or its number label
        const worldPt = screenToWorld(cx, cy);
        console.log('[EditMode Click] cx:', cx, 'cy:', cy, 'worldPt:', worldPt);
        
        const currentSavedParcels = savedParcelsRef.current || [];
        const currentPoints = loadedPointsRef.current || {};
        console.log('[EditMode Click] Total saved parcels in state:', currentSavedParcels.length);
        
        const candidates = [];
        
        for (let i = 0; i < currentSavedParcels.length; i++) {
          const parcel = currentSavedParcels[i];
          const pts = (parcel.ids || []).map(id => currentPoints[id]).filter(Boolean);
          if (pts.length >= 3) {
            // Check 1: Point in polygon
            const isInside = isPointInPolygon(worldPt, pts);
            
            // Check 2: Near label centroid
            let isNearLabel = false;
            let sx = 0, sy = 0, cnt = 0;
            parcel.ids.forEach(id => {
              const pt = currentPoints[id];
              if (pt) { sx += pt.x; sy += pt.y; cnt++; }
            });
            let distToLabel = Infinity;
            if (cnt > 0) {
              const s = worldToScreen(sx / cnt, sy / cnt);
              distToLabel = Math.hypot(s.x - cx, s.y - cy);
              if (distToLabel < 30) { // 30px click radius around label
                isNearLabel = true;
              }
            }
            
            console.log(`[EditMode Click] Checking Parcel #${parcel.number}: isInside=${isInside}, isNearLabel=${isNearLabel} (distToLabel=${distToLabel !== Infinity ? distToLabel.toFixed(1) : 'N/A'}), pointCount=${pts.length}`);
            
            if (isInside || isNearLabel) {
              candidates.push({
                parcel,
                isInside,
                isNearLabel,
                distToLabel,
                area: parcel.area || 0
              });
            }
          } else {
            console.log(`[EditMode Click] Skipped Parcel #${parcel.number} (less than 3 valid points: ${pts.length})`);
          }
        }
        
        let clickedParcel = null;
        if (candidates.length > 0) {
          // Sort candidates:
          // 1. Prioritize near label
          // 2. Sort by distance to label if both near label
          // 3. Otherwise, sort by area ascending (smallest area first, e.g. nested parcels)
          candidates.sort((a, b) => {
            if (a.isNearLabel && !b.isNearLabel) return -1;
            if (!a.isNearLabel && b.isNearLabel) return 1;
            if (a.isNearLabel && b.isNearLabel) {
              return a.distToLabel - b.distToLabel;
            }
            return a.area - b.area;
          });
          clickedParcel = candidates[0].parcel;
          console.log(`[EditMode Click] MATCH FOUND: Selected Parcel #${clickedParcel.number} out of ${candidates.length} candidates`);
        }
        
        if (clickedParcel) {
          const confirmEdit = await showConfirmDialog(
            'Edit Parcel',
            `Would you like to edit Parcel #${clickedParcel.number}?`
          );
          if (confirmEdit) {
            handleLoadSavedParcel(clickedParcel);
            setSelectEditParcelMode(false);
          }
        } else {
          // Diagnostic toast to show what went wrong
          const matchLogs = currentSavedParcels.map(p => {
            const pts = (p.ids || []).map(id => currentPoints[id]).filter(Boolean);
            const inside = isPointInPolygon(worldPt, pts);
            let dist = 'N/A';
            let sx = 0, sy = 0, cnt = 0;
            p.ids.forEach(id => {
              const pt = currentPoints[id];
              if (pt) { sx += pt.x; sy += pt.y; cnt++; }
            });
            if (cnt > 0) {
              const s = worldToScreen(sx / cnt, sy / cnt);
              dist = Math.hypot(s.x - cx, s.y - cy).toFixed(1) + 'px';
            }
            return `#${p.number}: inside=${inside}, dist=${dist}, pts=${pts.length}/${p.ids ? p.ids.length : 0}`;
          }).reverse().slice(0, 5).join('<br/>');
          
          showErrorToast(`❌ Click at (${worldPt.x.toFixed(1)}, ${worldPt.y.toFixed(1)}) did not match any parcel.<br/><br/><b>Checked Parcels:</b><br/>${matchLogs || 'None saved'}`);
        }
        return;
      }

      // NORMAL MODE: select point to build parcel
      const bounds = getBounds();
      if (!bounds) return;
      
      let closest = null;
      let minD = Infinity;
      bounds.points.forEach(p => {
        const s = worldToScreen(p.x, p.y);
        const d = Math.hypot(s.x - cx, s.y - cy);
        if (d < 15 && d < minD) {
          minD = d;
          closest = p.id;
        }
      });
      
      if (closest) {
        // If the boundary is already closed (isClosedRef.current || areaRef.current !== null), block selection of more points
        const isClosed = isClosedRef.current || areaRef.current !== null;
        if (isClosed) {
          showErrorToast('⚠️ Boundary is already closed! Please save or clear the active parcel first.');
          return;
        }

        // Double check if polygon closed (first ID re-clicked)
        if (enteredIdsRef.current.length > 2 && closest === enteredIdsRef.current[0]) {
          closePolygonAndPrompt(enteredIdsRef.current);
        } else if (!enteredIdsRef.current.includes(closest)) {
          setEnteredIds(prev => [...prev, closest]);
          setArea(null);
          setPerimeter(null);
        }
      }
    };
    
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('click', onClick);
    
    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('click', onClick);
    };
  }, [activeTab, drawCanvas, getBounds, worldToScreen, screenToWorld, closePolygonAndPrompt, isPointInPolygon, showConfirmDialog, handleLoadSavedParcel]);

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
      cadFilePath: cadFilePath || '',
      cadFileName: cadFileName || '',
      cadEntities: cadEntities || [],
      cadLayers: cadLayers || [],
      cadVisibleLayers: cadVisibleLayers || {},
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

        // Clear local UI state
        setParcelNumber('');
        setEnteredIds([]);
        setArea(null);
        setPerimeter(null);
        setCurves([]);

        // Now load the NEW project's data into global context
        const finalPath = result.filePath || filePath;
        if (finalPath) {
          setLastSavedPath(finalPath);
        }
        loadProjectData(projectData, finalPath);

        // Load current parcel UI state if it exists
        if (projectData.currentParcel) {
          setParcelNumber(projectData.currentParcel.parcelNumber || '');
          setEnteredIds(projectData.currentParcel.enteredIds || []);
          setCurves(projectData.currentParcel.curves || []);
        } else {
          setParcelNumber('');
          setEnteredIds([]);
          setCurves([]);
        }

        showSuccessToast(`✅ Project "${projectData.projectName}" loaded successfully!<br/><br/>Parcels: ${projectData.savedParcels?.length || 0}<br/>Points: ${Object.keys(projectData.loadedPoints || {}).length}<br/><br/>🔄 Points file is being watched for changes!`);

        const hasCad = Boolean(projectData.cadFilePath || (projectData.cadEntities && projectData.cadEntities.length > 0) || projectData.cadFileName);
        if (hasCad) {
          navigate('/dxf-import');
          return;
        }

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
    if (hasUnsavedChanges && !(await customConfirm('You have unsaved changes. Create new project?'))) {
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
    const nameInput = (await customPrompt('Name your new project:', defaultSuggestion)) ?? '';
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

  // Navigate back to main menu with unsaved changes verification
  const handleBackToMainMenu = useCallback(async () => {
    const currentProjectPath = lastSavedPath || projectPath;

    if (hasUnsavedChanges) {
      const result = await showUnsavedChangesDialog(
        globalProjectName
          ? `Save changes to "${globalProjectName}" before exiting?`
          : 'Save changes before exiting?'
      );

      if (result === 'save') {
        try {
          const saved = await handleSaveProject(!currentProjectPath);
          if (!saved) return; // User cancelled save - don't navigate
        } catch (error) {
          console.log('Save failed or cancelled:', error);
          return;
        }
      } else if (result === 'cancel') {
        return; // Stay on the page
      }
    }

    navigate('/');
  }, [navigate, hasUnsavedChanges, lastSavedPath, projectPath, globalProjectName]);

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
  const handleDeleteErrorCalculation = async (id) => {
    if (await customConfirm('Are you sure you want to delete this saved calculation?')) {
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
          errorResults: null,
          isBuggy: false
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
          savedErrorCalculations: savedErrorCalculations, // Sending all saved calculations
          isBuggy: false
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
        if (!showDuplicateDialog && !confirmDialog.isOpen) {
          e.preventDefault();
          handleBackToMainMenu();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleBackToMainMenu, showDuplicateDialog, confirmDialog.isOpen]);

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-900 text-white overflow-hidden select-none">
      {/* Portals / Overlay Dialogs */}
      {/* Duplicate Parcel Dialog - Non-blocking */}
      {showDuplicateDialog && duplicateParcel && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            pointerEvents: 'auto'
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-800 border-2 border-warning rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-warning flex items-center gap-2">⚠️ Duplicate Parcel</h2>
              <button
                onClick={() => {
                  setShowDuplicateDialog(false);
                  setDuplicateParcel(null);
                  setPendingParcelNumber('');
                }}
                className="text-dark-400 hover:text-white text-xl font-bold"
              >
                ×
              </button>
            </div>
            <p className="text-dark-200 mb-4 text-sm">
              Parcel number <strong className="text-primary">"{pendingParcelNumber}"</strong> already exists!
            </p>

            <div className="bg-dark-700 rounded-xl p-4 mb-4 border border-dark-600">
              <p className="text-dark-400 text-xs mb-1">Existing Parcel Details:</p>
              <div className="text-dark-100 text-sm">
                <p><strong>Parcel #{duplicateParcel.number}</strong></p>
                <p className="text-xs text-dark-300 mt-1">
                  📐 Area: {duplicateParcel.area?.toFixed(4) || 'N/A'} m² |
                  📍 Points: {duplicateParcel.pointCount || duplicateParcel.ids?.length || 0}
                </p>
              </div>
            </div>

            <p className="text-dark-200 mb-4 text-sm">What would you like to do?</p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleReplaceDuplicate}
                className="btn-primary w-full py-2.5 text-sm"
              >
                ✏️ Edit Existing
              </button>
              <button
                onClick={handleCreateNewDuplicate}
                className="btn-success w-full py-2.5 text-sm"
              >
                ➕ Create New (Allow Duplicate)
              </button>
              <button
                onClick={handleCancelDuplicate}
                className="btn-secondary w-full py-2.5 text-sm border-danger/30 text-danger hover:bg-danger/10"
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
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 10000,
            pointerEvents: 'auto'
          }}
          onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-800 border-2 border-warning rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">⚠️ {confirmDialog.title}</h2>
            <p className="text-dark-300 mb-5 text-sm font-medium leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm(false)}
                className="px-5 py-2 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDialog.onConfirm && confirmDialog.onConfirm(true)}
                className="px-5 py-2 rounded-lg bg-success text-white hover:bg-success/90 transition-colors text-sm font-bold shadow-lg"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}



      {/* ── Main Toolbar ── */}
      <header className="flex-shrink-0 bg-dark-800/90 border-b border-dark-700 px-6 py-3 flex items-center justify-between backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <button onClick={handleBackToMainMenu} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            ↩ Main Menu
          </button>
          <button onClick={handleCloseProject} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600/20 border-red-600/30 text-red-400">
            Close Project
          </button>
          
          {/* File watch / Loaded info */}
          {pointsFileName && (
            <div className="text-xs bg-success/10 border border-success/30 px-2.5 py-1 rounded-lg text-success flex items-center gap-1.5">
              <span>📁 {pointsFileName} ({Object.keys(loadedPoints).length} pts)</span>
              {isWatchingFile && <span className="animate-pulse">🔄 watched</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {globalProjectName && (
            <div className="text-xs bg-primary/15 border border-primary/30 px-3 py-1 rounded-lg text-primary font-semibold">
              Project: {globalProjectName} {hasUnsavedChanges && <span className="text-warning text-xs">● Unsaved</span>}
            </div>
          )}
          
          <button onClick={handleNewProject} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New
          </button>

          <input type="file" accept=".prcl" onChange={handleLoadProject} style={{ display: 'none' }} id="load-project" />
          <label htmlFor="load-project" className="btn-secondary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1.5 mb-0 font-medium">
            <Upload className="w-3.5 h-3.5" /> Open
          </label>

          <button onClick={handleSmartSave} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save {hasUnsavedChanges && <span className="animate-bounce">💾</span>}
          </button>
          
          <button onClick={handleSaveAs} className="btn-secondary py-1.5 px-3 text-xs">
            Save As...
          </button>

          <input type="file" accept=".pnt,.txt,.csv" onChange={handleLoadFile} style={{ display: 'none' }} id="load-points" />
          <label htmlFor="load-points" className="btn-secondary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1.5 mb-0 font-medium bg-dark-700/60">
            <Upload className="w-3.5 h-3.5" /> Load Points
          </label>

          <button onClick={handleExportAll} disabled={savedParcels.length === 0} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
            <FileDown className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </header>

      {/* ── Main Workspace split layout ── */}
      <main className="flex-grow min-h-0 flex relative">
        
        {/* Left column - Point Entry & Path Editor */}
        <section className="w-[360px] flex-shrink-0 bg-dark-850 border-r border-dark-700 flex flex-col min-h-0 h-full">
          <div className="p-4 border-b border-dark-700 flex-shrink-0">
            <h2 className="text-sm font-bold text-dark-200 mb-2 uppercase tracking-wide">1. Parcel Details</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-dark-400 text-xs mb-1 font-semibold">Parcel Number:</label>
                <input
                  type="text"
                  value={parcelNumber}
                  onChange={(e) => {
                    setParcelNumber(e.target.value);
                    if (showDuplicateDialog) {
                      setShowDuplicateDialog(false);
                      setDuplicateParcel(null);
                      setPendingParcelNumber('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('point-id-input')?.focus();
                    }
                  }}
                  className="w-full bg-dark-800 border-2 border-dark-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="e.g. 102/B"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-dark-400 text-xs mb-1 font-semibold">Add Corner Point ID:</label>
                <div className="flex gap-1.5">
                  <input
                    id="point-id-input"
                    type="text"
                    value={pointId}
                    onChange={(e) => setPointId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPoint();
                      }
                    }}
                    disabled={isClosed || area !== null}
                    className="flex-1 bg-dark-800 border-2 border-dark-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={(isClosed || area !== null) ? "Boundary is closed" : "Point ID"}
                    autoComplete="off"
                  />
                  <button 
                    onClick={handleAddPoint} 
                    disabled={isClosed || area !== null}
                    className="bg-primary hover:bg-primary-light text-white text-xs px-3 rounded font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ADD
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-dark-750/50">
              <button onClick={handleUndo} disabled={enteredIds.length === 0} className="btn-secondary py-1 px-2.5 text-[11px] flex-1 flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3" /> Undo Point
              </button>
              <button onClick={handleReset} disabled={enteredIds.length === 0} className="btn-secondary py-1 px-2.5 text-[11px] flex-1 flex items-center justify-center gap-1 hover:border-danger/45 hover:text-danger">
                <Trash2 className="w-3 h-3" /> Clear Active
              </button>
            </div>
          </div>

          {/* Current point list (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-dark-850/40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-dark-300 uppercase tracking-wider">Active Corners ({enteredIds.length})</h3>
              {editingParcelId && <span className="text-warning text-xs font-semibold">✏️ Editing saved</span>}
            </div>

            {enteredIds.length === 0 ? (
              <div className="h-[200px] border border-dashed border-dark-700 rounded-lg flex flex-col items-center justify-center p-4 text-center">
                <p className="text-dark-500 text-xs mb-1">No points entered yet.</p>
                <p className="text-dark-600 text-[10px]">Type Point IDs or click markers on the visual map to add corners.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {enteredIds.map((id, index) => (
                  <div key={index} className="flex flex-col">
                    {/* Insert point before this point indicator */}
                    {index > 0 && (
                      <div className="flex items-center justify-center h-4 group/insert">
                        <button
                          onClick={() => handleInsertPointAt(index - 1)}
                          className="opacity-0 group-hover/insert:opacity-100 hover:opacity-100 transition-all text-primary bg-primary/10 border border-primary/30 text-[9px] px-2 py-0.5 rounded-full"
                          title="Insert point here"
                        >
                          + Insert between
                        </button>
                      </div>
                    )}

                    <div className={`flex items-center justify-between bg-dark-800 rounded p-2 border ${editingPointIndex === index ? 'border-warning' : 'border-dark-700/80'} group hover:border-dark-600 transition-all`}>
                      <div className="flex items-center gap-2">
                        <span className="text-dark-500 text-[10px] w-4">{index + 1}.</span>
                        <span className="text-primary font-mono font-bold text-sm">{id}</span>
                        {loadedPoints[id] && (
                          <span className="text-[10px] text-dark-405">
                            ({loadedPoints[id].y.toFixed(1)}, {loadedPoints[id].x.toFixed(1)})
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingPointIndex(index);
                            setPointId(id);
                            setInsertPointAfterIndex(null);
                            document.getElementById('point-id-input')?.focus();
                          }}
                          className="text-warning text-xs hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePoint(index)}
                          className="text-danger text-xs hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Loop indicator */}
            {enteredIds.length > 0 && (
              <div className="mt-3 text-[11px] text-dark-400 bg-dark-800/40 p-2 rounded border border-dark-800 text-center">
                {enteredIds.length >= 3 ? (
                  <span>Enter <strong className="text-primary">"{enteredIds[0]}"</strong> again to close loop and calculate area</span>
                ) : (
                  <span>Add at least 3 points to draw polygon</span>
                )}
              </div>
            )}
          </div>

          {/* Curves Adjustment (Sidebar Section) */}
          {enteredIds.length >= 3 && (
            <div className="p-4 border-t border-dark-700 bg-dark-900/30 flex-shrink-0">
              <h3 className="text-xs font-bold text-dark-300 uppercase tracking-wider mb-2">3. Curves Adjustment</h3>
              
              {/* Curve Input Form */}
              <div className="bg-dark-800/60 rounded-xl p-3 mb-3 border border-dark-750 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-dark-400 text-[10px] mb-0.5">From Pt:</label>
                    <input
                      id="sidebar-curve-from"
                      type="text"
                      value={curveFrom}
                      onChange={(e) => setCurveFrom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !curveFrom.trim()) {
                          e.preventDefault();
                          document.getElementById('save-parcel-btn')?.focus();
                        } else {
                          handleCurveInputKeyDown(e, 'sidebar-curve-to');
                        }
                      }}
                      className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-primary"
                      placeholder="e.g. 1"
                    />
                  </div>
                  <div>
                    <label className="block text-dark-400 text-[10px] mb-0.5">To Pt:</label>
                    <input
                      id="sidebar-curve-to"
                      type="text"
                      value={curveTo}
                      onChange={(e) => setCurveTo(e.target.value)}
                      onKeyDown={(e) => handleCurveInputKeyDown(e, 'sidebar-curve-m')}
                      className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-primary"
                      placeholder="e.g. 2"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-dark-400 text-[10px] mb-0.5">Ordinate (M):</label>
                    <input
                      id="sidebar-curve-m"
                      type="text"
                      value={curveM}
                      onChange={(e) => setCurveM(e.target.value)}
                      onKeyDown={(e) => handleCurveInputKeyDown(e)}
                      className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-primary"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-dark-400 text-[10px] mb-0.5">Sign:</label>
                    <select
                      value={curveSign}
                      onChange={(e) => setCurveSign(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-0.5 text-white text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="+">+ Add (convex)</option>
                      <option value="-">− Subtract (concave)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-1.5 pt-1">
                  {editingCurveIndex !== null ? (
                    <>
                      <button onClick={handleCancelEdit} className="btn-secondary py-1 px-2.5 text-[10px] border-danger/30 text-danger hover:bg-danger/10">
                        Cancel
                      </button>
                      <button onClick={handleAddCurve} className="btn-primary flex-1 py-1 text-[10px]">
                        Update
                      </button>
                    </>
                  ) : (
                    <button onClick={handleAddCurve} className="btn-secondary w-full py-1 text-[10px] border-primary/30 text-primary hover:bg-primary/10">
                      + Add Curve
                    </button>
                  )}
                </div>
              </div>

              {/* Curves List */}
              {curves.length > 0 && (
                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                  {curves.map((curve, index) => (
                    <div key={index} className="flex items-center justify-between bg-dark-800 rounded p-1.5 border border-dark-700/60 text-[11px]">
                      <span className={curve.sign === 1 ? 'text-success' : 'text-danger'}>
                        {curve.from} → {curve.to}: M={curve.M} ({curve.sign === 1 ? '+' : '−'})
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => handleStartEditCurve(index)} className="text-warning hover:underline text-[10px]">Edit</button>
                        <button onClick={() => setCurves(curves.filter((_, i) => i !== index))} className="text-danger hover:underline text-[10px]">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Area result bottom card */}
          {area !== null && (
            <div className="p-4 bg-gradient-to-br from-success/15 to-success/5 border-t border-success/30 flex-shrink-0">
              <h4 className="text-xs font-bold text-success uppercase tracking-wider mb-2">Calculated Results</h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-dark-900/60 p-2 rounded border border-success/15">
                  <p className="text-dark-400 text-[9px] mb-0.5">Area</p>
                  <p className="text-base font-mono font-bold text-success">{area.toFixed(4)} m²</p>
                </div>
                <div className="bg-dark-900/60 p-2 rounded border border-dark-700/50">
                  <p className="text-dark-400 text-[9px] mb-0.5">Perimeter</p>
                  <p className="text-base font-mono font-bold text-dark-100">{perimeter.toFixed(2)} m</p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                {editingParcelId ? (
                  <button id="save-parcel-btn" onClick={handleUpdateSavedParcel} className="btn-success w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                ) : (
                  <button id="save-parcel-btn" onClick={handleSaveParcel} className="btn-success w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Save Parcel
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right column - Utility Tab Panels */}
        <section className="flex-grow min-w-0 bg-dark-950 flex flex-col h-full">
          {/* Tabs header */}
          <div className="flex-shrink-0 bg-dark-900 border-b border-dark-700 px-4 flex items-center justify-between">
            <div className="flex">
              <button
                onClick={() => setActiveTab('map')}
                className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'map' ? 'border-primary text-primary bg-dark-950/30' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                🗺️ Visual Map
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'saved' ? 'border-primary text-primary bg-dark-950/30' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                📁 Saved Parcels ({(() => {
                  const unique = new Set(savedParcels.map(p => p.number.trim().toLowerCase()));
                  return unique.size;
                })()})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'all' ? 'border-primary text-primary bg-dark-950/30' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                📋 All Versions ({savedParcels.length})
              </button>
              <button
                onClick={() => setActiveTab('errors')}
                className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'errors' ? 'border-primary text-primary bg-dark-950/30' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                📊 Error Calculations
              </button>
              <button
                onClick={() => setActiveTab('help')}
                className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'help' ? 'border-primary text-primary bg-dark-950/30' : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                📘 User Guide
              </button>
            </div>

            {activeTab === 'map' && hasPoints && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-dark-400 font-mono">Zoom: {(zoomDisplay).toFixed(1)}x</span>
                <div className="h-4 w-px bg-dark-700"></div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      zoomRef.current = Math.min(200, zoomRef.current * 1.25);
                      setZoomDisplay(zoomRef.current);
                      drawCanvas();
                    }}
                    className="p-1 hover:bg-dark-800 text-dark-300 rounded border border-dark-700"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      zoomRef.current = Math.max(0.01, zoomRef.current * 0.8);
                      setZoomDisplay(zoomRef.current);
                      drawCanvas();
                    }}
                    className="p-1 hover:bg-dark-800 text-dark-300 rounded border border-dark-700"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={resetView}
                    className="p-1 hover:bg-dark-800 text-dark-300 rounded border border-dark-700"
                    title="Reset Fit View"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <div className="h-6 w-px bg-dark-750 mx-1"></div>
                  <button
                    onClick={() => setShowPointLabels(prev => !prev)}
                    className={`p-1 rounded border ${showPointLabels ? 'bg-primary/20 border-primary text-primary' : 'border-dark-700 text-dark-400'}`}
                    title="Toggle Point Labels"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowCoordinates(prev => !prev)}
                    className={`p-1 rounded border ${showCoordinates ? 'bg-primary/20 border-primary text-primary' : 'border-dark-700 text-dark-400'}`}
                    title="Toggle Coordinates"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowSavedParcelsMap(prev => !prev)}
                    className={`p-1 rounded border ${showSavedParcelsMap ? 'bg-primary/20 border-primary text-primary' : 'border-dark-700 text-dark-400'}`}
                    title="Toggle Saved Parcels overlay"
                  >
                    <span className="text-[9px] font-bold px-0.5">SAVED</span>
                  </button>
                  <div className="h-6 w-px bg-dark-750 mx-1"></div>
                  <button
                    onClick={() => setSelectEditParcelMode(prev => !prev)}
                    className={`p-1 rounded border flex items-center gap-1 px-2 font-bold ${
                      selectEditParcelMode
                        ? 'bg-warning/20 border-warning text-warning'
                        : 'border-dark-700 text-dark-400 hover:text-dark-200'
                    }`}
                    title="Edit Parcel Mode: Click a saved parcel or its number on the map to load/edit its points"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span className="text-[10px]">EDIT MODE</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tab Content Panel (Strictly sized, no page-level scrolls) */}
          <div className="flex-1 min-h-0 relative">
            
            {/* Visual Map Tab */}
            {activeTab === 'map' && (
              <div ref={canvasContainerRef} className="w-full h-full relative overflow-hidden bg-dark-950">
                {selectEditParcelMode && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-warning/90 border border-warning/30 text-dark-955 font-bold px-4 py-2 rounded-full shadow-lg text-[11px] z-50 flex items-center gap-2 animate-pulse backdrop-blur">
                    <span>✏️ Select Mode: Click a parcel or its number to edit it</span>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className={`w-full h-full block ${selectEditParcelMode ? 'cursor-pointer' : 'cursor-crosshair'}`}
                  style={{ touchAction: 'none' }}
                />
                
                {/* Mini instructions Overlay */}
                <div className="absolute bottom-4 left-4 bg-dark-900/90 border border-dark-700 px-3 py-2 rounded-lg text-[10px] text-dark-300 backdrop-blur pointer-events-none select-none max-w-xs shadow-xl">
                  <p className="font-bold text-primary mb-1">🗺️ Map Guide:</p>
                  <ul className="space-y-0.5 list-disc pl-3 text-dark-400">
                    <li>Left click & drag to **Pan**.</li>
                    <li>Scroll wheel to **Zoom**.</li>
                    <li>Click a point dot to **Add to Path**.</li>
                    <li>Click starting point to **Close Loop**.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Saved Parcels Tab (Unique) */}
            {activeTab === 'saved' && (
              <div className="w-full h-full overflow-y-auto p-6 bg-dark-900/30">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white leading-none">Saved Unique Parcels</h2>
                      <p className="text-dark-400 text-xs mt-1">Showing one version per parcel number. Check "All Versions" to see history.</p>
                    </div>
                    {savedParcels.length > 0 && (
                      <button onClick={handleExportAll} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold">
                        <FileDown className="w-3.5 h-3.5" /> Export All PDF
                      </button>
                    )}
                  </div>

                  <UniqueParcelsList
                    savedParcels={savedParcels}
                    onEdit={(parcel) => {
                      handleLoadSavedParcel(parcel);
                    }}
                    onDelete={handleDeleteSaved}
                    onExport={handleExportSingle}
                  />
                </div>
              </div>
            )}

            {/* All Versions Tab */}
            {activeTab === 'all' && (
              <div className="w-full h-full overflow-y-auto p-6 bg-dark-900/30">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white leading-none">All Saved Versions</h2>
                      <p className="text-dark-400 text-xs mt-1">Full change log of all saves (including duplicates and updates).</p>
                    </div>
                    {savedParcels.length > 0 && (
                      <button onClick={handleExportAll} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold">
                        <FileDown className="w-3.5 h-3.5" /> Export All PDF
                      </button>
                    )}
                  </div>

                  <AllParcelsList
                    savedParcels={savedParcels}
                    onEdit={(parcel) => {
                      handleLoadSavedParcel(parcel);
                    }}
                    onDelete={handleDeleteSaved}
                    onExport={handleExportSingle}
                  />
                </div>
              </div>
            )}

            {/* Error Calculations Tab */}
            {activeTab === 'errors' && (
              <div className="w-full h-full overflow-y-auto p-6 bg-dark-900/30">
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-lg font-bold text-white leading-none mb-1">📊 Error Adjustment</h2>
                  <p className="text-dark-400 text-xs mb-6">
                    Proportionally adjust calculated areas against a registered title area.
                    Permissible limit formula: <code className="text-primary">0.8 × √A + 0.002 × A</code>.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 md:col-span-2">
                      <label className="block text-dark-300 font-semibold text-xs mb-2">
                        Total Registered Title Area:
                      </label>
                      <div className="flex gap-3 items-center">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={totalRegisteredArea}
                          onChange={(e) => setTotalRegisteredArea(e.target.value)}
                          className="bg-dark-900 border border-dark-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-primary text-sm w-44"
                          placeholder="Registered m²"
                        />
                        <span className="text-xs text-dark-400">m² (from land registry title)</span>
                      </div>
                    </div>

                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col justify-between">
                      <p className="text-[10px] text-dark-400">Selected: {selectedParcelsForError.length} parcels</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setSelectedParcelsForError(savedParcels.map(p => p.id))}
                          className="btn-secondary py-1 text-[10px] flex-1 text-center"
                        >
                          All
                        </button>
                        <button
                          onClick={() => {
                            setSelectedParcelsForError([]);
                            setTotalRegisteredArea('');
                            setErrorResults(null);
                          }}
                          className="btn-secondary py-1 text-[10px] flex-1 text-center"
                        >
                          Clear
                        </button>
                      </div>
                      <button
                        onClick={handleCalculateErrors}
                        disabled={selectedParcelsForError.length === 0 || !totalRegisteredArea}
                        className="btn-primary w-full py-1.5 mt-2 text-xs font-bold"
                      >
                        Calculate Adjustment
                      </button>
                    </div>
                  </div>

                  {savedParcels.length === 0 ? (
                    <div className="text-center py-12 bg-dark-800/30 rounded-lg border border-dark-800 text-dark-500 text-xs">
                      No saved parcels. Add and save parcels to perform error calculations.
                    </div>
                  ) : (
                    <div className="space-y-2 mb-6">
                      <h3 className="text-xs font-bold text-dark-300 uppercase tracking-wider mb-2">Select Parcels to Include:</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {savedParcels.map((parcel) => {
                          const isSelected = selectedParcelsForError.includes(parcel.id);
                          return (
                            <div
                              key={parcel.id}
                              onClick={() => toggleParcelSelection(parcel.id)}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between ${
                                isSelected ? 'bg-primary/10 border-primary' : 'bg-dark-800/60 border-dark-700/80 hover:border-dark-600'
                              }`}
                            >
                              <div>
                                <h4 className="font-bold text-sm text-primary">Parcel #{parcel.number}</h4>
                                <p className="text-[10px] text-dark-400">Area: {parcel.area.toFixed(4)} m² | Points: {parcel.pointCount}</p>
                              </div>
                              <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none rounded border-dark-600 bg-dark-800" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Results preview */}
                  {errorResults && (
                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 mb-6">
                      <div className="flex items-center justify-between border-b border-dark-700 pb-3 mb-4">
                        <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Adjustment Results</h3>
                        <button onClick={handleSaveErrorCalculation} className="btn-success py-1 px-3 text-xs flex items-center gap-1 font-bold">
                          <Save className="w-3.5 h-3.5" /> Save Results
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-center">
                        <div className="bg-dark-900 p-2.5 rounded">
                          <p className="text-[10px] text-dark-500 mb-0.5">Total Registered</p>
                          <p className="font-mono text-sm font-bold text-primary">{errorResults.totalRegisteredArea.toFixed(4)} m²</p>
                        </div>
                        <div className="bg-dark-900 p-2.5 rounded">
                          <p className="text-[10px] text-dark-500 mb-0.5">Total Calculated</p>
                          <p className="font-mono text-sm font-bold text-success">{errorResults.totalCalculatedArea.toFixed(4)} m²</p>
                        </div>
                        <div className="bg-dark-900 p-2.5 rounded">
                          <p className="text-[10px] text-dark-500 mb-0.5">Difference</p>
                          <p className="font-mono text-sm font-bold text-warning">{errorResults.absoluteDifference.toFixed(4)} m²</p>
                        </div>
                        <div className="bg-dark-900 p-2.5 rounded">
                          <p className="text-[10px] text-dark-500 mb-0.5 font-bold">Permissible Limit</p>
                          <p className="font-mono text-sm font-bold text-primary">{errorResults.permissibleError.toFixed(4)} m²</p>
                        </div>
                      </div>

                      <div className={`p-3 rounded text-xs mb-4 text-center font-bold ${errorResults.exceedsLimit ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-success/10 text-success border border-success/20'}`}>
                        {errorResults.exceedsLimit
                          ? '⚠️ Adjustment Exceeds Permissible Limit - Using original area values'
                          : '✅ Within Permissible Limit - Proportionally adjusted'}
                      </div>

                      {/* Tables */}
                      <div className="overflow-x-auto bg-dark-900 rounded border border-dark-700">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-dark-800 border-b border-dark-700 text-dark-400">
                              <th className="p-3">Parcel</th>
                              <th className="p-3 text-right">Orig Area</th>
                              <th className="p-3 text-right">Adj Area</th>
                              <th className="p-3 text-right">Rounded</th>
                            </tr>
                          </thead>
                          <tbody>
                            {errorResults.parcelResults.map((pr) => (
                              <tr key={pr.parcelId} className="border-b border-dark-800">
                                <td className="p-3 text-primary font-bold">#{pr.parcelNumber}</td>
                                <td className="p-3 text-right font-mono">{pr.calculatedArea.toFixed(4)}</td>
                                <td className="p-3 text-right font-mono text-warning">{pr.adjustedArea.toFixed(4)}</td>
                                <td className="p-3 text-right font-mono font-bold text-success">{pr.roundedArea}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Calculations History */}
                  {savedErrorCalculations.length > 0 && (
                    <div className="border-t border-dark-800 pt-6">
                      <h3 className="text-xs font-bold text-dark-300 uppercase tracking-wider mb-4">Saved Adjustments History ({savedErrorCalculations.length})</h3>
                      <div className="space-y-4">
                        {savedErrorCalculations.map((calc) => (
                          <div key={calc.id} className="bg-dark-800 border border-dark-700 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-sm font-bold text-white">{calc.name} <span className="text-[10px] text-dark-500 font-normal">({new Date(calc.timestamp).toLocaleDateString()})</span></h4>
                              <button onClick={() => handleDeleteErrorCalculation(calc.id)} className="text-danger hover:underline text-xs">Delete</button>
                            </div>
                            <div className="text-[11px] text-dark-400 space-y-1">
                              <p>Registered: {calc.totalRegisteredArea} m² | Calc: {calc.totalCalculatedArea.toFixed(4)} m² | Status: <span className={calc.exceedsLimit ? 'text-danger' : 'text-success font-bold'}>{calc.exceedsLimit ? 'Exceeded Limit' : 'Adjusted'}</span></p>
                              <div className="flex gap-2 flex-wrap pt-1.5">
                                {calc.parcelResults.map((pr, i) => (
                                  <span key={i} className="bg-dark-900 px-2 py-1 rounded text-dark-300">
                                    #{pr.parcelNumber}: <strong>{pr.roundedArea}</strong>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Help Tab */}
            {activeTab === 'help' && (
              <div className="w-full h-full overflow-y-auto p-6 bg-dark-900/30">
                <div className="max-w-2xl mx-auto bg-dark-800 border border-dark-700 rounded-xl p-6 text-sm text-dark-300 space-y-4 leading-relaxed">
                  <h2 className="text-lg font-bold text-primary mb-2 flex items-center gap-2">📘 Surveyor's Guide</h2>
                  <div className="space-y-3">
                    <p className="font-semibold text-white">How to calculate parcel areas:</p>
                    <ul className="space-y-2 list-decimal pl-4">
                      <li>Load your coordinates file (.pnt, .txt, .csv) from the top menu.</li>
                      <li>Specify a **Parcel Number** on the left panel.</li>
                      <li>Double-click/click points on the **Visual Map** tab or type Point IDs one-by-one to create a path.</li>
                      <li>Close the polygon loop by clicking the **first point** again on the map or typing the first ID in the input box.</li>
                      <li>The **Area Confirmation** dialog will show the base polygon area. Click **Continue** to add curves if necessary.</li>
                      <li>Select any curve links (Middle Ordinate M method) and click **Finalize Area** to save the parcel.</li>
                    </ul>
                    <p className="text-xs text-dark-500 pt-4 border-t border-dark-700">
                      Note: Your project saves automatically every 2 seconds to keep your progress secure. Saved parcels can be exported to PDF at any time.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>

      </main>
    </div>
  );
};
// Memoized list for unique parcels to prevent re-renders when typing
const UniqueParcelsList = React.memo(({ savedParcels, onEdit, onDelete, onExport }) => {
  if (savedParcels.length === 0) {
    return <p className="text-dark-400 text-center py-12">No saved parcels yet.</p>;
  }

  // Get unique parcels (LATEST occurrence of each parcel number)
  const uniqueParcels = [];
  const seen = new Set();
  // Loop from the end to get the latest first
  for (let i = savedParcels.length - 1; i >= 0; i--) {
    const parcel = savedParcels[i];
    const key = parcel.number.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueParcels.unshift(parcel); // Keep original chronological order
    }
  }

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
                  <span>📐 Area: <strong className="text-success">{parcel.area != null ? parcel.area.toFixed(4) : 'Calculating...'} m²</strong></span>
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
