/**
 * UI — renders game state into the DOM and handles user input.
 * Keeps the prototype readable and decision-focused.
 */
class UI {
  constructor(game) {
    this.game = game;
    this.data = game.data;
    this.lastResourcesRenderKey = "";
    this.isPointerDown = false;
    this.bindStaticControls();
  }

  bindStaticControls() {
    window.addEventListener("pointerdown", () => {
      this.isPointerDown = true;
    });
    window.addEventListener("pointerup", () => {
      this.isPointerDown = false;
    });
    window.addEventListener("pointercancel", () => {
      this.isPointerDown = false;
    });

    const resetBtn = document.getElementById("reset-progress-btn");
    if (!resetBtn) return;

    resetBtn.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Сбросить весь прогресс и начать новую игру?",
      );
      if (!confirmed) return;

      if (this.game.resetProgress()) {
        window.location.reload();
      } else {
        window.alert("Не удалось сбросить прогресс.");
      }
    });

    const restartObBtn = document.getElementById("restart-onboarding-btn");
    if (restartObBtn) {
      restartObBtn.addEventListener("click", () => {
        this.game.restartOnboarding();
        this.render({ forcePanels: true });
      });
    }

    const saveStatusEl = document.getElementById("save-status");
    const savePopup = document.getElementById("save-interval-popup");
    const saveInput = document.getElementById("save-interval-input");

    if (saveStatusEl && savePopup && saveInput) {
      const openPopup = () => {
        saveInput.value = this.game.getSaveIntervalSec();
        savePopup.hidden = false;
        saveInput.focus();
        saveInput.select();
      };

      const closePopup = () => {
        savePopup.hidden = true;
      };

      const applyInterval = () => {
        const sec = parseInt(saveInput.value, 10);
        if (Number.isFinite(sec)) {
          const appliedMs = this.game.setSaveInterval(sec * 1000);
          saveInput.value = String(Math.round(appliedMs / 1000));
          this.renderSaveStatus();
        } else {
          saveInput.value = this.game.getSaveIntervalSec();
        }
        closePopup();
      };

      saveStatusEl.addEventListener("click", openPopup);

      saveInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyInterval();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closePopup();
        }
      });

      // Apply on blur only if focus left the popup entirely
      saveInput.addEventListener("blur", (e) => {
        if (!savePopup.contains(e.relatedTarget)) {
          applyInterval();
        }
      });
    }

    this.bindChangelogModal();
    this.bindResearchModal();
  }

  bindChangelogModal() {
    const btn = document.getElementById("changelog-btn");
    const modal = document.getElementById("changelog-modal");
    const closeBtn = document.getElementById("changelog-close-btn");
    const content = document.getElementById("changelog-content");
    if (!btn || !modal || !closeBtn || !content) return;

    const open = () => {
      content.innerHTML = this._renderChangelogContent();
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    };

    const close = () => {
      modal.style.display = "none";
      document.body.style.overflow = "";
      btn.focus();
    };

    btn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") close();
    });
  }

  _renderChangelogContent() {
    if (typeof CHANGELOG_DATA === "undefined" || !CHANGELOG_DATA.length) {
      return "<p>История изменений пуста.</p>";
    }

    const typeLabelMap = {
      new: "Новое",
      improved: "Улучшено",
      fixed: "Исправлено",
    };

    return CHANGELOG_DATA.map((entry, i) => {
      const changes = entry.changes
        .map((c) => {
          const label = typeLabelMap[c.type] || c.type;
          return `<li class="cl-change-item">
            <span class="cl-change-badge ${c.type}">${label}</span>
            <span>${c.text}</span>
          </li>`;
        })
        .join("");

      const divider =
        i < CHANGELOG_DATA.length - 1 ? '<hr class="cl-divider">' : "";

      return `<div class="cl-version-block">
        <div class="cl-version-header">
          <span class="cl-version-tag">${entry.version}</span>
          <span class="cl-version-date">${entry.date}</span>
        </div>
        <div class="cl-version-title">${entry.title}</div>
        <ul class="cl-changes-list" style="margin-top:0.5rem">${changes}</ul>
      </div>${divider}`;
    }).join("");
  }

  bindResearchModal() {
    const modal = document.getElementById("research-modal");
    const closeBtn = document.getElementById("research-modal-close-btn");
    if (!modal || !closeBtn) return;

    const close = () => {
      modal.style.display = "none";
      document.body.style.overflow = "";
    };

    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") close();
    });
  }

  renderResearchWidget() {
    const container = document.getElementById("research-widget");
    if (!container) return;

    const researchState = this.game.getResearchState();
    const branchState = this.game.getResearchBranchesState();
    const totalDone = Object.keys(this.game.researched).length;
    const startedBranches = branchState.branches.filter((b) => b.started).length;

    const hasAvailable =
      branchState.branches.some((b) => b.techs.some((t) => this.game.canResearch(t.id))) ||
      branchState.foundation.some((t) => this.game.canResearch(t.id));

    let activeHtml = "";
    if (researchState) {
      const pct = Math.round(researchState.progress * 100);
      const queuedTech = this.game.researchQueue.length > 0
        ? this.data.tech[this.game.researchQueue[0].techId]
        : null;
      const queueHtml = queuedTech
        ? `<div class="rw-queue-row"><span class="rw-queue-label">📋</span><span class="rw-queue-name">${queuedTech.icon} ${queuedTech.name}</span></div>`
        : "";
      activeHtml = `
        <div class="rw-active">
          <div class="rw-active-info">
            <span class="rw-active-label">Исследуется:</span>
            <span class="rw-active-name">${researchState.icon} ${researchState.name}</span>
            <span class="rw-active-time">${this.formatSeconds(researchState.remainingMs)}</span>
          </div>
          <div class="rw-progress-bar"><div class="rw-progress-fill" style="width:${pct}%"></div></div>
          ${queueHtml}
        </div>`;
    }

    const indicatorClass = researchState ? "is-active" : hasAvailable ? "has-available" : "";
    const btnLabel = researchState
      ? "Управлять исследованиями"
      : hasAvailable
      ? "Открыть исследования ✦"
      : "Открыть исследования";

    container.innerHTML = `
      <div class="rw-header">
        <div class="rw-title">
          🔬 <span>Исследования</span>
          ${indicatorClass ? `<span class="rw-dot ${indicatorClass}"></span>` : ""}
        </div>
        <div class="rw-chips">
          <span class="research-summary-chip">Изучено: ${totalDone}</span>
          <span class="research-summary-chip">Ветви: ${startedBranches}/${branchState.branches.length}</span>
        </div>
      </div>
      ${activeHtml}
      <button class="rw-open-btn js-research-open" type="button">${btnLabel}</button>
    `;

    container.querySelector(".js-research-open")?.addEventListener("click", () => {
      const modal = document.getElementById("research-modal");
      if (!modal) return;
      this.renderResearchModalContent();
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
      document.getElementById("research-modal-close-btn")?.focus();
    });
  }

  renderResearchModalContent() {
    const container = document.getElementById("research-modal-body");
    if (!container) return;
    this._renderResearchBody(container);
  }

  formatResourcePairs(resourceMap, { plus = false, decimals = 0 } = {}) {
    return Object.entries(resourceMap)
      .map(([id, amount]) => {
        const value =
          decimals > 0 ? Number(amount).toFixed(decimals) : String(amount);
        return `${this.data.resources[id].icon}${plus ? "+" : ""}${value}`;
      })
      .join(" ");
  }

  formatSeconds(ms) {
    return `${(ms / 1000).toFixed(1)}с`;
  }

  formatCooldownMs(ms) {
    if (ms <= 0) return "0.0с";
    const deciseconds = Math.ceil(ms / 100);
    const shown = Math.max(1, deciseconds) / 10;
    return `${shown.toFixed(1)}с`;
  }

  formatTooltipText(lines) {
    return lines
      .filter((line) => typeof line === "string" && line.trim().length > 0)
      .map((line) => line.trim())
      .join("\n");
  }

  setTooltip(element, lines) {
    if (!element) return;
    const text = this.formatTooltipText(lines);
    if (!text) return;
    element.classList.add("has-tooltip");
    element.setAttribute("data-tooltip", text);
  }

  setButtonAvailability(button, isAvailable) {
    if (!button) return;
    button.disabled = false;
    button.classList.toggle("disabled", !isAvailable);
    button.setAttribute("aria-disabled", isAvailable ? "false" : "true");
  }

  isPanelHovered(panelId) {
    if (!panelId) return false;
    const panel = document.getElementById(panelId);
    return !!panel && panel.matches(":hover");
  }

  render({ forcePanels = false } = {}) {
    // Prevent click loss when DOM is rebuilt between pointer down/up.
    if (this.isPointerDown) {
      this.renderEnergy();
      this.renderSaveStatus();
      return;
    }

    if (this.game.shouldShowOnboardingIntro()) {
      this.renderOnboardingIntro();
      this.hideOnboardingStep();
    } else if (this.game.isOnboardingActive()) {
      this.hideOnboardingIntro();
      this.renderOnboardingStep();
    } else {
      this.hideOnboarding();
    }

    if (forcePanels || !this.isPanelHovered("energy-panel")) {
      this.renderEnergy();
    }
    if (forcePanels || !this.isPanelHovered("resources-panel")) {
      this.renderResources();
    }
    if (forcePanels || !this.isPanelHovered("gather-panel")) {
      this.renderGather();
    }
    if (forcePanels || !this.isPanelHovered("craft-panel")) {
      this.renderCrafting();
    }
    if (forcePanels || !this.isPanelHovered("buildings-panel")) {
      this.renderBuildings();
    }
    if (forcePanels || !this.isPanelHovered("automation-panel")) {
      this.renderAutomation();
    }
    this.renderResearchWidget();
    const _rModal = document.getElementById("research-modal");
    if (_rModal && _rModal.style.display !== "none" && !this.isPanelHovered("research-modal-body")) {
      this.renderResearchModalContent();
    }
    this.renderLog();
    this.renderEraProgress();
    this.renderSaveStatus();
  }

  renderOnboardingIntro() {
    const container = document.getElementById("onboarding-intro-panel");
    if (!container) return;

    container.style.display = "block";
    const lines = this.data.onboarding.introLines;
    container.innerHTML = `
      <img class="intro-hero-image" src="assets/intro-campfire.jpg" alt="" aria-hidden="true" onerror="this.src='assets/intro-campfire.svg'; this.onerror=null;">
      <div class="intro-hero-overlay"></div>
      <div class="onboarding-intro-content">
        <p class="intro-era-label">— Начало пути —</p>
        <h2 class="onboarding-intro-title">🌍 На заре человечества</h2>
        <div class="onboarding-intro-text">
          ${lines.map((l) => `<p>${l}</p>`).join("")}
        </div>
        <div class="onboarding-intro-buttons">
          <button id="obStartBtn" class="ob-btn ob-btn-start">📖 Начать обучение</button>
          <button id="obSkipBtn" class="ob-btn ob-btn-skip">Пропустить</button>
        </div>
      </div>
    `;

    document.getElementById("obStartBtn").addEventListener("click", () => {
      this.game.startOnboarding();
      this.render({ forcePanels: true });
    });

    document.getElementById("obSkipBtn").addEventListener("click", () => {
      this.game.skipOnboarding();
      container.style.display = "none";
      this.render({ forcePanels: true });
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
      this.render({ forcePanels: true });
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

  renderEnergy() {
    const container = document.getElementById("energy-panel");
    if (!container) return;

    container.innerHTML = "";
    const pct = (this.game.energy / this.game.maxEnergy) * 100;
    const regenSec = (this.game.getEnergyRegenRemaining() / 1000).toFixed(1);
    const modifiers = this.game.getEnergyModifiers();
    const regenDeltaSec = (modifiers.regenIntervalBonusMs / 1000).toFixed(1);

    container.classList.remove("is-low", "is-critical");
    if (pct <= 10) {
      container.classList.add("is-critical");
    } else if (pct < 20) {
      container.classList.add("is-low");
    }

    const warning =
      pct <= 10
        ? `<span class="energy-warning">Нужна пауза: энергии почти не осталось</span>`
        : pct < 20
          ? `<span class="energy-warning">Мало энергии: выбирайте действия осторожно</span>`
          : "";

    container.innerHTML = `
      <div class="energy-topline">
        <span class="energy-title">⚡ Энергия</span>
        <span class="energy-value">${this.game.energy} / ${this.game.maxEnergy}</span>
      </div>
      <div class="energy-bar-container">
        <div class="energy-bar-fill" style="width:${pct}%"></div>
        <span class="energy-bar-text">${Math.round(pct)}%</span>
      </div>
      <div class="energy-info">
        <span>🔄 +${this.game.energyRegenPerTick} через ${regenSec}с</span>
        ${modifiers.maxBonus > 0 ? `<span class="energy-bonus">🔋 запас +${modifiers.maxBonus}</span>` : ""}
        ${modifiers.regenIntervalBonusMs > 0 ? `<span class="energy-bonus">⏱ восстановление -${regenDeltaSec}с</span>` : ""}
      </div>
      ${warning}
    `;

    this.setTooltip(container, [
      "Энергия: тратится на ручной сбор",
      `Сейчас: ${this.game.energy} / ${this.game.maxEnergy}`,
      pct < 20
        ? "Низкая энергия: выбирайте только приоритетные действия"
        : "Чем выше энергия, тем дольше можно собирать без паузы",
    ]);
  }

  renderResources() {
    const container = document.getElementById("resources-panel");
    if (!container) return;

    const storageStatus = this.game.getStorageStatus();
    const storageTotals = this.game.getStorageTotals();
    const storageGroups = this.game.getStorageCategoryBreakdown();
    const recentOverflow = this.game.getRecentOverflow();
    const bonus = this.game._getGatherBonus();
    const renderKey = JSON.stringify({
      cap: this.game.maxResourceCap,
      resources: this.game.resources,
      near: storageStatus.isNearFull,
      full: storageStatus.isFull,
      highest: storageStatus.highest.id,
      bonus,
      used: storageTotals.used,
      free: storageTotals.free,
      totalCap: storageTotals.capacity,
      overflow: recentOverflow
        ? `${recentOverflow.id}:${recentOverflow.lost}`
        : null,
    });
    if (renderKey === this.lastResourcesRenderKey) {
      return;
    }
    this.lastResourcesRenderKey = renderKey;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "📦 Склад и ресурсы";
    container.appendChild(title);

    const storageSummary = document.createElement("div");
    storageSummary.className = "storage-summary";
    storageSummary.textContent = `Занято: ${storageTotals.used} / ${storageTotals.capacity}`;
    this.setTooltip(storageSummary, [
      "Суммарная занятость склада по всем ресурсам",
      `Использовано: ${storageTotals.used} из ${storageTotals.capacity}`,
      `Свободно: ${storageTotals.free}`,
      `Лимит на один ресурс: ${this.game.maxResourceCap}`,
    ]);
    container.appendChild(storageSummary);

    const storageBar = document.createElement("div");
    storageBar.className = "storage-bar";
    storageBar.innerHTML = `
      <div class="storage-bar-fill" style="width:${Math.round(storageTotals.fillRatio * 100)}%"></div>
      <span class="storage-bar-text">${Math.round(storageTotals.fillRatio * 100)}%</span>
    `;
    if (storageTotals.fillRatio >= 0.9) {
      storageBar.classList.add("is-critical");
    } else if (storageTotals.fillRatio >= 0.7) {
      storageBar.classList.add("is-near");
    }
    this.setTooltip(storageBar, [
      "Индикатор общей заполненности склада",
      `Заполнено: ${storageTotals.used} из ${storageTotals.capacity}`,
      `Свободно: ${storageTotals.free}`,
    ]);
    container.appendChild(storageBar);

    if (recentOverflow) {
      const overflowNotice = document.createElement("div");
      overflowNotice.className = "storage-warning is-full";
      const resource = this.data.resources[recentOverflow.id];
      overflowNotice.textContent = `Переполнение: ${resource.icon} ${resource.name} -${recentOverflow.lost}`;
      this.setTooltip(overflowNotice, [
        "Последнее переполнение склада",
        `${resource.name}: потеряно ${recentOverflow.lost}`,
        `Лимит по ресурсу: ${this.game.maxResourceCap}`,
      ]);
      container.appendChild(overflowNotice);
    } else if (storageStatus.isFull || storageStatus.isNearFull) {
      const warning = document.createElement("div");
      warning.className = `storage-warning ${storageStatus.isFull ? "is-full" : "is-near"}`;
      const resourceName = storageStatus.highest.id
        ? this.data.resources[storageStatus.highest.id].name
        : "ресурсов";
      warning.textContent = storageStatus.isFull
        ? `Лимит достигнут: ${resourceName}`
        : `Склад почти полон: ${resourceName}`;
      this.setTooltip(warning, [
        "Склад ограничивает накопление каждого ресурса",
        `Текущий лимит: ${this.game.maxResourceCap}`,
        storageStatus.isFull
          ? "Лимит достигнут: излишки не добавляются"
          : "Почти полный склад: расходуйте ресурсы заранее",
      ]);
      container.appendChild(warning);
    }

    const groups = document.createElement("div");
    groups.className = "storage-groups";

    for (const group of storageGroups) {
      const section = document.createElement("section");
      section.className = "storage-category";
      section.innerHTML = `
        <div class="storage-category-header">
          <div class="storage-category-title">${group.label}</div>
          <div class="storage-category-meta">${group.usedSpace} места</div>
        </div>
      `;
      this.setTooltip(section, [
        group.label,
        group.description || "Категория ресурсов склада",
        `Занято в категории: ${group.usedSpace}`,
        `Доля общего склада: ${Math.round(group.contributionRatio * 100)}%`,
      ]);

      const list = document.createElement("div");
      list.className = "storage-resource-list";

      for (const item of group.items) {
        const row = document.createElement("div");
        row.className = "storage-resource-row";

        if (item.isNearFull) row.classList.add("is-near");
        if (item.isHigh) row.classList.add("is-high");
        if (item.isFull) row.classList.add("is-full");
        if (item.overflow) row.classList.add("is-overflowed");

        row.innerHTML = `
          <div class="storage-resource-main">
            <span class="resource-icon" style="color:${item.def.color}">${item.def.icon}</span>
            <div class="resource-text">
              <div class="storage-resource-top">
                <span class="resource-name">${item.def.name}</span>
                <span class="storage-resource-count">${item.amount}</span>
              </div>
              ${item.overflow ? `<div class="storage-overflow-badge">Переполнение -${item.overflow.lost}</div>` : ""}
            </div>
          </div>
          <div class="storage-resource-bar">
            <div class="storage-resource-bar-fill" style="width:${Math.round(item.fillRatio * 100)}%"></div>
          </div>
        `;

        this.setTooltip(row, [
          item.def.name,
          item.def.description || "Ресурс склада",
          `На складе: ${item.amount} / ${this.game.maxResourceCap}`,
          `Размер ресурса: x${item.storageSize}`,
          `Занимает места: ${item.usedSpace}`,
          `Доля общего склада: ${Math.round(item.contributionRatio * 100)}%`,
          item.overflow
            ? `Последнее переполнение: потеряно ${item.overflow.lost}`
            : item.isFull
              ? "Ресурс упёрся в лимит и лишнее не помещается"
              : "",
          bonus > 0 ? `Бонус ручного сбора сейчас: +${bonus}` : "",
        ]);

        list.appendChild(row);
      }

      section.appendChild(list);
      groups.appendChild(section);
    }

    container.appendChild(groups);
  }

  renderGather() {
    const container = document.getElementById("gather-panel");
    if (!container) return;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "🖐️ Сбор ресурсов";
    container.appendChild(title);

    for (const [id, action] of Object.entries(this.data.gatherActions)) {
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.type = "button";

      const cooldown = this.game.getCooldownRemaining(id);
      const disabled = cooldown > 0 || !this.game.hasEnergy(action.energyCost);
      const output = this.game.getGatherOutput(id);
      const outputStr = this.formatResourcePairs(output, { plus: true });
      const perAction = `Эффективность: ${outputStr} / действие`;

      btn.innerHTML = `
        <span class="btn-icon">${action.icon}</span>
        <span class="btn-label">${action.name}</span>
        ${action.description ? `<span class="btn-desc">${action.description}</span>` : ""}
        <span class="btn-output">${outputStr}</span>
        <span class="btn-efficiency">${perAction}</span>
        <span class="btn-cost">⚡ -${action.energyCost}</span>
        ${cooldown > 0 ? `<span class="btn-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
        ${!this.game.hasEnergy(action.energyCost) && cooldown === 0 ? '<span class="btn-cooldown">⚡ Нет энергии</span>' : ""}
      `;

      btn.classList.toggle("cooldown", disabled);
      btn.classList.toggle("busy", cooldown > 0);
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");

      btn.addEventListener("click", () => {
        if (!this.game.gather(id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });

      container.appendChild(btn);
    }
  }

  renderCrafting() {
    const container = document.getElementById("craft-panel");
    if (!container) return;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "⚒️ Крафт";
    container.appendChild(title);

    const queueState = this.game.getCraftQueueState();
    const queueCard = document.createElement("div");
    queueCard.className = "craft-queue-card";
    queueCard.innerHTML = `
      <div class="craft-queue-header">
        <span class="craft-queue-title">Очередь производства</span>
        <span class="craft-queue-capacity">${queueState.items.length} / ${queueState.capacity}</span>
      </div>
      <div class="craft-queue-slots">
        ${Array.from({ length: queueState.capacity }, (_, index) => {
          const item = queueState.items[index];
          if (!item) {
            return `<div class="craft-queue-slot is-empty has-tooltip" data-tooltip="Свободный слот&#10;Добавьте рецепт, чтобы запланировать следующий шаг">Пусто</div>`;
          }

          const stateLabel = item.isActive
            ? `В работе · ${this.formatSeconds(item.remainingMs)}`
            : "Ожидает";

          return `
            <div class="craft-queue-slot ${item.isActive ? "is-active" : "is-waiting"} has-tooltip" data-tooltip="${this.formatTooltipText(
              [
                item.name,
                item.isActive
                  ? "Статус: выполняется сейчас"
                  : "Статус: ожидает в очереди",
                `Осталось: ${this.formatSeconds(item.remainingMs)}`,
              ],
            )}">
              <div class="craft-queue-slot-top">
                <span class="craft-queue-icon">${item.icon}</span>
                <span class="craft-queue-name">${item.name}</span>
              </div>
              <div class="craft-queue-state">${stateLabel}</div>
              <div class="craft-queue-progress">
                <div class="craft-queue-progress-fill" style="width:${item.isActive ? item.progress * 100 : 0}%"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
    this.setTooltip(queueCard, [
      "Очередь крафта: задания выполняются автоматически по порядку",
      `Слотов занято: ${queueState.items.length} / ${queueState.capacity}`,
      "В работе: текущий слот, Ожидает: ждёт своей очереди",
    ]);
    container.appendChild(queueCard);

    for (const [id, recipe] of Object.entries(this.data.recipes)) {
      const unlocked =
        this.game.unlockedRecipes.has(id) &&
        (!recipe.unlockedBy || this.game.researched[recipe.unlockedBy]);
      const meetsReqs =
        !recipe.requires || this.game.buildings[recipe.requires];
      const canQueue = this.game.canQueueCraft(id);
      const effectiveCost = this.game._getDiscountedCost(recipe.ingredients);

      const el = document.createElement("div");
      el.className = "recipe-card";

      if (!unlocked || !meetsReqs) {
        el.classList.add("locked");
        const reqName = !unlocked && recipe.unlockedBy
          ? this.data.tech[recipe.unlockedBy]?.name || recipe.unlockedBy
          : recipe.requires
            ? this.data.buildings[recipe.requires]?.name || recipe.requires
            : null;
        const reqType = !unlocked && recipe.unlockedBy ? "Исследование" : "Требуется";
        el.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-label">${recipe.name}</span>
          ${recipe.description ? `<span class="btn-desc">${recipe.description}</span>` : ""}
          ${reqName ? `<span class="btn-cooldown">${reqType}: ${reqName}</span>` : ""}
        `;
        container.appendChild(el);
        continue;
      }

      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.type = "button";
      this.setButtonAvailability(btn, canQueue);

      const costStr = this.formatResourcePairs(effectiveCost);
      const outStr = this.formatResourcePairs(recipe.output, { plus: true });
      let queueStateText = `⏱ ${this.formatSeconds(recipe.craftTimeMs || 3000)}`;

      if (this.game.craftQueue.length >= this.game.maxCraftQueueSize) {
        queueStateText = "Очередь заполнена";
      } else if (!this.game.hasResources(effectiveCost)) {
        queueStateText = "Не хватает ресурсов";
      }

      btn.innerHTML = `
        <span class="btn-icon">${recipe.icon}</span>
        <span class="btn-label">${recipe.name}</span>
        <span class="btn-flow">${costStr} → ${outStr}</span>
        ${recipe.description ? `<span class="btn-desc">${recipe.description}</span>` : ""}
        <span class="btn-efficiency">Время производства: ${this.formatSeconds(recipe.craftTimeMs || 3000)}</span>
        <span class="btn-queue-status">${queueStateText}</span>
      `;
      this.setTooltip(btn, [
        recipe.name,
        recipe.description || "Производственный рецепт",
        "Добавляет задачу в очередь крафта",
      ]);

      btn.addEventListener("click", () => {
        if (!this.game.queueCraft(id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });

      el.appendChild(btn);
      container.appendChild(el);
    }
  }

  createTimedStatusCard({
    title,
    icon,
    name,
    remainingMs,
    progress,
    note,
    variant,
  }) {
    const card = document.createElement("div");
    card.className = `project-status-card${variant ? ` is-${variant}` : ""}`;
    card.innerHTML = `
      <div class="project-status-top">
        <span class="project-status-title">${title}</span>
        <span class="project-status-remaining">${this.formatSeconds(remainingMs)}</span>
      </div>
      <div class="project-status-name">${icon} ${name}</div>
      ${note ? `<div class="project-status-note">${note}</div>` : ""}
      <div class="project-status-bar">
        <div class="project-status-bar-fill" style="width:${progress * 100}%"></div>
      </div>
    `;
    return card;
  }

  renderBuildings() {
    const container = document.getElementById("buildings-panel");
    if (!container) return;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "🏗️ Здания";
    container.appendChild(title);

    const construction = this.game.getConstructionState();
    if (construction) {
      const card = this.createTimedStatusCard({
        title: "Активное строительство",
        icon: construction.icon,
        name: construction.name,
        remainingMs: construction.remainingMs,
        progress: construction.progress,
        note: "Эффект здания включится после завершения строительства.",
        variant: "construction",
      });
      this.setTooltip(card, [
        `${construction.name}: строительство в процессе`,
        `Осталось: ${this.formatSeconds(construction.remainingMs)}`,
        "После завершения здание станет доступно как постоянный узел поселения.",
      ]);
      container.appendChild(card);
    }

    for (const [id, building] of Object.entries(this.data.buildings)) {
      const alreadyBuilt = this.game.buildings[id];
      const canDo = this.game.canBuild(id);
      const unlockedByTech =
        !building.unlockedBy || this.game.researched[building.unlockedBy];
      const requiredBuildingReady =
        !building.requires || this.game.buildings[building.requires];
      const isConstructingThis = construction?.buildingId === id;

      const el = document.createElement("div");
      el.className = "building-card";

      let automationInfo = "";
      if (building.effect.automation) {
        const auto = building.effect.automation;
        const efficiency = this.game.getAutomationEfficiency(auto.id);
        const cycleOutput = this.formatResourcePairs(auto.output, {
          plus: true,
        });
      } else if (isConstructingThis) {
        el.classList.add("in-progress");
        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${building.name}</span>
          ${building.description ? `<span class="btn-desc">${building.description}</span>` : ""}
          <span class="building-status is-pending">⏳ Строится — ${this.formatSeconds(construction.remainingMs)}</span>
          <div class="project-mini-bar">
            <div class="project-mini-bar-fill" style="width:${construction.progress * 100}%"></div>
          </div>
        `;
        this.setTooltip(el, [
          `${building.name}: строительство начато`,
          `Осталось: ${this.formatSeconds(construction.remainingMs)}`,
          "После завершения появится в постоянных постройках.",
        ]);
      }

      if (alreadyBuilt) {
        el.classList.add("built");
        let extraInfo = `<span class="building-status">✅ Построено</span>`;

        if (building.effect.automation) {
          const auto = building.effect.automation;
          const autoId = auto.id;
          const state = this.game.getAutomationState(autoId);
          const remaining = this.game.getAutomationRemaining(autoId);
          const inputStr = this.formatResourcePairs(auto.input);
          const outputStr = this.formatResourcePairs(auto.output, {
            plus: true,
          });
          const efficiency = this.game.getAutomationEfficiency(autoId);
          const perSecond = efficiency
            ? this.formatResourcePairs(efficiency.outputPerSecond, {
                decimals: 1,
              })
            : "";

          let stateLabel = "";
          let stateClass = "";
          if (state === "running") {
            stateLabel = `⏳ ${remaining.toFixed(1)}с до результата`;
            stateClass = "state-running";
          } else if (state === "waiting") {
            stateLabel = `⚠️ Нет входа: ${inputStr}`;
            stateClass = "state-waiting";
          }

          extraInfo += `
            <div class="automation-inline">
              <span class="automation-flow">${inputStr} → ${outputStr}</span>
              <span class="automation-efficiency">${outputStr} / ${efficiency.cycleSeconds.toFixed(0)}с = ${perSecond} / с</span>
              <span class="automation-state ${stateClass}">${stateLabel}</span>
            </div>
          `;
        }

        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${building.name}</span>
          ${building.description ? `<span class="btn-desc">${building.description}</span>` : ""}
          ${extraInfo}
        `;
        this.setTooltip(el, [
          building.name,
          building.description || "Уже построено",
          building.effect.automation
            ? "Автоматизирует производство по циклу"
            : "Даёт постоянный бонус для развития",
        ]);
      } else if (!unlockedByTech || !requiredBuildingReady) {
        el.classList.add("locked");
        const lockedByName = !unlockedByTech
          ? this.data.tech[building.unlockedBy]?.name || building.unlockedBy
          : this.data.buildings[building.requires]?.name || building.requires;
        const lockedByType = !unlockedByTech ? "исследование" : "здание";
        el.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-label">${building.name}</span>
          ${building.description ? `<span class="btn-desc">${building.description}</span>` : ""}
          <span class="btn-cooldown">Требуется: ${lockedByType} «${lockedByName}»</span>
        `;
        this.setTooltip(el, [
          building.name,
          building.description || "Пока недоступно",
          `Откроется через: ${lockedByType} «${lockedByName}»`,
        ]);
      } else {
        const costStr = this.formatResourcePairs(building.cost);
        const buildTime = this.formatSeconds(this.game.getBuildDuration(id));
        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        this.setButtonAvailability(btn, canDo);

        let unlocksInfo = "";
        if (building.effect.unlocks && building.effect.unlocks.length > 0) {
          const recipeNames = building.effect.unlocks
            .map((rid) => this.data.recipes[rid]?.name || rid)
            .join(", ");
          unlocksInfo = `<span class="btn-desc">🔓 Открывает: ${recipeNames}</span>`;
        }
        if (building.effect.automation) {
          unlocksInfo = automationInfo;
        }

        let buildStatus = `Строительство: ${buildTime}`;
        if (construction) {
          buildStatus = `Занято: ${construction.icon} ${construction.name}`;
        } else if (!this.game.hasResources(building.cost)) {
          buildStatus = "Не хватает ресурсов";
        }

        btn.innerHTML = `
          <span class="btn-icon">${building.icon}</span>
          <span class="btn-label">${building.name}</span>
          <span class="btn-desc">${building.description}</span>
          ${unlocksInfo}
          <span class="btn-cost">Стоимость: ${costStr}</span>
                  <span class="btn-efficiency">Время строительства: ${buildTime}</span>
                  <span class="btn-queue-status">${buildStatus}</span>
        `;
        this.setTooltip(btn, [
          building.name,
          building.description || "Раннее здание",
          building.effect.automation
            ? "Запускает строительство; после завершения включит автоматический цикл"
            : "Запускает строительство; эффект появится после завершения",
        ]);

        btn.addEventListener("click", () => {
          if (!this.game.build(id)) {
            this.render({ forcePanels: true });
            return;
          }
          this.render({ forcePanels: true });
        });

        el.appendChild(btn);
      }

      container.appendChild(el);
    }
  }

  renderAutomation() {
    const container = document.getElementById("automation-panel");
    if (!container) return;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "⚙️ Автоматизация";
    container.appendChild(title);

    let anyActive = false;
    for (const [buildingId] of Object.entries(this.game.buildings)) {
      const building = this.data.buildings[buildingId];
      if (!building || !building.effect.automation) continue;

      anyActive = true;
      const buildingData = this.game.buildings[buildingId];
      const auto = building.effect.automation;
      const autoId = auto.id;
      let state = this.game.getAutomationState(autoId);
      if (!buildingData.isAutomationRunning) {
        state = "idle";
      }
      const progress = this.game.getAutomationProgress(autoId);
      const remaining = this.game.getAutomationRemaining(autoId);
      const efficiency = this.game.getAutomationEfficiency(autoId);
      const perSecond = efficiency
        ? this.formatResourcePairs(efficiency.outputPerSecond, {
            decimals: 1,
          })
        : "";

      const el = document.createElement("div");
      el.className = "automation-card";

      const inputStr = this.formatResourcePairs(auto.input);
      const outputStr = this.formatResourcePairs(auto.output, { plus: true });

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
        const missing = this.game.getMissingResources(auto.input);
        const missingStr = missing
          .map(
            ({ id, missing: amount }) =>
              `${this.data.resources[id].icon}${amount}`,
          )
          .join(" ");
        stateDisplay = `<span class="automation-state-label state-waiting">⚠️ Ожидание — не хватает ${missingStr || inputStr}</span>`;
        progressHtml = `<div class="automation-bar"><div class="automation-bar-fill" style="width:0%"></div></div>`;
      } else {
        stateDisplay = `<span class="automation-state-label state-idle">⏸ Остановлено</span>`;
      }

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "automation-toggle-btn";
      toggleBtn.type = "button";
      toggleBtn.textContent = buildingData.isAutomationRunning
        ? "⏸ Остановить"
        : "▶️ Запустить";
      toggleBtn.addEventListener("click", () => {
        if (!this.game.toggleAutomation(buildingId)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });

      el.innerHTML = `
        <span class="btn-icon">${building.icon}</span>
        <span class="btn-label">${building.name}</span>
        ${auto.description ? `<span class="btn-desc">${auto.description}</span>` : ""}
        <span class="automation-flow">${inputStr} → ${outputStr}</span>
        <span class="automation-efficiency">${outputStr} / ${efficiency.cycleSeconds.toFixed(0)}с = ${perSecond} / с</span>
        ${stateDisplay}
        ${progressHtml}
      `;
      el.appendChild(toggleBtn);

      this.setTooltip(el, [
        `${building.name}: автоматизация`,
        state === "running"
          ? "Статус: работает и выпускает ресурс по циклу"
          : state === "waiting"
            ? "Статус: ожидание, пока не хватает входных ресурсов"
            : buildingData.isAutomationRunning
              ? "Статус: остановлено вручную"
              : "Статус: неактивно, цикл ещё не запущен",
        "Автоматизация снижает ручную нагрузку и поддерживает цепочку",
      ]);

      container.appendChild(el);
    }

    if (!anyActive) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        "Постройте здание с автоматическим циклом, чтобы часть прогресса шла без ручных кликов.";
      container.appendChild(hint);
    }
  }

  createResearchCard(tech, researchState) {
    const prereqs = this.game.getTechPrerequisites(tech.id);
    const done = this.game.researched[tech.id];
    const canDo = this.game.canResearch(tech.id);
    const isResearchingThis = researchState?.techId === tech.id;
    const isQueued = this.game.researchQueue.some((q) => q.techId === tech.id);
    const canQueue = this.game.canQueueResearch(tech.id);
    const outcomes = Array.isArray(tech.outcomes) ? tech.outcomes : [];
    const missingRequirementLabels = [
      ...prereqs.missingTechIds.map((id) => {
        const reqTech = this.data.tech[id];
        return reqTech ? `${reqTech.icon} ${reqTech.name}` : id;
      }),
      ...prereqs.missingBuildingIds.map((id) => {
        const reqBuilding = this.data.buildings[id];
        return reqBuilding ? `${reqBuilding.icon} ${reqBuilding.name}` : id;
      }),
    ];
    const outcomesHtml = outcomes.length
      ? `<div class="tech-outcomes">${outcomes.map((item) => `<span class="tech-outcome">${item}</span>`).join("")}</div>`
      : "";
    const requirementText =
      missingRequirementLabels.length > 0
        ? `Нужно: ${missingRequirementLabels.join(" · ")}`
        : "";

    const el = document.createElement("div");
    el.className = "tech-card";

    if (done) {
      el.classList.add("done");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status">✅ Изучено</span>
      `;
      this.setTooltip(el, [tech.name, tech.description, ...outcomes]);
      return el;
    }

    if (isResearchingThis) {
      el.classList.add("in-progress");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status is-pending">⏳ Исследуется — ${this.formatSeconds(researchState.remainingMs)}</span>
        <div class="project-mini-bar">
          <div class="project-mini-bar-fill" style="width:${researchState.progress * 100}%"></div>
        </div>
      `;
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "tech-cancel-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "✕ Отменить (−50% ресурсов)";
      cancelBtn.addEventListener("click", () => {
        this.game.cancelResearch();
        this.render({ forcePanels: true });
      });
      el.appendChild(cancelBtn);
      this.setTooltip(el, [
        `${tech.name}: исследование запущено`,
        `Осталось: ${this.formatSeconds(researchState.remainingMs)}`,
        ...outcomes,
      ]);
      return el;
    }

    if (isQueued) {
      el.classList.add("queued");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status is-pending">📋 В очереди — запустится автоматически</span>
      `;
      const dequeueBtn = document.createElement("button");
      dequeueBtn.className = "tech-cancel-btn";
      dequeueBtn.type = "button";
      dequeueBtn.textContent = "✕ Убрать из очереди (вернуть ресурсы)";
      dequeueBtn.addEventListener("click", () => {
        this.game.cancelQueuedResearch();
        this.render({ forcePanels: true });
      });
      el.appendChild(dequeueBtn);
      this.setTooltip(el, [tech.name, tech.description, "В очереди — ресурсы уже заняты", ...outcomes]);
      return el;
    }

    if (missingRequirementLabels.length > 0) {
      el.classList.add("locked");
      el.innerHTML = `
        <span class="tech-icon">🔒</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-req">${requirementText}</span>
      `;
      this.setTooltip(el, [tech.name, tech.description, requirementText, ...outcomes]);
      return el;
    }

    const costStr = this.formatResourcePairs(tech.cost);
    const researchTime = this.formatSeconds(this.game.getResearchDuration(tech.id));

    // Build resource status string with specific missing resources
    let researchStatus;
    if (canQueue) {
      researchStatus = `Исследование в очереди: стоимость ${costStr}`;
    } else if (researchState && !isResearchingThis) {
      // Another tech is being researched
      researchStatus = `Идёт: ${researchState.icon} ${researchState.name}`;
    } else if (!this.game.hasResources(tech.cost)) {
      const missing = this.game.getMissingResources(tech.cost);
      const missingStr = missing
        .map(({ id, missing: amount }) => `${this.data.resources[id].icon}${amount}`)
        .join(" ");
      researchStatus = `Не хватает: ${missingStr}`;
    } else {
      researchStatus = `Стоит: ${costStr} · Время: ${researchTime}`;
    }

    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.type = "button";

    if (canQueue) {
      // Show queue button
      this.setButtonAvailability(btn, true);
      btn.innerHTML = `
        <span class="btn-icon">${tech.icon}</span>
        <span class="btn-label">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="btn-cost">Стоимость: ${costStr}</span>
        <span class="btn-efficiency">Время исследования: ${researchTime}</span>
        <span class="btn-queue-status tech-queue-hint">📋 Поставить в очередь</span>
      `;
      btn.addEventListener("click", () => {
        this.game.queueResearch(tech.id);
        this.render({ forcePanels: true });
      });
    } else {
      this.setButtonAvailability(btn, canDo);
      btn.innerHTML = `
        <span class="btn-icon">${tech.icon}</span>
        <span class="btn-label">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="btn-cost">Стоимость: ${costStr}</span>
        <span class="btn-efficiency">Время исследования: ${researchTime}</span>
        <span class="btn-queue-status">${researchStatus}</span>
      `;
      btn.addEventListener("click", () => {
        if (!this.game.research(tech.id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });
    }

    this.setTooltip(btn, [tech.name, tech.description, ...outcomes]);
    el.appendChild(btn);
    return el;
  }

  _renderResearchBody(container) {
    container.innerHTML = "";

    const researchState = this.game.getResearchState();
    const branchState = this.game.getResearchBranchesState();
    const startedBranches = branchState.branches.filter((branch) => branch.started)
      .length;

    const overview = document.createElement("div");
    overview.className = "research-overview";
    overview.innerHTML = `
      <div class="research-overview-summary">
        <span class="research-summary-chip">Основа: ${branchState.foundation.filter((tech) => this.game.researched[tech.id]).length}/${branchState.foundation.length}</span>
        <span class="research-summary-chip">Ветви начаты: ${startedBranches}/${branchState.branches.length}</span>
        <span class="research-summary-chip">Изучено: ${Object.keys(this.game.researched).length}</span>
      </div>
      ${branchState.transitionText ? `<div class="research-overview-text">${branchState.transitionText}</div>` : ""}
    `;
    container.appendChild(overview);

    if (branchState.foundation.length > 0) {
      const foundation = document.createElement("section");
      foundation.className = "research-foundation";
      foundation.innerHTML = `
        <div class="research-branch-header is-foundation">
          <div class="research-branch-title">
            <span class="research-branch-icon">🪶</span>
            <div>
              <div class="research-branch-name">Основа эпохи</div>
              <div class="research-branch-desc">Без этих знаний ветви развития не складываются в общую систему.</div>
            </div>
          </div>
        </div>
      `;

      const foundationGrid = document.createElement("div");
      foundationGrid.className = "research-foundation-grid";
      for (const tech of branchState.foundation) {
        foundationGrid.appendChild(this.createResearchCard(tech, researchState));
      }

      foundation.appendChild(foundationGrid);
      container.appendChild(foundation);
    }

    if (researchState) {
      const card = this.createTimedStatusCard({
        title: "Активное исследование",
        icon: researchState.icon,
        name: researchState.name,
        remainingMs: researchState.remainingMs,
        progress: researchState.progress,
        note: "Эффект технологии включится после завершения исследования.",
        variant: "research",
      });
      this.setTooltip(card, [
        `${researchState.name}: исследование в процессе`,
        `Осталось: ${this.formatSeconds(researchState.remainingMs)}`,
        "После завершения технология сразу усилит ваше поселение.",
      ]);
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "tech-cancel-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "✕ Отменить (−50% ресурсов)";
      cancelBtn.addEventListener("click", () => {
        this.game.cancelResearch();
        this.render({ forcePanels: true });
      });
      card.appendChild(cancelBtn);
      container.appendChild(card);
    }

    // Queue slot indicator
    if (this.game.researchQueue.length > 0) {
      const queuedTech = this.data.tech[this.game.researchQueue[0].techId];
      const queueSlot = document.createElement("div");
      queueSlot.className = "research-queue-slot";
      queueSlot.innerHTML = `
        <span class="research-queue-slot-label">📋 В очереди:</span>
        <span class="research-queue-slot-name">${queuedTech?.icon || ""} ${queuedTech?.name || "?"}</span>
        <span class="research-queue-slot-hint">запустится автоматически</span>
      `;
      const cancelQueueBtn = document.createElement("button");
      cancelQueueBtn.className = "tech-cancel-btn";
      cancelQueueBtn.type = "button";
      cancelQueueBtn.textContent = "✕ Убрать (вернуть ресурсы)";
      cancelQueueBtn.addEventListener("click", () => {
        this.game.cancelQueuedResearch();
        this.render({ forcePanels: true });
      });
      queueSlot.appendChild(cancelQueueBtn);
      container.appendChild(queueSlot);
    } else if (researchState) {
      const emptySlot = document.createElement("div");
      emptySlot.className = "research-queue-slot is-empty";
      emptySlot.innerHTML = `<span class="research-queue-slot-label">📋 Очередь пуста</span><span class="research-queue-slot-hint">Выберите следующее исследование ниже</span>`;
      container.appendChild(emptySlot);
    }

    const branchesGrid = document.createElement("div");
    branchesGrid.className = "research-branches-grid";

    for (const branch of branchState.branches) {
      const isComplete = branch.completed === branch.total && branch.total > 0;
      const section = document.createElement("section");
      section.className = "research-branch" + (isComplete ? " is-complete" : "");
      section.innerHTML = `
        <div class="research-branch-header">
          <div class="research-branch-title">
            <span class="research-branch-icon">${branch.icon}</span>
            <div>
              <div class="research-branch-name">${branch.label}</div>
              <div class="research-branch-desc">${branch.description}</div>
            </div>
          </div>
          <div class="research-branch-meta">${isComplete ? "✅" : `${branch.completed}/${branch.total}`}</div>
        </div>
        <div class="research-branch-leads">${branch.leadsTo}</div>
      `;

      const techList = document.createElement("div");
      techList.className = "research-branch-techs";
      for (const tech of branch.techs) {
        techList.appendChild(this.createResearchCard(tech, researchState));
      }

      section.appendChild(techList);
      branchesGrid.appendChild(section);
    }

    container.appendChild(branchesGrid);
  }

  renderLog() {
    const container = document.getElementById("log-panel");
    if (!container) return;

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

  renderEraProgress() {
    const container = document.getElementById("era-progress-panel");
    if (!container) return;

    const eraData = this.game.getEraData();
    if (!eraData) {
      container.innerHTML = "";
      return;
    }

    const eraProgress = this.game.getEraProgress();
    const progressPercent = Math.round(eraProgress.progress * 100);
    const summary = this.game.getProgressSummary();

    // Milestones
    let milestonesHtml = "";
    for (const milestone of eraProgress.milestones) {
      const statusIcon = milestone.completed ? "✅" : "⏳";
      const statusClass = milestone.completed ? "completed" : "pending";
      milestonesHtml += `<div class="era-milestone ${statusClass}">${statusIcon} ${milestone.text}</div>`;
    }

    // Tactical goal (compact)
    let goalHtml = "";
    const goal = this.game.getCurrentGoal();
    const goalProgress = this.game.getGoalProgress();

    if (
      this.game.isOnboardingActive() ||
      this.game.shouldShowOnboardingIntro()
    ) {
      // During onboarding, don't show goal block
      goalHtml = "";
    } else if (!goal) {
      goalHtml = `<div class="era-goal-done">✅ Все цели выполнены (${goalProgress.done}/${goalProgress.total})</div>`;
    } else {
      const pct = goalProgress.currentPct;
      goalHtml = `
        <div class="era-goal-block">
          <div class="era-goal-header">
            <span class="era-goal-label">Цель ${goalProgress.done + 1}/${goalProgress.total}:</span>
            <span class="era-goal-text">${goal.text}</span>
          </div>
          ${goal.hint ? `<div class="era-goal-hint">💡 ${goal.hint}</div>` : ""}
          <div class="era-goal-bar">
            <div class="era-goal-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }

    // Stats line
    const statsHtml = `
      <div class="era-stats">
        <span>🏗 ${summary.buildingsBuilt}</span>
        <span>🔬 ${summary.techResearched}</span>
        <span>📦 ${summary.resourcesOwned}</span>
      </div>
    `;

    container.innerHTML = `
      <h3>🌟 ${eraData.name}</h3>
      <div class="era-description">${eraData.description}</div>
      <div class="era-progress-bar">
        <div class="era-progress-fill" style="width: ${progressPercent}%"></div>
        <span class="era-progress-text">${progressPercent}% (${eraProgress.completed}/${eraProgress.total})</span>
      </div>
      <div class="era-milestones">
        ${milestonesHtml}
      </div>
      ${goalHtml}
      ${statsHtml}
    `;
  }

  renderSaveStatus() {
    const element = document.getElementById("save-status");
    if (!element) return;

    const status = this.game.getSaveStatus();
    element.textContent = status.text;
    element.classList.remove("is-saved", "is-error");
    if (status.state === "saved") {
      element.classList.add("is-saved");
    } else if (status.state === "error") {
      element.classList.add("is-error");
    }
  }
}
