// Camp map rendering, travel animation, tile interaction.

Object.assign(UI.prototype, {
  _isCampRouteEstimateState(state) {
    return (
      state === "hidden" || state === "silhouette" || state === "visible_locked"
    );
  },

  _getCampTravelPathTo(tileId, { allowFallback = true } = {}) {
    const originTileId = this._getCampHomeTileIdForPath();
    if (!originTileId || !tileId) return [originTileId, tileId].filter(Boolean);
    const path = this.game._findCampHexPath?.(originTileId, tileId, {
      allowFallback,
    });
    if (Array.isArray(path) && path.length > 0) return path;
    return allowFallback ? [originTileId, tileId].filter(Boolean) : [];
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
    const cooldown = this.game.getCooldownRemaining?.(details.action.id) || 0;
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

  _getCampGatherChoiceDetails(details, resourceId) {
    if (!details?.action || !resourceId) return details;
    const gatherProfile = this.game.getGatherProfile?.(details.action.id, {
      tileId: details.id,
      resourceId,
    });
    return {
      ...details,
      gatherResourceId: resourceId,
      gatherProfile,
      canGather: gatherProfile
        ? this.game.canGather?.(details.action.id, {
            tileId: details.id,
            resourceId,
          }) || false
        : false,
    };
  },

  _getCampGatherResourceChoices(details) {
    if (!details?.action?.output) return [];
    return Object.keys(details.action.output)
      .filter((resourceId) => Number(details.action.output[resourceId]) > 0)
      .map((resourceId) => {
        const choiceDetails = this._getCampGatherChoiceDetails(
          details,
          resourceId,
        );
        const profile = choiceDetails.gatherProfile || null;
        return {
          id: resourceId,
          icon: this.getResourceDisplayIcon(resourceId),
          name: this.getResourceDisplayName(resourceId),
          profile,
          details: choiceDetails,
          output: profile?.output || { [resourceId]: 0 },
          canGather: !!choiceDetails.canGather,
          disabledReason: this._getCampGatherDisabledReason(choiceDetails),
        };
      });
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

  _startCampTileTravel(details, options = {}) {
    if (!details?.action || this._campTravelAction) return false;
    const gatherResourceId =
      options.resourceId ||
      details.gatherResourceId ||
      details.resourceId ||
      null;
    const travelDetails = gatherResourceId
      ? this._getCampGatherChoiceDetails(details, gatherResourceId)
      : details;
    if (!travelDetails.canGather) return false;

    const path = this._getCampTravelPathTo(travelDetails.id);
    const routeMetrics = this._getCampPathTravelMetrics(path);
    const travelPlan = this._getCampTravelPlan(travelDetails, routeMetrics);
    if (!travelPlan.totalMs) return false;

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
      startAt,
      outboundMs: travelPlan.outboundMs,
      gatherMs: travelPlan.gatherMs,
      returnMs: travelPlan.returnMs,
      outboundEndsAt,
      gatherEndsAt,
      endsAt: gatherEndsAt + travelPlan.returnMs,
      path,
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
    const path = this.game._findCampHexPath?.(originTileId, tileId, {
      allowFallback: false,
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

    if (task.isReturnTrip) {
      revealTravelPath({ includeDestination: false });
      this.game.arriveCharacterAtTile?.(task.tileId);
      this.game.unloadTripInventory?.({ silent: false });
      this.game.selectCampTile?.(task.tileId);
      this.render({ forcePanels: true });
      return;
    }

    revealTravelPath({ includeDestination: false });
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
    const path = this._getCampTravelPathTo(tileId, { allowFallback: false });
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

    return `<g class="camp-map-travel-layer is-idle" aria-hidden="true">
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
        _prevOverlayState === _currentOverlayState
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
      ? this.game.getCooldownRemaining(selected.action.id)
      : 0;
    const activeTravel = this._campTravelAction;
    const selectedTravel =
      activeTravel && activeTravel.tileId === selected.id ? activeTravel : null;
    const selectedTravelState = selectedTravel
      ? this._getCampTravelPhaseState(selectedTravel)
      : null;
    const selectedRoutePath = selected.action
      ? this._getCampTravelPathTo(selected.id)
      : [];
    const selectedRouteMetrics =
      this._getCampPathTravelMetrics(selectedRoutePath);
    const selectedTravelPlan = selected.action
      ? this._getCampTravelPlan(selected, selectedRouteMetrics)
      : { outboundMs: 0, gatherMs: 0, totalMs: 0 };
    const selectedTravelDurationMs = selectedTravelPlan.totalMs;
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
    } else if (!mapState.campSetupDone && selectedCampSiteCheck.ok) {
      const foundCheck = this.game.canFoundCamp();
      const foundCost = foundCheck.cost;
      const foundEnergy = foundCheck.energyCost;
      const foundCostStr = this.formatResourcePairs(foundCost);
      const missingLines = [];
      for (const [resId, amount] of Object.entries(
        foundCheck.missingResources || {},
      )) {
        missingLines.push(
          `Не хватает ${this.getResourceDisplayIcon(resId)} ${this.getResourceDisplayName(resId)}: ${amount}`,
        );
      }
      if (foundCheck.lacksEnergy) missingLines.push("⚡ Недостаточно сил");
      const disabled = !foundCheck.ok;
      detailsActionBlock = `
        <div class="camp-map-action-meta">
          <span>Тип места: ${selectedTerrainLabel}</span>
          <span>${selected.campCandidateHint || "Здесь можно основать лагерь, если материалы уже готовы."}</span>
          ${selectedCampSiteCheck.recommended ? `<span>Рекомендованное место, но не обязательный выбор.</span>` : `<span>Свободный выбор: лагерь можно поставить на любом открытом подходящем участке.</span>`}
        </div>
        ${
          missingLines.length > 0
            ? `<div class="camp-map-note is-empty">Не хватает материалов — соберите ресурсы и при перегрузе вернитесь к ночёвке, чтобы сгрузить рюкзак.</div>`
            : `<div class="camp-map-note is-built">Материалы готовы — можно основать лагерь</div>`
        }
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn${disabled ? " disabled" : ""}"
          type="button"
          ${disabled ? "disabled" : ""}
          aria-disabled="${disabled ? "true" : "false"}"
        >
          🏕️ Основать лагерь здесь
        </button>
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
    } else if (selected.action && selectedActionCopy) {
      const travelingOtherTile = activeTravel && !selectedTravel;
      const gatherDisabled =
        selectedHasResourceChoice || !selected.canGather || !!activeTravel;
      const gatherBtnLabel = selectedTravelState
        ? `🧍 ${selectedTravelState.phaseLabel}`
        : travelingOtherTile
          ? "🧍 Персонаж уже в выходе"
          : selectedHasResourceChoice
            ? "Выберите ресурс ниже"
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
                  const choiceDisabled =
                    !choice.canGather ||
                    !!activeTravel ||
                    selectedActionCooldown > 0;
                  const choiceReason =
                    selectedActionCooldown > 0
                      ? `Нужно подождать ещё ${this.formatCooldownMs(selectedActionCooldown)}.`
                      : choice.disabledReason || "";
                  return `
                    <button
                      class="camp-map-resource-choice-btn${choiceDisabled ? " disabled" : ""}"
                      type="button"
                      data-resource-id="${choice.id}"
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
                  `;
                })
                .join("")}
            </div>
          </div>`
        : "";

      detailsActionBlock = `
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
          selectedActionCooldown > 0
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
        detailsActionBlock += `
          <div class="camp-map-note is-progress">
            Логистика пути: ${selectedPathProject.deliveryTrips > 1 ? `${selectedPathProject.deliveryTrips} ходки · Σ ${this.formatNumber(selectedPathProject.totalLoad || 0)}` : `${this.formatNumber(selectedPathProject.load || 0)} / ${this.formatNumber(selectedPathProject.carryCapacity || this.game.getCharacterCarryCapacity())}`}
          </div>
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

    const topLegendHtml = `
      <div class="camp-map-top-legend" aria-label="Легенда карты">
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-camp"></span>${homeLegendLabel}</span>
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-here"></span>Вы здесь</span>
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-trail"></span>Тропы</span>
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-open"></span>Доступно</span>
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-locked"></span>Неизвестно</span>
      </div>
    `;

    const sideLegendHtml = `
      <aside class="camp-map-side-legend" aria-label="Типы участков карты">
        <div class="camp-map-side-title">Легенда</div>
        <div class="camp-map-side-list">
          <span><span class="map-symbol map-symbol-camp"></span>${homeLegendLabel}</span>
          <span><span class="map-symbol map-symbol-here"></span>Вы здесь</span>
          <span><span class="map-symbol map-symbol-trail"></span>Тропа</span>
          <span><span class="map-symbol map-symbol-open"></span>Природный участок</span>
          <span><span class="map-symbol map-symbol-locked"></span>Неизвестно</span>
        </div>
        <div class="camp-map-tip-card">Серые клетки неизвестны. Клик показывает путь, двойной клик отправляет персонажа на разведку.</div>
      </aside>
    `;

    const mapFooterHint = mapState.campSetupDone
      ? `${mapState.interactionHint} Клик по участку показывает маршрут; двойной клик отправляет персонажа.`
      : "Сначала выберите место стоянки. Открытые клетки показывают первые находки, а тёмные зоны станут понятнее после основания лагеря.";

    const fallbackQuickTile = !selected.action
      ? mapState.tiles
          .map((tile) => this.game.getCampMapTileDetails(tile.id))
          .find(
            (tile) =>
              tile?.action &&
              tile.state !== "hidden" &&
              tile.state !== "silhouette" &&
              tile.state !== "visible_locked" &&
              tile.state !== "camp_candidate" &&
              !tile.isDepleted,
          ) || null
      : null;
    const quickTile = selected.action ? selected : fallbackQuickTile;
    const routePreview = !activeTravel ? this._campRoutePreview || null : null;
    const routePreviewCanExplore =
      routePreview?.tileId &&
      routePreview.kind === "explore" &&
      (this.game.canExploreCampTile?.(routePreview.tileId) || false);
    let mapQuickActionHtml = "";
    if (routePreviewCanExplore) {
      const routeSteps = Math.max(1, (routePreview.path?.length || 1) - 1);
      const routeMetrics = this._getCampPathTravelMetrics(routePreview.path);
      const routeWalkMs = this._getCampRouteWalkDurationMs(routeMetrics, {
        setupMs: 280,
        minMs: 900,
        maxMs: 180000,
        extraCoef: 1.05,
      });
      const routeDistanceLabel = routeMetrics.distanceMeters
        ? ` · ${routeMetrics.distanceMeters} м`
        : "";
      const routeApproxLabel = routeMetrics.isApproximate ? "примерно " : "";
      const routeClarification = routeMetrics.isApproximate
        ? " Время уточнится по мере разведки."
        : "";
      mapQuickActionHtml = `
        <div class="camp-map-quick-action is-route-preview">
          <button
            id="camp-map-route-command"
            class="camp-map-quick-action-btn"
            type="button"
            data-tile-id="${routePreview.tileId}"
            aria-disabled="false"
          >
            🧭 Отправить на разведку
          </button>
          <div class="camp-map-quick-action-meta">Маршрут: ${routeApproxLabel}${routeSteps} ${routeSteps === 1 ? "переход" : "перехода"}${routeDistanceLabel} · ${this._formatCampRouteTimeLabel(routeWalkMs, routeMetrics)}. ${routeMetrics.terrainSummary || "Местность без особых помех"}.${routeClarification} Персонаж останется на месте осмотра.</div>
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
      const quickDisabled =
        quickNeedsResourceChoice || !quickTile.canGather || !!activeTravel;
      const quickRoutePath = this._getCampTravelPathTo(quickTile.id);
      const quickRouteMetrics = this._getCampPathTravelMetrics(quickRoutePath);
      const quickTravelPlan = this._getCampTravelPlan(
        quickTile,
        quickRouteMetrics,
      );
      const quickDisabledReason =
        quickDisabled && !quickTravelState && !activeTravel
          ? this._getCampGatherDisabledReason(quickTile)
          : "";
      const quickLabel = selectedTravelState
        ? `🧭 ${selectedTravelState.phaseLabel}`
        : quickTravelState
          ? `🧭 ${quickTravelState.phaseLabel}`
          : activeTravel
            ? "🧭 Персонаж уже занят"
            : quickNeedsResourceChoice
              ? "Выберите ресурс справа"
              : `${quickActionCopy.icon} Собрать ресурсы`;
      const quickMeta = quickActionProfile
        ? quickNeedsResourceChoice
          ? [
              selected.action ? "" : `Участок: ${quickTile.name}`,
              `Доступно: ${quickResourceChoices.map((choice) => choice.name).join(", ")}`,
              "Сначала выберите конкретный ресурс в правой панели.",
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
          <button
            id="camp-map-quick-gather-action"
            class="camp-map-quick-action-btn"
            type="button"
            data-tile-id="${quickTile.id}"
            ${quickDisabled ? "disabled" : ""}
            aria-disabled="${quickDisabled ? "true" : "false"}"
          >
            ${quickLabel}
          </button>
          <div class="camp-map-quick-action-meta">${quickMeta}</div>
        </div>
      `;
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

    // ── Just-founded pulse: detect campSetupDone going false → true ──
    let justFoundedFlag = false;
    if (mapState.campSetupDone && this._prevCampSetupDone === false) {
      justFoundedFlag = true;
    }
    this._prevCampSetupDone = !!mapState.campSetupDone;

    container.innerHTML = `
      <div class="camp-map-header">
        <div>
          <h3>${mapState.title}</h3>
          <div class="camp-map-description">${mapState.description}</div>
        </div>
        <div class="camp-map-header-right">
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
        ${sideLegendHtml}
        <div class="camp-map-scene-wrap${!mapState.campSetupDone ? " is-pre-camp" : ""}${justFoundedFlag ? " camp-just-founded" : ""}">
          <div class="camp-map-scene${!mapState.campSetupDone && mapState.introStep?.index === 0 ? " is-arriving" : ""}" id="camp-map-scene">
            <svg id="camp-map-svg" class="camp-map-svg"
                 width="100%" height="100%"
                 viewBox="-288 -320 576 640"
                 preserveAspectRatio="xMidYMid meet"
                 xmlns="http://www.w3.org/2000/svg"></svg>
            <div id="camp-map-tooltip" class="camp-map-tooltip" hidden></div>
            ${introOverlayHtml}
          </div>
          <div class="camp-map-legend">${mapFooterHint}</div>
          ${mapQuickActionHtml}
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
          ${selectedBuildUsageHtml}
          ${selectedMarkersHtml}
          ${selectedPotentialsHtml}
          ${selectedRoleHtml}
          ${detailsActionBlock}
        </aside>
      </div>
    `;

    const primaryAction = document.getElementById("camp-map-primary-action");
    if (primaryAction) {
      primaryAction.addEventListener("click", () => {
        // Camp site / camp tile: open modals even when disabled,
        // so the player can see the missing-resources explanation.
        if (!mapState.campSetupDone && selectedCampSiteCheck.ok) {
          this.openCampFoundConfirm(selected.id);
          return;
        }
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
          if (!this._startCampTileTravel(selected)) {
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

    document
      .querySelectorAll(".camp-map-resource-choice-btn")
      .forEach((choiceButton) => {
        choiceButton.addEventListener("click", () => {
          if (choiceButton.getAttribute("aria-disabled") === "true") {
            this.render({ forcePanels: true });
            return;
          }
          const resourceId = choiceButton.getAttribute("data-resource-id");
          const choiceDetails = this._getCampGatherChoiceDetails(
            selected,
            resourceId,
          );
          if (!this._startCampTileTravel(choiceDetails, { resourceId })) {
            this.render({ forcePanels: true });
          }
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
        const quickDetails = this.game.getCampMapTileDetails(quickTileId);
        if (quickDetails?.id) this.game.selectCampTile(quickDetails.id);
        if (quickDetails?.action && !this._startCampTileTravel(quickDetails)) {
          this.render({ forcePanels: true });
        }
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
        if (!this._startCampTileExplore(routeTileId)) {
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
        return "";
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
          if (tile.selected) classes.push("is-selected");
          if (tile.building || tile.placedBuildings?.length) {
            classes.push("has-building");
          }
          if (tile.construction) classes.push("is-constructing");
          if (tile.isDepleted) classes.push("is-depleted");
          if (tile.pathLevel && tile.pathLevel !== "none") {
            classes.push(`has-path-${tile.pathLevel}`);
          }
          if (tile.isCampCandidate || tile.state === "camp_candidate") {
            classes.push("is-candidate-flag");
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

          const stockBadge = "";

          const candidateLabel =
            tile.state === "camp_candidate" && tile.shortLabel
              ? `<text class="tile-label" x="${cx.toFixed(1)}" y="${(cy + 22).toFixed(1)}">${tile.shortLabel}</text>`
              : "";

          const pathMark =
            tile.pathLevel && tile.pathLevel !== "none" && !isUnknownTile
              ? `<path class="tile-path-mark" d="M ${(cx - 24).toFixed(1)} ${(cy + 21).toFixed(1)} C ${(cx - 10).toFixed(1)} ${(cy + 11).toFixed(1)}, ${(cx + 7).toFixed(1)} ${(cy + 27).toFixed(1)}, ${(cx + 24).toFixed(1)} ${(cy + 14).toFixed(1)}" />`
              : "";
          const campMarker =
            tile.state === "camp"
              ? `<circle class="tile-camp-marker" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9.5" />`
              : "";
          const selectedMarker =
            tile.selected && !isUnknownTile
              ? `<circle class="tile-here-marker" cx="${cx.toFixed(1)}" cy="${(cy + 20).toFixed(1)}" r="6.5" />`
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

          return `<g class="${classes.join(" ")}" data-tile-id="${tile.id}" role="button" tabindex="${tileTabIndex}" aria-label="${tileAriaLabel}"${animStyle}><defs><clipPath id="${clipId}"><polygon points="${pts}"/></clipPath></defs><polygon points="${pts}"/>${tileVisual}${pathMark}${campMarker}${selectedMarker}${candidateLabel}${stockBadge}</g>`;
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
            // Pre-camp: any open suitable non-resource tile can become camp.
            if (this.game.canUseTileAsCampSite?.(tile.id)?.ok) {
              this.openCampFoundConfirm(tile.id);
              return;
            }
            // Founded camp tile: open camp management screen.
            if (tile.state === "camp") {
              this.game.selectCampTile(tile.id);
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
            this.game.selectCampTile(tile.id);
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
            if (!this._startCampTileExplore(tile.id)) {
              this.render({ forcePanels: true });
            }
            return;
          }
          const tileDetails = this.game.getCampMapTileDetails(tile.id);
          if (tileDetails?.action) {
            this.game.selectCampTile(tile.id);
            if (!this._startCampTileTravel(tileDetails)) {
              this.render({ forcePanels: true });
            }
          }
        });
      }
    }
  },
});
