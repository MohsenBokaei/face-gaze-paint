/**
 * Advanced Physarum (Slime Mold) Particle System
 * Based on Sage Jenson's 'Physarum' and Jeff Jones' Research.
 * 
 * Logic: 
 * 1. Agents Sense: Look at Scent Grid (Left, Center, Right).
 * 2. Agents Move: Turn toward highest scent + Gaze Bias.
 * 3. Agents Deposit: Leave "chemical" on the Trail Map.
 * 4. Trail Map Update: Diffuse (Spread) and Decay (Evaporate).
 */
export class ParticleSystem {
    constructor(capacity = 8000) {
        this.capacity = capacity;
        
        // Agent Properties
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.heading = new Float32Array(capacity); // Direction in radians
        
        // Simulation Parameters
        this.config = {
            sensorAngle: 0.35,      // Angle of side sensors (radians)
            sensorDist: 18,        // Distance of sensors from agent
            turnSpeed: 0.4,        // How fast agents turn toward scent
            moveSpeed: 1.5,        // Pixels per frame
            randomTurn: 0.15,      // Stochastic "wiggle"
            evaporationRate: 0.94, // 0.9 = fast decay, 0.99 = long trails
            diffusionRate: 0.1,    // How much scent spreads to neighbors
            depositAmount: 5.0,    // Scent intensity left per frame
            gazeStrength: 0.08     // How much gaze influences direction
        };

        // Persistent Scent Grid
        this.trailMap = null;      // Float32Array initialized on first resize
        this.width = 0;
        this.height = 0;

        this.initAgents();
    }

    initAgents() {
        for (let i = 0; i < this.capacity; i++) {
            this.x[i] = Math.random() * window.innerWidth;
            this.y[i] = Math.random() * window.innerHeight;
            this.heading[i] = Math.random() * Math.PI * 2;
        }
    }

    /**
     * Initializes the Scent Grid based on current canvas dimensions.
     */
    initGrid(w, h) {
        this.width = Math.floor(w);
        this.height = Math.floor(h);
        this.trailMap = new Float32Array(this.width * this.height);
    }

    /**
     * The Core Simulation Loop
     */
    update(nx, ny, w, h) {
        if (!this.trailMap || this.width !== w || this.height !== h) {
            this.initGrid(w, h);
        }

        const tw = this.width;
        const th = this.height;

        // --- STEP 1: Agent Processing ---
        for (let i = 0; i < this.capacity; i++) {
            let x = this.x[i];
            let y = this.y[i];
            let ang = this.heading[i];

            // A. SENSING
            // Look at three points in front of the agent
            const vCenter = this.readSensor(x, y, ang, this.config.sensorDist, tw, th);
            const vLeft = this.readSensor(x, y, ang - this.config.sensorAngle, this.config.sensorDist, tw, th);
            const vRight = this.readSensor(x, y, ang + this.config.sensorAngle, this.config.sensorDist, tw, th);

            // B. STEERING (Based on Trail Map)
            if (vCenter > vLeft && vCenter > vRight) {
                // Stay on path
            } else if (vCenter < vLeft && vCenter < vRight) {
                // Stochastic turning if both sides are equal
                this.heading[i] += (Math.random() - 0.5) * 2 * this.config.turnSpeed;
            } else if (vLeft > vRight) {
                this.heading[i] -= this.config.turnSpeed;
            } else if (vRight > vLeft) {
                this.heading[i] += this.config.turnSpeed;
            }

            // C. GAZE INFLUENCE (The Nutrients)
            if (nx !== -1) {
                const targetAng = Math.atan2((ny * h) - y, (nx * w) - x);
                let diff = targetAng - this.heading[i];
                // Wrap angle difference
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.heading[i] += diff * this.config.gazeStrength;
            }

            // D. MOVEMENT
            this.heading[i] += (Math.random() - 0.5) * this.config.randomTurn;
            x += Math.cos(this.heading[i]) * this.config.moveSpeed;
            y += Math.sin(this.heading[i]) * this.config.moveSpeed;

            // E. WALL HANDLING (Bounce/Wrap)
            if (x < 0 || x >= tw) { 
                this.heading[i] = Math.PI - this.heading[i]; 
                x = Math.max(0, Math.min(tw - 1, x));
            }
            if (y < 0 || y >= th) { 
                this.heading[i] = -this.heading[i]; 
                y = Math.max(0, Math.min(th - 1, y));
            }

            this.x[i] = x;
            this.y[i] = y;

            // F. DEPOSIT SCENT
            const idx = Math.floor(y) * tw + Math.floor(x);
            this.trailMap[idx] += this.config.depositAmount;
        }

        // --- STEP 2: Trail Map Physics (Diffusion & Decay) ---
        this.processTrailMap(tw, th);
    }

    /**
     * Reads scent value at a specific offset from an agent
     */
    readSensor(x, y, angle, dist, w, h) {
        const sx = Math.floor(x + Math.cos(angle) * dist);
        const sy = Math.floor(y + Math.sin(angle) * dist);
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) return -1;
        return this.trailMap[sy * w + sx];
    }

    /**
     * Biological Decay: Simulates evaporation and nutrient spreading
     */
    processTrailMap(w, h) {
        const newMap = new Float32Array(this.trailMap.length);
        const d = this.config.diffusionRate;
        const e = this.config.evaporationRate;

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = y * w + x;
                
                // 3x3 Box Blur (Diffusion)
                const sum = (
                    this.trailMap[i - w - 1] + this.trailMap[i - w] + this.trailMap[i - w + 1] +
                    this.trailMap[i - 1]     + this.trailMap[i]     + this.trailMap[i + 1]     +
                    this.trailMap[i + w - 1] + this.trailMap[i + w] + this.trailMap[i + w + 1]
                ) / 9;

                // Combine Diffusion and Evaporation
                newMap[i] = sum * e;
            }
        }
        this.trailMap = newMap;
    }

    /**
     * Render the Trail Map to the Canvas
     */
    draw(ctx, w, h) {
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;

        for (let i = 0; i < this.trailMap.length; i++) {
            const val = this.trailMap[i];
            const px = i * 4;
            
            // MYCELIUM LOOK: High contrast, dark ink on light paper
            // We map the scent value to an inverted grayscale
            const brightness = Math.max(0, 255 - (val * 40)); 
            
            data[px] = brightness;     // R
            data[px + 1] = brightness; // G
            data[px + 2] = brightness; // B
            data[px + 3] = 255;        // A (Fully Opaque)
        }

        ctx.putImageData(imageData, 0, 0);
    }

    clear() {
        if (this.trailMap) this.trailMap.fill(0);
        this.initAgents();
    }
}
