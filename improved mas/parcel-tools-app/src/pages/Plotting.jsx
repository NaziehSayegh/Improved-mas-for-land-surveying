import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const Plotting = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const { loadedPoints, savedParcels, projectName, pointsFileName } = useProject();

  // All view state stored in refs so draw() always sees current values
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // React state only for UI re-renders (controls, labels, filter)
  const [zoomDisplay, setZoomDisplay] = useState(1);
  const [showParcels, setShowParcels] = useState(true);
  const [showPointLabels, setShowPointLabels] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [filterParcelId, setFilterParcelId] = useState('all');

  // Refs for render options so draw() sees current values without re-mounting
  const showParcelsRef = useRef(true);
  const showPointLabelsRef = useRef(true);
  const showCoordinatesRef = useRef(false);
  const selectedPointRef = useRef(null);
  const filterParcelIdRef = useRef('all');
  const loadedPointsRef = useRef(loadedPoints);
  const savedParcelsRef = useRef(savedParcels);

  // Keep refs in sync with state/props
  useEffect(() => { showParcelsRef.current = showParcels; }, [showParcels]);
  useEffect(() => { showPointLabelsRef.current = showPointLabels; }, [showPointLabels]);
  useEffect(() => { showCoordinatesRef.current = showCoordinates; }, [showCoordinates]);
  useEffect(() => { selectedPointRef.current = selectedPoint; }, [selectedPoint]);
  useEffect(() => { filterParcelIdRef.current = filterParcelId; }, [filterParcelId]);
  useEffect(() => { loadedPointsRef.current = loadedPoints; }, [loadedPoints]);
  useEffect(() => { savedParcelsRef.current = savedParcels; }, [savedParcels]);

  const hasPoints = Object.keys(loadedPoints).length > 0;

  // ─── Coordinate helpers (read from refs, no closures) ─────────────────────
  const worldToScreen = (wx, wy) => ({
    x: wx * zoomRef.current + panRef.current.x,
    y: -wy * zoomRef.current + panRef.current.y,
  });

  const screenToWorld = (sx, sy) => ({
    x: (sx - panRef.current.x) / zoomRef.current,
    y: -(sy - panRef.current.y) / zoomRef.current,
  });

  // ─── Bounds calculation ────────────────────────────────────────────────────
  const getBounds = () => {
    const points = loadedPointsRef.current;
    const parcels = savedParcelsRef.current;
    const filter = filterParcelIdRef.current;

    if (Object.keys(points).length === 0) return null;

    let pointsToProcess = [];

    if (filter !== 'all') {
      const parcel = parcels.find(p => p.id.toString() === filter);
      if (parcel && parcel.ids) {
        parcel.ids.forEach(id => {
          if (points[id]) pointsToProcess.push({ id, pt: points[id] });
        });
      }
    }

    if (pointsToProcess.length === 0) {
      pointsToProcess = Object.entries(points).map(([id, pt]) => ({ id, pt }));
    }
    if (pointsToProcess.length === 0) return null;

    const mapped = pointsToProcess.map(({ id, pt }) => ({ id, x: pt.y, y: pt.x }));
    const xs = mapped.map(p => p.x);
    const ys = mapped.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    return {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      points: mapped,
    };
  };

  // ─── Reset view ────────────────────────────────────────────────────────────
  const resetView = useCallback(() => {
    const bounds = getBounds();
    const canvas = canvasRef.current;
    if (!bounds || !canvas) return;

    const padding = 50;
    const scaleX = (canvas.width - padding * 2) / Math.max(bounds.width, 1);
    const scaleY = (canvas.height - padding * 2) / Math.max(bounds.height, 1);
    const scale = Math.min(scaleX, scaleY, 100);

    zoomRef.current = scale;
    panRef.current = {
      x: canvas.width / 2 - bounds.centerX * scale,
      y: canvas.height / 2 + bounds.centerY * scale,
    };
    setZoomDisplay(scale);
    drawCanvas();
  }, []);

  // ─── Draw helpers ──────────────────────────────────────────────────────────
  const drawGrid = (ctx, width, height) => {
    const zoom = zoomRef.current;
    ctx.strokeStyle = '#21262d';
    ctx.lineWidth = 1;

    const step = 50 / zoom;
    const startWorld = screenToWorld(0, 0);
    const endWorld = screenToWorld(width, height);

    const minX = Math.min(startWorld.x, endWorld.x);
    const maxX = Math.max(startWorld.x, endWorld.x);
    const minY = Math.min(startWorld.y, endWorld.y);
    const maxY = Math.max(startWorld.y, endWorld.y);

    const startX = Math.floor(minX / step) * step;
    for (let x = startX; x <= maxX; x += step) {
      const sx = worldToScreen(x, 0).x;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
    }
    const startY = Math.floor(minY / step) * step;
    for (let y = startY; y <= maxY; y += step) {
      const sy = worldToScreen(0, y).y;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
    }
  };

  const drawParcel = (ctx, parcel, index) => {
    const points = loadedPointsRef.current;
    if (!parcel.ids || parcel.ids.length < 2) return;
    const colors = ['#58a6ff', '#3fb950', '#f85149', '#f1e05a', '#a5a5a5'];
    const color = colors[index % colors.length];

    ctx.strokeStyle = color;
    ctx.fillStyle = color + '20';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < parcel.ids.length; i++) {
      const pt = points[parcel.ids[i]];
      if (!pt) continue;
      const s = worldToScreen(pt.y, pt.x);
      if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    if (parcel.number) {
      let sx = 0, sy = 0, cnt = 0;
      parcel.ids.forEach(id => {
        if (points[id]) { sx += points[id].y; sy += points[id].x; cnt++; }
      });
      if (cnt > 0) {
        const s = worldToScreen(sx / cnt, sy / cnt);
        ctx.fillStyle = color;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Parcel ${parcel.number}`, s.x, s.y - 5);
      }
    }
  };

  const drawPoint = (ctx, point, isSelected) => {
    const s = worldToScreen(point.x, point.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, isSelected ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#f85149' : '#58a6ff';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    if (showPointLabelsRef.current) {
      ctx.fillStyle = '#c9d1d9';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(point.id, s.x, s.y - 12);
    }
    if (showCoordinatesRef.current) {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#8b949e';
      ctx.textAlign = 'center';
      ctx.fillText(`(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`, s.x, s.y + 20);
    }
  };

  // ─── Main draw ─────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bounds = getBounds();

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!bounds || bounds.points.length === 0) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No points loaded', canvas.width / 2, canvas.height / 2);
      return;
    }

    drawGrid(ctx, canvas.width, canvas.height);

    if (showParcelsRef.current) {
      const parcels = savedParcelsRef.current;
      const filter = filterParcelIdRef.current;
      const parcelsToDraw = filter === 'all' ? parcels : parcels.filter(p => p.id.toString() === filter);
      parcelsToDraw.forEach((parcel) => drawParcel(ctx, parcel, savedParcelsRef.current.indexOf(parcel)));
    }

    bounds.points.forEach(point => drawPoint(ctx, point, point.id === selectedPointRef.current));

    // Info panel
    ctx.fillStyle = 'rgba(13,17,23,0.9)';
    ctx.fillRect(10, 10, 300, 120);
    ctx.fillStyle = '#58a6ff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Plot Information', 20, 30);
    ctx.fillStyle = '#c9d1d9'; ctx.font = '12px sans-serif';
    ctx.fillText(`Points: ${bounds.points.length}`, 20, 50);
    ctx.fillText(`Parcels: ${savedParcelsRef.current.length}`, 20, 70);
    ctx.fillText(`Zoom: ${zoomRef.current.toFixed(2)}x`, 20, 90);
    ctx.fillText(`Bounds: X[${bounds.minX.toFixed(2)}, ${bounds.maxX.toFixed(2)}]`, 20, 110);
  }, []);

  // ─── Canvas setup + event wiring ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      drawCanvas();
    };

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const oldZoom = zoomRef.current;
      const newZoom = Math.max(0.01, Math.min(200, oldZoom * delta));
      const scale = newZoom / oldZoom;

      panRef.current = {
        x: mouseX - (mouseX - panRef.current.x) * scale,
        y: mouseY - (mouseY - panRef.current.y) * scale,
      };
      zoomRef.current = newZoom;
      setZoomDisplay(newZoom);
      drawCanvas();
    };

    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      drawCanvas();
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = 'crosshair';
    };

    const onClick = (e) => {
      if (isDraggingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const bounds = getBounds();
      if (!bounds) return;
      let closest = null, minDist = Infinity;
      bounds.points.forEach(point => {
        const s = worldToScreen(point.x, point.y);
        const d = Math.hypot(s.x - cx, s.y - cy);
        if (d < 15 && d < minDist) { minDist = d; closest = point.id; }
      });
      setSelectedPoint(closest);
      selectedPointRef.current = closest;
      drawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('click', onClick);
    };
  }, [drawCanvas]);

  // Redraw when data or display options change
  useEffect(() => { drawCanvas(); }, [loadedPoints, savedParcels, showParcels, showPointLabels, showCoordinates, selectedPoint, filterParcelId, drawCanvas]);

  // Auto fit when points are first loaded
  useEffect(() => {
    if (hasPoints) setTimeout(resetView, 100);
  }, [loadedPoints, resetView]);

  // ESC to go back
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') navigate('/'); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate]);

  if (!hasPoints) {
    return (
      <div className="min-h-screen bg-dark-900 p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/')} className="btn-secondary mb-6 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> ↩ MAIN MENU
          </button>
          <div className="glass-effect rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h1 className="text-3xl font-bold text-primary mb-4">Plotting View</h1>
            <p className="text-dark-300 mb-6">To use plotting, you need to:</p>
            <div className="text-left max-w-md mx-auto space-y-3 mb-8">
              <div className="flex items-center gap-3"><span className="text-2xl">1️⃣</span><span className="text-dark-200">Open a project in Parcel Calculator</span></div>
              <div className="flex items-center gap-3"><span className="text-2xl">2️⃣</span><span className="text-dark-200">Load a points file (.pnt, .txt)</span></div>
              <div className="flex items-center gap-3"><span className="text-2xl">3️⃣</span><span className="text-dark-200">Return here to visualize the points</span></div>
            </div>
            <button onClick={() => navigate('/parcel-calculator')} className="btn-primary px-6 py-3">
              Go to Parcel Calculator
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 p-6">
      <div className="max-w-full mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button onClick={() => navigate('/')} className="btn-secondary mb-4 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> ↩ MAIN MENU
          </button>

          <div className="glass-effect rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">📊 Plotting View</h1>
                <p className="text-dark-300">
                  {projectName && `Project: ${projectName} • `}
                  {pointsFileName && `File: ${pointsFileName} • `}
                  {Object.keys(loadedPoints).length} points loaded
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => { zoomRef.current = Math.min(200, zoomRef.current * 1.2); setZoomDisplay(zoomRef.current); drawCanvas(); }} className="btn-secondary text-sm py-2 px-3">
                <ZoomIn className="w-4 h-4 inline mr-1" /> Zoom In
              </button>
              <button onClick={() => { zoomRef.current = Math.max(0.01, zoomRef.current * 0.8); setZoomDisplay(zoomRef.current); drawCanvas(); }} className="btn-secondary text-sm py-2 px-3">
                <ZoomOut className="w-4 h-4 inline mr-1" /> Zoom Out
              </button>
              <button onClick={resetView} className="btn-secondary text-sm py-2 px-3">
                <RotateCcw className="w-4 h-4 inline mr-1" /> Fit All
              </button>

              <div className="h-6 w-px bg-dark-600 mx-2" />

              <select
                value={filterParcelId}
                onChange={(e) => { setFilterParcelId(e.target.value); filterParcelIdRef.current = e.target.value; drawCanvas(); }}
                className="bg-dark-800 border border-dark-600 text-dark-300 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
              >
                <option value="all">View All Parcels</option>
                {savedParcels.map((p, idx) => (
                  <option key={p.id} value={p.id}>
                    Parcel {p.number}{savedParcels.filter(sp => sp.number === p.number).length > 1 ? ` (${idx + 1})` : ''}
                  </option>
                ))}
              </select>

              <div className="h-6 w-px bg-dark-600 mx-2" />

              <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                <input type="checkbox" checked={showParcels} onChange={(e) => { setShowParcels(e.target.checked); showParcelsRef.current = e.target.checked; drawCanvas(); }} className="w-4 h-4" />
                Show Parcels
              </label>
              <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                <input type="checkbox" checked={showPointLabels} onChange={(e) => { setShowPointLabels(e.target.checked); showPointLabelsRef.current = e.target.checked; drawCanvas(); }} className="w-4 h-4" />
                Show Point IDs
              </label>
              <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                <input type="checkbox" checked={showCoordinates} onChange={(e) => { setShowCoordinates(e.target.checked); showCoordinatesRef.current = e.target.checked; drawCanvas(); }} className="w-4 h-4" />
                Show Coordinates
              </label>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-effect rounded-xl p-4">
          <div
            ref={containerRef}
            className="w-full bg-dark-800 rounded-lg overflow-hidden border border-dark-700"
            style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
          >
            <canvas
              ref={canvasRef}
              className="cursor-crosshair w-full h-full"
              style={{ display: 'block' }}
            />
          </div>
          <div className="mt-4 text-sm text-dark-400">
            <p>🖱️ <strong>Mouse wheel:</strong> Zoom in/out • <strong>Click &amp; drag:</strong> Pan • <strong>Click point:</strong> Select</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Plotting;
