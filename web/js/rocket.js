class Rocket {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -90; // Наверх
    this.radius = 15;
    this.fuel = CONFIG.INITIAL_FUEL;
    this.credits = CONFIG.INITIAL_CREDITS;
    this.cargo = { metal: 0, fuel: 0, crystals: 0, gas: 0 };
    this.thrusting = false;
    this.rotationLeft = false;
    this.rotationRight = false;
    this.landed = false; // Флаг посадки
    this.landedOnPlanet = null; // На какой планете сидим
  }

  update(dt) {
    // Если на планете - ничего не делаем пока не оторвёмся
    if (this.landed) {
      // Можно оторваться только с топливом
      if (this.thrusting && this.fuel > 0) {
        this.landed = false;
        this.landedOnPlanet = null;
      } else {
        return [];
      }
    }

    // Поворот
    if (this.rotationLeft) {
      this.angle -= CONFIG.ROTATION_SPEED * dt;
    }
    if (this.rotationRight) {
      this.angle += CONFIG.ROTATION_SPEED * dt;
    }

    // Тяга (только если есть топливо)
    if (this.thrusting && this.fuel > 0) {
      const angleRad = (this.angle * Math.PI) / 180;
      const thrustX = Math.cos(angleRad) * CONFIG.THRUST_POWER * dt;
      const thrustY = Math.sin(angleRad) * CONFIG.THRUST_POWER * dt;

      this.vx += thrustX;
      this.vy += thrustY;
      this.fuel -= CONFIG.FUEL_CONSUMPTION * dt;

      // Не даём уйти в минус
      if (this.fuel < 0) this.fuel = 0;

      // Создаём частицы огня
      return this.createThrustParticles();
    }

    // Обновление позиции
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Границы экрана (зацикливание)
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;

    return [];
  }

  createThrustParticles() {
    const angleRad = ((this.angle + 180) * Math.PI) / 180;
    const particles = [];

    for (let i = 0; i < 3; i++) {
      particles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angleRad) * (100 + Math.random() * 50),
        vy: Math.sin(angleRad) * (100 + Math.random() * 50),
        life: 0.5,
        maxLife: 0.5,
        color: `hsl(${20 + Math.random() * 30}, 100%, 50%)`,
      });
    }

    return particles;
  }

  distanceTo(planet) {
    const dx = this.x - planet.x;
    const dy = this.y - planet.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  landOn(planet) {
    const angle = Math.atan2(planet.y - this.y, planet.x - this.x);
    this.x = planet.x - Math.cos(angle) * (planet.radius + 25);
    this.y = planet.y - Math.sin(angle) * (planet.radius + 25);
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.landed = true;
    this.landedOnPlanet = planet;
  }

  draw(ctx) {
    const angleRad = (this.angle * Math.PI) / 180;
    const rocketLength = 35;

    // Нос ракеты
    const noseX = this.x + Math.cos(angleRad) * rocketLength;
    const noseY = this.y + Math.sin(angleRad) * rocketLength;

    // Огонь двигателя
    if (this.thrusting && this.fuel > 0) {
      const flameLength = 20 + Math.random() * 10;
      const flameX = this.x - Math.cos(angleRad) * flameLength;
      const flameY = this.y - Math.sin(angleRad) * flameLength;

      const gradient = ctx.createLinearGradient(this.x, this.y, flameX, flameY);
      gradient.addColorStop(0, "#ff6600");
      gradient.addColorStop(1, "transparent");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(flameX, flameY);
      ctx.stroke();
    }

    // Корпус ракеты
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(noseX, noseY);
    ctx.stroke();

    // Нос ракеты (красный)
    ctx.fillStyle = "#ff3333";
    ctx.beginPath();
    ctx.arc(noseX, noseY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Индикатор направления
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(
      this.x + Math.cos(angleRad) * 50,
      this.y + Math.sin(angleRad) * 50,
    );
    ctx.stroke();
  }
}
