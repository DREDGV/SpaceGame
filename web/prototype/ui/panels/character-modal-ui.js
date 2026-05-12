// Character modal: full character sheet (avatar, bars, state, inventory,
// current action, camp status, nearest target, tips) with direct controls for
// the same core needs as the HUD.

Object.assign(UI.prototype, {
  bindCharacterModal() {
    const modal = document.getElementById("character-modal");
    const closeBtn = document.getElementById("character-modal-close-btn");
    const body = document.getElementById("character-modal-body");
    if (!modal || !closeBtn) return;

    const close = () => {
      this._cmEditingTitle = false;
      this._cmEditingTitleDraft = "";
      modal.style.display = "none";
      document.body.style.overflow = "";
    };

    closeBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") close();
    });

    // Делегирование клика по тумблерам авто-потребления.
    if (body) {
      body.addEventListener("click", (e) => {
        const supplyBtn = e.target.closest("[data-cm-supply]");
        if (supplyBtn) {
          const kind = supplyBtn.getAttribute("data-cm-supply");
          if (kind === "food" || kind === "water") {
            this.game.consumeCharacterSupply?.(kind);
            this.render({ forcePanels: true });
            this.renderCharacterModalContent();
          }
          return;
        }

        const restBtn = e.target.closest("[data-cm-rest]");
        if (restBtn) {
          if (this.game.restCharacter?.()) {
            this.scheduleRestCooldownRefresh?.(
              this.game.getCharacterRestCooldownMs?.() || 0,
            );
          }
          this.render({ forcePanels: true });
          this.renderCharacterModalContent();
          return;
        }

        const returnBtn = e.target.closest("[data-cm-return]");
        if (returnBtn) {
          if (!this._campTravelAction) {
            this._startCampReturnTrip?.();
          }
          this.render({ forcePanels: true });
          this.renderCharacterModalContent();
          return;
        }

        // Авто-потребление
        const toggleBtn = e.target.closest("[data-cm-toggle]");
        if (toggleBtn) {
          const kind = toggleBtn.getAttribute("data-cm-toggle");
          if (kind === "food" || kind === "water") {
            const status = this.game.getAutoConsumeStatus();
            const currentlyEnabled =
              kind === "food" ? status.food.enabled : status.water.enabled;
            if (typeof this.game.setAutoConsumeEnabled === "function") {
              this.game.setAutoConsumeEnabled(kind, !currentlyEnabled);
              this.renderCharacterModalContent();
            }
          }
          return;
        }

        // Редактирование имени персонажа
        const editBtn = e.target.closest("[data-cm-title-edit]");
        if (editBtn) {
          this._cmStartTitleEdit();
          return;
        }
      });

      body.addEventListener("input", (e) => {
        if (!e.target.matches("[data-cm-title-input]")) return;
        this._cmEditingTitleDraft = e.target.value;
      });

      body.addEventListener("keydown", (e) => {
        if (!e.target.matches("[data-cm-title-input]")) return;
        if (e.key === "Enter") {
          e.preventDefault();
          this._cmCommitTitleEdit();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          this._cmCancelTitleEdit();
        }
      });

      body.addEventListener("focusout", (e) => {
        if (!e.target.matches("[data-cm-title-input]")) return;
        if (!this._cmEditingTitle) return;
        this._cmCommitTitleEdit();
      });
    }
  },

  openCharacterModal() {
    const modal = document.getElementById("character-modal");
    const closeBtn = document.getElementById("character-modal-close-btn");
    if (!modal || !closeBtn) return;
    this._cmEditingTitle = false;
    this._cmEditingTitleDraft = "";
    this.renderCharacterModalContent();
    this._cmSyncModalTitle(this.game.getCharacterState()?.title);
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    closeBtn.focus();

    // is-loaded уже проставлен в HTML-шаблоне; fallback ::before скрыт
  },

  _cmStartTitleEdit() {
    const state = this.game.getCharacterState();
    this._cmEditingTitle = true;
    this._cmEditingTitleDraft = state.title || this._cmGetDefaultTitle();
    this.renderCharacterModalContent();
    // Используем queueMicrotask, чтобы гарантировать, что DOM обновлён
    queueMicrotask(() => {
      const input = document.querySelector(
        "#character-modal-body [data-cm-title-input]",
      );
      if (input) {
        input.focus();
        input.select();
      }
    });
  },

  _cmCommitTitleEdit() {
    if (!this._cmEditingTitle) return;
    const nextTitle =
      typeof this._cmEditingTitleDraft === "string"
        ? this._cmEditingTitleDraft.trim()
        : "";
    if (nextTitle) {
      if (typeof this.game.setCharacterTitle === "function") {
        this.game.setCharacterTitle(nextTitle);
      }
      this._cmEditingTitle = false;
      this._cmEditingTitleDraft = "";
    } else {
      // Если строка пуста, просто отменяем
      this._cmEditingTitle = false;
      this._cmEditingTitleDraft = "";
    }
    this.renderCharacterModalContent();
  },

  _cmCancelTitleEdit() {
    if (!this._cmEditingTitle) return;
    this._cmEditingTitle = false;
    this._cmEditingTitleDraft = "";
    this.renderCharacterModalContent();
  },

  _cmEscapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  _cmFmt(n, digits = 1) {
    if (!Number.isFinite(n)) return "—";
    return this.formatNumber(n, digits);
  },

  _cmGetDefaultTitle() {
    return this.data.character?.title || "Ведущий стоянки";
  },

  _cmSyncModalTitle(title) {
    const modalTitle = document.getElementById("character-modal-title");
    if (!modalTitle) return;
    modalTitle.textContent = `👤 ${title || this._cmGetDefaultTitle()}`;
  },

  _cmDescribeNeedRate(value, subject) {
    if (!Number.isFinite(value) || value <= 0.005) {
      return `${subject} почти не тратится`;
    }
    if (value <= 0.2) {
      return `${subject} уходит медленно`;
    }
    if (value <= 0.6) {
      return `${subject} уходит заметно`;
    }
    return `${subject} уходит быстро`;
  },

  _cmDescribeTripPressure(trip) {
    if (!trip) return "";
    const parts = [];
    if (trip.pathLabel) {
      parts.push(trip.pathLabel);
    }
    if (trip.effortLabel) {
      parts.push(trip.effortLabel);
    }
    if (Number.isFinite(trip.tripsRequired) && trip.tripsRequired > 1) {
      parts.push(`${trip.tripsRequired} ходки`);
    }
    if (Number.isFinite(trip.load) && Number.isFinite(trip.carryCapacity)) {
      const loadPct =
        trip.carryCapacity > 0 ? trip.load / trip.carryCapacity : 0;
      if (loadPct >= 0.85) {
        parts.push("почти предельный груз");
      } else if (loadPct >= 0.55) {
        parts.push("заметный груз");
      } else {
        parts.push("лёгкий груз");
      }
    }
    return parts.join(", ");
  },

  _cmSentenceCase(text) {
    const value = String(text || "").trim();
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

  /**
   * Maps current game state to a sprite cell in the 4×3 character-sheet.
   *
   * Sheet layout (col, row):
   *   (0,0) В норме      (1,0) Лёгкая жажда  (2,0) Сильная жажда  (3,0) Голоден
   *   (0,1) Устал        (1,1) Перегружен     (2,1) Замёрз          (3,1) Промок
   *   (0,2) Ранен        (1,2) Болен          (2,2) Отдыхает у костра  (3,2) Спит
   *
   * Returns { x, y, label } where x ∈ [0..3], y ∈ [0..2].
   */
  _cmGetAvatarSprite(state) {
    const hyd = state.hydration?.pct ?? 1;
    const sat = state.satiety?.pct ?? 1;
    const energy = state.energy?.pct ?? 1;
    const cond = state.condition?.id ?? "stable";
    const hasCampfire = state.autoConsume?.shelter?.hasCampfire ?? false;

    const carry = state.carry;
    const isTraveling = !!this._campTravelAction;
    const tripLoad = isTraveling ? state.tripProfile?.load : null;
    const isOverloaded =
      Number.isFinite(tripLoad) &&
      (carry?.capacity || 0) > 0 &&
      tripLoad > carry.capacity * 0.85;

    // Priority: most urgent state first.
    if (cond === "exhausted" && energy < 0.2)
      return { x: 3, y: 2, label: "Спит" };
    if (isOverloaded) return { x: 1, y: 1, label: "Перегружен" };
    if (hyd < 0.25) return { x: 2, y: 0, label: "Сильная жажда" };
    if (sat < 0.25) return { x: 3, y: 0, label: "Голоден" };
    if (cond === "exhausted") return { x: 0, y: 1, label: "Устал" };
    if (energy < 0.35) return { x: 0, y: 1, label: "Устал" };
    if (hyd < 0.5) return { x: 1, y: 0, label: "Лёгкая жажда" };
    if (sat < 0.5) return { x: 3, y: 0, label: "Голоден" };
    if (cond === "weakened") return { x: 0, y: 1, label: "Устал" };
    if (hasCampfire && energy > 0.65)
      return { x: 2, y: 2, label: "Отдыхает у костра" };
    return { x: 0, y: 0, label: "В норме" };
  },

  _cmComputeStates(state) {
    // Derive a small human-readable list of active states.
    const items = [];
    const hydr = state.hydration.pct;
    const sat = state.satiety.pct;
    const energy = state.energy.pct;
    const cond = state.condition;
    const atCamp =
      state.location?.atCamp ??
      state.location?.isAtCamp ??
      this.game.isCharacterAtCamp?.() ??
      true;

    // Base wellbeing (first row)
    if (cond.id === "stable") {
      items.push({
        icon: "😊",
        tone: "ok",
        name: "В норме",
        desc: "Штрафов нет",
      });
    } else if (cond.id === "weakened") {
      items.push({
        icon: "😕",
        tone: "warn",
        name: "Ослаблен",
        desc: cond.description || "Сниженные силы",
      });
    } else {
      items.push({
        icon: "😫",
        tone: "bad",
        name: "Истощён",
        desc: cond.description || "Резко просели силы",
      });
    }

    // Hydration tier
    if (hydr < 0.25) {
      items.push({
        icon: "🩸",
        tone: "bad",
        name: "Сильная жажда",
        desc: "Перемещение существенно замедлено",
      });
    } else if (hydr < 0.5) {
      items.push({
        icon: "💧",
        tone: "warn",
        name: "Лёгкая жажда",
        desc: "Скорость перемещения немного снижена",
      });
    }

    // Satiety tier
    if (sat < 0.25) {
      items.push({
        icon: "🍖",
        tone: "bad",
        name: "Сильный голод",
        desc: "Восстановление сил почти остановлено",
      });
    } else if (sat < 0.5) {
      items.push({
        icon: "🍖",
        tone: "warn",
        name: "Лёгкий голод",
        desc: "Восстановление сил снижено",
      });
    }

    // Energy-based rest state
    if (energy >= 0.9 && sat >= 0.6 && hydr >= 0.6) {
      items.push({
        icon: "💤",
        tone: "rest",
        name: "Выспался",
        desc: "Бонус к восстановлению энергии",
      });
    } else if (this._campTravelAction) {
      items.push({
        icon: "🚶",
        tone: "neutral",
        name: "В пути",
        desc: state.tripProfile?.zoneLabel || "Выход из лагеря",
      });
    } else if (!atCamp) {
      items.push({
        icon: "🧭",
        tone: "neutral",
        name: "Вне лагеря",
        desc: state.location?.tileName || "Участок карты",
      });
    } else {
      items.push({
        icon: "🏕",
        tone: "rest",
        name: "Отдыхает в лагере",
        desc: "Идёт пассивное восстановление",
      });
    }

    // Carry
    if (state.carry.capacityBonus > 0) {
      items.push({
        icon: "🧺",
        tone: "ok",
        name: "Нагрузка комфортная",
        desc: "Скорость без штрафов",
      });
    }

    return items.slice(0, 5);
  },

  _cmRenderStatBar(opts) {
    const {
      icon,
      name,
      current,
      max,
      pct,
      kind,
      note,
      currentDigits = 1,
      maxDigits = 0,
    } = opts;
    const clampedPct = Math.max(0, Math.min(100, pct * 100));
    return `
      <div class="cm-stat">
        <div class="cm-stat-head">
          <span class="cm-stat-icon">${icon}</span>
          <span class="cm-stat-name">${name}</span>
          <span class="cm-stat-value">${this._cmFmt(current, currentDigits)}
            <span class="cm-stat-value-max">/ ${this._cmFmt(max, maxDigits)}</span>
          </span>
        </div>
        <div class="cm-stat-bar">
          <div class="cm-stat-fill cm-stat-fill--${kind}" style="width:${clampedPct}%"></div>
        </div>
        ${note ? `<div class="cm-stat-note">${note}</div>` : ""}
      </div>
    `;
  },

  _cmRenderInventory(state = null) {
    const carriedResources = state?.carry?.carriedResources || {};
    const hasCarried = Object.values(carriedResources).some(
      (qty) => (Number(qty) || 0) > 0,
    );
    const resources = hasCarried ? carriedResources : this.game.resources || {};
    const data = this.data.resources || {};
    // Order by highest stock, then drop zeros.
    const entries = Object.entries(resources)
      .filter(([id, qty]) => qty > 0 && data[id])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const slots = [];
    for (let i = 0; i < 10; i++) {
      const entry = entries[i];
      if (!entry) {
        slots.push(
          `<div class="cm-inv-slot cm-inv-slot--empty"><span class="cm-inv-lock">·</span></div>`,
        );
        continue;
      }
      const [id, qty] = entry;
      const res = data[id] || {};
      const iconHtml = res.icon || `<span class="cm-inv-icon-text">📦</span>`;
      slots.push(`
        <div class="cm-inv-slot" title="${res.name || id}">
          <span class="cm-inv-icon-wrap">${iconHtml}</span>
          <span class="cm-inv-count">${Math.floor(qty)}</span>
        </div>
      `);
    }
    const emptyNote =
      entries.length === 0
        ? `<div class="cm-inv-empty-note">Сейчас персонаж ничего не несёт. До основания лагеря первые находки считаются ранним запасом у ночёвки, а после лагеря основная масса лежит на складе.</div>`
        : hasCarried
          ? `<div class="cm-inv-empty-note">Это то, что персонаж несёт прямо сейчас. Остальные ресурсы лежат в лагере.</div>`
          : `<div class="cm-inv-empty-note">Показаны запасы лагеря. Если персонаж выйдет за ресурсом, груз появится здесь до возвращения.</div>`;
    return `<div class="cm-inv-grid">${slots.join("")}</div>${emptyNote}`;
  },

  _cmRenderImmediateActions(state) {
    const waterAction = this.game.getCharacterManualSupplyProfile?.("water");
    const foodAction = this.game.getCharacterManualSupplyProfile?.("food");
    const rest = state.restProfile || {};
    const atCamp =
      state.location?.atCamp ??
      state.location?.isAtCamp ??
      this.game.isCharacterAtCamp?.() ??
      true;
    const tripTotal = this.game.getTripInventoryTotal?.() || 0;
    const fmtGain = (value) =>
      this._cmFmt(value, Number.isInteger(value) ? 0 : 1);
    const esc = (value) => this._cmEscapeHtml(value);
    const buttons = [];

    const buildButton = ({
      tone,
      label,
      meta,
      title,
      disabled = false,
      attr = "",
    }) => `
      <button
        type="button"
        class="cm-immediate-btn cm-immediate-btn--${tone}${disabled ? " is-disabled" : ""}"
        title="${esc(title)}"
        ${attr}
        ${disabled ? "disabled" : ""}
      >
        <span class="cm-immediate-btn-title">${label}</span>
        <span class="cm-immediate-btn-meta">${meta}</span>
      </button>
    `;

    if (waterAction?.show) {
      buttons.push(
        buildButton({
          tone: "water",
          label: `${waterAction.icon} ${waterAction.actionLabel}`,
          meta: waterAction.canUse
            ? `+${fmtGain(waterAction.gain)} воды · ${waterAction.sourceShortLabel}`
            : waterAction.blockedShortLabel,
          title: waterAction.canUse
            ? `${waterAction.actionLabel}: +${fmtGain(waterAction.gain)} воды ${waterAction.sourceLabel}.`
            : waterAction.blockedReason,
          disabled: !waterAction.canUse,
          attr: 'data-cm-supply="water"',
        }),
      );
    }

    if (foodAction?.show) {
      buttons.push(
        buildButton({
          tone: "food",
          label: `${foodAction.icon} ${foodAction.actionLabel}`,
          meta: foodAction.canUse
            ? `+${fmtGain(foodAction.gain)} сытости · ${foodAction.sourceShortLabel}`
            : foodAction.blockedShortLabel,
          title: foodAction.canUse
            ? `${foodAction.actionLabel}: +${fmtGain(foodAction.gain)} сытости ${foodAction.sourceLabel}.`
            : foodAction.blockedReason,
          disabled: !foodAction.canUse,
          attr: 'data-cm-supply="food"',
        }),
      );
    }

    const showRest =
      rest.canRest ||
      rest.remainingMs > 0 ||
      (!atCamp && state.energy?.current < state.energy?.max);
    if (showRest) {
      buttons.push(
        buildButton({
          tone: "rest",
          label: "🛌 Передохнуть",
          meta: rest.canRest
            ? `+${fmtGain(rest.energyGain + (rest.willUseWater ? rest.waterBonusEnergy || 0 : 0))} сил`
            : rest.remainingMs > 0
              ? `⌛ ${this.formatCooldownMs(rest.remainingMs)}`
              : "к стоянке",
          title: rest.canRest
            ? rest.label
            : rest.blockedReason || "Передышка недоступна.",
          disabled: !rest.canRest,
          attr: "data-cm-rest",
        }),
      );
    }

    if (!atCamp || tripTotal > 0) {
      const disabled = !!this._campTravelAction;
      buttons.push(
        buildButton({
          tone: "return",
          label: atCamp ? "📥 Сгрузить" : "🏠 Вернуться",
          meta: atCamp ? "добыча в лагерь" : "к стоянке и запасам",
          title: disabled
            ? "Персонаж уже в пути"
            : atCamp
              ? "Сгрузить переносимый запас в лагерь."
              : "Вернуться к стоянке и выгрузить добычу.",
          disabled,
          attr: "data-cm-return",
        }),
      );
    }

    if (buttons.length === 0) return "";
    return `<div class="cm-immediate-actions">${buttons.join("")}</div>`;
  },

  _cmRenderActionBlock(state) {
    const trip = state.tripProfile;
    const immediateActions = this._cmRenderImmediateActions(state);
    if (trip) {
      const kind =
        state.tripType === "build"
          ? "Строительство"
          : state.tripType === "trail"
            ? "Прокладка тропы"
            : "Сбор ресурса";
      const icon =
        state.tripType === "build"
          ? "🔨"
          : state.tripType === "trail"
            ? "🛤"
            : "🌿";
      const energy = Number.isFinite(trip.energyCost) ? trip.energyCost : null;
      const zone = trip.zoneLabel || "";
      const tripSummary = this._cmDescribeTripPressure(trip);
      const needsImpact = trip.needsImpact || null;
      const carryState = trip.carryState || null;
      const tripSummaryNote = needsImpact?.note
        ? `${needsImpact.note}${tripSummary ? ` Маршрут: ${tripSummary}.` : ""}`
        : tripSummary
          ? `Маршрут сейчас выглядит так: ${tripSummary}.`
          : "Здесь собрана короткая оценка пути и нагрузки перед выходом.";
      const tripTone = trip.blockedReason
        ? "warn"
        : needsImpact?.tone ||
          (energy !== null && energy >= (state.energy?.max || 0) * 0.35
            ? "warn"
            : "ok");
      const tripTitle = trip.blockedReason
        ? "Что мешает выйти"
        : needsImpact?.label || "Что это значит";
      const actionSub = tripSummary
        ? tripSummary
        : needsImpact?.label || "Цель выхода уже выбрана";
      return `
        ${immediateActions}
        <div class="cm-action">
          <div class="cm-action-icon">${icon}</div>
          <div class="cm-action-body">
            <div class="cm-action-title">${kind}${zone ? ` · ${zone}` : ""}</div>
            <div class="cm-action-sub">${actionSub}</div>
          </div>
        </div>
        <div class="cm-note-box cm-note-box--${tripTone}" style="margin-top:10px; margin-bottom:0;">
          <div class="cm-note-title">${tripTitle}</div>
          <div class="cm-note-copy">${trip.blockedReason || tripSummaryNote}</div>
        </div>
        <div class="cm-kv-list cm-kv-list--spaced">
          ${carryState ? `<div class="cm-kv"><span class="cm-kv-label">🧺 Ощущение груза</span><span class="cm-kv-value cm-kv-value--${carryState.tone === "ok" ? "good" : "bad"}">${carryState.label}</span></div>` : ""}
          ${Number.isFinite(trip.load) ? `<div class="cm-kv"><span class="cm-kv-label">🧺 Нагрузка</span><span class="cm-kv-value">${this._cmFmt(trip.load, 1)} / ${this._cmFmt(trip.carryCapacity, 1)}</span></div>` : ""}
          ${Number.isFinite(trip.tripsRequired) ? `<div class="cm-kv"><span class="cm-kv-label">📦 Ходки</span><span class="cm-kv-value">${Math.max(1, Math.round(trip.tripsRequired))}</span></div>` : ""}
          ${Number.isFinite(trip.totalLoad) ? `<div class="cm-kv"><span class="cm-kv-label">Σ Общий объём</span><span class="cm-kv-value">${this._cmFmt(trip.totalLoad, 1)}</span></div>` : ""}
        </div>
      `;
    }

    const regenSec = (state.regen.remainingMs / 1000).toFixed(1);
    return `
      ${immediateActions}
      <div class="cm-action">
        <div class="cm-action-icon">🏕</div>
        <div class="cm-action-body">
          <div class="cm-action-title">Отдых в лагере</div>
          <div class="cm-action-sub">Идёт пассивное восстановление</div>
        </div>
      </div>
      <div class="cm-kv-list" style="margin-top:10px">
        <div class="cm-kv"><span class="cm-kv-label">⚡ Следующий цикл</span><span class="cm-kv-value">через ${regenSec} с</span></div>
        <div class="cm-kv"><span class="cm-kv-label">⚡ За цикл</span><span class="cm-kv-value cm-kv-value--good">+${this._cmFmt(state.regen.perTick, 1)}</span></div>
        <div class="cm-kv"><span class="cm-kv-label">🍖 Сытость/цикл</span><span class="cm-kv-value cm-kv-value--good">+${this._cmFmt(state.satiety.recoveryPerTick, 2)}</span></div>
        <div class="cm-kv"><span class="cm-kv-label">💧 Вода/цикл</span><span class="cm-kv-value cm-kv-value--good">+${this._cmFmt(state.hydration.recoveryPerTick, 2)}</span></div>
      </div>
    `;
  },

  _cmRenderCampSupply() {
    const resources = this.game.resources || {};
    const food = Math.floor(resources.food || 0);
    const water = Math.floor(resources.water || 0);
    return `
      <div class="cm-kv-list">
        <div class="cm-kv">
          <span class="cm-kv-label">🍖 Еда в запасе</span>
          <span class="cm-kv-value">${food}</span>
        </div>
        <div class="cm-kv">
          <span class="cm-kv-label">💧 Вода в запасе</span>
          <span class="cm-kv-value">${water}</span>
        </div>
      </div>
    `;
  },

  _cmRenderTripTarget(state) {
    const trip = state.tripProfile;
    if (!trip) {
      return `<div class="cm-kv-list">
        <div class="cm-kv"><span class="cm-kv-label">Нет активной цели</span><span class="cm-kv-value">—</span></div>
        <div class="cm-auto-note">Выберите участок на карте лагеря, чтобы увидеть стоимость выхода.</div>
      </div>`;
    }

    const dist = Number.isFinite(trip.distance) ? trip.distance : null;
    const timeSec = Number.isFinite(trip.estimatedTime)
      ? trip.estimatedTime
      : null;
    const pathLabel = trip.pathLabel || (trip.pathIcon ? trip.pathIcon : "—");
    const costBits = [
      Number.isFinite(trip.energyCost)
        ? `⚡ −${this._cmFmt(trip.energyCost, 1)}`
        : "",
      Number.isFinite(trip.satietyCost)
        ? `🍖 −${this._cmFmt(trip.satietyCost, 2)}`
        : "",
      Number.isFinite(trip.hydrationCost)
        ? `💧 −${this._cmFmt(trip.hydrationCost, 2)}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return `
      <div class="cm-action" style="margin-bottom:10px">
        <div class="cm-action-icon">🎯</div>
        <div class="cm-action-body">
          <div class="cm-action-title">${trip.label || trip.zoneLabel || "Цель выхода"}</div>
          <div class="cm-action-sub">${pathLabel}</div>
        </div>
      </div>
      <div class="cm-kv-list">
        ${dist !== null ? `<div class="cm-kv"><span class="cm-kv-label">Дистанция (туда и обратно)</span><span class="cm-kv-value">${dist} переходов</span></div>` : ""}
        ${timeSec !== null ? `<div class="cm-kv"><span class="cm-kv-label">Ожидаемое время</span><span class="cm-kv-value">${this._cmFmt(timeSec, 1)} с</span></div>` : ""}
        ${costBits ? `<div class="cm-kv"><span class="cm-kv-label">Цена выхода</span><span class="cm-kv-value cm-kv-value--bad">${costBits}</span></div>` : ""}
        ${trip.blockedReason ? `<div class="cm-kv" style="color:#d07050"><span>⚠</span><span>${trip.blockedReason}</span></div>` : `<div class="cm-kv"><span class="cm-kv-label">Статус</span><span class="cm-kv-value cm-kv-value--good">Путь доступен</span></div>`}
      </div>
    `;
  },

  renderCharacterModalContent() {
    const container = document.getElementById("character-modal-body");
    if (!container) return;

    const state = this.game.getCharacterState();
    const resources = this.game.resources || {};

    // Level / XP: visual only — based on insights discovered so far.
    const insights = state.knowledge.insightsUnlocked || 0;
    const xpMax = Math.max(5, Math.ceil((insights + 1) / 5) * 5);
    const level = 1 + Math.floor(insights / 5);
    const xpIntoLevel = insights % 5;
    const xpPct = (xpIntoLevel / 5) * 100;
    const isEditingTitle = !!this._cmEditingTitle;
    const currentTitle = state.title || this._cmGetDefaultTitle();
    // Для input: используем сырой текст (браузер экранирует в атрибуте)
    // Для display: используем экранированный текст
    const titleDraftRaw = isEditingTitle
      ? this._cmEditingTitleDraft || currentTitle
      : currentTitle;
    const titleDraft = this._cmEscapeHtml(titleDraftRaw);
    this._cmSyncModalTitle(currentTitle);

    // Camp / trip badge follows the actual tile, not only active animation.
    const inCamp =
      state.location?.atCamp ??
      state.location?.isAtCamp ??
      this.game.isCharacterAtCamp?.() ??
      true;
    const campBadge = inCamp
      ? `<div class="cm-hero-chip cm-hero-chip--camp">
           <span class="cm-hero-chip-icon">🔥</span>
           <span class="cm-hero-chip-text"><b>В лагере</b></span>
         </div>`
      : `<div class="cm-hero-chip">
           <span class="cm-hero-chip-icon">${this._campTravelAction ? "🚶" : "🧭"}</span>
           <span class="cm-hero-chip-text"><b>${this._campTravelAction ? "В пути" : "Вне лагеря"}</b><span>${state.location?.tileName || state.tripProfile?.zoneLabel || "Участок карты"}</span></span>
         </div>`;

    // Carry badge: actual backpack load, not only selected trip estimate.
    const carryLoad = state.carry?.carriedLoad;
    const carryMax = state.carry.capacity;
    const carryBadgeValue = Number.isFinite(carryLoad)
      ? `${this._cmFmt(carryLoad, 1)} / ${this._cmFmt(carryMax, 1)}`
      : `— / ${this._cmFmt(carryMax, 1)}`;

    // Stat bars (left column)
    const energyBar = this._cmRenderStatBar({
      icon: "⚡",
      name: "Энергия",
      current: state.energy.current,
      max: state.energy.max,
      pct: state.energy.pct,
      kind: "energy",
      note: inCamp
        ? "Восстанавливается в лагере"
        : "В пути восстановление снижено",
      currentDigits: 1,
    });
    const satietyBar = this._cmRenderStatBar({
      icon: "🍖",
      name: "Сытость",
      current: state.satiety.current,
      max: state.satiety.max,
      pct: state.satiety.pct,
      kind: "satiety",
      note: `${state.condition?.needs?.satiety?.label || "Сытость"}: ${state.condition?.needs?.satiety?.note || "Показывает, насколько персонаж готов восстанавливаться и работать."}`,
      currentDigits: 1,
    });
    const hydrationBar = this._cmRenderStatBar({
      icon: "💧",
      name: "Вода",
      current: state.hydration.current,
      max: state.hydration.max,
      pct: state.hydration.pct,
      kind: "hydration",
      note: `${state.condition?.needs?.hydration?.label || "Вода"}: ${state.condition?.needs?.hydration?.note || "Показывает, насколько персонаж выдержит путь и работу."}`,
      currentDigits: 1,
    });
    const carryCap = state.carry.capacity;
    const carryCur = Number.isFinite(carryLoad) ? carryLoad : 0;
    const carryBar = this._cmRenderStatBar({
      icon: "🧺",
      name: "Нагрузка",
      current: carryCur,
      max: carryCap,
      pct: carryCap > 0 ? carryCur / carryCap : 0,
      kind: "carry",
      note: `${state.carry?.carriedLoadState?.label || "Нагрузка"}: ${state.carry?.carriedLoadState?.note || "Показывает, сколько персонаж реально несёт сейчас."}`,
      currentDigits: 1,
    });

    // States
    const states = this._cmComputeStates(state);
    const statesHtml = states
      .map(
        (s) => `
          <div class="cm-state-item">
            <span class="cm-state-dot">${s.icon}</span>
            <div class="cm-state-text">
              <span class="cm-state-name cm-state-name--${s.tone}">${s.name}</span>
              <span class="cm-state-desc">${s.desc}</span>
            </div>
          </div>
        `,
      )
      .join("");

    const passiveDrainSat = state.autoConsume?.drain?.satietyPerMin ?? 0.4;
    const passiveDrainHyd = state.autoConsume?.drain?.hydrationPerMin ?? 0.8;
    const foodPerHour = Math.max(0.1, passiveDrainSat * 60);
    const waterPerHour = Math.max(0.1, passiveDrainHyd * 60);
    const food = resources.food || 0;
    const water = resources.water || 0;
    const hoursFood =
      foodPerHour > 0 ? Math.floor((food / foodPerHour) * 10) / 10 : 0;
    const hoursWater =
      waterPerHour > 0 ? Math.floor((water / waterPerHour) * 10) / 10 : 0;

    // Avatar sprite
    const avatarSprite = this._cmGetAvatarSprite(state);
    // 4 columns fit the avatar width exactly; sprite element is slightly zoomed via CSS
    // to crop built-in borders and the baked-in tiny caption inside the source sheet.
    const _col = avatarSprite.x;
    const _row = avatarSprite.y;
    const avatarBpX = -(_col * 105);
    const avatarBpY = -(33 + _row * 129);

    const autoC = state.autoConsume || {
      food: {
        ok: false,
        enabled: true,
        threshold: 0.7,
        recovery: 1.5,
        stock: 0,
      },
      water: {
        ok: false,
        enabled: true,
        threshold: 0.75,
        recovery: 3,
        stock: 0,
      },
    };
    // Три состояния тумблера:
    //   «Вкл.» — включен и есть запасы
    //   «Нет запасов» — включен, но на складе 0
    //   «Откл.» — выключен вручную
    const foodToggleState = !autoC.food.enabled
      ? "Откл."
      : autoC.food.stock >= 1
        ? "Вкл."
        : "Нет запасов";
    const waterToggleState = !autoC.water.enabled
      ? "Откл."
      : autoC.water.stock >= 1
        ? "Вкл."
        : "Нет запасов";
    const foodToggleCls = !autoC.food.enabled
      ? "cm-toggle-state--off"
      : autoC.food.stock >= 1
        ? ""
        : "cm-toggle-state--paused";
    const waterToggleCls = !autoC.water.enabled
      ? "cm-toggle-state--off"
      : autoC.water.stock >= 1
        ? ""
        : "cm-toggle-state--paused";
    const noteParts = [];
    noteParts.push(
      "Тумблеры решают, будет ли лагерь автоматически давать еду и воду, когда персонаж просел после выхода.",
    );
    if (!autoC.food.enabled || !autoC.water.enabled) {
      noteParts.push("Отключённая потребность не будет восполняться сама.");
    }
    if (autoC.food.enabled && autoC.food.stock < 1) {
      noteParts.push("🍖 Еды в лагере нет: нужен выход за пищей.");
    }
    if (autoC.water.enabled && autoC.water.stock < 1) {
      noteParts.push("💧 Воды в лагере нет: нужен выход к источнику.");
    }
    const autoNote = noteParts.join(" ");
    const status = this._cpComputePanelStatus
      ? this._cpComputePanelStatus(state)
      : {
          label: state.condition?.label || "Состояние",
          note: state.condition?.description || "",
          tone: "info",
        };
    const trip = state.tripProfile || null;
    const rest = state.restProfile || {};
    const tripKind =
      state.tripType === "build"
        ? "Стройка"
        : state.tripType === "trail"
          ? "Тропа"
          : state.tripType === "gather"
            ? "Сбор"
            : "Выход";
    const rangeSummaryValue =
      state.condition.maxSafeDistance >= 99
        ? "Вся открытая карта"
        : state.condition.maxSafeDistance <= 1
          ? "Только рядом с лагерем"
          : `До ${state.condition.maxSafeDistance} переходов`;
    const enduranceNote =
      state.stats.enduranceBonus > 0
        ? `+${state.stats.enduranceBonus} к безопасной дальности`
        : "дальность пока держится только на текущих силах";
    const fieldcraftValue =
      state.stats.fieldcraft > 0
        ? `снимает до ${state.stats.fieldcraft} штрафа пути`
        : "без облегчения пути";
    const fieldcraftYieldBonus = state.stats.foragingYieldBonus || 0;
    const surveyRevealBonus = state.stats.surveyRevealBonus || 0;
    const fieldcraftNote =
      state.stats.fieldcraft > 0
        ? `хуже ощущаются тяжёлая местность и дальние выходы${fieldcraftYieldBonus > 0 ? `, а вода, еда и волокно дают +${fieldcraftYieldBonus}` : ""}${surveyRevealBonus > 0 ? ", при разведке может открыться соседняя клетка" : ""}`
        : "дистанция и тяжёлая почва бьют в полную силу";
    const useEarlySharedStock =
      this.game._shouldUseEarlySharedStock?.() || false;
    const carryValue =
      state.carry.carriedLoad > 0
        ? `${this.formatNumber(state.carry.carriedLoad)} / ${this.formatNumber(state.carry.capacity)} ед.`
        : `${this.formatNumber(state.carry.capacity)} ед.`;
    const carryNote =
      state.carry.carriedLoad > 0
        ? `свободно ещё ${this.formatNumber(state.carry.availableCapacity)} ед.`
        : useEarlySharedStock
          ? "до основания лагеря найденное сразу считается ранним запасом у ночёвки"
          : state.carry.capacityBonus > 0
            ? `лагерь и уклад дают +${this.formatNumber(state.carry.capacityBonus, 0)} к переноске`
            : "весь груз уносится на себе";
    const strengthCapacityBonus = state.carry.strengthCapacityBonus || 0;
    const heavyLoadPct = Math.round((state.carry.heavyThreshold || 0.85) * 100);
    const extractionYieldBonus = state.stats.extractionYieldBonus || 0;
    const strengthNote =
      strengthCapacityBonus > 0
        ? `+${this.formatNumber(strengthCapacityBonus, 1)} к переноске, тяжёлый груз с ${heavyLoadPct}%${extractionYieldBonus > 0 ? `, тяжёлая добыча +${extractionYieldBonus}` : ""}`
        : extractionYieldBonus > 0
          ? `тяжёлая добыча даёт +${extractionYieldBonus}, тяжёлый груз с ${heavyLoadPct}% переносимости`
          : `тяжёлый груз начинается с ${heavyLoadPct}% переносимости`;
    const travelGainPct = Math.max(
      0,
      Math.round((1 - (state.stats.travelSpeedMultiplier || 1)) * 100),
    );
    const needsRelief = state.stats.needsRelief || 0;
    const mobilityNote =
      needsRelief > 0
        ? `дальние выходы тратят на ${this.formatNumber(needsRelief, 2)} меньше еды и воды`
        : "еда и вода тратятся без снижения от хода";
    const ingenuityGainPct = Math.max(
      0,
      Math.round((1 - (state.stats.ingenuityTimeMultiplier || 1)) * 100),
    );
    const supplySalvageBonus = state.stats.supplySalvageBonus || 0;
    const ingenuityValue =
      ingenuityGainPct > 0
        ? `-${ingenuityGainPct}% к времени`
        : "базовый разбор";
    const ingenuityNote =
      ingenuityGainPct > 0
        ? `быстрее крафт, исследования и очередь знаний${supplySalvageBonus > 0 ? `, припасы дают +${supplySalvageBonus}` : ""}${surveyRevealBonus > 0 ? ", проще читать следы на карте" : ""}`
        : supplySalvageBonus > 0 || surveyRevealBonus > 0
          ? `припасы дают +${supplySalvageBonus}, а разведка лучше читает соседние следы`
          : "крафт и исследования идут без ускорения";
    const recoverySummary = state.recovery?.summary || "нет опоры отдыха";
    const overviewCards = this._cpBuildOverviewCards
      ? this._cpBuildOverviewCards({
          state,
          status,
          trip,
          tripKind,
          rest,
          recoverySummary,
          rangeValue: rangeSummaryValue,
          enduranceNote,
          mobilityNote,
        })
      : [];
    const cargoNote = [carryNote, strengthNote].filter(Boolean).join(". ");
    const capabilityCards = [
      {
        icon: "🗺",
        title: "Дальние выходы",
        value: rangeSummaryValue,
        note: `${enduranceNote}. ${mobilityNote}`,
      },
      {
        icon: "🥾",
        title: "Путь и сбор",
        value: fieldcraftValue,
        note: fieldcraftNote,
      },
      {
        icon: "🧺",
        title: "Груз",
        value: carryValue,
        note: cargoNote,
      },
      {
        icon: "🛠",
        title: "Ремесло и смекалка",
        value: ingenuityValue,
        note: ingenuityNote,
      },
    ];
    const supportStateLabel =
      autoC.food.ok && autoC.water.ok
        ? "Лагерь держит базовые нужды"
        : autoC.food.ok || autoC.water.ok
          ? "Лагерь помогает лишь частично"
          : "Лагерь не подстрахует";
    const normalizedRecoverySummary = this._cmSentenceCase(recoverySummary);
    const supportStateNote =
      autoC.food.ok && autoC.water.ok
        ? `Запасов хватит примерно на ${this._cmFmt(hoursFood, 1)} ч. еды и ${this._cmFmt(hoursWater, 1)} ч. воды. ${normalizedRecoverySummary}.`
        : autoC.food.ok || autoC.water.ok
          ? `Одна из базовых нужд ещё закрыта, но устойчивости уже не хватает. ${normalizedRecoverySummary}.`
          : `Еда или вода закончились, поэтому следующий цикл будет опираться только на текущие запасы тела. ${normalizedRecoverySummary}.`;
    const supportToneClass =
      autoC.food.ok && autoC.water.ok
        ? "ok"
        : autoC.food.ok || autoC.water.ok
          ? "warn"
          : "bad";
    const satietyRateNote = this._cmDescribeNeedRate(
      passiveDrainSat,
      "Сытость",
    );
    const hydrationRateNote = this._cmDescribeNeedRate(passiveDrainHyd, "Вода");
    const foodAutoLabel = !autoC.food.enabled
      ? "отключено вручную"
      : autoC.food.stock < 1
        ? "еды в лагере нет"
        : "включится при голоде";
    const waterAutoLabel = !autoC.water.enabled
      ? "отключено вручную"
      : autoC.water.stock < 1
        ? "воды в лагере нет"
        : "включится при жажде";
    const statusToneClass =
      status.tone === "bad" ? "bad" : status.tone === "warn" ? "warn" : "ok";
    const actionSectionTitle = trip
      ? "Если идти сейчас"
      : inCamp
        ? "Сейчас в лагере"
        : "Положение персонажа";

    container.innerHTML = `
      <!-- Hero -->
      <div class="cm-hero">
        <div class="cm-avatar" aria-label="${avatarSprite.label}">
          <div class="cm-avatar-sprite is-loaded" style="background-position: ${avatarBpX}px ${avatarBpY}px" data-sprite-img></div>
          <div class="cm-avatar-state-label">${this._cmEscapeHtml(avatarSprite.label)}</div>
        </div>
        <div class="cm-title-block">
          <div class="cm-title-row">
            ${
              isEditingTitle
                ? `<input
                    type="text"
                    class="cm-title-input"
                    data-cm-title-input
                    maxlength="32"
                    spellcheck="false"
                    autocapitalize="none"
                    aria-label="Имя персонажа"
                    value="${this._cmEscapeHtml(titleDraftRaw)}"
                  >`
                : `<div class="cm-title" data-cm-title-display>${titleDraft}</div>
                   <button class="cm-title-edit-btn" type="button" title="Изменить имя" data-cm-title-edit>✏️</button>`
            }
          </div>
          <div class="cm-subtitle">
            <span>Уровень ${level}</span>
            <span class="cm-xp-label">${xpIntoLevel} / 5 озарений до роста · всего ${insights}</span>
          </div>
          <div class="cm-xp-bar"><div class="cm-xp-fill" style="width:${xpPct}%"></div></div>
        </div>
        ${campBadge}
        <div class="cm-hero-chip">
          <span class="cm-hero-chip-icon">🧺</span>
          <span class="cm-hero-chip-text"><b>${carryBadgeValue}</b><span>нагрузка</span></span>
        </div>
      </div>

      <div class="cm-overview-grid">
        ${overviewCards
          .map(
            (card) => `
          <div class="cm-overview-card cm-overview-card--${card.tone || "info"}">
            <div class="cm-overview-label">${card.title}</div>
            <div class="cm-overview-value">${card.value}</div>
            <div class="cm-overview-note">${card.note}</div>
          </div>`,
          )
          .join("")}
      </div>

      <div class="cm-grid">
        <div class="cm-col">
          <div class="cm-card">
            <div class="cm-card-title">Жизненные показатели</div>
            ${energyBar}
            ${satietyBar}
            ${hydrationBar}
            ${carryBar}
          </div>
          <div class="cm-card">
            <div class="cm-card-title">Состояние сейчас</div>
            <div class="cm-note-box cm-note-box--${statusToneClass}">
              <div class="cm-note-title">${status.label}</div>
              <div class="cm-note-copy">${status.note}</div>
            </div>
            <div class="cm-state-list">${statesHtml}</div>
          </div>
        </div>

        <div class="cm-col">
          <div class="cm-card">
            <div class="cm-card-title">${actionSectionTitle}</div>
            ${this._cmRenderActionBlock(state)}
            <div class="cm-section-divider"></div>
            ${this._cmRenderTripTarget(state)}
          </div>
          <div class="cm-card">
            <div class="cm-card-title">Походные возможности</div>
            <div class="cm-practical-grid">
              ${capabilityCards
                .map(
                  (card) => `
                <div class="cm-practical-card">
                  <div class="cm-practical-label">${card.icon} ${card.title}</div>
                  <div class="cm-practical-value">${card.value}</div>
                  <div class="cm-practical-note">${card.note}</div>
                </div>`,
                )
                .join("")}
            </div>
          </div>
        </div>

        <div class="cm-col">
          <div class="cm-card">
            <div class="cm-card-title">Поддержка лагеря</div>
            <div class="cm-note-box cm-note-box--${supportToneClass}">
              <div class="cm-note-title">${supportStateLabel}</div>
              <div class="cm-note-copy">${supportStateNote}</div>
            </div>
            ${this._cmRenderCampSupply()}
            <div class="cm-kv-list cm-kv-list--spaced">
              <div class="cm-kv"><span class="cm-kv-label">🍖 Ритм сытости</span><span class="cm-kv-value">${satietyRateNote}</span></div>
              <div class="cm-kv"><span class="cm-kv-label">💧 Ритм воды</span><span class="cm-kv-value">${hydrationRateNote}</span></div>
              <div class="cm-kv"><span class="cm-kv-label">🍖 Еда из лагеря</span><span class="cm-kv-value ${autoC.food.enabled && autoC.food.stock >= 1 ? "cm-kv-value--good" : "cm-kv-value--bad"}">${foodAutoLabel}</span></div>
              <div class="cm-kv"><span class="cm-kv-label">💧 Вода из лагеря</span><span class="cm-kv-value ${autoC.water.enabled && autoC.water.stock >= 1 ? "cm-kv-value--good" : "cm-kv-value--bad"}">${waterAutoLabel}</span></div>
              ${
                autoC.shelter?.hasShelter || autoC.shelter?.hasCampfire
                  ? `<div class="cm-kv"><span class="cm-kv-label">🏕 Эффект построек</span><span class="cm-kv-value cm-kv-value--good">расход ×${this._cmFmt(autoC.drain?.satietyMult ?? 1, 2)}</span></div>`
                  : `<div class="cm-kv"><span class="cm-kv-label">🏕 Без построек</span><span class="cm-kv-value">костёр и укрытие ещё только предстоят</span></div>`
              }
            </div>
            <div class="cm-toggle-row">
              <span class="cm-toggle-label">🍖 Еда</span>
              <button type="button" data-cm-toggle="food" aria-pressed="${autoC.food.enabled ? "true" : "false"}" class="cm-toggle-state ${foodToggleCls}">${foodToggleState}</button>
            </div>
            <div class="cm-toggle-row">
              <span class="cm-toggle-label">💧 Вода</span>
              <button type="button" data-cm-toggle="water" aria-pressed="${autoC.water.enabled ? "true" : "false"}" class="cm-toggle-state ${waterToggleCls}">${waterToggleState}</button>
            </div>
            <div class="cm-auto-note">
              ${autoNote}
            </div>
          </div>
          <div class="cm-card">
            <div class="cm-card-title">Инвентарь и груз</div>
            ${this._cmRenderInventory(state)}
            <div class="cm-auto-note">${cargoNote}</div>
          </div>
        </div>
      </div>

      <!-- Footer tip -->
      <div class="cm-footer-tip">
        <span class="cm-footer-tip-icon">💡</span>
        <span>Совет: улучшайте лагерь, чтобы снижать расход и быстрее восстанавливаться.</span>
      </div>
    `;

    this._cmSyncModalTitle(currentTitle);
  },
});
