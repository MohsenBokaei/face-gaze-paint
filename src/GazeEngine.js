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

    calculateRawGaze(results) {
        if (!results?.faceLandmarks?.[0]) return null;
        const landmarks = results.faceLandmarks[0];

        try {
            // 1. ANCHORS (These points do not move with the eyes)
            const noseBridge = landmarks[168]; // Stable point between eyes
            const eyeL_In = landmarks[133];    // Inner corner Left
            const eyeR_In = landmarks[362];    // Inner corner Right
            
            // 2. IRIS CENTERS
            const irisL = this.getCenter(landmarks, [468]); // 468 is Iris Center
            const irisR = this.getCenter(landmarks, [473]); // 473 is Iris Center

            // 3. HORIZONTAL (X) - Still relative to eye width
            const eyeWidth = Math.abs(landmarks[33].x - landmarks[133].x);
            const oX = ((irisL.x - eyeL_In.x) + (irisR.x - eyeR_In.x)) / 2;

            // 4. VERTICAL (Y) - THE FIX
            // We measure how far the iris is from the STABLE nose bridge.
            // We normalize this by the distance from the nose bridge to the nose tip (stable face scale).
            const faceScale = Math.abs(landmarks[1].y - landmarks[168].y);
            
            // Calculate distance from bridge to iris
            // If this value increases, you are looking down.
            const distL = irisL.y - noseBridge.y;
            const distR = irisR.y - noseBridge.y;
            const avgDist = (distL + distR) / 2;

            // Normalize Y: 
            // We subtract a "neutral" offset (usually around 0.04 face units) 
            const neutralY = 0.045; 
            const oY = (avgDist / faceScale) - neutralY;

            // 5. HEAD PITCH (Secondary vertical signal)
            // If you tilt your chin down, this value changes.
            const headPitch = (landmarks[1].y - landmarks[168].y); 

            return {
                x: 0.5 - (oX / eyeWidth * this.sensitivity),
                y: 0.5 + (oY * this.vSensitivity) + this.vBias
            };
        } catch (e) { return null; }
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
