// Character panel rendering.

Object.assign(UI.prototype, {
  renderCharacterPanel() {
    const container = document.getElementById("character-panel");
    if (!container) return;

    const state = this.game.getCharacterState();
    const energyPct = state.energy.pct * 100;
    const satietyPct = state.satiety.pct * 100;
    const hydrationPct = state.hydration.pct * 100;
    const regenSec = (state.regen.remainingMs / 1000).toFixed(1);
    const satietyRecovery = state.satiety.recoveryPerTick;
    const hydrationRecovery = state.hydration.recoveryPerTick;
    const trip = state.tripProfile;
    const rest = state.restProfile;
    const totalRestEnergy =
      rest.energyGain + (rest.willUseWater ? rest.waterBonusEnergy || 0 : 0);
    const totalRestSatiety =
      rest.satietyGain + (rest.willUseFood ? rest.foodBonusSatiety || 0 : 0);
    const totalRestHydration = rest.willUseWater ? rest.hydrationGain || 0 : 0;
    const tripKind =
      state.tripType === "build"
        ? "Стройка"
        : state.tripType === "trail"
          ? "Прокладка тропы"
          : state.tripType === "gather"
            ? "Выход за ресурсом"
            : "Текущий выход";
    const recoverySummary = state.recovery?.summary || "";
    const carryBonusText =
      state.carry.capacityBonus > 0
        ? ` (+${this.formatNumber(state.carry.capacityBonus)})`
        : "";
    const satietyMaxBonusText =
      state.satiety.maxBonus > 0
        ? ` (+${this.formatNumber(state.satiety.maxBonus, 0)})`
        : "";
    const hydrationMaxBonusText =
      state.hydration.maxBonus > 0
        ? ` (+${this.formatNumber(state.hydration.maxBonus, 0)})`
        : "";
    const knowledgeText = this.game.isPrologueActive()
      ? `✨ ${state.knowledge.insightsUnlocked} озар.`
      : `🔬 ${state.knowledge.techResearched} исслед.`;
    const rangeChipText =
      state.condition.maxSafeDistance >= 99
        ? "🗺 вся открытая карта"
        : state.condition.maxSafeDistance <= 1
          ? "🗺 только ближние клетки"
          : `🗺 до дистанции ${state.condition.maxSafeDistance}`;
    const enduranceValue =
      state.stats.safeDistance >= 99
        ? "вся открытая карта"
        : state.stats.safeDistance <= 1
          ? "только рядом"
          : `до ${state.stats.safeDistance} клеток`;
    const enduranceNote =
      state.stats.enduranceBonus > 0
        ? `+${state.stats.enduranceBonus} к безопасной дальности`
        : "дальность пока держится только на текущих силах";
    const fieldcraftValue =
      state.stats.fieldcraft > 0
        ? `снимает до ${state.stats.fieldcraft} штрафа пути`
        : "без облегчения пути";
    const fieldcraftNote =
      state.stats.fieldcraft > 0
        ? "хуже ощущаются тяжёлая местность и дальние выходы"
        : "дистанция и тяжёлая почва бьют в полную силу";
    const carryValue = `${this.formatNumber(state.carry.capacity)} ед.`;
    const carryNote =
      state.carry.capacityBonus > 0
        ? `лагерь и уклад дают +${this.formatNumber(state.carry.capacityBonus, 0)} к переноске`
        : "весь груз уносится на себе";
    const restValue =
      totalRestEnergy > 0 || totalRestSatiety > 0 || totalRestHydration > 0
        ? `+${totalRestEnergy} сил · +${this.formatNumber(totalRestSatiety, 1)} сытости · +${this.formatNumber(totalRestHydration, 1)} воды`
        : "передышка не нужна";
    const restNote = rest.blockedReason
      ? `${rest.note} ${rest.blockedReason}`
      : rest.note;
    const restButtonLabel = rest.canRest
      ? rest.label
      : rest.remainingMs > 0
        ? `⌛ ${this.formatCooldownMs(rest.remainingMs)}`
        : "Сейчас не нужно";
    const recoverySourcesHtml =
      state.recovery?.sources?.length > 0
        ? `<span class="character-chip">🏕 ${recoverySummary}</span>`
        : `<span class="character-chip is-empty">🏕 нет опоры отдыха</span>`;

    const expanded = this.characterPanelExpanded;

    const compactRestHtml = !expanded
      ? rest.canRest
        ? `<button id="character-rest-compact-btn" class="character-rest-compact-btn" type="button">🛌 ${rest.label}</button>`
        : rest.remainingMs > 0
          ? `<span class="character-chip character-chip-cooldown">🛌 ⌛ ${this.formatCooldownMs(rest.remainingMs)}</span>`
          : ""
      : "";

    const compactTripHtml =
      !expanded && trip
        ? `<div class="character-trip-compact">
          <span class="character-trip-compact-kind">${tripKind}</span>
          <span>🗺 ${trip.zoneLabel}</span>
          ${Number.isFinite(trip.load) ? `<span>🎒 ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}</span>` : ""}
          ${trip.pathLabel ? `<span>${trip.pathIcon || "·"} ${trip.pathLabel}</span>` : ""}
          <span>⚡ -${trip.energyCost}</span>
          ${Number.isFinite(trip.satietyCost) ? `<span>🍖 -${this.formatNumber(trip.satietyCost, 2)}</span>` : ""}
          ${Number.isFinite(trip.hydrationCost) ? `<span>💧 -${this.formatNumber(trip.hydrationCost, 2)}</span>` : ""}
          ${trip.blockedReason ? `<span class="character-trip-warning">${trip.blockedReason}</span>` : ""}
        </div>`
        : "";

    container.classList.remove("is-low", "is-critical");
    if (state.condition.id === "exhausted") {
      container.classList.add("is-critical");
    } else if (state.condition.id === "weakened") {
      container.classList.add("is-low");
    }

    const tripHtml = trip
      ? `
        <div class="character-trip">
          <div class="character-trip-label">${tripKind}</div>
          <div class="character-trip-meta">
            <span>🗺 ${trip.zoneLabel}</span>
            ${
              Number.isFinite(trip.load)
                ? `<span>🎒 ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}</span>`
                : ""
            }
            ${
              trip.deliveryTrips > 1
                ? `<span>📦 ${trip.deliveryTrips} ходки</span>`
                : ""
            }
            ${
              Number.isFinite(trip.totalLoad) && trip.deliveryTrips > 1
                ? `<span>Σ ${this.formatNumber(trip.totalLoad)}</span>`
                : ""
            }
            ${trip.pathLabel ? `<span>${trip.pathIcon || "·"} ${trip.pathLabel}</span>` : ""}
            ${trip.effortLabel ? `<span>${trip.effortLabel}</span>` : ""}
            <span>⚡ -${trip.energyCost}</span>
            ${Number.isFinite(trip.satietyCost) ? `<span>🍖 -${this.formatNumber(trip.satietyCost, 2)}</span>` : ""}
            ${Number.isFinite(trip.hydrationCost) ? `<span>💧 -${this.formatNumber(trip.hydrationCost, 2)}</span>` : ""}
          </div>
          ${
            trip.blockedReason
              ? `<div class="character-trip-warning">${trip.blockedReason}</div>`
              : ""
          }
        </div>
      `
      : `
        <div class="character-trip">
          <div class="character-trip-label">Текущий выход</div>
          <div class="character-trip-empty">Выберите участок на карте, чтобы увидеть цену пути и нагрузку.</div>
        </div>
      `;

    const attributesHtml = `
      <div class="character-attribute-grid">
        <div class="character-attribute">
          <div class="character-attribute-label">Выносливость</div>
          <div class="character-attribute-value">${enduranceValue}</div>
          <div class="character-attribute-note">${enduranceNote}</div>
        </div>
        <div class="character-attribute">
          <div class="character-attribute-label">Сноровка</div>
          <div class="character-attribute-value">${fieldcraftValue}</div>
          <div class="character-attribute-note">${fieldcraftNote}</div>
        </div>
        <div class="character-attribute">
          <div class="character-attribute-label">Переноска</div>
          <div class="character-attribute-value">${carryValue}</div>
          <div class="character-attribute-note">${carryNote}</div>
        </div>
        <div class="character-attribute">
          <div class="character-attribute-label">Передышка</div>
          <div class="character-attribute-value">${restValue}</div>
          <div class="character-attribute-note">${rest.note}</div>
        </div>
      </div>
    `;

    const restHtml = `
      <div class="character-rest">
        <div class="character-rest-top">
          <div class="character-rest-body">
            <div class="character-rest-title">🛌 ${rest.label}</div>
            <div class="character-rest-meta">
              <span>⚡ +${totalRestEnergy}</span>
              <span>🍖 +${this.formatNumber(totalRestSatiety, 1)}</span>
              <span>💧 +${this.formatNumber(totalRestHydration, 1)}</span>
              <span>⏱ откат ${this.formatSeconds(rest.cooldownMs)}</span>
            </div>
            <div class="character-rest-note">${restNote}</div>
          </div>
          <button
            id="character-rest-btn"
            class="character-rest-btn${rest.canRest ? "" : " disabled"}"
            type="button"
            ${rest.canRest ? "" : "disabled"}
          >
            ${restButtonLabel}
          </button>
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="character-topline">
        <div class="character-identity">
          <span class="character-title">🧍 ${state.title}</span>
          <span class="character-condition is-${state.condition.id}">${state.condition.label}</span>
        </div>
        <div class="character-topline-right">
          <span class="character-carry">🎒 ${this.formatNumber(state.carry.capacity)} ед.${carryBonusText}</span>
          <button id="character-toggle-btn" class="character-toggle-btn" type="button" aria-expanded="${expanded}" title="${expanded ? "Свернуть" : "Развернуть"}">
            ${expanded ? "▾" : "▸"}
          </button>
        </div>
      </div>
      <div class="character-hud-grid">
        <div class="character-meter">
          <div class="character-meter-top">
            <span>⚡ Силы</span>
            <span>${this.formatNumber(state.energy.current, 0)} / ${this.formatNumber(state.energy.max, 0)}</span>
          </div>
          <div class="energy-bar-container character-bar-container">
            <div class="energy-bar-fill character-bar-energy" style="width:${energyPct}%"></div>
          </div>
        </div>
        <div class="character-meter">
          <div class="character-meter-top">
            <span>🍖 Сытость</span>
            <span>${this.formatNumber(state.satiety.current, 1)} / ${this.formatNumber(state.satiety.max, 0)}${satietyMaxBonusText}</span>
          </div>
          <div class="energy-bar-container character-bar-container is-satiety">
            <div class="energy-bar-fill character-bar-satiety" style="width:${satietyPct}%"></div>
          </div>
        </div>
        <div class="character-meter">
          <div class="character-meter-top">
            <span>💧 Вода</span>
            <span>${this.formatNumber(state.hydration.current, 1)} / ${this.formatNumber(state.hydration.max, 0)}${hydrationMaxBonusText}</span>
          </div>
          <div class="energy-bar-container character-bar-container is-hydration">
            <div class="energy-bar-fill character-bar-hydration" style="width:${hydrationPct}%"></div>
          </div>
        </div>
      </div>
      <div class="character-chip-row${expanded ? "" : " is-compact"}">
        <span class="character-chip chip-secondary">🔄 +${state.regen.perTick} через ${regenSec}с</span>
        <span class="character-chip chip-secondary">${satietyRecovery >= 0.1 ? `🍲 +${this.formatNumber(satietyRecovery, 2)} сытости/цикл` : "🍲 сытость почти не растёт"}</span>
        <span class="character-chip chip-secondary">${hydrationRecovery >= 0.01 ? `💧 +${this.formatNumber(hydrationRecovery, 2)} воды/цикл` : `💧 запас: ${this.game.resources.water || 0}`}</span>
        <span class="character-chip chip-secondary">${rangeChipText}</span>
        <span class="chip-secondary">${recoverySourcesHtml}</span>
        ${compactRestHtml}
      </div>
      ${compactTripHtml}
      <div class="character-expandable${expanded ? "" : " is-collapsed"}">
        <div class="character-detail-grid">
          <div class="character-detail-main">
            ${attributesHtml}
            <div class="character-note">${state.condition.description}</div>
          </div>
          <div class="character-detail-side">
            ${restHtml}
            ${tripHtml}
          </div>
        </div>
      </div>
    `;

    const toggleBtn = container.querySelector("#character-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.characterPanelExpanded = !this.characterPanelExpanded;
        this.renderCharacterPanel();
      });
    }

    const compactRestBtn = container.querySelector(
      "#character-rest-compact-btn",
    );
    if (compactRestBtn) {
      compactRestBtn.addEventListener("click", () => {
        if (!this.game.restCharacter()) {
          this.render({ forcePanels: true });
          return;
        }
        this.scheduleRestCooldownRefresh(
          this.game.getCharacterRestCooldownMs(),
        );
        this.render({ forcePanels: true });
      });
    }

    const restBtn = container.querySelector("#character-rest-btn");
    if (restBtn) {
      restBtn.addEventListener("click", () => {
        if (!this.game.restCharacter()) {
          this.render({ forcePanels: true });
          return;
        }
        this.scheduleRestCooldownRefresh(
          this.game.getCharacterRestCooldownMs(),
        );
        this.render({ forcePanels: true });
      });
    }

    this.setTooltip(container, [
      `${state.title}: ${state.role}`,
      `Состояние: ${state.condition.label}`,
      `Силы: ${this.formatNumber(state.energy.current, 0)} / ${this.formatNumber(state.energy.max, 0)}`,
      `Сытость: ${this.formatNumber(state.satiety.current, 1)} / ${this.formatNumber(state.satiety.max, 0)}`,
      `Вода: ${this.formatNumber(state.hydration.current, 1)} / ${this.formatNumber(state.hydration.max, 0)}`,
      `Выносливость: ${enduranceValue}`,
      `Походная сноровка: ${fieldcraftValue}`,
      `Переносимость: до ${this.formatNumber(state.carry.capacity)} единиц нагрузки за выход`,
      `Передышка: ${restValue}`,
      `Восстановление сытости: +${this.formatNumber(satietyRecovery, 2)} за цикл`,
      `Восстановление воды: +${this.formatNumber(hydrationRecovery, 2)} за цикл`,
      `Опора лагеря: ${recoverySummary}`,
      state.restrictionText,
      trip
        ? `Текущий выход: ${trip.zoneLabel}, ${Number.isFinite(trip.load) ? `нагрузка ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}, ` : ""}энергия -${trip.energyCost}`
        : "Текущий выход: выберите участок на карте, чтобы оценить путь и нагрузку",
    ]);
  },
});
