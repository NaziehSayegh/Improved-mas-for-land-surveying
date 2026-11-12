// Small pure helpers for working with saved parcels. No React, no DOM — easy to test.

// Parcel number as a comparison key. Tolerates numbers stored as numbers or missing
// (older project files, CAD imports) so a list can never crash on one odd parcel.
export const parcelKey = (p) => String(p?.number ?? '').trim().toLowerCase();

// Area text that never throws when the area is missing or not a number
export const formatArea = (value) => (typeof value === 'number' && isFinite(value)) ? value.toFixed(4) : '—';

// Latest saved version of each parcel number, in the order the numbers first reached their latest version
export const latestVersions = (parcels) => {
  const seen = new Set();
  const out = [];
  for (let i = parcels.length - 1; i >= 0; i--) {
    const key = parcelKey(parcels[i]);
    if (!seen.has(key)) {
      seen.add(key);
      out.unshift(parcels[i]);
    }
  }
  return out;
};

// For every parcel: which version of its number it is, and how many versions that number has.
// Returns { totals: Map<key, count>, versionOf: Map<parcel.id, n> } in one pass over the list.
export const countVersions = (parcels) => {
  const totals = new Map();
  const versionOf = new Map();
  parcels.forEach(p => {
    const key = parcelKey(p);
    const n = (totals.get(key) || 0) + 1;
    totals.set(key, n);
    versionOf.set(p.id, n);
  });
  return { totals, versionOf };
};

// Distance from point p to the segment a→b (world units)
export const distToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

// Index i of the boundary edge ids[i] → ids[i+1] (closed loop) that lies nearest to pt
export const nearestEdgeIndex = (ids, points, pt) => {
  let best = ids.length - 1, bestD = Infinity;
  for (let i = 0; i < ids.length; i++) {
    const a = points[ids[i]], b = points[ids[(i + 1) % ids.length]];
    if (!a || !b) continue;
    const d = distToSegment(pt, a, b);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
};

// Keep only the curves whose two ends are still neighbours on the boundary
export const pruneCurves = (ids, curveList) => (curveList || []).filter(c => {
  const i = ids.indexOf(c.from), j = ids.indexOf(c.to), n = ids.length;
  return i >= 0 && j >= 0 && ((i + 1) % n === j || (j + 1) % n === i);
});

// Ways a parcel list can be ordered. `saved` keeps the order the parcels were saved in.
export const PARCEL_SORTS = [
  { id: 'saved', label: 'Order saved (oldest first)' },
  { id: 'newest', label: 'Newest first' },
  { id: 'number', label: 'Parcel number (1 → 9, A → Z)' },
  { id: 'number-desc', label: 'Parcel number (9 → 1, Z → A)' },
  { id: 'area-desc', label: 'Area (largest first)' },
  { id: 'area', label: 'Area (smallest first)' },
];

const areaOf = (p) => (typeof p?.area === 'number' && isFinite(p.area)) ? p.area : null;
// "2" before "10", "12/A" before "12/B"
const byNumber = (a, b) => String(a?.number ?? '').trim().localeCompare(String(b?.number ?? '').trim(), undefined, { numeric: true, sensitivity: 'base' });
// Parcels without an area always go last
const byArea = (a, b, direction) => {
  const x = areaOf(a), y = areaOf(b);
  if (x === null || y === null) return (x === null) - (y === null);
  return (x - y) * direction;
};

// A sorted copy of the list (never changes the list it is given). Equal items keep their saved order.
export const sortParcels = (parcels, sortId) => {
  const list = [...parcels];
  switch (sortId) {
    case 'newest': return list.reverse();
    case 'number': return list.sort(byNumber);
    case 'number-desc': return list.sort((a, b) => byNumber(b, a));
    case 'area': return list.sort((a, b) => byArea(a, b, 1));
    case 'area-desc': return list.sort((a, b) => byArea(a, b, -1));
    default: return list;
  }
};
