// Character modal: full character sheet (avatar, bars, state, inventory,
// current action, camp status, nearest target, tips). Read-only visual layer
// on top of existing character state — introduces no new mechanics.

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
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    closeBtn.focus();

    // is-loaded уже проставлен в HTML-шаблоне; fallback ::before скрыт
  },

  _cmStartTitleEdit() {
    const state = this.game.getCharacterState();
    this._cmEditingTitle = true;
    this._cmEditingTitleDraft = state.title || "Человек";
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
        icon: "🎒",
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

  _cmRenderInventory() {
    const resources = this.game.resources || {};
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
    return `<div class="cm-inv-grid">${slots.join("")}</div>`;
  },

  _cmRenderActionBlock(state) {
    const trip = state.tripProfile;
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
      const sat = Number.isFinite(trip.satietyCost) ? trip.satietyCost : null;
      const hyd = Number.isFinite(trip.hydrationCost)
        ? trip.hydrationCost
        : null;
      const zone = trip.zoneLabel || "";
      const blocked = trip.blockedReason
        ? `<div class="cm-kv" style="color:#d07050"><span>⚠</span><span>${trip.blockedReason}</span></div>`
        : "";
      return `
        <div class="cm-action">
          <div class="cm-action-icon">${icon}</div>
          <div class="cm-action-body">
            <div class="cm-action-title">${kind}</div>
            <div class="cm-action-sub">${zone}</div>
          </div>
        </div>
        <div class="cm-kv-list" style="margin-top:10px">
          ${energy !== null ? `<div class="cm-kv"><span class="cm-kv-label">⚡ Расход энергии</span><span class="cm-kv-value cm-kv-value--bad">−${this._cmFmt(energy, 1)}</span></div>` : ""}
          ${hyd !== null ? `<div class="cm-kv"><span class="cm-kv-label">💧 Расход воды</span><span class="cm-kv-value cm-kv-value--bad">−${this._cmFmt(hyd, 2)}</span></div>` : ""}
          ${sat !== null ? `<div class="cm-kv"><span class="cm-kv-label">🍖 Расход сытости</span><span class="cm-kv-value cm-kv-value--bad">−${this._cmFmt(sat, 2)}</span></div>` : ""}
          ${Number.isFinite(trip.load) ? `<div class="cm-kv"><span class="cm-kv-label">🎒 Нагрузка</span><span class="cm-kv-value">${this._cmFmt(trip.load, 1)} / ${this._cmFmt(trip.carryCapacity, 1)}</span></div>` : ""}
          ${blocked}
        </div>
      `;
    }

    const regenSec = (state.regen.remainingMs / 1000).toFixed(1);
    return `
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
        ${Number.isFinite(trip.energyCost) ? `<div class="cm-kv"><span class="cm-kv-label">⚡ Расход на путь</span><span class="cm-kv-value cm-kv-value--bad">−${this._cmFmt(trip.energyCost, 1)}</span></div>` : ""}
        ${Number.isFinite(trip.hydrationCost) ? `<div class="cm-kv"><span class="cm-kv-label">💧 Расход воды</span><span class="cm-kv-value cm-kv-value--bad">−${this._cmFmt(trip.hydrationCost, 2)}</span></div>` : ""}
        ${Number.isFinite(trip.satietyCost) ? `<div class="cm-kv"><span class="cm-kv-label">🍖 Расход сытости</span><span class="cm-kv-value cm-kv-value--bad">−${this._cmFmt(trip.satietyCost, 2)}</span></div>` : ""}
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
    const currentTitle = state.title || "Человек";
    // Для input: используем сырой текст (браузер экранирует в атрибуте)
    // Для display: используем экранированный текст
    const titleDraftRaw = isEditingTitle
      ? this._cmEditingTitleDraft || currentTitle
      : currentTitle;
    const titleDraft = this._cmEscapeHtml(titleDraftRaw);

    // Camp / trip badge — «B пути» только при реальном движении
    const inCamp = !this._campTravelAction;
    const campBadge = inCamp
      ? `<div class="cm-hero-chip cm-hero-chip--camp">
           <span class="cm-hero-chip-icon">🔥</span>
           <span class="cm-hero-chip-text"><b>В лагере</b></span>
         </div>`
      : `<div class="cm-hero-chip">
           <span class="cm-hero-chip-icon">🚶</span>
           <span class="cm-hero-chip-text"><b>В пути</b>${state.tripProfile.zoneLabel ? `<span>${state.tripProfile.zoneLabel}</span>` : ""}</span>
         </div>`;

    // Carry badge: current load from trip profile (if any), else capacity only.
    const carryLoad = state.tripProfile?.load;
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
      note:
        (state.autoConsume?.food.ok
          ? "Автопотребление: вкл"
          : "Автопотребление: нет еды") + " (из лагеря)",
      currentDigits: 1,
    });
    const hydrationBar = this._cmRenderStatBar({
      icon: "💧",
      name: "Вода",
      current: state.hydration.current,
      max: state.hydration.max,
      pct: state.hydration.pct,
      kind: "hydration",
      note:
        (state.autoConsume?.water.ok
          ? "Автопотребление: вкл"
          : "Автопотребление: нет воды") + " (из лагеря)",
      currentDigits: 1,
    });
    const carryCap = state.carry.capacity;
    const carryCur = Number.isFinite(carryLoad) ? carryLoad : 0;
    const carryBar = this._cmRenderStatBar({
      icon: "🎒",
      name: "Нагрузка",
      current: carryCur,
      max: carryCap,
      pct: carryCap > 0 ? carryCur / carryCap : 0,
      kind: "carry",
      note:
        carryCur > carryCap * 0.85
          ? "Скорость перемещения снижена"
          : "Скорость перемещения без штрафов",
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
    const autoFoodThresholdPct = Math.round(autoC.food.threshold * 100);
    const autoWaterThresholdPct = Math.round(autoC.water.threshold * 100);
    const noteParts = [];
    noteParts.push(`Кликните «Вкл./Откл.», чтобы переключить автопотребление.`);
    if (autoC.food.enabled && autoC.water.enabled) {
      noteParts.push(
        `Сытость < ${autoFoodThresholdPct}% → еда из склада (+${autoC.food.recovery.toFixed(1)}). Вода < ${autoWaterThresholdPct}% → +${autoC.water.recovery.toFixed(1)}.`,
      );
    }
    if (!autoC.food.enabled || !autoC.water.enabled) {
      noteParts.push(`Отключённые потребности не будут восполняться.`);
    }
    if (autoC.food.enabled && autoC.food.stock < 1) {
      noteParts.push(`🍖 Запасы еды кончились.`);
    }
    if (autoC.water.enabled && autoC.water.stock < 1) {
      noteParts.push(`💧 Запасы воды кончились.`);
    }
    const autoNote = noteParts.join(" ");

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
          <span class="cm-hero-chip-icon">🎒</span>
          <span class="cm-hero-chip-text"><b>${carryBadgeValue}</b><span>нагрузка</span></span>
        </div>
      </div>

      <!-- 3-column grid -->
      <div class="cm-grid">
        <!-- LEFT -->
        <div class="cm-col">
          <div class="cm-card">
            ${energyBar}
            ${satietyBar}
            ${hydrationBar}
            ${carryBar}
          </div>
          <div class="cm-card">
            <div class="cm-card-title">Состояние</div>
            <div class="cm-state-list">${statesHtml}</div>
          </div>
        </div>

        <!-- MIDDLE -->
        <div class="cm-col">
          <div class="cm-card">
            <div class="cm-card-title">Текущее действие</div>
            ${this._cmRenderActionBlock(state)}
          </div>
          <div class="cm-card">
            <div class="cm-card-title">Режим в лагере</div>
            <div class="cm-kv-list">
              <div class="cm-kv"><span class="cm-kv-label">🍖 Сытость</span><span class="cm-kv-value cm-kv-value--bad">−${this._cmFmt(passiveDrainSat, 2)} / мин</span></div>
              <div class="cm-kv"><span class="cm-kv-label">💧 Вода</span><span class="cm-kv-value cm-kv-value--bad">−${this._cmFmt(passiveDrainHyd, 2)} / мин</span></div>
              <div class="cm-kv"><span class="cm-kv-label">🔄 Автопотребление</span><span class="cm-kv-value ${autoC.food.ok && autoC.water.ok ? "cm-kv-value--good" : "cm-kv-value--bad"}">${autoC.food.ok && autoC.water.ok ? "включено" : autoC.food.ok || autoC.water.ok ? "частично" : "нет запасов"}</span></div>
              ${
                autoC.shelter?.hasShelter || autoC.shelter?.hasCampfire
                  ? `<div class="cm-kv"><span class="cm-kv-label">🏕 Эффект построек</span><span class="cm-kv-value cm-kv-value--good">расход ×${this._cmFmt(autoC.drain?.satietyMult ?? 1, 2)}</span></div>`
                  : `<div class="cm-kv"><span class="cm-kv-label">🏕 Без построек</span><span class="cm-kv-value">костёр и укрытие снизят расход</span></div>`
              }
            </div>
          </div>
          <div class="cm-card">
            <div class="cm-card-title">Лагерь обеспечивает</div>
            ${this._cmRenderCampSupply()}
            <div class="cm-auto-note">
              Запасов хватит на ~${this._cmFmt(hoursFood, 1)} ч. еды и ~${this._cmFmt(hoursWater, 1)} ч. воды.
            </div>
          </div>
        </div>

        <!-- RIGHT -->
        <div class="cm-col">
          <div class="cm-card">
            <div class="cm-card-title">Инвентарь</div>
            ${this._cmRenderInventory()}
          </div>
          <div class="cm-card">
            <div class="cm-card-title">Автопотребление в лагере</div>
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
            <div class="cm-card-title">Выход: ближайшая цель</div>
            ${this._cmRenderTripTarget(state)}
          </div>
        </div>
      </div>

      <!-- Footer tip -->
      <div class="cm-footer-tip">
        <span class="cm-footer-tip-icon">💡</span>
        <span>Совет: улучшайте лагерь, чтобы снижать расход и быстрее восстанавливаться.</span>
      </div>
    `;
  },
});
