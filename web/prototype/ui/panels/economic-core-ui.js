// Economic core UI (Stage 1A) — stage, work cards, locked list, camp problems.

const ECORE_CAMP_ROUTINE_PRI_LABELS = {
  keep_fuel_stock: "Поддерживать топливо (древесина)",
  keep_stone_stock: "Поддерживать запас камня",
  keep_fiber_stock: "Поддерживать волокно",
  prepare_basic_materials: "Готовить базовые материалы",
};

const ECORE_CAMP_RES_LABELS = {
  wood: "Древесина",
  stone: "Камень",
  fiber: "Волокно",
};

Object.assign(UI.prototype, {
  _ecoreEscapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  /** Одна короткая строка для списка закрытых работ (без дублирования). */
  _ecoreFirstLockReason(reasons) {
    for (const r of reasons || []) {
      const t = String(r || "").trim();
      if (t) return t;
    }
    return "Недоступно.";
  },

  /** Короткая подсказка «сначала…» по первому коду из missing (только отображение). */
  _ecoreHintFromMissing(missing) {
    const raw = Array.isArray(missing) && missing.length ? String(missing[0]) : "";
    if (!raw) return "";
    if (raw === "energy") return "Сначала восстановите энергию или отдохните.";
    if (raw === "prologue") return "Сначала продвиньте шаги пролога.";
    if (raw === "cooldown") return "Сначала дождитесь перезарядки.";
    if (raw === "presentation") return "Сначала откройте этап или условия сценария.";
    if (raw === "unlock") return "Сначала разблокируйте рецепт или работу.";
    if (raw === "queue") return "Сначала освободите очередь крафта.";
    if (raw === "insights") return "Сначала получите нужные озарения.";
    if (raw === "resources") return "Сначала добудьте недостающие материалы.";
    if (raw === "blocked") return "Сначала снимите блокировку с действия.";
    if (raw.startsWith("building:")) return "Сначала постройте требуемое здание.";
    if (raw.startsWith("gather:")) return "Сначала выполните условия для этого сбора.";
    if (raw.startsWith("recipe:")) return "Сначала откройте рецепт в развитии лагеря.";
    return "";
  },

  _ecoreOneLine(text, maxLen = 120) {
    const s = String(text ?? "").replace(/\s+/g, " ").trim();
    if (s.length <= maxLen) return s;
    return `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
  },

  renderEconomicCorePanel() {
    const container = document.getElementById("shell-economic-core");
    if (!container) return;

    const mode = this.getShellMode?.() || "map";
    const hideIntro = this.game.shouldShowOnboardingIntro?.();
    const show = mode === "production" && !hideIntro;

    if (!show) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    container.hidden = false;

    const bundle = this.game.getCurrentEconomicStageBundle?.() || {
      id: "lone_survivor",
      def: null,
    };
    const def = bundle.def;
    const nextId = def?.nextStageId || null;
    const nextDef = nextId
      ? this.game.getEconomicStageDefinition?.(nextId)
      : null;

    const ids = this.data.workActionIdsOrdered || [];
    const evaluations = ids.map((wid) => ({
      id: wid,
      work: this.data.workActions?.[wid],
      ev: this.game.evaluateWorkActionAvailability?.(wid) || {
        available: false,
        reasons: ["Нет оценки доступности."],
        missing: [],
      },
    }));

    const availableWorks = evaluations.filter((x) => x.ev.available);
    const lockedWorks = evaluations
      .filter((x) => !x.ev.available)
      .slice(0, 3);

    const problemsRaw = this.game.getCampEconomicProblems?.() || [];
    const problems = problemsRaw.slice(0, 3);

    let nextStep = null;
    try {
      nextStep =
        typeof this.game.getEconomicNextStep === "function"
          ? this.game.getEconomicNextStep()
          : null;
    } catch (_) {
      nextStep = null;
    }

    const stageTitle = def?.title || "Этап развития";
    const stageDesc = def?.description || "";
    const stageDescLine = stageDesc
      ? this._ecoreOneLine(stageDesc, 140)
      : "";
    const nextLine = nextDef
      ? `Следующий этап: ${nextDef.title}.`
      : "Дальнейшие этапы откроются по мере развития лагеря.";
    const nextLineShort = this._ecoreOneLine(nextLine, 100);

    const nextHeadline = this._ecoreOneLine(
      nextStep?.headline || "Следуйте подсказкам этапа и журналу.",
      160,
    );
    const nextDetailRaw = String(nextStep?.detail || "").trim();
    const nextDetailLine = nextDetailRaw
      ? this._ecoreOneLine(nextDetailRaw, 160)
      : "";

    const worksHtml = availableWorks
      .map(({ id, work, ev }) => {
        const title = this._ecoreEscapeHtml(work?.title || id);
        const desc = this._ecoreEscapeHtml(work?.description || "");
        const meta = this._ecoreEscapeHtml(work?.category || "");
        const hid = this._ecoreEscapeHtml(id);
        const ex = work?.execute;
        const btnLabel =
          ex?.type === "gather"
            ? "В работу"
            : ex?.type === "craft"
              ? "В очередь крафта"
              : "Выполнить";
        return `
          <div class="ecore-work-card is-available" data-work-id="${hid}" data-economic-highlight-id="${hid}">
            <div class="ecore-work-title">${title}</div>
            <div class="ecore-work-kind${meta ? "" : " ecore-work-kind--empty"}">${meta || " "}</div>
            ${desc ? `<div class="ecore-work-desc">${desc}</div>` : '<div class="ecore-work-desc ecore-work-desc--empty"></div>'}
            <button type="button" class="ecore-work-btn" data-work-dispatch="${hid}">${this._ecoreEscapeHtml(btnLabel)}</button>
          </div>
        `;
      })
      .join("");

    const lockedHtml = lockedWorks
      .map(({ id, work, ev }) => {
        const title = this._ecoreEscapeHtml(work?.title || id);
        const hid = this._ecoreEscapeHtml(id);
        const reason = this._ecoreEscapeHtml(
          this._ecoreFirstLockReason(ev.reasons),
        );
        const hintRaw = this._ecoreHintFromMissing(ev.missing);
        const hint = hintRaw ? this._ecoreEscapeHtml(hintRaw) : "";
        return `<li class="ecore-locked-item" data-economic-highlight-id="${hid}"><span class="ecore-locked-title">${title}</span><span class="ecore-locked-reason">${reason}</span>${hint ? `<span class="ecore-locked-hint">${hint}</span>` : ""}</li>`;
      })
      .join("");

    const problemsHtml = problems
      .map((p) => {
        const cls =
          p.tone === "ok" ? "is-ok" : p.tone === "bad" ? "is-bad" : "is-warn";
        return `<div class="ecore-problem ${cls}" data-economic-problem-tone="${this._ecoreEscapeHtml(p.tone)}">${this._ecoreEscapeHtml(p.text)}</div>`;
      })
      .join("");

    const lane = this.game.getGatherWorkLaneState?.() || {
      items: [],
      maxQueue: 3,
      freeSlots: 3,
      pendingCount: 0,
      hasActive: false,
    };
    let workLaneHtml = "";
    if (!lane.items.length) {
      workLaneHtml = `
      <section class="ecore-block ecore-work-lane" aria-label="Рабочий ход">
        <div class="ecore-section-title">Рабочий ход</div>
        <p class="ecore-work-lane-empty">Нет активной работы — сборы из списка ниже занимают время и ставятся в очередь (до ${lane.maxQueue} ожидающих).</p>
      </section>`;
    } else {
      const rows = lane.items
        .map((it, idx) => {
          const title = this._ecoreEscapeHtml(it.title || it.workId);
          const pct = Math.round((it.progress || 0) * 100);
          let meta;
          let bar;
          let actions;
          if (it.isBlocked) {
            const br = this._ecoreEscapeHtml(it.blockedReason || "Сбор недоступен.");
            meta = `<span class="ecore-work-lane-badge is-blocked">приостановлена</span>`;
            bar = `<div class="ecore-work-lane-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="ecore-work-lane-bar-fill" style="width:${pct}%"></span></div>
              <p class="ecore-work-lane-block-msg">${br}</p>`;
            actions = `<button type="button" class="ecore-work-lane-retry" data-work-lane-retry="1">Повторить</button>
              <button type="button" class="ecore-work-lane-cancel" data-work-lane-cancel-active="1">Отменить</button>`;
          } else if (it.isActive) {
            meta = `<span class="ecore-work-lane-badge is-active">идёт</span>`;
            bar = `<div class="ecore-work-lane-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="ecore-work-lane-bar-fill" style="width:${pct}%"></span></div>`;
            actions = `<button type="button" class="ecore-work-lane-cancel" data-work-lane-cancel-active="1">Отменить</button>`;
          } else {
            meta = `<span class="ecore-work-lane-badge">в очереди</span>`;
            bar = "";
            actions = `<button type="button" class="ecore-work-lane-cancel" data-work-lane-cancel-queue="${idx - 1}">Убрать</button>`;
          }
          return `<li class="ecore-work-lane-item${it.isBlocked ? " is-blocked" : ""}">${meta}<div class="ecore-work-lane-row"><span class="ecore-work-lane-name">${title}</span><span class="ecore-work-lane-actions">${actions}</span></div>${bar}</li>`;
        })
        .join("");
      const queueHint = lane.queueFullMessage
        ? `<p class="ecore-work-lane-warn">${this._ecoreEscapeHtml(lane.queueFullMessage)}</p>`
        : "";
      workLaneHtml = `
      <section class="ecore-block ecore-work-lane" aria-label="Рабочий ход">
        <div class="ecore-section-title">Рабочий ход</div>
        <p class="ecore-work-lane-meta">Активно одна задача; в очереди до ${lane.maxQueue}. Свободно слотов очереди: ${lane.freeSlots}.</p>
        ${queueHint}
        <ul class="ecore-work-lane-list">${rows}</ul>
      </section>`;
    }

    const campRoutineGatedByPrologue =
      typeof this.game.isOnboardingActive === "function" &&
      this.game.isOnboardingActive();

    let campRoutineHtml = "";
    if (campRoutineGatedByPrologue) {
      campRoutineHtml = `
      <section class="ecore-block ecore-camp-routine ecore-camp-routine--gated" aria-label="Распорядок стоянки" data-economic-highlight-id="camp-routine">
        <div class="ecore-section-title">Распорядок стоянки</div>
        <p class="ecore-cr-gated-note">Откроется после первых устойчивых действий у стоянки.</p>
      </section>`;
    } else {
      const crm =
        typeof this.game.getCampRoutinePanelModel === "function"
          ? this.game.getCampRoutinePanelModel()
          : null;
      if (crm) {
        const priButtons = crm.priorityIds
        .map((pid) => {
          const lab = this._ecoreEscapeHtml(
            ECORE_CAMP_ROUTINE_PRI_LABELS[pid] || pid,
          );
          const hid = this._ecoreEscapeHtml(pid);
          const sel =
            crm.activePriorityId === pid ? " is-selected" : "";
          return `<button type="button" class="ecore-cr-pri${sel}" data-camp-routine-priority="${hid}">${lab}</button>`;
        })
        .join("");
      const targets = crm.targetRows
        .map((row) => {
          const rl = this._ecoreEscapeHtml(
            ECORE_CAMP_RES_LABELS[row.resourceId] || row.resourceId,
          );
          const rid = this._ecoreEscapeHtml(row.resourceId);
          const val = String(Math.floor(row.value));
          return `<div class="ecore-cr-target">
            <span class="ecore-cr-target-name">${rl}</span>
            <span class="ecore-cr-target-val">до ${val}</span>
            <button type="button" class="ecore-cr-step" data-camp-routine-target-delta="${rid}|-1" aria-label="Меньше">−</button>
            <button type="button" class="ecore-cr-step" data-camp-routine-target-delta="${rid}|1" aria-label="Больше">+</button>
          </div>`;
        })
        .join("");
      const hint = crm.hintText
        ? `<p class="ecore-cr-hint">${this._ecoreEscapeHtml(crm.hintText)}</p>`
        : "";
      const onClass = crm.enabled ? " is-on" : "";
      campRoutineHtml = `
      <section class="ecore-block ecore-camp-routine" aria-label="Распорядок стоянки" data-economic-highlight-id="camp-routine">
        <div class="ecore-section-title">Распорядок стоянки</div>
        <p class="ecore-cr-lead">Не чаще одного сбора за такт — только в свободный слот очереди работ.</p>
        <div class="ecore-cr-toolbar">
          <button type="button" class="ecore-cr-master${onClass}" data-camp-routine-toggle="1">${crm.enabled ? "Включено" : "Выключено"}</button>
          <button type="button" class="ecore-cr-now" data-camp-routine-now="1">Поставить сейчас</button>
        </div>
        <div class="ecore-cr-pri-list" role="group" aria-label="Задача">${priButtons}</div>
        ${
          crm.activePriorityId
            ? `<div class="ecore-cr-targets">${targets}</div>`
            : `<p class="ecore-cr-idle">Выберите задачу, чтобы задать целевые запасы.</p>`
        }
        ${hint}
      </section>`;
      }
    }

    container.innerHTML = `
      <div class="ecore-root" data-economic-highlight-id="economic-core">
      ${workLaneHtml}
      ${campRoutineHtml}
      <section class="ecore-priority" aria-label="Следующий шаг">
        <div class="ecore-priority-kicker">Следующий шаг</div>
        <div class="ecore-priority-title">${this._ecoreEscapeHtml(nextHeadline)}</div>
        ${nextDetailLine ? `<p class="ecore-priority-detail">${this._ecoreEscapeHtml(nextDetailLine)}</p>` : ""}
      </section>

      <section class="ecore-block ecore-block-works" aria-label="Доступные работы">
        <div class="ecore-section-title ecore-section-title--strong">Доступные работы</div>
        <div class="ecore-works" data-economic-section="works">${worksHtml || '<p class="ecore-empty">Сейчас нет работ, которые можно запустить с этого экрана.</p>'}</div>
      </section>

      <section class="ecore-block ecore-block-stage" aria-label="Текущий этап">
        <div class="ecore-head">
          <h3 class="ecore-stage-title">${this._ecoreEscapeHtml(stageTitle)}</h3>
          <span class="ecore-stage-id">${this._ecoreEscapeHtml(bundle.id)}</span>
        </div>
        ${stageDescLine ? `<p class="ecore-stage-desc ecore-line-clamp-1">${this._ecoreEscapeHtml(stageDescLine)}</p>` : ""}
        <p class="ecore-next ecore-next--compact">${this._ecoreEscapeHtml(nextLineShort)}</p>
      </section>

      <section class="ecore-block ecore-block-problems" aria-label="Проблемы лагеря">
        <div class="ecore-section-title">Проблемы лагеря</div>
        <div class="ecore-problems" data-economic-section="problems">${problemsHtml}</div>
      </section>

      <section class="ecore-block ecore-block-locked ecore-block-muted" aria-label="Закрытые возможности">
        <div class="ecore-section-title ecore-section-title--muted">Закрытые возможности</div>
        <div data-economic-section="locked">
        ${
          lockedHtml
            ? `<ul class="ecore-locked-list">${lockedHtml}</ul>`
            : '<p class="ecore-locked-empty">Все перечисленные работы доступны или ожидают условий карты.</p>'
        }
        </div>
      </section>
      </div>
    `;

    container.querySelectorAll("[data-work-dispatch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const workId = btn.getAttribute("data-work-dispatch");
        if (!workId) return;
        const ok = this.game.dispatchWorkAction?.(workId);
        if (ok) {
          this.render({ forcePanels: true });
        }
      });
    });

    container.querySelectorAll("[data-work-lane-cancel-active]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.game.cancelActiveGatherWork?.()) {
          this.render({ forcePanels: true });
        }
      });
    });
    container.querySelectorAll("[data-work-lane-cancel-queue]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-work-lane-cancel-queue");
        const i = parseInt(raw, 10);
        if (!Number.isFinite(i) || i < 0) return;
        if (this.game.cancelQueuedGatherWork?.(i)) {
          this.render({ forcePanels: true });
        }
      });
    });
    container.querySelectorAll("[data-work-lane-retry]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.game.retryBlockedGatherWork?.();
        this.render({ forcePanels: true });
      });
    });

    container.querySelectorAll("[data-camp-routine-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cr = this.game.campRoutine;
        if (!cr) return;
        this.game.setCampRoutineEnabled?.(!cr.enabled);
        this.render({ forcePanels: true });
      });
    });
    container.querySelectorAll("[data-camp-routine-priority]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-camp-routine-priority");
        if (!id) return;
        this.game.setCampRoutinePriority?.(id);
        this.render({ forcePanels: true });
      });
    });
    container.querySelectorAll("[data-camp-routine-target-delta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-camp-routine-target-delta");
        if (!raw || !raw.includes("|")) return;
        const pipe = raw.indexOf("|");
        const rid = raw.slice(0, pipe);
        const d = raw.slice(pipe + 1);
        const delta = parseInt(d, 10);
        if (!rid || !Number.isFinite(delta)) return;
        this.game.adjustCampRoutineTarget?.(rid, delta);
        this.render({ forcePanels: true });
      });
    });
    container.querySelectorAll("[data-camp-routine-now]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.game.tryCampRoutineEnqueueNow?.();
        this.render({ forcePanels: true });
      });
    });
  },
});
