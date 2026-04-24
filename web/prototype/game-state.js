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

    const dayCycleConf = this.getDayCycleConfig();
    const startingPhase =
      dayCycleConf.phases.find((phase) => phase.id === dayCycleConf.startingPhase) ||
      dayCycleConf.phases[0];
    this.dayNumber = dayCycleConf.startingDay;
    this.dayPhase = startingPhase.id;
    this.actionsLeftInPhase = startingPhase.actionBudget;
    this.lastNightResult = null;
    this.dayHistory = [];

    this.automation = {};
    this.craftQueue = [];
    this.maxCraftQueueSize = 3;
    this.activeConstruction = null;
    this.activeResearch = null;
    this.researchQueue = []; // max 1 queued item

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
    this._syncCharacterConditionState({ pushLog: false, pushStory: false });

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

  _getCampMapRevision() {
    return 4;
  }

  _getCampMapRadius() {
    return 4;
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

  canFoundCamp() {
    const cost = this.getCampFoundingCost();
    const energyCost = this.getCampFoundingEnergyCost();
    const missingResources = {};
    let lacksResources = false;
    for (const [resId, amount] of Object.entries(cost)) {
      const have = this.resources[resId] || 0;
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
    this.localCampMap.campSettings.name = sanitized;
    this.saveGame(true);
  }

  setCharacterTitle(name) {
    const sanitized =
      typeof name === "string"
        ? name.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 32)
        : "";
    if (!sanitized || sanitized === this.characterTitle) return;
    this.characterTitle = sanitized;
    this.saveGame(true);
  }

  // ─── Building upgrades ───────────────────────────────────────────────────

  getDayCycleConfig() {
    const fallbackPhases = [
      {
        id: "morning",
        label: "Утро",
        icon: "🌤️",
        actionBudget: 3,
        description: "Начало дня.",
      },
      {
        id: "day",
        label: "День",
        icon: "☀️",
        actionBudget: 4,
        description: "Основное рабочее время.",
      },
      {
        id: "evening",
        label: "Вечер",
        icon: "🌙",
        actionBudget: 2,
        description: "Последние дела перед ночью.",
      },
      {
        id: "night",
        label: "Ночь",
        icon: "🌑",
        actionBudget: 0,
        description: "Лагерь переживает ночь.",
      },
    ];
    const raw = this.data?.dayCycle || {};
    const phases =
      Array.isArray(raw.phases) && raw.phases.length > 0
        ? raw.phases
        : fallbackPhases;
    const normalizedPhases = phases.map((phase, index) => ({
      id:
        typeof phase.id === "string" && phase.id
          ? phase.id
          : `phase_${index}`,
      label: phase.label || phase.id || `Фаза ${index + 1}`,
      icon: phase.icon || "🕒",
      actionBudget: Number.isFinite(phase.actionBudget)
        ? Math.max(0, Math.floor(phase.actionBudget))
        : 0,
      description: phase.description || "",
    }));
    if (!normalizedPhases.some((phase) => phase.id === "night")) {
      normalizedPhases.push(fallbackPhases[3]);
    }
    const firstPhase = normalizedPhases[0];
    return {
      startingDay: Number.isFinite(raw.startingDay)
        ? Math.max(1, Math.floor(raw.startingDay))
        : 1,
      startingPhase:
        typeof raw.startingPhase === "string" &&
        normalizedPhases.some((phase) => phase.id === raw.startingPhase)
          ? raw.startingPhase
          : firstPhase.id,
      phases: normalizedPhases,
      nightNeeds: {
        food: Number.isFinite(raw.nightNeeds?.food)
          ? Math.max(0, raw.nightNeeds.food)
          : 1,
        water: Number.isFinite(raw.nightNeeds?.water)
          ? Math.max(0, raw.nightNeeds.water)
          : 1,
        woodWithCampfire: Number.isFinite(raw.nightNeeds?.woodWithCampfire)
          ? Math.max(0, raw.nightNeeds.woodWithCampfire)
          : 1,
      },
      historyLimit: Number.isFinite(raw.historyLimit)
        ? Math.max(1, Math.floor(raw.historyLimit))
        : 8,
    };
  }

  getCurrentPhaseIndex() {
    const phases = this.getDayCycleConfig().phases;
    const index = phases.findIndex((phase) => phase.id === this.dayPhase);
    return index >= 0 ? index : 0;
  }

  getCurrentPhaseDef() {
    return this.getDayCycleConfig().phases[this.getCurrentPhaseIndex()];
  }

  _getFirstDayPhaseDef() {
    const phases = this.getDayCycleConfig().phases;
    return phases.find((phase) => phase.id !== "night") || phases[0];
  }

  _sanitizeNightResult(result) {
    if (!result || typeof result !== "object") return null;
    return {
      dayNumber: Number.isFinite(result.dayNumber)
        ? Math.max(1, Math.floor(result.dayNumber))
        : this.dayNumber,
      status: typeof result.status === "string" ? result.status : "unknown",
      label: result.label || "Ночь завершилась",
      icon: result.icon || "🌑",
      text: result.text || "",
      consumed:
        result.consumed && typeof result.consumed === "object"
          ? { ...result.consumed }
          : {},
      missing: Array.isArray(result.missing) ? result.missing.slice(0, 6) : [],
      effects:
        result.effects && typeof result.effects === "object"
          ? { ...result.effects }
          : {},
      returnedToCamp: !!result.returnedToCamp,
      at: Number.isFinite(result.at) ? result.at : Date.now(),
    };
  }

  _restoreDayCycle(savedCycle) {
    const conf = this.getDayCycleConfig();
    const phaseIds = new Set(conf.phases.map((phase) => phase.id));
    const fallbackPhase =
      conf.phases.find((phase) => phase.id === conf.startingPhase) ||
      conf.phases[0];
    this.dayNumber = Number.isFinite(savedCycle?.dayNumber)
      ? Math.max(1, Math.floor(savedCycle.dayNumber))
      : conf.startingDay;
    this.dayPhase =
      typeof savedCycle?.dayPhase === "string" &&
      phaseIds.has(savedCycle.dayPhase)
        ? savedCycle.dayPhase
        : fallbackPhase.id;
    const phase = this.getCurrentPhaseDef();
    this.actionsLeftInPhase = Number.isFinite(savedCycle?.actionsLeftInPhase)
      ? Math.max(
          0,
          Math.min(
            phase.actionBudget,
            Math.floor(savedCycle.actionsLeftInPhase),
          ),
        )
      : phase.actionBudget;
    if (this.dayPhase === "night") {
      this.actionsLeftInPhase = 0;
    }
    this.lastNightResult = this._sanitizeNightResult(
      savedCycle?.lastNightResult,
    );
    this.dayHistory = Array.isArray(savedCycle?.dayHistory)
      ? savedCycle.dayHistory
          .map((entry) => this._sanitizeNightResult(entry))
          .filter(Boolean)
          .slice(0, conf.historyLimit)
      : [];
  }

  getNightForecast() {
    const conf = this.getDayCycleConfig();
    const needs = [];
    const addNeed = (id, amount, required = true) => {
      if (!required || amount <= 0) return;
      const have = Math.floor(this.resources[id] || 0);
      needs.push({
        id,
        label: this.data.resources[id]?.name || id,
        icon: this.data.resources[id]?.icon || "",
        need: amount,
        have,
        ok: have >= amount,
        missing: Math.max(0, amount - have),
      });
    };
    addNeed("food", conf.nightNeeds.food);
    addNeed("water", conf.nightNeeds.water);
    addNeed("wood", conf.nightNeeds.woodWithCampfire, !!this.buildings.campfire);

    const missing = needs.filter((need) => !need.ok);
    const hasShelter = !!this.buildings.rest_tent;
    const hasCampfire = !!this.buildings.campfire;
    let status = "good";
    let label = "Ночь подготовлена";
    if (missing.length >= 2) {
      status = "bad";
      label = "Ночь будет тяжёлой";
    } else if (missing.length === 1) {
      status = "warn";
      label = "Есть риск";
    } else if (!hasShelter) {
      status = "rough";
      label = "Без укрытия";
    }

    return {
      status,
      label,
      hasShelter,
      hasCampfire,
      needs,
      missing,
      summary:
        missing.length > 0
          ? `Не хватает: ${missing
              .map((need) => `${need.label} ${need.missing}`)
              .join(", ")}`
          : hasShelter
            ? "Припасы есть, укрытие помогает восстановиться."
            : "Припасы есть, но без укрытия восстановление слабее.",
    };
  }

  getDayState() {
    const phase = this.getCurrentPhaseDef();
    return {
      dayNumber: this.dayNumber,
      phase,
      phaseIndex: this.getCurrentPhaseIndex(),
      phases: this.getDayCycleConfig().phases,
      actionsLeftInPhase: this.actionsLeftInPhase,
      lastNightResult: this.lastNightResult,
      dayHistory: this.dayHistory,
      nightForecast: this.getNightForecast(),
    };
  }

  advanceDayAction(reason = "action") {
    const phase = this.getCurrentPhaseDef();
    if (!phase || phase.id === "night" || phase.actionBudget <= 0) return false;
    const current = Number.isFinite(this.actionsLeftInPhase)
      ? this.actionsLeftInPhase
      : phase.actionBudget;
    this.actionsLeftInPhase = Math.max(0, current - 1);
    if (this.actionsLeftInPhase <= 0) {
      this.advanceToNextPhase(reason);
    } else {
      this.markDirty();
    }
    return true;
  }

  advanceToNextPhase(reason = "phase") {
    const phases = this.getDayCycleConfig().phases;
    const currentIndex = this.getCurrentPhaseIndex();
    const nextPhase = phases[(currentIndex + 1) % phases.length];
    if (!nextPhase) return false;

    if (nextPhase.id === "night") {
      this.dayPhase = nextPhase.id;
      this.actionsLeftInPhase = 0;
      this.resolveNight(reason);
      const morning = this._getFirstDayPhaseDef();
      this.dayNumber += 1;
      this.dayPhase = morning.id;
      this.actionsLeftInPhase = morning.actionBudget;
      this.addLog(`🌤️ День ${this.dayNumber}: ${morning.label}.`);
      this.markDirty();
      return true;
    }

    this.dayPhase = nextPhase.id;
    this.actionsLeftInPhase = nextPhase.actionBudget;
    this.addLog(`${nextPhase.icon} Наступает ${nextPhase.label.toLowerCase()}.`);
    this.markDirty();
    return true;
  }

  _consumeNightNeed(resourceId, amount) {
    if (!resourceId || amount <= 0) return { consumed: 0, missing: 0 };
    const have = Math.floor(this.resources[resourceId] || 0);
    const consumed = Math.min(have, amount);
    if (consumed > 0) {
      this.resources[resourceId] -= consumed;
    }
    return {
      consumed,
      missing: Math.max(0, amount - consumed),
    };
  }

  resolveNight(reason = "night") {
    const consumed = {};
    const missing = [];

    let returnedToCamp = false;
    if (this.localCampMap?.campTileId && !this.isCharacterAtCamp()) {
      this.arriveCharacterAtTile(this.localCampMap.campTileId);
      returnedToCamp = true;
    }

    const forecast = this.getNightForecast();

    for (const need of forecast.needs) {
      const result = this._consumeNightNeed(need.id, need.need);
      if (result.consumed > 0) consumed[need.id] = result.consumed;
      if (result.missing > 0) {
        missing.push({
          id: need.id,
          label: need.label,
          icon: need.icon,
          amount: result.missing,
        });
      }
    }

    const hasShelter = !!this.buildings.rest_tent;
    const hasCampfire = !!this.buildings.campfire;
    const missingCount = missing.length;
    let status = "stable";
    let label = "Ночь прошла спокойно";
    let icon = "🌙";
    let energyDelta = hasShelter ? 3 : 2;
    let satietyDelta = 0.15;
    let hydrationDelta = 0.15;

    if (missingCount >= 2) {
      status = "bad";
      label = "Тяжёлая ночь";
      icon = "⚠️";
      energyDelta = -2;
      satietyDelta = -0.75;
      hydrationDelta = -0.75;
    } else if (missingCount === 1) {
      status = "rough";
      label = "Неровная ночь";
      icon = "🌘";
      energyDelta = hasShelter ? 0 : -1;
      satietyDelta = -0.35;
      hydrationDelta = -0.35;
    } else if (!hasShelter) {
      status = "bare";
      label = "Ночь без укрытия";
      icon = "🌫️";
      energyDelta = 1;
      satietyDelta = -0.1;
      hydrationDelta = -0.1;
    } else if (hasCampfire) {
      status = "good";
      label = "Тёплая ночь";
      icon = "🔥";
      energyDelta = 4;
      satietyDelta = 0.25;
      hydrationDelta = 0.2;
    }

    const energyBefore = this.energy;
    const satietyBefore = this.satiety;
    const hydrationBefore = this.hydration;
    this.energy = Math.max(
      0,
      Math.min(this.maxEnergy, this.energy + energyDelta),
    );
    this.satiety = this._clampSatiety(this.satiety + satietyDelta);
    this.hydration = this._clampHydration(this.hydration + hydrationDelta);
    this._syncCharacterConditionState();

    const result = {
      dayNumber: this.dayNumber,
      status,
      label,
      icon,
      text:
        missing.length > 0
          ? `Ночью не хватило: ${missing
              .map((item) => `${item.label} ${item.amount}`)
              .join(", ")}.`
          : hasShelter
            ? "Запасов хватило, лагерь дал восстановиться."
            : "Запасов хватило, но спать под открытым небом тяжело.",
      consumed,
      missing,
      returnedToCamp,
      effects: {
        energy: this.energy - energyBefore,
        satiety: Number((this.satiety - satietyBefore).toFixed(2)),
        hydration: Number((this.hydration - hydrationBefore).toFixed(2)),
      },
      at: Date.now(),
    };

    this.lastNightResult = result;
    this.dayHistory.unshift(result);
    this.dayHistory = this.dayHistory.slice(
      0,
      this.getDayCycleConfig().historyLimit,
    );
    this.addLog(`${icon} ${label}. ${result.text}`);
    this._pushStoryEvent({
      type: "survival",
      icon,
      title: label,
      text: result.text,
      ttlMs: 6500,
    });
    this.markDirty();
    return result;
  }

  isUpgradeApplied(upgradeId) {
    return (
      Array.isArray(this.localCampMap?.appliedUpgrades) &&
      this.localCampMap.appliedUpgrades.includes(upgradeId)
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

    if (!Array.isArray(this.localCampMap.appliedUpgrades)) {
      this.localCampMap.appliedUpgrades = [];
    }
    this.localCampMap.appliedUpgrades.push(upgradeId);

    this._recalculateDerivedState();
    this.advanceDayAction("building_upgrade");
    this._pushLogEntry(`⬆️ Улучшение применено: ${upgrade.name}`);
    this._pushStoryEvent({
      type: "camp",
      icon: upgrade.icon || "⬆️",
      title: upgrade.name,
      text: upgrade.description || "",
      ttlMs: 5000,
    });

    this.saveGame(true);
    return true;
  }

  getUpgradesForBuilding(buildingId) {
    const upgrades = this.data.buildingUpgrades || {};
    return Object.values(upgrades).filter(
      (u) => u.targetBuilding === buildingId,
    );
  }

  chooseCamp(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;
    // Allow any visible non-resource tile as camp site (not just pre-marked candidates)
    if (tile.actionId) return false; // Resource/gather tiles can't be camp
    const tileState = this.getCampTileState(tileId);
    if (tileState === "hidden") return false;

    // Ritual gating: resources + energy must be available
    const check = this.canFoundCamp();
    if (!check.ok) return false;

    // Spend the founding cost
    if (!this.spendResources(check.cost)) return false;
    if (check.energyCost > 0 && !this.spendEnergy(check.energyCost)) {
      // Best-effort rollback: refund already-spent resources
      for (const [resId, amount] of Object.entries(check.cost)) {
        this.resources[resId] = (this.resources[resId] || 0) + amount;
      }
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
    this.localCampMap.characterTileId = tileId;

    // Ensure there are resource tiles within reach of the new camp.
    // If the chosen tile has no wood/stone/fiber within radius 1, generate them.
    this._ensureStartingResourceTiles(tileId);
    this.advanceDayAction("found_camp");

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
        terrainType: "brush",
        actionId: "gather_wood",
        amount: 10,
      },
      stone: {
        icon: "🪨",
        name: "Камни рядом",
        terrainType: "rock",
        actionId: "gather_stone",
        amount: 8,
      },
      fiber: {
        icon: "🌾",
        name: "Трава рядом",
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
  _findCampHexPath(fromTileId, toTileId) {
    if (fromTileId === toTileId) return [fromTileId];
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
        if (!prev.has(nid)) {
          prev.set(nid, current);
          queue.push(nid);
        }
      }
    }
    // Fallback: no path through neighbors (edge case)
    return [fromTileId, toTileId];
  }

  // Movement cost multiplier for entering a tile on foot.
  // Higher = slower passage. Trails reduce the cost by 20%.
  _getCampTileMoveCost(tile) {
    if (!tile) return 1;
    const base =
      {
        camp: 0.8,
        clearing: 1.0,
        grass: 1.0,
        worksite: 1.0,
        lore: 1.0,
        brush: 1.15,
        clay: 1.2,
        water: 1.25,
        grove: 1.3,
        rock: 1.4,
        ridge: 1.4,
      }[tile.terrainType] ?? 1.0;
    const pathLevel = this.getCampPathLevel(tile.id);
    return pathLevel !== "none" ? base * 0.8 : base;
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

  _canTileMeetDiscoveryRules(tile) {
    if (!tile) return false;
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
    if (this._campMapTilesCache) {
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

    const radius = this._getCampMapRadius();
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
    const carriedResources = {};
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
    for (const resourceId of Object.keys(this.data.resources || {})) {
      carriedResources[resourceId] = 0;
    }

    return {
      tileStates,
      tileResourceRemaining,
      pathLevels,
      buildingPlacements: {},
      selectedTileId: "camp_clearing",
      campSetupDone: false,
      campTileId: null,
      campOrigin: { q: 0, r: 0 },
      introStep: 0,
      surveyedCandidates: [],
      campEntered: false,
      characterTileId: "camp_clearing",
      carriedResources,
      readyStoryShown: false,
      appliedUpgrades: [],
      campSettings: { name: "" },
      generatedTiles: {},
    };
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
    defaults.characterTileId =
      typeof raw?.characterTileId === "string" && tiles[raw.characterTileId]
        ? raw.characterTileId
        : defaults.characterTileId;
    for (const resourceId of Object.keys(defaults.carriedResources || {})) {
      const amount = raw?.carriedResources?.[resourceId];
      defaults.carriedResources[resourceId] = Number.isFinite(amount)
        ? Math.max(0, amount)
        : 0;
    }
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
        return 3;
      case "discovered":
      case "camp_candidate":
        return 2;
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
      characterTileId: this.localCampMap.characterTileId || "camp_clearing",
      carriedResources: { ...(this.localCampMap.carriedResources || {}) },
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

    // Pre-camp phase: show camp_candidate tiles; named neighbours within
    // radius 2 of any candidate become "silhouette" (hint that something is
    // there), but authored tiles that are explicitly marked as discovered
    // stay fully available so the player can gather the founding resources.
    if (!this.localCampMap.campSetupDone) {
      const candidates = [];
      const candidateIds = new Set();
      const preCampDiscoveredIds = new Set();
      for (const [tileId, tile] of Object.entries(tiles)) {
        const baseState = this._normalizeCampTileState(tile.state);
        const currentState = this._normalizeCampTileState(
          this.localCampMap.tileStates[tileId],
        );
        const isCandidateTile =
          baseState === "camp_candidate" ||
          !!tile.isCampCandidate ||
          currentState === "camp_candidate";
        if (isCandidateTile) {
          candidates.push(tile);
          candidateIds.add(tileId);
          continue;
        }

        const isPreCampDiscovered =
          baseState === "discovered" ||
          currentState === "discovered" ||
          currentState === "developed" ||
          currentState === "camp";
        if (isPreCampDiscovered) {
          preCampDiscoveredIds.add(tileId);
        }
      }

      const SILHOUETTE_RADIUS = 2;
      const silhouetteIds = new Set();
      for (const [tileId, tile] of Object.entries(tiles)) {
        if (candidateIds.has(tileId)) continue;
        // Only reveal silhouettes for named/hand-authored tiles, not for
        // procedurally filled background hexes (they clutter the pre-camp view).
        if (!tile.name) continue;
        for (const c of candidates) {
          const dq = (tile.q || 0) - (c.q || 0);
          const dr = (tile.r || 0) - (c.r || 0);
          const d = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
          if (d <= SILHOUETTE_RADIUS) {
            silhouetteIds.add(tileId);
            break;
          }
        }
      }

      for (const [tileId] of Object.entries(tiles)) {
        if (candidateIds.has(tileId)) {
          this.localCampMap.tileStates[tileId] = "camp_candidate";
        } else if (preCampDiscoveredIds.has(tileId)) {
          this.localCampMap.tileStates[tileId] = "discovered";
        } else if (silhouetteIds.has(tileId)) {
          this.localCampMap.tileStates[tileId] = "silhouette";
        } else {
          this.localCampMap.tileStates[tileId] = "hidden";
        }
      }
      this._ensureSelectedCampTile();
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

  refreshCampMap() {
    this._syncLocalCampMap({ pushStory: false });
  }

  _ensureSelectedCampTile() {
    const tiles = this._getCampMapTileList();
    const currentId = this.localCampMap.selectedTileId;
    if (
      currentId &&
      this._getCampMapTile(currentId) &&
      ["discovered", "developed", "camp", "camp_candidate"].includes(
        this.getCampTileState(currentId),
      )
    ) {
      return;
    }

    const discovered = tiles
      .filter((tile) => {
        const s = this.getCampTileState(tile.id);
        return ["discovered", "developed", "camp", "camp_candidate"].includes(
          s,
        );
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

  _canImproveCampPath(tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;
    if (this._getCampTileLiveDist(tile) <= 0) return false;
    if (this.getCampTileState(tileId) === "hidden") return false;
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
    if (fieldcraftRelief > 0) {
      warnings.push(
        "Походная сноровка помогает тянуть путь без лишней потери сил.",
      );
    }

    return {
      tile,
      pathLevel: this.getCampPathLevel(tileId),
      pathData,
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
    return this._getCampMapTileList()
      .filter((tile) => tile.actionId === actionId)
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
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;
    if (
      !Array.isArray(tile.buildOptions) ||
      !tile.buildOptions.includes(buildingId)
    ) {
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
    return tileId ? this._getCampMapTile(tileId) : null;
  }

  getCampMapState() {
    const mapData = this.data.localCampMap || {};
    const selectedTileId = this.getSelectedCampTileId();
    const tiles = this._getCampMapTileList()
      .map((tile) => {
        const state = this.getCampTileState(tile.id);
        const buildingId = this.getCampPlacedBuildingId(tile.id);
        const building = buildingId ? this.data.buildings[buildingId] : null;
        const construction =
          this.activeConstruction?.tileId === tile.id
            ? this.getConstructionState()
            : null;
        const liveDist = this._getCampTileLiveDist(tile);

        return {
          ...tile,
          distanceFromCamp: liveDist,
          state,
          pathLevel: this.getCampPathLevel(tile.id),
          pathData: this.getCampPathData(tile.id),
          selected: tile.id === selectedTileId,
          buildingId,
          building,
          construction,
          isCharacterHere: tile.id === this.getCharacterTileId(),
          resourceRemaining: this._getCampTileResourceRemaining(tile.id),
          resourceCapacity: Number.isFinite(tile.resourceAmount)
            ? tile.resourceAmount
            : null,
          isDepleted: this._isCampTileResourceDepleted(tile.id),
        };
      })
      .sort(
        (a, b) =>
          (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0),
      );

    return {
      title: mapData.title || "Локальная карта лагеря",
      description: mapData.description || "",
      interactionHint: mapData.interactionHint || "",
      radius: this._getCampMapRadius(),
      selectedTileId,
      characterTileId: this.getCharacterTileId(),
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
    const placedBuildingId = this.getCampPlacedBuildingId(tileId);
    const placedBuilding = placedBuildingId
      ? this.data.buildings[placedBuildingId]
      : null;
    const construction =
      this.activeConstruction?.tileId === tileId
        ? this.getConstructionState()
        : null;
    const action = tile.actionId
      ? this.data.gatherActions[tile.actionId]
      : null;
    const gatherProfile = action
      ? this.getGatherProfile(action.id, { tileId })
      : null;
    const pathProject = this.getCampPathProject(tileId);

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
      distanceFromCamp: this._getCampTileLiveDist(tile),
      state,
      action,
      placedBuildingId,
      placedBuilding,
      construction,
      nextBuildId,
      nextBuilding,
      isCharacterHere: tileId === this.getCharacterTileId(),
      resourceRemaining: this._getCampTileResourceRemaining(tileId),
      resourceCapacity: Number.isFinite(tile.resourceAmount)
        ? tile.resourceAmount
        : null,
      isDepleted: this._isCampTileResourceDepleted(tileId),
      pathLevel: this.getCampPathLevel(tileId),
      pathData: this.getCampPathData(tileId),
      pathProject,
      gatherProfile,
      canGather: gatherProfile ? this.canGather(action.id, { tileId }) : false,
      canImprovePath: !!pathProject?.canImprove,
      canBuild:
        nextBuildId && !placedBuildingId
          ? this._canBuildOnTile(nextBuildId, tileId) &&
            this.canBuild(nextBuildId)
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
    this.advanceDayAction("trail");

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
        dayCycle: {
          dayNumber: this.dayNumber,
          dayPhase: this.dayPhase,
          actionsLeftInPhase: this.actionsLeftInPhase,
          lastNightResult: this.lastNightResult,
          dayHistory: this.dayHistory,
        },
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
    this._restoreDayCycle(state.dayCycle);
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
      text: insight.momentText || insight.unlockText || insight.description,
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

    return visible;
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

  _clampSatiety(value) {
    return Math.max(0, Math.min(this.maxSatiety, value));
  }

  _clampHydration(value) {
    return Math.max(0, Math.min(this.maxHydration, value));
  }

  _getCharacterConditionConfig(conditionId) {
    return this.data.character?.conditions?.[conditionId] || null;
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
    };
  }

  getCharacterCarryCapacity() {
    const strengthCapacityBonus = this.getCharacterStrengthCapacityBonus();
    return Number((this.carryCapacity + strengthCapacityBonus).toFixed(2));
  }

  getCharacterTileId() {
    return (
      this.localCampMap?.characterTileId ||
      this.localCampMap?.campTileId ||
      "camp_clearing"
    );
  }

  setCharacterTileId(tileId) {
    if (!tileId || !this._getCampMapTile(tileId)) return false;
    this.localCampMap.characterTileId = tileId;
    return true;
  }

  isCharacterAtCamp() {
    const currentTileId = this.getCharacterTileId();
    return this.getCampTileState(currentTileId) === "camp";
  }

  getCharacterCarriedResources() {
    return { ...(this.localCampMap?.carriedResources || {}) };
  }

  getCharacterCarriedLoad() {
    return Object.entries(this.localCampMap?.carriedResources || {}).reduce(
      (sum, [resourceId, amount]) =>
        sum + this.getResourceCarryWeight(resourceId) * Math.max(0, amount || 0),
      0,
    );
  }

  getCharacterAvailableCarryCapacity() {
    return Math.max(
      0,
      Number(
        (
          this.getCharacterCarryCapacity() - this.getCharacterCarriedLoad()
        ).toFixed(2),
      ),
    );
  }

  _addCarriedResource(resourceId, amount) {
    if (
      !resourceId ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Object.prototype.hasOwnProperty.call(this.resources, resourceId)
    ) {
      return 0;
    }
    if (!this.localCampMap.carriedResources) {
      this.localCampMap.carriedResources = {};
    }
    const weight = this.getResourceCarryWeight(resourceId);
    const availableCapacity = this.getCharacterAvailableCarryCapacity();
    const maxAmount = weight > 0 ? Math.floor(availableCapacity / weight) : amount;
    const addedAmount = Math.max(0, Math.min(amount, maxAmount));
    if (addedAmount <= 0) return 0;
    const before = this.localCampMap.carriedResources[resourceId] || 0;
    this.localCampMap.carriedResources[resourceId] = before + addedAmount;
    this.totalResourcesCollected += addedAmount;
    this.resourceTotals[resourceId] += addedAmount;
    return addedAmount;
  }

  unloadCharacterCargo() {
    const carried = this.localCampMap?.carriedResources || {};
    const moved = {};
    for (const [resourceId, amount] of Object.entries(carried)) {
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const before = this.resources[resourceId] || 0;
      this.resources[resourceId] = Math.min(
        this.maxResourceCap,
        before + amount,
      );
      const added = this.resources[resourceId] - before;
      if (added > 0) {
        moved[resourceId] = added;
      }
      this.localCampMap.carriedResources[resourceId] = Math.max(
        0,
        amount - added,
      );
      if (added < amount) {
        this.lastOverflow = {
          id: resourceId,
          lost: 0,
          at: Date.now(),
        };
      }
    }
    const movedCount = Object.keys(moved).length;
    if (movedCount > 0) {
      this.addLog(
        `📦 В лагерь сложено: ${Object.entries(moved)
          .map(([id, amount]) => `${this.data.resources[id]?.icon || ""}${amount}`)
          .join(" ")}`,
      );
      this.markDirty();
    }
    return moved;
  }

  arriveCharacterAtTile(tileId) {
    if (!this.setCharacterTileId(tileId)) return false;
    if (this.getCampTileState(tileId) === "camp") {
      this.unloadCharacterCargo();
    }
    this.markDirty();
    return true;
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

  _getGatherEventSeed(profile, actionId) {
    const tile = profile?.tile || null;
    const routeDistance = profile?.routeDistance || 0;
    const tileQ = tile?.q || 0;
    const tileR = tile?.r || 0;
    const resourceHint = Object.keys(profile?.output || {}).join("|").length;
    let hash =
      (this.totalResourcesCollected || 0) * 31 +
      routeDistance * 17 +
      tileQ * 19 +
      tileR * 23 +
      resourceHint * 13;

    for (let i = 0; i < actionId.length; i += 1) {
      hash = (hash * 33 + actionId.charCodeAt(i)) | 0;
    }

    return Math.abs(hash);
  }

  _getPrimaryGatherResource(output) {
    return (
      Object.entries(output || {}).sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        return String(left[0]).localeCompare(String(right[0]));
      })[0]?.[0] || null
    );
  }

  _applyGatherFieldEvent(profile, actionId, output, options = {}) {
    if (!profile || !output) return null;

    const primaryResourceId = this._getPrimaryGatherResource(output);
    if (!primaryResourceId) return null;

    const seed = this._getGatherEventSeed(profile, actionId);
    const roll = seed % 100;
    const conditionPenalty =
      profile.condition?.id === "exhausted"
        ? 2
        : profile.condition?.id === "weakened"
          ? 1
          : 0;
    const positiveScore =
      (profile.specializationTotals?.fieldcraft || 0) +
      (profile.specializationTotals?.strength || 0) +
      (profile.specializationTotals?.ingenuity || 0) +
      (profile.mobilityRelief || 0);
    const riskScore =
      profile.distancePenalty +
      profile.terrainPenalty +
      profile.deliveryPenalty +
      profile.loadPenalty +
      conditionPenalty;
    const positiveThreshold = Math.min(30, 8 + positiveScore * 4);
    const negativeThreshold = Math.min(22, riskScore * 4);

    if (positiveScore > 0 && roll < positiveThreshold) {
      const bonusAmount = 1;
      if (options.toCarried) {
        this._addCarriedResource(primaryResourceId, bonusAmount);
      } else {
        this.addResource(primaryResourceId, bonusAmount);
      }
      if (
        profile.tile &&
        Number.isFinite(this.localCampMap.tileResourceRemaining[profile.tile.id])
      ) {
        this.localCampMap.tileResourceRemaining[profile.tile.id] = Math.max(
          0,
          this.localCampMap.tileResourceRemaining[profile.tile.id] - bonusAmount,
        );
      }

      const resource = this.data.resources?.[primaryResourceId];
      const title =
        primaryResourceId === "food" ||
        primaryResourceId === "fiber" ||
        primaryResourceId === "water"
          ? "Удачная находка"
          : primaryResourceId === "wood" ||
              primaryResourceId === "stone" ||
              primaryResourceId === "clay"
            ? "Крепкий пласт"
            : "Полезная мелочь";
      const text =
        primaryResourceId === "food" ||
        primaryResourceId === "fiber" ||
        primaryResourceId === "water"
          ? `Наблюдательность помогает добрать ещё ${resource?.icon || ""} ${resource?.name || primaryResourceId}.`
          : primaryResourceId === "wood" ||
              primaryResourceId === "stone" ||
              primaryResourceId === "clay"
            ? `Участок поддаётся лучше обычного: удалось вынести ещё ${resource?.icon || ""} ${resource?.name || primaryResourceId}.`
            : `По пути удаётся прихватить ещё ${resource?.icon || ""} ${resource?.name || primaryResourceId}.`;

      this.addLog(
        `✨ ${title}: +${bonusAmount} ${resource?.icon || ""}${resource?.name || primaryResourceId}.`,
      );
      this._pushStoryEvent({
        type: "gather-event",
        icon: resource?.icon || "✨",
        title,
        text,
        ttlMs: 4200,
      });

      return {
        kind: "bonus",
        resourceId: primaryResourceId,
        amount: bonusAmount,
      };
    }

    if (riskScore > 0 && roll >= 100 - negativeThreshold) {
      const extraSatiety = Number(
        Math.min(0.45, 0.12 + riskScore * 0.06).toFixed(2),
      );
      const extraHydration = Number(
        Math.min(0.55, 0.1 + riskScore * 0.07).toFixed(2),
      );
      const satietyLost = this._drainSatiety(extraSatiety);
      const hydrationLost = this._drainHydration(extraHydration);
      const textParts = [];
      if (satietyLost > 0.01) {
        textParts.push(`-${satietyLost.toFixed(2)} сытости`);
      }
      if (hydrationLost > 0.01) {
        textParts.push(`-${hydrationLost.toFixed(2)} воды`);
      }

      this.addLog(
        `⚠️ Тяжёлый выход: участок выбивает из ритма${textParts.length ? ` (${textParts.join(", ")})` : ""}.`,
      );
      this._pushStoryEvent({
        type: "gather-risk",
        icon: "⚠️",
        title: "Тяжёлый момент в пути",
        text:
          profile.terrainPenalty > 0
            ? "Почва и груз забирают больше сил, чем казалось поначалу."
            : "Дальний выход тянется тяжелее ожидаемого и выбивает запас сил.",
        ttlMs: 4200,
      });

      return {
        kind: "strain",
        satietyLost,
        hydrationLost,
      };
    }

    return null;
  }

  _getCampTravelThreatProfile(tile, context = {}) {
    if (!tile) return null;

    const terrainRisk =
      {
        grass: 7,
        clearing: 6,
        worksite: 9,
        brush: 12,
        grove: 15,
        clay: 16,
        water: 18,
        rock: 19,
        ridge: 21,
        lore: 14,
      }[tile.terrainType] ?? 10;
    const distance = Math.max(0, this._getCampTileLiveDist(tile));
    const condition = this.getCharacterCondition();
    const fieldcraft = this.getCharacterFieldcraft();
    const mobility = this.getCharacterMobility();
    const endurance = this.getCharacterEndurance();
    const ingenuity = this.getCharacterIngenuity();
    const actionId = context.actionId || "";

    let seed =
      (tile.q || 0) * 43 +
      (tile.r || 0) * 59 +
      distance * 31 +
      terrainRisk * 17 +
      (this.totalResourcesCollected || 0) * 7;
    for (let i = 0; i < actionId.length; i += 1) {
      seed = (seed * 33 + actionId.charCodeAt(i)) | 0;
    }

    const avoidance =
      fieldcraft * 4 + mobility * 3 + endurance * 2 + ingenuity * 1;
    const conditionPenalty =
      condition.id === "exhausted"
        ? 14
        : condition.id === "weakened"
          ? 8
          : 0;
    const threatChance = Math.max(
      0,
      Math.min(40, terrainRisk + distance * 4 + conditionPenalty - avoidance),
    );
    const roll = Math.abs(seed) % 100;

    return {
      tile,
      terrainRisk,
      threatChance,
      roll,
      triggered: roll < threatChance,
      distance,
    };
  }

  resolveCampTravelTileEvent(tileId, context = {}) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return null;

    const threat = this._getCampTravelThreatProfile(tile, context);
    if (!threat?.triggered) return null;

    const delayMs = Math.round(
      Math.min(1800, 350 + threat.terrainRisk * 28 + threat.distance * 90),
    );
    const extraSatiety = Number(
      Math.min(0.45, 0.08 + threat.terrainRisk * 0.01).toFixed(2),
    );
    const extraHydration = Number(
      Math.min(0.55, 0.08 + threat.distance * 0.05 + threat.terrainRisk * 0.008).toFixed(2),
    );
    const energyLoss = Math.min(
      2,
      Math.max(0, Math.floor((threat.terrainRisk + threat.distance) / 14)),
    );

    const satietyLost = this._drainSatiety(extraSatiety);
    const hydrationLost = this._drainHydration(extraHydration);
    if (energyLoss > 0) {
      this.energy = Math.max(0, this.energy - energyLoss);
    }
    this._syncCharacterConditionState();

    const terrainText =
      {
        water: "Топкая вода задерживает шаг.",
        clay: "Вязкая глина держит ноги и тянет время.",
        rock: "Каменная россыпь режет темп и заставляет идти осторожнее.",
        ridge: "Гребень и осыпь ломают прямой проход.",
        grove: "Густой лес заставляет искать обход.",
        brush: "Колючий кустарник цепляется за руки и груз.",
        lore: "Незнакомое место требует лишней осторожности.",
      }[tile.terrainType] || "Незнакомый участок ломает ритм движения.";

    this.addLog(
      `⚠️ ${tile.name}: ${terrainText} Потеряно ${delayMs}мс пути${energyLoss > 0 ? `, ⚡-${energyLoss}` : ""}${satietyLost > 0.01 ? `, 🍖-${satietyLost.toFixed(2)}` : ""}${hydrationLost > 0.01 ? `, 💧-${hydrationLost.toFixed(2)}` : ""}.`,
    );
    this._pushStoryEvent({
      type: "travel-threat",
      icon: "⚠️",
      title: "Опасный проход",
      text: `${terrainText} ${tile.name} оказывается не таким простым, как выглядел издалека.`,
      ttlMs: 4200,
    });
    this.markDirty();

    return {
      kind: "threat",
      tileId,
      delayMs,
      energyLoss,
      satietyLost,
      hydrationLost,
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
      case "clay":
        return { penalty: 1, label: "вязкая глина" };
      case "water":
        return { penalty: 1, label: "влажный берег" };
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
    if (
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
    this.saveGame(true);
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

  _limitOutputByCarry(output, capacity = this.getCharacterAvailableCarryCapacity()) {
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

  getGatherProfile(actionId, options = {}) {
    const action = this.data.gatherActions[actionId];
    if (!action) return null;

    const tile = this._getPreferredCampGatherTile(actionId, options.tileId);
    const distance = tile ? this._getCampTileLiveDist(tile) : 0;
    const zoneLabel =
      distance === 0
        ? "центр"
        : distance === 1
          ? "ближняя зона"
          : "дальний выход";
    const condition = this.getCharacterCondition();
    const carryCapacity = this.getCharacterAvailableCarryCapacity();
    const terrain = this._getTerrainEffort(tile);
    const path = tile
      ? this.getCampPathData(tile.id)
      : this.getCampPathData(null);
    const warnings = [];

    const rawOutput = { ...action.output };
    const gatherBonus = this._getGatherBonus();
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
          specialization.bonus -
          (condition.gatherOutputPenalty || 0),
      );
    }

    const carryLimited = this._limitOutputByCarry(rawOutput, carryCapacity);
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
    if (
      condition.id !== "stable" &&
      distancePenalty + terrainPenalty + loadPenalty + delivery.tripPenalty > 0
    ) {
      warnings.push("Ослабленное состояние делает этот выход заметно рискованнее.");
    }
    if (
      specializationTotals.fieldcraft +
        specializationTotals.strength +
        specializationTotals.ingenuity >
        0 &&
      routeDistance >= 1
    ) {
      warnings.push("Подготовленный персонаж может вытащить с такого выхода лишнюю единицу добычи.");
    }
    if (loadPenalty > 0) {
      warnings.push("Выход почти упирается в переносимость.");
    }
    if (delivery.requiresMultipleTrips) {
      warnings.push(
        `Доставка до стоянки потребует ${delivery.tripsRequired} ходки.`,
      );
    }
    if (carryLimited.limitedByCarry) {
      warnings.push("Часть добычи теряется из-за ограниченной переносимости.");
    }
    if (supplyLimited.limitedBySupply) {
      warnings.push("Участок почти выработан, поэтому выход уже меньше.");
    }

    const gatherDurationMs = this.getGatherDuration(actionId, {
      profile: {
        condition,
        terrainPenalty,
        output,
      },
    });
    const toolTier = this.getGatherToolTier();
    const toolSpeedPct = Math.max(
      0,
      Math.round((1 - this._getGatherToolSpeedMultiplier(actionId, this._getPrimaryGatherResource(output))) * 100),
    );
    if (toolSpeedPct > 0) {
      warnings.push(
        toolTier === "improved"
          ? `Хороший инструмент ускоряет сам сбор примерно на ${toolSpeedPct}%.`
          : `Инструмент под рукой ускоряет сбор примерно на ${toolSpeedPct}%.`,
      );
    }

    return {
      actionId,
      action,
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
      requiresMultipleTrips: delivery.requiresMultipleTrips,
      pathLevel: path.id,
      pathLabel: path.label,
      pathIcon: path.icon,
      routeDistance,
      energyCost,
      baseEnergyCost: action.energyCost,
      gatherDurationMs,
      toolTier,
      toolSpeedPct,
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
      blockedReason,
      isAvailable: !blockedReason,
      terrainLabel: terrain.label,
      warnings,
      condition,
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
    const currentTileId = this.getCharacterTileId();
    const currentTile = this._getCampMapTile(currentTileId);
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
        capacity: this.getCharacterCarryCapacity(),
        availableCapacity: this.getCharacterAvailableCarryCapacity(),
        carriedLoad: this.getCharacterCarriedLoad(),
        carriedResources: this.getCharacterCarriedResources(),
        baseCapacity: this.baseCarryCapacity,
        capacityBonus: this.carryCapacityBonus || 0,
        strengthCapacityBonus: this.getCharacterStrengthCapacityBonus(),
        heavyThreshold: this.getCharacterHeavyLoadThreshold(),
      },
      location: {
        tileId: currentTileId,
        tileName: currentTile?.name || "Лагерь",
        isAtCamp: this.isCharacterAtCamp(),
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
      this.saveGame(true);
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
    if (this.isPrologueActive()) {
      const allowedIds = this.data.prologue?.gatherActionIds || [];
      if (!allowedIds.includes(actionId) || action.hiddenInPrologue)
        return false;
    }
    if (action.unlockedBy && !this.researched[action.unlockedBy]) return false;
    if (this.cooldowns[actionId] && Date.now() < this.cooldowns[actionId])
      return false;
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

    const toCarried = !this.isCharacterAtCamp();
    const output = profile.output;
    for (const [id, amount] of Object.entries(output)) {
      if (toCarried) {
        this._addCarriedResource(id, amount);
      } else {
        this.addResource(id, amount);
      }
    }
    const fieldEvent = this._applyGatherFieldEvent(profile, actionId, output, {
      toCarried,
    });
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

    this.cooldowns[actionId] =
      Date.now() + this.getGatherCooldownDuration(actionId, { profile });
    if (this.isPrologueActive()) {
      this.addLog(this._getPrologueGatherLog(actionId, output));
    } else {
      this.addLog(
        `+${Object.entries(output)
          .map(([id, amount]) => {
            const resource = this.data.resources[id];
            return `${resource?.icon || id}${amount}`;
          })
          .join(" ")}${toCarried ? " в рюкзак" : ""} (⚡-${profile.energyCost})`,
      );
    }
    if (fieldEvent?.kind === "strain") {
      this._syncCharacterConditionState();
    }

    this._checkPrologueInsights();
    this._checkOnboarding();
    this._checkGoals();
    this._syncLocalCampMap({ pushStory: true });
    this.advanceDayAction("gather");
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

  getGatherToolTier() {
    if ((this.resources.improved_tools || 0) > 0) return "improved";
    if ((this.resources.crude_tools || 0) > 0) return "crude";
    return "none";
  }

  _getGatherTimingCategory(actionId, resourceId = null) {
    if (actionId === "gather_supplies") return "supplies";
    switch (resourceId) {
      case "stone":
      case "clay":
        return "heavy";
      case "wood":
        return "wood";
      case "fiber":
      case "food":
        return "light";
      case "water":
        return "water";
      default:
        return "default";
    }
  }

  _getGatherToolSpeedMultiplier(actionId, resourceId = null) {
    const toolTier = this.getGatherToolTier();
    const category = this._getGatherTimingCategory(actionId, resourceId);

    if (toolTier === "improved") {
      switch (category) {
        case "heavy":
          return 0.66;
        case "wood":
          return 0.7;
        case "supplies":
          return 0.74;
        case "light":
          return 0.76;
        case "water":
          return 0.86;
        default:
          return 0.8;
      }
    }

    if (toolTier === "crude") {
      switch (category) {
        case "heavy":
          return 0.82;
        case "wood":
          return 0.86;
        case "supplies":
          return 0.88;
        case "light":
          return 0.9;
        case "water":
          return 0.96;
        default:
          return 0.92;
      }
    }

    return 1;
  }

  _getGatherBaseDurationMs(actionId, resourceId = null) {
    if (actionId === "gather_supplies") return 2400;
    switch (resourceId) {
      case "stone":
        return 2800;
      case "clay":
        return 2200;
      case "wood":
        return 1850;
      case "food":
        return 1350;
      case "fiber":
        return 1200;
      case "water":
        return 950;
      default:
        return 1400;
    }
  }

  getGatherDuration(actionId, options = {}) {
    const action = this.data.gatherActions[actionId];
    if (!action) return 0;

    const profile =
      options.profile ||
      this.getGatherProfile(actionId, { tileId: options.tileId || null });
    const primaryResourceId =
      options.resourceId ||
      this._getPrimaryGatherResource(profile?.output || action.output);
    const toolMultiplier = this._getGatherToolSpeedMultiplier(
      actionId,
      primaryResourceId,
    );
    const conditionId = profile?.condition?.id || "stable";
    const conditionMultiplier =
      conditionId === "exhausted"
        ? 1.22
        : conditionId === "weakened"
          ? 1.1
          : 1;
    const terrainMultiplier = 1 + Math.max(0, Number(profile?.terrainPenalty || 0)) * 0.08;
    const ingenuityMultiplier =
      1 - Math.max(0, this.getCharacterIngenuity() - this.baseIngenuity) * 0.02;
    const baseDuration = Math.max(
      800,
      Number(
        action.gatherTimeMs ||
          this._getGatherBaseDurationMs(actionId, primaryResourceId) ||
          action.cooldown ||
          1200,
      ),
    );

    return Math.max(
      550,
      Math.round(
        baseDuration *
          toolMultiplier *
          conditionMultiplier *
          terrainMultiplier *
          Math.max(0.84, ingenuityMultiplier),
      ),
    );
  }

  getGatherCooldownDuration(actionId, options = {}) {
    return this.getGatherDuration(actionId, options);
  }

  getGatherOutput(actionId) {
    return this.getGatherProfile(actionId)?.output || {};
  }

  canCraft(recipeId) {
    const recipe = this.data.recipes[recipeId];
    if (!recipe) return false;
    if (this.isPrologueActive()) {
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
    this.advanceDayAction("craft");
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
    this.advanceDayAction("build");
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
    this.advanceDayAction("research");

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
