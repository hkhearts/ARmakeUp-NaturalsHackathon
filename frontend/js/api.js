/**
 * api.js — Backend API Client
 * ============================
 * Handles communication with the Django backend for skin tone
 * analysis (automatic + manual modes) and saving looks.
 */

const API_BASE = 'http://127.0.0.1:8000/api';

/**
 * Generate or retrieve a session ID for this browser session.
 */
function getSessionId() {
    let sid = sessionStorage.getItem('glamour_session_id');
    if (!sid) {
        sid = Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem('glamour_session_id', sid);
    }
    return sid;
}

/**
 * AUTOMATIC analysis — send a base64 image, get undertone + recommendations.
 *
 * @param {string} base64Image — Data URL or raw base64
 * @returns {Promise<Object>}
 */
export async function analyzeFaceAuto(base64Image) {
    const response = await fetch(`${API_BASE}/analyze-face/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: base64Image,
            session_id: getSessionId(),
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${response.status}`);
    }

    return response.json();
}

/**
 * MANUAL analysis — send a hex color or RGB values, get undertone + recommendations.
 *
 * @param {Object} params — { hex_color: '#AABBCC' } or { r: 0, g: 0, b: 0 }
 * @returns {Promise<Object>}
 */
export async function analyzeFaceManual(params) {
    const response = await fetch(`${API_BASE}/analyze-manual/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...params,
            session_id: getSessionId(),
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${response.status}`);
    }

    return response.json();
}

/**
 * Save a favorite makeup look.
 *
 * @param {Object} look — { name, foundation_color, lipstick_color, blush_color, contour_color, ...opacity }
 * @returns {Promise<Object>}
 */
export async function saveLook(look) {
    const response = await fetch(`${API_BASE}/save-look/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...look,
            session_id: getSessionId(),
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${response.status}`);
    }

    return response.json();
}

/**
 * Get saved looks for the current session.
 * @returns {Promise<Object>}
 */
export async function getLooks() {
    const sid = getSessionId();
    const response = await fetch(`${API_BASE}/looks/${sid}/`);
    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }
    return response.json();
}

/**
 * Get the full color recommendation database.
 * @returns {Promise<Object>}
 */
export async function getColorDatabase() {
    const response = await fetch(`${API_BASE}/color-database/`);
    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }
    return response.json();
}
