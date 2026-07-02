import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, ZoomIn, ZoomOut, RotateCcw, Plus, MapPin, Layers, ArrowUp, ArrowDown, RefreshCw, Star } from 'lucide-react';
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
        if (hasUnsavedChanges && !(await customConfirm('You have unsaved changes. Are you sure you want to return to the Main Menu?'))) {
            return;
        }
        navigate('/');
    }, [navigate, hasUnsavedChanges]);

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
    
    // Layer Management
    const [layerList, setLayerList] = useState([]);
    const layerListRef = useRef([]);
    useEffect(() => { layerListRef.current = layerList || []; }, [layerList]);
    const [visibleLayers, setVisibleLayers] = useState({});
    const visibleLayersRef = useRef({});
    const [showLayerPanel, setShowLayerPanel] = useState(false);
    const [layerSearch, setLayerSearch] = useState('');

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
        // We use tessellated points (generated at 1°/step for arcs) rather than
        // ctx.arc() because the Y-axis flip combined with raw atan2 angles from the
        // backend creates direction-normalization bugs with ctx.arc().
        // Dense tessellation (min 24 steps, 1 step per 2°) looks perfectly smooth.
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

                // Text size in world units × current zoom = screen pixels
                // CAD height is uppercase letter height ≈ 72% of font EM, so multiply by 1.38 to compensate.
                // Scale proportionally with zoom so text stays in exact real scale with CAD geometry.
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

                // Map DXF halign/valign to canvas textAlign/textBaseline
                const hMap = { left: 'left', center: 'center', right: 'right' };
                const vMap = { top: 'top', middle: 'middle', alphabetic: 'alphabetic', bottom: 'bottom' };
                ctx.textAlign = hMap[ent.halign] || 'left';
                ctx.textBaseline = vMap[ent.valign] || 'alphabetic';

                ctx.fillText(ent.text, 0, 0);
                ctx.restore();
            }
        });
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
            const clickWorld = s2w(cx, cy); // wx=clickWorld.x (CAD Y), wy=clickWorld.y (CAD X)
            
            const THRESH = 10;
            let best = null, bestDist = Infinity;
            
            entitiesRef.current.forEach((ent, i) => {
                // Check visibility
                if (visibleLayersRef.current && visibleLayersRef.current[ent.layer] === false) return;

                // 1. Check if clicking inside a closed polygon (Parcel selection - must be on GIS/Parcel boundary layer and not a filled hatch/symbol)
                if (ent.closed && !ent.filled && ent.type !== 'CIRCLE' && ent.points && ent.points.length >= 3 && isParcelLayer(ent.layer, layerListRef.current)) {
                    // AutoCAD X = p.y in our ent structure, AutoCAD Y = p.x
                    // s2w returns {x, y} where x is the original CAD Y and y is the original CAD X
                    if (isPointInPolygon(clickWorld.x, clickWorld.y, ent.points)) {
                        best = i; bestDist = 0; // Perfect hit
                    }
                }

                // 2. Fallback to edge selection
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
        // Guard: must have an active project before loading a CAD file
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
            
            // Handle Layers
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
            toast.success('✅ CAD file re-parsed and updated successfully!');
        } catch (err) {
            toast.error(err.message || 'Error reloading CAD file');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateParcel = async () => {
        if (selectedIdx === null) return;
        const ent = entities[selectedIdx];
        if (!ent.closed || ent.filled || ent.type === 'CIRCLE' || !isParcelLayer(ent.layer, layerListRef.current)) {
            toast.error('Please select a valid boundary polygon on the GIS / Parcel layer');
            return;
        }

        // ── Step 0: Separate labels into NUMERIC (point numbers) and ALL (for parcel name) ──
        const allLabels = entities.filter(e => e.type === 'TEXT_LABEL');

        // Point numbers in surveying are ALWAYS pure numbers (integers or simple decimals)
        // Filter to only labels whose text is a number (e.g. "17", "42", "1023", "5.1")
        const isNumericLabel = (txt) => /^\s*\d+(\.\d+)?\s*$/.test(txt);
        const numericLabels = allLabels.filter(lbl => isNumericLabel(lbl.text));

        // ── Step 1: Auto-detect parcel number inside boundary ──
        let parcelNo = '';
        const labelsInside = allLabels.filter(lbl => isPointInPolygon(lbl.x, lbl.y, ent.points));
        
        // Prioritize labels on description layers (e.g., "TEXT of description", "TEXT for DESCRIPTION")
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
            parcelNo = (savedParcels.length + 1).toString();
        }

        // ── Step 2: Deduplicate boundary vertices ──
        // Tessellated arcs can create many near-identical points — collapse them
        const rawPts = ent.points;
        const uniqueVerts = [];
        const MERGE_THRESHOLD = 1e-3; // collapse vertices closer than this
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
        // Also check first vs last (closed polygon closing point)
        if (uniqueVerts.length > 1) {
            const first = uniqueVerts[0], last = uniqueVerts[uniqueVerts.length - 1];
            if (Math.hypot(first.x - last.x, first.y - last.y) <= MERGE_THRESHOLD) {
                uniqueVerts.pop(); // remove duplicate closing vertex
            }
        }

        // ── Step 3: Dynamic threshold based on drawing scale ──
        // Compute the bounding box of the boundary and estimate a reasonable search radius
        const xs = uniqueVerts.map(p => p.x);
        const ys = uniqueVerts.map(p => p.y);
        const bbW = Math.max(...xs) - Math.min(...xs);
        const bbH = Math.max(...ys) - Math.min(...ys);
        const bbDiag = Math.hypot(bbW, bbH);
        // Use 25% of the boundary diagonal as threshold, clamped between 15 and 500 units
        const DYNAMIC_THRESHOLD = Math.max(15, Math.min(500, bbDiag * 0.25));

        // ── Step 4: For each UNIQUE vertex, find nearest text label using Global Best-Match Pairing ──
        const detectedPts = [];
        const missingPoints = {};
        const candidateLabels = allLabels.filter(lbl => lbl.text && lbl.text.trim().length > 0 && lbl.text.trim().length <= 15);

        // Helper: score a label for corner relevance based on layer name and distance
        const scoreCandidate = (lbl, dist) => {
            const layer = (lbl.layer || '').toLowerCase();
            let score = dist;
            // Prefer corner/point/number/mark/node block layers
            if (/corner|number|mark|point|node|boundary|original|pt|num|no|id/i.test(layer)) {
                score -= DYNAMIC_THRESHOLD * 3; // massive priority boost
            }
            // Prefer clean numeric or short integer text
            if (/^\s*\d+(\.\d+)?\s*$/.test(lbl.text)) {
                score -= DYNAMIC_THRESHOLD; // bonus for clean integers/numbers
            }
            // Deprioritize dimension/table/title/description/road layers
            if (/dimension|dim|table|title|description|desc|road|elevation/i.test(layer)) {
                score += DYNAMIC_THRESHOLD * 3; // penalty
            }
            return score;
        };

        // Create global candidate pairs of (vertexIdx, labelIdx, dist, score)
        const allPairs = [];
        uniqueVerts.forEach((p, vIdx) => {
            candidateLabels.forEach((lbl, lIdx) => {
                const d = Math.hypot(lbl.x - p.x, lbl.y - p.y);
                if (d < DYNAMIC_THRESHOLD) {
                    allPairs.push({ vIdx, lIdx, lbl, d, score: scoreCandidate(lbl, d) });
                }
            });
        });

        // Sort all pairs globally by score ascending for optimal non-greedy pairing
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
                // No numeric label near this vertex — generate a CAD fallback ID
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
                // Use CAD local coordinates as fallback
                updatedPoints[pid] = { x: item.x, y: item.y };
                addedCount++;
                unmatchedIds.push(pid);
            }
        });

        // 2. Calculate area and perimeter
        // IMPORTANT: Only calculate if ALL points are from the same coordinate system.
        // If some are from the .pnt file (real coords) and some are from CAD (local coords),
        // the area calculation will be WRONG because the coordinate systems don't match.
        let area = null;
        let perimeter = null;
        const allMatched = unmatchedIds.length === 0;
        const allUnmatched = unmatchedIds.length === pointIds.length;
        const isMixed = !allMatched && !allUnmatched;

        if (!isMixed) {
            // Safe to calculate: all coords are in the same system
            try {
                const res = await fetch('http://localhost:5000/api/calculate-area', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ points: pointIds.map(id => updatedPoints[id]) }),
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
            // Mixed coordinate systems — area would be inaccurate, skip calculation
            console.warn('[CAD Import] Mixed coordinate systems detected — area not calculated to avoid inaccuracy.');
        }

        const newParcel = {
            id: Date.now(),
            number: parcelNumberInput.trim(),
            ids: pointIds,
            area,
            perimeter,
            source: 'cad'
        };

        // 3. Save states
        setLoadedPoints(updatedPoints);
        setSavedParcels(prev => [...prev, newParcel]);
        setHasUnsavedChanges(true);

        // 4. Trigger auto-save immediately to persist context
        if (typeof saveActiveProject === 'function') {
            await saveActiveProject(null, [...savedParcels, newParcel], updatedPoints);
        }

        let successMsg = `✅ Parcel ${newParcel.number} created with ${pointIds.length} corners.`;
        if (addedCount > 0) successMsg += ` Registered ${addedCount} new points.`;
        if (isMixed) successMsg += ' ⚠️ Area not calculated (mixed coordinate systems — add missing points to your .pnt file).';
        toast.success(successMsg);
        setShowModal(false);
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

                <button 
                    onClick={() => setShowLayerPanel(!showLayerPanel)} 
                    className={`btn-primary text-[11px] py-1.5 px-3 flex items-center gap-2 ${showLayerPanel ? 'bg-primary text-black' : 'bg-dark-800 text-dark-300 border-dark-700'}`}
                >
                    <Layers className="w-3.5 h-3.5" /> 
                    LAYERS {layerList.length > 0 && `(${layerList.length})`}
                </button>

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

            {/* Review and Point Correlation Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
                    <div className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-dark-700 bg-dark-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-yellow-500" />
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Review Parcel & Point Mapping</h2>
                            </div>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="text-dark-400 hover:text-white transition-colors text-xs font-semibold p-1 hover:bg-dark-800 rounded font-sans"
                            >
                                ESC to Cancel
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 custom-scrollbar">
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
                                        <span>Matched Points:</span>
                                        <span className="text-green-400 font-bold">{detectedPoints.filter(p => p.status === 'matched').length}</span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                        <span>Unmatched (Fallback):</span>
                                        <span className="text-yellow-500 font-bold">{detectedPoints.filter(p => p.status !== 'matched').length}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Point Mapping Table */}
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
                                    <div className="max-h-[35vh] overflow-y-auto scroll-area">
                                        <table className="w-full text-left border-collapse text-[11px]">
                                            <thead>
                                                <tr className="bg-dark-800/80 border-b border-dark-700 text-dark-400 uppercase tracking-wider font-bold font-sans">
                                                    <th className="p-2.5 pl-4 w-14 text-center">#</th>
                                                    <th className="p-2.5">CAD Vertex (X, Y)</th>
                                                    <th className="p-2.5">Closest CAD Text Label</th>
                                                    <th className="p-2.5 w-40">Resolved Point ID</th>
                                                    <th className="p-2.5 w-24 text-center">Status</th>
                                                    <th className="p-2.5 pr-4 w-32 text-center">Order Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-dark-800 font-mono">
                                                {detectedPoints.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-dark-800/30 transition-colors">
                                                        <td className="p-2.5 pl-4 text-center text-dark-400 font-bold">{idx + 1}</td>
                                                        <td className="p-2.5 text-dark-300">
                                                            {row.y.toFixed(3)}, {row.x.toFixed(3)}
                                                        </td>
                                                        <td className="p-2.5 text-dark-400 font-sans">
                                                            {row.label ? (
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className="text-white font-semibold">{row.label}</span>
                                                                    <span className="text-[10px] text-dark-500 font-mono">(d={row.dist.toFixed(2)})</span>
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
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
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

                                // Mixed — DANGER
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

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-dark-700 bg-dark-800/40 flex justify-end gap-3 font-sans">
                            <button 
                                onClick={() => setShowModal(false)}
                                className="btn-secondary text-xs py-2 px-4"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmCreateParcel}
                                className="btn-primary bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs py-2 px-5 hover:shadow-yellow-500/20 hover:shadow-md border-0"
                            >
                                Confirm & Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DxfImport;
