/**
 * GameState — manages all game data, actions, progression, and save/load.
 * Pure logic, no DOM.
 */

const AUTO_STATE = {
  RUNNING: "running",
  WAITING: "waiting",
  IDLE: "idle",
};

const GAME_SAVE_KEY = "spacegame_save_v1";
const GAME_SETTINGS_KEY = "spacegame_settings";
const LEGACY_ONBOARDING_KEY = "spacegame_onboarding_v1";
const SAVE_VERSION = 1;
const MAX_SAVED_LOGS = 15;
const DEFAULT_SAVE_INTERVAL_MS = 15000;
const MIN_SAVE_INTERVAL_MS = 5000;
const MAX_SAVE_INTERVAL_MS = 300000;

class GameState {
  constructor(data) {
    this.data = data;

    this.resources = {};
    this.resourceTotals = {};
    this.automationProduction = {};
    this.buildings = {};
    this.researched = {};
    this.unlockedRecipes = new Set();
    this.maxResourceCap = 50;
    this.craftDiscount = 0;
    this.buildTimeMultiplier = 1;
    this.automationIntervalMultiplier = 1;
    this.totalResourcesCollected = 0;
    this.log = [];
    this.cooldowns = {};
    this.lastOverflow = null;

    const energyConf = data.energy;
    this.energy = energyConf.max;
    this.baseEnergyMax = energyConf.max;
    this.maxEnergy = energyConf.max;
    this.energyRegenPerTick = energyConf.regenPerTick;
    this.baseEnergyRegenInterval = energyConf.regenIntervalMs;
    this.energyRegenInterval = energyConf.regenIntervalMs;
    this.energyMaxBonus = 0;
    this.energyRegenIntervalBonusMs = 0;
    this.lastEnergyRegen = Date.now();

    this.automation = {};
    this.craftQueue = [];
    this.maxCraftQueueSize = 3;
    this.activeConstruction = null;
    this.activeResearch = null;
    this.researchQueue = [];  // max 1 queued item

    this.onboarding = this._getDefaultOnboardingState();
    this.insights = this._getDefaultInsightState();
    this.knowledgeEntries = this._getDefaultKnowledgeState();
    this.localCampMap = this._getDefaultLocalCampMapState();
    this.storyEvents = [];
    this.storyEventCounter = 0;
    this.currentGoalIndex = 0;
    this.completedGoals = [];
    this.allGoalsComplete = false;

    this.currentEra = this.data.eras.current;
    this.eraProgress = { completedMilestones: new Set() };

    this.hasUnsavedChanges = false;
    this.loadedFromSave = false;
    this.loadErrorMessage = "";
    this.isResettingProgress = false;
    this.saveMeta = {
      state: "idle",
      savedAt: 0,
      errorMessage: "",
    };
    this.saveIntervalMs = DEFAULT_SAVE_INTERVAL_MS;
    this._loadSettings();

    for (const id of Object.keys(data.resources)) {
      this.resources[id] = 0;
      this.resourceTotals[id] = 0;
      this.automationProduction[id] = 0;
    }

    this._ensureBaseRecipeUnlocks();
    this._loadGameState();
    this._recalculateDerivedState();
    this._syncLocalCampMap();

    if (this.loadErrorMessage) {
      this.addLog(this.loadErrorMessage);
    } else if (this.loadedFromSave) {
      this.addLog("💾 Прогресс восстановлен");
    }
  }

  _getDefaultOnboardingState() {
    return {
      started: false,
      skipped: false,
      completed: false,
      currentStep: 0,
    };
  }

  _sanitizeOnboarding(raw) {
    return {
      started: !!raw?.started,
      skipped: !!raw?.skipped,
      completed: !!raw?.completed,
      currentStep: Number.isFinite(raw?.currentStep) ? raw.currentStep : 0,
    };
  }

  _getDefaultInsightState() {
    const state = {};
    for (const id of Object.keys(this.data.prologue?.insights || {})) {
      state[id] = false;
    }
    return state;
  }

  _getDefaultKnowledgeState() {
    const state = {};
    for (const id of Object.keys(this.data.prologue?.knowledgeEntries || {})) {
      state[id] = false;
    }
    return state;
  }

  _getDefaultLocalCampMapState() {
    const tileStates = {};
    const tileResourceRemaining = {};
    const tiles = this.data.localCampMap?.tiles || {};

    for (const [tileId, tile] of Object.entries(tiles)) {
      tileStates[tileId] = tile.state || "hidden";
      if (tile.resourceType) {
        tileResourceRemaining[tileId] = Number.isFinite(tile.resourceAmount)
          ? tile.resourceAmount
          : null;
      }
    }

    return {
      tileStates,
      tileResourceRemaining,
      buildingPlacements: {},
      selectedTileId: "camp_clearing",
    };
  }

  _sanitizeCampMapState(raw) {
    const defaults = this._getDefaultLocalCampMapState();
    const tiles = this.data.localCampMap?.tiles || {};
    const validStates = new Set(["hidden", "discovered", "exploited", "settled"]);

    for (const tileId of Object.keys(defaults.tileStates)) {
      const state = raw?.tileStates?.[tileId];
      if (typeof state === "string" && validStates.has(state)) {
        defaults.tileStates[tileId] = state;
      }

      if (Object.prototype.hasOwnProperty.call(defaults.tileResourceRemaining, tileId)) {
        const remaining = raw?.tileResourceRemaining?.[tileId];
        defaults.tileResourceRemaining[tileId] = Number.isFinite(remaining)
          ? Math.max(0, remaining)
          : defaults.tileResourceRemaining[tileId];
      }
    }

    for (const [buildingId, tileId] of Object.entries(
      raw?.buildingPlacements || {},
    )) {
      if (!this.data.buildings[buildingId] || !tiles[tileId]) continue;
      defaults.buildingPlacements[buildingId] = tileId;
    }

    if (tiles[raw?.selectedTileId]) {
      defaults.selectedTileId = raw.selectedTileId;
    }

    return defaults;
  }

  _getCampTileStateRank(state) {
    switch (state) {
      case "settled":
        return 3;
      case "exploited":
        return 2;
      case "discovered":
        return 1;
      default:
        return 0;
    }
  }

  _getHigherCampTileState(currentState, nextState) {
    return this._getCampTileStateRank(nextState) >
      this._getCampTileStateRank(currentState)
      ? nextState
      : currentState;
  }

  _setCampTileState(tileId, nextState) {
    if (
      !Object.prototype.hasOwnProperty.call(
        this.localCampMap.tileStates,
        tileId,
      )
    ) {
      return false;
    }
    const currentState = this.localCampMap.tileStates[tileId];
    const mergedState = this._getHigherCampTileState(currentState, nextState);
    if (mergedState === currentState) return false;
    this.localCampMap.tileStates[tileId] = mergedState;
    return true;
  }

  _markCampTileExploited(tileId) {
    if (!tileId) return false;
    return this._setCampTileState(tileId, "exploited");
  }

  _serializeCampMap() {
    return {
      tileStates: { ...this.localCampMap.tileStates },
      tileResourceRemaining: { ...this.localCampMap.tileResourceRemaining },
      buildingPlacements: { ...this.localCampMap.buildingPlacements },
      selectedTileId: this.localCampMap.selectedTileId || null,
    };
  }

  _restoreCampMap(savedCampMap) {
    this.localCampMap = this._sanitizeCampMapState(savedCampMap);
  }

  _sanitizeBooleanMap(raw, defs) {
    const state = {};
    for (const id of Object.keys(defs || {})) {
      state[id] = !!raw?.[id];
    }
    return state;
  }

  _cloneMapFromSource(target, source) {
    for (const key of Object.keys(target)) {
      const value = source && Number.isFinite(source[key]) ? source[key] : 0;
      target[key] = value;
    }
  }

  _ensureBaseRecipeUnlocks() {
    for (const [id, recipe] of Object.entries(this.data.recipes)) {
      if (!recipe.requires && !recipe.unlockedBy) {
        this.unlockedRecipes.add(id);
      }
    }
  }

  _recalculateDerivedState() {
    this.unlockedRecipes = new Set();
    this._ensureBaseRecipeUnlocks();

    let maxResourceCap = 50;
    let craftDiscount = 0;
    let buildTimeMultiplier = 1;
    let automationIntervalMultiplier = 1;

    for (const techId of Object.keys(this.researched)) {
      const tech = this.data.tech[techId];
      if (!tech) continue;
      if (tech.effect?.craftDiscount) {
        craftDiscount = Math.max(craftDiscount, tech.effect.craftDiscount);
      }
      if (tech.effect?.buildTimeMultiplier) {
        buildTimeMultiplier *= tech.effect.buildTimeMultiplier;
      }
      if (tech.effect?.automationIntervalMultiplier) {
        automationIntervalMultiplier *= tech.effect.automationIntervalMultiplier;
      }
      for (const [recipeId, recipe] of Object.entries(this.data.recipes)) {
        if (recipe.unlockedBy === techId) {
          this.unlockedRecipes.add(recipeId);
        }
      }
    }

    for (const buildingId of Object.keys(this.buildings)) {
      const building = this.data.buildings[buildingId];
      if (!building) continue;

      if (building.effect?.maxResourceCap) {
        maxResourceCap = Math.max(
          maxResourceCap,
          building.effect.maxResourceCap,
        );
      }

      if (building.effect?.unlocks) {
        for (const recipeId of building.effect.unlocks) {
          this.unlockedRecipes.add(recipeId);
        }
      }

      for (const [recipeId, recipe] of Object.entries(this.data.recipes)) {
        if (recipe.requires === buildingId) {
          this.unlockedRecipes.add(recipeId);
        }
      }
    }

    this.maxResourceCap = maxResourceCap;
    this.craftDiscount = craftDiscount;
    this.buildTimeMultiplier = buildTimeMultiplier;
    this.automationIntervalMultiplier = automationIntervalMultiplier;
    this._recalculateEnergyStats();
    this._recalculateEraProgress();
  }

  _ensureCampBuildingPlacements() {
    const mapTiles = this.data.localCampMap?.tiles || {};

    for (const buildingId of Object.keys(this.buildings)) {
      if (this.localCampMap.buildingPlacements[buildingId]) continue;
      const tileId = this._getPreferredCampBuildTile(buildingId);
      if (tileId && mapTiles[tileId]) {
        this.localCampMap.buildingPlacements[buildingId] = tileId;
      }
    }

    if (
      this.activeConstruction?.buildingId &&
      !this.activeConstruction.tileId
    ) {
      this.activeConstruction.tileId = this._getPreferredCampBuildTile(
        this.activeConstruction.buildingId,
      );
    }
  }

  _syncLocalCampMap({ pushStory = false } = {}) {
    const tiles = this.data.localCampMap?.tiles || {};
    const newlyDiscovered = [];

    this._ensureCampBuildingPlacements();

    for (const [tileId, tile] of Object.entries(tiles)) {
      const previousState =
        this.localCampMap.tileStates[tileId] || tile.state || "hidden";

      let desiredState = tile.state || "hidden";
      if (
        tile.discoveryRequirements &&
        typeof tile.discoveryRequirements === "function" &&
        tile.discoveryRequirements(this)
      ) {
        desiredState = "discovered";
      }

      const placedBuildingId = this.getCampPlacedBuildingId(tileId);
      if (placedBuildingId) {
        desiredState = "settled";
      } else if (this.activeConstruction?.tileId === tileId) {
        desiredState = this._getHigherCampTileState(desiredState, "exploited");
      }

      const nextState = this._getHigherCampTileState(previousState, desiredState);
      this.localCampMap.tileStates[tileId] = nextState;

      if (
        previousState === "hidden" &&
        this._getCampTileStateRank(nextState) >=
          this._getCampTileStateRank("discovered")
      ) {
        newlyDiscovered.push(tile.name);
      }
    }

    this._ensureSelectedCampTile();

    if (pushStory && newlyDiscovered.length > 0) {
      const names = newlyDiscovered.slice(0, 3).join(", ");
      this.addLog(`🧭 Замечены новые места вокруг лагеря: ${names}.`);
      this._pushStoryEvent({
        type: "map",
        icon: "🧭",
        title: "Открыты новые клетки лагеря",
        text:
          newlyDiscovered.length > 3
            ? `${names} и ещё ${newlyDiscovered.length - 3} участка.`
            : names,
        ttlMs: 6500,
      });
      this.markDirty();
    }
  }

  syncCampMap() {
    this._syncLocalCampMap({ pushStory: true });
  }

  _ensureSelectedCampTile() {
    const tiles = this.data.localCampMap?.tiles || {};
    const currentId = this.localCampMap.selectedTileId;
    if (
      currentId &&
      tiles[currentId] &&
      this.getCampTileState(currentId) !== "hidden"
    ) {
      return;
    }

    const discovered = Object.values(tiles)
      .filter((tile) => this.getCampTileState(tile.id) !== "hidden")
      .sort(
        (a, b) =>
          (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      );

    this.localCampMap.selectedTileId = discovered[0]?.id || null;
  }

  getCampTileState(tileId) {
    return this.localCampMap.tileStates[tileId] || "hidden";
  }

  getCampPlacedBuildingId(tileId) {
    for (const [buildingId, placedTileId] of Object.entries(
      this.localCampMap.buildingPlacements,
    )) {
      if (placedTileId === tileId && this.buildings[buildingId]) {
        return buildingId;
      }
    }
    return null;
  }

  getBuildingPlacement(buildingId) {
    return this.localCampMap.buildingPlacements[buildingId] || null;
  }

  _getMappedCampTilesForAction(actionId) {
    return Object.values(this.data.localCampMap?.tiles || {})
      .filter((tile) => tile.actionId === actionId)
      .sort(
        (a, b) =>
          (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      );
  }

  _getCampTileResourceRemaining(tileId) {
    return Object.prototype.hasOwnProperty.call(
      this.localCampMap.tileResourceRemaining,
      tileId,
    )
      ? this.localCampMap.tileResourceRemaining[tileId]
      : null;
  }

  _isCampTileResourceDepleted(tileId) {
    const remaining = this._getCampTileResourceRemaining(tileId);
    return Number.isFinite(remaining) && remaining <= 0;
  }

  _getPreferredCampGatherTile(actionId, preferredTileId = null) {
    const tiles = this._getMappedCampTilesForAction(actionId);
    if (!tiles.length) return null;

    const canUseTile = (tile) =>
      tile &&
      this.getCampTileState(tile.id) !== "hidden" &&
      !this._isCampTileResourceDepleted(tile.id);

    if (preferredTileId) {
      const preferred = tiles.find((tile) => tile.id === preferredTileId);
      if (canUseTile(preferred)) return preferred;
    }

    const selected = tiles.find(
      (tile) => tile.id === this.getSelectedCampTileId(),
    );
    if (canUseTile(selected)) return selected;

    return tiles.find((tile) => canUseTile(tile)) || null;
  }

  _getMappedCampTileForAction(actionId) {
    return this._getPreferredCampGatherTile(actionId);
  }

  _canBuildOnTile(buildingId, tileId) {
    const tile = this.data.localCampMap?.tiles?.[tileId];
    if (!tile) return false;
    if (!Array.isArray(tile.buildOptions) || !tile.buildOptions.includes(buildingId)) {
      return false;
    }
    if (this.getCampTileState(tileId) === "hidden") return false;
    if (
      this.activeConstruction?.tileId &&
      this.activeConstruction.tileId !== tileId
    ) {
      return false;
    }

    const placedBuildingId = this.getCampPlacedBuildingId(tileId);
    if (placedBuildingId && placedBuildingId !== buildingId) return false;
    return true;
  }

  _getPreferredCampBuildTile(buildingId, preferredTileId = null) {
    const tiles = Object.values(this.data.localCampMap?.tiles || {});
    if (!tiles.length) return null;

    if (preferredTileId && this._canBuildOnTile(buildingId, preferredTileId)) {
      return preferredTileId;
    }

    const placed = this.getBuildingPlacement(buildingId);
    if (placed && this._canBuildOnTile(buildingId, placed)) {
      return placed;
    }

    const match = tiles
      .filter((tile) => this._canBuildOnTile(buildingId, tile.id))
      .sort(
        (a, b) =>
          (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      )[0];

    return match?.id || null;
  }

  selectCampTile(tileId) {
    const tile = this.data.localCampMap?.tiles?.[tileId];
    if (!tile || this.getCampTileState(tileId) === "hidden") return false;
    this.localCampMap.selectedTileId = tileId;
    return true;
  }

  getSelectedCampTileId() {
    this._ensureSelectedCampTile();
    return this.localCampMap.selectedTileId;
  }

  getSelectedCampTile() {
    const tileId = this.getSelectedCampTileId();
    return tileId ? this.data.localCampMap?.tiles?.[tileId] || null : null;
  }

  getCampMapState() {
    const mapData = this.data.localCampMap || {};
    const selectedTileId = this.getSelectedCampTileId();
    const tiles = Object.values(mapData.tiles || {})
      .sort(
        (a, b) =>
          (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      )
      .map((tile) => {
        const state = this.getCampTileState(tile.id);
        const buildingId = this.getCampPlacedBuildingId(tile.id);
        const building = buildingId ? this.data.buildings[buildingId] : null;
        const construction =
          this.activeConstruction?.tileId === tile.id
            ? this.getConstructionState()
            : null;

        return {
          ...tile,
          state,
          selected: tile.id === selectedTileId,
          buildingId,
          building,
          construction,
          resourceRemaining: this._getCampTileResourceRemaining(tile.id),
          resourceCapacity: Number.isFinite(tile.resourceAmount)
            ? tile.resourceAmount
            : null,
          isDepleted: this._isCampTileResourceDepleted(tile.id),
        };
      });

    return {
      title: mapData.title || "Локальная карта лагеря",
      description: mapData.description || "",
      interactionHint: mapData.interactionHint || "",
      selectedTileId,
      discoveredCount: tiles.filter((tile) => tile.state !== "hidden").length,
      settledCount: tiles.filter((tile) => tile.state === "settled").length,
      totalCount: tiles.length,
      tiles,
    };
  }

  getCampMapTileDetails(tileId = this.getSelectedCampTileId()) {
    const tile = this.data.localCampMap?.tiles?.[tileId];
    if (!tile) return null;

    const state = this.getCampTileState(tileId);
    const placedBuildingId = this.getCampPlacedBuildingId(tileId);
    const placedBuilding = placedBuildingId
      ? this.data.buildings[placedBuildingId]
      : null;
    const construction =
      this.activeConstruction?.tileId === tileId
        ? this.getConstructionState()
        : null;
    const action = tile.actionId ? this.data.gatherActions[tile.actionId] : null;

    let nextBuildId = null;
    if (Array.isArray(tile.buildOptions)) {
      nextBuildId =
        tile.buildOptions.find((buildingId) => !this.buildings[buildingId]) ||
        tile.buildOptions[0] ||
        null;
    }
    const nextBuilding = nextBuildId ? this.data.buildings[nextBuildId] : null;

    return {
      ...tile,
      state,
      action,
      placedBuildingId,
      placedBuilding,
      construction,
      nextBuildId,
      nextBuilding,
      resourceRemaining: this._getCampTileResourceRemaining(tileId),
      resourceCapacity: Number.isFinite(tile.resourceAmount)
        ? tile.resourceAmount
        : null,
      isDepleted: this._isCampTileResourceDepleted(tileId),
      canGather: action ? this.canGather(action.id, { tileId }) : false,
      canBuild:
        nextBuildId && !placedBuildingId
          ? this._canBuildOnTile(nextBuildId, tileId) && this.canBuild(nextBuildId)
          : false,
    };
  }

  performCampTileAction(tileId) {
    const details = this.getCampMapTileDetails(tileId);
    if (!details || details.state === "hidden") return false;

    if (details.action) {
      this.selectCampTile(tileId);
      return this.gather(details.action.id, { tileId });
    }

    if (
      details.nextBuildId &&
      !details.placedBuildingId &&
      this._canBuildOnTile(details.nextBuildId, tileId)
    ) {
      this.selectCampTile(tileId);
      return this.build(details.nextBuildId);
    }

    return false;
  }

  _getEraData(eraId = this.currentEra) {
    return this.data.eras[eraId];
  }

  getEraData(eraId = this.currentEra) {
    return this._getEraData(eraId);
  }

  _recalculateEraProgress() {
    const eraData = this._getEraData();
    if (!eraData) return;

    this.eraProgress.completedMilestones.clear();

    for (const milestone of eraData.milestones) {
      if (milestone.check(this)) {
        this.eraProgress.completedMilestones.add(milestone.id);
      }
    }

    this.transitionToNextEra();
  }

  getEraProgress() {
    const eraData = this._getEraData();
    if (!eraData)
      return { progress: 0, total: 0, completed: 0, milestones: [] };

    const completed = this.eraProgress.completedMilestones.size;
    const total = eraData.milestones.length;
    return {
      progress: total > 0 ? completed / total : 0,
      total,
      completed,
      milestones: eraData.milestones.map((m) => ({
        ...m,
        completed: this.eraProgress.completedMilestones.has(m.id),
      })),
    };
  }

  transitionToNextEra() {
    const eraData = this._getEraData();
    if (!eraData || !eraData.nextEra) return false;

    const progress = this.getEraProgress();
    if (progress.progress < 1) return false;

    this.currentEra = eraData.nextEra;
    this.eraProgress.completedMilestones.clear();
    this.addLog(
      `🌟 Эпоха завершена! Добро пожаловать в ${this._getEraData().name}`,
    );
    this.markDirty();
    this.saveGame(true);
    return true;
  }

  toggleAutomation(buildingId) {
    if (!this.buildings[buildingId]) return false;

    const buildingData = this.buildings[buildingId];
    buildingData.isAutomationRunning = !buildingData.isAutomationRunning;

    const building = this.data.buildings[buildingId];
    const auto = building?.effect?.automation;
    if (auto) {
      if (!buildingData.isAutomationRunning) {
        // Stop automation
        if (this.automation[auto.id]) {
          this.automation[auto.id].state = AUTO_STATE.IDLE;
        }
        this.addLog(
          `⏸️ Автоматизация остановлена: ${building.icon} ${building.name}`,
        );
      } else {
        // Start automation
        if (this.automation[auto.id]) {
          this.automation[auto.id].state = AUTO_STATE.WAITING;
        }
        this.addLog(
          `▶️ Автоматизация запущена: ${building.icon} ${building.name}`,
        );
      }
    }

    this.markDirty();
    return true;
  }

  _serializeCooldowns() {
    const now = Date.now();
    const payload = {};
    for (const [id, endsAt] of Object.entries(this.cooldowns)) {
      const remainingMs = Math.max(0, endsAt - now);
      if (remainingMs > 0) {
        payload[id] = remainingMs;
      }
    }
    return payload;
  }

  _restoreCooldowns(savedCooldowns) {
    this.cooldowns = {};
    const now = Date.now();
    for (const [id, remainingMs] of Object.entries(savedCooldowns || {})) {
      if (!this.data.gatherActions[id]) continue;
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) continue;
      this.cooldowns[id] = now + remainingMs;
    }
  }

  _serializeCraftQueue() {
    const now = Date.now();
    return this.craftQueue.map((job, index) => {
      const remainingMs =
        index === 0 && job.startedAt
          ? Math.max(0, job.durationMs - (now - job.startedAt))
          : job.durationMs;
      return {
        recipeId: job.recipeId,
        durationMs: job.durationMs,
        remainingMs,
        isActive: index === 0,
      };
    });
  }

  _restoreCraftQueue(savedQueue) {
    this.craftQueue = [];
    const now = Date.now();
    const normalizedQueue = Array.isArray(savedQueue)
      ? savedQueue.slice(0, this.maxCraftQueueSize)
      : [];

    normalizedQueue.forEach((job, index) => {
      const recipe = this.data.recipes[job.recipeId];
      if (!recipe) return;

      const durationMs = Number.isFinite(job.durationMs)
        ? job.durationMs
        : recipe.craftTimeMs || 3000;
      const remainingMs = Number.isFinite(job.remainingMs)
        ? Math.max(0, Math.min(durationMs, job.remainingMs))
        : durationMs;

      this.craftQueue.push({
        recipeId: job.recipeId,
        durationMs,
        startedAt: index === 0 ? now - (durationMs - remainingMs) : null,
      });
    });
  }

  _serializeConstruction() {
    if (!this.activeConstruction) return null;

    const now = Date.now();
    const remainingMs = Math.max(
      0,
      this.activeConstruction.durationMs -
        (now - this.activeConstruction.startedAt),
    );

    return {
      buildingId: this.activeConstruction.buildingId,
      tileId: this.activeConstruction.tileId || null,
      durationMs: this.activeConstruction.durationMs,
      remainingMs,
    };
  }

  _restoreConstruction(savedConstruction) {
    this.activeConstruction = null;
    if (
      !savedConstruction ||
      !this.data.buildings[savedConstruction.buildingId]
    ) {
      return;
    }

    const durationMs = Number.isFinite(savedConstruction.durationMs)
      ? savedConstruction.durationMs
      : this.getBuildDuration(savedConstruction.buildingId);
    const remainingMs = Number.isFinite(savedConstruction.remainingMs)
      ? Math.max(0, Math.min(durationMs, savedConstruction.remainingMs))
      : durationMs;

    this.activeConstruction = {
      buildingId: savedConstruction.buildingId,
      tileId:
        typeof savedConstruction.tileId === "string"
          ? savedConstruction.tileId
          : null,
      durationMs,
      startedAt: Date.now() - (durationMs - remainingMs),
    };
  }

  _serializeResearchTask() {
    if (!this.activeResearch) return null;

    const now = Date.now();
    const remainingMs = Math.max(
      0,
      this.activeResearch.durationMs - (now - this.activeResearch.startedAt),
    );

    return {
      techId: this.activeResearch.techId,
      durationMs: this.activeResearch.durationMs,
      remainingMs,
    };
  }

  _serializeResearchQueue() {
    return this.researchQueue.map((q) => ({ ...q }));
  }

  _restoreResearchQueue(savedQueue) {
    this.researchQueue = [];
    if (!Array.isArray(savedQueue)) return;
    for (const item of savedQueue) {
      if (item?.techId && this.data.tech[item.techId] && !this.researched[item.techId]) {
        this.researchQueue.push({
          techId: item.techId,
          spentResources: typeof item.spentResources === "object" && item.spentResources ? { ...item.spentResources } : {},
        });
      }
    }
  }

  _restoreResearchTask(savedResearch) {
    this.activeResearch = null;
    if (!savedResearch || !this.data.tech[savedResearch.techId]) {
      return;
    }

    const durationMs = Number.isFinite(savedResearch.durationMs)
      ? savedResearch.durationMs
      : this.getResearchDuration(savedResearch.techId);
    const remainingMs = Number.isFinite(savedResearch.remainingMs)
      ? Math.max(0, Math.min(durationMs, savedResearch.remainingMs))
      : durationMs;

    this.activeResearch = {
      techId: savedResearch.techId,
      durationMs,
      startedAt: Date.now() - (durationMs - remainingMs),
    };
  }

  _serializeAutomation() {
    const now = Date.now();
    const payload = {};

    for (const [autoId, entry] of Object.entries(this.automation)) {
      let remainingMs = 0;
      if (entry.lastRun > 0) {
        const autoDef = this.getAutomationDefinition(autoId);
        if (autoDef) {
          remainingMs = Math.max(
            0,
            this.getEffectiveAutomationInterval(autoDef) -
              (now - entry.lastRun),
          );
        }
      }

      payload[autoId] = {
        state: entry.state,
        remainingMs,
      };
    }

    return payload;
  }

  _restoreAutomation(savedAutomation) {
    this.automation = {};
    const now = Date.now();

    for (const [autoId, entry] of Object.entries(savedAutomation || {})) {
      const autoDef = this.getAutomationDefinition(autoId);
      if (!autoDef) continue;
      const intervalMs = this.getEffectiveAutomationInterval(autoDef);

      const remainingMs = Number.isFinite(entry.remainingMs)
        ? Math.max(0, Math.min(intervalMs, entry.remainingMs))
        : 0;

      this.automation[autoId] = {
        state: entry.state || AUTO_STATE.IDLE,
        lastRun:
          entry.state === AUTO_STATE.RUNNING && remainingMs > 0
            ? now - (intervalMs - remainingMs)
            : 0,
      };
    }
  }

  _buildSavePayload() {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state: {
        resources: { ...this.resources },
        resourceTotals: { ...this.resourceTotals },
        automationProduction: { ...this.automationProduction },
        buildings: { ...this.buildings },
        researched: { ...this.researched },
        unlockedRecipes: Array.from(this.unlockedRecipes),
        maxResourceCap: this.maxResourceCap,
        craftDiscount: this.craftDiscount,
        totalResourcesCollected: this.totalResourcesCollected,
        energy: this.energy,
        energyRegenRemainingMs: this.getEnergyRegenRemaining(),
        onboarding: { ...this.onboarding },
        insights: { ...this.insights },
        knowledgeEntries: { ...this.knowledgeEntries },
        currentGoalIndex: this.currentGoalIndex,
        completedGoals: [...this.completedGoals],
        allGoalsComplete: this.allGoalsComplete,
        currentEra: this.currentEra,
        eraProgress: {
          completedMilestones: Array.from(this.eraProgress.completedMilestones),
        },
        campMap: this._serializeCampMap(),
        craftQueue: this._serializeCraftQueue(),
        construction: this._serializeConstruction(),
        researchTask: this._serializeResearchTask(),
        researchQueue: this._serializeResearchQueue(),
        automation: this._serializeAutomation(),
        cooldowns: this._serializeCooldowns(),
        log: this.log.slice(0, MAX_SAVED_LOGS),
      },
    };
  }

  _applySaveState(state) {
    this._cloneMapFromSource(this.resources, state.resources);
    this._cloneMapFromSource(this.resourceTotals, state.resourceTotals);
    this._cloneMapFromSource(
      this.automationProduction,
      state.automationProduction,
    );

    this.buildings =
      typeof state.buildings === "object" && state.buildings
        ? { ...state.buildings }
        : {};

    // Migrate old format (number) to new (object)
    for (const [id, data] of Object.entries(this.buildings)) {
      if (typeof data === "number") {
        this.buildings[id] = { count: data, isAutomationRunning: true };
      } else if (typeof data === "object" && data !== null) {
        if (data.isAutomationRunning === undefined)
          data.isAutomationRunning = true;
      }
    }

    this.researched =
      typeof state.researched === "object" && state.researched
        ? { ...state.researched }
        : {};
    this.unlockedRecipes = new Set(
      Array.isArray(state.unlockedRecipes) ? state.unlockedRecipes : [],
    );

    this.totalResourcesCollected = Number.isFinite(
      state.totalResourcesCollected,
    )
      ? state.totalResourcesCollected
      : 0;

    this.onboarding = this._sanitizeOnboarding(state.onboarding);
    this.insights = this._sanitizeBooleanMap(
      state.insights,
      this.data.prologue?.insights,
    );
    this.knowledgeEntries = this._sanitizeBooleanMap(
      state.knowledgeEntries,
      this.data.prologue?.knowledgeEntries,
    );
    this.currentGoalIndex = Number.isFinite(state.currentGoalIndex)
      ? Math.max(0, Math.min(this.data.goals.length, state.currentGoalIndex))
      : 0;
    this.completedGoals = Array.isArray(state.completedGoals)
      ? state.completedGoals.filter((id) =>
          this.data.goals.some((goal) => goal.id === id),
        )
      : [];
    this.allGoalsComplete = !!state.allGoalsComplete;

    this.currentEra =
      typeof state.currentEra === "string"
        ? state.currentEra
        : this.data.eras.current;
    this.eraProgress = {
      completedMilestones: new Set(
        Array.isArray(state.eraProgress?.completedMilestones)
          ? state.eraProgress.completedMilestones
          : [],
      ),
    };

    this.log = Array.isArray(state.log)
      ? state.log.slice(0, MAX_SAVED_LOGS)
      : [];
    this._restoreCampMap(state.campMap);

    this._recalculateDerivedState();

    this.energy = Number.isFinite(state.energy)
      ? Math.max(0, Math.min(this.maxEnergy, state.energy))
      : this.maxEnergy;
    const regenRemainingMs = Number.isFinite(state.energyRegenRemainingMs)
      ? Math.max(
          0,
          Math.min(this.energyRegenInterval, state.energyRegenRemainingMs),
        )
      : this.energyRegenInterval;
    this.lastEnergyRegen =
      Date.now() - (this.energyRegenInterval - regenRemainingMs);

    this._restoreCraftQueue(state.craftQueue);
    this._restoreConstruction(state.construction);
    this._restoreResearchTask(state.researchTask);
    this._restoreResearchQueue(state.researchQueue);
    this._restoreAutomation(state.automation);
    this._restoreCooldowns(state.cooldowns);
  }

  _loadLegacyOnboarding() {
    try {
      const raw = localStorage.getItem(LEGACY_ONBOARDING_KEY);
      if (!raw) return this._getDefaultOnboardingState();
      return this._sanitizeOnboarding(JSON.parse(raw));
    } catch (error) {
      return this._getDefaultOnboardingState();
    }
  }

  _loadGameState() {
    try {
      const raw = localStorage.getItem(GAME_SAVE_KEY);
      if (!raw) {
        this.onboarding = this._loadLegacyOnboarding();
        return false;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SAVE_VERSION || !parsed.state) {
        throw new Error("invalid save payload");
      }

      this._applySaveState(parsed.state);
      this.loadedFromSave = true;
      this.saveMeta = {
        state: "saved",
        savedAt: Number.isFinite(parsed.savedAt) ? parsed.savedAt : Date.now(),
        errorMessage: "",
      };
      return true;
    } catch (error) {
      this.loadErrorMessage = "⚠️ Сохранение повреждено. Запущена новая игра.";
      this.onboarding = this._loadLegacyOnboarding();
      this._clearSaveStorage();
      return false;
    }
  }

  _clearSaveStorage() {
    try {
      localStorage.removeItem(GAME_SAVE_KEY);
      localStorage.removeItem(LEGACY_ONBOARDING_KEY);
    } catch (error) {
      // ignore
    }
  }

  markDirty() {
    this.hasUnsavedChanges = true;
  }

  // --- Settings (stored separately from save data) ---

  _loadSettings() {
    try {
      const raw = localStorage.getItem(GAME_SETTINGS_KEY);
      if (!raw) return;
      const settings = JSON.parse(raw);
      if (
        Number.isFinite(settings.saveIntervalMs) &&
        settings.saveIntervalMs >= MIN_SAVE_INTERVAL_MS
      ) {
        this.saveIntervalMs = Math.min(
          MAX_SAVE_INTERVAL_MS,
          settings.saveIntervalMs,
        );
      }
    } catch (_) {
      // ignore
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem(
        GAME_SETTINGS_KEY,
        JSON.stringify({
          saveIntervalMs: this.saveIntervalMs,
        }),
      );
    } catch (_) {
      // ignore
    }
  }

  setSaveInterval(ms) {
    const clamped = Math.max(
      MIN_SAVE_INTERVAL_MS,
      Math.min(MAX_SAVE_INTERVAL_MS, Math.round(ms)),
    );
    this.saveIntervalMs = clamped;
    this._saveSettings();
    return clamped;
  }

  getSaveIntervalSec() {
    return Math.round(this.saveIntervalMs / 1000);
  }

  getSaveIntervalLabel() {
    const totalSec = this.getSaveIntervalSec();
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;

    if (minutes <= 0) return `${totalSec}с`;
    if (seconds === 0) return `${minutes}м`;
    return `${minutes}м ${seconds}с`;
  }

  saveGame(force = false) {
    if (this.isResettingProgress) return false;
    if (!force && !this.hasUnsavedChanges) return false;

    try {
      const payload = this._buildSavePayload();
      localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
      this.hasUnsavedChanges = false;
      this.saveMeta = {
        state: "saved",
        savedAt: payload.savedAt,
        errorMessage: "",
      };
      return true;
    } catch (error) {
      this.saveMeta = {
        state: "error",
        savedAt: this.saveMeta.savedAt,
        errorMessage: "Не удалось сохранить прогресс",
      };
      return false;
    }
  }

  autoSaveIfNeeded(force = false) {
    if (this.isResettingProgress) return false;
    // Periodic autosave persists routine progress.
    // Immediate saves are reserved for rare, high-value events like
    // building/research start-complete, onboarding state changes and era transitions.
    if (!force && !this.hasUnsavedChanges) return false;
    return this.saveGame(true);
  }

  getSaveStatus() {
    if (this.saveMeta.state === "error") {
      return {
        state: "error",
        text: this.saveMeta.errorMessage || "Ошибка сохранения",
      };
    }

    if (this.saveMeta.savedAt > 0) {
      const ageMs = Date.now() - this.saveMeta.savedAt;
      if (ageMs < 2000) {
        return {
          state: "saved",
          text: "✓ Сохранено",
        };
      }
      return {
        state: "idle",
        text: `Автосохр. ${this.getSaveIntervalLabel()}`,
      };
    }

    return {
      state: "idle",
      text: "Новая игра",
    };
  }

  resetProgress() {
    try {
      this.isResettingProgress = true;
      this._clearSaveStorage();
      return true;
    } catch (error) {
      this.isResettingProgress = false;
      return false;
    }
  }

  isOnboardingActive() {
    return !this.onboarding.skipped && !this.onboarding.completed;
  }

  isPrologueActive() {
    return this.isOnboardingActive();
  }

  _pushStoryEvent(event) {
    if (!event) return;
    this.storyEventCounter += 1;
    this.storyEvents.push({
      id: `story-${Date.now()}-${this.storyEventCounter}`,
      createdAt: Date.now(),
      ttlMs: event.ttlMs || 7000,
      ...event,
    });
  }

  _pruneStoryEvents() {
    const now = Date.now();
    this.storyEvents = this.storyEvents.filter(
      (event) => now - event.createdAt < event.ttlMs,
    );
  }

  getActiveStoryEvent() {
    this._pruneStoryEvents();
    return this.storyEvents[0] || null;
  }

  dismissStoryEvent(eventId) {
    if (!eventId) return;
    this.storyEvents = this.storyEvents.filter((event) => event.id !== eventId);
  }

  shouldShowOnboardingIntro() {
    return this.isOnboardingActive() && !this.onboarding.started;
  }

  startOnboarding() {
    if (!this.isOnboardingActive()) return;
    this.onboarding.started = true;
    if (this.data.prologue?.startKnowledgeEntryId) {
      this._unlockKnowledgeEntry(this.data.prologue.startKnowledgeEntryId, {
        pushStory: false,
      });
    }
    this.addLog("🌄 Начались первые поиски.");
    this._pushStoryEvent({
      type: "prologue",
      icon: "🌄",
      title: "Холодная стоянка и первые поиски",
      text:
        "Около 12 тысяч лет назад мир уже меняется после льда, но ночь всё ещё холодна. Сначала нужно понять, что можно удержать в руках и что поможет пережить темноту.",
      ttlMs: 7000,
    });
    this._syncLocalCampMap();
    this.markDirty();
    this.saveGame(true);
  }

  skipOnboarding() {
    this.onboarding.started = false;
    this.onboarding.skipped = true;
    this.addLog("⏭️ Пролог пропущен — переход к primitive-эпохе");
    this._syncLocalCampMap();
    this.markDirty();
    this.saveGame(true);
  }

  completeOnboarding() {
    this.onboarding.started = false;
    this.onboarding.completed = true;
    this.addLog("🌄 Пролог завершён");
    this.addLog("→ Теперь община готова к более оформленной primitive-эпохе.");
    this._pushStoryEvent({
      type: "transition",
      icon: "🔥",
      title: this.data.prologue?.transitionTitle || "Начинается новая стадия",
      text:
        this.data.prologue?.postTransitionText ||
        this.data.prologue?.transitionText ||
        "Первый костёр превращает случайное выживание в более организованную жизнь.",
      ttlMs: 9000,
    });
    this._syncLocalCampMap({ pushStory: true });
    this.markDirty();
  }

  restartOnboarding() {
    this.onboarding = {
      started: true,
      skipped: false,
      completed: false,
      currentStep: 0,
    };
    this.storyEvents = [];
    this.addLog("🌄 Пролог запущен заново");
    this._syncLocalCampMap();
    this.markDirty();
    this.saveGame(true);
  }

  getPrologueInsights() {
    return Object.values(this.data.prologue?.insights || {}).sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
  }

  getPrologueInsightsState() {
    return this.getPrologueInsights().map((insight) => ({
      ...insight,
      unlocked: !!this.insights[insight.id],
    }));
  }

  getUnlockedInsightsCount() {
    return this.getPrologueInsightsState().filter((insight) => insight.unlocked)
      .length;
  }

  getKnowledgeEntries() {
    const defs = Object.values(this.data.prologue?.knowledgeEntries || {}).sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
    return defs.filter((entry) => this.knowledgeEntries[entry.id]);
  }

  _unlockKnowledgeEntry(entryId, { pushStory = true } = {}) {
    const entry = this.data.prologue?.knowledgeEntries?.[entryId];
    if (!entry || this.knowledgeEntries[entryId]) return false;
    this.knowledgeEntries[entryId] = true;
    this.addLog(`📚 В Книге знаний появилась запись «${entry.title}».`);
    if (pushStory) {
      this._pushStoryEvent({
        type: "knowledge",
        icon: "📚",
        title: "Новая запись в Книге знаний",
        text: `Записано: ${entry.title}. Короткое наблюдение закрепляет то, что стало понятно в эти ранние шаги.`,
        action: "knowledge",
        ttlMs: 7000,
      });
    }
    this.markDirty();
    return true;
  }

  _unlockInsight(insightId) {
    const insight = this.data.prologue?.insights?.[insightId];
    if (!insight || this.insights[insightId]) return false;

    this.insights[insightId] = true;
    this.addLog(`✨ Пришло озарение: ${insight.name}.`);
    if (insight.unlockText) {
      this.addLog(`→ ${insight.unlockText}`);
    }
    if (insight.knowledgeEntry) {
      this._unlockKnowledgeEntry(insight.knowledgeEntry, { pushStory: false });
    }
    this._pushStoryEvent({
      type: "insight",
      icon: insight.icon,
      title: `Озарение: ${insight.name}`,
      text:
        insight.momentText ||
        insight.unlockText ||
        insight.description,
      action: "insights",
      ttlMs: 8000,
    });
    this._syncLocalCampMap({ pushStory: true });
    this.markDirty();
    return true;
  }

  _checkPrologueInsights() {
    if (!this.isPrologueActive()) return false;

    for (const insight of this.getPrologueInsights()) {
      if (this.insights[insight.id]) continue;
      if (!insight.condition || !insight.condition(this)) continue;
      if (this._unlockInsight(insight.id)) {
        return true;
      }
    }

    return false;
  }

  getVisibleResourceIds() {
    if (!this.isPrologueActive()) {
      return Object.keys(this.data.resources);
    }
    if (!this.getPrologueRevealState().showResources) {
      return [];
    }

    const visible = new Set(this.data.prologue?.visibleResourceIds || []);
    for (const [id, amount] of Object.entries(this.resources)) {
      if (amount > 0) visible.add(id);
    }
    return Array.from(visible);
  }

  getVisibleGatherActions() {
    if (!this.isPrologueActive()) {
      return Object.keys(this.data.gatherActions);
    }
    return [...(this.data.prologue?.gatherActionIds || [])];
  }

  getVisibleRecipeIds() {
    if (!this.isPrologueActive()) {
      return Object.keys(this.data.recipes);
    }
    if (!this.getPrologueRevealState().showCraft) {
      return [];
    }
    return [...(this.data.prologue?.recipeIds || [])];
  }

  getVisibleBuildingIds() {
    if (!this.isPrologueActive()) {
      return Object.keys(this.data.buildings);
    }
    if (!this.getPrologueRevealState().showBuildings) {
      return [];
    }
    return [...(this.data.prologue?.buildingIds || [])];
  }

  getPrologueRevealState() {
    const unlockedInsights = this.getUnlockedInsightsCount();
    const hasTool =
      (this.resources.crude_tools || 0) >= 1 ||
      (this.resourceTotals.crude_tools || 0) >= 1;
    const nearFinalSteps =
      this.onboarding.currentStep >= Math.max(0, this.data.onboarding.steps.length - 2);
    const campfireSeen =
      this.activeConstruction?.buildingId === "campfire" ||
      !!this.buildings.campfire;

    let stage = 0;
    if (unlockedInsights >= 1) stage = 1;
    if (unlockedInsights >= 4 || hasTool) stage = 2;
    if (unlockedInsights >= 6 || nearFinalSteps || campfireSeen) stage = 3;

    return {
      stage,
      unlockedInsights,
      showInsights: true,
      showResources: stage >= 1,
      showCraft: stage >= 2,
      showBuildings: stage >= 3,
    };
  }

  getPrologueCampfireState() {
    const building = this.data.buildings.campfire;
    if (!building) return null;

    const missingInsights = (building.requiresInsights || []).filter(
      (insightId) => !this.insights[insightId],
    );
    const hasTool = (this.resources.crude_tools || 0) >= 1;
    const cost = this.getBuildingCost("campfire");
    const missingResources = this.getMissingResources(cost);
    const built = !!this.buildings.campfire;
    const constructing = this.activeConstruction?.buildingId === "campfire";
    const readyParts =
      this.getUnlockedInsightsCount() +
      (hasTool ? 1 : 0) +
      (built ? 1 : 0);
    const totalParts = this.getPrologueInsights().length + 2;

    return {
      title: this.data.prologue?.campfireTitle || "Путь к первому костру",
      text:
        built
          ? this.data.prologue?.campfireBuiltText ||
            "Костёр уже стал точкой возвращения."
          : this.data.prologue?.campfireText ||
            "Костёр должен стать первым центром жизни.",
      built,
      constructing,
      hasTool,
      unlockedInsights: this.getUnlockedInsightsCount(),
      totalInsights: this.getPrologueInsights().length,
      missingInsights,
      missingResources,
      canBuild: this.canBuild("campfire"),
      readiness: totalParts > 0 ? readyParts / totalParts : 0,
      cost,
    };
  }

  _pluralizeRu(amount, [one, few, many]) {
    const abs = Math.abs(amount) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
  }

  _formatPrologueAmount(resourceId, amount) {
    const forms = {
      wood: ["ветка", "ветки", "веток"],
      stone: ["камень", "камня", "камней"],
      fiber: ["связка волокон", "связки волокон", "связок волокон"],
      crude_tools: ["грубое орудие", "грубых орудия", "грубых орудий"],
    };
    const fallback = this.data.resources[resourceId]?.name || resourceId;
    const noun = forms[resourceId]
      ? this._pluralizeRu(amount, forms[resourceId])
      : fallback.toLowerCase();
    return `${amount} ${noun}`;
  }

  _formatPrologueOutput(output) {
    return Object.entries(output)
      .map(([id, amount]) => this._formatPrologueAmount(id, amount))
      .join(", ");
  }

  _getPrologueGatherLog(actionId, output) {
    const found = this._formatPrologueOutput(output);
    switch (actionId) {
      case "gather_wood":
        return `🌿 В сухостое удалось собрать ${found}.`;
      case "gather_stone":
        return `🪨 Среди россыпи удалось подобрать ${found}.`;
      case "gather_fiber":
        return `🌾 В траве нашлись ${found}.`;
      default:
        return `👣 Руками найдено: ${found}.`;
    }
  }

  _getPrologueCraftStartLog(recipeId) {
    if (recipeId === "craft_crude_tools") {
      return "🪢 Материалы сложены в первую связку. Скоро получится грубое орудие.";
    }
    return null;
  }

  _getPrologueCraftCompleteLog(recipeId) {
    if (recipeId === "craft_crude_tools") {
      return "🔨 Грубое орудие готово. Руки уже не совсем голые.";
    }
    return null;
  }

  _getPrologueBuildStartLog(buildingId) {
    if (buildingId === "campfire") {
      return "🔥 Начали складывать первый костёр. Огонь уже близко.";
    }
    return null;
  }

  _getPrologueBuildCompleteLog(buildingId) {
    if (buildingId === "campfire") {
      return "🔥 Первый костёр разгорелся. У общины появилось место, к которому можно возвращаться.";
    }
    return null;
  }

  getRecipeCost(recipeId) {
    const recipe = this.data.recipes[recipeId];
    if (!recipe) return {};

    const baseCost =
      this.isPrologueActive() && recipe.prologueIngredients
        ? recipe.prologueIngredients
        : recipe.ingredients;

    return this.isPrologueActive()
      ? { ...baseCost }
      : this._getDiscountedCost(baseCost);
  }

  getBuildingCost(buildingId) {
    const building = this.data.buildings[buildingId];
    if (!building) return {};

    const baseCost =
      this.isPrologueActive() && building.prologueCost
        ? building.prologueCost
        : building.cost;

    return { ...baseCost };
  }

  getCurrentOnboardingStep() {
    if (!this.isOnboardingActive()) return null;
    const steps = this.data.onboarding.steps;
    if (this.onboarding.currentStep >= steps.length) return null;
    return steps[this.onboarding.currentStep];
  }

  advanceOnboardingStep() {
    this.onboarding.currentStep += 1;
    this.markDirty();
  }

  addResource(id, amount) {
    if (!Object.prototype.hasOwnProperty.call(this.resources, id)) return 0;

    const before = this.resources[id];
    this.resources[id] = Math.min(
      this.resources[id] + amount,
      this.maxResourceCap,
    );
    const added = this.resources[id] - before;
    this.totalResourcesCollected += added;
    this.resourceTotals[id] += added;

    if (added < amount) {
      const lost = amount - added;
      this.lastOverflow = {
        id,
        lost,
        at: Date.now(),
      };
      this.addLog(
        `📦 Переполнение склада: ${this.data.resources[id].name} ${this.resources[id]} / ${this.maxResourceCap}, потеряно ${lost}`,
      );
    }

    return added;
  }

  hasResources(costObj) {
    for (const [id, amount] of Object.entries(costObj)) {
      if ((this.resources[id] || 0) < amount) return false;
    }
    return true;
  }

  spendResources(costObj) {
    if (!this.hasResources(costObj)) return false;
    for (const [id, amount] of Object.entries(costObj)) {
      this.resources[id] -= amount;
    }
    return true;
  }

  _getDiscountedCost(costObj) {
    const cost = { ...costObj };
    if (this.craftDiscount <= 0) return cost;

    for (const [id, amount] of Object.entries(cost)) {
      cost[id] = Math.max(1, Math.floor(amount * (1 - this.craftDiscount)));
    }

    return cost;
  }

  regenEnergy() {
    const now = Date.now();
    if (now - this.lastEnergyRegen < this.energyRegenInterval) return;

    const before = this.energy;
    this.energy = Math.min(
      this.energy + this.energyRegenPerTick,
      this.maxEnergy,
    );
    this.lastEnergyRegen = now;

    if (this.energy !== before && !this.isPrologueActive()) {
      this.addLog(`⚡ +${this.energy - before} энергии`);
      this.markDirty();
    } else if (this.energy !== before) {
      this.markDirty();
    }
  }

  hasEnergy(amount) {
    return this.energy >= amount;
  }

  spendEnergy(amount) {
    if (!this.hasEnergy(amount)) return false;
    this.energy -= amount;
    this.markDirty();
    return true;
  }

  _recalculateEnergyStats() {
    let maxBonus = 0;
    let regenBonusMs = 0;

    for (const techId of Object.keys(this.researched)) {
      const energyEffect = this.data.tech[techId]?.effect?.energy;
      if (!energyEffect) continue;
      maxBonus += energyEffect.maxBonus || 0;
      regenBonusMs += energyEffect.regenIntervalBonusMs || 0;
    }

    for (const buildingId of Object.keys(this.buildings)) {
      const energyEffect = this.data.buildings[buildingId]?.effect?.energy;
      if (!energyEffect) continue;
      maxBonus += energyEffect.maxBonus || 0;
      regenBonusMs += energyEffect.regenIntervalBonusMs || 0;
    }

    this.energyMaxBonus = maxBonus;
    this.energyRegenIntervalBonusMs = regenBonusMs;
    this.maxEnergy = this.baseEnergyMax + maxBonus;
    this.energyRegenInterval = Math.max(
      1000,
      this.baseEnergyRegenInterval - regenBonusMs,
    );
    this.energy = Math.min(this.energy, this.maxEnergy);
  }

  getEnergyModifiers() {
    return {
      maxBonus: this.energyMaxBonus,
      regenIntervalBonusMs: this.energyRegenIntervalBonusMs,
      maxEnergy: this.maxEnergy,
      regenIntervalMs: this.energyRegenInterval,
    };
  }

  getEnergyRegenRemaining() {
    const elapsed = Date.now() - this.lastEnergyRegen;
    return Math.max(0, this.energyRegenInterval - elapsed);
  }

  canGather(actionId, options = {}) {
    const action = this.data.gatherActions[actionId];
    if (!action) return false;
    if (this.isPrologueActive()) {
      const allowedIds = this.data.prologue?.gatherActionIds || [];
      if (!allowedIds.includes(actionId) || action.hiddenInPrologue) return false;
    }
    if (action.unlockedBy && !this.researched[action.unlockedBy]) return false;
    if (this.cooldowns[actionId] && Date.now() < this.cooldowns[actionId])
      return false;
    if (!this.hasEnergy(action.energyCost)) return false;
    const mappedTiles = this._getMappedCampTilesForAction(actionId);
    if (
      mappedTiles.length > 0 &&
      !this._getPreferredCampGatherTile(actionId, options.tileId)
    ) {
      return false;
    }
    return true;
  }

  gather(actionId, options = {}) {
    const mappedTile = this._getPreferredCampGatherTile(actionId, options.tileId);
    if (!this.canGather(actionId, options)) return false;

    const action = this.data.gatherActions[actionId];
    if (!this.spendEnergy(action.energyCost)) return false;

    const output = this.getGatherOutput(actionId);
    for (const [id, amount] of Object.entries(output)) {
      this.addResource(id, amount);
    }
    if (mappedTile) {
      this._markCampTileExploited(mappedTile.id);
      if (
        Number.isFinite(this.localCampMap.tileResourceRemaining[mappedTile.id])
      ) {
        const before = this.localCampMap.tileResourceRemaining[mappedTile.id];
        this.localCampMap.tileResourceRemaining[mappedTile.id] = Math.max(
          0,
          before - 1,
        );
        if (before > 0 && this.localCampMap.tileResourceRemaining[mappedTile.id] === 0) {
          this.addLog(`🗺️ Участок "${mappedTile.name}" истощён.`);
        }
      }
    }

    this.cooldowns[actionId] = Date.now() + action.cooldown;
    if (this.isPrologueActive()) {
      this.addLog(this._getPrologueGatherLog(actionId, output));
    } else {
      this.addLog(
        `+${Object.entries(output)
          .map(([id, amount]) => `${this.data.resources[id].icon}${amount}`)
          .join(" ")} (⚡-${action.energyCost})`,
      );
    }

    this._checkPrologueInsights();
    this._checkOnboarding();
    this._checkGoals();
    this._syncLocalCampMap({ pushStory: true });
    this.markDirty();
    return true;
  }

  getCooldownRemaining(actionId) {
    if (!this.cooldowns[actionId]) return 0;
    return Math.max(0, this.cooldowns[actionId] - Date.now());
  }

  _getGatherBonus() {
    let bonus = 0;
    if ((this.resources.crude_tools || 0) > 0) bonus = Math.max(bonus, 1);
    if ((this.resources.improved_tools || 0) > 0) bonus = Math.max(bonus, 2);

    for (const techId of Object.keys(this.researched)) {
      const gatherBonus = this.data.tech[techId]?.effect?.gatherBonus || 0;
      if (gatherBonus > 0) {
        bonus += gatherBonus;
      }
    }
    return bonus;
  }

  getGatherOutput(actionId) {
    const action = this.data.gatherActions[actionId];
    if (!action) return {};

    const output = { ...action.output };
    const bonus = this._getGatherBonus();
    if (bonus > 0) {
      for (const [id, amount] of Object.entries(output)) {
        output[id] = amount + bonus;
      }
    }

    return output;
  }

  canCraft(recipeId) {
    const recipe = this.data.recipes[recipeId];
    if (!recipe) return false;
    if (this.isPrologueActive()) {
      const allowedIds = this.data.prologue?.recipeIds || [];
      if (!allowedIds.includes(recipeId) || recipe.hiddenInPrologue) return false;
      const requiredInsights = recipe.requiresInsights || [];
      if (requiredInsights.some((id) => !this.insights[id])) return false;
    }
    if (!this.unlockedRecipes.has(recipeId)) return false;
    if (recipe.requires && !this.buildings[recipe.requires]) return false;
    return this.hasResources(this.getRecipeCost(recipeId));
  }

  canQueueCraft(recipeId) {
    if (!this.canCraft(recipeId)) return false;
    if (this.craftQueue.length >= this.maxCraftQueueSize) return false;
    return true;
  }

  queueCraft(recipeId) {
    if (!this.canQueueCraft(recipeId)) return false;

    const recipe = this.data.recipes[recipeId];
    const cost = this.getRecipeCost(recipeId);
    if (!this.spendResources(cost)) return false;

    this.craftQueue.push({
      recipeId,
      durationMs: recipe.craftTimeMs || 3000,
      startedAt: this.craftQueue.length === 0 ? Date.now() : null,
    });

    this.addLog(
      this.isPrologueActive()
        ? this._getPrologueCraftStartLog(recipeId) ||
            `🧰 В очередь: ${recipe.icon} ${recipe.name}`
        : `🧰 В очередь: ${recipe.icon} ${recipe.name}`,
    );
    this._checkGoals();
    this.markDirty();
    return true;
  }

  tickCraftQueue() {
    if (this.craftQueue.length === 0) return;

    const current = this.craftQueue[0];
    if (current.startedAt === null) {
      current.startedAt = Date.now();
      this.markDirty();
    }

    const elapsed = Date.now() - current.startedAt;
    if (elapsed < current.durationMs) return;

    const recipe = this.data.recipes[current.recipeId];
    for (const [id, amount] of Object.entries(recipe.output)) {
      this.addResource(id, amount);
    }

    this.addLog(
      this.isPrologueActive()
        ? this._getPrologueCraftCompleteLog(current.recipeId) ||
            `⚒️ Готово: ${recipe.icon} ${recipe.name}`
        : `⚒️ Готово: ${recipe.icon} ${recipe.name}`,
    );
    this.craftQueue.shift();
    if (this.craftQueue.length > 0) {
      this.craftQueue[0].startedAt = Date.now();
    }

    this._checkPrologueInsights();
    this._checkOnboarding();
    this._checkGoals();
    this._syncLocalCampMap({ pushStory: true });
    this.markDirty();
  }

  getCraftQueueState() {
    const items = this.craftQueue.map((job, index) => {
      const elapsed = job.startedAt ? Date.now() - job.startedAt : 0;
      const progress =
        index === 0 && job.startedAt
          ? Math.min(1, elapsed / job.durationMs)
          : 0;
      const recipe = this.data.recipes[job.recipeId];

      return {
        recipeId: job.recipeId,
        name: recipe.name,
        icon: recipe.icon,
        durationMs: job.durationMs,
        remainingMs:
          index === 0 && job.startedAt
            ? Math.max(0, job.durationMs - elapsed)
            : job.durationMs,
        progress,
        isActive: index === 0,
      };
    });

    return {
      items,
      capacity: this.maxCraftQueueSize,
      freeSlots: this.maxCraftQueueSize - this.craftQueue.length,
    };
  }

  craft(recipeId) {
    return this.queueCraft(recipeId);
  }

  getEffectiveAutomationInterval(auto) {
    if (!auto) return 0;
    return Math.max(
      1000,
      Math.round(auto.intervalMs * this.automationIntervalMultiplier),
    );
  }

  getBuildDuration(buildingId) {
    const building = this.data.buildings[buildingId];
    const baseDuration = Number.isFinite(building?.buildTimeMs)
      ? building.buildTimeMs
      : 8000;
    return Math.max(1000, Math.round(baseDuration * this.buildTimeMultiplier));
  }

  getConstructionState() {
    if (!this.activeConstruction) return null;

    const building = this.data.buildings[this.activeConstruction.buildingId];
    if (!building) return null;

    const elapsed = Math.max(0, Date.now() - this.activeConstruction.startedAt);
    const remainingMs = Math.max(
      0,
      this.activeConstruction.durationMs - elapsed,
    );

    return {
      buildingId: this.activeConstruction.buildingId,
      tileId: this.activeConstruction.tileId || null,
      name: building.name,
      icon: building.icon,
      description: building.description,
      durationMs: this.activeConstruction.durationMs,
      remainingMs,
      progress:
        this.activeConstruction.durationMs > 0
          ? Math.min(1, elapsed / this.activeConstruction.durationMs)
          : 1,
    };
  }

  canBuild(buildingId) {
    const building = this.data.buildings[buildingId];
    if (!building) return false;
    if (this.activeConstruction) return false;
    if (this.isPrologueActive()) {
      const allowedIds = this.data.prologue?.buildingIds || [];
      if (!allowedIds.includes(buildingId) || building.hiddenInPrologue)
        return false;
      const requiredInsights = building.requiresInsights || [];
      if (requiredInsights.some((id) => !this.insights[id])) return false;
      if (
        building.requiresPrologueTool &&
        (this.resources.crude_tools || 0) < 1
      ) {
        return false;
      }
    }
    if (building.unlockedBy && !this.researched[building.unlockedBy])
      return false;
    if (building.requires && !this.buildings[building.requires]) return false;
    if (this.buildings[buildingId]) return false;
    const hasMappedSite = Object.values(this.data.localCampMap?.tiles || {}).some(
      (tile) =>
        Array.isArray(tile.buildOptions) && tile.buildOptions.includes(buildingId),
    );
    if (
      hasMappedSite &&
      !this._getPreferredCampBuildTile(buildingId, this.getSelectedCampTileId())
    ) {
      return false;
    }
    return this.hasResources(this.getBuildingCost(buildingId));
  }

  build(buildingId) {
    if (!this.canBuild(buildingId)) return false;

    const building = this.data.buildings[buildingId];
    const cost = this.getBuildingCost(buildingId);
    if (!this.spendResources(cost)) return false;
    const tileId = this._getPreferredCampBuildTile(
      buildingId,
      this.getSelectedCampTileId(),
    );

    const durationMs = this.getBuildDuration(buildingId);
    this.activeConstruction = {
      buildingId,
      tileId,
      durationMs,
      startedAt: Date.now(),
    };

    this.addLog(
      this.isPrologueActive()
        ? this._getPrologueBuildStartLog(buildingId) ||
            `🏗️ Начато строительство: ${building.icon} ${building.name} (${Math.ceil(durationMs / 1000)}с)`
        : `🏗️ Начато строительство: ${building.icon} ${building.name} (${Math.ceil(durationMs / 1000)}с)`,
    );
    if (tileId) {
      this.localCampMap.buildingPlacements[buildingId] = tileId;
      this._markCampTileExploited(tileId);
    }
    this.markDirty();
    this.saveGame(true);
    return true;
  }

  tickConstruction() {
    const current = this.getConstructionState();
    if (!current || current.remainingMs > 0) return;

    const building = this.data.buildings[current.buildingId];
    this.activeConstruction = null;
    this.buildings[current.buildingId] = {
      count: 1,
      isAutomationRunning: true,
    };
    if (current.tileId) {
      this.localCampMap.buildingPlacements[current.buildingId] = current.tileId;
      this._setCampTileState(current.tileId, "settled");
    }
    if (building.effect?.automation) {
      this.automation[building.effect.automation.id] = {
        lastRun: 0,
        state: AUTO_STATE.WAITING,
      };
    }

    this._recalculateDerivedState();
    if (current.buildingId === "campfire") {
      this._unlockKnowledgeEntry("campfire_center");
      this._pushStoryEvent({
        type: "campfire",
        icon: "🔥",
        title: "Первый костёр разгорелся",
        text:
          this.data.prologue?.campfireBuiltText ||
          "У общины появился первый центр жизни: свет, тепло и место, к которому можно возвращаться.",
        ttlMs: 8500,
      });
    }
    this.addLog(
      this.isPrologueActive()
        ? this._getPrologueBuildCompleteLog(current.buildingId) ||
            `🏗️ Построено: ${building.icon} ${building.name}`
        : `🏗️ Построено: ${building.icon} ${building.name}`,
    );
    this._checkPrologueInsights();
    this._checkOnboarding();
    this._checkGoals();
    this._syncLocalCampMap({ pushStory: true });
    this.markDirty();
    this.saveGame(true);
  }

  tickAutomation() {
    const now = Date.now();

    for (const [buildingId] of Object.entries(this.buildings)) {
      const buildingData = this.buildings[buildingId];
      if (!buildingData.isAutomationRunning) continue;

      const building = this.data.buildings[buildingId];
      const auto = building?.effect?.automation;
      if (!auto) continue;

      if (!this.automation[auto.id]) {
        this.automation[auto.id] = {
          lastRun: 0,
          state: AUTO_STATE.WAITING,
        };
      }

      const entry = this.automation[auto.id];
      const hasInput = this.hasResources(auto.input);

      if (!hasInput) {
        entry.state = AUTO_STATE.WAITING;
        entry.lastRun = 0;
        continue;
      }

      if (entry.lastRun === 0) {
        entry.lastRun = now;
        entry.state = AUTO_STATE.RUNNING;
        this.markDirty();
        continue;
      }

      if (now - entry.lastRun < this.getEffectiveAutomationInterval(auto)) {
        entry.state = AUTO_STATE.RUNNING;
        continue;
      }

      this.spendResources(auto.input);
      for (const [id, amount] of Object.entries(auto.output)) {
        this.addResource(id, amount);
        this.automationProduction[id] += amount;
      }

      entry.lastRun = now;
      entry.state = AUTO_STATE.RUNNING;

      this.addLog(
        `🔥 Авто: ${building.icon} ${auto.name} → ${Object.entries(auto.output)
          .map(([id, amount]) => `${this.data.resources[id].icon}+${amount}`)
          .join(" ")}`,
      );
      this._checkOnboarding();
      this._checkGoals();
      this.markDirty();
    }
  }

  getAutomationDefinition(automationId) {
    for (const building of Object.values(this.data.buildings)) {
      if (building.effect?.automation?.id === automationId) {
        return building.effect.automation;
      }
    }
    return null;
  }

  getAutomationState(automationId) {
    const entry = this.automation[automationId];
    if (!entry) return AUTO_STATE.IDLE;
    return entry.state;
  }

  getAutomationProgress(automationId) {
    const entry = this.automation[automationId];
    const auto = this.getAutomationDefinition(automationId);
    if (!entry || !auto || entry.lastRun === 0) return 0;
    return Math.min(
      1,
      (Date.now() - entry.lastRun) / this.getEffectiveAutomationInterval(auto),
    );
  }

  getAutomationRemaining(automationId) {
    const entry = this.automation[automationId];
    const auto = this.getAutomationDefinition(automationId);
    if (!entry || !auto || entry.lastRun === 0) return 0;
    return Math.max(
      0,
      (this.getEffectiveAutomationInterval(auto) - (Date.now() - entry.lastRun)) /
        1000,
    );
  }

  getMissingResources(costObj) {
    return Object.entries(costObj)
      .filter(([id, amount]) => (this.resources[id] || 0) < amount)
      .map(([id, amount]) => ({
        id,
        missing: amount - (this.resources[id] || 0),
      }));
  }

  getStorageStatus() {
    const ratios = Object.entries(this.resources).map(([id, amount]) => ({
      id,
      amount,
      ratio: this.maxResourceCap > 0 ? amount / this.maxResourceCap : 0,
    }));

    const highest = ratios.reduce(
      (best, current) => (current.ratio > best.ratio ? current : best),
      { id: null, amount: 0, ratio: 0 },
    );

    return {
      highest,
      remainingSlots: Math.max(0, this.maxResourceCap - highest.amount),
      isNearFull: highest.ratio >= 0.85,
      isFull: highest.ratio >= 1,
    };
  }

  getRecentOverflow(resourceId = null) {
    if (!this.lastOverflow) return null;
    if (Date.now() - this.lastOverflow.at > 4500) return null;
    if (resourceId && this.lastOverflow.id !== resourceId) return null;
    return this.lastOverflow;
  }

  getResourceStorageInfo(resourceId) {
    const resource = this.data.resources[resourceId];
    if (!resource) return null;

    const amount = this.resources[resourceId] || 0;
    const storageSize = Number.isFinite(resource.storageSize)
      ? resource.storageSize
      : 1;
    const usedSpace = amount * storageSize;
    const itemCapacity = this.maxResourceCap * storageSize;
    const totals = this.getStorageTotals();
    const contributionRatio =
      totals.capacity > 0 ? usedSpace / totals.capacity : 0;
    const fillRatio =
      this.maxResourceCap > 0 ? amount / this.maxResourceCap : 0;
    const overflow = this.getRecentOverflow(resourceId);

    return {
      id: resourceId,
      def: resource,
      amount,
      storageSize,
      usedSpace,
      itemCapacity,
      contributionRatio,
      fillRatio,
      isNearFull: fillRatio >= 0.7,
      isHigh: fillRatio >= 0.9,
      isFull: fillRatio >= 1,
      overflow,
    };
  }

  getStorageTotals() {
    const resourceEntries = Object.entries(this.data.resources);
    const used = resourceEntries.reduce((sum, [id, def]) => {
      const storageSize = Number.isFinite(def.storageSize)
        ? def.storageSize
        : 1;
      return sum + (this.resources[id] || 0) * storageSize;
    }, 0);
    const resourceTypes = resourceEntries.length;
    const capacity = resourceEntries.reduce((sum, [, def]) => {
      const storageSize = Number.isFinite(def.storageSize)
        ? def.storageSize
        : 1;
      return sum + this.maxResourceCap * storageSize;
    }, 0);
    const free = Math.max(0, capacity - used);
    const fillRatio = capacity > 0 ? used / capacity : 0;

    return {
      used,
      capacity,
      free,
      resourceTypes,
      fillRatio,
    };
  }

  getStorageCategoryBreakdown() {
    const totals = this.getStorageTotals();
    const categoryDefs = this.data.storageCategories || {};
    const categories = new Map();

    for (const [categoryId, categoryDef] of Object.entries(categoryDefs)) {
      categories.set(categoryId, {
        id: categoryId,
        label: categoryDef.label || categoryId,
        description: categoryDef.description || "",
        order: Number.isFinite(categoryDef.order) ? categoryDef.order : 999,
        usedSpace: 0,
        contributionRatio: 0,
        items: [],
      });
    }

    for (const [resourceId] of Object.entries(this.data.resources)) {
      const item = this.getResourceStorageInfo(resourceId);
      if (!item) continue;

      const categoryId = item.def.storageCategory || "other";
      if (!categories.has(categoryId)) {
        categories.set(categoryId, {
          id: categoryId,
          label: categoryId,
          description: "",
          order: 999,
          usedSpace: 0,
          contributionRatio: 0,
          items: [],
        });
      }

      const category = categories.get(categoryId);
      category.items.push(item);
      category.usedSpace += item.usedSpace;
    }

    return Array.from(categories.values())
      .filter((category) => category.items.length > 0)
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "ru"))
      .map((category) => ({
        ...category,
        contributionRatio:
          totals.capacity > 0 ? category.usedSpace / totals.capacity : 0,
      }));
  }

  getAutomationEfficiency(automationId) {
    const auto = this.getAutomationDefinition(automationId);
    if (!auto) return null;

    const cycleSeconds = this.getEffectiveAutomationInterval(auto) / 1000;
    const outputPerSecond = Object.fromEntries(
      Object.entries(auto.output).map(([id, amount]) => [
        id,
        amount / cycleSeconds,
      ]),
    );

    return {
      cycleSeconds,
      output: auto.output,
      outputPerSecond,
    };
  }

  _checkOnboarding() {
    if (!this.isOnboardingActive()) return;

    const step = this.getCurrentOnboardingStep();
    if (!step) return;

    if (!step.check(this)) return;

    this.addLog(`🌿 Освоено: ${step.text}.`);
    this.advanceOnboardingStep();

    const nextStep = this.getCurrentOnboardingStep();
    if (nextStep) {
      this.addLog(`→ Теперь главное: ${nextStep.text}.`);
    } else {
      this.completeOnboarding();
      this.addLog(this.data.onboarding.completeMessage);
    }
  }

  _checkGoals() {
    if (this.isOnboardingActive() || this.allGoalsComplete) return;

    let changed = false;
    while (this.currentGoalIndex < this.data.goals.length) {
      const goal = this.data.goals[this.currentGoalIndex];
      if (!goal.check(this)) break;

      this.completedGoals.push(goal.id);
      this.addLog(`🎯 Цель выполнена: ${goal.text}`);
      if (goal.completeText) {
        this.addLog(`→ ${goal.completeText}`);
      }
      this.currentGoalIndex += 1;
      changed = true;
    }

    if (
      this.currentGoalIndex >= this.data.goals.length &&
      !this.allGoalsComplete
    ) {
      this.allGoalsComplete = true;
      this.addLog("🏆 Все цели выполнены!");
      changed = true;
    }

    if (changed) {
      this.markDirty();
    }
  }

  getCurrentGoal() {
    if (this.isOnboardingActive()) return null;
    if (this.allGoalsComplete) return null;
    return this.data.goals[this.currentGoalIndex] || null;
  }

  getGoalProgress() {
    const goal = this.getCurrentGoal();
    const total = this.data.goals.length;
    const done = this.completedGoals.length;
    const current = goal
      ? Math.min(
          goal.target || 1,
          goal.progress ? goal.progress(this) : goal.check(this) ? 1 : 0,
        )
      : total;
    const target = goal ? goal.target || 1 : total;

    return {
      done,
      total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      current,
      target,
      currentPct: target > 0 ? Math.round((current / target) * 100) : 0,
    };
  }

  getTechPrerequisites(techId) {
    const tech = this.data.tech[techId];
    if (!tech) {
      return {
        requiredTechIds: [],
        missingTechIds: [],
        requiredBuildingIds: [],
        missingBuildingIds: [],
      };
    }

    const requiredTechIds = Array.isArray(tech.requiresTech)
      ? tech.requiresTech.filter(Boolean)
      : tech.requiresTech
        ? [tech.requiresTech]
        : [];
    const requiredBuildingIds = Array.isArray(tech.requires)
      ? tech.requires.filter(Boolean)
      : tech.requires
        ? [tech.requires]
        : [];

    return {
      requiredTechIds,
      missingTechIds: requiredTechIds.filter((id) => !this.researched[id]),
      requiredBuildingIds,
      missingBuildingIds: requiredBuildingIds.filter((id) => !this.buildings[id]),
    };
  }

  getResearchBranchesState() {
    const branchDefs = this.data.researchBranches || {};
    const eraData = this.getEraData();
    const foundationIds = eraData?.researchFoundation || [];
    const branchIds =
      eraData?.researchBranches ||
      Object.values(branchDefs)
        .filter((branch) => branch.id !== "foundation")
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((branch) => branch.id);

    const foundation = foundationIds
      .map((id) => this.data.tech[id])
      .filter(Boolean)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const branches = branchIds
      .map((branchId) => {
        const branch = branchDefs[branchId];
        if (!branch) return null;

        const techs = Object.values(this.data.tech)
          .filter((tech) => tech.branch === branchId)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        const completed = techs.filter((tech) => this.researched[tech.id]).length;

        return {
          ...branch,
          techs,
          completed,
          total: techs.length,
          started: completed > 0,
        };
      })
      .filter(Boolean);

    return {
      foundation,
      branches,
      transitionText: eraData?.researchTransitionText || "",
    };
  }

  canResearch(techId) {
    const tech = this.data.tech[techId];
    if (!tech) return false;
    if (this.isPrologueActive()) return false;
    if (this.activeResearch) return false;
    if (this.researched[techId]) return false;
    const prereqs = this.getTechPrerequisites(techId);
    if (prereqs.missingTechIds.length > 0) return false;
    if (prereqs.missingBuildingIds.length > 0) return false;
    return this.hasResources(tech.cost);
  }

  getResearchDuration(techId) {
    const tech = this.data.tech[techId];
    return Number.isFinite(tech?.researchTimeMs) ? tech.researchTimeMs : 10000;
  }

  getResearchState() {
    if (!this.activeResearch) return null;

    const tech = this.data.tech[this.activeResearch.techId];
    if (!tech) return null;

    const elapsed = Math.max(0, Date.now() - this.activeResearch.startedAt);
    const remainingMs = Math.max(0, this.activeResearch.durationMs - elapsed);

    return {
      techId: this.activeResearch.techId,
      name: tech.name,
      icon: tech.icon,
      description: tech.description,
      durationMs: this.activeResearch.durationMs,
      remainingMs,
      progress:
        this.activeResearch.durationMs > 0
          ? Math.min(1, elapsed / this.activeResearch.durationMs)
          : 1,
    };
  }

  research(techId) {
    if (!this.canResearch(techId)) return false;

    const tech = this.data.tech[techId];
    if (!this.spendResources(tech.cost)) return false;

    const durationMs = this.getResearchDuration(techId);
    this.activeResearch = {
      techId,
      durationMs,
      startedAt: Date.now(),
    };

    this.addLog(
      `🔬 Начато исследование: ${tech.icon} ${tech.name} (${Math.ceil(durationMs / 1000)}с)`,
    );
    this.markDirty();
    this.saveGame(true);
    return true;
  }

  canQueueResearch(techId) {
    if (this.isPrologueActive()) return false;
    if (!this.activeResearch) return false; // queue only relevant when busy
    const tech = this.data.tech[techId];
    if (!tech) return false;
    if (this.researched[techId]) return false;
    if (this.researchQueue.some((q) => q.techId === techId)) return false;
    if (this.researchQueue.length >= 1) return false;
    const prereqs = this.getTechPrerequisites(techId);
    if (prereqs.missingTechIds.length > 0) return false;
    if (prereqs.missingBuildingIds.length > 0) return false;
    return this.hasResources(tech.cost);
  }

  queueResearch(techId) {
    if (!this.canQueueResearch(techId)) return false;
    const tech = this.data.tech[techId];
    if (!this.spendResources(tech.cost)) return false;
    this.researchQueue.push({ techId, spentResources: { ...tech.cost } });
    this.addLog(`📋 В очередь: ${tech.icon} ${tech.name}`);
    this.markDirty();
    return true;
  }

  cancelQueuedResearch() {
    if (this.researchQueue.length === 0) return false;
    const queued = this.researchQueue.shift();
    for (const [id, amount] of Object.entries(queued.spentResources || {})) {
      this.addResource(id, amount);
    }
    const tech = this.data.tech[queued.techId];
    this.addLog(`↩️ Убрано из очереди: ${tech?.icon || ""} ${tech?.name || queued.techId}`);
    this.markDirty();
    return true;
  }

  cancelResearch() {
    if (!this.activeResearch) return false;
    const tech = this.data.tech[this.activeResearch.techId];
    const cost = tech?.cost || {};
    for (const [id, amount] of Object.entries(cost)) {
      this.addResource(id, Math.floor(amount * 0.5));
    }
    this.addLog(`❌ Исследование отменено: ${tech?.icon || ""} ${tech?.name || ""} (возвращено 50% ресурсов)`);
    this.activeResearch = null;
    this.markDirty();
    this.saveGame(true);
    return true;
  }

  tickResearch() {
    const current = this.getResearchState();
    if (!current || current.remainingMs > 0) return;

    const tech = this.data.tech[current.techId];
    this.activeResearch = null;
    this.researched[current.techId] = true;
    this._recalculateDerivedState();
    this.addLog(`🔬 Изучено: ${tech.icon} ${tech.name}`);
    this._checkOnboarding();
    this._checkGoals();

    // Auto-start queued research
    if (this.researchQueue.length > 0) {
      const next = this.researchQueue.shift();
      const durationMs = this.getResearchDuration(next.techId);
      this.activeResearch = { techId: next.techId, durationMs, startedAt: Date.now() };
      const nextTech = this.data.tech[next.techId];
      if (nextTech) {
        this.addLog(`🔬 Начато (из очереди): ${nextTech.icon} ${nextTech.name} (${Math.ceil(durationMs / 1000)}с)`);
      }
    }

    this._syncLocalCampMap({ pushStory: true });
    this.markDirty();
    this.saveGame(true);
  }

  addLog(message) {
    this.log.unshift({
      time: new Date().toLocaleTimeString(),
      message,
    });
    if (this.log.length > 50) {
      this.log.pop();
    }
  }

  getProgressSummary() {
    return {
      resourcesOwned: this.totalResourcesCollected,
      buildingsBuilt: Object.keys(this.buildings).length,
      techResearched: Object.keys(this.researched).length,
    };
  }
}
