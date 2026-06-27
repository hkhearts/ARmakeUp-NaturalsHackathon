/**
 * api.js — Backend API Client
 * ============================
 * Communicates with the Django REST API endpoints.
 */

const API_BASE = '/api';

/**
 * Automatic skin analysis from a base64 image.
 */
export async function analyzeFaceAuto(base64Image, userName = '') {
    const resp = await fetch(`${API_BASE}/analyze-face/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, user_name: userName }),
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Auto analysis failed');
    }
    return resp.json();
}

/**
 * Manual skin analysis from a color value.
 */
export async function analyzeFaceManual(data) {
    const resp = await fetch(`${API_BASE}/analyze-manual/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Manual analysis failed');
    }
    return resp.json();
}

/**
 * Save a captured photo to user's folder.
 */
export async function capturePhoto(userName, base64Image, notes = '', makeupConfig = {}) {
    const resp = await fetch(`${API_BASE}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_name: userName,
            image: base64Image,
            notes: notes,
            makeup_config: makeupConfig,
        }),
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Capture failed');
    }
    return resp.json();
}

/**
 * Scan a barcode image.
 */
export async function scanBarcode(base64Image, userName = '') {
    const resp = await fetch(`${API_BASE}/scan-barcode/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            barcode_image: base64Image,
            user_name: userName,
        }),
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Barcode scan failed');
    }
    return resp.json();
}

/**
 * Manual barcode/product data entry.
 */
export async function scanBarcodeManual(content, userName = '') {
    const resp = await fetch(`${API_BASE}/scan-barcode-manual/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, user_name: userName }),
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Manual entry failed');
    }
    return resp.json();
}

/**
 * Generate a skin analysis report.
 */
export async function generateReport(userName, base64Image, analysis, makeupConfig) {
    const resp = await fetch(`${API_BASE}/generate-report/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_name: userName,
            image: base64Image,
            analysis: analysis,
            makeup_config: makeupConfig,
        }),
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Report generation failed');
    }
    return resp.json();
}

/**
 * Get all scanned products.
 */
export async function getProducts() {
    const resp = await fetch(`${API_BASE}/products/`);
    return resp.json();
}
