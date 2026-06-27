/**
 * makeupRenderer.js — Canvas 2D Makeup Rendering Engine
 * ======================================================
 * Renders realistic, Snapchat-style virtual makeup on a live
 * webcam feed using Canvas 2D compositing operations.
 *
 * FIXED:
 *  - Lip polygon now uses corrected LIPS_OUTER (proper closed contour)
 *  - Lip rendering uses smooth quadratic curves for natural look
 *  - Bindi position corrected to true glabella center
 *  - Video capture uses same mirror transform as display (no flip mismatch)
 *  - Foundation radial gradient uses correct face height ratio
 *  - Render pipeline properly resets globalAlpha between layers
 *  - Contour strips now use OPPOSITE normal direction for left vs right jaw
 *    so both halves are symmetrical (fixed the "shifted up" bug)
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
     * @param {HTMLVideoElement}  video         — The webcam video element.
     */
    constructor(displayCanvas, video) {
        this.displayCanvas = displayCanvas;
        this.displayCtx    = displayCanvas.getContext('2d');
        this.video         = video;

        // Offscreen makeup canvas
        this.makeupCanvas = document.createElement('canvas');
        this.makeupCtx    = this.makeupCanvas.getContext('2d');

        // Secondary offscreen for blur pipeline
        this.blurCanvas = document.createElement('canvas');
        this.blurCtx    = this.blurCanvas.getContext('2d');

        // ── Makeup state ──────────────────────────────────────────────
        this.colors = {
            foundation: null,
            lipstick:   null,
            blush:      null,
            contour:    null,
            eyeshadow:  null,
            eyeliner:   null,
            bindi:      null,
        };

        this.opacity = {
            foundation: 0.18,
            lipstick:   0.45,
            blush:      0.28,
            contour:    0.22,
            eyeshadow:  0.30,
            eyeliner:   0.60,
            bindi:      0.85,
        };

        // Alias for UI compatibility
        this.opacities = this.opacity;

        this.enabled = {
            foundation: false,
            lipstick:   false,
            blush:      false,
            contour:    false,
            eyeshadow:  false,
            eyeliner:   false,
            bindi:      false,
        };

        this._frameCount = 0;
    }

    // ─── Public API ───────────────────────────────────────────────────

    resize(width, height) {
        this.displayCanvas.width  = width;
        this.displayCanvas.height = height;
        this.makeupCanvas.width   = width;
        this.makeupCanvas.height  = height;
        this.blurCanvas.width     = width;
        this.blurCanvas.height    = height;
    }

    /** Set a makeup color.  hexColor = '#RRGGBB' or null to clear. */
    setColor(type, hexColor) {
        if (type in this.colors) {
            this.colors[type]  = hexColor;
            this.enabled[type] = !!hexColor;
        }
    }

    /** Set opacity (0-1) for a makeup type. */
    setOpacity(type, value) {
        if (type in this.opacity) {
            this.opacity[type] = Math.max(0, Math.min(1, value));
        }
    }

    /** Explicitly toggle a makeup type on/off (without changing color). */
    toggle(type, enabled) {
        if (type in this.enabled) this.enabled[type] = enabled;
    }

    /** Clear all makeup. */
    clearAll() {
        for (const type of Object.keys(this.colors)) {
            this.colors[type]  = null;
            this.enabled[type] = false;
        }
    }

    // ─── Colour helpers ───────────────────────────────────────────────

    _hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    _darken(hex, factor) {
        const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
        const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
        const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    // ─── Lipstick ─────────────────────────────────────────────────────

    _renderLipstick(ctx, px) {
        if (!this.enabled.lipstick || !this.colors.lipstick) return;

        const color = this.colors.lipstick;
        const alpha = this.opacity.lipstick;

        ctx.save();

        // ── Outer lip fill ──────────────────────────────────────────
        const outerPath = this._buildLipPath(px, LANDMARKS.LIPS_UPPER_OUTER, LANDMARKS.LIPS_LOWER_OUTER);

        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = color;
        ctx.fill(outerPath);

        // ── Inner lip (slightly deeper shade) ───────────────────────
        const innerPath = this._buildLipPath(px, LANDMARKS.LIPS_UPPER_INNER, LANDMARKS.LIPS_LOWER_INNER);
        const deeperColor = this._darken(color, 0.82);
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle   = deeperColor;
        ctx.fill(innerPath);

        // ── Lower-lip highlight ──────────────────────────────────────
        const lowerCenter    = getCenter(px, [14, 17, 84, 181, 91, 146]);
        const highlightRadius = getFaceWidth(px) * 0.032;

        const hlGrad = ctx.createRadialGradient(
            lowerCenter.x, lowerCenter.y, 0,
            lowerCenter.x, lowerCenter.y, highlightRadius
        );
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.45;
        ctx.fillStyle   = hlGrad;
        ctx.fill(outerPath);

        ctx.restore();
    }

    /**
     * Build a closed lip polygon from upper + lower outer (or inner) landmark sets.
     * Upper: left → right, Lower: right → left → closes back at left corner.
     */
    _buildLipPath(px, upperIndices, lowerIndices) {
        const path = new Path2D();
        if (!upperIndices.length || !lowerIndices.length) return path;

        // Safety: check landmarks exist
        if (!px[upperIndices[0]]) return path;

        // Start at left corner (first point of upper outer = landmark 61 / 78)
        path.moveTo(px[upperIndices[0]].x, px[upperIndices[0]].y);

        // Trace upper lip left → right using quadratic curves
        for (let i = 1; i < upperIndices.length; i++) {
            if (!px[upperIndices[i]] || !px[upperIndices[i - 1]]) continue;
            const prev = px[upperIndices[i - 1]];
            const curr = px[upperIndices[i]];
            const mx   = (prev.x + curr.x) / 2;
            const my   = (prev.y + curr.y) / 2;
            path.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        // Reach the last upper point
        const lastUpper = px[upperIndices[upperIndices.length - 1]];
        if (lastUpper) path.lineTo(lastUpper.x, lastUpper.y);

        // Trace lower lip right → left (reversed) using quadratic curves
        const revLower = [...lowerIndices].reverse();
        for (let i = 1; i < revLower.length; i++) {
            if (!px[revLower[i]] || !px[revLower[i - 1]]) continue;
            const prev = px[revLower[i - 1]];
            const curr = px[revLower[i]];
            const mx   = (prev.x + curr.x) / 2;
            const my   = (prev.y + curr.y) / 2;
            path.quadraticCurveTo(prev.x, prev.y, mx, my);
        }

        path.closePath();
        return path;
    }

    // ─── Foundation ───────────────────────────────────────────────────

    _renderFoundation(ctx, px) {
        if (!this.enabled.foundation || !this.colors.foundation) return;

        const color  = this.colors.foundation;
        const alpha  = this.opacity.foundation;

        ctx.save();

        const facePath   = buildPolygonPath(px, LANDMARKS.FACE_OVAL);
        const faceCenter = getCenter(px, [1, 4, 5, 6, 197, 195]);
        const faceW      = getFaceWidth(px);

        const grad = ctx.createRadialGradient(
            faceCenter.x, faceCenter.y, faceW * 0.08,
            faceCenter.x, faceCenter.y, faceW * 0.62
        );
        grad.addColorStop(0,    this._hexToRgba(color, alpha));
        grad.addColorStop(0.55, this._hexToRgba(color, alpha * 0.72));
        grad.addColorStop(0.80, this._hexToRgba(color, alpha * 0.30));
        grad.addColorStop(1,    this._hexToRgba(color, 0));

        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 1;
        ctx.clip(facePath);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.restore();
    }

    // ─── Blush ────────────────────────────────────────────────────────

    _renderBlush(ctx, px) {
        if (!this.enabled.blush || !this.colors.blush) return;

        const color      = this.colors.blush;
        const alpha      = this.opacity.blush;
        const faceW      = getFaceWidth(px);
        const blushRadius = faceW * 0.14;

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 1;

        const drawCheek = (centerIndices) => {
            const center = getCenter(px, centerIndices);
            const grad   = ctx.createRadialGradient(
                center.x, center.y, 0,
                center.x, center.y, blushRadius
            );
            grad.addColorStop(0,   this._hexToRgba(color, alpha));
            grad.addColorStop(0.5, this._hexToRgba(color, alpha * 0.55));
            grad.addColorStop(1,   this._hexToRgba(color, 0));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, blushRadius * 1.1, blushRadius * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
        };

        drawCheek(LANDMARKS.LEFT_CHEEK_CENTER);
        drawCheek(LANDMARKS.RIGHT_CHEEK_CENTER);

        ctx.restore();
    }

    // ─── Contour ──────────────────────────────────────────────────────
    //
    // FIXED: Left and right jaw contour strips now use opposite normal
    //        directions so both halves render symmetrically.

    _renderContour(ctx, px) {
        if (!this.enabled.contour || !this.colors.contour) return;

        const color = this.colors.contour;
        const alpha = this.opacity.contour;
        const faceW = getFaceWidth(px);

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 1;

        // flipNormal = 1 means push normal outward to the LEFT of travel direction
        // flipNormal = -1 means push normal outward to the RIGHT of travel direction
        // Left jawline travels chin→left ear: normal should push outward (right of travel = inward face)
        // Right jawline travels chin→right ear: normal should push the OTHER way
        this._drawContourStrip(ctx, px, LANDMARKS.JAWLINE_LEFT,  color, alpha, faceW * 0.055, 1);
        this._drawContourStrip(ctx, px, LANDMARKS.JAWLINE_RIGHT, color, alpha, faceW * 0.055, -1);
        this._drawNoseContour(ctx, px, color, alpha, faceW);
        this._drawCheekboneContour(ctx, px, color, alpha, faceW);

        ctx.restore();
    }

    /**
     * Draw a contour strip along a set of landmark indices.
     * @param {number} normalDir — +1 or -1 to control which side of the line the gradient extends to.
     *                             This fixes the asymmetry between left and right jawlines.
     */
    _drawContourStrip(ctx, px, indices, color, alpha, thickness, normalDir = 1) {
        if (indices.length < 2) return;
        ctx.save();
        for (let i = 0; i < indices.length - 1; i++) {
            const curr = px[indices[i]];
            const next = px[indices[i + 1]];
            if (!curr || !next) continue;

            const dx  = next.x - curr.x;
            const dy  = next.y - curr.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            // Normal perpendicular to the segment, direction controlled by normalDir
            const nx  = normalDir * (-dy / len) * thickness;
            const ny  = normalDir * ( dx / len) * thickness;

            const seg = new Path2D();
            seg.moveTo(curr.x, curr.y);
            seg.lineTo(next.x, next.y);
            seg.lineTo(next.x + nx, next.y + ny);
            seg.lineTo(curr.x + nx, curr.y + ny);
            seg.closePath();

            const midX = (curr.x + next.x) / 2;
            const midY = (curr.y + next.y) / 2;
            const grad = ctx.createLinearGradient(midX, midY, midX + nx, midY + ny);
            grad.addColorStop(0,   this._hexToRgba(color, alpha));
            grad.addColorStop(0.4, this._hexToRgba(color, alpha * 0.45));
            grad.addColorStop(1,   this._hexToRgba(color, 0));

            ctx.fillStyle = grad;
            ctx.fill(seg);
        }
        ctx.restore();
    }

    _drawNoseContour(ctx, px, color, alpha, faceW) {
        const noseAlpha = alpha * 0.55;
        const thickness = faceW * 0.028;
        // Nose left side: gradient pushes outward (to the left)
        this._drawContourStrip(ctx, px, LANDMARKS.NOSE_LEFT_SIDE,  color, noseAlpha, thickness, 1);
        // Nose right side: gradient pushes outward (to the right)
        this._drawContourStrip(ctx, px, LANDMARKS.NOSE_RIGHT_SIDE, color, noseAlpha, thickness, -1);
    }

    _drawCheekboneContour(ctx, px, color, alpha, faceW) {
        ctx.save();
        const drawOval = (centerIndices, xOffsetDir) => {
            const center = getCenter(px, centerIndices);
            // Move center down and out for contour under cheekbone
            const cx = center.x + (xOffsetDir * faceW * 0.08);
            const cy = center.y + (faceW * 0.06); 
            const radiusX = faceW * 0.12;
            const radiusY = faceW * 0.06;

            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusX);
            grad.addColorStop(0, this._hexToRgba(color, alpha * 0.8));
            grad.addColorStop(0.5, this._hexToRgba(color, alpha * 0.4));
            grad.addColorStop(1, this._hexToRgba(color, 0));

            ctx.fillStyle = grad;
            ctx.beginPath();
            // angle up towards the ear
            ctx.ellipse(cx, cy, radiusX, radiusY, xOffsetDir * Math.PI / 8, 0, Math.PI * 2);
            ctx.fill();
        };

        drawOval(LANDMARKS.LEFT_CHEEK_CENTER, -1);
        drawOval(LANDMARKS.RIGHT_CHEEK_CENTER, 1);
        ctx.restore();
    }

    // ─── Eyeshadow ────────────────────────────────────────────────────

    _renderEyeshadow(ctx, px) {
        if (!this.enabled.eyeshadow || !this.colors.eyeshadow) return;

        const color = this.colors.eyeshadow;
        const alpha = this.opacity.eyeshadow;
        const faceW = getFaceWidth(px);

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';

        this._drawEyeshadowRegion(ctx, px, LANDMARKS.LEFT_EYE_UPPER,  LANDMARKS.LEFT_EYEBROW,  color, alpha);
        this._drawEyeshadowRegion(ctx, px, LANDMARKS.RIGHT_EYE_UPPER, LANDMARKS.RIGHT_EYEBROW, color, alpha);

        ctx.restore();
    }

    _drawEyeshadowRegion(ctx, px, eyeIndices, browIndices, color, alpha) {
        const path = new Path2D();
        const firstEye = px[eyeIndices[0]];
        if (!firstEye) return;
        path.moveTo(firstEye.x, firstEye.y);
        for (let i = 1; i < eyeIndices.length; i++) {
            if (!px[eyeIndices[i]]) continue;
            path.lineTo(px[eyeIndices[i]].x, px[eyeIndices[i]].y);
        }
        for (let i = browIndices.length - 1; i >= 0; i--) {
            if (!px[browIndices[i]]) continue;
            path.lineTo(px[browIndices[i]].x, px[browIndices[i]].y);
        }
        path.closePath();

        const eyeCenter  = getCenter(px, eyeIndices);
        const browCenter = getCenter(px, browIndices);
        const grad = ctx.createLinearGradient(eyeCenter.x, eyeCenter.y, browCenter.x, browCenter.y);
        grad.addColorStop(0,   this._hexToRgba(color, alpha));
        grad.addColorStop(0.6, this._hexToRgba(color, alpha * 0.38));
        grad.addColorStop(1,   this._hexToRgba(color, 0));

        ctx.globalAlpha = 1;
        ctx.fillStyle   = grad;
        ctx.fill(path);
    }

    // ─── Eyeliner ─────────────────────────────────────────────────────

    _renderEyeliner(ctx, px) {
        if (!this.enabled.eyeliner || !this.colors.eyeliner) return;

        const color     = this.colors.eyeliner;
        const alpha     = this.opacity.eyeliner;
        const faceW     = getFaceWidth(px);
        const lineWidth = Math.max(1.5, faceW * 0.009);

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';

        this._drawEyelinerLine(ctx, px, LANDMARKS.LEFT_EYE_UPPER);
        this._drawEyelinerLine(ctx, px, LANDMARKS.RIGHT_EYE_UPPER);

        ctx.restore();
    }

    _drawEyelinerLine(ctx, px, indices) {
        if (indices.length < 2) return;
        if (!px[indices[0]]) return;
        ctx.beginPath();
        ctx.moveTo(px[indices[0]].x, px[indices[0]].y);
        for (let i = 1; i < indices.length; i++) {
            if (!px[indices[i]] || !px[indices[i - 1]]) continue;
            const prev = px[indices[i - 1]];
            const curr = px[indices[i]];
            const mx   = (prev.x + curr.x) / 2;
            const my   = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        ctx.stroke();
    }

    // ─── Bindi ───────────────────────────────────────────────────────
    //
    // FIXED: Position uses true glabella (landmark 9 = between brows),
    //        not an average that was pulling it off-center.

    _renderBindi(ctx, px) {
        if (!this.enabled.bindi || !this.colors.bindi) return;

        const color  = this.colors.bindi;
        const alpha  = this.opacity.bindi;
        const faceW  = getFaceWidth(px);

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;

        // True glabella: avg of landmark 9 (glabella center) and 151 (forehead midpoint)
        // Bias slightly toward 9 to stay in the brow gap, not the forehead
        const g9  = px[9];
        const g151 = px[151];
        if (!g9 || !g151) { ctx.restore(); return; }
        const bindiX = g9.x * 0.7 + g151.x * 0.3;
        const bindiY = g9.y * 0.7 + g151.y * 0.3;

        // Radius scales with size slider (opacity used as size proxy here)
        const bindiRadius = faceW * 0.020 * (0.6 + alpha * 0.6);

        // Main dot
        const grad = ctx.createRadialGradient(
            bindiX, bindiY, 0,
            bindiX, bindiY, bindiRadius
        );
        grad.addColorStop(0,   this._hexToRgba(color, 1.0));
        grad.addColorStop(0.68, this._hexToRgba(color, 0.92));
        grad.addColorStop(1,   this._hexToRgba(color, 0.25));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bindiX, bindiY, bindiRadius, 0, Math.PI * 2);
        ctx.fill();

        // Gloss highlight
        const hlGrad = ctx.createRadialGradient(
            bindiX - bindiRadius * 0.22, bindiY - bindiRadius * 0.22, 0,
            bindiX, bindiY, bindiRadius * 0.55
        );
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.38)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(bindiX, bindiY, bindiRadius * 0.62, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ─── Main render pipeline ─────────────────────────────────────────

    /**
     * Render a complete frame: video + all active makeup layers.
     * @param {Array} landmarks — Smoothed normalised landmarks from FaceLandmarker
     */
    render(landmarks) {
        const w = this.displayCanvas.width;
        const h = this.displayCanvas.height;
        const displayCtx = this.displayCtx;
        const makeupCtx  = this.makeupCtx;

        // 1. Draw mirrored video frame to display canvas
        displayCtx.save();
        displayCtx.clearRect(0, 0, w, h);
        displayCtx.translate(w, 0);
        displayCtx.scale(-1, 1);
        displayCtx.drawImage(this.video, 0, 0, w, h);
        displayCtx.restore();

        if (!landmarks) return;

        // 2. Convert normalised landmarks → mirrored pixel coords
        //    (mirror x so makeup aligns with the mirrored video)
        const px = landmarks.map(lm => ({
            x: (1 - lm.x) * w,
            y: lm.y * h,
            z: lm.z * w,
        }));

        // 3. Clear makeup canvas
        makeupCtx.clearRect(0, 0, w, h);

        // 4. Draw all makeup layers (always reset state between draws)
        this._renderFoundation(makeupCtx, px);
        this._renderContour(makeupCtx, px);
        this._renderBlush(makeupCtx, px);
        this._renderEyeshadow(makeupCtx, px);
        this._renderEyeliner(makeupCtx, px);
        this._renderLipstick(makeupCtx, px);
        this._renderBindi(makeupCtx, px);

        // 5. Blur the makeup canvas for smooth edges
        this.blurCtx.clearRect(0, 0, w, h);
        this.blurCtx.filter = 'blur(2.5px)';
        this.blurCtx.drawImage(this.makeupCanvas, 0, 0);
        this.blurCtx.filter = 'none';

        // 6. Composite blurred makeup onto display
        displayCtx.globalCompositeOperation = 'source-over';
        displayCtx.globalAlpha = 1;
        displayCtx.drawImage(this.blurCanvas, 0, 0);

        this._frameCount++;
    }

    /** Render only the video frame (no makeup) — used when no face detected. */
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

    /** Capture the current display canvas as an image Blob. */
    async capture() {
        return new Promise(resolve => {
            this.displayCanvas.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    /** Capture as base64 data URL. */
    captureDataUrl() {
        return this.displayCanvas.toDataURL('image/png');
    }

    /**
     * Capture a snapshot of the RAW (un-mirrored) video frame for backend analysis.
     * The backend analyzer works on the natural (un-flipped) image.
     */
    captureVideoFrame() {
        const vw = this.video.videoWidth  || this.displayCanvas.width;
        const vh = this.video.videoHeight || this.displayCanvas.height;
        const tmp    = document.createElement('canvas');
        tmp.width    = vw;
        tmp.height   = vh;
        const tmpCtx = tmp.getContext('2d');
        // Draw un-mirrored so the backend sees natural face orientation
        tmpCtx.drawImage(this.video, 0, 0, vw, vh);
        return tmp.toDataURL('image/jpeg', 0.85);
    }
}
