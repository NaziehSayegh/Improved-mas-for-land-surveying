import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, ZoomIn, ZoomOut, RotateCcw, Plus, MapPin } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';

// ─── Colour palette for layers ────────────────────────────────────────────────
const LAYER_COLORS = [
    '#58a6ff', '#3fb950', '#f85149', '#f1e05a', '#a5a5a5',
    '#ff7b72', '#d2a8ff', '#79c0ff', '#56d364', '#ffa657',
];
function layerColor(layer, idx) {
    if (layer === '0') return '#8b949e';
    return LAYER_COLORS[Math.abs([...layer].reduce((a, c) => a + c.charCodeAt(0), 0)) % LAYER_COLORS.length];
}

// ─── Hit-test: is point near a polyline segment? ──────────────────────────────
function distPointToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ─── Component ────────────────────────────────────────────────────────────────
const DxfImport = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { loadedPoints, setLoadedPoints, savedParcels, setSavedParcels, setHasUnsavedChanges } = useProject();

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const zoomRef = useRef(1);
    const panRef = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const entitiesRef = useRef([]);
    const selectedIdxRef = useRef(null);

    const [fileName, setFileName] = useState('');
    const [entities, setEntities] = useState([]);
    const [selectedIdx, setSelectedIdx] = useState(null);
    const [zoomDisplay, setZoomDisplay] = useState(1);
    const [loading, setLoading] = useState(false);
    const [layerList, setLayerList] = useState([]);

    // ─── Coordinate helpers ──────────────────────────────────────────────────────
    const w2s = (wx, wy) => ({
        x: wx * zoomRef.current + panRef.current.x,
        y: -wy * zoomRef.current + panRef.current.y,
    });
    const s2w = (sx, sy) => ({
        x: (sx - panRef.current.x) / zoomRef.current,
        y: -(sy - panRef.current.y) / zoomRef.current,
    });

    // ─── Draw ───────────────────────────────────────────────────────────────────
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width: W, height: H } = canvas;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        // Grid
        const step = 50 / zoomRef.current;
        ctx.strokeStyle = '#21262d'; ctx.lineWidth = 1;
        const sw = s2w(0, 0), ew = s2w(W, H);
        const mnX = Math.min(sw.x, ew.x), mxX = Math.max(sw.x, ew.x);
        const mnY = Math.min(sw.y, ew.y), mxY = Math.max(sw.y, ew.y);
        for (let x = Math.floor(mnX / step) * step; x <= mxX; x += step) {
            const sx = w2s(x, 0).x; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
        }
        for (let y = Math.floor(mnY / step) * step; y <= mxY; y += step) {
            const sy = w2s(0, y).y; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
        }

        const ents = entitiesRef.current;
        if (!ents.length) {
            ctx.fillStyle = '#8b949e'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('Open a DXF or DWG file to begin', W / 2, H / 2);
            return;
        }

        ents.forEach((ent, i) => {
            const isSelected = i === selectedIdxRef.current;
            const color = isSelected ? '#ffd700' : layerColor(ent.layer, i);
            ctx.strokeStyle = color;
            ctx.lineWidth = isSelected ? 3 : 1.5;
            ctx.setLineDash(isSelected ? [] : []);

            if (ent.type === 'LINE' || ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                ctx.beginPath();
                ent.points.forEach((p, pi) => {
                    const s = w2s(p.y, p.x);
                    if (pi === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
                });
                if (ent.closed && ent.points.length > 1) ctx.closePath();
                ctx.stroke();

                // Fill closed selected polyline lightly
                if (isSelected && ent.closed) {
                    ctx.fillStyle = '#ffd70025';
                    ctx.fill();
                }
            }
        });

        // Info panel
        ctx.fillStyle = 'rgba(13,17,23,0.9)'; ctx.fillRect(10, 10, 280, 80);
        ctx.fillStyle = '#58a6ff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('DXF/DWG Viewer', 20, 30);
        ctx.fillStyle = '#c9d1d9'; ctx.font = '12px sans-serif';
        ctx.fillText(`Entities: ${ents.length}  |  Zoom: ${zoomRef.current.toFixed(2)}x`, 20, 50);
        if (selectedIdxRef.current !== null) {
            const sel = ents[selectedIdxRef.current];
            ctx.fillStyle = '#ffd700';
            ctx.fillText(`Selected: ${sel.type} on layer "${sel.layer}" (${sel.points.length} pts, ${sel.closed ? 'closed' : 'open'})`, 20, 70);
        }
    }, []);

    // ─── Fit all entities in view ─────────────────────────────────────────────
    const fitView = useCallback(() => {
        const canvas = canvasRef.current;
        const ents = entitiesRef.current;
        if (!canvas || !ents.length) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        ents.forEach(ent => ent.points.forEach(p => {
            // points stored as {x: northing, y: easting} so canvas x=easting=p.y
            minX = Math.min(minX, p.y); maxX = Math.max(maxX, p.y);
            minY = Math.min(minY, p.x); maxY = Math.max(maxY, p.x);
        }));

        const W = canvas.width, H = canvas.height, pad = 60;
        const wx = (maxX - minX) || 1, wy = (maxY - minY) || 1;
        const scale = Math.min((W - pad * 2) / wx, (H - pad * 2) / wy, 500);

        zoomRef.current = scale;
        panRef.current = {
            x: W / 2 - ((minX + maxX) / 2) * scale,
            y: H / 2 + ((minY + maxY) / 2) * scale,
        };
        setZoomDisplay(scale);
        drawCanvas();
    }, [drawCanvas]);

    // ─── Canvas event setup ───────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resize = () => {
            const r = container.getBoundingClientRect();
            canvas.width = r.width; canvas.height = r.height;
            drawCanvas();
        };

        const onWheel = (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const oldZ = zoomRef.current;
            const newZ = Math.max(0.001, Math.min(10000, oldZ * delta));
            const sc = newZ / oldZ;
            panRef.current = { x: mx - (mx - panRef.current.x) * sc, y: my - (my - panRef.current.y) * sc };
            zoomRef.current = newZ;
            setZoomDisplay(newZ);
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

        const onMouseUp = () => { isDraggingRef.current = false; canvas.style.cursor = 'crosshair'; };

        const onClick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
            const THRESH = 8; // pixels
            let best = null, bestDist = Infinity;

            entitiesRef.current.forEach((ent, i) => {
                if (ent.type === 'LINE' || ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                    const pts = ent.points;
                    const len = ent.closed ? pts.length : pts.length - 1;
                    for (let j = 0; j < len; j++) {
                        const a = w2s(pts[j].y, pts[j].x);
                        const b = w2s(pts[(j + 1) % pts.length].y, pts[(j + 1) % pts.length].x);
                        const d = distPointToSegment(cx, cy, a.x, a.y, b.x, b.y);
                        if (d < THRESH && d < bestDist) { bestDist = d; best = i; }
                    }
                }
            });

            selectedIdxRef.current = best;
            setSelectedIdx(best);
            drawCanvas();
        };

        resize();
        window.addEventListener('resize', resize);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);
        canvas.addEventListener('click', onClick);

        return () => {
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseUp);
            canvas.removeEventListener('click', onClick);
        };
    }, [drawCanvas]);

    // ─── File open — use Electron dialog for a guaranteed full path ───────────
    const handleOpenFile = async () => {
        if (loading) return;

        // Use Electron's native file dialog if available (gives real absolute path)
        let filePath = null;
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            const result = await window.electronAPI.showOpenDialog({
                title: 'Open AutoCAD File',
                filters: [
                    { name: 'AutoCAD Files', extensions: ['dxf', 'dwg'] },
                    { name: 'DXF Files', extensions: ['dxf'] },
                    { name: 'DWG Files', extensions: ['dwg'] },
                ],
                properties: ['openFile'],
            });
            if (!result || result.canceled || !result.filePaths || !result.filePaths[0]) return;
            filePath = result.filePaths[0];
        }

        if (!filePath) {
            toast.error('File picker not available. Please run in the Electron desktop app.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/parse-cad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || 'Failed to parse CAD file');
                return;
            }

            entitiesRef.current = data.entities || [];
            setEntities(data.entities || []);
            setFileName(data.fileName);
            setSelectedIdx(null);
            selectedIdxRef.current = null;

            const layers = [...new Set((data.entities || []).map(e => e.layer))];
            setLayerList(layers);

            toast.success(`Loaded ${data.entities.length} entities from ${data.fileName}`);
            setTimeout(fitView, 100);
        } catch (err) {
            toast.error('Connection error — is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    // ─── Create parcel from selected entity ──────────────────────────────────
    const handleCreateParcel = async () => {
        if (selectedIdx === null) { toast.error('Please click a polyline on the canvas first'); return; }
        const ent = entities[selectedIdx];
        if (!ent || ent.points.length < 3) { toast.error('Selected entity has fewer than 3 points'); return; }
        if (!ent.closed) { toast.error('Please select a CLOSED polyline to create a parcel'); return; }

        // Generate unique point IDs
        const existingIds = new Set(Object.keys(loadedPoints));
        let counter = 1;
        const newPoints = { ...loadedPoints };
        const ids = [];

        ent.points.forEach(p => {
            let pid;
            do { pid = `CAD_${counter++}`; } while (existingIds.has(pid));
            existingIds.add(pid);
            newPoints[pid] = { x: p.x, y: p.y };
            ids.push(pid);
        });

        // Calculate area via backend
        let area = null, perimeter = null;
        try {
            const res = await fetch('http://localhost:5000/api/calculate-area', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points: newPoints, ids }),
            });
            if (res.ok) { const d = await res.json(); area = d.area; perimeter = d.perimeter; }
        } catch (_) { }

        const newParcel = {
            id: Date.now(),
            number: (savedParcels.length + 1).toString(),
            ids,
            area,
            perimeter,
            source: 'cad',
        };

        setLoadedPoints(newPoints);
        setSavedParcels(prev => [...prev, newParcel]);
        setHasUnsavedChanges(true);

        toast.success(
            `Parcel ${newParcel.number} created with ${ids.length} points` +
            (area ? ` — Area: ${area.toFixed(2)} m²` : '')
        );
    };

    // ─── Load raw points into project ─────────────────────────────────────────
    const handleLoadPoints = () => {
        if (!entities.length) { toast.error('No file loaded'); return; }

        // Extract all vertices from all closed polylines as survey points
        const existing = new Set(Object.keys(loadedPoints));
        let counter = 1;
        const newPoints = { ...loadedPoints };
        let added = 0;

        entities.forEach(ent => {
            if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                ent.points.forEach(p => {
                    let pid;
                    do { pid = `CAD_${counter++}`; } while (existing.has(pid));
                    existing.add(pid);
                    newPoints[pid] = { x: p.x, y: p.y };
                    added++;
                });
            }
        });

        setLoadedPoints(newPoints);
        setHasUnsavedChanges(true);
        toast.success(`Loaded ${added} survey points from the CAD file`);
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-dark-900 p-6">
            <div className="max-w-full mx-auto">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                    <button onClick={() => navigate('/')} className="btn-secondary mb-4 flex items-center gap-2">
                        <ArrowLeft className="w-5 h-5" /> ↩ MAIN MENU
                    </button>

                    <div className="glass-effect rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-3xl font-bold text-primary mb-1">🏗️ CAD Import</h1>
                                <p className="text-dark-300">Open AutoCAD files (.dxf / .dwg), select a boundary, and create a parcel</p>
                            </div>
                        </div>

                        {/* Controls row */}
                        <div className="flex gap-2 flex-wrap items-center">
                            {/* File picker via Electron dialog */}
                            <button
                                onClick={handleOpenFile}
                                disabled={loading}
                                className="btn-primary text-sm py-2 px-3 flex items-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                {loading ? 'Loading...' : 'Open DXF / DWG'}
                            </button>

                            {fileName && (
                                <span className="text-sm text-dark-300 font-mono px-3 py-2 bg-dark-800 rounded-lg border border-dark-600">
                                    📄 {fileName}
                                </span>
                            )}

                            <div className="h-6 w-px bg-dark-600 mx-2" />

                            <button onClick={() => { zoomRef.current = Math.min(10000, zoomRef.current * 1.2); setZoomDisplay(zoomRef.current); drawCanvas(); }} className="btn-secondary text-sm py-2 px-3">
                                <ZoomIn className="w-4 h-4 inline mr-1" /> Zoom In
                            </button>
                            <button onClick={() => { zoomRef.current = Math.max(0.001, zoomRef.current * 0.8); setZoomDisplay(zoomRef.current); drawCanvas(); }} className="btn-secondary text-sm py-2 px-3">
                                <ZoomOut className="w-4 h-4 inline mr-1" /> Zoom Out
                            </button>
                            <button onClick={fitView} className="btn-secondary text-sm py-2 px-3">
                                <RotateCcw className="w-4 h-4 inline mr-1" /> Fit All
                            </button>

                            <div className="h-6 w-px bg-dark-600 mx-2" />

                            <button
                                onClick={handleCreateParcel}
                                disabled={selectedIdx === null}
                                className={`text-sm py-2 px-4 rounded-lg flex items-center gap-2 font-semibold transition-all ${selectedIdx !== null
                                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                                    : 'bg-dark-700 text-dark-500 cursor-not-allowed'
                                    }`}
                            >
                                <Plus className="w-4 h-4" />
                                Create Parcel from Selection
                            </button>

                            <button
                                onClick={handleLoadPoints}
                                disabled={!entities.length}
                                className="btn-secondary text-sm py-2 px-3 flex items-center gap-2"
                            >
                                <MapPin className="w-4 h-4" /> Load as Survey Points
                            </button>
                        </div>

                        {/* Layer list */}
                        {layerList.length > 0 && (
                            <div className="mt-3 flex gap-2 flex-wrap">
                                {layerList.map((layer, idx) => (
                                    <span
                                        key={layer}
                                        className="text-xs px-2 py-1 rounded-full font-mono border"
                                        style={{ borderColor: layerColor(layer, idx), color: layerColor(layer, idx), background: layerColor(layer, idx) + '18' }}
                                    >
                                        {layer}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Canvas */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-effect rounded-xl p-4">
                    <div
                        ref={containerRef}
                        className="w-full bg-dark-800 rounded-lg overflow-hidden border border-dark-700"
                        style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}
                    >
                        <canvas
                            ref={canvasRef}
                            className="cursor-crosshair w-full h-full"
                            style={{ display: 'block' }}
                        />
                    </div>
                    <div className="mt-3 text-sm text-dark-400">
                        <p>🖱️ <strong>Scroll:</strong> Zoom • <strong>Drag:</strong> Pan • <strong>Click a line:</strong> Select boundary → press <em>Create Parcel</em></p>
                    </div>
                </motion.div>

            </div>
        </div>
    );
};

export default DxfImport;
