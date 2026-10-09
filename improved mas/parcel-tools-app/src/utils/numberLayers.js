// Which CAD layers may be used to read parcel numbers and corner numbers.
//
// In the drawings this app is used with, the numbers that name the corners of a polygon live on two layers
// ("numbers for marks" and "numbers for building corners") and the parcel number lives on "text for
// description". Text on every other layer (dimensions, road names, neighbours, ...) must be ignored,
// otherwise a nearby unrelated number can be taken as a corner or as the parcel number.

const norm = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '');

export const NUMBER_LAYERS_STORAGE_KEY = 'parcelTools.numberLayers';

/** Layers holding corner numbers: "numbers for marks", "numbers for building corners" (and close variants). */
export function detectCornerLayers(layerNames) {
    return (layerNames || []).filter((n) => {
        const s = norm(n);
        return s.includes('number') && (s.includes('mark') || s.includes('building') || s.includes('corner'));
    });
}

/** Layers holding the parcel number: "text for description". */
export function detectParcelNumberLayers(layerNames) {
    const names = layerNames || [];
    const exact = names.filter((n) => { const s = norm(n); return s.includes('text') && s.includes('description'); });
    return exact.length ? exact : names.filter((n) => norm(n).includes('description'));
}

/** Corner labels allowed by the chosen layers (no choice made = every label, the old behaviour). */
export function filterCornerLabels(labels, cornerLayers) {
    if (!cornerLayers || cornerLayers.length === 0) return labels;
    const allowed = new Set(cornerLayers);
    return labels.filter((l) => allowed.has(l.layer));
}

/**
 * Parcel number: text inside the polygon on the parcel-number layer(s) only (numeric text preferred, the one
 * closest to the polygon centre wins). Returns null when no layer was chosen (old behaviour applies) and ''
 * when layers were chosen but no text was found (the caller then uses its automatic number).
 */
export function pickParcelNumberText(labelsInside, parcelLayers, centroid) {
    if (!parcelLayers || parcelLayers.length === 0) return null;
    const allowed = new Set(parcelLayers);
    const onLayer = labelsInside.filter((l) => allowed.has(l.layer) && l.text && String(l.text).trim());
    if (onLayer.length === 0) return '';
    const numeric = onLayer.filter((l) => /^\s*\d+(\.\d+)?\s*$/.test(l.text));
    const pool = numeric.length ? numeric : onLayer;
    const best = [...pool].sort((a, b) =>
        Math.hypot(a.x - centroid.x, a.y - centroid.y) - Math.hypot(b.x - centroid.x, b.y - centroid.y))[0];
    return String(best.text).trim().replace(/^Parcel\s+|^#\s*|^No\.\s*/i, '');
}

/** Load the user's saved choice, keeping only layers that exist in the current drawing; otherwise auto-detect. */
export function resolveNumberLayers(layerNames, saved) {
    const names = layerNames || [];
    const keep = (list) => (Array.isArray(list) ? list.filter((n) => names.includes(n)) : []);
    const corner = keep(saved && saved.corner);
    const parcel = keep(saved && saved.parcel);
    return {
        corner: corner.length ? corner : detectCornerLayers(names),
        parcel: parcel.length ? parcel : detectParcelNumberLayers(names),
    };
}
