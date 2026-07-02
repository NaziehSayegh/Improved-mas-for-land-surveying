import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoomIn, ZoomOut, RotateCcw, MousePointer, Eye, EyeOff } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import PageLayout from '../components/PageLayout';

const Plotting = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const { loadedPoints, savedParcels, projectName, pointsFileName } = useProject();

  // View state in refs (no re-render needed for drawing)
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialMouseDownRef = useRef({ x: 0, y: 0 });

  // React state for UI controls
  const [zoomDisplay, setZoomDisplay] = useState(1);
  const [showParcels, setShowParcels] = useState(true);
  const [showPointLabels, setShowPointLabels] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [filterParcelId, setFilterParcelId] = useState('all');

  // Mirror state to refs so draw() sees current values without closures
  const showParcelsRef = useRef(true);
  const showPointLabelsRef = useRef(true);
  const showCoordinatesRef = useRef(false);
  const selectedPointRef = useRef(null);
  const filterParcelIdRef = useRef('all');
  const loadedPointsRef = useRef(loadedPoints);
  const savedParcelsRef = useRef(savedParcels);

  useEffect(() => { showParcelsRef.current = showParcels; }, [showParcels]);
  useEffect(() => { showPointLabelsRef.current = showPointLabels; }, [showPointLabels]);
  useEffect(() => { showCoordinatesRef.current = showCoordinates; }, [showCoordinates]);
  useEffect(() => { selectedPointRef.current = selectedPoint; }, [selectedPoint]);
  useEffect(() => { filterParcelIdRef.current = filterParcelId; }, [filterParcelId]);
  useEffect(() => { loadedPointsRef.current = loadedPoints; }, [loadedPoints]);
  useEffect(() => { savedParcelsRef.current = savedParcels; }, [savedParcels]);
  
  useEffect(() => {
    if (filterParcelId !== 'all' && !savedParcels.some(p => p.id.toString() === filterParcelId)) {
      setFilterParcelId('all');
      filterParcelIdRef.current = 'all';
    }
  }, [savedParcels, filterParcelId]);

  const hasPoints = Object.keys(loadedPoints).length > 0;

  const getCentroid = (pts) => {
    if (!pts || pts.length === 0) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    pts.forEach(p => {
      sx += p.x;
      sy += p.y;
    });
    return { x: sx / pts.length, y: sy / pts.length };
  };

  const getArcPoints = (A, B, M, sign, centroid) => {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const C = Math.hypot(dx, dy);
    
    if (C < 0.001 || M <= 0) {
      return [A, B];
    }
    
    const R = (C * C) / (8 * M) + M / 2;
    const M_mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    
    // Normal vector to the chord (pointing to the left of A -> B)
    const nx = -dy / C;
    const ny = dx / C;
    
    // Find which direction points away from the centroid
    const ux = M_mid.x - centroid.x;
    const uy = M_mid.y - centroid.y;
    const dot = ux * nx + uy * ny;
    
    let n_out_x = nx;
    let n_out_y = ny;
    if (dot < 0) {
      n_out_x = -nx;
      n_out_y = -ny;
    }
    
    const bulge_dir = sign >= 0 ? 1 : -1;
    const dx_arc = bulge_dir * n_out_x;
    const dy_arc = bulge_dir * n_out_y;
    
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
  };

  // ── Coordinate helpers ───────────────────────────────────────
  const worldToScreen = (wx, wy) => ({
    x: wx * zoomRef.current + panRef.current.x,
    y: -wy * zoomRef.current + panRef.current.y,
  });

  const screenToWorld = (sx, sy) => ({
    x: (sx - panRef.current.x) / zoomRef.current,
    y: -(sy - panRef.current.y) / zoomRef.current,
  });

  const getBounds = () => {
    const points = loadedPointsRef.current;
    const parcels = savedParcelsRef.current;
    const filter = filterParcelIdRef.current;
    if (Object.keys(points).length === 0) return null;
    let pts = [];
    if (filter !== 'all') {
      const parcel = parcels.find(p => p.id.toString() === filter);
      if (parcel?.ids) parcel.ids.forEach(id => { if (points[id]) pts.push({ id, pt: points[id] }); });
    }
    if (pts.length === 0) pts = Object.entries(points).map(([id, pt]) => ({ id, pt }));
    if (pts.length === 0) return null;
    const mapped = pts.map(({ id, pt }) => ({ id, x: pt.x, y: pt.y }));
    const xs = mapped.map(p => p.x), ys = mapped.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY,
             centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, points: mapped };
  };

  const resetView = useCallback(() => {
    const bounds = getBounds();
    const canvas = canvasRef.current;
    if (!bounds || !canvas) return;
    const padding = 60;
    const scaleX = (canvas.width - padding * 2) / Math.max(bounds.width, 1);
    const scaleY = (canvas.height - padding * 2) / Math.max(bounds.height, 1);
    const scale = Math.min(scaleX, scaleY, 100);
    zoomRef.current = scale;
    panRef.current = { x: canvas.width / 2 - bounds.centerX * scale, y: canvas.height / 2 + bounds.centerY * scale };
    setZoomDisplay(scale);
    drawCanvas();
  }, []);

  // ── Drawing ──────────────────────────────────────────────────
  const drawGrid = (ctx, w, h) => {
    const zoom = zoomRef.current;
    ctx.strokeStyle = '#1a1f26';
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
  };

  const drawParcel = (ctx, parcel, index) => {
    const points = loadedPointsRef.current;
    if (!parcel.ids || parcel.ids.length < 2) return;
    const colors = ['#58a6ff', '#3fb950', '#f85149', '#f1e05a', '#a5a5a5', '#c084fc'];
    const color = colors[index % colors.length];
    ctx.strokeStyle = color; ctx.fillStyle = color + '18';
    ctx.lineWidth = 2; ctx.beginPath();

    const parcelPts = parcel.ids.map(id => points[id]).filter(Boolean);
    const centroid = getCentroid(parcelPts);

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
        const arcPts = getArcPoints(pt1, pt2, curve.M, curve.sign, centroid);
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

    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (parcel.number) {
      let sx = 0, sy = 0, cnt = 0;
      parcel.ids.forEach(id => { if (points[id]) { sx += points[id].x; sy += points[id].y; cnt++; } });
      if (cnt > 0) {
        const s = worldToScreen(sx / cnt, sy / cnt);
        ctx.fillStyle = color; ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(`Parcel ${parcel.number}`, s.x, s.y);
      }
    }
  };

  const drawPoint = (ctx, point, isSelected) => {
    const s = worldToScreen(point.x, point.y);
    ctx.beginPath();
    ctx.arc(s.x, s.y, isSelected ? 9 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#f85149' : '#58a6ff';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    if (showPointLabelsRef.current) {
      ctx.fillStyle = '#c9d1d9'; ctx.font = '11px Inter, monospace';
      ctx.textAlign = 'center'; ctx.fillText(point.id, s.x, s.y - 13);
    }
    if (showCoordinatesRef.current) {
      ctx.font = '9px monospace'; ctx.fillStyle = '#6e7681';
      ctx.fillText(`(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`, s.x, s.y + 20);
    }
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bounds = getBounds();
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!bounds || bounds.points.length === 0) {
      ctx.fillStyle = '#484f58'; ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('No points loaded', canvas.width / 2, canvas.height / 2);
      return;
    }
    drawGrid(ctx, canvas.width, canvas.height);
    if (showParcelsRef.current) {
      const parcels = savedParcelsRef.current;
      const filter = filterParcelIdRef.current;
      const td = filter === 'all' ? parcels : parcels.filter(p => p.id.toString() === filter);
      td.forEach((p) => drawParcel(ctx, p, savedParcelsRef.current.indexOf(p)));
    }
    bounds.points.forEach(p => drawPoint(ctx, p, p.id === selectedPointRef.current));

    // Mini info overlay
    ctx.fillStyle = 'rgba(13,17,23,0.85)';
    ctx.beginPath(); ctx.roundRect?.(8, 8, 220, 80, 8); ctx.fill();
    ctx.fillStyle = '#58a6ff'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Plot Info', 18, 28);
    ctx.fillStyle = '#8b949e'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`Points: ${bounds.points.length}`, 18, 46);
    ctx.fillText(`Parcels: ${savedParcelsRef.current.length}`, 18, 61);
    ctx.fillText(`Zoom: ${zoomRef.current.toFixed(2)}×`, 18, 76);
  }, []);

  // ── Canvas setup ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => { const r = container.getBoundingClientRect(); canvas.width = r.width; canvas.height = r.height; drawCanvas(); };
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const oldZ = zoomRef.current, newZ = Math.max(0.01, Math.min(200, oldZ * delta)), scale = newZ / oldZ;
      panRef.current = { x: mx - (mx - panRef.current.x) * scale, y: my - (my - panRef.current.y) * scale };
      zoomRef.current = newZ; setZoomDisplay(newZ); drawCanvas();
    };
    const onDown = (e) => {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialMouseDownRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!isDraggingRef.current) return;
      panRef.current = { x: panRef.current.x + (e.clientX - dragStartRef.current.x), y: panRef.current.y + (e.clientY - dragStartRef.current.y) };
      dragStartRef.current = { x: e.clientX, y: e.clientY }; drawCanvas();
    };
    const onUp = () => { isDraggingRef.current = false; canvas.style.cursor = 'crosshair'; };
    const onClick = (e) => {
      const dragDist = Math.hypot(e.clientX - initialMouseDownRef.current.x, e.clientY - initialMouseDownRef.current.y);
      if (dragDist > 5) return; // Prevent selection if mouse was dragged
      const rect = canvas.getBoundingClientRect(), cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const bounds = getBounds(); if (!bounds) return;
      let closest = null, minD = Infinity;
      bounds.points.forEach(p => { const s = worldToScreen(p.x, p.y); const d = Math.hypot(s.x - cx, s.y - cy); if (d < 15 && d < minD) { minD = d; closest = p.id; } });
      setSelectedPoint(closest); selectedPointRef.current = closest; drawCanvas();
    };
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onUp);
      canvas.removeEventListener('click', onClick);
    };
  }, [drawCanvas]);

  useEffect(() => { drawCanvas(); }, [loadedPoints, savedParcels, showParcels, showPointLabels, showCoordinates, selectedPoint, filterParcelId, drawCanvas]);
  useEffect(() => { if (hasPoints) setTimeout(resetView, 100); }, [loadedPoints, resetView]);

  // ── Empty state ──────────────────────────────────────────────
  if (!hasPoints) {
    return (
      <PageLayout title="Plotting View" backPath="/" backLabel="Main Menu">
        <div className="h-full flex items-center justify-center">
          <div className="glass rounded-2xl p-10 text-center max-w-md">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-primary mb-3">No Points Loaded</h2>
            <p className="text-dark-400 text-sm mb-6">To use the plotting view, load survey points first.</p>
            <div className="text-left space-y-3 mb-7 text-sm text-dark-300">
              {[
                'Open a project in Data Files',
                'Load a points file (.pnt, .txt)',
                'Return here to visualize',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40
                                   flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/parcel-calculator')} className="btn-primary w-full">
              Go to Area Calculator
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Plotting View" backPath="/" backLabel="Main Menu">
      <div className="h-full flex flex-col overflow-hidden p-3 gap-3">
        {/* ── Toolbar (single line, no wrap) ──────────────────── */}
        <div className="flex-shrink-0 glass rounded-xl px-4 py-2.5 flex items-center gap-2 flex-wrap">
          {/* Zoom controls */}
          <button onClick={() => { zoomRef.current = Math.min(200, zoomRef.current * 1.2); setZoomDisplay(zoomRef.current); drawCanvas(); }}
            className="btn-secondary text-xs py-1.5 px-2.5">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { zoomRef.current = Math.max(0.01, zoomRef.current * 0.8); setZoomDisplay(zoomRef.current); drawCanvas(); }}
            className="btn-secondary text-xs py-1.5 px-2.5">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={resetView} className="btn-secondary text-xs py-1.5 px-3">
            <RotateCcw className="w-3.5 h-3.5" /> Fit All
          </button>

          <span className="text-dark-500 text-xs font-mono ml-1">
            {zoomDisplay.toFixed(2)}×
          </span>

          <div className="h-5 w-px bg-dark-700 mx-1 flex-shrink-0" />

          {/* Filter */}
          <select
            value={filterParcelId}
            onChange={(e) => { setFilterParcelId(e.target.value); filterParcelIdRef.current = e.target.value; drawCanvas(); }}
            className="bg-dark-700 border border-dark-600 text-dark-300 text-xs rounded-lg
                       focus:ring-1 focus:ring-primary focus:border-primary px-2.5 py-1.5"
          >
            <option value="all">All Parcels ({savedParcels.length})</option>
            {savedParcels.map((p, i) => (
              <option key={p.id} value={p.id}>
                Parcel {p.number}{savedParcels.filter(s => s.number === p.number).length > 1 ? ` (${i + 1})` : ''}
              </option>
            ))}
          </select>

          <div className="h-5 w-px bg-dark-700 mx-1 flex-shrink-0" />

          {/* Toggles */}
          {[
            { label: 'Parcels', checked: showParcels, onChange: (v) => { setShowParcels(v); showParcelsRef.current = v; drawCanvas(); } },
            { label: 'Point IDs', checked: showPointLabels, onChange: (v) => { setShowPointLabels(v); showPointLabelsRef.current = v; drawCanvas(); } },
            { label: 'Coords', checked: showCoordinates, onChange: (v) => { setShowCoordinates(v); showCoordinatesRef.current = v; drawCanvas(); } },
          ].map(({ label, checked, onChange }) => (
            <label key={label} className="flex items-center gap-1.5 text-xs text-dark-300 cursor-pointer select-none">
              <input type="checkbox" checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-dark-600 bg-dark-700 text-primary" />
              {label}
            </label>
          ))}

          {/* Spacer + info */}
          <div className="flex-1" />
          <div className="text-xs text-dark-500 hidden md:flex items-center gap-1">
            <MousePointer className="w-3 h-3" />
            Drag to pan · Scroll to zoom · Click point to select
          </div>

          {/* Selected point info */}
          {selectedPoint && (
            <span className="text-xs text-primary font-mono">
              Selected: #{selectedPoint}
            </span>
          )}
        </div>

        {/* ── Canvas ───────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 rounded-xl overflow-hidden border border-dark-700/60 bg-dark-900"
        >
          <canvas
            ref={canvasRef}
            className="cursor-crosshair w-full h-full block"
          />
        </div>
      </div>
    </PageLayout>
  );
};

export default Plotting;
