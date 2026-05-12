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
const BASE_RESOURCE_CAP = 15;

class GameState {
  constructor(data) {
    this.data = data;

    this.resources = {};
    this.resourceTotals = {};
    this.automationProduction = {};
    this.buildings = {};
    this.researched = {};
    this.unlockedRecipes = new Set();
    this.maxResourceCap = BASE_RESOURCE_CAP;
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

    const characterConf = data.character || {};
    const satietyConf = characterConf.satiety || {};
    const hydrationConf = characterConf.hydration || {};
    const carryConf = characterConf.carry || {};
    this.characterTitle = characterConf.title || "Ведущий стоянки";
    this.characterRole = characterConf.role || "";
    this.baseSatietyMax = Number.isFinite(satietyConf.max)
      ? satietyConf.max
      : 10;
    this.maxSatiety = this.baseSatietyMax;
    this.satiety = this.maxSatiety;
    this.satietyMaxBonus = 0;
    this.baseHydrationMax = Number.isFinite(hydrationConf.max)
      ? hydrationConf.max
      : 10;
    this.maxHydration = this.baseHydrationMax;
    this.hydration = this.maxHydration;
    this.hydrationMaxBonus = 0;
    this.characterRecoveryBonusPerTick = 0;
    this.carryCapacityBonus = 0;
    this.enduranceBonus = 0;
    this.fieldcraftBonus = 0;
    this.strengthBonus = 0;
    this.mobilityBonus = 0;
    this.ingenuityBonus = 0;
    this.recoveryRatingBonus = 0;
    const statsConf = characterConf.stats || {};
    this.baseEndurance = Number.isFinite(statsConf.endurance?.base)
      ? statsConf.endurance.base
      : 1;
    this.baseFieldcraft = Number.isFinite(statsConf.fieldcraft?.base)
      ? statsConf.fieldcraft.base
      : 0;
    this.baseStrength = Number.isFinite(statsConf.strength?.base)
      ? statsConf.strength.base
      : 1;
    this.baseMobility = Number.isFinite(statsConf.mobility?.base)
      ? statsConf.mobility.base
      : 1;
    this.baseIngenuity = Number.isFinite(statsConf.ingenuity?.base)
      ? statsConf.ingenuity.base
      : 1;
    this.baseRecoveryRating = Number.isFinite(statsConf.recovery?.base)
      ? statsConf.recovery.base
      : 0;
    this.baseCarryCapacity = Number.isFinite(carryConf.baseCapacity)
      ? carryConf.baseCapacity
      : 5;
    this.carryCapacity = this.baseCarryCapacity;
    this.lastCharacterConditionId = null;
    this.lastManualRestAt = 0;
    this.autoConsumeFoodEnabled = true;
    this.autoConsumeWaterEnabled = true;

    this.automation = {};
    this.craftQueue = [];
    this.maxCraftQueueSize = 3;
    /** Stage 2A — gather-type work-actions: one active + pending queue (not craft). */
    this.workQueue = [];
    this.activeWork = null;
    this.maxWorkQueueSize = 3;
    /** Stage 2C — авто-постановка сборов (распорядок стоянки). */
    this.campRoutine = {
      enabled: false,
      activePriorityId: null,
      targetStocks: {},
    };
    this._campRoutineTickHint = "";
    this.activeConstruction = null;
    this.activeResearch = null;
    this.researchQueue = []; // max 1 queued item

    this.onboarding = this._getDefaultOnboardingState();
    this.insights = this._getDefaultInsightState();
    this.insightUnlockMoments = this._getDefaultInsightUnlockMoments();
    this.knowledgeEntries = this._getDefaultKnowledgeState();
    this.discoveryEvents = [];
    this.pendingDiscoveryScene = null;
    this.seenDiscoveryScenes = this._getDefaultSeenDiscoveryScenes();
    this.localCampMap = this._getDefaultLocalCampMapState();
    this.surroundingsMap = this._getDefaultSurroundingsMapState();
    this.surroundingsHexMap = this._getDefaultSurroundingsHexMapState();
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
    this._campMapSyncKey = null;
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
    this._syncSurroundingsMap();
    this._syncCharacterConditionState({ pushLog: false, pushStory: false });
    this.presentationGateAudit = this.validatePresentationGates();

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
      handoff: false,
    };
  }

  _sanitizeOnboarding(raw) {
    return {
      started: !!raw?.started,
      skipped: !!raw?.skipped,
      completed: !!raw?.completed,
      currentStep: Number.isFinite(raw?.currentStep) ? raw.currentStep : 0,
      handoff: !!raw?.handoff,
    };
  }

  _getDiscoverySceneDefs() {
    return Object.values(this.data.prologue?.insights || {}).flatMap(
      (insight) => {
        if (!insight?.discoveryScene?.id) return [];
        return [
          {
            ...insight.discoveryScene,
            insightId: insight.id,
            insightName: insight.name,
            insightIcon: insight.icon,
            knowledgeEntry: insight.knowledgeEntry || null,
          },
        ];
      },
    );
  }

  _getDiscoverySceneDef(sceneId, insightId = null) {
    for (const scene of this._getDiscoverySceneDefs()) {
      if (scene.id !== sceneId) continue;
      if (insightId && scene.insightId !== insightId) continue;
      return scene;
    }
    return null;
  }

  _getDefaultSeenDiscoveryScenes() {
    const seen = {};
    for (const scene of this._getDiscoverySceneDefs()) {
      seen[scene.id] = false;
    }
    return seen;
  }

  _sanitizeSeenDiscoveryScenes(raw) {
    const seen = this._getDefaultSeenDiscoveryScenes();
    if (!raw || typeof raw !== "object") return seen;

    for (const sceneId of Object.keys(seen)) {
      seen[sceneId] = !!raw[sceneId];
    }

    return seen;
  }

  _sanitizeDiscoveryEvents(raw) {
    if (!Array.isArray(raw)) return [];

    const validSceneIds = new Set(
      this._getDiscoverySceneDefs().map((scene) => scene.id),
    );

    return raw
      .filter(
        (event) =>
          validSceneIds.has(event?.sceneId) &&
          typeof event?.insightId === "string",
      )
      .slice(-20)
      .map((event) => ({
        sceneId: event.sceneId,
        insightId: event.insightId,
        selectedOptionId:
          typeof event.selectedOptionId === "string"
            ? event.selectedOptionId
            : "",
        completedAt: Number.isFinite(event.completedAt)
          ? event.completedAt
          : Date.now(),
      }));
  }

  _sanitizePendingDiscoveryScene(raw) {
    if (!raw || typeof raw !== "object") return null;

    const scene = this._getDiscoverySceneDef(raw.sceneId, raw.insightId);
    if (!scene) return null;

    return {
      sceneId: scene.id,
      insightId: scene.insightId,
      status: raw.status === "success" ? "success" : "prompt",
      feedback: typeof raw.feedback === "string" ? raw.feedback : "",
      selectedOptionId:
        typeof raw.selectedOptionId === "string" ? raw.selectedOptionId : "",
      attempts: Number.isFinite(raw.attempts) ? Math.max(0, raw.attempts) : 0,
      triggeredAt: Number.isFinite(raw.triggeredAt)
        ? raw.triggeredAt
        : Date.now(),
      resolvedAt: Number.isFinite(raw.resolvedAt) ? raw.resolvedAt : 0,
    };
  }

  getPendingDiscoveryScene() {
    if (!this.pendingDiscoveryScene) return null;

    const pending = this.pendingDiscoveryScene;
    const scene = this._getDiscoverySceneDef(
      pending.sceneId,
      pending.insightId,
    );
    if (!scene) return null;

    const interaction = scene.interaction || { type: "confirm" };
    const knowledgeEntry = scene.knowledgeEntry
      ? this.data.prologue?.knowledgeEntries?.[scene.knowledgeEntry] || null
      : null;

    return {
      ...scene,
      sceneId: scene.id,
      title: scene.title || scene.insightName || "Озарение",
      icon: scene.insightIcon || "🧠",
      knowledgeEntry,
      interaction,
      effects: Array.isArray(scene.effects) ? scene.effects : [],
      canDismiss: pending.status === "success",
      ...pending,
    };
  }

  _queueDiscoveryScene(insight) {
    const scene = insight?.discoveryScene;
    if (!scene?.id) return false;

    if (
      this.pendingDiscoveryScene?.sceneId === scene.id &&
      this.pendingDiscoveryScene?.insightId === insight.id
    ) {
      return true;
    }

    if (this.seenDiscoveryScenes[scene.id]) {
      return this._completeInsightUnlock(insight.id, { sceneId: scene.id });
    }

    this.pendingDiscoveryScene = {
      sceneId: scene.id,
      insightId: insight.id,
      status: "prompt",
      feedback: "",
      selectedOptionId: "",
      attempts: 0,
      triggeredAt: Date.now(),
      resolvedAt: 0,
    };
    this.markDirty();
    return true;
  }

  _recordDiscoverySceneCompletion(sceneId, insightId, selectedOptionId = "") {
    if (!sceneId || !insightId) return;

    this.seenDiscoveryScenes[sceneId] = true;
    this.discoveryEvents = this.discoveryEvents
      .filter(
        (event) =>
          !(event.sceneId === sceneId && event.insightId === insightId),
      )
      .concat({
        sceneId,
        insightId,
        selectedOptionId,
        completedAt: Date.now(),
      })
      .slice(-20);
  }

  _completeInsightUnlock(
    insightId,
    { sceneId = "", selectedOptionId = "" } = {},
  ) {
    const insight = this.data.prologue?.insights?.[insightId];
    if (!insight) return false;

    if (sceneId) {
      this._recordDiscoverySceneCompletion(
        sceneId,
        insightId,
        selectedOptionId,
      );
    }

    if (this.insights[insightId]) {
      this.markDirty();
      return false;
    }

    this.insights[insightId] = true;
    if (!this.insightUnlockMoments) {
      this.insightUnlockMoments = this._getDefaultInsightUnlockMoments();
    }
    this.insightUnlockMoments[insightId] = Date.now();
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
      text: insight.momentText || insight.unlockText || insight.description,
      action: "insights",
      ttlMs: 8000,
    });
    this._syncLocalCampMap({ pushStory: true });
    this.markDirty();
    return true;
  }

  resolveDiscoveryScene(optionId = "") {
    const pending = this.pendingDiscoveryScene;
    if (!pending) {
      return { ok: false, reason: "no-scene" };
    }

    const scene = this._getDiscoverySceneDef(
      pending.sceneId,
      pending.insightId,
    );
    if (!scene) {
      this.pendingDiscoveryScene = null;
      this.markDirty();
      return { ok: false, reason: "missing-scene" };
    }

    if (pending.status === "success") {
      return {
        ok: true,
        completed: true,
        correct: true,
        scene: this.getPendingDiscoveryScene(),
      };
    }

    const interaction = scene.interaction || { type: "confirm" };

    if (interaction.type === "confirm") {
      this.pendingDiscoveryScene = {
        ...pending,
        status: "success",
        feedback: "",
        selectedOptionId: "",
        resolvedAt: Date.now(),
      };
      this._completeInsightUnlock(scene.insightId, { sceneId: scene.id });
      return {
        ok: true,
        completed: true,
        correct: true,
        scene: this.getPendingDiscoveryScene(),
      };
    }

    const options = Array.isArray(interaction.options)
      ? interaction.options
      : [];
    const option = options.find((entry) => entry.id === optionId);
    if (!option) {
      return { ok: false, reason: "missing-option" };
    }

    this.pendingDiscoveryScene = {
      ...pending,
      feedback: typeof option.result === "string" ? option.result : "",
      selectedOptionId: option.id,
      attempts: option.correct ? pending.attempts : pending.attempts + 1,
      status: option.correct ? "success" : "prompt",
      resolvedAt: option.correct ? Date.now() : 0,
    };

    if (option.correct) {
      this._completeInsightUnlock(scene.insightId, {
        sceneId: scene.id,
        selectedOptionId: option.id,
      });
    } else {
      this.markDirty();
    }

    return {
      ok: true,
      completed: !!option.correct,
      correct: !!option.correct,
      scene: this.getPendingDiscoveryScene(),
    };
  }

  dismissPendingDiscoveryScene() {
    if (!this.pendingDiscoveryScene) return false;
    if (this.pendingDiscoveryScene.status !== "success") return false;

    this.pendingDiscoveryScene = null;
    this.markDirty();
    return true;
  }

  _getDefaultInsightState() {
    const state = {};
    for (const id of Object.keys(this.data.prologue?.insights || {})) {
      state[id] = false;
    }
    return state;
  }

  _getDefaultInsightUnlockMoments() {
    const state = {};
    for (const id of Object.keys(this.data.prologue?.insights || {})) {
      state[id] = 0;
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

  _getCampMapRevision() {
    return 4;
  }

  _getCampExpansionBaseRadius() {
    const expansion = this.data.localCampMap?.expansion || {};
    const radius = Number(expansion.currentRadius);
    return Number.isFinite(radius) && radius > 0 ? Math.floor(radius) : 4;
  }

  _getCampExpansionPreparedRadius() {
    const expansion = this.data.localCampMap?.expansion || {};
    const preparedRadius = Number(expansion.preparedRadius);
    return Number.isFinite(preparedRadius) && preparedRadius > 0
      ? Math.floor(preparedRadius)
      : this._getCampExpansionBaseRadius();
  }

  _isCampExpansionTokenMet(token) {
    if (!token) return false;
    return !!(
      this.buildings?.[token] ||
      this.researched?.[token] ||
      this.localCampMap?.appliedUpgrades?.includes?.(token)
    );
  }

  _getCampExpansionTokenLabel(token) {
    return (
      this.data.buildings?.[token]?.name ||
      this.data.tech?.[token]?.name ||
      this.data.buildingUpgrades?.[token]?.name ||
      token
    );
  }

  _getCampPathLevelRank(level = "none") {
    const ranks = {
      none: 0,
      trace: 1,
      footpath: 2,
      stable_footpath: 3,
      trail: 4,
      built_trail: 4,
      dirt_road: 5,
    };
    return ranks[level] || 0;
  }

  _getCampPreparedPathCount(level = "footpath") {
    const requiredRank = this._getCampPathLevelRank(level || "footpath");
    const tilePathCount = Object.values(
      this.localCampMap?.pathLevels || {},
    ).filter(
      (pathLevel) => this._getCampPathLevelRank(pathLevel) >= requiredRank,
    ).length;
    const roadLinkCount = Object.values(
      this.localCampMap?.roadLinks || {},
    ).filter(
      (link) =>
        this._getCampPathLevelRank(
          link?.effectivePathLevel || link?.builtRoadLevel || "none",
        ) >= requiredRank,
    ).length;
    return Math.max(tilePathCount, roadLinkCount);
  }

  getCampPathDataForLevel(level = "none") {
    const defs = this.data.logistics?.pathLevels || {};
    return (
      defs[level] ||
      (level === "built_trail" ? defs.trail : null) || {
        id: level || "none",
        label: level && level !== "none" ? "Подготовленная тропа" : "Без тропы",
        icon: level && level !== "none" ? "⋯" : "·",
        routeRelief: 0,
        terrainRelief: 0,
        description: "Путь ещё не подготовлен.",
      }
    );
  }

  getCampExpansionGateProgress(gate = {}) {
    const requiresAll = Array.isArray(gate.requiresAll)
      ? gate.requiresAll.filter(Boolean)
      : [];
    const requiresAny = Array.isArray(gate.requiresAny)
      ? gate.requiresAny.filter(Boolean)
      : [];
    const missingAll = requiresAll.filter(
      (token) => !this._isCampExpansionTokenMet(token),
    );
    const anyMet =
      requiresAny.length === 0 ||
      requiresAny.some((token) => this._isCampExpansionTokenMet(token));
    const pathLevel = gate.requiresPathLevel || gate.requiresRoadLevel || "";
    const requiredPathCount = Math.max(
      0,
      Math.floor(Number(gate.requiresPathCount ?? gate.requiresRoadLinks) || 0),
    );
    const pathCount = pathLevel ? this._getCampPreparedPathCount(pathLevel) : 0;
    const pathsMet = !pathLevel || pathCount >= requiredPathCount;
    const met = missingAll.length === 0 && anyMet && pathsMet;
    const missing = [];

    missingAll.forEach((token) => {
      missing.push(this._getCampExpansionTokenLabel(token));
    });
    if (!anyMet) {
      missing.push(
        `одно из: ${requiresAny
          .map((token) => this._getCampExpansionTokenLabel(token))
          .join(", ")}`,
      );
    }
    if (!pathsMet) {
      const pathData = this.getCampPathDataForLevel(pathLevel);
      missing.push(`${requiredPathCount} ${pathData.label}`);
    }

    return {
      id: gate.id || "",
      label: gate.label || "Новая зона",
      opensRadius: Number(gate.opensRadius) || 0,
      met,
      missing,
      requiresAll,
      requiresAny,
      pathLevel,
      requiredPathCount,
      pathCount,
    };
  }

  getCampMapExpansionState() {
    const expansion = this.data.localCampMap?.expansion || {};
    const baseRadius = this._getCampExpansionBaseRadius();
    const preparedRadius = this._getCampExpansionPreparedRadius();
    const gates = (expansion.frontierGates || [])
      .map((gate) => this.getCampExpansionGateProgress(gate))
      .filter((gate) => gate.opensRadius > baseRadius)
      .sort((a, b) => a.opensRadius - b.opensRadius);
    let radius = baseRadius;

    for (const gate of gates) {
      if (!gate.met) continue;
      radius = Math.max(radius, Math.min(gate.opensRadius, preparedRadius));
    }

    return {
      radius,
      baseRadius,
      preparedRadius,
      gates,
      nextGate: gates.find((gate) => gate.opensRadius > radius) || null,
    };
  }

  _getCampMapRadius() {
    return this.getCampMapExpansionState().radius;
  }

  _getCampHexDistance(q, r) {
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
  }

  // Live distance from the chosen camp origin (used in all game logic after chooseCamp)
  _getCampTileLiveDist(tile) {
    if (!tile) return 0;
    const origin = this.localCampMap?.campOrigin || { q: 0, r: 0 };
    const dq = (tile.q || 0) - origin.q;
    const dr = (tile.r || 0) - origin.r;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
  }

  isCampSetupDone() {
    return !!this.localCampMap?.campSetupDone;
  }

  _getCampCandidateTileIds() {
    return Object.entries(this._getCampMapTiles())
      .filter(
        ([, tile]) => tile.state === "camp_candidate" || tile.isCampCandidate,
      )
      .map(([id]) => id);
  }

  // ─── Camp founding intro (narrative overlay over the map) ───
  getCampFoundingIntroSteps() {
    return this.data.campFoundingIntro?.steps || [];
  }

  getCampIntroStep() {
    if (this.isCampSetupDone()) return null;
    const step = this.localCampMap?.introStep;
    if (step === null || step === undefined) return null;
    const steps = this.getCampFoundingIntroSteps();
    if (!steps.length) return null;
    return Math.max(0, Math.min(steps.length - 1, step));
  }

  getCampIntroStepData() {
    const idx = this.getCampIntroStep();
    if (idx === null) return null;
    const step = this.getCampFoundingIntroSteps()[idx];
    return step ? { ...step, index: idx } : null;
  }

  advanceCampIntro(targetStep = null) {
    if (this.isCampSetupDone()) return false;
    const steps = this.getCampFoundingIntroSteps();
    if (!steps.length) return false;
    const current = this.localCampMap.introStep;
    if (current === null || current === undefined) return false;

    let next;
    if (Number.isFinite(targetStep)) {
      next = Math.max(0, Math.min(steps.length - 1, targetStep));
    } else {
      next = current + 1;
    }

    if (next >= steps.length) {
      // Finished intro but still need to choose — stay on last step
      this.localCampMap.introStep = steps.length - 1;
      return false;
    }
    if (next === current) return false;
    this.localCampMap.introStep = next;
    this.markDirty();
    return true;
  }

  skipCampIntro() {
    if (this.isCampSetupDone()) return false;
    const steps = this.getCampFoundingIntroSteps();
    if (!steps.length) return false;
    const lastStep = steps.length - 1;
    if (this.localCampMap.introStep === lastStep) return false;
    this.localCampMap.introStep = lastStep;
    this.markDirty();
    return true;
  }

  // Returns IDs of tiles that would become discovered if the given candidate
  // was chosen as the camp origin. Used for hover preview in the UI.
  getCampCandidatePreviewTiles(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return [];
    const origin = { q: tile.q || 0, r: tile.r || 0 };
    const tiles = this._getCampMapTiles();
    const previewIds = [];
    const radius = 1; // only immediate neighbours of the chosen tile on start
    for (const [id, t] of Object.entries(tiles)) {
      if (id === tileId) continue;
      const dq = (t.q || 0) - origin.q;
      const dr = (t.r || 0) - origin.r;
      const d = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
      if (d > radius) continue;
      // Only preview tiles that would actually become reachable
      // (i.e. not locked behind discoveryRequirements)
      if (typeof t.discoveryRequirements === "function") {
        try {
          if (!t.discoveryRequirements(this)) continue;
        } catch (_e) {
          continue;
        }
      }
      previewIds.push(id);
    }
    return previewIds;
  }

  // ─── Camp founding — cost, quest progress, surveyed candidates ───
  getCampFoundingCost() {
    return { ...(this.data.campFoundingIntro?.cost || {}) };
  }

  getCampFoundingEnergyCost() {
    return Number.isFinite(this.data.campFoundingIntro?.energyCost)
      ? this.data.campFoundingIntro.energyCost
      : 0;
  }

  getCampFoundingResourceBreakdown(resourceId) {
    const stock = Math.max(0, this.resources?.[resourceId] || 0);
    const carried = Math.max(
      0,
      this.localCampMap?.carriedResources?.[resourceId] || 0,
    );
    return {
      stock,
      carried,
      total: stock + carried,
    };
  }

  getCampFoundingResourceAmount(resourceId) {
    return this.getCampFoundingResourceBreakdown(resourceId).total;
  }

  _spendCampFoundingResources(costObj = {}) {
    const spent = { stock: {}, carried: {} };

    for (const [resourceId, rawAmount] of Object.entries(costObj)) {
      let remaining = Math.max(0, Math.floor(Number(rawAmount) || 0));
      if (remaining <= 0) continue;

      const stockAvailable = Math.max(0, this.resources[resourceId] || 0);
      const stockSpent = Math.min(stockAvailable, remaining);
      if (stockSpent > 0) {
        this.resources[resourceId] = stockAvailable - stockSpent;
        spent.stock[resourceId] = stockSpent;
        remaining -= stockSpent;
      }

      if (remaining > 0) {
        if (!this.localCampMap.carriedResources) {
          this.localCampMap.carriedResources = {};
        }
        const carriedAvailable = Math.max(
          0,
          this.localCampMap.carriedResources[resourceId] || 0,
        );
        const carriedSpent = Math.min(carriedAvailable, remaining);
        if (carriedSpent > 0) {
          this.localCampMap.carriedResources[resourceId] =
            carriedAvailable - carriedSpent;
          if (this.localCampMap.carriedResources[resourceId] <= 0) {
            delete this.localCampMap.carriedResources[resourceId];
          }
          spent.carried[resourceId] = carriedSpent;
          remaining -= carriedSpent;
        }
      }

      if (remaining > 0) {
        this._refundCampFoundingResources(spent);
        return null;
      }
    }

    return spent;
  }

  _refundCampFoundingResources(spent = {}) {
    for (const [resourceId, amount] of Object.entries(spent.stock || {})) {
      this.resources[resourceId] = (this.resources[resourceId] || 0) + amount;
    }
    if (!this.localCampMap.carriedResources) {
      this.localCampMap.carriedResources = {};
    }
    for (const [resourceId, amount] of Object.entries(spent.carried || {})) {
      this.localCampMap.carriedResources[resourceId] =
        (this.localCampMap.carriedResources[resourceId] || 0) + amount;
    }
  }

  canFoundCamp() {
    const cost = this.getCampFoundingCost();
    const energyCost = this.getCampFoundingEnergyCost();
    const missingResources = {};
    const resourceBreakdown = {};
    let lacksResources = false;
    for (const [resId, amount] of Object.entries(cost)) {
      const breakdown = this.getCampFoundingResourceBreakdown(resId);
      const have = breakdown.total;
      resourceBreakdown[resId] = breakdown;
      if (have < amount) {
        missingResources[resId] = amount - have;
        lacksResources = true;
      }
    }
    const lacksEnergy = energyCost > 0 && !this.hasEnergy(energyCost);
    return {
      ok: !lacksResources && !lacksEnergy,
      missingResources,
      lacksEnergy,
      cost,
      energyCost,
      resourceBreakdown,
    };
  }

  canUseTileAsCampSite(tileId) {
    if (this.isCampSetupDone()) {
      return { ok: false, reason: "Лагерь уже основан." };
    }

    const tile = this._getCampMapTile(tileId);
    if (!tile) {
      return { ok: false, reason: "Участок не найден." };
    }

    const tileState = this.getCampTileState(tileId);
    if (
      tileState === "hidden" ||
      tileState === "silhouette" ||
      tileState === "visible_locked"
    ) {
      return {
        ok: false,
        reason: "Сначала нужно разведать этот участок.",
      };
    }

    return {
      ok: true,
      tile,
      recommended: !!tile.recommendedCampSite,
      reason: "",
    };
  }

  getCampFoundingQuestProgress() {
    const intro = this.data.campFoundingIntro || {};
    const steps = Array.isArray(intro.questSteps) ? intro.questSteps : [];
    const items = steps.map((step) => {
      let done = false;
      try {
        done = typeof step.check === "function" ? !!step.check(this) : false;
      } catch (_e) {
        done = false;
      }
      return {
        id: step.id,
        text: step.text,
        hint: step.hint,
        done,
      };
    });
    const allDone = items.length > 0 && items.every((i) => i.done);
    return { items, allDone };
  }

  getCampCandidatesSurveyedCount() {
    const arr = this.localCampMap?.surveyedCandidates;
    return Array.isArray(arr) ? arr.length : 0;
  }

  isCampCandidateSurveyed(tileId) {
    const arr = this.localCampMap?.surveyedCandidates;
    return Array.isArray(arr) && arr.includes(tileId);
  }

  markCampCandidateSurveyed(tileId) {
    if (this.isCampSetupDone()) return false;
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;
    if (tile.state !== "camp_candidate" && !tile.isCampCandidate) return false;
    if (!Array.isArray(this.localCampMap.surveyedCandidates)) {
      this.localCampMap.surveyedCandidates = [];
    }
    if (this.localCampMap.surveyedCandidates.includes(tileId)) return false;
    this.localCampMap.surveyedCandidates.push(tileId);
    this.markDirty();

    // If quest becomes fully complete right now — push readyStory once
    if (!this.localCampMap.readyStoryShown) {
      const progress = this.getCampFoundingQuestProgress();
      if (progress.allDone) {
        const story = this.data.campFoundingIntro?.readyStory;
        if (story) {
          this._pushStoryEvent({
            type: "map",
            icon: story.icon || "🧺",
            title: story.title || "Всё готово",
            text: story.text || "",
            ttlMs: story.ttlMs || 6000,
          });
        }
        this.localCampMap.readyStoryShown = true;
      }
    }
    return true;
  }

  _maybeEmitCampReadyStory() {
    if (this.isCampSetupDone()) return;
    if (this.localCampMap.readyStoryShown) return;
    const progress = this.getCampFoundingQuestProgress();
    if (!progress.allDone) return;
    const story = this.data.campFoundingIntro?.readyStory;
    if (story) {
      this._pushStoryEvent({
        type: "map",
        icon: story.icon || "🧺",
        title: story.title || "Всё готово",
        text: story.text || "",
        ttlMs: story.ttlMs || 6000,
      });
    }
    this.localCampMap.readyStoryShown = true;
    this.markDirty();
  }

  isCampEntered() {
    return !!this.localCampMap?.campEntered;
  }

  markCampEntered() {
    if (!this.isCampSetupDone()) return false;
    if (this.localCampMap.campEntered) return false;
    this.localCampMap.campEntered = true;

    const story = this.data.campFoundingIntro?.enterStory;
    if (story) {
      this._pushStoryEvent({
        type: "map",
        icon: story.icon || "🚪",
        title: story.title || "Шаг за порог",
        text: story.text || "",
        ttlMs: story.ttlMs || 5500,
      });
    }
    this.markDirty();
    return true;
  }

  // ─── Camp settings ───────────────────────────────────────────────────────

  getCampSettings() {
    return this.localCampMap?.campSettings || { name: "" };
  }

  updateCampName(name) {
    if (!this.localCampMap) return;
    const sanitized = typeof name === "string" ? name.trim().slice(0, 40) : "";
    if (!this.localCampMap.campSettings) {
      this.localCampMap.campSettings = { name: "" };
    }
    if (this.localCampMap.campSettings.name === sanitized) return;
    this.localCampMap.campSettings.name = sanitized;
    this.markDirty();
  }

  setCharacterTitle(name) {
    const sanitized =
      typeof name === "string"
        ? name.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 32)
        : "";
    if (!sanitized || sanitized === this.characterTitle) return;
    this.characterTitle = sanitized;
    this.markDirty();
  }

  // ─── Building upgrades ───────────────────────────────────────────────────

  isUpgradeApplied(upgradeId) {
    return (
      Array.isArray(this.localCampMap?.appliedUpgrades) &&
      this.localCampMap.appliedUpgrades.includes(upgradeId)
    );
  }

  getBuildingLevel(buildingId) {
    if (!this.buildings?.[buildingId]) return 0;
    let level = 1;
    for (const upgradeId of this.localCampMap?.appliedUpgrades || []) {
      const upgrade = this.data.buildingUpgrades?.[upgradeId];
      if (upgrade?.targetBuilding !== buildingId) continue;
      const upgradeLevel = Number(upgrade.level || 0);
      if (upgradeLevel > level) level = upgradeLevel;
    }
    return Math.min(5, level);
  }

  getNextBuildingLevelUpgrade(buildingId) {
    const level = this.getBuildingLevel(buildingId);
    if (level <= 0 || level >= 5) return null;
    const nextLevel = level + 1;
    return (
      Object.values(this.data.buildingUpgrades || {}).find(
        (upgrade) =>
          upgrade.targetBuilding === buildingId && upgrade.level === nextLevel,
      ) || null
    );
  }

  canUpgrade(upgradeId) {
    const upgrade = this.data.buildingUpgrades?.[upgradeId];
    if (!upgrade) return { ok: false, reason: "unknown" };

    // Target building must be built
    if (!this.buildings[upgrade.targetBuilding]) {
      return { ok: false, reason: "building_not_built" };
    }

    // Not already applied
    if (this.isUpgradeApplied(upgradeId)) {
      return { ok: false, reason: "already_applied" };
    }

    // Another construction (build or upgrade) is busy.
    if (this.activeConstruction) {
      return { ok: false, reason: "construction_busy" };
    }

    if (
      upgrade.prerequisiteUpgrade &&
      !this.isUpgradeApplied(upgrade.prerequisiteUpgrade)
    ) {
      return {
        ok: false,
        reason: "prerequisite_upgrade",
        prerequisiteUpgrade: upgrade.prerequisiteUpgrade,
      };
    }

    if (
      upgrade.level &&
      this.getBuildingLevel(upgrade.targetBuilding) < upgrade.level - 1
    ) {
      return { ok: false, reason: "level_locked", level: upgrade.level - 1 };
    }

    // Tech requirement
    if (upgrade.unlockedBy && !this.researched[upgrade.unlockedBy]) {
      return { ok: false, reason: "tech_locked" };
    }

    // Energy
    const energyCost = upgrade.energyCost || 0;
    if (!this.hasEnergy(energyCost)) {
      return { ok: false, reason: "no_energy", energyCost };
    }

    // Resources
    const cost = upgrade.cost || {};
    const missingResources = [];
    for (const [res, amount] of Object.entries(cost)) {
      if ((this.resources[res] || 0) < amount) {
        missingResources.push({
          resource: res,
          need: amount,
          have: this.resources[res] || 0,
        });
      }
    }
    if (missingResources.length > 0) {
      return { ok: false, reason: "no_resources", missingResources };
    }

    return { ok: true };
  }

  applyUpgrade(upgradeId) {
    const check = this.canUpgrade(upgradeId);
    if (!check.ok) return false;

    // Block while another construction (build or upgrade) is in progress.
    if (this.activeConstruction) return false;

    const upgrade = this.data.buildingUpgrades[upgradeId];
    const cost = upgrade.cost || {};
    const energyCost = upgrade.energyCost || 0;

    if (!this.spendResources(cost)) return false;
    if (!this.spendEnergy(energyCost)) {
      // Rollback resources
      for (const [res, amount] of Object.entries(cost)) {
        this.resources[res] = (this.resources[res] || 0) + amount;
      }
      return false;
    }

    // Start a timed upgrade — reuses activeConstruction so the same UI
    // (progress bar, "is-constructing" plot state) works for upgrades.
    const baseDuration = Number.isFinite(upgrade.buildTimeMs)
      ? upgrade.buildTimeMs
      : 8000 + (upgrade.level || 1) * 4000;
    const durationMs = Math.max(
      1000,
      Math.round(baseDuration * this.buildTimeMultiplier),
    );
    const tileId =
      this.localCampMap?.buildingPlacements?.[upgrade.targetBuilding] || null;
    this.activeConstruction = {
      buildingId: upgrade.targetBuilding,
      upgradeId,
      tileId,
      durationMs,
      startedAt: Date.now(),
    };
    this.addLog(
      `🛠️ Начато улучшение: ${upgrade.icon || "⬆️"} ${upgrade.name} (${Math.ceil(durationMs / 1000)}с, ⚡-${energyCost})`,
    );
    this.markDirty();
    this.saveGame(true);
    return true;
  }

  /**
   * Cancel the currently active construction or upgrade.
   * Refunds 100% of the spent resources and 50% of the spent energy
   * (rounded down) — a small penalty to discourage tap-spam, while keeping
   * the prototype forgiving.
   */
  cancelConstruction() {
    const ac = this.activeConstruction;
    if (!ac) return false;

    let cost = {};
    let energyCost = 0;
    let label = "";
    let icon = "⏳";

    if (ac.upgradeId) {
      const upgrade = this.data.buildingUpgrades?.[ac.upgradeId];
      if (upgrade) {
        cost = upgrade.cost || {};
        energyCost = upgrade.energyCost || 0;
        label = `Улучшение: ${upgrade.name}`;
        icon = upgrade.icon || "⬆️";
      }
    } else {
      const building = this.data.buildings?.[ac.buildingId];
      if (building) {
        cost = this.getBuildingCost(ac.buildingId) || {};
        energyCost = building.energyCost || 0;
        label = building.name;
        icon = building.icon || "🏗️";
      }
    }

    // Refund resources (100%).
    for (const [res, amount] of Object.entries(cost)) {
      this.resources[res] = (this.resources[res] || 0) + amount;
    }
    // Refund energy (50%, rounded down).
    const energyRefund = Math.floor(energyCost * 0.5);
    if (energyRefund > 0 && this.character) {
      const max =
        this.character.energyMax ?? this.character.maxEnergy ?? Infinity;
      this.character.energy = Math.min(
        max,
        (this.character.energy || 0) + energyRefund,
      );
    }

    this.activeConstruction = null;
    this.addLog(
      `🚫 Отменено — ${icon} ${label} (возврат ресурсов, ⚡+${energyRefund})`,
    );
    this._recalculateDerivedState?.();
    this._syncLocalCampMap?.();
    this.markDirty();
    this.saveGame(true);
    return true;
  }

  /** Internal: finalize an in-progress upgrade once its timer elapses. */
  _finalizeUpgrade(upgradeId) {
    const upgrade = this.data.buildingUpgrades?.[upgradeId];
    if (!upgrade) return;
    if (!Array.isArray(this.localCampMap.appliedUpgrades)) {
      this.localCampMap.appliedUpgrades = [];
    }
    if (!this.localCampMap.appliedUpgrades.includes(upgradeId)) {
      this.localCampMap.appliedUpgrades.push(upgradeId);
    }
    this._recalculateDerivedState();
    this.addLog(`⬆️ Улучшение применено: ${upgrade.name}`);
    this._pushStoryEvent({
      type: "camp",
      icon: upgrade.icon || "⬆️",
      title: upgrade.name,
      text: upgrade.description || "",
      ttlMs: 5000,
    });
    this.saveGame(true);
  }

  getUpgradesForBuilding(buildingId) {
    const upgrades = this.data.buildingUpgrades || {};
    return Object.values(upgrades).filter(
      (u) => u.targetBuilding === buildingId,
    );
  }

  chooseCamp(tileId) {
    const siteCheck = this.canUseTileAsCampSite(tileId);
    if (!siteCheck.ok) return false;
    const tile = siteCheck.tile;

    // Ritual gating: resources + energy must be available
    const check = this.canFoundCamp();
    if (!check.ok) return false;

    // Spend the founding cost from the early stock first, then from carried
    // resources. Pre-camp materials may be either at the night spot or in hand.
    const spentFoundingResources = this._spendCampFoundingResources(check.cost);
    if (!spentFoundingResources) return false;
    if (check.energyCost > 0 && !this.spendEnergy(check.energyCost)) {
      // Best-effort rollback: refund already-spent resources
      this._refundCampFoundingResources(spentFoundingResources);
      return false;
    }

    // Set camp origin to chosen tile
    this.localCampMap.campOrigin = { q: tile.q, r: tile.r };
    this.localCampMap.campSetupDone = true;
    this.localCampMap.campTileId = tileId;
    this.localCampMap.introStep = null;

    // Chosen tile becomes the camp center
    this.localCampMap.tileStates[tileId] = "camp";

    // Other candidates become regular discovered terrain
    for (const candidateId of this._getCampCandidateTileIds()) {
      if (candidateId === tileId) continue;
      this.localCampMap.tileStates[candidateId] = "discovered";
    }

    // Clear any leftover silhouettes so post-camp sync can recompute
    // them as discovered (if reachable) or hidden (if not yet gated).
    for (const [tid, s] of Object.entries(this.localCampMap.tileStates)) {
      if (s === "silhouette") this.localCampMap.tileStates[tid] = "hidden";
    }

    // Select the camp tile
    this.localCampMap.selectedTileId = tileId;

    // Ensure there are resource tiles within reach of the new camp.
    // If the chosen tile has no wood/stone/fiber within radius 1, generate them.
    this._ensureStartingResourceTiles(tileId);

    // Sync map with new origin (reveals starting resource tiles + generated ones)
    this._syncLocalCampMap({ pushStory: false });

    this.addLog(`🏕️ Лагерь основан: "${tile.name}".`);
    if (tile.campChosenStory) {
      this.addLog(`📝 ${tile.campChosenStory}`);
    }
    const ritualStory = this.data.campFoundingIntro?.ritualStory;
    this._pushStoryEvent({
      type: "map",
      icon: ritualStory?.icon || "🏕️",
      title: ritualStory?.title || "Лагерь основан",
      text:
        ritualStory?.text ||
        tile.campChosenStory ||
        `Место выбрано. Отсюда начнётся первое освоение местности.`,
      ttlMs: ritualStory?.ttlMs || 6500,
    });
    this._pushStoryEvent({
      type: "map",
      icon: "🧭",
      title: "Осмотрись вокруг",
      text: "Рядом открылись участки, где можно начать собирать дерево, камень и волокно.",
      ttlMs: 7000,
    });

    this.markDirty();
    this.saveGame(true);
    return true;
  }

  _getCampMapCoordKey(q, r) {
    return `${q},${r}`;
  }

  _getProceduralCampTileId(q, r) {
    return `tile_${q}_${r}`;
  }

  _normalizeCampTileState(state) {
    switch (state) {
      case "developed":
      case "settled":
      case "exploited":
        return "developed";
      case "camp":
        return "camp";
      case "camp_candidate":
        return "camp_candidate";
      case "terrain_seen":
        return "terrain_seen";
      case "silhouette":
        return "silhouette";
      case "visible_locked":
        return "visible_locked";
      case "discovered":
      case "hidden":
        return state;
      default:
        return "hidden";
    }
  }

  _createProceduralCampTile(q, r) {
    const distanceFromCamp = this._getCampHexDistance(q, r);
    const expansion = this.data.localCampMap?.expansion || {};
    const ringPlan = expansion.rings?.[distanceFromCamp] || null;
    const baseTerrains = this.data.baseTerrains || {};
    const grass = baseTerrains.grass || {
      name: "Травы",
      icon: "🌾",
      description: "Спокойный участок местности рядом с лагерем.",
      terrainType: "grass",
    };
    const brush = baseTerrains.brush || grass;
    const rocks = baseTerrains.rocks || grass;
    const water = baseTerrains.water || grass;
    const clearing = baseTerrains.clearing || grass;
    const hash = Math.abs(q * 37 + r * 19 + (q + r) * 11);
    // Wider roll space (0..23) so roll branches don't collapse to a default
    const roll = hash % 24;

    // Subtype index for picking a name variant per terrain
    const subIdx = (hash >> 2) % 3;

    let terrain = grass;
    let actionId = null;
    let resourceType = null;
    let resourceAmount = null;
    let icon = "•";
    let name = "Участок";
    let description = "Спокойный участок местности рядом с лагерем.";
    let sourceKind = null;
    let roleLabel = null;
    let roleDescription = null;

    // Distance bonus: 0 at d=1, +1 per ring further out
    const distBonus = Math.max(0, distanceFromCamp - 1);

    // ── Resource tiles ─────────────────────────────────────────────────
    // Balanced ≈ 2/24 per primary resource (wood, stone, fiber) + rare
    // named landmarks on d≥3. Reserved slots (24..) are used for landmarks.
    if (roll <= 1) {
      // Wood (2/24 ≈ 8%) — brush/grove
      const isGrove = subIdx === 0 && distanceFromCamp >= 2;
      terrain = isGrove ? { ...brush, terrainType: "grove" } : brush;
      actionId = "gather_wood";
      resourceType = "wood";
      resourceAmount = 3 + (hash % 3) + distBonus * 4;
      icon = "🪵";
      const woodNames = isGrove
        ? ["Сосновая опушка", "Берёзовый подрост", "Тенистая роща"]
        : ["Заросли хвороста", "Сухие ветви", "Кустистый подлесок"];
      name = woodNames[subIdx % woodNames.length];
      description = isGrove
        ? "Молодой лес с опавшими ветками. Подходит для сбора дров и ровных жердей."
        : "Сухой кустарник со сломанными ветвями — тут проще всего собрать топливо.";
      sourceKind = isGrove ? "wood_grove" : "brush_deadwood";
      roleLabel = isGrove ? "Источник дров и жердей" : "Источник сухих ветвей";
      roleDescription = isGrove
        ? "Небольшая роща, где можно набрать не только топливо, но и более ровные жерди для лагерных нужд."
        : "Сухой подлесок и ломкие ветви. Отсюда удобнее всего брать лёгкое топливо для первых костров.";
    } else if (roll === 2 || roll === 3) {
      // Fiber (2/24 ≈ 8%) — grass
      terrain = grass;
      actionId = "gather_fiber";
      resourceType = "fiber";
      resourceAmount = 2 + (hash % 3) + distBonus * 3;
      icon = "🌾";
      const fiberNames = [
        "Полоса жёсткой травы",
        "Заросли пырея",
        "Седой ковыль",
      ];
      name = fiberNames[subIdx];
      description =
        "Жёсткие стебли и волокна. Из таких связок выходят грубые верёвки и подвязки.";
      sourceKind = "rough_fiber";
      roleLabel = "Источник жёстких волокон";
      roleDescription =
        "Жёсткая трава и волокнистые стебли для подвязок, грубой верёвки и первых хозяйственных связок.";
    } else if (roll === 4 || roll === 5) {
      // Stone (2/24 ≈ 8%) — rocks
      terrain = rocks;
      actionId = "gather_stone";
      resourceType = "stone";
      resourceAmount = 2 + (hash % 2) + distBonus * 3;
      icon = "🪨";
      const stoneNames = ["Каменная гряда", "Гранитный выход", "Старая осыпь"];
      name = stoneNames[subIdx];
      description =
        "Выход породы с подходящими сколами. Здесь можно подобрать тяжёлые куски и острые камни.";
      sourceKind = "stone_outcrop";
      roleLabel = "Источник камня и сколов";
      roleDescription =
        "Выход породы, где проще найти тяжёлые куски и острые сколы для грубых орудий и стройки.";
    }
    // ── Rare named landmarks on d≥3 (give far rings a reason to exist) ──
    else if (roll === 6 && distanceFromCamp >= 3) {
      // Ancient oak — rich wood landmark
      terrain = { ...brush, terrainType: "grove" };
      actionId = "gather_wood";
      resourceType = "wood";
      resourceAmount = 22 + distBonus * 3;
      icon = "🌳";
      name = "Старый дуб";
      description =
        "Могучий дуб, переживший много зим. Под ним лежат толстые сухие ветви — одной ходки хватит надолго.";
      sourceKind = "ancient_oak";
      roleLabel = "Богатый источник древесины";
      roleDescription =
        "Старое дерево с большим запасом сухих ветвей. Дальний выход сюда окупается объёмом древесины.";
    } else if (roll === 6 && distanceFromCamp === 2) {
      // Birch grove — medium fiber landmark
      terrain = { ...brush, terrainType: "grove" };
      actionId = "gather_fiber";
      resourceType = "fiber";
      resourceAmount = 16 + distBonus * 2;
      icon = "🪵";
      name = "Берёзовая роща";
      description =
        "Стройные берёзы с тонкой корой. Из лыка выходят крепкие связки — волокна здесь отличные.";
      sourceKind = "birch_bast";
      roleLabel = "Источник лыка и волокон";
      roleDescription =
        "Берёзовая роща даёт гибкое лыко и прочные волокна для связок, перевязки и ранних заготовок.";
    } else if (roll === 7 && distanceFromCamp >= 3) {
      // Flint ridge — rich stone landmark
      terrain = rocks;
      actionId = "gather_stone";
      resourceType = "stone";
      resourceAmount = 20 + distBonus * 3;
      icon = "🪨";
      name = "Кремнёвый гребень";
      description =
        "Длинная гряда с крепкими сколами кремня. Породу выбивать тяжелее, но камни здесь намного лучше.";
      sourceKind = "flint_ridge";
      roleLabel = "Богатый источник крепкого камня";
      roleDescription =
        "Дальний гребень с крепкими сколами. Добывать тяжелее, зато камень здесь заметно лучше обычной россыпи.";
    } else if (roll === 7 && distanceFromCamp === 2) {
      // Nut scatter — food landmark
      terrain = { ...brush, terrainType: "grove" };
      actionId = "gather_food";
      resourceType = "food";
      resourceAmount = 12 + distBonus * 2;
      icon = "🌰";
      name = "Орешниковый островок";
      description =
        "Плотный куст орешника с упавшими орехами у корней. Негусто, но сытно.";
      sourceKind = "nut_scatter";
      roleLabel = "Источник орехов и плотной пищи";
      roleDescription =
        "Небольшой орешник даёт не слишком много пищи, но она заметно сытнее обычных ягодных находок.";
    } else if (roll === 8 && distanceFromCamp >= 2) {
      // Clean spring — water landmark (rare because hand-placed tiles cover close range)
      terrain = water;
      actionId = "gather_water";
      resourceType = "water";
      resourceAmount = 14 + distBonus * 2;
      icon = "💧";
      const springNames = [
        "Чистый родник",
        "Ключ у корней",
        "Прохладный источник",
      ];
      name = springNames[subIdx];
      description =
        "Холодная вода сочится из-под камней. Нужно терпение, чтобы набрать запас, но вода свежая.";
      sourceKind = "fresh_spring";
      roleLabel = "Источник свежей воды";
      roleDescription =
        "Чистый дальний источник. Наполнять запас дольше, но вода здесь свежая и надёжная.";
    }
    // ── Neutral terrain tiles (variety, no resource) ───────────────────
    else if (roll === 9 || roll === 10) {
      // Grove (forested ring, mostly far out)
      terrain = { ...brush, terrainType: "grove" };
      icon = "🌲";
      const groveNames = [
        "Сосновая чаща",
        "Тёмный край рощи",
        "Молодой ельник",
      ];
      name = groveNames[subIdx];
      description =
        "Густая тень, мягкий мох под ногами. Пока без понятной пользы — но сюда можно проложить тропу.";
    } else if (roll === 11 || roll === 12) {
      // Brush (wild edge)
      terrain = brush;
      icon = "🌿";
      const brushNames = [
        "Кустарник терна",
        "Заросли орешника",
        "Краевой подлесок",
      ];
      name = brushNames[subIdx];
      description =
        "Колючая кромка зарослей. Через неё неудобно идти, но иногда здесь можно найти укрытие от ветра.";
    } else if (roll === 13 || roll === 14) {
      // Grass plain
      terrain = grass;
      icon = "🌾";
      const grassNames = ["Луговина", "Открытая пустошь", "Травяной откос"];
      name = grassNames[subIdx];
      description =
        "Открытое травяное поле. Ветер гуляет свободно, но место удобное для прохода.";
    } else if (roll === 15 || roll === 16) {
      // Rock outcrop (no resource)
      terrain = rocks;
      icon = "🪨";
      const rockNames = ["Каменистый склон", "Голый камень", "Россыпь валунов"];
      name = rockNames[subIdx];
      description =
        "Сухой каменистый участок. Породы здесь жёстче, чем у россыпи рядом со стоянкой — добывать неудобно.";
    } else if (roll === 17) {
      // Clearing (rest spot)
      terrain = clearing;
      icon = "🌲";
      const clearNames = ["Тихая поляна", "Сухая прогалина", "Открытое место"];
      name = clearNames[subIdx];
      description =
        "Ровный участок земли. Подходит для отдыха или ночлега в дальних выходах.";
    } else if (roll === 18 && distanceFromCamp >= 2) {
      // Damp lowland — neutral water terrain (no gather action)
      terrain = water;
      icon = "💧";
      const wetNames = ["Влажная низина", "Топкая лощина", "Старый промой"];
      name = wetNames[subIdx];
      description =
        "Сырое место, где после дождя долго держится вода. Вкус болотный — пить неприятно.";
    } else if (roll >= 19 && roll <= 21) {
      // Mixed brush/grass — variety filler
      const useBrush = subIdx === 0;
      terrain = useBrush ? brush : grass;
      icon = useBrush ? "🌿" : "🌾";
      const mixedNames = useBrush
        ? ["Низкий подлесок", "Полоса вереска", "Старый бурелом"]
        : ["Степной язык", "Жёсткое разнотравье", "Полевая кромка"];
      name = mixedNames[subIdx % mixedNames.length];
      description = useBrush
        ? "Низкий кустарник с переплетением веток. Не густо, но идти неудобно."
        : "Открытая полоса трав, выгоревшая на солнце.";
    } else {
      // 22..23 — outer ring filler (forested edge)
      terrain =
        distanceFromCamp >= 3 ? { ...brush, terrainType: "grove" } : brush;
      icon = "🌲";
      const edgeNames = ["Дальняя кромка леса", "Лесной край", "Тёмная опушка"];
      name = edgeNames[subIdx];
      description =
        "Край знакомой местности. Дальше пока туман — там видно только силуэты.";
    }

    return {
      id: this._getProceduralCampTileId(q, r),
      q,
      r,
      distanceFromCamp,
      terrainType: terrain.terrainType || "grass",
      state: "hidden",
      icon,
      name,
      description,
      actionId,
      resourceType,
      resourceAmount,
      sourceKind,
      roleLabel,
      roleDescription,
      mapRing: distanceFromCamp,
      expansionPlanId: ringPlan?.id || "",
      ringLabel: ringPlan?.label || "",
      biome: ringPlan?.biome || "",
      hazardTags: Array.isArray(ringPlan?.hazardTags)
        ? [...ringPlan.hazardTags]
        : [],
      futureResourceHints: Array.isArray(ringPlan?.futureResourceHints)
        ? [...ringPlan.futureResourceHints]
        : [],
      wildlifeHints: Array.isArray(ringPlan?.wildlifeHints)
        ? [...ringPlan.wildlifeHints]
        : [],
      eventSeeds: Array.isArray(ringPlan?.eventSeeds)
        ? [...ringPlan.eventSeeds]
        : [],
      surveySignals: Array.isArray(ringPlan?.surveySignals)
        ? [...ringPlan.surveySignals]
        : [],
      expansionNotes: ringPlan?.notes || "",
    };
  }

  // ─── Dynamic resource tile generation ─────────────────────────────────────

  // After camp is founded at any tile: if wood, stone, or fiber are not within
  // radius 1, create virtual resource tiles at adjacent empty positions.
  _ensureStartingResourceTiles(campTileId) {
    const campTile = this._getCampMapTile(campTileId);
    if (!campTile) return;

    // Check which resources are already within radius 1
    const allTiles = this._getCampMapTiles();
    const needed = new Set(["wood", "stone", "fiber"]);
    for (const t of Object.values(allTiles)) {
      if (t.resourceType && needed.has(t.resourceType)) {
        const dist = this._getCampTileLiveDist(t);
        if (dist <= 1) needed.delete(t.resourceType);
      }
    }
    if (needed.size === 0) return;

    // Find adjacent positions not already occupied
    const DIRECTIONS = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ];
    const usedCoords = new Set(
      Object.values(allTiles).map((t) => `${t.q},${t.r}`),
    );
    const freePositions = DIRECTIONS.map(([dq, dr]) => [
      campTile.q + dq,
      campTile.r + dr,
    ]).filter(([q, r]) => !usedCoords.has(`${q},${r}`));

    const defs = {
      wood: {
        icon: "🌿",
        name: "Ветви рядом",
        terrainName: "Лесная кромка",
        terrainTags: ["wooded", "near_camp", "deadwood"],
        potentials: ["валежник", "растопка", "ветви"],
        visibleMarkers: ["branches"],
        terrainType: "brush",
        actionId: "gather_wood",
        amount: 10,
      },
      stone: {
        icon: "🪨",
        name: "Камни рядом",
        terrainName: "Каменистая земля",
        terrainTags: ["rocky", "near_camp", "surface_stone"],
        potentials: ["камни", "острые сколы"],
        visibleMarkers: ["stone"],
        terrainType: "rock",
        actionId: "gather_stone",
        amount: 8,
      },
      fiber: {
        icon: "🌾",
        name: "Трава рядом",
        terrainName: "Жёсткая трава",
        terrainTags: ["grassy", "near_camp", "fiber"],
        potentials: ["волокна", "связки", "сухая трава"],
        visibleMarkers: ["fiber"],
        terrainType: "grass",
        actionId: "gather_fiber",
        amount: 7,
      },
    };

    if (!this.localCampMap.generatedTiles)
      this.localCampMap.generatedTiles = {};

    let posIdx = 0;
    for (const resource of needed) {
      if (posIdx >= freePositions.length) break;
      const [q, r] = freePositions[posIdx++];
      const def = defs[resource];
      const id = `gen_${resource}_${String(q).replace("-", "m")}_${String(r).replace("-", "m")}`;
      this.localCampMap.generatedTiles[id] = {
        id,
        q,
        r,
        terrainType: def.terrainType,
        terrainName: def.terrainName,
        terrainTags: def.terrainTags,
        potentials: def.potentials,
        visibleMarkers: def.visibleMarkers,
        state: "discovered",
        icon: def.icon,
        name: def.name,
        description:
          "Ближайший источник ресурсов рядом с выбранным местом лагеря.",
        actionId: def.actionId,
        resourceType: resource,
        resourceAmount: def.amount,
        isGenerated: true,
      };
      this.localCampMap.tileStates[id] = "discovered";
      this.localCampMap.tileResourceRemaining[id] = def.amount;
    }

    // Invalidate tile cache so generated tiles are picked up on next access
    this._campMapTilesCache = null;
  }

  // Reveal a silhouette/hidden tile (used for the exploration travel feature).
  discoverCampTile(tileId) {
    if (!tileId) return false;
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;
    const current = this.getCampTileState(tileId);
    if (
      current === "camp" ||
      current === "developed" ||
      current === "discovered" ||
      current === "camp_candidate"
    ) {
      return false; // already revealed
    }
    if (
      typeof this.canRevealCampTileByExploration === "function" &&
      !this.canRevealCampTileByExploration(tileId)
    ) {
      if (["hidden", "silhouette", "visible_locked"].includes(current)) {
        this.localCampMap.tileStates[tileId] = "terrain_seen";
        this._syncLocalCampMap({ pushStory: false });
        this.markDirty();
      }
      return false;
    }
    this.localCampMap.tileStates[tileId] = "discovered";
    let surveyAssistTile = null;
    if (this.getCharacterSurveyRevealBonus() > 0) {
      surveyAssistTile = this._getCampSurveyAssistTile(tileId);
      if (surveyAssistTile) {
        this.localCampMap.tileStates[surveyAssistTile.id] = "discovered";
      }
    }
    this._syncLocalCampMap({ pushStory: false });
    this.addLog(
      surveyAssistTile
        ? `🔍 Открыт новый участок: "${tile.name}". Следы вокруг помогают заметить ещё и "${surveyAssistTile.name}".`
        : `🔍 Открыт новый участок: "${tile.name}".`,
    );
    this.markDirty();
    return true;
  }

  // Helper: return full tile details for the best tile matching a gather action.
  // Used by the gather panel to start map travel animation.
  getBestGatherTileDetails(actionId) {
    const tile = this._getPreferredCampGatherTile(actionId);
    if (!tile) return null;
    return this.getCampMapTileDetails(tile.id);
  }

  _getCampNeighborTileIds(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return [];

    const directions = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ];
    const tilesByCoord = new Map(
      this._getCampMapTileList().map((entry) => [
        this._getCampMapCoordKey(entry.q, entry.r),
        entry.id,
      ]),
    );

    return directions
      .map(([dq, dr]) =>
        tilesByCoord.get(this._getCampMapCoordKey(tile.q + dq, tile.r + dr)),
      )
      .filter(Boolean);
  }

  // BFS: shortest tile-by-tile path on the hex grid from fromTileId to toTileId.
  // Returns array of tile IDs including both endpoints.
  _findCampHexPath(fromTileId, toTileId, options = {}) {
    if (fromTileId === toTileId) return [fromTileId];
    const allowFallback = options?.allowFallback !== false;
    const canEnterTile = (tileId) => {
      if (tileId === fromTileId || tileId === toTileId) return true;
      const tile = this._getCampMapTile(tileId);
      const state = this.getCampTileState(tileId);
      if (
        [
          "camp",
          "camp_candidate",
          "developed",
          "discovered",
          "terrain_seen",
        ].includes(state)
      ) {
        return true;
      }
      return !tile || this.isCampTilePresentationUnlocked(tile);
    };
    const prev = new Map();
    const queue = [fromTileId];
    prev.set(fromTileId, null);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === toTileId) {
        const path = [];
        let node = toTileId;
        while (node !== null) {
          path.unshift(node);
          node = prev.get(node);
        }
        return path;
      }
      for (const nid of this._getCampNeighborTileIds(current)) {
        if (!prev.has(nid) && canEnterTile(nid)) {
          prev.set(nid, current);
          queue.push(nid);
        }
      }
    }
    // Fallback: no path through neighbors (edge case)
    return allowFallback ? [fromTileId, toTileId] : [];
  }

  _getCampTileMoveProfile(tile) {
    const terrainType = tile?.terrainType || "plain";
    const baseProfiles = {
      camp: { cost: 0.75, label: "стоянка" },
      clearing: { cost: 0.95, label: "ровная поляна" },
      grass: { cost: 1.0, label: "трава" },
      worksite: { cost: 1.0, label: "твёрдая площадка" },
      lore: { cost: 1.0, label: "старый след" },
      brush: { cost: 1.16, label: "заросли" },
      clay: { cost: 1.22, label: "вязкая глина" },
      water: { cost: 1.28, label: "влажный берег" },
      grove: { cost: 1.34, label: "чаща" },
      rock: { cost: 1.42, label: "камни" },
      ridge: { cost: 1.48, label: "гряда" },
      kiln: { cost: 1.12, label: "жарная терраса" },
      plain: { cost: 1.0, label: "участок" },
    };
    const profile = baseProfiles[terrainType] || baseProfiles.plain;
    const pathLevel = tile?.id ? this.getCampPathLevel(tile.id) : "none";
    const pathMultiplier = pathLevel !== "none" ? 0.8 : 1;

    return {
      terrainType,
      label: profile.label,
      baseCost: profile.cost,
      pathLevel,
      cost: Math.max(0.55, profile.cost * pathMultiplier),
    };
  }

  // Movement cost multiplier for entering a tile on foot.
  // Higher = slower passage. Trails reduce the cost of the entered tile.
  _getCampTileMoveCost(tile) {
    return this._getCampTileMoveProfile(tile).cost;
  }

  _getCampRevealRadius() {
    let radius = 0;

    if (
      this.getUnlockedInsightsCount() >= 1 ||
      (this.resources.crude_tools || 0) > 0
    ) {
      radius = 1;
    }
    if (this.buildings.campfire) {
      radius = 2;
    }
    if (
      this.buildings.storage ||
      this.buildings.rest_tent ||
      this.buildings.workshop ||
      this.researched.communal_memory
    ) {
      radius = 3;
    }
    if (
      this.buildings.kiln ||
      this.researched.mining ||
      this.researched.labor_division
    ) {
      radius = 4;
    }

    return Math.min(radius, this._getCampMapRadius());
  }

  _getCampMapSyncKey() {
    const origin = this.localCampMap?.campOrigin || { q: 0, r: 0 };
    const buildingIds = Object.keys(this.buildings).sort().join(",");
    const researchedIds = Object.keys(this.researched).sort().join(",");
    const appliedUpgradeIds = Array.isArray(this.localCampMap?.appliedUpgrades)
      ? [...this.localCampMap.appliedUpgrades].sort().join(",")
      : "";
    const activeConstructionKey = this.activeConstruction
      ? `${this.activeConstruction.buildingId || ""}@${this.activeConstruction.tileId || ""}`
      : "-";

    return [
      this.localCampMap?.campSetupDone ? 1 : 0,
      this.localCampMap?.campTileId || "",
      origin.q,
      origin.r,
      this._getCampMapRadius(),
      this.getUnlockedInsightsCount(),
      this.hasToolingPresentationUnlock() ? 1 : 0,
      buildingIds,
      researchedIds,
      appliedUpgradeIds,
      activeConstructionKey,
    ].join("::");
  }

  _getCampMapViewKey() {
    const encodeMap = (map) =>
      Object.entries(map || {})
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => `${key}:${value}`)
        .join(",");
    const activeConstructionKey = this.activeConstruction
      ? `${this.activeConstruction.buildingId || ""}@${this.activeConstruction.tileId || ""}:${Math.max(0, Math.ceil((this.activeConstruction.remainingMs || 0) / 200))}`
      : "-";

    return [
      this._campMapSyncKey || this._getCampMapSyncKey(),
      this.localCampMap?.selectedTileId || "",
      encodeMap(this.localCampMap?.pathLevels),
      encodeMap(this.localCampMap?.pathTraffic),
      encodeMap(this.localCampMap?.tileResourceRemaining),
      encodeMap(this.localCampMap?.buildingPlacements),
      activeConstructionKey,
    ].join("||");
  }

  _canTileMeetDiscoveryRules(tile) {
    if (!tile) return false;
    if (!this.isCampTilePresentationUnlocked(tile)) return false;
    const liveDist = this._getCampTileLiveDist(tile);
    if (liveDist === 0) return true;
    if (liveDist > this._getCampRevealRadius()) return false;
    if (
      typeof tile.discoveryRequirements === "function" &&
      !tile.discoveryRequirements(this)
    ) {
      return false;
    }
    return true;
  }

  _isCampTileUnknownForDiscovery(tileId) {
    const state = this.getCampTileState(tileId);
    return (
      state === "hidden" ||
      state === "silhouette" ||
      state === "visible_locked" ||
      state === "terrain_seen"
    );
  }

  _isCampTileFrontierForScouting(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile || !this._isCampTileUnknownForDiscovery(tileId)) return false;

    const visibleUnknownStates = new Set([
      "silhouette",
      "visible_locked",
      "terrain_seen",
    ]);
    if (visibleUnknownStates.has(this.getCampTileState(tileId))) return true;

    const accessibleStates = new Set([
      "camp",
      "camp_candidate",
      "developed",
      "discovered",
      "terrain_seen",
    ]);
    const characterTileId = this.getCharacterTileId?.();
    return this._getCampNeighborTileIds(tileId).some(
      (neighborTileId) =>
        neighborTileId === characterTileId ||
        accessibleStates.has(this.getCampTileState(neighborTileId)),
    );
  }

  _getCampExplorationOriginTileId() {
    return (
      this.getCharacterTileId?.() ||
      this.localCampMap?.campTileId ||
      this._getCampMapTileList().find(
        (tile) => this.getCampTileState(tile.id) === "camp",
      )?.id ||
      this._getCampMapTileList().find((tile) => tile.id === "camp_clearing")
        ?.id ||
      null
    );
  }

  canScoutCampTile(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile || !this._isCampTileUnknownForDiscovery(tileId)) return false;
    if (!this._isCampTileFrontierForScouting(tileId)) return false;

    const originTileId = this._getCampExplorationOriginTileId();
    if (!originTileId) return false;
    if (originTileId === tileId) return true;

    const path = this._findCampHexPath(originTileId, tileId, {
      allowFallback: false,
    });
    return Array.isArray(path) && path.length >= 2;
  }

  canRevealCampTileByExploration(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile || !this.canScoutCampTile(tileId)) return false;
    if (!this.isCampTilePresentationUnlocked(tile)) return false;
    if (
      typeof tile.discoveryRequirements === "function" &&
      !tile.discoveryRequirements(this)
    ) {
      return false;
    }
    return true;
  }

  canExploreCampTile(tileId) {
    return this.canScoutCampTile(tileId);
  }

  _canRevealCampTileByTraversal(tile) {
    if (!tile) return false;
    if (!this.isCampTilePresentationUnlocked(tile)) return false;
    if (
      typeof tile.discoveryRequirements === "function" &&
      !tile.discoveryRequirements(this)
    ) {
      return false;
    }
    return true;
  }

  _getCampReachableDiscoveredTileIds() {
    const reachable = new Set();
    const frontier = [];

    for (const tile of this._getCampMapTileList()) {
      const baseState = this._normalizeCampTileState(tile.state);
      const currentState = this._normalizeCampTileState(
        this.localCampMap?.tileStates?.[tile.id],
      );

      if (
        this._getCampTileLiveDist(tile) === 0 ||
        baseState === "discovered" ||
        baseState === "developed" ||
        baseState === "camp" ||
        currentState === "discovered" ||
        currentState === "developed" ||
        currentState === "camp"
      ) {
        reachable.add(tile.id);
        frontier.push(tile.id);
      }
    }

    while (frontier.length > 0) {
      const currentTileId = frontier.shift();
      for (const neighborTileId of this._getCampNeighborTileIds(
        currentTileId,
      )) {
        if (reachable.has(neighborTileId)) continue;
        const neighborTile = this._getCampMapTile(neighborTileId);
        if (!this._canTileMeetDiscoveryRules(neighborTile)) continue;
        reachable.add(neighborTileId);
        frontier.push(neighborTileId);
      }
    }

    return reachable;
  }

  _getCampMapTiles() {
    const radius = this._getCampMapRadius();
    if (this._campMapTilesCache && this._campMapTilesCacheRadius === radius) {
      return this._campMapTilesCache;
    }

    const tiles = {};
    const tilesByCoord = new Map();

    for (const tile of Object.values(this.data.localCampMap?.tiles || {})) {
      const normalizedTile = {
        ...tile,
        distanceFromCamp: Number.isFinite(tile.distanceFromCamp)
          ? tile.distanceFromCamp
          : this._getCampHexDistance(tile.q || 0, tile.r || 0),
        state: this._normalizeCampTileState(tile.state),
      };
      tiles[normalizedTile.id] = normalizedTile;
      tilesByCoord.set(
        this._getCampMapCoordKey(normalizedTile.q, normalizedTile.r),
        normalizedTile,
      );
    }

    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (q + r < -radius || q + r > radius) continue;
        const key = this._getCampMapCoordKey(q, r);
        if (tilesByCoord.has(key)) continue;

        const tile = this._createProceduralCampTile(q, r);
        tiles[tile.id] = tile;
      }
    }

    // Merge in dynamically generated resource tiles (created after camp founding)
    for (const [id, vtile] of Object.entries(
      this.localCampMap?.generatedTiles || {},
    )) {
      if (!tiles[id]) {
        tiles[id] = vtile;
        tilesByCoord.set(this._getCampMapCoordKey(vtile.q, vtile.r), vtile);
      }
    }

    this._campMapTilesCache = tiles;
    this._campMapTilesCacheRadius = radius;
    return tiles;
  }

  _getCampMapTileList() {
    return Object.values(this._getCampMapTiles());
  }

  _getCampMapTile(tileId) {
    return this._getCampMapTiles()[tileId] || null;
  }

  _getDefaultLocalCampMapState() {
    const tileStates = {};
    const tileResourceRemaining = {};
    const pathLevels = {};
    const pathTraffic = {};
    const tiles = this._getCampMapTiles();

    for (const [tileId, tile] of Object.entries(tiles)) {
      tileStates[tileId] = this._normalizeCampTileState(tile.state);
      pathLevels[tileId] = "none";
      if (Number.isFinite(tile.resourceAmount)) {
        tileResourceRemaining[tileId] = Number.isFinite(tile.resourceAmount)
          ? tile.resourceAmount
          : null;
      }
    }

    return {
      tileStates,
      tileResourceRemaining,
      pathLevels,
      pathTraffic,
      buildingPlacements: {},
      selectedTileId: "camp_clearing",
      campSetupDone: false,
      campTileId: null,
      campOrigin: { q: 0, r: 0 },
      introStep: 0,
      surveyedCandidates: [],
      campEntered: false,
      readyStoryShown: false,
      appliedUpgrades: [],
      campSettings: { name: "" },
      generatedTiles: {},
    };
  }

  _getDefaultSurroundingsMapState() {
    return {
      activeView: "local",
      selectedNodeId: "camp_core",
      targetNodeId: null,
      knownNodeIds: [],
    };
  }

  _getSurroundingsProgressContext() {
    const visibleStates = new Set([
      "terrain_seen",
      "discovered",
      "developed",
      "camp",
      "camp_candidate",
    ]);
    const discoveredStates = new Set(["discovered", "developed", "camp"]);
    const terrainTypes = new Set();
    let discoveredCount = 0;
    let developedCount = 0;
    let trailCount = 0;

    for (const tile of this._getCampMapTileList()) {
      const state = this.getCampTileState(tile.id);
      if (visibleStates.has(state) && tile.terrainType) {
        terrainTypes.add(tile.terrainType);
      }
      if (discoveredStates.has(state)) {
        discoveredCount += 1;
      }
      if (state === "developed" || state === "camp") {
        developedCount += 1;
      }
      if (this.getCampPathLevel(tile.id) === "trail") {
        trailCount += 1;
      }
    }

    const campName = this.localCampMap?.campSettings?.name?.trim() || "Стоянка";

    return {
      campName,
      discoveredCount,
      developedCount,
      trailCount,
      terrainTypes,
      buildingCount: Object.keys(this.buildings || {}).length,
    };
  }

  _getSurroundingsNodeDefs() {
    const { campName } = this._getSurroundingsProgressContext();

    return {
      camp_core: {
        id: "camp_core",
        q: 0,
        r: 0,
        tone: "camp",
        title: campName,
        subtitle: "Ядро лагеря",
        description:
          "Текущая локальная карта лагеря остаётся внутренним масштабом, где решаются точные действия, сбор и стройка.",
        detail:
          "Это не отдельный биом, а узел входа обратно в карту 20 м на гекс. Через него окрестности связываются с уже существующей логикой лагеря.",
        distanceMeters: 0,
        travelMinutes: 0,
        tags: ["20 м/гекс", "внутренний слой"],
        resources: ["лагерь", "склад", "строительство"],
        focusResourceIds: [],
        focusTerrainTypes: [],
      },
      sunny_meadow: {
        id: "sunny_meadow",
        q: 1,
        r: 0,
        tone: "meadow",
        title: "Светлая поляна",
        subtitle: "Открытый сухой сектор",
        description:
          "Ближний просторный участок, откуда удобно считывать рельеф и намечать безопасные выходы из лагеря.",
        detail:
          "Хороший кандидат на ранний район вылазок: видимость выше, риск ниже, но ресурсы не самые глубокие.",
        distanceMeters: 250,
        travelMinutes: 6,
        tags: ["250 м/гекс", "ранний выход"],
        resources: ["трава", "сухая древесина"],
        focusResourceIds: ["fiber", "wood", "food"],
        focusTerrainTypes: ["grass", "clearing", "brush"],
        focusTags: ["open", "grassy", "deadwood"],
        unlockHint:
          "Нужно закрепиться на нескольких ближних участках локальной карты.",
        unlockRule: (context) => context.discoveredCount >= 3,
      },
      forest_edge: {
        id: "forest_edge",
        q: 0,
        r: -1,
        tone: "forest",
        title: "Кромка леса",
        subtitle: "Плотные заросли и тень",
        description:
          "Лесной край обещает волокно, пищу и укрытие, но требует чуть большей уверенности в маршрутах.",
        detail:
          "Здесь уже чувствуется следующий масштаб: не один гекс, а целый сектор со своим характером и набором рисков.",
        distanceMeters: 300,
        travelMinutes: 8,
        tags: ["волокно", "поиск пищи"],
        resources: ["дерево", "волокно", "ягоды"],
        focusResourceIds: ["wood", "fiber", "food"],
        focusTerrainTypes: ["grove", "brush"],
        focusTags: ["wooded", "sheltered", "shade"],
        unlockHint:
          "Нужно раскрыть больше ближних участков или выйти к древесным зонам рядом с лагерем.",
        unlockRule: (context) =>
          context.discoveredCount >= 5 || context.terrainTypes.has("grove"),
      },
      stream_bend: {
        id: "stream_bend",
        q: 1,
        r: -1,
        tone: "water",
        title: "Излучина ручья",
        subtitle: "Влажный проход",
        description:
          "Узел воды и мягкой почвы. Отсюда логично тянуть следующие походы за влагой и прибрежными ресурсами.",
        detail:
          "Этот сектор особенно важен для будущих переходов: вода начинает связывать несколько локальных зон в одну систему окрестностей.",
        distanceMeters: 350,
        travelMinutes: 10,
        tags: ["вода", "берег"],
        resources: ["вода", "глина", "пища"],
        focusResourceIds: ["water", "clay", "food"],
        focusTerrainTypes: ["water", "clay"],
        focusTags: ["wet", "near_water", "soft_soil"],
        unlockHint:
          "Нужно увидеть воду поблизости или расширить круг разведки вокруг лагеря.",
        unlockRule: (context) =>
          context.terrainTypes.has("water") || context.discoveredCount >= 6,
      },
      clay_hollow: {
        id: "clay_hollow",
        q: 0,
        r: 1,
        tone: "clay",
        title: "Глинистая низина",
        subtitle: "Тяжёлый грунт",
        description:
          "Сектор, который интересен не уютом, а материалом. Здесь окрестности начинают работать как выбор специализации.",
        detail:
          "Низина обещает строительный материал, но требует подготовленного ритма переноски и обратной доставки.",
        distanceMeters: 320,
        travelMinutes: 9,
        tags: ["материалы", "грунт"],
        resources: ["глина", "камень"],
        focusResourceIds: ["clay", "stone"],
        focusTerrainTypes: ["clay", "water", "rock"],
        focusTags: ["soft_soil", "hard_ground", "surface_stone"],
        unlockHint:
          "Нужно развить лагерь или выйти на глинистые участки локальной карты.",
        unlockRule: (context) =>
          context.developedCount >= 1 || context.terrainTypes.has("clay"),
      },
      stone_ridge: {
        id: "stone_ridge",
        q: -1,
        r: 1,
        tone: "ridge",
        title: "Каменная гряда",
        subtitle: "Жёсткий подъём",
        description:
          "Более тяжёлый сектор с хорошим обзором и твёрдым ресурсом. Сюда выходят уже не наугад.",
        detail:
          "Гряда нужна, чтобы следующий слой ощущался не просто дальше, а иным по нагрузке, времени и пользе.",
        distanceMeters: 420,
        travelMinutes: 12,
        tags: ["камень", "высота"],
        resources: ["камень", "сухое дерево"],
        focusResourceIds: ["stone", "wood"],
        focusTerrainTypes: ["rock", "rocks", "ridge"],
        focusTags: ["rocky", "hard_ground", "overlook"],
        unlockHint:
          "Нужно глубже разведать локальную карту или нащупать каменистые участки рядом.",
        unlockRule: (context) =>
          context.discoveredCount >= 7 ||
          context.terrainTypes.has("rock") ||
          context.terrainTypes.has("ridge"),
      },
      old_path: {
        id: "old_path",
        q: -1,
        r: 0,
        tone: "path",
        title: "Старая тропа",
        subtitle: "Маршрут наружу",
        description:
          "Первый намёк на внешний путь. Не ресурсный узел, а зацепка для будущей логистики и следующих слоёв карты.",
        detail:
          "Этот сектор нужен как мост в дальнейшее развитие: дороги и транспорт должны открывать новые масштабы, а не просто ускорять локалку.",
        distanceMeters: 380,
        travelMinutes: 11,
        tags: ["логистика", "дальнейший путь"],
        resources: ["маршрут", "ориентиры"],
        focusResourceIds: [],
        focusTerrainTypes: ["lore", "ridge", "clearing"],
        focusTags: ["trace", "memory", "old_camp", "overlook", "flat"],
        focusPath: true,
        unlockHint:
          "Нужно натоптать хотя бы несколько троп или заметно укрепить лагерь.",
        unlockRule: (context) =>
          context.trailCount >= 2 || context.developedCount >= 2,
      },
    };
  }

  _isSurroundingsNodeUnlocked(
    node,
    context = this._getSurroundingsProgressContext(),
  ) {
    if (!node || !this.isCampSetupDone()) return false;
    if (node.id === "camp_core") return true;
    return typeof node.unlockRule === "function"
      ? !!node.unlockRule(context)
      : true;
  }

  _getCampTileStateShortLabel(state) {
    switch (state) {
      case "camp":
        return "лагерь";
      case "developed":
        return "освоено";
      case "discovered":
        return "открыто";
      case "terrain_seen":
        return "осмотрено";
      case "camp_candidate":
        return "стоянка";
      default:
        return "участок";
    }
  }

  _getSurroundingsLocalFocusPlan(node) {
    if (!node || node.id === "camp_core") {
      return {
        headline:
          "Лагерь остаётся точкой входа в локальную карту и рабочие действия.",
        focusLabels: [],
        candidates: [],
        candidateCount: 0,
      };
    }

    const visibleStates = new Set([
      "terrain_seen",
      "discovered",
      "developed",
      "camp",
      "camp_candidate",
    ]);
    const focusResourceIds = Array.isArray(node.focusResourceIds)
      ? node.focusResourceIds
      : [];
    const focusTerrainTypes = Array.isArray(node.focusTerrainTypes)
      ? node.focusTerrainTypes
      : [];
    const focusTags = Array.isArray(node.focusTags) ? node.focusTags : [];
    const focusResourceSet = new Set(focusResourceIds);
    const focusTerrainSet = new Set(focusTerrainTypes);
    const focusTagSet = new Set(focusTags);
    const pathRank = { none: 0, footpath: 1, stable_footpath: 2, trail: 3 };
    const candidates = [];

    for (const tile of this._getCampMapTileList()) {
      const state = this.getCampTileState(tile.id);
      if (!visibleStates.has(state)) continue;
      if (!this.isCampTilePresentationUnlocked(tile) && state !== "terrain_seen") {
        continue;
      }

      const distance = this._getCampTileLiveDist(tile);
      const pathLevel = this.getCampPathLevel(tile.id);
      const reasons = [];
      let score = Math.max(0, 5 - distance) * 0.4;

      if (tile.resourceType && focusResourceSet.has(tile.resourceType)) {
        const remaining = this._getCampTileResourceRemaining(tile.id);
        const resource = this.data.resources?.[tile.resourceType];
        const resourceName = resource?.name || tile.resourceType;
        if (!Number.isFinite(remaining) || remaining > 0) {
          score += 8;
          reasons.push(resourceName);
        } else {
          score += 2;
          reasons.push(`${resourceName}: истощено`);
        }
      }

      if (tile.terrainType && focusTerrainSet.has(tile.terrainType)) {
        const terrain = Object.values(this.data.baseTerrains || {}).find(
          (entry) => entry?.terrainType === tile.terrainType,
        );
        score += 4;
        reasons.push(terrain?.name || tile.name || tile.terrainType);
      }

      const matchingTags = Array.isArray(tile.terrainTags)
        ? tile.terrainTags.filter((tag) => focusTagSet.has(tag))
        : [];
      if (matchingTags.length) {
        score += Math.min(3, matchingTags.length);
        reasons.push("подходящий рельеф");
      }

      if (node.focusPath && pathRank[pathLevel] > 0) {
        score += 4 + pathRank[pathLevel] * 2;
        reasons.push("есть подготовленный путь");
      }

      if (state === "developed" || state === "camp") {
        score += 1.5;
      }

      if (score <= 0 || reasons.length === 0) continue;

      const resource = tile.resourceType
        ? this.data.resources?.[tile.resourceType]
        : null;
      const remaining = tile.resourceType
        ? this._getCampTileResourceRemaining(tile.id)
        : null;

      candidates.push({
        id: tile.id,
        name: tile.name,
        state,
        stateLabel: this._getCampTileStateShortLabel(state),
        distance,
        distanceLabel: distance <= 0 ? "здесь" : `${distance} гекс.`,
        pathLevel,
        resourceId: tile.resourceType || null,
        resourceName: resource?.name || tile.resourceType || "",
        resourceIcon: resource?.icon || "",
        resourceRemaining: Number.isFinite(remaining) ? remaining : null,
        reasons: [...new Set(reasons)].slice(0, 3),
        score,
      });
    }

    candidates.sort(
      (a, b) => b.score - a.score || a.distance - b.distance || a.name.localeCompare(b.name),
    );

    const focusLabels = [
      ...focusResourceIds.map(
        (id) => this.data.resources?.[id]?.name || id,
      ),
      ...focusTerrainTypes
        .map((type) => {
          const terrain = Object.values(this.data.baseTerrains || {}).find(
            (entry) => entry?.terrainType === type,
          );
          return terrain?.name || "";
        })
        .filter(Boolean),
    ];

    const best = candidates[0] || null;
    return {
      headline: best
        ? `Лучший локальный якорь: ${best.name}. Через него район получает практический смысл на карте лагеря.`
        : "На локальной карте пока нет хорошей зацепки под этот район. Продолжайте разведку ближних гексов.",
      focusLabels: [...new Set(focusLabels)].slice(0, 5),
      candidates: candidates.slice(0, 4),
      candidateCount: candidates.length,
    };
  }

  _sanitizeSurroundingsMapState(raw) {
    const defaults = this._getDefaultSurroundingsMapState();
    const nodeDefs = this._getSurroundingsNodeDefs();

    if (raw?.activeView === "surroundings" && this.canOpenSurroundingsMap()) {
      defaults.activeView = "surroundings";
    }

    if (
      typeof raw?.selectedNodeId === "string" &&
      nodeDefs[raw.selectedNodeId]
    ) {
      defaults.selectedNodeId = raw.selectedNodeId;
    }

    if (
      typeof raw?.targetNodeId === "string" &&
      raw.targetNodeId !== "camp_core" &&
      nodeDefs[raw.targetNodeId]
    ) {
      defaults.targetNodeId = raw.targetNodeId;
    }

    if (Array.isArray(raw?.knownNodeIds)) {
      const uniqueIds = new Set();
      for (const nodeId of raw.knownNodeIds) {
        if (typeof nodeId === "string" && nodeDefs[nodeId]) {
          uniqueIds.add(nodeId);
        }
      }
      defaults.knownNodeIds = [...uniqueIds];
    }

    return defaults;
  }

  _serializeSurroundingsMap() {
    return {
      activeView: this.getActiveStrategicMapView(),
      selectedNodeId: this.surroundingsMap?.selectedNodeId || "camp_core",
      targetNodeId: this.surroundingsMap?.targetNodeId || null,
      knownNodeIds: Array.isArray(this.surroundingsMap?.knownNodeIds)
        ? [...this.surroundingsMap.knownNodeIds]
        : [],
    };
  }

  // ─── Surroundings map (V2): hex grid state used by new surroundings UI ───

  _getDefaultSurroundingsHexMapState() {
    return {
      revision: 1,
      selectedHexKey: "0,0",
      targetHexKey: null,
      tileStates: {},
      pathLevels: {},
      linkedLocalAnchor: null,
      lastScoutHexKeys: [],
    };
  }

  _sanitizeSurroundingsHexMapState(raw) {
    const defaults = this._getDefaultSurroundingsHexMapState();
    if (!raw || typeof raw !== "object") return defaults;

    if (typeof raw.selectedHexKey === "string" && raw.selectedHexKey.length > 0) {
      defaults.selectedHexKey = raw.selectedHexKey;
    }
    if (typeof raw.targetHexKey === "string" && raw.targetHexKey.length > 0) {
      defaults.targetHexKey = raw.targetHexKey;
    }

    if (raw.tileStates && typeof raw.tileStates === "object") {
      for (const [key, state] of Object.entries(raw.tileStates)) {
        if (typeof key !== "string") continue;
        if (state === "known" || state === "scouted") {
          defaults.tileStates[key] = state;
        }
      }
    }

    if (raw.pathLevels && typeof raw.pathLevels === "object") {
      for (const [key, value] of Object.entries(raw.pathLevels)) {
        if (typeof key !== "string" || typeof value !== "string") continue;
        defaults.pathLevels[key] = value;
      }
    }

    const R = this._getSurroundingsMapRadius();
    if (Array.isArray(raw.lastScoutHexKeys)) {
      const seen = new Set();
      for (const key of raw.lastScoutHexKeys) {
        if (typeof key !== "string") continue;
        const p = this._parseSurroundingsHexKey(key);
        if (!p || this._getSurroundingsHexDistance(p.q, p.r) > R) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        defaults.lastScoutHexKeys.push(key);
        if (defaults.lastScoutHexKeys.length >= 8) break;
      }
    }

    const anchor = raw.linkedLocalAnchor;
    if (
      anchor &&
      typeof anchor === "object" &&
      typeof anchor.hexKey === "string" &&
      typeof anchor.tileId === "string"
    ) {
      const ap = this._parseSurroundingsHexKey(anchor.hexKey);
      const tile = this._getCampMapTile(anchor.tileId);
      if (
        ap &&
        this._getSurroundingsHexDistance(ap.q, ap.r) <= R &&
        tile
      ) {
        defaults.linkedLocalAnchor = {
          hexKey: anchor.hexKey,
          tileId: anchor.tileId,
        };
      }
    }

    return defaults;
  }

  _serializeSurroundingsHexMap() {
    return {
      revision: this.surroundingsHexMap?.revision || 1,
      selectedHexKey: this.surroundingsHexMap?.selectedHexKey || "0,0",
      targetHexKey: this.surroundingsHexMap?.targetHexKey || null,
      tileStates: { ...(this.surroundingsHexMap?.tileStates || {}) },
      pathLevels: { ...(this.surroundingsHexMap?.pathLevels || {}) },
      linkedLocalAnchor: this.surroundingsHexMap?.linkedLocalAnchor
        ? {
            hexKey: this.surroundingsHexMap.linkedLocalAnchor.hexKey,
            tileId: this.surroundingsHexMap.linkedLocalAnchor.tileId,
          }
        : null,
      lastScoutHexKeys: Array.isArray(this.surroundingsHexMap?.lastScoutHexKeys)
        ? [...this.surroundingsHexMap.lastScoutHexKeys]
        : [],
    };
  }

  _restoreSurroundingsHexMap(saved) {
    this.surroundingsHexMap = this._sanitizeSurroundingsHexMapState(saved);
  }

  _restoreSurroundingsMap(savedSurroundingsMap) {
    this.surroundingsMap =
      this._sanitizeSurroundingsMapState(savedSurroundingsMap);
  }

  _syncSurroundingsMap({ pushLog = false } = {}) {
    const defaults = this._getDefaultSurroundingsMapState();
    if (!this.surroundingsMap || typeof this.surroundingsMap !== "object") {
      this.surroundingsMap = defaults;
    }

    const nodeDefs = this._getSurroundingsNodeDefs();
    const orderedNodeIds = Object.keys(nodeDefs);
    const knownNodeIds = new Set(
      Array.isArray(this.surroundingsMap.knownNodeIds)
        ? this.surroundingsMap.knownNodeIds.filter((nodeId) => nodeDefs[nodeId])
        : [],
    );
    const newlyKnown = [];
    let changed = false;

    if (!this.isCampSetupDone()) {
      if (this.surroundingsMap.selectedNodeId !== defaults.selectedNodeId) {
        this.surroundingsMap.selectedNodeId = defaults.selectedNodeId;
        changed = true;
      }
      if (this.surroundingsMap.targetNodeId !== defaults.targetNodeId) {
        this.surroundingsMap.targetNodeId = defaults.targetNodeId;
        changed = true;
      }
      if (knownNodeIds.size > 0) {
        this.surroundingsMap.knownNodeIds = [];
        changed = true;
      }
      if (changed) {
        this.markDirty();
      }
      return changed;
    }

    const context = this._getSurroundingsProgressContext();
    for (const nodeId of orderedNodeIds) {
      const node = nodeDefs[nodeId];
      if (!this._isSurroundingsNodeUnlocked(node, context)) continue;
      if (knownNodeIds.has(nodeId)) continue;
      knownNodeIds.add(nodeId);
      newlyKnown.push(node.title);
      changed = true;
    }

    const nextKnownNodeIds = orderedNodeIds.filter((nodeId) =>
      knownNodeIds.has(nodeId),
    );
    if (
      nextKnownNodeIds.length !==
        (this.surroundingsMap.knownNodeIds || []).length ||
      nextKnownNodeIds.some(
        (nodeId, index) =>
          this.surroundingsMap.knownNodeIds?.[index] !== nodeId,
      )
    ) {
      this.surroundingsMap.knownNodeIds = nextKnownNodeIds;
      changed = true;
    }

    if (!nodeDefs[this.surroundingsMap.selectedNodeId]) {
      this.surroundingsMap.selectedNodeId = defaults.selectedNodeId;
      changed = true;
    }

    if (
      this.surroundingsMap.targetNodeId &&
      !knownNodeIds.has(this.surroundingsMap.targetNodeId)
    ) {
      this.surroundingsMap.targetNodeId = null;
      changed = true;
    }

    if (pushLog && newlyKnown.length > 0) {
      const names = newlyKnown.slice(0, 3).join(", ");
      this.addLog(`🗺️ В окрестностях появились новые ориентиры: ${names}.`);
    }

    if (changed) {
      this.markDirty();
    }
    return changed;
  }

  _sanitizeCampMapState(raw) {
    const defaults = this._getDefaultLocalCampMapState();
    const tiles = this._getCampMapTiles();
    const validStates = new Set([
      "hidden",
      "silhouette",
      "discovered",
      "developed",
      "exploited",
      "settled",
      "terrain_seen",
      "camp_candidate",
      "camp",
      "visible_locked",
    ]);
    const validPathLevels = new Set(
      Object.keys(this.data.logistics?.pathLevels || {}),
    );
    const isLegacyCampMap = raw?.revision !== this._getCampMapRevision();

    for (const tileId of Object.keys(defaults.tileStates)) {
      const state = raw?.tileStates?.[tileId];
      if (typeof state === "string" && validStates.has(state)) {
        const normalizedState = this._normalizeCampTileState(state);
        if (isLegacyCampMap) {
          if (normalizedState === "developed" || normalizedState === "camp") {
            defaults.tileStates[tileId] = normalizedState;
          }
        } else {
          defaults.tileStates[tileId] = normalizedState;
        }
      }

      const savedPathLevel = raw?.pathLevels?.[tileId];
      if (
        typeof savedPathLevel === "string" &&
        validPathLevels.has(savedPathLevel)
      ) {
        defaults.pathLevels[tileId] = savedPathLevel;
      }

      const savedPathTraffic = raw?.pathTraffic?.[tileId];
      if (Number.isFinite(savedPathTraffic) && savedPathTraffic > 0) {
        defaults.pathTraffic[tileId] = Math.max(0, savedPathTraffic);
      }

      if (
        Object.prototype.hasOwnProperty.call(
          defaults.tileResourceRemaining,
          tileId,
        )
      ) {
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
      // Only restore placement if the tile still accepts this building
      const tileDef = tiles[tileId];
      if (
        !Array.isArray(tileDef.buildOptions) ||
        !tileDef.buildOptions.includes(buildingId)
      ) {
        continue;
      }
      defaults.buildingPlacements[buildingId] = tileId;
    }

    // Downgrade "developed" state for tiles that no longer support buildings
    for (const [tileId, state] of Object.entries(defaults.tileStates)) {
      if (state !== "developed") continue;
      const tileDef = tiles[tileId];
      if (
        !tileDef ||
        !Array.isArray(tileDef.buildOptions) ||
        tileDef.buildOptions.length === 0
      ) {
        defaults.tileStates[tileId] = "discovered";
      }
    }

    if (tiles[raw?.selectedTileId]) {
      defaults.selectedTileId = raw.selectedTileId;
    }

    // Restore camp setup state
    defaults.campSetupDone = !!raw?.campSetupDone;
    if (
      raw?.campOrigin &&
      Number.isFinite(raw.campOrigin.q) &&
      Number.isFinite(raw.campOrigin.r)
    ) {
      defaults.campOrigin = { q: raw.campOrigin.q, r: raw.campOrigin.r };
    }
    if (raw?.campTileId && tiles[raw.campTileId]) {
      defaults.campTileId = raw.campTileId;
    }

    // Intro step — already done once camp is set up
    if (defaults.campSetupDone) {
      defaults.introStep = null;
    } else if (raw?.introStep === null) {
      defaults.introStep = null;
    } else if (Number.isFinite(raw?.introStep)) {
      const maxStep = (this.data.campFoundingIntro?.steps?.length || 1) - 1;
      defaults.introStep = Math.max(0, Math.min(maxStep, raw.introStep));
    }

    // Restore surveyed candidates list (unique, only valid camp-candidate tile ids)
    if (Array.isArray(raw?.surveyedCandidates)) {
      const validCandidateIds = new Set(this._getCampCandidateTileIds());
      const unique = new Set();
      for (const tid of raw.surveyedCandidates) {
        if (typeof tid === "string" && validCandidateIds.has(tid)) {
          unique.add(tid);
        }
      }
      defaults.surveyedCandidates = [...unique];
    }

    defaults.campEntered = !!raw?.campEntered;
    defaults.readyStoryShown = !!raw?.readyStoryShown;

    // Restore applied upgrades list
    const allUpgradeIds = new Set(
      Object.keys(this.data.buildingUpgrades || {}),
    );
    if (Array.isArray(raw?.appliedUpgrades)) {
      defaults.appliedUpgrades = raw.appliedUpgrades.filter(
        (id) => typeof id === "string" && allUpgradeIds.has(id),
      );
    }

    // Restore camp settings
    if (raw?.campSettings && typeof raw.campSettings === "object") {
      defaults.campSettings = {
        name:
          typeof raw.campSettings.name === "string"
            ? raw.campSettings.name.slice(0, 40)
            : "",
      };
    }

    // Restore dynamically generated resource tiles (created after camp founding)
    if (raw?.generatedTiles && typeof raw.generatedTiles === "object") {
      defaults.generatedTiles = {};
      for (const [id, tile] of Object.entries(raw.generatedTiles)) {
        if (
          tile &&
          typeof tile === "object" &&
          tile.id === id &&
          Number.isFinite(tile.q) &&
          Number.isFinite(tile.r) &&
          tile.actionId
        ) {
          defaults.generatedTiles[id] = tile;
          defaults.tileStates[id] = "discovered";
          defaults.tileResourceRemaining[id] = Number.isFinite(
            raw?.tileResourceRemaining?.[id],
          )
            ? Math.max(0, raw.tileResourceRemaining[id])
            : (tile.resourceAmount ?? 0);
        }
      }
    }

    return defaults;
  }

  _getCampTileStateRank(state) {
    switch (state) {
      case "developed":
      case "camp":
        return 4;
      case "discovered":
      case "camp_candidate":
        return 3;
      case "terrain_seen":
        return 2;
      case "visible_locked":
      case "silhouette":
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

  _markCampTileDeveloped(tileId) {
    if (!tileId) return false;
    return this._setCampTileState(tileId, "developed");
  }

  _serializeCampMap() {
    return {
      revision: this._getCampMapRevision(),
      tileStates: { ...this.localCampMap.tileStates },
      tileResourceRemaining: { ...this.localCampMap.tileResourceRemaining },
      pathLevels: { ...this.localCampMap.pathLevels },
      pathTraffic: { ...(this.localCampMap.pathTraffic || {}) },
      buildingPlacements: { ...this.localCampMap.buildingPlacements },
      selectedTileId: this.localCampMap.selectedTileId || null,
      campSetupDone: !!this.localCampMap.campSetupDone,
      campTileId: this.localCampMap.campTileId || null,
      campOrigin: this.localCampMap.campOrigin || { q: 0, r: 0 },
      introStep: this.localCampMap.introStep ?? null,
      surveyedCandidates: Array.isArray(this.localCampMap.surveyedCandidates)
        ? [...this.localCampMap.surveyedCandidates]
        : [],
      campEntered: !!this.localCampMap.campEntered,
      readyStoryShown: !!this.localCampMap.readyStoryShown,
      appliedUpgrades: Array.isArray(this.localCampMap.appliedUpgrades)
        ? [...this.localCampMap.appliedUpgrades]
        : [],
      campSettings: {
        name: this.localCampMap.campSettings?.name || "",
      },
    };
  }

  _restoreCampMap(savedCampMap) {
    this.localCampMap = this._sanitizeCampMapState(savedCampMap);
    this._campMapTilesCache = null; // force rebuild so procedural tiles use restored campOrigin
  }

  _sanitizeBooleanMap(raw, defs) {
    const state = {};
    for (const id of Object.keys(defs || {})) {
      state[id] = !!raw?.[id];
    }
    return state;
  }

  _sanitizeInsightUnlockMoments(raw, defs, unlockedMap = {}) {
    const state = {};
    for (const id of Object.keys(defs || {})) {
      const value = raw?.[id];
      state[id] = Number.isFinite(value)
        ? Math.max(0, value)
        : unlockedMap?.[id]
          ? 1
          : 0;
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

    let maxResourceCap = BASE_RESOURCE_CAP;
    let craftDiscount = 0;
    let buildTimeMultiplier = 1;
    let automationIntervalMultiplier = 1;

    for (const techId of Object.keys(this.researched)) {
      const tech = this.data.tech[techId];
      if (!tech) continue;
      if (tech.effect?.craftDiscount) {
        craftDiscount += tech.effect.craftDiscount;
      }
      if (tech.effect?.buildTimeMultiplier) {
        buildTimeMultiplier *= tech.effect.buildTimeMultiplier;
      }
      if (tech.effect?.automationIntervalMultiplier) {
        automationIntervalMultiplier *=
          tech.effect.automationIntervalMultiplier;
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

    // Stack effects from applied building upgrades
    for (const upgradeId of this.localCampMap?.appliedUpgrades || []) {
      const upgrade = this.data.buildingUpgrades?.[upgradeId];
      if (!upgrade) continue;

      if (upgrade.effect?.maxResourceCap) {
        maxResourceCap = Math.max(
          maxResourceCap,
          upgrade.effect.maxResourceCap,
        );
      }
      if (upgrade.effect?.automation?.intervalMultiplier) {
        automationIntervalMultiplier *=
          upgrade.effect.automation.intervalMultiplier;
      }
      if (upgrade.effect?.automationIntervalMultiplier) {
        automationIntervalMultiplier *=
          upgrade.effect.automationIntervalMultiplier;
      }
      if (upgrade.effect?.craftDiscount) {
        craftDiscount += upgrade.effect.craftDiscount;
      }
      if (upgrade.effect?.buildTimeMultiplier) {
        buildTimeMultiplier *= upgrade.effect.buildTimeMultiplier;
      }
    }

    this.maxResourceCap = maxResourceCap;
    this._enforceResourceCap();
    this.craftDiscount = craftDiscount;
    this.buildTimeMultiplier = buildTimeMultiplier;
    this.automationIntervalMultiplier = automationIntervalMultiplier;
    this._recalculateCharacterStats();
    this._recalculateEnergyStats();
    this._recalculateEraProgress();
  }

  _enforceResourceCap() {
    let changed = false;
    for (const id of Object.keys(this.resources)) {
      const amount = this.resources[id] || 0;
      if (amount > this.maxResourceCap) {
        this.resources[id] = this.maxResourceCap;
        changed = true;
      }
    }
    if (changed) this.markDirty();
  }

  _recalculateCharacterStats() {
    let satietyMaxBonus = 0;
    let hydrationMaxBonus = 0;
    let recoveryBonusPerTick = 0;
    let carryCapacityBonus = 0;
    let enduranceBonus = 0;
    let fieldcraftBonus = 0;
    let strengthBonus = 0;
    let mobilityBonus = 0;
    let ingenuityBonus = 0;
    let recoveryRatingBonus = 0;

    for (const techId of Object.keys(this.researched)) {
      const effect = this.data.tech[techId]?.effect?.character;
      if (!effect) continue;
      satietyMaxBonus += effect.maxSatietyBonus || 0;
      hydrationMaxBonus += effect.maxHydrationBonus || 0;
      recoveryBonusPerTick += effect.recoveryBonusPerTick || 0;
      carryCapacityBonus += effect.carryCapacityBonus || 0;
      enduranceBonus += effect.enduranceBonus || 0;
      fieldcraftBonus += effect.fieldcraftBonus || 0;
      strengthBonus += effect.strengthBonus || 0;
      mobilityBonus += effect.mobilityBonus || 0;
      ingenuityBonus += effect.ingenuityBonus || 0;
      recoveryRatingBonus += effect.recoveryRatingBonus || 0;
    }

    for (const buildingId of Object.keys(this.buildings)) {
      const effect = this.data.buildings[buildingId]?.effect?.character;
      if (!effect) continue;
      satietyMaxBonus += effect.maxSatietyBonus || 0;
      hydrationMaxBonus += effect.maxHydrationBonus || 0;
      recoveryBonusPerTick += effect.recoveryBonusPerTick || 0;
      carryCapacityBonus += effect.carryCapacityBonus || 0;
      enduranceBonus += effect.enduranceBonus || 0;
      fieldcraftBonus += effect.fieldcraftBonus || 0;
      strengthBonus += effect.strengthBonus || 0;
      mobilityBonus += effect.mobilityBonus || 0;
      ingenuityBonus += effect.ingenuityBonus || 0;
      recoveryRatingBonus += effect.recoveryRatingBonus || 0;
    }

    for (const upgradeId of this.localCampMap?.appliedUpgrades || []) {
      const effect = this.data.buildingUpgrades?.[upgradeId]?.effect?.character;
      if (!effect) continue;
      satietyMaxBonus += effect.maxSatietyBonus || 0;
      hydrationMaxBonus += effect.maxHydrationBonus || 0;
      recoveryBonusPerTick += effect.recoveryBonusPerTick || 0;
      carryCapacityBonus += effect.carryCapacityBonus || 0;
      enduranceBonus += effect.enduranceBonus || 0;
      fieldcraftBonus += effect.fieldcraftBonus || 0;
      strengthBonus += effect.strengthBonus || 0;
      mobilityBonus += effect.mobilityBonus || 0;
      ingenuityBonus += effect.ingenuityBonus || 0;
      recoveryRatingBonus += effect.recoveryRatingBonus || 0;
    }

    this.satietyMaxBonus = satietyMaxBonus;
    this.hydrationMaxBonus = hydrationMaxBonus;
    this.characterRecoveryBonusPerTick = recoveryBonusPerTick;
    this.carryCapacityBonus = carryCapacityBonus;
    this.enduranceBonus = enduranceBonus;
    this.fieldcraftBonus = fieldcraftBonus;
    this.strengthBonus = strengthBonus;
    this.mobilityBonus = mobilityBonus;
    this.ingenuityBonus = ingenuityBonus;
    this.recoveryRatingBonus = recoveryRatingBonus;
    this.maxSatiety = this.baseSatietyMax + satietyMaxBonus;
    this.maxHydration = this.baseHydrationMax + hydrationMaxBonus;
    this.carryCapacity = this.baseCarryCapacity + carryCapacityBonus;
    this.satiety = Math.min(this.satiety, this.maxSatiety);
    this.hydration = Math.min(this.hydration, this.maxHydration);
  }

  _ensureCampBuildingPlacements() {
    const mapTiles = this._getCampMapTiles();

    // Clean up stale placements where the tile no longer accepts the building
    for (const [buildingId, tileId] of Object.entries(
      this.localCampMap.buildingPlacements,
    )) {
      const tile = mapTiles[tileId];
      if (
        !tile ||
        !Array.isArray(tile.buildOptions) ||
        !tile.buildOptions.includes(buildingId)
      ) {
        delete this.localCampMap.buildingPlacements[buildingId];
      }
    }

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
    const tiles = this._getCampMapTiles();
    const newlyDiscovered = [];

    // Pre-camp phase: there is only a temporary night spot, not a founded camp.
    // Authored discovered tiles stay available, and nearby named tiles appear
    // as silhouettes so the player can scout and choose a camp site freely.
    if (!this.localCampMap.campSetupDone) {
      const revealAnchors = [];
      const preCampDiscoveredIds = new Set();
      for (const [tileId, tile] of Object.entries(tiles)) {
        const baseState = this._normalizeCampTileState(tile.state);
        const currentState = this._normalizeCampTileState(
          this.localCampMap.tileStates[tileId],
        );

        const isPreCampDiscovered =
          baseState === "camp_candidate" ||
          baseState === "discovered" ||
          !!tile.isCampCandidate ||
          currentState === "camp_candidate" ||
          currentState === "discovered" ||
          currentState === "developed" ||
          currentState === "camp";
        if (isPreCampDiscovered && this.isCampTilePresentationUnlocked(tile)) {
          preCampDiscoveredIds.add(tileId);
          revealAnchors.push(tile);
        }
      }

      const SILHOUETTE_RADIUS = 2;
      const silhouetteIds = new Set();
      for (const [tileId, tile] of Object.entries(tiles)) {
        if (preCampDiscoveredIds.has(tileId)) continue;
        // Only reveal silhouettes for named/hand-authored tiles, not for
        // procedurally filled background hexes (they clutter the pre-camp view).
        if (!tile.name) continue;
        for (const c of revealAnchors) {
          const dq = (tile.q || 0) - (c.q || 0);
          const dr = (tile.r || 0) - (c.r || 0);
          const d = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
          if (d <= SILHOUETTE_RADIUS) {
            silhouetteIds.add(tileId);
            break;
          }
        }
      }

      for (const [tileId, tile] of Object.entries(tiles)) {
        const previousState = this.localCampMap.tileStates[tileId];
        if (previousState === "terrain_seen") {
          this.localCampMap.tileStates[tileId] =
            this._canTileMeetDiscoveryRules(tile)
              ? "discovered"
              : "terrain_seen";
        } else if (!this.isCampTilePresentationUnlocked(tile)) {
          this.localCampMap.tileStates[tileId] = "hidden";
        } else if (preCampDiscoveredIds.has(tileId)) {
          this.localCampMap.tileStates[tileId] = "discovered";
        } else if (silhouetteIds.has(tileId)) {
          this.localCampMap.tileStates[tileId] = "silhouette";
        } else {
          this.localCampMap.tileStates[tileId] = "hidden";
        }
      }
      this._ensureSelectedCampTile();
      this._syncSurroundingsMap({ pushLog: pushStory });
      this._campMapSyncKey = this._getCampMapSyncKey();
      return;
    }

    this._ensureCampBuildingPlacements();
    const reachableDiscoveredTileIds =
      this._getCampReachableDiscoveredTileIds();

    for (const [tileId, tile] of Object.entries(tiles)) {
      const previousState =
        this.localCampMap.tileStates[tileId] ||
        this._normalizeCampTileState(tile.state);

      let desiredState = reachableDiscoveredTileIds.has(tileId)
        ? "discovered"
        : "hidden";

      const progressionUnlocked = this.isCampTilePresentationUnlocked(tile);
      if (!progressionUnlocked) {
        desiredState =
          this._getCampTileLiveDist(tile) <= this._getCampRevealRadius()
            ? "visible_locked"
            : "hidden";
      }

      if (previousState === "terrain_seen") {
        desiredState = this._canTileMeetDiscoveryRules(tile)
          ? "discovered"
          : "terrain_seen";
      }

      // Prologue rule: the first shelter site must be available right after
      // camp founding so the player can build housing before the campfire.
      if (
        this.isPrologueActive() &&
        this.isCampSetupDone() &&
        tileId === "shelter_site" &&
        !this.buildings.rest_tent
      ) {
        desiredState = this._getHigherCampTileState(desiredState, "discovered");
      }

      const placedBuildingId = this.getCampPlacedBuildingId(tileId);
      // Only mark as developed if the building's tile still has matching buildOptions
      if (placedBuildingId) {
        const tileDef = tiles[tileId];
        if (
          Array.isArray(tileDef?.buildOptions) &&
          tileDef.buildOptions.includes(placedBuildingId)
        ) {
          desiredState = "developed";
        }
      } else if (this.activeConstruction?.tileId === tileId) {
        desiredState = this._getHigherCampTileState(desiredState, "developed");
      }

      const nextState = this._getHigherCampTileState(
        previousState,
        desiredState,
      );
      this.localCampMap.tileStates[tileId] =
        progressionUnlocked || previousState === "terrain_seen"
          ? nextState
          : desiredState;

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

    this._campMapSyncKey = this._getCampMapSyncKey();
    this._syncSurroundingsMap({ pushLog: pushStory });
  }

  syncCampMap() {
    const nextSyncKey = this._getCampMapSyncKey();
    if (nextSyncKey === this._campMapSyncKey) {
      return false;
    }
    this._syncLocalCampMap({ pushStory: true });
    return true;
  }

  refreshCampMap() {
    this._syncLocalCampMap({ pushStory: false });
  }

  _ensureSelectedCampTile() {
    const tiles = this._getCampMapTileList();
    const currentId = this.localCampMap.selectedTileId;
    if (
      currentId &&
      this._getCampMapTile(currentId) &&
      [
        "terrain_seen",
        "discovered",
        "developed",
        "camp",
        "camp_candidate",
      ].includes(this.getCampTileState(currentId))
    ) {
      return;
    }

    const discovered = tiles
      .filter((tile) => {
        const s = this.getCampTileState(tile.id);
        return [
          "terrain_seen",
          "discovered",
          "developed",
          "camp",
          "camp_candidate",
        ].includes(s);
      })
      .sort(
        (a, b) =>
          (this._getCampTileLiveDist(a) || 0) -
            (this._getCampTileLiveDist(b) || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      );

    this.localCampMap.selectedTileId = discovered[0]?.id || null;
  }

  getCampTileState(tileId) {
    return (
      this.localCampMap.tileStates[tileId] ||
      this._getCampMapTile(tileId)?.state ||
      "hidden"
    );
  }

  getCampPathLevel(tileId) {
    if (!tileId) return "none";
    return this.localCampMap.pathLevels?.[tileId] || "none";
  }

  getCampPathData(tileId) {
    const level = this.getCampPathLevel(tileId);
    const defs = this.data.logistics?.pathLevels || {};
    return (
      defs[level] || {
        id: "none",
        label: "Без тропы",
        icon: "·",
        routeRelief: 0,
        terrainRelief: 0,
        description: "Путь ещё не подготовлен.",
      }
    );
  }

  _getCampPathUseThreshold() {
    const value = Number(
      this.data.logistics?.trailProject?.useProgressThreshold,
    );
    return Number.isFinite(value) && value > 0
      ? Math.max(1, Math.floor(value))
      : 4;
  }

  getCampPathUseProgress(tileId) {
    const threshold = this._getCampPathUseThreshold();
    const uses = Math.max(
      0,
      Number(this.localCampMap?.pathTraffic?.[tileId]) || 0,
    );
    const pathLevel = this.getCampPathLevel(tileId);
    return {
      tileId,
      uses,
      threshold,
      remaining: Math.max(0, threshold - uses),
      ratio: threshold > 0 ? Math.max(0, Math.min(1, uses / threshold)) : 0,
      isComplete: pathLevel !== "none" || uses >= threshold,
      pathLevel,
    };
  }

  recordCampPathUse(path, options = {}) {
    if (!Array.isArray(path) || path.length < 2 || !this.localCampMap) {
      return { progressed: [], upgraded: [] };
    }
    const weight = Math.max(0, Number(options.weight) || 0);
    if (weight <= 0) return { progressed: [], upgraded: [] };

    if (!this.localCampMap.pathTraffic) this.localCampMap.pathTraffic = {};
    const threshold = this._getCampPathUseThreshold();
    const requiresCampfire =
      this.data.logistics?.trailProject?.autoTrailRequiresCampfire !== false;
    const canFormTrail = !requiresCampfire || !!this.buildings.campfire;
    const progressed = [];
    const upgraded = [];
    const seen = new Set();

    for (const tileId of path.slice(1)) {
      if (!tileId || seen.has(tileId)) continue;
      seen.add(tileId);

      const tile = this._getCampMapTile(tileId);
      if (!tile || this._getCampTileLiveDist(tile) <= 0) continue;
      if (this.getCampPathLevel(tileId) !== "none") continue;
      const tileState = this.getCampTileState(tileId);
      const canUpgradeTile = ![
        "hidden",
        "silhouette",
        "visible_locked",
        "terrain_seen",
      ].includes(tileState);

      const current = Math.max(
        0,
        Number(this.localCampMap.pathTraffic[tileId]) || 0,
      );
      const next = Number(Math.min(threshold, current + weight).toFixed(2));
      this.localCampMap.pathTraffic[tileId] = next;
      progressed.push({ tileId, uses: next, threshold });

      if (next >= threshold && canFormTrail && canUpgradeTile) {
        this.localCampMap.pathLevels[tileId] = "trail";
        delete this.localCampMap.pathTraffic[tileId];
        this._markCampTileDeveloped(tileId);
        upgraded.push({ tileId, name: tile.name || tileId });
      }
    }

    if (progressed.length || upgraded.length) {
      this.markDirty();
    }
    if (upgraded.length && !options.silent) {
      const names = upgraded.map((entry) => `"${entry.name}"`).join(", ");
      this.addLog(
        upgraded.length === 1
          ? `🥾 Повторные проходы протоптали тропу к участку ${names}.`
          : `🥾 Повторные проходы протоптали тропы к участкам: ${names}.`,
      );
      this._pushStoryEvent?.({
        type: "map",
        icon: "🥾",
        title:
          upgraded.length === 1 ? "Тропа закрепилась" : "Тропы закрепились",
        text:
          upgraded.length === 1
            ? `Путь к участку ${names} стал привычным и легче для следующих выходов.`
            : `Несколько часто пройденных участков стали частью лагерной логистики.`,
        ttlMs: 5200,
      });
    }

    return { progressed, upgraded };
  }

  _canImproveCampPath(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;
    if (this._getCampTileLiveDist(tile) <= 0) return false;
    if (
      ["hidden", "silhouette", "visible_locked", "terrain_seen"].includes(
        this.getCampTileState(tileId),
      )
    ) {
      return false;
    }
    if (this.getCampPathLevel(tileId) !== "none") return false;
    if (this.activeConstruction?.tileId === tileId) return false;
    if (
      this.data.logistics?.trailProject?.requiresCampfire &&
      !this.buildings.campfire
    ) {
      return false;
    }
    return true;
  }

  getCampPathProject(tileId = this.getSelectedCampTileId()) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return null;

    const pathData = this.getCampPathData(tileId);
    const project = this.data.logistics?.trailProject;
    const terrainType = tile.terrainType || "grass";
    const terrainExtraCost = project?.terrainExtraCosts?.[terrainType] || {};
    const cost = {
      ...(project?.baseCost || {}),
    };

    for (const [resourceId, amount] of Object.entries(terrainExtraCost)) {
      cost[resourceId] = (cost[resourceId] || 0) + amount;
    }

    const condition = this.getCharacterCondition();
    const distance = this._getCampTileLiveDist(tile);
    const terrain = this._getTerrainEffort(tile);
    const path = tile
      ? this.getCampPathData(tile.id)
      : this.getCampPathData(null);
    const routeDistance = Math.max(0, distance - (path.routeRelief || 0));
    const rawDistancePenalty = Math.max(0, routeDistance - 1);
    const rawTerrainPenalty = Math.max(0, terrain.penalty || 0);
    const penaltyAfterFieldcraft = this._applyFieldcraftRelief(
      rawDistancePenalty,
      rawTerrainPenalty,
    );
    const distancePenalty = penaltyAfterFieldcraft.distancePenalty;
    const terrainPenalty = penaltyAfterFieldcraft.terrainPenalty;
    const fieldcraftRelief = penaltyAfterFieldcraft.fieldcraftRelief;
    const delivery = this._getDeliveryProfile(
      this._getOutputCarryLoad(cost),
      this.getCharacterCarryCapacity(),
    );
    const mobilityRelief =
      this._getCharacterMobilityEffortRelief(routeDistance);
    const energyCost = Math.max(
      0,
      (project?.energyCost || 1) +
        distancePenalty +
        terrainPenalty +
        delivery.tripPenalty -
        mobilityRelief +
        (condition.gatherCostPenalty || 0),
    );
    const effortProfile = {
      distance,
      routeDistance,
      deliveryPenalty: delivery.tripPenalty,
      pathLevel: path.id,
      needsRelief: this.getCharacterNeedsRelief(),
    };
    const satietyCost = this._getSatietyDrainForBuild(effortProfile);
    const hydrationCost = this._getHydrationDrainForBuild(effortProfile);
    const needsImpact = this._getTripNeedsImpact(satietyCost, hydrationCost);
    const pathUseProgress = this.getCampPathUseProgress(tileId);

    let blockedReason = "";
    if (this._getCampTileLiveDist(tile) <= 0) {
      blockedReason =
        "Стоянка уже является центром лагеря и не требует отдельной тропы.";
    } else if (this.getCampTileState(tileId) === "hidden") {
      blockedReason = "Сначала нужно открыть участок на карте лагеря.";
    } else if (this.getCampPathLevel(tileId) !== "none") {
      blockedReason = `${pathData.label} к участку уже есть.`;
    } else if (project?.requiresCampfire && !this.buildings.campfire) {
      blockedReason =
        "Тропы имеют смысл только после первого костра и устойчивой точки лагеря.";
    } else if (
      Number.isFinite(condition.maxSafeDistance) &&
      routeDistance > condition.maxSafeDistance
    ) {
      blockedReason =
        condition.id === "exhausted"
          ? "В таком состоянии персонаж не потянет дальний выход даже ради новой тропы."
          : "Сначала нужно восстановиться, прежде чем тянуть путь так далеко от стоянки.";
    }

    const ruleAllowsImprove = this._canImproveCampPath(tileId);
    const missingResources = this.getMissingResources(cost);
    const hasTrailResources = missingResources.length === 0;
    const hasTrailEnergy = this.hasEnergy(energyCost);

    if (!blockedReason && !hasTrailResources) {
      const missingText = missingResources
        .map(({ id, missing }) => {
          const resource = this.data.resources[id];
          return `${resource?.icon || ""}${missing} ${resource?.name || id}`;
        })
        .join(", ");
      blockedReason = `Не хватает материалов для тропы: ${missingText}.`;
    } else if (!blockedReason && !hasTrailEnergy) {
      blockedReason = "Не хватает сил, чтобы протоптать путь к участку.";
    }

    const warnings = [];
    if (distancePenalty > 0) {
      warnings.push("Дальний участок особенно выигрывает от удобного прохода.");
    }
    if (terrainPenalty > 0) {
      warnings.push(
        `Местность тяжёлая: ${terrain.label}. Тропа здесь особенно полезна.`,
      );
    }
    if (delivery.requiresMultipleTrips) {
      warnings.push(
        `Материалы для тропы придётся подносить в ${delivery.tripsRequired} ходки.`,
      );
    }
    if (needsImpact.id === "critical" || needsImpact.id === "low") {
      warnings.push(needsImpact.note);
    }
    if (fieldcraftRelief > 0) {
      warnings.push(
        "Походная сноровка помогает тянуть путь без лишней потери сил.",
      );
    }

    return {
      tile,
      pathLevel: this.getCampPathLevel(tileId),
      pathData,
      pathUseProgress,
      canImprove: ruleAllowsImprove && hasTrailResources && hasTrailEnergy,
      project,
      cost,
      energyCost,
      satietyCost,
      hydrationCost,
      totalLoad: delivery.totalLoad,
      load: delivery.perTripLoad,
      carryCapacity: delivery.carryCapacity,
      deliveryTrips: delivery.tripsRequired,
      deliveryPenalty: delivery.tripPenalty,
      carryState: delivery.carryState,
      needsImpact,
      requiresMultipleTrips: delivery.requiresMultipleTrips,
      blockedReason,
      missingResources,
      hasResources: hasTrailResources,
      hasEnergy: hasTrailEnergy,
      warnings,
      terrainLabel: terrain.label,
      fieldcraftRelief,
      mobilityRelief,
    };
  }

  getBuildingSpaceCost(buildingId) {
    const value = Number(this.data.buildings?.[buildingId]?.spaceCost);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  getCampTileCapacity(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return 0;
    if (Number.isFinite(tile.capacity)) return Math.max(0, tile.capacity);
    if (Number.isFinite(tile.buildCapacity)) {
      return Math.max(0, tile.buildCapacity);
    }

    const terrainType = tile.terrainType || "grass";
    const terrainCapacity = {
      clearing: 20,
      grass: 20,
      worksite: 20,
      kiln: 18,
      clay: 16,
      water: 4,
      brush: 14,
      grove: 14,
      ridge: 12,
      lore: 12,
      rock: 10,
      rocks: 10,
    };

    return Number.isFinite(terrainCapacity[terrainType])
      ? terrainCapacity[terrainType]
      : 12;
  }

  getCampTilePlacedBuildings(tileId) {
    if (!tileId) return [];
    return Object.entries(this.localCampMap.buildingPlacements || {})
      .filter(
        ([buildingId, placedTileId]) =>
          placedTileId === tileId && !!this.buildings[buildingId],
      )
      .map(([buildingId]) => ({
        id: buildingId,
        buildingId,
        def: this.data.buildings[buildingId],
        spaceCost: this.getBuildingSpaceCost(buildingId),
      }))
      .filter((entry) => !!entry.def);
  }

  getCampTileBuildUsage(tileId) {
    const capacity = this.getCampTileCapacity(tileId);
    const buildings = this.getCampTilePlacedBuildings(tileId);
    const usedByBuildings = buildings.reduce(
      (sum, entry) => sum + entry.spaceCost,
      0,
    );
    const construction =
      this.activeConstruction?.tileId === tileId
        ? this.getConstructionState()
        : null;
    const constructionSpaceCost = construction
      ? this.getBuildingSpaceCost(construction.buildingId)
      : 0;
    const used = Math.min(capacity, usedByBuildings + constructionSpaceCost);

    return {
      tileId,
      capacity,
      used,
      free: Math.max(0, capacity - used),
      ratio: capacity > 0 ? used / capacity : 1,
      buildings,
      construction,
      constructionSpaceCost,
    };
  }

  canFitBuildingOnTile(buildingId, tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;

    const alreadyHere =
      this.localCampMap.buildingPlacements?.[buildingId] === tileId &&
      (!!this.buildings[buildingId] ||
        this.activeConstruction?.buildingId === buildingId);
    if (alreadyHere) return true;

    const usage = this.getCampTileBuildUsage(tileId);
    return usage.used + this.getBuildingSpaceCost(buildingId) <= usage.capacity;
  }

  getCampPlacedBuildingId(tileId) {
    return this.getCampTilePlacedBuildings(tileId)[0]?.buildingId || null;
  }

  getBuildingPlacement(buildingId) {
    return this.localCampMap.buildingPlacements[buildingId] || null;
  }

  _getMappedCampTilesForAction(actionId) {
    if (!this.isGatherActionPresentationUnlocked(actionId)) return [];
    return this._getCampMapTileList()
      .filter(
        (tile) =>
          this._getCampTileGatherActionIds(tile).includes(actionId) &&
          this.isCampTilePresentationUnlocked(tile),
      )
      .sort(
        (a, b) =>
          (this._getCampTileLiveDist(a) || 0) -
            (this._getCampTileLiveDist(b) || 0) ||
          (this.getCampPathLevel(b.id) === "trail" ? 1 : 0) -
            (this.getCampPathLevel(a.id) === "trail" ? 1 : 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      );
  }

  _getCampTileGatherActionIds(tile) {
    if (!tile) return [];
    const ids = [];
    const add = (actionId) => {
      if (actionId && !ids.includes(actionId)) ids.push(actionId);
    };
    add(tile.actionId);

    const terrainType = tile.terrainType || "";
    const terrainTags = Array.isArray(tile.terrainTags) ? tile.terrainTags : [];
    const hasTag = (tag) => terrainTags.includes(tag);

    if (terrainType === "water" || hasTag("near_water") || hasTag("wet")) {
      add("gather_water");
      add("gather_food");
    }
    if (terrainType === "clay" || hasTag("soft_soil")) {
      add("gather_clay");
    }
    if (
      terrainType === "rock" ||
      terrainType === "ridge" ||
      terrainType === "worksite" ||
      hasTag("rocky") ||
      hasTag("hard_ground") ||
      hasTag("surface_stone")
    ) {
      add("gather_stone");
    }
    if (
      terrainType === "grass" ||
      terrainType === "clearing" ||
      hasTag("grassy") ||
      hasTag("fiber") ||
      hasTag("open")
    ) {
      add("gather_fiber");
      add("gather_food");
    }
    if (
      terrainType === "brush" ||
      terrainType === "grove" ||
      terrainType === "kiln" ||
      terrainType === "lore" ||
      hasTag("wooded") ||
      hasTag("deadwood") ||
      hasTag("sheltered")
    ) {
      add("gather_wood");
      add("gather_food");
    }
    if (!ids.length) add("gather_fiber");
    return ids.filter((actionId) =>
      this.isGatherActionPresentationUnlocked(actionId),
    );
  }

  _getCampTileGatherActionId(tile) {
    return this._getCampTileGatherActionIds(tile)[0] || "";
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
      return canUseTile(preferred) ? preferred : null;
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
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;
    if (!this.isBuildingPresentationUnlocked(buildingId)) return false;
    if (!this.isCampTilePresentationUnlocked(tile)) return false;
    if (
      !Array.isArray(tile.buildOptions) ||
      !tile.buildOptions.includes(buildingId)
    ) {
      return false;
    }
    // Очаг разрешён только на той клетке, что была выбрана как лагерь.
    // Прочие camp_candidate-клетки сохраняют buildOptions=["campfire"] в данных
    // ради совместимости, но после основания лагеря они не должны предлагать
    // повторный костёр — иначе в окне постройки появляются «двойные» очаги.
    if (buildingId === "campfire" && this.getCampTileState(tileId) !== "camp") {
      return false;
    }
    if (
      ["hidden", "silhouette", "visible_locked", "terrain_seen"].includes(
        this.getCampTileState(tileId),
      )
    ) {
      return false;
    }
    if (
      this.activeConstruction?.tileId &&
      this.activeConstruction.tileId !== tileId
    ) {
      return false;
    }

    if (!this.canFitBuildingOnTile(buildingId, tileId)) return false;
    return true;
  }

  _getPreferredCampBuildTile(buildingId, preferredTileId = null) {
    const tiles = this._getCampMapTileList();
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
          (this._getCampTileLiveDist(a) || 0) -
            (this._getCampTileLiveDist(b) || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      )[0];

    return match?.id || null;
  }

  selectCampTile(tileId) {
    const tile = this._getCampMapTile(tileId);
    const state = this.getCampTileState(tileId);
    if (
      !tile ||
      state === "hidden" ||
      state === "silhouette" ||
      state === "visible_locked"
    ) {
      return false;
    }
    this.localCampMap.selectedTileId = tileId;
    return true;
  }

  getSelectedCampTileId() {
    this._ensureSelectedCampTile();
    return this.localCampMap.selectedTileId;
  }

  getSelectedCampTile() {
    const tileId = this.getSelectedCampTileId();
    return tileId ? this._getCampMapTile(tileId) : null;
  }

  canOpenSurroundingsMap() {
    return !!this.localCampMap;
  }

  // ─── Surroundings hex grid API (V2) ───

  _getSurroundingsHexKey(q, r) {
    return `${q},${r}`;
  }

  _parseSurroundingsHexKey(key) {
    if (typeof key !== "string") return null;
    const parts = key.split(",");
    if (parts.length !== 2) return null;
    const q = Number(parts[0]);
    const r = Number(parts[1]);
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    return { q: Math.trunc(q), r: Math.trunc(r) };
  }

  _getSurroundingsHexDistance(q, r) {
    return this._getCampHexDistance(q, r);
  }

  _getSurroundingsMapRadius() {
    return 8;
  }

  _getSurroundingsMetersPerHex() {
    return 250;
  }

  _getSurroundingsStartingOpenRadius() {
    return this.isCampSetupDone() ? 2 : 0;
  }

  _getSurroundingsAxialNeighborKeys(centerKey) {
    const parsed = this._parseSurroundingsHexKey(centerKey);
    if (!parsed) return [];
    const R = this._getSurroundingsMapRadius();
    const dirs = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ];
    const keys = [];
    for (const [dq, dr] of dirs) {
      const nq = parsed.q + dq;
      const nr = parsed.r + dr;
      if (this._getSurroundingsHexDistance(nq, nr) <= R) {
        keys.push(this._getSurroundingsHexKey(nq, nr));
      }
    }
    return keys;
  }

  /** Hex under cursor plus the six axial neighbors (within disk), for scout burst. */
  _getSurroundingsScoutPatchKeys(centerKey) {
    const out = new Set();
    out.add(centerKey);
    for (const nk of this._getSurroundingsAxialNeighborKeys(centerKey)) {
      out.add(nk);
    }
    return [...out];
  }

  _ensureSurroundingsHexSelection() {
    if (!this.surroundingsHexMap || typeof this.surroundingsHexMap !== "object") {
      this.surroundingsHexMap = this._getDefaultSurroundingsHexMapState();
    }
    const parsed = this._parseSurroundingsHexKey(
      this.surroundingsHexMap.selectedHexKey,
    );
    if (!parsed) {
      this.surroundingsHexMap.selectedHexKey = "0,0";
      return;
    }
    const dist = this._getSurroundingsHexDistance(parsed.q, parsed.r);
    if (dist > this._getSurroundingsMapRadius()) {
      this.surroundingsHexMap.selectedHexKey = "0,0";
    }
  }

  getSelectedSurroundingsHexKey() {
    this._ensureSurroundingsHexSelection();
    return this.surroundingsHexMap.selectedHexKey || "0,0";
  }

  selectSurroundingsHexByKey(hexKey) {
    const parsed = this._parseSurroundingsHexKey(hexKey);
    if (!parsed) return false;
    if (
      this._getSurroundingsHexDistance(parsed.q, parsed.r) >
      this._getSurroundingsMapRadius()
    )
      return false;
    if (this.surroundingsHexMap.selectedHexKey === hexKey) return false;
    this.surroundingsHexMap.selectedHexKey = hexKey;
    this.markDirty();
    return true;
  }

  setSurroundingsHexTarget(hexKey = null) {
    const next = typeof hexKey === "string" && hexKey.length > 0 ? hexKey : null;
    if (next) {
      if (next === "0,0") return false;
      const parsed = this._parseSurroundingsHexKey(next);
      if (
        !parsed ||
        this._getSurroundingsHexDistance(parsed.q, parsed.r) >
          this._getSurroundingsMapRadius()
      ) {
        return false;
      }
    }
    if ((this.surroundingsHexMap.targetHexKey || null) === next) return false;
    this.surroundingsHexMap.targetHexKey = next;
    this.markDirty();
    return true;
  }

  _getSurroundingsTileStateByKey(hexKey) {
    const openRadius = this._getSurroundingsStartingOpenRadius();
    const parsed = this._parseSurroundingsHexKey(hexKey);
    if (!parsed) return "locked";
    const dist = this._getSurroundingsHexDistance(parsed.q, parsed.r);
    if (dist <= openRadius) return "known";
    if (openRadius > 0 && dist <= openRadius + 1) return "silhouette";
    const saved = this.surroundingsHexMap?.tileStates?.[hexKey] || "";
    if (saved === "known" || saved === "scouted") return saved;
    return "locked";
  }

  _getSurroundingsTerrainTone(q, r) {
    if (q === 0 && r === 0) return "camp";
    const dist = this._getSurroundingsHexDistance(q, r);
    const seed = ((q * 73856093) ^ (r * 19349663) ^ 0x9e3779b9) >>> 0;
    const t = seed % 100;
    if (dist >= 7 && t < 8) return "ridge";
    if (t < 18) return "water";
    if (t < 28) return "clay";
    if (t < 66) return "forest";
    return "meadow";
  }

  _axialHexToCube(q, r) {
    return { x: q, y: -q - r, z: r };
  }

  _cubeDot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  _cubeLen(c) {
    const n = Math.sqrt(this._cubeDot(c, c));
    return n > 1e-9 ? n : 0;
  }

  /** Maps surroundings tone hints to camp tile terrain types for thematic matching. */
  _getCampTerrainAffinityForSurroundingsTone(tone) {
    const map = {
      water: ["water"],
      forest: ["grove", "brush"],
      clay: ["clay"],
      ridge: ["rock", "rocks", "ridge"],
      meadow: ["grass", "clearing", "brush"],
      camp: ["clearing"],
      unknown: [],
      locked: [],
    };
    return new Set(map[tone] || []);
  }

  _recordSurroundingsScoutCenter(hexKey) {
    if (!this.surroundingsHexMap) return;
    if (!Array.isArray(this.surroundingsHexMap.lastScoutHexKeys)) {
      this.surroundingsHexMap.lastScoutHexKeys = [];
    }
    const next = [
      hexKey,
      ...this.surroundingsHexMap.lastScoutHexKeys.filter((k) => k !== hexKey),
    ];
    this.surroundingsHexMap.lastScoutHexKeys = next.slice(0, 8);
  }

  /**
   * Pick a selectable local camp tile that best matches axial direction (q,r) from camp
   * and thematic tone of the surroundings hex.
   */
  _pickLocalCampTileForSurroundingsAxial(sq, sr) {
    if (!Number.isFinite(sq) || !Number.isFinite(sr)) return null;
    if (sq === 0 && sr === 0) {
      const campId =
        this.localCampMap?.campTileId ||
        this.getSelectedCampTileId() ||
        null;
      return this._getCampMapTile(campId) ? campId : null;
    }

    const hexTone = this._getSurroundingsTerrainTone(sq, sr);
    const affinity = this._getCampTerrainAffinityForSurroundingsTone(hexTone);
    const vS = this._axialHexToCube(sq, sr);
    const lenS = this._cubeLen(vS);

    const origin = this.localCampMap?.campOrigin || { q: 0, r: 0 };
    let bestId = null;
    let bestScore = -Infinity;

    for (const tile of this._getCampMapTileList()) {
      const state = this.getCampTileState(tile.id);
      if (
        state === "hidden" ||
        state === "silhouette" ||
        state === "visible_locked"
      ) {
        continue;
      }
      if (!this.isCampTilePresentationUnlocked(tile) && state !== "terrain_seen") {
        continue;
      }

      const dq = (tile.q || 0) - origin.q;
      const dr = (tile.r || 0) - origin.r;
      if (dq === 0 && dr === 0) continue;

      const vT = this._axialHexToCube(dq, dr);
      const lenT = this._cubeLen(vT);
      if (!lenT || !lenS) continue;

      const cos = this._cubeDot(vT, vS) / (lenT * lenS);
      let score = cos * 12;

      if (tile.terrainType && affinity.has(tile.terrainType)) {
        score += 5;
      }
      if (
        hexTone === "water" &&
        tile.resourceType === "water"
      ) {
        score += 3;
      }
      if (
        (hexTone === "forest" && tile.resourceType === "wood") ||
        (hexTone === "forest" && tile.resourceType === "fiber")
      ) {
        score += 2;
      }
      const dist = this._getCampTileLiveDist(tile);
      score -= Math.max(0, dist - 1) * 0.35;

      if (score > bestScore) {
        bestScore = score;
        bestId = tile.id;
      }
    }

    return bestId || null;
  }

  /** +1 gather output when the tile bears toward a recently scouted outskirts hex (same axial wedge). */
  _getSurroundingsScoutGatherEdgeBonus(tile) {
    if (!tile || !this.isCampSetupDone()) return 0;
    const dist = this._getCampTileLiveDist(tile);
    if (!(dist >= 2)) return 0;

    const keys = this.surroundingsHexMap?.lastScoutHexKeys;
    if (!Array.isArray(keys) || keys.length === 0) return 0;

    const origin = this.localCampMap?.campOrigin || { q: 0, r: 0 };
    const dq = (tile.q || 0) - origin.q;
    const dr = (tile.r || 0) - origin.r;
    if (dq === 0 && dr === 0) return 0;

    const vT = this._axialHexToCube(dq, dr);
    const lenT = this._cubeLen(vT);
    if (!lenT) return 0;

    const threshold = 0.52;
    for (const hk of keys) {
      const p = this._parseSurroundingsHexKey(hk);
      if (!p || (p.q === 0 && p.r === 0)) continue;
      const vS = this._axialHexToCube(p.q, p.r);
      const lenS = this._cubeLen(vS);
      if (!lenS) continue;
      const cos = this._cubeDot(vT, vS) / (lenT * lenS);
      if (cos >= threshold) return 1;
    }
    return 0;
  }

  /**
   * Switch to local camp map and select a tile tied to this outskirts hex (direction + biome hint).
   * Persists linkage in surroundingsHexMap.linkedLocalAnchor.
   */
  focusLocalMapFromSurroundingsHex(hexKey = "0,0") {
    this._ensureSurroundingsHexSelection();
    const parsed =
      typeof hexKey === "string"
        ? this._parseSurroundingsHexKey(hexKey)
        : null;
    if (!parsed) return { ok: false, tileId: null };

    const R = this._getSurroundingsMapRadius();
    if (this._getSurroundingsHexDistance(parsed.q, parsed.r) > R) {
      return { ok: false, tileId: null };
    }

    if (!this.isCampSetupDone()) {
      const opened = this.setActiveStrategicMapView("local");
      return { ok: opened, tileId: this.getSelectedCampTileId() };
    }

    const state = this._getSurroundingsTileStateByKey(hexKey);
    let tileId = null;

    if (hexKey === "0,0") {
      tileId =
        this.localCampMap.campTileId ||
        this.localCampMap.selectedTileId ||
        this.getSelectedCampTileId() ||
        null;
      if (!this._getCampMapTile(tileId)) tileId = null;
    } else if (state === "locked" || state === "silhouette") {
      return { ok: false, tileId: null };
    } else {
      const anchor = this.surroundingsHexMap?.linkedLocalAnchor;
      if (
        anchor?.hexKey === hexKey &&
        anchor?.tileId &&
        this._getCampMapTile(anchor.tileId)
      ) {
        const st = this.getCampTileState(anchor.tileId);
        if (
          st !== "hidden" &&
          st !== "silhouette" &&
          st !== "visible_locked"
        ) {
          tileId = anchor.tileId;
        }
      }
      if (!tileId) {
        tileId =
          this._pickLocalCampTileForSurroundingsAxial(parsed.q, parsed.r);
      }
    }

    if (tileId) {
      this.selectCampTile(tileId);
      this.surroundingsHexMap.linkedLocalAnchor = {
        hexKey,
        tileId,
      };
    } else if (hexKey !== "0,0") {
      this.addLog(
        "🧭 Пока нет ясной локальной зацепки под этот район — выберите участок на карте лагеря.",
      );
    }

    this.setActiveStrategicMapView("local");
    this.markDirty();
    return { ok: true, tileId };
  }

  _getSurroundingsPoiDefs() {
    // Deterministic POIs for early prototype. Later should come from world data.
    // Coordinates are within radius 8 and designed to create "pulls" around the camp.
    return [
      {
        id: "poi_hunting_zone",
        q: -2,
        r: -1,
        tone: "forest",
        icon: "🦌",
        title: "Охотничья зона",
        tags: ["Добыча", "Следы"],
      },
      {
        id: "poi_clay_bank",
        q: 2,
        r: -2,
        tone: "clay",
        icon: "🟠",
        title: "Глинистый берег",
        tags: ["Глина", "Вода"],
      },
      {
        id: "poi_temp_camp",
        q: 3,
        r: 1,
        tone: "meadow",
        icon: "⛺",
        title: "Временный лагерь",
        tags: ["Стоянка"],
      },
      {
        id: "poi_old_fire",
        q: 1,
        r: 3,
        tone: "ridge",
        icon: "🔥",
        title: "Место костра",
        tags: ["Ориентир"],
      },
      {
        id: "poi_danger_zone",
        q: -3,
        r: 3,
        tone: "unknown",
        icon: "☠",
        title: "Опасная зона",
        tags: ["Риск"],
      },
    ];
  }

  getSurroundingsHexMapState() {
    const radius = this._getSurroundingsMapRadius();
    const metersPerHex = this._getSurroundingsMetersPerHex();
    const openRadius = this._getSurroundingsStartingOpenRadius();
    const selectedKey = this.getSelectedSurroundingsHexKey();
    const targetKey = this.surroundingsHexMap?.targetHexKey || null;
    const campReady = this.isCampSetupDone();
    const tiles = [];

    if (!campReady) {
      tiles.push({
        id: "sur_0_0",
        hexKey: "0,0",
        q: 0,
        r: 0,
        dist: 0,
        distanceMeters: 0,
        state: "known",
        tone: "camp",
        selected: true,
        targeted: false,
        travelMs: 0,
      });
    } else {
    for (let q = -radius; q <= radius; q += 1) {
      for (let r = -radius; r <= radius; r += 1) {
        const dist = this._getSurroundingsHexDistance(q, r);
        if (dist > radius) continue;
        const hexKey = this._getSurroundingsHexKey(q, r);
        const state = this._getSurroundingsTileStateByKey(hexKey);
        const tone =
          state === "locked"
            ? "locked"
            : state === "silhouette"
              ? "unknown"
              : this._getSurroundingsTerrainTone(q, r);
        const distanceMeters = dist * metersPerHex;
        const travelMs =
          hexKey === "0,0"
            ? 0
            : window.TravelModel?.computeTravelTimeMs
              ? window.TravelModel.computeTravelTimeMs({
                  distanceMeters,
                  transport: "foot",
                  pathLevel: dist <= 1 ? "footpath" : "none",
                  loadFactor: 0.25,
                  terrainFactor: tone === "water" ? 1.25 : 1,
                  riskFactor: 1,
                })
              : 0;

        tiles.push({
          id: `sur_${q}_${r}`,
          hexKey,
          q,
          r,
          dist,
          distanceMeters,
          state,
          tone,
          scoutable: state === "silhouette" && this.canScoutSurroundingsHex(hexKey),
          selected: hexKey === selectedKey,
          targeted: !!targetKey && hexKey === targetKey,
          travelMs,
        });
      }
    }
    }

    const pois = campReady
      ? this._getSurroundingsPoiDefs()
          .map((poi) => {
        const dist = this._getSurroundingsHexDistance(poi.q, poi.r);
        const hexKey = this._getSurroundingsHexKey(poi.q, poi.r);
        const state = this._getSurroundingsTileStateByKey(hexKey);
        const visible = state !== "locked";
        const distanceMeters = dist * metersPerHex;
        const travelMs =
          dist <= 0
            ? 0
            : window.TravelModel?.computeTravelTimeMs
              ? window.TravelModel.computeTravelTimeMs({
                  distanceMeters,
                  transport: "foot",
                  pathLevel: dist <= 1 ? "footpath" : "none",
                  loadFactor: 0.25,
                  terrainFactor: poi.tone === "water" ? 1.25 : 1,
                  riskFactor: poi.id === "poi_danger_zone" ? 1.15 : 1,
                })
              : 0;
        return {
          ...poi,
          hexKey,
          dist,
          state,
          visible,
          distanceMeters,
          travelMs,
        };
          })
          .filter((poi) => poi.visible)
      : [];

    return {
      title: "Карта окрестностей",
      description:
        "Пеший слой над локальной картой. Здесь лагерь — якорь, а решения принимаются через вылазки, маршруты и будущую логистику.",
      interactionHint: this.isCampSetupDone()
        ? "На кольце тумана — «Разведать»: одна трата ⚡ открывает выбранный гекс и соседних. Двойной клик — метка вылазки."
        : "Сначала нужно основать лагерь, чтобы окрестности стали отдельным слоем карты.",
      scaleLabel: "250 м/гекс",
      mapRadius: radius,
      mapHexCount: 217,
      startingOpenRadius: openRadius,
      selectedHexKey: selectedKey,
      targetHexKey: targetKey,
      campReady,
      tiles,
      pois,
    };
  }

  getSurroundingsHexDetails(hexKey = this.getSelectedSurroundingsHexKey()) {
    const parsed = this._parseSurroundingsHexKey(hexKey) || { q: 0, r: 0 };
    const radius = this._getSurroundingsMapRadius();
    const dist = this._getSurroundingsHexDistance(parsed.q, parsed.r);
    if (dist > radius) return null;

    const metersPerHex = this._getSurroundingsMetersPerHex();
    const state = this._getSurroundingsTileStateByKey(hexKey);
    const tone =
      state === "locked"
        ? "locked"
        : state === "silhouette"
          ? "unknown"
          : this._getSurroundingsTerrainTone(parsed.q, parsed.r);
    const distanceMeters = dist * metersPerHex;
    const travelMs =
      hexKey === "0,0"
        ? 0
        : window.TravelModel?.computeTravelTimeMs
          ? window.TravelModel.computeTravelTimeMs({
              distanceMeters,
              transport: "foot",
              pathLevel: dist <= 1 ? "footpath" : "none",
              loadFactor: 0.25,
              terrainFactor: tone === "water" ? 1.25 : 1,
              riskFactor: 1,
            })
          : 0;

    const targeted = (this.surroundingsHexMap?.targetHexKey || null) === hexKey;
    const outskirtsRevealed =
      state === "known" || state === "scouted";

    let action = null;
    if (hexKey === "0,0") {
      action = {
        id: "enter_local",
        label: "Открыть локальную карту",
        disabled: !this.isCampSetupDone(),
        note:
          this.isCampSetupDone() && this.localCampMap?.campTileId
            ? "Перейдёте на локальный слой со стоянкой как выбранным участком: ходьба, сбор, стройка."
            : "Локальная карта остаётся слоем точных действий: стройка, сбор, тропы, работа с участками.",
      };
    } else if (state === "silhouette") {
      action = {
        id: "scout",
        label: "Разведать область",
        disabled: !this.canScoutSurroundingsHex(hexKey),
        note:
          "Одна вылазка снимает туман с выбранного гекса и соседних (до семи ячеек). Ориентиры и рельеф становятся видны; перемещение пешком по каждому гексу здесь не моделируется.",
      };
    } else if (state !== "locked") {
      action = {
        id: targeted ? "clear_target" : "set_target",
        label: targeted ? "Снять метку вылазки" : "Поставить метку вылазки",
        disabled: false,
        note:
          "Пока это планировочная метка. Следующий шаг — вылазки/разведка и расчёт маршрутов по дороге/местности.",
      };
    } else {
      action = {
        id: "locked",
        label: "Неизвестно",
        disabled: true,
        note:
          "Сначала откройте ближний слой и разведайте границу (silhouette). Дальний туман пока не трогаем.",
      };
    }

    const anchor = this.surroundingsHexMap?.linkedLocalAnchor;
    let companionAction = null;
    if (
      hexKey !== "0,0" &&
      outskirtsRevealed &&
      this.isCampSetupDone()
    ) {
      companionAction = {
        id: "enter_local_edge",
        label: "На локальную карту",
        disabled: false,
        note:
          anchor?.hexKey === hexKey &&
          anchor?.tileId &&
          this._getCampMapTile(anchor.tileId)
            ? `Сфокусирует участок, привязанный к этому гексу (сохраняется с прогрессом).`
            : "Подберёт ближайший подходящий участок локальной карты по направлению и типу сектора окрестностей.",
      };
    }

    return {
      hexKey,
      q: parsed.q,
      r: parsed.r,
      dist,
      state,
      tone,
      distanceMeters,
      travelMs,
      targeted,
      action,
      companionAction,
    };
  }

  canScoutSurroundingsHex(hexKey) {
    if (!this.isCampSetupDone()) return false;
    if (!hexKey || hexKey === "0,0") return false;
    const state = this._getSurroundingsTileStateByKey(hexKey);
    if (state !== "silhouette") return false;
    return this.energy >= 1;
  }

  scoutSurroundingsHex(hexKey) {
    if (!this.canScoutSurroundingsHex(hexKey)) return { ok: false };

    const patch = this._getSurroundingsScoutPatchKeys(hexKey);
    const toReveal = [];
    for (const key of patch) {
      if (key === "0,0") continue;
      const st = this._getSurroundingsTileStateByKey(key);
      if (st === "silhouette" || st === "locked") {
        toReveal.push(key);
      }
    }
    if (toReveal.length === 0) return { ok: false };
    if (!this.spendEnergy(1)) return { ok: false };

    if (!this.surroundingsHexMap?.tileStates) {
      this.surroundingsHexMap.tileStates = {};
    }
    for (const key of toReveal) {
      this.surroundingsHexMap.tileStates[key] = "scouted";
    }
    const n = toReveal.length;
    this.addLog(
      n > 1
        ? `🧭 Разведка: открыто ${n} гексов одной вылазкой.`
        : "🧭 Разведка окрестностей: новая область отмечена на карте.",
    );
    this.surroundingsHexMap.revision =
      (Number(this.surroundingsHexMap.revision) || 1) + 1;
    this._recordSurroundingsScoutCenter(hexKey);
    this.markDirty();
    return { ok: true, revealed: n };
  }

  getActiveStrategicMapView() {
    return this.canOpenSurroundingsMap() &&
      this.surroundingsMap?.activeView === "surroundings"
      ? "surroundings"
      : "local";
  }

  setActiveStrategicMapView(view) {
    const nextView =
      view === "surroundings" && this.canOpenSurroundingsMap()
        ? "surroundings"
        : "local";
    if (this.getActiveStrategicMapView() === nextView) return false;
    this.surroundingsMap.activeView = nextView;
    this.markDirty();
    return true;
  }

  selectSurroundingsNode(nodeId) {
    const nodeDefs = this._getSurroundingsNodeDefs();
    if (!nodeDefs[nodeId]) return false;
    if (this.surroundingsMap.selectedNodeId === nodeId) return false;
    this.surroundingsMap.selectedNodeId = nodeId;
    this.markDirty();
    return true;
  }

  setSurroundingsTargetNode(nodeId = null) {
    const nodeDefs = this._getSurroundingsNodeDefs();
    const nextTargetId =
      typeof nodeId === "string" &&
      nodeId !== "camp_core" &&
      nodeDefs[nodeId] &&
      this._isSurroundingsNodeUnlocked(nodeDefs[nodeId])
        ? nodeId
        : null;
    if ((this.surroundingsMap.targetNodeId || null) === nextTargetId)
      return false;
    this.surroundingsMap.targetNodeId = nextTargetId;
    this.markDirty();
    return true;
  }

  getSurroundingsTargetNodeId() {
    const nodeDefs = this._getSurroundingsNodeDefs();
    const targetNodeId = this.surroundingsMap?.targetNodeId || null;
    if (!targetNodeId || !nodeDefs[targetNodeId]) return null;
    return this._isSurroundingsNodeUnlocked(nodeDefs[targetNodeId])
      ? targetNodeId
      : null;
  }

  getSurroundingsMapState() {
    const context = this._getSurroundingsProgressContext();
    const nodeDefs = this._getSurroundingsNodeDefs();
    const knownNodeIds = new Set(this.surroundingsMap?.knownNodeIds || []);
    const targetNodeId = this.getSurroundingsTargetNodeId();
    const campReady = this.isCampSetupDone();
    const selectedNodeId = nodeDefs[this.surroundingsMap?.selectedNodeId]
      ? this.surroundingsMap.selectedNodeId
      : "camp_core";
    const nodes = Object.values(nodeDefs).map((node) => {
      const unlocked = this._isSurroundingsNodeUnlocked(node, context);
      const known =
        node.id === "camp_core"
          ? this.canOpenSurroundingsMap()
          : knownNodeIds.has(node.id);
      const distanceLabel =
        node.distanceMeters >= 1000
          ? `${(node.distanceMeters / 1000).toFixed(1)} км`
          : `${node.distanceMeters} м`;
      const travelLabel =
        node.travelMinutes > 0 ? `${node.travelMinutes} мин` : "здесь";

      return {
        ...node,
        distanceLabel,
        travelLabel,
        unlocked,
        known,
        selected: node.id === selectedNodeId,
        targeted: node.id === targetNodeId,
        isCamp: node.id === "camp_core",
        state:
          node.id === "camp_core"
            ? campReady
              ? "camp"
              : "locked"
            : unlocked
              ? "known"
              : "locked",
      };
    });

    return {
      title: "Карта окрестностей",
      description:
        "Первый внешний слой над локальной картой. Здесь лагерь выступает узлом, а окрестности собираются в крупные районы по 250 м на гекс.",
      interactionHint: campReady
        ? "Выберите район, чтобы увидеть, куда логично вести следующую вылазку."
        : "Сначала нужно основать лагерь, чтобы окрестности стали отдельным слоем карты.",
      activeView: this.getActiveStrategicMapView(),
      scaleLabel: "250 м/гекс",
      mapRadius: 8,
      mapHexCount: 217,
      startingOpenRadius: 2,
      startingOpenHexCount: campReady ? 19 : 0,
      selectedNodeId,
      targetNodeId,
      campReady,
      knownCount: nodes.filter((node) => node.known).length,
      unlockedCount: nodes.filter((node) => node.unlocked).length,
      totalCount: nodes.length,
      campSummary: {
        campName: context.campName,
        discoveredCount: context.discoveredCount,
        developedCount: context.developedCount,
        trailCount: context.trailCount,
      },
      nodes,
    };
  }

  getSurroundingsNodeDetails(
    nodeId = this.surroundingsMap?.selectedNodeId || "camp_core",
  ) {
    const mapState = this.getSurroundingsMapState();
    const node = mapState.nodes.find((entry) => entry.id === nodeId);
    if (!node) return null;

    let action = null;
    if (node.isCamp) {
      action = {
        id: "enter_local",
        label: "Открыть локальную карту",
        disabled: !mapState.campReady,
        note: "Локальная карта остаётся рабочим слоем для точных действий, стройки и сбора.",
      };
    } else if (node.unlocked) {
      action = {
        id: node.targeted ? "clear_target" : "set_target",
        label: node.targeted
          ? "Снять цель следующей вылазки"
          : "Сделать целью следующей вылазки",
        disabled: false,
        note: "Пока это планировочная метка. Полноценные переходы между картами будут следующим практическим шагом.",
      };
    } else {
      action = {
        id: "locked",
        label: "Пока недоступно",
        disabled: true,
        note:
          node.unlockHint ||
          "Этот район откроется позже по мере развития лагеря.",
      };
    }

    return {
      ...node,
      action,
      progressSummary: mapState.campSummary,
      localFocusPlan: this._getSurroundingsLocalFocusPlan(node),
    };
  }

  focusSurroundingsNodeOnLocalMap(nodeId) {
    const details = this.getSurroundingsNodeDetails(nodeId);
    if (!details || details.action?.disabled) return { ok: false };

    if (details.isCamp) {
      this.setActiveStrategicMapView("local");
      return { ok: true, tileId: this.getSelectedCampTileId() };
    }

    this.setSurroundingsTargetNode(details.id);
    const firstCandidate = details.localFocusPlan?.candidates?.[0] || null;
    if (firstCandidate?.id) {
      this.selectCampTile(firstCandidate.id);
    }
    this.setActiveStrategicMapView("local");
    return { ok: true, tileId: firstCandidate?.id || null };
  }

  focusSurroundingsLocalCandidate(nodeId, tileId) {
    const details = this.getSurroundingsNodeDetails(nodeId);
    if (!details || details.action?.disabled || !tileId) return { ok: false };

    const candidate = details.localFocusPlan?.candidates?.find(
      (entry) => entry.id === tileId,
    );
    if (!candidate) return { ok: false };

    this.setSurroundingsTargetNode(details.id);
    this.selectCampTile(candidate.id);
    this.setActiveStrategicMapView("local");
    return { ok: true, tileId: candidate.id };
  }

  getCampMapState() {
    const mapData = this.data.localCampMap || {};
    const selectedTileId = this.getSelectedCampTileId();
    const tiles = this._getCampMapTileList()
      .map((tile) => {
        const state = this.getCampTileState(tile.id);
        const presentationUnlocked = this.isCampTilePresentationUnlocked(tile);
        const placedBuildings = this.getCampTilePlacedBuildings(tile.id);
        const placedBuildingId = placedBuildings[0]?.buildingId || null;
        const placedBuilding = placedBuildings[0]?.def || null;
        const construction =
          this.activeConstruction?.tileId === tile.id
            ? this.getConstructionState()
            : null;
        const buildUsage = this.getCampTileBuildUsage(tile.id);
        const liveDist = this._getCampTileLiveDist(tile);
        const semanticView = this.getCampTileSemanticView(tile) || {};
        const terrainSeen = state === "terrain_seen";
        const publicView = terrainSeen
          ? this._getCampTerrainSeenPublicView(tile, semanticView)
          : {};

        return {
          ...tile,
          ...semanticView,
          ...publicView,
          distanceFromCamp: liveDist,
          state,
          terrainSeen,
          presentationLocked: terrainSeen || !presentationUnlocked,
          presentationLockHint: terrainSeen
            ? this.getCampTileUnlockHint?.(tile.id) ||
              publicView.roleDescription
            : presentationUnlocked
              ? ""
              : this.getCampTilePresentationLockHint(tile),
          pathLevel: this.getCampPathLevel(tile.id),
          pathData: this.getCampPathData(tile.id),
          pathUseProgress: this.getCampPathUseProgress(tile.id),
          selected: tile.id === selectedTileId,
          buildingId: placedBuildingId,
          building: placedBuilding,
          placedBuildingId,
          placedBuilding,
          placedBuildings,
          buildUsage,
          construction,
          resourceRemaining: terrainSeen
            ? null
            : this._getCampTileResourceRemaining(tile.id),
          resourceCapacity:
            !terrainSeen && Number.isFinite(tile.resourceAmount)
              ? tile.resourceAmount
              : null,
          isDepleted: terrainSeen
            ? false
            : this._isCampTileResourceDepleted(tile.id),
        };
      })
      .sort(
        (a, b) =>
          (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      );

    const expansionState = this.getCampMapExpansionState();

    return {
      title: mapData.title || "Локальная карта лагеря",
      description: mapData.description || "",
      interactionHint: mapData.interactionHint || "",
      radius: expansionState.radius,
      expansionState,
      selectedTileId,
      campSetupDone: !!this.localCampMap.campSetupDone,
      introStep: this.getCampIntroStepData(),
      discoveredCount: tiles.filter(
        (tile) =>
          tile.state !== "hidden" &&
          tile.state !== "silhouette" &&
          tile.state !== "visible_locked",
      ).length,
      developedCount: tiles.filter((tile) => tile.state === "developed").length,
      trailCount: tiles.filter((tile) => tile.pathLevel === "trail").length,
      resourceCount: tiles.filter((tile) => !!tile.actionId).length,
      totalCount: tiles.length,
      tiles,
    };
  }

  getCampMapTileDetails(tileId = this.getSelectedCampTileId()) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return null;

    const state = this.getCampTileState(tileId);
    const terrainSeen = state === "terrain_seen";
    if (!terrainSeen && !this.isCampTilePresentationUnlocked(tile)) {
      return null;
    }
    if (
      state === "hidden" ||
      state === "silhouette" ||
      state === "visible_locked"
    ) {
      return null;
    }
    const placedBuildings = this.getCampTilePlacedBuildings(tileId);
    const placedBuildingId = placedBuildings[0]?.buildingId || null;
    const placedBuilding = placedBuildings[0]?.def || null;
    const construction =
      this.activeConstruction?.tileId === tileId
        ? this.getConstructionState()
        : null;
    const buildUsage = this.getCampTileBuildUsage(tileId);
    const gatherActionIds = !terrainSeen
      ? this._getCampTileGatherActionIds(tile)
      : [];
    const actionId = gatherActionIds[0] || "";
    const action = actionId ? this.data.gatherActions[actionId] : null;
    const gatherProfile = action
      ? this.getGatherProfile(action.id, { tileId })
      : null;
    const pathProject = terrainSeen ? null : this.getCampPathProject(tileId);
    const semanticView = this.getCampTileSemanticView(tile) || {};
    const publicView = terrainSeen
      ? this._getCampTerrainSeenPublicView(tile, semanticView)
      : {};

    let nextBuildId = null;
    if (!terrainSeen && Array.isArray(tile.buildOptions)) {
      const visibleBuildOptions = tile.buildOptions.filter((buildingId) =>
        this.isBuildingPresentationUnlocked(buildingId),
      );
      nextBuildId =
        visibleBuildOptions.find(
          (buildingId) =>
            !this.buildings[buildingId] &&
            this._canBuildOnTile(buildingId, tileId),
        ) ||
        visibleBuildOptions.find((buildingId) => !this.buildings[buildingId]) ||
        visibleBuildOptions[0] ||
        null;
    }
    const nextBuilding = nextBuildId ? this.data.buildings[nextBuildId] : null;

    return {
      ...tile,
      ...semanticView,
      ...publicView,
      distanceFromCamp: this._getCampTileLiveDist(tile),
      state,
      terrainSeen,
      action,
      gatherActionIds,
      gatherActions: gatherActionIds
        .map((id) => this.data.gatherActions[id])
        .filter(Boolean),
      buildingId: placedBuildingId,
      building: placedBuilding,
      placedBuildingId,
      placedBuilding,
      placedBuildings,
      buildUsage,
      construction,
      nextBuildId,
      nextBuilding,
      resourceRemaining: terrainSeen
        ? null
        : this._getCampTileResourceRemaining(tileId),
      resourceCapacity:
        !terrainSeen && Number.isFinite(tile.resourceAmount)
          ? tile.resourceAmount
          : null,
      isDepleted: terrainSeen
        ? false
        : this._isCampTileResourceDepleted(tileId),
      pathLevel: this.getCampPathLevel(tileId),
      pathData: this.getCampPathData(tileId),
      pathUseProgress: this.getCampPathUseProgress(tileId),
      pathProject,
      gatherProfile,
      canGather:
        !terrainSeen && gatherProfile
          ? this.canGather(action.id, { tileId })
          : false,
      canImprovePath: !!pathProject?.canImprove,
      canBuild:
        !terrainSeen && nextBuildId
          ? this._canBuildOnTile(nextBuildId, tileId) &&
            this.canBuild(nextBuildId)
          : false,
    };
  }

  performCampTileAction(tileId, options = {}) {
    const details = this.getCampMapTileDetails(tileId);
    if (!details || details.state === "hidden") return false;

    if (details.action) {
      this.selectCampTile(tileId);
      const actionId =
        options.actionId && details.gatherActionIds?.includes(options.actionId)
          ? options.actionId
          : details.action.id;
      return this.enqueueManualGather(actionId, {
        tileId,
        resourceId: options.resourceId || null,
      });
    }

    if (
      details.nextBuildId &&
      this._canBuildOnTile(details.nextBuildId, tileId)
    ) {
      this.selectCampTile(tileId);
      return this.build(details.nextBuildId);
    }

    return false;
  }

  improveCampPath(tileId = this.getSelectedCampTileId()) {
    const project = this.getCampPathProject(tileId);
    if (!project || !project.canImprove) return false;
    if (!this.hasResources(project.cost)) return false;
    if (!this.hasEnergy(project.energyCost)) return false;

    if (!this.spendResources(project.cost)) return false;
    if (!this.spendEnergy(project.energyCost)) return false;

    this.localCampMap.pathLevels[tileId] = "trail";
    this._markCampTileDeveloped(tileId);
    this._drainSatiety(project.satietyCost || 0.18);
    this._drainHydration(project.hydrationCost || 0.14);
    this._syncCharacterConditionState();

    this.addLog(
      `🥾 Натоптана тропа к участку "${project.tile.name}" (⚡-${project.energyCost}).`,
    );
    this._pushStoryEvent({
      type: "map",
      icon: "🥾",
      title: "Появилась первая тропа",
      text: `Теперь путь к участку "${project.tile.name}" обходится легче и делает снабжение лагеря устойчивее.`,
      ttlMs: 5500,
    });
    this.markDirty();
    this.saveGame(true);
    return true;
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
        text: this.isEarlyProgressionMode() ? m.prologueText || m.text : m.text,
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
      upgradeId: this.activeConstruction.upgradeId || null,
      tileId: this.activeConstruction.tileId || null,
      durationMs: this.activeConstruction.durationMs,
      remainingMs,
    };
  }

  _restoreConstruction(savedConstruction) {
    this.activeConstruction = null;
    if (!savedConstruction) return;

    // Upgrade restore branch
    if (savedConstruction.upgradeId) {
      const upgrade = this.data.buildingUpgrades?.[savedConstruction.upgradeId];
      if (!upgrade) return;
      const baseDuration = Number.isFinite(savedConstruction.durationMs)
        ? savedConstruction.durationMs
        : Number.isFinite(upgrade.buildTimeMs)
          ? Math.round(upgrade.buildTimeMs * this.buildTimeMultiplier)
          : 12000;
      const remainingMs = Number.isFinite(savedConstruction.remainingMs)
        ? Math.max(0, Math.min(baseDuration, savedConstruction.remainingMs))
        : baseDuration;
      this.activeConstruction = {
        buildingId: upgrade.targetBuilding,
        upgradeId: savedConstruction.upgradeId,
        tileId:
          typeof savedConstruction.tileId === "string"
            ? savedConstruction.tileId
            : null,
        durationMs: baseDuration,
        startedAt: Date.now() - (baseDuration - remainingMs),
      };
      return;
    }

    if (!this.data.buildings[savedConstruction.buildingId]) return;

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
      if (
        item?.techId &&
        this.data.tech[item.techId] &&
        !this.researched[item.techId]
      ) {
        this.researchQueue.push({
          techId: item.techId,
          spentResources:
            typeof item.spentResources === "object" && item.spentResources
              ? { ...item.spentResources }
              : {},
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
        satiety: this.satiety,
        hydration: this.hydration,
        lastManualRestAt: this.lastManualRestAt,
        autoConsumeFoodEnabled: this.autoConsumeFoodEnabled,
        autoConsumeWaterEnabled: this.autoConsumeWaterEnabled,
        characterTitle: this.characterTitle,
        energyRegenRemainingMs: this.getEnergyRegenRemaining(),
        onboarding: { ...this.onboarding },
        insights: { ...this.insights },
        insightUnlockMoments: { ...this.insightUnlockMoments },
        knowledgeEntries: { ...this.knowledgeEntries },
        discoveryEvents: this.discoveryEvents.map((event) => ({ ...event })),
        pendingDiscoveryScene: this.pendingDiscoveryScene
          ? { ...this.pendingDiscoveryScene }
          : null,
        seenDiscoveryScenes: { ...this.seenDiscoveryScenes },
        currentGoalIndex: this.currentGoalIndex,
        completedGoals: [...this.completedGoals],
        allGoalsComplete: this.allGoalsComplete,
        currentEra: this.currentEra,
        eraProgress: {
          completedMilestones: Array.from(this.eraProgress.completedMilestones),
        },
        campMap: this._serializeCampMap(),
        surroundingsMap: this._serializeSurroundingsMap(),
        surroundingsHexMap: this._serializeSurroundingsHexMap(),
        craftQueue: this._serializeCraftQueue(),
        workLane: this._serializeWorkLane?.() ?? { active: null, queue: [] },
        campRoutine:
          typeof this._serializeCampRoutine === "function"
            ? this._serializeCampRoutine()
            : {
                enabled: !!this.campRoutine?.enabled,
                activePriorityId: this.campRoutine?.activePriorityId ?? null,
                targetStocks: { ...(this.campRoutine?.targetStocks || {}) },
              },
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
    const handoffStartIdx = this.data.onboarding?.steps?.findIndex?.(
      (s) => s?.id === "prologue_handoff_planks",
    );
    if (
      this.isOnboardingActive() &&
      Number.isFinite(handoffStartIdx) &&
      handoffStartIdx >= 0 &&
      (this.onboarding.currentStep || 0) >= handoffStartIdx
    ) {
      this.onboarding.handoff = true;
    }
    this.insights = this._sanitizeBooleanMap(
      state.insights,
      this.data.prologue?.insights,
    );
    this.insightUnlockMoments = this._sanitizeInsightUnlockMoments(
      state.insightUnlockMoments,
      this.data.prologue?.insights,
      this.insights,
    );
    this.knowledgeEntries = this._sanitizeBooleanMap(
      state.knowledgeEntries,
      this.data.prologue?.knowledgeEntries,
    );
    this.discoveryEvents = this._sanitizeDiscoveryEvents(state.discoveryEvents);
    this.seenDiscoveryScenes = this._sanitizeSeenDiscoveryScenes(
      state.seenDiscoveryScenes,
    );
    this.pendingDiscoveryScene = this._sanitizePendingDiscoveryScene(
      state.pendingDiscoveryScene,
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
    this._restoreSurroundingsMap(state.surroundingsMap);
    this._restoreSurroundingsHexMap(state.surroundingsHexMap);

    this._recalculateDerivedState();

    this.satiety = Number.isFinite(state.satiety)
      ? Math.max(0, Math.min(this.maxSatiety, state.satiety))
      : this.maxSatiety;
    this.hydration = Number.isFinite(state.hydration)
      ? Math.max(0, Math.min(this.maxHydration, state.hydration))
      : this.maxHydration;
    this.lastManualRestAt = Number.isFinite(state.lastManualRestAt)
      ? state.lastManualRestAt
      : 0;
    this.autoConsumeFoodEnabled =
      typeof state.autoConsumeFoodEnabled === "boolean"
        ? state.autoConsumeFoodEnabled
        : true;
    this.autoConsumeWaterEnabled =
      typeof state.autoConsumeWaterEnabled === "boolean"
        ? state.autoConsumeWaterEnabled
        : true;
    if (
      typeof state.characterTitle === "string" &&
      state.characterTitle.trim()
    ) {
      this.characterTitle = state.characterTitle.trim().slice(0, 32);
    }
    this.energy = Number.isFinite(state.energy)
      ? Math.max(0, Math.min(this.maxEnergy, state.energy))
      : this.maxEnergy;
    const currentRegenInterval = this.getCurrentEnergyRegenInterval();
    const regenRemainingMs = Number.isFinite(state.energyRegenRemainingMs)
      ? Math.max(
          0,
          Math.min(currentRegenInterval, state.energyRegenRemainingMs),
        )
      : currentRegenInterval;
    this.lastEnergyRegen =
      Date.now() - (currentRegenInterval - regenRemainingMs);

    this._restoreCraftQueue(state.craftQueue);
    this._restoreWorkLane?.(state.workLane);
    if (typeof this._restoreCampRoutine === "function") {
      this._restoreCampRoutine(state.campRoutine);
    }
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

  hasToolingPresentationUnlock() {
    return (
      (this.resources.crude_tools || 0) >= 1 ||
      (this.resourceTotals.crude_tools || 0) >= 1 ||
      (this.resources.improved_tools || 0) >= 1 ||
      (this.resourceTotals.improved_tools || 0) >= 1 ||
      !!this.researched.basic_tools
    );
  }

  isEarlyProgressionMode() {
    return (
      (this.isPrologueActive() && !this.onboarding?.handoff) ||
      !this.hasToolingPresentationUnlock()
    );
  }

  _asProgressionGateList(value) {
    if (!value) return [];
    return Array.isArray(value) ? value.filter(Boolean) : [value];
  }

  isProgressionGateMet(gate) {
    if (!gate) return true;
    if (typeof gate === "function") return !!gate(this);
    if (Array.isArray(gate)) {
      return gate.every((entry) => this.isProgressionGateMet(entry));
    }
    if (typeof gate !== "object") return true;

    if (
      Array.isArray(gate.anyOf) &&
      gate.anyOf.length > 0 &&
      !gate.anyOf.some((entry) => this.isProgressionGateMet(entry))
    ) {
      return false;
    }
    if (
      Array.isArray(gate.allOf) &&
      gate.allOf.length > 0 &&
      !gate.allOf.every((entry) => this.isProgressionGateMet(entry))
    ) {
      return false;
    }
    if (gate.notEarlyProgression && this.isEarlyProgressionMode()) {
      return false;
    }
    if (gate.tooling && !this.hasToolingPresentationUnlock()) {
      return false;
    }
    if (gate.campSetupDone && !this.isCampSetupDone()) {
      return false;
    }

    const requiredInsights = this._asProgressionGateList(gate.insights);
    if (requiredInsights.some((id) => !this.insights[id])) return false;

    const requiredTech = this._asProgressionGateList(gate.tech);
    if (requiredTech.some((id) => !this.researched[id])) return false;

    const requiredBuildings = this._asProgressionGateList(gate.buildings);
    if (requiredBuildings.some((id) => !this.buildings[id])) return false;

    const requiredResources = this._asProgressionGateList(gate.resources);
    if (requiredResources.some((id) => (this.resources[id] || 0) <= 0)) {
      return false;
    }

    const requiredResourceTotals = this._asProgressionGateList(
      gate.resourceTotals,
    );
    if (
      requiredResourceTotals.some((id) => (this.resourceTotals[id] || 0) <= 0)
    ) {
      return false;
    }

    if (typeof gate.when === "function" && !gate.when(this)) return false;
    return true;
  }

  getProgressionGateHint(gate, fallback = "") {
    if (!gate) return fallback;
    if (Array.isArray(gate)) {
      const hinted = gate.find((entry) => this.getProgressionGateHint(entry));
      return hinted ? this.getProgressionGateHint(hinted, fallback) : fallback;
    }
    if (typeof gate === "object") {
      return gate.hint || gate.description || fallback;
    }
    return fallback;
  }

  isResourcePresentationUnlocked(resourceId) {
    const resource = this.data.resources?.[resourceId];
    if (!resource) return false;
    return this.isProgressionGateMet(resource.presentationGate);
  }

  isGatherActionPresentationUnlocked(actionId) {
    const action = this.data.gatherActions?.[actionId];
    if (!action) return false;
    if (this.isEarlyProgressionMode() && action.hiddenInPrologue) return false;
    if (!this.isProgressionGateMet(action.presentationGate)) return false;
    if (action.unlockedBy && !this.researched[action.unlockedBy]) return false;

    const outputResourceIds = Object.keys(action.output || {});
    return outputResourceIds.every((resourceId) =>
      this.isResourcePresentationUnlocked(resourceId),
    );
  }

  isRecipePresentationUnlocked(recipeId) {
    const recipe = this.data.recipes?.[recipeId];
    if (!recipe) return false;
    if (this.isEarlyProgressionMode() && recipe.hiddenInPrologue) return false;
    if (!this.isProgressionGateMet(recipe.presentationGate)) return false;
    if (recipe.unlockedBy && !this.researched[recipe.unlockedBy]) return false;
    const resourceIds = new Set([
      ...Object.keys(recipe.output || {}),
      ...Object.keys(recipe.ingredients || {}),
    ]);
    for (const resourceId of resourceIds) {
      if (!this.isResourcePresentationUnlocked(resourceId)) return false;
    }
    return true;
  }

  isBuildingPresentationUnlocked(buildingId) {
    const building = this.data.buildings?.[buildingId];
    if (!building) return false;
    if (this.isEarlyProgressionMode() && building.hiddenInPrologue)
      return false;
    if (!this.isProgressionGateMet(building.presentationGate)) return false;
    if (building.unlockedBy && !this.researched[building.unlockedBy]) {
      return false;
    }
    return true;
  }

  isCampTilePresentationUnlocked(tile) {
    if (!tile) return false;
    if (
      !this.isProgressionGateMet(tile.mapRevealGate || tile.presentationGate)
    ) {
      return false;
    }
    if (
      tile.resourceType &&
      !this.isResourcePresentationUnlocked(tile.resourceType)
    ) {
      return false;
    }
    if (
      tile.actionId &&
      !this.isGatherActionPresentationUnlocked(tile.actionId)
    ) {
      return false;
    }
    return true;
  }

  getCampTilePresentationLockHint(tile) {
    if (!tile) return "";
    const gate = tile.mapRevealGate || tile.presentationGate;
    if (gate && !this.isProgressionGateMet(gate)) {
      return this.getProgressionGateHint(gate, tile.discoveryHint || "");
    }
    if (
      tile.resourceType &&
      !this.isResourcePresentationUnlocked(tile.resourceType)
    ) {
      const resource = this.data.resources?.[tile.resourceType];
      return this.getProgressionGateHint(
        resource?.presentationGate,
        tile.discoveryHint ||
          "Этот ресурс станет понятен после нужного озарения, исследования или постройки.",
      );
    }
    if (
      tile.actionId &&
      !this.isGatherActionPresentationUnlocked(tile.actionId)
    ) {
      const action = this.data.gatherActions?.[tile.actionId];
      return this.getProgressionGateHint(
        action?.presentationGate,
        tile.discoveryHint ||
          "Это действие откроется только после подходящего шага развития.",
      );
    }
    return tile.discoveryHint || "";
  }

  _getCampSemanticMarkerCatalog() {
    return {
      branches: {
        icon: "🪵",
        label: "Ветви",
        tone: "wood",
        resourceType: "wood",
      },
      wood: {
        icon: "🪵",
        label: "Дерево",
        tone: "wood",
        resourceType: "wood",
      },
      stone: {
        icon: "🪨",
        label: "Камень",
        tone: "stone",
        resourceType: "stone",
      },
      fiber: {
        icon: "🌾",
        label: "Волокна",
        tone: "fiber",
        resourceType: "fiber",
      },
      water: {
        icon: "💧",
        label: "Вода",
        tone: "water",
        resourceType: "water",
      },
      food: {
        icon: "🫐",
        label: "Пища",
        tone: "food",
        resourceType: "food",
      },
      clay: {
        icon: "◒",
        label: "Глина",
        tone: "clay",
        resourceType: "clay",
      },
      old_trace: {
        icon: "·",
        label: "Старый след",
        tone: "trace",
      },
      old_fire_trace: {
        icon: "○",
        label: "След очага",
        tone: "trace",
      },
      camp_place: {
        icon: "◉",
        label: "Место стоянки",
        tone: "camp",
      },
      build_site: {
        icon: "□",
        label: "Подходящее место",
        tone: "site",
      },
      shelter_site: {
        icon: "▱",
        label: "Ровная площадка",
        tone: "site",
      },
      workshop_site: {
        icon: "◇",
        label: "Твёрдая площадка",
        tone: "site",
      },
      kiln_site: {
        icon: "○",
        label: "Жарное место",
        tone: "site",
      },
      gather_supplies: {
        icon: "·",
        label: "Остатки привала",
        tone: "trace",
        actionId: "gather_supplies",
      },
    };
  }

  _normalizeCampSemanticMarker(marker) {
    if (!marker) return null;
    const raw =
      typeof marker === "string"
        ? { id: marker }
        : typeof marker === "object"
          ? { ...marker }
          : null;
    if (!raw) return null;

    const id = raw.id || raw.type || raw.resourceType || raw.actionId || "";
    const catalog = this._getCampSemanticMarkerCatalog()[id] || {};
    const normalized = {
      ...catalog,
      ...raw,
      id: id || catalog.id || raw.label || "marker",
    };

    const gate = normalized.revealGate || normalized.presentationGate;
    if (gate && !this.isProgressionGateMet(gate)) return null;
    if (
      normalized.resourceType &&
      !this.isResourcePresentationUnlocked(normalized.resourceType)
    ) {
      return null;
    }
    if (
      normalized.actionId &&
      !this.isGatherActionPresentationUnlocked(normalized.actionId)
    ) {
      return null;
    }

    return {
      id: normalized.id,
      icon: normalized.icon || "•",
      label: normalized.label || normalized.name || normalized.id,
      description: normalized.description || "",
      tone: normalized.tone || normalized.resourceType || "neutral",
      resourceType: normalized.resourceType || null,
      actionId: normalized.actionId || null,
    };
  }

  getCampTileVisibleMarkers(tile) {
    if (!tile || !this.isCampTilePresentationUnlocked(tile)) return [];

    const markers = [];
    const seen = new Set();
    const addMarker = (marker) => {
      const normalized = this._normalizeCampSemanticMarker(marker);
      if (!normalized) return;
      const key = [
        normalized.id,
        normalized.resourceType || "",
        normalized.actionId || "",
      ].join(":");
      if (seen.has(key)) return;
      seen.add(key);
      markers.push(normalized);
    };

    for (const marker of tile.visibleMarkers || []) {
      addMarker(marker);
    }

    if (markers.length === 0 && tile.resourceType) {
      addMarker({
        id: tile.resourceType === "wood" ? "branches" : tile.resourceType,
        resourceType: tile.resourceType,
        actionId: tile.actionId || null,
      });
    }

    if (markers.length === 0 && tile.actionId === "gather_supplies") {
      addMarker("gather_supplies");
    }

    if (markers.length === 0 && tile.sourceKind === "old_camp_trace") {
      addMarker("old_trace");
    }

    return markers.slice(0, 3);
  }

  _normalizeCampKnownPotential(potential) {
    if (!potential) return null;
    const raw =
      typeof potential === "string"
        ? { id: potential, label: potential }
        : typeof potential === "object"
          ? { ...potential }
          : null;
    if (!raw) return null;
    const gate = raw.revealGate || raw.presentationGate;
    if (gate && !this.isProgressionGateMet(gate)) return null;
    if (
      raw.resourceType &&
      !this.isResourcePresentationUnlocked(raw.resourceType)
    ) {
      return null;
    }
    if (
      raw.actionId &&
      !this.isGatherActionPresentationUnlocked(raw.actionId)
    ) {
      return null;
    }
    if (raw.hidden && !gate) return null;
    return {
      id:
        raw.id || raw.resourceType || raw.actionId || raw.label || "potential",
      label: raw.label || raw.name || raw.id || "Потенциал",
      description: raw.description || "",
      resourceType: raw.resourceType || null,
      actionId: raw.actionId || null,
    };
  }

  getCampTileKnownPotentials(tile) {
    if (!tile || !this.isCampTilePresentationUnlocked(tile)) return [];
    const source = Array.isArray(tile.revealedPotentials)
      ? tile.revealedPotentials
      : tile.potentials || [];
    const known = [];
    const seen = new Set();

    for (const potential of source) {
      const normalized = this._normalizeCampKnownPotential(potential);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      known.push(normalized);
    }

    if (known.length === 0 && tile.roleLabel) {
      known.push({
        id: "role",
        label: tile.roleLabel,
        description: tile.roleDescription || "",
        resourceType: tile.resourceType || null,
        actionId: tile.actionId || null,
      });
    }

    return known.slice(0, 5);
  }

  _getCampTerrainSeenPublicView(tile, semanticView = null) {
    if (!tile) return {};
    const terrain = this.data.baseTerrains?.[tile.terrainType] || {};
    const view = semanticView || this.getCampTileSemanticView(tile) || {};
    const terrainLabel =
      view.terrainLabel ||
      view.terrainName ||
      terrain.name ||
      tile.surfaceName ||
      "Осмотренная местность";
    const description =
      view.semanticDescription ||
      tile.surfaceDescription ||
      terrain.description ||
      "Местность уже видна, но её практический смысл пока не распознан.";

    return {
      name: terrainLabel,
      shortLabel: "",
      description,
      actionId: null,
      resourceType: null,
      resourceAmount: null,
      buildOptions: [],
      visibleMarkers: [],
      knownPotentials: [],
      primaryMarker: null,
      roleLabel: "Осмотренная местность",
      roleDescription:
        "Рельеф и проход понятны, но полезные признаки откроются после нужного опыта, озарения или постройки.",
      campCandidateHint: "",
      presentationLocked: true,
      terrainSeen: true,
    };
  }

  getCampTileSemanticView(tile) {
    if (!tile) return null;
    const terrain = this.data.baseTerrains?.[tile.terrainType] || {};
    const terrainName =
      tile.terrainName ||
      tile.surfaceName ||
      terrain.name ||
      tile.name ||
      "Участок";
    const terrainTags = Array.isArray(tile.terrainTags)
      ? tile.terrainTags
      : Array.isArray(terrain.terrainTags)
        ? terrain.terrainTags
        : [];
    const visibleMarkers = this.getCampTileVisibleMarkers(tile);
    const knownPotentials = this.getCampTileKnownPotentials(tile);

    return {
      terrainName,
      terrainLabel: terrainName,
      terrainTags,
      knownPotentials,
      visibleMarkers,
      primaryMarker: visibleMarkers[0] || null,
      surfaceImage: tile.surfaceImage || terrain.surfaceImage || "",
      semanticDescription:
        tile.semanticDescription ||
        tile.surfaceDescription ||
        terrain.description ||
        "",
    };
  }

  validatePresentationGates({ log = false } = {}) {
    const issues = [];
    for (const [actionId, action] of Object.entries(
      this.data.gatherActions || {},
    )) {
      if (action.hiddenInPrologue && !action.presentationGate) {
        issues.push(
          `gatherActions.${actionId}: hiddenInPrologue без presentationGate`,
        );
      }
    }
    for (const [resourceId, resource] of Object.entries(
      this.data.resources || {},
    )) {
      if (resource.futureStage && !resource.presentationGate) {
        issues.push(
          `resources.${resourceId}: futureStage без presentationGate`,
        );
      }
    }
    for (const [tileId, tile] of Object.entries(this._getCampMapTiles())) {
      const action = tile.actionId
        ? this.data.gatherActions?.[tile.actionId]
        : null;
      const resource = tile.resourceType
        ? this.data.resources?.[tile.resourceType]
        : null;
      const hasFutureGate =
        !!action?.presentationGate || !!resource?.presentationGate;
      if (
        hasFutureGate &&
        !tile.mapRevealGate &&
        typeof tile.discoveryRequirements !== "function"
      ) {
        issues.push(
          `localCampMap.tiles.${tileId}: future action/resource без mapRevealGate или discoveryRequirements`,
        );
      }
    }
    if (log && issues.length > 0 && typeof console !== "undefined") {
      console.warn("SpaceGame presentation gate audit", issues);
    }
    return issues;
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
    this.onboarding.handoff = false;
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
      text: "Около 12 тысяч лет назад мир уже меняется после льда, но ночь всё ещё холодна. Сначала нужно понять, что можно удержать в руках и что поможет пережить темноту.",
      ttlMs: 7000,
    });
    this._syncLocalCampMap();
    this.markDirty();
    this.saveGame(true);
  }

  skipOnboarding() {
    this.onboarding.started = false;
    this.onboarding.skipped = true;
    this.onboarding.handoff = true;
    this.addLog("⏭️ Пролог пропущен — переход к primitive-эпохе");
    this._syncLocalCampMap();
    this.markDirty();
    this.saveGame(true);
  }

  completeOnboarding() {
    this.onboarding.started = false;
    this.onboarding.completed = true;
    this.onboarding.handoff = true;
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
      handoff: false,
    };
    this.insights = this._getDefaultInsightState();
    this.insightUnlockMoments = this._getDefaultInsightUnlockMoments();
    this.knowledgeEntries = this._getDefaultKnowledgeState();
    this.discoveryEvents = [];
    this.pendingDiscoveryScene = null;
    this.seenDiscoveryScenes = this._getDefaultSeenDiscoveryScenes();
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
      unlockedAt: Number.isFinite(this.insightUnlockMoments?.[insight.id])
        ? this.insightUnlockMoments[insight.id]
        : 0,
    }));
  }

  getUnlockedInsightsCount() {
    return this.getPrologueInsightsState().filter((insight) => insight.unlocked)
      .length;
  }

  getKnowledgeEntries() {
    const sourceInsightByEntryId = new Map();
    for (const insight of this.getPrologueInsights()) {
      if (insight.knowledgeEntry) {
        sourceInsightByEntryId.set(insight.knowledgeEntry, insight);
      }
    }

    const defs = Object.values(this.data.prologue?.knowledgeEntries || {}).sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
    return defs
      .filter((entry) => this.knowledgeEntries[entry.id])
      .map((entry, index) => {
        const sourceInsight = sourceInsightByEntryId.get(entry.id) || null;
        return {
          ...entry,
          unlockedIndex: index + 1,
          sourceInsight,
          kind: sourceInsight ? "insight" : "milestone",
          relatedOutcomes: Array.isArray(sourceInsight?.outcomes)
            ? sourceInsight.outcomes
            : [],
          previewLine:
            Array.isArray(entry.lines) && entry.lines.length > 0
              ? entry.lines[0]
              : "",
        };
      });
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

    if (
      insight.discoveryScene?.id &&
      !this.seenDiscoveryScenes[insight.discoveryScene.id]
    ) {
      return this._queueDiscoveryScene(insight);
    }

    return this._completeInsightUnlock(insightId, {
      sceneId: insight.discoveryScene?.id || "",
    });
  }

  _checkPrologueInsights() {
    if (!this.isPrologueActive() || this.pendingDiscoveryScene) return false;

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
    if (!this.isEarlyProgressionMode()) {
      return Object.keys(this.data.resources).filter((id) =>
        this.isResourcePresentationUnlocked(id),
      );
    }
    if (
      this.isPrologueActive() &&
      !this.getPrologueRevealState().showResources
    ) {
      return [];
    }

    const visible = new Set(this.data.prologue?.visibleResourceIds || []);
    for (const [id, amount] of Object.entries(this.resources)) {
      if (amount > 0) visible.add(id);
    }
    return Array.from(visible).filter((id) =>
      this.isResourcePresentationUnlocked(id),
    );
  }

  getVisibleGatherActions() {
    if (!this.isEarlyProgressionMode()) {
      return Object.keys(this.data.gatherActions).filter((id) =>
        this.isGatherActionPresentationUnlocked(id),
      );
    }
    return [...(this.data.prologue?.gatherActionIds || [])].filter((id) =>
      this.isGatherActionPresentationUnlocked(id),
    );
  }

  getVisibleRecipeIds() {
    if (!this.isEarlyProgressionMode()) {
      return Object.keys(this.data.recipes).filter((id) =>
        this.isRecipePresentationUnlocked(id),
      );
    }
    if (this.isPrologueActive() && !this.getPrologueRevealState().showCraft) {
      return [];
    }
    return [...(this.data.prologue?.recipeIds || [])].filter((id) =>
      this.isRecipePresentationUnlocked(id),
    );
  }

  getVisibleBuildingIds() {
    if (!this.isEarlyProgressionMode()) {
      return Object.keys(this.data.buildings).filter((id) =>
        this.isBuildingPresentationUnlocked(id),
      );
    }
    if (
      this.isPrologueActive() &&
      !this.getPrologueRevealState().showBuildings
    ) {
      return [];
    }

    const visible = [];
    if (this.isCampSetupDone()) {
      visible.push("rest_tent");
    }

    const campfireVisible =
      !!this.buildings.rest_tent ||
      this.activeConstruction?.buildingId === "campfire" ||
      !!this.buildings.campfire;
    if (campfireVisible) {
      visible.push("campfire");
    }

    return visible.filter((id) => this.isBuildingPresentationUnlocked(id));
  }

  getPrologueRevealState() {
    const unlockedInsights = this.getUnlockedInsightsCount();
    const hasTool =
      (this.resources.crude_tools || 0) >= 1 ||
      (this.resourceTotals.crude_tools || 0) >= 1;
    const campSetupDone = this.isCampSetupDone();
    const shelterBuilt = !!this.buildings.rest_tent;
    const nearFinalSteps =
      this.onboarding.currentStep >=
      Math.max(0, this.data.onboarding.steps.length - 2);
    const campfireSeen =
      this.activeConstruction?.buildingId === "campfire" ||
      !!this.buildings.campfire;

    let stage = 0;
    if (unlockedInsights >= 1) stage = 1;
    if (unlockedInsights >= 4 || hasTool) stage = 2;
    if (unlockedInsights >= 6 || nearFinalSteps || shelterBuilt || campfireSeen)
      stage = 3;

    return {
      stage,
      unlockedInsights,
      showInsights: true,
      showResources: stage >= 1,
      showCraft: stage >= 2,
      showBuildings: campSetupDone,
    };
  }

  getPrologueCampfireState() {
    const building = this.data.buildings.campfire;
    if (!building) return null;

    const shelterBuilt = !!this.buildings.rest_tent;
    const shelterConstructing =
      this.activeConstruction?.buildingId === "rest_tent";
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
      (shelterBuilt ? 1 : 0) +
      (built ? 1 : 0);
    const totalParts = this.getPrologueInsights().length + 3;

    let text =
      this.data.prologue?.campfireText ||
      "Костёр должен стать первым центром жизни.";
    if (built) {
      text =
        this.data.prologue?.campfireBuiltText ||
        "Костёр уже стал точкой возвращения.";
    } else if (!shelterBuilt) {
      text =
        "Стоянка ещё слишком хрупкая для очага. Сначала нужно поставить первое жильё, чтобы лагерь стал пригодным для жизни, а уже потом собирать устойчивый огонь.";
    } else if (missingInsights.length > 0 || !hasTool) {
      text =
        "Жильё уже стоит, и место под очаг намечено. Теперь нужно закончить раннюю подготовку: добрать озарения, связать грубое орудие и не дать огню родиться вслепую.";
    }

    return {
      title: this.data.prologue?.campfireTitle || "Путь к первому костру",
      text,
      built,
      constructing,
      hasTool,
      shelterBuilt,
      shelterConstructing,
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
    if (buildingId === "rest_tent") {
      return "⛺ Начали ставить первую палатку. Стоянка становится местом, где можно задержаться.";
    }
    if (buildingId === "campfire") {
      return "🔥 Начали складывать первый костёр. Огонь уже близко.";
    }
    return null;
  }

  _getPrologueBuildCompleteLog(buildingId) {
    if (buildingId === "rest_tent") {
      return "⛺ Первое жильё готово. Теперь стоянка уже не выглядит совсем случайной.";
    }
    if (buildingId === "campfire") {
      return "🔥 Первый костёр разгорелся. У общины появилось место, к которому можно возвращаться.";
    }
    return null;
  }

  getRecipeCost(recipeId) {
    const recipe = this.data.recipes[recipeId];
    if (!recipe) return {};

    const baseCost =
      this.isEarlyProgressionMode() && recipe.prologueIngredients
        ? recipe.prologueIngredients
        : recipe.ingredients;

    return this.isEarlyProgressionMode()
      ? { ...baseCost }
      : this._getDiscountedCost(baseCost);
  }

  getBuildingCost(buildingId) {
    const building = this.data.buildings[buildingId];
    if (!building) return {};

    const baseCost =
      this.isEarlyProgressionMode() && building.prologueCost
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

  _clampSatiety(value) {
    return Math.max(0, Math.min(this.maxSatiety, value));
  }

  _clampHydration(value) {
    return Math.max(0, Math.min(this.maxHydration, value));
  }

  _getCharacterConditionConfig(conditionId) {
    return this.data.character?.conditions?.[conditionId] || null;
  }

  getCampTrailCount() {
    const levels = this.localCampMap?.pathLevels || {};
    let count = 0;
    for (const level of Object.values(levels)) {
      if (level === "trail") count += 1;
    }
    return count;
  }

  getCharacterCondition() {
    const satietyRatio =
      this.maxSatiety > 0 ? this.satiety / this.maxSatiety : 1;
    const hydrationRatio =
      this.maxHydration > 0 ? this.hydration / this.maxHydration : 1;
    const energyRatio = this.maxEnergy > 0 ? this.energy / this.maxEnergy : 1;

    let conditionId = "stable";
    if (satietyRatio <= 0.2 || hydrationRatio <= 0.2 || energyRatio <= 0.15) {
      conditionId = "exhausted";
    } else if (
      satietyRatio <= 0.5 ||
      hydrationRatio <= 0.5 ||
      energyRatio <= 0.35
    ) {
      conditionId = "weakened";
    }

    const config = this._getCharacterConditionConfig(conditionId) ||
      this._getCharacterConditionConfig("stable") || {
        id: "stable",
        label: "В порядке",
        description: "",
        regenPenaltyMs: 0,
        gatherOutputPenalty: 0,
        gatherCostPenalty: 0,
      };

    const maxSafeDistance = Number.isFinite(config.maxSafeDistance)
      ? config.maxSafeDistance >= 99
        ? config.maxSafeDistance
        : config.maxSafeDistance +
          Math.max(0, this.getCharacterEndurance() - this.baseEndurance)
      : config.maxSafeDistance;

    return {
      ...config,
      baseMaxSafeDistance: config.maxSafeDistance,
      maxSafeDistance,
      satietyRatio,
      hydrationRatio,
      energyRatio,
      needs: {
        satiety: this._getCharacterNeedState("satiety", satietyRatio),
        hydration: this._getCharacterNeedState("hydration", hydrationRatio),
      },
    };
  }

  _getCharacterNeedState(kind, ratio) {
    const safeRatio = Number.isFinite(ratio) ? Math.max(0, ratio) : 1;
    const isHydration = kind === "hydration";

    if (safeRatio <= 0.2) {
      return {
        id: "critical",
        tone: "bad",
        label: isHydration ? "Сильная жажда" : "Сильный голод",
        note: isHydration
          ? "Воды осталось на грани: дальние выходы быстро сорвут восстановление."
          : "Еды почти нет: восстановление сил начинает срываться.",
      };
    }
    if (safeRatio <= 0.5) {
      return {
        id: "low",
        tone: "warn",
        label: isHydration ? "Жажда нарастает" : "Голод нарастает",
        note: isHydration
          ? "Воды хватит ненадолго: дальние и тяжёлые выходы становятся рискованными."
          : "Сытость просела: работать можно, но отдых уже хуже держит силы.",
      };
    }
    if (safeRatio <= 0.75) {
      return {
        id: "watch",
        tone: "info",
        label: isHydration ? "Воду стоит пополнить" : "Еду стоит пополнить",
        note: isHydration
          ? "Запас воды ещё рабочий, но следующий выход уже важен."
          : "Сытость ещё рабочая, но без еды лагерь скоро перестанет помогать.",
      };
    }

    return {
      id: "steady",
      tone: "ok",
      label: isHydration ? "Воды достаточно" : "Сыт",
      note: isHydration
        ? "Водный запас позволяет работать без явных штрафов."
        : "Сытость позволяет нормально восстанавливаться и работать.",
    };
  }

  _getCarryLoadState(load, capacity, heavyThreshold = 0.85) {
    const safeCapacity = Math.max(0.01, capacity || 0);
    const loadPct = Math.max(0, load || 0) / safeCapacity;
    if (loadPct >= 1) {
      return {
        id: "full",
        tone: "bad",
        label: "Груз на пределе",
        note: "Персонаж несёт столько, сколько вообще способен утащить за ходку.",
        loadPct,
      };
    }
    if (loadPct >= heavyThreshold) {
      return {
        id: "heavy",
        tone: "warn",
        label: "Тяжёлый груз",
        note: "Нагрузка уже замедляет выход и повышает цену пути.",
        loadPct,
      };
    }
    if (loadPct >= 0.55) {
      return {
        id: "loaded",
        tone: "info",
        label: "Заметный груз",
        note: "Нести можно, но дальние участки лучше связывать тропой.",
        loadPct,
      };
    }
    return {
      id: loadPct > 0 ? "light" : "empty",
      tone: "ok",
      label: loadPct > 0 ? "Лёгкий груз" : "Руки свободны",
      note:
        loadPct > 0
          ? "Нагрузка почти не мешает передвижению."
          : "Персонаж ничего не несёт и может свободно идти к цели.",
      loadPct,
    };
  }

  _getTripNeedsImpact(satietyCost = 0, hydrationCost = 0) {
    const afterSatietyRatio =
      this.maxSatiety > 0
        ? Math.max(0, this.satiety - Math.max(0, satietyCost || 0)) /
          this.maxSatiety
        : 1;
    const afterHydrationRatio =
      this.maxHydration > 0
        ? Math.max(0, this.hydration - Math.max(0, hydrationCost || 0)) /
          this.maxHydration
        : 1;
    const satietyState = this._getCharacterNeedState(
      "satiety",
      afterSatietyRatio,
    );
    const hydrationState = this._getCharacterNeedState(
      "hydration",
      afterHydrationRatio,
    );
    const worstState =
      satietyState.id === "critical" || hydrationState.id === "critical"
        ? "critical"
        : satietyState.id === "low" || hydrationState.id === "low"
          ? "low"
          : satietyState.id === "watch" || hydrationState.id === "watch"
            ? "watch"
            : "steady";

    if (worstState === "critical") {
      return {
        id: "critical",
        tone: "bad",
        label: "Выход сорвёт базовые нужды",
        note: "После такого выхода еда или вода окажутся на критическом уровне. Лучше сначала пополнить запас или выбрать ближнюю цель.",
        afterSatietyRatio,
        afterHydrationRatio,
      };
    }
    if (worstState === "low") {
      return {
        id: "low",
        tone: "warn",
        label: "После выхода нужен отдых и запас",
        note: "Выход опустит сытость или воду ниже безопасной середины. Возвращение в лагерь станет важнее следующей работы.",
        afterSatietyRatio,
        afterHydrationRatio,
      };
    }
    if (worstState === "watch") {
      return {
        id: "watch",
        tone: "info",
        label: "Запас просядет, но выдержит",
        note: "Выход заметно потратит еду или воду, но не должен сразу ослабить персонажа.",
        afterSatietyRatio,
        afterHydrationRatio,
      };
    }

    return {
      id: "steady",
      tone: "ok",
      label: "Нужды выдержат выход",
      note: "После этого выхода сытость и вода останутся в рабочем диапазоне.",
      afterSatietyRatio,
      afterHydrationRatio,
    };
  }

  getCharacterCarryCapacity() {
    const strengthCapacityBonus = this.getCharacterStrengthCapacityBonus();
    return Number((this.carryCapacity + strengthCapacityBonus).toFixed(2));
  }

  getCharacterEndurance() {
    return Math.max(0, this.baseEndurance + (this.enduranceBonus || 0));
  }

  getCharacterFieldcraft() {
    let fieldcraft = this.baseFieldcraft + (this.fieldcraftBonus || 0);
    if ((this.resources.improved_tools || 0) > 0) {
      fieldcraft += 1;
    }
    return Math.max(0, fieldcraft);
  }

  getCharacterStrength() {
    return Math.max(0, this.baseStrength + (this.strengthBonus || 0));
  }

  getCharacterMobility() {
    return Math.max(0, this.baseMobility + (this.mobilityBonus || 0));
  }

  getCharacterIngenuity() {
    return Math.max(0, this.baseIngenuity + (this.ingenuityBonus || 0));
  }

  getCharacterStrengthCapacityBonus() {
    return Math.max(0, this.getCharacterStrength() - this.baseStrength) * 0.75;
  }

  getCharacterHeavyLoadThreshold() {
    const baseThreshold = this.data.character?.carry?.heavyThreshold || 0.85;
    const strengthLift = Math.max(
      0,
      this.getCharacterStrength() - this.baseStrength,
    );
    return Math.min(0.96, baseThreshold + strengthLift * 0.04);
  }

  getCharacterNeedsRelief() {
    const enduranceRelief =
      Math.max(0, this.getCharacterEndurance() - this.baseEndurance) * 0.035;
    const mobilityRelief =
      Math.max(0, this.getCharacterMobility() - this.baseMobility) * 0.025;
    return Math.min(0.22, enduranceRelief + mobilityRelief);
  }

  getCharacterTravelSpeedMultiplier() {
    const mobilityRelief =
      Math.max(0, this.getCharacterMobility() - this.baseMobility) * 0.04;
    const enduranceRelief =
      Math.max(0, this.getCharacterEndurance() - this.baseEndurance) * 0.02;
    return Math.max(0.72, 1 - mobilityRelief - enduranceRelief);
  }

  getCharacterIngenuityTimeMultiplier() {
    const ingenuityRelief =
      Math.max(0, this.getCharacterIngenuity() - this.baseIngenuity) * 0.04;
    return Math.max(0.78, 1 - ingenuityRelief);
  }

  getCharacterForagingYieldBonus() {
    const fieldcraftLift = Math.max(
      0,
      this.getCharacterFieldcraft() - this.baseFieldcraft,
    );
    return fieldcraftLift > 0 ? 1 : 0;
  }

  getCharacterExtractionYieldBonus() {
    const strengthLift = Math.max(
      0,
      this.getCharacterStrength() - this.baseStrength,
    );
    return strengthLift > 0 ? 1 : 0;
  }

  getCharacterSupplySalvageBonus() {
    const ingenuityLift = Math.max(
      0,
      this.getCharacterIngenuity() - this.baseIngenuity,
    );
    return ingenuityLift > 0 ? 1 : 0;
  }

  getCharacterSurveyRevealBonus() {
    const fieldcraftLift = Math.max(
      0,
      this.getCharacterFieldcraft() - this.baseFieldcraft,
    );
    const ingenuityLift = Math.max(
      0,
      this.getCharacterIngenuity() - this.baseIngenuity,
    );
    return fieldcraftLift + ingenuityLift >= 2 ? 1 : 0;
  }

  getCharacterRestEfficiencyBonus() {
    const ingenuityLift = Math.max(
      0,
      this.getCharacterIngenuity() - this.baseIngenuity,
    );
    const recoveryLift = Math.max(
      0,
      this.getCharacterRecoveryRating() - this.baseRecoveryRating,
    );

    return {
      food: Number(
        Math.min(0.75, ingenuityLift * 0.15 + recoveryLift * 0.1).toFixed(2),
      ),
      water: Number(
        Math.min(1.2, ingenuityLift * 0.2 + recoveryLift * 0.15).toFixed(2),
      ),
      energy: Number(
        Math.min(0.75, ingenuityLift * 0.05 + recoveryLift * 0.15).toFixed(2),
      ),
    };
  }

  _getCharacterGatherSpecialization(resourceId, tile, actionId) {
    const fieldcraftBonus = this.getCharacterForagingYieldBonus();
    const strengthBonus = this.getCharacterExtractionYieldBonus();
    const ingenuityBonus = this.getCharacterSupplySalvageBonus();
    let bonus = 0;

    const sources = {
      fieldcraft: 0,
      strength: 0,
      ingenuity: 0,
    };

    if (
      fieldcraftBonus > 0 &&
      (resourceId === "food" ||
        resourceId === "fiber" ||
        resourceId === "water")
    ) {
      bonus += fieldcraftBonus;
      sources.fieldcraft += fieldcraftBonus;
    }

    if (
      strengthBonus > 0 &&
      (resourceId === "wood" || resourceId === "stone" || resourceId === "clay")
    ) {
      bonus += strengthBonus;
      sources.strength += strengthBonus;
    }

    if (ingenuityBonus > 0 && actionId === "gather_supplies") {
      bonus += ingenuityBonus;
      sources.ingenuity += ingenuityBonus;
    }

    if (
      ingenuityBonus > 0 &&
      tile?.terrainType === "lore" &&
      (resourceId === "food" || resourceId === "water")
    ) {
      bonus += 1;
      sources.ingenuity += 1;
    }

    return {
      bonus: Math.min(2, bonus),
      sources,
    };
  }

  _getCampSurveyAssistTile(originTileId) {
    if (!originTileId) return null;

    return this._getCampNeighborTileIds(originTileId)
      .map((tileId) => this._getCampMapTile(tileId))
      .filter((tile) => {
        if (!tile) return false;
        const state = this.getCampTileState(tile.id);
        if (
          state === "camp" ||
          state === "developed" ||
          state === "discovered" ||
          state === "camp_candidate"
        ) {
          return false;
        }
        return this._canTileMeetDiscoveryRules(tile);
      })
      .sort((left, right) => {
        const leftDist = this._getCampTileLiveDist(left);
        const rightDist = this._getCampTileLiveDist(right);
        if (leftDist !== rightDist) return leftDist - rightDist;
        if (left.distanceFromCamp !== right.distanceFromCamp) {
          return left.distanceFromCamp - right.distanceFromCamp;
        }
        if ((left.q || 0) !== (right.q || 0)) {
          return (left.q || 0) - (right.q || 0);
        }
        return (left.r || 0) - (right.r || 0);
      })[0];
  }

  _getCharacterMobilityEffortRelief(routeDistance = 0) {
    const mobilityLift = Math.max(
      0,
      this.getCharacterMobility() - this.baseMobility,
    );
    if (mobilityLift <= 0 || routeDistance < 2) return 0;
    return Math.min(2, Math.floor(mobilityLift * 0.65 + routeDistance * 0.18));
  }

  getCharacterRecoveryRating() {
    return Math.max(
      0,
      this.baseRecoveryRating + (this.recoveryRatingBonus || 0),
    );
  }

  getResourceCarryWeight(resourceId) {
    return this.data.resources?.[resourceId]?.carryWeight || 1;
  }

  _getDeliveryProfile(
    totalLoad,
    carryCapacity = this.getCharacterCarryCapacity(),
  ) {
    const safeCapacity = Math.max(0.01, carryCapacity || 1);
    const safeLoad = Math.max(0, totalLoad || 0);
    const tripsRequired = Math.max(1, Math.ceil(safeLoad / safeCapacity));
    const perTripLoad =
      safeLoad > 0 ? Math.min(safeCapacity, safeLoad / tripsRequired) : 0;
    const loadPct = safeCapacity > 0 ? perTripLoad / safeCapacity : 0;
    const heavyThreshold = this.getCharacterHeavyLoadThreshold();

    return {
      totalLoad: safeLoad,
      carryCapacity: safeCapacity,
      tripsRequired,
      perTripLoad,
      loadPct,
      heavyThreshold,
      carryState: this._getCarryLoadState(
        perTripLoad,
        safeCapacity,
        heavyThreshold,
      ),
      tripPenalty: Math.max(0, tripsRequired - 1),
      requiresMultipleTrips: tripsRequired > 1,
    };
  }

  _getTerrainEffort(tile) {
    if (!tile) {
      return {
        penalty: 0,
        label: "лагерь",
      };
    }

    switch (tile.terrainType) {
      case "rock":
        return { penalty: 1, label: "каменистый участок" };
      case "ridge":
        return { penalty: 1, label: "каменистая гряда" };
      case "clay":
        return { penalty: 1, label: "вязкая глина" };
      case "water":
        return { penalty: 1, label: "влажный берег" };
      case "grove":
        return { penalty: 1, label: "густая чаща" };
      case "kiln":
        return { penalty: 0, label: "сухая терраса" };
      case "worksite":
        return { penalty: 0, label: "твёрдая площадка" };
      case "clearing":
      case "lore":
        return { penalty: 0, label: "ровная местность" };
      case "brush":
        return { penalty: 0, label: "заросли" };
      case "grass":
        return { penalty: 0, label: "трава" };
      default:
        return { penalty: 0, label: tile.terrainType || "участок" };
    }
  }

  getCharacterRecoveryState() {
    const sources = [];
    if (this.buildings.campfire) {
      sources.push({
        id: "campfire",
        label: "Костёр",
        description: "даёт тепло и возвращает сытость быстрее",
      });
    }
    if (this.buildings.rest_tent) {
      sources.push({
        id: "rest_tent",
        label: "Укрытие",
        description: "делает отдых устойчивее",
      });
    }
    if (this.buildings.storage) {
      sources.push({
        id: "storage",
        label: "Хранилище",
        description: "снижает бытовой хаос и чуть улучшает восстановление",
      });
    }

    return {
      sources,
      bonusPerTick: this.characterRecoveryBonusPerTick || 0,
      summary:
        sources.length > 0
          ? sources.map((source) => source.label).join(" · ")
          : "только короткие паузы без опоры лагеря",
    };
  }

  _getCharacterRestConfig() {
    return this.data.character?.rest || {};
  }

  getCharacterRestCooldownMs() {
    const restConf = this._getCharacterRestConfig();
    const sourceIds = new Set(
      (this.getCharacterRecoveryState().sources || []).map(
        (source) => source.id,
      ),
    );
    let cooldown = restConf.cooldownMs || 14000;

    if (sourceIds.has("campfire")) {
      cooldown -= 2000;
    }
    if (sourceIds.has("rest_tent")) {
      cooldown -= 3000;
    }
    cooldown -= this.getCharacterRecoveryRating() * 500;

    return Math.max(5000, cooldown);
  }

  getCharacterRestCooldownRemaining() {
    if (!this.lastManualRestAt) return 0;
    return Math.max(
      0,
      this.getCharacterRestCooldownMs() - (Date.now() - this.lastManualRestAt),
    );
  }

  getCharacterRestProfile() {
    const restConf = this._getCharacterRestConfig();
    const condition = this.getCharacterCondition();
    const recovery = this.getCharacterRecoveryState();
    const atCamp = this.isCharacterAtCamp?.() ?? true;
    const sourceIds = new Set(
      (recovery.sources || []).map((source) => source.id),
    );
    const recoveryRating = this.getCharacterRecoveryRating();
    const energyMissing = Math.max(0, this.maxEnergy - this.energy);
    const satietyMissing = Math.max(0, this.maxSatiety - this.satiety);
    const hydrationMissing = Math.max(0, this.maxHydration - this.hydration);
    const hydrationConf = this.data.character?.hydration || {};
    const restEfficiency = this.getCharacterRestEfficiencyBonus();
    const foodRecovery =
      (this.data.character?.satiety?.foodRecovery || 1.5) + restEfficiency.food;
    const waterRecovery =
      (hydrationConf.waterRecovery || 3) + restEfficiency.water;

    let energyGain = restConf.baseEnergy || 2;
    let satietyGain = restConf.baseSatiety || 0.45;

    if (sourceIds.has("campfire")) {
      energyGain += restConf.campfireEnergyBonus || 0;
      satietyGain += restConf.campfireSatietyBonus || 0;
    }
    if (sourceIds.has("rest_tent")) {
      energyGain += restConf.shelterEnergyBonus || 0;
      satietyGain += restConf.shelterSatietyBonus || 0;
    }
    if (sourceIds.has("storage")) {
      satietyGain += restConf.storageSatietyBonus || 0;
    }

    energyGain += Math.min(2, Math.floor(recoveryRating / 2));
    energyGain += Math.min(1, Math.floor((this.enduranceBonus || 0) / 2));
    satietyGain += Math.min(0.45, recoveryRating * 0.08);

    if (condition.id === "weakened") {
      energyGain += 1;
      satietyGain += 0.15;
    } else if (condition.id === "exhausted") {
      energyGain += 2;
      satietyGain += 0.35;
    }

    const cooldownMs = this.getCharacterRestCooldownMs();
    const remainingMs = this.getCharacterRestCooldownRemaining();
    const energyRecovery = Math.min(
      energyMissing,
      Math.max(0, Math.round(energyGain)),
    );
    const satietyRecovery = Math.min(
      satietyMissing,
      Math.max(0, Number(satietyGain.toFixed(2))),
    );
    const hasFood = (this.resources.food || 0) >= 1;
    const hasWater = (this.resources.water || 0) >= 1;
    const foodBonusSatiety = hasFood
      ? Math.min(Math.max(0, satietyMissing - satietyRecovery), foodRecovery)
      : 0;
    const willUseFood = foodBonusSatiety > 0.05;
    const willUseWater =
      hasWater && (hydrationMissing > 0.05 || energyMissing > energyRecovery);
    const hydrationRecovery = willUseWater
      ? Math.min(hydrationMissing, waterRecovery)
      : 0;
    const waterBonusEnergy = willUseWater
      ? Math.min(
          1 + restEfficiency.energy,
          Math.max(0, energyMissing - energyRecovery),
        )
      : 0;

    let blockedReason = "";
    if (!atCamp) {
      blockedReason =
        "Сначала нужно вернуться к стоянке, чтобы передохнуть и привести добычу.";
    } else if (
      energyRecovery <= 0 &&
      satietyRecovery <= 0.05 &&
      hydrationRecovery <= 0.05 &&
      foodBonusSatiety <= 0.05 &&
      waterBonusEnergy <= 0
    ) {
      blockedReason = "Персонажу пока не нужна передышка.";
    } else if (remainingMs > 0) {
      blockedReason = `Передышка будет доступна снова через ${Math.ceil(remainingMs / 1000)}с.`;
    }

    const label = sourceIds.has("rest_tent")
      ? "Отдохнуть под укрытием"
      : sourceIds.has("campfire")
        ? "Передохнуть у костра"
        : "Короткая передышка";
    const note = sourceIds.has("rest_tent")
      ? "Укрытие и лагерь собирают силы быстрее, чем случайная пауза в поле."
      : sourceIds.has("campfire")
        ? "Огонь помогает перевести дух и не развалить ритм тяжёлой работы."
        : "Без костра отдых даёт лишь короткую передышку и не держит силы долго.";
    const efficiencyNote =
      restEfficiency.food > 0.05 ||
      restEfficiency.water > 0.05 ||
      restEfficiency.energy > 0.05
        ? " Смекалка и привычка к лагерю позволяют экономнее перевести еду и воду в восстановление."
        : "";

    return {
      label,
      note: `${note}${efficiencyNote}`,
      energyGain: energyRecovery,
      satietyGain: satietyRecovery,
      hydrationGain: hydrationRecovery,
      foodBonusSatiety,
      waterBonusEnergy,
      willUseFood,
      willUseWater,
      hasFood,
      hasWater,
      cooldownMs,
      remainingMs,
      blockedReason,
      canRest: !blockedReason,
      recoveryRating,
      restEfficiency,
    };
  }

  _consumeCarriedResource(resourceId, amount = 1) {
    if (!this.localCampMap || !resourceId) return 0;

    const carried = this._sanitizeTripInventory?.(
      this.localCampMap.carriedResources,
    ) || { ...this.localCampMap.carriedResources };
    const available = Number(carried[resourceId]) || 0;
    const removed = Math.min(Math.max(0, amount || 0), available);
    if (removed <= 0) return 0;

    const left = Math.max(0, Number((available - removed).toFixed(2)));
    if (left > 0) {
      carried[resourceId] = left;
    } else {
      delete carried[resourceId];
    }
    this.localCampMap.carriedResources = carried;
    return removed;
  }

  getCharacterManualSupplyProfile(kind) {
    if (kind !== "food" && kind !== "water") return null;

    const isWater = kind === "water";
    const conf = isWater
      ? this.data.character?.hydration || {}
      : this.data.character?.satiety || {};
    const current = isWater ? this.hydration : this.satiety;
    const max = isWater ? this.maxHydration : this.maxSatiety;
    const missing = Math.max(0, max - current);
    const recovery = Number.isFinite(
      isWater ? conf.waterRecovery : conf.foodRecovery,
    )
      ? isWater
        ? conf.waterRecovery
        : conf.foodRecovery
      : isWater
        ? 3
        : 1.5;
    const atCamp = this.isCharacterAtCamp?.() ?? true;
    const campStock = Math.floor(this.resources[kind] || 0);
    const carried = this.getTripInventory?.() || {};
    const carriedStock = Math.floor(carried[kind] || 0);
    const available = atCamp ? campStock : carriedStock;
    const source = atCamp ? "camp" : "carried";
    const sourceLabel = atCamp
      ? this.isCampSetupDone?.()
        ? "со склада"
        : "у стоянки"
      : "из припасов";
    const sourceShortLabel = atCamp
      ? this.isCampSetupDone?.()
        ? "лагерь"
        : "стоянка"
      : "с собой";
    const gain = Math.max(0, Number(Math.min(missing, recovery).toFixed(1)));

    let blockedReason = "";
    let blockedShortLabel = "";
    if (missing <= 0.05) {
      blockedReason = isWater
        ? "Запас воды и так почти полный."
        : "Сытость и так почти полная.";
      blockedShortLabel = isWater ? "полный запас" : "сыт";
    } else if (available < 1) {
      if (!atCamp && campStock > 0) {
        blockedReason = isWater
          ? "Вода есть в лагере, но не взята с собой."
          : "Еда есть в лагере, но не взята с собой.";
        blockedShortLabel = "в лагере";
      } else {
        blockedReason = atCamp
          ? isWater
            ? "На складе нет воды."
            : "На складе нет еды."
          : isWater
            ? "С собой нет воды."
            : "С собой нет еды.";
        blockedShortLabel = isWater ? "нет воды" : "нет еды";
      }
    }

    return {
      kind,
      resourceId: kind,
      isWater,
      icon: isWater ? "💧" : "🍖",
      actionLabel: isWater ? "Выпить" : "Поесть",
      statLabel: isWater ? "воды" : "сытости",
      verb: isWater ? "выпил воды" : "поел",
      source,
      sourceLabel,
      sourceShortLabel,
      current,
      max,
      missing,
      gain,
      campStock,
      carriedStock,
      stock: available,
      blockedReason,
      blockedShortLabel,
      canUse: !blockedReason,
      show: missing > 0.05 || available > 0,
    };
  }

  consumeCharacterSupply(kind) {
    const profile = this.getCharacterManualSupplyProfile(kind);
    if (!profile?.canUse) return false;

    const before = profile.isWater ? this.hydration : this.satiety;
    let consumed = 0;

    if (profile.source === "camp") {
      if ((this.resources[profile.resourceId] || 0) < 1) return false;
      this.resources[profile.resourceId] -= 1;
      consumed = 1;
    } else {
      consumed = this._consumeCarriedResource(profile.resourceId, 1);
    }
    if (consumed < 1) return false;

    if (profile.isWater) {
      this.hydration = this._clampHydration(this.hydration + profile.gain);
    } else {
      this.satiety = this._clampSatiety(this.satiety + profile.gain);
    }

    this._syncCharacterConditionState();

    const recovered =
      (profile.isWater ? this.hydration : this.satiety) - before;
    this.addLog(
      `${profile.icon} Персонаж ${profile.verb} ${profile.sourceLabel}: +${recovered.toFixed(1)} ${profile.statLabel}.`,
    );
    this.markDirty();
    return true;
  }

  restCharacter() {
    const profile = this.getCharacterRestProfile();
    if (!profile.canRest) return false;

    const beforeEnergy = this.energy;
    const beforeSatiety = this.satiety;
    const beforeHydration = this.hydration;

    const foodConsumed = profile.willUseFood && (this.resources.food || 0) >= 1;
    const waterConsumed =
      profile.willUseWater && (this.resources.water || 0) >= 1;
    if (foodConsumed) {
      this.resources.food -= 1;
    }
    if (waterConsumed) {
      this.resources.water -= 1;
    }

    this.energy = Math.min(
      this.maxEnergy,
      this.energy +
        profile.energyGain +
        (waterConsumed ? profile.waterBonusEnergy : 0),
    );
    this.satiety = this._clampSatiety(
      this.satiety +
        profile.satietyGain +
        (foodConsumed ? profile.foodBonusSatiety : 0),
    );
    this.hydration = this._clampHydration(
      this.hydration + (waterConsumed ? profile.hydrationGain : 0),
    );
    this.lastManualRestAt = Date.now();
    this.lastEnergyRegen = Date.now();
    this._syncCharacterConditionState();

    const energyRecovered = this.energy - beforeEnergy;
    const satietyRecovered = this.satiety - beforeSatiety;
    const hydrationRecovered = this.hydration - beforeHydration;
    const bonusParts = [];
    if (foodConsumed) bonusParts.push("еда 🫐 +сытость");
    if (waterConsumed) {
      bonusParts.push(
        profile.hydrationGain > 0 ? "вода 💧 +водный запас" : "вода 💧 +силы",
      );
    }
    const bonusNote = bonusParts.length ? ` (${bonusParts.join(", ")})` : "";
    this.addLog(
      `🛌 ${profile.label}: +${energyRecovered} сил, +${satietyRecovered.toFixed(1)} сытости, +${hydrationRecovered.toFixed(1)} воды${bonusNote}.`,
    );
    this.markDirty();
    return true;
  }

  _getCharacterConditionTransitionEvent(condition) {
    switch (condition?.id) {
      case "stable":
        return {
          icon: "🫁",
          title: "Силы возвращаются",
          text: "Персонаж снова может работать ровно: дыхание выровнялось, путь по лагерю уже не кажется слишком тяжёлым.",
          log: "🫁 Персонаж пришёл в себя и снова работает без явных штрафов.",
        };
      case "weakened":
        return {
          icon: "🥀",
          title: "Силы на исходе",
          text: "Голод, жажда или усталость уже мешают дальним выходам. Теперь каждое тяжёлое действие нужно выбирать осторожнее.",
          log: "🥀 Персонаж ослаблен: голод, жажда или усталость заметно утяжеляют работу.",
        };
      case "exhausted":
        return {
          icon: "🪫",
          title: "Истощение",
          text: "Сейчас безопасны только самые близкие действия у стоянки. Нужны отдых, вода, еда и короткая передышка.",
          log: "🪫 Персонаж истощён: без воды, еды и отдыха далеко от стоянки лучше не уходить.",
        };
      default:
        return null;
    }
  }

  _syncCharacterConditionState({ pushLog = true, pushStory = true } = {}) {
    const condition = this.getCharacterCondition();
    if (!condition?.id) return;

    if (!this.lastCharacterConditionId) {
      this.lastCharacterConditionId = condition.id;
      return;
    }

    if (this.lastCharacterConditionId === condition.id) return;

    this.lastCharacterConditionId = condition.id;
    const event = this._getCharacterConditionTransitionEvent(condition);
    if (!event) return;

    if (pushLog) {
      this.addLog(event.log);
    }
    if (pushStory) {
      this._pushStoryEvent({
        type: "character",
        icon: event.icon,
        title: event.title,
        text: event.text,
        ttlMs: 5000,
      });
    }
    this.markDirty();
  }

  _getOutputCarryLoad(output) {
    return Object.entries(output).reduce(
      (sum, [resourceId, amount]) =>
        sum + this.getResourceCarryWeight(resourceId) * amount,
      0,
    );
  }

  _limitOutputByCarry(output) {
    const capacity = this.getCharacterCarryCapacity();
    const rawLoad = this._getOutputCarryLoad(output);

    if (rawLoad <= capacity) {
      return {
        output,
        rawLoad,
        load: rawLoad,
        limitedByCarry: false,
      };
    }

    const entries = Object.entries(output);
    if (entries.length === 0) {
      return {
        output,
        rawLoad,
        load: 0,
        limitedByCarry: false,
      };
    }

    const limitedOutput = {};
    let changed = false;

    if (entries.length === 1) {
      const [resourceId, amount] = entries[0];
      const weight = Math.max(0.01, this.getResourceCarryWeight(resourceId));
      const cappedAmount = Math.max(1, Math.floor((capacity + 1e-9) / weight));
      limitedOutput[resourceId] = Math.min(amount, cappedAmount);
      changed = limitedOutput[resourceId] < amount;
    } else {
      const ratio = capacity / Math.max(rawLoad, 0.01);
      for (const [resourceId, amount] of entries) {
        const limitedAmount = Math.min(
          amount,
          Math.max(1, Math.floor(amount * ratio)),
        );
        limitedOutput[resourceId] = limitedAmount;
        if (limitedAmount < amount) changed = true;
      }
    }

    const load = this._getOutputCarryLoad(limitedOutput);
    return {
      output: limitedOutput,
      rawLoad,
      load,
      limitedByCarry: changed,
    };
  }

  _limitOutputByTileSupply(output, tile) {
    if (!tile) {
      return {
        output,
        limitedBySupply: false,
      };
    }

    const remaining = this._getCampTileResourceRemaining(tile.id);
    if (!Number.isFinite(remaining)) {
      return {
        output,
        limitedBySupply: false,
      };
    }

    if (tile.resourceType) {
      const currentAmount = output[tile.resourceType] || 0;
      if (currentAmount <= remaining) {
        return {
          output,
          limitedBySupply: false,
        };
      }

      return {
        output: {
          ...output,
          [tile.resourceType]: Math.max(0, remaining),
        },
        limitedBySupply: true,
      };
    }

    const entries = Object.entries(output);
    const totalAmount = entries.reduce((sum, [, amount]) => sum + amount, 0);
    if (totalAmount <= remaining) {
      return {
        output,
        limitedBySupply: false,
      };
    }

    let unitsLeft = Math.max(0, Math.floor(remaining));
    const scaledEntries = entries
      .map(([resourceId, amount]) => {
        const exact = (amount * unitsLeft) / Math.max(totalAmount, 1);
        const limitedAmount = Math.min(amount, Math.floor(exact));
        return {
          resourceId,
          amount,
          limitedAmount,
          fraction: exact - limitedAmount,
        };
      })
      .sort((a, b) => b.fraction - a.fraction);

    unitsLeft -= scaledEntries.reduce(
      (sum, entry) => sum + entry.limitedAmount,
      0,
    );

    for (const entry of scaledEntries) {
      if (unitsLeft <= 0) break;
      if (entry.limitedAmount >= entry.amount) continue;
      entry.limitedAmount += 1;
      unitsLeft -= 1;
    }

    const limitedOutput = {};
    for (const entry of scaledEntries) {
      if (entry.limitedAmount > 0) {
        limitedOutput[entry.resourceId] = entry.limitedAmount;
      }
    }

    return {
      output: limitedOutput,
      limitedBySupply: true,
    };
  }

  _getSatietyRecoveryPerTick() {
    const satietyConf = this.data.character?.satiety || {};
    let recovery = satietyConf.passiveRecoveryPerTick || 0;

    if (this.buildings.campfire) {
      recovery += satietyConf.campfireRecoveryPerTick || 0;
    }
    if (this.buildings.rest_tent) {
      recovery += satietyConf.restTentRecoveryBonusPerTick || 0;
    }
    recovery += this.characterRecoveryBonusPerTick || 0;

    return recovery;
  }

  _getHydrationRecoveryPerTick() {
    const hydrationConf = this.data.character?.hydration || {};
    let recovery = hydrationConf.passiveRecoveryPerTick || 0;

    if (this.buildings.rest_tent) {
      recovery += hydrationConf.restTentRecoveryBonusPerTick || 0;
    }
    if (this.buildings.storage) {
      recovery += hydrationConf.storageRecoveryBonusPerTick || 0;
    }

    return recovery;
  }

  _drainSatiety(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const before = this.satiety;
    this.satiety = this._clampSatiety(this.satiety - amount);
    return before - this.satiety;
  }

  _drainHydration(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const before = this.hydration;
    this.hydration = this._clampHydration(this.hydration - amount);
    return before - this.hydration;
  }

  _getSatietyDrainForGather(profile) {
    const satietyConf = this.data.character?.satiety || {};
    const baseDrain = satietyConf.gatherDrain || 0;
    if (!profile) return baseDrain;
    const needsRelief = Math.max(0, profile.needsRelief || 0);

    return Math.max(
      0.08,
      baseDrain +
        Math.max(0, (profile.routeDistance ?? profile.distance) - 1) * 0.08 +
        Math.max(0, profile.deliveryPenalty || 0) * 0.08 +
        (profile.loadPct >= (profile.heavyThreshold || 0.85) ? 0.08 : 0) -
        (profile.pathLevel && profile.pathLevel !== "none" ? 0.08 : 0) -
        needsRelief,
    );
  }

  _getHydrationDrainForGather(profile) {
    const hydrationConf = this.data.character?.hydration || {};
    const baseDrain = hydrationConf.gatherDrain || 0;
    if (!profile) return baseDrain;
    const needsRelief = Math.max(0, profile.needsRelief || 0);

    return Math.max(
      0.06,
      baseDrain +
        Math.max(0, (profile.routeDistance ?? profile.distance) - 1) * 0.06 +
        Math.max(0, profile.deliveryPenalty || 0) * 0.06 +
        (profile.loadPct >= (profile.heavyThreshold || 0.85) ? 0.05 : 0) -
        (profile.pathLevel && profile.pathLevel !== "none" ? 0.05 : 0) -
        needsRelief * 0.8,
    );
  }

  _getSatietyDrainForBuild(profile = null) {
    const baseDrain = this.data.character?.satiety?.buildDrain || 0;
    if (!profile) return baseDrain;
    const needsRelief = Math.max(0, profile.needsRelief || 0);
    return Math.max(
      0.1,
      baseDrain +
        Math.max(0, (profile.routeDistance ?? profile.distance) - 1) * 0.08 +
        Math.max(0, profile.deliveryPenalty || 0) * 0.08 -
        (profile.pathLevel && profile.pathLevel !== "none" ? 0.08 : 0) -
        needsRelief,
    );
  }

  _getHydrationDrainForBuild(profile = null) {
    const baseDrain = this.data.character?.hydration?.buildDrain || 0;
    if (!profile) return baseDrain;
    const needsRelief = Math.max(0, profile.needsRelief || 0);
    return Math.max(
      0.08,
      baseDrain +
        Math.max(0, (profile.routeDistance ?? profile.distance) - 1) * 0.06 +
        Math.max(0, profile.deliveryPenalty || 0) * 0.06 -
        (profile.pathLevel && profile.pathLevel !== "none" ? 0.05 : 0) -
        needsRelief * 0.8,
    );
  }

  getCurrentEnergyRegenInterval() {
    const condition = this.getCharacterCondition();
    return Math.max(
      1000,
      this.energyRegenInterval + (condition.regenPenaltyMs || 0),
    );
  }

  _getLogisticsEffortLabel(totalPenalty) {
    if (totalPenalty <= 0) return "лёгкий путь";
    if (totalPenalty === 1) return "умеренный путь";
    return "тяжёлый путь";
  }

  _applyFieldcraftRelief(distancePenalty, terrainPenalty) {
    let remainingRelief = Math.max(0, this.getCharacterFieldcraft());
    const distanceRelief = Math.min(distancePenalty, remainingRelief);
    remainingRelief -= distanceRelief;
    const terrainRelief = Math.min(terrainPenalty, remainingRelief);

    return {
      distancePenalty: Math.max(0, distancePenalty - distanceRelief),
      terrainPenalty: Math.max(0, terrainPenalty - terrainRelief),
      fieldcraftRelief: distanceRelief + terrainRelief,
    };
  }

  _calculateGatherDurationMs(action, profile = null) {
    if (!action) return 0;

    const carryCapacity = Math.max(1, Number(profile?.carryCapacity || 1));
    const loadRatio = Math.max(
      0,
      Math.min(2.8, Number(profile?.load || 0) / carryCapacity),
    );
    const trips = Math.max(1, Number(profile?.deliveryTrips || 1));
    const conditionId = profile?.condition?.id || "stable";
    const conditionValue =
      conditionId === "exhausted"
        ? 0.25
        : conditionId === "weakened"
          ? 0.55
          : 1;
    const conditionCoef = 1 + (1 - conditionValue) * 0.58;
    const needsImpactId = profile?.needsImpact?.id || "steady";
    const needsCoef =
      needsImpactId === "critical"
        ? 1.28
        : needsImpactId === "low"
          ? 1.14
          : needsImpactId === "watch"
            ? 1.06
            : 1;
    const gatherCoef =
      1 +
      loadRatio * 0.16 +
      Math.max(0, trips - 1) * 0.08 +
      (profile?.limitedByCarry ? 0.12 : 0);

    return Math.round(
      Math.max(
        520,
        Math.min(
          2600,
          (Math.max(900, Number(action.cooldown || 1200)) * 0.82 + 240) *
            gatherCoef *
            conditionCoef *
            needsCoef *
            0.9,
        ),
      ),
    );
  }

  getGatherDuration(actionId, options = {}) {
    const action = this.data.gatherActions[actionId];
    if (!action) return 0;
    const profile = options.profile || this.getGatherProfile(actionId, options);
    return this._calculateGatherDurationMs(action, profile);
  }

  getGatherProfile(actionId, options = {}) {
    const action = this.data.gatherActions[actionId];
    if (!action) return null;

    const actionOutput = action.output || {};
    const availableResourceIds = Object.keys(actionOutput).filter(
      (resourceId) => Number(actionOutput[resourceId]) > 0,
    );
    const requestedResourceId =
      typeof options.resourceId === "string" ? options.resourceId : "";
    if (
      requestedResourceId &&
      !Object.prototype.hasOwnProperty.call(actionOutput, requestedResourceId)
    ) {
      return null;
    }

    const tile = this._getPreferredCampGatherTile(actionId, options.tileId);
    const distance = tile ? this._getCampTileLiveDist(tile) : 0;
    const zoneLabel =
      distance === 0
        ? "центр"
        : distance === 1
          ? "ближняя зона"
          : "дальний выход";
    const condition = this.getCharacterCondition();
    const carryCapacity = this.getCharacterCarryCapacity();
    const terrain = this._getTerrainEffort(tile);
    const path = tile
      ? this.getCampPathData(tile.id)
      : this.getCampPathData(null);
    const warnings = [];

    const rawOutput = requestedResourceId
      ? { [requestedResourceId]: actionOutput[requestedResourceId] }
      : { ...actionOutput };
    const gatherBonus = this._getGatherBonus();
    const scoutEdgeBonus = tile ? this._getSurroundingsScoutGatherEdgeBonus(tile) : 0;
    const specializationTotals = {
      fieldcraft: 0,
      strength: 0,
      ingenuity: 0,
    };
    const perResourceBonus = {};
    for (const [resourceId, amount] of Object.entries(rawOutput)) {
      const specialization = this._getCharacterGatherSpecialization(
        resourceId,
        tile,
        actionId,
      );
      perResourceBonus[resourceId] = specialization.bonus;
      specializationTotals.fieldcraft += specialization.sources.fieldcraft;
      specializationTotals.strength += specialization.sources.strength;
      specializationTotals.ingenuity += specialization.sources.ingenuity;
      rawOutput[resourceId] = Math.max(
        1,
        amount +
          gatherBonus +
          scoutEdgeBonus +
          specialization.bonus -
          (condition.gatherOutputPenalty || 0),
      );
    }

    const multiTripDelivery = action.deliveryMode === "multi-trip";
    const carryLimited = multiTripDelivery
      ? {
          output: rawOutput,
          rawLoad: this._getOutputCarryLoad(rawOutput),
          load: this._getOutputCarryLoad(rawOutput),
          limitedByCarry: false,
        }
      : this._limitOutputByCarry(rawOutput);
    const supplyLimited = this._limitOutputByTileSupply(
      carryLimited.output,
      tile,
    );
    const output = supplyLimited.output;
    const totalLoad = this._getOutputCarryLoad(output);
    const delivery = this._getDeliveryProfile(totalLoad, carryCapacity);
    const load = delivery.perTripLoad;
    const loadPct = delivery.loadPct;
    const heavyThreshold = delivery.heavyThreshold;
    const loadPenalty = loadPct >= heavyThreshold ? 1 : 0;
    const routeDistance = Math.max(0, distance - (path.routeRelief || 0));
    const rawDistancePenalty = Math.max(0, routeDistance - 1);
    const rawTerrainPenalty = Math.max(
      0,
      (terrain.penalty || 0) - (path.terrainRelief || 0),
    );
    const penaltyAfterFieldcraft = this._applyFieldcraftRelief(
      rawDistancePenalty,
      rawTerrainPenalty,
    );
    const distancePenalty = penaltyAfterFieldcraft.distancePenalty;
    const terrainPenalty = penaltyAfterFieldcraft.terrainPenalty;
    const fieldcraftRelief = penaltyAfterFieldcraft.fieldcraftRelief;
    const mobilityRelief =
      this._getCharacterMobilityEffortRelief(routeDistance);
    const energyCost = Math.max(
      0,
      action.energyCost +
        distancePenalty +
        terrainPenalty +
        delivery.tripPenalty +
        loadPenalty -
        mobilityRelief +
        (condition.gatherCostPenalty || 0),
    );
    const effortProfile = {
      distance,
      routeDistance,
      deliveryPenalty: delivery.tripPenalty,
      loadPct,
      heavyThreshold,
      pathLevel: path.id,
      needsRelief: this.getCharacterNeedsRelief(),
    };
    const satietyCost = this._getSatietyDrainForGather(effortProfile);
    const hydrationCost = this._getHydrationDrainForGather(effortProfile);
    const needsImpact = this._getTripNeedsImpact(satietyCost, hydrationCost);

    let blockedReason = "";
    if (!tile) {
      blockedReason = "Подходящий участок пока не найден или уже истощён.";
    } else if (
      Number.isFinite(condition.maxSafeDistance) &&
      routeDistance > condition.maxSafeDistance
    ) {
      blockedReason =
        condition.id === "exhausted"
          ? "Истощённый персонаж не потянет такой дальний выход."
          : "В таком состоянии дальние выходы уже слишком тяжёлые.";
    }

    if (terrainPenalty > 0) {
      warnings.push(`Местность утяжеляет выход: ${terrain.label}.`);
    }
    if (distancePenalty > 0) {
      warnings.push("Дистанция от стоянки повышает расход сил.");
    }
    if (path.id !== "none") {
      warnings.push(`Тропа облегчает путь: ${path.label}.`);
    }
    if (fieldcraftRelief > 0) {
      warnings.push("Походная сноровка снимает часть тяжести пути.");
    }
    if (specializationTotals.fieldcraft > 0) {
      warnings.push(
        `Сноровка вытягивает ещё +${specializationTotals.fieldcraft} к воде, еде или волокну на этом выходе.`,
      );
    }
    if (specializationTotals.strength > 0) {
      warnings.push(
        `Сила даёт ещё +${specializationTotals.strength} к тяжёлой добыче на участке.`,
      );
    }
    if (specializationTotals.ingenuity > 0) {
      warnings.push(
        `Смекалка помогает разобрать находку и вынести ещё +${specializationTotals.ingenuity} ресурсов.`,
      );
    }
    if (scoutEdgeBonus > 0) {
      warnings.push(
        "Разведка окрестностей навела на этот рубеж: +1 к добыче каждого ресурса.",
      );
    }
    if (loadPenalty > 0) {
      warnings.push("Выход почти упирается в переносимость.");
    }
    if (delivery.requiresMultipleTrips) {
      warnings.push(
        `Доставка до стоянки потребует ${delivery.tripsRequired} ходки.`,
      );
    }
    if (needsImpact.id === "critical" || needsImpact.id === "low") {
      warnings.push(needsImpact.note);
    }
    if (carryLimited.limitedByCarry) {
      warnings.push("Часть добычи теряется из-за ограниченной переносимости.");
    }
    if (supplyLimited.limitedBySupply) {
      warnings.push("Участок почти выработан, поэтому выход уже меньше.");
    }

    return {
      actionId,
      action,
      resourceId: requestedResourceId || null,
      availableResourceIds,
      tile,
      distance,
      zoneLabel,
      output,
      rawOutput,
      load,
      totalLoad,
      rawLoad: carryLimited.rawLoad,
      loadPct,
      carryCapacity,
      deliveryTrips: delivery.tripsRequired,
      deliveryPenalty: delivery.tripPenalty,
      carryState: delivery.carryState,
      needsImpact,
      requiresMultipleTrips: delivery.requiresMultipleTrips,
      pathLevel: path.id,
      pathLabel: path.label,
      pathIcon: path.icon,
      routeDistance,
      energyCost,
      baseEnergyCost: action.energyCost,
      satietyCost,
      hydrationCost,
      distancePenalty,
      terrainPenalty,
      fieldcraftRelief,
      mobilityRelief,
      specializationTotals,
      perResourceBonus,
      loadPenalty,
      heavyThreshold,
      effortLabel: this._getLogisticsEffortLabel(
        Math.max(
          0,
          distancePenalty +
            terrainPenalty +
            loadPenalty +
            delivery.tripPenalty -
            mobilityRelief,
        ),
      ),
      limitedByCarry: carryLimited.limitedByCarry,
      limitedBySupply: supplyLimited.limitedBySupply,
      gatherDurationMs: this._calculateGatherDurationMs(action, {
        load,
        carryCapacity,
        deliveryTrips: delivery.tripsRequired,
        limitedByCarry: carryLimited.limitedByCarry,
        condition,
        needsImpact,
      }),
      blockedReason,
      isAvailable: !blockedReason,
      terrainLabel: terrain.label,
      warnings,
      condition,
      surroundingsScoutGatherBonus: scoutEdgeBonus,
    };
  }

  getBuildProfile(buildingId, preferredTileId = null) {
    const building = this.data.buildings[buildingId];
    if (!building) return null;

    const tileId = this._getPreferredCampBuildTile(
      buildingId,
      preferredTileId || this.getSelectedCampTileId(),
    );
    const tile = tileId ? this._getCampMapTile(tileId) : null;
    const distance = tile ? this._getCampTileLiveDist(tile) : 0;
    const condition = this.getCharacterCondition();
    const zoneLabel =
      distance === 0
        ? "центр"
        : distance === 1
          ? "ближняя зона"
          : "дальний участок";
    const path = tile
      ? this.getCampPathData(tile.id)
      : this.getCampPathData(null);
    const routeDistance = Math.max(0, distance - (path.routeRelief || 0));
    const rawDistancePenalty = Math.max(0, routeDistance - 1);
    const terrain = this._getTerrainEffort(tile);
    const rawTerrainPenalty = Math.max(
      0,
      (terrain.penalty || 0) - (path.terrainRelief || 0),
    );
    const penaltyAfterFieldcraft = this._applyFieldcraftRelief(
      rawDistancePenalty,
      rawTerrainPenalty,
    );
    const distancePenalty = penaltyAfterFieldcraft.distancePenalty;
    const terrainPenalty = penaltyAfterFieldcraft.terrainPenalty;
    const fieldcraftRelief = penaltyAfterFieldcraft.fieldcraftRelief;
    const warnings = [];
    const cost = this.getBuildingCost(buildingId);
    const delivery = this._getDeliveryProfile(
      this._getOutputCarryLoad(cost),
      this.getCharacterCarryCapacity(),
    );
    const mobilityRelief =
      this._getCharacterMobilityEffortRelief(routeDistance);
    const energyCost = Math.max(
      0,
      1 +
        distancePenalty +
        terrainPenalty +
        delivery.tripPenalty -
        mobilityRelief +
        (condition.gatherCostPenalty || 0),
    );
    const effortProfile = {
      distance,
      routeDistance,
      deliveryPenalty: delivery.tripPenalty,
      pathLevel: path.id,
      needsRelief: this.getCharacterNeedsRelief(),
    };
    const satietyCost = this._getSatietyDrainForBuild(effortProfile);
    const hydrationCost = this._getHydrationDrainForBuild(effortProfile);
    const needsImpact = this._getTripNeedsImpact(satietyCost, hydrationCost);
    let blockedReason = "";

    if (
      Number.isFinite(condition.maxSafeDistance) &&
      routeDistance > condition.maxSafeDistance
    ) {
      blockedReason =
        condition.id === "exhausted"
          ? "В таком состоянии персонаж не потянет стройку так далеко от стоянки."
          : "Сначала нужно восстановиться, прежде чем тащить материалы так далеко.";
    }

    if (terrainPenalty > 0) {
      warnings.push(`Место утяжеляет стройку: ${terrain.label}.`);
    }
    if (distancePenalty > 0) {
      warnings.push("Материалы придётся нести заметно дальше от стоянки.");
    }
    if (delivery.requiresMultipleTrips) {
      warnings.push(
        `Поднос материалов займёт ${delivery.tripsRequired} ходки.`,
      );
    }
    if (needsImpact.id === "critical" || needsImpact.id === "low") {
      warnings.push(needsImpact.note);
    }

    if (path.id !== "none") {
      warnings.push(`Тропа облегчает перенос материалов: ${path.label}.`);
    }
    if (fieldcraftRelief > 0) {
      warnings.push(
        "Походная сноровка помогает нести материалы по этому пути.",
      );
    }

    return {
      buildingId,
      tileId,
      tile,
      distance,
      zoneLabel,
      totalLoad: delivery.totalLoad,
      load: delivery.perTripLoad,
      carryCapacity: delivery.carryCapacity,
      deliveryTrips: delivery.tripsRequired,
      deliveryPenalty: delivery.tripPenalty,
      carryState: delivery.carryState,
      needsImpact,
      requiresMultipleTrips: delivery.requiresMultipleTrips,
      pathLevel: path.id,
      pathLabel: path.label,
      pathIcon: path.icon,
      routeDistance,
      energyCost,
      satietyCost,
      hydrationCost,
      terrainLabel: terrain.label,
      terrainPenalty,
      fieldcraftRelief,
      mobilityRelief,
      effortLabel: this._getLogisticsEffortLabel(
        Math.max(
          0,
          distancePenalty +
            terrainPenalty +
            delivery.tripPenalty -
            mobilityRelief,
        ),
      ),
      blockedReason,
      warnings,
      condition,
    };
  }

  getCharacterState() {
    const selectedTileId = this.getSelectedCampTileId();
    const selectedTile = this._getCampMapTile(selectedTileId);
    let tripProfile = null;
    let tripType = "";

    if (selectedTile?.actionId) {
      tripProfile = this.getGatherProfile(selectedTile.actionId, {
        tileId: selectedTileId,
      });
      tripType = "gather";
    } else if (Array.isArray(selectedTile?.buildOptions)) {
      const buildId = selectedTile.buildOptions.find(
        (id) =>
          !this.buildings[id] &&
          this._getPreferredCampBuildTile(id, selectedTileId) ===
            selectedTileId,
      );
      if (buildId) {
        tripProfile = this.getBuildProfile(buildId, selectedTileId);
        tripType = "build";
      }
    } else if (
      selectedTileId &&
      selectedTile &&
      this._getCampTileLiveDist(selectedTile) > 0
    ) {
      const pathProject = this.getCampPathProject(selectedTileId);
      if (pathProject) {
        tripProfile = pathProject;
        tripType = "trail";
      }
    }

    const condition = this.getCharacterCondition();
    const regenIntervalMs = this.getCurrentEnergyRegenInterval();
    const recovery = this.getCharacterRecoveryState();
    const restProfile = this.getCharacterRestProfile();
    const endurance = this.getCharacterEndurance();
    const fieldcraft = this.getCharacterFieldcraft();
    const strength = this.getCharacterStrength();
    const mobility = this.getCharacterMobility();
    const ingenuity = this.getCharacterIngenuity();
    const recoveryRating = this.getCharacterRecoveryRating();
    const restrictionText = Number.isFinite(condition.maxSafeDistance)
      ? condition.maxSafeDistance >= 99
        ? "Доступны любые выходы в пределах открытой карты."
        : condition.maxSafeDistance <= 1
          ? "Сейчас безопасны только ближние клетки у стоянки."
          : `Сейчас безопасны выходы до дистанции ${condition.maxSafeDistance}.`
      : "";
    const carryCapacity = this.getCharacterCarryCapacity();
    const carriedResources = this.getTripInventory?.() || {};
    const carriedLoad = this._getOutputCarryLoad(carriedResources);
    const characterTileId = this.getCharacterTileId?.() || null;
    const homeTileId = this._getCampHomeTileId?.() || null;
    const characterTile = characterTileId
      ? this._getCampMapTile(characterTileId)
      : null;
    const atCamp = this.isCharacterAtCamp?.() ?? true;

    return {
      title: this.characterTitle,
      role: this.characterRole,
      energy: {
        current: this.energy,
        max: this.maxEnergy,
        pct: this.maxEnergy > 0 ? this.energy / this.maxEnergy : 0,
      },
      satiety: {
        current: this.satiety,
        max: this.maxSatiety,
        baseMax: this.baseSatietyMax,
        maxBonus: this.satietyMaxBonus || 0,
        pct: this.maxSatiety > 0 ? this.satiety / this.maxSatiety : 0,
        recoveryPerTick: this._getSatietyRecoveryPerTick(),
      },
      hydration: {
        current: this.hydration,
        max: this.maxHydration,
        baseMax: this.baseHydrationMax,
        maxBonus: this.hydrationMaxBonus || 0,
        pct: this.maxHydration > 0 ? this.hydration / this.maxHydration : 0,
        recoveryPerTick: this._getHydrationRecoveryPerTick(),
      },
      carry: {
        capacity: carryCapacity,
        baseCapacity: this.baseCarryCapacity,
        capacityBonus: this.carryCapacityBonus || 0,
        strengthCapacityBonus: this.getCharacterStrengthCapacityBonus(),
        heavyThreshold: this.getCharacterHeavyLoadThreshold(),
        carriedResources,
        carriedUnits: Object.values(carriedResources).reduce(
          (sum, amount) => sum + (Number(amount) || 0),
          0,
        ),
        carriedLoad,
        availableCapacity: Math.max(
          0,
          Number((carryCapacity - carriedLoad).toFixed(2)),
        ),
        carriedLoadState: this._getCarryLoadState(
          carriedLoad,
          carryCapacity,
          this.getCharacterHeavyLoadThreshold(),
        ),
      },
      condition,
      regen: {
        perTick: this.energyRegenPerTick,
        remainingMs: this.getEnergyRegenRemaining(),
        intervalMs: regenIntervalMs,
      },
      stats: {
        endurance,
        enduranceBonus: this.enduranceBonus || 0,
        fieldcraft,
        strength,
        strengthBonus: this.strengthBonus || 0,
        mobility,
        mobilityBonus: this.mobilityBonus || 0,
        ingenuity,
        ingenuityBonus: this.ingenuityBonus || 0,
        recoveryRating,
        safeDistance: condition.maxSafeDistance,
        needsRelief: this.getCharacterNeedsRelief(),
        travelSpeedMultiplier: this.getCharacterTravelSpeedMultiplier(),
        ingenuityTimeMultiplier: this.getCharacterIngenuityTimeMultiplier(),
        foragingYieldBonus: this.getCharacterForagingYieldBonus(),
        extractionYieldBonus: this.getCharacterExtractionYieldBonus(),
        supplySalvageBonus: this.getCharacterSupplySalvageBonus(),
        surveyRevealBonus: this.getCharacterSurveyRevealBonus(),
        restEfficiency: this.getCharacterRestEfficiencyBonus(),
      },
      recovery,
      restProfile,
      restrictionText,
      location: {
        tileId: characterTileId,
        homeTileId,
        atCamp,
        tileName: characterTile?.name || "Стоянка",
        state: characterTileId
          ? this.getCampTileState(characterTileId)
          : "camp",
      },
      tripProfile,
      tripType,
      knowledge: {
        insightsUnlocked: this.getUnlockedInsightsCount(),
        techResearched: Object.keys(this.researched).length,
      },
      autoConsume: this.getAutoConsumeStatus(),
    };
  }

  regenEnergy() {
    const now = Date.now();
    const currentInterval = this.getCurrentEnergyRegenInterval();
    if (now - this.lastEnergyRegen < currentInterval) return;

    const before = this.energy;
    const satietyBefore = this.satiety;
    const hydrationBefore = this.hydration;
    this.energy = Math.min(
      this.energy + this.energyRegenPerTick,
      this.maxEnergy,
    );
    this.satiety = this._clampSatiety(
      this.satiety + this._getSatietyRecoveryPerTick(),
    );
    this.hydration = this._clampHydration(
      this.hydration + this._getHydrationRecoveryPerTick(),
    );

    // Пассивный расход в лагере + авто-потребление со склада.
    const autoResult = this._applyCampPassiveAndAutoConsume();

    this.lastEnergyRegen = now;
    this._syncCharacterConditionState();

    if (this.energy !== before && !this.isPrologueActive()) {
      this.addLog(`⚡ +${this.energy - before} энергии`);
      this.markDirty();
    } else if (
      this.energy !== before ||
      this.satiety !== satietyBefore ||
      this.hydration !== hydrationBefore ||
      autoResult.consumed ||
      autoResult.shortageLogged
    ) {
      this.markDirty();
    }
  }

  _getAutoConsumeConfig() {
    const satietyConf = this.data.character?.satiety || {};
    const hydrationConf = this.data.character?.hydration || {};

    // Укрытие/костёр снижают пассивный расход.
    let satDrainMult = 1;
    let hydDrainMult = 1;
    if (this.buildings.rest_tent) {
      satDrainMult *= Number.isFinite(satietyConf.shelterDrainMultiplier)
        ? satietyConf.shelterDrainMultiplier
        : 1;
      hydDrainMult *= Number.isFinite(hydrationConf.shelterDrainMultiplier)
        ? hydrationConf.shelterDrainMultiplier
        : 1;
    }
    if (this.buildings.campfire) {
      satDrainMult *= Number.isFinite(satietyConf.campfireDrainMultiplier)
        ? satietyConf.campfireDrainMultiplier
        : 1;
    }

    const satietyBaseDrain = Number.isFinite(satietyConf.passiveDrainPerTick)
      ? satietyConf.passiveDrainPerTick
      : 0;
    const hydrationBaseDrain = Number.isFinite(
      hydrationConf.passiveDrainPerTick,
    )
      ? hydrationConf.passiveDrainPerTick
      : 0;

    return {
      satietyThreshold: Number.isFinite(satietyConf.autoConsumeThreshold)
        ? satietyConf.autoConsumeThreshold
        : 0.7,
      satietyStopThreshold: Number.isFinite(
        satietyConf.autoConsumeStopThreshold,
      )
        ? satietyConf.autoConsumeStopThreshold
        : 0.95,
      foodRecovery: Number.isFinite(satietyConf.foodRecovery)
        ? satietyConf.foodRecovery
        : 1.5,
      satietyPassiveDrain: satietyBaseDrain * satDrainMult,
      hydrationThreshold: Number.isFinite(hydrationConf.autoConsumeThreshold)
        ? hydrationConf.autoConsumeThreshold
        : 0.75,
      hydrationStopThreshold: Number.isFinite(
        hydrationConf.autoConsumeStopThreshold,
      )
        ? hydrationConf.autoConsumeStopThreshold
        : 0.95,
      waterRecovery: Number.isFinite(hydrationConf.waterRecovery)
        ? hydrationConf.waterRecovery
        : 3,
      hydrationPassiveDrain: hydrationBaseDrain * hydDrainMult,
      satDrainMult,
      hydDrainMult,
    };
  }

  getAutoConsumeStatus() {
    const conf = this._getAutoConsumeConfig();
    const foodStock = Math.floor(this.resources.food || 0);
    const waterStock = Math.floor(this.resources.water || 0);
    const intervalMs = this.getCurrentEnergyRegenInterval() || 3000;
    const ticksPerMin = 60000 / intervalMs;
    return {
      food: {
        enabled: this.autoConsumeFoodEnabled !== false,
        stock: foodStock,
        threshold: conf.satietyThreshold,
        recovery: conf.foodRecovery,
        ok: this.autoConsumeFoodEnabled !== false && foodStock >= 1,
      },
      water: {
        enabled: this.autoConsumeWaterEnabled !== false,
        stock: waterStock,
        threshold: conf.hydrationThreshold,
        recovery: conf.waterRecovery,
        ok: this.autoConsumeWaterEnabled !== false && waterStock >= 1,
      },
      drain: {
        satietyPerMin: conf.satietyPassiveDrain * ticksPerMin,
        hydrationPerMin: conf.hydrationPassiveDrain * ticksPerMin,
        satietyMult: conf.satDrainMult,
        hydrationMult: conf.hydDrainMult,
      },
      shelter: {
        hasShelter: !!this.buildings.rest_tent,
        hasCampfire: !!this.buildings.campfire,
      },
    };
  }

  setAutoConsumeEnabled(kind, enabled) {
    const value = !!enabled;
    let changed = false;
    if (kind === "food" && this.autoConsumeFoodEnabled !== value) {
      this.autoConsumeFoodEnabled = value;
      this.addLog(
        value
          ? "🍽 Автопотребление еды включено— лагерь снова кормит персонажа."
          : "🍽 Автопотребление еды отключено — сытость перестала восполняться автоматически.",
      );
      changed = true;
    } else if (kind === "water" && this.autoConsumeWaterEnabled !== value) {
      this.autoConsumeWaterEnabled = value;
      this.addLog(
        value
          ? "💧 Автопотребление воды включено — лагерь снова поит персонажа."
          : "💧 Автопотребление воды отключено — вода перестала восполняться автоматически.",
      );
      changed = true;
    }
    if (changed) {
      this.markDirty();
    }
    return changed;
  }

  _applyCampPassiveAndAutoConsume() {
    // Во время пролога поведение персонажа упрощено — не добавляем
    // пассивный расход и автопотребление, чтобы не ломать туториальный темп.
    if (this.isPrologueActive && this.isPrologueActive()) {
      return { consumed: false, shortageLogged: false };
    }
    const conf = this._getAutoConsumeConfig();

    // 1. Пассивный расход.
    if (conf.satietyPassiveDrain > 0) {
      this.satiety = this._clampSatiety(
        this.satiety - conf.satietyPassiveDrain,
      );
    }
    if (conf.hydrationPassiveDrain > 0) {
      this.hydration = this._clampHydration(
        this.hydration - conf.hydrationPassiveDrain,
      );
    }

    let consumed = false;
    let shortageLogged = false;

    // 2. Автопотребление еды. Гистерезис: если начали есть из-за
    // порога «threshold», продолжаем пока не достигнем stopThreshold,
    // но не более чем на 1 порцию за тик (чтобы не съесть весь склад).
    if (this.autoConsumeFoodEnabled !== false) {
      const satPct = this.maxSatiety > 0 ? this.satiety / this.maxSatiety : 1;
      if (satPct < conf.satietyThreshold) {
        if ((this.resources.food || 0) >= 1) {
          // Гистерезис: едим до stopThreshold, но не более 3 порций за тик.
          let portions = 0;
          while (
            portions < 3 &&
            (this.resources.food || 0) >= 1 &&
            (this.maxSatiety > 0 ? this.satiety / this.maxSatiety : 1) <
              conf.satietyStopThreshold
          ) {
            this.resources.food -= 1;
            this.satiety = this._clampSatiety(this.satiety + conf.foodRecovery);
            portions++;
          }
          if (portions > 0) {
            consumed = true;
            if (
              !this._lastAutoFoodLogAt ||
              Date.now() - this._lastAutoFoodLogAt > 30000
            ) {
              this.addLog(
                `🫐 Перекус из склада${portions > 1 ? ` (×${portions})` : ""}: +${(conf.foodRecovery * portions).toFixed(1)} сытости`,
              );
              this._lastAutoFoodLogAt = Date.now();
            }
          }
        } else if (satPct < conf.satietyThreshold - 0.15) {
          if (
            !this._lastFoodShortageAt ||
            Date.now() - this._lastFoodShortageAt > 60000
          ) {
            this.addLog("🍖 Запасов еды нет — сытость не восполняется.");
            this._lastFoodShortageAt = Date.now();
            shortageLogged = true;
          }
        }
      }
    }

    // 3. Автопотребление воды. Аналогичный гистерезис.
    if (this.autoConsumeWaterEnabled !== false) {
      const hydPct =
        this.maxHydration > 0 ? this.hydration / this.maxHydration : 1;
      if (hydPct < conf.hydrationThreshold) {
        if ((this.resources.water || 0) >= 1) {
          let portions = 0;
          while (
            portions < 3 &&
            (this.resources.water || 0) >= 1 &&
            (this.maxHydration > 0 ? this.hydration / this.maxHydration : 1) <
              conf.hydrationStopThreshold
          ) {
            this.resources.water -= 1;
            this.hydration = this._clampHydration(
              this.hydration + conf.waterRecovery,
            );
            portions++;
          }
          if (portions > 0) {
            consumed = true;
            if (
              !this._lastAutoWaterLogAt ||
              Date.now() - this._lastAutoWaterLogAt > 30000
            ) {
              this.addLog(
                `💧 Глоток из запасов${portions > 1 ? ` (×${portions})` : ""}: +${(conf.waterRecovery * portions).toFixed(1)} воды`,
              );
              this._lastAutoWaterLogAt = Date.now();
            }
          }
        } else if (hydPct < conf.hydrationThreshold - 0.15) {
          if (
            !this._lastWaterShortageAt ||
            Date.now() - this._lastWaterShortageAt > 60000
          ) {
            this.addLog(
              "💧 Запасов воды нет — персонаж начинает мучиться от жажды.",
            );
            this._lastWaterShortageAt = Date.now();
            shortageLogged = true;
          }
        }
      }
    }

    return { consumed, shortageLogged };
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

    for (const upgradeId of this.localCampMap?.appliedUpgrades || []) {
      const energyEffect =
        this.data.buildingUpgrades?.[upgradeId]?.effect?.energy;
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
      regenIntervalMs: this.getCurrentEnergyRegenInterval(),
    };
  }

  getEnergyRegenRemaining() {
    const elapsed = Date.now() - this.lastEnergyRegen;
    return Math.max(0, this.getCurrentEnergyRegenInterval() - elapsed);
  }

  canGather(actionId, options = {}) {
    const action = this.data.gatherActions[actionId];
    if (!action) return false;
    if (!this.isGatherActionPresentationUnlocked(actionId)) return false;
    if (this.isPrologueActive()) {
      const allowedIds = this.data.prologue?.gatherActionIds || [];
      if (!allowedIds.includes(actionId) || action.hiddenInPrologue)
        return false;
    }
    if (action.unlockedBy && !this.researched[action.unlockedBy]) return false;
    if (this.getCooldownRemaining(actionId, options) > 0) return false;
    const profile = this.getGatherProfile(actionId, options);
    if (!profile) return false;
    const mappedTiles = this._getMappedCampTilesForAction(actionId);
    if (mappedTiles.length > 0 && !profile.tile) return false;
    if (profile.blockedReason) return false;
    if (
      Object.values(profile.output).reduce((sum, amount) => sum + amount, 0) <=
      0
    ) {
      return false;
    }
    if (!this.hasEnergy(profile.energyCost)) return false;
    return true;
  }

  gather(actionId, options = {}) {
    const profile = this.getGatherProfile(actionId, options);
    const mappedTile =
      profile?.tile ||
      this._getPreferredCampGatherTile(actionId, options.tileId);
    if (!this.canGather(actionId, options)) return false;

    const action = this.data.gatherActions[actionId];
    if (!this.spendEnergy(profile.energyCost)) return false;
    this._drainSatiety(this._getSatietyDrainForGather(profile));
    this._drainHydration(this._getHydrationDrainForGather(profile));
    this._syncCharacterConditionState();

    const output = profile.output;
    if (mappedTile && typeof this.arriveCharacterAtTile === "function") {
      this.arriveCharacterAtTile(mappedTile.id);
    }
    const storeInCarriedResources =
      !!mappedTile &&
      typeof this._shouldStoreGatherInCarriedResources === "function" &&
      this._shouldStoreGatherInCarriedResources(mappedTile) &&
      typeof this._addCarriedResource === "function";
    for (const [id, amount] of Object.entries(output)) {
      if (storeInCarriedResources) {
        this._addCarriedResource(id, amount, {
          tile: mappedTile,
          actionId,
        });
      } else {
        this.addResource(id, amount);
      }
    }
    if (mappedTile) {
      if (
        Number.isFinite(this.localCampMap.tileResourceRemaining[mappedTile.id])
      ) {
        const before = this.localCampMap.tileResourceRemaining[mappedTile.id];
        const gatheredAmount = mappedTile.resourceType
          ? output[mappedTile.resourceType] || 0
          : Object.values(output).reduce((sum, amount) => sum + amount, 0);
        this.localCampMap.tileResourceRemaining[mappedTile.id] = Math.max(
          0,
          before - gatheredAmount,
        );
        if (
          before > 0 &&
          this.localCampMap.tileResourceRemaining[mappedTile.id] === 0
        ) {
          this.addLog(`🗺️ Участок "${mappedTile.name}" истощён.`);
        }
      }
    }

    this.cooldowns[this._getGatherCooldownKey(actionId, options)] =
      Date.now() + action.cooldown;
    if (this.isPrologueActive()) {
      this.addLog(this._getPrologueGatherLog(actionId, output));
    } else {
      this.addLog(
        `+${Object.entries(output)
          .map(([id, amount]) => {
            const resource = this.data.resources[id];
            return `${resource?.icon || id}${amount}`;
          })
          .join(" ")} (⚡-${profile.energyCost})`,
      );
    }

    this._checkPrologueInsights();
    this._checkOnboarding();
    this._checkGoals();
    this._syncLocalCampMap({ pushStory: true });
    this.markDirty();
    return true;
  }

  _getGatherCooldownKey(actionId, options = {}) {
    const tileId = typeof options.tileId === "string" ? options.tileId : "";
    return tileId ? `${actionId}@${tileId}` : actionId;
  }

  _shouldBypassGatherCooldown(options = {}) {
    const tileId = typeof options.tileId === "string" ? options.tileId : "";
    return (
      !!tileId &&
      typeof this.getCharacterTileId === "function" &&
      this.getCharacterTileId() === tileId
    );
  }

  getCooldownRemaining(actionId, options = {}) {
    if (this._shouldBypassGatherCooldown(options)) return 0;
    const now = Date.now();
    const keys = [this._getGatherCooldownKey(actionId, options)];
    if (keys[0] !== actionId) keys.push(actionId);
    return keys.reduce((remaining, key) => {
      const endsAt = this.cooldowns[key];
      return Math.max(remaining, endsAt ? endsAt - now : 0);
    }, 0);
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
    return this.getGatherProfile(actionId)?.output || {};
  }

  canCraft(recipeId) {
    const recipe = this.data.recipes[recipeId];
    if (!recipe) return false;
    if (!this.isRecipePresentationUnlocked(recipeId)) return false;
    if (this.isEarlyProgressionMode()) {
      const allowedIds = this.data.prologue?.recipeIds || [];
      if (!allowedIds.includes(recipeId) || recipe.hiddenInPrologue)
        return false;
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

  getCraftDuration(recipeId) {
    const recipe = this.data.recipes[recipeId];
    const baseDuration = Number.isFinite(recipe?.craftTimeMs)
      ? recipe.craftTimeMs
      : 3000;
    return Math.max(
      500,
      Math.round(baseDuration * this.getCharacterIngenuityTimeMultiplier()),
    );
  }

  queueCraft(recipeId) {
    if (!this.canQueueCraft(recipeId)) return false;

    const recipe = this.data.recipes[recipeId];
    const cost = this.getRecipeCost(recipeId);
    if (!this.spendResources(cost)) return false;

    this.craftQueue.push({
      recipeId,
      durationMs: this.getCraftDuration(recipeId),
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

    const elapsed = Math.max(0, Date.now() - this.activeConstruction.startedAt);
    const remainingMs = Math.max(
      0,
      this.activeConstruction.durationMs - elapsed,
    );

    // Upgrade-in-progress branch: report the upgrade's name/icon while still
    // anchoring the construction to the target building (so existing tile
    // ↔ construction plumbing keeps working).
    if (this.activeConstruction.upgradeId) {
      const upgrade =
        this.data.buildingUpgrades?.[this.activeConstruction.upgradeId];
      if (!upgrade) return null;
      return {
        buildingId: this.activeConstruction.buildingId,
        upgradeId: this.activeConstruction.upgradeId,
        tileId: this.activeConstruction.tileId || null,
        name: upgrade.name,
        icon: upgrade.icon || "⬆️",
        description: upgrade.description,
        durationMs: this.activeConstruction.durationMs,
        remainingMs,
        progress:
          this.activeConstruction.durationMs > 0
            ? Math.min(1, elapsed / this.activeConstruction.durationMs)
            : 1,
        isUpgrade: true,
      };
    }

    const building = this.data.buildings[this.activeConstruction.buildingId];
    if (!building) return null;

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
    if (!this.isBuildingPresentationUnlocked(buildingId)) return false;
    if (this.activeConstruction) return false;
    if (this.isEarlyProgressionMode()) {
      const allowedIds = this.getVisibleBuildingIds();
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
    const hasMappedSite = this._getCampMapTileList().some(
      (tile) =>
        Array.isArray(tile.buildOptions) &&
        tile.buildOptions.includes(buildingId),
    );
    if (
      hasMappedSite &&
      !this._getPreferredCampBuildTile(buildingId, this.getSelectedCampTileId())
    ) {
      return false;
    }
    const buildProfile = this.getBuildProfile(buildingId);
    if (!buildProfile) return false;
    if (buildProfile.blockedReason) return false;
    if (!this.hasEnergy(buildProfile.energyCost)) return false;
    return this.hasResources(this.getBuildingCost(buildingId));
  }

  canBuildOnTile(buildingId, tileId) {
    const building = this.data.buildings[buildingId];
    if (!building || !tileId) return false;
    if (!this.isBuildingPresentationUnlocked(buildingId)) return false;
    if (this.activeConstruction) return false;
    if (this.isEarlyProgressionMode()) {
      const allowedIds = this.getVisibleBuildingIds();
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
    if (!this._canBuildOnTile(buildingId, tileId)) return false;
    if (this._getPreferredCampBuildTile(buildingId, tileId) !== tileId)
      return false;

    const buildProfile = this.getBuildProfile(buildingId, tileId);
    if (!buildProfile || buildProfile.tileId !== tileId) return false;
    if (buildProfile.blockedReason) return false;
    if (!this.hasEnergy(buildProfile.energyCost)) return false;
    return this.hasResources(this.getBuildingCost(buildingId));
  }

  build(buildingId) {
    if (!this.canBuild(buildingId)) return false;

    const building = this.data.buildings[buildingId];
    const cost = this.getBuildingCost(buildingId);
    if (!this.spendResources(cost)) return false;
    const buildProfile = this.getBuildProfile(buildingId);
    const tileId =
      buildProfile?.tileId ||
      this._getPreferredCampBuildTile(buildingId, this.getSelectedCampTileId());
    if (!this.spendEnergy(buildProfile.energyCost)) return false;

    const durationMs = this.getBuildDuration(buildingId);
    this._drainSatiety(this._getSatietyDrainForBuild(buildProfile));
    this._drainHydration(this._getHydrationDrainForBuild(buildProfile));
    this._syncCharacterConditionState();
    this.activeConstruction = {
      buildingId,
      tileId,
      durationMs,
      startedAt: Date.now(),
    };

    this.addLog(
      this.isPrologueActive()
        ? this._getPrologueBuildStartLog(buildingId) ||
            `🏗️ Начато строительство: ${building.icon} ${building.name} (${Math.ceil(durationMs / 1000)}с, ⚡-${buildProfile.energyCost})`
        : `🏗️ Начато строительство: ${building.icon} ${building.name} (${Math.ceil(durationMs / 1000)}с, ⚡-${buildProfile.energyCost})`,
    );
    if (tileId) {
      this.localCampMap.buildingPlacements[buildingId] = tileId;
      this._markCampTileDeveloped(tileId);
    }
    this.markDirty();
    this.saveGame(true);
    return true;
  }

  tickConstruction() {
    const current = this.getConstructionState();
    if (!current || current.remainingMs > 0) return;

    // Upgrade completion: apply upgrade and clear the construction slot.
    // Don't touch this.buildings — the target building already exists.
    if (current.isUpgrade && current.upgradeId) {
      const upgradeId = current.upgradeId;
      this.activeConstruction = null;
      this._finalizeUpgrade(upgradeId);
      this._checkPrologueInsights?.();
      this._checkOnboarding?.();
      this._checkGoals?.();
      this._syncLocalCampMap?.({ pushStory: true });
      this.markDirty();
      this.saveGame(true);
      return;
    }

    const building = this.data.buildings[current.buildingId];
    this.activeConstruction = null;
    this.buildings[current.buildingId] = {
      count: 1,
      isAutomationRunning: true,
    };
    if (current.tileId) {
      this.localCampMap.buildingPlacements[current.buildingId] = current.tileId;
      this._setCampTileState(current.tileId, "developed");
    }
    if (building.effect?.automation) {
      this.automation[building.effect.automation.id] = {
        lastRun: 0,
        state: AUTO_STATE.WAITING,
      };
    }

    this._recalculateDerivedState();
    if (current.buildingId === "rest_tent" && this.isPrologueActive()) {
      this._pushStoryEvent({
        type: "prologue",
        icon: "⛺",
        title: "Появилось первое жильё",
        text: "Палатка уже держит ветер и сырость. Стоянка стала местом, где можно не просто дожидаться утра, а оставаться дольше одного случайного вечера.",
        ttlMs: 8000,
      });
    }
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
    if (building.effect?.maxResourceCap) {
      this.addLog(
        `📦 Лимит ресурсов увеличен до ${building.effect.maxResourceCap}`,
      );
    }
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
      (this.getEffectiveAutomationInterval(auto) -
        (Date.now() - entry.lastRun)) /
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

    if (step.id === "prologue_first_fire" && !this.onboarding.handoff) {
      this.onboarding.handoff = true;
      this._pushStoryEvent({
        type: "transition",
        icon: "📦",
        title: "Теперь можно держать темп",
        text: "Костёр стал опорой. Дальше важно не просто найти — важно уметь хранить, перерабатывать и связывать участки тропой.",
        ttlMs: 8500,
      });
      this._syncLocalCampMap({ pushStory: false });
      this.markDirty();
      this.saveGame(true);
    }

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
      missingBuildingIds: requiredBuildingIds.filter(
        (id) => !this.buildings[id],
      ),
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
        const completed = techs.filter(
          (tech) => this.researched[tech.id],
        ).length;

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
      transitionText: this.isEarlyProgressionMode()
        ? eraData?.prologueResearchTransitionText ||
          eraData?.researchTransitionText ||
          ""
        : eraData?.researchTransitionText || "",
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
    const baseDuration = Number.isFinite(tech?.researchTimeMs)
      ? tech.researchTimeMs
      : 10000;
    return Math.max(
      1000,
      Math.round(baseDuration * this.getCharacterIngenuityTimeMultiplier()),
    );
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
    this.addLog(
      `↩️ Убрано из очереди: ${tech?.icon || ""} ${tech?.name || queued.techId}`,
    );
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
    this.addLog(
      `❌ Исследование отменено: ${tech?.icon || ""} ${tech?.name || ""} (возвращено 50% ресурсов)`,
    );
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
      this.activeResearch = {
        techId: next.techId,
        durationMs,
        startedAt: Date.now(),
      };
      const nextTech = this.data.tech[next.techId];
      if (nextTech) {
        this.addLog(
          `🔬 Начато (из очереди): ${nextTech.icon} ${nextTech.name} (${Math.ceil(durationMs / 1000)}с)`,
        );
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
