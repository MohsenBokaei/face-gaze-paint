/**
 * FractalSystem: Based on Clifford Attractors.
 * Your gaze (nx, ny) controls the constants (a, b, c, d) that define the fractal.
 */
export class ParticleSystem {
    constructor(capacity = 5000) {
        this.capacity = capacity;
        // The points representing the current "state" of the fractal
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.hue = new Float32Array(capacity);
        
        // Fractal parameters influenced by gaze
        this.a = -1.4; this.b = 1.6; this.c = 1.0; this.d = 0.7;
        
        this.init();
    }

    init() {
        for (let i = 0; i < this.capacity; i++) {
            this.x[i] = (Math.random() - 0.5) * 2;
            this.y[i] = (Math.random() - 0.5) * 2;
            this.hue[i] = Math.random() * 360;
        }
    }

    /**
     * Update the fractal parameters based on gaze.
     * Moving eyes changes the "dimension" of the fractal.
     */
    update(nx, ny, w, h) {
        if (nx !== -1) {
            // Map gaze 0-1 to attractor parameter ranges (approx -3 to 3)
            this.a = (nx - 0.5) * 6;
            this.b = (ny - 0.5) * 6;
        }

        for (let i = 0; i < this.capacity; i++) {
            let oldX = this.x[i];
            let oldY = this.y[i];

            // Clifford Attractor Equations:
            // x_{n+1} = sin(a * y_n) + c * cos(a * x_n)
            // y_{n+1} = sin(b * x_n) + d * cos(b * y_n)
            this.x[i] = Math.sin(this.a * oldY) + this.c * Math.cos(this.a * oldX);
            this.y[i] = Math.sin(this.b * oldX) + this.d * Math.cos(this.b * oldY);
            
            // Color shifts based on the "position" in the fractal
            this.hue[i] = (this.hue[i] + 0.5) % 360;
        }
    }

    draw(ctx, w, h) {
        ctx.globalCompositeOperation = 'lighter';
        const centerX = w / 2;
        const centerY = h / 2;
        const scale = Math.min(w, h) * 0.2; // Zoom of the fractal

        for (let i = 0; i < this.capacity; i++) {
            // Map the attractor's abstract -2..2 coordinates to screen pixels
            const screenX = centerX + this.x[i] * scale;
            const screenY = centerY + this.y[i] * scale;

            ctx.beginPath();
            ctx.fillStyle = `hsla(${this.hue[i]}, 80%, 60%, 0.2)`;
            // Drawing tiny rectangles or dots to build the fractal "density"
            ctx.fillRect(screenX, screenY, 1.5, 1.5);
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    clear() { this.init(); }
}
