"""
Система управления ресурсами
"""

from src.config import Config


class ResourceManager:
    def __init__(self):
        self.player_resources = {
            "metal": Config.INITIAL_METAL,
            "fuel": Config.INITIAL_FUEL,
            "credits": Config.INITIAL_CREDITS,
        }
        self.cargo = {
            "metal": 0,
            "fuel": 0,
            "crystals": 0,
            "gas": 0,
        }
        
    def add_resource(self, resource_type, amount):
        """Добавить ресурс"""
        if resource_type in self.cargo:
            self.cargo[resource_type] += amount
            
    def remove_resource(self, resource_type, amount):
        """Удалить ресурс"""
        if resource_type in self.cargo:
            self.cargo[resource_type] -= amount
            if self.cargo[resource_type] < 0:
                self.cargo[resource_type] = 0
                
    def get_resource(self, resource_type):
        """Получить количество ресурса"""
        return self.cargo.get(resource_type, 0)
        
    def get_all_resources(self):
        """Получить все ресурсы"""
        return self.cargo.copy()
