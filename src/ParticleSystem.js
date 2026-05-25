/**
 * Accurate Physarum (Slime Mold) System
 * Recreating the logic from johshoff/physarum & Jeff Jones
 */
export class ParticleSystem {
    constructor(capacity = 8000) {
        this.capacity = capacity;
        
        // Simulation Constants (Fine-tuned for Mycelium look)
        this.config = {
            sensorDist: 12,
            sensorAngle: 35 * Math.PI / 180,
            turnSpeed: 30 * Math.PI / 180,
            moveSpeed: 1.2,
            decayFactor: 0.92,
            depositAmount: 0.8,
            gazeInfluence: 0.15, // How strongly they turn toward eyes
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

        this.step_sense_and_rotate(nx, ny);
        this.step_move();
        this.step_deposit();
        this.step_diffuse_and_decay();
    }

    step_sense_and_rotate(nx, ny) {
        const w = this.width;
        const h = this.height;

        for (let agent of this.agents) {
            const sense = (angleOffset) => {
                const lookAngle = agent.heading + angleOffset;
                const sx = Math.round(agent.x + Math.cos(lookAngle) * this.config.sensorDist);
                const sy = Math.round(agent.y + Math.sin(lookAngle) * this.config.sensorDist);
                
                // Boundary check
                if (sx < 0 || sx >= w || sy < 0 || sy >= h) return -1;
                return this.trail[sy * w + sx];
            };

            const vCenter = sense(0);
            const vLeft = sense(this.config.sensorAngle);
            const vRight = sense(-this.config.sensorAngle);

            // Turning Logic from Jeff Jones
            if (vCenter > vLeft && vCenter > vRight) {
                // Continue straight
            } else if (vCenter < vLeft && vCenter < vRight) {
                // Randomly turn left or right
                agent.heading += (Math.random() > 0.5 ? 1 : -1) * this.config.turnSpeed;
            } else if (vLeft > vRight) {
                agent.heading += this.config.turnSpeed;
            } else if (vRight > vLeft) {
                agent.heading -= this.config.turnSpeed;
            }

            // --- GAZE INTERACTION ---
            // If the user is looking at the screen, nudge the agents
            if (nx !== -1) {
                const angleToGaze = Math.atan2((ny * h) - agent.y, (nx * w) - agent.x);
                let diff = angleToGaze - agent.heading;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                agent.heading += diff * this.config.gazeInfluence;
            }
        }
    }

    step_move() {
        for (let agent of this.agents) {
            agent.x += Math.cos(agent.heading) * this.config.moveSpeed;
            agent.y += Math.sin(agent.heading) * this.config.moveSpeed;

            // Wrap Around
            agent.x = (agent.x + this.width) % this.width;
            agent.y = (agent.y + this.height) % this.height;
        }
    }

    step_deposit() {
        for (let agent of this.agents) {
            const x = Math.round(agent.x);
            const y = Math.round(agent.y);
            const idx = y * this.width + x;
            if (idx >= 0 && idx < this.trail.length) {
                this.trail[idx] += this.config.depositAmount;
            }
        }
    }

    step_diffuse_and_decay() {
        const old_trail = new Float32Array(this.trail);
        const w = this.width;
        const h = this.height;
        const wt = this.config.weight;

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = y * w + x;
                
                // 3x3 Gaussian Convolution
                const diffused_value = (
                    old_trail[i - w - 1] * wt[0] + old_trail[i - w] * wt[1] + old_trail[i - w + 1] * wt[2] +
                    old_trail[i - 1]     * wt[3] + old_trail[i]     * wt[4] + old_trail[i + 1]     * wt[5] +
                    old_trail[i + w - 1] * wt[6] + old_trail[i + w] * wt[7] + old_trail[i + w + 1] * wt[8]
                );

                this.trail[i] = diffused_value * this.config.decayFactor;
            }
        }
    }

    draw(ctx, w, h) {
        const imgData = ctx.createImageData(w, h);
        const pixels = imgData.data;

        for (let i = 0; i < this.trail.length; i++) {
            const val = this.trail[i];
            const idx = i * 4;

            // Mapping: High scent = Dark Ink, Low scent = White Paper
            // Using 255 - val creates the "Inverted" Mycelium look
            const brightness = Math.max(0, 255 - (val * 180)); 
            
            pixels[idx]     = brightness; // R
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
