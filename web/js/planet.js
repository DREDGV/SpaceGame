class Planet {
    constructor(name, x, y, radius, color, resources) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.resources = resources || {};
    }

    draw(ctx) {
        // Градиент для планеты
        const gradient = ctx.createRadialGradient(
            this.x - this.radius * 0.3,
            this.y - this.radius * 0.3,
            0,
            this.x,
            this.y,
            this.radius
        );
        gradient.addColorStop(0, this.lightenColor(this.color, 30));
        gradient.addColorStop(1, this.color);
        
        // Основная планета
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Обводка
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Название
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y + this.radius + 20);
    }

    lightenColor(color, percent) {
        // Простая функция осветления цвета
        return color;
    }

    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
}
