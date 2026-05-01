(() => {
  if (typeof GameState !== "function") return;

  const baseAddCarriedResource = GameState.prototype._addCarriedResource;
  const baseDiscoverCampTile = GameState.prototype.discoverCampTile;
  const baseGetDefaultLocalCampMapState =
    GameState.prototype._getDefaultLocalCampMapState;
  const baseGetGatherProfile = GameState.prototype.getGatherProfile;
  const baseEnsureSelectedCampTile =
    GameState.prototype._ensureSelectedCampTile;
  const baseSanitizeCampMapState = GameState.prototype._sanitizeCampMapState;
  const baseSerializeCampMap = GameState.prototype._serializeCampMap;
  const baseSyncLocalCampMap = GameState.prototype._syncLocalCampMap;

  GameState.prototype._getDefaultLocalCampMapState = function () {
    const state = baseGetDefaultLocalCampMapState.call(this);
    return {
      ...state,
      characterTileId: state.characterTileId || null,
      carriedResources: state.carriedResources || {},
    };
  };

  GameState.prototype._sanitizeTripInventory = function (raw) {
    const inventory = {};
    if (!raw || typeof raw !== "object") return inventory;
    for (const resourceId of Object.keys(this.data.resources || {})) {
      const amount = raw[resourceId];
      if (Number.isFinite(amount) && amount > 0) {
        inventory[resourceId] = Math.max(0, amount);
      }
    }
    return inventory;
  };

  GameState.prototype._getCampHomeTileId = function () {
    const tiles = this._getCampMapTileList?.() || [];
    return (
      this.localCampMap?.campTileId ||
      tiles.find((tile) => this.getCampTileState(tile.id) === "camp")?.id ||
      tiles.find((tile) => tile.id === "camp_clearing")?.id ||
      tiles.find((tile) => this._getCampTileLiveDist?.(tile) === 0)?.id ||
      null
    );
  };

  GameState.prototype._sanitizeCampMapState = function (raw) {
    const state = baseSanitizeCampMapState.call(this, raw);
    const tiles = this._getCampMapTiles?.() || {};
    const homeTileId =
      state.campTileId ||
      Object.values(tiles).find(
        (tile) => state.tileStates?.[tile.id] === "camp",
      )?.id ||
      (tiles.camp_clearing ? "camp_clearing" : null);

    state.characterTileId =
      raw?.characterTileId && tiles[raw.characterTileId]
        ? raw.characterTileId
        : homeTileId;
    state.carriedResources = this._sanitizeTripInventory(raw?.carriedResources);
    return state;
  };

  GameState.prototype._serializeCampMap = function () {
    return {
      ...baseSerializeCampMap.call(this),
      characterTileId: this.localCampMap?.characterTileId || null,
      carriedResources: this._sanitizeTripInventory(
        this.localCampMap?.carriedResources,
      ),
    };
  };

  GameState.prototype.getCharacterTileId = function () {
    const tileId = this.localCampMap?.characterTileId;
    if (tileId && this._getCampMapTile(tileId)) return tileId;
    return this._getCampHomeTileId();
  };

  GameState.prototype.isCharacterAtCamp = function () {
    const homeTileId = this._getCampHomeTileId();
    const characterTileId = this.getCharacterTileId();
    return !characterTileId || !homeTileId || characterTileId === homeTileId;
  };

  GameState.prototype.getTripInventory = function () {
    if (!this.localCampMap) return {};
    this.localCampMap.carriedResources = this._sanitizeTripInventory(
      this.localCampMap.carriedResources,
    );
    return { ...this.localCampMap.carriedResources };
  };

  GameState.prototype.getTripInventoryTotal = function () {
    return Object.values(this.getTripInventory()).reduce(
      (sum, amount) => sum + (Number(amount) || 0),
      0,
    );
  };

  GameState.prototype.getTripInventoryLoad = function () {
    return this._getOutputCarryLoad?.(this.getTripInventory()) || 0;
  };

  GameState.prototype.getCharacterAvailableCarryCapacity = function () {
    const capacity = this.getCharacterCarryCapacity?.() || 0;
    const load = this.getTripInventoryLoad?.() || 0;
    return Math.max(0, Number((capacity - load).toFixed(2)));
  };

  GameState.prototype.unloadTripInventory = function ({ silent = false } = {}) {
    if (!this.localCampMap?.carriedResources) return false;
    const carried = this._sanitizeTripInventory(
      this.localCampMap.carriedResources,
    );
    const moved = {};

    for (const [resourceId, amount] of Object.entries(carried)) {
      const before = this.resources[resourceId] || 0;
      this.resources[resourceId] = Math.min(
        this.maxResourceCap,
        before + amount,
      );
      const added = this.resources[resourceId] - before;
      if (added > 0) moved[resourceId] = added;
      const left = Math.max(0, amount - added);
      if (left > 0) {
        carried[resourceId] = left;
      } else {
        delete carried[resourceId];
      }
    }

    this.localCampMap.carriedResources = carried;
    const movedEntries = Object.entries(moved);
    if (movedEntries.length === 0) return false;

    if (!silent) {
      this.addLog(
        `📥 Добыча сгружена ${this.isCampSetupDone?.() ? "в лагерь" : "у ночёвки"}: ${movedEntries
          .map(
            ([resourceId, amount]) =>
              `${this.data.resources[resourceId]?.icon || ""}${amount}`,
          )
          .join(" ")}.`,
      );
    }
    this.markDirty();
    return true;
  };

  GameState.prototype.arriveCharacterAtTile = function (tileId) {
    if (!this.localCampMap || !tileId || !this._getCampMapTile(tileId)) {
      return false;
    }
    if (this.localCampMap.characterTileId === tileId) {
      if (this.isCharacterAtCamp()) this.unloadTripInventory({ silent: false });
      return false;
    }
    this.localCampMap.characterTileId = tileId;
    if (this.isCharacterAtCamp()) this.unloadTripInventory({ silent: false });
    this.markDirty();
    return true;
  };

  GameState.prototype._shouldUseEarlySharedStock = function () {
    return false;
  };

  GameState.prototype._shouldStoreGatherInCarriedResources = function (tile) {
    const homeTileId = this._getCampHomeTileId?.();
    if (tile?.id) return !!homeTileId && tile.id !== homeTileId;
    return !this.isCharacterAtCamp();
  };

  GameState.prototype._normalizeEarlyCarriedResources = function ({
    silent = true,
  } = {}) {
    if (!this._shouldUseEarlySharedStock()) return false;
    if (!this.localCampMap?.carriedResources) return false;

    const moved = {};
    for (const [resourceId, amount] of Object.entries(
      this.localCampMap.carriedResources,
    )) {
      if (!Object.prototype.hasOwnProperty.call(this.resources, resourceId)) {
        continue;
      }
      const safeAmount = Math.max(0, Number(amount) || 0);
      if (safeAmount <= 0) continue;

      const before = this.resources[resourceId] || 0;
      this.resources[resourceId] = Math.min(
        this.maxResourceCap,
        before + safeAmount,
      );
      const added = this.resources[resourceId] - before;
      this.localCampMap.carriedResources[resourceId] = Math.max(
        0,
        safeAmount - added,
      );
      if (added > 0) {
        moved[resourceId] = added;
      }
    }

    const movedEntries = Object.entries(moved);
    if (movedEntries.length === 0) return false;

    if (!silent) {
      this.addLog(
        `📦 Ранний запас у ночёвки пополнен: ${movedEntries
          .map(
            ([resourceId, amount]) =>
              `${this.data.resources[resourceId]?.icon || ""}${amount}`,
          )
          .join(" ")}`,
      );
    }
    this.markDirty();
    return true;
  };

  GameState.prototype._getCampFrontierLockedTileIds = function () {
    if (!this.isCampSetupDone?.()) return [];

    const accessibleStates = new Set([
      "camp",
      "developed",
      "discovered",
      "terrain_seen",
    ]);
    const frontier = [];

    for (const tile of this._getCampMapTileList?.() || []) {
      if (!tile || this.getCampTileState(tile.id) !== "hidden") continue;

      const isFrontier = (this._getCampNeighborTileIds?.(tile.id) || []).some(
        (neighborTileId) =>
          accessibleStates.has(this.getCampTileState(neighborTileId)),
      );

      if (isFrontier) {
        frontier.push(tile.id);
      }
    }

    return frontier;
  };

  GameState.prototype.getCampTileUnlockHint = function (tileId) {
    const tile = this._getCampMapTile(tileId);
    if (!tile) return "";

    if (this.getCampTileState(tileId) === "terrain_seen") {
      return (
        tile.discoveryHint ||
        "Местность уже осмотрена, но её польза станет ясна после следующего шага развития."
      );
    }

    if (!this.isCampTilePresentationUnlocked?.(tile)) {
      return (
        this.getCampTilePresentationLockHint?.(tile) ||
        tile.discoveryHint ||
        "Этот участок станет понятен после нужного озарения, исследования или постройки."
      );
    }

    const revealRadius = this._getCampRevealRadius?.() || 0;
    const maxRadius = this._getCampMapRadius?.() || revealRadius;
    const liveDist = this._getCampTileLiveDist?.(tile) || 0;
    const canScout = this.canScoutCampTile?.(tileId) || false;
    const canRevealByExploration =
      this.canRevealCampTileByExploration?.(tileId) || false;

    if (canRevealByExploration) {
      return (
        tile.discoveryHint ||
        "Можно отправить персонажа на разведку и открыть этот участок."
      );
    }

    if (!canScout && this._isCampTileUnknownForDiscovery?.(tileId)) {
      return (
        tile.discoveryHint ||
        "Сначала откройте соседний участок или подойдите ближе: к этой клетке пока нет читаемого пути."
      );
    }

    if (
      canScout &&
      typeof tile.discoveryRequirements === "function" &&
      !tile.discoveryRequirements(this)
    ) {
      return (
        tile.discoveryHint ||
        "До этого места можно дойти, но его польза станет ясна после следующего шага развития."
      );
    }

    if (liveDist > revealRadius) {
      return `Пока участок лежит за пределом обзора лагеря: ${revealRadius}/${maxRadius}.`;
    }

    if (
      typeof tile.discoveryRequirements === "function" &&
      !tile.discoveryRequirements(this)
    ) {
      return (
        tile.discoveryHint ||
        "Этот участок откроется после следующего шага развития лагеря."
      );
    }

    if (this.getCampTileState(tileId) === "visible_locked") {
      return (
        tile.discoveryHint ||
        "Участок замечен на краю освоенной зоны, но выход к нему ещё не готов."
      );
    }

    return tile.discoveryHint || "";
  };

  GameState.prototype.discoverCampTile = function (
    tileId,
    { silent = false, pushStory = false, skipSurveyAssist = false } = {},
  ) {
    if (!tileId) return false;
    const tile = this._getCampMapTile(tileId);
    if (!tile) return false;
    const current = this.getCampTileState(tileId);
    if (
      current === "camp" ||
      current === "developed" ||
      current === "discovered" ||
      current === "camp_candidate"
    ) {
      return false;
    }

    if (
      typeof this.canRevealCampTileByExploration === "function" &&
      !this.canRevealCampTileByExploration(tileId)
    ) {
      if (["hidden", "silhouette", "visible_locked"].includes(current)) {
        this.localCampMap.tileStates[tileId] = "terrain_seen";
        this._syncLocalCampMap({ pushStory: false });
        this.markDirty();
      }
      return false;
    }

    if (!skipSurveyAssist && pushStory === false && silent === false) {
      const result = baseDiscoverCampTile.call(this, tileId);
      return result
        ? {
            ok: true,
            tile,
            surveyAssistTile: null,
            revealedTileIds: [tile.id],
            revealedNames: [tile.name],
          }
        : false;
    }

    this.localCampMap.tileStates[tileId] = "discovered";
    let surveyAssistTile = null;
    if (!skipSurveyAssist && this.getCharacterSurveyRevealBonus() > 0) {
      surveyAssistTile = this._getCampSurveyAssistTile(tileId);
      if (surveyAssistTile) {
        this.localCampMap.tileStates[surveyAssistTile.id] = "discovered";
      }
    }

    this._syncLocalCampMap({ pushStory: false });

    const storyText = surveyAssistTile
      ? `Открыт участок "${tile.name}". Следы по дороге помогают заметить ещё и "${surveyAssistTile.name}".`
      : `Открыт участок "${tile.name}".`;

    if (!silent) {
      this.addLog(
        surveyAssistTile
          ? `🔍 Открыт новый участок: "${tile.name}". Следы вокруг помогают заметить ещё и "${surveyAssistTile.name}".`
          : `🔍 Открыт новый участок: "${tile.name}".`,
      );
    }

    if (pushStory) {
      this._pushStoryEvent({
        type: "map",
        icon: "🔍",
        title: surveyAssistTile
          ? "По пути найдено новое место"
          : "Открыт новый участок",
        text: storyText,
        ttlMs: 5200,
      });
    }

    this.markDirty();
    return {
      ok: true,
      tile,
      surveyAssistTile,
      revealedTileIds: [tile.id, surveyAssistTile?.id].filter(Boolean),
      revealedNames: [tile.name, surveyAssistTile?.name].filter(Boolean),
    };
  };

  GameState.prototype.discoverCampTilesAlongPath = function (
    path,
    { includeDestination = false, pushStory = true } = {},
  ) {
    if (!Array.isArray(path) || path.length < 2) {
      return {
        count: 0,
        names: [],
      };
    }

    const routeTileIds = includeDestination ? path.slice(1) : path.slice(1, -1);
    const revealedNames = [];
    const terrainSeenTileIds = [];

    for (let index = 0; index < routeTileIds.length; index += 1) {
      const tileId = routeTileIds[index];
      const tile = this._getCampMapTile(tileId);
      if (!tile) continue;

      const state = this.getCampTileState(tileId);
      const canRevealByRoute =
        state === "silhouette" ||
        state === "hidden" ||
        state === "visible_locked" ||
        state === "terrain_seen";
      if (!canRevealByRoute) continue;

      const canRevealByTraversal =
        typeof this._canRevealCampTileByTraversal === "function"
          ? this._canRevealCampTileByTraversal(tile)
          : this.isCampTilePresentationUnlocked?.(tile);
      if (!canRevealByTraversal) {
        if (["hidden", "silhouette", "visible_locked"].includes(state)) {
          this.localCampMap.tileStates[tileId] = "terrain_seen";
          terrainSeenTileIds.push(tileId);
        }
        continue;
      }

      this.localCampMap.tileStates[tileId] = "discovered";
      revealedNames.push(tile.name);
    }

    const uniqueNames = [...new Set(revealedNames)];
    const uniqueTerrainSeenTileIds = [...new Set(terrainSeenTileIds)];
    if (uniqueNames.length === 0 && uniqueTerrainSeenTileIds.length === 0) {
      return {
        count: 0,
        names: [],
      };
    }

    if (pushStory && uniqueNames.length > 0) {
      this.addLog(
        uniqueNames.length === 1
          ? `🔍 По пути открыт участок: "${uniqueNames[0]}".`
          : `🔍 По пути открыты участки: ${uniqueNames
              .map((name) => `"${name}"`)
              .join(", ")}.`,
      );
    }

    if (pushStory && uniqueNames.length > 0) {
      this._pushStoryEvent({
        type: "map",
        icon: "🌫️",
        title:
          uniqueNames.length === 1
            ? "Туман рассеялся на пути"
            : "Маршрут открыл новые участки",
        text:
          uniqueNames.length === 1
            ? `Во время перехода открылся участок "${uniqueNames[0]}".`
            : `Во время перехода открылись участки: ${uniqueNames
                .slice(0, 3)
                .map((name) => `"${name}"`)
                .join(
                  ", ",
                )}${uniqueNames.length > 3 ? ` и ещё ${uniqueNames.length - 3}` : ""}.`,
        ttlMs: 5200,
      });
    }

    this._syncLocalCampMap({ pushStory: false });
    this.markDirty();
    return {
      count: uniqueNames.length + uniqueTerrainSeenTileIds.length,
      names: uniqueNames,
      terrainSeenTileIds: uniqueTerrainSeenTileIds,
    };
  };

  GameState.prototype._syncLocalCampMap = function (...args) {
    const result = baseSyncLocalCampMap.apply(this, args);

    if (this.isCampSetupDone?.()) {
      for (const tileId of this._getCampFrontierLockedTileIds()) {
        if (this.getCampTileState(tileId) === "hidden") {
          this.localCampMap.tileStates[tileId] = "visible_locked";
        }
      }
    }

    this._normalizeEarlyCarriedResources({ silent: true });
    if (typeof this._getCampMapSyncKey === "function") {
      this._campMapSyncKey = this._getCampMapSyncKey();
    }
    return result;
  };

  GameState.prototype._ensureSelectedCampTile = function () {
    const currentId = this.localCampMap?.selectedTileId;
    if (
      currentId &&
      this._getCampMapTile(currentId) &&
      [
        "camp",
        "developed",
        "discovered",
        "terrain_seen",
        "camp_candidate",
      ].includes(this.getCampTileState(currentId))
    ) {
      return;
    }

    return baseEnsureSelectedCampTile.call(this);
  };

  GameState.prototype._addCarriedResource = function (
    resourceId,
    amount,
    options = {},
  ) {
    if (!this.localCampMap) return this.addResource(resourceId, amount);
    if (!Object.prototype.hasOwnProperty.call(this.resources, resourceId)) {
      return 0;
    }

    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (safeAmount <= 0) return 0;

    this.localCampMap.carriedResources = this._sanitizeTripInventory(
      this.localCampMap.carriedResources,
    );
    this.localCampMap.carriedResources[resourceId] =
      (this.localCampMap.carriedResources[resourceId] || 0) + safeAmount;
    this.totalResourcesCollected += safeAmount;
    this.resourceTotals[resourceId] =
      (this.resourceTotals[resourceId] || 0) + safeAmount;
    this.markDirty();
    return safeAmount;
  };

  GameState.prototype._limitOutputByCarry = function (
    output,
    capacity = this.getCharacterAvailableCarryCapacity(),
  ) {
    const rawLoad = this._getOutputCarryLoad(output);
    const safeCapacity = Math.max(0, Number.isFinite(capacity) ? capacity : 0);

    if (rawLoad <= safeCapacity) {
      return {
        output,
        rawLoad,
        load: rawLoad,
        limitedByCarry: false,
      };
    }

    const entries = Object.entries(output);
    if (entries.length === 0) {
      return {
        output,
        rawLoad,
        load: 0,
        limitedByCarry: false,
      };
    }

    const limitedEntries = entries.map(([resourceId, amount]) => ({
      resourceId,
      amount: Math.max(0, Math.floor(Number(amount) || 0)),
      weight: Math.max(0.01, this.getResourceCarryWeight(resourceId)),
      limitedAmount: 0,
      remainderScore: 0,
    }));
    let changed = false;

    if (limitedEntries.length === 1) {
      const [entry] = limitedEntries;
      const cappedAmount = Math.max(
        0,
        Math.floor((safeCapacity + 1e-9) / entry.weight),
      );
      entry.limitedAmount = Math.min(entry.amount, cappedAmount);
      changed = entry.limitedAmount < entry.amount;
    } else {
      const ratio = safeCapacity / Math.max(rawLoad, 0.01);
      for (const entry of limitedEntries) {
        const exactAmount = entry.amount * ratio;
        entry.limitedAmount = Math.min(
          entry.amount,
          Math.max(0, Math.floor(exactAmount)),
        );
        entry.remainderScore = exactAmount - entry.limitedAmount;
        if (entry.limitedAmount < entry.amount) changed = true;
      }

      let remainingCapacity = Math.max(
        0,
        Number(
          (
            safeCapacity -
            limitedEntries.reduce(
              (sum, entry) => sum + entry.weight * entry.limitedAmount,
              0,
            )
          ).toFixed(2),
        ),
      );
      const refillOrder = [...limitedEntries].sort((left, right) => {
        if (left.limitedAmount === 0 && right.limitedAmount > 0) return -1;
        if (right.limitedAmount === 0 && left.limitedAmount > 0) return 1;
        if (right.remainderScore !== left.remainderScore) {
          return right.remainderScore - left.remainderScore;
        }
        if (left.weight !== right.weight) return left.weight - right.weight;
        return left.resourceId.localeCompare(right.resourceId);
      });

      while (remainingCapacity > 0) {
        let addedAny = false;
        for (const entry of refillOrder) {
          if (entry.limitedAmount >= entry.amount) continue;
          if (entry.weight > remainingCapacity + 1e-9) continue;
          entry.limitedAmount += 1;
          remainingCapacity = Math.max(
            0,
            Number((remainingCapacity - entry.weight).toFixed(2)),
          );
          addedAny = true;
        }
        if (!addedAny) break;
      }
    }

    const limitedOutput = Object.fromEntries(
      limitedEntries.map((entry) => [entry.resourceId, entry.limitedAmount]),
    );
    const load = this._getOutputCarryLoad(limitedOutput);
    return {
      output: limitedOutput,
      rawLoad,
      load,
      limitedByCarry: changed,
    };
  };

  GameState.prototype.getGatherProfile = function (actionId, options = {}) {
    const action = this.data.gatherActions[actionId];
    if (!action) return baseGetGatherProfile.call(this, actionId, options);

    const useEarlySharedStock = this._shouldUseEarlySharedStock();
    const multiTripDelivery = action.deliveryMode === "multi-trip";
    if (!useEarlySharedStock && !multiTripDelivery) {
      return baseGetGatherProfile.call(this, actionId, options);
    }

    const originalGetCharacterAvailableCarryCapacity =
      this.getCharacterAvailableCarryCapacity;
    const originalLimitOutputByCarry = this._limitOutputByCarry;

    try {
      if (useEarlySharedStock) {
        this.getCharacterAvailableCarryCapacity = () =>
          this.getCharacterCarryCapacity();
      }
      if (multiTripDelivery) {
        this._limitOutputByCarry = (output) => ({
          output,
          rawLoad: this._getOutputCarryLoad(output),
          load: this._getOutputCarryLoad(output),
          limitedByCarry: false,
        });
      }

      const profile = baseGetGatherProfile.call(this, actionId, options);
      if (!profile) return profile;

      if (
        profile.blockedReason &&
        /переносим|походном грузе/i.test(profile.blockedReason) &&
        (useEarlySharedStock || profile.carryCapacity > 0)
      ) {
        return {
          ...profile,
          blockedReason: "",
          isAvailable: true,
        };
      }

      return profile;
    } finally {
      this.getCharacterAvailableCarryCapacity =
        originalGetCharacterAvailableCarryCapacity;
      this._limitOutputByCarry = originalLimitOutputByCarry;
    }
  };
})();
