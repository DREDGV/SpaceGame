// Camp management screen — scene, dock, detail panel.
// Camp founding UI is in camp-founding-ui.js.

Object.assign(UI.prototype, {
  /** Shows a brief toast notification on the camp scene wrap. */
  _showCampToast(text) {
    const wrap = document.querySelector(".cs-scene-wrap");
    if (!wrap) return;
    // Remove any existing toast
    wrap.querySelector(".cs-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "cs-toast";
    toast.textContent = text;
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 3300);
  },

  /** Plays a short woody-click tone via Web Audio API (no file needed). */
  _playCampClickSound() {
    try {
      const ctx = this._audioCtx || (this._audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      gain.connect(ctx.destination);

      // Short thump: sine at 180Hz for wood-knock feel
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.1);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.13);
    } catch (_) {
      // Audio unavailable — silently ignore
    }
  },

  openCampScreen() {
    if (!this.game.isCampSetupDone()) return;
    this.game.refreshCampMap?.();
    const screen = document.getElementById("camp-screen");
    if (!screen) return;
    this.game.markCampEntered();
    screen.style.display = "flex";
    document.body.style.overflow = "hidden";
    this._selectedCampSlot = null;
    // Track previously built set to detect completions while screen is open
    this._prevBuiltKeys = new Set(Object.keys(this.game.buildings));
    this.renderCampScreen({ force: true });
    this._initCampSceneDrag();
    document.getElementById("cs-back-btn")?.focus();
  },

  closeCampScreen() {
    const screen = document.getElementById("camp-screen");
    if (!screen) return;
    screen.style.display = "none";
    document.body.style.overflow = "";
  },

  /** Initialise drag-to-scroll (pan) on the scene wrap. Idempotent. */
  _initCampSceneDrag() {
    const wrap = document.querySelector(".cs-scene-wrap");
    if (!wrap || wrap._dragBound) return;
    wrap._dragBound = true;
    let startX, startY, startScrollX, startScrollY, dragging = false;

    const onDown = (e) => {
      // Only drag on the wrap itself or the scene, not on slots
      if (e.target.closest(".cs-slot")) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startScrollX = wrap.scrollLeft; startScrollY = wrap.scrollTop;
      wrap.classList.add("is-dragging");
    };
    const onMove = (e) => {
      if (!dragging) return;
      wrap.scrollLeft = startScrollX - (e.clientX - startX);
      wrap.scrollTop  = startScrollY - (e.clientY - startY);
    };
    const onUp = () => {
      dragging = false;
      wrap.classList.remove("is-dragging");
    };

    wrap.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  },

  // ─── Camp management screen render ───────────────────────────────────────

  /** Camp slot layout: fixed positions relative to a 560×440 scene */

  _getCampSlotLayout() {
    return [
      {
        id: "campfire",
        buildingId: "campfire",
        x: 260,
        y: 195,
        label: "Очаг",
        emptyIcon: "🪵",
        emptyHint: "центр стоянки",
        role: "Центр лагеря. Тепло, свет и безопасность не появляются сразу: сначала стоянка должна стать жилой, и только потом здесь складывается настоящий очаг.",
      },
      {
        id: "rest_tent",
        buildingId: "rest_tent",
        x: 115,
        y: 110,
        label: "Укрытие",
        emptyIcon: "🛖",
        emptyHint: "место под укрытие",
        role: "Защита от среды и отдых. Укрытие даёт восстановление сил, увеличивает запас энергии и делает жизнь устойчивее.",
      },
      {
        id: "storage",
        buildingId: "storage",
        x: 415,
        y: 105,
        label: "Хранилище",
        emptyIcon: "📦",
        emptyHint: "место под хранилище",
        role: "Организация запасов. Хранилище увеличивает лимит ресурсов и уменьшает потери — основа хозяйственной устойчивости.",
      },
      {
        id: "workshop",
        buildingId: "workshop",
        x: 105,
        y: 320,
        label: "Мастерская",
        emptyIcon: "⚒️",
        emptyHint: "место под мастерскую",
        role: "Центр ремесла и инструментов. Мастерская открывает улучшенные орудия и более сложные производственные цепочки.",
      },
      {
        id: "kiln",
        buildingId: "kiln",
        x: 410,
        y: 325,
        label: "Печь",
        emptyIcon: "🧱",
        emptyHint: "место под печь",
        role: "Обработка материалов огнём. Печь нужна для обжига, керамики, кирпича — это следующий уровень производства.",
      },
    ];
  },

  /** Calculate camp development stage based on what's built */

  _getCampStage() {
    const b = this.game.buildings;
    const builtCount = Object.keys(b).length;
    const hasShelter = !!b.rest_tent;
    const hasCampfire = !!b.campfire;

    if (hasCampfire && builtCount >= 4)
      return { id: 4, label: "Производственный лагерь", icon: "🏘️" };
    if (hasCampfire) return { id: 3, label: "Лагерь с очагом", icon: "🔥" };
    if (hasShelter) return { id: 2, label: "Жилой лагерь", icon: "⛺" };
    return { id: 1, label: "Основанная стоянка", icon: "🏕️" };
  },

  _getCampfireSlotPresentation() {
    const building = this.data.buildings.campfire;
    const copy = this.getBuildingCopy(building);
    const construction = this.game.getConstructionState();
    const campfireState = this.game.getPrologueCampfireState?.();

    if (
      !this.game.isPrologueActive() ||
      this.game.buildings.campfire ||
      construction?.buildingId === "campfire"
    ) {
      return {
        name: copy.name,
        description: copy.description,
        icon: copy.icon,
        emptyIcon: "🔥",
        emptyHint: "место под очаг",
        dockLabel: copy.name,
        role: "Центр лагеря. Тепло, свет, безопасность. Костёр — сердце стоянки, вокруг которого строится вся жизнь.",
        sceneMode: "campfire",
      };
    }

    if (!campfireState?.shelterBuilt) {
      return {
        name: "Центр стоянки",
        description:
          "Лагерь только что основан. Пока это общий центр жизни без устойчивого очага: сперва нужно поставить жильё и сделать стоянку пригодной для более долгой жизни.",
        icon: "🪵",
        emptyIcon: "🪵",
        emptyHint: "центр стоянки",
        dockLabel: "Центр",
        role: "Пока это просто середина стоянки. Сначала общине нужно первое жильё. Когда лагерь перестанет быть случайной ночёвкой, это место превратится в очаг.",
        sceneMode: "center",
      };
    }

    if (!campfireState.canBuild) {
      return {
        name: "Будущий очаг",
        description:
          "Жильё уже стоит, и центр лагеря готовится к огню. Но очаг ещё рано складывать: сначала нужно закончить ранние цели и подготовить всё для устойчивого костра.",
        icon: "🪨",
        emptyIcon: "🪨",
        emptyHint: "место под очаг",
        dockLabel: "Очаг",
        role: "Жильё уже поставлено. Теперь это место ждёт очага: завершите ранние задачи, свяжите грубое орудие и подготовьте запас материалов, чтобы огонь не погас сразу.",
        sceneMode: "hearth-site",
      };
    }

    return {
      name: copy.name,
      description: copy.description,
      icon: copy.icon,
      emptyIcon: "🔥",
      emptyHint: "место под очаг",
      dockLabel: "Очаг",
      role: "Центр лагеря. Тепло, свет, безопасность. Костёр — сердце стоянки, вокруг которого строится вся жизнь.",
      sceneMode: "campfire-ready",
    };
  },

  _getCampSlotPresentation(slot) {
    const building = this.data.buildings[slot.buildingId];
    const copy = building ? this.getBuildingCopy(building) : null;

    if (slot.buildingId === "campfire") {
      return this._getCampfireSlotPresentation();
    }

    return {
      name: copy?.name || slot.label,
      description: copy?.description || "",
      icon: copy?.icon || slot.emptyIcon || "",
      emptyIcon: slot.emptyIcon || copy?.icon || "+",
      emptyHint: slot.emptyHint || slot.label,
      dockLabel: copy?.name || slot.label,
      role: slot.role || "",
      sceneMode: "default",
    };
  },

  renderCampScreen({ force = false } = {}) {
    const screen = document.getElementById("camp-screen");
    if (!screen || screen.style.display === "none") return;

    this.game.refreshCampMap?.();

    // Detect newly completed buildings while screen is open
    const currentBuilt = new Set(Object.keys(this.game.buildings));
    if (this._prevBuiltKeys) {
      for (const key of currentBuilt) {
        if (!this._prevBuiltKeys.has(key)) {
          // A building just completed — trigger toast + dock animation
          const bDef = this.data.buildings[key];
          const name = bDef?.name || key;
          this._showCampToast(`${bDef?.icon || "🏗️"} ${name} построено!`);
          // Mark dock item for animation (will apply on next dock render)
          this._justBuiltId = key;
        }
      }
      this._prevBuiltKeys = currentBuilt;
    }

    // Topbar (resources, energy) updates every tick — always safe to rebuild.
    this._renderCampTopbar();

    // Skip heavy DOM rebuilds while the user hovers over interactive zones
    // so that CSS :hover state is never lost, preventing flicker.
    // User-triggered calls (force=true) always do a full rebuild.
    const dockHovered   = !force && document.getElementById("cs-dock")?.matches(":hover");
    const detailHovered = !force && document.getElementById("cs-detail")?.matches(":hover");

    if (!dockHovered)   this._renderCampScene();
    if (!dockHovered)   this._renderCampDock();
    if (!detailHovered) this._renderCampDetail();
  },

  // ── A: Top status bar ────────────────────────────────────────────────────

  _renderCampTopbar() {
    // Camp name + stage
    const nameEl = document.getElementById("cs-camp-name");
    if (nameEl) {
      const settings = this.game.getCampSettings();
      const stage = this._getCampStage();
      const name = settings.name ? settings.name : "Лагерь";

      // Stage dots (4 stages)
      let dots = "";
      for (let i = 1; i <= 4; i++) {
        const cls =
          i < stage.id ? "is-done" : i === stage.id ? "is-active" : "";
        dots += `<span class="cs-topbar-stage-dot ${cls}"></span>`;
      }

      nameEl.innerHTML = `${stage.icon} ${name} <span class="cs-topbar-stage">${dots} ${stage.label}</span>`;

      // Building count badge
      const layout = this._getCampSlotLayout();
      const totalSlots = layout.length;
      const builtCount = layout.filter(s => !!this.game.buildings[s.buildingId]).length;
      let countEl = document.getElementById("cs-topbar-build-count");
      if (!countEl) {
        countEl = document.createElement("span");
        countEl.id = "cs-topbar-build-count";
        countEl.className = "cs-topbar-build-count";
        nameEl.appendChild(countEl);
      }
      countEl.textContent = `${builtCount}/${totalSlots}`;
      countEl.className = `cs-topbar-build-count${builtCount === totalSlots ? " is-complete" : ""}`;
    }

    // Key resources
    const resEl = document.getElementById("cs-topbar-resources");
    if (resEl) {
      const keyRes = ["wood", "stone", "clay", "fiber", "plank", "brick"];
      resEl.innerHTML = keyRes
        .filter(
          (id) =>
            (this.game.resources[id] || 0) > 0 ||
            this.game.resourceTotals?.[id] > 0,
        )
        .map((id) => {
          const val = this.game.resources[id] || 0;
          const def = this.data.resources[id];
          const label = def?.name || id;
          const cap = this.game.maxResourceCap || 15;
          return `<span class="cs-res-chip" title="${label}">
            <span class="cs-res-chip-icon">${this.getResourceDisplayIcon(id)}</span>
            <span class="cs-res-chip-val">${val}</span>
            <span class="cs-res-chip-tooltip">${label} ${val}/${cap}</span>
          </span>`;
        })
        .join("");
    }

    // Character status
    const charEl = document.getElementById("cs-topbar-character");
    if (charEl) {
      const energy = this.game.energy ?? 0;
      const maxE = this.game.maxEnergy ?? 12;
      const satiety = this.game.satiety ?? 0;
      const maxS = this.game.maxSatiety ?? 10;
      const hydration = this.game.hydration ?? 0;
      const maxH = this.game.maxHydration ?? 10;
      const ePct = maxE > 0 ? Math.round((energy / maxE) * 100) : 0;
      const sPct = maxS > 0 ? Math.round((satiety / maxS) * 100) : 0;
      const hPct = maxH > 0 ? Math.round((hydration / maxH) * 100) : 0;
      charEl.innerHTML = `
        <span class="cs-char-stat">⚡ ${Math.floor(energy)}
          <span class="cs-char-bar"><span class="cs-char-bar-fill cs-char-bar-fill--energy" style="width:${ePct}%"></span></span>
        </span>
        <span class="cs-char-stat">🍖 ${Math.floor(satiety)}
          <span class="cs-char-bar"><span class="cs-char-bar-fill cs-char-bar-fill--satiety" style="width:${sPct}%"></span></span>
        </span>
        <span class="cs-char-stat">💧 ${Math.floor(hydration)}
          <span class="cs-char-bar"><span class="cs-char-bar-fill cs-char-bar-fill--hydration" style="width:${hPct}%"></span></span>
        </span>
      `;
    }
  },

  // ── B: Central visual scene ──────────────────────────────────────────────

  _getCampfireSceneVariant(slotView, isBuilt, isConstructing) {
    if (isBuilt) {
      const hasHearth = this.game.localCampMap?.appliedUpgrades?.includes(
        "campfire_stone_hearth",
      );
      return hasHearth ? "hearth" : "live";
    }
    if (isConstructing) return "constructing";
    if (slotView.sceneMode === "campfire-ready") return "ready";
    if (slotView.sceneMode === "campfire") return "live";
    return null;
  },

  _renderCampfireSceneArt(iconEl, variant) {
    if (!iconEl || !variant) return;

    const sparkMarkup =
      variant === "live" || variant === "hearth"
        ? `
          <span class="cs-campfire-spark cs-campfire-spark--1"></span>
          <span class="cs-campfire-spark cs-campfire-spark--2"></span>
          <span class="cs-campfire-spark cs-campfire-spark--3"></span>
        `
        : "";
    const frontFlameMarkup =
      variant === "live" || variant === "hearth" || variant === "constructing"
        ? '<span class="cs-campfire-flame cs-campfire-flame--front"></span>'
        : "";
    const backFlameMarkup =
      variant === "live" || variant === "hearth"
        ? '<span class="cs-campfire-flame cs-campfire-flame--back"></span>'
        : variant === "constructing"
          ? '<span class="cs-campfire-smoke"></span>'
          : "";

    iconEl.innerHTML = `
      <span class="cs-campfire-art cs-campfire-art--${variant}">
        <span class="cs-campfire-stones"></span>
        <span class="cs-campfire-log cs-campfire-log--left"></span>
        <span class="cs-campfire-log cs-campfire-log--right"></span>
        <span class="cs-campfire-coals"></span>
        ${backFlameMarkup}
        ${frontFlameMarkup}
        ${sparkMarkup}
      </span>
    `;
  },

  _renderCampScene() {
    const scene = document.getElementById("cs-scene");
    if (!scene) return;

    const layout = this._getCampSlotLayout();
    const construction = this.game.getConstructionState();
    const stage = this._getCampStage();

    scene.className = "cs-scene cs-scene--stage-" + stage.id;
    if (
      this.game.buildings.campfire ||
      construction?.buildingId === "campfire"
    ) {
      scene.classList.add("cs-scene--campfire-live");
    }

    let slotsExist = scene.querySelector(".cs-slot");
    if (!slotsExist) {
      scene.innerHTML = "";
      for (const slot of layout) {
        const el = document.createElement("div");
        el.className = "cs-slot";
        el.dataset.slotId = slot.id;
        el.style.left = slot.x + "px";
        el.style.top = slot.y + "px";
        el.style.transform = "translate(-50%, -50%)";
        el.innerHTML = `
          <div class="cs-slot-ground"></div>
          <div class="cs-slot-icon"></div>
          <div class="cs-slot-label"></div>
          <div class="cs-slot-status"></div>
        `;
        el.addEventListener("click", () => {
          this._selectedCampSlot = slot.id;
          this._renderCampScene();
          this._renderCampDock();
          this._renderCampDetail();
          document.getElementById("cs-scene-hint")?.classList.add("is-hidden");
        });
        scene.appendChild(el);
      }
    }

    for (const slot of layout) {
      const el = scene.querySelector(`[data-slot-id="${slot.id}"]`);
      if (!el) continue;

      const building = this.data.buildings[slot.buildingId];
      const slotView = this._getCampSlotPresentation(slot);
      const isBuilt = !!this.game.buildings[slot.buildingId];
      const isConstructing = construction?.buildingId === slot.buildingId;
      const isSelected = this._selectedCampSlot === slot.id;

      const isCampfire = slot.buildingId === "campfire";
      const campfireVariant = isCampfire
        ? this._getCampfireSceneVariant(slotView, isBuilt, isConstructing)
        : null;

      el.classList.toggle("is-selected", isSelected);
      el.classList.toggle(
        "cs-slot--empty",
        !isBuilt && !isConstructing && !isCampfire,
      );
      el.classList.toggle("cs-slot--undiscovered", false);
      el.classList.toggle(
        "cs-slot--campfire",
        isCampfire &&
          (isBuilt ||
            isConstructing ||
            slotView.sceneMode === "campfire-ready" ||
            slotView.sceneMode === "campfire"),
      );
      el.classList.toggle(
        "cs-slot--campfire-ready",
        campfireVariant === "ready",
      );
      el.classList.toggle(
        "cs-slot--campfire-constructing",
        campfireVariant === "constructing",
      );
      el.classList.toggle("cs-slot--campfire-live", campfireVariant === "live");
      el.classList.toggle(
        "cs-slot--campfire-hearth",
        campfireVariant === "hearth",
      );
      el.classList.toggle(
        "cs-slot--camp-center",
        isCampfire && slotView.sceneMode === "center",
      );
      el.classList.toggle(
        "cs-slot--hearth-site",
        isCampfire && slotView.sceneMode === "hearth-site",
      );

      const iconEl = el.querySelector(".cs-slot-icon");
      const labelEl = el.querySelector(".cs-slot-label");
      const statusEl = el.querySelector(".cs-slot-status");

      if (isBuilt) {
        if (isCampfire) this._renderCampfireSceneArt(iconEl, campfireVariant);
        else iconEl.textContent = building?.icon || "🏗️";
        iconEl.style.cssText = "";
        labelEl.textContent = building?.name || slot.label;
        statusEl.textContent = "✓";
        statusEl.className = "cs-slot-status is-built";
        el.style.opacity = "";
      } else if (isConstructing) {
        if (isCampfire) this._renderCampfireSceneArt(iconEl, "constructing");
        else iconEl.textContent = building?.icon || "🏗️";
        iconEl.style.cssText = "";
        labelEl.textContent = building?.name || slot.label;
        const pct = Math.round((construction.progress || 0) * 100);
        statusEl.textContent = `⏳ ${pct}%`;
        statusEl.className = "cs-slot-status is-constructing";
        el.style.opacity = "";
      } else {
        if (isCampfire && campfireVariant === "ready") {
          this._renderCampfireSceneArt(iconEl, "ready");
        } else {
          iconEl.textContent = slotView.emptyIcon || slot.emptyIcon || "+";
        }
        iconEl.style.cssText = "";
        labelEl.textContent =
          slotView.emptyHint || slot.emptyHint || slot.label;
        statusEl.textContent = "";
        statusEl.className = "cs-slot-status";
        el.style.opacity = "";
      }
    }
  },

  // ── D: Bottom dock ───────────────────────────────────────────────────────

  _renderCampDock() {
    const dock = document.getElementById("cs-dock");
    if (!dock) return;

    const layout = this._getCampSlotLayout();
    const construction = this.game.getConstructionState();

    dock.innerHTML = "";
    const justBuiltId = this._justBuiltId;
    this._justBuiltId = null;
    for (const slot of layout) {
      const building = this.data.buildings[slot.buildingId];
      const slotView = this._getCampSlotPresentation(slot);
      const isBuilt = !!this.game.buildings[slot.buildingId];
      const isConstructing = construction?.buildingId === slot.buildingId;
      const isSelected = this._selectedCampSlot === slot.id;
      const isCampfire = slot.buildingId === "campfire";

      const item = document.createElement("div");
      item.className = "cs-dock-item";
      if (isBuilt) item.classList.add("is-built");
      if (isConstructing) item.classList.add("is-constructing");
      if (!isBuilt && !isConstructing) item.classList.add("is-empty");
      if (isSelected) item.classList.add("is-selected");

      let statusMark = "";
      if (isBuilt)
        statusMark = `<span class="cs-dock-status is-built" title="Построено">✓</span>`;
      else if (isConstructing)
        statusMark = `<span class="cs-dock-status is-constructing" title="Строится">⏳ ${Math.round((construction.progress || 0) * 100)}%</span>`;
      else
        statusMark = `<span class="cs-dock-status is-empty" title="Можно построить">＋</span>`;

      const icon =
        isBuilt || isConstructing
          ? building?.icon || "🏗️"
          : slotView.emptyIcon || slot.emptyIcon || "+";
      const label =
        isBuilt || isConstructing
          ? building?.name || slot.label
          : slotView.dockLabel || slot.label;

      const meta = isBuilt
        ? `<span class="cs-dock-meta">Построено</span>`
        : isConstructing
          ? `<span class="cs-dock-meta">Строится</span>`
          : `<span class="cs-dock-meta cs-dock-meta--empty">Пустой слот</span>`;

      item.innerHTML = `
        <span class="cs-dock-icon">${icon}</span>
        <span class="cs-dock-text">
          <span class="cs-dock-label">${label}</span>
          ${meta}
        </span>
        ${statusMark}
      `;

      item.addEventListener("click", () => {
        this._playCampClickSound();
        this._selectedCampSlot = slot.id;
        this._renderCampScene();
        this._renderCampDock();
        this._renderCampDetail();
        document.getElementById("cs-scene-hint")?.classList.add("is-hidden");
      });

      dock.appendChild(item);

      // Animate item if it just finished building
      if (justBuiltId === slot.buildingId) {
        requestAnimationFrame(() => {
          item.classList.add("just-built");
          item.addEventListener("animationend", () => item.classList.remove("just-built"), { once: true });
        });
      }
    }
  },

  // ── C: Right context panel ───────────────────────────────────────────────

  _renderCampDetail() {
    const content = document.getElementById("cs-detail-content");
    if (!content) return;

    const slotId = this._selectedCampSlot;
    if (!slotId) {
      // Живой intro: показываем состояние лагеря и подсказку что делать дальше
      const stage = this._getCampStage();
      const layout = this._getCampSlotLayout();
      const builtCount = layout.filter(s => !!this.game.buildings[s.buildingId]).length;
      const nextEmpty = layout.find(s => !this.game.buildings[s.buildingId]);
      const nextBuilding = nextEmpty ? this.data.buildings[nextEmpty.buildingId] : null;

      const stageIntros = [
        "Стоянка только что основана. Здесь ещё нет ни очага, ни укрытия — только земля и первые следы.",
        "Жильё уже поставлено. Стоянка стала местом, где можно остаться на несколько дней подряд.",
        "Очаг разгорелся. Лагерь приобрёл центр — теперь можно думать о ремесле и хранении.",
        "Лагерь полностью развит. Каждое место занято, производство запущено.",
      ];
      const introText = stageIntros[Math.min(stage.id - 1, stageIntros.length - 1)];

      let hint = "";
      if (nextBuilding && builtCount < layout.length) {
        const canBuild = this.game.canBuild(nextEmpty.buildingId);
        hint = canBuild
          ? `Нажмите на <strong>${nextBuilding.name}</strong> в левом списке, чтобы начать строительство.`
          : `Следующая постройка: <strong>${nextBuilding.name}</strong>. Соберите нужные ресурсы.`;
      } else if (builtCount === layout.length) {
        hint = "Все постройки завершены. Исследуйте улучшения в каждом здании.";
      }

      content.innerHTML = `
        <div class="cs-detail-intro">
          <div class="cs-detail-intro-stage">${stage.icon} ${stage.label}</div>
          <h3 class="cs-detail-intro-title">Обустройство лагеря</h3>
          <p class="cs-detail-intro-text">${introText}</p>
          ${hint ? `<div class="cs-detail-intro-hint"><span class="cs-detail-intro-hint-icon">💡</span><span>${hint}</span></div>` : ""}
        </div>`;
      content.classList.remove("cs-detail-content--visible");
      requestAnimationFrame(() => content.classList.add("cs-detail-content--visible"));
      return;
    }

    const layout = this._getCampSlotLayout();
    const slot = layout.find((s) => s.id === slotId);
    if (!slot) return;

    const building = this.data.buildings[slot.buildingId];
    if (!building) return;

    const slotView = this._getCampSlotPresentation(slot);
    const isBuilt = !!this.game.buildings[slot.buildingId];
    const construction = this.game.getConstructionState();
    const isConstructing = construction?.buildingId === slot.buildingId;
    const copy = this.getBuildingCopy(building);
    const canBuild = this.game.canBuild(slot.buildingId);

    let html = "";

    const badgeClass = isBuilt
      ? "built"
      : isConstructing
        ? "constructing"
        : canBuild
          ? "available"
          : "locked";
    let badgeText = isBuilt
      ? "Построено"
      : isConstructing
        ? `Строится ${Math.round((construction.progress || 0) * 100)}%`
        : canBuild
          ? "Доступно"
          : "Заблокировано";
    if (!isBuilt && !isConstructing && slot.buildingId === "campfire") {
      if (slotView.sceneMode === "center") {
        badgeText = "Сначала жильё";
      } else if (slotView.sceneMode === "hearth-site") {
        badgeText = "Подготовка";
      }
    }

    const headerIcon =
      isBuilt || isConstructing ? building.icon : slotView.icon;
    const headerName = isBuilt || isConstructing ? copy.name : slotView.name;
    const headerDescription =
      isBuilt || isConstructing
        ? copy.description || ""
        : slotView.description || "";

    html += `
      <div class="cs-det-header">
        <div class="cs-det-header-icon">${headerIcon}</div>
        <div class="cs-det-header-info">
          <div class="cs-det-name">${headerName}</div>
          <span class="cs-det-badge cs-det-badge--${badgeClass}">${badgeText}</span>
        </div>
      </div>
      <div class="cs-det-desc">${headerDescription}</div>
    `;

    if (isConstructing) {
      // Construction progress — if bar already exists, update it in-place for smooth animation
      const existingBar = content.querySelector(".cs-det-progress-fill");
      const existingText = content.querySelector(".cs-det-progress-text");
      const pct = Math.round((construction.progress || 0) * 100);
      if (existingBar && existingText) {
        existingBar.style.width = pct + "%";
        existingText.textContent = `⏳ ${this.formatSeconds(construction.remainingMs)} осталось`;
        // Only update the header badge text (progress %) in-place too
        const badgeEl = content.querySelector(".cs-det-badge--constructing");
        if (badgeEl) badgeEl.textContent = `Строится ${pct}%`;
        return; // skip full innerHTML rebuild
      }
      html += `
        <div class="cs-det-progress">
          <div class="cs-det-progress-bar">
            <div class="cs-det-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="cs-det-progress-text">⏳ ${this.formatSeconds(construction.remainingMs)} осталось</div>
        </div>
      `;
    } else if (isBuilt) {
      // Show effects
      html += this._renderCampDetailEffects(building, slot.buildingId);

      // Show automation if present
      if (building.effect?.automation) {
        html += this._renderCampDetailAutomation(building.effect.automation);
      }

      // Show upgrades for this building
      html += this._renderCampDetailUpgrades(slot.buildingId);
    } else {
      if (slotView.role) {
        html += `<div class="cs-det-role">${slotView.role}</div>`;
      }
      html += this._renderCampDetailBuildSection(slot);
    }

    // Camp info if campfire selected
    if (slot.buildingId === "campfire" && isBuilt) {
      html += this._renderCampInfoSummary();
    }

    content.innerHTML = html;

    // Fade-in new content
    content.classList.remove("cs-detail-content--visible");
    requestAnimationFrame(() => content.classList.add("cs-detail-content--visible"));

    // Bind action buttons
    this._bindCampDetailActions(content, slot);
  },

  _renderCampDetailEffects(building, buildingId) {
    const parts = [];

    if (building.effect?.maxResourceCap)
      parts.push(`📦 Лимит ресурсов → ${building.effect.maxResourceCap}`);
    if (building.effect?.energy?.maxBonus)
      parts.push(`⚡ +${building.effect.energy.maxBonus} макс. энергии`);
    if (building.effect?.energy?.regenIntervalBonusMs)
      parts.push(
        `⚡ Восстановление быстрее на ${(building.effect.energy.regenIntervalBonusMs / 1000).toFixed(0)}с`,
      );
    if (building.effect?.character?.maxSatietyBonus)
      parts.push(
        `🍖 +${building.effect.character.maxSatietyBonus} макс. сытости`,
      );
    if (building.effect?.character?.recoveryBonusPerTick)
      parts.push(`🍖 Восстановление сытости ускорено`);
    if (building.effect?.unlocks?.length)
      parts.push(
        `🔓 Открывает: ${building.effect.unlocks.map((id) => this.data.recipes[id]?.name || id).join(", ")}`,
      );

    if (parts.length === 0) return "";
    return `
      <div class="cs-det-section">
        <div class="cs-det-section-title">Эффекты</div>
        <div class="cs-det-effects">
          ${parts.map((p) => `<div class="cs-det-effect">${p}</div>`).join("")}
        </div>
      </div>
    `;
  },

  _renderCampDetailAutomation(auto) {
    const autoId = auto.id;
    const state = this.game.getAutomationState(autoId);
    const remaining = this.game.getAutomationRemaining(autoId);
    const inputStr = this.formatResourcePairs(auto.input);
    const outputStr = this.formatResourcePairs(auto.output, { plus: true });
    const efficiency = this.game.getAutomationEfficiency(autoId);

    let stateLabel = "";
    let stateClass = "";
    if (state === "running") {
      stateLabel = `⏳ ${remaining.toFixed(1)}с до результата`;
      stateClass = "is-running";
    } else if (state === "waiting") {
      stateLabel = `⚠️ Нет ресурсов: ${inputStr}`;
      stateClass = "is-waiting";
    }

    return `
      <div class="cs-det-auto">
        <div class="cs-det-auto-title">Автоматизация</div>
        <div class="cs-det-auto-flow">${inputStr} → ${outputStr}</div>
        ${efficiency ? `<div style="font-size:0.72rem;color:#7c7a94;">${this.formatResourcePairs(efficiency.outputPerSecond, { decimals: 1 })} / сек</div>` : ""}
        <div class="cs-det-auto-state ${stateClass}">${stateLabel}</div>
      </div>
    `;
  },

  _renderCampDetailUpgrades(buildingId) {
    const upgrades = Object.values(this.data.buildingUpgrades || {}).filter(
      (u) => u.targetBuilding === buildingId,
    );
    if (upgrades.length === 0) return "";

    let html = `<div class="cs-det-section"><div class="cs-det-section-title">Улучшения</div>`;

    for (const upgrade of upgrades) {
      const applied = this.game.isUpgradeApplied(upgrade.id);
      const check = this.game.canUpgrade(upgrade.id);
      const techLocked =
        upgrade.unlockedBy && !this.game.researched[upgrade.unlockedBy];

      const costHtml = Object.entries(upgrade.cost || {})
        .map(([res, amt]) => {
          const def = this.data.resources?.[res];
          const have = this.game.resources[res] || 0;
          const missing = !applied && have < amt;
          return `<span class="cs-det-cost-item${missing ? " is-missing" : ""}">${this.getResourceDisplayIcon(res)} ${this.getResourceDisplayName(res)} ×${amt}</span>`;
        })
        .join("");

      const energyHtml =
        (upgrade.energyCost || 0) > 0
          ? `<span class="cs-det-cost-item${!applied && !this.game.hasEnergy(upgrade.energyCost) ? " is-missing" : ""}">⚡ −${upgrade.energyCost}</span>`
          : "";

      let lockReason = "";
      if (!applied && techLocked)
        lockReason = `Требуется: ${this.data.tech[upgrade.unlockedBy]?.name || upgrade.unlockedBy}`;

      html += `
        <div class="cs-det-upgrade${applied ? " is-applied" : ""}">
          <div class="cs-det-upgrade-name">${upgrade.icon} ${upgrade.name}</div>
          <div class="cs-det-upgrade-desc">${upgrade.description}</div>
          ${
            applied
              ? `<div style="font-size:0.75rem;color:#4ade80;">✅ Применено</div>`
              : `<div class="cs-det-cost-list">${costHtml}${energyHtml}</div>
               ${lockReason ? `<div class="cs-det-blocker">${lockReason}</div>` : ""}
               <button class="cs-det-action-btn cs-det-action-btn--upgrade" data-upgrade-id="${upgrade.id}"
                 ${!check.ok || techLocked ? 'disabled aria-disabled="true"' : ""}>⬆️ Улучшить</button>`
          }
        </div>
      `;
    }

    html += `</div>`;
    return html;
  },

  _renderCampDetailBuildSection(slot) {
    const building = this.data.buildings[slot.buildingId];
    if (!building) return "";

    const canDo = this.game.canBuild(slot.buildingId);
    const construction = this.game.getConstructionState();
    const buildProfile = this.game.getBuildProfile(slot.buildingId);
    const cost = this.game.getBuildingCost(slot.buildingId);
    const buildTime = this.formatSeconds(
      this.game.getBuildDuration(slot.buildingId),
    );
    const energyCost = buildProfile?.energyCost ?? 1;

    const costHtml = Object.entries(cost)
      .map(([res, amt]) => {
        const def = this.data.resources?.[res];
        const have = this.game.resources[res] || 0;
        const missing = have < amt;
        return `<span class="cs-det-cost-item${missing ? " is-missing" : ""}">${this.getResourceDisplayIcon(res)} ${this.getResourceDisplayName(res)} ×${amt}</span>`;
      })
      .join("");

    const energyHtml = `<span class="cs-det-cost-item${!this.game.hasEnergy(energyCost) ? " is-missing" : ""}">⚡ −${energyCost}</span>`;

    // Determine blocker reason
    let blocker = "";
    const unlockedByTech =
      !building.unlockedBy || this.game.researched[building.unlockedBy];
    const requiredBuildingReady =
      !building.requires || this.game.buildings[building.requires];
    const missingInsights = (building.requiresInsights || []).filter(
      (insightId) => !this.game.insights[insightId],
    );
    const missingPrologueTool =
      this.game.isPrologueActive() &&
      building.requiresPrologueTool &&
      (this.game.resources.crude_tools || 0) < 1;
    const slotTileState = slot.tileId
      ? this.game.getCampTileState?.(slot.tileId)
      : null;
    const prologueCampfireState =
      this.game.isPrologueActive() && slot.buildingId === "campfire"
        ? this.game.getPrologueCampfireState?.()
        : null;

    if (!unlockedByTech) {
      const techName =
        this.data.tech[building.unlockedBy]?.name || building.unlockedBy;
      blocker = `Требуется исследование: <button class="req-link" data-req-type="tech" data-req-id="${building.unlockedBy}">${techName}</button>`;
    } else if (!requiredBuildingReady) {
      const reqBldName =
        this.data.buildings[building.requires]?.name || building.requires;
      blocker = `Требуется здание: <button class="req-link" data-req-type="building" data-req-id="${building.requires}">${reqBldName}</button>`;
    } else if (prologueCampfireState && !prologueCampfireState.shelterBuilt)
      blocker =
        "Сначала нужно построить первое жильё (палатку), и только потом готовить очаг.";
    else if (slotTileState === "hidden")
      blocker =
        "Место под эту постройку ещё не открыто на локальной карте лагеря.";
    else if (missingInsights.length > 0)
      blocker = `Нужно завершить подготовку: ${missingInsights.map((insightId) => this.data.prologue?.insights?.[insightId]?.name || insightId).join(", ")}`;
    else if (missingPrologueTool)
      blocker = "Сначала нужно связать грубое орудие.";
    else if (construction)
      blocker = `Строится: ${construction.icon} ${construction.name}`;
    else if (!buildProfile)
      blocker = "Сейчас нет доступного участка для этой постройки.";
    else if (buildProfile?.blockedReason) blocker = buildProfile.blockedReason;

    return `
      <div class="cs-det-section">
        <div class="cs-det-section-title">Стоимость строительства</div>
        <div class="cs-det-cost-list">${costHtml}${energyHtml}</div>
        <div style="font-size:0.75rem;color:#7c7a94;margin-top:0.3rem;">⏱ Время: ${buildTime}</div>
      </div>
      ${blocker ? `<div class="cs-det-blocker">${blocker}</div>` : ""}
      <button class="cs-det-action-btn cs-det-action-btn--build" data-build-id="${slot.buildingId}"
        ${!canDo ? 'disabled aria-disabled="true"' : ""}>🏗️ Построить</button>
    `;
  },

  _renderCampInfoSummary() {
    const builtCount = Object.keys(this.game.buildings).length;
    const upgradeCount = (this.game.localCampMap?.appliedUpgrades || []).length;
    const maxCap = this.game.maxResourceCap || 100;
    const condition = this.game.getCharacterCondition?.() || { label: "—" };

    return `
      <div class="cs-det-section" style="margin-top:0.75rem;">
        <div class="cs-det-section-title">Сводка лагеря</div>
        <div class="cs-camp-summary">
          <div class="cs-camp-summary-row"><span>Постройки</span><span class="cs-camp-summary-val">${builtCount}</span></div>
          <div class="cs-camp-summary-row"><span>Улучшения</span><span class="cs-camp-summary-val">${upgradeCount}</span></div>
          <div class="cs-camp-summary-row"><span>Лимит ресурсов</span><span class="cs-camp-summary-val">${maxCap}</span></div>
          <div class="cs-camp-summary-row"><span>Состояние</span><span class="cs-camp-summary-val">${condition.label || "—"}</span></div>
        </div>
      </div>
    `;
  },

  _bindCampDetailActions(container, slot) {
    // Build button
    const buildBtn = container.querySelector("[data-build-id]");
    if (buildBtn) {
      buildBtn.addEventListener("click", () => {
        this.game.build(slot.buildingId);
        this.renderCampScreen({ force: true });
        this.render({ forcePanels: true });
      });
    }

    // Requirement links (tech → open research modal; building → select that camp slot)
    container.querySelectorAll(".req-link").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const type = btn.dataset.reqType;
        const id = btn.dataset.reqId;
        if (type === "tech") {
          this.openResearchModal();
        } else if (type === "building") {
          const layout = this._getCampSlotLayout();
          const target = layout.find((s) => s.buildingId === id);
          if (target) {
            this._selectedCampSlot = target.id;
            this._renderCampScene();
            this._renderCampDock();
            this._renderCampDetail();
          }
        }
      });
    });

    // Upgrade buttons
    container.querySelectorAll("[data-upgrade-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.dataset.upgradeId;
        if (this.game.applyUpgrade(uid)) {
          this.renderCampScreen({ force: true });
          this.render({ forcePanels: true });
        }
      });
    });
  },
});
