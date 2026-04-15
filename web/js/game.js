const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI элементы
const fuelDisplay = document.getElementById("fuelDisplay");
const creditsDisplay = document.getElementById("creditsDisplay");
const cargoDisplay = document.getElementById("cargoDisplay");
const pauseScreen = document.getElementById("pauseScreen");
const planetInteraction = document.getElementById("planetInteraction");
const planetNameDisplay = document.getElementById("planetName");
const planetResourcesDisplay = document.getElementById("planetResources");

// Состояние игры
let game = {
  running: true,
  paused: false,
  lastTime: 0,
  particles: [],
  nearbyPlanet: null,
};

// Инициализация canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Создание игровых объектов
const rocket = new Rocket(canvas.width / 2, canvas.height / 2);
const physics = new Physics();

const planets = [
  new Planet("Земля", 300, 500, 60, "#4a90e2", { metal: 100, fuel: 50 }),
  new Planet("Марс", 800, 300, 50, "#e74c3c", { metal: 80, crystals: 30 }),
  new Planet("Юпитер", 1100, 600, 90, "#f39c12", { fuel: 200, gas: 100 }),
];

const stars = generateStars(200, canvas.width, canvas.height);

// Управление
const keys = {};

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === "Escape") {
    game.paused = !game.paused;
    pauseScreen.classList.toggle("hidden");
  }

  if (e.key.toLowerCase() === "e" && game.nearbyPlanet && !game.paused) {
    openPlanetInteraction(game.nearbyPlanet);
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Обработка ввода для ракеты
function handleRocketInput() {
  rocket.thrusting = keys["w"] || keys["ц"] || keys["arrowup"];
  rocket.rotationLeft = keys["a"] || keys["ф"] || keys["arrowleft"];
  rocket.rotationRight = keys["d"] || keys["в"] || keys["arrowright"];
}

// Открытие интерфейса планеты
function openPlanetInteraction(planet) {
  game.paused = true;
  planetNameDisplay.textContent = planet.name;

  let resourcesHTML = '<div style="margin: 20px 0; text-align: left;">';
  for (const [resource, amount] of Object.entries(planet.resources)) {
    const price = CONFIG.RESOURCE_PRICES[resource];
    resourcesHTML += `
            <div style="margin: 10px 0; display: flex; justify-content: space-between;">
                <span>${resource}: ${amount}</span>
                <span>Цена: ${price} 💰</span>
            </div>
        `;
  }
  resourcesHTML += "</div>";
  planetResourcesDisplay.innerHTML = resourcesHTML;

  planetInteraction.classList.remove("hidden");
}

// Закрытие интерфейса планеты
function closePlanetInteraction() {
  game.paused = false;
  planetInteraction.classList.add("hidden");
  game.nearbyPlanet = null;
}

document
  .getElementById("closeButton")
  .addEventListener("click", closePlanetInteraction);

// Обновление UI
function updateUI() {
  const statusDisplay = document.getElementById("statusDisplay");

  // Статус
  if (rocket.landed && rocket.landedOnPlanet) {
    statusDisplay.textContent = `На ${rocket.landedOnPlanet.name}`;
    statusDisplay.style.color = "#0f0";
  } else {
    statusDisplay.textContent = "В полёте";
    statusDisplay.style.color = "#0ff";
  }

  fuelDisplay.textContent = Math.floor(rocket.fuel);
  creditsDisplay.textContent = rocket.credits;

  const cargoItems = Object.entries(rocket.cargo)
    .filter(([_, amount]) => amount > 0)
    .map(([resource, amount]) => `${resource}: ${amount}`);

  cargoDisplay.textContent =
    cargoItems.length > 0 ? cargoItems.join(", ") : "Пусто";
}

// Обновление частиц
function updateParticles(dt) {
  game.particles = game.particles.filter((particle) => {
    const alive = particle.update(dt);
    return alive;
  });
}

// Основной игровой цикл
function gameLoop(timestamp) {
  if (!game.lastTime) game.lastTime = timestamp;
  const dt = Math.min((timestamp - game.lastTime) / 1000, 0.1);
  game.lastTime = timestamp;

  if (game.running && !game.paused) {
    // Обработка ввода
    handleRocketInput();

    // Обновление ракеты
    const newParticles = rocket.update(dt);
    game.particles.push(
      ...newParticles.map(
        (p) => new Particle(p.x, p.y, p.vx, p.vy, p.life, p.color),
      ),
    );

    // Физика (только если не на планете)
    if (!rocket.landed) {
      physics.applyGravity(rocket, planets, dt);
    }

    // Проверка столкновений (только если не на планете)
    game.nearbyPlanet = rocket.landedOnPlanet;
    if (!rocket.landed) {
      for (const planet of planets) {
        if (physics.checkCollision(rocket, planet)) {
          rocket.landOn(planet);
          game.nearbyPlanet = planet;
          break;
        }

        // Проверка близости к планете
        if (rocket.distanceTo(planet) < planet.radius + 50) {
          game.nearbyPlanet = planet;
        }
      }
    }

    // Если на планете - показываем подсказку
    if (rocket.landed && rocket.landedOnPlanet) {
      game.nearbyPlanet = rocket.landedOnPlanet;
    }

    // Обновление частиц
    updateParticles(dt);

    // Обновление UI
    updateUI();
  }

  // Отрисовка
  render(timestamp / 1000);

  requestAnimationFrame(gameLoop);
}

// Отрисовка
function render(time) {
  // Очистка
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Звёзды
  stars.forEach((star) => star.draw(ctx, time));

  // Частицы
  game.particles.forEach((particle) => particle.draw(ctx));

  // Планеты
  planets.forEach((planet) => planet.draw(ctx));

  // Ракета
  rocket.draw(ctx);

  // Индикатор взаимодействия
  if (game.nearbyPlanet && !game.paused) {
    ctx.fillStyle = "#00ff00";
    ctx.font = "20px Segoe UI";
    ctx.textAlign = "center";

    if (rocket.landed) {
      ctx.fillText(
        "🚀 Вы на планете! Нажмите W для взлёта, E для торговли",
        canvas.width / 2,
        100,
      );
    } else {
      ctx.fillText("Нажмите E для взаимодействия", canvas.width / 2, 100);
    }
  }
}

// Обработка изменения размера окна
window.addEventListener("resize", () => {
  resizeCanvas();
  stars.length = 0;
  stars.push(...generateStars(200, canvas.width, canvas.height));
});

// Запуск игры
resizeCanvas();
requestAnimationFrame(gameLoop);
