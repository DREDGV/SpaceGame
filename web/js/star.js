class Star {
    constructor(x, y, size, brightness) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.brightness = brightness;
        this.twinkleSpeed = Math.random() * 2 + 1;
        this.twinkleOffset = Math.random() * Math.PI * 2;
    }

    draw(ctx, time) {
        const twinkle = Math.sin(time * this.twinkleSpeed + this.twinkleOffset);
        const alpha = 0.5 + (twinkle + 1) * 0.25;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

function generateStars(count, width, height) {
    const stars = [];
    for (let i = 0; i < count; i++) {
        stars.push(new Star(
            Math.random() * width,
            Math.random() * height,
            Math.random() * 2 + 1,
            Math.random()
        ));
    }
    return stars;
}
