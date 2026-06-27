/**
 * makeupRenderer.js — Canvas 2D Makeup Rendering Engine
 * ======================================================
 * Renders realistic, Snapchat-style virtual makeup on a live
 * webcam feed using Canvas 2D compositing operations.
 *
 * Architecture: Multi-layer canvas stack
 *   1. Video canvas  — raw camera feed
 *   2. Makeup canvas — makeup drawn here (offscreen), blurred
 *   3. Display canvas — final composited output
 *
 * Each makeup type uses appropriate compositing:
 *   - Lipstick: multiply blend, alpha ~0.45
 *   - Foundation: overlay blend, feathered radial gradient
 *   - Blush: multiply blend, radial gradient
 *   - Contour: multiply blend, linear gradient along jaw/nose
 */

import {
    LANDMARKS,
    landmarksToPixels,
    getCenter,
    getFaceWidth,
    buildPolygonPath,
} from './landmarks.js';

export class MakeupRenderer {
    /**
     * @param {HTMLCanvasElement} displayCanvas — The visible output canvas.
     * @param {HTMLVideoElement} video — The webcam video element.
     */
    constructor(displayCanvas, video) {
        this.displayCanvas = displayCanvas;
        this.displayCtx = displayCanvas.getContext('2d');
        this.video = video;

        // Create offscreen makeup canvas
        this.makeupCanvas = document.createElement('canvas');
        this.makeupCtx = this.makeupCanvas.getContext('2d');

        // Create secondary offscreen for blur pipeline
        this.blurCanvas = document.createElement('canvas');
        this.blurCtx = this.blurCanvas.getContext('2d');

        // Makeup state
        this.colors = {
            foundation: null,
            lipstick: null,
            blush: null,
            contour: null,
            eyeshadow: null,
            eyeliner: null,
        };

        this.opacity = {
            foundation: 0.18,
            lipstick: 0.45,
            blush: 0.28,
            contour: 0.22,
            eyeshadow: 0.30,
            eyeliner: 0.60,
        };

        this.enabled = {
            foundation: false,
            lipstick: false,
            blush: false,
            contour: false,
            eyeshadow: false,
            eyeliner: false,
        };

        // Performance
        this._frameCount = 0;
    }

    /**
     * Resize all canvases to match video dimensions.
     */
    resize(width, height) {
        this.displayCanvas.width = width;
        this.displayCanvas.height = height;
        this.makeupCanvas.width = width;
        this.makeupCanvas.height = height;
        this.blurCanvas.width = width;
        this.blurCanvas.height = height;
    }

    /**
     * Set a makeup color.
     * @param {string} type — 'foundation', 'lipstick', 'blush', 'contour'
     * @param {string} hexColor — '#RRGGBB'
     */
    setColor(type, hexColor) {
        if (type in this.colors) {
            this.colors[type] = hexColor;
            this.enabled[type] = !!hexColor;
        }
    }

    /**
     * Set opacity for a makeup type.
     * @param {string} type
     * @param {number} value — 0 to 1
     */
    setOpacity(type, value) {
        if (type in this.opacity) {
            this.opacity[type] = Math.max(0, Math.min(1, value));
        }
    }

    /**
     * Toggle a makeup type on/off.
     */
    toggle(type, enabled) {
        if (type in this.enabled) {
            this.enabled[type] = enabled;
        }
    }

    /**
     * Clear all makeup.
     */
    clearAll() {
        for (const type of Object.keys(this.colors)) {
            this.colors[type] = null;
            this.enabled[type] = false;
        }
    }

    /**
     * Parse hex color to RGBA string.
     * @param {string} hex — '#RRGGBB'
     * @param {number} alpha — 0 to 1
     * @returns {string} 'rgba(r, g, b, a)'
     */
    _hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Darken a hex color by a factor.
     * @param {string} hex
     * @param {number} factor — 0 to 1 (0 = black, 1 = original)
     * @returns {string}
     */
    _darken(hex, factor) {
        const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
        const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
        const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // ===================================================================
    // LIPSTICK RENDERING
    // ===================================================================

    _renderLipstick(ctx, px) {
        if (!this.enabled.lipstick || !this.colors.lipstick) return;

        const color = this.colors.lipstick;
        const alpha = this.opacity.lipstick;

        ctx.save();

        // --- Outer lip fill with multiply blending ---
        const outerPath = buildPolygonPath(px, LANDMARKS.LIPS_OUTER);

        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fill(outerPath);

        // --- Inner lip (slightly deeper shade) ---
        // Build inner lip region for a two-tone effect
        const upperInner = LANDMARKS.LIPS_UPPER_INNER;
        const lowerInner = LANDMARKS.LIPS_LOWER_INNER;

        // Create inner lip path
        const innerPath = new Path2D();
        if (upperInner.length > 0) {
            innerPath.moveTo(px[upperInner[0]].x, px[upperInner[0]].y);
            for (let i = 1; i < upperInner.length; i++) {
                innerPath.lineTo(px[upperInner[i]].x, px[upperInner[i]].y);
            }
        }
        // Connect with lower inner (reversed for proper polygon)
        for (let i = lowerInner.length - 1; i >= 0; i--) {
            innerPath.lineTo(px[lowerInner[i]].x, px[lowerInner[i]].y);
        }
        innerPath.closePath();

        // Slightly deeper shade for inner lip
        const deeperColor = this._darken(color, 0.8);
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = deeperColor;
        ctx.fill(innerPath);

        // --- Lip highlight (center of lower lip) ---
        const lowerCenter = getCenter(px, [14, 17, 84, 181, 91, 146]);
        const highlightRadius = getFaceWidth(px) * 0.03;

        const highlightGrad = ctx.createRadialGradient(
            lowerCenter.x, lowerCenter.y, 0,
            lowerCenter.x, lowerCenter.y, highlightRadius
        );
        highlightGrad.addColorStop(0, `rgba(255, 255, 255, 0.15)`);
        highlightGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = highlightGrad;
        ctx.fill(outerPath);

        ctx.restore();
    }

    // ===================================================================
    // FOUNDATION RENDERING
    // ===================================================================

    _renderFoundation(ctx, px) {
        if (!this.enabled.foundation || !this.colors.foundation) return;

        const color = this.colors.foundation;
        const alpha = this.opacity.foundation;

        ctx.save();

        // Build face oval path
        const facePath = buildPolygonPath(px, LANDMARKS.FACE_OVAL);

        // Compute face center and dimensions for radial gradient
        const faceCenter = getCenter(px, [1, 4, 5, 6, 197, 195]);
        const faceW = getFaceWidth(px);
        const faceH = faceW * 1.3; // Face is taller than wide

        // Create feathered radial gradient — full color in center, transparent at edges
        const grad = ctx.createRadialGradient(
            faceCenter.x, faceCenter.y, faceW * 0.1,
            faceCenter.x, faceCenter.y, faceW * 0.6
        );
        grad.addColorStop(0, this._hexToRgba(color, alpha));
        grad.addColorStop(0.6, this._hexToRgba(color, alpha * 0.7));
        grad.addColorStop(0.85, this._hexToRgba(color, alpha * 0.3));
        grad.addColorStop(1, this._hexToRgba(color, 0));

        // Clip to face oval and fill with gradient
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 1;
        ctx.clip(facePath);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.restore();
    }

    // ===================================================================
    // BLUSH RENDERING
    // ===================================================================

    _renderBlush(ctx, px) {
        if (!this.enabled.blush || !this.colors.blush) return;

        const color = this.colors.blush;
        const alpha = this.opacity.blush;
        const faceW = getFaceWidth(px);
        const blushRadius = faceW * 0.14;

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 1;

        // Left cheek
        const leftCenter = getCenter(px, LANDMARKS.LEFT_CHEEK_CENTER);
        const leftGrad = ctx.createRadialGradient(
            leftCenter.x, leftCenter.y, 0,
            leftCenter.x, leftCenter.y, blushRadius
        );
        leftGrad.addColorStop(0, this._hexToRgba(color, alpha));
        leftGrad.addColorStop(0.5, this._hexToRgba(color, alpha * 0.6));
        leftGrad.addColorStop(1, this._hexToRgba(color, 0));

        ctx.fillStyle = leftGrad;
        ctx.beginPath();
        ctx.arc(leftCenter.x, leftCenter.y, blushRadius, 0, Math.PI * 2);
        ctx.fill();

        // Right cheek
        const rightCenter = getCenter(px, LANDMARKS.RIGHT_CHEEK_CENTER);
        const rightGrad = ctx.createRadialGradient(
            rightCenter.x, rightCenter.y, 0,
            rightCenter.x, rightCenter.y, blushRadius
        );
        rightGrad.addColorStop(0, this._hexToRgba(color, alpha));
        rightGrad.addColorStop(0.5, this._hexToRgba(color, alpha * 0.6));
        rightGrad.addColorStop(1, this._hexToRgba(color, 0));

        ctx.fillStyle = rightGrad;
        ctx.beginPath();
        ctx.arc(rightCenter.x, rightCenter.y, blushRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ===================================================================
    // CONTOUR RENDERING
    // ===================================================================

    _renderContour(ctx, px) {
        if (!this.enabled.contour || !this.colors.contour) return;

        const color = this.colors.contour;
        const alpha = this.opacity.contour;
        const faceW = getFaceWidth(px);

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 1;

        // --- Jawline contour (left side) ---
        this._drawContourStrip(ctx, px, LANDMARKS.JAWLINE_LEFT, color, alpha, faceW * 0.06, 'outward');

        // --- Jawline contour (right side) ---
        this._drawContourStrip(ctx, px, LANDMARKS.JAWLINE_RIGHT, color, alpha, faceW * 0.06, 'outward');

        // --- Nose contour (sides of nose bridge) ---
        this._drawNoseContour(ctx, px, color, alpha, faceW);

        ctx.restore();
    }

    /**
     * Draw a contour strip along a set of landmarks with gradient fade.
     */
    _drawContourStrip(ctx, px, indices, color, alpha, thickness, direction) {
        if (indices.length < 2) return;

        ctx.save();

        // Build a thick path along the landmark line
        const path = new Path2D();

        for (let i = 0; i < indices.length - 1; i++) {
            const curr = px[indices[i]];
            const next = px[indices[i + 1]];

            // Compute normal vector for thickness
            const dx = next.x - curr.x;
            const dy = next.y - curr.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len * thickness;
            const ny = dx / len * thickness;

            // Create a quad for this segment
            const segPath = new Path2D();
            segPath.moveTo(curr.x, curr.y);
            segPath.lineTo(next.x, next.y);
            segPath.lineTo(next.x + nx, next.y + ny);
            segPath.lineTo(curr.x + nx, curr.y + ny);
            segPath.closePath();

            // Gradient perpendicular to the strip
            const midX = (curr.x + next.x) / 2;
            const midY = (curr.y + next.y) / 2;
            const grad = ctx.createLinearGradient(
                midX, midY,
                midX + nx, midY + ny
            );
            grad.addColorStop(0, this._hexToRgba(color, alpha));
            grad.addColorStop(0.4, this._hexToRgba(color, alpha * 0.5));
            grad.addColorStop(1, this._hexToRgba(color, 0));

            ctx.fillStyle = grad;
            ctx.fill(segPath);
        }

        ctx.restore();
    }

    /**
     * Draw nose contour — subtle darkening on the sides of the nose bridge.
     */
    _drawNoseContour(ctx, px, color, alpha, faceW) {
        const noseAlpha = alpha * 0.6;
        const thickness = faceW * 0.03;

        // Left side of nose
        this._drawContourStrip(ctx, px, LANDMARKS.NOSE_LEFT_SIDE, color, noseAlpha, thickness, 'outward');

        // Right side of nose
        this._drawContourStrip(ctx, px, LANDMARKS.NOSE_RIGHT_SIDE, color, noseAlpha, thickness, 'outward');
    }

    // ===================================================================
    // EYESHADOW RENDERING (BONUS)
    // ===================================================================

    _renderEyeshadow(ctx, px) {
        if (!this.enabled.eyeshadow || !this.colors.eyeshadow) return;

        const color = this.colors.eyeshadow;
        const alpha = this.opacity.eyeshadow;
        const faceW = getFaceWidth(px);

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';

        // Left eye
        this._drawEyeshadowRegion(ctx, px, LANDMARKS.LEFT_EYE_UPPER, LANDMARKS.LEFT_EYEBROW, color, alpha, faceW);

        // Right eye
        this._drawEyeshadowRegion(ctx, px, LANDMARKS.RIGHT_EYE_UPPER, LANDMARKS.RIGHT_EYEBROW, color, alpha, faceW);

        ctx.restore();
    }

    _drawEyeshadowRegion(ctx, px, eyeIndices, browIndices, color, alpha, faceW) {
        // Build a path between the upper eyelid and eyebrow
        const path = new Path2D();

        // Trace upper eyelid
        const firstEye = px[eyeIndices[0]];
        path.moveTo(firstEye.x, firstEye.y);
        for (let i = 1; i < eyeIndices.length; i++) {
            path.lineTo(px[eyeIndices[i]].x, px[eyeIndices[i]].y);
        }

        // Trace eyebrow (reversed) to close the region
        for (let i = browIndices.length - 1; i >= 0; i--) {
            path.lineTo(px[browIndices[i]].x, px[browIndices[i]].y);
        }
        path.closePath();

        // Gradient from eyelid (strong) to brow (transparent)
        const eyeCenter = getCenter(px, eyeIndices);
        const browCenter = getCenter(px, browIndices);

        const grad = ctx.createLinearGradient(
            eyeCenter.x, eyeCenter.y,
            browCenter.x, browCenter.y
        );
        grad.addColorStop(0, this._hexToRgba(color, alpha));
        grad.addColorStop(0.6, this._hexToRgba(color, alpha * 0.4));
        grad.addColorStop(1, this._hexToRgba(color, 0));

        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.fill(path);
    }

    // ===================================================================
    // EYELINER RENDERING (BONUS)
    // ===================================================================

    _renderEyeliner(ctx, px) {
        if (!this.enabled.eyeliner || !this.colors.eyeliner) return;

        const color = this.colors.eyeliner;
        const alpha = this.opacity.eyeliner;
        const faceW = getFaceWidth(px);
        const lineWidth = Math.max(1, faceW * 0.008);

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Left eye upper line
        this._drawEyelinerLine(ctx, px, LANDMARKS.LEFT_EYE_UPPER);

        // Right eye upper line
        this._drawEyelinerLine(ctx, px, LANDMARKS.RIGHT_EYE_UPPER);

        ctx.restore();
    }

    _drawEyelinerLine(ctx, px, indices) {
        if (indices.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(px[indices[0]].x, px[indices[0]].y);
        for (let i = 1; i < indices.length; i++) {
            ctx.lineTo(px[indices[i]].x, px[indices[i]].y);
        }
        ctx.stroke();
    }

    // ===================================================================
    // MAIN RENDER PIPELINE
    // ===================================================================

    /**
     * Render a complete frame: video + all active makeup layers.
     *
     * @param {Array} landmarks — Smoothed pixel-coordinate landmarks
     */
    render(landmarks) {
        const w = this.displayCanvas.width;
        const h = this.displayCanvas.height;
        const displayCtx = this.displayCtx;
        const makeupCtx = this.makeupCtx;

        // 1. Draw video frame to display canvas (base layer)
        displayCtx.save();
        displayCtx.clearRect(0, 0, w, h);
        // Mirror the video horizontally for selfie view
        displayCtx.translate(w, 0);
        displayCtx.scale(-1, 1);
        displayCtx.drawImage(this.video, 0, 0, w, h);
        displayCtx.restore();

        if (!landmarks) return;

        // Convert normalized landmarks to pixel coordinates
        // Note: landmarks from FaceLandmarker are normalized [0,1]
        // but since we mirror the video, we need to mirror x coordinates
        const px = landmarks.map(lm => ({
            x: (1 - lm.x) * w,  // Mirror for selfie view
            y: lm.y * h,
            z: lm.z * w,
        }));

        // 2. Clear makeup canvas
        makeupCtx.clearRect(0, 0, w, h);

        // 3. Draw all makeup layers onto the offscreen makeup canvas
        this._renderFoundation(makeupCtx, px);
        this._renderContour(makeupCtx, px);
        this._renderBlush(makeupCtx, px);
        this._renderEyeshadow(makeupCtx, px);
        this._renderEyeliner(makeupCtx, px);
        this._renderLipstick(makeupCtx, px);

        // 4. Apply Gaussian blur to makeup canvas for smooth edges
        this.blurCtx.clearRect(0, 0, w, h);
        this.blurCtx.filter = 'blur(3px)';
        this.blurCtx.drawImage(this.makeupCanvas, 0, 0);
        this.blurCtx.filter = 'none';

        // 5. Composite blurred makeup onto display canvas
        displayCtx.globalCompositeOperation = 'source-over';
        displayCtx.drawImage(this.blurCanvas, 0, 0);

        this._frameCount++;
    }

    /**
     * Render only the video frame (no makeup) — used when face is not detected.
     */
    renderVideoOnly() {
        const w = this.displayCanvas.width;
        const h = this.displayCanvas.height;

        this.displayCtx.save();
        this.displayCtx.clearRect(0, 0, w, h);
        this.displayCtx.translate(w, 0);
        this.displayCtx.scale(-1, 1);
        this.displayCtx.drawImage(this.video, 0, 0, w, h);
        this.displayCtx.restore();
    }

    /**
     * Capture the current display canvas as an image blob.
     * @returns {Promise<Blob>}
     */
    async capture() {
        return new Promise(resolve => {
            this.displayCanvas.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    /**
     * Capture as base64 data URL.
     * @returns {string}
     */
    captureDataUrl() {
        return this.displayCanvas.toDataURL('image/png');
    }

    /**
     * Get a base64 snapshot of just the video (no makeup) for backend analysis.
     * @returns {string}
     */
    captureVideoFrame() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.video.videoWidth;
        tempCanvas.height = this.video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.video, 0, 0);
        return tempCanvas.toDataURL('image/jpeg', 0.8);
    }
}
