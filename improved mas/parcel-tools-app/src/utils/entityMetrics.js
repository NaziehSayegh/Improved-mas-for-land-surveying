// Exact area / perimeter of a CAD outline that carries true arcs (`segments`: line corners + arc records),
// the same rule the saved parcel uses: corner polygon +/- circular segments. Avoids the small error of
// measuring the drawn (straight-piece) approximation of the arcs.

/** @returns {{area:number, perimeter:number, baseArea:number, curveAdjustment:number}|null} null if there are no arcs */
export function exactMetricsFromSegments(segments) {
    if (!Array.isArray(segments) || !segments.some(s => s.type === 'arc')) return null;
    const corners = segments.filter(s => s.type === 'line');
    const n = corners.length;
    if (n < 3) return null;

    let twice = 0;
    for (let i = 0; i < n; i++) {
        const a = corners[i], b = corners[(i + 1) % n];
        twice += a.x * b.y - b.x * a.y;
    }
    const polygonCCW = twice > 0;
    const baseArea = Math.abs(twice) / 2;

    let curveAdjustment = 0;
    let perimeter = 0;
    let cornerIdx = -1;
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (s.type === 'line') {
            cornerIdx++;
            const next = corners[(cornerIdx + 1) % n];
            const following = segments[i + 1];
            if (following && following.type === 'arc') {
                const seg = 0.5 * following.r * following.r * (following.theta - Math.sin(following.theta));
                curveAdjustment += (following.ccw === polygonCCW) ? seg : -seg;
                perimeter += following.r * following.theta;
            } else {
                perimeter += Math.hypot(next.x - s.x, next.y - s.y);
            }
        }
    }
    return { area: Math.max(0, baseArea + curveAdjustment), perimeter, baseArea, curveAdjustment };
}

/** Replace the approximate numbers of `metrics` by the exact ones when the entity has arcs. */
export function withExactMetrics(entity, metrics) {
    const exact = entity && exactMetricsFromSegments(entity.segments);
    if (!metrics || !exact) return metrics;
    return { ...metrics, ...exact, dunams: exact.area / 1000 };
}
