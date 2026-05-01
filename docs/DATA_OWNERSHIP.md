# DATA OWNERSHIP

## Runtime Load Order

`web/prototype.html` loads data in this order:

1. `web/prototype/data/game-data.js`
2. `web/prototype/data/narrative.js`
3. `web/prototype/data/terrain.js`
4. `web/prototype/data/world.js`
5. `web/prototype/data/character.js`
6. `web/prototype/data/production.js`

Because the split files use `Object.assign(GAME_DATA, ...)`, later files overwrite earlier keys silently.

## Effective Owners

| File                               | Effective ownership                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `web/prototype/data/game-data.js`  | bootstrap `GAME_DATA`, shared constants/icons, `CHANGELOG_DATA`, legacy fallback definitions |
| `web/prototype/data/narrative.js`  | `campFoundingIntro`, `onboarding`, `prologue`, `insights`, `knowledgeEntries`                |
| `web/prototype/data/terrain.js`    | `baseTerrains`, `localCampMap`, `logistics`                                                  |
| `web/prototype/data/world.js`      | `goals`, `storageCategories`, `resources`, `researchBranches`, `eras`, `energy`              |
| `web/prototype/data/character.js`  | `character`, `gatherActions`                                                                 |
| `web/prototype/data/production.js` | `recipes`, `buildings`, `buildingUpgrades`, `tech`                                           |

## What `game-data.js` Still Does

`game-data.js` is not just a bootstrap. It also contains older or duplicated definitions for nearly every major data domain. At runtime those values are often replaced by later split files.

This means:

- editing `game-data.js` alone is unsafe
- runtime behavior may differ from what a reader sees in the first loaded file
- documentation and maintenance drift are likely unless ownership is explicit

## Duplicates: `game-data.js` vs `narrative.js`

### Overlapping sections

- `campFoundingIntro`
- `onboarding`
- `prologue`

### Practical duplicate examples

- `campFoundingIntro.steps[2]` text/CTA differs between the files.
- `campFoundingIntro.questIntro` differs in wording (`дерево` vs `ветки`).
- `campFoundingIntro.questSteps.camp_quest_wood.text` differs in wording.
- The broader structure of intro/onboarding/prologue is duplicated in both places.

### Effective runtime result

`narrative.js` wins, because it loads after `game-data.js`.

## Other Major Duplicates

### `game-data.js` vs `terrain.js`

- `baseTerrains`
- `localCampMap`
- `logistics`

Runtime owner: `terrain.js`

### `game-data.js` vs `world.js`

- `goals`
- `storageCategories`
- `resources`
- `researchBranches`
- `eras`
- `energy`

Runtime owner: `world.js`

### `game-data.js` vs `character.js`

- `character`
- `gatherActions`

Runtime owner: `character.js`

### `game-data.js` vs `production.js`

- `recipes`
- `buildings`
- `buildingUpgrades`
- `tech`

Runtime owner: `production.js`

## Ownership Rule For Future Work

Until a later cleanup pass lands, use this rule:

- narrative text -> edit `narrative.js`
- map / tile / path data -> edit `terrain.js`
- resources / eras / goals -> edit `world.js`
- character and gather config -> edit `character.js`
- recipes / buildings / tech -> edit `production.js`
- do not edit duplicated runtime sections in `game-data.js` unless the cleanup step explicitly targets them

For anything that can appear before its historical/technical moment, also follow `docs/PROGRESSION_PRESENTATION_GATES.md`:

- resources/actions/recipes/buildings use `presentationGate`
- local map tiles use `mapRevealGate` when they expose gated resources, actions or future roles

## What Should Be Removed Or Moved Later

These changes are recommended, but not performed in this pass.

### Remove from `game-data.js` after parity verification

- duplicated `campFoundingIntro`
- duplicated `onboarding`
- duplicated `prologue`
- duplicated `baseTerrains`
- duplicated `localCampMap`
- duplicated `logistics`
- duplicated `goals`
- duplicated `storageCategories`
- duplicated `resources`
- duplicated `researchBranches`
- duplicated `eras`
- duplicated `energy`
- duplicated `character`
- duplicated `gatherActions`
- duplicated `recipes`
- duplicated `buildings`
- duplicated `buildingUpgrades`
- duplicated `tech`

### Move out of `game-data.js`

- `CHANGELOG_DATA` -> dedicated runtime changelog data file

### Keep in a small bootstrap file

- `const GAME_DATA = {}`
- shared icon helpers/constants that are intentionally imported by later files

## Safe Cleanup Strategy

1. Mark split files as source of truth in comments.
2. Add a static parity check for duplicated keys.
3. Remove identical duplicate sections from `game-data.js` first.
4. Remove variant duplicate sections only after manual review.
5. Keep load order unchanged until duplicate removal is complete.

## Current Recommendation

Treat `game-data.js` as a legacy monolith plus bootstrap, not as the authoritative runtime file.
