"""
Экономическая система - торговля, цены, рынки
"""

from src.config import Config


class Economy:
    def __init__(self):
        self.market_prices = Config.RESOURCE_PRICES.copy()
        self.market_fluctuation = 0.1  # 10% изменение цен
        
    def update(self, dt):
        """Обновление экономики (изменение цен)"""
        # Здесь можно добавить динамическое изменение цен
        pass
        
    def get_price(self, resource):
        """Получить цену ресурса"""
        return self.market_prices.get(resource, 0)
        
    def buy(self, resource, amount, credits):
        """Купить ресурс"""
        cost = self.get_price(resource) * amount
        if credits >= cost:
            return True, cost
        return False, cost
        
    def sell(self, resource, amount):
        """Продать ресурс"""
        revenue = self.get_price(resource) * amount
        return revenue
