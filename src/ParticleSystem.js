export class ParticleSystem {
    constructor(capacity = 4000) {
        this.capacity = capacity;
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.angle = new Float32Array(capacity); // Direction of growth
        
        // Mycelium Settings
        this.sensorAngle = 45 * (Math.PI / 180);
        this.sensorDist = 15;
        this.turnSpeed = 0.2;
        this.moveSpeed = 1.2;
        
        this.init();
    }

    init() {
        for (let i = 0; i < this.capacity; i++) {
            this.x[i] = Math.random() * window.innerWidth;
            this.y[i] = Math.random() * window.innerHeight;
            this.angle[i] = Math.random() * Math.PI * 2;
        }
    }

    update(nx, ny, w, h, trailCtx) {
        // trailCtx is a hidden canvas used for "scent" detection
        const trailData = trailCtx.getImageData(0, 0, w, h).data;

        for (let i = 0; i < this.capacity; i++) {
            // 1. SENSING LOGIC
            const sensorDist = this.sensorDist;
            
            // Look Center, Left, and Right
            const v1 = this.getSensorValue(this.x[i], this.y[i], this.angle[i], sensorDist, w, h, trailData);
            const v2 = this.getSensorValue(this.x[i], this.y[i], this.angle[i] - this.sensorAngle, sensorDist, w, h, trailData);
            const v3 = this.getSensorValue(this.x[i], this.y[i], this.angle[i] + this.sensorAngle, sensorDist, w, h, trailData);

            // Turn toward the strongest trail
            if (v1 > v2 && v1 > v3) { /* Stay straight */ }
            else if (v1 < v2 && v1 < v3) { this.angle[i] += (Math.random() - 0.5) * 2 * this.turnSpeed; }
            else if (v2 > v3) { this.angle[i] -= this.turnSpeed; }
            else if (v3 > v2) { this.angle[i] += this.turnSpeed; }

            // 2. GAZE ATTRACTION
            if (nx !== -1) {
                const dx = (nx * w) - this.x[i];
                const dy = (ny * h) - this.y[i];
                const angleToGaze = Math.atan2(dy, dx);
                // Slowly nudge angle toward gaze
                this.angle[i] += (angleToGaze - this.angle[i]) * 0.02;
            }

            // 3. MOVE
            this.x[i] += Math.cos(this.angle[i]) * this.moveSpeed;
            this.y[i] += Math.sin(this.angle[i]) * this.moveSpeed;

            // Bounce off walls
            if (this.x[i] <= 0 || this.x[i] >= w) this.angle[i] = Math.PI - this.angle[i];
            if (this.y[i] <= 0 || this.y[i] >= h) this.angle[i] = -this.angle[i];
        }
    }

    getSensorValue(x, y, angle, dist, w, h, data) {
        const sx = Math.floor(x + Math.cos(angle) * dist);
        const sy = Math.floor(y + Math.sin(angle) * dist);
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) return 0;
        // Return the "Red" channel as the scent value
        return data[(sy * w + sx) * 4];
    }

    draw(ctx) {
        // High-contrast ink look
        ctx.fillStyle = "black";
        for (let i = 0; i < this.capacity; i++) {
            ctx.fillRect(this.x[i], this.y[i], 1.2, 1.2);
        }
    }
    
    clear() { this.init(); }
}
