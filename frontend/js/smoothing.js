/**
 * smoothing.js — Exponential Moving Average (EMA) Landmark Smoother
 * ==================================================================
 * Reduces jitter in MediaPipe face landmarks by applying temporal
 * smoothing across frames. Each landmark's x, y, z coordinates are
 * smoothed independently.
 *
 * Alpha (smoothing factor):
 *   - 1.0 = no smoothing (raw values)
 *   - 0.0 = infinite smoothing (frozen)
 *   - 0.5-0.7 = good balance for face tracking
 */

export class LandmarkSmoother {
    /**
     * @param {number} alpha — Smoothing factor (0-1). Lower = smoother but more lag.
     * @param {number} numLandmarks — Number of landmarks to track (478 for FaceLandmarker).
     */
    constructor(alpha = 0.6, numLandmarks = 478) {
        this.alpha = alpha;
        this.numLandmarks = numLandmarks;
        this.prevLandmarks = null;
    }

    /**
     * Apply EMA smoothing to a new set of landmarks.
     *
     * @param {Array} landmarks — Current frame's landmarks [{x, y, z}, ...]
     * @returns {Array} Smoothed landmarks
     */
    smooth(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            return landmarks;
        }

        if (this.prevLandmarks === null) {
            // First frame — no previous data, use raw values
            this.prevLandmarks = landmarks.map(lm => ({
                x: lm.x,
                y: lm.y,
                z: lm.z,
            }));
            return this.prevLandmarks;
        }

        const smoothed = [];
        for (let i = 0; i < landmarks.length; i++) {
            const curr = landmarks[i];
            const prev = this.prevLandmarks[i] || curr;

            smoothed.push({
                x: this.alpha * curr.x + (1 - this.alpha) * prev.x,
                y: this.alpha * curr.y + (1 - this.alpha) * prev.y,
                z: this.alpha * curr.z + (1 - this.alpha) * prev.z,
            });
        }

        this.prevLandmarks = smoothed;
        return smoothed;
    }

    /**
     * Reset the smoother (e.g., when face is lost and re-detected).
     */
    reset() {
        this.prevLandmarks = null;
    }

    /**
     * Update the smoothing factor dynamically.
     *
     * @param {number} alpha
     */
    setAlpha(alpha) {
        this.alpha = Math.max(0, Math.min(1, alpha));
    }
}
