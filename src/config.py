"""
Конфигурация игры
"""


class Config:
    WIDTH = 1280
    HEIGHT = 720
    FPS = 60
    
    # Физика
    GRAVITY_CONSTANT = 1000
    THRUST_POWER = 300
    ROTATION_SPEED = 180  # градусов в секунду
    
    # Ресурсы
    INITIAL_METAL = 100
    INITIAL_FUEL = 200
    INITIAL_CREDITS = 500
    
    # Цены ресурсов
    RESOURCE_PRICES = {
        "metal": 10,
        "fuel": 5,
        "crystals": 25,
        "gas": 8,
    }
