// Stage 2A — gather work-actions: active + queue + tick. Stage 2A-Fix: blocked state if gather() fails.

(() => {
  if (typeof GameState !== "function") return;

  const DEFAULT_GATHER_WORK_MS = 4500;

  /** @type {Record<string, string>} gatherActionId → workActionId (UI / map use gather ids; work lane uses work ids) */
  const GATHER_ACTION_TO_WORK_ID = {
    gather_wood: "work_gather_branches",
    gather_stone: "work_gather_stone",
    // Intentional: general fiber gather maps to work_gather_fiber (not work_search_tinder — same gather_fiber id, different work title/context).
    gather_fiber: "work_gather_fiber",
  };

  const MANUAL_LANE_PREFIX = "manual:";

  function laneWorkTitle(game, workId, gatherId) {
    if (game._isManualLaneWorkId(workId)) {
      return game.data?.gatherActions?.[gatherId]?.name || gatherId || workId;
    }
    const work = game._getWorkActionDef?.(workId);
    return work?.title || workId;
  }

  const origEvaluate = GameState.prototype.evaluateWorkActionAvailability;
  GameState.prototype.evaluateWorkActionAvailability = function (
    workId,
    options = {},
  ) {
    const res = origEvaluate.call(this, workId, options);
    if (!res.available) return res;
    const work = this._getWorkActionDef?.(workId);
    if (work?.execute?.type !== "gather") return res;
    const blockedSame =
      this.activeWork?.workId === workId &&
      this._isGatherWorkBlocked?.(this.activeWork);
    if (!blockedSame && !this._gatherWorkLaneHasRoom()) {
      return {
        available: false,
        reasons: [
          "Очередь работ заполнена: активна одна задача и до трёх ожидающих. Завершите, отмените или разберите приостановленную работу.",
        ],
        missing: ["work_queue"],
      };
    }
    return res;
  };

  const origDispatch = GameState.prototype.dispatchWorkAction;
  GameState.prototype.dispatchWorkAction = function (workId, options = {}) {
    const work = this._getWorkActionDef?.(workId);
    if (work?.execute?.type === "gather") {
      return this.enqueueGatherWork(workId, options);
    }
    return origDispatch.call(this, workId, options);
  };

  GameState.prototype._gatherWorkLaneHasRoom = function () {
    if (!this.activeWork) return true;
    return (this.workQueue?.length || 0) < (this.maxWorkQueueSize ?? 3);
  };

  GameState.prototype._isGatherWorkBlocked = function (aw) {
    return !!(aw && (aw.state === "blocked" || aw.blockedReason));
  };

  GameState.prototype._getGatherWorkDurationMs = function (workId) {
    if (this._isManualLaneWorkId(workId)) return DEFAULT_GATHER_WORK_MS;
    const work = this._getWorkActionDef?.(workId);
    const ms = work?.workDurationMs;
    return Number.isFinite(ms) && ms >= 500 ? Math.round(ms) : DEFAULT_GATHER_WORK_MS;
  };

  GameState.prototype._isManualLaneWorkId = function (workId) {
    return typeof workId === "string" && workId.startsWith(MANUAL_LANE_PREFIX);
  };

  GameState.prototype._manualLaneWorkId = function (gatherId) {
    return MANUAL_LANE_PREFIX + gatherId;
  };

  GameState.prototype._normalizeGatherWorkOptions = function (options = {}) {
    const out = {};
    const tileId =
      typeof options.tileId === "string" ? options.tileId : "";
    if (tileId) out.tileId = tileId;
    const rid = options.resourceId;
    if (typeof rid === "string" && rid.length) out.resourceId = rid;
    if (typeof options.source === "string" && options.source.length)
      out.source = options.source;
    return out;
  };

  /**
   * Ручной сбор из UI / карты: только постановка в work lane; gather() вызывается из tickWorkQueue.
   * @returns {boolean}
   */
  GameState.prototype.enqueueManualGather = function (actionId, options = {}) {
    if (!actionId || !this.data.gatherActions?.[actionId]) {
      this.addLog("⚠ Неизвестное действие сбора.");
      return false;
    }
    const normOpts = this._normalizeGatherWorkOptions(options);
    const mapped = GATHER_ACTION_TO_WORK_ID[actionId];
    const ok = mapped
      ? this.enqueueGatherWork(mapped, normOpts)
      : this._enqueueLaneJobManualOnly(actionId, normOpts);
    if (!ok) {
      const msg = this._getManualGatherEnqueueDenialMessage(actionId, normOpts);
      if (msg) this.addLog(msg.includes("⚠") ? msg : "⚠ " + msg);
    }
    return ok;
  };

  GameState.prototype._getManualGatherEnqueueDenialMessage = function (
    actionId,
    options,
  ) {
    const mapped = GATHER_ACTION_TO_WORK_ID[actionId];
    if (mapped) {
      const ev = this.evaluateWorkActionAvailability(mapped, options);
      if (!ev.available)
        return ev.reasons?.[0]
          ? String(ev.reasons[0])
          : "Нельзя поставить сбор в работу.";
      return "Не удалось добавить задачу в очередь работ.";
    }
    try {
      const profile = this.getGatherProfile(actionId, options);
      if (profile?.blockedReason) return String(profile.blockedReason);
    } catch (_) {
      /* ignore */
    }
    if (!this.canGather(actionId, options)) return "Сбор сейчас недоступен.";
    const workId = this._manualLaneWorkId(actionId);
    const blockedSame =
      this.activeWork &&
      this._isGatherWorkBlocked(this.activeWork) &&
      this.activeWork.gatherId === actionId &&
      this.activeWork.workId === workId;
    if (!blockedSame && !this._gatherWorkLaneHasRoom())
      return "Очередь работ заполнена (1 активная + до 3 ожидающих).";
    return "Не удалось поставить сбор в работу.";
  };

  /**
   * Очередь для gatherActionId без отдельного work-action (длительность по умолчанию).
   * @returns {boolean}
   */
  GameState.prototype._enqueueLaneJobManualOnly = function (
    gatherId,
    normOpts,
  ) {
    const workId = this._manualLaneWorkId(gatherId);
    if (!this.canGather(gatherId, normOpts)) return false;

    const blockedSame =
      this.activeWork &&
      this._isGatherWorkBlocked(this.activeWork) &&
      this.activeWork.gatherId === gatherId &&
      this.activeWork.workId === workId;
    if (!blockedSame && !this._gatherWorkLaneHasRoom()) return false;

    this._promoteGatherWorkHead();

    const durationMs = this._getGatherWorkDurationMs(workId);
    const job = {
      workId,
      gatherId,
      durationMs,
      options: normOpts,
      state: "running",
    };

    const title = this.data.gatherActions[gatherId]?.name || gatherId;

    if (!this.activeWork) {
      this.activeWork = { ...job, startedAt: Date.now() };
      this.addLog(`⚙ Начата работа: ${title}`);
      this.markDirty();
      return true;
    }

    if ((this.workQueue?.length || 0) >= (this.maxWorkQueueSize ?? 3)) {
      return false;
    }

    this.workQueue.push({ ...job, startedAt: null });
    this.addLog(`📋 В очередь работ: ${title}`);
    this.markDirty();
    return true;
  };

  GameState.prototype._promoteGatherWorkHead = function () {
    if (this.activeWork || !this.workQueue?.length) return;
    const next = this.workQueue.shift();
    this.activeWork = {
      ...next,
      startedAt: Date.now(),
      state: "running",
    };
    this.markDirty();
  };

  /**
   * Queue or start a gather-type work action (does not call gather() until completion).
   * @returns {boolean}
   */
  GameState.prototype.enqueueGatherWork = function (workId, options = {}) {
    const work = this._getWorkActionDef?.(workId);
    if (!work?.execute || work.execute.type !== "gather") return false;

    const gate = this.evaluateWorkActionAvailability(workId, options);
    if (!gate.available) return false;

    this._promoteGatherWorkHead();

    const gatherId = work.execute.id;
    const durationMs = this._getGatherWorkDurationMs(workId);
    const normOpts = this._normalizeGatherWorkOptions(options);
    const job = {
      workId,
      gatherId,
      durationMs,
      options: normOpts,
      state: "running",
    };

    if (!this.activeWork) {
      this.activeWork = { ...job, startedAt: Date.now() };
      const title = work.title || workId;
      this.addLog(`⚙ Начата работа: ${title}`);
      this.markDirty();
      return true;
    }

    if ((this.workQueue?.length || 0) >= (this.maxWorkQueueSize ?? 3)) {
      return false;
    }

    this.workQueue.push({ ...job, startedAt: null });
    const title = work.title || workId;
    this.addLog(`📋 В очередь работ: ${title}`);
    this.markDirty();
    return true;
  };

  GameState.prototype.tickWorkQueue = function () {
    this._promoteGatherWorkHead();
    if (!this.activeWork) return;

    const aw = this.activeWork;
    if (this._isGatherWorkBlocked(aw)) return;

    const startedAt = aw.startedAt;
    if (!Number.isFinite(startedAt)) return;
    const dur = aw.durationMs || DEFAULT_GATHER_WORK_MS;
    const elapsed = Date.now() - startedAt;
    if (elapsed < dur) return;

    const gatherId = aw.gatherId;
    const optsRaw = aw.options || {};
    const opts = { ...optsRaw };
    delete opts.source;
    const workId = aw.workId;
    const blockedProgressMs = Math.max(0, dur - elapsed);

    this.activeWork = null;

    const ok = this.gather(gatherId, opts);
    if (!ok) {
      let reason = "Сбор сейчас недоступен.";
      if (this._isManualLaneWorkId(String(workId || ""))) {
        try {
          const p = this.getGatherProfile(gatherId, opts);
          if (p?.blockedReason) reason = String(p.blockedReason);
        } catch (_) {
          /* ignore */
        }
      } else {
        try {
          const ev = origEvaluate.call(this, workId, opts);
          if (ev?.reasons?.length) reason = String(ev.reasons[0]);
        } catch (_) {
          /* ignore */
        }
      }
      this.activeWork = {
        workId,
        gatherId,
        durationMs: dur,
        options: opts,
        startedAt: null,
        state: "blocked",
        blockedReason: reason,
        blockedProgressMs,
      };
      this.addLog(`⏸ Работа приостановлена: ${reason}`);
      this.markDirty();
      return;
    }

    this._promoteGatherWorkHead();
    this._checkGoals?.();
    this.markDirty();
  };

  /**
   * Повторить приостановленную активную gather-работу (полный цикл таймера заново).
   * @returns {boolean}
   */
  GameState.prototype.retryBlockedGatherWork = function () {
    const aw = this.activeWork;
    if (!aw || !this._isGatherWorkBlocked(aw)) return false;

    if (this._isManualLaneWorkId(aw.workId)) {
      if (!this.canGather(aw.gatherId, aw.options || {})) {
        let r0 = "Сбор по-прежнему недоступен.";
        try {
          const p = this.getGatherProfile(aw.gatherId, aw.options || {});
          if (p?.blockedReason) r0 = String(p.blockedReason);
        } catch (_) {
          /* ignore */
        }
        this.activeWork = { ...aw, blockedReason: r0 };
        this.markDirty();
        return false;
      }
      const dur = aw.durationMs || DEFAULT_GATHER_WORK_MS;
      this.activeWork = {
        workId: aw.workId,
        gatherId: aw.gatherId,
        durationMs: dur,
        options: aw.options || {},
        startedAt: Date.now(),
        state: "running",
      };
      this.addLog("▶ Работа снова запущена.");
      this.markDirty();
      return true;
    }

    const gate = this.evaluateWorkActionAvailability(aw.workId, aw.options || {});
    if (!gate.available) {
      const r0 = gate.reasons?.[0] ? String(gate.reasons[0]) : aw.blockedReason;
      this.activeWork = { ...aw, blockedReason: r0 || aw.blockedReason };
      this.markDirty();
      return false;
    }
    const dur = aw.durationMs || DEFAULT_GATHER_WORK_MS;
    this.activeWork = {
      workId: aw.workId,
      gatherId: aw.gatherId,
      durationMs: dur,
      options: aw.options || {},
      startedAt: Date.now(),
      state: "running",
    };
    this.addLog("▶ Работа снова запущена.");
    this.markDirty();
    return true;
  };

  GameState.prototype.cancelActiveGatherWork = function () {
    if (!this.activeWork) return false;
    const aw = this.activeWork;
    const title = laneWorkTitle(this, aw.workId, aw.gatherId);
    this.activeWork = null;
    this.addLog(`✕ Работа отменена: ${title}`);
    this._promoteGatherWorkHead();
    this.markDirty();
    return true;
  };

  GameState.prototype.cancelQueuedGatherWork = function (index) {
    const i = Number.isFinite(index) ? Math.floor(index) : -1;
    if (i < 0 || i >= (this.workQueue?.length || 0)) return false;
    const [removed] = this.workQueue.splice(i, 1);
    const title = laneWorkTitle(
      this,
      removed?.workId,
      removed?.gatherId,
    ) || "задача";
    this.addLog(`✕ Убрано из очереди: ${title}`);
    this.markDirty();
    return true;
  };

  GameState.prototype.getGatherWorkLaneState = function () {
    const maxQ = this.maxWorkQueueSize ?? 3;
    const now = Date.now();
    const items = [];

    if (this.activeWork) {
      const aw = this.activeWork;
      const work = this._getWorkActionDef?.(aw.workId);
      const dur = aw.durationMs || DEFAULT_GATHER_WORK_MS;
      if (this._isGatherWorkBlocked(aw)) {
        const rem = Number.isFinite(aw.blockedProgressMs)
          ? Math.max(0, aw.blockedProgressMs)
          : dur;
        const progress =
          dur > 0 ? Math.min(1, Math.max(0, (dur - rem) / dur)) : 0;
        items.push({
          workId: aw.workId,
          title: laneWorkTitle(this, aw.workId, aw.gatherId),
          category: work?.category || "",
          durationMs: dur,
          remainingMs: rem,
          progress,
          isActive: true,
          isBlocked: true,
          blockedReason: aw.blockedReason || "Сбор недоступен.",
        });
      } else {
        const elapsed = aw.startedAt ? now - aw.startedAt : 0;
        items.push({
          workId: aw.workId,
          title: laneWorkTitle(this, aw.workId, aw.gatherId),
          category: work?.category || "",
          durationMs: dur,
          remainingMs: Math.max(0, dur - elapsed),
          progress: dur > 0 ? Math.min(1, elapsed / dur) : 1,
          isActive: true,
          isBlocked: false,
          blockedReason: "",
        });
      }
    }

    for (const q of this.workQueue || []) {
      const work = this._getWorkActionDef?.(q.workId);
      items.push({
        workId: q.workId,
        title: laneWorkTitle(this, q.workId, q.gatherId),
        category: work?.category || "",
        durationMs: q.durationMs || DEFAULT_GATHER_WORK_MS,
        remainingMs: q.durationMs || DEFAULT_GATHER_WORK_MS,
        progress: 0,
        isActive: false,
        isBlocked: false,
        blockedReason: "",
      });
    }

    const pending = this.workQueue?.length || 0;
    const hasActive = !!this.activeWork;
    const canEnqueueMore = this._gatherWorkLaneHasRoom();

    return {
      items,
      maxQueue: maxQ,
      pendingCount: pending,
      freeSlots: Math.max(0, maxQ - pending),
      hasActive,
      canEnqueueMore,
      queueFullMessage: canEnqueueMore
        ? ""
        : "Очередь заполнена (1 активная + 3 ожидающих). Освободите место или отмените задачу.",
    };
  };

  GameState.prototype._serializeWorkLane = function () {
    const now = Date.now();
    const queue = (this.workQueue || []).map((j) => {
      const o = { ...(j.options || {}) };
      delete o.source;
      return {
        workId: j.workId,
        gatherId: j.gatherId,
        durationMs: j.durationMs,
        options: o,
      };
    });

    if (!this.activeWork) {
      return { active: null, queue };
    }

    const aw = this.activeWork;
    const dur = aw.durationMs || DEFAULT_GATHER_WORK_MS;
    const activeOpts = { ...(aw.options || {}) };
    delete activeOpts.source;

    if (this._isGatherWorkBlocked(aw)) {
      const rem = Number.isFinite(aw.blockedProgressMs)
        ? Math.max(0, aw.blockedProgressMs)
        : dur;
      return {
        active: {
          workId: aw.workId,
          gatherId: aw.gatherId,
          durationMs: dur,
          options: activeOpts,
          state: "blocked",
          blockedReason: String(aw.blockedReason || "Сбор недоступен."),
          blockedProgressMs: rem,
        },
        queue,
      };
    }

    const elapsed = aw.startedAt ? now - aw.startedAt : 0;
    const remainingMs = Math.max(0, dur - elapsed);

    return {
      active: {
        workId: aw.workId,
        gatherId: aw.gatherId,
        durationMs: dur,
        remainingMs,
        options: activeOpts,
        state: "running",
      },
      queue,
    };
  };

  GameState.prototype._restoreWorkLane = function (raw) {
    this.workQueue = [];
    this.activeWork = null;
    const maxQ = this.maxWorkQueueSize ?? 3;
    if (!raw || typeof raw !== "object") return;

    const now = Date.now();
    if (Array.isArray(raw.queue)) {
      for (const entry of raw.queue.slice(0, maxQ)) {
        if (!entry?.workId || !entry?.gatherId) continue;
        this.workQueue.push({
          workId: String(entry.workId),
          gatherId: String(entry.gatherId),
          durationMs: Number.isFinite(entry.durationMs)
            ? Math.max(500, entry.durationMs)
            : this._getGatherWorkDurationMs(entry.workId),
          options:
            entry.options && typeof entry.options === "object"
              ? entry.options
              : {},
          startedAt: null,
          state: "running",
        });
      }
    }

    if (raw.active && raw.active.workId && raw.active.gatherId) {
      const durationMs = Number.isFinite(raw.active.durationMs)
        ? Math.max(500, raw.active.durationMs)
        : this._getGatherWorkDurationMs(raw.active.workId);
      const opts =
        raw.active.options && typeof raw.active.options === "object"
          ? raw.active.options
          : {};

      if (raw.active.state === "blocked") {
        const rem = Number.isFinite(raw.active.blockedProgressMs)
          ? Math.max(0, Math.min(durationMs, raw.active.blockedProgressMs))
          : durationMs;
        this.activeWork = {
          workId: String(raw.active.workId),
          gatherId: String(raw.active.gatherId),
          durationMs,
          options: opts,
          startedAt: null,
          state: "blocked",
          blockedReason: String(
            raw.active.blockedReason || "Сбор недоступен.",
          ),
          blockedProgressMs: rem,
        };
      } else {
        const remainingMs = Number.isFinite(raw.active.remainingMs)
          ? Math.max(0, Math.min(durationMs, raw.active.remainingMs))
          : durationMs;
        this.activeWork = {
          workId: String(raw.active.workId),
          gatherId: String(raw.active.gatherId),
          durationMs,
          options: opts,
          startedAt: now - (durationMs - remainingMs),
          state: "running",
        };
      }
    }

    this._promoteGatherWorkHead();
  };
})();
