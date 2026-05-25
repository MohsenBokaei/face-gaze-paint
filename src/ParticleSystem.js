/**
 * ParticleSystem: Flow-Field / Magnet Logic.
 * Particles never die; they drift and react to the gaze "magnet".
 */
export class ParticleSystem {
    constructor(capacity = 3000) {
        this.capacity = capacity;
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.colorHue = new Float32Array(capacity);
        this.init();
    }

    init() {
        for (let i = 0; i < this.capacity; i++) {
            this.x[i] = Math.random() * window.innerWidth;
            this.y[i] = Math.random() * window.innerHeight;
            this.vx[i] = (Math.random() - 0.5) * 2;
            this.vy[i] = (Math.random() - 0.5) * 2;
            this.colorHue[i] = Math.random() * 40; // Warm colors (Reds/Oranges)
        }
    }

    // This method now matches the call in script.js
    update(nx, ny, canvasWidth, canvasHeight) {
        const gx = nx * canvasWidth;
        const gy = ny * canvasHeight;

        for (let i = 0; i < this.capacity; i++) {
            // If nx is -1, just do natural drift
            if (nx !== -1) {
                const dx = gx - this.x[i];
                const dy = gy - this.y[i];
                const distSq = dx * dx + dy * dy + 100;
                const dist = Math.sqrt(distSq);

                // Attraction (Magnet)
                const force = Math.min(2.0, 500 / dist);
                this.vx[i] += (dx / dist) * force * 0.15;
                this.vy[i] += (dy / dist) * force * 0.15;

                // Vortex (Spin)
                const spin = 0.4;
                this.vx[i] += (dy / dist) * spin;
                this.vy[i] -= (dx / dist) * spin;
            }

            // Friction & Movement
            this.vx[i] *= 0.95;
            this.vy[i] *= 0.95;
            this.x[i] += this.vx[i];
            this.y[i] += this.vy[i];

            // Wrap edges
            if (this.x[i] < 0) this.x[i] = canvasWidth;
            if (this.x[i] > canvasWidth) this.x[i] = 0;
            if (this.y[i] < 0) this.y[i] = canvasHeight;
            if (this.y[i] > canvasHeight) this.y[i] = 0;
        }
    }

    draw(ctx) {
        ctx.lineWidth = 1.0;
        for (let i = 0; i < this.capacity; i++) {
            const speed = Math.abs(this.vx[i]) + Math.abs(this.vy[i]);
            const alpha = Math.min(0.4, speed / 10);
            ctx.strokeStyle = `hsla(${this.colorHue[i]}, 100%, 50%, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(this.x[i], this.y[i]);
            ctx.lineTo(this.x[i] - this.vx[i] * 2, this.y[i] - this.vy[i] * 2);
            ctx.stroke();
        }
    }

    clear() { this.init(); }
}
