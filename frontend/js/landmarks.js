/**
 * landmarks.js — MediaPipe FaceMesh Landmark Index Maps
 * =====================================================
 * Defines precise landmark indices for each facial region
 * used in makeup rendering. Based on MediaPipe's 478-point
 * face mesh topology.
 *
 * Reference: https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
 */

export const LANDMARKS = {
    // ---------------------------------------------------------------
    // LIPS — Outer contour (closed polygon)
    // ---------------------------------------------------------------
    LIPS_OUTER: [
        61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
        291, 308, 324, 318, 402, 317, 14, 87, 178, 88,
        95, 185, 40, 39, 37, 0, 267, 269, 270, 409,
        415, 310, 311, 312, 13, 82, 81, 42, 183, 78
    ],

    // LIPS — Upper lip line
    LIPS_UPPER_OUTER: [
        61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
        291
    ],

    LIPS_UPPER_INNER: [
        78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
        308
    ],

    // LIPS — Lower lip line
    LIPS_LOWER_OUTER: [
        61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
        291
    ],

    LIPS_LOWER_INNER: [
        78, 95, 88, 178, 87, 14, 317, 402, 318, 324,
        308
    ],

    // ---------------------------------------------------------------
    // CHEEKS — For blush application (anchor clusters)
    // ---------------------------------------------------------------
    LEFT_CHEEK: [
        // Main cheek surface
        50, 101, 36, 205, 206, 187, 123, 116, 117, 118,
        119, 120, 121, 126, 142, 203, 100, 47, 114, 217
    ],

    RIGHT_CHEEK: [
        // Mirror of left cheek
        280, 330, 266, 425, 426, 411, 352, 345, 346, 347,
        348, 349, 350, 355, 371, 423, 329, 277, 343, 437
    ],

    // Cheek center points (for radial gradient origin)
    LEFT_CHEEK_CENTER: [205, 123, 187, 36, 142],
    RIGHT_CHEEK_CENTER: [425, 352, 411, 266, 371],

    // ---------------------------------------------------------------
    // JAWLINE — For contour shading
    // ---------------------------------------------------------------
    JAWLINE: [
        10, 338, 297, 332, 284, 251, 389, 356, 454,
        323, 361, 288, 397, 365, 379, 378, 400, 377,
        152, 148, 176, 149, 150, 136, 172, 58, 132,
        93, 234, 127, 162, 21, 54, 103, 67, 109
    ],

    // Jawline — left side only (chin to ear)
    JAWLINE_LEFT: [
        152, 148, 176, 149, 150, 136, 172, 58, 132,
        93, 234, 127, 162, 21, 54, 103, 67, 109, 10
    ],

    // Jawline — right side only (chin to ear)
    JAWLINE_RIGHT: [
        152, 377, 400, 378, 379, 365, 397, 288, 361,
        323, 454, 356, 389, 251, 284, 332, 297, 338, 10
    ],

    // ---------------------------------------------------------------
    // NOSE — For contour highlighting / shading
    // ---------------------------------------------------------------
    NOSE_BRIDGE: [6, 197, 195, 5, 4, 1, 19, 94, 2],

    NOSE_LEFT_SIDE: [
        196, 174, 217, 198, 209, 49, 48, 115, 220, 45, 4
    ],

    NOSE_RIGHT_SIDE: [
        419, 399, 437, 420, 429, 279, 278, 344, 440, 275, 4
    ],

    NOSE_TIP: [1, 2, 98, 327, 4, 5, 195],

    // ---------------------------------------------------------------
    // FACE OVAL — For foundation application (full face outline)
    // ---------------------------------------------------------------
    FACE_OVAL: [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361,
        288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
        150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103,
        67, 109, 10
    ],

    // ---------------------------------------------------------------
    // FOREHEAD — For foundation (above eyebrows)
    // ---------------------------------------------------------------
    FOREHEAD: [
        10, 338, 297, 332, 284, 251, 389, 356, 454,
        // Connects across top via hairline estimate
        234, 127, 162, 21, 54, 103, 67, 109, 10
    ],

    // ---------------------------------------------------------------
    // EYES — For eyeshadow / eyeliner (future use)
    // ---------------------------------------------------------------
    LEFT_EYE_UPPER: [
        246, 161, 160, 159, 158, 157, 173
    ],

    LEFT_EYE_LOWER: [
        33, 7, 163, 144, 145, 153, 154, 155, 133
    ],

    RIGHT_EYE_UPPER: [
        466, 388, 387, 386, 385, 384, 398
    ],

    RIGHT_EYE_LOWER: [
        263, 249, 390, 373, 374, 380, 381, 382, 362
    ],

    // Left eyebrow
    LEFT_EYEBROW: [
        70, 63, 105, 66, 107, 55, 65, 52, 53, 46
    ],

    // Right eyebrow
    RIGHT_EYEBROW: [
        300, 293, 334, 296, 336, 285, 295, 282, 283, 276
    ],
};

/**
 * Convert normalized MediaPipe landmarks to screen pixel coordinates.
 *
 * @param {Array} landmarks - MediaPipe normalized landmarks array
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 * @returns {Array} Array of {x, y, z} in pixel coordinates
 */
export function landmarksToPixels(landmarks, width, height) {
    return landmarks.map(lm => ({
        x: lm.x * width,
        y: lm.y * height,
        z: lm.z * width,  // z is relative to x scale
    }));
}

/**
 * Get the center point of a set of landmark indices.
 *
 * @param {Array} pixelLandmarks - Full array of pixel-coordinate landmarks
 * @param {Array} indices - Array of landmark indices to average
 * @returns {{x: number, y: number}}
 */
export function getCenter(pixelLandmarks, indices) {
    let sx = 0, sy = 0;
    for (const idx of indices) {
        sx += pixelLandmarks[idx].x;
        sy += pixelLandmarks[idx].y;
    }
    return {
        x: sx / indices.length,
        y: sy / indices.length,
    };
}

/**
 * Estimate face width from landmarks (distance between cheek points).
 *
 * @param {Array} pixelLandmarks
 * @returns {number}
 */
export function getFaceWidth(pixelLandmarks) {
    const left = pixelLandmarks[234];   // Left ear area
    const right = pixelLandmarks[454];  // Right ear area
    return Math.sqrt(
        Math.pow(right.x - left.x, 2) + Math.pow(right.y - left.y, 2)
    );
}

/**
 * Build a Path2D polygon from landmark indices.
 *
 * @param {Array} pixelLandmarks
 * @param {Array} indices
 * @returns {Path2D}
 */
export function buildPolygonPath(pixelLandmarks, indices) {
    const path = new Path2D();
    if (indices.length === 0) return path;

    const first = pixelLandmarks[indices[0]];
    path.moveTo(first.x, first.y);
    for (let i = 1; i < indices.length; i++) {
        const pt = pixelLandmarks[indices[i]];
        path.lineTo(pt.x, pt.y);
    }
    path.closePath();
    return path;
}
