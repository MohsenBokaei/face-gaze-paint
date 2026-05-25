import { MathUtils } from './MathUtils.js';

export class GazeEngine {
    constructor(sensitivity = 4.0, smoothingFactor = 0.12) {
        this.sensitivity = sensitivity;
        this.vSensitivity = sensitivity * 2.2; 
        this.smoothingFactor = smoothingFactor;
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        this.calibrated = false;
        this.mapping = { coeffsX: null, coeffsY: null, tpsParams: null };
        this.vBias = 0.15; 
    }

    calculateRawGaze(results) {
        // 1. Safety Check: Ensure a face was actually detected
        if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
            return null;
        }

        const landmarks = results.faceLandmarks[0];

        try {
            // 2. Stable Anchors (Standard landmarks 0-467 always exist)
            const noseBridge = landmarks[168]; 
            const eyeL_In = landmarks[133];    
            const eyeR_In = landmarks[362];    
            const noseTip = landmarks[1];

            // 3. Iris Detection with Fallback
            let irisL, irisR;

            // Check if Iris landmarks (468+) are available in the model
            if (landmarks.length > 468 && landmarks[468] && landmarks[473]) {
                irisL = landmarks[468]; // Iris Center Left
                irisR = landmarks[473]; // Iris Center Right
            } else {
                // FALLBACK: Use average of eyelid top/bottom if Iris model isn't active
                // Left Eye: 159 (top), 145 (bottom). Right Eye: 386 (top), 374 (bottom)
                irisL = {
                    x: (landmarks[159].x + landmarks[145].x) / 2,
                    y: (landmarks[159].y + landmarks[145].y) / 2
                };
                irisR = {
                    x: (landmarks[386].x + landmarks[374].x) / 2,
                    y: (landmarks[386].y + landmarks[374].y) / 2
                };
            }

            // 4. Horizontal (X) Calculation
            const eyeWidth = Math.abs(landmarks[33].x - landmarks[133].x);
            const oX = ((irisL.x - eyeL_In.x) + (irisR.x - eyeR_In.x)) / 2;

            // 5. Vertical (Y) Calculation (Anchor-based)
            const faceScale = Math.abs(noseTip.y - noseBridge.y) || 0.1;
            const distL = irisL.y - noseBridge.y;
            const distR = irisR.y - noseBridge.y;
            const avgDist = (distL + distR) / 2;

            const neutralY = 0.045; 
            const oY = (avgDist / faceScale) - neutralY;

            return {
                x: 0.5 - (oX / eyeWidth * this.sensitivity),
                y: 0.5 + (oY * this.vSensitivity) + this.vBias
            };
        } catch (e) {
            console.warn("Gaze Calculation Error:", e);
            return null;
        }
    }

    getGazePoint(results) {
        const raw = this.calculateRawGaze(results);
        
        // If no face found, stay at last known position
        if (!raw) return { x: this.smoothedX, y: this.smoothedY };

        // Smoothing
        this.smoothedX += (raw.x - this.smoothedX) * this.smoothingFactor;
        this.smoothedY += (raw.y - this.smoothedY) * this.smoothingFactor;

        let finalX = this.smoothedX;
        let finalY = this.smoothedY;

        // Apply TPS/Polynomial mapping if calibrated
        if (this.calibrated) {
            if (this.mapping.tpsParams) {
                const mapped = MathUtils.applyTPSMapping(this.smoothedX, this.smoothedY, this.mapping.tpsParams);
                if (mapped && isFinite(mapped.x)) {
                    finalX = mapped.x;
                    finalY = mapped.y;
                }
            } else if (this.mapping.coeffsX) {
                const mapped = MathUtils.applyPolynomialMapping(this.smoothedX, this.smoothedY, this.mapping.coeffsX, this.mapping.coeffsY);
                if (mapped && isFinite(mapped.x)) {
                    finalX = mapped.x;
                    finalY = mapped.y;
                }
            }
        }

        return {
            x: Math.max(0, Math.min(1, finalX)),
            y: Math.max(0, Math.min(1, finalY))
        };
    }

    setCalibrationData(data) {
        if (!data) return;
        this.mapping.coeffsX = data.coeffsX;
        this.mapping.coeffsY = data.coeffsY;
        this.mapping.tpsParams = data.tpsParams;
        this.calibrated = true;
    }
}
