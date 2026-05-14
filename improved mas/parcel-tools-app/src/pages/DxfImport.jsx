import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, ZoomIn, ZoomOut, RotateCcw, Plus, MapPin, Layers } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';

// ─── Colour palette for layers fallback ──────────────────────────────────────
const LAYER_COLORS = [
    '#58a6ff', '#3fb950', '#f85149', '#f1e05a', '#a5a5a5',
    '#ff7b72', '#d2a8ff', '#79c0ff', '#56d364', '#ffa657',
];
function layerColor(layer, idx) {
    if (!layer || layer === '0') return '#8b949e';
    const layerStr = String(layer);
    return LAYER_COLORS[Math.abs([...layerStr].reduce((a, c) => a + c.charCodeAt(0), 0)) % LAYER_COLORS.length];
}

// ─── Hit-test: is point near a polyline segment? ──────────────────────────────
function distPointToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

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

    const w2s = (wx, wy) => ({
        x: wx * zoomRef.current + panRef.current.x,
        y: -wy * zoomRef.current + panRef.current.y,
    });
    const s2w = (sx, sy) => ({
        x: (sx - panRef.current.x) / zoomRef.current,
        y: -(sy - panRef.current.y) / zoomRef.current,
    });

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width: W, height: H } = canvas;

        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        // Grid
        const step = 50 / zoomRef.current;
        if (step > 1) {
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
        }

        const ents = entitiesRef.current;
        if (!ents.length) {
            ctx.fillStyle = '#8b949e'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('Please open a DXF or DWG file to begin', W / 2, H / 2);
            return;
        }

        ents.forEach((ent, i) => {
            const isSelected = i === selectedIdxRef.current;
            let color = '#ffffff';
            try {
                if (ent.color) color = ent.color;
                else color = layerColor(ent.layer, i);
                if (color === '#000000') color = '#ffffff';
                if (isSelected) color = '#ffd700';
            } catch (e) { color = '#ffffff'; }
            
            ctx.strokeStyle = color;
            ctx.lineWidth = isSelected ? 3 : 1.2;

            const isShape = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE', 'TEXT'].includes(ent.type);
            if (isShape && ent.points && ent.points.length > 0) {
                ctx.beginPath();
                ent.points.forEach((p, pi) => {
                    const sx = p.y * zoomRef.current + panRef.current.x;
                    const sy = -p.x * zoomRef.current + panRef.current.y;
                    if (pi === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
                });
                if (ent.closed && ent.points.length > 1) ctx.closePath();
                ctx.stroke();

                if (isSelected && ent.closed && ['LWPOLYLINE', 'POLYLINE', 'CIRCLE'].includes(ent.type)) {
                    ctx.fillStyle = '#ffd70025'; ctx.fill();
                }
            } else if (ent.type === 'TEXT_LABEL' && ent.text) {
                ctx.fillStyle = color;
                const fontSize = Math.max(10, (ent.height || 2) * zoomRef.current);
                if (fontSize < 200) {
                    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
                    const sx = ent.y * zoomRef.current + panRef.current.x;
                    const sy = -ent.x * zoomRef.current + panRef.current.y;
                    ctx.fillText(ent.text, sx, sy);
                }
            }
        });
    }, []);

    const fitView = useCallback(() => {
        const canvas = canvasRef.current;
        const ents = entitiesRef.current;
        if (!canvas || !ents.length) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        ents.forEach(ent => (ent.points || []).forEach(p => {
            minX = Math.min(minX, p.y); maxX = Math.max(maxX, p.y);
            minY = Math.min(minY, p.x); maxY = Math.max(maxY, p.x);
        }));
        if (minX === Infinity) return;
        const W = canvas.width, H = canvas.height, pad = 40;
        const wx = (maxX - minX) || 1, wy = (maxY - minY) || 1;
        const scale = Math.min((W - pad * 2) / wx, (H - pad * 2) / wy, 1000);
        zoomRef.current = scale;
        panRef.current = { x: W / 2 - ((minX + maxX) / 2) * scale, y: H / 2 + ((minY + maxY) / 2) * scale };
        setZoomDisplay(scale);
        drawCanvas();
    }, [drawCanvas]);

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
            const delta = e.deltaY > 0 ? 0.85 : 1.15;
            const oldZ = zoomRef.current;
            const newZ = Math.max(0.00001, Math.min(100000, oldZ * delta));
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
            const THRESH = 10;
            let best = null, bestDist = Infinity;
            entitiesRef.current.forEach((ent, i) => {
                if (['LINE', 'LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE'].includes(ent.type) && ent.points) {
                    const pts = ent.points;
                    const len = ent.closed ? pts.length : pts.length - 1;
                    for (let j = 0; j < len; j++) {
                        const a = w2s(pts[j].y, pts[j].x), b = w2s(pts[(j + 1) % pts.length].y, pts[(j + 1) % pts.length].x);
                        const d = distPointToSegment(cx, cy, a.x, a.y, b.x, b.y);
                        if (d < THRESH && d < bestDist) { bestDist = d; best = i; }
                    }
                }
            });
            selectedIdxRef.current = best; setSelectedIdx(best); drawCanvas();
        };
        resize();
        window.addEventListener('resize', resize);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('click', onClick);
        return () => {
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('click', onClick);
        };
    }, [drawCanvas]);

    const handleOpenFile = async () => {
        if (loading) return;
        let filePath = null;
        if (window.electronAPI?.showOpenDialog) {
            const result = await window.electronAPI.showOpenDialog({
                title: 'Open AutoCAD File',
                filters: [{ name: 'AutoCAD Files', extensions: ['dxf', 'dwg'] }],
                properties: ['openFile'],
            });
            if (result?.filePaths?.[0]) filePath = result.filePaths[0];
        }
        if (!filePath) return;
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/parse-cad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            entitiesRef.current = data.entities || [];
            setEntities(data.entities || []);
            setFileName(data.fileName);
            setSelectedIdx(null); selectedIdxRef.current = null;
            setLayerList([...new Set((data.entities || []).map(e => e.layer))]);
            setTimeout(fitView, 100);
        } catch (err) { toast.error(err.message || 'Error loading file'); }
        finally { setLoading(false); }
    };

    const handleCreateParcel = async () => {
        if (selectedIdx === null) return;
        const ent = entities[selectedIdx];
        if (!ent.closed) { toast.error('Select a CLOSED polyline'); return; }
        const existingIds = new Set(Object.keys(loadedPoints));
        let counter = 1; const newPoints = { ...loadedPoints }; const ids = [];
        ent.points.forEach(p => {
            let pid; do { pid = `CAD_${counter++}`; } while (existingIds.has(pid));
            existingIds.add(pid); newPoints[pid] = { x: p.x, y: p.y }; ids.push(pid);
        });
        let area = null, perimeter = null;
        try {
            const res = await fetch('http://localhost:5000/api/calculate-area', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points: newPoints, ids }),
            });
            if (res.ok) { const d = await res.json(); area = d.area; perimeter = d.perimeter; }
        } catch (_) { }
        const newParcel = { id: Date.now(), number: (savedParcels.length + 1).toString(), ids, area, perimeter, source: 'cad' };
        setLoadedPoints(newPoints); setSavedParcels(prev => [...prev, newParcel]); setHasUnsavedChanges(true);
        toast.success(`Parcel ${newParcel.number} created`);
    };

    return (
        <div className="h-screen flex flex-col bg-dark-900 text-dark-100 overflow-hidden">
            {/* Top Bar */}
            <div className="flex-none p-2 border-b border-dark-700 bg-dark-800/50 backdrop-blur-md flex items-center gap-3">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-dark-700 rounded-lg text-dark-400">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="h-8 w-px bg-dark-700" />
                <h1 className="text-sm font-bold text-primary whitespace-nowrap">🏗️ CAD IMPORT</h1>
                
                <button onClick={handleOpenFile} disabled={loading} className="btn-primary text-[11px] py-1.5 px-3 flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" /> {loading ? '...' : 'OPEN'}
                </button>

                {fileName && <span className="text-[10px] text-dark-400 bg-dark-900 px-2 py-1 rounded border border-dark-700 max-w-[150px] truncate">{fileName}</span>}

                <div className="h-8 w-px bg-dark-700" />

                {layerList.length > 0 && (
                    <div className="flex items-center gap-2 bg-dark-900 px-2 py-1 rounded border border-dark-700">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <select className="bg-transparent text-[11px] outline-none border-none cursor-pointer" onChange={(e) => e.target.value && toast.info(`Layer: ${e.target.value}`)}>
                            <option value="">{layerList.length} LAYERS</option>
                            {layerList.map(l => <option key={l} value={l} className="bg-dark-800">{l}</option>)}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-1">
                    <button onClick={() => { zoomRef.current *= 1.2; setZoomDisplay(zoomRef.current); drawCanvas(); }} className="p-1.5 hover:bg-dark-700 rounded"><ZoomIn className="w-4 h-4" /></button>
                    <button onClick={() => { zoomRef.current *= 0.8; setZoomDisplay(zoomRef.current); drawCanvas(); }} className="p-1.5 hover:bg-dark-700 rounded"><ZoomOut className="w-4 h-4" /></button>
                    <button onClick={fitView} className="p-1.5 hover:bg-dark-700 rounded"><RotateCcw className="w-4 h-4" /></button>
                </div>

                <div className="flex-1" />

                <button onClick={handleCreateParcel} disabled={selectedIdx === null} className={`text-[11px] font-bold py-1.5 px-4 rounded-lg flex items-center gap-2 transition-all ${selectedIdx !== null ? 'bg-yellow-500 text-black' : 'bg-dark-700 text-dark-500 cursor-not-allowed'}`}>
                    <Plus className="w-3.5 h-3.5" /> CREATE PARCEL
                </button>
            </div>

            {/* Viewport Area */}
            <div className="flex-1 relative bg-black overflow-hidden" ref={containerRef}>
                <canvas ref={canvasRef} />
                
                {/* Floating HUD */}
                <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none">
                    <div className="bg-dark-900/80 backdrop-blur-md border border-dark-700 px-3 py-1.5 rounded-lg flex gap-4 text-[10px] font-mono text-dark-400">
                        <span>ZOOM: {(zoomDisplay * 100).toFixed(1)}%</span>
                        <span>ENTITIES: {entities.length}</span>
                    </div>
                    {selectedIdx !== null && (
                        <div className="bg-yellow-500/10 backdrop-blur-md border border-yellow-500/30 px-3 py-1.5 rounded-lg text-[10px] font-mono text-yellow-500">
                            SELECTED: {entities[selectedIdx].type} | LAYER: {entities[selectedIdx].layer}
                        </div>
                    )}
                </div>

                <div className="absolute top-4 right-4 bg-dark-900/50 backdrop-blur-sm border border-dark-700 px-3 py-2 rounded-lg text-[10px] text-dark-400 pointer-events-none">
                    🖱️ Scroll: Zoom • Drag: Pan • Click: Select
                </div>
            </div>
        </div>
    );
};

export default DxfImport;
