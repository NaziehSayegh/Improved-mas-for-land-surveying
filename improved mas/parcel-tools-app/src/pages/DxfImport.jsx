import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowLeft, Upload, ZoomIn, ZoomOut, RotateCcw, Plus, MapPin, 
    Layers, ArrowUp, ArrowDown, RefreshCw, Star, Bookmark, History, 
    Clock, Search, Eye, Trash2, Edit3, X, ChevronRight, Maximize2, 
    FileText, CheckCircle2, Copy, Sparkles, AlertCircle 
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useToast } from '../context/ToastContext';
import { customConfirm } from '../utils/dialogs';

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

function isPointInPolygon(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y;
        const xj = pts[j].x, yj = pts[j].y;
        const intersect = ((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// ─── Polygon & Arc Geometry Math Helpers ────────────────────────────────────
function isPolygonCCW(pts) {
    if (!pts || pts.length < 3) return true;
    let sum = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        if (p1 && p2 && typeof p1.x === 'number' && typeof p1.y === 'number' && typeof p2.x === 'number' && typeof p2.y === 'number') {
            sum += p1.x * p2.y - p2.x * p1.y;
        }
    }
    return sum > 0;
}

function getArcPoints(A, B, M, sign, isCCW) {
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
}

function calculatePolygonMetrics(pts, curves = []) {
    if (!pts || pts.length < 3) return null;
    let baseArea = 0;
    let perimeter = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const p1 = pts[i];
        const p2 = pts[j];
        if (!p1 || !p2 || typeof p1.x !== 'number' || typeof p1.y !== 'number' || typeof p2.x !== 'number' || typeof p2.y !== 'number') {
            return null;
        }
        baseArea += p1.x * p2.y - p2.x * p1.y;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        perimeter += Math.hypot(dx, dy);
    }
    baseArea = Math.abs(baseArea) / 2;

    let curveAdjustment = 0;
    if (curves && curves.length > 0) {
        for (const curve of curves) {
            const M = Number(curve.M || 0);
            const sign = Number(curve.sign || 1);
            let fromPt = null, toPt = null;

            if (typeof curve.fromIndex === 'number' && typeof curve.toIndex === 'number' && pts[curve.fromIndex] && pts[curve.toIndex]) {
                fromPt = pts[curve.fromIndex];
                toPt = pts[curve.toIndex];
            } else if (curve.from && curve.to) {
                const fIdx = pts.findIndex(p => String(p.id || p.pointId || p.label) === String(curve.from));
                const tIdx = pts.findIndex(p => String(p.id || p.pointId || p.label) === String(curve.to));
                if (fIdx !== -1 && tIdx !== -1) {
                    fromPt = pts[fIdx];
                    toPt = pts[tIdx];
                }
            }

            if (fromPt && toPt && M > 0) {
                const C = Math.hypot(toPt.x - fromPt.x, toPt.y - fromPt.y);
                if (C > 0) {
                    const R = (C * C) / (8.0 * M) + (M / 2.0);
                    const theta = 2.0 * Math.asin(Math.min(1.0, C / (2.0 * R)));
                    const segArea = 0.5 * R * R * (theta - Math.sin(theta));
                    curveAdjustment += segArea * sign;
                }
            }
        }
    }

    const finalArea = Math.max(0, baseArea + curveAdjustment);
    return {
        baseArea,
        curveAdjustment,
        area: finalArea,
        perimeter,
        dunams: finalArea / 1000,
        pointCount: n
    };
}

function isParcelLayer(layerName, layerList = []) {
    if (!layerName) return false;
    const lname = String(layerName).trim().toUpperCase();
    const hasGis = layerList.some(l => {
        const n = String(l.name || '').trim().toUpperCase();
        return n === 'GIS' || n.includes('GIS');
    });
    if (hasGis) {
        return lname === 'GIS' || lname.includes('GIS');
    }
    return ['PARCEL', 'PLOT', 'TABU', 'QUSAI', 'QASIMA', 'BOUNDARY OF PARTITION'].some(k => lname.includes(k));
}

// ─── Auto Arc Extraction ─────────────────────────────────────────────────────
// Reads the 'segments' array already sent by the backend for LWPOLYLINE/POLYLINE
// entities that have bulge (arc) vertices. For each arc segment it finds the two
// REAL corner points that bracket the arc (skipping tessellated intermediate points),
// computes the middle ordinate M (already provided by backend) and the correct sign
// (+1 = arc adds area, -1 = arc subtracts area) from the polygon winding direction.
// Returns an array of curve objects ready to be placed directly into the curves state.
function extractAutoArcsFromEntity(ent, detectedPts) {
    if (!ent || !ent.segments || ent.segments.length === 0) return [];
    const COORD_THRESH = 0.05; // 5 cm — enough for surveying coordinates
    const autoArcs = [];
    const segs = ent.segments;
    const isCCW = isPolygonCCW(detectedPts.map(p => ({ x: p.x, y: p.y })));

    for (let i = 0; i < segs.length; i++) {
        if (segs[i].type !== 'arc') continue;
        const arcSeg = segs[i];
        // M is now sent by the backend; skip arcs with no valid M
        if (!arcSeg.M || arcSeg.M <= 0) continue;

        // 'from' real corner = the line segment immediately before this arc
        const fromLine = (i > 0 && segs[i - 1].type === 'line') ? segs[i - 1] : null;
        if (!fromLine) continue;

        // 'to' real corner = the next line segment (skip any consecutive arcs)
        let toLine = null;
        for (let j = i + 1; j < segs.length; j++) {
            if (segs[j].type === 'line') { toLine = segs[j]; break; }
        }
        // Wrap around for closed polylines
        if (!toLine) {
            toLine = segs.find(s => s.type === 'line') || null;
        }
        if (!toLine) continue;

        // Match real corner coords to detectedPts (which contain only real corners + CAD_N ids)
        const fromPt = detectedPts.find(p =>
            Math.hypot(p.x - fromLine.x, p.y - fromLine.y) < COORD_THRESH
        );
        const toPt = detectedPts.find(p =>
            Math.hypot(p.x - toLine.x, p.y - toLine.y) < COORD_THRESH
        );
        if (!fromPt || !toPt || fromPt.pointId === toPt.pointId) continue;

        // Sign: outward arc (same winding as polygon) adds area (+1), inward subtracts (-1)
        // CCW polygon + CCW arc → arc bulges outward → +1
        // CCW polygon + CW arc  → arc bulges inward  → -1
        // CW  polygon + CW arc  → arc bulges outward → +1
        // CW  polygon + CCW arc → arc bulges inward  → -1
        const sign = (isCCW === arcSeg.ccw) ? 1 : -1;

        autoArcs.push({ from: fromPt.pointId, to: toPt.pointId, M: arcSeg.M, sign });
    }
    return autoArcs;
}

// ─── Inline Modal Boundary Preview Component ────────────────────────────────
function ModalBoundaryPreview({ detectedPoints, loadedPoints, curves, parcelNumber, metrics }) {
    const canvasRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const handleResetView = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    // Derive points coordinates
    const parcelCoords = useMemo(() => {
        if (!detectedPoints || detectedPoints.length === 0) return [];
        return detectedPoints.map((p, i) => {
            const resolved = loadedPoints[p.pointId];
            return {
                id: p.pointId || `#${i + 1}`,
                vertexIdx: i,
                x: resolved ? resolved.x : p.x,
                y: resolved ? resolved.y : p.y,
                isMatched: !!resolved
            };
        });
    }, [detectedPoints, loadedPoints]);

    const isCCW = useMemo(() => isPolygonCCW(parcelCoords), [parcelCoords]);

    // Bounding Box
    const bounds = useMemo(() => {
        if (!parcelCoords || parcelCoords.length === 0) return null;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        parcelCoords.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        if (minX === Infinity) return null;
        const width = maxX - minX;
        const height = maxY - minY;
        return {
            minX, maxX, minY, maxY,
            width, height,
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2
        };
    }, [parcelCoords]);

    // Draw canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        if (w === 0 || h === 0) return;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        // Background
        ctx.fillStyle = '#090d13';
        ctx.fillRect(0, 0, w, h);

        if (!bounds || parcelCoords.length < 2) {
            ctx.fillStyle = '#64748b';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Select or add at least 3 points to preview boundary', w / 2, h / 2);
            return;
        }

        // Calculate fit scale (with padding)
        const pad = 42;
        const availW = Math.max(10, w - pad * 2);
        const availH = Math.max(10, h - pad * 2);
        const scaleX = bounds.width > 0 ? availW / bounds.width : 1;
        const scaleY = bounds.height > 0 ? availH / bounds.height : 1;
        const baseScale = Math.min(scaleX, scaleY);
        const activeScale = baseScale * zoom;

        // Coordinate transforms (Y flipped for surveying north-up)
        const wx2sx = (wx) => (wx - bounds.cx) * activeScale + w / 2 + pan.x;
        const wy2sy = (wy) => -(wy - bounds.cy) * activeScale + h / 2 + pan.y;

        // Draw subtle coordinate grid
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
        ctx.lineWidth = 1;
        const gridStep = Math.max(20, 45 * zoom);
        for (let x = (w / 2 + pan.x) % gridStep; x < w; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = (h / 2 + pan.y) % gridStep; y < h; y += gridStep) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Draw Polygon Path & Curves
        ctx.save();
        ctx.strokeStyle = '#06b6d4';
        ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const n = parcelCoords.length;
        for (let i = 0; i < n; i++) {
            const p1 = parcelCoords[i];
            const p2 = parcelCoords[(i + 1) % n];

            const curve = (curves || []).find(c =>
                (String(c.from) === String(p1.id) && String(c.to) === String(p2.id)) ||
                (String(c.from) === String(p2.id) && String(c.to) === String(p1.id))
            );

            if (curve && Number(curve.M) > 0) {
                const isReversed = String(curve.from) === String(p2.id) && String(curve.to) === String(p1.id);
                const drawSign = isReversed ? -curve.sign : curve.sign;
                const arcPts = getArcPoints(p1, p2, Number(curve.M), drawSign, isCCW);
                arcPts.forEach((ap, api) => {
                    const sx = wx2sx(ap.x), sy = wy2sy(ap.y);
                    if (i === 0 && api === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                });
            } else {
                const sx1 = wx2sx(p1.x), sy1 = wy2sy(p1.y);
                const sx2 = wx2sx(p2.x), sy2 = wy2sy(p2.y);
                if (i === 0) ctx.moveTo(sx1, sy1);
                ctx.lineTo(sx2, sy2);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Draw segment lengths & traverse badges
        for (let i = 0; i < n; i++) {
            const p1 = parcelCoords[i];
            const p2 = parcelCoords[(i + 1) % n];
            const sx1 = wx2sx(p1.x), sy1 = wy2sy(p1.y);
            const sx2 = wx2sx(p2.x), sy2 = wy2sy(p2.y);

            const curve = (curves || []).find(c =>
                (String(c.from) === String(p1.id) && String(c.to) === String(p2.id)) ||
                (String(c.from) === String(p2.id) && String(c.to) === String(p1.id))
            );

            const midX = (sx1 + sx2) / 2;
            const midY = (sy1 + sy2) / 2;
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

            if (dist > 0.01) {
                ctx.save();
                const distText = curve ? `Arc M=${curve.M}m (${dist.toFixed(1)}m)` : `${dist.toFixed(2)}m`;
                ctx.font = '9px JetBrains Mono, monospace, sans-serif';
                ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
                ctx.strokeStyle = curve ? '#06b6d4' : '#334155';
                ctx.lineWidth = 1;

                const textW = ctx.measureText(distText).width;
                const bx = midX - textW / 2 - 4;
                const by = midY - 7;
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(bx, by, textW + 8, 14, 4);
                } else {
                    ctx.rect(bx, by, textW + 8, 14);
                }
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = curve ? '#67e8f9' : '#94a3b8';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(distText, midX, midY);
                ctx.restore();
            }
        }

        // Draw Corner Vertices with badges
        parcelCoords.forEach((p, i) => {
            const sx = wx2sx(p.x), sy = wy2sy(p.y);
            const isStart = i === 0;

            ctx.save();
            ctx.fillStyle = isStart ? '#eab308' : '#06b6d4';
            ctx.beginPath();
            ctx.arc(sx, sy, isStart ? 5.5 : 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.stroke();

            const label = isStart ? `#${i + 1} ★ ${p.id}` : `#${i + 1} ${p.id}`;
            ctx.font = isStart ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
            ctx.fillStyle = isStart ? '#fef08a' : '#ffffff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.fillText(label, sx + 7, sy - 4);
            ctx.restore();
        });

        // Centroid Parcel Info Badge
        if (parcelCoords.length >= 3 && bounds) {
            const scx = wx2sx(bounds.cx), scy = wy2sy(bounds.cy);
            ctx.save();
            const pNumText = `Parcel #${parcelNumber || '---'}`;
            const areaText = metrics?.area != null ? `${metrics.area.toFixed(2)} m²` : '';
            ctx.font = 'bold 12px Inter, sans-serif';
            const w1 = ctx.measureText(pNumText).width;
            ctx.font = '10px Inter, sans-serif';
            const w2 = ctx.measureText(areaText).width;
            const maxW = Math.max(w1, w2) + 16;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
            ctx.lineWidth = 1;
            const bx = scx - maxW / 2;
            const by = scy - 18;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(bx, by, maxW, 36, 6);
            } else {
                ctx.rect(bx, by, maxW, 36);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'center';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.fillText(pNumText, scx, scy - 4);

            if (areaText) {
                ctx.fillStyle = '#a5f3fc';
                ctx.font = '10px font-mono, sans-serif';
                ctx.fillText(areaText, scx, scy + 11);
            }
            ctx.restore();
        }

    }, [parcelCoords, curves, bounds, zoom, pan, isCCW, parcelNumber, metrics]);

    // Mouse handlers for dragging/panning
    const handleMouseDown = (e) => {
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };
    const handleMouseMove = (e) => {
        if (!isDraggingRef.current) return;
        setPan({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };
    const handleMouseUp = () => { isDraggingRef.current = false; };
    const handleWheel = (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        setZoom(prev => Math.min(5, Math.max(0.2, prev * factor)));
    };

    return (
        <div className="flex flex-col bg-dark-900 border border-dark-700 rounded-xl overflow-hidden shadow-inner">
            {/* Header & Controls */}
            <div className="p-3 bg-dark-850 border-b border-dark-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-sans flex items-center gap-1.5">
                        📐 Computed Boundary Plot
                    </span>
                    <span className={`text-[9px] font-mono px-2 py-0.2 rounded font-medium ${isCCW ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'}`}>
                        {isCCW ? '↺ CCW Direction' : '↻ CW Direction'}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <button 
                        type="button"
                        onClick={() => setZoom(z => Math.min(5, z * 1.2))}
                        className="p-1 hover:bg-dark-750 text-dark-300 hover:text-white rounded transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        type="button"
                        onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
                        className="p-1 hover:bg-dark-750 text-dark-300 hover:text-white rounded transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        type="button"
                        onClick={handleResetView}
                        className="p-1 hover:bg-dark-750 text-dark-300 hover:text-yellow-400 rounded transition-colors"
                        title="Fit Boundary to Preview"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Canvas Viewport */}
            <div 
                className="relative h-64 sm:h-80 w-full bg-black cursor-grab active:cursor-grabbing overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <canvas ref={canvasRef} className="w-full h-full block" />
                <div className="absolute bottom-2 left-2 text-[9px] font-mono text-dark-500 bg-dark-950/80 px-2 py-0.5 rounded border border-dark-800 pointer-events-none">
                    Drag: Pan • Scroll: Zoom • Start: #1 ★
                </div>
            </div>

            {/* Bottom Details Footer */}
            <div className="p-2.5 bg-dark-850 border-t border-dark-700/80 flex items-center justify-between text-[10px] font-mono text-dark-400">
                <span>
                    Extent: <strong className="text-dark-200">{bounds ? `${bounds.width.toFixed(2)}m × ${bounds.height.toFixed(2)}m` : '0m × 0m'}</strong>
                </span>
                <span>
                    Corners: <strong className="text-white">{detectedPoints.length}</strong> ({curves.length} curves)
                </span>
            </div>
        </div>
    );
}

const DxfImport = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { 
        loadedPoints, setLoadedPoints, savedParcels, setSavedParcels, 
        hasUnsavedChanges, setHasUnsavedChanges, saveActiveProject, 
        projectPath, projectName, pointsFileName, pointsFilePath,
        cadFilePath, setCadFilePath, cadFileName, setCadFileName,
        cadEntities, setCadEntities, cadLayers, setCadLayers,
        cadVisibleLayers, setCadVisibleLayers
    } = useProject();

    // Allow DWG import if: a project file is saved (.prcl) OR a points file is loaded
    const hasPointsFile = Boolean(pointsFilePath) || (Boolean(pointsFileName) && Object.keys(loadedPoints).length > 0);
    const hasProject = Boolean(projectPath) || hasPointsFile;

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

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleBackToMainMenu();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleBackToMainMenu]);

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const zoomRef = useRef(1);
    const panRef = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const entitiesRef = useRef([]);
    const selectedIdxRef = useRef(null);

    // Refs to avoid stale closures in canvas drawing
    const savedParcelsRef = useRef(savedParcels);
    useEffect(() => { savedParcelsRef.current = savedParcels || []; }, [savedParcels]);
    const loadedPointsRef = useRef(loadedPoints);
    useEffect(() => { loadedPointsRef.current = loadedPoints || {}; }, [loadedPoints]);

    const [fileName, setFileName] = useState('');
    const [entities, setEntities] = useState([]);
    const [selectedIdx, setSelectedIdx] = useState(null);
    const [zoomDisplay, setZoomDisplay] = useState(1);
    const [loading, setLoading] = useState(false);

    // Modal state for parcel review and point correlation
    const [showModal, setShowModal] = useState(false);
    const [detectedNumber, setDetectedNumber] = useState('');
    const [detectedPoints, setDetectedPoints] = useState([]);
    const [parcelNumberInput, setParcelNumberInput] = useState('');
    const [newPointsToRegister, setNewPointsToRegister] = useState({});
    const [renumberStartInput, setRenumberStartInput] = useState('1');
    const [editingParcelId, setEditingParcelId] = useState(null);
    const [saveMode, setSaveMode] = useState('update'); // 'update' | 'new'

    // Curves & Arcs state for active parcel review
    const [curves, setCurves] = useState([]); // array of { from, to, M, sign }
    const curvesRef = useRef(curves);
    useEffect(() => { curvesRef.current = curves; }, [curves]);
    const [curveFrom, setCurveFrom] = useState('');
    const [curveTo, setCurveTo] = useState('');
    const [curveM, setCurveM] = useState('');
    const [curveSign, setCurveSign] = useState(1);
    const [editingCurveIdx, setEditingCurveIdx] = useState(null);
    const [showCurvesSection, setShowCurvesSection] = useState(true);

    // Layer Management
    const [layerList, setLayerList] = useState([]);
    const layerListRef = useRef([]);
    useEffect(() => { layerListRef.current = layerList || []; }, [layerList]);
    const [visibleLayers, setVisibleLayers] = useState({});
    const visibleLayersRef = useRef({});
    const [showLayerPanel, setShowLayerPanel] = useState(false);
    const [layerSearch, setLayerSearch] = useState('');

    // Saved Parcels & Versions History Management
    const [showParcelsPanel, setShowParcelsPanel] = useState(false);
    const [parcelsTab, setParcelsTab] = useState('saved'); // 'saved' | 'versions'
    const [parcelSearch, setParcelSearch] = useState('');
    const [selectedSavedParcelId, setSelectedSavedParcelId] = useState(null);
    const selectedSavedParcelIdRef = useRef(null);
    useEffect(() => { selectedSavedParcelIdRef.current = selectedSavedParcelId; }, [selectedSavedParcelId]);

    // Unique parcels (latest entry for each parcel number)
    const uniqueParcels = useMemo(() => {
        const unique = [];
        const seen = new Set();
        for (let i = (savedParcels || []).length - 1; i >= 0; i--) {
            const p = savedParcels[i];
            const k = (p.number || '').trim().toLowerCase();
            if (!seen.has(k)) {
                seen.add(k);
                unique.push(p);
            }
        }
        return unique;
    }, [savedParcels]);

    // Filtered unique parcels based on search query
    const filteredUniqueParcels = useMemo(() => {
        if (!parcelSearch.trim()) return uniqueParcels;
        const q = parcelSearch.toLowerCase().trim();
        return uniqueParcels.filter(p => 
            (p.number || '').toLowerCase().includes(q) ||
            (p.ids || []).some(id => String(id).toLowerCase().includes(q))
        );
    }, [uniqueParcels, parcelSearch]);

    // All parcel versions (newest first)
    const allVersionsList = useMemo(() => {
        return [...(savedParcels || [])].reverse();
    }, [savedParcels]);

    // Filtered all versions based on search query
    const filteredAllVersions = useMemo(() => {
        if (!parcelSearch.trim()) return allVersionsList;
        const q = parcelSearch.toLowerCase().trim();
        return allVersionsList.filter(p => 
            (p.number || '').toLowerCase().includes(q) ||
            (p.ids || []).some(id => String(id).toLowerCase().includes(q))
        );
    }, [allVersionsList, parcelSearch]);

    // Live computed metrics for currently selected entity on CAD canvas
    const selectedEntity = (selectedIdx !== null && entities[selectedIdx]) ? entities[selectedIdx] : null;
    const selectedEntityMetrics = useMemo(() => {
        if (!selectedEntity || !selectedEntity.points || selectedEntity.points.length < 3) return null;
        return calculatePolygonMetrics(selectedEntity.points);
    }, [selectedEntity]);

    // Live computed metrics for the Review & Point Correlation Modal
    const modalLiveMetrics = useMemo(() => {
        if (!detectedPoints || detectedPoints.length < 3) return null;

        const unmatched = detectedPoints.filter(p => !loadedPoints[p.pointId]);
        const isMixed = unmatched.length > 0 && unmatched.length < detectedPoints.length;

        // Build coordinate array
        const coords = detectedPoints.map(p => {
            if (loadedPoints[p.pointId]) {
                return { ...loadedPoints[p.pointId], pointId: p.pointId };
            }
            return { x: p.x, y: p.y, pointId: p.pointId };
        });

        const metrics = calculatePolygonMetrics(coords, curves);
        if (!metrics) return null;

        return {
            ...metrics,
            isMixed,
            allMatched: unmatched.length === 0,
            allUnmatched: unmatched.length === detectedPoints.length,
            matchedCount: detectedPoints.length - unmatched.length,
            unmatchedCount: unmatched.length
        };
    }, [detectedPoints, loadedPoints, curves]);

    const toggleLayer = (layerName) => {
        const newVis = { ...visibleLayers, [layerName]: !visibleLayers[layerName] };
        setVisibleLayers(newVis);
        visibleLayersRef.current = newVis;
        setCadVisibleLayers(newVis);
        setHasUnsavedChanges(true);
        drawCanvas();
    };

    const isolateLayer = (layerName) => {
        const newVis = {};
        layerList.forEach(l => { newVis[l.name] = (l.name === layerName); });
        setVisibleLayers(newVis);
        visibleLayersRef.current = newVis;
        setCadVisibleLayers(newVis);
        setHasUnsavedChanges(true);
        drawCanvas();
    };

    const setAllLayers = (state) => {
        const newVis = {};
        layerList.forEach(l => { newVis[l.name] = state; });
        setVisibleLayers(newVis);
        visibleLayersRef.current = newVis;
        setCadVisibleLayers(newVis);
        setHasUnsavedChanges(true);
        drawCanvas();
    };

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

        // Helper: world-to-screen transform (Y axis flipped: DXF Y is up, canvas Y is down)
        const wx2sx = (wx) => wx * zoomRef.current + panRef.current.x;
        const wy2sy = (wy) => -wy * zoomRef.current + panRef.current.y;

        // ─── Draw a path using the dense tessellated 'points' array ──────────────
        const buildPath = (ctx, ent) => {
            ctx.beginPath();
            if (ent.points && ent.points.length > 0) {
                ent.points.forEach((p, pi) => {
                    const sx = wx2sx(p.x), sy = wy2sy(p.y);
                    if (pi === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
                });
            }
            if (ent.closed && ent.points?.length > 1) ctx.closePath();
        };

        ents.forEach((ent, i) => {
            // Check layer visibility
            if (visibleLayersRef.current && visibleLayersRef.current[ent.layer] === false) return;

            const isSelected = i === selectedIdxRef.current;
            let color = '#ffffff';
            try {
                if (ent.color) color = ent.color;
                else color = layerColor(ent.layer, i);
                if (color === '#000000') color = '#ffffff';
                if (isSelected) color = '#ffd700';
            } catch (e) { color = '#ffffff'; }

            const isShape = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE'].includes(ent.type);
            if (isShape && (ent.points || ent.segments) && (ent.points?.length > 0 || ent.segments?.length > 0)) {
                ctx.strokeStyle = color;
                ctx.lineWidth = isSelected ? 3 : 1.5;
                buildPath(ctx, ent);
                ctx.stroke();

                if (isSelected && ent.closed && ['LWPOLYLINE', 'POLYLINE', 'CIRCLE'].includes(ent.type)) {
                    ctx.fillStyle = '#ffd70025';
                    buildPath(ctx, ent);
                    ctx.fill();

                    // Draw Live Computed Area Badge near centroid of selected entity
                    if (ent.points && ent.points.length >= 3) {
                        const metrics = calculatePolygonMetrics(ent.points);
                        if (metrics) {
                            const cx = ent.points.reduce((sum, p) => sum + p.x, 0) / ent.points.length;
                            const cy = ent.points.reduce((sum, p) => sum + p.y, 0) / ent.points.length;
                            const scx = wx2sx(cx), scy = wy2sy(cy);

                            ctx.save();
                            const labelText = `📐 Area: ${metrics.area.toFixed(2)} m²`;
                            const dunamText = `(${metrics.dunams.toFixed(3)} dunam)`;
                            ctx.font = 'bold 12px Inter, sans-serif';
                            const textWidth = Math.max(ctx.measureText(labelText).width, ctx.measureText(dunamText).width);
                            
                            // Background badge
                            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                            ctx.strokeStyle = '#eab308';
                            ctx.lineWidth = 1.5;
                            const padX = 10, padY = 6;
                            const boxW = textWidth + padX * 2;
                            const boxH = 38;
                            const boxX = scx - boxW / 2;
                            const boxY = scy - boxH / 2;

                            ctx.beginPath();
                            if (typeof ctx.roundRect === 'function') {
                                ctx.roundRect(boxX, boxY, boxW, boxH, 8);
                            } else {
                                ctx.rect(boxX, boxY, boxW, boxH);
                            }
                            ctx.fill();
                            ctx.stroke();

                            // Text
                            ctx.fillStyle = '#fef08a';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'top';
                            ctx.fillText(labelText, scx, boxY + 5);
                            ctx.font = '10px Inter, sans-serif';
                            ctx.fillStyle = '#ca8a04';
                            ctx.fillText(dunamText, scx, boxY + 21);
                            ctx.restore();
                        }
                    }
                }
                // Render filled SOLIDs (from title blocks, filled arrows, etc.)
                if (ent.filled && ent.closed) {
                    ctx.fillStyle = color;
                    buildPath(ctx, ent);
                    ctx.fill();
                }
            } else if (ent.type === 'TEXT_LABEL' && ent.text) {
                ctx.save();
                ctx.fillStyle = color;

                const renderSize = (ent.height || 2.5) * zoomRef.current * 1.38;
                if (renderSize < 0.3 || renderSize >= 5000) {
                    ctx.restore();
                    return;
                }
                const sx = wx2sx(ent.x);
                const sy = wy2sy(ent.y);

                ctx.translate(sx, sy);
                if (ent.rotation) {
                    ctx.rotate(-ent.rotation * Math.PI / 180);
                }

                ctx.font = `${renderSize.toFixed(2)}px Inter, monospace, sans-serif`;

                const hMap = { left: 'left', center: 'center', right: 'right' };
                const vMap = { top: 'top', middle: 'middle', alphabetic: 'alphabetic', bottom: 'bottom' };
                ctx.textAlign = hMap[ent.halign] || 'left';
                ctx.textBaseline = vMap[ent.valign] || 'alphabetic';

                ctx.fillText(ent.text, 0, 0);
                ctx.restore();
            }
        });

        // ─── Render Visual Highlight for Selected Saved Parcel ──────────────
        const activeParcelId = selectedSavedParcelIdRef.current;
        if (activeParcelId && savedParcelsRef.current) {
            const activeParcel = savedParcelsRef.current.find(p => p.id === activeParcelId);
            if (activeParcel && activeParcel.ids && activeParcel.ids.length >= 2) {
                const pts = activeParcel.ids
                    .map(id => loadedPointsRef.current?.[id])
                    .filter(Boolean);

                if (pts.length >= 2) {
                    ctx.save();
                    ctx.strokeStyle = '#00f0ff';
                    ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
                    ctx.lineWidth = 3.5;
                    ctx.setLineDash([8, 4]);
                    ctx.shadowColor = '#00f0ff';
                    ctx.shadowBlur = 12;

                    const isCCW = isPolygonCCW(pts);
                    const parcelCurves = activeParcel.curves || [];

                    ctx.beginPath();
                    const n = activeParcel.ids.length;
                    for (let i = 0; i < n; i++) {
                        const id1 = activeParcel.ids[i];
                        const id2 = activeParcel.ids[(i + 1) % n];
                        const pt1 = loadedPointsRef.current?.[id1];
                        const pt2 = loadedPointsRef.current?.[id2];
                        if (!pt1 || !pt2) continue;

                        const curve = parcelCurves.find(c => 
                            (String(c.from) === String(id1) && String(c.to) === String(id2)) ||
                            (String(c.from) === String(id2) && String(c.to) === String(id1))
                        );

                        if (curve && Number(curve.M) > 0) {
                            const isReversed = String(curve.from) === String(id2) && String(curve.to) === String(id1);
                            const drawSign = isReversed ? -curve.sign : curve.sign;
                            const arcPts = getArcPoints(pt1, pt2, Number(curve.M), drawSign, isCCW);
                            arcPts.forEach((ap, api) => {
                                const sx = wx2sx(ap.x), sy = wy2sy(ap.y);
                                if (i === 0 && api === 0) ctx.moveTo(sx, sy);
                                else ctx.lineTo(sx, sy);
                            });
                        } else {
                            const sx1 = wx2sx(pt1.x), sy1 = wy2sy(pt1.y);
                            const sx2 = wx2sx(pt2.x), sy2 = wy2sy(pt2.y);
                            if (i === 0) ctx.moveTo(sx1, sy1);
                            ctx.lineTo(sx2, sy2);
                        }
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Draw corner point badges
                    ctx.setLineDash([]);
                    ctx.shadowBlur = 0;
                    pts.forEach((p, idx) => {
                        const sx = wx2sx(p.x), sy = wy2sy(p.y);
                        const pid = activeParcel.ids[idx];

                        // Point marker circle
                        ctx.fillStyle = '#00f0ff';
                        ctx.beginPath();
                        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.strokeStyle = '#0d1117';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();

                        // Point label badge
                        if (pid) {
                            ctx.font = 'bold 11px Inter, sans-serif';
                            ctx.fillStyle = '#ffffff';
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'middle';
                            ctx.shadowColor = '#000000';
                            ctx.shadowBlur = 6;
                            ctx.fillText(pid, sx + 8, sy - 8);
                        }
                    });

                    // Centroid label for parcel number
                    if (pts.length >= 3) {
                        const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
                        const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
                        const scx = wx2sx(cx), scy = wy2sy(cy);

                        ctx.font = 'bold 13px Inter, sans-serif';
                        ctx.fillStyle = '#00f0ff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.shadowColor = '#000000';
                        ctx.shadowBlur = 8;
                        ctx.fillText(`PARCEL #${activeParcel.number}`, scx, scy);
                        if (activeParcel.area != null) {
                            ctx.font = '10px Inter, sans-serif';
                            ctx.fillStyle = '#a5f3fc';
                            ctx.fillText(`${Number(activeParcel.area).toFixed(2)} m²`, scx, scy + 16);
                        }
                    }

                    ctx.restore();
                }
            }
        }
    }, []);

    const fitView = useCallback(() => {
        const canvas = canvasRef.current;
        const ents = entitiesRef.current;
        if (!canvas || !ents.length) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        ents.forEach(ent => (ent.points || []).forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
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

    // ── Focus & Zoom to a specific parcel ──────────────────────────────────
    const focusOnParcel = useCallback((parcel) => {
        if (!parcel || !parcel.ids || parcel.ids.length === 0) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let foundPoints = 0;
        
        parcel.ids.forEach(id => {
            const pt = loadedPointsRef.current[id];
            if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
                minX = Math.min(minX, pt.x);
                maxX = Math.max(maxX, pt.x);
                minY = Math.min(minY, pt.y);
                maxY = Math.max(maxY, pt.y);
                foundPoints++;
            }
        });

        if (foundPoints >= 2 && minX !== Infinity) {
            const W = canvas.width, H = canvas.height, pad = 90;
            const wx = (maxX - minX) || 50, wy = (maxY - minY) || 50;
            const scale = Math.min((W - pad * 2) / wx, (H - pad * 2) / wy, 1000);
            zoomRef.current = scale;
            panRef.current = { x: W / 2 - ((minX + maxX) / 2) * scale, y: H / 2 + ((minY + maxY) / 2) * scale };
            setZoomDisplay(scale);
            drawCanvas();
        }
    }, [drawCanvas]);

    // ── Select a saved parcel and highlight it on canvas ─────────────────
    const handleSelectSavedParcel = useCallback((parcel) => {
        if (!parcel) return;
        setSelectedSavedParcelId(parcel.id);
        selectedSavedParcelIdRef.current = parcel.id;
        focusOnParcel(parcel);
        drawCanvas();
    }, [focusOnParcel, drawCanvas]);

    // ── Load previous parcel version into Review/Edit modal ────────────────
    const handleLoadPreviousVersion = useCallback((parcel) => {
        if (!parcel) return;
        setSelectedSavedParcelId(parcel.id);
        selectedSavedParcelIdRef.current = parcel.id;
        
        const pts = (parcel.ids || []).map((pid, idx) => {
            const pt = loadedPointsRef.current[pid];
            return {
                vertexIdx: idx,
                x: pt ? pt.x : 0,
                y: pt ? pt.y : 0,
                label: pid,
                dist: 0,
                pointId: pid,
                status: pt ? 'matched' : 'missing'
            };
        });

        setDetectedNumber(parcel.number);
        setParcelNumberInput(parcel.number);
        setDetectedPoints(pts);
        setCurves(parcel.curves ? JSON.parse(JSON.stringify(parcel.curves)) : []);
        setEditingCurveIdx(null);
        setCurveFrom('');
        setCurveTo('');
        setCurveM('');
        setCurveSign(1);
        setEditingParcelId(parcel.id);
        setSaveMode('update');
        syncMissingPoints(pts);
        setShowModal(true);
        focusOnParcel(parcel);
        toast.success(`Loaded Parcel #${parcel.number} (${parcel.ids.length} corners, ${(parcel.curves || []).length} curves) for review`);
    }, [focusOnParcel, toast]);

    // ── Delete a saved parcel / version ────────────────────────────────────
    const handleDeleteSavedParcel = async (parcelId, e) => {
        if (e) e.stopPropagation();
        const toDelete = (savedParcels || []).find(p => p.id === parcelId);
        const parcelName = toDelete ? `Parcel #${toDelete.number}` : 'this parcel';
        
        if (!(await customConfirm(`Are you sure you want to delete ${parcelName}?`))) {
            return;
        }
        
        const updated = (savedParcels || []).filter(p => p.id !== parcelId);
        setSavedParcels(updated);
        savedParcelsRef.current = updated;
        setHasUnsavedChanges(true);
        
        if (selectedSavedParcelId === parcelId) {
            setSelectedSavedParcelId(null);
            selectedSavedParcelIdRef.current = null;
        }
        
        if (typeof saveActiveProject === 'function') {
            await saveActiveProject(null, updated);
        }
        
        drawCanvas();
        toast.success(`Deleted ${parcelName}`);
    };

    useEffect(() => {
        if (cadEntities && cadEntities.length > 0) {
            entitiesRef.current = cadEntities;
            setEntities(cadEntities);
            setFileName(cadFileName || '');
            setLayerList(cadLayers || []);
            setVisibleLayers(cadVisibleLayers || {});
            visibleLayersRef.current = cadVisibleLayers || {};
            setTimeout(fitView, 100);
        } else if (cadFilePath && (!cadEntities || cadEntities.length === 0)) {
            setLoading(true);
            fetch('http://localhost:5000/api/parse-cad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: cadFilePath }),
            })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (!ok) throw new Error(data.error || 'Failed to auto-open CAD file');
                entitiesRef.current = data.entities || [];
                setEntities(data.entities || []);
                setFileName(data.fileName);
                setCadEntities(data.entities || []);
                setCadFileName(data.fileName);
                const newLayers = data.layers || [];
                setLayerList(newLayers);
                setCadLayers(newLayers);
                const initialVis = {};
                newLayers.forEach(l => { initialVis[l.name] = l.visible !== false; });
                setVisibleLayers(initialVis);
                visibleLayersRef.current = initialVis;
                setCadVisibleLayers(initialVis);
                setHasUnsavedChanges(true);
                if (projectPath && typeof saveActiveProject === 'function') {
                    setTimeout(() => saveActiveProject(), 200);
                }
                setTimeout(fitView, 100);
            })
            .catch(err => {
                console.error('[CAD Auto-Load Error]', err);
                toast.error(`Could not auto-open CAD file: ${cadFilePath}`);
            })
            .finally(() => setLoading(false));
        }
    }, [cadFilePath, cadEntities, cadFileName, cadLayers, cadVisibleLayers, fitView]);

    // Auto-save CAD state changes to the active project file on disk
    useEffect(() => {
        if (!projectPath || !cadFilePath || typeof saveActiveProject !== 'function') return;
        const timer = setTimeout(() => {
            if (hasUnsavedChanges) {
                saveActiveProject();
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [projectPath, cadFilePath, cadEntities, cadLayers, cadVisibleLayers, hasUnsavedChanges, saveActiveProject]);

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
            const clickWorld = s2w(cx, cy);
            
            const THRESH = 10;
            let best = null, bestDist = Infinity;
            
            entitiesRef.current.forEach((ent, i) => {
                if (visibleLayersRef.current && visibleLayersRef.current[ent.layer] === false) return;

                if (ent.closed && !ent.filled && ent.type !== 'CIRCLE' && ent.points && ent.points.length >= 3 && isParcelLayer(ent.layer, layerListRef.current)) {
                    if (isPointInPolygon(clickWorld.x, clickWorld.y, ent.points)) {
                        best = i; bestDist = 0;
                    }
                }

                // ── New: also allow selecting filled/hatch entities ──
                // Only takes effect when no parcel-layer boundary is already found (bestDist > 0).
                // This gives parcel-layer polylines priority — they always win with bestDist=0.
                if (bestDist > 0 && ent.closed && ent.filled && ent.type !== 'CIRCLE' &&
                    ent.points && ent.points.length >= 3) {
                    if (isPointInPolygon(clickWorld.x, clickWorld.y, ent.points)) {
                        best = i; bestDist = 0.5;
                    }
                }

                if (bestDist > 0 && ['LINE', 'LWPOLYLINE', 'POLYLINE', 'ARC', 'CIRCLE'].includes(ent.type) && ent.points) {
                    if (ent.closed && (ent.filled || ent.type === 'CIRCLE' || !isParcelLayer(ent.layer, layerListRef.current))) {
                        return;
                    }
                    const pts = ent.points;
                    const len = ent.closed ? pts.length : pts.length - 1;
                    for (let j = 0; j < len; j++) {
                        const a = w2s(pts[j].x, pts[j].y), b = w2s(pts[(j + 1) % pts.length].x, pts[(j + 1) % pts.length].y);
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
        if (!hasProject) {
            toast.error('⚠️ Please open or create a project first before loading a CAD file.');
            return;
        }
        let filePath = null;
        if (window.electronAPI) {
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
            
            const newLayers = data.layers || [];
            setLayerList(newLayers);
            const initialVis = {};
            newLayers.forEach(l => {
                initialVis[l.name] = l.visible !== false;
            });
            setVisibleLayers(initialVis);
            visibleLayersRef.current = initialVis;
            
            setCadFilePath(filePath);
            setCadFileName(data.fileName);
            setCadEntities(data.entities || []);
            setCadLayers(newLayers);
            setCadVisibleLayers(initialVis);
            setHasUnsavedChanges(true);
            if (projectPath && typeof saveActiveProject === 'function') {
                setTimeout(() => saveActiveProject(), 200);
            }
            
            setTimeout(fitView, 100);
        } catch (err) { toast.error(err.message || 'Error loading file'); }
        finally { setLoading(false); }
    };

    const handleReloadCad = async () => {
        if (loading || !cadFilePath) return;
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/parse-cad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: cadFilePath }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reload CAD file');
            entitiesRef.current = data.entities || [];
            setEntities(data.entities || []);
            setFileName(data.fileName);
            setSelectedIdx(null); selectedIdxRef.current = null;
            
            const newLayers = data.layers || [];
            setLayerList(newLayers);
            const initialVis = {};
            newLayers.forEach(l => {
                initialVis[l.name] = l.visible !== false;
            });
            setVisibleLayers(initialVis);
            visibleLayersRef.current = initialVis;
            
            setCadFilePath(cadFilePath);
            setCadFileName(data.fileName);
            setCadEntities(data.entities || []);
            setCadLayers(newLayers);
            setCadVisibleLayers(initialVis);
            setHasUnsavedChanges(true);
            if (projectPath && typeof saveActiveProject === 'function') {
                setTimeout(() => saveActiveProject(), 200);
            }
            setTimeout(fitView, 100);
            toast.completed({
                title: 'CAD File Synchronized',
                message: `Re-parsed ${data.fileName || 'CAD file'} successfully with active layers.`,
                badge: 'CAD Updated',
                details: [
                    { label: 'Entities', value: `${(data.entities || []).length} items` },
                    { label: 'Layers', value: `${newLayers.length} active` }
                ],
                duration: 4500
            });
        } catch (err) {
            toast.error(err.message || 'Error reloading CAD file');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateParcel = async () => {
        if (selectedIdx === null) return;
        const ent = entities[selectedIdx];

        // ── New: route filled/hatch entities to dedicated handler (no layer restriction) ──
        if (ent.filled && ent.closed && ent.type !== 'CIRCLE') {
            handleCreateParcelFromHatch(ent);
            return;
        }

        // ── Existing guard — unchanged ──
        if (!ent.closed || ent.filled || ent.type === 'CIRCLE' || !isParcelLayer(ent.layer, layerListRef.current)) {
            toast.error('Please select a valid boundary polygon on the GIS / Parcel layer');
            return;
        }

        setEditingParcelId(null);
        setSaveMode('new');
        setCurves([]);
        setEditingCurveIdx(null);
        setCurveFrom('');
        setCurveTo('');
        setCurveM('');
        setCurveSign(1);

        const allLabels = entities.filter(e => e.type === 'TEXT_LABEL');
        const isNumericLabel = (txt) => /^\s*\d+(\.\d+)?\s*$/.test(txt);

        let parcelNo = '';
        const labelsInside = allLabels.filter(lbl => isPointInPolygon(lbl.x, lbl.y, ent.points));
        
        const descLabelsInside = labelsInside.filter(lbl => /description|desc/i.test(lbl.layer || ''));
        const numericDescInside = descLabelsInside.filter(lbl => isNumericLabel(lbl.text));
        const numericInside = labelsInside.filter(lbl => isNumericLabel(lbl.text));

        let searchPool = [];
        if (numericDescInside.length > 0) searchPool = numericDescInside;
        else if (descLabelsInside.length > 0) searchPool = descLabelsInside;
        else if (numericInside.length > 0) searchPool = numericInside;
        else searchPool = labelsInside;

        if (searchPool.length > 0) {
            let sx = 0, sy = 0;
            ent.points.forEach(p => { sx += p.x; sy += p.y; });
            const centroid = { x: sx / ent.points.length, y: sy / ent.points.length };
            searchPool.sort((a, b) =>
                Math.hypot(a.x - centroid.x, a.y - centroid.y) -
                Math.hypot(b.x - centroid.x, b.y - centroid.y)
            );
            parcelNo = searchPool[0].text.trim().replace(/^Parcel\s+|^\#\s*|^No\.\s*/i, '');
        }
        if (!parcelNo) {
            parcelNo = ((savedParcels || []).length + 1).toString();
        }

        const rawPts = ent.points;
        const uniqueVerts = [];
        const MERGE_THRESHOLD = 1e-3;
        rawPts.forEach(p => {
            if (uniqueVerts.length === 0) {
                uniqueVerts.push(p);
                return;
            }
            const prev = uniqueVerts[uniqueVerts.length - 1];
            if (Math.hypot(p.x - prev.x, p.y - prev.y) > MERGE_THRESHOLD) {
                uniqueVerts.push(p);
            }
        });
        if (uniqueVerts.length > 1) {
            const first = uniqueVerts[0], last = uniqueVerts[uniqueVerts.length - 1];
            if (Math.hypot(first.x - last.x, first.y - last.y) <= MERGE_THRESHOLD) {
                uniqueVerts.pop();
            }
        }

        const xs = uniqueVerts.map(p => p.x);
        const ys = uniqueVerts.map(p => p.y);
        const bbW = Math.max(...xs) - Math.min(...xs);
        const bbH = Math.max(...ys) - Math.min(...ys);
        const bbDiag = Math.hypot(bbW, bbH);
        const DYNAMIC_THRESHOLD = Math.max(15, Math.min(500, bbDiag * 0.25));

        const detectedPts = [];
        const missingPoints = {};
        const candidateLabels = allLabels.filter(lbl => lbl.text && lbl.text.trim().length > 0 && lbl.text.trim().length <= 15);

        const scoreCandidate = (lbl, dist) => {
            const layer = (lbl.layer || '').toLowerCase();
            let score = dist;
            if (/corner|number|mark|point|node|boundary|original|pt|num|no|id/i.test(layer)) {
                score -= DYNAMIC_THRESHOLD * 3;
            }
            if (/^\s*\d+(\.\d+)?\s*$/.test(lbl.text)) {
                score -= DYNAMIC_THRESHOLD;
            }
            if (/dimension|dim|table|title|description|desc|road|elevation/i.test(layer)) {
                score += DYNAMIC_THRESHOLD * 3;
            }
            return score;
        };

        const allPairs = [];
        uniqueVerts.forEach((p, vIdx) => {
            candidateLabels.forEach((lbl, lIdx) => {
                const d = Math.hypot(lbl.x - p.x, lbl.y - p.y);
                if (d < DYNAMIC_THRESHOLD) {
                    allPairs.push({ vIdx, lIdx, lbl, d, score: scoreCandidate(lbl, d) });
                }
            });
        });

        allPairs.sort((a, b) => a.score - b.score);

        const assignedLabels = new Array(uniqueVerts.length).fill(null);
        const usedLabelIndices = new Set();
        const usedVertexIndices = new Set();

        for (const pair of allPairs) {
            if (!usedVertexIndices.has(pair.vIdx) && !usedLabelIndices.has(pair.lIdx)) {
                assignedLabels[pair.vIdx] = { label: pair.lbl.text.trim(), dist: pair.d };
                usedVertexIndices.add(pair.vIdx);
                usedLabelIndices.add(pair.lIdx);
            }
        }

        uniqueVerts.forEach((p, idx) => {
            const match = assignedLabels[idx];
            const matchedLabel = match ? match.label : null;
            const matchedDist  = match ? match.dist : Infinity;
            let status  = 'missing';
            let pointId = '';

            if (matchedLabel) {
                pointId = matchedLabel;
                if (loadedPoints[pointId]) {
                    status = 'matched';
                } else {
                    status = 'missing';
                    missingPoints[pointId] = { x: p.x, y: p.y };
                }
            } else {
                let counter = 1;
                const existingIds = new Set([...Object.keys(loadedPoints), ...Object.keys(missingPoints)]);
                do { pointId = `CAD_${counter++}`; } while (existingIds.has(pointId));
                status = 'generated';
                missingPoints[pointId] = { x: p.x, y: p.y };
            }

            detectedPts.push({
                vertexIdx: idx,
                x: p.x,
                y: p.y,
                label: matchedLabel,
                dist: matchedDist,
                pointId,
                status
            });
        });

        setDetectedNumber(parcelNo);
        setParcelNumberInput(parcelNo);
        setDetectedPoints(detectedPts);
        setNewPointsToRegister(missingPoints);

        // ── New: auto-populate curves from CAD arc segments (non-hatch only) ──
        // extractAutoArcsFromEntity reads the 'segments' array (backend sends M + theta
        // for each arc), maps arc endpoints to real corner point IDs in detectedPts,
        // and computes the correct sign from polygon winding. User can still edit freely.
        const autoArcs = extractAutoArcsFromEntity(ent, detectedPts);
        if (autoArcs.length > 0) setCurves(autoArcs);

        setShowModal(true);
    };

    // ── New: create parcel from a filled/hatch entity ─────────────────────────
    // Identical flow to handleCreateParcel but skips the isParcelLayer check and
    // skips auto-arc extraction (hatch boundaries are tessellated flat polygons).
    // No existing code is touched — this is a fully additive new function.
    const handleCreateParcelFromHatch = (ent) => {
        setEditingParcelId(null);
        setSaveMode('new');
        setCurves([]);
        setEditingCurveIdx(null);
        setCurveFrom('');
        setCurveTo('');
        setCurveM('');
        setCurveSign(1);

        const allLabels = entities.filter(e => e.type === 'TEXT_LABEL');
        const isNumericLabel = (txt) => /^\s*\d+(\.\d+)?\s*$/.test(txt);

        let parcelNo = '';
        const labelsInside = allLabels.filter(lbl => isPointInPolygon(lbl.x, lbl.y, ent.points));
        const descLabelsInside = labelsInside.filter(lbl => /description|desc/i.test(lbl.layer || ''));
        const numericDescInside = descLabelsInside.filter(lbl => isNumericLabel(lbl.text));
        const numericInside = labelsInside.filter(lbl => isNumericLabel(lbl.text));

        let searchPool = [];
        if (numericDescInside.length > 0) searchPool = numericDescInside;
        else if (descLabelsInside.length > 0) searchPool = descLabelsInside;
        else if (numericInside.length > 0) searchPool = numericInside;
        else searchPool = labelsInside;

        if (searchPool.length > 0) {
            let sx = 0, sy = 0;
            ent.points.forEach(p => { sx += p.x; sy += p.y; });
            const centroid = { x: sx / ent.points.length, y: sy / ent.points.length };
            searchPool.sort((a, b) =>
                Math.hypot(a.x - centroid.x, a.y - centroid.y) -
                Math.hypot(b.x - centroid.x, b.y - centroid.y)
            );
            parcelNo = searchPool[0].text.trim().replace(/^Parcel\s+|^\#\s*|^No\.\s*/i, '');
        }
        if (!parcelNo) {
            parcelNo = ((savedParcels || []).length + 1).toString();
        }

        const rawPts = ent.points;
        const uniqueVerts = [];
        const MERGE_THRESHOLD = 1e-3;
        rawPts.forEach(p => {
            if (uniqueVerts.length === 0) { uniqueVerts.push(p); return; }
            const prev = uniqueVerts[uniqueVerts.length - 1];
            if (Math.hypot(p.x - prev.x, p.y - prev.y) > MERGE_THRESHOLD) uniqueVerts.push(p);
        });
        if (uniqueVerts.length > 1) {
            const first = uniqueVerts[0], last = uniqueVerts[uniqueVerts.length - 1];
            if (Math.hypot(first.x - last.x, first.y - last.y) <= MERGE_THRESHOLD) uniqueVerts.pop();
        }

        const xs = uniqueVerts.map(p => p.x);
        const ys = uniqueVerts.map(p => p.y);
        const bbW = Math.max(...xs) - Math.min(...xs);
        const bbH = Math.max(...ys) - Math.min(...ys);
        const bbDiag = Math.hypot(bbW, bbH);
        const DYNAMIC_THRESHOLD = Math.max(15, Math.min(500, bbDiag * 0.25));

        const detectedPts = [];
        const missingPoints = {};
        const candidateLabels = allLabels.filter(lbl => lbl.text && lbl.text.trim().length > 0 && lbl.text.trim().length <= 15);

        const scoreCandidate = (lbl, dist) => {
            const layer = (lbl.layer || '').toLowerCase();
            let score = dist;
            if (/corner|number|mark|point|node|boundary|original|pt|num|no|id/i.test(layer)) score -= DYNAMIC_THRESHOLD * 3;
            if (/^\s*\d+(\.\d+)?\s*$/.test(lbl.text)) score -= DYNAMIC_THRESHOLD;
            if (/dimension|dim|table|title|description|desc|road|elevation/i.test(layer)) score += DYNAMIC_THRESHOLD * 3;
            return score;
        };

        const allPairs = [];
        uniqueVerts.forEach((p, vIdx) => {
            candidateLabels.forEach((lbl, lIdx) => {
                const d = Math.hypot(lbl.x - p.x, lbl.y - p.y);
                if (d < DYNAMIC_THRESHOLD) allPairs.push({ vIdx, lIdx, lbl, d, score: scoreCandidate(lbl, d) });
            });
        });
        allPairs.sort((a, b) => a.score - b.score);

        const assignedLabels = new Array(uniqueVerts.length).fill(null);
        const usedLabelIndices = new Set();
        const usedVertexIndices = new Set();
        for (const pair of allPairs) {
            if (!usedVertexIndices.has(pair.vIdx) && !usedLabelIndices.has(pair.lIdx)) {
                assignedLabels[pair.vIdx] = { label: pair.lbl.text.trim(), dist: pair.d };
                usedVertexIndices.add(pair.vIdx);
                usedLabelIndices.add(pair.lIdx);
            }
        }

        uniqueVerts.forEach((p, idx) => {
            const match = assignedLabels[idx];
            const matchedLabel = match ? match.label : null;
            const matchedDist  = match ? match.dist : Infinity;
            let status = 'missing';
            let pointId = '';
            if (matchedLabel) {
                pointId = matchedLabel;
                status = loadedPoints[pointId] ? 'matched' : 'missing';
                if (!loadedPoints[pointId]) missingPoints[pointId] = { x: p.x, y: p.y };
            } else {
                let counter = 1;
                const existingIds = new Set([...Object.keys(loadedPoints), ...Object.keys(missingPoints)]);
                do { pointId = `CAD_${counter++}`; } while (existingIds.has(pointId));
                status = 'generated';
                missingPoints[pointId] = { x: p.x, y: p.y };
            }
            detectedPts.push({ vertexIdx: idx, x: p.x, y: p.y, label: matchedLabel, dist: matchedDist, pointId, status });
        });

        setDetectedNumber(parcelNo);
        setParcelNumberInput(parcelNo);
        setDetectedPoints(detectedPts);
        setNewPointsToRegister(missingPoints);
        setShowModal(true);
    };

    const syncMissingPoints = (pointsArray) => {
        const missing = {};
        pointsArray.forEach(item => {
            if (item.status !== 'matched' && item.pointId) {
                missing[item.pointId] = { x: item.x, y: item.y };
            }
        });
        setNewPointsToRegister(missing);
    };

    const handleUpdatePointId = (vertexIdx, newId) => {
        const updated = [...detectedPoints];
        const row = updated[vertexIdx];
        const cleanedId = newId.trim();

        row.pointId = cleanedId;
        if (!cleanedId) {
            row.status = 'missing';
        } else if (loadedPoints[cleanedId]) {
            row.status = 'matched';
        } else {
            row.status = 'missing';
        }

        setDetectedPoints(updated);
        syncMissingPoints(updated);
    };

    // ── Order & Renumbering Helpers for Modal ──
    const handleMovePointUp = (idx) => {
        if (idx === 0) return;
        const updated = [...detectedPoints];
        const temp = updated[idx - 1];
        updated[idx - 1] = updated[idx];
        updated[idx] = temp;
        updated.forEach((p, i) => p.vertexIdx = i);
        setDetectedPoints(updated);
        syncMissingPoints(updated);
    };

    const handleMovePointDown = (idx) => {
        if (idx === detectedPoints.length - 1) return;
        const updated = [...detectedPoints];
        const temp = updated[idx + 1];
        updated[idx + 1] = updated[idx];
        updated[idx] = temp;
        updated.forEach((p, i) => p.vertexIdx = i);
        setDetectedPoints(updated);
        syncMissingPoints(updated);
    };

    const handleSetAsStartPoint = (idx) => {
        if (idx === 0) return;
        const updated = [
            ...detectedPoints.slice(idx),
            ...detectedPoints.slice(0, idx)
        ];
        updated.forEach((p, i) => p.vertexIdx = i);
        setDetectedPoints(updated);
        syncMissingPoints(updated);
        toast.success(`Point ${updated[0].pointId || `#${idx + 1}`} set as start corner (#1)`);
    };

    const handleReverseOrder = () => {
        if (detectedPoints.length <= 1) return;
        const updated = [...detectedPoints].reverse();
        updated.forEach((p, i) => p.vertexIdx = i);
        setDetectedPoints(updated);
        syncMissingPoints(updated);
        toast.success('Boundary corner sequence reversed');
    };

    const handleAutoRenumber = () => {
        const startNum = parseInt(renumberStartInput, 10);
        if (isNaN(startNum)) {
            toast.error('Enter a valid starting integer');
            return;
        }
        const updated = detectedPoints.map((row, idx) => {
            const newId = (startNum + idx).toString();
            return {
                ...row,
                pointId: newId,
                status: loadedPoints[newId] ? 'matched' : 'generated'
            };
        });
        setDetectedPoints(updated);
        syncMissingPoints(updated);
        toast.success(`Renumbered corners sequentially from ${startNum}`);
    };

    const handleDeletePoint = (idx) => {
        if (detectedPoints.length <= 3) {
            toast.error('A parcel boundary requires a minimum of 3 corners');
            return;
        }
        const pointToDelete = detectedPoints[idx];
        const deletedId = pointToDelete?.pointId;

        const updated = detectedPoints.filter((_, i) => i !== idx);
        updated.forEach((p, i) => { p.vertexIdx = i; });
        setDetectedPoints(updated);
        syncMissingPoints(updated);

        // Safely adjust attached curves that reference the deleted corner point
        if (deletedId && curves.length > 0) {
            const updatedCurves = curves.filter(c => 
                String(c.from) !== String(deletedId) && String(c.to) !== String(deletedId)
            );
            if (updatedCurves.length !== curves.length) {
                setCurves(updatedCurves);
                toast.info(`Adjusted attached curves after removing point ${deletedId}`);
            }
        }

        toast.success(`Removed point ${deletedId || `#${idx + 1}`}. Geometry recalculated.`);
    };

    // ── Curve Management Handlers for Modal ──────────────────────────────
    const handleAddOrUpdateCurve = (e) => {
        if (e) e.preventDefault();
        const from = curveFrom.trim();
        const to = curveTo.trim();
        const m = parseFloat(curveM);

        if (!from || !to) {
            toast.error('Please select both From and To corners');
            return;
        }
        if (from === to) {
            toast.error('From and To corners cannot be the same point');
            return;
        }
        if (isNaN(m) || m <= 0) {
            toast.error('Middle Ordinate (M) must be a positive number');
            return;
        }

        const newCurve = {
            from,
            to,
            M: m,
            sign: Number(curveSign) === -1 ? -1 : 1
        };

        if (editingCurveIdx !== null && editingCurveIdx >= 0 && editingCurveIdx < curves.length) {
            const updated = [...curves];
            updated[editingCurveIdx] = newCurve;
            setCurves(updated);
            setEditingCurveIdx(null);
            toast.success(`Updated curve between ${from} → ${to}`);
        } else {
            // Check if curve on this segment already exists
            const existingIdx = curves.findIndex(c => 
                (String(c.from) === from && String(c.to) === to) || 
                (String(c.from) === to && String(c.to) === from)
            );
            if (existingIdx !== -1) {
                const updated = [...curves];
                updated[existingIdx] = newCurve;
                setCurves(updated);
                toast.success(`Updated existing curve on segment ${from} ↔ ${to}`);
            } else {
                setCurves([...curves, newCurve]);
                toast.success(`Attached curve to segment ${from} → ${to} (M = ${m}m)`);
            }
        }

        setCurveFrom('');
        setCurveTo('');
        setCurveM('');
        setCurveSign(1);
    };

    const handleStartEditCurve = (idx) => {
        const c = curves[idx];
        if (!c) return;
        setCurveFrom(c.from);
        setCurveTo(c.to);
        setCurveM(String(c.M));
        setCurveSign(c.sign);
        setEditingCurveIdx(idx);
        setShowCurvesSection(true);
    };

    const handleDeleteCurve = (idx) => {
        const updated = curves.filter((_, i) => i !== idx);
        setCurves(updated);
        if (editingCurveIdx === idx) {
            setEditingCurveIdx(null);
            setCurveFrom('');
            setCurveTo('');
            setCurveM('');
        }
        toast.info('Curve removed');
    };

    const handleQuickAttachCurve = (from, to) => {
        setCurveFrom(from);
        setCurveTo(to);
        setEditingCurveIdx(null);
        setShowCurvesSection(true);
        setTimeout(() => {
            const el = document.getElementById('dwg-curve-m-input');
            if (el) el.focus();
        }, 50);
    };

    const handleConfirmCreateParcel = async () => {
        if (!parcelNumberInput.trim()) {
            toast.error('Please specify a parcel number');
            return;
        }

        const pointIds = detectedPoints.map(p => p.pointId.trim());
        if (pointIds.some(id => !id)) {
            toast.error('All corners must have a point ID');
            return;
        }

        const uniqueIds = new Set(pointIds);
        if (uniqueIds.size !== pointIds.length) {
            toast.error('Duplicate Point IDs are not allowed in the same boundary');
            return;
        }

        // 1. Add new/unmatched points to loadedPoints using CAD coordinates as fallback
        const updatedPoints = { ...loadedPoints };
        let addedCount = 0;
        const unmatchedIds = [];

        detectedPoints.forEach(item => {
            const pid = item.pointId;
            if (!loadedPoints[pid]) {
                updatedPoints[pid] = { x: item.x, y: item.y };
                addedCount++;
                unmatchedIds.push(pid);
            }
        });

        // 2. Calculate area and perimeter including attached curves
        let area = null;
        let perimeter = null;
        const allMatched = unmatchedIds.length === 0;
        const allUnmatched = unmatchedIds.length === pointIds.length;
        const isMixed = !allMatched && !allUnmatched;

        if (!isMixed) {
            try {
                // Map curves to index-based format for backend
                const curvesWithIndices = (curves || []).map(curve => {
                    const fromIndex = pointIds.indexOf(curve.from);
                    const toIndex = pointIds.indexOf(curve.to);
                    if (fromIndex !== -1 && toIndex !== -1) {
                        return {
                            fromIndex,
                            toIndex,
                            M: parseFloat(curve.M),
                            sign: curve.sign === 1 ? 1 : -1
                        };
                    }
                    return null;
                }).filter(Boolean);

                const res = await fetch('http://localhost:5000/api/calculate-area', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        points: pointIds.map(id => updatedPoints[id]),
                        curves: curvesWithIndices
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    area = data.area;
                    perimeter = data.perimeter;
                }
            } catch (err) {
                console.error('Error calculating area:', err);
            }
        } else {
            console.warn('[CAD Import] Mixed coordinate systems detected — area not calculated to avoid inaccuracy.');
        }

        const parcelData = {
            id: (editingParcelId && saveMode === 'update') ? editingParcelId : Date.now(),
            number: parcelNumberInput.trim(),
            ids: pointIds,
            curves: curves || [],
            area,
            perimeter,
            source: 'cad'
        };

        let updatedParcelsList;
        if (editingParcelId && saveMode === 'update') {
            updatedParcelsList = (savedParcels || []).map(p => p.id === editingParcelId ? { ...p, ...parcelData } : p);
        } else {
            updatedParcelsList = [...(savedParcels || []), parcelData];
        }

        // 3. Save states
        setLoadedPoints(updatedPoints);
        setSavedParcels(updatedParcelsList);
        savedParcelsRef.current = updatedParcelsList;
        setSelectedSavedParcelId(parcelData.id);
        selectedSavedParcelIdRef.current = parcelData.id;
        setHasUnsavedChanges(true);

        // 4. Trigger auto-save immediately to persist context
        if (typeof saveActiveProject === 'function') {
            await saveActiveProject(null, updatedParcelsList, updatedPoints);
        }

        const isUpdate = Boolean(editingParcelId && saveMode === 'update');
        toast.completed({
            title: isUpdate ? `Parcel #${parcelData.number} Updated` : `Parcel #${parcelData.number} Saved & Ready`,
            message: `Successfully processed boundary polygon with ${pointIds.length} corners.${addedCount > 0 ? ` Registered ${addedCount} new points.` : ''}`,
            badge: isUpdate ? 'Updated' : 'Created',
            details: [
                { label: 'Area', value: area != null ? `${Number(area).toFixed(2)} m²` : 'CAD Local' },
                { label: 'Corners', value: `${pointIds.length} pts` },
                ...(curves.length > 0 ? [{ label: 'Curves', value: `${curves.length} attached` }] : []),
                { label: 'Perimeter', value: perimeter != null ? `${Number(perimeter).toFixed(2)} m` : 'N/A' }
            ],
            duration: 5000
        });
        
        setShowModal(false);
        setEditingParcelId(null);
        drawCanvas();
    };

    return (
        <div className="h-screen flex flex-col bg-dark-900 text-dark-100 overflow-hidden">

            {/* ── No-Project Guard Screen ── */}
            {!hasProject && (
                <div className="fixed inset-0 z-[99999] bg-dark-900/98 backdrop-blur-md flex flex-col items-center justify-center gap-6 p-8">
                    <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                        <span className="text-3xl">🏗️</span>
                    </div>
                    <div className="text-center max-w-md">
                        <h2 className="text-xl font-bold text-white mb-2">No Active Project</h2>
                        <p className="text-dark-400 text-sm leading-relaxed">
                            You must open or create a project before importing a CAD file.
                            The project holds your parcel data and links your coordinates (.pnt) file.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate('/data-files')}
                            className="btn-primary py-2.5 px-6 text-sm"
                        >
                            📂 Open / Create Project
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="btn-secondary py-2.5 px-6 text-sm"
                        >
                            ← Back to Main Menu
                        </button>
                    </div>
                    <p className="text-[11px] text-dark-500">
                        After opening a project, return here to import your DWG/DXF file.
                    </p>
                </div>
            )}

            {/* Top Bar */}
            <div className="flex-none p-2 border-b border-dark-700 bg-dark-800/50 backdrop-blur-md flex items-center gap-3">
                <button onClick={handleBackToMainMenu} className="p-2 hover:bg-dark-700 rounded-lg text-dark-400">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="h-8 w-px bg-dark-700" />
                <h1 className="text-sm font-bold text-primary whitespace-nowrap">🏗️ CAD IMPORT</h1>

                {/* Project & Points File Status Badge */}
                {hasProject && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded font-semibold">
                            📁 {projectName || 'Project'}
                        </span>
                        {hasPointsFile ? (
                            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-semibold">
                                📍 {pointsFileName} ({Object.keys(loadedPoints).length} pts)
                            </span>
                        ) : (
                            <span className="text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-semibold">
                                ⚠️ No Points File — Parcels will use CAD local coords
                            </span>
                        )}
                    </div>
                )}

                <button
                    onClick={handleOpenFile}
                    disabled={loading || !hasProject}
                    title={!hasProject ? 'Open a project first' : 'Open DWG/DXF file'}
                    className={`btn-primary text-[11px] py-1.5 px-3 flex items-center gap-2 ${!hasProject ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    <Upload className="w-3.5 h-3.5" /> {loading ? '...' : 'OPEN DWG'}
                </button>

                {cadFilePath && (
                    <button
                        onClick={handleReloadCad}
                        disabled={loading || !hasProject}
                        title="Re-parse and reload CAD file from disk to get latest entity changes"
                        className="bg-dark-800 hover:bg-dark-700 text-yellow-500 hover:text-yellow-400 border border-dark-700 text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors font-medium shadow-sm"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> {loading ? '...' : 'RELOAD CAD'}
                    </button>
                )}

                {fileName && <span className="text-[10px] text-dark-400 bg-dark-900 px-2 py-1 rounded border border-dark-700 max-w-[150px] truncate">{fileName}</span>}

                <div className="h-8 w-px bg-dark-700" />

                {/* Layers Manager Button */}
                <button 
                    onClick={() => setShowLayerPanel(!showLayerPanel)} 
                    className={`btn-primary text-[11px] py-1.5 px-3 flex items-center gap-2 ${showLayerPanel ? 'bg-primary text-black' : 'bg-dark-800 text-dark-300 border-dark-700'}`}
                >
                    <Layers className="w-3.5 h-3.5" /> 
                    LAYERS {layerList.length > 0 && `(${layerList.length})`}
                </button>

                {/* Saved Parcels & Versions History Button */}
                <button
                    onClick={() => setShowParcelsPanel(!showParcelsPanel)}
                    className={`btn-primary text-[11px] py-1.5 px-3 flex items-center gap-1.5 transition-all ${
                        showParcelsPanel 
                            ? 'bg-yellow-500 text-black font-bold shadow-md shadow-yellow-500/20' 
                            : 'bg-dark-800 text-dark-300 border-dark-700 hover:text-white'
                    }`}
                    title="Browse Saved Parcels & History Versions"
                >
                    <Bookmark className="w-3.5 h-3.5" />
                    PARCELS {(savedParcels || []).length > 0 && `(${uniqueParcels.length})`}
                    {(savedParcels || []).length > uniqueParcels.length && (
                        <span className="ml-1 px-1.5 py-0.2 bg-blue-500/30 text-blue-300 text-[9px] rounded-full font-mono font-normal">
                            +{(savedParcels || []).length - uniqueParcels.length} rev
                        </span>
                    )}
                </button>

                <div className="flex items-center gap-1">
                    <button onClick={() => { zoomRef.current *= 1.2; setZoomDisplay(zoomRef.current); drawCanvas(); }} className="p-1.5 hover:bg-dark-700 rounded"><ZoomIn className="w-4 h-4" /></button>
                    <button onClick={() => { zoomRef.current *= 0.8; setZoomDisplay(zoomRef.current); drawCanvas(); }} className="p-1.5 hover:bg-dark-700 rounded"><ZoomOut className="w-4 h-4" /></button>
                    <button onClick={fitView} className="p-1.5 hover:bg-dark-700 rounded"><RotateCcw className="w-4 h-4" /></button>
                </div>

                <div className="flex-1" />

                {selectedEntityMetrics && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-lg flex items-center gap-2 animate-in fade-in duration-150">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-[10px] text-dark-400 font-sans uppercase font-bold">Live Area:</span>
                        <span className="text-xs font-bold text-white font-mono">{selectedEntityMetrics.area.toFixed(2)} m²</span>
                        <span className="text-[10px] text-yellow-400/80 font-mono">({selectedEntityMetrics.dunams.toFixed(3)} dun)</span>
                    </div>
                )}

                <button onClick={handleCreateParcel} disabled={selectedIdx === null} className={`text-[11px] font-bold py-1.5 px-4 rounded-lg flex items-center gap-2 transition-all ${selectedIdx !== null ? 'bg-yellow-500 text-black' : 'bg-dark-700 text-dark-500 cursor-not-allowed'}`}>
                    <Plus className="w-3.5 h-3.5" /> CREATE PARCEL
                </button>
            </div>

            {/* Viewport Area */}
            <div className="flex-1 relative bg-black overflow-hidden" ref={containerRef}>
                <canvas ref={canvasRef} />
                
                {/* Layer Management Panel */}
                {showLayerPanel && (
                    <div className="absolute top-4 left-4 bg-dark-900/95 backdrop-blur-md border border-dark-700 rounded-xl p-4 w-72 max-h-[70vh] flex flex-col gap-3 z-50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-primary" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Layer Manager</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setAllLayers(true)} className="text-[9px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-1 rounded border border-dark-700 transition-colors">ALL ON</button>
                                <button onClick={() => setAllLayers(false)} className="text-[9px] bg-dark-800 hover:bg-dark-700 text-dark-300 px-2 py-1 rounded border border-dark-700 transition-colors">ALL OFF</button>
                            </div>
                        </div>

                        <div className="relative">
                            <input 
                                type="text"
                                placeholder="Search layers..."
                                value={layerSearch}
                                onChange={(e) => setLayerSearch(e.target.value)}
                                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-1.5 text-[11px] outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
                            {layerList.length === 0 ? (
                                <div className="text-[10px] text-dark-500 text-center py-8 italic">No layers detected</div>
                            ) : (
                                layerList
                                    .filter(l => l.name.toLowerCase().includes(layerSearch.toLowerCase()))
                                    .map(l => (
                                        <div 
                                            key={l.name} 
                                            className={`group flex items-center justify-between gap-3 p-2 rounded-lg border transition-all ${visibleLayers[l.name] ? 'bg-dark-800/50 border-dark-700/50' : 'bg-dark-950/30 border-transparent opacity-60'}`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: layerColor(l.name, 0) }} />
                                                <span className={`text-[11px] truncate font-medium ${visibleLayers[l.name] ? 'text-dark-100' : 'text-dark-500'}`}>{l.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => toggleLayer(l.name)}
                                                    className={`text-[9px] font-bold px-2 py-1 rounded shadow-sm transition-all ${visibleLayers[l.name] ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-dark-700 text-dark-400 hover:bg-dark-600'}`}
                                                >
                                                    {visibleLayers[l.name] ? 'ON' : 'OFF'}
                                                </button>
                                                <button 
                                                    onClick={() => isolateLayer(l.name)}
                                                    className="text-[9px] font-bold bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded border border-primary/20 transition-all"
                                                >
                                                    ISO
                                                </button>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                        
                        <div className="pt-2 border-t border-dark-700 flex justify-end">
                            <button onClick={() => setShowLayerPanel(false)} className="text-[10px] text-dark-500 hover:text-white transition-colors">Close Panel</button>
                        </div>
                    </div>
                )}

                {/* ── Saved Parcels & All Versions History Panel ── */}
                {showParcelsPanel && (
                    <div className="absolute top-4 right-4 bg-dark-900/95 backdrop-blur-md border border-dark-700 rounded-xl p-4 w-96 max-h-[82vh] flex flex-col gap-3.5 z-50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
                        {/* Header & Tabs */}
                        <div className="flex items-center justify-between pb-2 border-b border-dark-700">
                            <div className="flex items-center gap-2">
                                <Bookmark className="w-4 h-4 text-yellow-500" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">Parcels & History</span>
                            </div>
                            <button 
                                onClick={() => setShowParcelsPanel(false)}
                                className="p-1 hover:bg-dark-800 text-dark-400 hover:text-white rounded transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex bg-dark-800/80 p-1 rounded-lg border border-dark-700/60 font-sans">
                            <button
                                onClick={() => setParcelsTab('saved')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    parcelsTab === 'saved'
                                        ? 'bg-yellow-500 text-black shadow-sm'
                                        : 'text-dark-400 hover:text-white'
                                }`}
                            >
                                <Bookmark className="w-3 h-3" />
                                Saved ({uniqueParcels.length})
                            </button>
                            <button
                                onClick={() => setParcelsTab('versions')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    parcelsTab === 'versions'
                                        ? 'bg-yellow-500 text-black shadow-sm'
                                        : 'text-dark-400 hover:text-white'
                                }`}
                            >
                                <History className="w-3 h-3" />
                                All Versions ({(savedParcels || []).length})
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-dark-400" />
                            <input 
                                type="text"
                                placeholder={parcelsTab === 'saved' ? "Search unique parcels..." : "Search all revision history..."}
                                value={parcelSearch}
                                onChange={(e) => setParcelSearch(e.target.value)}
                                className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-8 pr-7 py-1.5 text-[11px] outline-none focus:border-yellow-500 text-white placeholder-dark-500 transition-colors"
                            />
                            {parcelSearch && (
                                <button 
                                    onClick={() => setParcelSearch('')}
                                    className="absolute right-2.5 top-2 text-dark-400 hover:text-white"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar max-h-[52vh]">
                            {parcelsTab === 'saved' ? (
                                // ─── Unique Saved Parcels Tab ───
                                filteredUniqueParcels.length === 0 ? (
                                    <div className="text-center py-10 px-4 flex flex-col items-center gap-2">
                                        <Bookmark className="w-8 h-8 text-dark-600 mb-1" />
                                        <p className="text-xs text-dark-400 font-medium">No saved parcels found</p>
                                        <p className="text-[10px] text-dark-500 leading-relaxed max-w-[220px]">
                                            {parcelSearch ? 'No parcels match your search query.' : 'Select a parcel boundary on the CAD canvas and click "CREATE PARCEL" to save it.'}
                                        </p>
                                    </div>
                                ) : (
                                    filteredUniqueParcels.map(parcel => {
                                        const isSelected = selectedSavedParcelId === parcel.id;
                                        const duplicatesCount = (savedParcels || []).filter(p => 
                                            (p.number || '').trim().toLowerCase() === (parcel.number || '').trim().toLowerCase()
                                        ).length;

                                        return (
                                            <div 
                                                key={parcel.id}
                                                onClick={() => handleSelectSavedParcel(parcel)}
                                                className={`group p-3 rounded-xl border cursor-pointer transition-all ${
                                                    isSelected 
                                                        ? 'bg-cyan-500/10 border-cyan-500/60 shadow-lg shadow-cyan-500/10' 
                                                        : 'bg-dark-800/60 hover:bg-dark-800 border-dark-700/70 hover:border-dark-600'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                        <span className="text-xs font-bold text-white flex items-center gap-1 font-sans">
                                                            Parcel #{parcel.number}
                                                        </span>
                                                        {duplicatesCount > 1 && (
                                                            <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono font-medium" title="Multiple revisions saved for this parcel">
                                                                📋 {duplicatesCount} revs
                                                            </span>
                                                        )}
                                                        {parcel.source === 'cad' && (
                                                            <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded font-sans">
                                                                CAD
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Quick Action Buttons */}
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); focusOnParcel(parcel); }}
                                                            className="p-1.5 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-colors"
                                                            title="Focus & Zoom to parcel on CAD"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleLoadPreviousVersion(parcel); }}
                                                            className="p-1.5 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors"
                                                            title="Load parcel into Review & Edit modal"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => handleDeleteSavedParcel(parcel.id, e)}
                                                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                                            title="Delete parcel"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Stats */}
                                                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-dark-400 mb-2 bg-dark-900/60 p-2 rounded-lg border border-dark-800">
                                                    <div>
                                                        <span className="text-dark-500 block text-[9px] uppercase font-sans">Area</span>
                                                        <span className="text-green-400 font-bold">
                                                            {parcel.area != null ? `${Number(parcel.area).toFixed(2)} m²` : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-dark-500 block text-[9px] uppercase font-sans">Corners</span>
                                                        <span className="text-dark-200 font-bold">{parcel.ids?.length || 0} pts</span>
                                                    </div>
                                                </div>

                                                {/* Point IDs Chips */}
                                                <div className="flex flex-wrap gap-1 items-center">
                                                    <span className="text-[9px] text-dark-500 font-sans mr-1">Points:</span>
                                                    {(parcel.ids || []).map((id, idx) => (
                                                        <span 
                                                            key={idx} 
                                                            className="text-[9px] font-mono bg-dark-900 border border-dark-700/80 text-dark-300 px-1.5 py-0.2 rounded"
                                                        >
                                                            {id}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            ) : (
                                // ─── All Versions History Tab ───
                                filteredAllVersions.length === 0 ? (
                                    <div className="text-center py-10 px-4 flex flex-col items-center gap-2">
                                        <History className="w-8 h-8 text-dark-600 mb-1" />
                                        <p className="text-xs text-dark-400 font-medium">No revision history found</p>
                                        <p className="text-[10px] text-dark-500 leading-relaxed max-w-[220px]">
                                            Every time you save or edit a parcel, a version history entry is preserved here.
                                        </p>
                                    </div>
                                ) : (
                                    filteredAllVersions.map((version, index) => {
                                        const isSelected = selectedSavedParcelId === version.id;
                                        const sameNumberVersions = (savedParcels || []).filter(p => 
                                            (p.number || '').trim().toLowerCase() === (version.number || '').trim().toLowerCase()
                                        );
                                        const versionIndex = sameNumberVersions.findIndex(p => p.id === version.id) + 1;
                                        const isLatest = versionIndex === sameNumberVersions.length;

                                        let formattedDate = '';
                                        try {
                                            if (typeof version.id === 'number' && version.id > 1000000000000) {
                                                formattedDate = new Date(version.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                            }
                                        } catch (e) {}

                                        return (
                                            <div 
                                                key={version.id}
                                                onClick={() => handleSelectSavedParcel(version)}
                                                className={`group p-3 rounded-xl border cursor-pointer transition-all ${
                                                    isSelected 
                                                        ? 'bg-cyan-500/10 border-cyan-500/60 shadow-lg shadow-cyan-500/10' 
                                                        : isLatest
                                                            ? 'bg-dark-800/80 hover:bg-dark-800 border-dark-700 hover:border-dark-600'
                                                            : 'bg-dark-900/40 hover:bg-dark-800/40 border-dark-800 hover:border-dark-700 opacity-80 hover:opacity-100'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                        <span className="text-xs font-bold text-white font-sans">
                                                            Parcel #{version.number}
                                                        </span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                                            isLatest 
                                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                                                : 'bg-dark-700 text-dark-400 border border-dark-600'
                                                        }`}>
                                                            {sameNumberVersions.length > 1 ? `v${versionIndex} of ${sameNumberVersions.length}` : 'v1'}
                                                            {isLatest && ' (Latest)'}
                                                        </span>
                                                        {formattedDate && (
                                                            <span className="text-[9px] text-dark-500 font-mono flex items-center gap-1">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {formattedDate}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Action buttons */}
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); focusOnParcel(version); }}
                                                            className="p-1.5 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-colors"
                                                            title="Focus on CAD"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleLoadPreviousVersion(version); }}
                                                            className="p-1.5 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors"
                                                            title="Load this exact version"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => handleDeleteSavedParcel(version.id, e)}
                                                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                                            title="Delete version"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Stats */}
                                                <div className="flex justify-between items-center text-[11px] font-mono text-dark-400 mb-2 bg-dark-950/40 px-2 py-1 rounded border border-dark-800">
                                                    <span>Area: <strong className="text-green-400">{version.area != null ? `${Number(version.area).toFixed(2)} m²` : 'N/A'}</strong></span>
                                                    <span>{version.ids?.length || 0} corners</span>
                                                </div>

                                                {/* Point IDs */}
                                                <div className="flex flex-wrap gap-1 items-center">
                                                    {(version.ids || []).map((id, idx) => (
                                                        <span 
                                                            key={idx} 
                                                            className="text-[9px] font-mono bg-dark-900 border border-dark-700/80 text-dark-400 px-1.5 py-0.2 rounded"
                                                        >
                                                            {id}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            )}
                        </div>

                        {/* Footer status */}
                        <div className="pt-2 border-t border-dark-700/80 flex items-center justify-between text-[10px] text-dark-400 font-sans">
                            <span>Total unique: <strong className="text-white">{uniqueParcels.length}</strong></span>
                            <span>All records: <strong className="text-white">{(savedParcels || []).length}</strong></span>
                        </div>
                    </div>
                )}
                
                {/* Floating HUD */}
                <div className="absolute bottom-4 left-4 flex flex-col gap-2 pointer-events-none">
                    {/* Live Computed Area Dimension Card for Active Selection */}
                    {selectedEntityMetrics && (
                        <div className="bg-dark-900/95 backdrop-blur-md border border-yellow-500/50 p-3 rounded-xl shadow-2xl flex flex-col gap-1.5 min-w-[260px] animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <div className="flex items-center justify-between border-b border-dark-800 pb-1.5">
                                <span className="text-[10px] uppercase font-bold text-yellow-400 flex items-center gap-1.5 font-sans">
                                    <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Live Computed Parcel Area
                                </span>
                                <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.2 rounded font-mono font-medium">
                                    {selectedEntityMetrics.pointCount} corners
                                </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-xl font-extrabold text-white font-mono tracking-tight">
                                    {selectedEntityMetrics.area.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-yellow-400">m²</span>
                                </span>
                                <span className="text-xs text-dark-300 font-mono font-medium">
                                    {selectedEntityMetrics.dunams.toFixed(3)} dunam
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-dark-400 font-mono pt-1 border-t border-dark-800/80">
                                <span>Perimeter: <strong className="text-dark-200">{selectedEntityMetrics.perimeter.toFixed(2)} m</strong></span>
                                <span className="text-[9px] text-green-400 font-sans font-medium">● Instant Live</span>
                            </div>
                        </div>
                    )}

                    <div className="bg-dark-900/80 backdrop-blur-md border border-dark-700 px-3 py-1.5 rounded-lg flex gap-4 text-[10px] font-mono text-dark-400">
                        <span>ZOOM: {(zoomDisplay * 100).toFixed(1)}%</span>
                        <span>ENTITIES: {entities.length}</span>
                        <span>SAVED PARCELS: {uniqueParcels.length}</span>
                    </div>
                    {selectedIdx !== null && (
                        <div className="bg-yellow-500/10 backdrop-blur-md border border-yellow-500/30 px-3 py-1.5 rounded-lg text-[10px] font-mono text-yellow-500">
                            SELECTED CAD: {entities[selectedIdx].type} | LAYER: {entities[selectedIdx].layer}
                        </div>
                    )}
                    {selectedSavedParcelId !== null && (
                        <div className="bg-cyan-500/10 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 rounded-lg text-[10px] font-mono text-cyan-400">
                            PARCEL OVERLAY: #{((savedParcels || []).find(p => p.id === selectedSavedParcelId)?.number) || selectedSavedParcelId} ACTIVE
                        </div>
                    )}
                </div>

                <div className="absolute top-4 right-4 bg-dark-900/50 backdrop-blur-sm border border-dark-700 px-3 py-2 rounded-lg text-[10px] text-dark-400 pointer-events-none">
                    🖱️ Scroll: Zoom • Drag: Pan • Click: Select
                </div>
            </div>

            {/* Review and Point Correlation Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-dark-700 bg-dark-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-yellow-500" />
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                                    {editingParcelId ? `Review & Edit Parcel #${parcelNumberInput || ''}` : 'Review Parcel & Point Mapping'}
                                </h2>
                            </div>
                            <button 
                                onClick={() => { setShowModal(false); setEditingParcelId(null); }}
                                className="text-dark-400 hover:text-white transition-colors text-xs font-semibold p-1 hover:bg-dark-800 rounded font-sans"
                            >
                                ESC to Cancel
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 custom-scrollbar">
                            {/* Edit / Version Mode Option Bar */}
                            {editingParcelId && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl flex items-center justify-between gap-3 font-sans">
                                    <div className="flex items-center gap-2 text-xs text-yellow-400">
                                        <Edit3 className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                                        <span>Editing previously saved version. Choose how to save:</span>
                                    </div>
                                    <div className="flex bg-dark-900 border border-dark-700 rounded-lg p-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setSaveMode('update')}
                                            className={`text-[10px] font-bold px-3 py-1 rounded transition-all ${
                                                saveMode === 'update' ? 'bg-yellow-500 text-black shadow-sm' : 'text-dark-400 hover:text-white'
                                            }`}
                                        >
                                            Update Existing
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSaveMode('new')}
                                            className={`text-[10px] font-bold px-3 py-1 rounded transition-all ${
                                                saveMode === 'new' ? 'bg-yellow-500 text-black shadow-sm' : 'text-dark-400 hover:text-white'
                                            }`}
                                        >
                                            Save as New Version
                                        </button>
                                    </div>
                                </div>
                            )}
                                      {/* Live Computed Final Area Preview Banner */}
                            {modalLiveMetrics && (
                                <div className="bg-gradient-to-r from-dark-800/90 to-dark-850/90 p-4 rounded-xl border border-yellow-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-lg animate-in fade-in duration-200">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-11 h-11 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0 shadow-inner">
                                            <Sparkles className="w-6 h-6 text-yellow-400" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-yellow-400 tracking-wider font-sans">
                                                    Live Computed Final Area
                                                </span>
                                                <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.2 rounded font-mono font-medium">
                                                    Live Preview
                                                </span>
                                                {curves.length > 0 && (
                                                    <span className="text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono font-medium">
                                                        📐 {curves.length} Curve(s) Attached
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                                                <span className="text-2xl font-extrabold text-white font-mono tracking-tight">
                                                    {modalLiveMetrics.area.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    <span className="text-sm font-bold text-yellow-400 ml-1">m²</span>
                                                </span>
                                                <span className="text-xs text-dark-300 font-mono">
                                                    ({modalLiveMetrics.dunams.toFixed(3)} dunam)
                                                </span>
                                                {modalLiveMetrics.curveAdjustment !== undefined && Math.abs(modalLiveMetrics.curveAdjustment) > 0.001 && (
                                                    <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60 ml-1">
                                                        Base: {modalLiveMetrics.baseArea.toFixed(2)} m² | Curves: {modalLiveMetrics.curveAdjustment > 0 ? '+' : ''}{modalLiveMetrics.curveAdjustment.toFixed(2)} m²
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-around sm:justify-end gap-5 sm:border-l border-dark-700 sm:pl-6 text-[11px] font-mono text-dark-300 bg-dark-950/40 sm:bg-transparent p-2.5 sm:p-0 rounded-lg">
                                        <div>
                                            <span className="text-[9px] text-dark-500 uppercase block font-sans">Perimeter</span>
                                            <span className="font-bold text-white text-xs">{modalLiveMetrics.perimeter.toFixed(2)} m</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-dark-500 uppercase block font-sans">Corners</span>
                                            <span className="font-bold text-white text-xs">{modalLiveMetrics.pointCount} pts</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-dark-500 uppercase block font-sans">Coordinates</span>
                                            <span className={`font-bold text-xs ${modalLiveMetrics.allMatched ? 'text-green-400' : modalLiveMetrics.isMixed ? 'text-red-400' : 'text-blue-400'}`}>
                                                {modalLiveMetrics.allMatched ? 'Real (.pnt)' : modalLiveMetrics.isMixed ? 'Mixed ⚠️' : 'CAD Coords'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Parcel Number Settings */}
                            <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                <div className="flex-1 w-full">
                                    <label className="block text-xs font-bold text-dark-300 uppercase tracking-wider mb-2 font-sans">Parcel Number</label>
                                    <input 
                                        type="text"
                                        value={parcelNumberInput}
                                        onChange={(e) => setParcelNumberInput(e.target.value)}
                                        placeholder="Enter Parcel Number"
                                        className="w-full bg-dark-750 border border-dark-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 transition-colors font-sans"
                                    />
                                    {detectedNumber && parcelNumberInput !== detectedNumber && (
                                        <p className="text-[10px] text-dark-400 mt-1 font-sans">Auto-detected number was: <span className="font-mono text-dark-300">{detectedNumber}</span></p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 text-[11px] text-dark-400 font-mono self-stretch justify-center md:border-l border-dark-700 md:pl-6 w-full md:w-auto">
                                    <div className="flex justify-between gap-6">
                                        <span>Total Corners:</span>
                                        <span className="text-white font-bold">{detectedPoints.length}</span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                        <span>Attached Curves:</span>
                                        <span className="text-cyan-400 font-bold">{curves.length}</span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                        <span>Matched Points:</span>
                                        <span className="text-green-400 font-bold">{detectedPoints.filter(p => p.status === 'matched').length}</span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                        <span>Unmatched (Fallback):</span>
                                        <span className="text-yellow-500 font-bold">{detectedPoints.filter(p => p.status !== 'matched').length}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Responsive 2-Column Layout: Left (Mapping & Curves) / Right (Inline Boundary Preview) */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                {/* Left Column: Table, Curves & Status Alerts */}
                                <div className="lg:col-span-7 flex flex-col gap-4">
                                    {/* Point Mapping & Corner Table */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-dark-300 uppercase tracking-wider font-sans">Boundary Corner Mapping & Ordering</span>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex items-center gap-1 bg-dark-800 border border-dark-700 px-2 py-1 rounded-lg">
                                                    <span className="text-[10px] text-dark-400 font-sans">Start #:</span>
                                                    <input 
                                                        type="text" 
                                                        value={renumberStartInput} 
                                                        onChange={(e) => setRenumberStartInput(e.target.value)} 
                                                        className="w-10 bg-dark-900 border border-dark-700 rounded px-1.5 py-0.5 text-xs text-center text-white font-mono outline-none focus:border-yellow-500"
                                                    />
                                                    <button 
                                                        onClick={handleAutoRenumber}
                                                        className="text-[10px] font-bold bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded transition-all ml-1 font-sans"
                                                    >
                                                        Auto-Renumber
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={handleReverseOrder}
                                                    className="text-[10px] font-bold bg-dark-800 hover:bg-dark-700 text-dark-200 border border-dark-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-sans"
                                                    title="Reverse sequence of corners (Clockwise ↔ Counter-clockwise)"
                                                >
                                                    <RefreshCw className="w-3 h-3 text-primary" /> Reverse Direction
                                                </button>
                                            </div>
                                        </div>
                                        <div className="border border-dark-700 rounded-xl overflow-hidden bg-dark-950/40">
                                            <div className="max-h-[32vh] overflow-y-auto scroll-area">
                                                <table className="w-full text-left border-collapse text-[11px]">
                                                    <thead>
                                                        <tr className="bg-dark-800/80 border-b border-dark-700 text-dark-400 uppercase tracking-wider font-bold font-sans">
                                                            <th className="p-2.5 pl-4 w-12 text-center">#</th>
                                                            <th className="p-2.5">CAD Vertex (X, Y)</th>
                                                            <th className="p-2.5">Closest CAD Text Label</th>
                                                            <th className="p-2.5 w-36">Resolved Point ID</th>
                                                            <th className="p-2.5 w-20 text-center">Status</th>
                                                            <th className="p-2.5 w-28 text-center">Attached Arc</th>
                                                            <th className="p-2.5 pr-4 w-36 text-center">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-dark-800 font-mono">
                                                        {detectedPoints.map((row, idx) => {
                                                            const nextRow = detectedPoints[(idx + 1) % detectedPoints.length];
                                                            const segCurve = curves.find(c => 
                                                                (String(c.from) === String(row.pointId) && String(c.to) === String(nextRow?.pointId)) ||
                                                                (String(c.from) === String(nextRow?.pointId) && String(c.to) === String(row.pointId))
                                                            );

                                                            return (
                                                                <tr key={idx} className="hover:bg-dark-800/30 transition-colors">
                                                                    <td className="p-2.5 pl-4 text-center text-dark-400 font-bold">{idx + 1}</td>
                                                                    <td className="p-2.5 text-dark-300">
                                                                        {row.y?.toFixed(3)}, {row.x?.toFixed(3)}
                                                                    </td>
                                                                    <td className="p-2.5 text-dark-400 font-sans">
                                                                        {row.label ? (
                                                                            <span className="flex items-center gap-1.5">
                                                                                <span className="text-white font-semibold">{row.label}</span>
                                                                                <span className="text-[10px] text-dark-500 font-mono">(d={row.dist?.toFixed(2)})</span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-dark-600 italic">None found</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2.5">
                                                                        <input 
                                                                            type="text" 
                                                                            value={row.pointId}
                                                                            onChange={(e) => handleUpdatePointId(row.vertexIdx, e.target.value)}
                                                                            className="w-full bg-dark-800 border border-dark-700 rounded px-2 py-1 text-xs text-white focus:border-yellow-500 outline-none font-sans font-medium"
                                                                            placeholder="Enter Point ID"
                                                                        />
                                                                    </td>
                                                                    <td className="p-2.5 text-center font-sans">
                                                                        {row.status === 'matched' ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/10 border border-green-500/20 text-green-400">
                                                                                Matched
                                                                            </span>
                                                                        ) : row.status === 'generated' ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                                                                Auto-Gen
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                                                                                New Point
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2.5 text-center font-sans">
                                                                        {segCurve ? (
                                                                            <span 
                                                                                onClick={() => handleStartEditCurve(curves.indexOf(segCurve))}
                                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 cursor-pointer hover:bg-cyan-500/25 transition-all"
                                                                                title="Click to edit attached curve"
                                                                            >
                                                                                📐 M={segCurve.M}m ({segCurve.sign === 1 ? '+' : '-'})
                                                                            </span>
                                                                        ) : (
                                                                            <button 
                                                                                onClick={() => handleQuickAttachCurve(row.pointId, nextRow?.pointId)}
                                                                                disabled={!row.pointId || !nextRow?.pointId}
                                                                                className="text-[9px] font-semibold text-dark-400 hover:text-cyan-400 hover:bg-dark-800 px-2 py-0.5 rounded border border-transparent hover:border-dark-700 transition-all"
                                                                                title={`Attach curve between ${row.pointId} → ${nextRow?.pointId}`}
                                                                            >
                                                                                + Arc to #{nextRow?.pointId || (idx + 2)}
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2.5 pr-4 text-center">
                                                                        <div className="flex items-center justify-center gap-1 font-sans">
                                                                            <button 
                                                                                onClick={() => handleSetAsStartPoint(idx)}
                                                                                disabled={idx === 0}
                                                                                title="Set as Start Corner (#1)"
                                                                                className={`p-1 rounded border transition-all ${idx === 0 ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500 cursor-default' : 'bg-dark-800 hover:bg-dark-700 border-dark-700 text-dark-400 hover:text-yellow-400'}`}
                                                                            >
                                                                                <Star className="w-3.5 h-3.5 fill-current" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleMovePointUp(idx)}
                                                                                disabled={idx === 0}
                                                                                title="Move Up in order"
                                                                                className={`p-1 rounded border transition-all ${idx === 0 ? 'bg-dark-900 border-dark-800 text-dark-600 cursor-not-allowed' : 'bg-dark-800 hover:bg-dark-700 border-dark-700 text-dark-300 hover:text-white'}`}
                                                                            >
                                                                                <ArrowUp className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleMovePointDown(idx)}
                                                                                disabled={idx === detectedPoints.length - 1}
                                                                                title="Move Down in order"
                                                                                className={`p-1 rounded border transition-all ${idx === detectedPoints.length - 1 ? 'bg-dark-900 border-dark-800 text-dark-600 cursor-not-allowed' : 'bg-dark-800 hover:bg-dark-700 border-dark-700 text-dark-300 hover:text-white'}`}
                                                                            >
                                                                                <ArrowDown className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleDeletePoint(idx)}
                                                                                disabled={detectedPoints.length <= 3}
                                                                                title={detectedPoints.length <= 3 ? "Cannot delete: Minimum 3 corners required" : `Delete Point ${row.pointId || `#${idx + 1}`} & update geometry`}
                                                                                className={`p-1 rounded border transition-all ${
                                                                                    detectedPoints.length <= 3 
                                                                                        ? 'bg-dark-900 border-dark-800 text-dark-600 cursor-not-allowed opacity-40' 
                                                                                        : 'bg-dark-800 hover:bg-red-500/20 border-dark-700 text-dark-400 hover:text-red-400'
                                                                                }`}
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Curves & Arcs Attachment Panel ── */}
                                    <div className="bg-dark-800/40 border border-dark-700 rounded-xl p-4 flex flex-col gap-3 font-sans">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    📐 Curves & Arcs Adjustment
                                                </span>
                                                {curves.length > 0 && (
                                                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-0.2 rounded-full font-mono font-medium">
                                                        {curves.length} active
                                                    </span>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => setShowCurvesSection(!showCurvesSection)}
                                                className="text-[11px] text-dark-400 hover:text-white font-medium"
                                            >
                                                {showCurvesSection ? 'Hide Panel' : 'Show Panel'}
                                            </button>
                                        </div>

                                        {showCurvesSection && (
                                            <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                                                {/* Curve Creator Form */}
                                                <form onSubmit={handleAddOrUpdateCurve} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end bg-dark-900/60 p-3 rounded-lg border border-dark-700/80">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] font-bold text-dark-400 uppercase">From Corner</label>
                                                        <select 
                                                            value={curveFrom}
                                                            onChange={(e) => setCurveFrom(e.target.value)}
                                                            className="bg-dark-800 border border-dark-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500 font-mono"
                                                        >
                                                            <option value="">Select From</option>
                                                            {detectedPoints.map((p, i) => (
                                                                <option key={i} value={p.pointId}>{p.pointId || `Point ${i + 1}`}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] font-bold text-dark-400 uppercase">To Corner</label>
                                                        <select 
                                                            value={curveTo}
                                                            onChange={(e) => setCurveTo(e.target.value)}
                                                            className="bg-dark-800 border border-dark-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500 font-mono"
                                                        >
                                                            <option value="">Select To</option>
                                                            {detectedPoints.map((p, i) => (
                                                                <option key={i} value={p.pointId}>{p.pointId || `Point ${i + 1}`}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] font-bold text-dark-400 uppercase">Ordinate (M, meters)</label>
                                                        <input 
                                                            id="dwg-curve-m-input"
                                                            type="number"
                                                            step="any"
                                                            min="0.001"
                                                            value={curveM}
                                                            onChange={(e) => setCurveM(e.target.value)}
                                                            placeholder="e.g. 1.25"
                                                            className="bg-dark-800 border border-dark-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500 font-mono"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[10px] font-bold text-dark-400 uppercase">Type / Sign</label>
                                                        <div className="flex bg-dark-800 border border-dark-700 rounded p-0.5">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setCurveSign(1)}
                                                                className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${curveSign === 1 ? 'bg-cyan-500 text-black shadow-sm' : 'text-dark-400 hover:text-white'}`}
                                                            >
                                                                + Add Bulge
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setCurveSign(-1)}
                                                                className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${curveSign === -1 ? 'bg-red-500 text-white shadow-sm' : 'text-dark-400 hover:text-white'}`}
                                                            >
                                                                - Subtract
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-1.5">
                                                        <button 
                                                            type="submit"
                                                            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs py-1.5 px-3 rounded transition-all shadow-sm"
                                                        >
                                                            {editingCurveIdx !== null ? 'Update Arc' : '+ Attach Curve'}
                                                        </button>
                                                        {editingCurveIdx !== null && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingCurveIdx(null);
                                                                    setCurveFrom('');
                                                                    setCurveTo('');
                                                                    setCurveM('');
                                                                }}
                                                                className="bg-dark-800 hover:bg-dark-700 text-dark-300 text-xs px-2.5 py-1.5 rounded"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                </form>

                                                {/* Attached Curves List */}
                                                {curves.length > 0 ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                        {curves.map((c, i) => (
                                                            <div 
                                                                key={i}
                                                                className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                                                                    editingCurveIdx === i 
                                                                        ? 'bg-cyan-500/10 border-cyan-500' 
                                                                        : 'bg-dark-900/70 border-dark-700/80 hover:border-dark-600'
                                                                }`}
                                                            >
                                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[11px] font-bold text-white font-mono">{c.from} → {c.to}</span>
                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                                                            c.sign === 1 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-red-500/20 text-red-300'
                                                                        }`}>
                                                                            {c.sign === 1 ? '+ Bulge' : '- Hollow'}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] text-dark-400 font-mono">
                                                                        M = <strong className="text-dark-200">{c.M} m</strong>
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleStartEditCurve(i)}
                                                                        className="p-1 hover:bg-dark-800 text-dark-400 hover:text-cyan-400 rounded transition-colors"
                                                                        title="Edit curve parameters"
                                                                    >
                                                                        <Edit3 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => handleDeleteCurve(i)}
                                                                        className="p-1 hover:bg-red-500/20 text-dark-400 hover:text-red-400 rounded transition-colors"
                                                                        title="Delete curve"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-dark-500 italic">No curves attached yet. Select two boundary corners above to attach a curve or click "+ Arc" directly in the corner table.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Coordinate System Status Alerts */}
                                    {(() => {
                                        const unmatchedCount = detectedPoints.filter(p => p.status !== 'matched').length;
                                        const matchedCount = detectedPoints.filter(p => p.status === 'matched').length;
                                        const total = detectedPoints.length;
                                        const allMatched = unmatchedCount === 0;
                                        const allUnmatched = matchedCount === 0;
                                        const isMixed = !allMatched && !allUnmatched;

                                        if (allMatched) return (
                                            <div className="bg-green-500/5 border border-green-500/20 p-3 rounded-lg flex items-start gap-2.5 font-sans">
                                                <span className="text-green-400 text-sm mt-0.5">✅</span>
                                                <div className="text-[11px] text-dark-300 leading-normal">
                                                    <span className="font-bold text-green-400">All {total} corners matched</span> in your coordinates file.
                                                    Area and perimeter will be calculated using <span className="font-semibold text-white">real-world coordinates</span> — result will be accurate.
                                                </div>
                                            </div>
                                        );

                                        if (allUnmatched) return (
                                            <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg flex items-start gap-2.5 font-sans">
                                                <span className="text-blue-400 text-sm mt-0.5">ℹ️</span>
                                                <div className="text-[11px] text-dark-300 leading-normal">
                                                    <span className="font-bold text-blue-400">No points file loaded</span> — area will be calculated using <span className="font-semibold text-white">local CAD coordinates</span>.
                                                    This is consistent and gives a correct relative area, but coordinates are not real-world.
                                                    To get accurate real-world area, add the missing points to your <span className="font-semibold text-white">.pnt file</span>.
                                                </div>
                                            </div>
                                        );

                                        return (
                                            <div className="bg-red-500/5 border border-red-500/30 p-3 rounded-lg flex items-start gap-2.5 font-sans">
                                                <span className="text-red-400 text-sm mt-0.5">🚫</span>
                                                <div className="text-[11px] text-dark-300 leading-normal">
                                                    <span className="font-bold text-red-400">Mixed Coordinate Systems Detected!</span>{' '}
                                                    <span className="font-semibold text-white">{matchedCount} corners</span> use real-world coords (.pnt file) and{' '}
                                                    <span className="font-semibold text-white">{unmatchedCount} corners</span> use local CAD coords.
                                                    <br />
                                                    <span className="text-red-300 font-semibold">Area will NOT be calculated</span> — it would be wrong.
                                                    To fix this, add the missing point IDs to your .pnt file, then confirm.
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Right Column: Inline Computed Boundary Preview Canvas */}
                                <div className="lg:col-span-5 flex flex-col gap-3 lg:sticky lg:top-0">
                                    <ModalBoundaryPreview 
                                        detectedPoints={detectedPoints}
                                        loadedPoints={loadedPoints}
                                        curves={curves}
                                        parcelNumber={parcelNumberInput}
                                        metrics={modalLiveMetrics}
                                    />
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-dark-700 bg-dark-800/40 flex justify-end gap-3 font-sans">
                            <button 
                                onClick={() => { setShowModal(false); setEditingParcelId(null); }}
                                className="btn-secondary text-xs py-2 px-4"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmCreateParcel}
                                className="btn-primary bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs py-2 px-5 hover:shadow-yellow-500/20 hover:shadow-md border-0"
                            >
                                {editingParcelId && saveMode === 'update' ? 'Save Changes' : 'Confirm & Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DxfImport;
