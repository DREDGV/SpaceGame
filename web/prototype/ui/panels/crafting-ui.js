// Crafting panel rendering.

Object.assign(UI.prototype, {

  renderCrafting() {
    const container = document.getElementById("craft-panel");
    if (!container) return;

    if (
      this.game.isPrologueActive() &&
      !this.game.getPrologueRevealState().showCraft
    ) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = this.game.isPrologueActive()
      ? "🪢 Первые предметы"
      : "⚒️ Крафт";
    container.appendChild(title);

    if (this.game.isPrologueActive()) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        "Пока ещё нет мастерской и ремесла. Есть только одна полезная связка, которая помогает перейти от голых рук к первому орудию.";
      container.appendChild(hint);
    }

    const queueState = this.game.getCraftQueueState();
    const queueCard = document.createElement("div");
    queueCard.className = "craft-queue-card";
    queueCard.innerHTML = `
      <div class="craft-queue-header">
        <span class="craft-queue-title">${this.game.isPrologueActive() ? "Текущее занятие" : "Очередь производства"}</span>
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
    if (!this.game.isPrologueActive() || queueState.items.length > 0) {
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
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
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
        <span class="btn-icon">${copy.icon}</span>
        <span class="btn-label">${copy.name}</span>
        <span class="btn-flow">${costStr} → ${outStr}</span>
        ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
        <span class="btn-efficiency">Время производства: ${this.formatSeconds(recipe.craftTimeMs || 3000)}</span>
        <span class="btn-queue-status">${queueStateText}</span>
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
