# SAVE AUDIT v0.1.18

## Current Save Contract

- Save key: `spacegame_save_v1`
- Settings key: `spacegame_settings`
- Legacy onboarding key: `spacegame_onboarding_v1`
- Save version constant: `SAVE_VERSION = 1`
- Camp-map internal schema: `schemaVersion = 1`

## Current Save Payload

Top-level payload shape:

- `version`
- `savedAt`
- `state`

Current serialized `state` fields:

- `resources`
- `resourceTotals`
- `automationProduction`
- `buildings`
- `researched`
- `unlockedRecipes`
- `maxResourceCap`
- `craftDiscount`
- `totalResourcesCollected`
- `energy`
- `satiety`
- `hydration`
- `lastManualRestAt`
- `autoConsumeFoodEnabled`
- `autoConsumeWaterEnabled`
- `characterTitle`
- `energyRegenRemainingMs`
- `dayCycle`
- `onboarding`
- `insights`
- `knowledgeEntries`
- `currentGoalIndex`
- `completedGoals`
- `allGoalsComplete`
- `currentEra`
- `eraProgress`
- `campMap`
- `craftQueue`
- `construction`
- `researchTask`
- `researchQueue`
- `automation`
- `cooldowns`
- `log`

## Serialized `dayCycle` Block

Current saved `dayCycle` fields:

- `dayNumber`
- `dayPhase`
- `actionsLeftInPhase`
- `lastNightResult`
- `dayHistory`

## Serialized `campMap` Block

Current serialized `campMap` fields:

- `revision`
- `schemaVersion`
- `orientation`
- `scaleMetersPerHex`
- `tileStates`
- `tileResourceRemaining`
- `pathLevels`
- `roadLinks`
- `tileMeta`
- `buildingPlacements`
- `selectedTileId`
- `campSetupDone`
- `campTileId`
- `campOrigin`
- `introStep`
- `surveyedCandidates`
- `campEntered`
- `characterTileId`
- `readyStoryShown`
- `appliedUpgrades`
- `campSettings`
- `generatedTiles`

## What The Loader Does Today

- `_loadGameState()` rejects payloads where `parsed.version !== SAVE_VERSION`.
- Version mismatch is treated like broken save data and falls back to a new game.
- There is no general cross-version migration layer.
- There are limited internal compatibility shims only for specific nested structures.

## Newer Systems That Need Regression Checks

These systems already exist inside save version 1 and should be regression-tested before any future cleanup:

- hydration and `maxHydration`-related character progression
- auto-consume flags for food and water
- day/night cycle state and history
- camp-map revisioned state and generated tiles
- road/path serialization
- character position on the camp map (`characterTileId`)
- research queue and active research
- active construction and craft queue
- automation state restoration and cooldown restoration
- camp settings / camp naming
- applied building upgrades

## Does The Project Need `SAVE_VERSION = 2` Right Now?

Short answer: no.

Reasoning:

- Current additions still fit inside the existing version-1 payload.
- The loader already restores optional newer fields defensively.
- Bumping `SAVE_VERSION` now would invalidate existing saves immediately because no migration layer exists.
- The safer course is to keep version 1 until a future PR introduces explicit migrations.

## When Version 2 Would Be Justified

Only after one of these happens:

- payload shape changes in a way that cannot be restored from defaults
- camp-map serialization is structurally rewritten
- resource/building/research state moves to incompatible keys
- a migration adapter is introduced and tested

## Recommendation

- Keep `SAVE_VERSION = 1` in the stabilization pass.
- Treat save compatibility as preserved.
- If version 2 is ever introduced, do it in a dedicated PR with migration code and targeted compatibility testing.
