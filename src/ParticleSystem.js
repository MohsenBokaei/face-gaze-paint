export class ParticleSystem {
    constructor(capacity = 3000) {
        this.capacity = capacity;
        
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.colorHue = new Float32Array(capacity);

        this.initParticles();
    }

    initParticles() {
        for (let i = 0; i < this.capacity; i++) {
            this.x[i] = Math.random() * window.innerWidth;
            this.y[i] = Math.random() * window.innerHeight;
            this.vx[i] = (Math.random() - 0.5) * 2;
            this.vy[i] = (Math.random() - 0.5) * 2;
            this.colorHue[i] = Math.random() * 60; // Range of reds/oranges
        }
    }

    // New update logic: gazeX and gazeY are normalized 0-1
    update(gazeX, gazeY, canvasWidth, canvasHeight) {
        const gx = gazeX * canvasWidth;
        const gy = gazeY * canvasHeight;

        for (let i = 0; i < this.capacity; i++) {
            const dx = gx - this.x[i];
            const dy = gy - this.y[i];
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            // 1. Attraction Force (The Magnet)
            const force = Math.min(2.0, 500 / (dist + 20));
            this.vx[i] += (dx / dist) * force * 0.2;
            this.vy[i] += (dy / dist) * force * 0.2;

            // 2. Vortex Force (The Spin)
            // This creates a perpendicular force to the gaze
            const spinStrength = 0.5;
            this.vx[i] += (dy / dist) * spinStrength;
            this.vy[i] -= (dx / dist) * spinStrength;

            // 3. Friction (Damping)
            // Keeps the particles from flying off screen
            this.vx[i] *= 0.96;
            this.vy[i] *= 0.96;

            // Update Position
            this.x[i] += this.vx[i];
            this.y[i] += this.vy[i];

            // 4. Wrap around screen edges
            if (this.x[i] < 0) this.x[i] = canvasWidth;
            if (this.x[i] > canvasWidth) this.x[i] = 0;
            if (this.y[i] < 0) this.y[i] = canvasHeight;
            if (this.y[i] > canvasHeight) this.y[i] = 0;
        }
    }

    draw(ctx) {
        // We use a very faint line to create "silk" trails
        ctx.lineWidth = 0.5;
        for (let i = 0; i < this.capacity; i++) {
            const speed = Math.sqrt(this.vx[i]**2 + this.vy[i]**2);
            const alpha = Math.min(0.5, speed / 10);
            
            ctx.beginPath();
            ctx.strokeStyle = `hsla(${this.colorHue[i]}, 100%, 50%, ${alpha})`;
            // Draw a line from current position back to previous position
            ctx.moveTo(this.x[i], this.y[i]);
            ctx.lineTo(this.x[i] - this.vx[i] * 2, this.y[i] - this.vy[i] * 2);
            ctx.stroke();
        }
    }

    clear() {
        this.initParticles();
    }
}
