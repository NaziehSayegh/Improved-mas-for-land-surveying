// ─── Label → point match validation ──────────────────────────────────────────
// Corner labels are matched to the nearest CAD text. When a corner has no label of its own, a label that
// belongs to a NEIGHBOURING parcel can be picked instead, and the app would then take that other point's
// coordinates from the points file (a spike across the map and a wrong area).
// Real matches agree with the CAD drawing (same offset for every corner), so a match whose point sits far
// away from the corner compared with the others is rejected: the CAD position is used and the user is told.
export function validateLabelMatches(detectedPts, missingPoints, loadedPoints, bbDiag) {
    const warnings = [];
    const median = (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const matched = detectedPts.filter(p => p.status === 'matched' && loadedPoints[p.pointId]);
    if (matched.length >= 3) {
        const dxs = matched.map(p => loadedPoints[p.pointId].x - p.x);
        const dys = matched.map(p => loadedPoints[p.pointId].y - p.y);
        const mdx = median(dxs), mdy = median(dys);     // common offset between CAD and points file (usually 0)
        const tol = Math.max(2, 0.08 * (bbDiag || 0));
        const bad = matched.filter((p, i) => Math.hypot(dxs[i] - mdx, dys[i] - mdy) > tol);
        // If most corners disagree the drawing is simply in another coordinate frame: leave everything as is.
        if (bad.length > 0 && bad.length <= matched.length / 2) {
            const existing = new Set([...Object.keys(loadedPoints), ...Object.keys(missingPoints)]);
            bad.forEach((p) => {
                const lp = loadedPoints[p.pointId];
                const off = Math.hypot(lp.x - p.x - mdx, lp.y - p.y - mdy);
                let c = 1;
                while (existing.has(`CAD_${c}`)) c++;
                const newId = `CAD_${c}`;
                existing.add(newId);
                warnings.push(`Corner #${p.vertexIdx + 1}: label "${p.pointId}" was ignored — that point in your points file is ${off.toFixed(1)} m away from this corner (it is probably a label of another parcel). The CAD position is used instead; please check the ID.`);
                missingPoints[newId] = { x: p.x, y: p.y };
                p.label = null; p.dist = Infinity; p.pointId = newId; p.status = 'generated';
            });
        }
    }
    // Soft check: a label much farther from its corner than the others is suspicious even if it can't be proven wrong
    const dists = detectedPts.filter(p => p.status !== 'generated' && Number.isFinite(p.dist)).map(p => p.dist);
    if (dists.length >= 4) {
        const limit = Math.max(3 * median(dists), 3);
        detectedPts.forEach((p) => {
            if (p.status !== 'generated' && Number.isFinite(p.dist) && p.dist > limit) {
                warnings.push(`Corner #${p.vertexIdx + 1}: label "${p.pointId}" is ${p.dist.toFixed(1)} away from the corner (other labels are ~${median(dists).toFixed(1)}). Check that the ID is right.`);
            }
        });
    }
    return { warnings };
}
