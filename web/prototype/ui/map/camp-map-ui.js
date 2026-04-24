// Camp map rendering, travel animation, tile interaction.

Object.assign(UI.prototype, {
  _getCampTravelPlan(details) {
    if (!details || !details.action) {
      return { outboundMs: 0, gatherMs: 0, returnMs: 0, totalMs: 0 };
    }

    const profile = details.gatherProfile || null;
    const routeDistance = Math.max(
      0,
      Number.isFinite(profile?.routeDistance)
        ? profile.routeDistance
        : details.distanceFromCamp || 0,
    );
    const trips = Math.max(1, Number(profile?.deliveryTrips || 1));
    const terrainPenalty = Math.max(0, Number(profile?.terrainPenalty || 0));
    const distancePenalty = Math.max(0, Number(profile?.distancePenalty || 0));
    const loadPenalty = Math.max(0, Number(profile?.loadPenalty || 0));
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
    const gatherDurationMs =
      Number(profile?.gatherDurationMs) ||
      this.game.getGatherDuration?.(details.action.id, {
        profile,
        tileId: details.id,
      }) ||
      Math.max(900, Number(details.action.cooldown || 1200));

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
    const researchedCount = Object.keys(this.game.researched || {}).length;
    const builtCount = Object.keys(this.game.buildings || {}).length;
    const isEarlyStage = researchedCount <= 2 && builtCount <= 2;

    // Ключевые коэффициенты логистики: путь, местность, нагрузка, состояние.
    const terrainCoef = 1 + terrainPenalty * 0.14;
    const distanceCoef = 1 + routeDistance * 0.11 + distancePenalty * 0.12;
    const pathCoef = noPath ? 1.2 : details.pathData?.id === "trail" ? 0.9 : 1;
    const conditionCoef = 1 + (1 - condition) * 0.58;
    const stageCoef = isEarlyStage && routeDistance > 0 ? 1.28 : 1;
    const skillCoef = Math.max(
      0.68,
      1 -
        fieldcraft * 0.045 -
        Math.max(0, endurance - 1) * 0.028 -
        Math.max(0, mobility - 1) * 0.035,
    );
    const strengthLoadCoef = Math.max(
      0.82,
      1 - Math.max(0, strength - 1) * 0.04,
    );

    const baseLegMs = 1120 + Math.max(0, trips - 1) * 160;
    const outboundMs = Math.round(
      Math.max(
        900,
        Math.min(
          6200,
          baseLegMs *
            terrainCoef *
            distanceCoef *
            pathCoef *
            conditionCoef *
            stageCoef *
            skillCoef,
        ),
      ),
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
          (Math.max(850, gatherDurationMs * 0.84) + 220) *
            gatherCoef *
            conditionCoef *
            0.9,
        ),
      ),
    );

    const returnLoadCoef =
      1 +
      loadRatio * 0.42 * strengthLoadCoef +
      loadPenalty * 0.14 +
      (profile?.limitedByCarry ? 0.16 : 0);
    const returnMs = Math.round(
      Math.max(1000, Math.min(7800, outboundMs * returnLoadCoef)),
    );

    return {
      outboundMs,
      gatherMs,
      returnMs,
      totalMs: outboundMs + gatherMs + returnMs,
    };
  },

  _estimateCampActionTravelMs(details) {
    return this._getCampTravelPlan(details).totalMs;
  },

  _getCampTravelPhaseState(travelAction, now = Date.now()) {
    if (!travelAction) return null;

    const totalRemainingMs = Math.max(0, travelAction.endsAt - now);
    if (now < travelAction.outboundEndsAt) {
      return {
        phase: "outbound",
        phaseLabel: "Переход к участку",
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
        phaseLabel: "Сбор ресурсов",
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

  _startCampTileTravel(details) {
    if (!details?.action || this._campTravelAction) return false;

    const travelPlan = this._getCampTravelPlan(details);
    if (!travelPlan.totalMs) return false;

    const startAt = Date.now();
    const outboundEndsAt = startAt + travelPlan.outboundMs;
    const gatherEndsAt = outboundEndsAt + travelPlan.gatherMs;

    // Tile-by-tile path for animation
    const homeTileId = this._getCampHomeTileIdForPath();
    const path = homeTileId
      ? this.game._findCampHexPath(homeTileId, details.id)
      : [homeTileId, details.id].filter(Boolean);
    const pathTimings = this._computePathTimings(path);
    const reversedPath = path.length > 1 ? [...path].reverse() : path;
    const returnTimings = this._computePathTimings(reversedPath);

    this._campTravelAction = {
      tileId: details.id,
      actionId: details.action.id,
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

  _scheduleCampTileTravelTick() {
    if (!this._campTravelAction) return;
    if (this._campTravelTimer) clearTimeout(this._campTravelTimer);

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

    // Exploration travel: just reveal the tile, no gather
    if (task.isExplore) {
      this.game.discoverCampTile(task.tileId);
      // Select the newly discovered tile so the flicker-guard sees a changed
      // selectedTileId and rebuilds the SVG immediately.
      this.game.selectCampTile(task.tileId);
      this.render({ forcePanels: true });
      return;
    }

    const ok = this.game.performCampTileAction(task.tileId);
    this.render({ forcePanels: true });
    if (!ok) return;

    const cooldownMs =
      this.game.getGatherCooldownDuration?.(task.actionId) || 0;
    this._scheduleGatherCooldownRefresh(cooldownMs);
  },

  // Start an exploration trip to a silhouette/unknown tile.
  // Character walks there, reveals it, and stays (no return trip).
  _startCampTileExplore(tileId) {
    if (this._campTravelAction) return false;
    const tile = this.game._getCampMapTile(tileId);
    if (!tile) return false;
    const distance = Math.max(1, this.game._getCampTileLiveDist(tile));
    const startAt = Date.now();
    const outboundMs = Math.round(
      Math.max(900, Math.min(3800, 1000 + distance * 550)),
    );
    const lookMs = 500;

    // Tile-by-tile path for animation
    const homeTileId = this._getCampHomeTileIdForPath();
    const path = homeTileId
      ? this.game._findCampHexPath(homeTileId, tileId)
      : [homeTileId, tileId].filter(Boolean);
    const pathTimings = this._computePathTimings(path);

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
    };
    this._scheduleCampTileTravelTick();
    this.render({ forcePanels: true });
    return true;
  },

  // Find the "home" tile ID for pathfinding: the founded camp tile, or pre-camp origin.
  _getCampHomeTileIdForPath() {
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
    const costs = [];
    for (let i = 1; i < path.length; i++) {
      const tile = this.game._getCampMapTile(path[i]);
      costs.push(this.game._getCampTileMoveCost(tile));
    }
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
  _buildTravelOverlaySvg(tileCoordById, mapState) {
    if (!this._campTravelAction) return "";
    const targetCoord = tileCoordById[this._campTravelAction.tileId] || null;
    const campTile =
      mapState.tiles.find((t) => t.state === "camp") ||
      mapState.tiles.find((t) => t.id === "camp_clearing") ||
      mapState.tiles.find((t) => (t.distanceFromCamp || 0) === 0) ||
      null;
    const startCoord = campTile ? tileCoordById[campTile.id] : null;
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
    const carriedResourceId =
      targetTile?.resourceType ||
      outputIds[0] ||
      (actionId === "gather_supplies" ? "supplies" : "");
    const resourceClass = carriedResourceId
      ? ` resource-${String(carriedResourceId).replace(/[^a-z0-9_-]/gi, "")}`
      : "";

    // ── Tile-by-tile path interpolation ──
    const task = this._campTravelAction;
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
      travelState.phase === "return"
        ? "camp-map-travel-route is-return"
        : "camp-map-travel-route";
    const markerClass =
      travelState.phase === "gather"
        ? "camp-map-travel-marker is-gathering"
        : "camp-map-travel-marker";
    const actionLabel =
      travelState.phase === "gather"
        ? travelState.phaseLabel
        : travelState.phase === "return"
          ? "Несёт добычу"
          : "Идёт к участку";
    const phaseClass = ` phase-${travelState.phase}`;
    const directionClass =
      travelState.phase === "return" ? " facing-home" : " facing-target";
    const bob =
      travelState.phase === "gather" ? 0 : Math.sin(Date.now() / 120) * 1.4;
    const footDust =
      travelState.phase === "gather"
        ? ""
        : `<g class="camp-map-traveler-dust">
            <circle cx="-13" cy="16" r="1.7" />
            <circle cx="12" cy="17" r="1.2" />
          </g>`;
    const gatherFx =
      travelState.phase === "gather"
        ? `<g class="camp-map-gather-fx${resourceClass}">
            <path class="gather-fx-spark a" d="M -18 -4 L -10 -10" />
            <path class="gather-fx-spark b" d="M 13 -8 L 21 -15" />
            <circle class="gather-fx-dot" cx="18" cy="1" r="2" />
          </g>`
        : "";

    return `<g class="camp-map-travel-layer" aria-hidden="true">
      <path class="${routeClass}" d="${routeD}" />
      <circle class="${markerClass}" cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="11" />
      <g class="camp-map-traveler${phaseClass}${directionClass}${resourceClass}" transform="translate(${markerX.toFixed(1)} ${(markerY + bob).toFixed(1)})">
        <ellipse class="traveler-shadow" cx="0" cy="19" rx="14" ry="4.8" />
        ${footDust}
        <g class="traveler-body-wrap">
          <!-- Sleek minimalist icon/meeple body -->
          <path class="traveler-pawn-body" d="M 0 -7 C -9 -5, -11 11, -9 18 C -8 21, -6 20, -4 14 C -3 10, 3 10, 4 14 C 6 20, 8 21, 9 18 C 11 11, 9 -5, 0 -7 Z" />
          <!-- Head -->
          <circle class="traveler-pawn-head" cx="0" cy="-15" r="5.5" />

          <!-- Spear (minimalist) -->
          <path class="traveler-tool" d="M 12 -22 L 10 14" />
          <circle class="traveler-tool-head" cx="12" cy="-22" r="2.5" />

          <!-- Carry items (back, visible on return) -->
          <g class="traveler-carry">
            <path class="carry-wood" d="M -11 -5 L -18 -15 M -8 -6 L -14 -17 M -4 -5 L -10 -16" />
            <path class="carry-sack" d="M -10 0 C -17 3 -15 11 -8 13 C -2 10 -3 2 -10 0 Z" />
            <circle class="carry-water" cx="-11" cy="5" r="4" />
          </g>
        </g>
        ${gatherFx}
      </g>
      <g class="camp-map-travel-label" transform="translate(${markerX.toFixed(1)} ${(markerY - 28).toFixed(1)})">
        <text class="camp-map-travel-action" x="0" y="-8">${actionLabel}</text>
        <text class="camp-map-travel-timer" x="0" y="5">${this.formatCooldownMs(travelState.totalRemainingMs)}</text>
      </g>
    </g>`;
  },

  getCampTileStateLabel(state) {
    switch (state) {
      case "developed":
        return "Освоено";
      case "discovered":
        return "Доступно";
      case "hidden":
        return "Скрыто";
      case "camp":
        return "Лагерь";
      case "camp_candidate":
        return "Место стоянки";
      case "silhouette":
        return "Туман";
      default:
        return "Участок";
    }
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
    if (typeof icon === "string" && !icon.includes("<")) return icon;
    switch (tile?.resourceType || tile?.actionId) {
      case "wood":
      case "gather_wood":
        return "🪵";
      case "stone":
      case "gather_stone":
        return "🪨";
      case "fiber":
      case "gather_fiber":
        return "🌾";
      case "clay":
      case "gather_clay":
        return "🏺";
      case "water":
      case "gather_water":
        return "💧";
      case "food":
      case "gather_food":
        return "🫐";
      default:
        return icon ? "•" : "";
    }
  },

  getCampTileImageHref(tile) {
    if (!tile || tile.state === "hidden" || tile.state === "silhouette") {
      return "";
    }
    // Resource PNG — shown on gatherable tiles (replaces emoji icon)
    const byResource = {
      wood: "wood.png",
      stone: "stone.png",
      fiber: "fiber.png",
      clay: "clay.png",
      water: "water.png",
      food: "food.png",
    };
    // Building PNG — shown when the tile actually carries a built / being-built
    // structure or when the camp is founded here. NOT used for free build slots
    // (candidate tiles) — those show only terrain art until construction starts.
    const byBuild = {
      campfire: "campfire.png",
      rest_tent: "rest_tent.png",
      storage: "storage.png",
      workshop: "workshop.png",
      kiln: "kiln.png",
    };
    // Camp tile — show the founded camp marker. If a campfire is actually
    // built on the camp tile, the campfire PNG (warm glow). Otherwise show
    // the dedicated camp.png (tipi + fire) so the tile reads unambiguously
    // as "лагерь основан", not as a tool or plain tent.
    if (tile.state === "camp") {
      const builtId = tile.building?.id || tile.construction?.buildingId;
      if (builtId === "campfire") {
        return "prototype/assets/icons/campfire.png";
      }
      return "prototype/assets/icons/camp.png";
    }
    if (byResource[tile.resourceType]) {
      return `prototype/assets/icons/${byResource[tile.resourceType]}`;
    }
    if (tile.actionId === "gather_supplies") {
      return "prototype/assets/icons/storage.png";
    }
    const builtId =
      tile.building?.id ||
      tile.construction?.buildingId ||
      tile.nextBuildId ||
      "";
    // Only show a building PNG when something is actually built or under
    // construction. Do NOT use nextBuildId (free build slot) as a fallback —
    // candidate tiles like Поляна/Опушка/Откос should show their terrain
    // backdrop, not a hammer/workshop/storage icon prematurely.
    const isReallyBuilt = !!tile.building || !!tile.construction;
    if (isReallyBuilt && builtId && byBuild[builtId]) {
      return `prototype/assets/icons/${byBuild[builtId]}`;
    }
    // Neutral terrain PNG — shown when no resource / building / camp
    const terrainPng = {
      grove: "forest.png",
      brush: "forest.png",
      clearing: "forest.png",
      grass: "forest.png",
      rocks: "Mountain.png",
      ridge: "Mountain.png",
      water: "Boloto.png",
    };
    const tpng = terrainPng[tile.terrainType];
    if (tpng) return `prototype/assets/icons/${tpng}`;
    return "prototype/assets/icons/forest.png";
  },

  renderCampMap() {
    const container = document.getElementById("camp-map-panel");
    if (!container) return;

    const mapState = this.game.getCampMapState();

    // ── Flicker guard: if the intro overlay is already showing the same step
    //    AND the selected tile hasn't changed, skip full DOM rebuild so CSS
    //    animations don't restart every tick. ──
    const _currentSelectedTile = mapState.selectedTileId || "";
    const _prevSelectedTile = container.dataset.prevSelectedTile ?? null;
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
        _prevSelectedTile === _currentSelectedTile
      ) {
        // If travel is active, update only the SVG travel layer (avoids
        // restarting intro-card CSS animations on every 120ms tick).
        if (this._campTravelAction) {
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
            svgEl2.querySelector(".camp-map-travel-layer")?.remove();
            const ov = this._buildTravelOverlaySvg(coords2, mapState);
            if (ov) svgEl2.insertAdjacentHTML("beforeend", ov);
          }
        }
        return; // same intro step AND same tile — don't re-render
      }
    }
    container.dataset.prevSelectedTile = _currentSelectedTile;

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
    const selectedPlacedBuildingCopy = selected.placedBuilding
      ? this.getBuildingCopy(selected.placedBuilding)
      : null;
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
    const selectedTravelDurationMs = selected.action
      ? this._estimateCampActionTravelMs(selected)
      : 0;

    let detailsActionBlock = "";
    if (selected.construction) {
      detailsActionBlock = `
        <div class="camp-map-note is-progress">
          Строится: ${selected.construction.icon} ${selected.construction.name}
          · ${this.formatSeconds(selected.construction.remainingMs)}
        </div>
      `;
    } else if (selected.placedBuilding && selectedPlacedBuildingCopy) {
      detailsActionBlock = `
        <div class="camp-map-note is-built">
          Постройка на месте: ${selectedPlacedBuildingCopy.icon} ${selectedPlacedBuildingCopy.name}
        </div>
        <div class="camp-map-note">
          ${selectedPlacedBuildingCopy.description || "Этот участок уже включён в лагерь."}
        </div>
      `;
    } else if (selected.state === "camp_candidate") {
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
          <span>${selected.campCandidateHint || "Здесь можно основать лагерь."}</span>
        </div>
        ${
          missingLines.length > 0
            ? `<div class="camp-map-note is-empty">Не хватает материалов — нажмите на участок с ресурсами на карте или используйте панель ниже</div>`
            : `<div class="camp-map-note is-built">Материалы готовы — можно основать лагерь</div>`
        }
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn${disabled ? " disabled" : ""}"
          type="button"
          aria-disabled="${disabled ? "true" : "false"}"
        >
          🏕️ Основать лагерь здесь
        </button>
      `;
    } else if (selected.state === "camp") {
      const enteredLabel = this.game.isCampEntered()
        ? "Вернуться в лагерь"
        : "Войти в лагерь";
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
          <span>Здесь можно заняться внутренним устройством лагеря.</span>
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
          aria-disabled="${campRestProfile.canRest ? "false" : "true"}"
        >
          ${campRestLabel}
        </button>
        <div class="camp-map-note">${campRestProfile.blockedReason || campRestProfile.note}</div>
      `;
    } else if (selected.action && selectedActionCopy) {
      const travelingOtherTile = activeTravel && !selectedTravel;
      const gatherDisabled = !selected.canGather || !!activeTravel;
      const gatherBtnLabel = selectedTravelState
        ? `🧍 ${selectedTravelState.phaseLabel}`
        : travelingOtherTile
          ? "🧍 Персонаж уже в выходе"
          : `${selectedActionCopy.icon} ${selectedActionCopy.name}`;

      detailsActionBlock = `
        <div class="camp-map-action-meta">
          <span>Находка: ${selectedActionOutput}</span>
          <span>Энергия: -${selectedActionProfile?.energyCost ?? selected.action.energyCost}</span>
          ${Number.isFinite(selectedActionProfile?.satietyCost) ? `<span>Сытость: -${this.formatNumber(selectedActionProfile.satietyCost, 2)}</span>` : ""}
          ${Number.isFinite(selectedActionProfile?.hydrationCost) ? `<span>Вода: -${this.formatNumber(selectedActionProfile.hydrationCost, 2)}</span>` : ""}
          <span>Путь: ${selectedActionProfile?.zoneLabel || (selected.distanceFromCamp === 0 ? "центр" : selected.distanceFromCamp === 1 ? "ближняя зона" : "дальний выход")}</span>
          <span>Местность: ${selectedActionProfile?.terrainLabel || "обычный участок"}</span>
          <span>Время сбора: ${this.formatSeconds(selectedActionProfile?.gatherDurationMs || selected.action.cooldown || 0)}</span>
          <span>Логистика: ${this.formatSeconds(selectedTravelDurationMs)} (туда/сбор/обратно)</span>
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
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn${gatherDisabled ? " disabled" : ""}"
          type="button"
          aria-disabled="${gatherDisabled ? "true" : "false"}"
        >
          ${gatherBtnLabel}
        </button>
      `;
      if (selectedResourceStock) {
        detailsActionBlock += `<div class="camp-map-note">Запас участка: ${selectedResourceStock}</div>`;
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
        this.game.isPrologueActive() &&
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
    } else if (
      !mapState.campSetupDone &&
      !selected.actionId &&
      selected.state !== "hidden" &&
      selected.state !== "silhouette"
    ) {
      // Pre-camp: non-resource discovered tile — offer founding here
      const campCheck = this.game.canFoundCamp();
      detailsActionBlock = `
        ${
          campCheck.ok
            ? ""
            : `<div class="camp-map-note is-waiting">Для основания нужны: ${Object.entries(
                campCheck.missingResources || {},
              )
                .map(([r, n]) => `${this.data.resources?.[r]?.icon || r} ×${n}`)
                .join(", ")}${campCheck.lacksEnergy ? " ⚡" : ""}.</div>`
        }
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn${campCheck.ok ? "" : " disabled"}"
          type="button"
          aria-disabled="${campCheck.ok ? "false" : "true"}"
        >
          🏕️ Основать лагерь здесь
        </button>
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

    if (selected.id === "camp_clearing" && mapState.campSetupDone) {
      detailsActionBlock += `
        <button class="camp-map-primary-btn disabled" type="button" style="opacity:0.5; cursor:default;" aria-disabled="true">
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
    const selectedPreviewMedia = selectedImageHref
      ? `<img src="${selectedImageHref}" alt="" aria-hidden="true">`
      : `<span>${selectedDisplayIcon}</span>`;
    const selectedDistanceLabel =
      selected.distanceFromCamp === 0
        ? "Стоянка"
        : `${selected.distanceFromCamp} переход.`;

    const topLegendHtml = `
      <div class="camp-map-top-legend" aria-label="Легенда карты">
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-camp"></span>Лагерь</span>
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-here"></span>Вы здесь</span>
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-trail"></span>Тропы</span>
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-open"></span>Доступно</span>
        <span class="camp-map-top-legend-item"><span class="map-symbol map-symbol-locked"></span>Недоступно</span>
      </div>
    `;

    const sideLegendHtml = `
      <aside class="camp-map-side-legend" aria-label="Типы участков карты">
        <div class="camp-map-side-title">Легенда</div>
        <div class="camp-map-side-list">
          <span><span class="map-symbol map-symbol-camp"></span>Лагерь</span>
          <span><span class="map-symbol map-symbol-here"></span>Вы здесь</span>
          <span><span class="map-symbol map-symbol-trail"></span>Тропа</span>
          <span><span class="legend-hex legend-forest"></span>Лес</span>
          <span><span class="legend-emoji">🫐</span>Кусты / ягоды</span>
          <span><span class="legend-emoji">🌾</span>Поляна</span>
          <span><span class="legend-emoji">🪨</span>Камни</span>
          <span><span class="legend-emoji">🏺</span>Глина</span>
          <span><span class="legend-emoji">💧</span>Вода</span>
          <span><span class="legend-emoji">🪵</span>Ветки</span>
          <span><span class="legend-emoji">🌾</span>Волокно</span>
          <span><span class="legend-emoji">?</span>Неизвестно</span>
        </div>
        <div class="camp-map-tip-card">Наведите курсор на клетку, чтобы узнать больше. Клик выбирает участок и показывает действие справа.</div>
      </aside>
    `;

    const mapFooterHint = mapState.campSetupDone
      ? mapState.interactionHint
      : "Сначала выберите место стоянки. Открытые клетки показывают первые находки, а тёмные зоны станут понятнее после основания лагеря.";

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
        </div>
        <aside class="camp-map-details">
          <div class="camp-map-details-preview terrain-${selected.terrainType || "plain"}">
            ${selectedPreviewMedia}
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
          ${detailsActionBlock}
        </aside>
      </div>
    `;

    const primaryAction = document.getElementById("camp-map-primary-action");
    if (primaryAction) {
      primaryAction.addEventListener("click", () => {
        // Camp candidate / camp tile: open modals even when disabled,
        // so the player can see the missing-resources explanation.
        if (selected.state === "camp_candidate") {
          this.openCampFoundConfirm(selected.id);
          return;
        }
        if (selected.state === "camp") {
          this.openCampScreen();
          return;
        }
        // Pre-camp: non-resource discovered tile — open founding confirm
        if (
          !this.game.isCampSetupDone() &&
          !selected.actionId &&
          selected.state !== "hidden" &&
          selected.state !== "silhouette"
        ) {
          this.openCampFoundConfirm(selected.id);
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
          ${state === "silhouette" ? `<text class="tile-art-question" x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}">?</text>` : ""}
        </g>`;

      const buildCampTileArt = (tile, cx, cy, clipId) => {
        if (tile.state === "hidden" || tile.state === "silhouette") {
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
          if (tile.building) classes.push("has-building");
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
          if (
            tile.resourceType &&
            Number.isFinite(tile.resourceRemaining) &&
            tile.state !== "hidden" &&
            tile.state !== "silhouette"
          ) {
            const cap = tile.resourceCapacity || 1;
            const pct = tile.resourceRemaining / cap;
            if (pct >= 0.67) classes.push("res-rich");
            else if (pct >= 0.34) classes.push("res-medium");
            else classes.push("res-sparse");
          }

          const rawDisplayIcon =
            tile.state === "hidden"
              ? ""
              : tile.state === "camp"
                ? ""
                : tile.construction?.icon || tile.icon || "";
          const displayIcon = this.getCampTileDisplayIcon(tile, rawDisplayIcon);
          const imageHref = this.getCampTileImageHref(tile);

          const tileStateLabel = this.getCampTileStateLabel(tile.state);

          const stockBadge =
            tile.state !== "hidden" &&
            tile.state !== "silhouette" &&
            Number.isFinite(tile.resourceRemaining)
              ? `<text class="tile-stock${tile.isDepleted ? " is-depleted" : ""}" x="${(cx + 21).toFixed(1)}" y="${(cy - 18).toFixed(1)}">${tile.resourceRemaining}</text>`
              : "";

          const candidateLabel =
            tile.state === "camp_candidate" && tile.shortLabel
              ? `<text class="tile-label" x="${cx.toFixed(1)}" y="${(cy + 22).toFixed(1)}">${tile.shortLabel}</text>`
              : "";

          const pathMark =
            tile.pathLevel &&
            tile.pathLevel !== "none" &&
            tile.state !== "hidden" &&
            tile.state !== "silhouette"
              ? `<path class="tile-path-mark" d="M ${(cx - 24).toFixed(1)} ${(cy + 21).toFixed(1)} C ${(cx - 10).toFixed(1)} ${(cy + 11).toFixed(1)}, ${(cx + 7).toFixed(1)} ${(cy + 27).toFixed(1)}, ${(cx + 24).toFixed(1)} ${(cy + 14).toFixed(1)}" />`
              : "";
          const campMarker =
            tile.state === "camp"
              ? `<circle class="tile-camp-marker" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9.5" />`
              : "";
          const selectedMarker =
            tile.selected &&
            tile.state !== "hidden" &&
            tile.state !== "silhouette"
              ? `<circle class="tile-here-marker" cx="${cx.toFixed(1)}" cy="${(cy + 20).toFixed(1)}" r="6.5" />`
              : "";

          const animStyle =
            !mapState.campSetupDone && mapState.introStep?.index === 0
              ? ` style="animation-delay:${(tileIndex * 45).toFixed(0)}ms"`
              : "";

          tileIndex++;
          const artSvg = buildCampTileArt(tile, cx, cy, clipId);
          const isCampTile = tile.state === "camp";
          const hasResourceImage =
            !!imageHref &&
            !!tile.resourceType &&
            tile.state !== "hidden" &&
            tile.state !== "silhouette";
          const hasBuildingImage =
            !!imageHref &&
            !hasResourceImage &&
            !isCampTile &&
            (!!tile.building ||
              !!tile.construction ||
              tile.actionId === "gather_supplies") &&
            tile.state !== "hidden" &&
            tile.state !== "silhouette";
          const hasCampImage = isCampTile && !!imageHref;
          const hasTerrainImage =
            !!imageHref &&
            !hasResourceImage &&
            !hasBuildingImage &&
            !hasCampImage &&
            tile.state !== "hidden" &&
            tile.state !== "silhouette";
          // Resource PNG: prominent central icon
          const resourceImage = hasResourceImage
            ? `<image class="tile-image is-resource" href="${imageHref}" x="${(cx - 18).toFixed(1)}" y="${(cy - 18).toFixed(1)}" width="36" height="36" preserveAspectRatio="xMidYMid meet" />`
            : "";
          const buildingImage = hasBuildingImage
            ? `<image class="tile-image is-building" href="${imageHref}" x="${(cx - 17).toFixed(1)}" y="${(cy - 17).toFixed(1)}" width="34" height="34" preserveAspectRatio="xMidYMid meet" />`
            : "";
          // Camp PNG: larger, glowing — shown on the founded camp tile
          const campImage = hasCampImage
            ? `<image class="tile-image is-camp" href="${imageHref}" x="${(cx - 22).toFixed(1)}" y="${(cy - 22).toFixed(1)}" width="44" height="44" preserveAspectRatio="xMidYMid meet" />`
            : "";
          // Terrain PNG: landscape image filling the hex (clipped to hex shape)
          const terrainImage = hasTerrainImage
            ? `<image class="tile-image is-terrain" href="${imageHref}" x="${(cx - 40).toFixed(1)}" y="${(cy - 40).toFixed(1)}" width="80" height="80" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`
            : "";
          // Emoji fallback only when no image at all could be shown
          const fallbackIcon =
            !resourceImage &&
            !buildingImage &&
            !campImage &&
            !terrainImage &&
            tile.state !== "silhouette" &&
            displayIcon
              ? `<text class="tile-icon" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}">${displayIcon}</text>`
              : "";
          const tileVisual = `${artSvg}${terrainImage}${resourceImage}${buildingImage}${campImage}${fallbackIcon}`;

          return `<g class="${classes.join(" ")}" data-tile-id="${tile.id}" role="button" tabindex="${tile.state !== "hidden" && tile.state !== "silhouette" ? "0" : "-1"}" aria-label="${tile.name} (${tileStateLabel})"${animStyle}><defs><clipPath id="${clipId}"><polygon points="${pts}"/></clipPath></defs><polygon points="${pts}"/>${tileVisual}${pathMark}${campMarker}${selectedMarker}${candidateLabel}${stockBadge}</g>`;
        })
        .join("\n");

      const travelOverlay = this._buildTravelOverlaySvg(
        tileCoordById,
        mapState,
      );

      svgEl.innerHTML = `${defsSvg}${backdropSvg}${tileGroups}${travelOverlay}`;

      for (const tile of mapState.tiles) {
        const group = svgEl.querySelector(`[data-tile-id="${tile.id}"]`);
        if (!group) continue;

        // Hidden and silhouette tiles are purely visual — no interaction
        if (tile.state === "hidden") continue;
        if (tile.state === "silhouette") {
          if (tooltipEl) {
            const silhouetteTip = [
              `🌫️ ${tile.name}`,
              "Туманные очертания… что-то видно, но пока не разглядеть.",
              "Подойдёт ближе, когда лагерь будет основан.",
            ].join("\n");
            group.addEventListener("mouseenter", () => {
              this._showTooltipDelayed(tooltipEl, silhouetteTip);
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
          // Silhouette click: explore after camp is founded
          group.addEventListener("click", () => {
            group.blur?.();
            if (!this._campTravelAction) {
              this._startCampTileExplore(tile.id);
            }
          });
          continue;
        }
        let tipText;
        if (tile.state === "camp_candidate") {
          tipText = this.formatTooltipText([
            `📍 ${tile.name}`,
            tile.description,
            tile.campCandidateHint || "Здесь можно основать лагерь.",
            "▶ Нажмите, чтобы выбрать это место",
          ]);
        } else {
          const lines = [tile.name, tile.description];
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
          if (tile.buildingId) {
            lines.push(
              `Постройка: ${tile.building.icon} ${tile.building.name}`,
            );
          } else if (
            Array.isArray(tile.buildOptions) &&
            tile.buildOptions.length > 0
          ) {
            const optionNames = tile.buildOptions
              .map((bid) => this.data.buildings[bid]?.name || bid)
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

        group.addEventListener("click", () => {
          group.blur?.();
          // Camp candidates: open confirmation modal (ritual with cost).
          if (tile.state === "camp_candidate") {
            this.openCampFoundConfirm(tile.id);
            return;
          }
          // Founded camp tile: open camp management screen.
          if (tile.state === "camp") {
            this.openCampScreen();
            return;
          }
          // Pre-camp: any visible non-resource tile can be chosen as camp site
          if (
            !mapState.campSetupDone &&
            !tile.actionId &&
            tile.state !== "hidden" &&
            tile.state !== "silhouette"
          ) {
            this.openCampFoundConfirm(tile.id);
            return;
          }
          // Other tiles: click only selects. Action is explicit via right panel
          // so gather spam/misclicks are less likely.
          this.game.selectCampTile(tile.id);
          this.render({ forcePanels: true });
        });
      }
    }
  },
});
