/**
 * faceTracker.js — MediaPipe FaceLandmarker Wrapper
 * ===================================================
 * Initializes and runs the modern MediaPipe Face Landmarker
 * from @mediapipe/tasks-vision for real-time 478-point face mesh
 * tracking via webcam.
 */

import { LandmarkSmoother } from './smoothing.js';

const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class FaceTracker {
    constructor() {
        this.faceLandmarker = null;
        this.smoother = new LandmarkSmoother(0.6, 478);
        this.isReady = false;
        this.lastTimestamp = -1;
        this._vision = null;
    }

    /**
     * Initialize the FaceLandmarker model.
     * Must be called before detect().
     *
     * @param {Function} onProgress — Optional callback(message) for loading progress.
     */
    async init(onProgress) {
        try {
            if (onProgress) onProgress('Loading vision module...');

            // Dynamically import the MediaPipe tasks-vision module
            const vision = await import(VISION_CDN);
            this._vision = vision;

            if (onProgress) onProgress('Initializing WASM runtime...');

            const filesetResolver = await vision.FilesetResolver.forVisionTasks(
                `${VISION_CDN}/wasm`
            );

            if (onProgress) onProgress('Loading face landmarker model...');

            this.faceLandmarker = await vision.FaceLandmarker.createFromOptions(
                filesetResolver,
                {
                    baseOptions: {
                        modelAssetPath: MODEL_URL,
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    outputFaceBlendshapes: false,
                    outputFacialTransformationMatrixes: false,
                    numFaces: 1,
                }
            );

            this.isReady = true;
            if (onProgress) onProgress('Face tracker ready!');

        } catch (err) {
            console.error('FaceTracker init failed:', err);
            throw err;
        }
    }

    /**
     * Detect face landmarks from a video frame.
     *
     * @param {HTMLVideoElement} video — The video element to analyze.
     * @returns {Array|null} — Smoothed landmarks array [{x, y, z}, ...] or null if no face.
     */
    detect(video) {
        if (!this.isReady || !this.faceLandmarker) return null;

        const timestamp = performance.now();
        // Avoid processing same frame twice
        if (timestamp <= this.lastTimestamp) return null;
        this.lastTimestamp = timestamp;

        try {
            const results = this.faceLandmarker.detectForVideo(video, timestamp);

            if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                const rawLandmarks = results.faceLandmarks[0];
                return this.smoother.smooth(rawLandmarks);
            } else {
                // No face detected — reset smoother to avoid stale data
                this.smoother.reset();
                return null;
            }
        } catch (err) {
            console.warn('Face detection error:', err);
            return null;
        }
    }

    /**
     * Adjust smoothing intensity.
     *
     * @param {number} alpha — 0 (max smooth) to 1 (no smooth)
     */
    setSmoothingAlpha(alpha) {
        this.smoother.setAlpha(alpha);
    }

    /**
     * Clean up resources.
     */
    destroy() {
        if (this.faceLandmarker) {
            this.faceLandmarker.close();
            this.faceLandmarker = null;
        }
        this.isReady = false;
    }
}
