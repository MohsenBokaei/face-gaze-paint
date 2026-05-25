import { MathUtils } from './MathUtils.js';

/**
 * CalibrationManager: Optimized for extreme-edge coverage and 
 * high-fidelity gaze mapping. Fixes invisible drawing by syncing resolution.
 */
export class CalibrationManager {
    constructor(overlayCanvas, overlayCtx) {
        this.canvas = overlayCanvas;
        this.ctx = overlayCtx;
        
        this.config = {
            pointsToCollect: 9, 
            samplesPerPoint: 45, 
            settleFrames: 25,    // Wait for eye stabilization
            outlierThreshold: 1.5 
        };

        this.isCalibrating = false;
        this.currentIndex = 0;
        this.sequence = [];
        this.collectedPoints = [];
        this.currentPointSamples = [];
        this.settleCounter = 0;
    }

    /**
     * Hits 3% and 97% to ensure we capture the absolute limits of the screen.
     */
    generateSequence() {
        const margins = [0.03, 0.5, 0.97]; 
        const sequence = [];
        for (let y of margins) {
            for (let x of margins) {
                sequence.push({ x, y });
            }
        }
        this.sequence = sequence.sort(() => Math.random() - 0.5);
        return this.sequence;
    }

    start() {
        // --- THE CRITICAL FIX ---
        // Sync the internal drawing buffer to the actual screen size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.generateSequence();
        this.isCalibrating = true;
        this.currentIndex = 0;
        this.collectedPoints = [];
        this.currentPointSamples = [];
        this.settleCounter = 0;
        
        // Show overlay
        this.canvas.style.display = "block";
        console.log("Calibration Canvas Initialized:", this.canvas.width, "x", this.canvas.height);
    }

    /**
     * Visual Feedback: Shrinking Target.
     */
    drawCurrentDot() {
        const point = this.sequence[this.currentIndex];
        if (!point) return;

        // Uses the corrected width/height
        const px = point.x * this.canvas.width;
        const py = point.y * this.canvas.height;

        const progress = this.currentPointSamples.length / this.config.samplesPerPoint;
        
        // Clear the entire fullscreen overlay
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Darken the background slightly to make the dot "pop"
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Outer Focus Ring
        this.ctx.strokeStyle = "rgba(100, 100, 255, 0.8)";
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 40, 0, Math.PI * 2);
        this.ctx.stroke();

        // 2. Shrinking Target Dot
        const radius = Math.max(5, 30 * (1 - progress));
        const hue = progress * 120; // Red to Green
        
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        this.ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0; // Reset shadow

        // 3. Label
        this.ctx.fillStyle = "black";
        this.ctx.font = "bold 16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`LOOK HERE (${this.currentIndex + 1}/9)`, px, py + 60);
    }

    processPointSamples(samples) {
        if (samples.length < 10) return;

        const meanX = samples.reduce((a, b) => a + b.x, 0) / samples.length;
        const meanY = samples.reduce((a, b) => a + b.y, 0) / samples.length;

        const dists = samples.map(s => Math.sqrt((s.x - meanX)**2 + (s.y - meanY)**2));
        const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;
        
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

    solve() {
        this.canvas.style.display = "none";
        this.isCalibrating = false;

        if (this.collectedPoints.length < 5) return null;

        const tpsParams = this.calculateTPS(this.collectedPoints);

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
