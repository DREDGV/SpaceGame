"""
Ракета - основная сущность игрока
"""

import pygame
import math
from src.config import Config


class Rocket:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.vx = 0
        self.vy = 0
        self.angle = -90  # Наверх
        self.thrusting = False
        self.radius = 10
        
        # Ресурсы ракеты
        self.fuel = 200
        self.cargo = {"metal": 0, "fuel": 0, "crystals": 0, "gas": 0}
        self.credits = Config.INITIAL_CREDITS
        
        # Параметры
        self.max_fuel = 500
        
        # Визуал
        self.color = (255, 255, 255)
        
    def update(self, dt):
        if self.thrusting and self.fuel > 0:
            # Ускорение в направлении ракеты
            thrust_x = math.cos(math.radians(self.angle)) * Config.THRUST_POWER * dt
            thrust_y = math.sin(math.radians(self.angle)) * Config.THRUST_POWER * dt
            
            self.vx += thrust_x
            self.vy += thrust_y
            self.fuel -= 50 * dt  # Расход топлива
            
        # Обновление позиции
        self.x += self.vx * dt
        self.y += self.vy * dt
        
    def start_thrust(self):
        self.thrusting = True
        
    def stop_thrust(self):
        self.thrusting = False
        
    def rotate(self, direction, dt):
        """direction: 1 или -1"""
        self.angle += Config.ROTATION_SPEED * direction * dt
        
    def land_on(self, planet):
        """Посадка на планету"""
        self.x = planet.x
        self.y = planet.y - planet.radius - 20
        self.vx = 0
        self.vy = 0
        self.thrusting = False
        
    def distance_to(self, planet):
        """Расстояние до планеты"""
        dx = self.x - planet.x
        dy = self.y - planet.y
        return math.sqrt(dx**2 + dy**2)
        
    def draw(self, screen):
        """Отрисовка ракеты"""
        # Корпус ракеты
        rocket_length = 30
        rocket_width = 10
        
        # Рассчитываем точки ракеты
        nose_x = self.x + math.cos(math.radians(self.angle)) * rocket_length
        nose_y = self.y + math.sin(math.radians(self.angle)) * rocket_length
        
        # Огонь двигателя
        if self.thrusting and self.fuel > 0:
            flame_length = 15 + 5 * abs(math.sin(pygame.time.get_ticks() / 50))
            flame_x = self.x - math.cos(math.radians(self.angle)) * flame_length
            flame_y = self.y - math.sin(math.radians(self.angle)) * flame_length
            
            pygame.draw.line(
                screen,
                (255, 165, 0),
                (self.x, self.y),
                (flame_x, flame_y),
                4
            )
        
        # Линия корпуса
        pygame.draw.line(
            screen,
            self.color,
            (self.x, self.y),
            (nose_x, nose_y),
            rocket_width
        )
        
        # Нос ракеты
        pygame.draw.circle(
            screen,
            (255, 0, 0),
            (int(nose_x), int(nose_y)),
            rocket_width // 2
        )
