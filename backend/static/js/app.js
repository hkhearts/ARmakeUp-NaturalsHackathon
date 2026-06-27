/**
 * app.js — Main Application Orchestrator
 * ========================================
 * Initializes webcam, face tracker, makeup renderer, UI, and AI character.
 * Runs the main render loop at target 30-60 FPS.
 */

import { FaceTracker } from './faceTracker.js';
import { MakeupRenderer } from './makeupRenderer.js';
import { UIController } from './ui.js';
import { AICharacter } from './aiCharacter.js';

class GlamourApp {
    constructor() {
        this.faceTracker = new FaceTracker();
        this.renderer = null;
        this.ui = null;
        this.aiCharacter = null;
        this.video = null;
        this.canvas = null;
        this.stream = null;
        this.isRunning = false;
        this.animFrameId = null;

        // FPS tracking
        this.fpsFrames = 0;
        this.fpsLastTime = performance.now();
        this.currentFPS = 0;

        // Setup CSRF token for Django API calls
        this._setupCSRF();
    }

    _setupCSRF() {
        // Get CSRF token from cookie (set by Django)
        const getCookie = (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return '';
        };
        // Patch global fetch to include CSRF token on same-origin POST requests
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            if (options.method && options.method.toUpperCase() === 'POST') {
                const csrfToken = getCookie('csrftoken');
                if (csrfToken) {
                    options.headers = options.headers || {};
                    if (options.headers instanceof Headers) {
                        options.headers.set('X-CSRFToken', csrfToken);
                    } else {
                        options.headers['X-CSRFToken'] = csrfToken;
                    }
                }
            }
            return originalFetch.call(this, url, options);
        };
    }

    async init() {
        this._showLoading('Initializing camera...');

        try {
            this.video = document.getElementById('webcam-video');
            this.canvas = document.getElementById('display-canvas');

            if (!this.video || !this.canvas) {
                throw new Error('Required DOM elements not found');
            }

            // 1. Start webcam
            await this._startCamera();

            // 2. Initialize face tracker
            this._showLoading('Loading AI face model...');
            await this.faceTracker.init((msg) => this._showLoading(msg));

            // 3. Set canvas dimensions
            const vw = this.video.videoWidth;
            const vh = this.video.videoHeight;
            this.canvas.width = vw;
            this.canvas.height = vh;

            // 4. Initialize renderer
            this.renderer = new MakeupRenderer(this.canvas, this.video);
            this.renderer.resize(vw, vh);

            // 5. Initialize AI Character (NON-BLOCKING - failures don't stop the app)
            this._initAICharacter();

            // 6. Initialize UI (pass both renderer and AI character ref)
            this.ui = new UIController(this.renderer, this);
            this.ui.init();

            // 7. Start render loop
            this._hideLoading();
            this.isRunning = true;
            this._renderLoop();

            console.log('App initialized successfully');

        } catch (err) {
            console.error('App init failed:', err);
            this._showError(err.message);
        }
    }

    _initAICharacter() {
        const characterCanvas = document.getElementById('character-canvas');
        const modelUrl = window.CHARACTER_MODEL_URL || '/static/character/scene.gltf';

        if (!characterCanvas) {
            console.warn('Character canvas not found, skipping AI character');
            return;
        }

        try {
            this.aiCharacter = new AICharacter(characterCanvas, modelUrl);
            this.aiCharacter.init().then(success => {
                if (success) {
                    console.log('AI Character loaded successfully');
                } else {
                    console.warn('AI Character init returned false');
                }
            }).catch(err => {
                console.warn('AI Character loading failed:', err.message);
                // AI character is still usable (CSS avatar + speech) even if GLTF fails
            });
        } catch (err) {
            console.warn('AI Character creation failed:', err.message);
            this.aiCharacter = null;
        }
    }

    async _startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });

            this.video.srcObject = this.stream;

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

    _renderLoop() {
        if (!this.isRunning) return;

        // Only process if video is ready and playing
        if (this.video && this.video.readyState >= 2) {
            const landmarks = this.faceTracker.detect(this.video);

            if (landmarks) {
                this.renderer.render(landmarks);
                this._updateFaceStatus(true);
            } else {
                this.renderer.renderVideoOnly();
                this._updateFaceStatus(false);
            }

            this._updateFPS();
        }

        this.animFrameId = requestAnimationFrame(() => this._renderLoop());
    }

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

    _updateFaceStatus(detected) {
        const statusEl = document.getElementById('face-status');
        if (statusEl) {
            if (detected) {
                statusEl.textContent = 'Face detected';
                statusEl.className = 'face-status detected';
            } else {
                statusEl.textContent = 'No face detected';
                statusEl.className = 'face-status not-detected';
            }
        }
    }

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

    _showError(message) {
        this._hideLoading();
        let errorEl = document.getElementById('error-overlay');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'error-overlay';
            errorEl.innerHTML = `
                <div class="error-content">
                    <div class="error-icon">!</div>
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

    destroy() {
        this.isRunning = false;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        this.faceTracker.destroy();
        if (this.aiCharacter) this.aiCharacter.destroy();
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('display-canvas')) {
        const app = new GlamourApp();
        app.init();
        window.__glamourApp = app;
    }
});
