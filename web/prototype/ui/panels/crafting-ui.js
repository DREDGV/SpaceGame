// Crafting panel rendering.

Object.assign(UI.prototype, {
  renderCrafting() {
    const container = document.getElementById("craft-panel");
    if (!container) return;
    const isEarlyProgression =
      this.game.isEarlyProgressionMode?.() ?? this.game.isPrologueActive();

    if (
      this.game.isPrologueActive() &&
      !this.game.getPrologueRevealState().showCraft
    ) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = isEarlyProgression ? "🪢 Первые предметы" : "⚒️ Крафт";
    container.appendChild(title);

    if (isEarlyProgression) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        "Пока ещё нет ремесла как отдельного дела. Сейчас можно только соединять простые находки в первые полезные вещи.";
      container.appendChild(hint);
    }

    const queueState = this.game.getCraftQueueState();
    const freeSlots = Math.max(
      0,
      queueState.capacity - queueState.items.length,
    );
    const queueCard = document.createElement("div");
    queueCard.className = "craft-queue-card";
    queueCard.innerHTML = `
      <div class="craft-queue-header">
        <span class="craft-queue-title">${isEarlyProgression ? "Текущее занятие" : "Очередь производства"}</span>
        <span class="craft-queue-capacity">${queueState.items.length} / ${queueState.capacity}</span>
      </div>
      <div class="craft-queue-slots">
        ${
          queueState.items.length === 0
            ? `<div class="craft-queue-empty has-tooltip" data-tooltip="Очередь пуста&#10;Добавьте рецепт, чтобы сразу запустить следующий производственный шаг">
              <span>Сейчас ничего не производится</span>
              <small>Можно добавить до ${queueState.capacity} задач</small>
            </div>`
            : `${queueState.items
                .map((item) => {
                  const stateLabel = item.isActive
                    ? `Сейчас · ${this.formatSeconds(item.remainingMs)}`
                    : "Далее";

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
                })
                .join("")}
            ${freeSlots > 0 ? `<div class="craft-queue-free">Свободно ещё ${freeSlots} ${freeSlots === 1 ? "место" : freeSlots >= 2 && freeSlots <= 4 ? "места" : "мест"}</div>` : ""}`
        }
      </div>
    `;
    if (!isEarlyProgression || queueState.items.length > 0) {
      this.setTooltip(queueCard, [
        "Очередь крафта: задания выполняются автоматически по порядку",
        `Слотов занято: ${queueState.items.length} / ${queueState.capacity}`,
        "В работе: текущий слот, Ожидает: ждёт своей очереди",
      ]);
      container.appendChild(queueCard);
    }

    for (const id of this.game.getVisibleRecipeIds()) {
      const recipe = this.data.recipes[id];
      if (!recipe) continue;

      const copy = this.getRecipeCopy(recipe);
      const unlocked =
        this.game.unlockedRecipes.has(id) &&
        (!recipe.unlockedBy || this.game.researched[recipe.unlockedBy]);
      const meetsReqs =
        !recipe.requires || this.game.buildings[recipe.requires];
      const canQueue = this.game.canQueueCraft(id);
      const effectiveCost = this.game.getRecipeCost(id);
      const missingInsights = (recipe.requiresInsights || []).filter(
        (insightId) => !this.game.insights[insightId],
      );

      const el = document.createElement("div");
      el.className = "recipe-card";

      if (!unlocked || !meetsReqs || missingInsights.length > 0) {
        el.classList.add("locked");
        const reqName =
          missingInsights.length > 0
            ? missingInsights
                .map(
                  (insightId) =>
                    this.data.prologue?.insights?.[insightId]?.name ||
                    insightId,
                )
                .join(" · ")
            : !unlocked && recipe.unlockedBy
              ? this.data.tech[recipe.unlockedBy]?.name || recipe.unlockedBy
              : recipe.requires
                ? this.data.buildings[recipe.requires]?.name || recipe.requires
                : null;
        const reqType =
          missingInsights.length > 0
            ? "Озарения"
            : !unlocked && recipe.unlockedBy
              ? "Исследование"
              : "Требуется";
        el.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-label">${copy.name}</span>
          ${reqName ? `<span class="btn-cooldown">${reqType}: ${reqName}</span>` : ""}
        `;
        container.appendChild(el);
        continue;
      }

      const btn = document.createElement("button");
      btn.className = "action-btn action-btn--craft";
      btn.type = "button";
      this.setButtonAvailability(btn, canQueue);

      const costStr = this.formatResourcePairs(effectiveCost);
      const outStr = this.formatResourcePairs(recipe.output, { plus: true });
      const craftDuration = this.game.getCraftDuration
        ? this.game.getCraftDuration(id)
        : recipe.craftTimeMs || 3000;
      let queueStateText =
        queueState.items.length === 0 ? "Стартует сразу" : "Встанет в очередь";

      if (queueState.items.length >= queueState.capacity) {
        queueStateText = "Очередь полна";
      } else if (!this.game.hasResources(effectiveCost)) {
        queueStateText = "Нет материалов";
      } else if (!canQueue) {
        queueStateText = "Сейчас нельзя";
      }

      btn.innerHTML = `
        <span class="btn-icon">${copy.icon}</span>
        <span class="btn-label">${copy.name}</span>
        <span class="btn-flow">${costStr} → ${outStr}</span>
        <div class="btn-meta-inline">
          <span class="btn-efficiency">⏱ ${this.formatSeconds(craftDuration)}</span>
          <span class="btn-queue-status">${queueStateText}</span>
        </div>
      `;
      this.setTooltip(btn, [
        copy.name,
        copy.description || "Производственный рецепт",
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
  },
});
