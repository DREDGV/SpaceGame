"""
Физическая система - гравитация, движение, столкновения
"""

import math
from src.config import Config


class PhysicsSystem:
    def __init__(self):
        self.gravity_constant = Config.GRAVITY_CONSTANT
        
    def apply_gravity(self, rocket, planets):
        """Применить гравитацию планет к ракете"""
        for planet in planets:
            dx = rocket.x - planet.x
            dy = rocket.y - planet.y
            dist_sq = dx**2 + dy**2
            dist = math.sqrt(dist_sq)
            
            if dist > 0:
                # Сила гравитации (упрощённая)
                gravity_force = self.gravity_constant * planet.radius / dist_sq
                
                # Направление к планете
                ax = -gravity_force * dx / dist
                ay = -gravity_force * dy / dist
                
                rocket.vx += ax
                rocket.vy += ay
