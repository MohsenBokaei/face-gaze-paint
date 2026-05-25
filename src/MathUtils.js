/**
 * MathUtils: Stateless helper functions for Matrix math and Coordinate Mapping.
 * Corrected for index-safety and full TPS affine support.
 */
export class MathUtils {
    
    static transpose(matrix) {
        if (!matrix || matrix.length === 0) return [];
        return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
    }

    /**
     * Corrected: Uses proper indices instead of indexOf
     */
    static multiplyMatrices(A, B) {
        const rA = A.length;
        const cA = A[0].length;
        const cB = B[0].length;
        const result = Array(rA).fill(0).map(() => Array(cB).fill(0));

        for (let i = 0; i < rA; i++) {
            for (let j = 0; j < cB; j++) {
                let sum = 0;
                for (let k = 0; k < cA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    static multiplyMatrixVector(A, v) {
        return A.map(row => row.reduce((acc, val, i) => acc + val * v[i], 0));
    }

    static solveLinearSystem(A, b) {
        let n = A.length, Ac = A.map(r => [...r]), bc = [...b];
        for (let i = 0; i < n; i++) {
            let max = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(Ac[k][i]) > Math.abs(Ac[max][i])) max = k;
            }
            [Ac[i], Ac[max]] = [Ac[max], Ac[i]];
            [bc[i], bc[max]] = [bc[max], bc[i]];
            
            let p = Ac[i][i];
            if (Math.abs(p) < 1e-10) return null;
            
            for (let k = i + 1; k < n; k++) {
                let f = Ac[k][i] / p;
                bc[k] -= f * bc[i];
                for (let j = i; j < n; j++) Ac[k][j] -= f * Ac[i][j];
            }
        }
        let x = Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            let s = 0;
            for (let j = i + 1; j < n; j++) s += Ac[i][j] * x[j];
            x[i] = (bc[i] - s) / Ac[i][i];
        }
        return x;
    }

    static tpsBasis(rSq) {
        return rSq <= 1e-10 ? 0 : rSq * Math.log(rSq);
    }

    /**
     * Corrected: Implements full affine transformation (a + bx + cy)
     */
    static applyTPSMapping(rawX, rawY, tps) {
        if (!tps || !tps.controlPoints) return { x: rawX, y: rawY };
        
        let sumX = 0;
        let sumY = 0;
        const n = tps.controlPoints.length;

        // Radial Basis Sum
        for (let i = 0; i < n; i++) {
            const cp = tps.controlPoints[i];
            const distSq = Math.pow(rawX - cp.x, 2) + Math.pow(rawY - cp.y, 2);
            const u = this.tpsBasis(distSq);
            sumX += tps.weightsX[i] * u;
            sumY += tps.weightsY[i] * u;
        }

        // Add Affine components (The last 3 weights in the solver vector)
        // a1 + a2*x + a3*y
        const ax1 = tps.weightsX[n], ax2 = tps.weightsX[n+1], ax3 = tps.weightsX[n+2];
        const ay1 = tps.weightsY[n], ay2 = tps.weightsY[n+1], ay3 = tps.weightsY[n+2];

        return { 
            x: ax1 + ax2 * rawX + ax3 * rawY + sumX, 
            y: ay1 + ay2 * rawX + ay3 * rawY + sumY 
        };
    }

    static applyPolynomialMapping(x, y, cX, cY) {
        if (!cX || !cY) return { x, y };
        const x2 = x * x, y2 = y * y, xy = x * y;
        return {
            x: cX[0]*x2 + cX[1]*xy + cX[2]*y2 + cX[3]*x + cX[4]*y + cX[5],
            y: cY[0]*x2 + cY[1]*xy + cY[2]*y2 + cY[3]*x + cY[4]*y + cY[5]
        };
    }
}
