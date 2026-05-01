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
      const ctx =
        this._audioCtx ||
        (this._audioCtx = new (
          window.AudioContext || window.webkitAudioContext
        )());
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
    // First render: defer one frame so the just-shown flex layout settles
    // (otherwise scene.clientWidth can be measured before the cs-scene--plots
    // class has applied its responsive width, causing icons to clump).
    this.renderCampScreen({ force: true });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.renderCampScreen({ force: true }));
    });
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
    let startX,
      startY,
      startScrollX,
      startScrollY,
      dragging = false;

    const onDown = (e) => {
      // Only drag on the wrap itself or the scene, not on slots
      if (e.target.closest(".cs-slot, .cs-plot")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollX = wrap.scrollLeft;
      startScrollY = wrap.scrollTop;
      wrap.classList.add("is-dragging");
    };
    const onMove = (e) => {
      if (!dragging) return;
      wrap.scrollLeft = startScrollX - (e.clientX - startX);
      wrap.scrollTop = startScrollY - (e.clientY - startY);
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

  /** Calculate camp development stage based on what's built */

  _getCampStage() {
    const b = this.game.buildings;
    const builtCount = Object.keys(b).length;
    const hasShelter = !!b.rest_tent;
    const hasCampfire = !!b.campfire;

    // Sum building levels (cap 5 per building) for the "mature" stage.
    let totalLevels = 0;
    for (const id of Object.keys(b)) {
      totalLevels += this.game.getBuildingLevel?.(id) || 1;
    }

    if (hasCampfire && builtCount >= 4 && totalLevels >= 10)
      return { id: 5, label: "Зрелый лагерь", icon: "🏘️" };
    if (hasCampfire && builtCount >= 4)
      return { id: 4, label: "Производственный лагерь", icon: "🏘️" };
    if (hasCampfire) return { id: 3, label: "Лагерь с очагом", icon: "🔥" };
    if (hasShelter) return { id: 2, label: "Жилой лагерь", icon: "⛺" };
    return { id: 1, label: "Основанная стоянка", icon: "🏕️" };
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

    const plotsForSelection = this._getCampPlots?.() || [];
    if (
      !this._selectedCampSlot ||
      !plotsForSelection.some((plot) => plot.id === this._selectedCampSlot)
    ) {
      const preferredPlot =
        plotsForSelection.find((plot) => plot.state === "camp") ||
        plotsForSelection.find((plot) => plot.visibleBuildOptions?.length) ||
        plotsForSelection[0];
      this._selectedCampSlot = preferredPlot?.id || null;
      if (this._selectedCampSlot) {
        this.game.selectCampTile?.(this._selectedCampSlot);
      }
    }

    // Topbar (resources, energy) updates every tick — always safe to rebuild.
    this._renderCampTopbar();

    // Skip heavy DOM rebuilds while the user hovers over interactive zones
    // so that CSS :hover state is never lost, preventing flicker.
    // User-triggered calls (force=true) always do a full rebuild.
    const dockHovered =
      !force && document.getElementById("cs-dock")?.matches(":hover");
    const detailHovered =
      !force && document.getElementById("cs-detail")?.matches(":hover");

    if (force) {
      // Invalidate caches so a forced render (e.g. modal open, build action)
      // always rebuilds the DOM regardless of renderKey state.
      const sceneEl = document.getElementById("cs-scene");
      const dockEl = document.getElementById("cs-dock");
      const detailEl = document.getElementById("cs-detail-content");
      if (sceneEl) delete sceneEl.dataset.renderKey;
      if (dockEl) delete dockEl.dataset.renderKey;
      if (detailEl) delete detailEl.dataset.renderKey;
    }

    if (!dockHovered) this._renderCampScene();
    if (!dockHovered) this._renderCampDock();
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

      const plots = this._getCampPlots?.() || [];
      const usage = plots.reduce(
        (sum, plot) => {
          const buildUsage = plot.buildUsage || {};
          sum.used += buildUsage.used || 0;
          sum.capacity += buildUsage.capacity || 0;
          return sum;
        },
        { used: 0, capacity: 0 },
      );
      let countEl = document.getElementById("cs-topbar-build-count");
      if (!countEl) {
        countEl = document.createElement("span");
        countEl.id = "cs-topbar-build-count";
        countEl.className = "cs-topbar-build-count";
        nameEl.appendChild(countEl);
      }
      countEl.textContent = `${usage.used}/${usage.capacity || 0}`;
      countEl.title = `Занято места на участках лагеря: ${usage.used} из ${usage.capacity || 0}. Каждая постройка занимает определённое количество слотов вместимости.`;
      countEl.className = `cs-topbar-build-count${usage.capacity > 0 && usage.used >= usage.capacity ? " is-complete" : ""}`;
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
    const currentLevel = this.game.getBuildingLevel?.(buildingId) || 0;
    const allUpgrades = Object.values(this.data.buildingUpgrades || {})
      .filter((u) => u.targetBuilding === buildingId)
      .sort((a, b) => (a.level || 99) - (b.level || 99));
    if (allUpgrades.length === 0) return "";

    // Show only the NEXT unapplied upgrade
    const nextLevel = currentLevel + 1;
    let upgrades = allUpgrades.filter(
      (u) => !this.game.isUpgradeApplied(u.id) && u.level === nextLevel,
    );
    if (upgrades.length === 0) {
      // No leveled next upgrade — take first unapplied (no-level or any level)
      const first = allUpgrades.find((u) => !this.game.isUpgradeApplied(u.id));
      if (first) upgrades = [first];
    }
    if (upgrades.length === 0) return ""; // Fully upgraded

    let html = `<div class="cs-det-section"><div class="cs-det-section-title">Уровень и улучшения</div>
      <div class="cs-building-level-track">
        ${[1, 2, 3, 4, 5]
          .map(
            (level) =>
              `<span class="${level <= currentLevel ? "is-filled" : ""}">${level}</span>`,
          )
          .join("")}
      </div>`;

    for (const upgrade of upgrades) {
      const applied = this.game.isUpgradeApplied(upgrade.id);
      const check = this.game.canUpgrade(upgrade.id);
      const techLocked =
        upgrade.unlockedBy && !this.game.researched[upgrade.unlockedBy];
      const costHtml = Object.entries(upgrade.cost || {})
        .map(([res, amt]) => {
          const have = this.game.resources[res] || 0;
          const missing = !applied && have < amt;
          return `<span class="cs-det-cost-item${missing ? " is-missing" : ""}">${this.getResourceDisplayIcon(res)} ${this.getResourceDisplayName(res)} ×${amt}</span>`;
        })
        .join("");
      const energyHtml =
        (upgrade.energyCost || 0) > 0
          ? `<span class="cs-det-cost-item${!applied && !this.game.hasEnergy(upgrade.energyCost) ? " is-missing" : ""}">⚡ −${this.formatNumber(upgrade.energyCost, 2)}</span>`
          : "";
      const timeHtml =
        upgrade.buildTimeMs && !applied
          ? `<span class="cs-det-cost-item cs-det-cost-item--time">⏱ ${Math.ceil((upgrade.buildTimeMs * (this.game.buildTimeMultiplier || 1)) / 1000)}с</span>`
          : "";

      let lockReason = "";
      if (!applied && techLocked) {
        lockReason = `Требуется: ${this.data.tech[upgrade.unlockedBy]?.name || upgrade.unlockedBy}`;
      } else if (!applied && check.reason === "prerequisite_upgrade") {
        lockReason = "Сначала нужен предыдущий уровень.";
      } else if (!applied && check.reason === "level_locked") {
        lockReason = `Нужен уровень ${check.level}.`;
      } else if (!applied && this.game.activeConstruction) {
        const cs = this.game.getConstructionState();
        lockReason = `Сейчас идёт работа: ${cs?.name || "стройка"}.`;
      }

      html += `
        <div class="cs-det-upgrade${applied ? " is-applied" : ""}">
          <div class="cs-det-upgrade-name">${upgrade.icon} ${upgrade.level ? `Ур.${upgrade.level} ` : ""}${upgrade.name}</div>
          <div class="cs-det-upgrade-desc">${upgrade.description}</div>
          ${
            applied
              ? `<div style="font-size:0.75rem;color:#4ade80;">✓ Применено</div>`
              : `<div class="cs-det-cost-list">${costHtml}${energyHtml}${timeHtml}</div>
               ${lockReason ? `<div class="cs-det-blocker">${lockReason}</div>` : ""}
               <button class="cs-det-action-btn cs-det-action-btn--upgrade" data-upgrade-id="${upgrade.id}"
                 ${!check.ok || techLocked || this.game.activeConstruction ? 'disabled aria-disabled="true"' : ""}>⬆️ Улучшить</button>`
          }
        </div>
      `;
    }

    html += `</div>`;
    return html;
  },

  _getCampPlots() {
    const mapState = this.game.getCampMapState?.();
    const visibleStates = new Set(["camp", "developed", "discovered"]);
    // Скрываем «костёр» как опцию строительства на любых клетках, кроме самой
    // клетки лагеря — иначе после основания на windbreak/cache_site остаётся
    // фантомный «место под очаг» (повторяющая роль очага плитка).
    const filterTileBuildOptions = (tile) =>
      (tile.buildOptions || []).filter((id) => {
        if (id === "campfire" && tile.state !== "camp") return false;
        return true;
      });
    const classifyPlot = (tile, options) => {
      if (tile.state === "camp") return "center";
      if (options.includes("campfire") && options.includes("rest_tent")) {
        return "center";
      }
      if (options.includes("rest_tent")) return "shelter";
      if (options.includes("campfire")) return "hearth";
      if (options.includes("storage")) return "storage";
      if (options.includes("workshop")) return "workshop";
      if (options.includes("kiln")) return "kiln";
      return "general";
    };
    const compact = typeof window !== "undefined" && window.innerWidth <= 800;
    const scene =
      typeof document !== "undefined"
        ? document.getElementById("cs-scene")
        : null;
    const sceneWidth = scene?.clientWidth || (compact ? 440 : 760);
    const sceneHeight = scene?.clientHeight || (compact ? 330 : 560);
    const cardWidth = compact ? 124 : 186;
    const cardHeight = compact ? 104 : 142;
    const pad = compact ? 18 : 30;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const positionsByKind = {
      center: [
        { x: 0.52, y: 0.5 },
        { x: 0.5, y: 0.25 },
      ],
      shelter: [
        { x: 0.27, y: 0.28 },
        { x: 0.26, y: 0.66 },
      ],
      hearth: [
        { x: 0.34, y: 0.72 },
        { x: 0.73, y: 0.55 },
        { x: 0.72, y: 0.28 },
      ],
      storage: [{ x: 0.73, y: 0.32 }],
      workshop: [{ x: 0.31, y: 0.82 }],
      kiln: [{ x: 0.72, y: 0.8 }],
      general: [
        { x: 0.18, y: 0.5 },
        { x: 0.82, y: 0.5 },
        { x: 0.18, y: 0.22 },
        { x: 0.82, y: 0.78 },
      ],
    };
    const usedByKind = {};
    const placedRects = [];
    const resolvePosition = (kind) => {
      const used = usedByKind[kind] || 0;
      usedByKind[kind] = used + 1;
      const anchors = positionsByKind[kind] || positionsByKind.general;
      const anchor = anchors[used % anchors.length];
      const baseX = anchor.x * sceneWidth;
      const baseY = anchor.y * sceneHeight;
      let x = clamp(
        baseX,
        pad + cardWidth / 2,
        sceneWidth - pad - cardWidth / 2,
      );
      let y = clamp(
        baseY,
        pad + cardHeight / 2,
        sceneHeight - pad - cardHeight / 2,
      );
      const overlaps = (rx, ry) =>
        placedRects.some(
          (rect) =>
            Math.abs(rx - rect.x) < (cardWidth + rect.w) / 2 + 14 &&
            Math.abs(ry - rect.y) < (cardHeight + rect.h) / 2 + 14,
        );
      for (let i = 0; i < 24 && overlaps(x, y); i += 1) {
        const angle = i * 2.399963;
        const radius = (compact ? 34 : 48) * (1 + Math.floor(i / 6));
        x = clamp(
          baseX + Math.cos(angle) * radius,
          pad + cardWidth / 2,
          sceneWidth - pad - cardWidth / 2,
        );
        y = clamp(
          baseY + Math.sin(angle) * radius,
          pad + cardHeight / 2,
          sceneHeight - pad - cardHeight / 2,
        );
      }
      placedRects.push({ x, y, w: cardWidth, h: cardHeight });
      return { x, y };
    };

    return (mapState?.tiles || [])
      .filter((tile) => {
        if (!visibleStates.has(tile.state)) return false;
        const effectiveOptions = filterTileBuildOptions(tile);
        // Hide empty plots whose ALL build options are already constructed
        // somewhere else (uniques like rest_tent / storage / workshop / kiln).
        // This prevents a "ghost twin" plot from appearing alongside the real
        // built one (e.g. shelter_site stays visible after a rest_tent was
        // placed on camp_clearing).
        const isEmpty =
          tile.state !== "camp" &&
          !tile.construction &&
          !tile.placedBuildings?.length;
        if (isEmpty && effectiveOptions.length) {
          const allTaken = effectiveOptions.every(
            (id) => !!this.game.buildings[id],
          );
          if (allTaken) return false;
        }
        return (
          tile.state === "camp" ||
          tile.construction ||
          tile.placedBuildings?.length ||
          effectiveOptions.length
        );
      })
      .map((tile) => {
        const effectiveOptions = filterTileBuildOptions(tile);
        const kind = classifyPlot(tile, effectiveOptions);
        const position = resolvePosition(kind);
        const visibleBuildOptions = effectiveOptions.filter((id) =>
          this.game.isBuildingPresentationUnlocked(id),
        );
        const roleLabel = {
          center: "Центр",
          shelter: "Жильё",
          hearth: "Очаг",
          storage: "Запасы",
          workshop: "Ремесло",
          kiln: "Обжиг",
          general: "Участок",
        }[kind];
        return {
          ...tile,
          x: position.x,
          y: position.y,
          kind,
          roleLabel,
          visibleBuildOptions,
          title:
            tile.state === "camp"
              ? "Центр лагеря"
              : tile.shortLabel || tile.name || tile.id,
        };
      })
      .sort((a, b) => {
        const kindOrder = {
          center: 0,
          shelter: 1,
          hearth: 2,
          storage: 3,
          workshop: 4,
          kiln: 5,
          general: 9,
        };
        return (
          (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
          (a.distanceFromCamp || 0) - (b.distanceFromCamp || 0) ||
          (a.r || 0) - (b.r || 0) ||
          (a.q || 0) - (b.q || 0)
        );
      });
  },

  _getCampPlotById(tileId) {
    return this._getCampPlots().find((plot) => plot.id === tileId) || null;
  },

  _getCampBuildingArtLevel(buildingId) {
    const level = this.game.getBuildingLevel?.(buildingId);
    return Math.max(1, Math.min(5, Number(level || 1)));
  },

  _getCampBuildingImageSrc(buildingId, level = null) {
    const artLevel = Math.max(
      1,
      Math.min(5, Number(level || this._getCampBuildingArtLevel(buildingId))),
    );
    const levelArt = {
      campfire: `campfire_lvl${artLevel}.png`,
      rest_tent: `shelter_lvl${artLevel}.png`,
      storage: `storage_lvl${artLevel}.png`,
      workshop: `workshop_lvl${artLevel}.png`,
      kiln: `kiln_lvl${artLevel}.png`,
    };
    const fileName = levelArt[buildingId];
    return fileName ? `prototype/assets/buildings/${fileName}` : "";
  },

  _getCampBuildingFallbackImageSrc(buildingId) {
    const byBuild = {
      campfire: "campfire.png",
      rest_tent: "rest_tent.png",
      storage: "storage.png",
      workshop: "workshop.png",
      kiln: "kiln.png",
    };
    const fileName = byBuild[buildingId];
    return fileName ? `prototype/assets/icons/${fileName}` : "";
  },

  _renderCampBuildingIcon(
    buildingId,
    fallbackIcon = "",
    className = "",
    level = null,
  ) {
    const src = this._getCampBuildingImageSrc(buildingId, level);
    const fallbackSrc = this._getCampBuildingFallbackImageSrc(buildingId);
    const safeFallback = fallbackIcon || "◇";
    if (!src && !fallbackSrc)
      return `<span class="${className}">${safeFallback}</span>`;
    const imageSrc = src || fallbackSrc;
    const buildingLevel = this.game.getBuildingLevel?.(buildingId) || 0;
    const levelBadge =
      buildingLevel > 1
        ? `<span class="cs-building-level">Ур.${buildingLevel}</span>`
        : "";
    return `<span class="${className}">
      <img class="cs-building-img" src="${imageSrc}" data-fallback-src="${src ? fallbackSrc : ""}" alt="" aria-hidden="true" onerror="if(this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;this.dataset.fallbackSrc=''}else{this.style.display='none';this.nextElementSibling.hidden=false}">
      <span hidden>${safeFallback}</span>
      ${levelBadge}
    </span>`;
  },

  _renderCampScene() {
    const scene = document.getElementById("cs-scene");
    if (!scene) return;

    const construction = this.game.getConstructionState();
    const stage = this._getCampStage();

    // Apply scene class FIRST so layout reflects the --plots size BEFORE
    // _getCampPlots reads clientWidth (otherwise on first open positions are
    // calculated for the default 560×440 size and icons clump together).
    const sceneClasses = "cs-scene cs-scene--plots cs-scene--stage-" + stage.id;
    if (scene.className !== sceneClasses) scene.className = sceneClasses;
    if (
      this.game.buildings.campfire ||
      construction?.buildingId === "campfire"
    ) {
      scene.classList.add("cs-scene--campfire-live");
    }
    // Force layout (read forces reflow) so clientWidth now reflects the new size
    void scene.offsetWidth;

    const plots = this._getCampPlots();

    // Build a stable key from all plot state — skip full rebuild if nothing changed
    const renderKey = [
      stage.id,
      this._selectedCampSlot || "",
      construction?.buildingId || "",
      construction?.upgradeId || "",
      scene.clientWidth,
      scene.clientHeight,
      plots
        .map((p) =>
          [
            p.id,
            p.kind,
            (p.placedBuildings || []).map((b) => b.buildingId).join(","),
            p.construction?.buildingId || "",
            p.visibleBuildOptions.join(","),
          ].join(":"),
        )
        .join("|"),
    ].join("§");
    if (scene.dataset.renderKey === renderKey) return;
    scene.dataset.renderKey = renderKey;

    scene.innerHTML = `
      <div class="cs-scene-atmosphere" aria-hidden="true"></div>
      <div class="cs-scene-path cs-scene-path--a" aria-hidden="true"></div>
      <div class="cs-scene-path cs-scene-path--b" aria-hidden="true"></div>
      <div class="cs-scene-label">
        <span>${stage.icon} ${stage.label}</span>
        <strong>${plots.reduce((sum, plot) => sum + (plot.buildUsage?.used || 0), 0)}/${plots.reduce((sum, plot) => sum + (plot.buildUsage?.capacity || 0), 0)}</strong>
      </div>
    `;
    for (const plot of plots) {
      const usage = plot.buildUsage || { used: 0, capacity: 0, ratio: 0 };

      // Collect placed + in-construction buildings for this plot
      const buildingEntries = [
        ...(plot.placedBuildings || []).map((entry) => {
          const copy = this.getBuildingCopy(entry.def);
          return {
            id: entry.buildingId,
            icon: copy.icon,
            name: copy.name,
            constructing: false,
          };
        }),
        ...(plot.construction
          ? [
              {
                id: plot.construction.buildingId,
                icon: plot.construction.icon,
                name: plot.construction.name,
                constructing: true,
              },
            ]
          : []),
      ];

      const isSelected = this._selectedCampSlot === plot.id;
      const canBuildSomething = plot.visibleBuildOptions.some((id) =>
        this.game.canBuildOnTile?.(id, plot.id),
      );
      const isEmpty = buildingEntries.length === 0;

      const el = document.createElement("button");
      el.type = "button";
      el.className = `cs-plot cs-plot--${plot.kind}`;
      if (isSelected) el.classList.add("is-selected");
      if (plot.state === "camp") el.classList.add("is-camp");
      if (!isEmpty) el.classList.add("has-buildings");
      if (plot.construction) el.classList.add("is-constructing");
      if (canBuildSomething) el.classList.add("has-action");
      if (isEmpty) el.classList.add("is-empty");
      el.dataset.slotId = plot.id;
      el.style.left = plot.x + "px";
      el.style.top = plot.y + "px";

      // Main icon: first placed building image, or ghost "+" for empty
      let mainIconHtml;
      if (!isEmpty) {
        const first = buildingEntries[0];
        mainIconHtml = this._renderCampBuildingIcon(
          first.id,
          first.icon,
          `cs-plot-icon${first.constructing ? " is-constructing" : ""}`,
        );
      } else {
        // Show ghost icon for first buildable option, else generic "+"
        const ghostId = plot.visibleBuildOptions[0];
        const ghostBuilding = ghostId ? this.data.buildings[ghostId] : null;
        const ghostCopy = ghostBuilding
          ? this.getBuildingCopy(ghostBuilding)
          : null;
        mainIconHtml = this._renderCampBuildingIcon(
          ghostId || "",
          ghostCopy?.icon || "+",
          "cs-plot-icon is-ghost",
        );
      }

      // Stacked extra icon count badge (if > 1 building)
      const extraCount =
        buildingEntries.length > 1 ? buildingEntries.length - 1 : 0;
      const extraBadge =
        extraCount > 0
          ? `<span class="cs-plot-extra">+${extraCount}</span>`
          : "";

      // Bottom label: name of first building, or role for empty plot
      const labelText = !isEmpty ? buildingEntries[0].name : plot.roleLabel;

      // Capacity bar strip (compact, below icon)
      const capPct = Math.round(Math.min(1, usage.ratio || 0) * 100);

      // Native tooltip with role / building / capacity / hint
      const tipParts = [plot.roleLabel];
      if (!isEmpty) tipParts.push(buildingEntries[0].name);
      else if (plot.visibleBuildOptions.length)
        tipParts.push(
          "Можно построить: " +
            plot.visibleBuildOptions
              .map((id) => this.data.buildings[id]?.name || id)
              .join(", "),
        );
      tipParts.push(`Вместимость ${usage.used || 0}/${usage.capacity || 0}`);
      el.title = tipParts.join(" · ");

      el.innerHTML = `
        <span class="cs-plot-icon-wrap">
          ${mainIconHtml}
          ${extraBadge}
        </span>
        <span class="cs-plot-label">${labelText}</span>
        <span class="cs-plot-cap-bar"><span style="width:${capPct}%"></span></span>
      `;

      el.addEventListener("click", () => {
        this._selectedCampSlot = plot.id;
        this.game.selectCampTile?.(plot.id);
        this._renderCampScene();
        this._renderCampDock();
        this._renderCampDetail();
        document.getElementById("cs-scene-hint")?.classList.add("is-hidden");
      });
      scene.appendChild(el);
    }
  },

  _renderCampDock() {
    const dock = document.getElementById("cs-dock");
    if (!dock) return;

    const plots = this._getCampPlots();
    const justBuiltId = this._justBuiltId;

    // Skip rebuild when nothing visible has changed (prevents <img> flicker).
    const renderKey = [
      this._selectedCampSlot || "",
      justBuiltId || "",
      plots
        .map((p) => {
          const built = (p.placedBuildings || [])
            .map(
              (b) =>
                `${b.buildingId}@${this.game.getBuildingLevel?.(b.buildingId) || 0}`,
            )
            .join(",");
          const usage = p.buildUsage || {};
          return [
            p.id,
            p.kind,
            built,
            p.construction?.buildingId || "",
            p.visibleBuildOptions.join(","),
            `${usage.used || 0}/${usage.capacity || 0}`,
          ].join(":");
        })
        .join("|"),
    ].join("§");
    if (dock.dataset.renderKey === renderKey) {
      this._justBuiltId = null;
      return;
    }
    dock.dataset.renderKey = renderKey;

    dock.innerHTML = "";
    this._justBuiltId = null;

    for (const plot of plots) {
      const usage = plot.buildUsage || { used: 0, capacity: 0 };
      const buildingCount =
        (plot.placedBuildings?.length || 0) + (plot.construction ? 1 : 0);
      const isSelected = this._selectedCampSlot === plot.id;
      const item = document.createElement("div");
      item.className = "cs-dock-item cs-dock-item--plot";
      if (isSelected) item.classList.add("is-selected");
      if (buildingCount) item.classList.add("is-built");
      if (plot.construction) item.classList.add("is-constructing");
      if (!buildingCount) item.classList.add("is-empty");

      const icon =
        plot.state === "camp"
          ? "🏕️"
          : plot.placedBuildings?.[0]
            ? this.getBuildingCopy(plot.placedBuildings[0].def).icon
            : plot.visibleBuildOptions?.[0] &&
                this.data.buildings[plot.visibleBuildOptions[0]]
              ? this.getBuildingCopy(
                  this.data.buildings[plot.visibleBuildOptions[0]],
                ).icon
              : "◇";
      const iconBuildingId =
        plot.placedBuildings?.[0]?.buildingId ||
        plot.visibleBuildOptions?.[0] ||
        "";
      const iconMarkup =
        plot.state === "camp"
          ? `<span class="cs-dock-icon">🏕️</span>`
          : this._renderCampBuildingIcon(iconBuildingId, icon, "cs-dock-icon");
      const meta = buildingCount
        ? `${plot.roleLabel} · ${buildingCount} постр.`
        : `${plot.roleLabel} · свободно ${usage.free ?? usage.capacity}`;

      const dockTitle = plot.placedBuildings?.[0]
        ? this.getBuildingCopy(plot.placedBuildings[0].def).name
        : plot.construction?.name || plot.title;
      item.innerHTML = `
        ${iconMarkup}
        <span class="cs-dock-text">
          <span class="cs-dock-label">${dockTitle}</span>
          <span class="cs-dock-meta">${meta}</span>
          <span class="cs-dock-capacity-bar"><span style="width:${Math.round(Math.min(1, usage.ratio || 0) * 100)}%"></span></span>
        </span>
        <span class="cs-dock-status is-empty">${usage.used}/${usage.capacity}</span>
      `;
      item.addEventListener("click", () => {
        this._playCampClickSound();
        this._selectedCampSlot = plot.id;
        this.game.selectCampTile?.(plot.id);
        this._renderCampScene();
        this._renderCampDock();
        this._renderCampDetail();
        document.getElementById("cs-scene-hint")?.classList.add("is-hidden");
      });
      dock.appendChild(item);

      if (
        justBuiltId &&
        plot.placedBuildings?.some((entry) => entry.buildingId === justBuiltId)
      ) {
        requestAnimationFrame(() => {
          item.classList.add("just-built");
          item.addEventListener(
            "animationend",
            () => item.classList.remove("just-built"),
            { once: true },
          );
        });
      }
    }
  },

  _renderCampDetail() {
    const content = document.getElementById("cs-detail-content");
    if (!content) return;

    const plot = this._selectedCampSlot
      ? this._getCampPlotById(this._selectedCampSlot)
      : null;
    if (!plot) {
      const plots = this._getCampPlots();
      const usage = plots.reduce(
        (sum, item) => {
          const buildUsage = item.buildUsage || {};
          sum.used += buildUsage.used || 0;
          sum.capacity += buildUsage.capacity || 0;
          return sum;
        },
        { used: 0, capacity: 0 },
      );
      content.innerHTML = `
        <div class="cs-detail-intro">
          <div class="cs-detail-intro-stage">${this._getCampStage().icon} ${this._getCampStage().label}</div>
          <h3 class="cs-detail-intro-title">Планировка лагеря</h3>
          <p class="cs-detail-intro-text">Каждый гекс теперь является участком с вместимостью. Постройки занимают место внутри участка, но не требуют отдельной внутренней сетки.</p>
          <div class="cs-detail-intro-hint"><span class="cs-detail-intro-hint-icon">◇</span><span>Занято: <strong>${usage.used}/${usage.capacity}</strong>. Выберите участок слева или в сцене.</span></div>
        </div>`;
      content.classList.remove("cs-detail-content--visible");
      requestAnimationFrame(() =>
        content.classList.add("cs-detail-content--visible"),
      );
      return;
    }

    const usage = plot.buildUsage || {
      used: 0,
      capacity: 0,
      free: 0,
      ratio: 0,
    };
    // ── Resolve header: building name/icon OR terrain name when empty ──────
    const firstEntry = plot.placedBuildings?.[0] || null;
    const roleIcons = {
      center: "🏕️",
      shelter: "🏠",
      hearth: "🔥",
      storage: "🪨",
      workshop: "🔨",
      kiln: "🏺",
      general: "◇",
    };
    let detHeaderIconHtml, detHeaderTitle, detHeaderDesc;
    if (firstEntry) {
      const copy = this.getBuildingCopy(firstEntry.def);
      const imgSrc = this._getCampBuildingImageSrc(firstEntry.buildingId);
      const fallbackSrc = this._getCampBuildingFallbackImageSrc(
        firstEntry.buildingId,
      );
      detHeaderIconHtml = imgSrc
        ? `<img class="cs-building-img" src="${imgSrc}" data-fallback-src="${fallbackSrc || ""}" alt="" aria-hidden="true" onerror="if(this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;this.dataset.fallbackSrc=''}else{this.style.display='none'}">`
        : copy.icon || "◇";
      detHeaderTitle = copy.name;
      detHeaderDesc =
        firstEntry.def.description ||
        copy.description ||
        plot.description ||
        "";
    } else if (plot.construction) {
      const { buildingId, icon, name } = plot.construction;
      const imgSrc = this._getCampBuildingImageSrc(buildingId);
      const fallbackSrc = this._getCampBuildingFallbackImageSrc(buildingId);
      detHeaderIconHtml = imgSrc
        ? `<img class="cs-building-img" src="${imgSrc}" data-fallback-src="${fallbackSrc || ""}" alt="" aria-hidden="true" onerror="if(this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;this.dataset.fallbackSrc=''}else{this.style.display='none'}">`
        : icon || "◇";
      detHeaderTitle = name;
      detHeaderDesc = plot.description || "";
    } else {
      detHeaderIconHtml = roleIcons[plot.kind] || "◇";
      detHeaderTitle = plot.title;
      detHeaderDesc = plot.description || "";
    }

    const buildingRows = (plot.placedBuildings || [])
      .map((entry) => {
        const copy = this.getBuildingCopy(entry.def);
        // Show building name in row only if > 1 building (already in header otherwise)
        const rowNameHtml =
          plot.placedBuildings.length > 1
            ? `<div class="cs-plot-detail-building">
              <span>${this._renderCampBuildingIcon(entry.buildingId, copy.icon, "cs-det-inline-icon")} ${copy.name}</span>
             </div>`
            : "";
        return `
          ${rowNameHtml}
          ${this._renderCampDetailEffects(entry.def, entry.buildingId)}
          ${entry.def.effect?.automation ? this._renderCampDetailAutomation(entry.def.effect.automation) : ""}
          ${this._renderCampDetailUpgrades(entry.buildingId)}
        `;
      })
      .join("");

    const constructionHtml = plot.construction
      ? `<div class="cs-det-progress">
          <div class="cs-det-progress-bar">
            <div class="cs-det-progress-fill" style="width:${Math.round((plot.construction.progress || 0) * 100)}%"></div>
          </div>
          <div class="cs-det-progress-text">${plot.construction.isUpgrade ? "🛠️" : "⏳"} ${plot.construction.icon} ${plot.construction.isUpgrade ? "Улучшение: " : ""}${plot.construction.name}: ${this.formatSeconds(plot.construction.remainingMs)} осталось</div>
          <button type="button" class="cs-det-cancel-btn" data-action="cancel-construction" title="Отменить. Ресурсы вернутся полностью, энергия — наполовину">✕ Отменить</button>
        </div>`
      : "";

    const buildOptionsHtml = plot.visibleBuildOptions
      .filter((id) => !this.game.buildings[id])
      .map((id) => this._renderCampPlotBuildOption(plot, id))
      .join("");

    // Build a render key — skip rebuild when nothing visually changed.
    // This prevents <img> elements from being re-created every game tick (icon flicker).
    const builtSig = (plot.placedBuildings || [])
      .map(
        (e) =>
          `${e.buildingId}@${this.game.getBuildingLevel?.(e.buildingId) || 0}`,
      )
      .join(",");
    const constructionBucket = plot.construction
      ? `${plot.construction.buildingId}#${plot.construction.upgradeId || ""}#${Math.round((plot.construction.progress || 0) * 50)}`
      : "";
    // Affordability signature: which build options & next-level upgrades are
    // currently affordable. We round resource amounts so micro fluctuations don't
    // trigger a rebuild, but actual affordability flips still do.
    const affordSig = [];
    for (const id of plot.visibleBuildOptions) {
      if (this.game.buildings[id]) continue;
      const cost = this.game.getBuildingCost(id) || {};
      const ok = Object.entries(cost).every(
        ([r, a]) => (this.game.resources[r] || 0) >= a,
      );
      affordSig.push(`b:${id}:${ok ? 1 : 0}`);
    }
    for (const entry of plot.placedBuildings || []) {
      const next = this.game.getNextBuildingLevelUpgrade?.(entry.buildingId);
      if (!next) continue;
      const cost = next.cost || {};
      const ok = Object.entries(cost).every(
        ([r, a]) => (this.game.resources[r] || 0) >= a,
      );
      const energyOk =
        (this.game.character?.energy ?? Infinity) >= (next.energyCost || 0);
      affordSig.push(`u:${next.id}:${ok && energyOk ? 1 : 0}`);
    }
    const renderKey = [
      plot.id,
      builtSig,
      constructionBucket,
      plot.visibleBuildOptions.join(","),
      `${usage.used}/${usage.capacity}`,
      affordSig.join("|"),
    ].join("§");
    if (content.dataset.renderKey === renderKey) return;
    content.dataset.renderKey = renderKey;

    content.innerHTML = `
      <div class="cs-det-header">
        <div class="cs-det-header-icon">${detHeaderIconHtml}</div>
        <div class="cs-det-header-info">
          <div class="cs-det-name">${detHeaderTitle}</div>
          <span class="cs-det-badge cs-det-badge--available">${plot.roleLabel}</span>
        </div>
      </div>
      <div class="cs-det-desc">${detHeaderDesc}</div>
      <div class="cs-det-section">
        <div class="cs-det-section-title">Вместимость участка</div>
        <div class="cs-plot-detail-capacity">
          <span>${usage.used}/${usage.capacity}</span>
          <span>свободно ${usage.free}</span>
        </div>
        <div class="cs-plot-detail-capacity-bar"><span style="width:${Math.round(Math.min(1, usage.ratio || 0) * 100)}%"></span></div>
      </div>
      ${constructionHtml}
      ${
        buildingRows
          ? `<div class="cs-det-section"><div class="cs-det-section-title">Постройки</div>${buildingRows}</div>`
          : `<div class="cs-det-section"><div class="cs-det-section-title">Постройки</div><div class="cs-det-blocker">Участок пока свободен.</div></div>`
      }
      ${
        buildOptionsHtml
          ? `<div class="cs-det-section"><div class="cs-det-section-title">Доступное строительство</div>${buildOptionsHtml}</div>`
          : ""
      }
    `;

    content.classList.remove("cs-detail-content--visible");
    requestAnimationFrame(() =>
      content.classList.add("cs-detail-content--visible"),
    );
    this._bindCampDetailActions(content);
  },

  _renderCampPlotBuildOption(plot, buildingId) {
    const building = this.data.buildings[buildingId];
    if (!building) return "";
    const copy = this.getBuildingCopy(building);
    const profile = this.game.getBuildProfile(buildingId, plot.id);
    const canDo = !!this.game.canBuildOnTile?.(buildingId, plot.id);
    const cost = this.game.getBuildingCost(buildingId);
    const costHtml = Object.entries(cost)
      .map(([res, amt]) => {
        const have = this.game.resources[res] || 0;
        const missing = have < amt;
        return `<span class="cs-det-cost-item${missing ? " is-missing" : ""}">${this.getResourceDisplayIcon(res)} ${this.getResourceDisplayName(res)} ×${amt}</span>`;
      })
      .join("");
    const buildSecs =
      this.game.getBuildDuration?.(buildingId) || building.buildTimeMs || 0;
    const timeHtml = buildSecs
      ? `<span class="cs-det-cost-item cs-det-cost-item--time">⏱ ${Math.ceil(buildSecs / 1000)}с</span>`
      : "";
    const energyCost = profile?.energyCost || 0;
    const energyHtml = energyCost
      ? `<span class="cs-det-cost-item${!this.game.hasEnergy(energyCost) ? " is-missing" : ""}">⚡ −${energyCost}</span>`
      : "";
    const spaceCost =
      this.game.getBuildingSpaceCost?.(buildingId) || building.spaceCost || 1;
    let blocker = "";
    if (this.game.buildings[buildingId]) blocker = "Постройка уже возведена.";
    else if (!this.game.canFitBuildingOnTile?.(buildingId, plot.id)) {
      blocker = `Не хватает места: нужно ${spaceCost}, свободно ${plot.buildUsage?.free ?? 0}.`;
    } else if (profile?.blockedReason) blocker = profile.blockedReason;
    else if (!canDo && this.game.activeConstruction) {
      blocker = `Сейчас строится: ${this.game.getConstructionState()?.name || "другая постройка"}.`;
    }

    return `
      <div class="cs-plot-build-option">
        <div class="cs-plot-build-option-head">
          <span class="cs-plot-build-option-title">
            ${this._renderCampBuildingIcon(buildingId, copy.icon, "cs-build-option-art")}
            <span>
              <strong>${copy.name}</strong>
              <em>${spaceCost} места</em>
            </span>
          </span>
          <span class="cs-plot-build-option-badge">${spaceCost}</span>
        </div>
        <div class="cs-det-cost-list">${costHtml}${energyHtml}${timeHtml}</div>
        ${blocker ? `<div class="cs-det-blocker">${blocker}</div>` : ""}
        <button class="cs-det-action-btn cs-det-action-btn--build" data-build-id="${buildingId}" data-tile-id="${plot.id}" ${!canDo ? 'disabled aria-disabled="true"' : ""}>🏗️ Построить здесь</button>
      </div>
    `;
  },

  _bindCampDetailActions(container, slot = null) {
    container.querySelectorAll("[data-build-id]").forEach((buildBtn) => {
      buildBtn.addEventListener("click", () => {
        const tileId = buildBtn.dataset.tileId;
        if (tileId) {
          this.game.selectCampTile?.(tileId);
          this._selectedCampSlot = tileId;
        }
        const buildingId = buildBtn.dataset.buildId || slot?.buildingId;
        if (buildingId) this.game.build(buildingId);
        this.renderCampScreen({ force: true });
        this.render({ forcePanels: true });
      });
    });

    container.querySelectorAll(".req-link").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const type = btn.dataset.reqType;
        const id = btn.dataset.reqId;
        if (type === "tech") {
          this.openResearchModal();
        } else if (type === "building") {
          const tileId = this.game.getBuildingPlacement?.(id);
          if (tileId) {
            this._selectedCampSlot = tileId;
            this.game.selectCampTile?.(tileId);
            this._renderCampScene();
            this._renderCampDock();
            this._renderCampDetail();
          }
        }
      });
    });

    container.querySelectorAll("[data-upgrade-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.dataset.upgradeId;
        if (this.game.applyUpgrade(uid)) {
          this.renderCampScreen({ force: true });
          this.render({ forcePanels: true });
        }
      });
    });

    container
      .querySelectorAll('[data-action="cancel-construction"]')
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.game.cancelConstruction?.()) {
            this._showCampToast?.("🚫 Отменено — ресурсы возвращены");
            this.renderCampScreen({ force: true });
            this.render({ forcePanels: true });
          }
        });
      });
  },
});
