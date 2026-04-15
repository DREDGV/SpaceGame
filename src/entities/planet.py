"""
Планета - объект в космосе с ресурсами
"""

import pygame


class Planet:
    def __init__(self, name, x, y, radius, color, resources=None):
        self.name = name
        self.x = x
        self.y = y
        self.radius = radius
        self.color = color
        self.resources = resources or {}
        
    def draw(self, screen):
        """Отрисовка планеты"""
        # Основной круг
        pygame.draw.circle(
            screen,
            self.color,
            (int(self.x), int(self.y)),
            self.radius
        )
        
        # Обводка
        pygame.draw.circle(
            screen,
            (255, 255, 255),
            (int(self.x), int(self.y)),
            self.radius,
            2
        )
        
        # Название
        font = pygame.font.Font(None, 24)
        text = font.render(self.name, True, (255, 255, 255))
        text_rect = text.get_rect(center=(self.x, self.y + self.radius + 15))
        screen.blit(text, text_rect)
