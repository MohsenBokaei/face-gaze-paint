import { MathUtils } from './MathUtils.js';

export class GazeEngine {
    constructor(sensitivity = 4.0, smoothingFactor = 0.12) {
        this.sensitivity = sensitivity;
        this.vSensitivity = sensitivity * 2.2; // Significant boost for vertical
        this.smoothingFactor = smoothingFactor;
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        this.calibrated = false;
        this.mapping = { coeffsX: null, coeffsY: null };
        
        // Vertical Bias: Adjust this if the gaze is naturally too high or low
        // Most webcams sit above the screen, so we need a default downward shift
        this.vBias = 0.15; 
    }

        // Inside GazeEngine.js -> calculateRawGaze
    calculateRawGaze(results) {
        const landmarks = results.faceLandmarks[0];
        const iris = landmarks[468]; // Iris Center 3D
        const eyeCenter = landmarks[168]; // Stable Nose Bridge
    
        // The 'Depth' of the eye (approximate scale based on face size)
        const faceDepthScale = Math.abs(landmarks[1].z - landmarks[168].z) || 0.1;
        const eyeRadius = faceDepthScale * 0.5; // Estimated 3D radius of eyeball
    
        // Project the iris onto a 3D sphere
        // This replicates the 'Line of Sight' vector from the papers
        const dx = (iris.x - landmarks[133].x) / (landmarks[33].x - landmarks[133].x) - 0.5;
        
        // VERTICAL FIX: Use the Nose Bridge (168) as a fixed Y-anchor
        // We calculate the 'arc' of the eye rotation
        const dy = (iris.y - eyeCenter.y); 
        
        // Instead of linear Y, we use a Tangent-like boost 
        // to simulate the iris moving around the curve of the eyeball
        const verticalRotation = Math.atan2(dy, eyeRadius);
    
        return {
            x: 0.5 - (dx * this.sensitivity),
            // Use the rotation angle for Y instead of raw coordinate distance
            y: 0.5 + (verticalRotation * this.vSensitivity) + this.vBias
        };
    }

        // Inside GazeEngine.js
    setCalibrationData(data) {
        this.mapping.coeffsX = data.coeffsX;
        this.mapping.coeffsY = data.coeffsY;
        
        // Calculate the 'Kappa Offset' (The vertical error at center screen)
        // If the center point (0.5, 0.5) is consistently off, we shift the whole world.
        const centerError = data.centerRawY - 0.5;
        this.vBias -= centerError * 0.5; 
        
        this.calibrated = true;
    }

    getGazePoint(results) {
        const raw = this.calculateRawGaze(results);
        if (!raw) return { x: this.smoothedX, y: this.smoothedY };

        // Smoothing
        this.smoothedX += (raw.x - this.smoothedX) * this.smoothingFactor;
        this.smoothedY += (raw.y - this.smoothedY) * this.smoothingFactor;

        let finalX = this.smoothedX;
        let finalY = this.smoothedY;

        // Use calibration if available
        if (this.calibrated && this.mapping.coeffsX) {
            const mapped = MathUtils.applyPolynomialMapping(this.smoothedX, this.smoothedY, this.mapping.coeffsX, this.mapping.coeffsY);
            if (mapped && isFinite(mapped.x)) {
                finalX = mapped.x;
                finalY = mapped.y;
            }
        }

        return {
            x: Math.max(0, Math.min(1, finalX)),
            y: Math.max(0, Math.min(1, finalY))
        };
    }

    getCenter(lms, idx) {
        let x = 0, y = 0;
        idx.forEach(i => { x += lms[i].x; y += lms[i].y; });
        return { x: x / idx.length, y: y / idx.length };
    }

    setCalibrationData(data) {
        this.mapping.coeffsX = data.coeffsX;
        this.mapping.coeffsY = data.coeffsY;
        this.calibrated = true;
    }
}
