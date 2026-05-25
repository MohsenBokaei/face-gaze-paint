import { MathUtils } from './MathUtils.js';

/**
 * GazeEngine: The brain of the app. 
 * Responsible for landmark extraction, raw gaze geometry, 
 * temporal smoothing, and applying calibration maps.
 */
export class GazeEngine {
    constructor(sensitivity = 3.0, smoothingFactor = 0.3) {
        // Matched to original settings (lines 142-144)
        this.sensitivity = sensitivity;
        this.smoothingFactor = smoothingFactor;

        // Internal State
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        this.calibrated = false;
        this.mapping = {
            type: 'polynomial', // Default to polynomial
            coeffsX: null,
            coeffsY: null,
            tpsParams: null
        };

        // MediaPipe Face Mesh Indices (Matched to original lines 686-689)
        this.indices = {
            leftIris: [474, 475, 476, 477],
            rightIris: [469, 470, 471, 472],
            leftEyeInner: 133,
            leftEyeOuter: 33,
            rightEyeInner: 362,
            rightEyeOuter: 263
        };
    }

    /**
     * Processes results and returns a normalized {x, y} coordinate.
     * Logic matched to original predictWebcam loop (lines 763-782).
     */
    getGazePoint(results) {
        const raw = this.calculateRawGaze(results);
        
        // If we lose the face, return the last known smoothed position
        if (!raw) return { x: this.smoothedX, y: this.smoothedY };

        // 1. Temporal Smoothing (Exponential Moving Average)
        this.smoothedX += (raw.x - this.smoothedX) * this.smoothingFactor;
        this.smoothedY += (raw.y - this.smoothedY) * this.smoothingFactor;

        let finalX = this.smoothedX;
        let finalY = this.smoothedY;

        // 2. Apply Calibration (Matched to lines 771-778)
        if (this.calibrated) {
            let mapped = null;
            
            if (this.mapping.type === 'polynomial' && this.mapping.coeffsX) {
                mapped = MathUtils.applyPolynomialMapping(
                    this.smoothedX, 
                    this.smoothedY, 
                    this.mapping.coeffsX, 
                    this.mapping.coeffsY
                );
            } else if (this.mapping.type === 'tps' && this.mapping.tpsParams) {
                mapped = MathUtils.applyTPSMapping(
                    this.smoothedX, 
                    this.smoothedY, 
                    this.mapping.tpsParams
                );
            }

            if (mapped && isFinite(mapped.x) && isFinite(mapped.y)) {
                finalX = mapped.x;
                finalY = mapped.y;
            }
        }

        // 3. Final screen clamping (0.0 to 1.0)
        return {
            x: Math.max(0, Math.min(1, finalX)),
            y: Math.max(0, Math.min(1, finalY))
        };
    }

    /**
     * Geometric calculation of gaze based on iris center vs eye corners.
     * Logic matched to original calculateRawGaze (lines 683-711).
     */
    calculateRawGaze(results) {
        if (!results?.faceLandmarks?.[0]) return null;
        const landmarks = results.faceLandmarks[0];

        try {
            // Get center of irises
            const lI = this.calculateCenter(landmarks, this.indices.leftIris);
            const rI = this.calculateCenter(landmarks, this.indices.rightIris);

            // Get eye corners
            const lEi = landmarks[this.indices.leftEyeInner];
            const lEo = landmarks[this.indices.leftEyeOuter];
            const rEi = landmarks[this.indices.rightEyeInner];
            const rEo = landmarks[this.indices.rightEyeOuter];

            // Calculate eye geometric centers (matched to lines 694-695)
            const lEc = { x: (lEi.x + lEo.x) / 2, y: (lEi.y + lEo.y) / 2 };
            const rEc = { x: (rEi.x + rEo.x) / 2, y: (rEi.y + rEo.y) / 2 };

            // Calculate eye widths for normalization
            const lW = Math.abs(lEo.x - lEi.x);
            const rW = Math.abs(rEo.x - rEi.x);
            if (lW < 0.005 || rW < 0.005) return null;

            // Normalized offsets (matched to lines 698-701)
            const oX = (((lI.x - lEc.x) / lW) + ((rI.x - rEc.x) / rW)) / 2;
            const oY = (((lI.y - lEc.y) / lW) + ((rI.y - rEc.y) / rW)) / 2;

            // Apply sensitivity (matched to lines 704-706)
            let rawX = 0.5 - oX * this.sensitivity;
            let rawY = 0.5 + oY * this.sensitivity;

            // Wide-range clamping for calibration stability
            rawX = Math.max(-1.0, Math.min(2.0, rawX));
            rawY = Math.max(-1.0, Math.min(2.0, rawY));

            return { x: rawX, y: rawY };
        } catch (e) {
            console.error("GazeEngine: Geometry Error", e);
            return null;
        }
    }

    /**
     * Matched to original calculateCenter (lines 173-186)
     */
    calculateCenter(landmarks, indices) {
        let sumX = 0, sumY = 0, valid = 0;
        indices.forEach(idx => {
            if (landmarks[idx] && isFinite(landmarks[idx].x)) {
                sumX += landmarks[idx].x;
                sumY += landmarks[idx].y;
                valid++;
            }
        });
        return valid > 0 ? { x: sumX / valid, y: sumY / valid } : { x: 0.5, y: 0.5 };
    }

    /**
     * Updates the calibration profile. 
     * Called by the Orchestrator after CalibrationManager finishes.
     */
    setCalibrationData(data) {
        if (!data) return;
        this.mapping.coeffsX = data.coeffsX;
        this.mapping.coeffsY = data.coeffsY;
        this.mapping.tpsParams = data.tpsParams;
        this.calibrated = true;
    }

    /**
     * Allows toggling between Polynomial and TPS math.
     */
    setMappingType(type) {
        if (type === 'polynomial' || type === 'tps') {
            this.mapping.type = type;
        }
    }
}