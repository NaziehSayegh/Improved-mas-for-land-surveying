/**
 * Point & Parcel Dataset Deduplication Utility
 * Safely removes redundant and duplicate entries while preserving valid unique points,
 * parcel geometries, calculations, curves, and the underlying data schema.
 */

/**
 * Deduplicates and sanitizes the point dataset.
 * - Trims point IDs (keys) and standardizes keys.
 * - Filters out invalid coordinates (null, undefined, NaN, infinity).
 * - Ensures numeric values for x and y.
 * - Detects and eliminates redundant duplicate mappings.
 * 
 * @param {Object} pointsMap - Map of pointId -> { x, y }
 * @returns {{ deduplicated: Object, removedCount: number, hasChanged: boolean }}
 */
export function deduplicatePoints(pointsMap) {
  if (!pointsMap || typeof pointsMap !== 'object') {
    return { deduplicated: {}, removedCount: 0, hasChanged: false };
  }

  const deduplicated = {};
  let removedCount = 0;
  let hasChanged = false;
  const originalKeys = Object.keys(pointsMap);

  for (const rawKey of originalKeys) {
    const point = pointsMap[rawKey];
    const key = String(rawKey).trim();

    // Check if key is invalid/empty or point is null/undefined
    if (!key || !point || typeof point !== 'object') {
      removedCount++;
      hasChanged = true;
      continue;
    }

    const x = typeof point.x === 'number' ? point.x : parseFloat(point.x);
    const y = typeof point.y === 'number' ? point.y : parseFloat(point.y);

    if (isNaN(x) || !isFinite(x) || isNaN(y) || !isFinite(y)) {
      removedCount++;
      hasChanged = true;
      continue;
    }

    // Check if trimmed key already exists with identical or existing coords
    if (Object.prototype.hasOwnProperty.call(deduplicated, key)) {
      if (Math.abs(deduplicated[key].x - x) < 1e-7 && Math.abs(deduplicated[key].y - y) < 1e-7) {
        removedCount++;
        hasChanged = true;
        continue;
      }
    }

    if (rawKey !== key) {
      hasChanged = true;
    }

    deduplicated[key] = {
      x,
      y,
      ...(point.z !== undefined && typeof point.z === 'number' ? { z: point.z } : {})
    };
  }

  if (Object.keys(deduplicated).length !== originalKeys.length) {
    hasChanged = true;
  }

  return { deduplicated, removedCount, hasChanged };
}

/**
 * Deduplicates and sanitizes the parcel dataset.
 * - Normalizes parcel numbers and fields.
 * - Cleans vertex ID sequences (removes consecutive duplicates and trailing closures).
 * - Eliminates exact duplicate parcel entries (same number, same boundary IDs sequence, same area, same curves).
 * - Eliminates duplicate parcel IDs.
 * - Preserves all unique revisions and versions.
 * 
 * @param {Array} parcelsList - Array of parcel objects
 * @returns {{ deduplicated: Array, removedCount: number, hasChanged: boolean }}
 */
export function deduplicateParcels(parcelsList) {
  if (!Array.isArray(parcelsList)) {
    return { deduplicated: [], removedCount: 0, hasChanged: false };
  }

  const deduplicated = [];
  const seenSignatures = new Set();
  const seenIds = new Set();
  let removedCount = 0;
  let hasChanged = false;

  for (let i = 0; i < parcelsList.length; i++) {
    const rawParcel = parcelsList[i];
    if (!rawParcel || typeof rawParcel !== 'object') {
      removedCount++;
      hasChanged = true;
      continue;
    }

    const parcelNumber = String(rawParcel.number || rawParcel.parcelNumber || '').trim();
    const rawIds = Array.isArray(rawParcel.ids) ? rawParcel.ids : [];

    // Clean up IDs array: trim strings and remove consecutive duplicates
    const cleanedIds = [];
    for (let j = 0; j < rawIds.length; j++) {
      const id = String(rawIds[j]).trim();
      if (!id) continue;
      // Skip consecutive identical corner points
      if (cleanedIds.length > 0 && cleanedIds[cleanedIds.length - 1] === id) {
        hasChanged = true;
        continue;
      }
      cleanedIds.push(id);
    }

    // Remove closing vertex if it's identical to the start vertex (polygon representation is non-repeating)
    if (cleanedIds.length > 2 && cleanedIds[0] === cleanedIds[cleanedIds.length - 1]) {
      cleanedIds.pop();
      hasChanged = true;
    }

    // Create a deterministic signature for the parcel content
    const curvesSignature = JSON.stringify(rawParcel.curves || []);
    const areaSignature = rawParcel.area != null ? Number(rawParcel.area).toFixed(4) : 'null';
    const contentSignature = `${parcelNumber.toLowerCase()}|${cleanedIds.join(',')}|${areaSignature}|${curvesSignature}`;

    // If exact same parcel content signature already exists, it is a redundant duplicate entry
    if (seenSignatures.has(contentSignature)) {
      removedCount++;
      hasChanged = true;
      continue;
    }

    // Ensure unique parcel.id
    let parcelId = rawParcel.id;
    if (!parcelId || seenIds.has(parcelId)) {
      parcelId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      hasChanged = true;
    }

    seenSignatures.add(contentSignature);
    seenIds.add(parcelId);

    const sanitizedParcel = {
      ...rawParcel,
      id: parcelId,
      number: parcelNumber,
      ids: cleanedIds,
      pointCount: cleanedIds.length
    };

    deduplicated.push(sanitizedParcel);
  }

  if (deduplicated.length !== parcelsList.length) {
    hasChanged = true;
  }

  return { deduplicated, removedCount, hasChanged };
}

/**
 * Runs full dataset deduplication across points and parcels.
 * Safe, non-destructive, and preserves schema integrity.
 * 
 * @param {Object} points - loadedPoints map
 * @param {Array} parcels - savedParcels array
 * @returns {{ points: Object, parcels: Array, removedPoints: number, removedParcels: number, totalRemoved: number, hasChanged: boolean }}
 */
export function deduplicateDatasets(points, parcels) {
  const pointResult = deduplicatePoints(points);
  const parcelResult = deduplicateParcels(parcels);

  return {
    points: pointResult.deduplicated,
    parcels: parcelResult.deduplicated,
    removedPoints: pointResult.removedCount,
    removedParcels: parcelResult.removedCount,
    totalRemoved: pointResult.removedCount + parcelResult.removedCount,
    hasChanged: pointResult.hasChanged || parcelResult.hasChanged
  };
}
