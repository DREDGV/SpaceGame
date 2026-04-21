// Resources / storage panel rendering.

Object.assign(UI.prototype, {
  renderResources() {
    const container = document.getElementById("resources-panel");
    if (!container) return;

    if (
      this.game.isPrologueActive() &&
      !this.game.getPrologueRevealState().showResources
    ) {
      container.innerHTML = "";
      this.lastResourcesRenderKey = "";
      return;
    }

    if (this.game.isPrologueActive()) {
      const visibleIds = this.game.getVisibleResourceIds();
      const renderKey = JSON.stringify({
        mode: "prologue",
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
        this.data.prologue?.resourcesTitle || "🌿 Найденные материалы";
      container.appendChild(title);

      const hint = document.createElement("div");
      hint.className = "storage-summary";
      hint.textContent =
        this.data.prologue?.resourcesHint ||
        "Пока это не склад и не производство — только то, что удалось найти руками.";
      container.appendChild(hint);

      const categoryMeta = {
        raw: {
          label: "Ресурсы",
          description: "Сырьё, которое удалось найти и унести при себе.",
        },
        tools: {
          label: "Инструменты",
          description: "То, что уже собрано руками в полезный предмет.",
        },
        supplies: {
          label: "Пища и вода",
          description: "Съедобные находки и вода, которые поддерживают человека.",
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

          const item = document.createElement("div");
          item.className = "resource-item prologue-resource-item";
          item.innerHTML = `
            <span class="resource-icon" style="color:${resource.color}">${this.getResourceDisplayIcon(id)}</span>
            <div class="resource-text">
              <span class="resource-name">${resourceName}</span>
              <span class="prologue-resource-total">Найдено всего: ${total}</span>
            </div>
            <span class="resource-count">${amount}</span>
          `;
          this.setTooltip(item, [
            resourceName,
            resourceDesc || "Материал раннего пролога",
            `Сейчас при себе: ${amount}`,
            `Всего найдено: ${total}`,
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
      overflowNotice.textContent = `Переполнение: ${this.getResourceDisplayIcon(recentOverflow.id)} ${this.getResourceDisplayName(recentOverflow.id)} -${recentOverflow.lost}`;
      this.setTooltip(overflowNotice, [
        "Последнее переполнение склада",
        `${this.getResourceDisplayName(recentOverflow.id)}: потеряно ${recentOverflow.lost}`,
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
  },
});
