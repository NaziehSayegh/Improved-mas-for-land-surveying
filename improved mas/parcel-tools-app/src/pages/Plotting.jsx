import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2 } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

const Plotting = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const {
    loadedPoints,
    savedParcels,
    projectName,
    pointsFileName
  } = useProject();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showParcels, setShowParcels] = useState(true);
  const [showPointLabels, setShowPointLabels] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Check if we have points loaded
  const hasPoints = Object.keys(loadedPoints).length > 0;

  // ESC to go back
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  // Calculate bounds of all points
  const getBounds = () => {
    if (!hasPoints) return null;

    const points = Object.entries(loadedPoints).map(([id, pt]) => ({
      id,
      x: pt.x,
      y: pt.y
    }));

    if (points.length === 0) return null;

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return { minX, maxX, minY, maxY, width, height, centerX, centerY, points };
  };

  // Reset view to fit all points
  const resetView = () => {
    const bounds = getBounds();
    if (!bounds) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const padding = 50; // Padding around points
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Calculate scale to fit
    const scaleX = (canvasWidth - padding * 2) / Math.max(bounds.width, 1);
    const scaleY = (canvasHeight - padding * 2) / Math.max(bounds.height, 1);
    const scale = Math.min(scaleX, scaleY, 100); // Max zoom 100x

    // Center the plot
    const centerScreenX = canvasWidth / 2;
    const centerScreenY = canvasHeight / 2;
    
    const panX = centerScreenX - bounds.centerX * scale;
    const panY = centerScreenY - bounds.centerY * scale;

    setZoom(scale);
    setPan({ x: panX, y: panY });
  };

  // Convert world coordinates to screen coordinates
  const worldToScreen = (wx, wy) => {
    return {
      x: wx * zoom + pan.x,
      y: wy * zoom + pan.y
    };
  };

  // Convert screen coordinates to world coordinates
  const screenToWorld = (sx, sy) => {
    return {
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom
    };
  };

  // Draw on canvas
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const bounds = getBounds();
    
    if (!bounds || bounds.points.length === 0) {
      // Clear and show message
      ctx.fillStyle = '#161b22';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#8b949e';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No points loaded', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Clear canvas
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw parcels if enabled
    if (showParcels && savedParcels.length > 0) {
      savedParcels.forEach((parcel, index) => {
        drawParcel(ctx, parcel, index);
      });
    }

    // Draw points
    bounds.points.forEach(point => {
      drawPoint(ctx, point, point.id === selectedPoint);
    });

    // Draw coordinate info
    drawInfo(ctx, canvas.width, canvas.height, bounds);
  };

  // Draw grid
  const drawGrid = (ctx, width, height) => {
    ctx.strokeStyle = '#21262d';
    ctx.lineWidth = 1;

    const step = 50 / zoom; // Grid step in world coordinates
    const startWorld = screenToWorld(0, 0);
    const endWorld = screenToWorld(width, height);

    // Vertical lines
    const startX = Math.floor(startWorld.x / step) * step;
    for (let x = startX; x <= endWorld.x; x += step) {
      const screen = worldToScreen(x, 0);
      ctx.beginPath();
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, height);
      ctx.stroke();
    }

    // Horizontal lines
    const startY = Math.floor(startWorld.y / step) * step;
    for (let y = startY; y <= endWorld.y; y += step) {
      const screen = worldToScreen(0, y);
      ctx.beginPath();
      ctx.moveTo(0, screen.y);
      ctx.lineTo(width, screen.y);
      ctx.stroke();
    }
  };

  // Draw a parcel
  const drawParcel = (ctx, parcel, index) => {
    if (!parcel.ids || parcel.ids.length < 2) return;

    const colors = ['#58a6ff', '#3fb950', '#f85149', '#f1e05a', '#a5a5a5'];
    const color = colors[index % colors.length];

    ctx.strokeStyle = color;
    ctx.fillStyle = color + '20';
    ctx.lineWidth = 2;

    ctx.beginPath();
    const ids = parcel.ids;
    for (let i = 0; i < ids.length; i++) {
      const pointId = ids[i];
      if (loadedPoints[pointId]) {
        const pt = loadedPoints[pointId];
        const screen = worldToScreen(pt.x, pt.y);
        if (i === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw parcel number in center
    if (parcel.number) {
      const center = getParcelCenter(parcel);
      if (center) {
        const screen = worldToScreen(center.x, center.y);
        ctx.fillStyle = color;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Parcel ${parcel.number}`, screen.x, screen.y - 5);
      }
    }
  };

  // Get center of a parcel
  const getParcelCenter = (parcel) => {
    if (!parcel.ids || parcel.ids.length === 0) return null;

    let sumX = 0, sumY = 0, count = 0;
    parcel.ids.forEach(id => {
      if (loadedPoints[id]) {
        sumX += loadedPoints[id].x;
        sumY += loadedPoints[id].y;
        count++;
      }
    });

    if (count === 0) return null;
    return { x: sumX / count, y: sumY / count };
  };

  // Draw a point
  const drawPoint = (ctx, point, isSelected) => {
    const screen = worldToScreen(point.x, point.y);

    // Draw point circle
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, isSelected ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#f85149' : '#58a6ff';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw point label
    if (showPointLabels) {
      ctx.fillStyle = '#c9d1d9';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(point.id, screen.x, screen.y - 12);
    }
    
    // Draw coordinates (separate option)
    if (showCoordinates) {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#8b949e';
      ctx.textAlign = 'center';
      ctx.fillText(`(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`, screen.x, screen.y + 20);
    }
  };

  // Draw info panel
  const drawInfo = (ctx, width, height, bounds) => {
    ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
    ctx.fillRect(10, 10, 300, 120);

    ctx.fillStyle = '#58a6ff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Plot Information', 20, 30);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Points: ${bounds.points.length}`, 20, 50);
    ctx.fillText(`Parcels: ${savedParcels.length}`, 20, 70);
    ctx.fillText(`Zoom: ${zoom.toFixed(2)}x`, 20, 90);
    ctx.fillText(`Bounds: X[${bounds.minX.toFixed(2)}, ${bounds.maxX.toFixed(2)}] Y[${bounds.minY.toFixed(2)}, ${bounds.maxY.toFixed(2)}]`, 20, 110);
  };

  // Handle canvas click
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const bounds = getBounds();
    if (!bounds) return;

    // Find closest point
    let closest = null;
    let minDist = Infinity;

    bounds.points.forEach(point => {
      const screen = worldToScreen(point.x, point.y);
      const dist = Math.sqrt((screen.x - x) ** 2 + (screen.y - y) ** 2);
      if (dist < 15 && dist < minDist) {
        minDist = dist;
        closest = point.id;
      }
    });

    setSelectedPoint(closest);
  };

  // Handle mouse wheel for zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const world = screenToWorld(mouseX, mouseY);

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.01, Math.min(200, zoom * delta)); // Max zoom 200x

    const newPanX = mouseX - world.x * newZoom;
    const newPanY = mouseY - world.y * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Handle mouse drag for panning
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Initialize canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height - 60; // Reserve space for controls
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [loadedPoints, savedParcels, zoom, pan, showParcels, showPointLabels, showCoordinates, selectedPoint, hasPoints]);

  // Reset view when points change
  useEffect(() => {
    if (hasPoints) {
      setTimeout(resetView, 100);
    }
  }, [loadedPoints]);

  // Show warning if no project/points
  if (!hasPoints) {
    return (
      <div className="min-h-screen bg-dark-900 p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/')} className="btn-secondary mb-6 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            ↩ MAIN MENU
          </button>

          <div className="glass-effect rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h1 className="text-3xl font-bold text-primary mb-4">Plotting View</h1>
            <p className="text-dark-300 mb-6">
              To use plotting, you need to:
            </p>
            <div className="text-left max-w-md mx-auto space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <span className="text-2xl">1️⃣</span>
                <span className="text-dark-200">Open a project in Parcel Calculator</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">2️⃣</span>
                <span className="text-dark-200">Load a points file (.pnt, .txt)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">3️⃣</span>
                <span className="text-dark-200">Return here to visualize the points</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/parcel-calculator')}
              className="btn-primary px-6 py-3"
            >
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
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button onClick={() => navigate('/')} className="btn-secondary mb-4 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            ↩ MAIN MENU
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

            {/* Controls */}
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={() => setZoom(z => Math.min(200, z * 1.2))} className="btn-secondary text-sm py-2 px-3">
                <ZoomIn className="w-4 h-4 inline mr-1" />
                Zoom In
              </button>
              <button onClick={() => setZoom(z => Math.max(0.01, z * 0.8))} className="btn-secondary text-sm py-2 px-3">
                <ZoomOut className="w-4 h-4 inline mr-1" />
                Zoom Out
              </button>
              <button onClick={resetView} className="btn-secondary text-sm py-2 px-3">
                <RotateCcw className="w-4 h-4 inline mr-1" />
                Fit All
              </button>
              <div className="h-6 w-px bg-dark-600 mx-2"></div>
              <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showParcels}
                  onChange={(e) => setShowParcels(e.target.checked)}
                  className="w-4 h-4"
                />
                Show Parcels
              </label>
              <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPointLabels}
                  onChange={(e) => setShowPointLabels(e.target.checked)}
                  className="w-4 h-4"
                />
                Show Point IDs
              </label>
              <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCoordinates}
                  onChange={(e) => setShowCoordinates(e.target.checked)}
                  className="w-4 h-4"
                />
                Show Coordinates
              </label>
            </div>
          </div>
        </motion.div>

        {/* Canvas Container */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-effect rounded-xl p-4"
        >
          <div
            ref={containerRef}
            className="w-full bg-dark-800 rounded-lg overflow-hidden border border-dark-700"
            style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="cursor-crosshair w-full h-full"
              style={{ display: 'block' }}
            />
          </div>

          {/* Instructions */}
          <div className="mt-4 text-sm text-dark-400">
            <p>🖱️ <strong>Mouse wheel:</strong> Zoom in/out • <strong>Click & drag:</strong> Pan • <strong>Click point:</strong> Select</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Plotting;

