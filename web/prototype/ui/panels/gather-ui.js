// Gather panel — prologue, pre-camp, post-camp modes.

Object.assign(UI.prototype, {
  renderGather() {
    const container = document.getElementById("gather-panel");
    if (!container) return;

    // ── POST-CAMP: navigation panel "Resources around camp" ─────────────────
    const mapState = this._getCampMapStateSnapshot();
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

  _scheduleGatherCooldownRefresh(durationMs = 0) {
    if (this._gatherCooldownTimer) {
      clearTimeout(this._gatherCooldownTimer);
      this._gatherCooldownTimer = null;
    }

    const totalMs = Math.max(0, Number(durationMs) || 0);
    if (totalMs <= 0) return;

    const endsAt = Date.now() + totalMs;
    const tick = () => {
      this.render({ forcePanels: true });
      const remainingMs = endsAt - Date.now();
      if (remainingMs > 0) {
        this._gatherCooldownTimer = setTimeout(
          tick,
          Math.min(250, remainingMs),
        );
      } else {
        this._gatherCooldownTimer = null;
      }
    };

    this._gatherCooldownTimer = setTimeout(tick, Math.min(250, totalMs));
  },

  _renderGatherDecisionChips(profile, energyCost, options = {}) {
    const {
      includeEnergy = true,
      includeDuration = false,
      includeTimeCost = false,
      includeNeeds = true,
      includeCarry = true,
      includeTrips = true,
      onlyAlerts = false,
    } = options;
    const chips = [];
    if (includeEnergy) {
      chips.push(
        `<span class="grr-energy">⚡ ${this.formatNumber(energyCost, 2)} сил</span>`,
      );
    }
    if (includeDuration && Number.isFinite(options.durationMs)) {
      chips.push(
        `<span class="grr-energy">⏱ ${this.formatSeconds(options.durationMs)}</span>`,
      );
    }
    if (includeTimeCost && Number.isFinite(options.timeCost)) {
      chips.push(`<span class="grr-energy">⏳ ${options.timeCost}</span>`);
    }
    const needsTone = profile?.needsImpact?.tone || "info";
    if (
      includeNeeds &&
      profile?.needsImpact &&
      (!onlyAlerts || (needsTone !== "ok" && needsTone !== "info"))
    ) {
      chips.push(
        `<span class="grr-energy grr-energy--${needsTone}">🍖💧 ${profile.needsImpact.label}</span>`,
      );
    } else if (includeNeeds && !onlyAlerts) {
      const costs = [];
      if (Number.isFinite(profile?.satietyCost)) {
        costs.push(`🍖 -${this.formatNumber(profile.satietyCost, 2)}`);
      }
      if (Number.isFinite(profile?.hydrationCost)) {
        costs.push(`💧 -${this.formatNumber(profile.hydrationCost, 2)}`);
      }
      if (costs.length) {
        chips.push(`<span class="grr-energy">${costs.join(" · ")}</span>`);
      }
    }
    const carryTone = profile?.carryState?.tone || "info";
    if (
      includeCarry &&
      profile?.carryState &&
      (!onlyAlerts || (carryTone !== "ok" && carryTone !== "info"))
    ) {
      chips.push(
        `<span class="grr-energy grr-energy--${carryTone}">🧺 ${profile.carryState.label}</span>`,
      );
    }
    if (includeTrips && profile?.deliveryTrips > 1) {
      chips.push(
        `<span class="grr-warn">${profile.deliveryTrips} ходки</span>`,
      );
    }
    return chips.join("");
  },

  _focusGatherTile(tileId, options = {}) {
    if (!tileId) return;
    this.game.selectCampTile?.(tileId);
    document.getElementById("camp-map-panel")?.scrollIntoView({
      behavior: options.behavior || "smooth",
      block: "nearest",
    });
    this.render({ forcePanels: true });
  },

  _getFoundingNeedLabels(output = {}, cost = {}) {
    return Object.keys(output)
      .filter((resId) => {
        if (!cost[resId]) return false;
        const have =
          this.game.getCampFoundingResourceAmount?.(resId) ??
          this.game.resources?.[resId] ??
          0;
        return have < cost[resId];
      })
      .map(
        (resId) =>
          `${this.getResourceDisplayIcon(resId)} ${this.getResourceDisplayName(resId)}`,
      );
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
      const gatherDurationMs =
        profile?.gatherDurationMs || this.game.getGatherDuration(id);
      const outputStr = this.formatResourcePairs(output, { plus: true });
      const loadText = profile
        ? `🧺 ${this.formatNumber(profile.load)} / ${this.formatNumber(profile.carryCapacity)}`
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
        <span class="btn-label">В работу: ${copy.name}</span>
        ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
        <div class="btn-meta-inline">
          <span class="btn-output">Находка: ${outputStr}</span>
          <span class="btn-cost">⚡ -${this.formatNumber(effectiveEnergyCost, 2)}</span>
          <span class="btn-cost">⏱ ${this.formatSeconds(gatherDurationMs)}</span>
          <span class="btn-cost">⏳ ${profile?.timeCost || 1}</span>
          ${Number.isFinite(profile?.satietyCost) ? `<span class="btn-cost">🍖 -${this.formatNumber(profile.satietyCost, 2)}</span>` : ""}
          ${Number.isFinite(profile?.hydrationCost) ? `<span class="btn-cost">💧 -${this.formatNumber(profile.hydrationCost, 2)}</span>` : ""}
          ${loadText ? `<span class="btn-cost">${loadText}</span>` : ""}
        </div>
        ${zoneText || terrainText ? `<span class="btn-efficiency">${[zoneText, terrainText].filter(Boolean).join(" · ")}</span>` : ""}
        ${profile?.blockedReason ? `<span class="btn-cooldown">🧍 ${profile.blockedReason}</span>` : ""}
        ${profile?.limitedByCarry ? '<span class="btn-cooldown">🧺 Переносимость ограничивает вынос</span>' : ""}
        ${cooldown > 0 ? `<span class="btn-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
        ${!this.game.hasEnergy(effectiveEnergyCost) && cooldown === 0 ? '<span class="btn-cooldown">⚡ Нет сил</span>' : ""}
      `;
      btn.classList.toggle("cooldown", disabled);
      btn.classList.toggle("busy", cooldown > 0);
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
      // Нет setTooltip: кнопка уже показывает все данные inline (icon, name, desc, Находка, Энергия, Нагрузка, Местность)
      btn.addEventListener("click", () => {
        if (this.game.enqueueManualGather(id)) {
          this.render({ forcePanels: true });
        } else {
          this.render({ forcePanels: true });
        }
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
    const carriedFoundingTotal = progressItems.reduce(
      (sum, item) => sum + (item.carried || 0),
      0,
    );
    const mapState = this._getCampMapStateSnapshot();

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
              ${this.formatCampFoundingResourceMeta?.(item) || (item.done ? "Готово" : `Осталось собрать: ${item.missing}`)}
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
      carriedFoundingTotal > 0
        ? "Материалы, которые персонаж несёт с собой, уже засчитываются для основания. Доберите недостающее или выберите место стоянки, когда всё готово."
        : "Нажмите на участок с ресурсами на карте выше или соберите прямо из списка ниже.";
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
      .sort((a, b) => (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0));

    if (resourceTiles.length === 0) {
      const noTiles = document.createElement("p");
      noTiles.className = "hint";
      noTiles.textContent =
        "Поблизости не видно мест, где можно что-то собрать.";
      container.appendChild(noTiles);
      return;
    }

    const selectedTileId = this.game.getSelectedCampTileId();
    const neededTileCount = resourceTiles.filter((tile) => {
      if (tile.isDepleted) return false;
      const action = this.data.gatherActions[tile.actionId];
      if (!action) return false;
      const output = this.game.getGatherOutput(action.id);
      return this._getFoundingNeedLabels(output, cost).length > 0;
    }).length;

    const routesIntro = document.createElement("div");
    routesIntro.className = "gather-route-summary";
    routesIntro.innerHTML = `
      <div class="gather-route-summary-head">
        <div class="gather-route-summary-title">Маршруты сбора</div>
        <div class="gather-route-summary-stats">
          <span class="gather-route-summary-chip">${resourceTiles.length} участков</span>
          <span class="gather-route-summary-chip${neededTileCount > 0 ? " is-needed" : ""}">${neededTileCount} помогают основанию</span>
        </div>
      </div>
      <div class="gather-route-summary-text">Карточки ниже не заменяют карту: они помогают быстро решить, к какому участку идти сейчас, что он даст и закроет ли он текущую нехватку для лагеря.</div>
    `;
    container.appendChild(routesIntro);

    for (const tile of resourceTiles) {
      const action = this.data.gatherActions[tile.actionId];
      if (!action) continue;
      const actionCopy = this.getGatherActionCopy(action);
      const profile = this.game.getGatherProfile(action.id, {
        tileId: tile.id,
      });
      const cooldown = this.game.getCooldownRemaining(action.id, {
        tileId: tile.id,
      });
      const effectiveEnergyCost = profile?.energyCost ?? action.energyCost;
      const canGather = this.game.canGather(action.id, { tileId: tile.id });
      const output = profile?.output || this.game.getGatherOutput(action.id);
      const gatherDurationMs =
        profile?.gatherDurationMs ||
        this.game.getGatherDuration(action.id, { tileId: tile.id });
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
      const marker = tile.primaryMarker || tile.visibleMarkers?.[0] || null;
      const rowIcon = marker
        ? this.getCampTileMarkerIcon(marker)
        : tile.resourceType
          ? this.getPlainIcon(
              this.getResourceDisplayIcon(tile.resourceType),
              tile.icon || actionCopy.icon,
            )
          : tile.icon || actionCopy.icon;
      const placeName = tile.terrainName || tile.name;
      const placeRole =
        tile.knownPotentials?.[0]?.label || tile.roleLabel || tile.name;
      const needLabels = this._getFoundingNeedLabels(output, cost);
      const isSelected = tile.id === selectedTileId;

      // Highlight tiles that provide a resource still needed for founding
      const stillNeeded = !isDepleted && needLabels.length > 0;
      const rowSummary = stillNeeded
        ? `Поможет закрыть: ${needLabels.join(", ")}`
        : isSelected
          ? "Сейчас этот участок выделен на карте."
          : "Используйте карточку, чтобы быстро сфокусироваться на участке или собрать ресурс без лишнего поиска по карте.";

      const row = document.createElement("div");
      row.className = "gather-resource-row gather-resource-row--precamp";
      if (isDepleted) row.classList.add("is-depleted");
      if (stillNeeded) row.classList.add("is-needed");
      if (isSelected) row.classList.add("is-selected");

      const deliveryNote =
        profile?.deliveryTrips > 1
          ? `<span class="grr-warn">${profile.deliveryTrips} ходки</span>`
          : "";
      const decisionChips = this._renderGatherDecisionChips(
        profile,
        effectiveEnergyCost,
        {
          durationMs: gatherDurationMs,
          timeCost: profile?.timeCost || 1,
        },
      );
      const badgesHtml = [
        stillNeeded
          ? '<span class="grr-badge grr-badge--needed">Нужно для основания</span>'
          : "",
        isSelected
          ? '<span class="grr-badge grr-badge--selected">Выбрано на карте</span>'
          : "",
        isDepleted
          ? '<span class="grr-badge grr-badge--muted">Исчерпан</span>'
          : "",
      ].join("");

      row.innerHTML = `
        <div class="grr-left">
          <span class="grr-icon">${rowIcon}</span>
          <div class="grr-info">
            <span class="grr-name">${placeName}</span>
            ${badgesHtml ? `<div class="grr-badges">${badgesHtml}</div>` : ""}
            ${placeRole && placeRole !== placeName ? `<span class="grr-role">${placeRole}</span>` : ""}
            <span class="grr-meta">
              🗺 ${zoneLabel}${stockStr ? ` · 📦 ${stockStr}` : ""}
            </span>
            <span class="grr-summary">${rowSummary}</span>
            ${isDepleted ? '<span class="grr-blocked">Участок исчерпан</span>' : ""}
            ${!isDepleted && cooldown > 0 ? `<span class="grr-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
            ${profile?.blockedReason && !isDepleted ? `<span class="grr-blocked">${profile.blockedReason}</span>` : ""}
          </div>
        </div>
        <div class="grr-right">
          <span class="grr-output">${outputStr}</span>
          ${decisionChips}
          ${deliveryNote && !decisionChips.includes("ходки") ? deliveryNote : ""}
        </div>
      `;

      // Row click → select tile on map and scroll into view
      row.addEventListener("click", () => {
        this._focusGatherTile(tile.id);
      });

      const actions = document.createElement("div");
      actions.className = "grr-actions";

      const focusBtn = document.createElement("button");
      focusBtn.className = "grr-action grr-action--focus";
      focusBtn.type = "button";
      focusBtn.textContent = isSelected
        ? "Участок на карте"
        : "Показать на карте";
      focusBtn.disabled = isSelected;
      focusBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._focusGatherTile(tile.id);
      });
      actions.appendChild(focusBtn);

      const gatherBtn = document.createElement("button");
      gatherBtn.className = "grr-action grr-action--gather";
      gatherBtn.type = "button";
      gatherBtn.innerHTML = `${actionCopy.icon} Поставить в очередь`;
      gatherBtn.disabled = isDepleted || !canGather;
      gatherBtn.title = isDepleted
        ? "Участок исчерпан"
        : cooldown > 0
          ? `Перерыв: ${this.formatCooldownMs(cooldown)}`
          : profile?.blockedReason
            ? `${profile.blockedReason} (очередь работ)`
            : "Поставить сбор в очередь работ";
      gatherBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.game.enqueueManualGather(action.id, { tileId: tile.id });
        this.game.selectCampTile(tile.id);
        this.render({ forcePanels: true });
      });
      actions.appendChild(gatherBtn);
      row.appendChild(actions);

      container.appendChild(row);
    }
  },

  /**
   * Post-camp mode: logistics overview panel.
   * Shows resource tiles grouped by type, with distance / path / stock info.
   * Clicking a row selects the tile on the map; the row button starts travel.
   */

  _renderGatherPostCamp(container, mapState) {
    container.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = "📍 Известные места вокруг лагеря";
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
      empty.textContent =
        "Поблизости пока не видно мест, где можно что-то собрать.";
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
      const actionIcon = tiles[0].resourceType
        ? this.getPlainIcon(
            this.getResourceDisplayIcon(tiles[0].resourceType),
            groupKey === "wood" ? "🌿" : actionCopy.icon,
          )
        : this.getPlainIcon(actionCopy.icon, "•");

      const groupEl = document.createElement("div");
      groupEl.className = "gather-resource-group";

      const groupHeader = document.createElement("div");
      groupHeader.className = "gather-resource-group-header";
      groupHeader.textContent = `${actionIcon} ${actionCopy.name}`;
      groupEl.appendChild(groupHeader);

      for (const tile of tiles) {
        const action = this.data.gatherActions[tile.actionId];
        if (!action) continue;
        const roleMeta =
          typeof this.getCampTileRoleMeta === "function"
            ? this.getCampTileRoleMeta(tile)
            : null;
        const profile = this.game.getGatherProfile(action.id, {
          tileId: tile.id,
        });
        const details = this.game.getCampMapTileDetails?.(tile.id) || {
          ...tile,
          action,
          gatherProfile: profile,
        };
        const logistics = this._getCampLogisticsSummary?.(details) || null;
        const cooldown = this.game.getCooldownRemaining(action.id, {
          tileId: tile.id,
        });
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
        if (canGather) row.classList.add("gather-resource-row--actionable");

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
        const outputStr = this.formatResourcePairs(
          profile?.output || this.game.getGatherOutput(action.id),
          { plus: true },
        );

        // Energy cost
        const energyCost = profile?.energyCost ?? action.energyCost;
        const decisionChips = this._renderGatherDecisionChips(
          profile,
          energyCost,
          {
            includeEnergy: false,
            includeNeeds: true,
            includeCarry: true,
            includeTrips: false,
            onlyAlerts: true,
          },
        );
        const marker = tile.primaryMarker || tile.visibleMarkers?.[0] || null;
        const rowIcon = marker
          ? this.getCampTileMarkerIcon(marker)
          : tile.resourceType
            ? this.getPlainIcon(
                this.getResourceDisplayIcon(tile.resourceType),
                tile.resourceType === "wood"
                  ? "🌿"
                  : tile.icon || actionCopy.icon,
              )
            : tile.icon || actionCopy.icon;
        const placeName = tile.terrainName || tile.name;
        const knownLabel = tile.knownPotentials?.[0]?.label || roleMeta?.label;
        const routeSummary = [
          logistics ? `⏱ ${logistics.totalLabel}` : "",
          logistics ? `↔ ${logistics.routeLabel}` : `🗺 ${zoneLabel}`,
          stockStr ? `📦 ${stockStr}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const routeStatus = tile.isDepleted
          ? "Участок исчерпан"
          : profile?.blockedReason
            ? profile.blockedReason
            : profile?.limitedByCarry
              ? "Вынос упрётся в переносимость"
              : profile?.deliveryTrips > 1
                ? `Понадобится ${profile.deliveryTrips} ${profile.deliveryTrips === 1 ? "ходка" : profile.deliveryTrips >= 2 && profile.deliveryTrips <= 4 ? "ходки" : "ходок"}`
                : noPath && dist > 1
                  ? "Без тропы путь ощутимо тяжелее"
                  : hasPath
                    ? "Тропа уже облегчает рейс"
                    : dist === 0
                      ? "Сбор рядом с лагерем"
                      : dist === 1
                        ? "Ближний выход"
                        : "Дальний выход";
        const routeStatusClass = tile.isDepleted || profile?.blockedReason
          ? "grr-blocked"
          : noPath && dist > 1
            ? "grr-warn"
            : "grr-status";

        row.innerHTML = `
          <div class="grr-left">
            <span class="grr-icon">${rowIcon}</span>
            <div class="grr-info">
              <span class="grr-name">${placeName}</span>
              ${knownLabel ? `<span class="grr-role">${knownLabel}</span>` : ""}
              <span class="grr-meta">
                🗺 ${zoneLabel}
                ${pathIcon ? ` · ${pathIcon} ${pathLabel}` : ""}
              </span>
              ${routeSummary ? `<span class="grr-route">${routeSummary}</span>` : ""}
              <span class="${routeStatusClass}">${routeStatus}</span>
            </div>
          </div>
          <div class="grr-right">
            <span class="grr-output">${outputStr}</span>
            ${decisionChips ? `<div class="grr-decision-strip">${decisionChips}</div>` : ""}
            ${cooldown > 0 ? `<span class="grr-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
          </div>
        `;

        this.setTooltip(row, [
          tile.name,
          roleMeta?.label ? `Роль: ${roleMeta.label}` : "",
          roleMeta?.description || "",
          tile.description || "",
          `Зона: ${zoneLabel}`,
          pathLabel ? `Путь: ${pathIcon} ${pathLabel}` : "Путь: не проложен",
          stockStr ? `Запас участка: ${stockStr}` : "",
          `Энергия: -${this.formatNumber(energyCost, 2)}`,
          Number.isFinite(profile?.satietyCost)
            ? `Сытость: -${this.formatNumber(profile.satietyCost, 2)}`
            : "",
          Number.isFinite(profile?.hydrationCost)
            ? `Вода: -${this.formatNumber(profile.hydrationCost, 2)}`
            : "",
          logistics ? `Логистика: ${logistics.totalLabel}` : "",
          logistics ? logistics.note : "",
          profile?.needsImpact ? profile.needsImpact.note : "",
          profile?.carryState ? profile.carryState.note : "",
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

        if (!tile.isDepleted && canGather) {
          const gatherBtn = document.createElement("button");
          gatherBtn.className = "action-btn action-btn--gather-tile";
          gatherBtn.innerHTML = `${actionCopy.icon} Поставить в очередь`;
          gatherBtn.type = "button";
          gatherBtn.disabled = !!this._campTravelAction;
          gatherBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this._campTravelAction) return;

            this.game.selectCampTile(tile.id);
            const details = this.game.getCampMapTileDetails?.(tile.id);
            if (
              details?.action &&
              typeof this._startCampTileTravel === "function" &&
              this._startCampTileTravel(details)
            ) {
              return;
            }

            this.game.enqueueManualGather(action.id, { tileId: tile.id });
            this.render({ forcePanels: true });
          });
          row.appendChild(gatherBtn);
        }

        groupEl.appendChild(row);
      }

      container.appendChild(groupEl);
    }

    // Hint at the bottom
    const hint = document.createElement("p");
    hint.className = "hint gather-map-hint";
    hint.textContent =
      "Выберите место, чтобы отправить персонажа на выход через карту лагеря.";
    container.appendChild(hint);
  },
});
