/**
 * app.js — Main Application Orchestrator
 * ========================================
 * Initializes webcam, face tracker, makeup renderer, and UI.
 * Runs the main render loop at target 30-60 FPS.
 */

import { FaceTracker } from './faceTracker.js';
import { MakeupRenderer } from './makeupRenderer.js';
import { UIController } from './ui.js';

class GlamourApp {
    constructor() {
        this.faceTracker = new FaceTracker();
        this.renderer = null;
        this.ui = null;
        this.video = null;
        this.canvas = null;
        this.stream = null;
        this.isRunning = false;
        this.animFrameId = null;

        // FPS tracking
        this.fpsFrames = 0;
        this.fpsLastTime = performance.now();
        this.currentFPS = 0;
    }

    /**
     * Boot the application.
     */
    async init() {
        this._showLoading('Initializing camera...');

        try {
            // 1. Get DOM elements
            this.video = document.getElementById('webcam-video');
            this.canvas = document.getElementById('display-canvas');

            if (!this.video || !this.canvas) {
                throw new Error('Required DOM elements not found (webcam-video, display-canvas)');
            }

            // 2. Start webcam
            await this._startCamera();

            // 3. Initialize face tracker
            this._showLoading('Loading AI face model...');
            await this.faceTracker.init((msg) => this._showLoading(msg));

            // 4. Set canvas dimensions to match video
            const vw = this.video.videoWidth;
            const vh = this.video.videoHeight;
            this.canvas.width = vw;
            this.canvas.height = vh;

            // 5. Initialize renderer
            this.renderer = new MakeupRenderer(this.canvas, this.video);
            this.renderer.resize(vw, vh);

            // 6. Initialize UI
            this.ui = new UIController(this.renderer);
            this.ui.init();

            // 7. Hide loading, start render loop
            this._hideLoading();
            this._showStatus('Face tracking active');
            this.isRunning = true;
            this._renderLoop();

        } catch (err) {
            console.error('App init failed:', err);
            this._showError(err.message);
        }
    }

    /**
     * Start the webcam stream.
     */
    async _startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            this.video.srcObject = this.stream;

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(resolve).catch(reject);
                };
                this.video.onerror = reject;
                setTimeout(() => reject(new Error('Camera timeout')), 10000);
            });

        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw new Error('Camera access denied. Please allow camera permission and reload.');
            } else if (err.name === 'NotFoundError') {
                throw new Error('No camera found. Please connect a webcam.');
            }
            throw new Error(`Camera error: ${err.message}`);
        }
    }

    /**
     * Main render loop — runs at display refresh rate.
     */
    _renderLoop() {
        if (!this.isRunning) return;

        // Face detection + makeup rendering
        const landmarks = this.faceTracker.detect(this.video);

        if (landmarks) {
            this.renderer.render(landmarks);
            this._updateFaceStatus(true);
        } else {
            this.renderer.renderVideoOnly();
            this._updateFaceStatus(false);
        }

        // FPS counter
        this._updateFPS();

        // Schedule next frame
        this.animFrameId = requestAnimationFrame(() => this._renderLoop());
    }

    /**
     * Update FPS display.
     */
    _updateFPS() {
        this.fpsFrames++;
        const now = performance.now();
        const elapsed = now - this.fpsLastTime;

        if (elapsed >= 1000) {
            this.currentFPS = Math.round((this.fpsFrames * 1000) / elapsed);
            this.fpsFrames = 0;
            this.fpsLastTime = now;

            const fpsEl = document.getElementById('fps-counter');
            if (fpsEl) fpsEl.textContent = `${this.currentFPS} FPS`;
        }
    }

    /**
     * Update face detection status indicator.
     */
    _updateFaceStatus(detected) {
        const statusEl = document.getElementById('face-status');
        if (statusEl) {
            if (detected) {
                statusEl.textContent = '😊 Face detected';
                statusEl.className = 'face-status detected';
            } else {
                statusEl.textContent = '👤 No face detected';
                statusEl.className = 'face-status not-detected';
            }
        }
    }

    // -------------------------------------------------------------------
    // Loading / Error UI
    // -------------------------------------------------------------------

    _showLoading(message) {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p class="loading-text"></p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.querySelector('.loading-text').textContent = message;
        overlay.classList.add('visible');
    }

    _hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 500);
        }
    }

    _showStatus(message) {
        const statusEl = document.getElementById('app-status');
        if (statusEl) statusEl.textContent = message;
    }

    _showError(message) {
        this._hideLoading();
        let errorEl = document.getElementById('error-overlay');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'error-overlay';
            errorEl.innerHTML = `
                <div class="error-content">
                    <div class="error-icon">⚠️</div>
                    <h2>Something went wrong</h2>
                    <p class="error-message"></p>
                    <button onclick="location.reload()" class="error-retry-btn">Retry</button>
                </div>
            `;
            document.body.appendChild(errorEl);
        }
        errorEl.querySelector('.error-message').textContent = message;
        errorEl.classList.add('visible');
    }

    /**
     * Stop everything and clean up.
     */
    destroy() {
        this.isRunning = false;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
        }
        this.faceTracker.destroy();
    }
}

// -----------------------------------------------------------------------
// Auto-initialize when DOM is ready
// -----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Only auto-init on the camera page
    if (document.getElementById('display-canvas')) {
        const app = new GlamourApp();
        app.init();

        // Expose for debugging
        window.__glamourApp = app;
    }
});
