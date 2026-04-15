"""
Модуль игры - основной игровой цикл
"""

import pygame
from src.config import Config
from src.systems.resource_manager import ResourceManager
from src.systems.economy import Economy
from src.systems.physics import PhysicsSystem
from src.entities.rocket import Rocket
from src.entities.planet import Planet
from src.ui.hud import HUD


class Game:
    def __init__(self):
        self.screen = pygame.display.set_mode((Config.WIDTH, Config.HEIGHT))
        pygame.display.set_caption("Space Economy")
        self.clock = pygame.time.Clock()
        self.running = True
        
        # Инициализация систем
        self.resource_manager = ResourceManager()
        self.economy = Economy()
        self.physics = PhysicsSystem()
        
        # Игровые объекты
        self.rocket = Rocket(400, 300)
        self.planets = self._create_planets()
        
        # UI
        self.hud = HUD(self)
        
        # Состояние игры
        self.state = "exploring"  # exploring, trading, building, mission
        
    def _create_planets(self):
        """Создание начальных планет"""
        planets_data = [
            {"name": "Земля", "x": 200, "y": 500, "radius": 50, "color": (100, 149, 237), "resources": {"metal": 100, "fuel": 50}},
            {"name": "Марс", "x": 600, "y": 200, "radius": 40, "color": (205, 92, 92), "resources": {"metal": 80, "crystals": 30}},
            {"name": "Юпитер", "x": 900, "y": 400, "radius": 80, "color": (210, 180, 140), "resources": {"fuel": 200, "gas": 100}},
        ]
        return [Planet(**data) for data in planets_data]
    
    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_e:
                    self._interact_with_planet()
            elif event.type == pygame.KEYUP:
                if event.key in (pygame.K_UP, pygame.K_w):
                    self.rocket.stop_thrust()
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:  # ЛКМ
                    self.rocket.start_thrust()
            elif event.type == pygame.MOUSEBUTTONUP:
                if event.button == 1:  # ЛКМ
                    self.rocket.stop_thrust()
    
    def get_keys(self):
        """Получение нажатых клавиш"""
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            self.rocket.rotate(-1, 1/60)
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            self.rocket.rotate(1, 1/60)
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            self.rocket.start_thrust()
                    
    def _interact_with_planet(self):
        """Взаимодействие с ближайшей планетой"""
        for planet in self.planets:
            if self.rocket.distance_to(planet) < planet.radius + 20:
                print(f"Взаимодействие с {planet.name}")
                # Здесь будет открытие интерфейса торговли/миссий
                break
                
    def update(self, dt):
        # Управление
        self.get_keys()
        
        # Обновление ракеты
        self.rocket.update(dt)
        
        # Физика
        self.physics.apply_gravity(self.rocket, self.planets)
        
        # Проверка столкновений
        self._check_collisions()
        
        # Обновление экономики
        self.economy.update(dt)
        
    def _check_collisions(self):
        """Проверка столкновений с планетами"""
        for planet in self.planets:
            dist = self.rocket.distance_to(planet)
            if dist < planet.radius + self.rocket.radius:
                # Посадка на планету
                self.rocket.land_on(planet)
                print(f"Посадка на {planet.name}")
                
    def render(self):
        self.screen.fill((10, 10, 30))  # Тёмно-синий космос
        
        # Отрисовка звёзд (фон)
        self._draw_stars()
        
        # Отрисовка планет
        for planet in self.planets:
            planet.draw(self.screen)
            
        # Отрисовка ракеты
        self.rocket.draw(self.screen)
        
        # Отрисовка UI
        self.hud.draw(self.screen)
        
        pygame.display.flip()
        
    def _draw_stars(self):
        """Простая отрисовка звёзд"""
        import random
        random.seed(42)  # Фиксированный сид для постоянных звёзд
        for _ in range(100):
            x = random.randint(0, Config.WIDTH)
            y = random.randint(0, Config.HEIGHT)
            self.screen.fill((255, 255, 255), (x, y, 1, 1))
            
    def run(self):
        while self.running:
            dt = self.clock.tick(60) / 1000.0  # Delta time в секундах
            
            self.handle_events()
            self.update(dt)
            self.render()
