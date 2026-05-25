/**
 * ParticleSystem: High-Fluidity / Painting Mode.
 * Features: HSLA color cycles, steering behaviors, and velocity-based scaling.
 */
export class ParticleSystem {
    constructor(capacity = 3500) {
        this.capacity = capacity;
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.hue = new Float32Array(capacity);
        this.size = new Float32Array(capacity);
        this.init();
    }

    init() {
        for (let i = 0; i < this.capacity; i++) {
            this.x[i] = Math.random() * window.innerWidth;
            this.y[i] = Math.random() * window.innerHeight;
            this.vx[i] = 0;
            this.vy[i] = 0;
            this.hue[i] = Math.random() * 360; 
            this.size[i] = 1 + Math.random() * 3;
        }
    }

    update(nx, ny, w, h, time) {
        for (let i = 0; i < this.capacity; i++) {
            // 1. Natural Fluid Drift (using sine-wave noise)
            // This makes them move like they are underwater
            const noise = (Math.sin(time * 0.001 + i) + Math.cos(time * 0.0005 + i)) * 0.2;
            this.vx[i] += Math.cos(this.hue[i] + noise) * 0.05;
            this.vy[i] += Math.sin(this.hue[i] + noise) * 0.05;

            // 2. Gaze Magnet (Steering)
            if (nx !== -1) {
                const dx = (nx * w) - this.x[i];
                const dy = (ny * h) - this.y[i];
                const dist = Math.sqrt(dx * dx + dy * dy) + 1;
                
                // Slow "Steering" force instead of raw pull
                const strength = 0.15;
                if (dist < 400) {
                    this.vx[i] += (dx / dist) * strength;
                    this.vy[i] += (dy / dist) * strength;
                    // Color shifts toward the gaze
                    this.hue[i] = (this.hue[i] + 1) % 360;
                }
            }

            // 3. Viscosity (Damping) - This is what makes it "Slow and Fluid"
            this.vx[i] *= 0.92;
            this.vy[i] *= 0.92;

            this.x[i] += this.vx[i];
            this.y[i] += this.vy[i];

            // 4. Edge Bounce (Soft wrap)
            if (this.x[i] < 0) this.x[i] = w;
            if (this.x[i] > w) this.x[i] = 0;
            if (this.y[i] < 0) this.y[i] = h;
            if (this.y[i] > h) this.y[i] = 0;
        }
    }

    draw(ctx) {
        // Use 'lighter' composite for a glowing, neon paint effect
        ctx.globalCompositeOperation = 'lighter';
        
        for (let i = 0; i < this.capacity; i++) {
            const speed = Math.sqrt(this.vx[i]**2 + this.vy[i]**2);
            
            // Draw lines for trails
            ctx.beginPath();
            ctx.lineWidth = this.size[i] * (speed * 0.5);
            ctx.strokeStyle = `hsla(${this.hue[i]}, 80%, 60%, 0.15)`;
            ctx.moveTo(this.x[i], this.y[i]);
            ctx.lineTo(this.x[i] - this.vx[i] * 3, this.y[i] - this.vy[i] * 3);
            ctx.stroke();
        }
        
        ctx.globalCompositeOperation = 'source-over';
    }

    clear() { this.init(); }
}
