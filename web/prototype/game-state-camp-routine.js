// Stage 2C — распорядок стоянки: автопостановка сборов через enqueueManualGather.

(() => {
  if (typeof GameState !== "function") return;

  function priorityDefs(game) {
    return game?.data?.campRoutinePrioritiesById || {};
  }

  function priorityOrder(game) {
    const raw = game?.data?.campRoutinePriorityOrder;
    if (Array.isArray(raw) && raw.length) return raw;
    return Object.keys(priorityDefs(game));
  }

  function defaultTargets(game) {
    return game?.data?.campRoutineDefaultTargets || {};
  }

  GameState.prototype._getCampRoutineDefaultTarget = function (resourceId) {
    const d = defaultTargets(this);
    const v = d[resourceId];
    return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 5;
  };

  GameState.prototype._campRoutineTargetValue = function (resourceId) {
    const cr = this.campRoutine;
    const v = cr?.targetStocks?.[resourceId];
    if (Number.isFinite(v) && v >= 1) return Math.floor(v);
    return this._getCampRoutineDefaultTarget(resourceId);
  };

  GameState.prototype._gatherLaneHasGatherJob = function (gatherId) {
    if (!gatherId) return false;
    const aw = this.activeWork;
    if (aw && aw.gatherId === gatherId) return true;
    for (const q of this.workQueue || []) {
      if (q.gatherId === gatherId) return true;
    }
    return false;
  };

  GameState.prototype._resolveCampRoutineGather = function (priorityId) {
    const defs = priorityDefs(this);
    const cr = this.campRoutine;
    const pdef = defs[priorityId];
    if (!pdef) return { gatherId: null, resourceId: null };

    if (pdef.mode === "min_deficit") {
      const order = pdef.resourceIds || [];
      let bestR = null;
      let bestDef = 0;
      for (const rid of order) {
        const gatherId = pdef.gatherByResource?.[rid];
        if (!gatherId) continue;
        const tgt = this._campRoutineTargetValue(rid);
        const cur = Number(this.resources?.[rid]) || 0;
        const baseDef = Math.max(0, tgt - cur);
        const extra =
          typeof this._earlyWorkshopRoutineExtraDeficit === "function"
            ? this._earlyWorkshopRoutineExtraDeficit(rid)
            : 0;
        const deficit = Math.max(baseDef, extra);
        if (deficit <= 0) continue;
        if (!bestR || deficit > bestDef) {
          bestDef = deficit;
          bestR = rid;
        }
      }
      if (!bestR) return { gatherId: null, resourceId: null };
      return {
        gatherId: pdef.gatherByResource[bestR] || null,
        resourceId: bestR,
      };
    }

    const rid = pdef.resourceId;
    const gatherId = pdef.gatherActionId;
    if (!rid || !gatherId) return { gatherId: null, resourceId: null };
    const tgt = this._campRoutineTargetValue(rid);
    const cur = Number(this.resources?.[rid]) || 0;
    if (cur >= tgt) return { gatherId: null, resourceId: rid };
    return { gatherId, resourceId: rid };
  };

  GameState.prototype._serializeCampRoutine = function () {
    const cr = this.campRoutine || {};
    return {
      enabled: !!cr.enabled,
      activePriorityId:
        typeof cr.activePriorityId === "string" ? cr.activePriorityId : null,
      targetStocks:
        cr.targetStocks && typeof cr.targetStocks === "object"
          ? { ...cr.targetStocks }
          : {},
    };
  };

  GameState.prototype._restoreCampRoutine = function (raw) {
    const base = {
      enabled: false,
      activePriorityId: null,
      targetStocks: {},
    };
    if (raw && typeof raw === "object") {
      base.enabled = !!raw.enabled;
      base.activePriorityId =
        typeof raw.activePriorityId === "string" && raw.activePriorityId
          ? raw.activePriorityId
          : null;
      if (raw.targetStocks && typeof raw.targetStocks === "object") {
        for (const [k, v] of Object.entries(raw.targetStocks)) {
          if (typeof k !== "string" || !k) continue;
          const n = Number(v);
          if (!Number.isFinite(n)) continue;
          const t = Math.max(1, Math.min(999, Math.floor(n)));
          base.targetStocks[k] = t;
        }
      }
    }
    this.campRoutine = base;
  };

  GameState.prototype.setCampRoutineEnabled = function (enabled) {
    if (!this.campRoutine) this._restoreCampRoutine(null);
    this.campRoutine.enabled = !!enabled;
    if (!this.campRoutine.enabled) this._campRoutineTickHint = "";
    this.markDirty();
  };

  GameState.prototype.setCampRoutinePriority = function (priorityId) {
    if (!this.campRoutine) this._restoreCampRoutine(null);
    const defs = priorityDefs(this);
    if (!priorityId || !defs[priorityId]) {
      this.campRoutine.activePriorityId = null;
      this.markDirty();
      return;
    }
    this.campRoutine.activePriorityId = priorityId;
    const pdef = defs[priorityId];
    const ensure = (rid) => {
      if (!rid) return;
      if (this.campRoutine.targetStocks[rid] == null)
        this.campRoutine.targetStocks[rid] =
          this._getCampRoutineDefaultTarget(rid);
    };
    if (pdef.mode === "min_deficit") {
      for (const rid of pdef.resourceIds || []) ensure(rid);
    } else {
      ensure(pdef.resourceId);
    }
    this.markDirty();
  };

  GameState.prototype.adjustCampRoutineTarget = function (resourceId, delta) {
    if (!resourceId || !this.campRoutine) return false;
    const cur = this.campRoutine.targetStocks[resourceId];
    const base = Number.isFinite(cur)
      ? cur
      : this._getCampRoutineDefaultTarget(resourceId);
    const cap = Math.max(
      30,
      Math.min(999, (Number(this.maxResourceCap) || 15) + 25),
    );
    const next = Math.max(
      1,
      Math.min(cap, base + (Number(delta) || 0)),
    );
    this.campRoutine.targetStocks[resourceId] = next;
    this.markDirty();
    return true;
  };

  GameState.prototype.tryCampRoutineEnqueueNow = function () {
    return this.tickCampRoutine(true) === true;
  };

  /**
   * Не чаще одного постановления за вызов. Из app — после tickWorkQueue.
   * @param {boolean} [manualNow]
   * @returns {boolean|void}
   */
  GameState.prototype.tickCampRoutine = function (manualNow) {
    if (
      typeof this.isOnboardingActive === "function" &&
      this.isOnboardingActive()
    ) {
      if (!manualNow) this._campRoutineTickHint = "";
      return manualNow ? false : undefined;
    }
    const cr = this.campRoutine;
    if (!cr || !cr.enabled) {
      if (!manualNow) this._campRoutineTickHint = "";
      return manualNow ? false : undefined;
    }
    if (!cr.activePriorityId) {
      this._campRoutineTickHint = "choose_priority";
      return manualNow ? false : undefined;
    }
    if (!this._gatherWorkLaneHasRoom?.()) {
      this._campRoutineTickHint = "queue_full";
      return manualNow ? false : undefined;
    }
    const { gatherId } = this._resolveCampRoutineGather(cr.activePriorityId);
    if (!gatherId) {
      this._campRoutineTickHint = "stocked";
      return manualNow ? false : undefined;
    }
    if (this._gatherLaneHasGatherJob(gatherId)) {
      this._campRoutineTickHint = "duplicate";
      return manualNow ? false : undefined;
    }
    const ok = this.enqueueManualGather(gatherId, { source: "campRoutine" });
    if (ok) {
      this._campRoutineTickHint = "enqueued";
      return true;
    }
    this._campRoutineTickHint = "blocked";
    return manualNow ? false : undefined;
  };

  GameState.prototype.getCampRoutinePanelModel = function () {
    const HINTS = {
      queue_full: "Очередь занята — распорядок подождёт.",
      stocked: "Запасы по выбранной задаче на цели.",
      duplicate: "Такой сбор уже в работе или в очереди.",
      blocked: "Сейчас нельзя поставить сбор (энергия, условия, перезарядка).",
      choose_priority: "Выберите задачу распорядка.",
      enqueued: "",
    };
    const defs = priorityDefs(this);
    const order = priorityOrder(this).filter((id) => defs[id]);
    const cr = this.campRoutine || {
      enabled: false,
      activePriorityId: null,
      targetStocks: {},
    };
    const active = cr.activePriorityId && defs[cr.activePriorityId]
      ? cr.activePriorityId
      : null;
    const pdef = active ? defs[active] : null;
    const targetRows = [];
    if (pdef?.mode === "min_deficit") {
      for (const rid of pdef.resourceIds || []) {
        targetRows.push({
          resourceId: rid,
          value: this._campRoutineTargetValue(rid),
        });
      }
    } else if (pdef?.resourceId) {
      targetRows.push({
        resourceId: pdef.resourceId,
        value: this._campRoutineTargetValue(pdef.resourceId),
      });
    }
    const key = this._campRoutineTickHint || "";
    return {
      enabled: !!cr.enabled,
      activePriorityId: active,
      priorityIds: order,
      targetRows,
      hintText: HINTS[key] || "",
      hintKey: key,
      laneFull: !this._gatherWorkLaneHasRoom?.(),
    };
  };
})();
