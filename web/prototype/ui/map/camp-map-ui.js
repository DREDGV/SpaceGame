// Camp map rendering, travel animation, tile interaction.

Object.assign(UI.prototype, {
  _isCampRouteEstimateState(state) {
    return (
      state === "hidden" || state === "silhouette" || state === "visible_locked"
    );
  },

  _getCampTravelPathTo(tileId, { allowFallback = true, routeId = "" } = {}) {
    const originTileId = this._getCampHomeTileIdForPath();
    if (!originTileId || !tileId) return [originTileId, tileId].filter(Boolean);
    if (routeId && routeId !== "direct") {
      const routedPath = this._getCampRoutePathById(tileId, routeId, {
        allowFallback,
      });
      if (Array.isArray(routedPath) && routedPath.length > 0) return routedPath;
    }
    const path = this.game._findCampHexPath?.(originTileId, tileId, {
      allowFallback,
    });
    if (Array.isArray(path) && path.length > 0) return path;
    return allowFallback ? [originTileId, tileId].filter(Boolean) : [];
  },

  _getCampRoutePathById(
    tileId,
    routeId = "direct",
    { allowFallback = true } = {},
  ) {
    const originTileId = this._getCampHomeTileIdForPath();
    if (!originTileId || !tileId) return [originTileId, tileId].filter(Boolean);
    if (routeId === "easy" || routeId === "known") {
      const path = this._findCampWeightedRoutePath(originTileId, tileId, {
        mode: routeId,
        allowFallback,
      });
      if (Array.isArray(path) && path.length > 0) return path;
    }
    const path = this.game._findCampHexPath?.(originTileId, tileId, {
      allowFallback,
    });
    if (Array.isArray(path) && path.length > 0) return path;
    return allowFallback ? [originTileId, tileId].filter(Boolean) : [];
  },

  _getCampRouteTileCost(tileId, mode = "easy") {
    const tile = this.game._getCampMapTile?.(tileId) || null;
    const state = this.game.getCampTileState?.(tileId) || "hidden";
    const profile = this.game._getCampTileMoveProfile?.(tile) || {
      cost: this.game._getCampTileMoveCost?.(tile) || 1,
      pathLevel: this.game.getCampPathLevel?.(tileId) || "none",
    };
    let cost = Math.max(0.55, Number(profile.cost) || 1);

    if (mode === "known") {
      if (this._isCampRouteEstimateState(state)) cost += 2.6;
      if (state === "terrain_seen") cost += 0.55;
      if (profile.pathLevel && profile.pathLevel !== "none") cost -= 0.2;
      const traffic = this.game.getCampPathUseProgress?.(tileId)?.uses || 0;
      cost -= Math.min(0.32, Math.max(0, Number(traffic) || 0) * 0.06);
    }

    if (mode === "easy") {
      const terrainCost = Math.max(
        1,
        Number(profile.baseCost || profile.cost || 1),
      );
      cost += Math.max(0, terrainCost - 1) * 0.85;
      if (profile.pathLevel && profile.pathLevel !== "none") cost -= 0.14;
    }

    return Math.max(0.25, cost);
  },

  _findCampWeightedRoutePath(fromTileId, toTileId, options = {}) {
    if (fromTileId === toTileId) return [fromTileId];
    const mode = options.mode || "easy";
    const allowFallback = options.allowFallback !== false;
    const canEnterTile = (tileId) => {
      if (tileId === fromTileId || tileId === toTileId) return true;
      const tile = this.game._getCampMapTile?.(tileId) || null;
      const state = this.game.getCampTileState?.(tileId) || "hidden";
      if (
        [
          "camp",
          "camp_candidate",
          "developed",
          "discovered",
          "terrain_seen",
        ].includes(state)
      ) {
        return true;
      }
      return !tile || this.game.isCampTilePresentationUnlocked?.(tile);
    };

    const distances = new Map([[fromTileId, 0]]);
    const previous = new Map([[fromTileId, null]]);
    const open = [{ tileId: fromTileId, cost: 0 }];

    while (open.length > 0) {
      open.sort((left, right) => left.cost - right.cost);
      const current = open.shift();
      if (!current) break;
      if (current.cost > (distances.get(current.tileId) || 0) + 1e-9) continue;
      if (current.tileId === toTileId) {
        const path = [];
        let node = toTileId;
        while (node !== null) {
          path.unshift(node);
          node = previous.get(node);
        }
        return path;
      }

      for (const neighborId of this.game._getCampNeighborTileIds?.(
        current.tileId,
      ) || []) {
        if (!canEnterTile(neighborId)) continue;
        const nextCost =
          current.cost + this._getCampRouteTileCost(neighborId, mode);
        if (nextCost + 1e-9 >= (distances.get(neighborId) ?? Infinity)) {
          continue;
        }
        distances.set(neighborId, nextCost);
        previous.set(neighborId, current.tileId);
        open.push({ tileId: neighborId, cost: nextCost });
      }
    }

    return allowFallback ? [fromTileId, toTileId].filter(Boolean) : [];
  },

  _getCampPathTravelMetrics(path) {
    const entries = [];
    if (!Array.isArray(path) || path.length <= 1) {
      return {
        hexCount: 0,
        distanceMeters: 0,
        effectiveDistanceMeters: 0,
        weightedCost: 0,
        baseMoveMs: 0,
        isApproximate: false,
        estimatedHexCount: 0,
        entries,
        terrainSummary: "",
      };
    }

    for (let index = 1; index < path.length; index += 1) {
      const tileId = path[index];
      const tile = this.game._getCampMapTile(tileId);
      const tileState = this.game.getCampTileState?.(tileId) || "hidden";
      const isEstimated = this._isCampRouteEstimateState(tileState);
      const profile = this.game._getCampTileMoveProfile?.(tile) || {
        cost: this.game._getCampTileMoveCost?.(tile) || 1,
        label: this.getCampTerrainLabel(tile?.terrainType),
        pathLevel: this.game.getCampPathLevel?.(tile?.id) || "none",
      };
      const estimatedCost = Math.max(
        0.9,
        (profile.pathLevel !== "none" ? 0.96 : 1.18) *
          (tile?.resourceType ? 1.04 : 1),
      );
      entries.push({
        tileId,
        label: isEstimated
          ? "неизведанная местность"
          : profile.label || this.getCampTerrainLabel(tile?.terrainType),
        cost: isEstimated
          ? estimatedCost
          : Math.max(0.55, Number(profile.cost) || 1),
        pathLevel: profile.pathLevel || "none",
        isEstimated,
      });
    }

    const weightedCost = entries.reduce((sum, entry) => sum + entry.cost, 0);
    const labels = [];
    for (const entry of entries) {
      if (!labels.includes(entry.label)) labels.push(entry.label);
      if (labels.length >= 2) break;
    }

    return {
      hexCount: entries.length,
      distanceMeters: entries.length * 20,
      effectiveDistanceMeters: Math.round(weightedCost * 20),
      weightedCost,
      baseMoveMs: 0,
      isApproximate: entries.some((entry) => entry.isEstimated),
      estimatedHexCount: entries.filter((entry) => entry.isEstimated).length,
      entries,
      terrainSummary: labels.join(" + "),
    };
  },

  _getCampRouteOptions(tileId) {
    const originTileId = this._getCampHomeTileIdForPath();
    if (!originTileId || !tileId || originTileId === tileId) return [];
    const definitions = [
      {
        id: "direct",
        label: "Прямой",
        note: "меньше клеток, без обходов",
      },
      {
        id: "easy",
        label: "Лёгкий",
        note: "обходит тяжёлый рельеф, если есть проход",
      },
      {
        id: "known",
        label: "По следу",
        note: "держится открытых клеток и троп",
      },
    ];
    const seen = new Set();
    const options = [];

    for (const definition of definitions) {
      const path = this._getCampRoutePathById(tileId, definition.id, {
        allowFallback: false,
      });
      if (!Array.isArray(path) || path.length < 2) continue;
      const signature = path.join("|");
      if (seen.has(signature)) continue;
      seen.add(signature);
      const metrics = this._getCampPathTravelMetrics(path);
      const travelMs = this._getCampRouteWalkDurationMs(metrics, {
        setupMs: 280,
        minMs: metrics.hexCount > 0 ? 850 : 0,
        maxMs: 180000,
        extraCoef: 1.02,
      });
      options.push({
        ...definition,
        path,
        metrics,
        travelMs,
      });
    }

    if (!options.length) {
      const fallbackPath = this._getCampTravelPathTo(tileId);
      if (fallbackPath.length > 1) {
        const metrics = this._getCampPathTravelMetrics(fallbackPath);
        options.push({
          ...definitions[0],
          path: fallbackPath,
          metrics,
          travelMs: this._getCampRouteWalkDurationMs(metrics, {
            setupMs: 280,
            minMs: metrics.hexCount > 0 ? 850 : 0,
            maxMs: 180000,
            extraCoef: 1.02,
          }),
        });
      }
    }

    return options;
  },

  _getActiveCampRouteChoiceId(tileId, routeOptions = null) {
    const options = routeOptions || this._getCampRouteOptions(tileId);
    if (!options.length) return "";
    const stored = this.game.getCampRouteChoice?.(tileId) || "";
    if (stored && options.some((option) => option.id === stored)) return stored;
    return options[0].id;
  },

  _renderCampRouteChoiceBlock(
    details,
    routeOptions = null,
    activeRouteId = "",
  ) {
    if (!details || (details.distanceFromCamp || 0) <= 0) return "";
    const options = routeOptions || this._getCampRouteOptions(details.id);
    if (!options.length) return "";
    const activeId =
      activeRouteId || this._getActiveCampRouteChoiceId(details.id, options);
    const activeOption =
      options.find((option) => option.id === activeId) || options[0];
    return `
      <div class="camp-map-route-choice" aria-label="Выбор маршрута">
        <div class="camp-map-route-choice-head">
          <span>Маршрут к цели</span>
          <strong>${this._formatCampRouteTimeLabel(activeOption.travelMs, activeOption.metrics)}</strong>
        </div>
        <div class="camp-map-route-choice-grid">
          ${options
            .map(
              (option) => `
                <button
                  type="button"
                  class="camp-map-route-choice-btn${option.id === activeId ? " is-active" : ""}"
                  data-camp-route-choice="${option.id}"
                  aria-pressed="${option.id === activeId ? "true" : "false"}"
                >
                  <span>${option.label}</span>
                  <small>${this._formatCampRouteMetricLabel(option.metrics)} · ${this._formatCampRouteTimeLabel(option.travelMs, option.metrics)}</small>
                  <em>${option.note}</em>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  },

  _getCampRouteWalkDurationMs(
    routeMetrics,
    {
      setupMs = 300,
      minMs = 750,
      maxMs = Number.POSITIVE_INFINITY,
      load = 0,
      extraCoef = 1,
    } = {},
  ) {
    const hexCount = Math.max(0, Number(routeMetrics?.hexCount || 0));
    if (hexCount <= 0) return 0;

    const distanceMeters = Math.max(
      20,
      Number(routeMetrics?.distanceMeters || hexCount * 20),
    );
    const conditionObj = this.game.getCharacterCondition?.() || {
      id: "stable",
    };
    const conditionId = conditionObj.id || "stable";
    const conditionCoef =
      conditionId === "exhausted"
        ? 0.48
        : conditionId === "weakened"
          ? 0.72
          : 1;
    const characterState = this.game.getCharacterState?.() || null;
    const fieldcraft = Math.max(
      0,
      Number(
        characterState?.fieldcraft || characterState?.stats?.fieldcraft || 0,
      ),
    );
    const endurance = Math.max(
      0,
      Number(
        characterState?.endurance || characterState?.stats?.endurance || 0,
      ),
    );
    const mobility = Math.max(
      0,
      Number(characterState?.mobility || characterState?.stats?.mobility || 0),
    );
    const strength = Math.max(
      0,
      Number(characterState?.strength || characterState?.stats?.strength || 0),
    );
    const carryCapacity = Math.max(
      1,
      Number(this.game.getCharacterCarryCapacity?.() || 1),
    );
    const loadRatio = Math.max(
      0,
      Math.min(2.8, Number(load || 0) / carryCapacity),
    );
    const terrainSlowdown = Math.max(
      1,
      Number(routeMetrics?.weightedCost || hexCount),
    );
    const baseSpeedMetersPerSecond = 4.6;
    const skillSpeedBonus =
      fieldcraft * 0.1 +
      Math.max(0, endurance - 1) * 0.18 +
      Math.max(0, mobility - 1) * 0.28;
    const strengthRelief = Math.max(0, strength - 1) * 0.08;
    const loadSpeedCoef = Math.max(0.48, 1 - loadRatio * 0.22 + strengthRelief);
    const effectiveSpeedMetersPerSecond = Math.max(
      1.15,
      Math.min(
        8.5,
        (baseSpeedMetersPerSecond + skillSpeedBonus) *
          conditionCoef *
          loadSpeedCoef,
      ),
    );
    const rawMs =
      setupMs +
      ((distanceMeters * terrainSlowdown * Math.max(0.55, extraCoef)) /
        effectiveSpeedMetersPerSecond) *
        1000;

    const clampedMaxMs = Number.isFinite(maxMs)
      ? maxMs
      : Number.POSITIVE_INFINITY;
    return Math.round(Math.max(minMs, Math.min(clampedMaxMs, rawMs)));
  },

  _formatCampRouteMetricLabel(metrics) {
    const hexCount = Math.max(0, Number(metrics?.hexCount || 0));
    if (hexCount <= 0) return "на месте";
    const distanceMeters = Math.max(
      0,
      Number(metrics?.distanceMeters || hexCount * 20),
    );
    const word =
      hexCount === 1
        ? "гекс"
        : hexCount >= 2 && hexCount <= 4
          ? "гекса"
          : "гексов";
    const prefix = metrics?.isApproximate ? "примерно " : "";
    const distanceLabel = distanceMeters > 0 ? ` · ${distanceMeters} м` : "";
    const terrain = metrics.terrainSummary
      ? ` · ${metrics.terrainSummary}`
      : "";
    return `${prefix}${hexCount} ${word}${distanceLabel}${terrain}`;
  },

  _formatCampRouteTimeLabel(durationMs, metrics) {
    const prefix = metrics?.isApproximate ? "около " : "";
    return `${prefix}${this.formatSeconds(durationMs)}`;
  },

  _getCampLogisticsSummary(details, routeMetrics = null, travelPlan = null) {
    if (!details?.action) return null;
    const profile = details.gatherProfile || null;
    const path = routeMetrics ? null : this._getCampTravelPathTo(details.id);
    const metrics = routeMetrics || this._getCampPathTravelMetrics(path);
    const plan = travelPlan || this._getCampTravelPlan(details, metrics);
    const distance = Math.max(0, Number(details.distanceFromCamp || 0));
    const pathData =
      details.pathData || this.game.getCampPathData?.(details.id) || null;
    const pathLevel = details.pathLevel || profile?.pathLevel || pathData?.id;
    const output = profile?.output || {};
    const load = Number(profile?.load || 0);
    const totalLoad = Number(profile?.totalLoad || load);
    const carryCapacity = Math.max(
      1,
      Number(
        profile?.carryCapacity || this.game.getCharacterCarryCapacity?.() || 1,
      ),
    );
    const trips = Math.max(1, Number(profile?.deliveryTrips || 1));
    const routeLabel = this._formatCampRouteMetricLabel(metrics);
    const totalLabel = this._formatCampRouteTimeLabel(
      plan.totalMs || 0,
      metrics,
    );
    const walkLabel = this._formatCampRouteTimeLabel(
      plan.outboundMs || 0,
      metrics,
    );
    const gatherLabel = this.formatSeconds(plan.gatherMs || 0);
    const loadLabel = `${this.formatNumber(load, 1)} / ${this.formatNumber(carryCapacity, 1)}`;
    const totalLoadLabel = this.formatNumber(totalLoad, 1);
    const pathLabel =
      distance <= 0
        ? "на месте"
        : `${pathData?.icon || "·"} ${pathData?.label || "Без тропы"}`;
    const outputLabel = Object.keys(output).length
      ? this.formatResourcePairs(output, { plus: true })
      : "нет выноса";
    const stockLabel = Number.isFinite(details.resourceRemaining)
      ? `${details.resourceRemaining}/${details.resourceCapacity}`
      : "";
    const outputUnits = details.resourceType
      ? Number(output[details.resourceType] || 0)
      : Object.values(output).reduce(
          (sum, amount) => sum + (Number(amount) || 0),
          0,
        );
    const remainingRuns =
      Number.isFinite(details.resourceRemaining) && outputUnits > 0
        ? Math.ceil(Math.max(0, details.resourceRemaining) / outputUnits)
        : null;
    const remainingRunsLabel = Number.isFinite(remainingRuns)
      ? remainingRuns > 0
        ? `ещё ${remainingRuns} ${remainingRuns === 1 ? "выход" : "выходов"}`
        : "исчерпан"
      : "";

    let tone = "ok";
    let note =
      "Один понятный рейс: путь, сбор и груз не создают отдельного узкого места.";
    if (profile?.blockedReason) {
      tone = "bad";
      note = profile.blockedReason;
    } else if (profile?.limitedByCarry) {
      tone = "warn";
      note =
        "Переносимость режет вынос: часть возможной добычи не помещается в рейс.";
    } else if (trips > 1) {
      tone = "warn";
      note = `Доставка требует ${trips} ходки: важен не только сбор, но и поднос к лагерю.`;
    } else if (distance > 1 && (!pathLevel || pathLevel === "none")) {
      tone = "warn";
      note =
        "Дальний участок без тропы: маршрут сам становится издержкой производства.";
    } else if ((profile?.terrainPenalty || 0) > 0) {
      tone = "warn";
      note = "Местность утяжеляет выход: этот ресурс дороже ближнего сбора.";
    } else if (pathLevel && pathLevel !== "none") {
      note = "Тропа уже снижает цену доставки этого ресурса.";
    }

    return {
      tone,
      note,
      routeLabel,
      totalLabel,
      walkLabel,
      gatherLabel,
      pathLabel,
      terrainLabel:
        profile?.terrainLabel || details.terrainLabel || "обычный участок",
      outputLabel,
      stockLabel,
      remainingRunsLabel,
      loadLabel,
      totalLoadLabel,
      trips,
      needsLabel: profile?.needsImpact?.label || "",
      carryLabel: profile?.carryState?.label || "",
    };
  },

  _renderCampLogisticsBlock(summary, options = {}) {
    if (!summary) return "";
    const { compact = false } = options;
    if (compact) {
      return `
        <div class="grr-logistics is-${summary.tone}">
          <span>↔ ${summary.routeLabel}</span>
          <span>⏱ ${summary.totalLabel}</span>
          <span>🧺 ${summary.loadLabel}</span>
          ${summary.remainingRunsLabel ? `<span>↻ ${summary.remainingRunsLabel}</span>` : ""}
          ${summary.trips > 1 ? `<span>${summary.trips} ходки</span>` : ""}
        </div>
      `;
    }
    return `
      <div class="camp-map-logistics-card is-${summary.tone}">
        <div class="camp-map-logistics-head">
          <span>Логистика</span>
          <strong>${summary.totalLabel}</strong>
        </div>
        <div class="camp-map-logistics-grid">
          <span><b>Маршрут</b>${summary.routeLabel}</span>
          <span><b>Цикл</b>ходьба ${summary.walkLabel} · сбор ${summary.gatherLabel}</span>
          <span><b>Вынос</b>${summary.outputLabel} · груз ${summary.loadLabel}</span>
          ${summary.stockLabel ? `<span><b>Запас</b>${summary.stockLabel} · ${summary.remainingRunsLabel}</span>` : ""}
          <span><b>Путь</b>${summary.pathLabel} · ${summary.terrainLabel}</span>
        </div>
        <div class="camp-map-logistics-note">${summary.note}</div>
      </div>
    `;
  },

  _getCampMapLayerMode() {
    const mode = this._campMapLayerMode || "terrain";
    return ["terrain", "resources", "paths", "survey"].includes(mode)
      ? mode
      : "terrain";
  },

  _setCampMapLayerMode(mode) {
    const nextMode = ["terrain", "resources", "paths", "survey"].includes(mode)
      ? mode
      : "terrain";
    if (this._campMapLayerMode === nextMode) return false;
    this._campMapLayerMode = nextMode;
    return true;
  },

  _renderCampMapLayerControls(activeMode = this._getCampMapLayerMode()) {
    const modes = [
      {
        id: "terrain",
        label: "Рельеф",
        hint: "Природная карта без служебных меток",
      },
      { id: "resources", label: "Ресурсы", hint: "Абстрактные точки ресурсов" },
      { id: "paths", label: "Пути", hint: "Тропы и логистика маршрутов" },
      {
        id: "survey",
        label: "Разведка",
        hint: "Статус участков и будущие зоны",
      },
    ];
    return `
      <div class="camp-map-layer-switch" role="group" aria-label="Слой карты">
        ${modes
          .map(
            (mode) => `
              <button
                type="button"
                class="camp-map-layer-btn${activeMode === mode.id ? " is-active" : ""}"
                data-camp-map-layer="${mode.id}"
                aria-pressed="${activeMode === mode.id ? "true" : "false"}"
                title="${mode.hint}"
              >${mode.label}</button>
            `,
          )
          .join("")}
      </div>
    `;
  },

  _renderCampRouteIntelBlock(details, routeMetrics = null) {
    if (!details || (details.distanceFromCamp || 0) <= 0) return "";
    const path = routeMetrics ? null : this._getCampTravelPathTo(details.id);
    const metrics = routeMetrics || this._getCampPathTravelMetrics(path);
    const walkMs = this._getCampRouteWalkDurationMs(metrics, {
      setupMs: 280,
      minMs: metrics.hexCount > 0 ? 850 : 0,
      maxMs: 180000,
      extraCoef: 1.02,
    });
    const pathData =
      details.pathData || this.game.getCampPathData?.(details.id);
    const tone = metrics.isApproximate
      ? "warn"
      : pathData?.id && pathData.id !== "none"
        ? "ok"
        : "neutral";
    const note = metrics.isApproximate
      ? "Маршрут пока примерный: часть пути проходит через неясную местность."
      : pathData?.id && pathData.id !== "none"
        ? "Путь уже подготовлен, поэтому этот участок легче включать в регулярные выходы."
        : "Путь пока сырой: для дальнего участка тропа может стать важнее самого ресурса.";
    return `
      <div class="camp-map-route-card is-${tone}">
        <div class="camp-map-route-card-head">
          <span>Маршрут участка</span>
          <strong>${this._formatCampRouteTimeLabel(walkMs, metrics)}</strong>
        </div>
        <div class="camp-map-route-card-grid">
          <span><b>Дистанция</b>${this._formatCampRouteMetricLabel(metrics)}</span>
          <span><b>Проход</b>${pathData?.icon || "·"} ${pathData?.label || "Без тропы"}</span>
          <span><b>Местность</b>${details.terrainLabel || this.getCampTerrainLabel(details.terrainType)}</span>
        </div>
        <div class="camp-map-route-card-note">${note}</div>
      </div>
    `;
  },

  _renderCampTileJournalBlock(details) {
    if (!details) return "";
    const items = [];
    items.push({
      label: "Статус",
      value: this.getCampTileStateLabel(details.state),
    });
    items.push({
      label: "Кольцо",
      value:
        (details.distanceFromCamp || 0) <= 0
          ? "центр"
          : `${details.distanceFromCamp} от лагеря`,
    });
    if (details.pathData) {
      items.push({
        label: "Путь",
        value: details.pathData.label || "Без тропы",
      });
    }
    if (Number.isFinite(details.resourceRemaining)) {
      items.push({
        label: "Запас",
        value: `${details.resourceRemaining}/${details.resourceCapacity}`,
      });
    }
    if (details.isDepleted) {
      items.push({ label: "Ресурс", value: "исчерпан" });
    }
    if (details.roleLabel) {
      items.push({ label: "Роль", value: details.roleLabel });
    }
    if (details.terrainSeen) {
      items.push({ label: "Смысл", value: "осмотрен, но ещё не раскрыт" });
    }
    return `
      <div class="camp-map-tile-journal">
        <div class="camp-map-tile-journal-title">Журнал участка</div>
        <div class="camp-map-tile-journal-grid">
          ${items
            .map((item) => `<span><b>${item.label}</b>${item.value}</span>`)
            .join("")}
        </div>
      </div>
    `;
  },

  _renderCampExpansionBlock(details, mapState) {
    const expansion = this.data.localCampMap?.expansion || null;
    if (!expansion) return "";
    const expansionState = mapState.expansionState || {};
    const preparedRadius = Number(
      expansionState.preparedRadius ||
        expansion.preparedRadius ||
        mapState.radius ||
        0,
    );
    const currentRadius = Number(
      expansionState.radius || mapState.radius || expansion.currentRadius || 0,
    );
    const nextRings = Object.entries(expansion.rings || {})
      .map(([ring, plan]) => ({ ring: Number(ring), plan }))
      .filter(
        (entry) => entry.ring > currentRadius && entry.ring <= preparedRadius,
      )
      .sort((left, right) => left.ring - right.ring);
    const selectedRingPlan =
      expansion.rings?.[details?.distanceFromCamp] || null;
    if (!selectedRingPlan && nextRings.length === 0) return "";
    const plan = selectedRingPlan || nextRings[0]?.plan || null;
    if (!plan) return "";
    const ring = selectedRingPlan
      ? details.distanceFromCamp
      : nextRings[0].ring;
    const gate = (expansionState.gates || []).find(
      (entry) => Number(entry.opensRadius) === Number(ring),
    );
    const gateText = gate
      ? gate.met
        ? "Условия выполнены"
        : `Нужно: ${gate.missing.slice(0, 3).join(" · ")}`
      : "Условия открытия ещё не заданы";
    const prospectTags = [
      ...(Array.isArray(plan.futureResourceHints)
        ? plan.futureResourceHints.slice(0, 3).map((item) => `ресурс: ${item}`)
        : []),
      ...(Array.isArray(plan.wildlifeHints)
        ? plan.wildlifeHints.slice(0, 2).map((item) => `след: ${item}`)
        : []),
      ...(Array.isArray(plan.eventSeeds)
        ? plan.eventSeeds.slice(0, 2).map((item) => `событие: ${item}`)
        : []),
      ...(Array.isArray(plan.hazardTags) ? plan.hazardTags.slice(0, 2) : []),
    ].slice(0, 8);
    const nextLabel = selectedRingPlan
      ? `${details.distanceFromCamp} кольцо: ${plan.label}`
      : `Следующее: ${nextRings[0].ring} кольцо, ${plan.label}`;
    return `
      <div class="camp-map-expansion-card">
        <div class="camp-map-expansion-head">
          <span>Расширение карты</span>
          <strong>${currentRadius}/${preparedRadius}</strong>
        </div>
        <div class="camp-map-expansion-title">${nextLabel}</div>
        <div class="camp-map-expansion-gate">${gateText}</div>
        <div class="camp-map-expansion-text">${plan.unlockHint || plan.notes || "Данные кольца готовы для будущего открытия."}</div>
        ${
          prospectTags.length
            ? `<div class="camp-map-expansion-tags">${prospectTags.map((tag) => `<span>${tag}</span>`).join("")}</div>`
            : ""
        }
      </div>
    `;
  },

  _renderCampSurveyStatus(mapState) {
    const expansion = this.data.localCampMap?.expansion || {};
    const expansionState = mapState.expansionState || {};
    const tiles = Array.isArray(mapState.tiles) ? mapState.tiles : [];
    const knownCount = tiles.filter(
      (tile) =>
        !["hidden", "silhouette", "visible_locked"].includes(tile.state),
    ).length;
    const seenCount = tiles.filter(
      (tile) => tile.state === "terrain_seen",
    ).length;
    const frontierCount = tiles.filter(
      (tile) => tile.state === "visible_locked" || tile.state === "silhouette",
    ).length;
    const nextGate = expansionState.nextGate || null;
    const nextRingPlan = nextGate
      ? expansion.rings?.[nextGate.opensRadius] || null
      : null;
    const signalTags = nextRingPlan
      ? [
          ...(nextRingPlan.surveySignals || []).slice(0, 3),
          ...(nextRingPlan.futureResourceHints || []).slice(0, 2),
          ...(nextRingPlan.wildlifeHints || []).slice(0, 2),
        ].slice(0, 7)
      : [];
    const actionableExploreCount =
      typeof this.game.canExploreCampTile === "function"
        ? tiles.filter((tile) => this.game.canExploreCampTile(tile.id)).length
        : 0;
    const actionableExploreLabel =
      actionableExploreCount % 10 === 1 && actionableExploreCount % 100 !== 11
        ? "участок"
        : actionableExploreCount % 10 >= 2 &&
            actionableExploreCount % 10 <= 4 &&
            ![12, 13, 14].includes(actionableExploreCount % 100)
          ? "участка"
          : "участков";
    const gateLine = nextGate
      ? nextGate.met
        ? `${nextGate.label}: готово к открытию`
        : `${nextGate.label}: ${nextGate.missing.slice(0, 3).join(" · ")}`
      : "Подготовленный радиус достигнут";
    const nextStepLine =
      actionableExploreCount > 0
        ? `Что дальше: можно разведать ${actionableExploreCount} ${actionableExploreLabel}. Выберите рубеж или осмотренный гекс и отправьте персонажа.`
        : nextGate && !nextGate.met && nextGate.missing?.length
          ? `Что дальше: подготовьте следующее кольцо — ${nextGate.missing.slice(0, 2).join(" · ")}.`
          : nextGate?.met
            ? "Что дальше: следующее кольцо уже готово, остаётся выбрать направление разведки."
            : "Что дальше: осматривайте рубеж и готовьте следующее кольцо расширения.";

    return `
      <div class="camp-map-survey-card">
        <div class="camp-map-survey-head">
          <span>Разведка</span>
          <strong>${mapState.radius}/${expansionState.preparedRadius || mapState.radius}</strong>
        </div>
        <div class="camp-map-survey-grid">
          <span><b>${knownCount}</b>открыто</span>
          <span><b>${seenCount}</b>осмотрено</span>
          <span><b>${frontierCount}</b>рубеж</span>
        </div>
        <div class="camp-map-survey-gate">${gateLine}</div>
        <div class="camp-map-survey-next">${nextStepLine}</div>
        ${
          signalTags.length
            ? `<div class="camp-map-survey-tags">${signalTags.map((tag) => `<span>${tag}</span>`).join("")}</div>`
            : ""
        }
        <div class="camp-map-survey-legend">
          <span><i class="survey-dot is-known"></i>открыто</span>
          <span><i class="survey-dot is-seen"></i>осмотрено</span>
          <span><i class="survey-dot is-frontier"></i>рубеж</span>
          <span><i class="survey-dot is-unknown"></i>неизвестно</span>
        </div>
      </div>
    `;
  },

  _clearCampInterruptedTravelAction() {
    this._campInterruptedTravelAction = null;
  },

  _getCampInterruptedTravelSummary() {
    const paused = this._campInterruptedTravelAction;
    if (!paused || this._campTravelAction) return null;

    const currentTileId = this.game.getCharacterTileId?.() || null;
    const atCamp = this.game.isCharacterAtCamp?.() ?? true;
    const targetTile = paused.tileId
      ? this.game._getCampMapTile?.(paused.tileId)
      : null;
    const stopTile = paused.stopTileId
      ? this.game._getCampMapTile?.(paused.stopTileId)
      : null;
    const targetLabel = targetTile?.name || paused.targetTileName || "цели";
    const stopLabel =
      stopTile?.name || paused.stopTileName || "текущего участка";
    const onTarget = !!paused.tileId && currentTileId === paused.tileId;

    let primaryAction = "";
    let primaryLabel = "";
    let note = "";

    if (paused.isReturnTrip) {
      primaryAction = atCamp ? "" : "resume-return";
      primaryLabel = "Продолжить возврат";
      note = atCamp
        ? "Возврат был прерван уже у лагеря: можно сразу разобрать ношу вручную."
        : `Возврат в лагерь прерван у участка \"${stopLabel}\". Можно сразу продолжить путь домой.`;
    } else if (onTarget) {
      if (paused.isExplore) {
        primaryAction = "complete-explore";
        primaryLabel = "Завершить разведку";
        note = `Персонаж дошёл до \"${targetLabel}\", но осмотр был прерван. Можно сразу закончить разведку на месте.`;
      } else if (paused.isMove) {
        primaryAction = "complete-move";
        primaryLabel = "Остаться на участке";
        note = `Персонаж уже дошёл до \"${targetLabel}\". Можно оставить его здесь и продолжить планировать следующий ход.`;
      } else {
        primaryAction = "complete-gather";
        primaryLabel = "Собрать здесь";
        note = `Персонаж уже на участке \"${targetLabel}\". Можно сразу закончить сбор без нового перехода.`;
      }
    } else {
      primaryAction = paused.isExplore
        ? "resume-explore"
        : paused.isMove
          ? "resume-move"
          : "resume-route";
      primaryLabel = paused.isExplore
        ? "Продолжить разведку"
        : paused.isMove
          ? "Продолжить переход"
          : "Продолжить маршрут";
      note = `Путь к участку \"${targetLabel}\" прерван у \"${stopLabel}\". Можно продолжить тот же выход или сменить решение.`;
    }

    return {
      ...paused,
      targetLabel,
      stopLabel,
      onTarget,
      primaryAction,
      primaryLabel,
      note,
      showReturnAlternative: !atCamp && !paused.isReturnTrip,
    };
  },

  _resumeCampInterruptedTravelAction() {
    const paused = this._campInterruptedTravelAction;
    const summary = this._getCampInterruptedTravelSummary();
    if (!paused || !summary || this._campTravelAction) return false;

    this.game.selectCampTile?.(paused.tileId || paused.stopTileId || null);

    if (summary.primaryAction === "resume-return") {
      const started = this._startCampReturnTrip();
      if (started) this._clearCampInterruptedTravelAction();
      return started;
    }

    if (summary.primaryAction === "complete-explore") {
      const discovery = this.game.discoverCampTile?.(paused.tileId, {
        silent: false,
        pushStory: true,
      });
      const ok =
        discovery === true ||
        !!discovery?.ok ||
        this.game.getCampTileState?.(paused.tileId) === "discovered";
      if (!ok) {
        const hint =
          this.game.getCampTileUnlockHint?.(paused.tileId) ||
          "Место осмотрено, но его смысл пока не ясен.";
        this.game.addLog?.(
          `🚶 Персонаж дошёл до неизвестного участка. ${hint}`,
        );
      }
      if (ok) this._clearCampInterruptedTravelAction();
      this.render({ forcePanels: true });
      return ok;
    }

    if (summary.primaryAction === "complete-gather") {
      const ok = this.game.performCampTileAction?.(paused.tileId, {
        resourceId: paused.resourceId || null,
      });
      if (ok) this._clearCampInterruptedTravelAction();
      this.render({ forcePanels: true });
      return ok;
    }

    if (summary.primaryAction === "complete-move") {
      this._clearCampInterruptedTravelAction();
      this.render({ forcePanels: true });
      return true;
    }

    if (summary.primaryAction === "resume-explore") {
      const started = this._startCampTileExplore(paused.tileId);
      if (started) this._clearCampInterruptedTravelAction();
      return started;
    }

    if (summary.primaryAction === "resume-move") {
      const started = this._startCampTileVisit(paused.tileId);
      if (started) this._clearCampInterruptedTravelAction();
      return started;
    }

    if (summary.primaryAction === "resume-route") {
      const targetDetails = this.game.getCampMapTileDetails?.(paused.tileId);
      const started =
        !!targetDetails?.action &&
        this._startCampTileTravel(targetDetails, {
          resourceId: paused.resourceId || null,
        });
      if (started) this._clearCampInterruptedTravelAction();
      return started;
    }

    return false;
  },

  _getCampExpeditionSummary() {
    const currentTileId = this.game.getCharacterTileId?.() || null;
    const currentTile = currentTileId
      ? this.game._getCampMapTile?.(currentTileId)
      : null;
    const atCamp = this.game.isCharacterAtCamp?.() ?? true;
    const carried = this.game.getTripInventory?.() || {};
    const carriedTotal = Object.values(carried).reduce(
      (sum, amount) => sum + (Number(amount) || 0),
      0,
    );
    const load = this.game.getTripInventoryLoad?.() || 0;
    const capacity = this.game.getCharacterCarryCapacity?.() || 0;
    const available =
      this.game.getCharacterAvailableCarryCapacity?.() ??
      Math.max(0, capacity - load);
    const activeTravel = this._campTravelAction || null;
    const busy = !!activeTravel;
    const travelState = activeTravel
      ? this._getCampTravelPhaseState(activeTravel)
      : null;
    const pausedTravel = !busy ? this._getCampInterruptedTravelSummary() : null;
    const cargoLabel =
      carriedTotal > 0 ? this.formatResourcePairs(carried) : "ноша пуста";
    const locationLabel = atCamp
      ? this.game.isCampSetupDone?.()
        ? "лагерь"
        : "ночёвка"
      : currentTile?.name || "участок карты";

    let note =
      "Можно выбрать ресурсный участок и отправить персонажа в новый выход.";
    if (busy) {
      note = activeTravel?.fromQueue
        ? `${travelState?.phaseLabel || "Персонаж в пути"}: выполняется пункт путевого листа.`
        : `${travelState?.phaseLabel || "Персонаж в пути"}: можно остановиться на достигнутом участке без завершения действия.`;
    } else if (pausedTravel) {
      note = pausedTravel.note;
    } else if (!atCamp && carriedTotal > 0) {
      note =
        "Груз станет общим запасом только после возврата и разгрузки в лагере.";
    } else if (!atCamp) {
      note = "Персонаж вне лагеря: новый маршрут начнётся с этого участка.";
    } else if (carriedTotal > 0) {
      note = "Груз уже у лагеря: его можно переложить в общий запас.";
    }

    return {
      currentTileId,
      locationLabel,
      atCamp,
      carried,
      carriedTotal,
      cargoLabel,
      load,
      capacity,
      available,
      busy,
      activeTravel,
      travelState,
      pausedTravel,
      canStop: busy,
      canReturn: !pausedTravel && !atCamp && !busy,
      canUnload: !pausedTravel && atCamp && carriedTotal > 0 && !busy,
      note,
      tone: busy || pausedTravel ? "warn" : carriedTotal > 0 ? "cargo" : "idle",
    };
  },

  _renderCampExpeditionBlock(summary) {
    if (!summary) return "";
    const loadLabel = `${this.formatNumber(summary.load, 1)} / ${this.formatNumber(summary.capacity, 1)}`;
    const freeLabel = this.formatNumber(summary.available, 1);
    const pausedTravel = summary.pausedTravel || null;
    const actionHtml = summary.canStop
      ? `<button id="camp-map-stop-travel-command" class="camp-map-expedition-action is-stop" type="button">Остановиться</button>`
      : pausedTravel?.primaryAction
        ? `${pausedTravel.primaryLabel ? `<button id="camp-map-resume-travel-command" class="camp-map-expedition-action" type="button">${pausedTravel.primaryLabel}</button>` : ""}${pausedTravel.showReturnAlternative ? `<button id="camp-map-return-command" class="camp-map-expedition-action is-secondary" type="button">Вернуться и разгрузить</button>` : ""}`
        : summary.canReturn
          ? `<button id="camp-map-return-command" class="camp-map-expedition-action" type="button">Вернуться и разгрузить</button>`
          : summary.canUnload
            ? `<button id="camp-map-unload-command" class="camp-map-expedition-action" type="button">Разгрузить ношу</button>`
            : "";
    const progressHtml = summary.travelState
      ? `<div class="camp-map-expedition-progress">
          <span>${summary.travelState.phaseLabel}</span>
          <strong>${this.formatCooldownMs(summary.travelState.totalRemainingMs)}</strong>
        </div>`
      : "";

    return `
      <div class="camp-map-expedition is-${summary.tone}">
        <div class="camp-map-expedition-head">
          <span>Экспедиция</span>
          <strong>${summary.locationLabel}</strong>
        </div>
        <div class="camp-map-expedition-grid">
          <span><b>Груз</b>${summary.cargoLabel}</span>
          <span><b>Ноша</b>${loadLabel} · свободно ${freeLabel}</span>
        </div>
        ${progressHtml}
        <div class="camp-map-expedition-note">${summary.note}</div>
        ${actionHtml}
      </div>
    `;
  },

  _getCampFoundingGuideTile(guidance, selectedId = "") {
    const candidates = [
      ...(guidance?.tileHints || []),
      ...(guidance?.supportTiles || []),
      guidance?.preferredTile,
    ].filter(Boolean);
    const seen = new Set();
    const resolved = candidates
      .filter((tile) => {
        const tileId = tile?.id || "";
        if (!tileId || tileId === selectedId || seen.has(tileId)) return false;
        seen.add(tileId);
        return true;
      })
      .map((tile) => this.game.getCampMapTileDetails?.(tile.id) || tile);
    return (
      resolved.find((tile) => {
        const state =
          this.game.getCampTileState?.(tile.id) || tile.state || "hidden";
        return !this._isCampTileUnknownState(state);
      }) ||
      resolved[0] ||
      null
    );
  },

  _renderCampFoundingDockBlock(selected, options = {}) {
    if (this.game.isCampSetupDone?.()) return "";

    const cost = this.game.getCampFoundingCost?.() || {};
    const progressItems = this.getCampFoundingProgressItems?.(cost) || [];
    if (!progressItems.length) return "";

    const check = this.game.canFoundCamp?.() || {
      ok: false,
      missingResources: {},
    };
    const guidance = !check.ok
      ? this.getCampFoundingResourceGuidance?.(check) || null
      : null;
    const preferredTile = this._getCampFoundingGuideTile(
      guidance,
      selected?.id || "",
    );
    const readyCount = progressItems.filter((item) => item.done).length;
    const carriedTotal = progressItems.reduce(
      (sum, item) => sum + Math.max(0, Number(item.carried) || 0),
      0,
    );
    const note = check.ok
      ? options.selectedCanFoundBeforeCamp
        ? "Материалы собраны. На выбранной площадке можно сразу начать основание лагеря."
        : "Материалы собраны. Выберите подходящую площадку на карте, чтобы основать лагерь."
      : carriedTotal > 0
        ? "Ноша уже засчитывается. Осталось добрать недостающее и выбрать место стоянки."
        : preferredTile
          ? `Ближайший полезный участок: ${preferredTile.name}.`
          : "Соберите недостающие материалы с карты или из списка ресурсов ниже.";
    const actionHtml =
      check.ok && options.selectedCanFoundBeforeCamp
        ? `
          <button
            id="camp-map-founding-ready-action"
            class="camp-map-founding-dock-action"
            type="button"
          >
            🏕️ Основать лагерь здесь
          </button>
        `
        : preferredTile && preferredTile.id !== selected?.id
          ? `
            <button
              id="camp-map-founding-guide-action"
              class="camp-map-founding-dock-action is-secondary"
              type="button"
              data-tile-id="${preferredTile.id}"
            >
              🧭 Показать нужный участок
            </button>
          `
          : "";

    return `
      <section class="camp-map-founding-dock" aria-label="Подготовка к основанию лагеря">
        <div class="camp-map-founding-dock-head">
          <span>Подготовка к основанию</span>
          <strong>${readyCount}/${progressItems.length}</strong>
        </div>
        <div class="camp-map-founding-dock-grid">
          ${progressItems
            .map(
              (item) => `
                <div class="camp-map-founding-chip${item.done ? " is-done" : ""}">
                  <div class="camp-map-founding-chip-head">
                    <span>${item.icon} ${item.name}</span>
                    <strong>${item.have}/${item.needed}</strong>
                  </div>
                  <div class="camp-map-founding-chip-meta">${this.formatCampFoundingResourceMeta?.(item) || (item.done ? "Готово" : `Осталось собрать: ${item.missing}`)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="camp-map-founding-dock-note">${note}</div>
        ${actionHtml}
      </section>
    `;
  },

  _buildCampInlineActionOverlayHtml(layout, options = {}) {
    if (this._campTravelAction) return "";

    const selected = options.selected || null;
    const coord = selected?.id ? layout?.tileCoordById?.[selected.id] : null;
    if (
      !selected?.id ||
      !coord ||
      this._isCampTileUnknownState(selected.state)
    ) {
      return "";
    }
    if (this._campInlineActionDismissedTileId === selected.id) {
      return "";
    }

    const buttons = [];
    const addButton = ({
      kind,
      label,
      resourceId = "",
      actionId = "",
      secondary = false,
      disabled = false,
    }) => {
      if (!kind || !label) return;
      buttons.push(`
        <button
          type="button"
          class="camp-map-inline-action-btn${secondary ? " is-secondary" : ""}${disabled ? " is-disabled" : ""}"
          data-camp-inline-action="${kind}"
          ${resourceId ? `data-resource-id="${resourceId}"` : ""}
          ${actionId ? `data-action-id="${actionId}"` : ""}
          ${disabled ? "disabled" : ""}
          aria-disabled="${disabled ? "true" : "false"}"
        >
          ${label}
        </button>
      `);
    };

    let title = "";
    if (options.selectedCanFoundBeforeCamp) {
      title = "Место стоянки";
      addButton({
        kind: "visit",
        label: options.selectedIsCharacterTile
          ? "🚶 Вы уже здесь"
          : "🚶 Идти сюда",
        secondary: true,
        disabled: !options.selectedCanMoveHere,
      });
      addButton({
        kind: "found",
        label: "🏕️ Поставить лагерь",
        disabled: !options.selectedCampSiteCheck?.ok,
      });
    } else if (options.selectedHasGatherAction) {
      const resourceChoices = options.selectedResourceChoices || [];
      const singleChoice = resourceChoices[0] || null;
      title = resourceChoices.length > 1 ? "Что собрать" : "Быстрое действие";

      if (resourceChoices.length > 1) {
        resourceChoices.forEach((choice) => {
          addButton({
            kind: "gather",
            label: `${choice.icon} ${choice.name}`,
            resourceId: choice.id,
            actionId: choice.actionId,
            disabled: !choice.canGather,
          });
        });
      } else if (singleChoice) {
        addButton({
          kind: "gather",
          label: options.selectedIsCharacterTile
            ? `${singleChoice.icon} Собрать здесь`
            : `${singleChoice.icon} Собрать`,
          resourceId: singleChoice.id,
          actionId: singleChoice.actionId,
          disabled: !singleChoice.canGather,
        });
      }
    } else if (options.selectedCanMoveHere) {
      title = "Переход";
      addButton({
        kind: "visit",
        label: "🚶 Идти сюда",
      });
    }

    if (!buttons.length) return "";

    const sceneWidth = Math.max(1, Number(layout?.sceneWidth) || 0);
    const sceneHeight = Math.max(1, Number(layout?.sceneHeight) || 0);
    const viewBox = layout?.viewBox || {
      x: -288,
      y: -320,
      width: 576,
      height: 640,
    };
    const scale = Math.min(
      sceneWidth / viewBox.width,
      sceneHeight / viewBox.height,
    );
    const offsetX = (sceneWidth - viewBox.width * scale) / 2;
    const offsetY = (sceneHeight - viewBox.height * scale) / 2;
    const anchorX = offsetX + (coord.x - viewBox.x) * scale;
    const anchorY = offsetY + (coord.y - viewBox.y) * scale;

    const panelWidth = options.selectedCanFoundBeforeCamp ? 204 : 186;
    const panelHeight = 16 + (title ? 18 : 0) + buttons.length * 38;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const preferBelow = anchorY < 120;
    const x = clamp(anchorX - panelWidth / 2, 10, sceneWidth - panelWidth - 10);
    const y = preferBelow
      ? clamp(anchorY + 34, 10, sceneHeight - panelHeight - 10)
      : clamp(anchorY - panelHeight - 28, 10, sceneHeight - panelHeight - 10);

    return `
      <div
        class="camp-map-inline-panel${preferBelow ? " is-below" : " is-above"}"
        style="left:${x.toFixed(1)}px; top:${y.toFixed(1)}px; width:${panelWidth}px;"
      >
        <div class="camp-map-inline-head">
          ${title ? `<div class="camp-map-inline-title">${title}</div>` : ""}
          <button
            type="button"
            class="camp-map-inline-close"
            data-camp-inline-dismiss="true"
            aria-label="Закрыть"
          >×</button>
        </div>
        <div class="camp-map-inline-actions">
          ${buttons.join("")}
        </div>
      </div>
    `;
  },

  _getCampTaskQueueEntryView(entry, index = 0) {
    const details = this.game.getCampMapTileDetails?.(entry.tileId) || null;
    if (!details?.action) {
      return {
        index,
        valid: false,
        title: "Недоступный участок",
        meta: "Цель больше нельзя собрать.",
      };
    }
    const resourceId = entry.resourceId || "";
    const choiceDetails = resourceId
      ? this._getCampGatherChoiceDetails(details, resourceId, entry.actionId)
      : details;
    const actionCopy = this.getGatherActionCopy(choiceDetails.action);
    const profile = choiceDetails.gatherProfile || null;
    const routePath = this._getCampTravelPathTo(details.id, {
      routeId:
        entry.routeId || this.game.getCampRouteChoice?.(details.id) || "",
    });
    const routeMetrics = this._getCampPathTravelMetrics(routePath);
    const travelPlan = this._getCampTravelPlan(choiceDetails, routeMetrics);
    const resourceName = resourceId
      ? this.getResourceDisplayName(resourceId)
      : this.formatResourcePairs(profile?.output || {}, { plus: true });
    const resourceIcon = resourceId
      ? this.getResourceDisplayIcon(resourceId)
      : actionCopy.icon;
    const routeOption = this._getCampRouteOptions(details.id).find(
      (option) => option.id === entry.routeId,
    );
    return {
      index,
      valid: !!choiceDetails.canGather,
      tileId: details.id,
      resourceId,
      title: `${resourceIcon} ${resourceName}`,
      location: details.name,
      routeLabel: routeOption?.label || "маршрут",
      timeLabel: this._formatCampRouteTimeLabel(
        travelPlan.totalMs,
        routeMetrics,
      ),
      meta: `${details.name} · ${this._formatCampRouteMetricLabel(routeMetrics)} · ${this._formatCampRouteTimeLabel(travelPlan.totalMs, routeMetrics)}`,
      disabledReason: this._getCampGatherDisabledReason(choiceDetails),
    };
  },

  _renderCampTaskQueueBlock() {
    const gate = this.game.getCampTaskQueueGate?.() || {
      unlocked: true,
      insightName: "Путевые метки",
      reason: "",
    };
    const queue = this.game.getCampTaskQueue?.() || [];
    const activeTravel = this._campTravelAction || null;
    const activeQueue = !!activeTravel?.fromQueue;
    const canStart = gate.unlocked && queue.length > 0 && !activeTravel;
    const queueViews = queue.map((entry, index) =>
      this._getCampTaskQueueEntryView(entry, index),
    );
    const emptyText = gate.unlocked
      ? "Выберите ресурсный участок и добавьте его в лист."
      : gate.reason;
    const itemsHtml = queueViews.length
      ? queueViews
          .map(
            (entry) => `
              <div class="camp-map-task-item${entry.valid ? "" : " is-blocked"}">
                <div>
                  <strong>${entry.title}</strong>
                  <span>${entry.meta}</span>
                  ${entry.disabledReason ? `<em>${entry.disabledReason}</em>` : ""}
                </div>
                <button type="button" class="camp-map-task-remove" data-camp-queue-remove="${entry.index}" aria-label="Убрать пункт">×</button>
              </div>
            `,
          )
          .join("")
      : `<div class="camp-map-task-empty">${emptyText}</div>`;
    const activeText = activeQueue
      ? "Выполняется текущий пункт. Оставшиеся задачи ждут очереди."
      : queue.length > 0
        ? `${queue.length} ${queue.length === 1 ? "пункт" : queue.length >= 2 && queue.length <= 4 ? "пункта" : "пунктов"} в листе.`
        : "Лист пуст.";

    return `
      <div class="camp-map-task-queue${gate.unlocked ? "" : " is-locked"}">
        <div class="camp-map-task-head">
          <span>Путевой лист</span>
          <strong>${gate.unlocked ? `${queue.length}/6` : "закрыт"}</strong>
        </div>
        <div class="camp-map-task-list">${itemsHtml}</div>
        <div class="camp-map-task-note">${activeText}</div>
        <div class="camp-map-task-actions">
          <button
            id="camp-map-queue-start"
            class="camp-map-task-action"
            type="button"
            ${canStart ? "" : "disabled"}
            aria-disabled="${canStart ? "false" : "true"}"
          >Начать лист</button>
          <button
            id="camp-map-queue-clear"
            class="camp-map-task-action is-ghost"
            type="button"
            ${queue.length ? "" : "disabled"}
            aria-disabled="${queue.length ? "false" : "true"}"
          >Очистить</button>
        </div>
      </div>
    `;
  },

  _startCampQueuedEntry(entry) {
    if (!entry || this._campTravelAction) return false;
    const details = this.game.getCampMapTileDetails?.(entry.tileId) || null;
    if (!details?.action) {
      this.game.addLog?.("Пункт путевого листа больше недоступен.");
      return false;
    }
    const travelDetails = entry.resourceId
      ? this._getCampGatherChoiceDetails(
          details,
          entry.resourceId,
          entry.actionId,
        )
      : details;
    const blockedReason = this._getCampGatherDisabledReason(travelDetails);
    if (!travelDetails.canGather || blockedReason) {
      this.game.addLog?.(
        `Путевой лист остановлен: ${blockedReason || "пункт нельзя выполнить"}`,
      );
      return false;
    }
    return this._startCampTileTravel(travelDetails, {
      resourceId: entry.resourceId || null,
      routeId:
        entry.routeId || this.game.getCampRouteChoice?.(entry.tileId) || "",
      fromQueue: true,
    });
  },

  _startCampTaskQueue() {
    const gate = this.game.getCampTaskQueueGate?.();
    if (gate && !gate.unlocked) {
      this.game.addLog?.(gate.reason);
      return false;
    }
    if (this._campTravelAction) return false;
    const queue = this.game.getCampTaskQueue?.() || [];
    if (!queue.length) return false;
    const [entry, ...rest] = queue;
    if (!this._startCampQueuedEntry(entry)) return false;
    this.game.setCampTaskQueue?.(rest);
    this.render({ forcePanels: true });
    return true;
  },

  _continueCampTaskQueue() {
    const queue = this.game.getCampTaskQueue?.() || [];
    if (!queue.length) {
      this.game.addLog?.("Путевой лист выполнен.");
      this.render({ forcePanels: true });
      return;
    }
    const available = this.game.getCharacterAvailableCarryCapacity?.() ?? 0;
    if (available <= 0.01) {
      this.game.addLog?.(
        "Путевой лист остановлен: ноша заполнена, нужно вернуться и разгрузиться.",
      );
      this.render({ forcePanels: true });
      return;
    }
    if (this._campTaskQueueTimer) clearTimeout(this._campTaskQueueTimer);
    this._campTaskQueueTimer = setTimeout(() => {
      this._campTaskQueueTimer = null;
      if (!this._startCampTaskQueue()) {
        this.render({ forcePanels: true });
      }
    }, 180);
  },

  _refreshCampTravelEstimate(
    task,
    { reachedIndex = 0, now = Date.now() } = {},
  ) {
    if (!task?.path || now >= task.outboundEndsAt) return false;
    const routeMetrics = this._getCampPathTravelMetrics(task.path);
    const hadApproximateRoute = !!task.routeMetrics?.isApproximate;
    if (!hadApproximateRoute && !routeMetrics.isApproximate) return false;

    const safeReachedIndex = Math.max(
      0,
      Math.min(task.path.length - 1, Number(reachedIndex) || 0),
    );
    const timings = this._computePathTimings(task.path);
    const baseProgress = Math.max(
      0,
      Math.min(1, Number(timings[safeReachedIndex] || 0)),
    );
    const remainingPath = task.path.slice(safeReachedIndex);
    const remainingMetrics = this._getCampPathTravelMetrics(remainingPath);
    const remainingMs =
      remainingPath.length > 1
        ? this._getCampRouteWalkDurationMs(remainingMetrics, {
            ...(task.travelTimingOptions || {}),
            setupMs: 0,
            minMs: 0,
            maxMs: Number.POSITIVE_INFINITY,
          })
        : 0;

    let outboundMs = Math.max(1, Number(task.outboundMs || 1));
    let startAt = task.startAt;
    let outboundEndsAt = task.outboundEndsAt;

    if (baseProgress >= 0.999 || remainingMs <= 0) {
      outboundMs = Math.max(1, now - task.startAt);
      outboundEndsAt = now;
    } else {
      outboundMs = Math.max(1, remainingMs / Math.max(0.001, 1 - baseProgress));
      startAt = Math.round(now - outboundMs * baseProgress);
      outboundEndsAt = Math.round(startAt + outboundMs);
    }

    task.startAt = startAt;
    task.outboundMs = Math.round(outboundMs);
    task.outboundEndsAt = outboundEndsAt;
    task.gatherEndsAt = task.outboundEndsAt + task.gatherMs;
    task.endsAt = task.gatherEndsAt + task.returnMs;
    task.pathTimings = timings;
    task.routeMetrics = routeMetrics;
    return true;
  },

  _getCampGatherDisabledReason(details, activeTravel = null) {
    if (!details?.action) return "";
    const profile = details.gatherProfile || null;
    if (activeTravel) return "Персонаж уже занят другим выходом.";
    const cooldown =
      this.game.getCooldownRemaining?.(details.action.id, {
        tileId: details.id,
      }) || 0;
    if (cooldown > 0) {
      return `Нужно подождать ещё ${this.formatCooldownMs(cooldown)}.`;
    }
    if (details.isDepleted) {
      return "Участок истощён: полезного сырья здесь пока не осталось.";
    }
    if (profile?.blockedReason) return profile.blockedReason;
    if (profile && !this.game.hasEnergy?.(profile.energyCost)) {
      return "Не хватает сил для этого выхода. Вернитесь к стоянке и восстановитесь.";
    }
    if (
      profile &&
      Object.values(profile.output || {}).every((amount) => amount <= 0)
    ) {
      return "С этого участка сейчас нечего вынести.";
    }
    if (!details.canGather) {
      return "Сбор сейчас недоступен: проверьте состояние персонажа, запас участка и доступность действия.";
    }
    return "";
  },

  _getCampGatherChoiceDetails(details, resourceId, actionId = "") {
    const selectedActionId =
      actionId || details?.actionId || details?.action?.id || "";
    const action =
      (selectedActionId && this.data.gatherActions?.[selectedActionId]) ||
      details?.action ||
      null;
    if (!details || !action || !resourceId) return details;
    const gatherProfile = this.game.getGatherProfile?.(action.id, {
      tileId: details.id,
      resourceId,
    });
    return {
      ...details,
      action,
      actionId: action.id,
      gatherResourceId: resourceId,
      gatherProfile,
      canGather: gatherProfile
        ? this.game.canGather?.(action.id, {
            tileId: details.id,
            resourceId,
          }) || false
        : false,
    };
  },

  _getCampGatherResourceChoices(details) {
    const actions = (
      details?.gatherActions?.length
        ? details.gatherActions
        : details?.action
          ? [details.action]
          : []
    ).filter(Boolean);
    const seen = new Set();
    const choices = [];
    for (const action of actions) {
      const resolvedActionId = action?.id || details?.actionId || "";
      for (const resourceId of Object.keys(action.output || {})) {
        if (Number(action.output[resourceId]) <= 0 || seen.has(resourceId)) {
          continue;
        }
        seen.add(resourceId);
        const choiceDetails = this._getCampGatherChoiceDetails(
          details,
          resourceId,
          resolvedActionId,
        );
        const profile = choiceDetails.gatherProfile || null;
        choices.push({
          id: resourceId,
          actionId: resolvedActionId,
          action,
          icon: this.getResourceDisplayIcon(resourceId),
          name: this.getResourceDisplayName(resourceId),
          profile,
          details: choiceDetails,
          output: profile?.output || { [resourceId]: 0 },
          canGather: !!choiceDetails.canGather,
          disabledReason: this._getCampGatherDisabledReason(choiceDetails),
        });
      }
    }
    return choices;
  },

  _getCampTileResourceInfoItems(details, choices = null) {
    const byId = new Map();
    const addResource = (resourceId, data = {}) => {
      if (!resourceId || byId.has(resourceId)) return;
      byId.set(resourceId, {
        id: resourceId,
        icon: this.getResourceDisplayIcon(resourceId),
        name: this.getResourceDisplayName(resourceId),
        ...data,
      });
    };

    for (const choice of choices || []) {
      addResource(choice.id, {
        output: choice.output,
        canGather: choice.canGather,
      });
    }
    if (details?.resourceType) {
      addResource(details.resourceType);
    }
    for (const marker of details?.visibleMarkers || []) {
      if (marker.resourceType) addResource(marker.resourceType);
    }
    for (const potential of details?.knownPotentials || []) {
      if (potential.resourceType) addResource(potential.resourceType);
    }

    return Array.from(byId.values());
  },

  _getCampTravelPlan(details, routeMetrics = null) {
    if (!details || !details.action) {
      return {
        outboundMs: 0,
        gatherMs: 0,
        returnMs: 0,
        totalMs: 0,
        travelTimingOptions: null,
      };
    }

    const profile = details.gatherProfile || null;
    const fallbackDistance = Math.max(
      0,
      Number.isFinite(profile?.routeDistance)
        ? profile.routeDistance
        : details.distanceFromCamp || 0,
    );
    const metrics = routeMetrics || {
      hexCount: fallbackDistance,
      weightedCost: Math.max(
        fallbackDistance,
        fallbackDistance +
          Math.max(0, Number(profile?.terrainPenalty || 0)) * 0.35 +
          Math.max(0, Number(profile?.distancePenalty || 0)) * 0.2,
      ),
      baseMoveMs: 760,
      entries: [],
      terrainSummary: "",
    };
    const routeDistance = Math.max(
      0,
      Number.isFinite(metrics.hexCount) ? metrics.hexCount : fallbackDistance,
    );
    const trips = Math.max(1, Number(profile?.deliveryTrips || 1));
    const carryCapacity = Math.max(
      1,
      Number(
        profile?.carryCapacity || this.game.getCharacterCarryCapacity() || 1,
      ),
    );
    const loadRatio = Math.max(
      0,
      Math.min(2.8, Number(profile?.load || 0) / carryCapacity),
    );
    const noPath =
      routeDistance > 0 &&
      (!details.pathData || details.pathData.id === "none");

    // getCharacterCondition() возвращает объект {id, ...}, а не число.
    // Преобразуем в числовой коэффициент 0..1: чем лучше состояние, тем ближе к 1.
    const conditionObj =
      profile?.condition && typeof profile.condition === "object"
        ? profile.condition
        : this.game.getCharacterCondition?.() || { id: "stable" };
    const conditionId = conditionObj.id || "stable";
    const condition =
      conditionId === "exhausted"
        ? 0.25
        : conditionId === "weakened"
          ? 0.55
          : 1.0;

    const characterState = this.game.getCharacterState?.() || null;
    const mobility = Math.max(
      0,
      Number(characterState?.mobility || characterState?.stats?.mobility || 0),
    );
    const researchedCount = Object.keys(this.game.researched || {}).length;
    const builtCount = Object.keys(this.game.buildings || {}).length;
    const isEarlyStage = researchedCount <= 2 && builtCount <= 2;

    const pathCoef = noPath
      ? 1.08
      : details.pathData?.id === "trail"
        ? 0.94
        : 1;
    const conditionCoef = 1 + (1 - condition) * 0.58;
    const stageCoef = isEarlyStage && routeDistance > 0 ? 1.28 : 1;
    const travelTimingOptions = {
      setupMs: 320 + Math.max(0, trips - 1) * 90,
      minMs: routeDistance > 0 ? 850 : 0,
      maxMs: 240000,
      load: profile?.load || 0,
      extraCoef: pathCoef * stageCoef,
    };
    const outboundMs = this._getCampRouteWalkDurationMs(
      metrics,
      travelTimingOptions,
    );

    const gatherCoef =
      1 +
      loadRatio * 0.16 +
      Math.max(0, trips - 1) * 0.08 +
      (profile?.limitedByCarry ? 0.12 : 0) -
      Math.max(0, mobility - 1) * 0.025;
    const gatherMs = Math.round(
      Math.max(
        520,
        Math.min(
          2600,
          (Math.max(900, Number(details.action.cooldown || 1200)) * 0.82 +
            240) *
            gatherCoef *
            conditionCoef *
            0.9,
        ),
      ),
    );

    const returnMs = 0;

    return {
      outboundMs,
      gatherMs,
      returnMs,
      totalMs: outboundMs + gatherMs,
      travelTimingOptions,
    };
  },

  _estimateCampActionTravelMs(details) {
    const path = this._getCampTravelPathTo(details?.id);
    return this._getCampTravelPlan(
      details,
      this._getCampPathTravelMetrics(path),
    ).totalMs;
  },

  _getCampTravelPhaseState(travelAction, now = Date.now()) {
    if (!travelAction) return null;

    const totalRemainingMs = Math.max(0, travelAction.endsAt - now);
    const returnHomeLabel = this.game.isCampSetupDone?.()
      ? "лагерь"
      : "ночёвку";
    if (now < travelAction.outboundEndsAt) {
      return {
        phase: "outbound",
        phaseLabel: travelAction.isReturnTrip
          ? `Переход в ${returnHomeLabel}`
          : "Переход к участку",
        progress: Math.max(
          0,
          Math.min(
            1,
            (now - travelAction.startAt) / Math.max(1, travelAction.outboundMs),
          ),
        ),
        phaseRemainingMs: Math.max(0, travelAction.outboundEndsAt - now),
        totalRemainingMs,
      };
    }
    if (now < travelAction.gatherEndsAt) {
      return {
        phase: "gather",
        phaseLabel: travelAction.isReturnTrip
          ? "Выгрузка добычи"
          : travelAction.isMove
            ? "Осматривает участок"
            : "Сбор ресурсов",
        progress: 1,
        phaseRemainingMs: Math.max(0, travelAction.gatherEndsAt - now),
        totalRemainingMs,
      };
    }
    return {
      phase: "return",
      phaseLabel: "Возвращение в лагерь",
      progress: Math.max(
        0,
        Math.min(
          1,
          (now - travelAction.gatherEndsAt) /
            Math.max(1, travelAction.returnMs),
        ),
      ),
      phaseRemainingMs: Math.max(0, travelAction.endsAt - now),
      totalRemainingMs,
    };
  },

  _getCampTravelReachedIndex(path, timings, progress) {
    if (!Array.isArray(path) || path.length === 0) return 0;
    if (!Array.isArray(timings) || timings.length !== path.length) {
      return Math.max(
        0,
        Math.min(path.length - 1, Math.floor(progress * (path.length - 1))),
      );
    }
    const clamped = Math.max(0, Math.min(1, progress));
    let reachedIndex = 0;
    for (let index = 1; index < timings.length; index += 1) {
      if (clamped + 0.001 >= timings[index]) reachedIndex = index;
    }
    return reachedIndex;
  },

  _getCampTravelStopPoint(task, now = Date.now()) {
    if (!task) return null;
    const travelState = this._getCampTravelPhaseState(task, now);
    if (!travelState) return null;

    const useReturnPath = travelState.phase === "return";
    const path =
      useReturnPath && task.returnPath?.length ? task.returnPath : task.path;
    const timings = useReturnPath ? task.returnTimings : task.pathTimings;
    if (!Array.isArray(path) || path.length === 0) return null;

    const reachedIndex =
      travelState.phase === "gather"
        ? path.length - 1
        : this._getCampTravelReachedIndex(path, timings, travelState.progress);
    const tileId = path[Math.max(0, Math.min(path.length - 1, reachedIndex))];
    return {
      tileId,
      path: path.slice(0, reachedIndex + 1),
      phase: travelState.phase,
      reachedDestination: reachedIndex >= path.length - 1,
      travelState,
    };
  },

  _cancelCampTravelAction() {
    const task = this._campTravelAction;
    if (!task) return false;

    const now = Date.now();
    this._revealCampTravelPathProgress();
    const stopPoint = this._getCampTravelStopPoint(task, now);
    if (!stopPoint?.tileId) return false;

    const stopTile = this.game._getCampMapTile?.(stopPoint.tileId) || null;
    const targetTile = task.tileId
      ? this.game._getCampMapTile?.(task.tileId)
      : null;
    const stopPath = Array.isArray(stopPoint.path) ? stopPoint.path : [];
    if (stopPath.length > 1) {
      this.game.discoverCampTilesAlongPath?.(stopPath, {
        includeDestination: true,
        pushStory: false,
      });
      this.game.recordCampPathUse?.(stopPath, {
        weight: stopPoint.reachedDestination ? 0.75 : 0.45,
        source: "cancel",
      });
    }

    this._clearCampTileTravel();
    document
      .getElementById("camp-map-svg")
      ?.querySelector(".camp-map-travel-layer")
      ?.remove();

    const homeTileId = this.game._getCampHomeTileId?.();
    const reachedHome = stopPoint.tileId && stopPoint.tileId === homeTileId;
    if (reachedHome && this.game.localCampMap) {
      this.game.localCampMap.characterTileId = stopPoint.tileId;
      this.game.markDirty?.();
    } else {
      this.game.arriveCharacterAtTile?.(stopPoint.tileId);
    }
    this.game.selectCampTile?.(stopPoint.tileId);

    if (!(task.isReturnTrip && reachedHome)) {
      this._campInterruptedTravelAction = {
        tileId: task.tileId,
        targetTileName: targetTile?.name || "",
        actionId: task.actionId,
        resourceId: task.resourceId || null,
        isExplore: !!task.isExplore,
        isMove: !!task.isMove,
        isReturnTrip: !!task.isReturnTrip,
        fromQueue: !!task.fromQueue,
        stopTileId: stopPoint.tileId,
        stopTileName: stopTile?.name || "",
        phase: stopPoint.phase || "",
      };
    } else {
      this._clearCampInterruptedTravelAction();
    }

    const stoppedAt = stopTile?.name ? ` у участка "${stopTile.name}"` : "";
    const phaseLabel = task.isReturnTrip
      ? reachedHome
        ? "Разгрузка прервана"
        : "Возврат остановлен"
      : stopPoint.phase === "gather"
        ? task.isExplore
          ? "Разведка остановлена"
          : task.isMove
            ? "Осмотр прерван"
            : "Сбор прерван"
        : "Переход остановлен";
    this.game.addLog?.(`⏸ ${phaseLabel}: персонаж остановился${stoppedAt}.`);
    this.render({ forcePanels: true });
    return true;
  },

  _startCampTileTravel(details, options = {}) {
    if (!details?.action || this._campTravelAction) return false;
    const gatherResourceId =
      options.resourceId ||
      details.gatherResourceId ||
      details.resourceId ||
      null;
    const travelDetails = gatherResourceId
      ? this._getCampGatherChoiceDetails(
          details,
          gatherResourceId,
          options.actionId || details.actionId || details.action?.id || "",
        )
      : details;
    if (!travelDetails?.id || !travelDetails.canGather) return false;

    const routeId =
      options.routeId || this.game.getCampRouteChoice?.(travelDetails.id) || "";
    const path = this._getCampTravelPathTo(travelDetails.id, { routeId });
    const routeMetrics = this._getCampPathTravelMetrics(path);
    const travelPlan = this._getCampTravelPlan(travelDetails, routeMetrics);
    if (!travelPlan.totalMs) return false;

    this._clearCampInterruptedTravelAction();

    this._clearCampRoutePreview();

    const startAt = Date.now();
    const outboundEndsAt = startAt + travelPlan.outboundMs;
    const gatherEndsAt = outboundEndsAt + travelPlan.gatherMs;

    // Tile-by-tile path for animation
    const pathTimings = this._computePathTimings(path);
    const reversedPath = path.length > 1 ? [...path].reverse() : path;
    const returnTimings = this._computePathTimings(reversedPath);
    const travelTimingOptions = travelPlan.travelTimingOptions || {
      setupMs: 320,
      minMs: routeMetrics.hexCount > 0 ? 850 : 0,
      maxMs: 240000,
      load: travelDetails.gatherProfile?.load || 0,
      extraCoef: 1,
    };

    this._campTravelAction = {
      tileId: travelDetails.id,
      actionId: travelDetails.action.id,
      resourceId: gatherResourceId,
      fromQueue: !!options.fromQueue,
      startAt,
      outboundMs: travelPlan.outboundMs,
      gatherMs: travelPlan.gatherMs,
      returnMs: travelPlan.returnMs,
      outboundEndsAt,
      gatherEndsAt,
      endsAt: gatherEndsAt + travelPlan.returnMs,
      path,
      routeId,
      pathTimings,
      returnPath: reversedPath,
      returnTimings,
      routeMetrics,
      travelTimingOptions,
    };
    this._scheduleCampTileTravelTick();
    this.render({ forcePanels: true });
    return true;
  },

  _clearCampTileTravel() {
    if (this._campTravelTimer) {
      clearTimeout(this._campTravelTimer);
      this._campTravelTimer = null;
    }
    this._campTravelAction = null;
  },

  _clearCampRoutePreview({ render = false } = {}) {
    if (!this._campRoutePreview) return false;
    this._campRoutePreview = null;
    if (render) {
      const container = document.getElementById("camp-map-panel");
      if (container) container.dataset.prevSelectedTile = "__route_preview__";
      this.render({ forcePanels: true });
    }
    return true;
  },

  _getCampRoutePreview(tileId, kind = "inspect") {
    if (!tileId || this._campTravelAction) return null;
    const originTileId = this._getCampHomeTileIdForPath();
    if (!originTileId || originTileId === tileId) return null;
    const routeId = this.game.getCampRouteChoice?.(tileId) || "";
    const path = this._getCampTravelPathTo(tileId, {
      allowFallback: false,
      routeId,
    });
    if (!Array.isArray(path) || path.length < 2) return null;
    return { tileId, kind, path };
  },

  _setCampRoutePreview(tileId, kind = "inspect", { render = false } = {}) {
    const preview = this._getCampRoutePreview(tileId, kind);
    const previous = this._campRoutePreview;
    if (!preview) {
      return this._clearCampRoutePreview({ render });
    }
    const samePreview =
      previous?.tileId === preview.tileId &&
      previous?.kind === preview.kind &&
      Array.isArray(previous.path) &&
      previous.path.join("|") === preview.path.join("|");
    this._campRoutePreview = preview;
    if (render && !samePreview) {
      const container = document.getElementById("camp-map-panel");
      if (container) container.dataset.prevSelectedTile = "__route_preview__";
      this.render({ forcePanels: true });
    }
    return true;
  },

  _revealCampTravelPathProgress() {
    const task = this._campTravelAction;
    if (
      !task?.path ||
      !Array.isArray(task.path) ||
      task.path.length < 2 ||
      typeof this.game.discoverCampTilesAlongPath !== "function"
    ) {
      return;
    }

    const timings = Array.isArray(task.pathTimings) ? task.pathTimings : [];
    if (timings.length !== task.path.length) return;

    const now = Date.now();
    const outboundProgress =
      now >= task.outboundEndsAt
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              (now - task.startAt) / Math.max(1, task.outboundMs || 1),
            ),
          );
    let reachedIndex = 0;
    for (let index = 1; index < timings.length; index += 1) {
      if (outboundProgress + 0.001 >= timings[index]) {
        reachedIndex = index;
      }
    }

    if (reachedIndex <= (task.revealedPathIndex || 0)) return;

    const partialPath = task.path.slice(0, reachedIndex + 1);
    const reachedDestination = reachedIndex >= task.path.length - 1;
    this.game.discoverCampTilesAlongPath(partialPath, {
      includeDestination: !task.isExplore || !reachedDestination,
      pushStory: false,
    });
    this._refreshCampTravelEstimate(task, { reachedIndex, now });
    task.revealedPathIndex = reachedIndex;
  },

  _scheduleCampTileTravelTick() {
    if (!this._campTravelAction) return;
    if (this._campTravelTimer) clearTimeout(this._campTravelTimer);

    this._revealCampTravelPathProgress();

    const remaining = this._campTravelAction.endsAt - Date.now();
    if (remaining <= 0) {
      this._finalizeCampTileTravel();
      return;
    }

    this.render({ forcePanels: true });
    this._campTravelTimer = setTimeout(
      () => this._scheduleCampTileTravelTick(),
      120,
    );
  },

  _finalizeCampTileTravel() {
    const task = this._campTravelAction;
    if (!task) return;

    this._clearCampTileTravel();

    // Remove the travel-layer from the SVG immediately so it doesn't linger
    // if the flicker-guard prevents a full DOM rebuild this tick.
    document
      .getElementById("camp-map-svg")
      ?.querySelector(".camp-map-travel-layer")
      ?.remove();

    const revealTravelPath = ({ includeDestination = false } = {}) => {
      if (typeof this.game.discoverCampTilesAlongPath !== "function") {
        return null;
      }
      return this.game.discoverCampTilesAlongPath(task.path, {
        includeDestination,
        pushStory: true,
      });
    };

    // Exploration travel: just reveal the tile, no gather
    if (task.isExplore) {
      revealTravelPath({ includeDestination: false });
      this.game.recordCampPathUse?.(task.path, {
        weight: 1,
        source: "explore",
      });
      const discovery =
        typeof this.game.discoverCampTile === "function"
          ? this.game.discoverCampTile(task.tileId, {
              silent: false,
              pushStory: true,
            })
          : false;
      const revealed =
        discovery === true ||
        !!discovery?.ok ||
        this.game.getCampTileState?.(task.tileId) === "discovered";
      this.game.arriveCharacterAtTile?.(task.tileId);
      this.game.selectCampTile?.(task.tileId);
      if (!revealed) {
        const hint =
          this.game.getCampTileUnlockHint?.(task.tileId) ||
          "Место осмотрено, но его смысл пока не ясен.";
        this.game.addLog?.(
          `🚶 Персонаж дошёл до неизвестного участка. ${hint}`,
        );
        this.render({ forcePanels: true });
        return;
      }
      this.render({ forcePanels: true });
      return;
    }

    if (task.isMove) {
      revealTravelPath({ includeDestination: false });
      this.game.recordCampPathUse?.(task.path, {
        weight: 1,
        source: "move",
      });
      this.game.arriveCharacterAtTile?.(task.tileId);
      this.game.selectCampTile?.(task.tileId);
      const tile = this.game._getCampMapTile?.(task.tileId) || null;
      this.game.addLog?.(
        `🚶 Персонаж дошёл до участка \"${tile?.name || task.tileId}\".`,
      );
      this.render({ forcePanels: true });
      return;
    }

    if (task.isReturnTrip) {
      revealTravelPath({ includeDestination: false });
      this.game.recordCampPathUse?.(task.path, {
        weight: 1,
        source: "return",
      });
      this.game.arriveCharacterAtTile?.(task.tileId);
      this.game.unloadTripInventory?.({ silent: false });
      this.game.selectCampTile?.(task.tileId);
      this.render({ forcePanels: true });
      return;
    }

    revealTravelPath({ includeDestination: false });
    this.game.recordCampPathUse?.(task.path, {
      weight: 1,
      source: "gather",
    });
    this.game.arriveCharacterAtTile?.(task.tileId);
    const ok = this.game.performCampTileAction(task.tileId, {
      resourceId: task.resourceId || null,
    });
    this.render({ forcePanels: true });
    if (!ok) return;

    const cooldownMs =
      this.game.getGatherCooldownDuration?.(task.actionId) ||
      this.data.gatherActions?.[task.actionId]?.cooldown ||
      0;
    this._scheduleGatherCooldownRefresh(cooldownMs);
    if (task.fromQueue) {
      this._continueCampTaskQueue();
    }
  },

  // Start an exploration trip to a silhouette/unknown tile.
  // Character walks there, reveals it, and stays (no return trip).
  _startCampTileExplore(tileId) {
    if (this._campTravelAction) return false;
    const tile = this.game._getCampMapTile(tileId);
    if (!tile) return false;
    if (
      typeof this.game.canExploreCampTile === "function" &&
      !this.game.canExploreCampTile(tileId)
    ) {
      return false;
    }
    const startAt = Date.now();
    const lookMs = 500;
    const path = this._getCampTravelPathTo(tileId, {
      allowFallback: false,
      routeId: this.game.getCampRouteChoice?.(tileId) || "",
    });
    if (!Array.isArray(path) || path.length < 2) return false;
    const routeMetrics = this._getCampPathTravelMetrics(path);
    const travelTimingOptions = {
      setupMs: 280,
      minMs: 900,
      maxMs: 180000,
      extraCoef: 1.05,
    };
    const outboundMs = this._getCampRouteWalkDurationMs(
      routeMetrics,
      travelTimingOptions,
    );
    const pathTimings = this._computePathTimings(path);

    this._clearCampInterruptedTravelAction();

    this._clearCampRoutePreview();

    this._campTravelAction = {
      tileId,
      actionId: "_explore",
      isExplore: true,
      startAt,
      outboundMs,
      gatherMs: lookMs,
      returnMs: 0,
      outboundEndsAt: startAt + outboundMs,
      gatherEndsAt: startAt + outboundMs + lookMs,
      endsAt: startAt + outboundMs + lookMs,
      path,
      pathTimings,
      returnPath: [],
      returnTimings: [],
      routeMetrics,
      travelTimingOptions,
    };
    this._scheduleCampTileTravelTick();
    this.render({ forcePanels: true });
    return true;
  },

  _startCampTileVisit(tileId) {
    if (this._campTravelAction) return false;
    const tile = this.game._getCampMapTile?.(tileId) || null;
    if (!tile) return false;

    const startAt = Date.now();
    const inspectMs = 280;
    const path = this._getCampTravelPathTo(tileId, {
      allowFallback: false,
      routeId: this.game.getCampRouteChoice?.(tileId) || "",
    });
    if (!Array.isArray(path) || path.length < 2) return false;
    const routeMetrics = this._getCampPathTravelMetrics(path);
    const travelTimingOptions = {
      setupMs: 280,
      minMs: 850,
      maxMs: 180000,
      extraCoef: 1.02,
    };
    const outboundMs = this._getCampRouteWalkDurationMs(
      routeMetrics,
      travelTimingOptions,
    );
    const pathTimings = this._computePathTimings(path);

    this._clearCampInterruptedTravelAction();
    this._clearCampRoutePreview();

    this._campTravelAction = {
      tileId,
      actionId: "_move",
      isMove: true,
      startAt,
      outboundMs,
      gatherMs: inspectMs,
      returnMs: 0,
      outboundEndsAt: startAt + outboundMs,
      gatherEndsAt: startAt + outboundMs + inspectMs,
      endsAt: startAt + outboundMs + inspectMs,
      path,
      pathTimings,
      returnPath: [],
      returnTimings: [],
      routeMetrics,
      travelTimingOptions,
    };
    this._scheduleCampTileTravelTick();
    this.render({ forcePanels: true });
    return true;
  },

  _startCampReturnTrip() {
    if (this._campTravelAction) return false;

    this._clearCampRoutePreview();

    const tiles = this.game._getCampMapTileList?.() || [];
    const homeTileId =
      this.game._getCampHomeTileId?.() ||
      tiles.find((tile) => this.game.getCampTileState(tile.id) === "camp")
        ?.id ||
      tiles.find((tile) => tile.id === "camp_clearing")?.id ||
      tiles.find((tile) => this.game._getCampTileLiveDist(tile) === 0)?.id ||
      null;
    if (!homeTileId) return false;

    const currentTileId = this.game.getCharacterTileId?.();
    if (!currentTileId || currentTileId === homeTileId) {
      this._clearCampInterruptedTravelAction();
      this.game.arriveCharacterAtTile?.(homeTileId);
      this.game.unloadTripInventory?.({ silent: false });
      this.game.selectCampTile?.(homeTileId);
      this.render({ forcePanels: true });
      return true;
    }

    const foundPath = this.game._findCampHexPath?.(currentTileId, homeTileId);
    const path =
      Array.isArray(foundPath) && foundPath.length > 0
        ? foundPath
        : [currentTileId, homeTileId].filter(Boolean);
    const pathTimings = this._computePathTimings(path);
    const load = Math.max(
      0,
      this.game.getTripInventoryLoad?.() ||
        this.game.getTripInventoryTotal?.() ||
        0,
    );
    const routeMetrics = this._getCampPathTravelMetrics(path);
    const travelTimingOptions = {
      setupMs: 240,
      minMs: 850,
      maxMs: 180000,
      load,
    };
    const outboundMs = this._getCampRouteWalkDurationMs(
      routeMetrics,
      travelTimingOptions,
    );
    const unloadMs = load > 0 ? 420 : 180;
    const startAt = Date.now();

    this._clearCampInterruptedTravelAction();

    this._campTravelAction = {
      tileId: homeTileId,
      actionId: "_return_home",
      isReturnTrip: true,
      startAt,
      outboundMs,
      gatherMs: unloadMs,
      returnMs: 0,
      outboundEndsAt: startAt + outboundMs,
      gatherEndsAt: startAt + outboundMs + unloadMs,
      endsAt: startAt + outboundMs + unloadMs,
      path,
      pathTimings,
      returnPath: [],
      returnTimings: [],
      routeMetrics,
      travelTimingOptions,
    };

    this._scheduleCampTileTravelTick();
    this.render({ forcePanels: true });
    return true;
  },

  // Find the "home" tile ID for pathfinding: the founded camp tile, or pre-camp origin.
  _getCampHomeTileIdForPath() {
    const currentTileId = this.game.getCharacterTileId?.();
    if (currentTileId && this.game._getCampMapTile(currentTileId)) {
      return currentTileId;
    }
    const tiles = this.game._getCampMapTileList();
    const campTile =
      tiles.find((t) => this.game.getCampTileState(t.id) === "camp") ||
      tiles.find((t) => t.id === "camp_clearing") ||
      tiles.find((t) => this.game._getCampTileLiveDist(t) === 0);
    return campTile?.id || null;
  },

  // Compute normalized progress checkpoints [0..1] for each tile in the path.
  // pathTimings[i] = progress (0..1) when character arrives at path[i].
  // Weights are terrain movement costs of each entered tile.
  _computePathTimings(path) {
    if (!path || path.length <= 1) return path?.length === 1 ? [0] : [];
    const costs = this._getCampPathTravelMetrics(path).entries.map((entry) =>
      Math.max(0.01, Number(entry.cost) || 1),
    );
    const total = costs.reduce((s, c) => s + c, 0);
    if (total <= 0) return path.map((_, i) => i / (path.length - 1));
    const timings = [0];
    let cum = 0;
    for (const c of costs) {
      cum += c;
      timings.push(cum / total);
    }
    return timings;
  },

  // Given a path + timings array and a progress value (0..1), return {x, y}
  // interpolated between the two surrounding tile centres.
  _interpolateAlongPath(path, timings, progress, tileCoordById) {
    if (!path || path.length === 0) return null;
    if (path.length === 1) return tileCoordById[path[0]] || null;
    const clamped = Math.max(0, Math.min(1, progress));
    let segIdx = path.length - 2;
    for (let i = 0; i < timings.length - 1; i++) {
      if (clamped <= timings[i + 1]) {
        segIdx = i;
        break;
      }
    }
    const fromCoord = tileCoordById[path[segIdx]];
    const toCoord = tileCoordById[path[segIdx + 1]];
    if (!fromCoord || !toCoord) {
      return tileCoordById[path[path.length - 1]] || null;
    }
    const segLen = timings[segIdx + 1] - timings[segIdx];
    const segProg = segLen > 0 ? (clamped - timings[segIdx]) / segLen : 1;
    return {
      x: fromCoord.x + (toCoord.x - fromCoord.x) * segProg,
      y: fromCoord.y + (toCoord.y - fromCoord.y) * segProg,
    };
  },

  // Build the SVG travel-layer markup from a pre-computed tileCoordById map.
  // Returns an HTML string for a <g class="camp-map-travel-layer"> or "".
  _buildCharacterMapMarkerSvg({
    x,
    y,
    phase = "idle",
    directionClass = "",
    resourceClass = "",
    hasCarry = false,
    extraSvg = "",
  }) {
    const safePhase = String(phase).replace(/[^a-z0-9_-]/gi, "") || "idle";
    const carryClass = hasCarry ? " has-carry" : "";
    return `<g class="camp-map-player-marker phase-${safePhase}${directionClass}${resourceClass}${carryClass}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle class="camp-map-player-halo" cx="0" cy="0" r="13" />
      <path class="camp-map-player-pointer" d="M 0 -10 L 8 7 L 2 5 L 0 12 L -2 5 L -8 7 Z" />
      <circle class="camp-map-player-core" cx="0" cy="0" r="3.8" />
      <circle class="camp-map-player-load" cx="7" cy="7" r="3" />
      ${extraSvg}
    </g>`;
  },

  _buildTravelOverlaySvg(tileCoordById, mapState) {
    if (!this._campTravelAction) return "";
    const task = this._campTravelAction;
    const targetCoord = tileCoordById[task.tileId] || null;
    const startTileId =
      Array.isArray(task.path) && task.path.length > 0
        ? task.path[0]
        : this.game.getCharacterTileId?.();
    const campTile =
      mapState.tiles.find((t) => t.state === "camp") ||
      mapState.tiles.find((t) => t.id === "camp_clearing") ||
      mapState.tiles.find((t) => (t.distanceFromCamp || 0) === 0) ||
      null;
    const startCoord =
      tileCoordById[startTileId] ||
      (campTile ? tileCoordById[campTile.id] : null);
    if (!targetCoord || !startCoord) return "";
    const travelState = this._getCampTravelPhaseState(this._campTravelAction);
    if (!travelState) return "";
    const targetTile =
      mapState.tiles.find(
        (tile) => tile.id === this._campTravelAction.tileId,
      ) || null;
    const actionId = this._campTravelAction.actionId || "";
    const action = this.data.gatherActions?.[actionId] || null;
    const outputIds = Object.keys(action?.output || {});
    const tripInventory = this.game.getTripInventory?.() || {};
    const carriedTripResourceId = Object.keys(tripInventory).find(
      (resourceId) => Number(tripInventory[resourceId]) > 0,
    );
    const carriedResourceId =
      (task.isReturnTrip ? carriedTripResourceId : "") ||
      targetTile?.resourceType ||
      outputIds[0] ||
      (actionId === "gather_supplies" ? "supplies" : "");
    const resourceClass = carriedResourceId
      ? ` resource-${String(carriedResourceId).replace(/[^a-z0-9_-]/gi, "")}`
      : "";

    // ── Tile-by-tile path interpolation ──
    const outPath = task.path;
    const outTimings = task.pathTimings;
    const retPath = task.returnPath;
    const retTimings = task.returnTimings;

    let markerX = startCoord.x;
    let markerY = startCoord.y;

    if (travelState.phase === "outbound" && outPath?.length > 1 && outTimings) {
      const pos = this._interpolateAlongPath(
        outPath,
        outTimings,
        travelState.progress,
        tileCoordById,
      );
      markerX =
        pos?.x ??
        startCoord.x + (targetCoord.x - startCoord.x) * travelState.progress;
      markerY =
        pos?.y ??
        startCoord.y + (targetCoord.y - startCoord.y) * travelState.progress;
    } else if (travelState.phase === "gather") {
      markerX = targetCoord.x;
      markerY = targetCoord.y;
    } else if (
      travelState.phase === "return" &&
      retPath?.length > 1 &&
      retTimings
    ) {
      const pos = this._interpolateAlongPath(
        retPath,
        retTimings,
        travelState.progress,
        tileCoordById,
      );
      markerX =
        pos?.x ??
        targetCoord.x + (startCoord.x - targetCoord.x) * travelState.progress;
      markerY =
        pos?.y ??
        targetCoord.y + (startCoord.y - targetCoord.y) * travelState.progress;
    } else {
      // Fallback: linear interpolation (no path data)
      if (travelState.phase === "outbound") {
        markerX =
          startCoord.x + (targetCoord.x - startCoord.x) * travelState.progress;
        markerY =
          startCoord.y + (targetCoord.y - startCoord.y) * travelState.progress;
      } else if (travelState.phase === "return") {
        markerX =
          targetCoord.x + (startCoord.x - targetCoord.x) * travelState.progress;
        markerY =
          targetCoord.y + (startCoord.y - targetCoord.y) * travelState.progress;
      }
    }

    // ── Route line: polyline through hex tile centres ──
    let routeD;
    if (outPath?.length > 1) {
      const pathCoords = outPath.map((id) => tileCoordById[id]).filter(Boolean);
      routeD = pathCoords
        .map(
          (c, i) =>
            `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
        )
        .join(" ");
    } else {
      routeD = `M ${startCoord.x.toFixed(1)} ${startCoord.y.toFixed(1)} L ${targetCoord.x.toFixed(1)} ${targetCoord.y.toFixed(1)}`;
    }

    const routeClass =
      travelState.phase === "return" || task.isReturnTrip
        ? "camp-map-travel-route is-return"
        : "camp-map-travel-route";
    const actionLabel = task.isReturnTrip
      ? travelState.phase === "gather"
        ? "Выгружает добычу"
        : "Идёт в лагерь"
      : travelState.phase === "gather"
        ? travelState.phaseLabel
        : travelState.phase === "return"
          ? "Несёт добычу"
          : "Идёт к участку";
    const directionClass =
      travelState.phase === "return" || task.isReturnTrip
        ? " facing-home"
        : " facing-target";
    const bob =
      travelState.phase === "gather" ? 0 : Math.sin(Date.now() / 150) * 0.9;
    const gatherFx =
      travelState.phase === "gather"
        ? `<g class="camp-map-gather-fx${resourceClass}">
            <path class="gather-fx-spark a" d="M -13 -5 L -7 -11" />
            <path class="gather-fx-spark b" d="M 9 -7 L 15 -13" />
            <circle class="gather-fx-dot" cx="13" cy="1" r="1.8" />
          </g>`
        : "";
    const markerPhase = task.isReturnTrip
      ? travelState.phase === "gather"
        ? "gather"
        : "return"
      : travelState.phase;
    const markerHasCarry =
      !!carriedResourceId &&
      (travelState.phase === "return" ||
        task.isReturnTrip ||
        travelState.phase === "gather");

    return `<g class="camp-map-travel-layer" aria-hidden="true">
      <path class="${routeClass}" d="${routeD}" />
      ${this._buildCharacterMapMarkerSvg({
        x: markerX,
        y: markerY + bob,
        phase: markerPhase,
        directionClass,
        resourceClass,
        hasCarry: markerHasCarry,
        extraSvg: gatherFx,
      })}
      <g class="camp-map-travel-label" transform="translate(${markerX.toFixed(1)} ${(markerY - 28).toFixed(1)})">
        <text class="camp-map-travel-action" x="0" y="-8">${actionLabel}</text>
        <text class="camp-map-travel-timer" x="0" y="5">${this.formatCooldownMs(travelState.totalRemainingMs)}</text>
      </g>
    </g>`;
  },

  _buildRoutePreviewOverlaySvg(tileCoordById) {
    if (this._campTravelAction || !this._campRoutePreview?.path?.length) {
      return "";
    }
    const preview = this._campRoutePreview;
    const pathCoords = preview.path
      .map((id) => tileCoordById[id])
      .filter(Boolean);
    if (pathCoords.length < 2) return "";

    const routeD = pathCoords
      .map(
        (coord, index) =>
          `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`,
      )
      .join(" ");
    const targetCoord = pathCoords[pathCoords.length - 1];
    const kindClass = String(preview.kind || "inspect").replace(
      /[^a-z0-9_-]/gi,
      "",
    );
    const nodes = pathCoords
      .slice(1, -1)
      .map(
        (coord) =>
          `<circle class="camp-map-route-preview-node" cx="${coord.x.toFixed(1)}" cy="${coord.y.toFixed(1)}" r="2.4" />`,
      )
      .join("");

    return `<g class="camp-map-route-preview-layer is-${kindClass}" aria-hidden="true">
      <path class="camp-map-route-preview" d="${routeD}" />
      ${nodes}
      <circle class="camp-map-route-preview-target" cx="${targetCoord.x.toFixed(1)}" cy="${targetCoord.y.toFixed(1)}" r="16" />
      <circle class="camp-map-route-preview-core" cx="${targetCoord.x.toFixed(1)}" cy="${targetCoord.y.toFixed(1)}" r="4.4" />
      <g class="camp-map-route-preview-label" transform="translate(${targetCoord.x.toFixed(1)} ${(targetCoord.y - 24).toFixed(1)})">
        <text class="camp-map-route-preview-tag" x="0" y="0">Цель</text>
      </g>
    </g>`;
  },

  _buildIdleCharacterOverlaySvg(tileCoordById, mapState) {
    if (this._campTravelAction) return "";
    const characterTileId = this.game.getCharacterTileId?.();
    if (!characterTileId) return "";
    const coord = tileCoordById[characterTileId];
    if (!coord) return "";
    const tile =
      mapState.tiles.find((entry) => entry.id === characterTileId) || null;
    const tripInventory = this.game.getTripInventory?.() || {};
    const carriedTripResourceId = Object.keys(tripInventory).find(
      (resourceId) => Number(tripInventory[resourceId]) > 0,
    );
    const resourceId = carriedTripResourceId || tile?.resourceType || "";
    const resourceClass = resourceId
      ? ` resource-${String(resourceId).replace(/[^a-z0-9_-]/gi, "")}`
      : "";
    const carryClass = carriedTripResourceId ? " has-carry" : "";
    const showLocationLabel = !!this._campRoutePreview?.path?.length;

    return `<g class="camp-map-travel-layer is-idle" aria-hidden="true">
      <circle class="camp-map-current-tile-ring" cx="${coord.x.toFixed(1)}" cy="${coord.y.toFixed(1)}" r="18" />
      ${showLocationLabel ? `<g class="camp-map-current-tile-label" transform="translate(${coord.x.toFixed(1)} ${(coord.y + 24).toFixed(1)})"><text class="camp-map-current-tile-tag" x="0" y="0">Вы здесь</text></g>` : ""}
      ${this._buildCharacterMapMarkerSvg({
        x: coord.x,
        y: coord.y,
        phase: "idle",
        directionClass: " facing-target",
        resourceClass,
        hasCarry: !!carryClass,
      })}
    </g>`;
  },

  getCampTileStateLabel(state) {
    switch (state) {
      case "developed":
        return "Освоено";
      case "discovered":
        return "Доступно";
      case "terrain_seen":
        return "Осмотрено";
      case "visible_locked":
      case "hidden":
      case "silhouette":
        return "Неизвестно";
      case "camp":
        return "Лагерь";
      case "camp_candidate":
        return "Место стоянки";
      default:
        return "Участок";
    }
  },

  _isCampTileUnknownState(state) {
    return (
      state === "hidden" || state === "silhouette" || state === "visible_locked"
    );
  },

  getCampTerrainLabel(terrainType) {
    switch (terrainType) {
      case "camp":
        return "центр стоянки";
      case "clearing":
        return "ровная площадка";
      case "grove":
      case "brush":
        return "заросли";
      case "ridge":
      case "rock":
        return "каменистый участок";
      case "water":
        return "берег ручья";
      case "clay":
        return "глинистый берег";
      case "worksite":
        return "твёрдая площадка";
      case "kiln":
        return "жарное место";
      case "lore":
        return "старый след";
      case "grass":
        return "травяной участок";
      default:
        return "подходящее место";
    }
  },

  getCampTileDisplayIcon(tile, icon) {
    if (tile?.primaryMarker) {
      return this.getCampTileMarkerIcon(tile.primaryMarker);
    }
    switch (tile?.resourceType || tile?.actionId) {
      case "gather_supplies":
        return "·";
      case "wood":
      case "gather_wood":
        return this.getCampMapResourceMarkerIcon("wood") || "·";
      case "stone":
      case "gather_stone":
        return this.getCampMapResourceMarkerIcon("stone") || "·";
      case "fiber":
      case "gather_fiber":
        return this.getCampMapResourceMarkerIcon("fiber") || "·";
      case "clay":
      case "gather_clay":
        return this.getCampMapResourceMarkerIcon("clay") || "·";
      case "water":
      case "gather_water":
        return this.getCampMapResourceMarkerIcon("water") || "·";
      case "food":
      case "gather_food":
        return this.getCampMapResourceMarkerIcon("food") || "·";
      default:
        if (typeof icon === "string" && !icon.includes("<")) {
          return this.isCampMapItemLikeMarkerIcon(icon) ? "" : icon;
        }
        return icon ? "•" : "";
    }
  },

  getCampMapResourceMarkerIcon(resourceType) {
    const mapGlyphs = {
      wood: "⌁",
      stone: "◆",
      fiber: "≋",
      water: "≈",
      food: "✦",
      clay: "◒",
    };
    return mapGlyphs[resourceType] || "";
  },

  isCampMapItemLikeMarkerIcon(icon) {
    if (typeof icon !== "string" || !icon) return false;
    return ["🪓", "🪚", "🪵", "🔧", "🛠", "🛠️", "🧰", "🪨", "🏺"].includes(
      icon,
    );
  },

  getCampMapBuildingMarkerIcon(buildingId, icon) {
    const buildingGlyphs = {
      campfire: "✺",
      rest_tent: "⌂",
      storage: "▣",
      workshop: "⚙",
      kiln: "◒",
    };
    if (buildingGlyphs[buildingId]) return buildingGlyphs[buildingId];
    const plainIcon = this.getPlainIcon(icon || "", "");
    return this.isCampMapItemLikeMarkerIcon(plainIcon) ? "▣" : plainIcon || "▣";
  },

  getCampTileMarkerIcon(marker) {
    if (!marker) return "";
    const markerId = marker.id || marker.resourceType || marker.actionId || "";
    const semanticGlyphs = {
      branches: this.getCampMapResourceMarkerIcon("wood"),
      wood: this.getCampMapResourceMarkerIcon("wood"),
      stone: this.getCampMapResourceMarkerIcon("stone"),
      fiber: this.getCampMapResourceMarkerIcon("fiber"),
      water: this.getCampMapResourceMarkerIcon("water"),
      food: this.getCampMapResourceMarkerIcon("food"),
      clay: this.getCampMapResourceMarkerIcon("clay"),
      old_trace: "·",
      old_fire_trace: "○",
      camp_place: "◉",
      build_site: "□",
      shelter_site: "▱",
      workshop_site: "◇",
      kiln_site: "○",
      gather_supplies: "·",
    };
    if (semanticGlyphs[markerId]) return semanticGlyphs[markerId];
    if (marker.resourceType) {
      return this.getCampMapResourceMarkerIcon(marker.resourceType);
    }
    const icon = this.getPlainIcon(marker.icon || "•", "•");
    return this.isCampMapItemLikeMarkerIcon(icon) ? "" : icon;
  },

  getCampTileMarkerLabel(marker) {
    if (!marker) return "";
    if (marker.resourceType) {
      return this.getResourceDisplayName(marker.resourceType);
    }
    return marker.label || marker.id || "Метка";
  },

  getCampTileRoleMeta(tile) {
    if (!tile) return null;

    if (tile.roleLabel || tile.roleDescription) {
      return {
        label: tile.roleLabel || "Роль участка",
        description: tile.roleDescription || tile.description || "",
      };
    }

    if (tile.state === "camp") {
      return {
        label: "Центр стоянки",
        description:
          "Здесь сходятся отдых, внутренний уклад и обратный путь с добычей. Это домашняя точка карты, а не источник сырья.",
      };
    }

    if (tile.sourceKind === "old_camp_trace") {
      return {
        label: "След старого привала",
        description:
          "Это не готовое хранилище, а остатки прежней стоянки: немного топлива, камней и волокон, которые ещё можно подобрать.",
      };
    }

    if (Array.isArray(tile.buildOptions) && tile.buildOptions.length > 0) {
      return {
        label: "Подходящая площадка",
        description:
          "Сейчас это просто часть местности. Позже участок сможет получить постоянную роль внутри лагеря.",
      };
    }

    return null;
  },

  getCampTileImageHref(tile) {
    if (!tile || this._isCampTileUnknownState(tile.state)) {
      return "";
    }
    if (tile.state === "camp") {
      return "prototype/assets/icons/camp.png";
    }

    if (tile.surfaceImage) return tile.surfaceImage;
    const terrainPng = {
      grove: "grove.webp",
      brush: "forest_edge.webp",
      clearing: "clearing.webp",
      grass: "grass.webp",
      plain: "open_grass.webp",
      lore: "old_camp_trace.webp",
      worksite: "hard_worksite.webp",
      rocks: "stony_ground.webp",
      rock: "stony_ground.webp",
      ridge: "rocky_ridge.webp",
      kiln: "dry_terrace.webp",
      water: "wet_bank.webp",
      clay: "clay_bank.webp",
    };
    const tpng = terrainPng[tile.terrainType];
    if (tpng) return `prototype/assets/terrain/${tpng}`;
    return "prototype/assets/terrain/clearing.webp";
  },

  renderCampMap() {
    const container = document.getElementById("camp-map-panel");
    if (!container) return;

    const mapState = this._getCampMapStateSnapshot();
    const activeMapLayer = this._getCampMapLayerMode();
    const showResourceLayer = activeMapLayer === "resources";
    const showPathLayer = activeMapLayer === "paths";
    const showSurveyLayer = activeMapLayer === "survey";

    // ── Flicker guard: if the intro overlay is already showing the same step
    //    AND the selected tile hasn't changed, skip full DOM rebuild so CSS
    //    animations don't restart every tick. ──
    const _currentSelectedTile = mapState.selectedTileId || "";
    const _currentCharacterTile = this.game.getCharacterTileId?.() || "";
    const _currentOverlayState = this._campTravelAction
      ? "travel"
      : this._campRoutePreview
        ? `preview:${this._campRoutePreview.tileId || ""}:${this._campRoutePreview.kind || "inspect"}`
        : "idle";
    const _prevSelectedTile = container.dataset.prevSelectedTile ?? null;
    const _prevCharacterTile = container.dataset.prevCharacterTile ?? null;
    const _prevOverlayState = container.dataset.prevOverlayState ?? null;
    const _prevMapLayer = container.dataset.prevMapLayer ?? null;
    if (
      !mapState.campSetupDone &&
      mapState.introStep &&
      container.querySelector(".camp-intro-overlay")
    ) {
      const currentOverlayStep = container
        .querySelector(".camp-intro-overlay")
        ?.getAttribute("data-intro-step");
      if (
        currentOverlayStep === mapState.introStep.id &&
        _prevSelectedTile === _currentSelectedTile &&
        _prevCharacterTile === _currentCharacterTile &&
        _prevOverlayState === _currentOverlayState &&
        _prevMapLayer === activeMapLayer
      ) {
        // If travel or route preview is active, update only SVG overlays
        // so intro-card CSS animations don't restart on every small change.
        if (this._campTravelAction || this._campRoutePreview) {
          const svgEl2 = document.getElementById("camp-map-svg");
          if (svgEl2) {
            const HR2 = 40;
            const hStep2 = HR2 * 1.5;
            const vStep2 = HR2 * Math.sqrt(3);
            const coords2 = {};
            for (const t of mapState.tiles) {
              coords2[t.id] = {
                x: t.q * hStep2,
                y: (t.r + t.q * 0.5) * vStep2,
              };
            }
            svgEl2
              .querySelectorAll(
                ".camp-map-route-preview-layer, .camp-map-travel-layer",
              )
              .forEach((entry) => entry.remove());
            const activeOv = this._buildTravelOverlaySvg(coords2, mapState);
            const ov =
              activeOv ||
              `${this._buildRoutePreviewOverlaySvg(coords2, mapState)}${this._buildIdleCharacterOverlaySvg(coords2, mapState)}`;
            if (ov) svgEl2.insertAdjacentHTML("beforeend", ov);
          }
        }
        return; // same intro step AND same tile — don't re-render
      }
    }
    container.dataset.prevSelectedTile = _currentSelectedTile;
    container.dataset.prevCharacterTile = _currentCharacterTile;
    container.dataset.prevOverlayState = _currentOverlayState;
    container.dataset.prevMapLayer = activeMapLayer;

    const selected = this.game.getCampMapTileDetails(mapState.selectedTileId);
    if (!selected) {
      container.innerHTML = "";
      return;
    }

    const selectedStateLabel = this.getCampTileStateLabel(selected.state);
    const selectedTerrainLabel =
      selected.terrainLabel || this.getCampTerrainLabel(selected.terrainType);
    const selectedActionCopy = selected.action
      ? this.getGatherActionCopy(selected.action)
      : null;
    const selectedActionProfile = selected.gatherProfile || null;
    const selectedPathData = selected.pathData || null;
    const selectedPathProject = selected.pathProject || null;
    const selectedBuildingCopy = selected.nextBuilding
      ? this.getBuildingCopy(selected.nextBuilding)
      : null;
    const selectedPlacedBuildingCopies = (selected.placedBuildings || [])
      .map((entry) => ({
        ...entry,
        copy: this.getBuildingCopy(entry.def),
      }))
      .filter((entry) => !!entry.copy);
    const selectedActionOutput = selectedActionProfile
      ? this.formatResourcePairs(selectedActionProfile.output, {
          plus: true,
        })
      : "";
    const selectedResourceStock = Number.isFinite(selected.resourceRemaining)
      ? `${selected.resourceRemaining}/${selected.resourceCapacity}`
      : "";
    const selectedActionCooldown = selected.action
      ? this.game.getCooldownRemaining(selected.action.id, {
          tileId: selected.id,
        })
      : 0;
    const activeTravel = this._campTravelAction;
    const selectedTravel =
      activeTravel && activeTravel.tileId === selected.id ? activeTravel : null;
    const selectedTravelState = selectedTravel
      ? this._getCampTravelPhaseState(selectedTravel)
      : null;
    const selectedIsCharacterTile =
      this.game.getCharacterTileId?.() === selected.id;
    const selectedRouteOptions = this._getCampRouteOptions(selected.id);
    const selectedRouteChoiceId = this._getActiveCampRouteChoiceId(
      selected.id,
      selectedRouteOptions,
    );
    const selectedRoutePath =
      (selected.distanceFromCamp || 0) > 0
        ? this._getCampTravelPathTo(selected.id, {
            routeId: selectedRouteChoiceId,
          })
        : [];
    const selectedRouteMetrics =
      this._getCampPathTravelMetrics(selectedRoutePath);
    const selectedTravelPlan = selected.action
      ? this._getCampTravelPlan(selected, selectedRouteMetrics)
      : { outboundMs: 0, gatherMs: 0, totalMs: 0 };
    const selectedTravelDurationMs = selectedTravelPlan.totalMs;
    const selectedLogisticsSummary = selected.action
      ? this._getCampLogisticsSummary(
          selected,
          selectedRouteMetrics,
          selectedTravelPlan,
        )
      : null;
    const selectedLogisticsHtml = this._renderCampLogisticsBlock(
      selectedLogisticsSummary,
    );
    const selectedRouteChoiceHtml = this._renderCampRouteChoiceBlock(
      selected,
      selectedRouteOptions,
      selectedRouteChoiceId,
    );
    const selectedRouteChoicePanelHtml = selected.action
      ? ""
      : selectedRouteChoiceHtml;
    const selectedRouteIntelHtml = selected.action
      ? ""
      : this._renderCampRouteIntelBlock(selected, selectedRouteMetrics);
    const selectedRouteLabel =
      this._formatCampRouteMetricLabel(selectedRouteMetrics);
    const selectedRoleMeta = this.getCampTileRoleMeta(selected);
    const selectedCampSiteCheck = this.game.canUseTileAsCampSite?.(
      selected.id,
    ) || { ok: false, reason: "" };
    const selectedResourceChoices =
      this._getCampGatherResourceChoices(selected);
    const selectedHasResourceChoice = selectedResourceChoices.length > 1;
    const selectedResourceInfoItems = this._getCampTileResourceInfoItems(
      selected,
      selectedResourceChoices,
    );
    const selectedResourceStockLabel = selectedResourceStock
      ? selectedHasResourceChoice
        ? `Общий запас участка: ${selectedResourceStock}`
        : `Запас участка: ${selectedResourceStock}`
      : "";
    const taskQueueGate = this.game.getCampTaskQueueGate?.() || {
      unlocked: true,
      insightName: "Путевые метки",
      reason: "",
    };
    const taskQueue = this.game.getCampTaskQueue?.() || [];
    const taskQueueFull = taskQueue.length >= 6;
    const taskQueueAddDisabledReason = !taskQueueGate.unlocked
      ? taskQueueGate.reason
      : taskQueueFull
        ? "Путевой лист заполнен."
        : "";
    const selectedPreviewResourcesHtml = selectedResourceInfoItems.length
      ? `<div class="camp-map-details-preview-resources" aria-label="Ресурсы участка">
          ${selectedResourceInfoItems
            .slice(0, 4)
            .map(
              (item) => `
                <span class="camp-map-preview-resource-chip">
                  <span class="camp-map-preview-resource-icon">${item.icon}</span>
                  <span>${item.name}</span>
                </span>
              `,
            )
            .join("")}
          ${selectedResourceStockLabel ? `<span class="camp-map-preview-resource-stock">${selectedResourceStockLabel}</span>` : ""}
        </div>`
      : "";
    const selectedResourceSummaryHtml = selectedResourceInfoItems.length
      ? `<div class="camp-map-resource-summary" aria-label="Ресурсы участка">
          <div class="camp-map-resource-summary-head">
            <span>Ресурсы участка</span>
            ${selectedResourceStock ? `<strong>${selectedResourceStock}</strong>` : ""}
          </div>
          <div class="camp-map-resource-summary-list">
            ${selectedResourceInfoItems
              .map((item) => {
                const outputLabel = item.output
                  ? this.formatResourcePairs(item.output, { plus: true })
                  : "";
                const stateLabel = selected.terrainSeen
                  ? "осмотрено, сбор пока не открыт"
                  : selected.isDepleted
                    ? "участок исчерпан"
                    : item.canGather === false
                      ? "сбор сейчас недоступен"
                      : outputLabel
                        ? `за выход ${outputLabel}`
                        : "есть на участке";
                return `<span class="camp-map-resource-summary-item">
                  <span class="camp-map-resource-summary-icon">${item.icon}</span>
                  <span><b>${item.name}</b><em>${stateLabel}</em></span>
                </span>`;
              })
              .join("")}
          </div>
          ${selectedResourceStockLabel ? `<div class="camp-map-resource-summary-note">${selectedResourceStockLabel}</div>` : ""}
        </div>`
      : "";
    const selectedJournalHtml = this._renderCampTileJournalBlock(selected);
    const selectedExpansionHtml = this._renderCampExpansionBlock(
      selected,
      mapState,
    );
    const selectedHasGatherAction = !!(selected.action && selectedActionCopy);
    const selectedCanFoundBeforeCamp =
      !mapState.campSetupDone && selectedCampSiteCheck.ok;
    const selectedMoveDurationMs =
      !selectedHasGatherAction && selectedRoutePath.length > 1
        ? this._getCampRouteWalkDurationMs(selectedRouteMetrics, {
            setupMs: 280,
            minMs: 850,
            maxMs: 180000,
            extraCoef: 1.02,
          })
        : 0;
    const selectedCanMoveHere =
      !activeTravel &&
      !selectedIsCharacterTile &&
      !selectedHasGatherAction &&
      !selected.terrainSeen &&
      selectedRoutePath.length > 1;

    let detailsActionBlock = "";
    if (selected.construction) {
      detailsActionBlock = `
        <div class="camp-map-note is-progress">
          Строится: ${selected.construction.icon} ${selected.construction.name}
          · ${this.formatSeconds(selected.construction.remainingMs)}
        </div>
      `;
    } else if (
      selected.state !== "camp" &&
      selectedPlacedBuildingCopies.length > 0
    ) {
      detailsActionBlock = `
        <div class="camp-map-note is-built">
          Участок учтён в устройстве лагеря, но на локальной карте остаётся природным гексом.
        </div>
      `;
    } else if (
      selectedCanFoundBeforeCamp &&
      !selectedHasGatherAction &&
      !selected.terrainSeen
    ) {
      const moveDisabledReason = activeTravel
        ? "Персонаж уже занят другим выходом."
        : selectedIsCharacterTile
          ? "Персонаж уже стоит на этом участке."
          : selectedRoutePath.length > 1
            ? ""
            : "Сначала нужно наметить путь к этому месту.";
      const moveDisabled = !!moveDisabledReason;
      detailsActionBlock = `
        <div class="camp-map-action-meta">
          <span>Тип места: ${selectedTerrainLabel}</span>
          <span>${selected.campCandidateHint || "Этот участок подходит для стоянки, но сначала к нему можно просто выйти и осмотреться на месте."}</span>
          <span>Маршрут: ${selectedRouteLabel}</span>
          <span>Переход: ${selectedMoveDurationMs ? this._formatCampRouteTimeLabel(selectedMoveDurationMs, selectedRouteMetrics) : "на месте"}</span>
          ${(selected.distanceFromCamp || 0) > 0 ? `<span>Тропа: ${selected.pathData?.icon || "·"} ${selected.pathData?.label || "Без тропы"}</span>` : ""}
          ${selectedCampSiteCheck.recommended ? `<span>Это удобное место для стоянки, но лагерь остаётся отдельным решением.</span>` : `<span>Лагерь можно поставить на любом открытом подходящем участке, не теряя остальных действий на карте.</span>`}
        </div>
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn${moveDisabled ? " disabled" : ""}"
          type="button"
          data-camp-move="true"
          ${moveDisabled ? "disabled" : ""}
          aria-disabled="${moveDisabled ? "true" : "false"}"
        >
          ${selectedIsCharacterTile ? "🚶 Вы уже на участке" : "🚶 Идти сюда"}
        </button>
        <button
          id="camp-map-found-action"
          class="camp-map-secondary-btn"
          type="button"
          aria-disabled="false"
        >
          🏕️ Поставить лагерь здесь
        </button>
        <div class="camp-map-note">Основание лагеря остаётся отдельной опцией и не заменяет обычный переход на участок.</div>
        ${
          moveDisabledReason
            ? `<div class="camp-map-note is-waiting">${moveDisabledReason}</div>`
            : ""
        }
      `;
    } else if (selected.state === "camp") {
      const characterAtCamp = this.game.isCharacterAtCamp?.() ?? true;
      const enteredLabel = this.game.isCampEntered()
        ? "Вернуться в лагерь"
        : characterAtCamp
          ? "Войти в лагерь"
          : "Вернуться к стоянке";
      const campRestProfile = this.game.getCharacterRestProfile();
      const campRestEnergy =
        campRestProfile.energyGain +
        (campRestProfile.willUseWater
          ? campRestProfile.waterBonusEnergy || 0
          : 0);
      const campRestSatiety =
        campRestProfile.satietyGain +
        (campRestProfile.willUseFood
          ? campRestProfile.foodBonusSatiety || 0
          : 0);
      const campRestHydration = campRestProfile.willUseWater
        ? campRestProfile.hydrationGain || 0
        : 0;
      const campRestLabel = campRestProfile.canRest
        ? `🛌 ${campRestProfile.label} · ⚡ +${campRestEnergy} · 🍖 +${this.formatNumber(campRestSatiety, 1)} · 💧 +${this.formatNumber(campRestHydration, 1)}`
        : campRestProfile.remainingMs > 0
          ? `🛌 Передышка через ${this.formatCooldownMs(campRestProfile.remainingMs)}`
          : "🛌 Передышка не нужна";
      detailsActionBlock = `
        <div class="camp-map-action-meta">
          <span>Центр вашей стоянки.</span>
          <span>${
            characterAtCamp
              ? "Здесь можно заняться внутренним устройством лагеря."
              : "Персонаж сейчас в выходе. Сначала нужно вернуться к стоянке, а уже потом переходить к лагерным делам."
          }</span>
        </div>
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn"
          type="button"
          aria-disabled="false"
        >
          🏕️ ${enteredLabel}
        </button>
        <button
          id="camp-map-rest-action"
          class="camp-map-secondary-btn${campRestProfile.canRest ? "" : " disabled"}"
          type="button"
          ${campRestProfile.canRest ? "" : "disabled"}
          aria-disabled="${campRestProfile.canRest ? "false" : "true"}"
        >
          ${campRestLabel}
        </button>
        <div class="camp-map-note">${campRestProfile.blockedReason || campRestProfile.note}</div>
      `;
    } else if (selectedHasGatherAction) {
      const travelingOtherTile = activeTravel && !selectedTravel;
      const gatherDisabled =
        selectedHasResourceChoice || !selected.canGather || !!activeTravel;
      const gatherBtnLabel = selectedTravelState
        ? `🧍 ${selectedTravelState.phaseLabel}`
        : travelingOtherTile
          ? "🧍 Персонаж уже в выходе"
          : selectedHasResourceChoice
            ? "Выберите ресурс ниже"
            : selectedIsCharacterTile
              ? `${selectedActionCopy.icon} Собрать здесь`
              : `${selectedActionCopy.icon} ${selectedActionCopy.name}`;
      const gatherDisabledReason =
        gatherDisabled &&
        !selectedHasResourceChoice &&
        !selectedTravelState &&
        !travelingOtherTile &&
        selectedActionCooldown <= 0 &&
        !selectedActionProfile?.blockedReason
          ? this._getCampGatherDisabledReason(selected)
          : "";
      const singleQueueDisabledReason = selectedHasResourceChoice
        ? ""
        : taskQueueAddDisabledReason ||
          (!selected.canGather
            ? this._getCampGatherDisabledReason(selected)
            : "");
      const singleQueueDisabled = !!singleQueueDisabledReason;
      const singleQueueLabel = taskQueueGate.unlocked
        ? "➕ В путевой лист"
        : `🔒 ${taskQueueGate.insightName}`;
      const resourceChoiceHtml = selectedHasResourceChoice
        ? `<div class="camp-map-resource-choice" aria-label="Выбор ресурса для сбора">
            <div class="camp-map-resource-choice-title">Что собрать в этот ход</div>
            <div class="camp-map-resource-choice-grid">
              ${selectedResourceChoices
                .map((choice) => {
                  const choiceDetails = choice.details;
                  const choiceProfile = choice.profile || null;
                  const choicePlan = choiceProfile
                    ? this._getCampTravelPlan(
                        choiceDetails,
                        selectedRouteMetrics,
                      )
                    : { totalMs: 0 };
                  const choiceCooldown =
                    this.game.getCooldownRemaining?.(choice.actionId, {
                      tileId: selected.id,
                    }) || 0;
                  const choiceDisabled =
                    !choice.canGather || !!activeTravel || choiceCooldown > 0;
                  const choiceReason =
                    choiceCooldown > 0
                      ? `Нужно подождать ещё ${this.formatCooldownMs(choiceCooldown)}.`
                      : choice.disabledReason || "";
                  const choiceQueueDisabledReason =
                    taskQueueAddDisabledReason ||
                    (!choice.canGather ? choice.disabledReason : "");
                  const choiceQueueDisabled = !!choiceQueueDisabledReason;
                  return `
                    <div class="camp-map-resource-choice-row">
                      <button
                        class="camp-map-resource-choice-btn${choiceDisabled ? " disabled" : ""}"
                        type="button"
                        data-resource-id="${choice.id}"
                        data-action-id="${choice.actionId}"
                        ${choiceDisabled ? "disabled" : ""}
                        aria-disabled="${choiceDisabled ? "true" : "false"}"
                      >
                        <span class="camp-map-resource-choice-icon">${choice.icon}</span>
                        <span class="camp-map-resource-choice-copy">
                          <strong>${choice.name}</strong>
                          <small>${this.formatResourcePairs(choice.output, { plus: true })} · ⚡ -${this.formatNumber(choiceProfile?.energyCost ?? selected.action.energyCost, 2)} · ⏱ ${this._formatCampRouteTimeLabel(choicePlan.totalMs, selectedRouteMetrics)}</small>
                          ${choiceReason ? `<em>${choiceReason}</em>` : ""}
                        </span>
                      </button>
                      <button
                        class="camp-map-resource-queue-btn${choiceQueueDisabled ? " disabled" : ""}"
                        type="button"
                        data-camp-queue-add="true"
                        data-tile-id="${selected.id}"
                        data-resource-id="${choice.id}"
                        data-action-id="${choice.actionId}"
                        data-route-id="${selectedRouteChoiceId}"
                        ${choiceQueueDisabled ? "disabled" : ""}
                        aria-disabled="${choiceQueueDisabled ? "true" : "false"}"
                        title="${choiceQueueDisabledReason || "Добавить пункт в путевой лист"}"
                      >${taskQueueGate.unlocked ? "В лист" : "Закрыто"}</button>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>`
        : "";

      detailsActionBlock = `
        ${selectedLogisticsHtml}
        ${selectedRouteChoiceHtml}
        <div class="camp-map-action-meta">
          <span>${selectedHasResourceChoice ? "На участке есть несколько видов добычи." : `Находка: ${selectedActionOutput}`}</span>
          <span>Энергия: -${selectedActionProfile?.energyCost ?? selected.action.energyCost}</span>
          ${Number.isFinite(selectedActionProfile?.satietyCost) ? `<span>Сытость: -${this.formatNumber(selectedActionProfile.satietyCost, 2)}</span>` : ""}
          ${Number.isFinite(selectedActionProfile?.hydrationCost) ? `<span>Вода: -${this.formatNumber(selectedActionProfile.hydrationCost, 2)}</span>` : ""}
          <span>Путь: ${selectedActionProfile?.zoneLabel || (selected.distanceFromCamp === 0 ? "центр" : selected.distanceFromCamp === 1 ? "ближняя зона" : "дальний выход")}</span>
          <span>Маршрут: ${selectedRouteLabel}</span>
          <span>Местность: ${selectedActionProfile?.terrainLabel || "обычный участок"}</span>
          <span>Время сбора: ${this.formatSeconds(selected.action.cooldown || 0)}</span>
          <span>Ходьба: ${this._formatCampRouteTimeLabel(selectedTravelPlan.outboundMs, selectedRouteMetrics)} · сбор ${this.formatSeconds(selectedTravelPlan.gatherMs)}</span>
          <span>Логистика: ${this._formatCampRouteTimeLabel(selectedTravelDurationMs, selectedRouteMetrics)} (путь + сбор)</span>
          ${(selected.distanceFromCamp || 0) > 0 ? `<span>Тропа: ${selected.pathData?.icon || "·"} ${selected.pathData?.label || "Без тропы"}</span>` : ""}
          ${(selected.distanceFromCamp || 0) > 0 && selectedActionProfile?.effortLabel ? `<span>Усилие: ${selectedActionProfile.effortLabel}</span>` : ""}
          <span>Нагрузка: ${this.formatNumber(selectedActionProfile?.load || 0)} / ${this.formatNumber(selectedActionProfile?.carryCapacity || this.game.getCharacterCarryCapacity())}</span>
          ${selectedActionProfile?.deliveryTrips > 1 ? `<span>Доставка: ${selectedActionProfile.deliveryTrips} ходки · Σ ${this.formatNumber(selectedActionProfile.totalLoad || 0)}</span>` : ""}
        </div>
        ${
          selectedActionProfile?.blockedReason
            ? `<div class="camp-map-note is-empty">${selectedActionProfile.blockedReason}</div>`
            : ""
        }
        ${
          selectedTravelState
            ? `<div class="camp-map-note is-waiting">${selectedTravelState.phaseLabel}. До завершения выхода: ${this.formatCooldownMs(selectedTravelState.totalRemainingMs)}.</div>`
            : ""
        }
        ${
          travelingOtherTile
            ? `<div class="camp-map-note is-waiting">Персонаж занят на другом участке. Дождитесь завершения текущего выхода.</div>`
            : ""
        }
        ${
          !selectedHasResourceChoice && selectedActionCooldown > 0
            ? `<div class="camp-map-note is-waiting">Нужно подождать ещё ${this.formatCooldownMs(selectedActionCooldown)}.</div>`
            : ""
        }
        ${
          selectedActionProfile?.limitedByCarry
            ? `<div class="camp-map-note is-waiting">Персонаж не может унести весь выход за один раз: часть добычи ограничена переносимостью.</div>`
            : ""
        }
        ${
          gatherDisabledReason
            ? `<div class="camp-map-note is-empty">${gatherDisabledReason}</div>`
            : ""
        }
        ${resourceChoiceHtml}
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn${gatherDisabled ? " disabled" : ""}"
          type="button"
          ${gatherDisabled ? "disabled" : ""}
          aria-disabled="${gatherDisabled ? "true" : "false"}"
        >
          ${gatherBtnLabel}
        </button>
        ${
          selectedCanFoundBeforeCamp
            ? `<button
                id="camp-map-found-action"
                class="camp-map-secondary-btn"
                type="button"
                aria-disabled="false"
              >
                🏕️ Поставить лагерь здесь
              </button>
              <div class="camp-map-note">Этот ресурсный участок тоже подходит для лагеря. Если закрепиться здесь, сбор на месте останется доступен.</div>`
            : ""
        }
        ${
          !selectedHasResourceChoice
            ? `<button
                class="camp-map-secondary-btn${singleQueueDisabled ? " disabled" : ""}"
                type="button"
                data-camp-queue-add="true"
                data-tile-id="${selected.id}"
                data-action-id="${selected.action?.id || ""}"
                data-route-id="${selectedRouteChoiceId}"
                ${singleQueueDisabled ? "disabled" : ""}
                aria-disabled="${singleQueueDisabled ? "true" : "false"}"
              >${singleQueueLabel}</button>`
            : ""
        }
        ${
          !selectedHasResourceChoice && singleQueueDisabledReason
            ? `<div class="camp-map-note is-waiting">${singleQueueDisabledReason}</div>`
            : ""
        }
      `;
      if (selectedResourceStock) {
        detailsActionBlock += `<div class="camp-map-note">${selectedResourceStockLabel}</div>`;
      }
      if (selectedActionProfile?.warnings?.length) {
        detailsActionBlock += selectedActionProfile.warnings
          .map((warning) => `<div class="camp-map-note">${warning}</div>`)
          .join("");
      }
      if (selected.isDepleted) {
        detailsActionBlock += `<div class="camp-map-note is-empty">Этот участок уже вычищен. Полезного сырья здесь пока не осталось.</div>`;
      }
    } else if (selected.nextBuilding && selectedBuildingCopy) {
      const selectedBuildProfile = this.game.getBuildProfile(
        selected.nextBuildId,
        selected.id,
      );
      const missingInsights = (
        selected.nextBuilding.requiresInsights || []
      ).filter((insightId) => !this.game.insights[insightId]);
      const blockedByTech =
        selected.nextBuilding.unlockedBy &&
        !this.game.researched[selected.nextBuilding.unlockedBy];
      const blockedByBuilding =
        selected.nextBuilding.requires &&
        !this.game.buildings[selected.nextBuilding.requires];
      const blockedByTool =
        (this.game.isEarlyProgressionMode?.() ??
          this.game.isPrologueActive()) &&
        selected.nextBuilding.requiresPrologueTool &&
        (this.game.resources.crude_tools || 0) < 1;
      const buildCost = this.formatResourcePairs(
        this.game.getBuildingCost(selected.nextBuildId),
      );

      let buildBlockerText = "";
      if (missingInsights.length > 0) {
        buildBlockerText = `Нужно озарение: ${missingInsights
          .map(
            (insightId) =>
              this.data.prologue?.insights?.[insightId]?.name || insightId,
          )
          .join(", ")}`;
      } else if (blockedByTool) {
        buildBlockerText = "Сначала нужно грубое орудие.";
      } else if (blockedByTech) {
        buildBlockerText = `Сначала нужно исследование: ${
          this.data.tech[selected.nextBuilding.unlockedBy]?.name ||
          selected.nextBuilding.unlockedBy
        }.`;
      } else if (blockedByBuilding) {
        buildBlockerText = `Сначала нужно здание: ${
          this.data.buildings[selected.nextBuilding.requires]?.name ||
          selected.nextBuilding.requires
        }.`;
      } else if (!selected.canBuild) {
        buildBlockerText = "Пока не хватает ресурсов для строительства.";
      }
      if (selectedBuildProfile?.blockedReason) {
        buildBlockerText = selectedBuildProfile.blockedReason;
      } else if (
        selectedBuildProfile &&
        !this.game.hasEnergy(selectedBuildProfile.energyCost)
      ) {
        buildBlockerText =
          "Не хватает сил, чтобы начать стройку на этом участке.";
      }

      detailsActionBlock = `
        <div class="camp-map-action-meta">
          <span>Место под: ${selectedBuildingCopy.icon} ${selectedBuildingCopy.name}</span>
          <span>Стоимость: ${buildCost}</span>
          <span>Энергия: -${selectedBuildProfile?.energyCost ?? 1}</span>
          ${Number.isFinite(selectedBuildProfile?.satietyCost) ? `<span>Сытость: -${this.formatNumber(selectedBuildProfile.satietyCost, 2)}</span>` : ""}
          ${Number.isFinite(selectedBuildProfile?.hydrationCost) ? `<span>Вода: -${this.formatNumber(selectedBuildProfile.hydrationCost, 2)}</span>` : ""}
          <span>Путь: ${selectedBuildProfile?.zoneLabel || "у стоянки"}</span>
          <span>Местность: ${selectedBuildProfile?.terrainLabel || "обычный участок"}</span>
          ${(selected.distanceFromCamp || 0) > 0 ? `<span>Тропа: ${selected.pathData?.icon || "·"} ${selected.pathData?.label || "Без тропы"}</span>` : ""}
          ${selectedBuildProfile?.deliveryTrips > 1 ? `<span>Поднос: ${selectedBuildProfile.deliveryTrips} ходки · Σ ${this.formatNumber(selectedBuildProfile.totalLoad || 0)}</span>` : Number.isFinite(selectedBuildProfile?.load) ? `<span>Поднос: ${this.formatNumber(selectedBuildProfile.load)} / ${this.formatNumber(selectedBuildProfile.carryCapacity || this.game.getCharacterCarryCapacity())}</span>` : ""}
          <span>Стройка: ${this.formatSeconds(
            this.game.getBuildDuration(selected.nextBuildId),
          )}</span>
        </div>
        ${
          buildBlockerText
            ? `<div class="camp-map-note is-waiting">${buildBlockerText}</div>`
            : ""
        }
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn${selected.canBuild ? "" : " disabled"}"
          type="button"
          ${selected.canBuild ? "" : "disabled"}
          aria-disabled="${selected.canBuild ? "false" : "true"}"
        >
          ${selectedBuildingCopy.icon} ${selectedBuildingCopy.name}
        </button>
        ${
          selectedCanMoveHere
            ? `<button
                id="camp-map-move-action"
                class="camp-map-secondary-btn"
                type="button"
                aria-disabled="false"
              >
                🚶 Идти сюда
              </button>
              <div class="camp-map-note">Переход на участок остаётся отдельным действием и не заменяется стройкой.</div>`
            : ""
        }
      `;
      if (selectedBuildProfile?.warnings?.length) {
        detailsActionBlock += selectedBuildProfile.warnings
          .map((warning) => `<div class="camp-map-note">${warning}</div>`)
          .join("");
      }
    } else if (!mapState.campSetupDone && selectedCampSiteCheck.reason) {
      detailsActionBlock = `
        <div class="camp-map-note">
          ${selectedCampSiteCheck.reason}
        </div>
      `;
    } else if (selected.terrainSeen) {
      const terrainSeenHint =
        this.game.getCampTileUnlockHint?.(selected.id) ||
        "Местность осмотрена, но её практический смысл ещё не ясен.";
      detailsActionBlock = `
        <div class="camp-map-note is-waiting">
          ${terrainSeenHint}
        </div>
      `;
    } else {
      detailsActionBlock = `
        <div class="camp-map-note">
          Этот участок пока важен как часть местности. Позже он может дать новую опору лагерю.
        </div>
      `;
    }

    // ── Trail improvement section — all non-camp tiles that aren't under active construction ──
    if (
      (selected.distanceFromCamp || 0) > 0 &&
      !selected.construction &&
      selectedPathProject
    ) {
      const pathLevel = selected.pathLevel || "none";
      if (pathLevel !== "none") {
        detailsActionBlock += `<div class="camp-map-note is-built">🥾 ${selected.pathData.icon} ${selected.pathData.label}: путь к участку уже проложен.</div>`;
      } else if (selectedPathProject.canImprove) {
        const trailCostStr = this.formatResourcePairs(selectedPathProject.cost);
        const pathUse = selectedPathProject.pathUseProgress || null;
        const pathUseHtml =
          pathUse && pathUse.threshold > 0
            ? `<div class="camp-map-path-progress">
                <div class="camp-map-path-progress-row">
                  <span>След от проходов</span>
                  <strong>${this.formatNumber(pathUse.uses, 1)}/${pathUse.threshold}</strong>
                </div>
                <div class="camp-map-path-progress-bar"><span style="width:${Math.round(pathUse.ratio * 100)}%"></span></div>
              </div>`
            : "";
        detailsActionBlock += `
          <div class="camp-map-note is-progress">
            Логистика пути: ${selectedPathProject.deliveryTrips > 1 ? `${selectedPathProject.deliveryTrips} ходки · Σ ${this.formatNumber(selectedPathProject.totalLoad || 0)}` : `${this.formatNumber(selectedPathProject.load || 0)} / ${this.formatNumber(selectedPathProject.carryCapacity || this.game.getCharacterCarryCapacity())}`}
            ${pathUse?.uses > 0 ? `<br>Повторные выходы уже натоптали ${this.formatNumber(pathUse.uses, 1)} из ${pathUse.threshold}.` : ""}
          </div>
          ${pathUseHtml}
          <button id="camp-map-trail-action" class="camp-map-secondary-btn" type="button">
            🥾 Натоптать тропу · ${trailCostStr} · ⚡-${selectedPathProject.energyCost} · 🍖-${this.formatNumber(selectedPathProject.satietyCost || 0, 2)} · 💧-${this.formatNumber(selectedPathProject.hydrationCost || 0, 2)}
          </button>
        `;
      } else if (selectedPathProject.blockedReason) {
        detailsActionBlock += `<div class="camp-map-note">${selectedPathProject.blockedReason}</div>`;
      }
    }

    if (selected.state === "camp" && mapState.campSetupDone) {
      detailsActionBlock += `
        <button class="camp-map-primary-btn disabled" type="button" disabled style="opacity:0.5; cursor:default;" aria-disabled="true">
          🏕️ Карта местности лагеря
        </button>
        <div class="camp-map-note" style="margin-top:0.3rem; opacity:0.65; font-style:italic;">
          Подробная карта лагеря с постройками появится в будущих версиях.
        </div>
      `;
    }

    // ── Intro overlay (pre-camp narrative) ──
    const introStepData = mapState.introStep;
    let introOverlayHtml = "";
    if (!mapState.campSetupDone && introStepData) {
      const isLastStep =
        introStepData.index ===
        this.game.getCampFoundingIntroSteps().length - 1;
      // "choose" step: only a slim banner — don't obstruct the map tiles
      if (isLastStep) {
        introOverlayHtml = `
          <div class="camp-intro-overlay camp-intro-overlay--banner" data-intro-step="${introStepData.id}">
            <div class="camp-intro-banner">
              <span class="camp-intro-banner-icon">${introStepData.icon || "🏕️"}</span>
              <span class="camp-intro-banner-text">${introStepData.title}</span>
              <span class="camp-intro-banner-cta">${introStepData.cta}</span>
            </div>
          </div>
        `;
      } else {
        const showNextBtn =
          introStepData.advanceMode === "click" ||
          introStepData.advanceMode === "hover-candidate";
        introOverlayHtml = `
          <div class="camp-intro-overlay" data-intro-step="${introStepData.id}">
            <div class="camp-intro-card">
              <div class="camp-intro-icon">${introStepData.icon || "▶"}</div>
              <div class="camp-intro-title">${introStepData.title || ""}</div>
              <div class="camp-intro-text">${introStepData.text || ""}</div>
              <div class="camp-intro-cta">${introStepData.cta || ""}</div>
              <div class="camp-intro-buttons">
                ${
                  showNextBtn
                    ? `<button type="button" id="camp-intro-next" class="camp-intro-next">Далее</button>`
                    : ""
                }
                <button type="button" id="camp-intro-skip" class="camp-intro-skip">
                  ${this.game.data.campFoundingIntro?.skipLabel || "Пропустить вступление"}
                </button>
              </div>
            </div>
          </div>
        `;
      }
    }

    const selectedDisplayIcon = this.getCampTileDisplayIcon(
      selected,
      selected.icon || "•",
    );
    const selectedImageHref = this.getCampTileImageHref(selected);
    const selectedPreviewImageKind =
      selected.state === "camp" ? "is-icon" : "is-terrain";
    const selectedPreviewMedia = selectedImageHref
      ? `<img class="camp-map-details-preview-image ${selectedPreviewImageKind}" src="${selectedImageHref}" alt="" aria-hidden="true">`
      : `<span>${selectedDisplayIcon}</span>`;
    const selectedDistanceLabel =
      selected.distanceFromCamp === 0
        ? mapState.campSetupDone
          ? "Лагерь"
          : "Ночёвка"
        : `${selected.distanceFromCamp} переход.`;
    const selectedBuildUsage = selected.buildUsage || null;
    const selectedBuildUsageHtml =
      selected.state === "camp" &&
      selectedBuildUsage &&
      selectedBuildUsage.capacity > 0
        ? `<div class="camp-map-build-capacity">
            <div class="camp-map-build-capacity-row">
              <span>Вместимость участка</span>
              <strong>${selectedBuildUsage.used}/${selectedBuildUsage.capacity}</strong>
            </div>
            <div class="camp-map-build-capacity-bar">
              <span style="width:${Math.round(Math.min(1, selectedBuildUsage.ratio || 0) * 100)}%"></span>
            </div>
          </div>`
        : "";
    const homeLegendLabel = mapState.campSetupDone ? "Лагерь" : "Ночёвка";
    const layerControlsHtml = this._renderCampMapLayerControls(activeMapLayer);
    const expansion = this.data.localCampMap?.expansion || {};
    const expansionState = mapState.expansionState || {};
    const preparedRadius = Number(
      expansionState.preparedRadius ||
        expansion.preparedRadius ||
        mapState.radius ||
        0,
    );
    const currentRadius = Number(expansionState.radius || mapState.radius || 0);
    const preparedRingLabels = Object.entries(expansion.rings || {})
      .map(([ring, plan]) => ({ ring: Number(ring), plan }))
      .filter(
        (entry) => entry.ring > currentRadius && entry.ring <= preparedRadius,
      )
      .sort((left, right) => left.ring - right.ring)
      .map((entry) => `${entry.ring}: ${entry.plan.label}`);
    const nextGate = expansionState.nextGate || null;
    const expansionHint = nextGate?.missing?.length
      ? `Нужно: ${nextGate.missing.slice(0, 3).join(" · ")}`
      : preparedRingLabels.join(" · ");
    const expansionStatusHtml = preparedRingLabels.length
      ? `<div class="camp-map-expansion-status">
          <span>Данные расширения</span>
          <strong>${currentRadius}/${preparedRadius}</strong>
          <em>${expansionHint}</em>
        </div>`
      : "";
    const surveyStatusHtml =
      activeMapLayer === "survey" ? this._renderCampSurveyStatus(mapState) : "";

    const topLegendItems =
      activeMapLayer === "survey"
        ? [
            `<span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-camp"></span>${homeLegendLabel}</span>`,
            `<span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-here"></span>Вы здесь</span>`,
            `<span class="camp-map-top-legend-item"><i class="survey-dot is-known"></i>Открыто</span>`,
            `<span class="camp-map-top-legend-item"><i class="survey-dot is-seen"></i>Осмотрено</span>`,
            `<span class="camp-map-top-legend-item"><i class="survey-dot is-frontier"></i>Рубеж</span>`,
            `<span class="camp-map-top-legend-item"><i class="survey-dot is-unknown"></i>Неизвестно</span>`,
          ]
        : [
            `<span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-camp"></span>${homeLegendLabel}</span>`,
            `<span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-here"></span>Вы здесь</span>`,
            `<span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-target"></span>Цель</span>`,
            `<span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-trail"></span>Тропы</span>`,
            `<span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-open"></span>Доступно</span>`,
            `<span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-locked"></span>Неизвестно</span>`,
          ];
    const sideLegendItems =
      activeMapLayer === "survey"
        ? [
            `<span><span class="map-symbol map-symbol-camp"></span>${homeLegendLabel}</span>`,
            `<span><span class="map-symbol map-symbol-here"></span>Вы здесь</span>`,
            `<span><i class="survey-dot is-known"></i>Открытые участки</span>`,
            `<span><i class="survey-dot is-seen"></i>Осмотрено, но не раскрыто</span>`,
            `<span><i class="survey-dot is-frontier"></i>Рубеж следующего кольца</span>`,
            `<span><i class="survey-dot is-unknown"></i>Туман карты</span>`,
          ]
        : [
            `<span><span class="map-symbol map-symbol-camp"></span>${homeLegendLabel}</span>`,
            `<span><span class="map-symbol map-symbol-here"></span>Вы здесь</span>`,
            `<span><span class="map-symbol map-symbol-target"></span>Цель маршрута</span>`,
            `<span><span class="map-symbol map-symbol-trail"></span>Тропа</span>`,
            `<span><span class="map-symbol map-symbol-open"></span>Природный участок</span>`,
            `<span><span class="map-symbol map-symbol-locked"></span>Неизвестно</span>`,
          ];

    const topLegendHtml = `
      <div class="camp-map-top-legend" aria-label="Легенда карты">
        ${topLegendItems.join("")}
      </div>
    `;

    const sideLegendHtml = `
      <aside class="camp-map-side-legend" aria-label="Типы участков карты">
        <div class="camp-map-side-title">${activeMapLayer === "survey" ? "Разведка" : "Легенда"}</div>
        <div class="camp-map-side-list">
          ${sideLegendItems.join("")}
        </div>
        ${expansionStatusHtml}
        ${surveyStatusHtml}
        <div class="camp-map-tip-card">Серые клетки неизвестны. Клик показывает путь, двойной клик отправляет персонажа на разведку.</div>
      </aside>
    `;

    const baseMapFooterHint = mapState.campSetupDone
      ? `${mapState.interactionHint} Клик по участку показывает маршрут; двойной клик отправляет персонажа.`
      : "Сначала выберите место стоянки. Открытые клетки показывают первые находки, а тёмные зоны станут понятнее после основания лагеря.";
    const expeditionSummary = this._getCampExpeditionSummary();
    const expeditionHtml = this._renderCampExpeditionBlock(expeditionSummary);
    const taskQueueHtml = this._renderCampTaskQueueBlock();

    const quickTile = selected.action ? selected : null;
    const routePreview = !activeTravel ? this._campRoutePreview || null : null;
    const routePreviewCanExplore =
      routePreview?.tileId &&
      routePreview.kind === "explore" &&
      (this.game.canExploreCampTile?.(routePreview.tileId) || false);
    const routePreviewCanMove =
      routePreview?.tileId && routePreview.kind === "inspect";
    let mapQuickActionHtml = "";
    if (routePreviewCanExplore || routePreviewCanMove) {
      const routeSteps = Math.max(1, (routePreview.path?.length || 1) - 1);
      const routeMetrics = this._getCampPathTravelMetrics(routePreview.path);
      const routeWalkMs = this._getCampRouteWalkDurationMs(routeMetrics, {
        setupMs: 280,
        minMs: routePreviewCanExplore ? 900 : 850,
        maxMs: 180000,
        extraCoef: routePreviewCanExplore ? 1.05 : 1.02,
      });
      const routeDistanceLabel = routeMetrics.distanceMeters
        ? ` · ${routeMetrics.distanceMeters} м`
        : "";
      const routeApproxLabel = routeMetrics.isApproximate ? "примерно " : "";
      const routeClarification = routeMetrics.isApproximate
        ? " Время уточнится по мере разведки."
        : "";
      const routeInlineMeta = `${this._formatCampRouteTimeLabel(routeWalkMs, routeMetrics)} · ${routeApproxLabel}${routeSteps} ${routeSteps === 1 ? "переход" : "перехода"}${routeDistanceLabel}`;
      mapQuickActionHtml = `
        <div class="camp-map-quick-action is-route-preview">
          <button
            id="camp-map-route-command"
            class="camp-map-quick-action-btn"
            type="button"
            data-tile-id="${routePreview.tileId}"
            data-route-kind="${routePreview.kind}"
            aria-disabled="false"
          >
            <span class="camp-map-quick-action-copy">${routePreviewCanExplore ? "🧭 Отправить на разведку" : "🚶 Идти сюда"}</span>
            <span class="camp-map-quick-action-inline-meta">${routeInlineMeta}</span>
          </button>
          <div class="camp-map-quick-action-meta">Маршрут: ${routeApproxLabel}${routeSteps} ${routeSteps === 1 ? "переход" : "перехода"}${routeDistanceLabel} · ${this._formatCampRouteTimeLabel(routeWalkMs, routeMetrics)}. ${routeMetrics.terrainSummary || "Местность без особых помех"}.${routeClarification} ${routePreviewCanExplore ? "Персонаж останется на месте осмотра." : "Персонаж просто перейдёт на участок и останется там."}</div>
        </div>
      `;
    } else if (quickTile?.action) {
      const quickActionCopy = this.getGatherActionCopy(quickTile.action);
      const quickActionProfile = quickTile.gatherProfile || null;
      const quickResourceChoices =
        this._getCampGatherResourceChoices(quickTile);
      const quickNeedsResourceChoice = quickResourceChoices.length > 1;
      const quickOutput = quickActionProfile
        ? this.formatResourcePairs(quickActionProfile.output, { plus: true })
        : "";
      const quickResourceStock = Number.isFinite(quickTile.resourceRemaining)
        ? `${quickTile.resourceRemaining}/${quickTile.resourceCapacity}`
        : "";
      const quickTravel =
        activeTravel && activeTravel.tileId === quickTile.id
          ? activeTravel
          : null;
      const quickTravelState = quickTravel
        ? this._getCampTravelPhaseState(quickTravel)
        : null;
      const quickIsCharacterTile =
        this.game.getCharacterTileId?.() === quickTile.id;
      const quickDisabled = !quickTile.canGather || !!activeTravel;
      const quickRoutePath = this._getCampTravelPathTo(quickTile.id, {
        routeId: this.game.getCampRouteChoice?.(quickTile.id) || "",
      });
      const quickRouteMetrics = this._getCampPathTravelMetrics(quickRoutePath);
      const quickTravelPlan = this._getCampTravelPlan(
        quickTile,
        quickRouteMetrics,
      );
      const quickDisabledReason =
        quickDisabled && !quickTravelState && !activeTravel
          ? this._getCampGatherDisabledReason(quickTile)
          : "";
      const quickChoiceButtonsHtml = quickNeedsResourceChoice
        ? `<div class="camp-map-quick-choice-grid">
            ${quickResourceChoices
              .map((choice) => {
                const choiceDisabled = !choice.canGather || !!activeTravel;
                const choicePlan = choice.profile
                  ? this._getCampTravelPlan(choice.details, quickRouteMetrics)
                  : { totalMs: quickTravelPlan.totalMs };
                return `
                  <button
                    class="camp-map-quick-choice-btn${choiceDisabled ? " disabled" : ""}"
                    type="button"
                    data-camp-quick-choice="gather"
                    data-tile-id="${quickTile.id}"
                    data-resource-id="${choice.id}"
                    data-action-id="${choice.actionId || quickTile.actionId || quickTile.action?.id || ""}"
                    ${choiceDisabled ? "disabled" : ""}
                    aria-disabled="${choiceDisabled ? "true" : "false"}"
                  >
                    <span class="camp-map-quick-choice-copy">
                      <strong>${choice.icon} ${choice.name}</strong>
                      <small>${this.formatResourcePairs(choice.output, { plus: true })} · ⏱ ${quickIsCharacterTile ? "на месте" : this._formatCampRouteTimeLabel(choicePlan.totalMs, quickRouteMetrics)}</small>
                    </span>
                  </button>
                `;
              })
              .join("")}
          </div>`
        : "";
      const quickLabel = selectedTravelState
        ? `🧭 ${selectedTravelState.phaseLabel}`
        : quickTravelState
          ? `🧭 ${quickTravelState.phaseLabel}`
          : activeTravel
            ? "🧭 Персонаж уже занят"
            : quickIsCharacterTile
              ? `${quickActionCopy.icon} Собрать здесь`
              : `${quickActionCopy.icon} Собрать ресурсы`;
      const quickInlineMeta = selectedTravelState
        ? `⏱ ${this.formatCooldownMs(selectedTravelState.totalRemainingMs)}`
        : quickTravelState
          ? `⏱ ${this.formatCooldownMs(quickTravelState.totalRemainingMs)}`
          : activeTravel
            ? "Действие недоступно"
            : `⏱ ${this._formatCampRouteTimeLabel(quickTravelPlan.totalMs, quickRouteMetrics)} · ${Math.max(0, Number(quickRouteMetrics.hexCount || 0)) || "на месте"}${Number(quickRouteMetrics?.hexCount || 0) > 0 ? ` ${quickRouteMetrics.hexCount === 1 ? "гекс" : quickRouteMetrics.hexCount >= 2 && quickRouteMetrics.hexCount <= 4 ? "гекса" : "гексов"}` : ""}`;
      const quickMeta = quickActionProfile
        ? quickNeedsResourceChoice
          ? [
              selected.action ? "" : `Участок: ${quickTile.name}`,
              `Доступно: ${quickResourceChoices.map((choice) => choice.name).join(", ")}`,
              quickIsCharacterTile
                ? "Можно собирать прямо отсюда: выберите нужный ресурс кнопкой ниже или над гексом."
                : "Выберите конкретный ресурс, чтобы сразу отправить выход на нужную добычу.",
              quickResourceStock ? `Запас: ${quickResourceStock}` : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : [
              selected.action ? "" : `Участок: ${quickTile.name}`,
              quickOutput ? `Находка: ${quickOutput}` : "",
              `⚡ -${this.formatNumber(quickActionProfile.energyCost ?? quickTile.action.energyCost, 2)}`,
              Number.isFinite(quickActionProfile.satietyCost)
                ? `🍖 -${this.formatNumber(quickActionProfile.satietyCost, 2)}`
                : "",
              Number.isFinite(quickActionProfile.hydrationCost)
                ? `💧 -${this.formatNumber(quickActionProfile.hydrationCost, 2)}`
                : "",
              `⏱ ${this._formatCampRouteTimeLabel(quickTravelPlan.totalMs, quickRouteMetrics)}`,
              this._formatCampRouteMetricLabel(quickRouteMetrics),
              quickResourceStock ? `Запас: ${quickResourceStock}` : "",
              quickDisabledReason,
            ]
              .filter(Boolean)
              .join(" · ")
        : "Выбранный участок можно собрать с карты.";
      mapQuickActionHtml = `
        <div class="camp-map-quick-action${quickDisabled ? " is-disabled" : ""}">
          ${
            quickNeedsResourceChoice
              ? `<div class="camp-map-quick-action-head">${quickIsCharacterTile ? "Выберите ресурс и соберите здесь" : "Выберите ресурс для выхода"}</div>
                 ${quickChoiceButtonsHtml}`
              : `<button
                   id="camp-map-quick-gather-action"
                   class="camp-map-quick-action-btn"
                   type="button"
                   data-tile-id="${quickTile.id}"
                   data-resource-id="${quickResourceChoices[0]?.id || ""}"
                   data-action-id="${quickResourceChoices[0]?.actionId || quickTile.actionId || quickTile.action?.id || ""}"
                   ${quickDisabled ? "disabled" : ""}
                   aria-disabled="${quickDisabled ? "true" : "false"}"
                 >
                   <span class="camp-map-quick-action-copy">${quickLabel}</span>
                   <span class="camp-map-quick-action-inline-meta">${quickInlineMeta}</span>
                 </button>`
          }
          <div class="camp-map-quick-action-meta">${quickMeta}</div>
        </div>
      `;
    }

    let mapFooterHint = baseMapFooterHint;
    const selectedCanExploreNow =
      activeMapLayer === "survey" &&
      typeof this.game.canExploreCampTile === "function" &&
      this.game.canExploreCampTile(selected.id);
    if (routePreview?.path?.length > 1) {
      const footerRouteTile =
        mapState.tiles.find((tile) => tile.id === routePreview.tileId) ||
        selected;
      const footerRouteMetrics = this._getCampPathTravelMetrics(
        routePreview.path,
      );
      const footerRouteWalkMs =
        routePreview.kind === "explore"
          ? this._getCampRouteWalkDurationMs(footerRouteMetrics, {
              setupMs: 280,
              minMs: 900,
              maxMs: 180000,
              extraCoef: 1.05,
            })
          : this._getCampTravelPlan(footerRouteTile, footerRouteMetrics)
              .totalMs;
      const footerActionLabel =
        routePreview.kind === "explore"
          ? "Разведка"
          : footerRouteTile.action
            ? "Сбор"
            : "Путь";
      mapFooterHint = `${baseMapFooterHint} Сейчас: ${footerActionLabel} до ${footerRouteTile.name || "участка"} · ⏱ ${this._formatCampRouteTimeLabel(footerRouteWalkMs, footerRouteMetrics)} · ${this._formatCampRouteMetricLabel(footerRouteMetrics)}.`;
    } else if (quickTile?.action && !activeTravel) {
      const footerQuickRoutePath = this._getCampTravelPathTo(quickTile.id, {
        routeId: this.game.getCampRouteChoice?.(quickTile.id) || "",
      });
      const footerQuickRouteMetrics =
        this._getCampPathTravelMetrics(footerQuickRoutePath);
      const footerQuickPlan = this._getCampTravelPlan(
        quickTile,
        footerQuickRouteMetrics,
      );
      mapFooterHint = `${baseMapFooterHint} Выбранный участок можно собрать прямо с карты: ${quickTile.name} · ⏱ ${this._formatCampRouteTimeLabel(footerQuickPlan.totalMs, footerQuickRouteMetrics)} · ${this._formatCampRouteMetricLabel(footerQuickRouteMetrics)}.`;
    } else if (activeMapLayer === "survey") {
      const selectedUnlockHint =
        this.game.getCampTileUnlockHint?.(selected.id) || "";
      if (selectedCanExploreNow) {
        mapFooterHint = `${baseMapFooterHint} Разведка доступна сейчас: ${selected.name} · клик покажет путь, двойной клик отправит персонажа.`;
      } else if (selected.terrainSeen) {
        mapFooterHint = `${baseMapFooterHint} ${selected.name} уже осмотрен, но ещё не раскрыт полностью. ${selectedUnlockHint || "Нужен более уверенный проход к следующему рубежу."}`;
      } else if (this._isCampTileUnknownState(selected.state)) {
        mapFooterHint = `${baseMapFooterHint} ${selected.name}: неизвестный участок. ${selectedUnlockHint || "Сначала раскройте соседний рубеж или подготовьте следующий проход."}`;
      } else {
        mapFooterHint = `${baseMapFooterHint} ${selected.name} уже раскрыт. Для дальнейшей разведки выбирайте рубеж или осмотренный гекс с подсветкой.`;
      }
    }

    const selectedRoleHtml = selectedRoleMeta
      ? `
          <div class="camp-map-note">
            <strong>${selectedRoleMeta.label}</strong>
            ${selectedRoleMeta.description ? ` · ${selectedRoleMeta.description}` : ""}
          </div>
        `
      : "";
    const selectedMarkersHtml = selected.visibleMarkers?.length
      ? `
          <div class="camp-map-known-row" aria-label="Видимые метки участка">
            ${selected.visibleMarkers
              .map(
                (marker) => `
                  <span class="camp-map-known-chip tone-${marker.tone || "neutral"}">
                    <span>${this.getCampTileMarkerIcon(marker)}</span>
                    ${this.getCampTileMarkerLabel(marker)}
                  </span>
                `,
              )
              .join("")}
          </div>
        `
      : "";
    const selectedPotentialsHtml = selected.knownPotentials?.length
      ? `
          <div class="camp-map-known-block">
            <div class="camp-map-known-title">Известно</div>
            <div class="camp-map-known-list">
              ${selected.knownPotentials
                .map(
                  (potential) => `
                    <span class="camp-map-known-pill">${potential.label}</span>
                  `,
                )
                .join("")}
            </div>
          </div>
        `
      : "";

    const selectedSecondaryDetailsHtml = [
      selectedRouteIntelHtml,
      selectedRouteChoicePanelHtml,
      selectedJournalHtml,
      selectedExpansionHtml,
      selectedBuildUsageHtml,
      selectedMarkersHtml,
      selectedPotentialsHtml,
      selectedRoleHtml,
    ]
      .filter(Boolean)
      .join("");

    // ── Just-founded pulse: detect campSetupDone going false → true ──
    let justFoundedFlag = false;
    if (mapState.campSetupDone && this._prevCampSetupDone === false) {
      justFoundedFlag = true;
    }
    this._prevCampSetupDone = !!mapState.campSetupDone;

    const foundingDockHtml = this._renderCampFoundingDockBlock(selected, {
      selectedCanFoundBeforeCamp,
    });
    const commandDeckHtml = `
      <div class="camp-map-command-deck${!mapState.campSetupDone ? " is-pre-camp" : ""}">
        ${foundingDockHtml}
        <div class="camp-map-command-grid">
          <div class="camp-map-command-stack is-primary">
            ${expeditionHtml}
            ${mapQuickActionHtml}
          </div>
          <div class="camp-map-command-stack is-secondary">
            ${taskQueueHtml}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="camp-map-header">
        <div>
          <h3>${mapState.title}</h3>
          <div class="camp-map-description">${mapState.description}</div>
        </div>
        <div class="camp-map-header-right">
          ${layerControlsHtml}
          ${topLegendHtml}
          ${
            mapState.campSetupDone
              ? `
        <div class="camp-map-chips">
          <span class="camp-map-chip">Участков ${mapState.totalCount}</span>
          <span class="camp-map-chip">Открыто ${mapState.discoveredCount}</span>
          <span class="camp-map-chip">Освоено ${mapState.developedCount}</span>
          <span class="camp-map-chip">Троп ${mapState.trailCount}</span>
        </div>`
              : ""
          }
        </div>
      </div>
      <div class="camp-map-body">
        <div class="camp-map-left-rail">
          ${commandDeckHtml}
          ${sideLegendHtml}
        </div>
        <div class="camp-map-scene-wrap${!mapState.campSetupDone ? " is-pre-camp" : ""}${justFoundedFlag ? " camp-just-founded" : ""}">
          <div class="camp-map-scene${!mapState.campSetupDone && mapState.introStep?.index === 0 ? " is-arriving" : ""}" id="camp-map-scene">
              <svg id="camp-map-svg" class="camp-map-svg layer-${activeMapLayer}"
                 width="100%" height="100%"
                 viewBox="-288 -320 576 640"
                 preserveAspectRatio="xMidYMid meet"
                 xmlns="http://www.w3.org/2000/svg"></svg>
            <div id="camp-map-inline-action-host" class="camp-map-inline-action-host"></div>
            <div id="camp-map-tooltip" class="camp-map-tooltip" hidden></div>
            ${introOverlayHtml}
          </div>
          <div class="camp-map-legend">${mapFooterHint}</div>
        </div>
        <aside class="camp-map-details">
          <div class="camp-map-details-preview terrain-${selected.terrainType || "plain"}">
            ${selectedPreviewMedia}
            ${selectedPreviewResourcesHtml}
          </div>
          <div class="camp-map-details-top">
            <div>
              <div class="camp-map-details-name">${selected.name}</div>
              <div class="camp-map-details-subtitle">${selectedTerrainLabel}</div>
            </div>
            <div class="camp-map-details-meta">
              <span class="camp-map-chip">${selectedStateLabel}</span>
              <span class="camp-map-chip">Дистанция ${selectedDistanceLabel}</span>
            </div>
          </div>
          <div class="camp-map-details-text">${selected.description}</div>
          ${selectedResourceSummaryHtml}
          ${detailsActionBlock}
          ${
            selectedSecondaryDetailsHtml
              ? `
                <button
                  class="camp-map-details-more"
                  type="button"
                  data-camp-details-toggle="true"
                  aria-expanded="false"
                >Детали участка</button>
                <div class="camp-map-details-secondary" aria-label="Дополнительные сведения участка" aria-hidden="true">
                  <div class="camp-map-details-secondary-head">
                    <span>Детали участка</span>
                    <button class="camp-map-details-secondary-close" type="button" data-camp-details-close="true" aria-label="Закрыть">×</button>
                  </div>
                  <div class="camp-map-details-secondary-grid">
                    ${selectedSecondaryDetailsHtml}
                  </div>
                </div>
              `
              : ""
          }
        </aside>
      </div>
    `;

    const setCampDetailsDrawerOpen = (open) => {
      document.body.classList.toggle("is-camp-details-open", open);
      document
        .querySelectorAll("[data-camp-details-toggle]")
        .forEach((button) =>
          button.setAttribute("aria-expanded", open ? "true" : "false"),
        );
      document
        .querySelectorAll(".camp-map-details-secondary")
        .forEach((panel) =>
          panel.setAttribute("aria-hidden", open ? "false" : "true"),
        );
    };

    setCampDetailsDrawerOpen(
      document.body.classList.contains("is-camp-details-open") &&
        !!selectedSecondaryDetailsHtml,
    );

    container.querySelectorAll("[data-camp-details-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        setCampDetailsDrawerOpen(
          !document.body.classList.contains("is-camp-details-open"),
        );
      });
    });

    container.querySelectorAll("[data-camp-details-close]").forEach((button) => {
      button.addEventListener("click", () => setCampDetailsDrawerOpen(false));
    });

    container.querySelectorAll("[data-camp-map-layer]").forEach((button) => {
      button.addEventListener("click", () => {
        const changed = this._setCampMapLayerMode(button.dataset.campMapLayer);
        if (changed) this.renderCampMap();
      });
    });

    container.querySelectorAll("[data-camp-route-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        const routeId = button.getAttribute("data-camp-route-choice") || "";
        this.game.setCampRouteChoice?.(selected.id, routeId);
        const previewKind = selected.action
          ? "action"
          : selected.terrainSeen && this.game.canExploreCampTile?.(selected.id)
            ? "explore"
            : "inspect";
        this._setCampRoutePreview(selected.id, previewKind);
        container.dataset.prevSelectedTile = "__route_choice__";
        this.render({ forcePanels: true });
      });
    });

    const primaryAction = document.getElementById("camp-map-primary-action");
    if (primaryAction) {
      primaryAction.addEventListener("click", () => {
        if (selected.state === "camp") {
          if (!(this.game.isCharacterAtCamp?.() ?? true)) {
            if (!this._startCampReturnTrip()) {
              this.render({ forcePanels: true });
            }
            return;
          }
          this.openCampScreen();
          return;
        }
        if (primaryAction.getAttribute("aria-disabled") === "true") {
          this.render({ forcePanels: true });
          return;
        }
        if (selected.action) {
          if (this.game.getCharacterTileId?.() === selected.id) {
            const ok = this.game.performCampTileAction(selected.id);
            if (ok) this._clearCampInterruptedTravelAction();
            this.render({ forcePanels: true });
            return;
          }
          if (!this._startCampTileTravel(selected)) {
            this.render({ forcePanels: true });
          }
          return;
        }
        if (primaryAction.dataset.campMove === "true") {
          if (!this._startCampTileVisit(selected.id)) {
            this.render({ forcePanels: true });
          }
          return;
        }
        if (!this.game.performCampTileAction(selected.id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });
    }

    const foundAction = document.getElementById("camp-map-found-action");
    if (foundAction) {
      foundAction.addEventListener("click", () => {
        this.openCampFoundConfirm(selected.id);
      });
    }

    const moveAction = document.getElementById("camp-map-move-action");
    if (moveAction) {
      moveAction.addEventListener("click", () => {
        if (!this._startCampTileVisit(selected.id)) {
          this.render({ forcePanels: true });
        }
      });
    }

    const foundingGuideAction = document.getElementById(
      "camp-map-founding-guide-action",
    );
    if (foundingGuideAction) {
      foundingGuideAction.addEventListener("click", () => {
        const tileId = foundingGuideAction.getAttribute("data-tile-id") || "";
        if (!tileId) return;
        const details = this.game.getCampMapTileDetails?.(tileId) || null;
        this.game.selectCampTile?.(tileId);
        if (details) {
          const previewKind = details.action
            ? "action"
            : details.terrainSeen && this.game.canExploreCampTile?.(tileId)
              ? "explore"
              : "inspect";
          this._setCampRoutePreview(tileId, previewKind);
        }
        container.dataset.prevSelectedTile = "__founding_dock__";
        this.render({ forcePanels: true });
      });
    }

    const foundingReadyAction = document.getElementById(
      "camp-map-founding-ready-action",
    );
    if (foundingReadyAction) {
      foundingReadyAction.addEventListener("click", () => {
        this.openCampFoundConfirm(selected.id);
      });
    }

    container
      .querySelectorAll("[data-camp-quick-choice]")
      .forEach((choiceButton) => {
        choiceButton.addEventListener("click", () => {
          if (choiceButton.getAttribute("aria-disabled") === "true") {
            this.render({ forcePanels: true });
            return;
          }
          const tileId =
            choiceButton.getAttribute("data-tile-id") || selected.id;
          const resourceId =
            choiceButton.getAttribute("data-resource-id") || "";
          const actionId = choiceButton.getAttribute("data-action-id") || "";
          const tileDetails = this.game.getCampMapTileDetails?.(tileId) || null;
          if (!tileDetails?.action) {
            this.render({ forcePanels: true });
            return;
          }
          const choiceDetails = this._getCampGatherChoiceDetails(
            tileDetails,
            resourceId,
            actionId,
          );
          this.game.selectCampTile?.(tileId);
          if (this.game.getCharacterTileId?.() === tileId) {
            const ok = this.game.performCampTileAction(tileId, {
              ...(actionId ? { actionId } : {}),
              ...(resourceId ? { resourceId } : {}),
            });
            if (ok) this._clearCampInterruptedTravelAction();
            this.render({ forcePanels: true });
            return;
          }
          if (
            !this._startCampTileTravel(choiceDetails, {
              ...(actionId ? { actionId } : {}),
              ...(resourceId ? { resourceId } : {}),
            })
          ) {
            this.render({ forcePanels: true });
          }
        });
      });

    document
      .querySelectorAll(".camp-map-resource-choice-btn")
      .forEach((choiceButton) => {
        choiceButton.addEventListener("click", () => {
          if (choiceButton.getAttribute("aria-disabled") === "true") {
            this.render({ forcePanels: true });
            return;
          }
          const resourceId = choiceButton.getAttribute("data-resource-id");
          const actionId = choiceButton.getAttribute("data-action-id") || "";
          const choiceDetails = this._getCampGatherChoiceDetails(
            selected,
            resourceId,
            actionId,
          );
          if (this.game.getCharacterTileId?.() === selected.id) {
            const ok = this.game.performCampTileAction(selected.id, {
              actionId,
              resourceId,
            });
            if (ok) this._clearCampInterruptedTravelAction();
            this.render({ forcePanels: true });
            return;
          }
          if (
            !this._startCampTileTravel(choiceDetails, { resourceId, actionId })
          ) {
            this.render({ forcePanels: true });
          }
        });
      });

    container.querySelectorAll("[data-camp-queue-add]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.getAttribute("aria-disabled") === "true") {
          this.render({ forcePanels: true });
          return;
        }
        const tileId = button.getAttribute("data-tile-id") || selected.id;
        const tileDetails = this.game.getCampMapTileDetails?.(tileId) || null;
        if (!tileDetails?.action) {
          this.render({ forcePanels: true });
          return;
        }
        const result = this.game.addCampTaskQueueEntry?.({
          tileId,
          actionId:
            button.getAttribute("data-action-id") || tileDetails.action.id,
          resourceId: button.getAttribute("data-resource-id") || "",
          routeId:
            button.getAttribute("data-route-id") ||
            this.game.getCampRouteChoice?.(tileId) ||
            "",
        });
        if (result?.ok) {
          const resourceName = button.getAttribute("data-resource-id")
            ? this.getResourceDisplayName(
                button.getAttribute("data-resource-id"),
              )
            : tileDetails.name;
          this.showToast?.(
            `Добавлено в путевой лист: ${resourceName}.`,
            "success",
          );
        } else if (result?.reason) {
          this.game.addLog?.(result.reason);
        }
        this.render({ forcePanels: true });
      });
    });

    const queueStart = document.getElementById("camp-map-queue-start");
    if (queueStart) {
      queueStart.addEventListener("click", () => {
        if (queueStart.getAttribute("aria-disabled") === "true") {
          this.render({ forcePanels: true });
          return;
        }
        if (!this._startCampTaskQueue()) {
          this.render({ forcePanels: true });
        }
      });
    }

    const queueClear = document.getElementById("camp-map-queue-clear");
    if (queueClear) {
      queueClear.addEventListener("click", () => {
        if (queueClear.getAttribute("aria-disabled") !== "true") {
          this.game.clearCampTaskQueue?.();
        }
        this.render({ forcePanels: true });
      });
    }

    container.querySelectorAll("[data-camp-queue-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-camp-queue-remove"));
        this.game.removeCampTaskQueueEntry?.(index);
        this.render({ forcePanels: true });
      });
    });

    const quickGatherAction = document.getElementById(
      "camp-map-quick-gather-action",
    );
    if (quickGatherAction) {
      quickGatherAction.addEventListener("click", () => {
        if (quickGatherAction.getAttribute("aria-disabled") === "true") {
          this.render({ forcePanels: true });
          return;
        }
        const quickTileId = quickGatherAction.getAttribute("data-tile-id");
        const resourceId =
          quickGatherAction.getAttribute("data-resource-id") || "";
        const actionId = quickGatherAction.getAttribute("data-action-id") || "";
        const quickDetails = this.game.getCampMapTileDetails(quickTileId);
        if (quickDetails?.id) this.game.selectCampTile(quickDetails.id);
        const quickChoices = quickDetails?.action
          ? this._getCampGatherResourceChoices(quickDetails)
          : [];
        const quickChoice = quickChoices.length === 1 ? quickChoices[0] : null;
        if (
          quickDetails?.action &&
          this.game.getCharacterTileId?.() === quickDetails.id
        ) {
          const ok = this.game.performCampTileAction(quickDetails.id, {
            ...(actionId || quickChoice?.actionId
              ? { actionId: actionId || quickChoice?.actionId }
              : {}),
            ...(resourceId || quickChoice?.id
              ? { resourceId: resourceId || quickChoice?.id }
              : {}),
          });
          if (ok) this._clearCampInterruptedTravelAction();
          this.render({ forcePanels: true });
          return;
        }
        const travelDetails = quickChoice?.details || quickDetails;
        if (
          quickDetails?.action &&
          !this._startCampTileTravel(travelDetails, {
            ...(actionId || quickChoice?.actionId
              ? { actionId: actionId || quickChoice?.actionId }
              : {}),
            ...(resourceId || quickChoice?.id
              ? { resourceId: resourceId || quickChoice?.id }
              : {}),
          })
        ) {
          this.render({ forcePanels: true });
        }
      });
    }

    const resumeTravelCommand = document.getElementById(
      "camp-map-resume-travel-command",
    );
    if (resumeTravelCommand) {
      resumeTravelCommand.addEventListener("click", () => {
        if (!this._resumeCampInterruptedTravelAction()) {
          this.render({ forcePanels: true });
        }
      });
    }

    const returnCommand = document.getElementById("camp-map-return-command");
    if (returnCommand) {
      returnCommand.addEventListener("click", () => {
        if (!this._startCampReturnTrip()) {
          this.render({ forcePanels: true });
        }
      });
    }

    const stopTravelCommand = document.getElementById(
      "camp-map-stop-travel-command",
    );
    if (stopTravelCommand) {
      stopTravelCommand.addEventListener("click", () => {
        if (!this._cancelCampTravelAction()) {
          this.render({ forcePanels: true });
        }
      });
    }

    const unloadCommand = document.getElementById("camp-map-unload-command");
    if (unloadCommand) {
      unloadCommand.addEventListener("click", () => {
        if (this.game.unloadTripInventory?.()) {
          this._clearCampInterruptedTravelAction();
          this.showToast("Груз переложен в общий запас.", "success");
        }
        this.render({ forcePanels: true });
      });
    }

    const routeCommandAction = document.getElementById(
      "camp-map-route-command",
    );
    if (routeCommandAction) {
      routeCommandAction.addEventListener("click", () => {
        if (routeCommandAction.getAttribute("aria-disabled") === "true") {
          this.render({ forcePanels: true });
          return;
        }
        const routeTileId = routeCommandAction.getAttribute("data-tile-id");
        const routeKind =
          routeCommandAction.getAttribute("data-route-kind") || "explore";
        const started =
          routeKind === "inspect"
            ? this._startCampTileVisit(routeTileId)
            : this._startCampTileExplore(routeTileId);
        if (!started) {
          this.render({ forcePanels: true });
        }
      });
    }

    const trailAction = document.getElementById("camp-map-trail-action");
    if (trailAction) {
      trailAction.addEventListener("click", () => {
        this.game.improveCampPath(selected.id);
        this.render({ forcePanels: true });
      });
    }

    const campRestAction = document.getElementById("camp-map-rest-action");
    if (campRestAction) {
      campRestAction.addEventListener("click", () => {
        if (campRestAction.getAttribute("aria-disabled") === "true") {
          this.render({ forcePanels: true });
          return;
        }
        if (this.game.restCharacter()) {
          this.scheduleRestCooldownRefresh(
            this.game.getCharacterRestCooldownMs(),
          );
        }
        this.render({ forcePanels: true });
      });
    }

    // ── Camp intro overlay interactions ──
    if (!mapState.campSetupDone && introStepData) {
      const overlayEl = document.querySelector(".camp-intro-overlay");
      const skipBtn = document.getElementById("camp-intro-skip");
      const nextBtn = document.getElementById("camp-intro-next");

      if (skipBtn) {
        skipBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.game.skipCampIntro()) {
            this.render({ forcePanels: true });
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.game.advanceCampIntro()) {
            this.render({ forcePanels: true });
          }
        });
      }

      // Step "arrival" (click to proceed) + "survey" auto-advance timeout
      if (overlayEl && introStepData.advanceMode === "click") {
        overlayEl.addEventListener("click", () => {
          if (this.game.advanceCampIntro()) {
            this.render({ forcePanels: true });
          }
        });
      }

      // Auto-advance timer — set once per render; clear on next render
      if (this._campIntroTimer) {
        clearTimeout(this._campIntroTimer);
        this._campIntroTimer = null;
      }
      if (
        Number.isFinite(introStepData.autoAdvanceMs) &&
        introStepData.autoAdvanceMs > 0
      ) {
        const frozenStep = introStepData.index;
        this._campIntroTimer = setTimeout(() => {
          // Only advance if we're still on the same step
          if (this.game.getCampIntroStep() === frozenStep) {
            if (this.game.advanceCampIntro()) {
              this.render({ forcePanels: true });
            }
          }
        }, introStepData.autoAdvanceMs);
      }
    } else if (this._campIntroTimer) {
      clearTimeout(this._campIntroTimer);
      this._campIntroTimer = null;
    }

    // ── Just-founded flash: remove the class after the animation plays ──
    if (justFoundedFlag) {
      if (this._justFoundedTimer) clearTimeout(this._justFoundedTimer);
      this._justFoundedTimer = setTimeout(() => {
        document
          .querySelector(".camp-map-scene-wrap.camp-just-founded")
          ?.classList.remove("camp-just-founded");
      }, 1800);
    }

    const shellInspectorHost = document.getElementById(
      "shell-map-inspector-host",
    );
    const renderedInspector = container.querySelector(".camp-map-details");
    if (shellInspectorHost && renderedInspector) {
      shellInspectorHost.replaceChildren(renderedInspector);
      shellInspectorHost.hidden = false;
    } else if (shellInspectorHost) {
      shellInspectorHost.replaceChildren();
      shellInspectorHost.hidden = true;
    }

    // ── SVG tile rendering — viewBox coordinate system is fixed,
    // completely independent of DOM layout timing ─────────────────────────────
    const sceneEl = document.getElementById("camp-map-scene");
    const svgEl = document.getElementById("camp-map-svg");
    const tooltipEl = document.getElementById("camp-map-tooltip");
    if (sceneEl && svgEl) {
      // Flat-top hex. HR = radius (centre → vertex). Full radius keeps cells adjacent.
      const HR = 40;
      const shrink = 1;
      const r = HR * shrink;
      const rv = (r * Math.sqrt(3)) / 2;
      const rh = r * 0.5;
      const hStep = HR * 1.5;
      const vStep = HR * Math.sqrt(3);
      const tileCoordById = {};

      const tileSeed = (value) => {
        let hash = 0;
        const text = String(value || "");
        for (let i = 0; i < text.length; i++) {
          hash = (hash * 31 + text.charCodeAt(i)) % 9973;
        }
        return hash;
      };

      const buildTree = (x, y, scale = 1, variant = 0) => `
        <g class="tile-art-tree variant-${variant % 3}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
          <path class="tile-art-trunk" d="M -2 20 L 2 20 L 1.2 3 L -1.2 3 Z" />
          <path class="tile-art-needles is-back" d="M 0 -25 L -14 4 L -8 4 L -18 20 L 18 20 L 8 4 L 14 4 Z" />
          <path class="tile-art-needles" d="M 0 -31 L -11 -5 L -6 -5 L -15 11 L 15 11 L 6 -5 L 11 -5 Z" />
        </g>`;

      const buildShrub = (x, y, scale = 1, berries = false) => `
        <g class="tile-art-shrub${berries ? " has-berries" : ""}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
          <circle cx="-9" cy="3" r="8" />
          <circle cx="0" cy="-2" r="10" />
          <circle cx="10" cy="4" r="8" />
          ${berries ? `<circle class="tile-art-berry" cx="-6" cy="-2" r="2.1" /><circle class="tile-art-berry" cx="4" cy="-7" r="2.1" /><circle class="tile-art-berry" cx="10" cy="2" r="2.1" />` : ""}
        </g>`;

      const buildGrass = (x, y, scale = 1, flowers = false) => `
        <g class="tile-art-grass${flowers ? " has-flowers" : ""}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
          <path d="M -10 12 C -9 4 -8 -2 -4 -10" />
          <path d="M -3 13 C -4 5 -1 -2 1 -12" />
          <path d="M 4 13 C 5 4 8 -1 11 -9" />
          <path d="M 9 12 C 7 7 7 2 4 -4" />
          ${flowers ? `<circle class="tile-art-flower" cx="-5" cy="-9" r="1.8" /><circle class="tile-art-flower" cx="9" cy="-8" r="1.8" />` : ""}
        </g>`;

      const buildRocks = (x, y, scale = 1) => `
        <g class="tile-art-rocks" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
          <path d="M -20 9 L -12 -8 L 2 -15 L 14 -5 L 20 10 L 5 16 L -12 15 Z" />
          <path class="is-small" d="M -28 16 L -21 5 L -11 7 L -6 18 L -18 23 Z" />
          <path class="is-small" d="M 13 18 L 18 6 L 29 11 L 25 22 Z" />
          <path class="tile-art-rock-edge" d="M -12 -8 L 0 1 L 14 -5" />
        </g>`;

      const buildTwigs = (x, y, scale = 1) => `
        <g class="tile-art-twigs" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
          <path d="M -22 10 L 18 -9" />
          <path d="M -17 -4 L 21 11" />
          <path d="M -8 13 L 10 -15" />
          <path d="M -2 -1 L -12 -13" />
          <path d="M 5 0 L 17 -4" />
        </g>`;

      const buildWater = (x, y, scale = 1) => `
        <g class="tile-art-water" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
          <ellipse cx="0" cy="6" rx="27" ry="13" />
          <path d="M -18 5 C -9 0, 0 0, 9 5 S 25 10, 31 4" />
          <path d="M -13 13 C -5 10, 4 10, 12 13" />
          <circle cx="0" cy="-3" r="3.4" />
        </g>`;

      const buildClay = (x, y, scale = 1) => `
        <g class="tile-art-clay" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
          <path d="M -25 12 C -18 -8, 5 -16, 23 -4 L 18 15 C 6 22, -12 20, -25 12 Z" />
          <path class="tile-art-crack" d="M -11 2 L -2 8 L 6 -1 L 16 4" />
          <path class="tile-art-crack" d="M -4 13 L 2 7" />
        </g>`;

      const buildCampfire = (x, y, scale = 1) => `
        <g class="tile-art-campfire" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
          <path class="tile-art-fire-glow" d="M -23 15 C -19 -6, 19 -6, 23 15 C 8 23, -8 23, -23 15 Z" />
          <path class="tile-art-log" d="M -18 15 L 16 2" />
          <path class="tile-art-log" d="M -16 2 L 18 15" />
          <path class="tile-art-flame is-outer" d="M 0 -28 C -15 -8, -5 6, 0 12 C 13 1, 11 -11, 0 -28 Z" />
          <path class="tile-art-flame" d="M 2 -15 C -5 -5, -1 4, 3 8 C 10 1, 8 -8, 2 -15 Z" />
          <path class="tile-art-smoke" d="M 0 -32 C -8 -43, 9 -48, 1 -60" />
        </g>`;

      const buildUnknown = (cx, cy, state) => `
        <g class="tile-art-unknown ${state === "hidden" ? "is-hidden" : "is-silhouette"}">
        </g>`;

      const buildTileMarkers = (tile, cx, cy) => {
        if (!showResourceLayer || this._isCampTileUnknownState(tile.state)) {
          return "";
        }
        const resourceIds = new Set();
        if (tile.resourceType) resourceIds.add(tile.resourceType);
        const gatherActionIds =
          this.game._getCampTileGatherActionIds?.(tile) ||
          (tile.actionId ? [tile.actionId] : []);
        gatherActionIds.forEach((actionId) => {
          const action = this.data.gatherActions?.[actionId];
          Object.keys(action?.output || {}).forEach((resourceId) =>
            resourceIds.add(resourceId),
          );
        });
        const resources = [...resourceIds].slice(0, 4);
        if (!resources.length) return "";

        const startX = cx - (resources.length - 1) * 5.5;
        const y = cy - 22;
        return `<g class="tile-resource-dots" aria-hidden="true">
          ${resources
            .map((resourceId, index) => {
              const resource = this.data.resources?.[resourceId];
              return `<circle class="tile-resource-dot resource-${resourceId}" cx="${(startX + index * 11).toFixed(1)}" cy="${y.toFixed(1)}" r="4.2"><title>${resource?.name || resourceId}</title></circle>`;
            })
            .join("")}
        </g>`;
      };

      const buildCampTileArt = (tile, cx, cy, clipId) => {
        if (
          tile.state === "hidden" ||
          tile.state === "silhouette" ||
          tile.state === "visible_locked"
        ) {
          return buildUnknown(cx, cy, tile.state);
        }

        const seed = tileSeed(tile.id);
        const dx = ((seed % 7) - 3) * 1.1;
        const dy = (((seed >> 3) % 7) - 3) * 1.1;
        const parts = [
          `<g class="tile-art terrain-art-${tile.terrainType || "plain"}" clip-path="url(#${clipId})">`,
          `<ellipse class="tile-art-light" cx="${(cx + dx).toFixed(1)}" cy="${(cy - 8 + dy).toFixed(1)}" rx="31" ry="22" />`,
          `<ellipse class="tile-art-shadow" cx="${cx.toFixed(1)}" cy="${(cy + 23).toFixed(1)}" rx="31" ry="10" />`,
        ];

        if (tile.state === "camp") {
          // Camp tile renders campfire.png on top — neutral backdrop only
        } else if (tile.terrainType === "lore") {
          // Old fire ring — dead campfire / ash trace
          parts.push(buildCampfire(cx, cy + 2, 0.72));
        }
        // All other tiles: neutral terrain backdrop (light+shadow ellipses +
        // terrain-art-<type> CSS tint). Resource/building PNG is overlaid
        // separately in the render pipeline.

        if (tile.state === "camp_candidate") {
          parts.push(
            `<circle class="tile-art-candidate-dot" cx="${cx.toFixed(1)}" cy="${(cy + 18).toFixed(1)}" r="3.2" />`,
          );
        }

        parts.push("</g>");
        return parts.join("");
      };

      const buildBackdropTree = (x, y, scale, tone = 0) => `
        <g class="camp-backdrop-tree tone-${tone % 3}" transform="translate(${x} ${y}) scale(${scale})">
          <path d="M -3 28 L 3 28 L 2 2 L -2 2 Z" />
          <path d="M 0 -35 L -18 4 L -10 4 L -24 28 L 24 28 L 10 4 L 18 4 Z" />
          <path d="M 0 -53 L -14 -16 L -8 -16 L -20 8 L 20 8 L 8 -16 L 14 -16 Z" />
        </g>`;

      const defsSvg = `
        <defs>
          <radialGradient id="campMapFogGlow" cx="50%" cy="46%" r="60%">
            <stop offset="0%" stop-color="#244f2d" stop-opacity="0.36" />
            <stop offset="58%" stop-color="#0d2119" stop-opacity="0.18" />
            <stop offset="100%" stop-color="#02070a" stop-opacity="0" />
          </radialGradient>
        </defs>`;

      const backdropSvg = `
        <g class="camp-map-backdrop" aria-hidden="true">
          <rect x="-360" y="-380" width="720" height="760" fill="url(#campMapFogGlow)" />
          ${[
            [-276, -230, 0.86, 0],
            [-238, -166, 0.74, 1],
            [-292, -38, 0.82, 2],
            [-258, 116, 0.9, 1],
            [-210, 226, 0.72, 0],
            [-118, -274, 0.76, 2],
            [-42, -300, 0.62, 1],
            [48, -286, 0.72, 0],
            [132, -250, 0.64, 2],
            [218, -174, 0.78, 1],
            [274, -50, 0.84, 0],
            [246, 94, 0.74, 2],
            [212, 218, 0.88, 1],
            [86, 286, 0.66, 0],
            [-58, 300, 0.72, 2],
            [-178, 268, 0.8, 1],
            [-326, 54, 0.68, 0],
            [326, 52, 0.7, 2],
          ]
            .map((item) => buildBackdropTree(...item))
            .join("")}
        </g>`;

      let tileIndex = 0;
      const tileGroups = mapState.tiles
        .map((tile) => {
          const isUnknownTile = this._isCampTileUnknownState(tile.state);
          const cx = tile.q * hStep;
          const cy = (tile.r + tile.q * 0.5) * vStep;
          tileCoordById[tile.id] = { x: cx, y: cy };

          // Flat-top hex polygon points — clockwise from right vertex
          const pts = [
            `${(cx + r).toFixed(1)},${cy.toFixed(1)}`,
            `${(cx + rh).toFixed(1)},${(cy + rv).toFixed(1)}`,
            `${(cx - rh).toFixed(1)},${(cy + rv).toFixed(1)}`,
            `${(cx - r).toFixed(1)},${cy.toFixed(1)}`,
            `${(cx - rh).toFixed(1)},${(cy - rv).toFixed(1)}`,
            `${(cx + rh).toFixed(1)},${(cy - rv).toFixed(1)}`,
          ].join(" ");
          const clipId = `camp-tile-clip-${tile.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

          const classes = [
            "camp-tile",
            `is-${tile.state}`,
            `terrain-${tile.terrainType || "plain"}`,
            `zone-${tile.distanceFromCamp ?? 0}`,
          ];
          const baseMapRadius =
            mapState.expansionState?.baseRadius || mapState.radius;
          const surveyState =
            tile.state === "visible_locked"
              ? "frontier"
              : tile.state === "terrain_seen"
                ? "seen"
                : this._isCampTileUnknownState(tile.state)
                  ? "unknown"
                  : "known";
          const canExploreNow =
            typeof this.game.canExploreCampTile === "function" &&
            this.game.canExploreCampTile(tile.id);
          if (tile.selected) classes.push("is-selected");
          if (tile.building || tile.placedBuildings?.length) {
            classes.push("has-building");
          }
          if (tile.construction) classes.push("is-constructing");
          if (tile.isDepleted) classes.push("is-depleted");
          if (showPathLayer && tile.pathLevel && tile.pathLevel !== "none") {
            classes.push(`has-path-${tile.pathLevel}`);
          }
          if (
            showPathLayer &&
            (!tile.pathLevel || tile.pathLevel === "none") &&
            (tile.pathUseProgress?.uses || 0) > 0
          ) {
            classes.push("has-path-trace");
          }
          if (showSurveyLayer) {
            classes.push(`survey-${surveyState}`);
            if ((tile.distanceFromCamp || 0) > baseMapRadius) {
              classes.push("is-frontier-ring");
            }
            if (canExploreNow) {
              classes.push("is-explorable");
            }
          }
          if (tile.isCampCandidate || tile.state === "camp_candidate") {
            classes.push("is-candidate-flag");
          }
          if (
            showResourceLayer &&
            !isUnknownTile &&
            tile.resourceType &&
            Number.isFinite(tile.resourceRemaining)
          ) {
            const cap = tile.resourceCapacity || 1;
            const pct = tile.resourceRemaining / cap;
            if (pct >= 0.67) classes.push("res-rich");
            else if (pct >= 0.34) classes.push("res-medium");
            else classes.push("res-sparse");
          }
          if (
            tile.state === "camp" &&
            this.game.isCampSetupDone() &&
            !this.game.isCampEntered()
          ) {
            classes.push("is-beckon");
          }
          const imageHref = this.getCampTileImageHref(tile);

          const tileStateLabel = this.getCampTileStateLabel(tile.state);

          const stockBadge =
            showResourceLayer &&
            !isUnknownTile &&
            Number.isFinite(tile.resourceRemaining)
              ? `<text class="tile-stock${tile.isDepleted ? " is-depleted" : ""}" x="${(cx + 22).toFixed(1)}" y="${(cy - 18).toFixed(1)}">${tile.resourceRemaining}</text>`
              : "";

          const candidateLabel =
            tile.state === "camp_candidate" && tile.shortLabel
              ? `<text class="tile-label" x="${cx.toFixed(1)}" y="${(cy + 22).toFixed(1)}">${tile.shortLabel}</text>`
              : "";

          const pathMark =
            showPathLayer &&
            tile.pathLevel &&
            tile.pathLevel !== "none" &&
            !isUnknownTile
              ? `<path class="tile-path-mark" d="M ${(cx - 24).toFixed(1)} ${(cy + 21).toFixed(1)} C ${(cx - 10).toFixed(1)} ${(cy + 11).toFixed(1)}, ${(cx + 7).toFixed(1)} ${(cy + 27).toFixed(1)}, ${(cx + 24).toFixed(1)} ${(cy + 14).toFixed(1)}" />`
              : "";
          const pathTraceMark =
            showPathLayer &&
            (!tile.pathLevel || tile.pathLevel === "none") &&
            (tile.pathUseProgress?.uses || 0) > 0 &&
            !isUnknownTile
              ? `<path class="tile-path-trace-mark" d="M ${(cx - 22).toFixed(1)} ${(cy + 18).toFixed(1)} C ${(cx - 9).toFixed(1)} ${(cy + 10).toFixed(1)}, ${(cx + 6).toFixed(1)} ${(cy + 22).toFixed(1)}, ${(cx + 22).toFixed(1)} ${(cy + 12).toFixed(1)}" />`
              : "";
          const surveyBadge = showSurveyLayer
            ? `<circle class="tile-survey-ring is-${surveyState}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="31.5" />`
            : "";
          const surveyMarkText = !showSurveyLayer
            ? ""
            : surveyState === "unknown"
              ? "?"
              : surveyState === "frontier"
                ? "!"
                : surveyState === "seen"
                  ? "◔"
                  : "";
          const surveyMarker =
            showSurveyLayer && surveyMarkText
              ? `<text class="tile-survey-mark is-${surveyState}" x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}">${surveyMarkText}</text>`
              : "";
          const campMarker =
            tile.state === "camp"
              ? `<circle class="tile-camp-marker" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9.5" />`
              : "";

          const animStyle =
            !mapState.campSetupDone && mapState.introStep?.index === 0
              ? ` style="animation-delay:${(tileIndex * 45).toFixed(0)}ms"`
              : "";

          tileIndex++;
          const artSvg = buildCampTileArt(tile, cx, cy, clipId);
          const isCampTile = tile.state === "camp";
          const hasBuildingImage = false;
          const hasCampImage = isCampTile && !!imageHref;
          const hasTerrainImage =
            !!imageHref && !hasBuildingImage && !hasCampImage && !isUnknownTile;
          const buildingImage = "";
          const campImage = hasCampImage
            ? `<image class="tile-image is-camp" href="${imageHref}" x="${(cx - 22).toFixed(1)}" y="${(cy - 22).toFixed(1)}" width="44" height="44" preserveAspectRatio="xMidYMid meet" />`
            : "";
          const terrainImage = hasTerrainImage
            ? `<image class="tile-image is-terrain" href="${imageHref}" x="${(cx - 40).toFixed(1)}" y="${(cy - 40).toFixed(1)}" width="80" height="80" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`
            : "";
          const fallbackIcon = "";
          const buildingCluster = "";
          const usageBadge = "";
          const markerSvg = buildTileMarkers(tile, cx, cy);
          const tileVisual = `${artSvg}${terrainImage}${buildingImage}${campImage}${fallbackIcon}${buildingCluster}${usageBadge}${markerSvg}`;

          const tileTabIndex = "0";
          const tileAriaLabel = isUnknownTile
            ? "Неизвестный участок. Нажмите, чтобы исследовать."
            : `${tile.name} (${tileStateLabel})`;

          return `<g class="${classes.join(" ")}" data-tile-id="${tile.id}" role="button" tabindex="${tileTabIndex}" aria-label="${tileAriaLabel}"${animStyle}><defs><clipPath id="${clipId}"><polygon points="${pts}"/></clipPath></defs><polygon points="${pts}"/>${tileVisual}${surveyBadge}${surveyMarker}${pathTraceMark}${pathMark}${campMarker}${candidateLabel}${stockBadge}</g>`;
        })
        .join("\n");

      const activeTravelOverlay = this._buildTravelOverlaySvg(
        tileCoordById,
        mapState,
      );
      const travelOverlay =
        activeTravelOverlay ||
        `${this._buildRoutePreviewOverlaySvg(tileCoordById, mapState)}${this._buildIdleCharacterOverlaySvg(tileCoordById, mapState)}`;
      svgEl.innerHTML = `${defsSvg}${backdropSvg}${tileGroups}${travelOverlay}`;

      const inlineActionHost = document.getElementById(
        "camp-map-inline-action-host",
      );
      if (inlineActionHost) {
        const viewBox = svgEl.viewBox?.baseVal || {
          x: -288,
          y: -320,
          width: 576,
          height: 640,
        };
        inlineActionHost.innerHTML = this._buildCampInlineActionOverlayHtml(
          {
            tileCoordById,
            sceneWidth: sceneEl.clientWidth || svgEl.clientWidth || 0,
            sceneHeight: sceneEl.clientHeight || svgEl.clientHeight || 0,
            viewBox: {
              x: viewBox.x,
              y: viewBox.y,
              width: viewBox.width,
              height: viewBox.height,
            },
          },
          {
            selected,
            selectedCampSiteCheck,
            selectedCanFoundBeforeCamp,
            selectedCanMoveHere,
            selectedHasGatherAction,
            selectedIsCharacterTile,
            selectedResourceChoices,
          },
        );
      }

      container
        .querySelectorAll("[data-camp-inline-dismiss]")
        .forEach((dismissButton) => {
          dismissButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this._campInlineActionDismissedTileId = selected.id;
            if (inlineActionHost) inlineActionHost.innerHTML = "";
          });
        });

      container
        .querySelectorAll("[data-camp-inline-action]")
        .forEach((actionButton) => {
          actionButton.addEventListener("click", () => {
            if (actionButton.getAttribute("aria-disabled") === "true") {
              this.render({ forcePanels: true });
              return;
            }
            this._campInlineActionDismissedTileId = selected.id;

            const actionKind = actionButton.getAttribute(
              "data-camp-inline-action",
            );
            if (actionKind === "found") {
              this.openCampFoundConfirm(selected.id);
              return;
            }

            if (actionKind === "visit") {
              if (!this._startCampTileVisit(selected.id)) {
                this.render({ forcePanels: true });
              }
              return;
            }

            if (actionKind === "gather") {
              const resourceId =
                actionButton.getAttribute("data-resource-id") || "";
              const actionId =
                actionButton.getAttribute("data-action-id") || "";
              const choiceDetails = resourceId
                ? this._getCampGatherChoiceDetails(
                    selected,
                    resourceId,
                    actionId,
                  )
                : selected;
              if (this.game.getCharacterTileId?.() === selected.id) {
                const ok = this.game.performCampTileAction(selected.id, {
                  ...(actionId ? { actionId } : {}),
                  ...(resourceId ? { resourceId } : {}),
                });
                if (ok) this._clearCampInterruptedTravelAction();
                this.render({ forcePanels: true });
                return;
              }
              if (
                !this._startCampTileTravel(choiceDetails, {
                  ...(actionId ? { actionId } : {}),
                  ...(resourceId ? { resourceId } : {}),
                })
              ) {
                this.render({ forcePanels: true });
              }
            }
          });
        });

      sceneEl.addEventListener("click", (event) => {
        if (event.target !== sceneEl && event.target !== svgEl) return;
        if (!inlineActionHost?.innerHTML) return;
        this._campInlineActionDismissedTileId = selected.id;
        inlineActionHost.innerHTML = "";
      });

      for (const tile of mapState.tiles) {
        const group = svgEl.querySelector(`[data-tile-id="${tile.id}"]`);
        if (!group) continue;

        if (this._isCampTileUnknownState(tile.state)) {
          const canExploreUnknown =
            typeof this.game.canExploreCampTile === "function"
              ? this.game.canExploreCampTile(tile.id)
              : !tile.presentationLocked;
          if (tooltipEl) {
            const unknownTipLines = [
              "🌫️ Неизвестный участок",
              tile.presentationLockHint ||
                this.game.getCampTileUnlockHint?.(tile.id) ||
                "Туман скрывает подробности местности.",
            ];
            if (canExploreUnknown) {
              unknownTipLines.push(
                "Клик — показать маршрут. Двойной клик — отправить персонажа.",
              );
            } else {
              unknownTipLines.push(
                "Сначала нужен соседний открытый участок или понятный проход.",
              );
            }
            const unknownTip = this.formatTooltipText(unknownTipLines);
            group.addEventListener("mouseenter", () => {
              this._showTooltipDelayed(tooltipEl, unknownTip);
            });
            group.addEventListener("mousemove", (e) => {
              const rect = sceneEl.getBoundingClientRect();
              const tx = e.clientX - rect.left + 14;
              const ty = e.clientY - rect.top - 48;
              tooltipEl.style.left = `${Math.max(0, Math.min(tx, rect.width - 240))}px`;
              tooltipEl.style.top = `${Math.max(0, ty)}px`;
            });
            group.addEventListener("mouseleave", () => {
              this._hideTooltip(tooltipEl);
            });
          }
          group.addEventListener("click", (event) => {
            if (event.detail > 1) return;
            group.blur?.();
            if (canExploreUnknown && !this._campTravelAction) {
              if (this._campRoutePreviewClickTimer) {
                clearTimeout(this._campRoutePreviewClickTimer);
              }
              this._campRoutePreviewClickTimer = setTimeout(() => {
                this._campRoutePreviewClickTimer = null;
                this.game.selectCampTile?.(tile.id);
                if (this._campInlineActionDismissedTileId !== tile.id) {
                  this._campInlineActionDismissedTileId = "";
                }
                this._setCampRoutePreview(tile.id, "explore", {
                  render: true,
                });
              }, 170);
            }
          });
          group.addEventListener("dblclick", (event) => {
            event.preventDefault();
            if (this._campRoutePreviewClickTimer) {
              clearTimeout(this._campRoutePreviewClickTimer);
              this._campRoutePreviewClickTimer = null;
            }
            group.blur?.();
            if (canExploreUnknown && !this._campTravelAction) {
              this.game.selectCampTile?.(tile.id);
              this._campInlineActionDismissedTileId = "";
              this._startCampTileExplore(tile.id);
            }
          });
          continue;
        }
        if (tile.state === "camp_candidate") {
          tipText = this.formatTooltipText([
            `📍 ${tile.name}`,
            tile.description,
            tile.campCandidateHint || "Здесь можно основать лагерь.",
            "▶ Нажмите, чтобы выбрать это место",
          ]);
        } else {
          const canExploreTooltipNow =
            showSurveyLayer &&
            typeof this.game.canExploreCampTile === "function" &&
            this.game.canExploreCampTile(tile.id);
          const terrainLine = tile.terrainName || tile.terrainLabel || "";
          const lines = [
            tile.name,
            terrainLine ? `Местность: ${terrainLine}` : "",
            tile.description,
          ];
          if (tile.visibleMarkers?.length) {
            lines.push(
              `Метки: ${tile.visibleMarkers
                .map((marker) => this.getCampTileMarkerLabel(marker))
                .join(", ")}`,
            );
          }
          if (canExploreTooltipNow) {
            lines.push("Разведка доступна сейчас.");
          }
          if (tile.resourceType) {
            const resourceName = this.getResourceDisplayName(tile.resourceType);
            const resourceIcon = this.getResourceDisplayIcon(tile.resourceType);
            const stockText = Number.isFinite(tile.resourceRemaining)
              ? ` · запас ${tile.resourceRemaining}/${tile.resourceCapacity}`
              : "";
            lines.push(`Ресурс: ${resourceIcon} ${resourceName}${stockText}`);
          }
          if (tile.knownPotentials?.length) {
            lines.push(
              `Известно: ${tile.knownPotentials
                .map((potential) => potential.label)
                .join(", ")}`,
            );
          }
          const roleMeta = this.getCampTileRoleMeta(tile);
          if (roleMeta) {
            lines.push(`Роль: ${roleMeta.label}`);
            if (roleMeta.description) {
              lines.push(roleMeta.description);
            }
          }
          if (tile.actionId) {
            const action = this.data.gatherActions[tile.actionId];
            const actionCopy = this.getGatherActionCopy(action);
            const actionIcon = this.getPlainIcon(actionCopy.icon, "•");
            const profile = this.game.getGatherProfile(tile.actionId, {
              tileId: tile.id,
            });
            lines.push(`Действие: ${actionIcon} ${actionCopy.name}`);
            if (profile) {
              lines.push(
                `Выход: ${this.formatResourcePairsPlain(profile.output, { plus: true })}`,
              );
              lines.push(`Цена: -${profile.energyCost} энергии`);
              if (profile.blockedReason) lines.push(profile.blockedReason);
            }
          }
          if (tile.buildUsage?.capacity > 0 && tile.buildUsage.used > 0) {
            lines.push(
              `Занятость: ${tile.buildUsage.used}/${tile.buildUsage.capacity}`,
            );
          }
          if (tile.placedBuildings?.length) {
            const buildingNames = tile.placedBuildings
              .map((entry) => {
                const buildingCopy = this.getBuildingCopy(entry.def);
                return `${buildingCopy.icon} ${buildingCopy.name}`;
              })
              .join(", ");
            lines.push(`Постройки: ${buildingNames}`);
          } else if (tile.buildingId) {
            const buildingCopy = this.getBuildingCopy(tile.building);
            lines.push(`Постройка: ${buildingCopy.icon} ${buildingCopy.name}`);
          } else if (
            Array.isArray(tile.buildOptions) &&
            tile.buildOptions.length > 0
          ) {
            const optionNames = tile.buildOptions
              .map((bid) => {
                const building = this.data.buildings[bid];
                return building ? this.getBuildingCopy(building).name : bid;
              })
              .join(", ");
            lines.push(`Участок: ${optionNames}`);
          }
          tipText = this.formatTooltipText(lines);
        }

        if (tooltipEl) {
          group.addEventListener("mouseenter", () => {
            this._showTooltipDelayed(tooltipEl, tipText);
            // Pre-camp: advance intro 1→2 when hovering a candidate, and
            // show preview of tiles that would be revealed after the choice.
            if (tile.state === "camp_candidate") {
              // Mark this candidate as surveyed (ritual quest requirement)
              const becameSurveyed = this.game.markCampCandidateSurveyed(
                tile.id,
              );
              if (
                this.game.getCampIntroStep() === 1 &&
                this.game.advanceCampIntro()
              ) {
                this.render({ forcePanels: true });
                return;
              }
              if (becameSurveyed) {
                this.render({ forcePanels: true });
              }
              const previewIds = this.game.getCampCandidatePreviewTiles(
                tile.id,
              );
              for (const pid of previewIds) {
                svgEl
                  .querySelector(`[data-tile-id="${pid}"]`)
                  ?.classList.add("is-preview-reach");
              }
              group.classList.add("is-preview-source");
            }
          });
          group.addEventListener("mousemove", (e) => {
            const rect = sceneEl.getBoundingClientRect();
            const tx = e.clientX - rect.left + 14;
            const ty = e.clientY - rect.top - 48;
            tooltipEl.style.left = `${Math.max(0, Math.min(tx, rect.width - 240))}px`;
            tooltipEl.style.top = `${Math.max(0, ty)}px`;
          });
          group.addEventListener("mouseleave", () => {
            this._hideTooltip(tooltipEl);
            if (tile.state === "camp_candidate") {
              svgEl
                .querySelectorAll(".is-preview-reach")
                .forEach((el) => el.classList.remove("is-preview-reach"));
              group.classList.remove("is-preview-source");
            }
          });
        }

        group.addEventListener("click", (event) => {
          if (event.detail > 1) return;
          group.blur?.();
          if (this._campRoutePreviewClickTimer) {
            clearTimeout(this._campRoutePreviewClickTimer);
          }
          this._campRoutePreviewClickTimer = setTimeout(() => {
            this._campRoutePreviewClickTimer = null;
            // Founded camp tile: open camp management screen.
            if (tile.state === "camp") {
              this.game.selectCampTile(tile.id);
              this._campInlineActionDismissedTileId = "";
              if (!(this.game.isCharacterAtCamp?.() ?? true)) {
                if (!this._startCampReturnTrip()) {
                  this.render({ forcePanels: true });
                }
                return;
              }
              this.openCampScreen();
              return;
            }
            // Other tiles: click only selects. Action is explicit via right panel
            // so gather spam/misclicks are less likely.
            const previousSelectedId = selected?.id || "";
            this.game.selectCampTile(tile.id);
            if (previousSelectedId !== tile.id) {
              this._campInlineActionDismissedTileId = "";
            }
            const previewKind =
              tile.terrainSeen && this.game.canExploreCampTile?.(tile.id)
                ? "explore"
                : tile.action || tile.actionId
                  ? "action"
                  : "inspect";
            this._setCampRoutePreview(tile.id, previewKind);
            this.render({ forcePanels: true });
          }, 170);
        });
        group.addEventListener("dblclick", (event) => {
          event.preventDefault();
          if (this._campRoutePreviewClickTimer) {
            clearTimeout(this._campRoutePreviewClickTimer);
            this._campRoutePreviewClickTimer = null;
          }
          group.blur?.();
          if (this._campTravelAction) return;
          if (tile.terrainSeen && this.game.canExploreCampTile?.(tile.id)) {
            this._campInlineActionDismissedTileId = "";
            if (!this._startCampTileExplore(tile.id)) {
              this.render({ forcePanels: true });
            }
            return;
          }
          const tileDetails = this.game.getCampMapTileDetails(tile.id);
          if (tileDetails?.action) {
            this.game.selectCampTile(tile.id);
            this._campInlineActionDismissedTileId = "";
            if (!this._startCampTileTravel(tileDetails)) {
              this.render({ forcePanels: true });
            }
          }
        });
      }
    }
  },
});
