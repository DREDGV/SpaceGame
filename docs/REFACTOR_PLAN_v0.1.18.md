# REFACTOR PLAN v0.1.18

## Scope

This plan is for a safe stabilization pass only.

Non-goals:

- no gameplay redesign
- no resource / building / tech / tile ID changes
- no save wipe by accident
- no large-scale rewrite of `game-state.js` or the full UI layer in one step

## P0

### 1. Lock Down Source Of Truth

- Declare split data files as effective owners:
  - `narrative.js`
  - `terrain.js`
  - `world.js`
  - `character.js`
  - `production.js`
- Stop treating `game-data.js` as the single authoritative place for all runtime values.
- Add non-functional comments where needed so future edits do not accidentally go into overridden sections.

### 2. Stabilize Documentation And Version Surfaces

- Align current docs with live runtime `v0.1.17`.
- Fix document status drift and record what is implemented vs still active.
- Record task numbering mismatches before renaming anything.

### 3. Freeze Save Contract Before More Refactors

- Keep `SAVE_VERSION = 1` until a real migration adapter exists.
- Treat the save payload as a contract that must be documented before file cleanup.
- Verify that hydration, day cycle, auto-consume and camp-map additions still load safely from existing version-1 saves.

### 4. Separate Legacy Files From Live Files

- Mark `web/prototype/style.css` as legacy / non-loaded.
- Mark `game-data.js` duplicate sections as fallback / legacy reference only.
- Do not delete either file in P0.

## P1

### 1. Remove Non-Behavioral Ambiguity

- Normalize document numbering and file titles in task/spec docs.
- Move `CHANGELOG_DATA` out of `game-data.js` into a dedicated runtime changelog file.
- Add a short data-load note in `web/prototype.html` explaining override order.

### 2. Add Static Integrity Checks

- Add a simple script that compares duplicated `GAME_DATA` sections between `game-data.js` and split files.
- Fail fast when overlapping sections diverge unexpectedly.

### 3. Continue UI Layer Separation Carefully

- Keep `ui.js` as coordinator only.
- Move remaining domain-specific rendering into existing `ui/*` modules without changing behavior.
- Do not mix UI refactor with logic refactor in the same PR.

## P2

### 1. Retire Duplicates From `game-data.js`

- Remove duplicated runtime sections only after parity checks are in place.
- Keep bootstrap-only content in `game-data.js` or replace it with a smaller bootstrap file.

### 2. Introduce Explicit Save Migration Policy

- Add versioned migrations before any future bump to `SAVE_VERSION = 2`.
- Ensure version mismatch is no longer treated as generic corruption once migrations exist.

### 3. Revisit File Layout

- Rename misnumbered task files.
- Decide whether documentation numbered tasks remain historical artifacts or active specs.
- Consider splitting `game-state.js` only after save contract and data ownership are stable.

## Risks

- Duplicate data currently hides bugs because later `Object.assign` calls silently win.
- A version bump without migration would invalidate all existing saves immediately.
- Misnumbered task/spec files create planning mistakes during future work.
- `web/prototype/style.css` can attract edits even though the live prototype does not load it.
- `game-state.js` and `ui.js` are large enough that “small safe edits” are becoming harder to verify locally.
- `CHANGELOG.md` and `CHANGELOG_DATA` can drift because they are maintained separately.

## Safe Order Of Work

1. Documentation audit and status marking.
2. Source-of-truth comments and ownership markers.
3. Version-surface alignment.
4. Static integrity checks for duplicated data.
5. Only then selective duplicate removal.
6. Only after that any save-version migration work.

## Recommended PR Breakdown

### PR 1

- docs only
- status blocks in historical task/spec files
- no runtime file changes

### PR 2

- ownership comments
- changelog/version alignment
- optional `game-data.js` legacy markers

### PR 3

- static duplicate-check tool
- misnumbered file cleanup
- still no gameplay changes

### PR 4

- selective removal of dead duplicates after parity verification
- optional save migration groundwork if needed
