// ─── Label → point match validation ──────────────────────────────────────────
// Corner labels are matched to the nearest CAD text. When a corner has no label of its own, a label that
// belongs to a NEIGHBOURING parcel can be picked instead, and the app would then take that other point's
// coordinates from the points file (a spike across the map and a wrong area).
// Real matches agree with the CAD drawing (same offset for every corner), so a match whose point sits far
// away from the corner compared with the others is rejected: the CAD position is used and the user is told.
export function validateLabelMatches(detectedPts, missingPoints, loadedPoints, bbDiag) {
    const warnings = [];
    warnings.byVertex = {};      // vertexIdx -> index of the 'label ignored' warning for that corner
    const median = (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const matched = detectedPts.filter(p => !p.isCopy && p.status === 'matched' && loadedPoints[p.pointId]);
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
                warnings.byVertex[p.vertexIdx] = warnings.length;
                warnings.push(`Corner #${p.vertexIdx + 1}: label "${p.pointId}" was ignored — that point in your points file is ${off.toFixed(1)} m away from this corner (it is probably a label of another parcel). The CAD position is used instead; please check the ID.`);
                missingPoints[newId] = { x: p.x, y: p.y };
                p.label = null; p.dist = Infinity; p.pointId = newId; p.status = 'generated';
            });
        }
    }
    // Soft check: a label much farther from its corner than the others is suspicious even if it can't be proven wrong
    const dists = detectedPts.filter(p => !p.isCopy && p.status !== 'generated' && Number.isFinite(p.dist)).map(p => p.dist);
    if (dists.length >= 4) {
        const limit = Math.max(3 * median(dists), 3);
        detectedPts.forEach((p) => {
            if (!p.isCopy && p.status !== 'generated' && Number.isFinite(p.dist) && p.dist > limit) {
                warnings.push(`Corner #${p.vertexIdx + 1}: label "${p.pointId}" is ${p.dist.toFixed(1)} away from the corner (other labels are ~${median(dists).toFixed(1)}). Check that the ID is right.`);
            }
        });
    }
    return { warnings };
}

/**
 * Corners that sit at exactly the same position (a hole stitched into its outer ring visits a corner twice)
 * are ONE point. Give every copy the same identification and drop the extra generated ids.
 */
export function unifyCoincidentCorners(detectedPts, missingPoints, tol = 1e-3, reselect = true) {
    const rank = (p) => (p.status === 'matched' ? 0 : p.status === 'missing' ? 1 : 2);
    const groups = new Map();
    detectedPts.forEach((p) => {
        const key = `${Math.round((p.cadX ?? p.x) / tol)}|${Math.round((p.cadY ?? p.y) / tol)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
    });
    groups.forEach((members) => {
        if (members.length < 2) return;
        let best = reselect ? null : members.find(p => !p.isCopy);
        if (!best) {
            best = members.reduce((a, b) => (rank(b) < rank(a) || (rank(b) === rank(a) && (b.dist ?? Infinity) < (a.dist ?? Infinity)) ? b : a));
        }
        members.forEach((p) => {
            p.isCopy = p !== best;          // copies simply follow their twin: never matched/warned about on their own
            if (p === best) return;
            if (p.pointId && p.pointId !== best.pointId && missingPoints[p.pointId]
                && !detectedPts.some(q => q !== p && q.pointId === p.pointId)) {
                delete missingPoints[p.pointId];
            }
            p.pointId = best.pointId; p.label = best.label; p.dist = best.dist; p.status = best.status;
            p.byPosition = best.byPosition; p.shifted = best.shifted;
        });
    });
}

/**
 * Identify every corner of a parcel in the coordinates (.pnt) file, even when its label is missing/wrong.
 *
 * 1. Labels that disagree with the drawing are rejected (validateLabelMatches).
 * 2. The common offset between the drawing and the points file is estimated from the reliable matches.
 * 3. Corners that are still unidentified are matched BY POSITION to the nearest point of the points file
 *    (within `tol`), so no "CAD_n" ids are invented for points that already exist.
 * 4. Corners that really are new are moved into the points-file frame (using the same offset) and registered
 *    there, so all corners share one coordinate system and the area can be computed.
 *
 * Mutates detectedPts / missingPoints. Returns { warnings, consistent }:
 *   consistent === true  -> every corner is expressed in the points-file frame (area can be calculated)
 */
export function reconcileCorners(detectedPts, missingPoints, loadedPoints, bbDiag, tol = 0.25) {
    // keep the drawing position: arcs / orientation are worked out in the drawing's own frame
    detectedPts.forEach((p) => { if (p.cadX === undefined) { p.cadX = p.x; p.cadY = p.y; } });
    unifyCoincidentCorners(detectedPts, missingPoints);
    const { warnings } = validateLabelMatches(detectedPts, missingPoints, loadedPoints, bbDiag);
    const median = (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const isKnown = (p) => p.status === 'matched' && loadedPoints[p.pointId];
    const known = detectedPts.filter(p => !p.isCopy && isKnown(p));
    const loadedEntries = Object.entries(loadedPoints);

    // --- offset between drawing and points file, from the reliable label matches
    let offset = null;
    if (known.length >= 2) {
        const dxs = known.map(p => loadedPoints[p.pointId].x - p.x);
        const dys = known.map(p => loadedPoints[p.pointId].y - p.y);
        const mdx = median(dxs), mdy = median(dys);
        const spread = Math.max(...known.map((p, i) => Math.hypot(dxs[i] - mdx, dys[i] - mdy)));
        if (spread <= Math.max(2, 0.08 * (bbDiag || 0))) offset = { x: mdx, y: mdy };
    }
    const tryOffsets = offset ? [offset] : [{ x: 0, y: 0 }];

    // --- identify the rest by position
    const used = new Set(known.map(p => p.pointId));
    let positionMatches = 0;
    detectedPts.filter(p => !p.isCopy && !isKnown(p)).forEach((p) => {
        let best = null;
        for (const off of tryOffsets) {
            const px = p.x + off.x, py = p.y + off.y;
            for (const [id, pt] of loadedEntries) {
                if (used.has(id)) continue;
                const d = Math.hypot(pt.x - px, pt.y - py);
                if (d <= tol && (!best || d < best.d)) best = { id, d, off };
            }
        }
        if (!best) return;
        const ignoredIdx = warnings.byVertex ? warnings.byVertex[p.vertexIdx] : undefined;
        if (ignoredIdx !== undefined) {
            warnings[ignoredIdx] = `Corner #${p.vertexIdx + 1}: the drawing label was ignored (it belongs to another parcel); the corner was identified as point ${best.id} from its position in your points file.`;
        } else if (p.pointId && p.pointId !== best.id && p.label) {
            warnings.push(`Corner #${p.vertexIdx + 1}: the drawing label "${p.label}" was replaced by point ${best.id}, which is at the same position in your points file.`);
        }
        if (p.pointId && missingPoints[p.pointId]) delete missingPoints[p.pointId];
        used.add(best.id);
        p.label = p.label || null;
        p.dist = best.d;
        p.pointId = best.id;
        p.status = 'matched';
        p.byPosition = true;
        positionMatches++;
        if (!offset) offset = best.off;     // first position match under the "same frame" assumption
    });

    unifyCoincidentCorners(detectedPts, missingPoints, 1e-3, false);   // copies of a corner just identified get the same id

    // --- anything still unidentified is a genuinely new point: bring it into the points-file frame
    const stillOpen = detectedPts.filter(p => !isKnown(p) && !(p.status === 'matched'));
    let consistent = stillOpen.length === 0;
    const matchedCount = detectedPts.filter(p => p.status === 'matched').length;
    if (!consistent && offset && matchedCount >= 2) {
        stillOpen.forEach((p) => {
            const nx = p.x + offset.x, ny = p.y + offset.y;
            if (missingPoints[p.pointId]) missingPoints[p.pointId] = { x: nx, y: ny };
            p.x = nx; p.y = ny;               // corner is now expressed in the points-file frame
            p.shifted = true;
        });
        consistent = true;
    }
    unifyCoincidentCorners(detectedPts, missingPoints, 1e-3, false);
    return { warnings, consistent, positionMatches, offset };
}
