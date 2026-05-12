# CURRENT STATE

## Snapshot

- Live prototype version: `v0.1.19`
- Stabilization target for the next safe pass: `v0.1.19`
- Main entry point: `web/prototype.html`
- Runtime model: plain browser scripts, `GAME_DATA` bootstrap in `game-data.js` plus layered `Object.assign(...)` overrides from split data files.

## Design Spine / общий костяк SpaceGame

В проектировочной рамке **SpaceGame** трактуется как **экономическая стратегия развития цивилизации** (от выживания до космоса), с одной сквозной экономической осью, а не как набор несвязанных мини-игр.

- **Текущий браузерный прототип** в основном покрывает **слой эпох A–B** (раннее выживание и стоянка / ранняя община) по карте эпох; это **не** вся задуманная игра, а ранний слой костяка.
- **Дальнейшие задачи** следует сверять с **картой эпох A–G** и **матрицей ключевых систем**, чтобы не углублять primitive без моста к следующему масштабу управления.
- **Новые фичи** без явного места в матрице эпох **A–G** (и без опоры в документах ниже) **не следует** включать в ближайшие спринты, пока рамка не согласована с костяком.

Документы рамки (корень репозитория):

- [`SPACEGAME_DESIGN_SPINE.md`](../SPACEGAME_DESIGN_SPINE.md)
- [`ERA_PROGRESSION_MAP.md`](../ERA_PROGRESSION_MAP.md)
- [`CORE_SYSTEMS_MATRIX.md`](../CORE_SYSTEMS_MATRIX.md)
- [`GAME_LOOP_EVOLUTION.md`](../GAME_LOOP_EVOLUTION.md)
- [`CURRENT_PROTOTYPE_GAP_ANALYSIS.md`](../CURRENT_PROTOTYPE_GAP_ANALYSIS.md)

## How The Prototype Runs

1. Open `web/prototype.html` in a browser.
2. The page loads modular CSS from `web/prototype/css/*.css`.
3. The page then loads data in this order:
   - `web/prototype/data/game-data.js`
   - `web/prototype/data/narrative.js`
   - `web/prototype/data/terrain.js`
   - `web/prototype/data/world.js`
   - `web/prototype/data/character.js`
   - `web/prototype/data/production.js`
4. Logic is initialized by `web/prototype/game-state.js`.
5. UI coordinator is `web/prototype/ui.js`, then domain UI modules extend `UI.prototype`.
6. Boot happens from `web/prototype/app.js`.

Notes:

- `web/prototype/style.css` still exists in the repo, but `web/prototype.html` does not load it.
- The runtime source of truth is the final merged `GAME_DATA`, not the first monolithic definition in `game-data.js` alone.

## Implemented Systems

- Browser prototype shell with header, sidebar, panels and modal flow.
- Local save/load via `localStorage`, periodic autosave and settings persistence.
- Early-human prologue and onboarding flow.
- Camp founding intro, candidate selection and camp entry flow.
- Local camp hex map with discovery states, gathering, pathing and tile progression.
- Camp management screen with build slots and detail panel.
- Character layer: energy, satiety, hydration, carry load, conditions and derived stats.
- Manual gathering with logistics, travel timing and phased map animation.
- Recipes, buildings, building upgrades and research tree.
- Era progress and goal tracking.
- Day/night survival loop with nightly consumption and history.
- Knowledge / insights / story event / changelog UI.

## Main Runtime Files

- `web/prototype.html` — live HTML shell, CSS/script load order, modal containers.
- `web/prototype/game-state.js` — core game logic, progression, save/load, camp map state, day cycle.
- `web/prototype/ui.js` — UI coordinator, modal binding, top-level render orchestration.
- `web/prototype/ui/map/camp-map-ui.js` — camp map rendering, travel animation, tile interaction.
- `web/prototype/data/game-data.js` — monolithic bootstrap data plus `CHANGELOG_DATA`; currently duplicates many split sections.
- `web/prototype/data/narrative.js` — effective owner of intro/onboarding/prologue narrative payloads.
- `web/prototype/data/terrain.js` — effective owner of base terrains, camp tiles and logistics.
- `web/prototype/data/world.js` — effective owner of resources, storage categories, goals, eras and energy.
- `web/prototype/data/character.js` — effective owner of character config and gather actions.
- `web/prototype/data/production.js` — effective owner of recipes, buildings, upgrades and tech.
- `web/prototype/app.js` — boot/tick wiring.

## Documentation Status

### ACTUAL

- `SPACEGAME_DESIGN_SPINE.md` (repo root — design spine)
- `ERA_PROGRESSION_MAP.md`
- `CORE_SYSTEMS_MATRIX.md`
- `GAME_LOOP_EVOLUTION.md`
- `CURRENT_PROTOTYPE_GAP_ANALYSIS.md`
- `CHANGELOG.md`
- `AI_CONTEXT.md`
- `LOCAL_CAMP_MAP_SYSTEM.md`
- `LOCAL_LOGISTICS_AND_PATHS.md`
- `CHARACTER_CORE_SYSTEM.md`
- `TASK_15_EARLY_HUMAN_PROLOGUE.md`
- `TASK_16.1_camp_management_screen_system.md`

### PARTIALLY_ACTUAL

- `TASK_06_GAME_FEEL_AND_DECISIONS.md`
- `TASK_08_TOOLTIPS_AND_HINTS.md`
- `TASK_10_STORAGE_UI_COMPRESSION.md`
- `TASK_12_BALANCE_AND_PACING.md`
- `TASK_13_PROGRESS_AND_GOALS_CLEANUP.md`
- `TASK_14_RESEARCH_SYSTEM_REWORK.md`
- `TASK_16.2_camp_management_screen_mvp.md`
- `TASK_17_UI_REFACTOR_PHASE_1.md`

### IMPLEMENTED

- `TASK_01_PROTOTYPE.md`
- `TASK_02_CORE_LOOP.md`
- `TASK_03_GOALS_NARRATIVE.md`
- `TASK_05_PRODUCTION_DEPTH.md`
- `TASK_07_SAVE_SYSTEM.md`
- `TASK_09_STORAGE_REWORK.md`
- `TASK_11_ERA_PROGRESS_SYSTEM.md`
- `TASK_18_day_night_survival_loop_agent_spec_ru.md`

### OUTDATED

- `CHARACTER_CORE_SYSTEM_1.1.md`
- `mvp_content_primitive_to_industrial.md`

### SUPERSEDED

- `TASK_04_ONBOARDING.md` — superseded by the current prologue-first start flow from `TASK_15_EARLY_HUMAN_PROLOGUE.md`.

## Known Documentation Risks

- `game-data.js` duplicates sections that are actually overridden later by split files.
- File names and in-file titles for late task documents are inconsistent:
  - `TASK_16.2_camp_management_screen_mvp.md` contains heading `TASK 17 — CAMP MANAGEMENT SCREEN MVP`
  - `TASK_17_UI_REFACTOR_PHASE_1.md` contains heading `TASK_18_UI_REFACTOR_PHASE_1`
  - `TASK_18_day_night_survival_loop_agent_spec_ru.md` contains heading `TASK_16_DAY_NIGHT_SURVIVAL_LOOP`
- Runtime version surfaces are manually repeated across `web/prototype.html`, `CHANGELOG.md` and `CHANGELOG_DATA`.

## Stabilization Reading Of The Project

- The project is no longer a single-file prototype. It already behaves like a small browser game with a live vertical slice.
- The main stabilization pressure is not missing mechanics, but ownership ambiguity, oversized central files and drift between docs and runtime.
- The safest next work is documentation alignment and source-of-truth cleanup before any more feature growth.
