/**
 * UI — renders game state into the DOM and handles user input.
 * Core Loop v4:
 * - Onboarding intro screen (Start / Skip)
 * - Step-by-step tutorial display with hints
 * - Skip button always available during tutorial
 * - Goals panel (post-onboarding)
 * - Automation state display
 */
class UI {
  constructor(game) {
    this.game = game;
    this.data = game.data;
  }

  render() {
    if (this.game.shouldShowOnboardingIntro()) {
      this.renderOnboardingIntro();
      this.hideOnboardingStep();
      this.hideGoals();
    } else if (this.game.isOnboardingActive()) {
      this.hideOnboardingIntro();
      this.renderOnboardingStep();
      this.hideGoals();
    } else {
      this.hideOnboarding();
      this.renderGoals();
    }

    this.renderEnergy();
    this.renderResources();
    this.renderGather();
    this.renderCrafting();
    this.renderBuildings();
    this.renderAutomation();
    this.renderResearch();
    this.renderLog();
    this.renderProgress();
  }

  // ─── Onboarding ───

  renderOnboardingIntro() {
    const container = document.getElementById("onboarding-intro-panel");
    if (!container) return;
    container.style.display = "block";

    const lines = this.data.onboarding.introLines;
    container.innerHTML = `
      <div class="onboarding-intro-content">
        <h3 class="onboarding-intro-title">🌍 Добро пожаловать</h3>
        <p class="onboarding-intro-text">${lines.join("<br>")}</p>
        <div class="onboarding-intro-buttons">
          <button id="obStartBtn" class="ob-btn ob-btn-start">Начать обучение</button>
          <button id="obSkipBtn" class="ob-btn ob-btn-skip">Пропустить</button>
        </div>
      </div>
    `;

    document.getElementById("obStartBtn").addEventListener("click", () => {
      this.game.startOnboarding();
      this.render();
    });

    document.getElementById("obSkipBtn").addEventListener("click", () => {
      this.game.skipOnboarding();
      container.style.display = "none";
      this.render();
    });
  }

  renderOnboardingStep() {
    const container = document.getElementById("onboarding-step-panel");
    if (!container) return;
    container.style.display = "block";

    const step = this.game.getCurrentOnboardingStep();
    if (!step) {
      container.style.display = "none";
      return;
    }

    const steps = this.data.onboarding.steps;
    const currentIdx = this.game.onboarding.currentStep;
    const progressPct = Math.round((currentIdx / steps.length) * 100);

    container.innerHTML = `
      <div class="onboarding-step-content">
        <div class="onboarding-step-header">
          <h3>📖 Обучение — шаг ${currentIdx + 1} из ${steps.length}</h3>
          <button id="obSkipStepBtn" class="ob-btn ob-btn-skip-small">Пропустить</button>
        </div>
        <div class="onboarding-step-text">${step.text}</div>
        <div class="onboarding-step-hint">💡 ${step.hint}</div>
        <div class="onboarding-step-bar">
          <div class="onboarding-step-bar-fill" style="width:${progressPct}%"></div>
        </div>
      </div>
    `;

    document.getElementById("obSkipStepBtn").addEventListener("click", () => {
      this.game.skipOnboarding();
      this.render();
    });
  }

  hideOnboarding() {
    const intro = document.getElementById("onboarding-intro-panel");
    const step = document.getElementById("onboarding-step-panel");
    if (intro) intro.style.display = "none";
    if (step) step.style.display = "none";
  }

  hideOnboardingIntro() {
    const intro = document.getElementById("onboarding-intro-panel");
    if (intro) intro.style.display = "none";
  }

  hideOnboardingStep() {
    const step = document.getElementById("onboarding-step-panel");
    if (step) step.style.display = "none";
  }

  hideGoals() {
    const container = document.getElementById("goals-panel");
    if (container) container.style.display = "none";
  }

  // ─── Goals (post-onboarding) ───

  renderGoals() {
    const container = document.getElementById("goals-panel");
    if (!container) return;
    container.style.display = "block";
    container.innerHTML = "";

    const goal = this.game.getCurrentGoal();
    const progress = this.game.getGoalProgress();

    if (!goal) {
      container.innerHTML = `
        <h3>🎯 Цели</h3>
        <div class="goal-complete">✅ Все цели выполнены!</div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width:100%"></div>
        </div>
        <div class="goal-progress-text">${progress.done} / ${progress.total}</div>
        <button id="restartOnboardingBtn" class="ob-btn ob-btn-start">Начать обучение заново</button>
      `;
      document.getElementById("restartOnboardingBtn").addEventListener("click", () => {
        this.game.restartOnboarding();
        this.render();
      });
      return;
    }

    container.innerHTML = `
      <h3>🎯 Текущая цель</h3>
      <div class="goal-current">
        <span class="goal-number">${progress.done + 1}</span>
        <span class="goal-text">${goal.text}</span>
      </div>
      <div class="goal-progress-bar">
        <div class="goal-progress-fill" style="width:${progress.currentPct}%"></div>
      </div>
      <div class="goal-progress-text">${progress.current} / ${progress.target}</div>
    `;
    container.innerHTML += `<button id="restartOnboardingBtn" class="ob-btn ob-btn-start">\u041d\u0430\u0447\u0430\u0442\u044c \u043e\u0431\u0443\u0447\u0435\u043d\u0438\u0435 \u0437\u0430\u043d\u043e\u0432\u043e</button>`;
    document.getElementById("restartOnboardingBtn").addEventListener("click", () => {
      this.game.restartOnboarding();
      this.render();
    });
  }

  // ─── Energy ───

  renderEnergy() {
    const container = document.getElementById("energy-panel");
    container.innerHTML = "";

    const pct = (this.game.energy / this.game.maxEnergy) * 100;
    const regenSec = (this.game.getEnergyRegenRemaining() / 1000).toFixed(1);
    const bonus = this.game._getGatherBonus();

    container.innerHTML = `
      <h3>⚡ Энергия</h3>
      <div class="energy-bar-container">
        <div class="energy-bar-fill" style="width:${pct}%"></div>
        <span class="energy-bar-text">${this.game.energy} / ${this.game.maxEnergy}</span>
      </div>
      <div class="energy-info">
        <span>🔄 +${this.game.energyRegenPerTick} через ${regenSec}с</span>
        ${bonus > 0 ? `<span class="energy-bonus">🔧 Бонус: +${bonus}</span>` : ""}
      </div>
    `;
  }

  // ─── Resources ───

  renderResources() {
    const container = document.getElementById("resources-panel");
    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = `📦 Ресурсы (лимит: ${this.game.maxResourceCap})`;
    container.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "resource-grid";

    for (const [id, def] of Object.entries(this.data.resources)) {
      const count = this.game.resources[id] || 0;

      const el = document.createElement("div");
      el.className = "resource-item";
      el.innerHTML = `
        <span class="resource-icon" style="color:${def.color}">${def.icon}</span>
        <span class="resource-name">${def.name}</span>
        <span class="resource-count">${count}</span>
      `;
      grid.appendChild(el);
    }

    container.appendChild(grid);
  }

  // ─── Gather ───

  renderGather() {
    const container = document.getElementById("gather-panel");
    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "🖐️ Сбор ресурсов";
    container.appendChild(title);

    const bonus = this.game._getGatherBonus();

    for (const [id, action] of Object.entries(this.data.gatherActions)) {
      const btn = document.createElement("button");
      btn.className = "action-btn";
      const cooldown = this.game.getCooldownRemaining(id);
      const disabled = cooldown > 0 || !this.game.hasEnergy(action.energyCost);

      let output = { ...action.output };
      if (bonus > 0) {
        for (const [rid, amount] of Object.entries(output)) {
          output[rid] = amount + bonus;
        }
      }

      const outStr = Object.entries(output)
        .map(([rid, amount]) => `${this.data.resources[rid].icon}+${amount}`)
        .join(" ");

      btn.innerHTML = `
        <span class="btn-icon">${action.icon}</span>
        <span class="btn-label">${action.name}</span>
        <span class="btn-output">${outStr}</span>
        <span class="btn-cost">⚡ -${action.energyCost}</span>
        ${cooldown > 0 ? `<span class="btn-cooldown">⏳ ${(cooldown / 1000).toFixed(1)}s</span>` : ""}
        ${!this.game.hasEnergy(action.energyCost) && cooldown === 0 ? '<span class="btn-cooldown">⚡ Нет энергии</span>' : ""}
      `;
      btn.disabled = disabled;
      if (disabled) btn.classList.add("cooldown");

      btn.addEventListener("click", () => {
        if (this.game.gather(id)) this.render();
      });

      container.appendChild(btn);
    }
  }

  // ─── Crafting ───

  renderCrafting() {
    const container = document.getElementById("craft-panel");
    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "⚒️ Крафт";
    container.appendChild(title);

    for (const [id, recipe] of Object.entries(this.data.recipes)) {
      const unlocked = this.game.unlockedRecipes.has(id);
      const meetsReqs =
        !recipe.requires || this.game.buildings[recipe.requires];
      const canDo = this.game.canCraft(id);

      const el = document.createElement("div");
      el.className = "recipe-card";

      if (!unlocked || !meetsReqs) {
        el.classList.add("locked");
        const reqName = recipe.requires
          ? this.data.buildings[recipe.requires]?.name || recipe.requires
          : null;
        el.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-label">${recipe.name}</span>
          ${reqName ? `<span class="btn-cooldown">Требуется: ${reqName}</span>` : ""}
        `;
      } else {
        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.disabled = !canDo;
        if (!canDo) btn.classList.add("disabled");

        const costStr = Object.entries(recipe.ingredients)
          .map(([rid, amount]) => `${this.data.resources[rid].icon}${amount}`)
          .join(" ");
        const outStr = Object.entries(recipe.output)
          .map(([rid, amount]) => `${this.data.resources[rid].icon}+${amount}`)
          .join(" ");

        btn.innerHTML = `
          <span class="btn-icon">${recipe.icon}</span>
          <span class="btn-label">${recipe.name}</span>
          <span class="btn-flow">${costStr} → ${outStr}</span>
          ${recipe.description ? `<span class="btn-desc">${recipe.description}</span>` : ""}
        `;

        btn.addEventListener("click", () => {
          if (this.game.craft(id)) this.render();
        });

        el.appendChild(btn);
      }

      container.appendChild(el);
    }
  }

  // ─── Buildings ───

  renderBuildings() {
    const container = document.getElementById("buildings-panel");
    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "🏗️ Здания";
    container.appendChild(title);

    for (const [id, building] of Object.entries(this.data.buildings)) {
      const alreadyBuilt = this.game.buildings[id];
      const canDo = this.game.canBuild(id);

      const el = document.createElement("div");
      el.className = "building-card";

      if (alreadyBuilt) {
        el.classList.add("built");
        let extraInfo = `<span class="building-status">✅ Построено</span>`;

        if (building.effect.automation) {
          const auto = building.effect.automation;
          const autoId = auto.id;
          const state = this.game.getAutomationState(autoId);
          const remaining = this.game.getAutomationRemaining(autoId);

          const inputStr = Object.entries(auto.input)
            .map(([rid, a]) => `${this.data.resources[rid].icon}${a}`)
            .join(" ");
          const outputStr = Object.entries(auto.output)
            .map(([rid, a]) => `${this.data.resources[rid].icon}+${a}`)
            .join(" ");

          let stateLabel = "";
          let stateClass = "";
          if (state === "running") {
            stateLabel = `⏳ ${remaining.toFixed(1)}с`;
            stateClass = "state-running";
          } else if (state === "waiting") {
            stateLabel = `⚠️ Нет ${inputStr}`;
            stateClass = "state-waiting";
          }

          extraInfo += `
            <div class="automation-inline">
              <span class="automation-flow">${inputStr} → ${outputStr}</span>
              <span class="automation-state ${stateClass}">${stateLabel}</span>
            </div>
          `;
        }

        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${building.name}</span>
          ${extraInfo}
        `;
      } else {
        const costStr = Object.entries(building.cost)
          .map(([rid, amount]) => `${this.data.resources[rid].icon}${amount}`)
          .join(" ");

        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.disabled = !canDo;
        if (!canDo) btn.classList.add("disabled");

        let unlocksInfo = "";
        if (building.effect.unlocks && building.effect.unlocks.length > 0) {
          const recipeNames = building.effect.unlocks
            .map((rid) => this.data.recipes[rid]?.name || rid)
            .join(", ");
          unlocksInfo = `<span class="btn-desc">🔓 Открывает: ${recipeNames}</span>`;
        }
        if (building.effect.automation) {
          const auto = building.effect.automation;
          const interval = (auto.intervalMs / 1000).toFixed(0);
          const inputStr = Object.entries(auto.input)
            .map(([rid, a]) => `${this.data.resources[rid].icon}${a}`)
            .join(" ");
          const outputStr = Object.entries(auto.output)
            .map(([rid, a]) => `${this.data.resources[rid].icon}+${a}`)
            .join(" ");
          unlocksInfo = `<span class="btn-desc">⚙️ Авто: ${inputStr} → ${outputStr} / ${interval}с</span>`;
        }

        btn.innerHTML = `
          <span class="btn-icon">${building.icon}</span>
          <span class="btn-label">${building.name}</span>
          <span class="btn-desc">${building.description}</span>
          ${unlocksInfo}
          <span class="btn-cost">Стоимость: ${costStr}</span>
        `;

        btn.addEventListener("click", () => {
          if (this.game.build(id)) this.render();
        });

        el.appendChild(btn);
      }

      container.appendChild(el);
    }
  }

  // ─── Automation ───

  renderAutomation() {
    const container = document.getElementById("automation-panel");
    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "⚙️ Автоматизация";
    container.appendChild(title);

    let anyActive = false;

    for (const [buildingId] of Object.entries(this.game.buildings)) {
      const building = this.data.buildings[buildingId];
      if (!building || !building.effect.automation) continue;

      anyActive = true;
      const auto = building.effect.automation;
      const autoId = auto.id;
      const state = this.game.getAutomationState(autoId);
      const progress = this.game.getAutomationProgress(autoId);
      const remaining = this.game.getAutomationRemaining(autoId);

      const el = document.createElement("div");
      el.className = "automation-card";

      const inputStr = Object.entries(auto.input)
        .map(([rid, a]) => `${this.data.resources[rid].icon}${a}`)
        .join(" ");
      const outputStr = Object.entries(auto.output)
        .map(([rid, a]) => `${this.data.resources[rid].icon}+${a}`)
        .join(" ");

      let stateDisplay = "";
      let progressHtml = "";

      if (state === "running") {
        stateDisplay = `<span class="automation-state-label state-running">🔄 Работает — ${remaining.toFixed(1)}с</span>`;
        progressHtml = `
          <div class="automation-bar">
            <div class="automation-bar-fill" style="width:${progress * 100}%"></div>
          </div>
        `;
      } else if (state === "waiting") {
        stateDisplay = `<span class="automation-state-label state-waiting">⚠️ Ожидание — нет ${inputStr}</span>`;
        progressHtml = `<div class="automation-bar"><div class="automation-bar-fill" style="width:0%"></div></div>`;
      } else {
        stateDisplay = `<span class="automation-state-label state-idle">⏸ Неактивно</span>`;
      }

      el.innerHTML = `
        <span class="btn-icon">${building.icon}</span>
        <span class="btn-label">${building.name}</span>
        <span class="automation-flow">${inputStr} → ${outputStr}</span>
        ${stateDisplay}
        ${progressHtml}
      `;

      container.appendChild(el);
    }

    if (!anyActive) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Постройте здания с автоматизацией (напр. Костёр)";
      container.appendChild(hint);
    }
  }

  // ─── Research ───

  renderResearch() {
    const container = document.getElementById("research-panel");
    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "🔬 Исследования";
    container.appendChild(title);

    for (const [id, tech] of Object.entries(this.data.tech)) {
      const done = this.game.researched[id];
      const canDo = this.game.canResearch(id);
      const meetsReqs = !tech.requires || this.game.buildings[tech.requires];

      const el = document.createElement("div");
      el.className = "tech-card";

      if (done) {
        el.classList.add("done");
        el.innerHTML = `
          <span class="tech-icon">${tech.icon}</span>
          <span class="tech-name">${tech.name}</span>
          <span class="tech-status">✅ Изучено</span>
        `;
      } else if (!meetsReqs) {
        el.classList.add("locked");
        const reqBuilding = this.data.buildings[tech.requires];
        el.innerHTML = `
          <span class="tech-icon">🔒</span>
          <span class="tech-name">${tech.name}</span>
          <span class="tech-req">Требуется: ${reqBuilding ? reqBuilding.icon + " " + reqBuilding.name : tech.requires}</span>
        `;
      } else {
        const costStr = Object.entries(tech.cost)
          .map(([rid, amount]) => `${this.data.resources[rid].icon}${amount}`)
          .join(" ");

        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.disabled = !canDo;
        if (!canDo) btn.classList.add("disabled");

        btn.innerHTML = `
          <span class="btn-icon">${tech.icon}</span>
          <span class="btn-label">${tech.name}</span>
          <span class="btn-desc">${tech.description}</span>
          <span class="btn-cost">Стоимость: ${costStr}</span>
        `;

        btn.addEventListener("click", () => {
          if (this.game.research(id)) this.render();
        });

        el.appendChild(btn);
      }

      container.appendChild(el);
    }
  }

  // ─── Log ───

  renderLog() {
    const container = document.getElementById("log-panel");
    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "📋 Журнал";
    container.appendChild(title);

    const logContainer = document.createElement("div");
    logContainer.className = "log-entries";

    const entries = this.game.log.slice(0, 15);
    if (entries.length === 0) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Здесь будут отображаться ваши действия";
      logContainer.appendChild(p);
    } else {
      for (const entry of entries) {
        const el = document.createElement("div");
        el.className = "log-entry";
        el.textContent = entry.message;
        logContainer.appendChild(el);
      }
    }

    container.appendChild(logContainer);
  }

  // ─── Progress ───

  renderProgress() {
    const container = document.getElementById("progress-panel");
    const summary = this.game.getProgressSummary();

    container.innerHTML = `
      <h3>📊 Прогресс</h3>
      <div class="progress-stat">Ресурсов получено: <strong>${summary.resourcesOwned}</strong></div>
      <div class="progress-stat">Зданий построено: <strong>${summary.buildingsBuilt}</strong></div>
      <div class="progress-stat">Технологий изучено: <strong>${summary.techResearched}</strong></div>
    `;
  }
}
