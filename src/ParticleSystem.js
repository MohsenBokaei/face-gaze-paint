/**
 * ParticleSystem: The visual engine.
 * Manages 1,024 particles using Typed Arrays for high-performance physics.
 * Matched to original interaction logic (cos(d)/d) and fading (Red -> Black).
 */
export class ParticleSystem {
    constructor(capacity = 1024) {
        this.capacity = capacity;
        this.cursor = 0; // Insertion index 'c' from original script

        // High-performance memory allocation
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.intensity = new Float32Array(capacity); // Color shift (1.0 = Red, 0.0 = Black)
        this.alpha = new Float32Array(capacity);     // Transparency fading
    }

    /**
     * Spawns a new particle.
     * Logic matched to original addNewParticleAtGaze (lines 342-353).
     */
    add(px, py) {
        if (!isFinite(px) || !isFinite(py)) return;

        const i = this.cursor;
        this.x[i] = px;
        this.y[i] = py;
        this.vx[i] = 0;
        this.vy[i] = 0;
        this.intensity[i] = 1.0; // Max redness
        this.alpha[i] = 0.95;    // Initial alpha

        this.cursor = (this.cursor + 1) % this.capacity;
    }

    /**
     * The Physics Loop.
     * Logic matched to original updateAndDrawParticles Loop 1 (lines 357-394).
     */
    update() {
        // Calculate interaction forces
        for (let a = 0; a < this.capacity; a++) {
            if (this.alpha[a] <= 0.01) continue;

            let ax = 0, ay = 0;
            for (let b = 0; b < this.capacity; b++) {
                // Ignore self or inactive particles
                if (a === b || this.alpha[b] <= 0.01) continue;

                const dx = this.x[a] - this.x[b];
                const dy = this.y[a] - this.y[b];
                const dSq = dx * dx + dy * dy + 0.001; // Avoid division by zero
                const d = Math.sqrt(dSq);

                if (d < 1) continue; // Minimum distance stability

                // Interaction force: cos(d) / d (Original line 383)
                const common = Math.cos(d) / d;
                
                if (isFinite(common)) {
                    ax += common * dx;
                    ay += common * dy;
                }
            }

            // Apply force to velocity with 0.01 scaling factor (Original line 391)
            this.vx[a] += ax * 0.01;
            this.vy[a] += ay * 0.01;
        }

        // Apply velocities and fading
        for (let i = 0; i < this.capacity; i++) {
            if (this.alpha[i] <= 0.01) continue;

            this.x[i] += this.vx[i];
            this.y[i] += this.vy[i];

            // Color shift: Fade from Red to Black (Original line 403)
            this.intensity[i] *= 0.992; 
            
            // Transparency: Fade out (Original line 407)
            this.alpha[i] *= 0.99;
        }
    }

    /**
     * Rendering logic.
     * Logic matched to original updateAndDrawParticles Loop 2 (lines 415-430).
     */
    draw(ctx, canvasWidth, canvasHeight) {
        const margin = 150;
        // Important: We don't clear the background here so the "paint" persists
        for (let i = 0; i < this.capacity; i++) {
            const a = this.alpha[i];
            if (a <= 0.01) continue;

            if (this.x[i] < -margin || this.x[i] > canvasWidth + margin || 
                this.y[i] < -margin || this.y[i] > canvasHeight + margin) {
                this.alpha[i] = 0;
                continue;
            }

            const red = Math.floor(255 * this.intensity[i]);
            const size = 1.5 + a; 

            // FIXED TYPO HERE: was rgba($red}
            ctx.fillStyle = `rgba(${red}, 0, 0, ${a})`;
            ctx.fillRect(this.x[i] - size / 2, this.y[i] - size / 2, size, size);
        }
    }

    /**
     * Resets the system. Matched to clearPaintButton (lines 656-668).
     */
    clear() {
        this.cursor = 0;
        this.x.fill(0);
        this.y.fill(0);
        this.vx.fill(0);
        this.vy.fill(0);
        this.intensity.fill(0);
        this.alpha.fill(0);
    }
}
