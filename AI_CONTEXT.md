# AI_CONTEXT

## Project

SpaceGame — browser strategy/economy game about long-term civilization development from primitive manual labor to industry and later space expansion.

## Important design direction

This game does NOT start from factories or rockets.
The player starts from a primitive stage:

- manual gathering
- primitive crafting
- early survival-production decisions
- gradual transition into workshops, mining, metallurgy and industrialization

Space is a later layer of the game, not an early MVP goal.

## Source of truth

Read these files before making changes:

- `mvp_content_primitive_to_industrial.md`
- `TASK_01_PROTOTYPE.md`
- `TASK_02_CORE_LOOP.md`
- `TASK_03_GOALS_NARRATIVE.md`
- `TASK_04_ONBOARDING.md`
- `TASK_05_PRODUCTION_DEPTH.md`
- `TASK_06_GAME_FEEL_AND_DECISIONS.md`
- `TASK_07_SAVE_SYSTEM.md`
- `TASK_09_STORAGE_REWORK.md`

## Current goal

Build the first playable local prototype of the primitive-to-early-production stage, deepen the production system without widening the game, improve decisions and planning, keep progress between sessions with a simple local save system, and prepare the storage UI/data for future growth without changing core storage rules.

## Non-goals for now

Do NOT implement:

- multiplayer
- backend/server
- space/orbit systems
- complex map generation
- combat
- diplomacy
- large character systems
- deep economy simulation
- visual polish beyond basic usability

## Technical direction

Prefer a simple browser prototype with clean structure and fast iteration.
Focus on game loop, state, resources, crafting, building unlocks, and minimal UI.

## Priority

Gameplay clarity > architecture perfection
Working prototype > overengineering
Small clean files > giant all-in-one file
