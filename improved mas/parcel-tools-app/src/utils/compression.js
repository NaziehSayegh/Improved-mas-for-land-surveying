/**
 * Compression and Archive Management Utility for Parcel Tools
 * Communicates with high-concurrency streaming compression backend.
 */

const API_BASE = 'http://localhost:5000/api';

/**
 * Compresses multiple files into an optimized ZIP archive.
 * @param {Array<{sourcePath?: string, content?: string, base64Content?: string, archiveName: string}>} files 
 * @param {string|null} outputPath - Destination .zip path (optional)
 * @param {object} options - { compressionLevel: 1..9, comment: string }
 * @returns {Promise<object>} Compression statistics and result
 */
export async function compressFiles(files, outputPath = null, options = {}) {
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new Error('No files provided for compression');
    }

    const payload = {
        files,
        outputPath: outputPath || undefined,
        compressionLevel: options.compressionLevel || 6,
        comment: options.comment || 'Parcel Tools Compressed Archive'
    };

    const response = await fetch(`${API_BASE}/compress-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Compression failed with status ${response.status}`);
    }

    return await response.json();
}

/**
 * Creates a comprehensive project archive (.zip) containing project JSON, active .pnt coordinates,
 * CAD drawing, and manifest.
 * @param {object} params - { projectName, projectData, pointsFilePath, cadFilePath, outputPath }
 * @returns {Promise<object>}
 */
export async function exportProjectArchive({ projectName, projectData, pointsFilePath, cadFilePath, outputPath = null }) {
    const payload = {
        projectName: projectName || 'ParcelProject',
        projectData: projectData || {},
        pointsFilePath: pointsFilePath || undefined,
        cadFilePath: cadFilePath || undefined,
        outputPath: outputPath || undefined
    };

    const response = await fetch(`${API_BASE}/project/export-archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Project archive export failed with status ${response.status}`);
    }

    return await response.json();
}

/**
 * Checks concurrency and compression engine status.
 * @returns {Promise<object>}
 */
export async function getCompressionEngineStatus() {
    try {
        const response = await fetch(`${API_BASE}/compress/status`);
        if (response.ok) {
            return await response.json();
        }
        return { status: 'offline' };
    } catch {
        return { status: 'offline' };
    }
}
