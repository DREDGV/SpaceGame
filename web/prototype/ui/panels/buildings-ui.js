// Buildings and automation panels.

Object.assign(UI.prototype, {
  _renderAutomationSupplySummary(supply, options = {}) {
    if (!supply) return "";
    const { compact = false, showProgress = true } = options;
    const inputStr = this.formatResourcePairs(supply.input);
    const outputStr = this.formatResourcePairs(supply.output, { plus: true });
    const efficiency = supply.efficiency;
    const perSecond = efficiency
      ? this.formatResourcePairs(efficiency.outputPerSecond, { decimals: 1 })
      : "";
    const cycleText = efficiency
      ? `${outputStr} / ${efficiency.cycleSeconds.toFixed(0)}с${perSecond ? ` = ${perSecond} / с` : ""}`
      : "";
    const missingText = supply.missingInput.length
      ? supply.missingInput
          .map(
            ({ id, missing }) =>
              `${this.getResourceDisplayIcon(id)} ${this.getResourceDisplayName(id)} ×${missing}`,
          )
          .join(" · ")
      : "достаточно";
    const outputMeta = supply.outputItems.length
      ? supply.outputItems
          .map((item) => {
            const label = this.getResourceDisplayName(item.id);
            return `${label}: ${item.current}/${item.capacity}`;
          })
          .join(" · ")
      : "без складирования";
    const progressHtml =
      showProgress && supply.enabled && supply.statusId === "running"
        ? `<div class="automation-bar"><div class="automation-bar-fill" style="width:${supply.progress * 100}%"></div></div>`
        : "";
    const classes = [
      "automation-supply",
      compact ? "automation-supply--compact" : "",
      `is-${supply.tone || "info"}`,
    ]
      .filter(Boolean)
      .join(" ");

    return `
      <div class="${classes}">
        <div class="automation-supply-flow">${inputStr} → ${outputStr}</div>
        ${cycleText ? `<div class="automation-efficiency">${cycleText}</div>` : ""}
        <div class="automation-supply-grid">
          <div class="automation-supply-row">
            <span class="automation-supply-label">Вход</span>
            <strong>${inputStr}</strong>
            <em>${missingText}</em>
          </div>
          <div class="automation-supply-row">
            <span class="automation-supply-label">Выход</span>
            <strong>${outputStr}</strong>
            <em>${outputMeta}</em>
          </div>
        </div>
        <span class="automation-state-label ${supply.statusClass}">${supply.statusLabel}</span>
        <span class="automation-supply-note">${supply.statusNote}</span>
        ${progressHtml}
      </div>
    `;
  },

  renderBuildingsPanel() {
    const container = document.getElementById("buildings-panel");
    if (!container) return;
    const isEarlyProgression =
      this.game.isEarlyProgressionMode?.() ?? this.game.isPrologueActive();

    if (
      this.game.isPrologueActive() &&
      !this.game.getPrologueRevealState().showBuildings
    ) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = isEarlyProgression
      ? "🏕️ Ранние постройки"
      : "🏗️ Здания";
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
        "После завершения постройка начнёт работать постоянно.",
      ]);
      container.appendChild(card);
    }

    for (const id of this.game.getVisibleBuildingIds()) {
      const building = this.data.buildings[id];
      if (!building) continue;

      const copy = this.getBuildingCopy(building);
      const buildProfile = this.game.getBuildProfile(id);
      const alreadyBuilt = this.game.buildings[id];
      const canDo = this.game.canBuild(id);
      const unlockedByTech =
        !building.unlockedBy || this.game.researched[building.unlockedBy];
      const requiredBuildingReady =
        !building.requires || this.game.buildings[building.requires];
      const missingInsights = (building.requiresInsights || []).filter(
        (insightId) => !this.game.insights[insightId],
      );
      const missingPrologueTool =
        isEarlyProgression &&
        building.requiresPrologueTool &&
        (this.game.resources.crude_tools || 0) < 1;
      const isConstructingThis = construction?.buildingId === id;

      const el = document.createElement("div");
      el.className = "building-card";

      if (isConstructingThis) {
        el.classList.add("in-progress");
        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          <span class="building-status is-pending">⏳ Строится — ${this.formatSeconds(construction.remainingMs)}</span>
          <div class="project-mini-bar">
            <div class="project-mini-bar-fill" style="width:${construction.progress * 100}%"></div>
          </div>
        `;
      } else if (alreadyBuilt) {
        el.classList.add("built");
        let extraInfo = `<span class="building-status">✅ Построено</span>`;

        if (isEarlyProgression && id === "campfire") {
          extraInfo += `<span class="btn-desc">Огонь стал первой точкой, вокруг которой начинает складываться более устойчивый уклад.</span>`;
        }

        if (building.effect.automation) {
          const auto = building.effect.automation;
          const supply = this.game.getAutomationSupplyStatus?.(auto.id);

          extraInfo += `
            <div class="automation-inline">
              ${this._renderAutomationSupplySummary(supply, { compact: true, showProgress: false })}
            </div>
          `;
        }

        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          ${extraInfo}
        `;
      } else if (
        !unlockedByTech ||
        !requiredBuildingReady ||
        missingInsights.length > 0 ||
        missingPrologueTool
      ) {
        const lockedByName =
          missingInsights.length > 0
            ? missingInsights
                .map(
                  (insightId) =>
                    this.data.prologue?.insights?.[insightId]?.name ||
                    insightId,
                )
                .join(" · ")
            : missingPrologueTool
              ? "Грубое орудие"
              : !unlockedByTech
                ? this.data.tech[building.unlockedBy]?.name ||
                  building.unlockedBy
                : this.data.buildings[building.requires]?.name ||
                  building.requires;
        const lockedByType =
          missingInsights.length > 0
            ? "озарения"
            : missingPrologueTool
              ? "предмет"
              : !unlockedByTech
                ? "исследование"
                : "здание";

        // Determine linkable requirement
        const reqLinkType = !unlockedByTech
          ? "tech"
          : !requiredBuildingReady
            ? "building"
            : null;
        const reqLinkId = !unlockedByTech
          ? building.unlockedBy
          : !requiredBuildingReady
            ? building.requires
            : null;
        const reqNameHtml = reqLinkType
          ? `<button class="req-link" data-req-type="${reqLinkType}" data-req-id="${reqLinkId}">${lockedByName}</button>`
          : `«${lockedByName}»`;

        el.classList.add("locked");
        el.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-label">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          <span class="btn-cooldown">Требуется: ${lockedByType} ${reqNameHtml}</span>
        `;

        if (reqLinkType === "tech") {
          el.querySelector(".req-link")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.openResearchModal();
          });
        }
      } else {
        const costStr = this.formatResourcePairs(this.game.getBuildingCost(id));
        const buildTime = this.formatSeconds(this.game.getBuildDuration(id));
        const buildEnergy = buildProfile?.energyCost ?? 1;
        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        this.setButtonAvailability(btn, canDo);

        let unlocksInfo = "";
        if (building.effect.unlocks && building.effect.unlocks.length > 0) {
          const recipeNames = building.effect.unlocks
            .map((rid) => this.data.recipes[rid]?.name || rid)
            .join(", ");
          unlocksInfo = `<span class="btn-desc">📖 Открывает: ${recipeNames}</span>`;
        }

        let buildStatus = `Строительство: ${buildTime}`;
        if (construction) {
          buildStatus = `Занято: ${construction.icon} ${construction.name}`;
        } else if (isEarlyProgression && id === "rest_tent" && canDo) {
          buildStatus = "Можно поставить первое жильё";
        } else if (isEarlyProgression && id === "campfire" && canDo) {
          buildStatus = "Можно сложить первый очаг";
        } else if (!this.game.hasResources(this.game.getBuildingCost(id))) {
          buildStatus = "Не хватает ресурсов";
        } else if (buildProfile?.blockedReason) {
          buildStatus = buildProfile.blockedReason;
        } else if (!this.game.hasEnergy(buildEnergy)) {
          buildStatus = "Не хватает сил на перенос и стройку";
        }

        btn.innerHTML = `
          <span class="btn-icon">${building.icon}</span>
          <span class="btn-label">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          ${unlocksInfo}
          <span class="btn-cost">Стоимость: ${costStr}</span>
          <span class="btn-efficiency">Время строительства: ${buildTime} · ⚡ -${buildEnergy} · ${buildProfile?.zoneLabel || "у стоянки"}</span>
          <span class="btn-queue-status">${buildStatus}</span>
        `;
        this.setTooltip(btn, [
          copy.name,
          copy.description || "Ранняя постройка",
          `Энергия на начало стройки: -${buildEnergy}`,
          buildProfile?.tile ? `Участок: ${buildProfile.tile.name}` : "",
          buildProfile?.terrainLabel
            ? `Местность: ${buildProfile.terrainLabel}`
            : "",
          buildProfile?.blockedReason || "",
          ...(buildProfile?.warnings || []),
          building.effect.automation
            ? "После завершения откроет автоматический цикл"
            : "После завершения даст постоянный эффект",
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

      this.setTooltip(el, [copy.name, copy.description || "Ранняя постройка"]);
      container.appendChild(el);
    }
  },

  renderAutomationPanel() {
    if (this.game.isEarlyProgressionMode?.() ?? this.game.isPrologueActive()) {
      const container = document.getElementById("automation-panel");
      if (!container) return;

      container.innerHTML = "";
      return;
    }

    this.renderAutomation();
  },

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
          const supply = this.game.getAutomationSupplyStatus?.(auto.id);

          extraInfo += `
            <div class="automation-inline">
              ${this._renderAutomationSupplySummary(supply, { compact: true, showProgress: false })}
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
  },

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
      const supply = this.game.getAutomationSupplyStatus?.(autoId);

      const el = document.createElement("div");
      el.className = "automation-card";

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
        ${this._renderAutomationSupplySummary(supply)}
      `;
      el.appendChild(toggleBtn);

      this.setTooltip(el, [
        `${building.name}: автоматизация`,
        supply?.statusNote || "Статус: цикл ещё не рассчитан",
        buildingData.isAutomationRunning
          ? "Автоматизация включена"
          : "Автоматизация выключена вручную",
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
  },
});
