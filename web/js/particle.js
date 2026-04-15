class Particle {
    constructor(x, y, vx, vy, life, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        return this.life > 0;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color.replace('1)', `${alpha})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}
