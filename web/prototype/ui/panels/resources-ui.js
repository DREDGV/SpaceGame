// Resources / storage panel rendering.

Object.assign(UI.prototype, {
  renderShellStatus() {
    this.renderShellHeader();
    this.renderResourceHud();
    this.renderShellSummary();

    const dayPanel = document.getElementById("day-cycle-panel");
    if (dayPanel) dayPanel.hidden = typeof this.game.getDayState !== "function";
  },

  renderShellHeader() {
    const eraEl = document.getElementById("shell-era-chip");
    const timeEl = document.getElementById("shell-time-chip");
    if (!eraEl || !timeEl) return;

    const eraData =
      this.game.getEraData?.() || this.data.eras?.[this.game.currentEra] || {};
    const eraProgress = this.game.getEraProgress?.() || null;
    const dayState = this.game.getDayState?.() || null;
    const energy = Math.floor(this.game.energy || 0);
    const maxEnergy = Math.floor(this.game.maxEnergy || 0);
    const renderKey = JSON.stringify({
      era: eraData.name || this.game.currentEra || "Пролог",
      completed: eraProgress?.completed ?? 0,
      total: eraProgress?.total ?? 0,
      day: dayState?.dayNumber ?? null,
      phase: dayState?.phase?.label || dayState?.phaseLabel || null,
      actionsLeft: dayState?.actionsLeftInPhase ?? null,
      energy,
      maxEnergy,
    });
    if (renderKey === this.lastShellHeaderRenderKey) return;
    this.lastShellHeaderRenderKey = renderKey;

    eraEl.innerHTML = "";
    const eraLabel = document.createElement("small");
    eraLabel.textContent = "Эпоха";
    const eraValue = document.createElement("strong");
    eraValue.textContent = eraProgress?.total
      ? `${eraData.name || "Пролог"} ${eraProgress.completed}/${eraProgress.total}`
      : eraData.name || "Пролог";
    eraEl.append(eraLabel, eraValue);

    timeEl.innerHTML = "";
    const timeLabel = document.createElement("small");
    const timeValue = document.createElement("strong");
    if (dayState) {
      timeLabel.textContent = `День ${dayState.dayNumber || 1}`;
      const phaseLabel = dayState.phase?.label || dayState.phaseLabel || "Ход";
      const actionsLeft = Number.isFinite(dayState.actionsLeftInPhase)
        ? ` · ${dayState.actionsLeftInPhase}`
        : "";
      timeValue.textContent = `${phaseLabel}${actionsLeft}`;
    } else {
      timeLabel.textContent = "Статус";
      timeValue.textContent =
        maxEnergy > 0 ? `Энергия ${energy}/${maxEnergy}` : "Активный ход";
    }
    timeEl.append(timeLabel, timeValue);
  },

  renderResourceHud() {
    const container = document.getElementById("top-resource-bar");
    if (!container) return;

    const revealState = this.game.getPrologueRevealState?.() || {};
    if (this.game.isPrologueActive?.() && !revealState.showResources) {
      container.innerHTML = "";
      this.lastResourceHudRenderKey = "";
      return;
    }

    const priorityIds = [
      "wood",
      "stone",
      "fiber",
      "clay",
      "plank",
      "brick",
      "food",
      "water",
    ];
    const visibleIds = new Set(
      this.game.getVisibleResourceIds?.() ||
        Object.keys(this.data.resources || {}),
    );
    const isEarlyProgression =
      this.game.isEarlyProgressionMode?.() ?? this.game.isPrologueActive?.();
    const showAllPriority =
      !isEarlyProgression || this.game.isCampSetupDone?.();
    const resourceIds = priorityIds.filter((id) => {
      if (!this.data.resources?.[id]) return false;
      return (
        showAllPriority ||
        visibleIds.has(id) ||
        (this.game.resources[id] || 0) > 0
      );
    });

    const storageTotals = this.game.getStorageTotals?.() || {
      used: 0,
      capacity: 0,
      free: 0,
      fillRatio: 0,
    };
    const tripLoad = this.game.getTripInventoryLoad?.() || 0;
    const carryCapacity = this.game.getCharacterCarryCapacity?.() || 0;
    const renderKey = JSON.stringify({
      ids: resourceIds,
      amounts: Object.fromEntries(
        resourceIds.map((id) => [id, this.game.resources[id] || 0]),
      ),
      storageUsed: storageTotals.used,
      storageCapacity: storageTotals.capacity,
      storageFill: Math.round((storageTotals.fillRatio || 0) * 100),
      tripLoad,
      carryCapacity,
    });
    if (renderKey === this.lastResourceHudRenderKey) return;
    this.lastResourceHudRenderKey = renderKey;

    container.innerHTML = "";

    for (const id of resourceIds) {
      const amount = this.game.resources[id] || 0;
      const card = this.createResourceHudItem({
        label: this.getResourceDisplayName(id),
        value: this.formatResourceAmount(id, amount),
        iconHtml: this.getResourceDisplayIcon(id),
        className: amount <= 0 ? "is-low" : "",
        tooltip: [
          this.getResourceDisplayName(id),
          this.data.resources[id]?.description || "Ресурс",
          `Сейчас доступно: ${this.formatResourceAmount(id, amount)}`,
        ],
      });
      container.appendChild(card);
    }

    if (carryCapacity > 0) {
      const fillRatio = tripLoad / carryCapacity;
      container.appendChild(
        this.createResourceHudItem({
          label: "Груз",
          value: `${this.formatNumber(tripLoad, 1)}/${this.formatNumber(carryCapacity, 1)}`,
          iconText: "🎒",
          className: `is-status ${fillRatio >= 0.9 ? "is-full" : ""}`,
          tooltip: [
            "Походная ноша",
            `Занято: ${this.formatNumber(tripLoad, 1)} из ${this.formatNumber(carryCapacity, 1)}`,
          ],
        }),
      );
    }

    const storageFill = Number.isFinite(storageTotals.fillRatio)
      ? storageTotals.fillRatio
      : 0;
    container.appendChild(
      this.createResourceHudItem({
        label: "Склад",
        value: `${storageTotals.used || 0}/${storageTotals.capacity || 0}`,
        iconText: "▦",
        isButton: true,
        className: `is-status ${storageFill >= 0.9 ? "is-full" : ""}`,
        tooltip: [
          "Подробный склад",
          `Использовано: ${storageTotals.used || 0} из ${storageTotals.capacity || 0}`,
          `Свободно: ${storageTotals.free || 0}`,
        ],
      }),
    );
  },

  createResourceHudItem({
    label,
    value,
    iconHtml = "",
    iconText = "",
    tooltip = [],
    className = "",
    isButton = false,
  }) {
    const card = document.createElement(isButton ? "button" : "div");
    card.className =
      `resource-hud-item ${isButton ? "is-button" : ""} ${className}`.trim();
    if (isButton) {
      card.type = "button";
      card.setAttribute("data-shell-storage-toggle", "true");
    }

    const icon = document.createElement("span");
    icon.className = "resource-hud-icon";
    if (iconHtml) {
      icon.innerHTML = iconHtml;
    } else {
      icon.textContent = iconText || "•";
    }

    const copy = document.createElement("span");
    copy.className = "resource-hud-copy";
    const labelEl = document.createElement("span");
    labelEl.className = "resource-hud-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "resource-hud-value";
    valueEl.textContent = value;
    copy.append(labelEl, valueEl);

    card.append(icon, copy);
    this.setTooltip(card, tooltip);
    return card;
  },

  renderShellSummary() {
    const container = document.getElementById("shell-summary-panel");
    if (!container) return;

    let mapState = null;
    try {
      mapState = this._getCampMapStateSnapshot?.() || null;
    } catch (error) {
      mapState = null;
    }

    const storageTotals = this.game.getStorageTotals?.() || {
      used: 0,
      capacity: 0,
    };
    const buildingCount = Object.values(this.game.buildings || {}).filter(
      Boolean,
    ).length;
    const activeWork =
      (this.game.craftQueue?.length || 0) +
      (this.game.activeConstruction ? 1 : 0) +
      (this.game.activeResearch ? 1 : 0) +
      (this.game.researchQueue?.length || 0);
    const stats = [
      {
        label: "Карта",
        value: mapState
          ? `${mapState.discoveredCount}/${mapState.totalCount}`
          : "—",
      },
      {
        label: "Освоено",
        value: mapState ? `${mapState.developedCount}` : "—",
      },
      {
        label: "Постройки",
        value: `${buildingCount}`,
      },
      {
        label: "Работы",
        value: `${activeWork}`,
      },
      {
        label: "Тропы",
        value: mapState ? `${mapState.trailCount || 0}` : "—",
      },
      {
        label: "Склад",
        value: `${storageTotals.used || 0}/${storageTotals.capacity || 0}`,
      },
    ];
    const renderKey = JSON.stringify(stats);
    if (renderKey === this.lastShellSummaryRenderKey) return;
    this.lastShellSummaryRenderKey = renderKey;

    container.innerHTML = "";
    const head = document.createElement("div");
    head.className = "shell-summary-head";
    const title = document.createElement("h3");
    title.textContent = "Сводка";
    head.appendChild(title);
    container.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "shell-summary-grid";
    for (const stat of stats) {
      const item = document.createElement("div");
      item.className = "shell-summary-stat";
      const labelEl = document.createElement("span");
      labelEl.textContent = stat.label;
      const valueEl = document.createElement("strong");
      valueEl.textContent = stat.value;
      item.append(labelEl, valueEl);
      grid.appendChild(item);
    }
    container.appendChild(grid);
  },

  renderResources() {
    const container = document.getElementById("resources-panel");
    if (!container) return;
    const isEarlyProgression =
      this.game.isEarlyProgressionMode?.() ?? this.game.isPrologueActive();

    if (
      this.game.isPrologueActive() &&
      !this.game.getPrologueRevealState().showResources
    ) {
      container.innerHTML = "";
      this.lastResourcesRenderKey = "";
      return;
    }

    if (isEarlyProgression) {
      const visibleIds = this.game.getVisibleResourceIds();
      const renderKey = JSON.stringify({
        mode: "early-progression",
        resources: Object.fromEntries(
          visibleIds.map((id) => [id, this.game.resources[id] || 0]),
        ),
      });
      if (renderKey === this.lastResourcesRenderKey) {
        return;
      }
      this.lastResourcesRenderKey = renderKey;

      container.innerHTML = "";
      const title = document.createElement("h3");
      title.textContent =
        this.data.prologue?.resourcesTitle || "🧺 Ранний запас у ночёвки";
      container.appendChild(title);

      const hint = document.createElement("div");
      hint.className = "storage-summary";
      hint.textContent =
        this.data.prologue?.resourcesHint ||
        "До основания лагеря найденное сначала несётся в походной ноше, а в ранний запас попадает после возвращения к ночёвке.";
      container.appendChild(hint);

      const categoryMeta = {
        raw: {
          label: "Ресурсы",
          description:
            "Сырьё, которое уже сгружено у ночёвки и готово для первых шагов.",
        },
        tools: {
          label: "Инструменты",
          description: "То, что уже собрано руками в полезный предмет.",
        },
        supplies: {
          label: "Пища и вода",
          description:
            "Запас пищи и воды у ночёвки, который помогает пережить первые дни.",
        },
        materials: {
          label: "Материалы",
          description: "Обработанные заготовки и части для следующих шагов.",
        },
        other: {
          label: "Другое",
          description: "Прочие находки и особые предметы раннего цикла.",
        },
      };

      const grouped = new Map();
      for (const id of visibleIds) {
        const resource = this.data.resources[id];
        if (!resource) continue;
        const groupKey = resource.storageCategory || "other";
        if (!grouped.has(groupKey)) grouped.set(groupKey, []);
        const resourceName =
          id === "wood"
            ? "Ветки"
            : id === "stone"
              ? "Камни"
              : id === "fiber"
                ? "Волокна"
                : id === "crude_tools"
                  ? "Грубое орудие"
                  : resource.name;
        const resourceDesc =
          id === "wood"
            ? "Сухие ветви, которые можно унести руками и пустить на первое орудие или костёр."
            : id === "stone"
              ? "Подобранные камни и сколы. Среди них встречаются острые края."
              : id === "fiber"
                ? "Трава и волокна, пригодные для простых связок."
                : id === "crude_tools"
                  ? "Первое связанное орудие, собранное из ветви, камня и волокна."
                  : resource.description;

        grouped.get(groupKey).push({
          id,
          resource,
          resourceName,
          resourceDesc,
          amount: this.game.resources[id] || 0,
          total: this.game.resourceTotals[id] || 0,
        });
      }

      const groups = document.createElement("div");
      groups.className = "storage-groups prologue-resource-groups";

      for (const [groupKey, items] of grouped) {
        const meta = categoryMeta[groupKey] || categoryMeta.other;
        const section = document.createElement("section");
        section.className = "storage-category prologue-resource-category";
        section.innerHTML = `
          <div class="storage-category-header">
            <div class="storage-category-title">${meta.label}</div>
            <div class="storage-category-meta">${items.length}</div>
          </div>
        `;
        this.setTooltip(section.querySelector(".storage-category-header"), [
          meta.label,
          meta.description || "Категория ресурсов",
          `Предметов в группе: ${items.length}`,
        ]);

        const list = document.createElement("div");
        list.className = "storage-resource-list";

        for (const itemData of items) {
          const { id, resource, resourceName, resourceDesc, amount, total } =
            itemData;
          const amountLabel = this.formatResourceAmount(id, amount);
          const totalLabel = this.formatResourceAmount(id, total);

          const item = document.createElement("div");
          item.className = "resource-item prologue-resource-item";
          item.innerHTML = `
            <span class="resource-icon" style="color:${resource.color}">${this.getResourceDisplayIcon(id)}</span>
            <div class="resource-text">
              <span class="resource-name">${resourceName}</span>
              <span class="prologue-resource-total">Найдено всего: ${totalLabel}</span>
            </div>
            <span class="resource-count">${amountLabel}</span>
          `;
          this.setTooltip(item, [
            resourceName,
            resourceDesc || "Материал раннего пролога",
            `Сейчас в раннем запасе: ${amountLabel}`,
            `Всего найдено: ${totalLabel}`,
            `Категория: ${meta.label}`,
          ]);
          list.appendChild(item);
        }

        section.appendChild(list);
        groups.appendChild(section);
      }

      container.appendChild(groups);
      return;
    }

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
      const lostLabel = this.formatResourceAmount(
        recentOverflow.id,
        recentOverflow.lost,
      );
      overflowNotice.textContent = `Переполнение: ${this.getResourceDisplayIcon(recentOverflow.id)} ${this.getResourceDisplayName(recentOverflow.id)} -${lostLabel}`;
      this.setTooltip(overflowNotice, [
        "Последнее переполнение склада",
        `${this.getResourceDisplayName(recentOverflow.id)}: потеряно ${lostLabel}`,
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
          <div class="storage-category-heading">
            <div class="storage-category-title">${group.label}</div>
            ${group.flowLabel ? `<div class="storage-category-flow">${group.flowLabel}</div>` : ""}
          </div>
          <div class="storage-category-meta">${group.usedSpace} места</div>
        </div>
      `;
      this.setTooltip(section, [
        group.label,
        group.flowLabel || "",
        group.description || "Категория ресурсов склада",
        `Занято в категории: ${group.usedSpace}`,
        `Доля общего склада: ${Math.round(group.contributionRatio * 100)}%`,
      ]);

      const list = document.createElement("div");
      list.className = "storage-resource-list";

      for (const item of group.items) {
        const row = document.createElement("div");
        row.className = "storage-resource-row";
        const amountLabel = this.formatResourceAmount(item.id, item.amount);
        const capLabel = this.formatResourceAmount(
          item.id,
          this.game.maxResourceCap,
        );
        const overflowLabel = item.overflow
          ? this.formatResourceAmount(item.id, item.overflow.lost)
          : "";

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
                <span class="storage-resource-count">${amountLabel}</span>
              </div>
              ${item.overflow ? `<div class="storage-overflow-badge">Переполнение -${overflowLabel}</div>` : ""}
            </div>
          </div>
          <div class="storage-resource-bar">
            <div class="storage-resource-bar-fill" style="width:${Math.round(item.fillRatio * 100)}%"></div>
          </div>
        `;

        this.setTooltip(row, [
          item.def.name,
          item.def.description || "Ресурс склада",
          `На складе: ${amountLabel} / ${capLabel}`,
          `Размер ресурса: x${item.storageSize}`,
          `Занимает места: ${item.usedSpace}`,
          `Доля общего склада: ${Math.round(item.contributionRatio * 100)}%`,
          item.overflow
            ? `Последнее переполнение: потеряно ${overflowLabel}`
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
  },
});
