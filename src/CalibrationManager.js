import { MathUtils } from './MathUtils.js';

/**
 * CalibrationManager: Optimized for extreme-edge coverage and 
 * high-fidelity gaze mapping.
 */
export class CalibrationManager {
    constructor(overlayCanvas, overlayCtx) {
        this.canvas = overlayCanvas;
        this.ctx = overlayCtx;
        
        this.config = {
            // 9-point grid provides the best balance of speed and edge accuracy
            pointsToCollect: 9, 
            samplesPerPoint: 45, // Increased for better statistical mean
            settleFrames: 20,    // Ignore the first 20 frames to allow eye to settle
            outlierThreshold: 1.5 // Tightened to reject saccades (eye jumps)
        };

        this.isCalibrating = false;
        this.currentIndex = 0;
        this.sequence = [];
        this.collectedPoints = [];
        this.currentPointSamples = [];
        this.settleCounter = 0;
    }

    /**
     * Generates a 3x3 grid at the absolute limits of the screen.
     * Hits 2% and 98% to ensure the "Look Down" logic has extreme data.
     */
    generateSequence() {
        const margins = [0.03, 0.5, 0.97]; // Absolute edges + centers
        const sequence = [];

        for (let y of margins) {
            for (let x of margins) {
                sequence.push({ x, y });
            }
        }

        // Randomize order to prevent the user from "pre-moving" their eyes
        this.sequence = sequence.sort(() => Math.random() - 0.5);
        return this.sequence;
    }

    start() {
        this.generateSequence();
        this.isCalibrating = true;
        this.currentIndex = 0;
        this.collectedPoints = [];
        this.currentPointSamples = [];
        this.settleCounter = 0;
        this.canvas.style.display = "block";
    }

    /**
     * Visual Feedback: Shrinking Target.
     * Forces the user's pupil to contract and focus on a single point.
     */
    drawCurrentDot() {
        const point = this.sequence[this.currentIndex];
        if (!point) return;

        const px = point.x * this.canvas.width;
        const py = point.y * this.canvas.height;

        // Calculate progress (0.0 to 1.0)
        const progress = this.currentPointSamples.length / this.config.samplesPerPoint;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Draw Outer "Focus" Ring
        this.ctx.strokeStyle = "rgba(100, 100, 255, 0.5)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 30, 0, Math.PI * 2);
        this.ctx.stroke();

        // 2. Draw Shrinking Inner Target
        // Starts large/red, ends tiny/green
        const radius = Math.max(3, 25 * (1 - progress));
        const hue = progress * 120; // 0 (Red) to 120 (Green)
        
        this.ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // 3. Label for user
        this.ctx.fillStyle = "white";
        this.ctx.font = "12px Inter";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`Point ${this.currentIndex + 1}/9: Focus on the center`, px, py + 45);
    }

    /**
     * Advanced Outlier Rejection.
     * Discards noisy data from when the user blinks or looks away.
     */
    processPointSamples(samples) {
        if (samples.length < 10) return;

        // Calculate Mean
        const meanX = samples.reduce((a, b) => a + b.x, 0) / samples.length;
        const meanY = samples.reduce((a, b) => a + b.y, 0) / samples.length;

        // Calculate Standard Deviation
        const dists = samples.map(s => Math.sqrt((s.x - meanX)**2 + (s.y - meanY)**2));
        const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;
        
        // Threshold: Discard samples that are too far from the average gaze for this dot
        const filtered = samples.filter((s, i) => dists[i] < avgDist * this.config.outlierThreshold);

        if (filtered.length > 5) {
            this.collectedPoints.push({
                targetX: this.sequence[this.currentIndex].x,
                targetY: this.sequence[this.currentIndex].y,
                avgRawX: filtered.reduce((a, b) => a + b.x, 0) / filtered.length,
                avgRawY: filtered.reduce((a, b) => a + b.y, 0) / filtered.length
            });
        }
    }

    /**
     * TPS Solver: Handles the non-linear "warp" of looking up and down.
     */
    solve() {
        this.canvas.style.display = "none";
        this.isCalibrating = false;

        if (this.collectedPoints.length < 5) {
            console.error("Calibration failed: Not enough stable points.");
            return null;
        }

        // Calculate TPS Parameters (as seen in the research papers)
        const tpsParams = this.calculateTPS(this.collectedPoints);

        // Also calculate legacy Polynomial for fallback
        const A = [], bX = [], bY = [];
        this.collectedPoints.forEach(p => {
            const x = p.avgRawX, y = p.avgRawY;
            A.push([x * x, x * y, y * y, x, y, 1]);
            bX.push(p.targetX); bY.push(p.targetY);
        });

        const AT = MathUtils.transpose(A);
        const ATA = MathUtils.multiplyMatrices(AT, A);
        const coeffsX = MathUtils.solveLinearSystem(ATA, MathUtils.multiplyMatrixVector(AT, bX));
        const coeffsY = MathUtils.solveLinearSystem(ATA, MathUtils.multiplyMatrixVector(AT, bY));

        return { coeffsX, coeffsY, tpsParams };
    }

    calculateTPS(points) {
        const n = points.length;
        const size = n + 3;
        const L = Array(size).fill(0).map(() => Array(size).fill(0));

        for (let i = 0; i < n; i++) {
            for (let j = i; j < n; j++) {
                const dx = points[i].avgRawX - points[j].avgRawX;
                const dy = points[i].avgRawY - points[j].avgRawY;
                const val = MathUtils.tpsBasis(dx * dx + dy * dy);
                L[i][j] = L[j][i] = val;
            }
        }

        for (let i = 0; i < n; i++) {
            L[i][n] = L[n][i] = 1.0;
            L[i][n+1] = L[n+1][i] = points[i].avgRawX;
            L[i][n+2] = L[n+2][i] = points[i].avgRawY;
        }

        const Yx = Array(size).fill(0);
        const Yy = Array(size).fill(0);
        for (let i = 0; i < n; i++) {
            Yx[i] = points[i].targetX;
            Yy[i] = points[i].targetY;
        }

        return {
            controlPoints: points.map(p => ({ x: p.avgRawX, y: p.avgRawY })),
            weightsX: MathUtils.solveLinearSystem(L, Yx),
            weightsY: MathUtils.solveLinearSystem(L, Yy)
        };
    }

    stop() {
        this.isCalibrating = false;
        this.canvas.style.display = "none";
    }
}
