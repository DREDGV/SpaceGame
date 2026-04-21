// Gather panel — prologue, pre-camp, post-camp modes.

Object.assign(UI.prototype, {
  renderGather() {
    const container = document.getElementById("gather-panel");
    if (!container) return;

    // ── POST-CAMP: navigation panel "Resources around camp" ─────────────────
    const mapState = this.game.getCampMapState();
    if (mapState.campSetupDone) {
      this._renderGatherPostCamp(container, mapState);
      return;
    }

    // ── PRE-CAMP / PROLOGUE: tile-based gather rows. ────────────────────────
    // isPrologueActive() stays true the whole pre-camp phase (until all
    // onboarding steps complete), so we always show tile-based rows here.
    // The old abstract prologue panel is no longer needed.
    this._renderGatherPreCamp(container);
  },

  /** Prologue mode: classic action buttons for abstract hand-gathering. */

  _renderGatherPrologue(container) {
    container.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent =
      this.data.prologue?.actionsTitle || "🖐️ Первые действия";
    container.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      this.data.prologue?.actionsHint ||
      "Первые шаги — это не добыча, а поиск того, что можно подобрать, унести и использовать.";
    container.appendChild(hint);

    for (const id of this.game.getVisibleGatherActions()) {
      const action = this.data.gatherActions[id];
      if (!action) continue;
      if (action.mapOnly) continue; // tile-bound actions are used via the map, not the gather panel

      const copy = this.getGatherActionCopy(action);
      const profile = this.game.getGatherProfile(id);
      const cooldown = this.game.getCooldownRemaining(id);
      const effectiveEnergyCost = profile?.energyCost ?? action.energyCost;
      const disabled =
        cooldown > 0 || !this.game.hasEnergy(effectiveEnergyCost);
      const output = profile?.output || this.game.getGatherOutput(id);
      const outputStr = this.formatResourcePairs(output, { plus: true });
      const loadText = profile
        ? `🎒 ${this.formatNumber(profile.load)} / ${this.formatNumber(profile.carryCapacity)}`
        : "";
      const zoneText = profile?.tile ? `🗺 ${profile.zoneLabel}` : "";
      const terrainText = profile?.terrainLabel
        ? `🌍 ${profile.terrainLabel}`
        : "";

      const btn = document.createElement("button");
      btn.className = "action-btn action-btn--prologue";
      btn.type = "button";
      btn.innerHTML = `
        <span class="btn-icon">${copy.icon}</span>
        <span class="btn-label">${copy.name}</span>
        ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
        <div class="btn-meta-inline">
          <span class="btn-output">Находка: ${outputStr}</span>
          <span class="btn-cost">⚡ -${effectiveEnergyCost}</span>
          ${Number.isFinite(profile?.satietyCost) ? `<span class="btn-cost">🍖 -${this.formatNumber(profile.satietyCost, 2)}</span>` : ""}
          ${Number.isFinite(profile?.hydrationCost) ? `<span class="btn-cost">💧 -${this.formatNumber(profile.hydrationCost, 2)}</span>` : ""}
          ${loadText ? `<span class="btn-cost">${loadText}</span>` : ""}
        </div>
        ${zoneText || terrainText ? `<span class="btn-efficiency">${[zoneText, terrainText].filter(Boolean).join(" · ")}</span>` : ""}
        ${profile?.blockedReason ? `<span class="btn-cooldown">🧍 ${profile.blockedReason}</span>` : ""}
        ${profile?.limitedByCarry ? '<span class="btn-cooldown">🎒 Переносимость ограничивает вынос</span>' : ""}
        ${cooldown > 0 ? `<span class="btn-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
        ${!this.game.hasEnergy(effectiveEnergyCost) && cooldown === 0 ? '<span class="btn-cooldown">⚡ Нет сил</span>' : ""}
      `;
      btn.classList.toggle("cooldown", disabled);
      btn.classList.toggle("busy", cooldown > 0);
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
      // Нет setTooltip: кнопка уже показывает все данные inline (icon, name, desc, Находка, Энергия, Нагрузка, Местность)
      btn.addEventListener("click", () => {
        this.game.gather(id);
        this.render({ forcePanels: true });
      });
      container.appendChild(btn);
    }
  },

  /**
   * Pre-camp mode (after prologue, before camp founded).
   * Shows resource tiles from the map as clickable rows, so the player
   * can see where resources come from and gather directly from this panel.
   * Clicking a row selects the tile on the map and gathers from it.
   */

  _renderGatherPreCamp(container) {
    container.innerHTML = "";

    const intro = this.data.campFoundingIntro || {};
    const cost = this.game.getCampFoundingCost();
    const check = this.game.canFoundCamp();
    const progressItems = this.getCampFoundingProgressItems(cost);
    const mapState = this.game.getCampMapState();

    // ── Header ──
    const title = document.createElement("h3");
    title.textContent = "🪓 Подготовка к основанию";
    container.appendChild(title);

    // ── Resource progress strip ──
    const progress = document.createElement("div");
    progress.className = "gather-precamp-progress";
    progress.innerHTML = progressItems
      .map(
        (item) => `
          <div class="gather-precamp-res${item.done ? " is-done" : ""}">
            <div class="gather-precamp-res-head">
              <span>${item.icon} ${item.name}</span>
              <strong>${item.have}/${item.needed}</strong>
            </div>
            <div class="gather-precamp-res-meta">
              ${item.done ? "Готово" : `Осталось собрать: ${item.missing}`}
            </div>
          </div>
        `,
      )
      .join("");
    container.appendChild(progress);

    if (check.ok) {
      const readyNote = document.createElement("p");
      readyNote.className = "gather-precamp-ready";
      readyNote.textContent =
        intro.questReadyText ||
        "Материалы собраны — выберите место на карте и основайте лагерь.";
      container.appendChild(readyNote);
      return;
    }

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "Нажмите на участок с ресурсами на карте выше или соберите прямо из списка ниже.";
    container.appendChild(hint);

    // ── Resource tiles from map — primary gather interface ──
    const resourceTiles = mapState.tiles
      .filter(
        (t) =>
          t.actionId &&
          t.state !== "hidden" &&
          t.state !== "silhouette" &&
          t.state !== "camp_candidate",
      )
      .sort((a, b) => {
        // starter_cache first — it gives all founding resources in one go
        if (a.id === "starter_cache") return -1;
        if (b.id === "starter_cache") return 1;
        return (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0);
      });

    if (resourceTiles.length === 0) {
      const noTiles = document.createElement("p");
      noTiles.className = "hint";
      noTiles.textContent = "Поблизости не видно участков с ресурсами.";
      container.appendChild(noTiles);
      return;
    }

    const selectedTileId = this.game.getSelectedCampTileId();

    for (const tile of resourceTiles) {
      const action = this.data.gatherActions[tile.actionId];
      if (!action) continue;
      const actionCopy = this.getGatherActionCopy(action);
      const profile = this.game.getGatherProfile(action.id, {
        tileId: tile.id,
      });
      const cooldown = this.game.getCooldownRemaining(action.id);
      const effectiveEnergyCost = profile?.energyCost ?? action.energyCost;
      const canGather = this.game.canGather(action.id, { tileId: tile.id });
      const output = profile?.output || this.game.getGatherOutput(action.id);
      const outputStr = this.formatResourcePairs(output, { plus: true });
      const isDepleted = !!tile.isDepleted;
      const stockStr =
        Number.isFinite(tile.resourceRemaining) &&
        Number.isFinite(tile.resourceCapacity)
          ? `${tile.resourceRemaining}/${tile.resourceCapacity}`
          : "";
      const dist = tile.distanceFromCamp || 0;
      const zoneLabel =
        dist === 0 ? "центр" : dist === 1 ? "ближняя зона" : "дальний выход";

      // Highlight tiles that provide a resource still needed for founding
      const stillNeeded =
        !isDepleted &&
        Object.keys(output || {}).some(
          (resId) =>
            cost[resId] && (this.game.resources[resId] || 0) < cost[resId],
        );

      const row = document.createElement("div");
      row.className = "gather-resource-row gather-resource-row--precamp";
      if (isDepleted) row.classList.add("is-depleted");
      if (stillNeeded) row.classList.add("is-needed");
      if (tile.id === selectedTileId) row.classList.add("is-selected");

      const deliveryNote =
        profile?.deliveryTrips > 1
          ? `<span class="grr-warn">${profile.deliveryTrips} ходки</span>`
          : "";

      row.innerHTML = `
        <div class="grr-left">
          <span class="grr-icon">${tile.icon || actionCopy.icon}</span>
          <div class="grr-info">
            <span class="grr-name">${tile.name}</span>
            <span class="grr-meta">
              🗺 ${zoneLabel}${stockStr ? ` · 📦 ${stockStr}` : ""}
            </span>
            ${isDepleted ? '<span class="grr-blocked">Участок исчерпан</span>' : ""}
            ${!isDepleted && cooldown > 0 ? `<span class="grr-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
            ${profile?.blockedReason && !isDepleted ? `<span class="grr-blocked">${profile.blockedReason}</span>` : ""}
          </div>
        </div>
        <div class="grr-right">
          <span class="grr-output">${outputStr}</span>
          <span class="grr-energy">⚡ ${effectiveEnergyCost}</span>
          ${Number.isFinite(profile?.satietyCost) ? `<span class="grr-energy">🍖 -${this.formatNumber(profile.satietyCost, 2)}</span>` : ""}
          ${Number.isFinite(profile?.hydrationCost) ? `<span class="grr-energy">💧 -${this.formatNumber(profile.hydrationCost, 2)}</span>` : ""}
          ${deliveryNote}
        </div>
      `;

      // Row click → select tile on map and scroll into view
      row.addEventListener("click", () => {
        this.game.selectCampTile(tile.id);
        document.getElementById("camp-map-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        this.render({ forcePanels: true });
      });

      // Inline gather button
      if (!isDepleted && canGather) {
        const gatherBtn = document.createElement("button");
        gatherBtn.className = "action-btn action-btn--gather-tile";
        gatherBtn.innerHTML = `${actionCopy.icon} Собрать`;
        gatherBtn.type = "button";
        gatherBtn.addEventListener("click", (e) => {
          e.stopPropagation(); // don't trigger row select
          this.game.gather(action.id, { tileId: tile.id });
          this.game.selectCampTile(tile.id); // show which tile was used
          this.render({ forcePanels: true });
        });
        row.appendChild(gatherBtn);
      }

      container.appendChild(row);
    }
  },

  /**
   * Post-camp mode: logistics overview panel.
   * Shows resource tiles grouped by type, with distance / path / stock info.
   * Clicking a row selects the tile on the map (no direct gather call here).
   */

  _renderGatherPostCamp(container, mapState) {
    container.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = "📍 Ресурсы вокруг лагеря";
    container.appendChild(title);

    // Collect all tiles that have a gather action and are not hidden
    const resourceTiles = mapState.tiles.filter(
      (t) =>
        t.actionId &&
        t.state !== "hidden" &&
        t.state !== "silhouette" &&
        t.state !== "camp_candidate",
    );

    if (resourceTiles.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Поблизости пока не видно участков с ресурсами.";
      container.appendChild(empty);
      return;
    }

    // Group by resourceType (or actionId as fallback)
    const groups = new Map();
    for (const tile of resourceTiles) {
      const key = tile.resourceType || tile.actionId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tile);
    }

    const selectedTileId = this.game.getSelectedCampTileId();

    for (const [groupKey, tiles] of groups) {
      // Group header: use first tile's action icon + name
      const firstAction = this.data.gatherActions[tiles[0].actionId];
      if (!firstAction) continue;
      const actionCopy = this.getGatherActionCopy(firstAction);
      const actionIcon = this.getPlainIcon(actionCopy.icon, "•");

      const groupEl = document.createElement("div");
      groupEl.className = "gather-resource-group";

      const groupHeader = document.createElement("div");
      groupHeader.className = "gather-resource-group-header";
      groupHeader.textContent = `${actionIcon} ${actionCopy.name}`;
      groupEl.appendChild(groupHeader);

      for (const tile of tiles) {
        const action = this.data.gatherActions[tile.actionId];
        if (!action) continue;
        const profile = this.game.getGatherProfile(action.id, {
          tileId: tile.id,
        });
        const cooldown = this.game.getCooldownRemaining(action.id);
        const canGather =
          !!profile &&
          !profile.blockedReason &&
          cooldown === 0 &&
          this.game.hasEnergy(profile.energyCost ?? action.energyCost);

        const dist = tile.distanceFromCamp ?? 0;
        const isFar = dist > 1;
        const hasPath = tile.pathLevel && tile.pathLevel !== "none";
        const noPath = dist > 0 && !hasPath;

        const row = document.createElement("div");
        row.className = "gather-resource-row";
        if (tile.isDepleted) row.classList.add("is-depleted");
        if (isFar) row.classList.add("is-far");
        if (noPath) row.classList.add("no-path");
        if (tile.id === selectedTileId) row.classList.add("is-selected");

        // Zone label
        const zoneLabel =
          dist === 0
            ? "центр"
            : dist === 1
              ? "ближняя зона"
              : `дальний выход (${dist})`;

        // Path indicator
        const pathIcon = hasPath
          ? tile.pathData?.icon || "🥾"
          : noPath && dist > 0
            ? "·"
            : "";
        const pathLabel = hasPath
          ? tile.pathData?.label || "Тропа"
          : noPath
            ? "нет тропы"
            : "";

        // Stock display
        const stockStr =
          Number.isFinite(tile.resourceRemaining) &&
          Number.isFinite(tile.resourceCapacity)
            ? `${tile.resourceRemaining}/${tile.resourceCapacity}`
            : "";

        // Energy cost
        const energyCost = profile?.energyCost ?? action.energyCost;

        row.innerHTML = `
          <div class="grr-left">
            <span class="grr-icon">${tile.icon || actionCopy.icon}</span>
            <div class="grr-info">
              <span class="grr-name">${tile.name}</span>
              <span class="grr-meta">
                🗺 ${zoneLabel}
                ${pathIcon ? ` · ${pathIcon} ${pathLabel}` : ""}
                ${stockStr ? ` · 📦 ${stockStr}` : ""}
              </span>
              ${profile?.blockedReason ? `<span class="grr-blocked">${profile.blockedReason}</span>` : ""}
              ${tile.isDepleted ? '<span class="grr-blocked">Участок исчерпан</span>' : ""}
              ${noPath && dist > 1 ? '<span class="grr-warn">Тяжёлый путь</span>' : ""}
            </div>
          </div>
          <div class="grr-right">
            <span class="grr-energy">⚡ ${energyCost}</span>
            ${Number.isFinite(profile?.satietyCost) ? `<span class="grr-energy">🍖 -${this.formatNumber(profile.satietyCost, 2)}</span>` : ""}
            ${Number.isFinite(profile?.hydrationCost) ? `<span class="grr-energy">💧 -${this.formatNumber(profile.hydrationCost, 2)}</span>` : ""}
            ${cooldown > 0 ? `<span class="grr-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
          </div>
        `;

        this.setTooltip(row, [
          tile.name,
          tile.description || "",
          `Зона: ${zoneLabel}`,
          pathLabel ? `Путь: ${pathIcon} ${pathLabel}` : "Путь: не проложен",
          stockStr ? `Запас участка: ${stockStr}` : "",
          `Энергия: -${energyCost}`,
          Number.isFinite(profile?.satietyCost)
            ? `Сытость: -${this.formatNumber(profile.satietyCost, 2)}`
            : "",
          Number.isFinite(profile?.hydrationCost)
            ? `Вода: -${this.formatNumber(profile.hydrationCost, 2)}`
            : "",
          profile
            ? `Нагрузка: ${this.formatNumber(profile.load)} / ${this.formatNumber(profile.carryCapacity)}`
            : "",
          profile?.terrainLabel ? `Местность: ${profile.terrainLabel}` : "",
          tile.isDepleted ? "Участок исчерпан — ресурсов не осталось" : "",
          "Нажмите, чтобы выбрать участок на карте",
        ]);

        row.addEventListener("click", () => {
          this.game.selectCampTile(tile.id);
          // Scroll the map into view
          document.getElementById("camp-map-panel")?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
          this.render({ forcePanels: true });
        });

        groupEl.appendChild(row);
      }

      container.appendChild(groupEl);
    }

    // Hint at the bottom
    const hint = document.createElement("p");
    hint.className = "hint gather-map-hint";
    hint.textContent =
      "Выберите участок, чтобы собрать ресурс через карту лагеря.";
    container.appendChild(hint);
  },
});
