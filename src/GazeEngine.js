import { MathUtils } from './MathUtils.js';

export class GazeEngine {
    constructor(sensitivity = 3.0, smoothingFactor = 0.3) {
        this.sensitivity = sensitivity;
        this.smoothingFactor = smoothingFactor;
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        this.calibrated = false;
        this.mapping = { coeffsX: null, coeffsY: null, tpsParams: null };
    }

    getGazePoint(results) {
        const raw = this.calculateRawGaze(results);
        if (!raw) return { x: this.smoothedX, y: this.smoothedY };

        this.smoothedX += (raw.x - this.smoothedX) * this.smoothingFactor;
        this.smoothedY += (raw.y - this.smoothedY) * this.smoothingFactor;

        let finalX = this.smoothedX;
        let finalY = this.smoothedY;

        if (this.calibrated) {
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

    calculateRawGaze(results) {
        if (!results?.faceLandmarks?.[0]) return null;
        const landmarks = results.faceLandmarks[0];

        try {
            // Original Proto Indices
            const irisL = this.getCenter(landmarks, [474, 475, 476, 477]);
            const irisR = this.getCenter(landmarks, [469, 470, 471, 472]);
            const eyeL_In = landmarks[133], eyeL_Out = landmarks[33];
            const eyeR_In = landmarks[362], eyeR_Out = landmarks[263];

            if (!eyeL_In || !eyeR_In) return null;

            const lEc = { x: (eyeL_In.x + eyeL_Out.x) / 2, y: (eyeL_In.y + eyeL_Out.y) / 2 };
            const rEc = { x: (eyeR_In.x + eyeR_Out.x) / 2, y: (eyeR_In.y + eyeR_Out.y) / 2 };

            const lW = Math.abs(eyeL_Out.x - eyeL_In.x);
            const rW = Math.abs(eyeR_Out.x - eyeR_In.x);

            const oX = (((irisL.x - lEc.x) / lW) + ((irisR.x - rEc.x) / rW)) / 2;
            const oY = (((irisL.y - lEc.y) / lW) + ((irisR.y - rEc.y) / rW)) / 2;

            return {
                x: 0.5 - oX * this.sensitivity,
                y: 0.5 + oY * this.sensitivity
            };
        } catch (e) { return null; }
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
