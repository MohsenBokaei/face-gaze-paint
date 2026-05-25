export class ParticleSystem {
    constructor(capacity = 10000) {
        this.capacity = capacity;
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.heading = new Float32Array(capacity);
        this.config = {
            sensorDist: 15, sensorAngle: 0.45, turnSpeed: 0.35,
            moveSpeed: 1.1, evaporation: 0.94, deposit: 4.0
        };
        this.trailMap = null; 
        this.width = 0; this.height = 0;
    }

    init(w, h) {
        this.width = Math.floor(w); this.height = Math.floor(h);
        this.trailMap = new Float32Array(this.width * this.height);
        for (let i = 0; i < this.capacity; i++) {
            this.x[i] = Math.random() * this.width;
            this.y[i] = Math.random() * this.height;
            this.heading[i] = Math.random() * Math.PI * 2;
        }
    }

    update(nx, ny, w, h) {
        if (!this.trailMap || this.width !== w || this.height !== h) this.init(w, h);

        if (nx !== -1) {
            const gx = Math.floor(nx * w), gy = Math.floor(ny * h);
            const idx = gy * this.width + gx;
            if (this.trailMap[idx] !== undefined) this.trailMap[idx] += 50.0;
        }

        for (let i = 0; i < this.capacity; i++) {
            const ang = this.heading[i];
            const vC = this.read(this.x[i], this.y[i], ang, this.config.sensorDist);
            const vL = this.read(this.x[i], this.y[i], ang - this.config.sensorAngle, this.config.sensorDist);
            const vR = this.read(this.x[i], this.y[i], ang + this.config.sensorAngle, this.config.sensorDist);

            if (vC > vL && vC > vR) {} 
            else if (vL > vR) this.heading[i] -= this.config.turnSpeed;
            else if (vR > vL) this.heading[i] += this.config.turnSpeed;

            this.x[i] = (this.x[i] + Math.cos(this.heading[i]) * this.config.moveSpeed + w) % w;
            this.y[i] = (this.y[i] + Math.sin(this.heading[i]) * this.config.moveSpeed + h) % h;

            this.trailMap[Math.floor(this.y[i]) * this.width + Math.floor(this.x[i])] += this.config.deposit;
        }

        const newMap = new Float32Array(this.trailMap.length);
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const i = y * this.width + x;
                const sum = (this.trailMap[i-this.width-1] + this.trailMap[i-this.width] + this.trailMap[i-this.width+1] +
                             this.trailMap[i-1] + this.trailMap[i] + this.trailMap[i+1] +
                             this.trailMap[i+this.width-1] + this.trailMap[i+this.width] + this.trailMap[i+this.width+1]) / 9;
                newMap[i] = sum * this.config.evaporation;
            }
        }
        this.trailMap = newMap;
    }

    read(x, y, ang, dist) {
        const sx = Math.floor(x + Math.cos(ang) * dist), sy = Math.floor(y + Math.sin(ang) * dist);
        return (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) ? -1 : this.trailMap[sy * this.width + sx];
    }

    draw(ctx, w, h) {
        const img = ctx.createImageData(w, h);
        for (let i = 0; i < this.trailMap.length; i++) {
            const b = Math.max(0, 255 - (this.trailMap[i] * 40));
            const px = i * 4;
            img.data[px] = b; img.data[px+1] = b; img.data[px+2] = b; img.data[px+3] = 255;
        }
        ctx.
