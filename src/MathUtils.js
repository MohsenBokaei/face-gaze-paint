export class MathUtils {
    static transpose(m) { return m[0].map((_, i) => m.map(r => r[i])); }
    static multiplyMatrices(A, B) {
        return A.map((row) => B[0].map((_, j) => row.reduce((acc, _, k) => acc + A[row.indexOf(row)][k] * B[k][j], 0)));
    }
    static multiplyMatrixVector(A, v) { return A.map(row => row.reduce((acc, val, i) => acc + val * v[i], 0)); }
    static solveLinearSystem(A, b) {
        let n = A.length, Ac = A.map(r => [...r]), bc = [...b];
        for (let i = 0; i < n; i++) {
            let max = i;
            for (let k = i + 1; k < n; k++) if (Math.abs(Ac[k][i]) > Math.abs(Ac[max][i])) max = k;
            [Ac[i], Ac[max]] = [Ac[max], Ac[i]]; [bc[i], bc[max]] = [bc[max], bc[i]];
            let p = Ac[i][i]; if (Math.abs(p) < 1e-10) return null;
            for (let k = i + 1; k < n; k++) {
                let f = Ac[k][i] / p; bc[k] -= f * bc[i];
                for (let j = i; j < n; j++) Ac[k][j] -= f * Ac[i][j];
            }
        }
        let x = Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            let s = 0; for (let j = i + 1; j < n; j++) s += Ac[i][j] * x[j];
            x[i] = (bc[i] - s) / Ac[i][i];
        }
        return x;
    }
    static tpsBasis(rSq) { return rSq <= 1e-10 ? 0 : rSq * Math.log(rSq); }
    static applyTPSMapping(rawX, rawY, tps) {
        if (!tps) return {x:rawX, y:rawY};
        let sumX = 0, sumY = 0;
        tps.controlPoints.forEach((cp, i) => {
            let u = this.tpsBasis(Math.pow(rawX - cp.x, 2) + Math.pow(rawY - cp.y, 2));
            sumX += tps.weightsX[i] * u; sumY += tps.weightsY[i] * u;
        });
        return { x: tps.weightsX[tps.weightsX.length-3] + sumX, y: tps.weightsY[tps.weightsY.length-3] + sumY };
    }
    static applyPolynomialMapping(x, y, cX, cY) {
        if (!cX) return {x, y};
        const x2 = x*x, y2 = y*y, xy = x*y;
        return {
            x: cX[0]*x2 + cX[1]*xy + cX[2]*y2 + cX[3]*x + cX[4]*y + cX[5],
            y: cY[0]*x2 + cY[1]*xy + cY[2]*y2 + cY[3]*x + cY[4]*y + cY[5]
        };
    }
}