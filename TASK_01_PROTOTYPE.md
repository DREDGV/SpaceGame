# TASK 01 — FIRST PLAYABLE PROTOTYPE

**Status:** IMPLEMENTED  
**Audit:** v0.1.18  
**Note:** Основной результат уже реализован; документ полезен как историческая спецификация.

## Goal

Create the first playable browser prototype for the primitive stage of the game.

## Prototype scope

Implement only the early gameplay loop:

1. Gather basic resources manually:

- wood
- stone
- clay
- fiber

2. Craft basic resources/products:

- plank
- crude_tools
- brick

3. Build first structures:

- storage
- campfire
- workshop
- kiln

4. Unlock early progression:

- basic_tools
- crafting
- mining (only as locked placeholder if needed)

## What the player should be able to do

- start with zero resources
- manually gather resources with buttons
- spend resources on recipes
- build first buildings
- see that buildings unlock new actions/options
- feel progression from manual labor toward structured production

## Required UI

At minimum:

- resource panel
- action buttons for gathering
- crafting panel
- buildings panel
- simple research/unlocks panel
- event/log panel optional

No fancy art required.

## Required architecture

Use a simple browser-only structure.

Suggested current layout:

- `web/prototype/data/game-data.js` for resources, recipes, buildings, research
- `web/prototype/game-state.js` for logic and progression
- `web/prototype/ui.js` for DOM rendering and input wiring
- `web/prototype/app.js` for the main loop and bootstrapping
- `web/prototype/style.css` for layout and visual rules

Do not add Python, Pygame, or backend scaffolding to this prototype.

## Required implementation approach

- Keep data-driven definitions where practical
- Separate game data from UI
- Avoid hardcoding everything directly in React components
- Use TypeScript types for core entities

## Acceptance criteria

The prototype is successful if:

- app runs locally
- player can gather resources
- player can craft at least 3 products
- player can build at least 3 buildings
- player can unlock at least 1 new layer of actions
- state updates correctly and visibly in UI
- code is readable and split into sensible files

## Explicit restrictions

Do not add:

- backend
- login
- multiplayer
- orbit/cosmos layer
- combat
- animations beyond tiny UI feedback
- premature optimization
- Python or Pygame runtime
