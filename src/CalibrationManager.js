import { MathUtils } from './MathUtils.js';

/**
 * CalibrationManager: Manages the calibration state machine, 
 * dot sequence, data sampling, outlier rejection, and solving (Poly & TPS).
 */
export class CalibrationManager {
    constructor(overlayCanvas, overlayCtx) {
        this.canvas = overlayCanvas;
        this.ctx = overlayCtx;
        
        // Settings - 100% matched to original lines 7-12
        this.config = {
            gridSize: 4, 
            includeCenter: true, 
            pointDuration: 1500, // ms
            settleTime: 500,      // ms (Wait for eyes to focus)
            sampleDuration: 700,   // ms (Actual recording window)
            samplesPerPoint: 20, 
            outlierThreshold: 1.75
        };

        // State
        this.isCalibrating = false;
        this.currentIndex = 0;
        this.sequence = [];
        this.collectedPoints = [];
        this.currentPointSamples = [];
        this.isSampling = false;
    }

    /**
     * Logic from original generateCalibrationSequence (lines 16-39)
     */
    generateSequence() {
        const { gridSize, includeCenter } = this.config;
        const sequence = [];
        const step = 1.0 / (gridSize + 1);
        const margin = step;

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                let x = margin + i * (1.0 - 2 * margin) / (gridSize - 1);
                let y = margin + j * (1.0 - 2 * margin) / (gridSize - 1);
                sequence.push({ x, y });
            }
        }

        if (includeCenter) {
            const hasCenter = sequence.some(p => Math.abs(p.x - 0.5) < 1e-6 && Math.abs(p.y - 0.5) < 1e-6);
            if (!hasCenter) sequence.push({ x: 0.5, y: 0.5 });
        }
        
        this.sequence = sequence;
        return sequence;
    }

    start() {
        this.generateSequence();
        this.isCalibrating = true;
        this.currentIndex = 0;
        this.collectedPoints = [];
        this.canvas.style.display = "block";
    }

    /**
     * Visuals matched to original drawCurrentDot (lines 463-475)
     */
    drawCurrentDot() {
        const point = this.sequence[this.currentIndex];
        const px = point.x * this.canvas.width;
        const py = point.y * this.canvas.height;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Red fill
        this.ctx.fillStyle = "red";
        this.ctx.beginPath();
        this.ctx.arc(px, py, 20, 0, Math.PI * 2);
        this.ctx.fill();

        // White stroke
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    }

    /**
     * Outlier Rejection logic matched to original finishGazeSampling (lines 496-540)
     */
    processPointSamples(samples) {
        if (samples.length < 5) return;

        const sumX = samples.reduce((a, b) => a + b.x, 0);
        const sumY = samples.reduce((a, b) => a + b.y, 0);
        const meanX = sumX / samples.length;
        const meanY = sumY / samples.length;

        const distances = samples.map(s => Math.sqrt(Math.pow(s.x - meanX, 2) + Math.pow(s.y - meanY, 2)));
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const stdDev = Math.sqrt(distances.reduce((a, d) => a + Math.pow(d - avgDist, 2), 0) / distances.length);
        
        const threshold = avgDist + this.config.outlierThreshold * Math.max(stdDev, 0.0001);
        
        const filtered = samples.filter((s, i) => distances[i] <= threshold);
        const finalSamples = filtered.length >= 3 ? filtered : samples;

        this.collectedPoints.push({
            targetX: this.sequence[this.currentIndex].x,
            targetY: this.sequence[this.currentIndex].y,
            avgRawX: finalSamples.reduce((a, b) => a + b.x, 0) / finalSamples.length,
            avgRawY: finalSamples.reduce((a, b) => a + b.y, 0) / finalSamples.length
        });
    }

    /**
     * SOLVER: Matched to lines 547-606 (Includes both Poly and TPS support)
     */
    solve() {
        this.canvas.style.display = "none";
        this.isCalibrating = false;

        if (this.collectedPoints.length < 6) throw new Error("Not enough data");

        // 1. Solve Polynomial Regression
        const A = [];
        const bX = [];
        const bY = [];

        this.collectedPoints.forEach(p => {
            const x = p.avgRawX;
            const y = p.avgRawY;
            A.push([x * x, x * y, y * y, x, y, 1]);
            bX.push(p.targetX);
            bY.push(p.targetY);
        });

        const AT = MathUtils.transpose(A);
        const ATA = MathUtils.multiplyMatrices(AT, A);
        
        const coeffsX = MathUtils.solveLinearSystem(ATA, MathUtils.multiplyMatrixVector(AT, bX));
        const coeffsY = MathUtils.solveLinearSystem(ATA, MathUtils.multiplyMatrixVector(AT, bY));

        // 2. Solve TPS (Thin Plate Spline) - Restoring logic from lines 566-606
        const tpsParams = this.calculateTPS(this.collectedPoints);

        return { coeffsX, coeffsY, tpsParams };
    }

    /**
     * Logic from original calculateTPSParameters (lines 566-601)
     */
    calculateTPS(points) {
        const n = points.length;
        const size = n + 3;
        const L = Array(size).fill(0).map(() => Array(size).fill(0));

        // Construct K matrix
        for (let i = 0; i < n; i++) {
            for (let j = i; j < n; j++) {
                const dx = points[i].avgRawX - points[j].avgRawX;
                const dy = points[i].avgRawY - points[j].avgRawY;
                const val = MathUtils.tpsBasis(dx * dx + dy * dy);
                L[i][j] = L[j][i] = val;
            }
        }

        // Add P and PT
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