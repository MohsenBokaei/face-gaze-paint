import { MathUtils } from './MathUtils.js';

export class GazeEngine {
    constructor(sensitivity = 3.5, smoothingFactor = 0.15) { // Lower smoothing = more responsive
        this.sensitivity = sensitivity;
        this.vSensitivity = sensitivity * 1.5; // Up/Down needs more boost than Left/Right
        this.smoothingFactor = smoothingFactor;
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        this.calibrated = false;
        this.mapping = { coeffsX: null, coeffsY: null, tpsParams: null };
    }

    calculateRawGaze(results) {
        if (!results?.faceLandmarks?.[0]) return null;
        const landmarks = results.faceLandmarks[0];

        try {
            // 1. Get Iris Centers
            const irisL = this.getCenter(landmarks, [474, 475, 476, 477]);
            const irisR = this.getCenter(landmarks, [469, 470, 471, 472]);

            // 2. Get Eye Corners (Stable Anchors)
            const eyeL_In = landmarks[133], eyeL_Out = landmarks[33];
            const eyeR_In = landmarks[362], eyeR_Out = landmarks[263];

            // 3. Get Eyelid Landmarks (To track vertical aperture)
            const eyeL_Top = landmarks[159], eyeL_Bot = landmarks[145];
            const eyeR_Top = landmarks[386], eyeR_Bot = landmarks[374];

            // 4. Calculate Horizontal Center (unchanged)
            const lEcX = (eyeL_In.x + eyeL_Out.x) / 2;
            const rEcX = (eyeR_In.x + eyeR_Out.x) / 2;
            const lW = Math.abs(eyeL_Out.x - eyeL_In.x);
            const rW = Math.abs(eyeR_Out.x - eyeR_In.x);

            // 5. IMPROVED VERTICAL CALCULATION
            // Instead of using eye width for Y, we use a fixed head landmark (like the bridge of the nose) 
            // to see where the iris is relative to the eye socket.
            const lEcY = (eyeL_Top.y + eyeL_Bot.y) / 2;
            const rEcY = (eyeR_Top.y + eyeR_Bot.y) / 2;
            
            // Aperture (How open is the eye?) - Helps correct "Look Down" errors
            const lH = Math.abs(eyeL_Bot.y - eyeL_Top.y);
            const rH = Math.abs(eyeR_Bot.y - eyeR_Top.y);
            const avgH = (lH + rH) / 2;

            const oX = (((irisL.x - lEcX) / lW) + ((irisR.x - rEcX) / rW)) / 2;
            
            // Vertical offset is scaled by eye height to compensate for squinting while looking down
            const oY = (((irisL.y - lEcY) / avgH) + ((irisR.y - rEcY) / avgH)) / 2;

            // 6. HEAD PITCH COMPENSATION
            // Most people tilt their head slightly when looking up/down.
            // We use the nose (1) and the chin (152) to find the head pitch.
            const nose = landmarks[1], chin = landmarks[152];
            const headPitch = (nose.y - landmarks[4].y); // Distance nose-tip to nose-bridge

            // Final coordinates: 
            // We flip X because the webcam is mirrored.
            // We subtract a small bias (0.1) from Y because looking "center" is usually lower than 0.5
            return {
                x: 0.5 - (oX * this.sensitivity),
                y: 0.5 + (oY * this.vSensitivity) + (headPitch * 2) 
            };
        } catch (e) { return null; }
    }

    getGazePoint(results) {
        const raw = this.calculateRawGaze(results);
        if (!raw) return { x: this.smoothedX, y: this.smoothedY };

        // Exponential Smoothing
        this.smoothedX += (raw.x - this.smoothedX) * this.smoothingFactor;
        this.smoothedY += (raw.y - this.smoothedY) * this.smoothingFactor;

        let finalX = this.smoothedX;
        let finalY = this.smoothedY;

        if (this.calibrated && this.mapping.coeffsX) {
            const mapped = MathUtils.applyPolynomialMapping(this.smoothedX, this.smoothedY, this.mapping.coeffsX, this.mapping.coeffsY);
            if (mapped && isFinite(mapped.x)) {
                finalX = mapped.x;
                finalY = mapped.y;
            }
        }

        // Add a "Deadzone" clamp at the very edges
        return {
            x: Math.max(-0.1, Math.min(1.1, finalX)),
            y: Math.max(-0.1, Math.min(1.1, finalY))
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
