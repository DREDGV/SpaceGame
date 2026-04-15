"""
HUD - интерфейс игры (ресурсы, топливо, кредиты)
"""

import pygame


class HUD:
    def __init__(self, game):
        self.game = game
        self.font = pygame.font.Font(None, 36)
        
    def draw(self, screen):
        """Отрисовка интерфейса"""
        rocket = self.game.rocket
        
        # Топливо
        fuel_text = self.font.render(f"Топливо: {int(rocket.fuel)}", True, (255, 255, 0))
        screen.blit(fuel_text, (10, 10))
        
        # Кредиты
        credits_text = self.font.render(f"Кредиты: {rocket.credits}", True, (255, 215, 0))
        screen.blit(credits_text, (10, 50))
        
        # Груз
        cargo_y = 90
        cargo_text = self.font.render("Груз:", True, (255, 255, 255))
        screen.blit(cargo_text, (10, cargo_y))
        
        for i, (resource, amount) in enumerate(rocket.cargo.items()):
            if amount > 0:
                item_text = self.font.render(f"  {resource}: {amount}", True, (200, 200, 200))
                screen.blit(item_text, (10, cargo_y + 30 * (i + 1)))
                
        # Подсказки
        hints = [
            "ЛКМ - двигатель",
            "ПКМ - стоп двигатель",
            "E - взаимодействие",
            "ESC - выход"
        ]
        
        hint_y = screen.get_height() - 120
        for hint in hints:
            hint_text = pygame.font.Font(None, 24).render(hint, True, (150, 150, 150))
            screen.blit(hint_text, (10, hint_y))
            hint_y += 25
