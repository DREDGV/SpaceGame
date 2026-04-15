#!/usr/bin/env python3
"""
Space Economy - Игра про космос, ракеты и ресурсы
"""

import sys
import pygame
from src.game import Game


def main():
    pygame.init()
    
    game = Game()
    game.run()
    
    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
