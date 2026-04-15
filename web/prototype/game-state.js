/**
 * GameState — manages all game data, actions, and progression.
 * Pure logic, no DOM.
 *
 * Core Loop v4:
 * - Onboarding system with localStorage persistence
 * - Sequential tutorial steps with hints
 * - Skip/disable at any time
 * - Energy system
 * - Automation with clear state machine
 * - Tool impact on gathering
 * - Goals (post-onboarding)
 */

const AUTO_STATE = {
  RUNNING: "running",
  WAITING: "waiting",
  IDLE: "idle",
};

const SAVE_KEY = "spacegame_onboarding_v1";

class GameState {
  constructor(data) {
    this.data = data;
    this.resources = {};
    this.resourceTotals = {};
    this.buildings = {};
    this.researched = {};
    this.unlockedRecipes = new Set();
    this.maxResourceCap = 50;
    this.craftDiscount = 0;
    this.totalResourcesCollected = 0;
    this.log = [];
    this.cooldowns = {};

    // Energy
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

    // Automation
    this.automation = {};

    // Onboarding state
    this.onboarding = this._loadOnboarding();

    // Goals (post-onboarding)
    this.currentGoalIndex = 0;
    this.completedGoals = [];
    this.allGoalsComplete = false;

    // Init resources
    for (const id of Object.keys(data.resources)) {
      this.resources[id] = 0;
      this.resourceTotals[id] = 0;
    }

    // Unlock recipes with no requirements
    for (const [id, recipe] of Object.entries(data.recipes)) {
      if (!recipe.requires) {
        this.unlockedRecipes.add(id);
      }
    }

    this._recalculateEnergyStats();
  }

  // ─── Onboarding persistence ───

  _loadOnboarding() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          started: !!parsed.started,
          skipped: !!parsed.skipped,
          completed: !!parsed.completed,
          currentStep: parsed.currentStep || 0,
        };
      }
    } catch (e) {
      // ignore
    }
    return { started: false, skipped: false, completed: false, currentStep: 0 };
  }

  _saveOnboarding() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.onboarding));
    } catch (e) {
      // ignore
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
    this._saveOnboarding();
    this.addLog("📘 Обучение начато");
  }

  skipOnboarding() {
    this.onboarding.started = false;
    this.onboarding.skipped = true;
    this._saveOnboarding();
    this.addLog("⏭️ Обучение пропущено");
  }

  completeOnboarding() {
    this.onboarding.started = false;
    this.onboarding.completed = true;
    this._saveOnboarding();
    this.addLog("🎉 Обучение завершено!");
  }

  restartOnboarding() {
    this.onboarding = {
      started: true,
      skipped: false,
      completed: false,
      currentStep: 0,
    };
    this._saveOnboarding();
    this.addLog("📘 Обучение запущено заново");
  }

  getCurrentOnboardingStep() {
    if (!this.isOnboardingActive()) return null;
    const steps = this.data.onboarding.steps;
    if (this.onboarding.currentStep >= steps.length) return null;
    return steps[this.onboarding.currentStep];
  }

  advanceOnboardingStep() {
    this.onboarding.currentStep++;
    this._saveOnboarding();
  }

  // ─── Resource helpers ───

  addResource(id, amount) {
    if (!this.resources.hasOwnProperty(id)) return 0;
    const cap = this.maxResourceCap;
    const before = this.resources[id];
    this.resources[id] = Math.min(this.resources[id] + amount, cap);
    const added = this.resources[id] - before;
    this.totalResourcesCollected += added;
    this.resourceTotals[id] += added;
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

  // ─── Energy ───

  regenEnergy() {
    const now = Date.now();
    if (now - this.lastEnergyRegen >= this.energyRegenInterval) {
      const amount = this.energyRegenPerTick;
      const before = this.energy;
      this.energy = Math.min(this.energy + amount, this.maxEnergy);
      this.lastEnergyRegen = now;
      if (this.energy !== before) {
        this.addLog(`⚡ +${this.energy - before} энергии`);
      }
    }
  }

  hasEnergy(amount) {
    return this.energy >= amount;
  }

  spendEnergy(amount) {
    if (!this.hasEnergy(amount)) return false;
    this.energy -= amount;
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

  // ─── Gathering ───

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

    let output = { ...action.output };
    const bonus = this._getGatherBonus();
    if (bonus > 0) {
      for (const [id, amount] of Object.entries(output)) {
        output[id] = amount + bonus;
      }
    }

    for (const [id, amount] of Object.entries(output)) {
      this.addResource(id, amount);
    }

    this.cooldowns[actionId] = Date.now() + action.cooldown;
    this.addLog(
      `+${Object.entries(output)
        .map(([id, a]) => `${this.data.resources[id].icon}${a}`)
        .join(" ")} (⚡-${action.energyCost})`,
    );
    this._checkOnboarding();
    this._checkGoals();
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
    if (this.researched.basic_tools) {
      bonus += this.data.tech.basic_tools?.effect.gatherBonus || 0;
    }
    return bonus;
  }

  // ─── Crafting ───

  canCraft(recipeId) {
    const recipe = this.data.recipes[recipeId];
    if (!recipe) return false;
    if (!this.unlockedRecipes.has(recipeId)) return false;
    if (recipe.requires && !this.buildings[recipe.requires]) return false;
    if (!this.hasResources(this._getDiscountedCost(recipe.ingredients)))
      return false;
    return true;
  }

  craft(recipeId) {
    if (!this.canCraft(recipeId)) return false;
    const recipe = this.data.recipes[recipeId];
    const cost = this._getDiscountedCost(recipe.ingredients);

    if (!this.spendResources(cost)) return false;
    for (const [id, amount] of Object.entries(recipe.output)) {
      this.addResource(id, amount);
    }

    this.addLog(`Создано: ${recipe.icon} ${recipe.name}`);
    this._checkOnboarding();
    this._checkGoals();
    return true;
  }

  // ─── Buildings ───

  canBuild(buildingId) {
    const building = this.data.buildings[buildingId];
    if (!building) return false;
    if (building.unlockedBy && !this.researched[building.unlockedBy])
      return false;
    if (this.buildings[buildingId]) return false;
    if (!this.hasResources(building.cost)) return false;
    return true;
  }

  build(buildingId) {
    if (!this.canBuild(buildingId)) return false;
    const building = this.data.buildings[buildingId];
    if (!this.spendResources(building.cost)) return false;

    this.buildings[buildingId] = 1;

    if (building.effect.maxResourceCap) {
      this.maxResourceCap = building.effect.maxResourceCap;
    }
    if (building.effect.unlocks) {
      for (const recipeId of building.effect.unlocks) {
        this.unlockedRecipes.add(recipeId);
      }
    }
    if (building.effect.automation) {
      const autoId = building.effect.automation.id;
      this.automation[autoId] = { lastRun: 0, state: AUTO_STATE.WAITING };
    }
    if (building.effect.energy) {
      this._recalculateEnergyStats();
    }
    for (const [id, recipe] of Object.entries(this.data.recipes)) {
      if (recipe.requires === buildingId) {
        this.unlockedRecipes.add(id);
      }
    }

    this.addLog(`🏗️ Построено: ${building.icon} ${building.name}`);
    this._checkOnboarding();
    this._checkGoals();
    return true;
  }

  // ─── Automation ───

  tickAutomation() {
    const now = Date.now();

    for (const [buildingId] of Object.entries(this.buildings)) {
      const building = this.data.buildings[buildingId];
      if (!building || !building.effect.automation) continue;

      const auto = building.effect.automation;
      const autoId = auto.id;

      if (!this.automation[autoId]) {
        this.automation[autoId] = { lastRun: 0, state: AUTO_STATE.WAITING };
      }

      const state = this.automation[autoId];
      const hasInput = this.hasResources(auto.input);

      if (!hasInput) {
        state.state = AUTO_STATE.WAITING;
        state.lastRun = 0;
        continue;
      }

      if (state.lastRun === 0) {
        state.lastRun = now;
        state.state = AUTO_STATE.RUNNING;
        continue;
      }

      const elapsed = now - state.lastRun;
      if (elapsed >= auto.intervalMs) {
        this.spendResources(auto.input);
        for (const [id, amount] of Object.entries(auto.output)) {
          this.addResource(id, amount);
        }
        this.addLog(
          `🔥 Авто: ${building.icon} ${auto.name} → ${Object.entries(
            auto.output,
          )
            .map(([rid, a]) => `${this.data.resources[rid].icon}+${a}`)
            .join(" ")}`,
        );
        this._checkOnboarding();
        this._checkGoals();
        state.lastRun = now;
        state.state = AUTO_STATE.RUNNING;
      } else {
        state.state = AUTO_STATE.RUNNING;
      }
    }
  }

  getAutomationState(automationId) {
    const entry = this.automation[automationId];
    if (!entry) return AUTO_STATE.IDLE;
    return entry.state;
  }

  getAutomationProgress(automationId) {
    const entry = this.automation[automationId];
    if (!entry || entry.lastRun === 0) return 0;
    for (const building of Object.values(this.data.buildings)) {
      if (
        building.effect.automation &&
        building.effect.automation.id === automationId
      ) {
        const interval = building.effect.automation.intervalMs;
        const elapsed = Date.now() - entry.lastRun;
        return Math.min(1, elapsed / interval);
      }
    }
    return 0;
  }

  getAutomationRemaining(automationId) {
    const entry = this.automation[automationId];
    if (!entry || entry.lastRun === 0) return 0;
    for (const building of Object.values(this.data.buildings)) {
      if (
        building.effect.automation &&
        building.effect.automation.id === automationId
      ) {
        const interval = building.effect.automation.intervalMs;
        const elapsed = Date.now() - entry.lastRun;
        return Math.max(0, (interval - elapsed) / 1000);
      }
    }
    return 0;
  }

  getMissingResources(costObj) {
    return Object.entries(costObj)
      .filter(([id, amount]) => (this.resources[id] || 0) < amount)
      .map(([id, amount]) => ({
        id,
        missing: amount - (this.resources[id] || 0),
      }));
  }

  // ─── Onboarding check ───

  _checkOnboarding() {
    if (!this.isOnboardingActive()) return;

    const step = this.getCurrentOnboardingStep();
    if (!step) return;

    if (step.check(this)) {
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
  }

  // ─── Goals (post-onboarding) ───

  _checkGoals() {
    if (this.isOnboardingActive()) return;
    if (this.onboarding.skipped) {
      // Goals work normally when skipped
    }
    if (this.allGoalsComplete) return;

    while (this.currentGoalIndex < this.data.goals.length) {
      const goal = this.data.goals[this.currentGoalIndex];
      if (goal.check(this)) {
        this.completedGoals.push(goal.id);
        this.addLog(`🎯 Цель: ${goal.text}`);
        this.currentGoalIndex++;
      } else {
        break;
      }
    }

    if (this.currentGoalIndex >= this.data.goals.length) {
      this.allGoalsComplete = true;
      this.addLog("🏆 Все цели выполнены!");
    }
  }

  getCurrentGoal() {
    if (this.isOnboardingActive()) return null;
    if (this.allGoalsComplete) return null;
    if (this.currentGoalIndex >= this.data.goals.length) return null;
    return this.data.goals[this.currentGoalIndex];
  }

  getGoalProgress() {
    const goal = this.getCurrentGoal();
    const total = this.data.goals.length;
    const done = this.completedGoals.length;
    const current = goal
      ? Math.min(goal.target || 1, goal.progress ? goal.progress(this) : goal.check(this) ? 1 : 0)
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

  // ─── Research ───

  canResearch(techId) {
    const tech = this.data.tech[techId];
    if (!tech) return false;
    if (this.researched[techId]) return false;
    if (tech.requires && !this.buildings[tech.requires]) return false;
    if (!this.hasResources(tech.cost)) return false;
    return true;
  }

  research(techId) {
    if (!this.canResearch(techId)) return false;
    const tech = this.data.tech[techId];
    if (!this.spendResources(tech.cost)) return false;

    this.researched[techId] = true;
    if (tech.effect.craftDiscount) {
      this.craftDiscount = tech.effect.craftDiscount;
    }
    if (tech.effect.energy) {
      this._recalculateEnergyStats();
    }

    this.addLog(`🔬 Изучено: ${tech.icon} ${tech.name}`);
    this._checkOnboarding();
    this._checkGoals();
    return true;
  }

  // ─── Log ───

  addLog(message) {
    this.log.unshift({ time: new Date().toLocaleTimeString(), message });
    if (this.log.length > 50) this.log.pop();
  }

  // ─── Progress ───

  getProgressSummary() {
    return {
      resourcesOwned: this.totalResourcesCollected,
      buildingsBuilt: Object.keys(this.buildings).length,
      techResearched: Object.keys(this.researched).length,
    };
  }
}
