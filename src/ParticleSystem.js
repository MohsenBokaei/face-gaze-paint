/**
 * Accurate Physarum (Slime Mold) System
 * Faithful recreation of Jeff Jones' "Characteristics of Pattern Formation"
 */
export class ParticleSystem {
    constructor(capacity = 8000) {
        this.capacity = capacity;
        
        // Physarum Constants
        this.config = {
            sensorDist: 15,         // How far ahead agents "smell"
            sensorAngle: 0.52,      // ~30 degrees
            turnSpeed: 0.45,        // How sharply they turn
            moveSpeed: 1.2,
            decayFactor: 0.91,      // How fast trails fade (0.91 = organic)
            depositAmount: 1.0,     // Scent intensity left by agent
            gazeInfluence: 0.12,    // How strongly they nudge toward eyes
            // Gaussian Blur Kernel
            weight: [
                1/16, 1/8, 1/16,
                1/8,  1/4,  1/8,
                1/16, 1/8, 1/16
            ]
        };

        this.agents = [];
        this.trail = null;
        this.width = 0;
        this.height = 0;
    }

    init(w, h) {
        this.width = Math.floor(w);
        this.height = Math.floor(h);
        this.trail = new Float32Array(this.width * this.height);
        this.agents = [];

        for (let i = 0; i < this.capacity; i++) {
            this.agents.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                heading: Math.random() * Math.PI * 2
            });
        }
    }

    update(nx, ny, w, h) {
        if (!this.trail || this.width !== w || this.height !== h) {
            this.init(w, h);
        }

        // 1. SENSE & ROTATE
        for (let agent of this.agents) {
            const sense = (angleOffset) => {
                const lookAngle = agent.heading + angleOffset;
                const sx = Math.round(agent.x + Math.cos(lookAngle) * this.config.sensorDist);
                const sy = Math.round(agent.y + Math.sin(lookAngle) * this.config.sensorDist);
                
                if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) return -1;
                return this.trail[sy * this.width + sx];
            };

            const vCenter = sense(0);
            const vLeft = sense(this.config.sensorAngle);
            const vRight = sense(-this.config.sensorAngle);

            // Turning logic based on Jeff Jones' algorithm
            if (vCenter > vLeft && vCenter > vRight) {
                // Continue straight
            } else if (vCenter < vLeft && vCenter < vRight) {
                agent.heading += (Math.random() > 0.5 ? 1 : -1) * this.config.turnSpeed;
            } else if (vLeft > vRight) {
                agent.heading += this.config.turnSpeed;
            } else if (vRight > vLeft) {
                agent.heading -= this.config.turnSpeed;
            }

            // --- GAZE BIAS ---
            // Nudge agents toward the gaze coordinates
            if (nx !== -1) {
                const angleToGaze = Math.atan2((ny * h) - agent.y, (nx * w) - agent.x);
                let diff = angleToGaze - agent.heading;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                agent.heading += diff * this.config.gazeInfluence;
            }
        }

        // 2. MOVE & WRAP
        for (let agent of this.agents) {
            agent.x = (agent.x + Math.cos(agent.heading) * this.config.moveSpeed + this.width) % this.width;
            agent.y = (agent.y + Math.sin(agent.heading) * this.config.moveSpeed + this.height) % this.height;
            
            // 3. DEPOSIT
            const idx = Math.floor(agent.y) * this.width + Math.floor(agent.x);
            this.trail[idx] += this.config.depositAmount;
        }

        // 4. DIFFUSE & DECAY
        const oldTrail = new Float32Array(this.trail);
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const i = y * this.width + x;
                const diffused = (
                    oldTrail[i - this.width - 1] * this.config.weight[0] +
                    oldTrail[i - this.width] * this.config.weight[1] +
                    oldTrail[i - this.width + 1] * this.config.weight[2] +
                    oldTrail[i - 1] * this.config.weight[3] +
                    oldTrail[i] * this.config.weight[4] +
                    oldTrail[i + 1] * this.config.weight[5] +
                    oldTrail[i + this.width - 1] * this.config.weight[6] +
                    oldTrail[i + this.width] * this.config.weight[7] +
                    oldTrail[i + this.width + 1] * this.config.weight[8]
                );
                this.trail[i] = diffused * this.config.decayFactor;
            }
        }
    }

    draw(ctx, w, h) {
        const imgData = ctx.createImageData(w, h);
        const pixels = imgData.data;

        for (let i = 0; i < this.trail.length; i++) {
            // Map scent value to brightness (Inverted for ink-on-paper look)
            const brightness = Math.max(0, 255 - (this.trail[i] * 180));
            const idx = i * 4;
            pixels[idx] = brightness;     // R
            pixels[idx + 1] = brightness; // G
            pixels[idx + 2] = brightness; // B
            pixels[idx + 3] = 255;        // A
        }
        ctx.putImageData(imgData, 0, 0);
    }

    clear() {
        if (this.trail) this.trail.fill(0);
    }
}
