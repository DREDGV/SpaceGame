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
        currentGoalIndex: this.currentGoalIndex,
        completedGoals: [...this.completedGoals],
        allGoalsComplete: this.allGoalsComplete,
        currentEra: this.currentEra,
        eraProgress: {
          completedMilestones: Array.from(this.eraProgress.completedMilestones),
        },
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

  shouldShowOnboardingIntro() {
    return this.isOnboardingActive() && !this.onboarding.started;
  }

  startOnboarding() {
    if (!this.isOnboardingActive()) return;
    this.onboarding.started = true;
    this.addLog("📘 Обучение начато");
    this.markDirty();
    this.saveGame(true);
  }

  skipOnboarding() {
    this.onboarding.started = false;
    this.onboarding.skipped = true;
    this.addLog("⏭️ Обучение пропущено");
    this.markDirty();
    this.saveGame(true);
  }

  completeOnboarding() {
    this.onboarding.started = false;
    this.onboarding.completed = true;
    this.addLog("🎉 Обучение завершено!");
    this.markDirty();
  }

  restartOnboarding() {
    this.onboarding = {
      started: true,
      skipped: false,
      completed: false,
      currentStep: 0,
    };
    this.addLog("📘 Обучение запущено заново");
    this.markDirty();
    this.saveGame(true);
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

    if (this.energy !== before) {
      this.addLog(`⚡ +${this.energy - before} энергии`);
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

  canGather(actionId) {
    const action = this.data.gatherActions[actionId];
    if (!action) return false;
    if (action.unlockedBy && !this.researched[action.unlockedBy]) return false;
    if (this.cooldowns[actionId] && Date.now() < this.cooldowns[actionId])
      return false;
    if (!this.hasEnergy(action.energyCost)) return false;
    return true;
  }

  gather(actionId) {
    if (!this.canGather(actionId)) return false;

    const action = this.data.gatherActions[actionId];
    if (!this.spendEnergy(action.energyCost)) return false;

    const output = this.getGatherOutput(actionId);
    for (const [id, amount] of Object.entries(output)) {
      this.addResource(id, amount);
    }

    this.cooldowns[actionId] = Date.now() + action.cooldown;
    this.addLog(
      `+${Object.entries(output)
        .map(([id, amount]) => `${this.data.resources[id].icon}${amount}`)
        .join(" ")} (⚡-${action.energyCost})`,
    );

    this._checkOnboarding();
    this._checkGoals();
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
    if (!this.unlockedRecipes.has(recipeId)) return false;
    if (recipe.requires && !this.buildings[recipe.requires]) return false;
    return this.hasResources(this._getDiscountedCost(recipe.ingredients));
  }

  canQueueCraft(recipeId) {
    if (!this.canCraft(recipeId)) return false;
    if (this.craftQueue.length >= this.maxCraftQueueSize) return false;
    return true;
  }

  queueCraft(recipeId) {
    if (!this.canQueueCraft(recipeId)) return false;

    const recipe = this.data.recipes[recipeId];
    const cost = this._getDiscountedCost(recipe.ingredients);
    if (!this.spendResources(cost)) return false;

    this.craftQueue.push({
      recipeId,
      durationMs: recipe.craftTimeMs || 3000,
      startedAt: this.craftQueue.length === 0 ? Date.now() : null,
    });

    this.addLog(`🧰 В очередь: ${recipe.icon} ${recipe.name}`);
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

    this.addLog(`⚒️ Готово: ${recipe.icon} ${recipe.name}`);
    this.craftQueue.shift();
    if (this.craftQueue.length > 0) {
      this.craftQueue[0].startedAt = Date.now();
    }

    this._checkOnboarding();
    this._checkGoals();
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
    if (building.unlockedBy && !this.researched[building.unlockedBy])
      return false;
    if (building.requires && !this.buildings[building.requires]) return false;
    if (this.buildings[buildingId]) return false;
    return this.hasResources(building.cost);
  }

  build(buildingId) {
    if (!this.canBuild(buildingId)) return false;

    const building = this.data.buildings[buildingId];
    if (!this.spendResources(building.cost)) return false;

    const durationMs = this.getBuildDuration(buildingId);
    this.activeConstruction = {
      buildingId,
      durationMs,
      startedAt: Date.now(),
    };

    this.addLog(
      `🏗️ Начато строительство: ${building.icon} ${building.name} (${Math.ceil(durationMs / 1000)}с)`,
    );
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
    if (building.effect?.automation) {
      this.automation[building.effect.automation.id] = {
        lastRun: 0,
        state: AUTO_STATE.WAITING,
      };
    }

    this._recalculateDerivedState();
    this.addLog(`🏗️ Построено: ${building.icon} ${building.name}`);
    this._checkOnboarding();
    this._checkGoals();
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

    this.addLog(`✅ Обучение: ${step.text}`);
    this.advanceOnboardingStep();

    const nextStep = this.getCurrentOnboardingStep();
    if (nextStep) {
      this.addLog(`📖 Далее: ${nextStep.text}`);
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
