import { MathUtils } from './MathUtils.js';

export class GazeEngine {
    constructor(sensitivity = 3.0, smoothingFactor = 0.25) {
        this.sensitivity = sensitivity;
        this.smoothingFactor = smoothingFactor;
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        this.calibrated = false;
        this.mapping = { type: 'polynomial', coeffsX: null, coeffsY: null, tpsParams: null };

        // Specific landmarks for Gaze Ratio logic
        this.indices = {
            leftIris: 468,
            rightIris: 473,
            leftEye: { left: 33, right: 133, top: 159, bottom: 145 },
            rightEye: { left: 362, right: 263, top: 386, bottom: 374 }
        };
    }

    /**
     * Ported logic from Antoine Lame's GazeTracking
     * Calculates the position of the pupil relative to the eye corners
     */
    calculateGazeRatio(iris, eyeCorners) {
        // Horizontal distance from left corner to iris
        const dx = iris.x - eyeCorners.left.x;
        const totalW = eyeCorners.right.x - eyeCorners.left.x;
        const hRatio = dx / totalW;

        // Vertical distance from top to iris
        const dy = iris.y - eyeCorners.top.y;
        const totalH = eyeCorners.bottom.y - eyeCorners.top.y;
        const vRatio = dy / totalH;

        return { x: hRatio, y: vRatio };
    }

    getGazePoint(results) {
        if (!results?.faceLandmarks?.[0]) return { x: this.smoothedX, y: this.smoothedY };
        const lms = results.faceLandmarks[0];

        try {
            // Get eye data
            const leftRatio = this.calculateGazeRatio(lms[this.indices.leftIris], {
                left: lms[this.indices.leftEye.left],
                right: lms[this.indices.leftEye.right],
                top: lms[this.indices.leftEye.top],
                bottom: lms[this.indices.leftEye.bottom]
            });

            const rightRatio = this.calculateGazeRatio(lms[this.indices.rightIris], {
                left: lms[this.indices.rightEye.left],
                right: lms[this.indices.rightEye.right],
                top: lms[this.indices.rightEye.top],
                bottom: lms[this.indices.rightEye.bottom]
            });

            // Average the ratios from both eyes
            const avgX = (leftRatio.x + rightRatio.x) / 2;
            const avgY = (leftRatio.y + rightRatio.y) / 2;

            // Map ratio (usually 0.2 to 0.8) to screen 0.0 to 1.0
            // We use the sensitivity to "stretch" the range
            let rawX = 0.5 + (avgX - 0.5) * this.sensitivity;
            let rawY = 0.5 + (avgY - 0.5) * (this.sensitivity * 1.5);

            // Smoothing
            this.smoothedX += (rawX - this.smoothedX) * this.smoothingFactor;
            this.smoothedY += (rawY - this.smoothedY) * this.smoothingFactor;

            let finalX = this.smoothedX;
            let finalY = this.smoothedY;

            if (this.calibrated) {
                const mapped = MathUtils.applyPolynomialMapping(this.smoothedX, this.smoothedY, this.mapping.coeffsX, this.mapping.coeffsY);
                finalX = mapped.x; finalY = mapped.y;
            }

            return { x: Math.max(0, Math.min(1, finalX)), y: Math.max(0, Math.min(1, finalY)) };
        } catch (e) {
            return { x: this.smoothedX, y: this.smoothedY };
        }
    }
}
