/**
 * PHYSARUM POLYCEPHALUM (Slime Mold / Mycelium) Simulation
 * A complex stigmergic system where agents communicate through a pheromone field.
 */
export class ParticleSystem {
    constructor(capacity = 10000) {
        this.capacity = capacity;
        
        // Agent Properties
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.heading = new Float32Array(capacity);
        
        // Simulation Constants (Adjust for "crunchiness")
        this.config = {
            sensorDist: 15,       // How far agents look ahead
            sensorAngle: 0.45,    // Angle of the side sensors
            turnSpeed: 0.35,      // How sharply they turn toward scent
            moveSpeed: 1.1,       // Speed of growth
            evaporation: 0.94,    // How fast trails fade (decay)
            diffusion: 0.15,      // How much trails spread (blur)
            deposit: 4.0,         // Scent intensity left by each agent
            gazeScent: 12.0       // Intensity of "food" at gaze point
        };

        this.trailMap = null; 
        this.width = 0;
        this.height = 0;
    }

    init(w, h) {
        this.width = Math.floor(w);
        this.height = Math.floor(h);
        this.trailMap = new Float32Array(this.width * this.height);
        for (let i = 0; i < this.capacity; i++) {
            this.x[i] = Math.random() * this.width;
            this.y[i] = Math.random() * this.height;
            this.heading[i] = Math.random() * Math.PI * 2;
        }
    }

    update(nx, ny, w, h) {
        if (!this.trailMap || this.width !== w || this.height !== h) this.init(w, h);

        // 1. GAZE AS FOOD SOURCE
        // We drop a massive amount of "scent" where the user looks
        if (nx !== -1) {
            const gx = Math.floor(nx * w);
            const gy = Math.floor(ny * h);
            for(let i = -3; i < 3; i++) {
                for(let j = -3; j < 3; j++) {
                    const idx = (gy + j) * this.width + (gx + i);
                    if (this.trailMap[idx] !== undefined) this.trailMap[idx] += this.config.gazeScent;
                }
            }
        }

        // 2. AGENT BEHAVIOR (Sense, Move, Deposit)
        for (let i = 0; i < this.capacity; i++) {
            const ang = this.heading[i];
            const x = this.x[i];
            const y = this.y[i];

            // Sense 3 directions
            const vC = this.readSensor(x, y, ang, this.config.sensorDist);
            const vL = this.readSensor(x, y, ang - this.config.sensorAngle, this.config.sensorDist);
            const vR = this.readSensor(x, y, ang + this.config.sensorAngle, this.config.sensorDist);

            // Steer
            if (vC > vL && vC > vR) { /* Continue straight */ }
            else if (vC < vL && vC < vR) { this.heading[i] += (Math.random() - 0.5) * 2 * this.config.turnSpeed; }
            else if (vL > vR) { this.heading[i] -= this.config.turnSpeed; }
            else if (vR > vL) { this.heading[i] += this.config.turnSpeed; }

            // Move
            this.x[i] = (x + Math.cos(this.heading[i]) * this.config.moveSpeed + w) % w;
            this.y[i] = (y + Math.sin(this.heading[i]) * this.config.moveSpeed + h) % h;

            // Deposit Pheromone
            const idx = Math.floor(this.y[i]) * this.width + Math.floor(this.x[i]);
            this.trailMap[idx] += this.config.deposit;
        }

        // 3. DIFFUSE & DECAY (Chemical Physics)
        this.processMap();
    }

    readSensor(x, y, angle, dist) {
        const sx = Math.floor(x + Math.cos(angle) * dist);
        const sy = Math.floor(y + Math.sin(angle) * dist);
        if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) return -1;
        return this.trailMap[sy * this.width + sx];
    }

    processMap() {
        const newMap = new Float32Array(this.trailMap.length);
        const w = this.width;
        const h = this.height;
        const decay = this.config.evaporation;

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = y * w + x;
                // 3x3 Mean Blur (Diffusion)
                const sum = (
                    this.trailMap[i - w - 1] + this.trailMap[i - w] + this.trailMap[i - w + 1] +
                    this.trailMap[i - 1] + this.trailMap[i] + this.trailMap[i + 1] +
                    this.trailMap[i + w - 1] + this.trailMap[i + w] + this.trailMap[i + w + 1]
                ) / 9;
                newMap[i] = sum * decay;
            }
        }
        this.trailMap = newMap;
    }

    draw(ctx, w, h) {
        const img = ctx.createImageData(w, h);
        for (let i = 0; i < this.trailMap.length; i++) {
            const val = this.trailMap[i];
            const px = i * 4;
            // Map Scent to Brightness (Inverted: High scent = Dark Ink)
            const b = Math.max(0, 255 - (val * 40));
            img.data[px] = b; img.data[px+1] = b; img.data[px+2] = b; img.data[px+3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }

    clear() { this.trailMap?.fill(0); }
}
