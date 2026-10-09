// Drawing of CAD hatches the way AutoCAD shows them: pattern lines (not a solid block), solid colour or gradient.

/**
 * World-space line segments of a pattern hatch inside a bounding box (the caller clips them to the boundary).
 * Each pattern line is a family of parallel lines through `base + k * offset` with direction `angle`,
 * optionally dashed (positive = dash, negative = gap, 0 = dot).
 *
 * Returns null when the pattern is too dense (or too heavy) to draw line by line at this zoom: AutoCAD then
 * shows the area as a tint, and so do we.
 */
export function hatchSegments(lines, bbox, minSpacingWorld = 0, maxSegments = 60000) {
    const out = [];
    const corners = [[bbox.minX, bbox.minY], [bbox.maxX, bbox.minY], [bbox.maxX, bbox.maxY], [bbox.minX, bbox.maxY]];
    for (const pl of lines) {
        const a = (pl.angle * Math.PI) / 180;
        const ux = Math.cos(a), uy = Math.sin(a);
        const nx = -uy, ny = ux;
        const [bx, by] = pl.base;
        const [ox, oy] = pl.offset;
        const d = ox * nx + oy * ny;                    // perpendicular distance between neighbouring lines
        if (Math.abs(d) < 1e-9) continue;
        if (Math.abs(d) < minSpacingWorld) return null; // too dense to be drawn as lines
        const e = ox * ux + oy * uy;                    // shift along the line between neighbours

        const ks = corners.map(([x, y]) => ((x - bx) * nx + (y - by) * ny) / d);
        const kMin = Math.floor(Math.min(...ks)), kMax = Math.ceil(Math.max(...ks));
        if (kMax - kMin + 1 > 4000) return null;

        const items = (pl.dashes || []).map(Number).filter(Number.isFinite);
        const cycle = items.reduce((s, v) => s + Math.abs(v), 0);
        const dashed = items.length > 0 && cycle > 1e-9 && cycle >= minSpacingWorld * 0.5;

        for (let k = kMin; k <= kMax; k++) {
            const px = bx + k * ox, py = by + k * oy;   // origin of this line
            const ts = corners.map(([x, y]) => (x - px) * ux + (y - py) * uy);
            const tMin = Math.min(...ts), tMax = Math.max(...ts);
            if (!dashed) {
                out.push([px + tMin * ux, py + tMin * uy, px + tMax * ux, py + tMax * uy]);
            } else {
                // keep the dash phase tied to the line origin so neighbouring lines line up like in AutoCAD
                let t = Math.floor(tMin / cycle) * cycle;
                let i = 0;
                while (t < tMax) {
                    const v = items[i % items.length];
                    const len = Math.abs(v);
                    if (v >= 0) {
                        const s = Math.max(t, tMin), f = Math.min(t + (len || 1e-6), tMax);
                        if (f > s) out.push([px + s * ux, py + s * uy, px + f * ux, py + f * uy]);
                    }
                    t += len;
                    i++;
                    if (out.length > maxSegments) return null;
                }
            }
            if (out.length > maxSegments) return null;
        }
    }
    return out;
}

/** Bounding box of a list of {x, y}. */
export function pointsBBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
}

/**
 * Draw one hatch entity. `view` supplies the canvas transforms of the CAD view.
 * Pattern hatches draw only their pattern lines (no solid fill, no outline) - like AutoCAD.
 */
export function drawHatch(ctx, ent, view) {
    const h = ent.hatch;
    const pts = ent.points;
    if (!h || !pts || pts.length < 3) return false;
    const { wx2sx, wy2sy, zoom, color, width, height, buildPath } = view;

    const bbox = pointsBBox(pts);
    const sx1 = wx2sx(bbox.minX), sx2 = wx2sx(bbox.maxX);
    const sy1 = wy2sy(bbox.maxY), sy2 = wy2sy(bbox.minY);
    if (Math.max(sx1, sx2) < 0 || Math.min(sx1, sx2) > width || Math.max(sy1, sy2) < 0 || Math.min(sy1, sy2) > height) return true; // off-screen

    const fillSolid = (alpha = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (h.gradient && h.solid) {
            const r = ((h.gradient.rotation || 0) * Math.PI) / 180;
            const cx = (sx1 + sx2) / 2, cy = (sy1 + sy2) / 2;
            const half = Math.hypot(sx2 - sx1, sy2 - sy1) / 2;
            const g = ctx.createLinearGradient(cx - Math.cos(r) * half, cy + Math.sin(r) * half, cx + Math.cos(r) * half, cy - Math.sin(r) * half);
            g.addColorStop(0, h.gradient.color1);
            g.addColorStop(1, h.gradient.color2);
            ctx.fillStyle = g;
        } else {
            ctx.fillStyle = color;
        }
        buildPath(ctx, ent);
        ctx.fill('evenodd');
        ctx.restore();
    };

    if (h.solid || !h.lines || h.lines.length === 0) {
        fillSolid(1);
        return true;
    }

    const segments = hatchSegments(h.lines, bbox, 2.5 / zoom);
    if (!segments) {
        fillSolid(0.4);                                   // far too dense to separate: show as a tint, like AutoCAD
        return true;
    }
    ctx.save();
    buildPath(ctx, ent);
    ctx.clip('evenodd');                                  // holes stay empty
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segments) {
        ctx.moveTo(wx2sx(x1), wy2sy(y1));
        ctx.lineTo(wx2sx(x2), wy2sy(y2));
    }
    ctx.stroke();
    ctx.restore();
    return true;
}
