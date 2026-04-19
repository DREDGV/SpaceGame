/**
 * UI — renders game state into the DOM and handles user input.
 * Keeps the prototype readable and decision-focused.
 */
class UI {
  constructor(game) {
    this.game = game;
    this.data = game.data;
    this.lastResourcesRenderKey = "";
    this.lastStoryEventId = "";
    this.isPointerDown = false;
    this._selectedCampSlot = null;
    this.characterPanelExpanded = false;
    this._restCooldownTimer = null;
    this._gatherCooldownTimer = null;
    this._campTravelTimer = null;
    this._campTravelAction = null;
    this._campIntroTimer = null;
    this._justFoundedTimer = null;
    this._tooltipTimer = null;
    this.bindStaticControls();
  }

  _showTooltipDelayed(tooltipEl, text, delayMs = 1500) {
    if (this._tooltipTimer) clearTimeout(this._tooltipTimer);
    this._tooltipTimer = setTimeout(() => {
      this._tooltipTimer = null;
      tooltipEl.textContent = text;
      tooltipEl.hidden = false;
    }, delayMs);
  }

  _hideTooltip(tooltipEl) {
    if (this._tooltipTimer) {
      clearTimeout(this._tooltipTimer);
      this._tooltipTimer = null;
    }
    tooltipEl.hidden = true;
  }

  _scheduleGatherCooldownRefresh(cooldownMs) {
    clearTimeout(this._gatherCooldownTimer);
    if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) return;

    let elapsed = 0;
    const tickInterval = 200;
    const tick = () => {
      elapsed += tickInterval;
      this.render({ forcePanels: true });
      if (elapsed < cooldownMs) {
        this._gatherCooldownTimer = setTimeout(tick, tickInterval);
      }
    };
    this._gatherCooldownTimer = setTimeout(tick, tickInterval);
  }

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
      0.72,
      1 - fieldcraft * 0.045 - endurance * 0.028,
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
      (profile?.limitedByCarry ? 0.12 : 0);
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

    const returnLoadCoef =
      1 +
      loadRatio * 0.42 +
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
  }

  _estimateCampActionTravelMs(details) {
    return this._getCampTravelPlan(details).totalMs;
  }

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
  }

  _startCampTileTravel(details) {
    if (!details?.action || this._campTravelAction) return false;

    const travelPlan = this._getCampTravelPlan(details);
    if (!travelPlan.totalMs) return false;

    const startAt = Date.now();
    const outboundEndsAt = startAt + travelPlan.outboundMs;
    const gatherEndsAt = outboundEndsAt + travelPlan.gatherMs;
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
    };
    this._scheduleCampTileTravelTick();
    this.render({ forcePanels: true });
    return true;
  }

  _clearCampTileTravel() {
    if (this._campTravelTimer) {
      clearTimeout(this._campTravelTimer);
      this._campTravelTimer = null;
    }
    this._campTravelAction = null;
  }

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
  }

  _finalizeCampTileTravel() {
    const task = this._campTravelAction;
    if (!task) return;

    this._clearCampTileTravel();
    const ok = this.game.performCampTileAction(task.tileId);
    this.render({ forcePanels: true });
    if (!ok) return;

    const cooldownMs = this.data.gatherActions?.[task.actionId]?.cooldown || 0;
    this._scheduleGatherCooldownRefresh(cooldownMs);
  }

  bindStaticControls() {
    window.addEventListener("pointerdown", () => {
      this.isPointerDown = true;
    });
    window.addEventListener("pointerup", () => {
      this.isPointerDown = false;
    });
    window.addEventListener("pointercancel", () => {
      this.isPointerDown = false;
    });

    const resetBtn = document.getElementById("reset-progress-btn");
    if (!resetBtn) return;

    resetBtn.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Сбросить весь прогресс и начать новую игру?",
      );
      if (!confirmed) return;

      if (this.game.resetProgress()) {
        window.location.reload();
      } else {
        window.alert("Не удалось сбросить прогресс.");
      }
    });

    const restartObBtn = document.getElementById("restart-onboarding-btn");
    if (restartObBtn) {
      restartObBtn.addEventListener("click", () => {
        this.game.restartOnboarding();
        this.render({ forcePanels: true });
      });
    }

    const saveStatusEl = document.getElementById("save-status");
    const savePopup = document.getElementById("save-interval-popup");
    const saveInput = document.getElementById("save-interval-input");

    if (saveStatusEl && savePopup && saveInput) {
      const openPopup = () => {
        saveInput.value = this.game.getSaveIntervalSec();
        savePopup.hidden = false;
        saveInput.focus();
        saveInput.select();
      };

      const closePopup = () => {
        savePopup.hidden = true;
      };

      const applyInterval = () => {
        const sec = parseInt(saveInput.value, 10);
        if (Number.isFinite(sec)) {
          const appliedMs = this.game.setSaveInterval(sec * 1000);
          saveInput.value = String(Math.round(appliedMs / 1000));
          this.renderSaveStatus();
        } else {
          saveInput.value = this.game.getSaveIntervalSec();
        }
        closePopup();
      };

      saveStatusEl.addEventListener("click", openPopup);

      saveInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyInterval();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closePopup();
        }
      });

      // Apply on blur only if focus left the popup entirely
      saveInput.addEventListener("blur", (e) => {
        if (!savePopup.contains(e.relatedTarget)) {
          applyInterval();
        }
      });
    }

    this.bindChangelogModal();
    this.bindResearchModal();
    this.bindKnowledgeModal();
    this.bindCampModals();
  }

  bindChangelogModal() {
    const btn = document.getElementById("changelog-btn");
    const modal = document.getElementById("changelog-modal");
    const closeBtn = document.getElementById("changelog-close-btn");
    const content = document.getElementById("changelog-content");
    if (!btn || !modal || !closeBtn || !content) return;

    const open = () => {
      content.innerHTML = this._renderChangelogContent();
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    };

    const close = () => {
      modal.style.display = "none";
      document.body.style.overflow = "";
      btn.focus();
    };

    btn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") close();
    });
  }

  _renderChangelogContent() {
    if (typeof CHANGELOG_DATA === "undefined" || !CHANGELOG_DATA.length) {
      return "<p>История изменений пуста.</p>";
    }

    const typeLabelMap = {
      new: "Новое",
      improved: "Улучшено",
      fixed: "Исправлено",
    };

    return CHANGELOG_DATA.map((entry, i) => {
      const changes = entry.changes
        .map((c) => {
          const label = typeLabelMap[c.type] || c.type;
          return `<li class="cl-change-item">
            <span class="cl-change-badge ${c.type}">${label}</span>
            <span>${c.text}</span>
          </li>`;
        })
        .join("");

      const divider =
        i < CHANGELOG_DATA.length - 1 ? '<hr class="cl-divider">' : "";

      return `<div class="cl-version-block">
        <div class="cl-version-header">
          <span class="cl-version-tag">${entry.version}</span>
          <span class="cl-version-date">${entry.date}</span>
        </div>
        <div class="cl-version-title">${entry.title}</div>
        <ul class="cl-changes-list" style="margin-top:0.5rem">${changes}</ul>
      </div>${divider}`;
    }).join("");
  }

  bindResearchModal() {
    const modal = document.getElementById("research-modal");
    const closeBtn = document.getElementById("research-modal-close-btn");
    if (!modal || !closeBtn) return;

    const close = () => {
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
  }

  openResearchModal() {
    const modal = document.getElementById("research-modal");
    if (!modal) return;
    this.renderResearchModalContent();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.getElementById("research-modal-close-btn")?.focus();
  }

  bindKnowledgeModal() {
    const btn = document.getElementById("knowledge-book-btn");
    const modal = document.getElementById("knowledge-modal");
    const closeBtn = document.getElementById("knowledge-modal-close-btn");
    if (!btn || !modal || !closeBtn) return;

    const open = () => this.openKnowledgeModal();

    const close = () => {
      modal.style.display = "none";
      document.body.style.overflow = "";
      btn.focus();
    };

    btn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") close();
    });
  }

  openKnowledgeModal() {
    const modal = document.getElementById("knowledge-modal");
    const closeBtn = document.getElementById("knowledge-modal-close-btn");
    if (!modal || !closeBtn) return;
    this.renderKnowledgeModalContent();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  // ─── Camp founding confirmation + camp screen ───
  bindCampModals() {
    // Confirm modal (camp founding)
    const confirmModal = document.getElementById("camp-found-confirm-modal");
    const confirmClose = document.getElementById(
      "camp-found-confirm-close-btn",
    );
    const confirmCancel = document.getElementById(
      "camp-found-confirm-cancel-btn",
    );
    const confirmGather = document.getElementById(
      "camp-found-confirm-gather-btn",
    );
    const confirmOk = document.getElementById("camp-found-confirm-ok-btn");
    const closeConfirm = () => this.closeCampFoundConfirm();

    if (
      confirmModal &&
      confirmClose &&
      confirmCancel &&
      confirmGather &&
      confirmOk
    ) {
      confirmClose.addEventListener("click", closeConfirm);
      confirmCancel.addEventListener("click", closeConfirm);
      confirmGather.addEventListener("click", () => {
        this.guideToCampFoundingResources();
      });
      confirmModal.addEventListener("click", (e) => {
        if (e.target === confirmModal) closeConfirm();
      });
      confirmOk.addEventListener("click", () => {
        const tileId = this._pendingCampFoundTileId;
        if (!tileId) {
          closeConfirm();
          return;
        }
        const ok = this.game.chooseCamp(tileId);
        this._pendingCampFoundTileId = null;
        closeConfirm();
        if (ok) {
          // Trigger ritual animation on the camp tile next render
          this._campRitualTileId = tileId;
        }
        this.render({ forcePanels: true });
      });
    }

    // Camp management screen
    const campScreen = document.getElementById("camp-screen");
    const campScreenBack = document.getElementById("cs-back-btn");
    const closeCampScreen = () => this.closeCampScreen();

    if (campScreen && campScreenBack) {
      campScreenBack.addEventListener("click", closeCampScreen);
    }

    // Single Escape handler for both confirm modal and camp screen
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (confirmModal && confirmModal.style.display === "flex") {
        closeConfirm();
      } else if (campScreen && campScreen.style.display === "flex") {
        closeCampScreen();
      }
    });
  }

  getCampFoundingProgressItems(cost = this.game.getCampFoundingCost()) {
    return Object.entries(cost || {}).map(([resId, needed]) => {
      const resDef = this.data.resources?.[resId] || {};
      const have = this.game.resources[resId] || 0;
      const missing = Math.max(0, needed - have);
      return {
        resId,
        icon: resDef.icon || "",
        name: resDef.name || resId,
        have,
        needed,
        missing,
        done: missing === 0,
      };
    });
  }

  getCampFoundingResourceGuidance(check = this.game.canFoundCamp()) {
    const allMapTiles = this.game.getCampMapState().tiles;
    const missingResourceIds = Object.keys(check.missingResources || {});
    const resourceTiles = new Map();

    for (const tile of allMapTiles) {
      if (
        tile.resourceType &&
        tile.state !== "hidden" &&
        tile.state !== "camp" &&
        !resourceTiles.has(tile.resourceType)
      ) {
        resourceTiles.set(tile.resourceType, tile);
      }
    }

    const cacheTile = allMapTiles.find(
      (tile) =>
        tile.id === "starter_cache" &&
        tile.state !== "hidden" &&
        !tile.isDepleted,
    );

    const tileHints = missingResourceIds
      .map((resId) => resourceTiles.get(resId))
      .filter(Boolean)
      .filter(
        (tile, index, array) =>
          array.findIndex((other) => other.id === tile.id) === index,
      );

    return {
      missingResourceIds,
      tileHints,
      cacheTile,
      preferredTile: cacheTile || tileHints[0] || null,
      preferredMode: cacheTile || tileHints.length > 0 ? "map" : "manual",
    };
  }

  guideToCampFoundingResources() {
    const check = this.game.canFoundCamp();
    const guidance = this.getCampFoundingResourceGuidance(check);
    const preferredTile = guidance.preferredTile;

    this.closeCampFoundConfirm();
    if (preferredTile) {
      this.game.selectCampTile(preferredTile.id);
    }
    this.render({ forcePanels: true });

    window.requestAnimationFrame(() => {
      const targetId = preferredTile ? "camp-map-panel" : "gather-panel";
      const targetEl = document.getElementById(targetId);
      targetEl?.scrollIntoView({ behavior: "smooth", block: "center" });

      if (preferredTile) {
        document.getElementById("camp-map-primary-action")?.focus();
        return;
      }

      const neededBtn = document.querySelector(
        "#gather-panel .action-btn--needed:not([aria-disabled='true'])",
      );
      const fallbackBtn = document.querySelector(
        "#gather-panel .action-btn:not([aria-disabled='true'])",
      );
      (neededBtn || fallbackBtn)?.focus();
    });
  }

  openCampFoundConfirm(tileId) {
    const modal = document.getElementById("camp-found-confirm-modal");
    const body = document.getElementById("camp-found-confirm-body");
    const gatherBtn = document.getElementById("camp-found-confirm-gather-btn");
    const okBtn = document.getElementById("camp-found-confirm-ok-btn");
    if (!modal || !body || !gatherBtn || !okBtn) return;

    const tile = this.game.getCampMapState().tiles.find((t) => t.id === tileId);
    if (!tile) return;

    const check = this.game.canFoundCamp();
    const intro = this.data.campFoundingIntro || {};
    const cost = check.cost;
    const energyCost = check.energyCost;
    const costStr = this.formatResourcePairs(cost);
    const progressItems = this.getCampFoundingProgressItems(cost);
    const guidance = this.getCampFoundingResourceGuidance(check);
    const hasMissingResources = guidance.missingResourceIds.length > 0;

    const missingParts = [];
    for (const [resId, amount] of Object.entries(
      check.missingResources || {},
    )) {
      const resDef = this.data.resources?.[resId];
      missingParts.push(
        `${resDef?.icon || ""} ${resDef?.name || resId}: не хватает ${amount}`,
      );
    }
    if (check.lacksEnergy) missingParts.push("⚡ Не хватает сил");

    const progressHtml = `
      <div class="camp-found-confirm-progress">
        ${progressItems
          .map(
            (item) => `
              <div class="camp-found-confirm-progress-item${item.done ? " is-done" : ""}">
                <div class="camp-found-confirm-progress-head">
                  <span>${item.icon} ${item.name}</span>
                  <strong>${item.have}/${item.needed}</strong>
                </div>
                <div class="camp-found-confirm-progress-meta">
                  ${item.done ? "Готово для лагеря" : `Осталось собрать: ${item.missing}`}
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    `;

    const gatherHintHtml =
      missingParts.length > 0 &&
      (guidance.tileHints.length > 0 || guidance.cacheTile)
        ? `<div class="cfc-gather-hint">
            <div class="cfc-hint-label">Где быстро добрать материалы:</div>
            <div class="cfc-hint-tiles">
              ${guidance.tileHints.map((h) => `<span>${h.icon} ${h.name}</span>`).join("")}
              ${guidance.cacheTile ? `<span class="cfc-hint-cache">${guidance.cacheTile.icon} ${guidance.cacheTile.name}</span>` : ""}
            </div>
          </div>`
        : "";

    body.innerHTML = `
      <div class="camp-found-confirm-place">
        <span class="camp-found-confirm-icon">${tile.icon || "🏕️"}</span>
        <span class="camp-found-confirm-name">${tile.name}</span>
      </div>
      ${tile.campChosenStory ? `<p class="camp-found-confirm-story">${tile.campChosenStory}</p>` : ""}
      <div class="camp-found-confirm-cost">
        <div class="camp-found-confirm-cost-label">Ритуал основания стоит:</div>
        <div class="camp-found-confirm-cost-line">⚒️ ${costStr} · ⚡ −${energyCost}</div>
      </div>
      ${progressHtml}
      ${
        missingParts.length > 0
          ? `<div class="camp-found-confirm-missing">${missingParts.map((p) => `<div>${p}</div>`).join("")}${gatherHintHtml}</div>`
          : `<div class="camp-found-confirm-ready">${intro.questReadyText || "Всё готово — можно основать лагерь."}</div>`
      }
    `;

    gatherBtn.hidden = !hasMissingResources;
    okBtn.disabled = !check.ok;
    okBtn.setAttribute("aria-disabled", check.ok ? "false" : "true");
    okBtn.textContent = intro.confirmConfirmLabel || "🏕️ Основать лагерь";

    this._pendingCampFoundTileId = tileId;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    if (check.ok) okBtn.focus();
    else if (!gatherBtn.hidden) gatherBtn.focus();
    else document.getElementById("camp-found-confirm-cancel-btn")?.focus();
  }

  closeCampFoundConfirm() {
    const modal = document.getElementById("camp-found-confirm-modal");
    if (!modal) return;
    modal.style.display = "none";
    document.body.style.overflow = "";
    this._pendingCampFoundTileId = null;
  }

  openCampScreen() {
    if (!this.game.isCampSetupDone()) return;
    this.game.refreshCampMap?.();
    const screen = document.getElementById("camp-screen");
    if (!screen) return;
    this.game.markCampEntered();
    screen.style.display = "flex";
    document.body.style.overflow = "hidden";
    this._selectedCampSlot = null;
    this.renderCampScreen();
    document.getElementById("cs-back-btn")?.focus();
  }

  closeCampScreen() {
    const screen = document.getElementById("camp-screen");
    if (!screen) return;
    screen.style.display = "none";
    document.body.style.overflow = "";
  }

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
        tileId: "shelter_site",
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
        tileId: "storage_site",
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
        tileId: "workshop_site",
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
        tileId: "kiln_site",
        emptyIcon: "🧱",
        emptyHint: "место под печь",
        role: "Обработка материалов огнём. Печь нужна для обжига, керамики, кирпича — это следующий уровень производства.",
      },
    ];
  }

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
  }

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
  }

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
  }

  renderCampScreen() {
    const screen = document.getElementById("camp-screen");
    if (!screen || screen.style.display === "none") return;

    this.game.refreshCampMap?.();

    this._renderCampTopbar();
    this._renderCampScene();
    this._renderCampDock();
    this._renderCampDetail();
  }

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
          return `<span class="cs-res-chip"><span class="cs-res-chip-icon">${this.getResourceDisplayIcon(id)}</span> <span class="cs-res-chip-val">${val}</span></span>`;
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
      const ePct = maxE > 0 ? Math.round((energy / maxE) * 100) : 0;
      const sPct = maxS > 0 ? Math.round((satiety / maxS) * 100) : 0;
      charEl.innerHTML = `
        <span class="cs-char-stat">⚡ ${Math.floor(energy)}
          <span class="cs-char-bar"><span class="cs-char-bar-fill cs-char-bar-fill--energy" style="width:${ePct}%"></span></span>
        </span>
        <span class="cs-char-stat">🍖 ${Math.floor(satiety)}
          <span class="cs-char-bar"><span class="cs-char-bar-fill cs-char-bar-fill--satiety" style="width:${sPct}%"></span></span>
        </span>
      `;
    }
  }

  // ── B: Central visual scene ──────────────────────────────────────────────
  _getCampfireSceneVariant(slotView, isBuilt, isConstructing) {
    if (isBuilt) return "live";
    if (isConstructing) return "constructing";
    if (slotView.sceneMode === "campfire-ready") return "ready";
    if (slotView.sceneMode === "campfire") return "live";
    return null;
  }

  _renderCampfireSceneArt(iconEl, variant) {
    if (!iconEl || !variant) return;

    const sparkMarkup =
      variant === "live"
        ? `
          <span class="cs-campfire-spark cs-campfire-spark--1"></span>
          <span class="cs-campfire-spark cs-campfire-spark--2"></span>
          <span class="cs-campfire-spark cs-campfire-spark--3"></span>
        `
        : "";
    const frontFlameMarkup =
      variant === "live" || variant === "constructing"
        ? '<span class="cs-campfire-flame cs-campfire-flame--front"></span>'
        : "";
    const backFlameMarkup =
      variant === "live"
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
  }

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

      let tileDiscovered = true;
      if (slot.tileId) {
        const tileState = this.game.localCampMap?.tileStates?.[slot.tileId];
        if (tileState === "hidden") tileDiscovered = false;
      }

      const isCampfire = slot.buildingId === "campfire";
      const campfireVariant = isCampfire
        ? this._getCampfireSceneVariant(slotView, isBuilt, isConstructing)
        : null;

      el.classList.toggle("is-selected", isSelected);
      el.classList.toggle(
        "cs-slot--empty",
        !isBuilt && !isConstructing && tileDiscovered && !isCampfire,
      );
      el.classList.toggle(
        "cs-slot--undiscovered",
        !tileDiscovered && !isCampfire,
      );
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

      if (!tileDiscovered && !isCampfire) {
        iconEl.textContent = "❓";
        iconEl.style.cssText = "";
        labelEl.textContent = "";
        statusEl.textContent = "";
        statusEl.className = "cs-slot-status";
        el.style.opacity = "";
      } else if (isBuilt) {
        if (isCampfire) this._renderCampfireSceneArt(iconEl, "live");
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
  }

  // ── D: Bottom dock ───────────────────────────────────────────────────────
  _renderCampDock() {
    const dock = document.getElementById("cs-dock");
    if (!dock) return;

    const layout = this._getCampSlotLayout();
    const construction = this.game.getConstructionState();

    dock.innerHTML = "";
    for (const slot of layout) {
      const building = this.data.buildings[slot.buildingId];
      const slotView = this._getCampSlotPresentation(slot);
      const isBuilt = !!this.game.buildings[slot.buildingId];
      const isConstructing = construction?.buildingId === slot.buildingId;
      const isSelected = this._selectedCampSlot === slot.id;

      // Check tile discovery
      let tileDiscovered = true;
      if (slot.tileId) {
        const tileState = this.game.localCampMap?.tileStates?.[slot.tileId];
        if (tileState === "hidden") tileDiscovered = false;
      }
      const isCampfire = slot.buildingId === "campfire";

      const item = document.createElement("div");
      item.className = "cs-dock-item";
      if (isBuilt) item.classList.add("is-built");
      if (isConstructing) item.classList.add("is-constructing");
      if (!tileDiscovered && !isCampfire) item.classList.add("is-locked");
      else if (!isBuilt && !isConstructing) item.classList.add("is-empty");
      if (isSelected) item.classList.add("is-selected");

      let statusText = "";
      if (isBuilt)
        statusText = `<span class="cs-dock-status is-built">✓</span>`;
      else if (isConstructing)
        statusText = `<span class="cs-dock-status is-constructing">⏳ ${Math.round((construction.progress || 0) * 100)}%</span>`;

      const icon =
        !tileDiscovered && !isCampfire
          ? "❓"
          : isBuilt || isConstructing
            ? building?.icon || "🏗️"
            : slotView.emptyIcon || slot.emptyIcon || "+";
      const label =
        !tileDiscovered && !isCampfire
          ? "?"
          : isBuilt || isConstructing
            ? building?.name || slot.label
            : slotView.dockLabel || slot.label;

      item.innerHTML = `
        <span class="cs-dock-icon">${icon}</span>
        <span class="cs-dock-label">${label}</span>
        ${statusText}
      `;

      item.addEventListener("click", () => {
        this._selectedCampSlot = slot.id;
        this._renderCampScene();
        this._renderCampDock();
        this._renderCampDetail();
        document.getElementById("cs-scene-hint")?.classList.add("is-hidden");
      });

      dock.appendChild(item);
    }
  }

  // ── C: Right context panel ───────────────────────────────────────────────
  _renderCampDetail() {
    const content = document.getElementById("cs-detail-content");
    if (!content) return;

    const slotId = this._selectedCampSlot;
    if (!slotId) {
      const stage = this._getCampStage();
      content.innerHTML = `
        <div class="cs-detail-empty">
          <div class="cs-detail-empty-icon">🏕️</div>
          <div class="cs-detail-empty-text">Выберите место в лагере, чтобы узнать о нём</div>
          <div class="cs-detail-empty-text" style="font-size: 0.72rem; margin-top: 0.25rem;">Стадия: ${stage.label}</div>
        </div>`;
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
        ? "Строится"
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
      // Construction progress
      const pct = Math.round((construction.progress || 0) * 100);
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

    // Bind action buttons
    this._bindCampDetailActions(content, slot);
  }

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
  }

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
  }

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
  }

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

    if (!unlockedByTech)
      blocker = `Требуется исследование: ${this.data.tech[building.unlockedBy]?.name || building.unlockedBy}`;
    else if (!requiredBuildingReady)
      blocker = `Требуется здание: ${this.data.buildings[building.requires]?.name || building.requires}`;
    else if (prologueCampfireState && !prologueCampfireState.shelterBuilt)
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
  }

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
  }

  _bindCampDetailActions(container, slot) {
    // Build button
    const buildBtn = container.querySelector("[data-build-id]");
    if (buildBtn) {
      buildBtn.addEventListener("click", () => {
        this.game.build(slot.buildingId);
        this.renderCampScreen();
        this.render({ forcePanels: true });
      });
    }

    // Upgrade buttons
    container.querySelectorAll("[data-upgrade-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.dataset.upgradeId;
        if (this.game.applyUpgrade(uid)) {
          this.renderCampScreen();
          this.render({ forcePanels: true });
        }
      });
    });
  }

  // ─── Camp founding quest widget (pre-camp only) ───
  renderCampFoundingQuest() {
    const container = document.getElementById("camp-founding-quest");
    if (!container) return;

    if (this.game.isCampSetupDone()) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    const intro = this.data.campFoundingIntro || {};
    const progress = this.game.getCampFoundingQuestProgress();
    const cost = this.game.getCampFoundingCost();
    const energyCost = this.game.getCampFoundingEnergyCost();

    // Emit readyStory once if quest just became fully complete
    // (covers cases when completion happens via resource gains, not hover).
    this.game._maybeEmitCampReadyStory();

    const itemsHtml = progress.items
      .map((item) => {
        const icon = item.done ? "✓" : "○";
        const cls = item.done ? "camp-quest-item is-done" : "camp-quest-item";
        return `
          <li class="${cls}">
            <span class="camp-quest-check">${icon}</span>
            <div class="camp-quest-body">
              <div class="camp-quest-text">${item.text}</div>
              ${item.hint && !item.done ? `<div class="camp-quest-hint">${item.hint}</div>` : ""}
            </div>
          </li>`;
      })
      .join("");

    const costStr = this.formatResourcePairs(cost);
    const summaryHtml = progress.allDone
      ? `<div class="camp-quest-ready">${intro.questReadyText || "Всё готово. Выберите место и основайте лагерь."}</div>`
      : `<div class="camp-quest-summary">Ритуал основания: ⚒️ ${costStr} · ⚡ −${energyCost}</div>`;

    container.innerHTML = `
      <div class="camp-quest-header">
        <h3 class="camp-quest-title">${intro.questTitle || "🏕️ Подготовка к основанию лагеря"}</h3>
        ${intro.questIntro ? `<p class="camp-quest-intro">${intro.questIntro}</p>` : ""}
      </div>
      <ul class="camp-quest-list">${itemsHtml}</ul>
      ${summaryHtml}
    `;
    container.hidden = false;
    container.classList.toggle("is-ready", !!progress.allDone);
  }

  renderHeaderModeState() {
    const isPrologue = this.game.isPrologueActive();
    const isIntroScreen = this.game.shouldShowOnboardingIntro();
    document.body.classList.toggle("is-prologue-active", isPrologue);
    document.body.classList.toggle("is-intro-screen", isIntroScreen);

    const bookBtn = document.getElementById("knowledge-book-btn");
    if (bookBtn) {
      const entries = this.game.getKnowledgeEntries().length;
      if (entries > 0) {
        bookBtn.setAttribute("data-badge", String(entries));
      } else {
        bookBtn.removeAttribute("data-badge");
      }
      bookBtn.classList.toggle("has-badge", entries > 0);
      bookBtn.classList.toggle(
        "is-highlighted",
        this.game.getActiveStoryEvent()?.type === "knowledge",
      );
    }
  }

  renderPrologueLayoutState() {
    const resourcesPanel = document.getElementById("resources-panel");
    const craftPanel = document.getElementById("craft-panel");
    const buildingsPanel = document.getElementById("buildings-panel");
    const actionsRow = document.getElementById("actions-row");
    const systemsRow = document.getElementById("systems-row");
    const researchWidget = document.getElementById("research-widget");

    if (!this.game.isPrologueActive()) {
      resourcesPanel?.style.removeProperty("display");
      craftPanel?.style.removeProperty("display");
      buildingsPanel?.style.removeProperty("display");
      systemsRow?.style.removeProperty("display");
      researchWidget?.style.removeProperty("display");
      actionsRow?.classList.remove("is-single");
      systemsRow?.classList.remove("is-single");
      return;
    }

    const reveal = this.game.getPrologueRevealState();

    if (resourcesPanel) {
      resourcesPanel.style.display = reveal.showResources ? "" : "none";
    }
    if (craftPanel) {
      craftPanel.style.display = reveal.showCraft ? "" : "none";
    }
    if (buildingsPanel) {
      buildingsPanel.style.display = reveal.showBuildings ? "" : "none";
    }
    if (researchWidget) {
      researchWidget.style.display = reveal.showInsights ? "" : "none";
    }
    if (actionsRow) {
      actionsRow.classList.toggle("is-single", !reveal.showCraft);
    }
    if (systemsRow) {
      systemsRow.style.display = reveal.showBuildings ? "" : "none";
      systemsRow.classList.toggle("is-single", reveal.showBuildings);
    }
  }

  getCampTileStateLabel(state) {
    switch (state) {
      case "developed":
        return "Освоено";
      case "discovered":
        return "Доступно";
      case "hidden":
        return "Скрыто";
      default:
        return "Участок";
    }
  }

  renderCampMap() {
    const container = document.getElementById("camp-map-panel");
    if (!container) return;

    const mapState = this.game.getCampMapState();

    // ── Flicker guard: if the intro overlay is already showing the same step,
    //    skip full DOM rebuild so CSS animations don't restart every tick. ──
    if (
      !mapState.campSetupDone &&
      mapState.introStep &&
      container.querySelector(".camp-intro-overlay")
    ) {
      const currentOverlayStep = container
        .querySelector(".camp-intro-overlay")
        ?.getAttribute("data-intro-step");
      if (currentOverlayStep === mapState.introStep.id) {
        return; // same intro step — don't re-render
      }
    }

    const selected = this.game.getCampMapTileDetails(mapState.selectedTileId);
    if (!selected) {
      container.innerHTML = "";
      return;
    }

    const selectedStateLabel = this.getCampTileStateLabel(selected.state);
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
        const resDef = this.data.resources?.[resId];
        missingLines.push(
          `Не хватает ${resDef?.icon || ""} ${resDef?.name || resId}: ${amount}`,
        );
      }
      if (foundCheck.lacksEnergy) missingLines.push("⚡ Недостаточно сил");
      const disabled = !foundCheck.ok;
      detailsActionBlock = `
        <div class="camp-map-action-meta">
          <span>Тип места: ${selected.terrainLabel || selected.terrainType || "подходящее место"}</span>
          <span>${selected.campCandidateHint || "Здесь можно основать лагерь."}</span>
        </div>
        ${
          missingLines.length > 0
            ? `<div class="camp-map-note is-empty">Не хватает материалов — соберите их в панели ниже</div>`
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
      const campRestLabel = campRestProfile.canRest
        ? `🛌 ${campRestProfile.label} · ⚡ +${campRestProfile.energyGain} · 🍖 +${this.formatNumber(campRestProfile.satietyGain, 1)}`
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
          <span>Путь: ${selectedActionProfile?.zoneLabel || (selected.distanceFromCamp === 0 ? "центр" : selected.distanceFromCamp === 1 ? "ближняя зона" : "дальний выход")}</span>
          <span>Местность: ${selectedActionProfile?.terrainLabel || "обычный участок"}</span>
          <span>Время сбора: ${this.formatSeconds(selected.action.cooldown || 0)}</span>
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
            🥾 Натоптать тропу · ${trailCostStr} · ⚡-${selectedPathProject.energyCost}
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

    // ── Legend under the map ──
    const legendHtml = mapState.campSetupDone
      ? mapState.interactionHint
      : `<span class="camp-map-legend-item"><span class="lg-dot lg-candidate"></span> Кандидаты</span>
        <span class="camp-map-legend-item"><span class="lg-dot lg-discovered"></span> Доступные ресурсы</span>
         <span class="camp-map-legend-item"><span class="lg-dot lg-silhouette"></span> Очертания</span>
         <span class="camp-map-legend-item"><span class="lg-dot lg-hidden"></span> Неизвестное</span>`;

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
      <div class="camp-map-body">
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
          <div class="camp-map-legend">${legendHtml}</div>
        </div>
        <aside class="camp-map-details">
          <div class="camp-map-details-top">
            <div class="camp-map-details-name">${selected.icon || "•"} ${selected.name}</div>
            <div class="camp-map-details-meta">
              <span class="camp-map-chip">${selectedStateLabel}</span>
              <span class="camp-map-chip">Дистанция ${selected.distanceFromCamp}</span>
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

          const displayIcon =
            tile.state === "hidden"
              ? ""
              : tile.construction?.icon ||
                tile.building?.icon ||
                tile.icon ||
                "";

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

          const animStyle =
            !mapState.campSetupDone && mapState.introStep?.index === 0
              ? ` style="animation-delay:${(tileIndex * 45).toFixed(0)}ms"`
              : "";

          tileIndex++;
          return `<g class="${classes.join(" ")}" data-tile-id="${tile.id}" role="button" tabindex="${tile.state !== "hidden" && tile.state !== "silhouette" ? "0" : "-1"}" aria-label="${tile.name} (${tileStateLabel})"${animStyle}><polygon points="${pts}"/>${pathMark}<text class="tile-icon" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}">${displayIcon}</text>${candidateLabel}${stockBadge}</g>`;
        })
        .join("\n");

      let travelOverlay = "";
      if (this._campTravelAction) {
        const targetCoord =
          tileCoordById[this._campTravelAction.tileId] || null;
        const campTile =
          mapState.tiles.find((tile) => tile.state === "camp") ||
          mapState.tiles.find((tile) => tile.id === "camp_clearing") ||
          mapState.tiles.find((tile) => (tile.distanceFromCamp || 0) === 0) ||
          null;
        const startCoord = campTile ? tileCoordById[campTile.id] : null;
        if (targetCoord && startCoord) {
          const travelState = this._getCampTravelPhaseState(
            this._campTravelAction,
          );
          if (travelState) {
            let markerX = startCoord.x;
            let markerY = startCoord.y;
            if (travelState.phase === "outbound") {
              markerX =
                startCoord.x +
                (targetCoord.x - startCoord.x) * travelState.progress;
              markerY =
                startCoord.y +
                (targetCoord.y - startCoord.y) * travelState.progress;
            } else if (travelState.phase === "gather") {
              markerX = targetCoord.x;
              markerY = targetCoord.y;
            } else {
              markerX =
                targetCoord.x +
                (startCoord.x - targetCoord.x) * travelState.progress;
              markerY =
                targetCoord.y +
                (startCoord.y - targetCoord.y) * travelState.progress;
            }

            const routeClass =
              travelState.phase === "return"
                ? "camp-map-travel-route is-return"
                : "camp-map-travel-route";
            const markerClass =
              travelState.phase === "gather"
                ? "camp-map-travel-marker is-gathering"
                : "camp-map-travel-marker";

            travelOverlay = `
              <g class="camp-map-travel-layer" aria-hidden="true">
                <path class="${routeClass}" d="M ${startCoord.x.toFixed(1)} ${startCoord.y.toFixed(1)} L ${targetCoord.x.toFixed(1)} ${targetCoord.y.toFixed(1)}" />
                <circle class="${markerClass}" cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="8" />
                <text class="camp-map-travel-icon" x="${markerX.toFixed(1)}" y="${(markerY + 0.5).toFixed(1)}">🧍</text>
                <text class="camp-map-travel-timer" x="${markerX.toFixed(1)}" y="${(markerY - 14).toFixed(1)}">${this.formatCooldownMs(travelState.totalRemainingMs)}</text>
              </g>
            `;
          }
        }
      }

      svgEl.innerHTML = `${tileGroups}${travelOverlay}`;

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
          continue;
        }

        // Build tooltip text (SVG <g> elements don't support ::after)
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
            const profile = this.game.getGatherProfile(tile.actionId, {
              tileId: tile.id,
            });
            lines.push(`Действие: ${actionCopy.icon} ${actionCopy.name}`);
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
          // Other tiles: click only selects. Action is explicit via right panel
          // so gather spam/misclicks are less likely.
          this.game.selectCampTile(tile.id);
          this.render({ forcePanels: true });
        });
      }
    }
  }

  renderResearchWidget() {
    const container = document.getElementById("research-widget");
    if (!container) return;

    if (this.game.isPrologueActive()) {
      const insights = this.game.getPrologueInsightsState();
      const unlockedCount = insights.filter(
        (insight) => insight.unlocked,
      ).length;
      const hasAvailable = insights.some((insight) => !insight.unlocked);
      const latestUnlocked = [...insights]
        .reverse()
        .find((insight) => insight.unlocked);

      container.innerHTML = `
        <div class="rw-header">
          <div class="rw-title">
            ✨ <span>${this.data.prologue?.insightsTitle || "Озарения"}</span>
            ${hasAvailable ? '<span class="rw-dot has-available"></span>' : ""}
          </div>
          <div class="rw-chips">
            <span class="research-summary-chip">Открыто: ${unlockedCount}/${insights.length}</span>
            <span class="research-summary-chip">Книга: ${this.game.getKnowledgeEntries().length}</span>
          </div>
        </div>
        <div class="research-overview-text">${this.data.prologue?.insightsHint || ""}</div>
        ${
          latestUnlocked
            ? `<div class="prologue-inline-note">Последнее озарение: ${latestUnlocked.icon} ${latestUnlocked.name}</div>`
            : `<div class="prologue-inline-note">Первые озарения придут не из меню, а из повторяющихся действий руками.</div>`
        }
        <button class="rw-open-btn js-research-open" type="button">Открыть озарения</button>
      `;

      container
        .querySelector(".js-research-open")
        ?.addEventListener("click", () => {
          this.openResearchModal();
        });

      return;
    }

    const researchState = this.game.getResearchState();
    const branchState = this.game.getResearchBranchesState();
    const totalDone = Object.keys(this.game.researched).length;
    const startedBranches = branchState.branches.filter(
      (b) => b.started,
    ).length;

    const hasAvailable =
      branchState.branches.some((b) =>
        b.techs.some((t) => this.game.canResearch(t.id)),
      ) || branchState.foundation.some((t) => this.game.canResearch(t.id));

    let activeHtml = "";
    if (researchState) {
      const pct = Math.round(researchState.progress * 100);
      const queuedTech =
        this.game.researchQueue.length > 0
          ? this.data.tech[this.game.researchQueue[0].techId]
          : null;
      const queueHtml = queuedTech
        ? `<div class="rw-queue-row"><span class="rw-queue-label">📋</span><span class="rw-queue-name">${queuedTech.icon} ${queuedTech.name}</span></div>`
        : "";
      activeHtml = `
        <div class="rw-active">
          <div class="rw-active-info">
            <span class="rw-active-label">Исследуется:</span>
            <span class="rw-active-name">${researchState.icon} ${researchState.name}</span>
            <span class="rw-active-time">${this.formatSeconds(researchState.remainingMs)}</span>
          </div>
          <div class="rw-progress-bar"><div class="rw-progress-fill" style="width:${pct}%"></div></div>
          ${queueHtml}
        </div>`;
    }

    const indicatorClass = researchState
      ? "is-active"
      : hasAvailable
        ? "has-available"
        : "";
    const btnLabel = researchState
      ? "Управлять исследованиями"
      : hasAvailable
        ? "Открыть исследования ✦"
        : "Открыть исследования";

    container.innerHTML = `
      <div class="rw-header">
        <div class="rw-title">
          🔬 <span>Исследования</span>
          ${indicatorClass ? `<span class="rw-dot ${indicatorClass}"></span>` : ""}
        </div>
        <div class="rw-chips">
          <span class="research-summary-chip">Изучено: ${totalDone}</span>
          <span class="research-summary-chip">Ветви: ${startedBranches}/${branchState.branches.length}</span>
        </div>
      </div>
      ${activeHtml}
      <button class="rw-open-btn js-research-open" type="button">${btnLabel}</button>
    `;

    container
      .querySelector(".js-research-open")
      ?.addEventListener("click", () => {
        const modal = document.getElementById("research-modal");
        if (!modal) return;
        this.renderResearchModalContent();
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
        document.getElementById("research-modal-close-btn")?.focus();
      });
  }

  renderResearchModalContent() {
    const container = document.getElementById("research-modal-body");
    if (!container) return;
    const title = document.getElementById("research-modal-title");
    if (this.game.isPrologueActive()) {
      if (title) title.textContent = "✨ Озарения";
      this._renderPrologueInsightsBody(container);
      return;
    }
    if (title) title.textContent = "🔬 Исследования эпохи";
    this._renderResearchBody(container);
  }

  renderKnowledgeModalContent() {
    const container = document.getElementById("knowledge-modal-body");
    if (!container) return;

    const entries = this.game.getKnowledgeEntries();
    if (entries.length === 0) {
      container.innerHTML =
        '<p class="knowledge-empty">Пока в Книге знаний нет записей. Первые наблюдения появятся во время пролога.</p>';
      return;
    }

    const intro = this.data.prologue?.knowledgeIntro
      ? `<div class="knowledge-intro">${this.data.prologue.knowledgeIntro}</div>`
      : "";

    container.innerHTML =
      intro +
      entries
        .map(
          (entry, index) => `
          <article class="knowledge-entry">
            <div class="knowledge-entry-meta">Запись ${index + 1}</div>
            <h3 class="knowledge-entry-title">${entry.title}</h3>
            <div class="knowledge-entry-body">
              ${entry.lines.map((line) => `<p>${line}</p>`).join("")}
            </div>
          </article>
        `,
        )
        .join("");
  }

  renderStoryEvent() {
    const layer = document.getElementById("story-event-layer");
    if (!layer) return;

    const event = this.game.getActiveStoryEvent();
    if (!event) {
      this.lastStoryEventId = "";
      layer.innerHTML = "";
      layer.style.display = "none";
      return;
    }

    if (event.id === this.lastStoryEventId) {
      layer.style.display = "block";
      return;
    }

    this.lastStoryEventId = event.id;

    layer.style.display = "block";
    layer.innerHTML = `
      <article class="story-event story-event--${event.type || "default"}">
        <div class="story-event-main">
          <div class="story-event-kicker">${event.type === "transition" ? "Новый этап" : event.type === "campfire" ? "Рубеж пролога" : event.type === "knowledge" ? "Книга знаний" : event.type === "prologue" ? "Первые шаги" : "Озарение"}</div>
          <div class="story-event-title">${event.icon || "✦"} ${event.title}</div>
          <div class="story-event-text">${event.text || ""}</div>
        </div>
        <div class="story-event-actions">
          ${
            event.action === "insights"
              ? '<button class="story-event-action js-story-action" type="button">Озарения</button>'
              : event.action === "knowledge"
                ? '<button class="story-event-action js-story-action" type="button">Книга знаний</button>'
                : ""
          }
          <button class="story-event-close" type="button" aria-label="Закрыть">✕</button>
        </div>
      </article>
    `;

    layer.querySelector(".story-event-close")?.addEventListener("click", () => {
      this.game.dismissStoryEvent(event.id);
      this.render({ forcePanels: true });
    });

    layer.querySelector(".js-story-action")?.addEventListener("click", () => {
      if (event.action === "insights") {
        this.openResearchModal();
      } else if (event.action === "knowledge") {
        this.openKnowledgeModal();
      }
      this.game.dismissStoryEvent(event.id);
      this.render({ forcePanels: true });
    });
  }

  formatResourcePairs(resourceMap, { plus = false, decimals = 0 } = {}) {
    return Object.entries(resourceMap)
      .map(([id, amount]) => {
        const value =
          decimals > 0 ? Number(amount).toFixed(decimals) : String(amount);
        return `${this.getResourceDisplayIcon(id)}${plus ? "+" : ""}${value}`;
      })
      .join(" ");
  }

  formatResourcePairsPlain(resourceMap, { plus = false, decimals = 0 } = {}) {
    return Object.entries(resourceMap)
      .map(([id, amount]) => {
        const value =
          decimals > 0 ? Number(amount).toFixed(decimals) : String(amount);
        return `${this.getResourceDisplayName(id)} ${plus ? "+" : ""}${value}`;
      })
      .join(", ");
  }

  formatSeconds(ms) {
    return `${(ms / 1000).toFixed(1)}с`;
  }

  formatCooldownMs(ms) {
    if (ms <= 0) return "0.0с";
    const deciseconds = Math.ceil(ms / 100);
    const shown = Math.max(1, deciseconds) / 10;
    return `${shown.toFixed(1)}с`;
  }

  formatNumber(value, decimals = 1) {
    return Number(value).toFixed(decimals);
  }

  scheduleRestCooldownRefresh(durationMs) {
    clearTimeout(this._restCooldownTimer);
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;

    let elapsed = 0;
    const tickInterval = 250;
    const tick = () => {
      elapsed += tickInterval;
      this.render({ forcePanels: true });
      if (elapsed < durationMs) {
        this._restCooldownTimer = setTimeout(tick, tickInterval);
      }
    };

    this._restCooldownTimer = setTimeout(tick, tickInterval);
  }

  formatTooltipText(lines) {
    return lines
      .filter((line) => typeof line === "string" && line.trim().length > 0)
      .map((line) =>
        line
          .trim()
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((line) => line.length > 0)
      .join("\n");
  }

  setTooltip(element, lines) {
    if (!element) return;
    const text = this.formatTooltipText(lines);
    if (!text) return;
    element.classList.add("has-tooltip");
    element.setAttribute("data-tooltip", text);
  }

  setButtonAvailability(button, isAvailable) {
    if (!button) return;
    button.disabled = false;
    button.classList.toggle("disabled", !isAvailable);
    button.setAttribute("aria-disabled", isAvailable ? "false" : "true");
  }

  getGatherActionCopy(action) {
    if (this.game.isPrologueActive()) {
      return {
        name: action.prologueName || action.name,
        description: action.prologueDescription || action.description,
        icon: action.prologueIcon || action.icon,
      };
    }

    return {
      name: action.name,
      description: action.description,
      icon: action.icon,
    };
  }

  getRecipeCopy(recipe) {
    if (this.game.isPrologueActive()) {
      return {
        name: recipe.prologueName || recipe.name,
        description: recipe.prologueDescription || recipe.description,
        icon: recipe.prologueIcon || recipe.icon,
      };
    }

    return {
      name: recipe.name,
      description: recipe.description,
      icon: recipe.icon,
    };
  }

  getBuildingCopy(building) {
    if (this.game.isPrologueActive()) {
      return {
        name: building.prologueName || building.name,
        description: building.prologueDescription || building.description,
        icon: building.prologueIcon || building.icon,
      };
    }

    return {
      name: building.name,
      description: building.description,
      icon: building.icon,
    };
  }

  getResourceDisplayName(resourceId) {
    const resource = this.data.resources?.[resourceId];
    if (!resource) return resourceId;
    if (this.game.isPrologueActive() && resource.prologueName) {
      return resource.prologueName;
    }
    return resource.name || resourceId;
  }

  getResourceDisplayIcon(resourceId) {
    const resource = this.data.resources?.[resourceId];
    if (!resource) return "";
    if (this.game.isPrologueActive() && resource.prologueIcon) {
      return resource.prologueIcon;
    }
    return resource.icon || "";
  }

  isPanelHovered(panelId) {
    if (!panelId) return false;
    const panel = document.getElementById(panelId);
    return !!panel && panel.matches(":hover");
  }

  render({ forcePanels = false } = {}) {
    this.renderHeaderModeState();
    this.renderPrologueLayoutState();
    this.renderStoryEvent();

    // Prevent click loss when DOM is rebuilt between pointer down/up.
    if (this.isPointerDown) {
      this.renderCharacterPanel();
      this.renderSaveStatus();
      return;
    }

    if (this.game.shouldShowOnboardingIntro()) {
      this.renderOnboardingIntro();
      this.hideOnboardingStep();
    } else if (this.game.isOnboardingActive()) {
      this.hideOnboardingIntro();
      this.renderOnboardingStep();
    } else {
      this.hideOnboarding();
    }

    if (forcePanels || !this.isPanelHovered("character-panel")) {
      this.renderCharacterPanel();
    }
    if (forcePanels || !this.isPanelHovered("camp-map-panel")) {
      this.renderCampMap();
    }
    if (forcePanels || !this.isPanelHovered("camp-founding-quest")) {
      this.renderCampFoundingQuest();
    }
    if (forcePanels || !this.isPanelHovered("resources-panel")) {
      this.renderResources();
    }
    if (forcePanels || !this.isPanelHovered("gather-panel")) {
      this.renderGather();
    }
    if (forcePanels || !this.isPanelHovered("craft-panel")) {
      this.renderCrafting();
    }
    if (forcePanels || !this.isPanelHovered("buildings-panel")) {
      this.renderBuildingsPanel();
    }
    if (forcePanels || !this.isPanelHovered("automation-panel")) {
      this.renderAutomationPanel();
    }
    if (forcePanels || !this.isPanelHovered("research-widget")) {
      this.renderResearchWidget();
    }
    const _rModal = document.getElementById("research-modal");
    if (
      _rModal &&
      _rModal.style.display !== "none" &&
      (forcePanels || !this.isPanelHovered("research-modal"))
    ) {
      this.renderResearchModalContent();
    }
    const _kModal = document.getElementById("knowledge-modal");
    if (
      _kModal &&
      _kModal.style.display !== "none" &&
      !this.isPanelHovered("knowledge-modal-body")
    ) {
      this.renderKnowledgeModalContent();
    }
    this.renderLog();
    this.renderEraProgress();
    this.renderSaveStatus();
    this.renderCampScreen();
  }

  renderOnboardingIntro() {
    const container = document.getElementById("onboarding-intro-panel");
    if (!container) return;

    container.style.display = "block";
    const lines = this.data.onboarding.introLines;
    const prologue = this.data.prologue || {};
    const lede = lines[0] || "";
    const rest = lines.slice(1);
    container.innerHTML = `
      <img class="intro-hero-image" src="assets/intro-campfire.jpg" alt="" aria-hidden="true" onerror="this.src='assets/intro-campfire.svg'; this.onerror=null;">
      <div class="intro-hero-overlay"></div>
      <div class="onboarding-intro-content">
        <p class="intro-era-label">${prologue.eraLabel || "— Пролог —"}</p>
        <h2 class="onboarding-intro-title">🌍 ${prologue.title || "На заре человечества"}</h2>
        ${prologue.subtitle ? `<p class="intro-subtitle">${prologue.subtitle}</p>` : ""}
        <div class="onboarding-intro-text">
          <p class="intro-lede">${lede}</p>
          ${rest.map((l) => `<p>${l}</p>`).join("")}
        </div>
        <div class="intro-divider"><span>✦</span></div>
        <div class="onboarding-intro-buttons">
          <button id="obStartBtn" class="ob-btn ob-btn-start">🌄 Войти в историю</button>
          <button id="obSkipBtn" class="ob-btn ob-btn-skip">Пропустить пролог</button>
        </div>
      </div>
    `;

    document.getElementById("obStartBtn").addEventListener("click", () => {
      this.game.startOnboarding();
      this.render({ forcePanels: true });
    });

    document.getElementById("obSkipBtn").addEventListener("click", () => {
      this.game.skipOnboarding();
      container.style.display = "none";
      this.render({ forcePanels: true });
    });
  }

  renderOnboardingStep() {
    const container = document.getElementById("onboarding-step-panel");
    if (!container) return;

    container.style.display = "block";
    const step = this.game.getCurrentOnboardingStep();
    if (!step) {
      container.style.display = "none";
      return;
    }

    const steps = this.data.onboarding.steps;
    const currentIdx = this.game.onboarding.currentStep;
    const progressPct = Math.round((currentIdx / steps.length) * 100);
    const campfireState = this.game.getPrologueCampfireState();
    const insightsCount = this.game.getUnlockedInsightsCount();
    const knowledgeCount = this.game.getKnowledgeEntries().length;
    const campfireChecklist = [
      {
        done: !!campfireState?.shelterBuilt,
        text: "Поставлено первое жильё",
      },
      {
        done:
          campfireState &&
          campfireState.unlockedInsights >= campfireState.totalInsights,
        text: `Замечены свойства материалов (${campfireState?.unlockedInsights || 0}/${campfireState?.totalInsights || 0})`,
      },
      {
        done: !!campfireState?.hasTool,
        text: "Связано первое грубое орудие",
      },
      {
        done: !!campfireState?.built,
        text: "Разведён первый костёр",
      },
    ];

    container.innerHTML = `
      <div class="onboarding-step-content">
        <div class="onboarding-step-header">
          <h3>${this.data.prologue?.stepTitle || "Сейчас главное"}</h3>
          <button id="obSkipStepBtn" class="ob-btn ob-btn-skip-small">Пропустить пролог</button>
        </div>
        <div class="prologue-focus-layout">
          <div class="prologue-focus-main">
            <div class="prologue-focus-kicker">${this.data.prologue?.stepSubtitle || ""}</div>
            <div class="onboarding-step-text">${step.text}</div>
            <div class="onboarding-step-hint">💡 ${step.hint}</div>
            ${
              step.sceneText
                ? `<div class="prologue-scene-text">${step.sceneText}</div>`
                : ""
            }
            <div class="onboarding-step-bar">
              <div class="onboarding-step-bar-fill" style="width:${progressPct}%"></div>
            </div>
            <div class="prologue-step-meta">
              <span class="prologue-step-chip">Шаг ${currentIdx + 1}/${steps.length}</span>
              <span class="prologue-step-chip">Озарения ${insightsCount}/${this.game.getPrologueInsights().length}</span>
              <span class="prologue-step-chip">Книга ${knowledgeCount}</span>
            </div>
            <div class="prologue-step-actions">
              <button id="prologueInsightsBtn" class="prologue-link-btn" type="button">✨ Озарения</button>
              <button id="prologueBookBtn" class="prologue-link-btn" type="button">📚 Книга знаний</button>
            </div>
          </div>
          <aside class="prologue-focus-aside">
            <div class="prologue-focus-aside-title">${campfireState?.title || "Путь к костру"}</div>
            <div class="prologue-focus-aside-text">${campfireState?.text || ""}</div>
            <div class="prologue-fire-readiness">
              ${campfireChecklist
                .map(
                  (item) =>
                    `<div class="prologue-fire-item ${item.done ? "done" : ""}">${item.done ? "✓" : "•"} ${item.text}</div>`,
                )
                .join("")}
            </div>
          </aside>
        </div>
      </div>
    `;

    document.getElementById("obSkipStepBtn").addEventListener("click", () => {
      this.game.skipOnboarding();
      this.render({ forcePanels: true });
    });
    document
      .getElementById("prologueInsightsBtn")
      ?.addEventListener("click", () => {
        this.openResearchModal();
      });
    document
      .getElementById("prologueBookBtn")
      ?.addEventListener("click", () => {
        this.openKnowledgeModal();
      });
  }

  hideOnboarding() {
    const intro = document.getElementById("onboarding-intro-panel");
    const step = document.getElementById("onboarding-step-panel");
    if (intro) intro.style.display = "none";
    if (step) step.style.display = "none";
  }

  hideOnboardingIntro() {
    const intro = document.getElementById("onboarding-intro-panel");
    if (intro) intro.style.display = "none";
  }

  hideOnboardingStep() {
    const step = document.getElementById("onboarding-step-panel");
    if (step) step.style.display = "none";
  }

  renderCharacterPanel() {
    const container = document.getElementById("character-panel");
    if (!container) return;

    const state = this.game.getCharacterState();
    const energyPct = state.energy.pct * 100;
    const satietyPct = state.satiety.pct * 100;
    const regenSec = (state.regen.remainingMs / 1000).toFixed(1);
    const satietyRecovery = state.satiety.recoveryPerTick;
    const trip = state.tripProfile;
    const rest = state.restProfile;
    const tripKind =
      state.tripType === "build"
        ? "Стройка"
        : state.tripType === "trail"
          ? "Прокладка тропы"
          : state.tripType === "gather"
            ? "Выход за ресурсом"
            : "Текущий выход";
    const recoverySummary = state.recovery?.summary || "";
    const carryBonusText =
      state.carry.capacityBonus > 0
        ? ` (+${this.formatNumber(state.carry.capacityBonus)})`
        : "";
    const satietyMaxBonusText =
      state.satiety.maxBonus > 0
        ? ` (+${this.formatNumber(state.satiety.maxBonus, 0)})`
        : "";
    const knowledgeText = this.game.isPrologueActive()
      ? `✨ ${state.knowledge.insightsUnlocked} озар.`
      : `🔬 ${state.knowledge.techResearched} исслед.`;
    const rangeChipText =
      state.condition.maxSafeDistance >= 99
        ? "🗺 вся открытая карта"
        : state.condition.maxSafeDistance <= 1
          ? "🗺 только ближние клетки"
          : `🗺 до дистанции ${state.condition.maxSafeDistance}`;
    const enduranceValue =
      state.stats.safeDistance >= 99
        ? "вся открытая карта"
        : state.stats.safeDistance <= 1
          ? "только рядом"
          : `до ${state.stats.safeDistance} клеток`;
    const enduranceNote =
      state.stats.enduranceBonus > 0
        ? `+${state.stats.enduranceBonus} к безопасной дальности`
        : "дальность пока держится только на текущих силах";
    const fieldcraftValue =
      state.stats.fieldcraft > 0
        ? `снимает до ${state.stats.fieldcraft} штрафа пути`
        : "без облегчения пути";
    const fieldcraftNote =
      state.stats.fieldcraft > 0
        ? "хуже ощущаются тяжёлая местность и дальние выходы"
        : "дистанция и тяжёлая почва бьют в полную силу";
    const carryValue = `${this.formatNumber(state.carry.capacity)} ед.`;
    const carryNote =
      state.carry.capacityBonus > 0
        ? `лагерь и уклад дают +${this.formatNumber(state.carry.capacityBonus, 0)} к переноске`
        : "весь груз уносится на себе";
    const restValue =
      rest.energyGain > 0 || rest.satietyGain > 0
        ? `+${rest.energyGain} сил · +${this.formatNumber(rest.satietyGain, 1)} сытости`
        : "передышка не нужна";
    const restNote = rest.blockedReason
      ? `${rest.note} ${rest.blockedReason}`
      : rest.note;
    const restButtonLabel = rest.canRest
      ? rest.label
      : rest.remainingMs > 0
        ? `⌛ ${this.formatCooldownMs(rest.remainingMs)}`
        : "Сейчас не нужно";
    const recoverySourcesHtml =
      state.recovery?.sources?.length > 0
        ? `<span class="character-chip">🏕 ${recoverySummary}</span>`
        : `<span class="character-chip is-empty">🏕 нет опоры отдыха</span>`;

    const expanded = this.characterPanelExpanded;

    const compactRestHtml = !expanded
      ? rest.canRest
        ? `<button id="character-rest-compact-btn" class="character-rest-compact-btn" type="button">🛌 ${rest.label}</button>`
        : rest.remainingMs > 0
          ? `<span class="character-chip character-chip-cooldown">🛌 ⌛ ${this.formatCooldownMs(rest.remainingMs)}</span>`
          : ""
      : "";

    const compactTripHtml =
      !expanded && trip
        ? `<div class="character-trip-compact">
          <span class="character-trip-compact-kind">${tripKind}</span>
          <span>🗺 ${trip.zoneLabel}</span>
          ${Number.isFinite(trip.load) ? `<span>🎒 ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}</span>` : ""}
          ${trip.pathLabel ? `<span>${trip.pathIcon || "·"} ${trip.pathLabel}</span>` : ""}
          <span>⚡ -${trip.energyCost}</span>
          ${trip.blockedReason ? `<span class="character-trip-warning">${trip.blockedReason}</span>` : ""}
        </div>`
        : "";

    container.classList.remove("is-low", "is-critical");
    if (state.condition.id === "exhausted") {
      container.classList.add("is-critical");
    } else if (state.condition.id === "weakened") {
      container.classList.add("is-low");
    }

    const tripHtml = trip
      ? `
        <div class="character-trip">
          <div class="character-trip-label">${tripKind}</div>
          <div class="character-trip-meta">
            <span>🗺 ${trip.zoneLabel}</span>
            ${
              Number.isFinite(trip.load)
                ? `<span>🎒 ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}</span>`
                : ""
            }
            ${
              trip.deliveryTrips > 1
                ? `<span>📦 ${trip.deliveryTrips} ходки</span>`
                : ""
            }
            ${
              Number.isFinite(trip.totalLoad) && trip.deliveryTrips > 1
                ? `<span>Σ ${this.formatNumber(trip.totalLoad)}</span>`
                : ""
            }
            ${trip.pathLabel ? `<span>${trip.pathIcon || "·"} ${trip.pathLabel}</span>` : ""}
            ${trip.effortLabel ? `<span>${trip.effortLabel}</span>` : ""}
            <span>⚡ -${trip.energyCost}</span>
          </div>
          ${
            trip.blockedReason
              ? `<div class="character-trip-warning">${trip.blockedReason}</div>`
              : ""
          }
        </div>
      `
      : `
        <div class="character-trip">
          <div class="character-trip-label">Текущий выход</div>
          <div class="character-trip-empty">Выберите участок на карте, чтобы увидеть цену пути и нагрузку.</div>
        </div>
      `;

    const attributesHtml = `
      <div class="character-attribute-grid">
        <div class="character-attribute">
          <div class="character-attribute-label">Выносливость</div>
          <div class="character-attribute-value">${enduranceValue}</div>
          <div class="character-attribute-note">${enduranceNote}</div>
        </div>
        <div class="character-attribute">
          <div class="character-attribute-label">Сноровка</div>
          <div class="character-attribute-value">${fieldcraftValue}</div>
          <div class="character-attribute-note">${fieldcraftNote}</div>
        </div>
        <div class="character-attribute">
          <div class="character-attribute-label">Переноска</div>
          <div class="character-attribute-value">${carryValue}</div>
          <div class="character-attribute-note">${carryNote}</div>
        </div>
        <div class="character-attribute">
          <div class="character-attribute-label">Передышка</div>
          <div class="character-attribute-value">${restValue}</div>
          <div class="character-attribute-note">${rest.note}</div>
        </div>
      </div>
    `;

    const restHtml = `
      <div class="character-rest">
        <div class="character-rest-top">
          <div class="character-rest-body">
            <div class="character-rest-title">🛌 ${rest.label}</div>
            <div class="character-rest-meta">
              <span>⚡ +${rest.energyGain}</span>
              <span>🍖 +${this.formatNumber(rest.satietyGain, 1)}</span>
              <span>⏱ откат ${this.formatSeconds(rest.cooldownMs)}</span>
            </div>
            <div class="character-rest-note">${restNote}</div>
          </div>
          <button
            id="character-rest-btn"
            class="character-rest-btn${rest.canRest ? "" : " disabled"}"
            type="button"
            ${rest.canRest ? "" : "disabled"}
          >
            ${restButtonLabel}
          </button>
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="character-topline">
        <div class="character-identity">
          <span class="character-title">🧍 ${state.title}</span>
          <span class="character-condition is-${state.condition.id}">${state.condition.label}</span>
        </div>
        <div class="character-topline-right">
          <div class="character-mini-stack">
            <span class="character-carry">🎒 ${this.formatNumber(state.carry.capacity)} ед.${carryBonusText}</span>
            <span class="character-knowledge">${knowledgeText}</span>
          </div>
          <button id="character-toggle-btn" class="character-toggle-btn" type="button" aria-expanded="${expanded}" title="${expanded ? "Свернуть" : "Развернуть"}">
            ${expanded ? "▾" : "▸"}
          </button>
        </div>
      </div>
      <div class="character-hud-grid">
        <div class="character-meter">
          <div class="character-meter-top">
            <span>⚡ Силы</span>
            <span>${this.formatNumber(state.energy.current, 0)} / ${this.formatNumber(state.energy.max, 0)}</span>
          </div>
          <div class="energy-bar-container character-bar-container">
            <div class="energy-bar-fill character-bar-energy" style="width:${energyPct}%"></div>
          </div>
        </div>
        <div class="character-meter">
          <div class="character-meter-top">
            <span>🍖 Сытость</span>
            <span>${this.formatNumber(state.satiety.current, 1)} / ${this.formatNumber(state.satiety.max, 0)}${satietyMaxBonusText}</span>
          </div>
          <div class="energy-bar-container character-bar-container is-satiety">
            <div class="energy-bar-fill character-bar-satiety" style="width:${satietyPct}%"></div>
          </div>
        </div>
      </div>
      <div class="character-chip-row">
        <span class="character-chip">🔄 +${state.regen.perTick} через ${regenSec}с</span>
        <span class="character-chip">${satietyRecovery >= 0.1 ? `🍲 +${this.formatNumber(satietyRecovery, 2)} сытости/цикл` : "🍲 сытость почти не растёт"}</span>
        <span class="character-chip">${rangeChipText}</span>
        ${recoverySourcesHtml}
        ${compactRestHtml}
      </div>
      ${compactTripHtml}
      <div class="character-expandable${expanded ? "" : " is-collapsed"}">
        <div class="character-detail-grid">
          <div class="character-detail-main">
            ${attributesHtml}
            <div class="character-note">${state.condition.description}</div>
          </div>
          <div class="character-detail-side">
            ${restHtml}
            ${tripHtml}
          </div>
        </div>
      </div>
    `;

    const toggleBtn = container.querySelector("#character-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.characterPanelExpanded = !this.characterPanelExpanded;
        this.renderCharacterPanel();
      });
    }

    const compactRestBtn = container.querySelector(
      "#character-rest-compact-btn",
    );
    if (compactRestBtn) {
      compactRestBtn.addEventListener("click", () => {
        if (!this.game.restCharacter()) {
          this.render({ forcePanels: true });
          return;
        }
        this.scheduleRestCooldownRefresh(
          this.game.getCharacterRestCooldownMs(),
        );
        this.render({ forcePanels: true });
      });
    }

    const restBtn = container.querySelector("#character-rest-btn");
    if (restBtn) {
      restBtn.addEventListener("click", () => {
        if (!this.game.restCharacter()) {
          this.render({ forcePanels: true });
          return;
        }
        this.scheduleRestCooldownRefresh(
          this.game.getCharacterRestCooldownMs(),
        );
        this.render({ forcePanels: true });
      });
    }

    this.setTooltip(container, [
      `${state.title}: ${state.role}`,
      `Состояние: ${state.condition.label}`,
      `Силы: ${this.formatNumber(state.energy.current, 0)} / ${this.formatNumber(state.energy.max, 0)}`,
      `Сытость: ${this.formatNumber(state.satiety.current, 1)} / ${this.formatNumber(state.satiety.max, 0)}`,
      `Выносливость: ${enduranceValue}`,
      `Походная сноровка: ${fieldcraftValue}`,
      `Переносимость: до ${this.formatNumber(state.carry.capacity)} единиц нагрузки за выход`,
      `Передышка: ${restValue}`,
      `Восстановление сытости: +${this.formatNumber(satietyRecovery, 2)} за цикл`,
      `Опора лагеря: ${recoverySummary}`,
      state.restrictionText,
      trip
        ? `Текущий выход: ${trip.zoneLabel}, ${Number.isFinite(trip.load) ? `нагрузка ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}, ` : ""}энергия -${trip.energyCost}`
        : "Текущий выход: выберите участок на карте, чтобы оценить путь и нагрузку",
    ]);
  }

  renderResources() {
    const container = document.getElementById("resources-panel");
    if (!container) return;

    if (
      this.game.isPrologueActive() &&
      !this.game.getPrologueRevealState().showResources
    ) {
      container.innerHTML = "";
      this.lastResourcesRenderKey = "";
      return;
    }

    if (this.game.isPrologueActive()) {
      const visibleIds = this.game.getVisibleResourceIds();
      const renderKey = JSON.stringify({
        mode: "prologue",
        resources: Object.fromEntries(
          visibleIds.map((id) => [id, this.game.resources[id] || 0]),
        ),
      });
      if (renderKey === this.lastResourcesRenderKey) {
        return;
      }
      this.lastResourcesRenderKey = renderKey;

      container.innerHTML = "";
      const title = document.createElement("h3");
      title.textContent =
        this.data.prologue?.resourcesTitle || "🌿 Найденные материалы";
      container.appendChild(title);

      const hint = document.createElement("div");
      hint.className = "storage-summary";
      hint.textContent =
        this.data.prologue?.resourcesHint ||
        "Пока это не склад и не производство — только то, что удалось найти руками.";
      container.appendChild(hint);

      const categoryMeta = {
        raw: {
          label: "Ресурсы",
          description: "Сырьё, которое удалось найти и унести при себе.",
        },
        tools: {
          label: "Инструменты",
          description: "То, что уже собрано руками в полезный предмет.",
        },
        materials: {
          label: "Материалы",
          description: "Обработанные заготовки и части для следующих шагов.",
        },
        other: {
          label: "Другое",
          description: "Прочие находки и особые предметы раннего цикла.",
        },
      };

      const grouped = new Map();
      for (const id of visibleIds) {
        const resource = this.data.resources[id];
        if (!resource) continue;
        const groupKey = resource.storageCategory || "other";
        if (!grouped.has(groupKey)) grouped.set(groupKey, []);
        const resourceName =
          id === "wood"
            ? "Ветки"
            : id === "stone"
              ? "Камни"
              : id === "fiber"
                ? "Волокна"
                : id === "crude_tools"
                  ? "Грубое орудие"
                  : resource.name;
        const resourceDesc =
          id === "wood"
            ? "Сухие ветви, которые можно унести руками и пустить на первое орудие или костёр."
            : id === "stone"
              ? "Подобранные камни и сколы. Среди них встречаются острые края."
              : id === "fiber"
                ? "Трава и волокна, пригодные для простых связок."
                : id === "crude_tools"
                  ? "Первое связанное орудие, собранное из ветви, камня и волокна."
                  : resource.description;

        grouped.get(groupKey).push({
          resource,
          resourceName,
          resourceDesc,
          amount: this.game.resources[id] || 0,
          total: this.game.resourceTotals[id] || 0,
        });
      }

      const groups = document.createElement("div");
      groups.className = "storage-groups prologue-resource-groups";

      for (const [groupKey, items] of grouped) {
        const meta = categoryMeta[groupKey] || categoryMeta.other;
        const section = document.createElement("section");
        section.className = "storage-category prologue-resource-category";
        section.innerHTML = `
          <div class="storage-category-header">
            <div class="storage-category-title">${meta.label}</div>
            <div class="storage-category-meta">${items.length}</div>
          </div>
        `;
        this.setTooltip(section.querySelector(".storage-category-header"), [
          meta.label,
          meta.description || "Категория ресурсов",
          `Предметов в группе: ${items.length}`,
        ]);

        const list = document.createElement("div");
        list.className = "storage-resource-list";

        for (const itemData of items) {
          const { resource, resourceName, resourceDesc, amount, total } =
            itemData;

          const item = document.createElement("div");
          item.className = "resource-item prologue-resource-item";
          item.innerHTML = `
            <span class="resource-icon" style="color:${resource.color}">${this.getResourceDisplayIcon(resource.id)}</span>
            <div class="resource-text">
              <span class="resource-name">${resourceName}</span>
              <span class="prologue-resource-total">Найдено всего: ${total}</span>
            </div>
            <span class="resource-count">${amount}</span>
          `;
          this.setTooltip(item, [
            resourceName,
            resourceDesc || "Материал раннего пролога",
            `Сейчас при себе: ${amount}`,
            `Всего найдено: ${total}`,
            `Категория: ${meta.label}`,
          ]);
          list.appendChild(item);
        }

        section.appendChild(list);
        groups.appendChild(section);
      }

      container.appendChild(groups);
      return;
    }

    const storageStatus = this.game.getStorageStatus();
    const storageTotals = this.game.getStorageTotals();
    const storageGroups = this.game.getStorageCategoryBreakdown();
    const recentOverflow = this.game.getRecentOverflow();
    const bonus = this.game._getGatherBonus();
    const renderKey = JSON.stringify({
      cap: this.game.maxResourceCap,
      resources: this.game.resources,
      near: storageStatus.isNearFull,
      full: storageStatus.isFull,
      highest: storageStatus.highest.id,
      bonus,
      used: storageTotals.used,
      free: storageTotals.free,
      totalCap: storageTotals.capacity,
      overflow: recentOverflow
        ? `${recentOverflow.id}:${recentOverflow.lost}`
        : null,
    });
    if (renderKey === this.lastResourcesRenderKey) {
      return;
    }
    this.lastResourcesRenderKey = renderKey;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "📦 Склад и ресурсы";
    container.appendChild(title);

    const storageSummary = document.createElement("div");
    storageSummary.className = "storage-summary";
    storageSummary.textContent = `Занято: ${storageTotals.used} / ${storageTotals.capacity}`;
    this.setTooltip(storageSummary, [
      "Суммарная занятость склада по всем ресурсам",
      `Использовано: ${storageTotals.used} из ${storageTotals.capacity}`,
      `Свободно: ${storageTotals.free}`,
      `Лимит на один ресурс: ${this.game.maxResourceCap}`,
    ]);
    container.appendChild(storageSummary);

    const storageBar = document.createElement("div");
    storageBar.className = "storage-bar";
    storageBar.innerHTML = `
      <div class="storage-bar-fill" style="width:${Math.round(storageTotals.fillRatio * 100)}%"></div>
      <span class="storage-bar-text">${Math.round(storageTotals.fillRatio * 100)}%</span>
    `;
    if (storageTotals.fillRatio >= 0.9) {
      storageBar.classList.add("is-critical");
    } else if (storageTotals.fillRatio >= 0.7) {
      storageBar.classList.add("is-near");
    }
    this.setTooltip(storageBar, [
      "Индикатор общей заполненности склада",
      `Заполнено: ${storageTotals.used} из ${storageTotals.capacity}`,
      `Свободно: ${storageTotals.free}`,
    ]);
    container.appendChild(storageBar);

    if (recentOverflow) {
      const overflowNotice = document.createElement("div");
      overflowNotice.className = "storage-warning is-full";
      const resource = this.data.resources[recentOverflow.id];
      overflowNotice.textContent = `Переполнение: ${this.getResourceDisplayIcon(recentOverflow.id)} ${this.getResourceDisplayName(recentOverflow.id)} -${recentOverflow.lost}`;
      this.setTooltip(overflowNotice, [
        "Последнее переполнение склада",
        `${this.getResourceDisplayName(recentOverflow.id)}: потеряно ${recentOverflow.lost}`,
        `Лимит по ресурсу: ${this.game.maxResourceCap}`,
      ]);
      container.appendChild(overflowNotice);
    } else if (storageStatus.isFull || storageStatus.isNearFull) {
      const warning = document.createElement("div");
      warning.className = `storage-warning ${storageStatus.isFull ? "is-full" : "is-near"}`;
      const resourceName = storageStatus.highest.id
        ? this.data.resources[storageStatus.highest.id].name
        : "ресурсов";
      warning.textContent = storageStatus.isFull
        ? `Лимит достигнут: ${resourceName}`
        : `Склад почти полон: ${resourceName}`;
      this.setTooltip(warning, [
        "Склад ограничивает накопление каждого ресурса",
        `Текущий лимит: ${this.game.maxResourceCap}`,
        storageStatus.isFull
          ? "Лимит достигнут: излишки не добавляются"
          : "Почти полный склад: расходуйте ресурсы заранее",
      ]);
      container.appendChild(warning);
    }

    const groups = document.createElement("div");
    groups.className = "storage-groups";

    for (const group of storageGroups) {
      const section = document.createElement("section");
      section.className = "storage-category";
      section.innerHTML = `
        <div class="storage-category-header">
          <div class="storage-category-title">${group.label}</div>
          <div class="storage-category-meta">${group.usedSpace} места</div>
        </div>
      `;
      this.setTooltip(section, [
        group.label,
        group.description || "Категория ресурсов склада",
        `Занято в категории: ${group.usedSpace}`,
        `Доля общего склада: ${Math.round(group.contributionRatio * 100)}%`,
      ]);

      const list = document.createElement("div");
      list.className = "storage-resource-list";

      for (const item of group.items) {
        const row = document.createElement("div");
        row.className = "storage-resource-row";

        if (item.isNearFull) row.classList.add("is-near");
        if (item.isHigh) row.classList.add("is-high");
        if (item.isFull) row.classList.add("is-full");
        if (item.overflow) row.classList.add("is-overflowed");

        row.innerHTML = `
          <div class="storage-resource-main">
            <span class="resource-icon" style="color:${item.def.color}">${item.def.icon}</span>
            <div class="resource-text">
              <div class="storage-resource-top">
                <span class="resource-name">${item.def.name}</span>
                <span class="storage-resource-count">${item.amount}</span>
              </div>
              ${item.overflow ? `<div class="storage-overflow-badge">Переполнение -${item.overflow.lost}</div>` : ""}
            </div>
          </div>
          <div class="storage-resource-bar">
            <div class="storage-resource-bar-fill" style="width:${Math.round(item.fillRatio * 100)}%"></div>
          </div>
        `;

        this.setTooltip(row, [
          item.def.name,
          item.def.description || "Ресурс склада",
          `На складе: ${item.amount} / ${this.game.maxResourceCap}`,
          `Размер ресурса: x${item.storageSize}`,
          `Занимает места: ${item.usedSpace}`,
          `Доля общего склада: ${Math.round(item.contributionRatio * 100)}%`,
          item.overflow
            ? `Последнее переполнение: потеряно ${item.overflow.lost}`
            : item.isFull
              ? "Ресурс упёрся в лимит и лишнее не помещается"
              : "",
          bonus > 0 ? `Бонус ручного сбора сейчас: +${bonus}` : "",
        ]);

        list.appendChild(row);
      }

      section.appendChild(list);
      groups.appendChild(section);
    }

    container.appendChild(groups);
  }

  renderGather() {
    const container = document.getElementById("gather-panel");
    if (!container) return;

    // ── PROLOGUE: abstract hand-search buttons ──────────────────────────────
    if (this.game.isPrologueActive()) {
      this._renderGatherPrologue(container);
      return;
    }

    // ── POST-CAMP: navigation panel "Resources around camp" ─────────────────
    const mapState = this.game.getCampMapState();
    if (mapState.campSetupDone) {
      this._renderGatherPostCamp(container, mapState);
      return;
    }

    // ── PRE-CAMP (after prologue): gather materials for founding ────────────
    this._renderGatherPreCamp(container);
  }

  /** Prologue mode: classic action buttons for abstract hand-gathering. */
  _renderGatherPrologue(container) {
    container.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent =
      this.data.prologue?.actionsTitle || "🖐️ Первые действия";
    container.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      this.data.prologue?.actionsHint ||
      "Первые шаги — это не добыча, а поиск того, что можно подобрать, унести и использовать.";
    container.appendChild(hint);

    for (const id of this.game.getVisibleGatherActions()) {
      const action = this.data.gatherActions[id];
      if (!action) continue;
      if (action.mapOnly) continue; // tile-bound actions are used via the map, not the gather panel

      const copy = this.getGatherActionCopy(action);
      const profile = this.game.getGatherProfile(id);
      const cooldown = this.game.getCooldownRemaining(id);
      const effectiveEnergyCost = profile?.energyCost ?? action.energyCost;
      const disabled =
        cooldown > 0 || !this.game.hasEnergy(effectiveEnergyCost);
      const output = profile?.output || this.game.getGatherOutput(id);
      const outputStr = this.formatResourcePairs(output, { plus: true });
      const loadText = profile
        ? `🎒 ${this.formatNumber(profile.load)} / ${this.formatNumber(profile.carryCapacity)}`
        : "";
      const zoneText = profile?.tile ? `🗺 ${profile.zoneLabel}` : "";
      const terrainText = profile?.terrainLabel
        ? `🌍 ${profile.terrainLabel}`
        : "";

      const btn = document.createElement("button");
      btn.className = "action-btn action-btn--prologue";
      btn.type = "button";
      btn.innerHTML = `
        <span class="btn-icon">${copy.icon}</span>
        <span class="btn-label">${copy.name}</span>
        ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
        <div class="btn-meta-inline">
          <span class="btn-output">Находка: ${outputStr}</span>
          <span class="btn-cost">⚡ -${effectiveEnergyCost}</span>
          ${loadText ? `<span class="btn-cost">${loadText}</span>` : ""}
        </div>
        ${zoneText || terrainText ? `<span class="btn-efficiency">${[zoneText, terrainText].filter(Boolean).join(" · ")}</span>` : ""}
        ${profile?.blockedReason ? `<span class="btn-cooldown">🧍 ${profile.blockedReason}</span>` : ""}
        ${profile?.limitedByCarry ? '<span class="btn-cooldown">🎒 Переносимость ограничивает вынос</span>' : ""}
        ${cooldown > 0 ? `<span class="btn-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
        ${!this.game.hasEnergy(effectiveEnergyCost) && cooldown === 0 ? '<span class="btn-cooldown">⚡ Нет сил</span>' : ""}
      `;
      btn.classList.toggle("cooldown", disabled);
      btn.classList.toggle("busy", cooldown > 0);
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
      this.setTooltip(btn, [
        copy.name,
        copy.description,
        `Выход: ${outputStr}`,
        `Энергия: -${effectiveEnergyCost}`,
        profile
          ? `Нагрузка: ${this.formatNumber(profile.load)} / ${this.formatNumber(profile.carryCapacity)}`
          : "",
        profile?.terrainLabel ? `Местность: ${profile.terrainLabel}` : "",
        profile?.blockedReason || "",
      ]);
      btn.addEventListener("click", () => {
        this.game.gather(id);
        this.render({ forcePanels: true });
      });
      container.appendChild(btn);
    }
  }

  /**
   * Pre-camp mode (after prologue, before camp founded).
   * Shows the same 3 gather action buttons as prologue, but contextualised
   * as "preparing materials for camp founding". Includes a resource-progress
   * bar so the player immediately understands how much more they need.
   */
  _renderGatherPreCamp(container) {
    container.innerHTML = "";

    const intro = this.data.campFoundingIntro || {};
    const cost = this.game.getCampFoundingCost();
    const check = this.game.canFoundCamp();
    const progressItems = this.getCampFoundingProgressItems(cost);
    const starterCache = this.game
      .getCampMapState()
      .tiles.find(
        (tile) =>
          tile.id === "starter_cache" &&
          tile.state !== "hidden" &&
          !tile.isDepleted,
      );

    // ── Header ──
    const title = document.createElement("h3");
    title.textContent = "🪓 Подготовка к основанию";
    container.appendChild(title);

    // ── Resource progress strip ──
    const progress = document.createElement("div");
    progress.className = "gather-precamp-progress";
    progress.innerHTML = progressItems
      .map(
        (item) => `
          <div class="gather-precamp-res${item.done ? " is-done" : ""}">
            <div class="gather-precamp-res-head">
              <span>${item.icon} ${item.name}</span>
              <strong>${item.have}/${item.needed}</strong>
            </div>
            <div class="gather-precamp-res-meta">
              ${item.done ? "Готово" : `Осталось собрать: ${item.missing}`}
            </div>
          </div>
        `,
      )
      .join("");
    container.appendChild(progress);

    if (check.ok) {
      const readyNote = document.createElement("p");
      readyNote.className = "gather-precamp-ready";
      readyNote.textContent =
        intro.questReadyText ||
        "Материалы собраны — выберите место на карте и основайте лагерь.";
      container.appendChild(readyNote);
    } else {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        "Сверху видно, сколько уже собрано и сколько ещё нужно. Добирайте материалы вручную кнопками ниже или заберите быстрый стартовый запас на карте.";
      container.appendChild(hint);

      if (starterCache) {
        const mapNote = document.createElement("div");
        mapNote.className = "gather-precamp-map-note";
        const starterProfile = this.game.getGatherProfile("gather_supplies", {
          tileId: starterCache.id,
        });
        mapNote.textContent = `${starterCache.icon} ${starterCache.name}: на карте рядом лежит стартовый набор ресурсов для основания лагеря.${starterProfile ? ` Один поднос даёт ${this.formatResourcePairs(starterProfile.output, { plus: true })}${starterProfile.deliveryTrips > 1 ? ` и потребует ${starterProfile.deliveryTrips} ходки` : ""}.` : ""}`;
        container.appendChild(mapNote);
      }
    }

    // ── Gather buttons — gather_wood / gather_stone / gather_fiber ──
    const gatherIds = this.data.prologue?.gatherActionIds || [
      "gather_wood",
      "gather_stone",
      "gather_fiber",
    ];

    for (const id of gatherIds) {
      const action = this.data.gatherActions[id];
      if (!action) continue;
      if (action.mapOnly) continue;

      const copy = this.getGatherActionCopy(action);
      const profile = this.game.getGatherProfile(id);
      const cooldown = this.game.getCooldownRemaining(id);
      const effectiveEnergyCost = profile?.energyCost ?? action.energyCost;
      const disabled =
        cooldown > 0 || !this.game.hasEnergy(effectiveEnergyCost);
      const output = profile?.output || this.game.getGatherOutput(id);
      const outputStr = this.formatResourcePairs(output, { plus: true });

      // Highlight if this resource is still needed
      const mainResId = Object.keys(output || {})[0];
      const stillNeeded =
        mainResId &&
        cost[mainResId] &&
        (this.game.resources[mainResId] || 0) < cost[mainResId];

      const btn = document.createElement("button");
      btn.className = "action-btn action-btn--prologue";
      if (stillNeeded) btn.classList.add("action-btn--needed");
      btn.type = "button";
      btn.innerHTML = `
        <span class="btn-icon">${copy.icon}</span>
        <span class="btn-label">${copy.name}</span>
        ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
        <div class="btn-meta-inline">
          <span class="btn-output">Находка: ${outputStr}</span>
          <span class="btn-cost">⚡ -${effectiveEnergyCost}</span>
        </div>
        ${cooldown > 0 ? `<span class="btn-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
        ${!this.game.hasEnergy(effectiveEnergyCost) && cooldown === 0 ? '<span class="btn-cooldown">⚡ Нет сил</span>' : ""}
      `;
      btn.classList.toggle("cooldown", disabled);
      btn.classList.toggle("busy", cooldown > 0);
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
      btn.addEventListener("click", () => {
        this.game.gather(id);
        this.render({ forcePanels: true });
      });
      container.appendChild(btn);
    }
  }

  /**
   * Post-camp mode: logistics overview panel.
   * Shows resource tiles grouped by type, with distance / path / stock info.
   * Clicking a row selects the tile on the map (no direct gather call here).
   */
  _renderGatherPostCamp(container, mapState) {
    container.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = "📍 Ресурсы вокруг лагеря";
    container.appendChild(title);

    // Collect all tiles that have a gather action and are not hidden
    const resourceTiles = mapState.tiles.filter(
      (t) =>
        t.actionId &&
        t.state !== "hidden" &&
        t.state !== "silhouette" &&
        t.state !== "camp_candidate",
    );

    if (resourceTiles.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Поблизости пока не видно участков с ресурсами.";
      container.appendChild(empty);
      return;
    }

    // Group by resourceType (or actionId as fallback)
    const groups = new Map();
    for (const tile of resourceTiles) {
      const key = tile.resourceType || tile.actionId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tile);
    }

    const selectedTileId = this.game.getSelectedCampTileId();

    for (const [groupKey, tiles] of groups) {
      // Group header: use first tile's action icon + name
      const firstAction = this.data.gatherActions[tiles[0].actionId];
      if (!firstAction) continue;
      const actionCopy = this.getGatherActionCopy(firstAction);

      const groupEl = document.createElement("div");
      groupEl.className = "gather-resource-group";

      const groupHeader = document.createElement("div");
      groupHeader.className = "gather-resource-group-header";
      groupHeader.textContent = `${actionCopy.icon} ${actionCopy.name}`;
      groupEl.appendChild(groupHeader);

      for (const tile of tiles) {
        const action = this.data.gatherActions[tile.actionId];
        if (!action) continue;
        const profile = this.game.getGatherProfile(action.id, {
          tileId: tile.id,
        });
        const cooldown = this.game.getCooldownRemaining(action.id);
        const canGather =
          !!profile &&
          !profile.blockedReason &&
          cooldown === 0 &&
          this.game.hasEnergy(profile.energyCost ?? action.energyCost);

        const dist = tile.distanceFromCamp ?? 0;
        const isFar = dist > 1;
        const hasPath = tile.pathLevel && tile.pathLevel !== "none";
        const noPath = dist > 0 && !hasPath;

        const row = document.createElement("div");
        row.className = "gather-resource-row";
        if (tile.isDepleted) row.classList.add("is-depleted");
        if (isFar) row.classList.add("is-far");
        if (noPath) row.classList.add("no-path");
        if (tile.id === selectedTileId) row.classList.add("is-selected");

        // Zone label
        const zoneLabel =
          dist === 0
            ? "центр"
            : dist === 1
              ? "ближняя зона"
              : `дальний выход (${dist})`;

        // Path indicator
        const pathIcon = hasPath
          ? tile.pathData?.icon || "🥾"
          : noPath && dist > 0
            ? "·"
            : "";
        const pathLabel = hasPath
          ? tile.pathData?.label || "Тропа"
          : noPath
            ? "нет тропы"
            : "";

        // Stock display
        const stockStr =
          Number.isFinite(tile.resourceRemaining) &&
          Number.isFinite(tile.resourceCapacity)
            ? `${tile.resourceRemaining}/${tile.resourceCapacity}`
            : "";

        // Energy cost
        const energyCost = profile?.energyCost ?? action.energyCost;

        row.innerHTML = `
          <div class="grr-left">
            <span class="grr-icon">${tile.icon || actionCopy.icon}</span>
            <div class="grr-info">
              <span class="grr-name">${tile.name}</span>
              <span class="grr-meta">
                🗺 ${zoneLabel}
                ${pathIcon ? ` · ${pathIcon} ${pathLabel}` : ""}
                ${stockStr ? ` · 📦 ${stockStr}` : ""}
              </span>
              ${profile?.blockedReason ? `<span class="grr-blocked">${profile.blockedReason}</span>` : ""}
              ${tile.isDepleted ? '<span class="grr-blocked">Участок исчерпан</span>' : ""}
              ${noPath && dist > 1 ? '<span class="grr-warn">Тяжёлый путь</span>' : ""}
            </div>
          </div>
          <div class="grr-right">
            <span class="grr-energy">⚡ ${energyCost}</span>
            ${cooldown > 0 ? `<span class="grr-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
          </div>
        `;

        this.setTooltip(row, [
          tile.name,
          tile.description || "",
          `Зона: ${zoneLabel}`,
          pathLabel ? `Путь: ${pathIcon} ${pathLabel}` : "Путь: не проложен",
          stockStr ? `Запас участка: ${stockStr}` : "",
          `Энергия: -${energyCost}`,
          profile
            ? `Нагрузка: ${this.formatNumber(profile.load)} / ${this.formatNumber(profile.carryCapacity)}`
            : "",
          profile?.terrainLabel ? `Местность: ${profile.terrainLabel}` : "",
          tile.isDepleted ? "Участок исчерпан — ресурсов не осталось" : "",
          "Нажмите, чтобы выбрать участок на карте",
        ]);

        row.addEventListener("click", () => {
          this.game.selectCampTile(tile.id);
          // Scroll the map into view
          document.getElementById("camp-map-panel")?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
          this.render({ forcePanels: true });
        });

        groupEl.appendChild(row);
      }

      container.appendChild(groupEl);
    }

    // Hint at the bottom
    const hint = document.createElement("p");
    hint.className = "hint gather-map-hint";
    hint.textContent =
      "Выберите участок, чтобы собрать ресурс через карту лагеря.";
    container.appendChild(hint);
  }

  renderCrafting() {
    const container = document.getElementById("craft-panel");
    if (!container) return;

    if (
      this.game.isPrologueActive() &&
      !this.game.getPrologueRevealState().showCraft
    ) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = this.game.isPrologueActive()
      ? "🪢 Первые предметы"
      : "⚒️ Крафт";
    container.appendChild(title);

    if (this.game.isPrologueActive()) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        "Пока ещё нет мастерской и ремесла. Есть только одна полезная связка, которая помогает перейти от голых рук к первому орудию.";
      container.appendChild(hint);
    }

    const queueState = this.game.getCraftQueueState();
    const queueCard = document.createElement("div");
    queueCard.className = "craft-queue-card";
    queueCard.innerHTML = `
      <div class="craft-queue-header">
        <span class="craft-queue-title">${this.game.isPrologueActive() ? "Текущее занятие" : "Очередь производства"}</span>
        <span class="craft-queue-capacity">${queueState.items.length} / ${queueState.capacity}</span>
      </div>
      <div class="craft-queue-slots">
        ${Array.from({ length: queueState.capacity }, (_, index) => {
          const item = queueState.items[index];
          if (!item) {
            return `<div class="craft-queue-slot is-empty has-tooltip" data-tooltip="Свободный слот&#10;Добавьте рецепт, чтобы запланировать следующий шаг">Пусто</div>`;
          }

          const stateLabel = item.isActive
            ? `В работе · ${this.formatSeconds(item.remainingMs)}`
            : "Ожидает";

          return `
            <div class="craft-queue-slot ${item.isActive ? "is-active" : "is-waiting"} has-tooltip" data-tooltip="${this.formatTooltipText(
              [
                item.name,
                item.isActive
                  ? "Статус: выполняется сейчас"
                  : "Статус: ожидает в очереди",
                `Осталось: ${this.formatSeconds(item.remainingMs)}`,
              ],
            )}">
              <div class="craft-queue-slot-top">
                <span class="craft-queue-icon">${item.icon}</span>
                <span class="craft-queue-name">${item.name}</span>
              </div>
              <div class="craft-queue-state">${stateLabel}</div>
              <div class="craft-queue-progress">
                <div class="craft-queue-progress-fill" style="width:${item.isActive ? item.progress * 100 : 0}%"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
    if (!this.game.isPrologueActive() || queueState.items.length > 0) {
      this.setTooltip(queueCard, [
        "Очередь крафта: задания выполняются автоматически по порядку",
        `Слотов занято: ${queueState.items.length} / ${queueState.capacity}`,
        "В работе: текущий слот, Ожидает: ждёт своей очереди",
      ]);
      container.appendChild(queueCard);
    }

    for (const id of this.game.getVisibleRecipeIds()) {
      const recipe = this.data.recipes[id];
      if (!recipe) continue;

      const copy = this.getRecipeCopy(recipe);
      const unlocked =
        this.game.unlockedRecipes.has(id) &&
        (!recipe.unlockedBy || this.game.researched[recipe.unlockedBy]);
      const meetsReqs =
        !recipe.requires || this.game.buildings[recipe.requires];
      const canQueue = this.game.canQueueCraft(id);
      const effectiveCost = this.game.getRecipeCost(id);
      const missingInsights = (recipe.requiresInsights || []).filter(
        (insightId) => !this.game.insights[insightId],
      );

      const el = document.createElement("div");
      el.className = "recipe-card";

      if (!unlocked || !meetsReqs || missingInsights.length > 0) {
        el.classList.add("locked");
        const reqName =
          missingInsights.length > 0
            ? missingInsights
                .map(
                  (insightId) =>
                    this.data.prologue?.insights?.[insightId]?.name ||
                    insightId,
                )
                .join(" · ")
            : !unlocked && recipe.unlockedBy
              ? this.data.tech[recipe.unlockedBy]?.name || recipe.unlockedBy
              : recipe.requires
                ? this.data.buildings[recipe.requires]?.name || recipe.requires
                : null;
        const reqType =
          missingInsights.length > 0
            ? "Озарения"
            : !unlocked && recipe.unlockedBy
              ? "Исследование"
              : "Требуется";
        el.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-label">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          ${reqName ? `<span class="btn-cooldown">${reqType}: ${reqName}</span>` : ""}
        `;
        container.appendChild(el);
        continue;
      }

      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.type = "button";
      this.setButtonAvailability(btn, canQueue);

      const costStr = this.formatResourcePairs(effectiveCost);
      const outStr = this.formatResourcePairs(recipe.output, { plus: true });
      let queueStateText = `⏱ ${this.formatSeconds(recipe.craftTimeMs || 3000)}`;

      if (this.game.craftQueue.length >= this.game.maxCraftQueueSize) {
        queueStateText = "Очередь заполнена";
      } else if (!this.game.hasResources(effectiveCost)) {
        queueStateText = "Не хватает ресурсов";
      }

      btn.innerHTML = `
        <span class="btn-icon">${copy.icon}</span>
        <span class="btn-label">${copy.name}</span>
        <span class="btn-flow">${costStr} → ${outStr}</span>
        ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
        <span class="btn-efficiency">Время производства: ${this.formatSeconds(recipe.craftTimeMs || 3000)}</span>
        <span class="btn-queue-status">${queueStateText}</span>
      `;
      this.setTooltip(btn, [
        copy.name,
        copy.description || "Производственный рецепт",
        "Добавляет задачу в очередь крафта",
      ]);

      btn.addEventListener("click", () => {
        if (!this.game.queueCraft(id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });

      el.appendChild(btn);
      container.appendChild(el);
    }
  }

  createTimedStatusCard({
    title,
    icon,
    name,
    remainingMs,
    progress,
    note,
    variant,
  }) {
    const card = document.createElement("div");
    card.className = `project-status-card${variant ? ` is-${variant}` : ""}`;
    card.innerHTML = `
      <div class="project-status-top">
        <span class="project-status-title">${title}</span>
        <span class="project-status-remaining">${this.formatSeconds(remainingMs)}</span>
      </div>
      <div class="project-status-name">${icon} ${name}</div>
      ${note ? `<div class="project-status-note">${note}</div>` : ""}
      <div class="project-status-bar">
        <div class="project-status-bar-fill" style="width:${progress * 100}%"></div>
      </div>
    `;
    return card;
  }

  renderBuildingsPanel() {
    const container = document.getElementById("buildings-panel");
    if (!container) return;

    if (
      this.game.isPrologueActive() &&
      !this.game.getPrologueRevealState().showBuildings
    ) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = this.game.isPrologueActive()
      ? "🏕️ Ранние постройки"
      : "🏗️ Здания";
    container.appendChild(title);

    if (this.game.isPrologueActive()) {
      const campfireState = this.game.getPrologueCampfireState();
      if (campfireState) {
        const hint = document.createElement("div");
        hint.className = "prologue-campfire-banner";
        hint.innerHTML = `
          <div class="prologue-campfire-title">${campfireState.title}</div>
          <div class="prologue-campfire-text">${campfireState.text}</div>
        `;
        container.appendChild(hint);
      }
    }

    const construction = this.game.getConstructionState();
    if (construction) {
      const card = this.createTimedStatusCard({
        title: "Активное строительство",
        icon: construction.icon,
        name: construction.name,
        remainingMs: construction.remainingMs,
        progress: construction.progress,
        note: "Эффект здания включится после завершения строительства.",
        variant: "construction",
      });
      this.setTooltip(card, [
        `${construction.name}: строительство в процессе`,
        `Осталось: ${this.formatSeconds(construction.remainingMs)}`,
        "После завершения постройка начнёт работать постоянно.",
      ]);
      container.appendChild(card);
    }

    for (const id of this.game.getVisibleBuildingIds()) {
      const building = this.data.buildings[id];
      if (!building) continue;

      const copy = this.getBuildingCopy(building);
      const buildProfile = this.game.getBuildProfile(id);
      const alreadyBuilt = this.game.buildings[id];
      const canDo = this.game.canBuild(id);
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
      const isConstructingThis = construction?.buildingId === id;

      const el = document.createElement("div");
      el.className = "building-card";

      if (isConstructingThis) {
        el.classList.add("in-progress");
        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          <span class="building-status is-pending">⏳ Строится — ${this.formatSeconds(construction.remainingMs)}</span>
          <div class="project-mini-bar">
            <div class="project-mini-bar-fill" style="width:${construction.progress * 100}%"></div>
          </div>
        `;
      } else if (alreadyBuilt) {
        el.classList.add("built");
        let extraInfo = `<span class="building-status">✅ Построено</span>`;

        if (this.game.isPrologueActive() && id === "campfire") {
          extraInfo += `<span class="btn-desc">Огонь стал первой точкой, вокруг которой начинает складываться более устойчивый уклад.</span>`;
        }

        if (building.effect.automation) {
          const auto = building.effect.automation;
          const autoId = auto.id;
          const state = this.game.getAutomationState(autoId);
          const remaining = this.game.getAutomationRemaining(autoId);
          const inputStr = this.formatResourcePairs(auto.input);
          const outputStr = this.formatResourcePairs(auto.output, {
            plus: true,
          });
          const efficiency = this.game.getAutomationEfficiency(autoId);
          const perSecond = efficiency
            ? this.formatResourcePairs(efficiency.outputPerSecond, {
                decimals: 1,
              })
            : "";

          let stateLabel = "";
          let stateClass = "";
          if (state === "running") {
            stateLabel = `⏳ ${remaining.toFixed(1)}с до результата`;
            stateClass = "state-running";
          } else if (state === "waiting") {
            stateLabel = `⚠️ Нет входа: ${inputStr}`;
            stateClass = "state-waiting";
          }

          extraInfo += `
            <div class="automation-inline">
              <span class="automation-flow">${inputStr} → ${outputStr}</span>
              <span class="automation-efficiency">${outputStr} / ${efficiency.cycleSeconds.toFixed(0)}с = ${perSecond} / с</span>
              <span class="automation-state ${stateClass}">${stateLabel}</span>
            </div>
          `;
        }

        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          ${extraInfo}
        `;
      } else if (
        !unlockedByTech ||
        !requiredBuildingReady ||
        missingInsights.length > 0 ||
        missingPrologueTool
      ) {
        const lockedByName =
          missingInsights.length > 0
            ? missingInsights
                .map(
                  (insightId) =>
                    this.data.prologue?.insights?.[insightId]?.name ||
                    insightId,
                )
                .join(" · ")
            : missingPrologueTool
              ? "Грубое орудие"
              : !unlockedByTech
                ? this.data.tech[building.unlockedBy]?.name ||
                  building.unlockedBy
                : this.data.buildings[building.requires]?.name ||
                  building.requires;
        const lockedByType =
          missingInsights.length > 0
            ? "озарения"
            : missingPrologueTool
              ? "предмет"
              : !unlockedByTech
                ? "исследование"
                : "здание";

        el.classList.add("locked");
        el.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-label">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          <span class="btn-cooldown">Требуется: ${lockedByType} «${lockedByName}»</span>
        `;
      } else {
        const costStr = this.formatResourcePairs(this.game.getBuildingCost(id));
        const buildTime = this.formatSeconds(this.game.getBuildDuration(id));
        const buildEnergy = buildProfile?.energyCost ?? 1;
        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        this.setButtonAvailability(btn, canDo);

        let unlocksInfo = "";
        if (building.effect.unlocks && building.effect.unlocks.length > 0) {
          const recipeNames = building.effect.unlocks
            .map((rid) => this.data.recipes[rid]?.name || rid)
            .join(", ");
          unlocksInfo = `<span class="btn-desc">📖 Открывает: ${recipeNames}</span>`;
        }

        let buildStatus = `Строительство: ${buildTime}`;
        if (construction) {
          buildStatus = `Занято: ${construction.icon} ${construction.name}`;
        } else if (
          this.game.isPrologueActive() &&
          id === "rest_tent" &&
          canDo
        ) {
          buildStatus = "Можно поставить первое жильё";
        } else if (this.game.isPrologueActive() && id === "campfire" && canDo) {
          buildStatus = "Можно сложить первый очаг";
        } else if (!this.game.hasResources(this.game.getBuildingCost(id))) {
          buildStatus = "Не хватает ресурсов";
        } else if (buildProfile?.blockedReason) {
          buildStatus = buildProfile.blockedReason;
        } else if (!this.game.hasEnergy(buildEnergy)) {
          buildStatus = "Не хватает сил на перенос и стройку";
        }

        btn.innerHTML = `
          <span class="btn-icon">${building.icon}</span>
          <span class="btn-label">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          ${unlocksInfo}
          <span class="btn-cost">Стоимость: ${costStr}</span>
          <span class="btn-efficiency">Время строительства: ${buildTime} · ⚡ -${buildEnergy} · ${buildProfile?.zoneLabel || "у стоянки"}</span>
          <span class="btn-queue-status">${buildStatus}</span>
        `;
        this.setTooltip(btn, [
          copy.name,
          copy.description || "Ранняя постройка",
          `Энергия на начало стройки: -${buildEnergy}`,
          buildProfile?.tile ? `Участок: ${buildProfile.tile.name}` : "",
          buildProfile?.terrainLabel
            ? `Местность: ${buildProfile.terrainLabel}`
            : "",
          buildProfile?.blockedReason || "",
          ...(buildProfile?.warnings || []),
          building.effect.automation
            ? "После завершения откроет автоматический цикл"
            : "После завершения даст постоянный эффект",
        ]);

        btn.addEventListener("click", () => {
          if (!this.game.build(id)) {
            this.render({ forcePanels: true });
            return;
          }
          this.render({ forcePanels: true });
        });

        el.appendChild(btn);
      }

      this.setTooltip(el, [copy.name, copy.description || "Ранняя постройка"]);
      container.appendChild(el);
    }
  }

  renderAutomationPanel() {
    if (this.game.isPrologueActive()) {
      const container = document.getElementById("automation-panel");
      if (!container) return;

      container.innerHTML = "";
      return;
    }

    this.renderAutomation();
  }

  renderBuildings() {
    const container = document.getElementById("buildings-panel");
    if (!container) return;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "🏗️ Здания";
    container.appendChild(title);

    const construction = this.game.getConstructionState();
    if (construction) {
      const card = this.createTimedStatusCard({
        title: "Активное строительство",
        icon: construction.icon,
        name: construction.name,
        remainingMs: construction.remainingMs,
        progress: construction.progress,
        note: "Эффект здания включится после завершения строительства.",
        variant: "construction",
      });
      this.setTooltip(card, [
        `${construction.name}: строительство в процессе`,
        `Осталось: ${this.formatSeconds(construction.remainingMs)}`,
        "После завершения здание станет доступно как постоянный узел поселения.",
      ]);
      container.appendChild(card);
    }

    for (const [id, building] of Object.entries(this.data.buildings)) {
      const alreadyBuilt = this.game.buildings[id];
      const canDo = this.game.canBuild(id);
      const unlockedByTech =
        !building.unlockedBy || this.game.researched[building.unlockedBy];
      const requiredBuildingReady =
        !building.requires || this.game.buildings[building.requires];
      const isConstructingThis = construction?.buildingId === id;

      const el = document.createElement("div");
      el.className = "building-card";

      let automationInfo = "";
      if (building.effect.automation) {
        const auto = building.effect.automation;
        const efficiency = this.game.getAutomationEfficiency(auto.id);
        const cycleOutput = this.formatResourcePairs(auto.output, {
          plus: true,
        });
      } else if (isConstructingThis) {
        el.classList.add("in-progress");
        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${building.name}</span>
          ${building.description ? `<span class="btn-desc">${building.description}</span>` : ""}
          <span class="building-status is-pending">⏳ Строится — ${this.formatSeconds(construction.remainingMs)}</span>
          <div class="project-mini-bar">
            <div class="project-mini-bar-fill" style="width:${construction.progress * 100}%"></div>
          </div>
        `;
        this.setTooltip(el, [
          `${building.name}: строительство начато`,
          `Осталось: ${this.formatSeconds(construction.remainingMs)}`,
          "После завершения появится в постоянных постройках.",
        ]);
      }

      if (alreadyBuilt) {
        el.classList.add("built");
        let extraInfo = `<span class="building-status">✅ Построено</span>`;

        if (building.effect.automation) {
          const auto = building.effect.automation;
          const autoId = auto.id;
          const state = this.game.getAutomationState(autoId);
          const remaining = this.game.getAutomationRemaining(autoId);
          const inputStr = this.formatResourcePairs(auto.input);
          const outputStr = this.formatResourcePairs(auto.output, {
            plus: true,
          });
          const efficiency = this.game.getAutomationEfficiency(autoId);
          const perSecond = efficiency
            ? this.formatResourcePairs(efficiency.outputPerSecond, {
                decimals: 1,
              })
            : "";

          let stateLabel = "";
          let stateClass = "";
          if (state === "running") {
            stateLabel = `⏳ ${remaining.toFixed(1)}с до результата`;
            stateClass = "state-running";
          } else if (state === "waiting") {
            stateLabel = `⚠️ Нет входа: ${inputStr}`;
            stateClass = "state-waiting";
          }

          extraInfo += `
            <div class="automation-inline">
              <span class="automation-flow">${inputStr} → ${outputStr}</span>
              <span class="automation-efficiency">${outputStr} / ${efficiency.cycleSeconds.toFixed(0)}с = ${perSecond} / с</span>
              <span class="automation-state ${stateClass}">${stateLabel}</span>
            </div>
          `;
        }

        el.innerHTML = `
          <span class="building-icon">${building.icon}</span>
          <span class="building-name">${building.name}</span>
          ${building.description ? `<span class="btn-desc">${building.description}</span>` : ""}
          ${extraInfo}
        `;
        this.setTooltip(el, [
          building.name,
          building.description || "Уже построено",
          building.effect.automation
            ? "Автоматизирует производство по циклу"
            : "Даёт постоянный бонус для развития",
        ]);
      } else if (!unlockedByTech || !requiredBuildingReady) {
        el.classList.add("locked");
        const lockedByName = !unlockedByTech
          ? this.data.tech[building.unlockedBy]?.name || building.unlockedBy
          : this.data.buildings[building.requires]?.name || building.requires;
        const lockedByType = !unlockedByTech ? "исследование" : "здание";
        el.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-label">${building.name}</span>
          ${building.description ? `<span class="btn-desc">${building.description}</span>` : ""}
          <span class="btn-cooldown">Требуется: ${lockedByType} «${lockedByName}»</span>
        `;
        this.setTooltip(el, [
          building.name,
          building.description || "Пока недоступно",
          `Откроется через: ${lockedByType} «${lockedByName}»`,
        ]);
      } else {
        const costStr = this.formatResourcePairs(building.cost);
        const buildTime = this.formatSeconds(this.game.getBuildDuration(id));
        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        this.setButtonAvailability(btn, canDo);

        let unlocksInfo = "";
        if (building.effect.unlocks && building.effect.unlocks.length > 0) {
          const recipeNames = building.effect.unlocks
            .map((rid) => this.data.recipes[rid]?.name || rid)
            .join(", ");
          unlocksInfo = `<span class="btn-desc">🔓 Открывает: ${recipeNames}</span>`;
        }
        if (building.effect.automation) {
          unlocksInfo = automationInfo;
        }

        let buildStatus = `Строительство: ${buildTime}`;
        if (construction) {
          buildStatus = `Занято: ${construction.icon} ${construction.name}`;
        } else if (!this.game.hasResources(building.cost)) {
          buildStatus = "Не хватает ресурсов";
        }

        btn.innerHTML = `
          <span class="btn-icon">${building.icon}</span>
          <span class="btn-label">${building.name}</span>
          <span class="btn-desc">${building.description}</span>
          ${unlocksInfo}
          <span class="btn-cost">Стоимость: ${costStr}</span>
                  <span class="btn-efficiency">Время строительства: ${buildTime}</span>
                  <span class="btn-queue-status">${buildStatus}</span>
        `;
        this.setTooltip(btn, [
          building.name,
          building.description || "Раннее здание",
          building.effect.automation
            ? "Запускает строительство; после завершения включит автоматический цикл"
            : "Запускает строительство; эффект появится после завершения",
        ]);

        btn.addEventListener("click", () => {
          if (!this.game.build(id)) {
            this.render({ forcePanels: true });
            return;
          }
          this.render({ forcePanels: true });
        });

        el.appendChild(btn);
      }

      container.appendChild(el);
    }
  }

  renderAutomation() {
    const container = document.getElementById("automation-panel");
    if (!container) return;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "⚙️ Автоматизация";
    container.appendChild(title);

    let anyActive = false;
    for (const [buildingId] of Object.entries(this.game.buildings)) {
      const building = this.data.buildings[buildingId];
      if (!building || !building.effect.automation) continue;

      anyActive = true;
      const buildingData = this.game.buildings[buildingId];
      const auto = building.effect.automation;
      const autoId = auto.id;
      let state = this.game.getAutomationState(autoId);
      if (!buildingData.isAutomationRunning) {
        state = "idle";
      }
      const progress = this.game.getAutomationProgress(autoId);
      const remaining = this.game.getAutomationRemaining(autoId);
      const efficiency = this.game.getAutomationEfficiency(autoId);
      const perSecond = efficiency
        ? this.formatResourcePairs(efficiency.outputPerSecond, {
            decimals: 1,
          })
        : "";

      const el = document.createElement("div");
      el.className = "automation-card";

      const inputStr = this.formatResourcePairs(auto.input);
      const outputStr = this.formatResourcePairs(auto.output, { plus: true });

      let stateDisplay = "";
      let progressHtml = "";

      if (state === "running") {
        stateDisplay = `<span class="automation-state-label state-running">🔄 Работает — ${remaining.toFixed(1)}с</span>`;
        progressHtml = `
          <div class="automation-bar">
            <div class="automation-bar-fill" style="width:${progress * 100}%"></div>
          </div>
        `;
      } else if (state === "waiting") {
        const missing = this.game.getMissingResources(auto.input);
        const missingStr = missing
          .map(
            ({ id, missing: amount }) =>
              `${this.getResourceDisplayIcon(id)}${amount}`,
          )
          .join(" ");
        stateDisplay = `<span class="automation-state-label state-waiting">⚠️ Ожидание — не хватает ${missingStr || inputStr}</span>`;
        progressHtml = `<div class="automation-bar"><div class="automation-bar-fill" style="width:0%"></div></div>`;
      } else {
        stateDisplay = `<span class="automation-state-label state-idle">⏸ Остановлено</span>`;
      }

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "automation-toggle-btn";
      toggleBtn.type = "button";
      toggleBtn.textContent = buildingData.isAutomationRunning
        ? "⏸ Остановить"
        : "▶️ Запустить";
      toggleBtn.addEventListener("click", () => {
        if (!this.game.toggleAutomation(buildingId)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });

      el.innerHTML = `
        <span class="btn-icon">${building.icon}</span>
        <span class="btn-label">${building.name}</span>
        ${auto.description ? `<span class="btn-desc">${auto.description}</span>` : ""}
        <span class="automation-flow">${inputStr} → ${outputStr}</span>
        <span class="automation-efficiency">${outputStr} / ${efficiency.cycleSeconds.toFixed(0)}с = ${perSecond} / с</span>
        ${stateDisplay}
        ${progressHtml}
      `;
      el.appendChild(toggleBtn);

      this.setTooltip(el, [
        `${building.name}: автоматизация`,
        state === "running"
          ? "Статус: работает и выпускает ресурс по циклу"
          : state === "waiting"
            ? "Статус: ожидание, пока не хватает входных ресурсов"
            : buildingData.isAutomationRunning
              ? "Статус: остановлено вручную"
              : "Статус: неактивно, цикл ещё не запущен",
        "Автоматизация снижает ручную нагрузку и поддерживает цепочку",
      ]);

      container.appendChild(el);
    }

    if (!anyActive) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        "Постройте здание с автоматическим циклом, чтобы часть прогресса шла без ручных кликов.";
      container.appendChild(hint);
    }
  }

  createResearchCard(tech, researchState) {
    const prereqs = this.game.getTechPrerequisites(tech.id);
    const done = this.game.researched[tech.id];
    const canDo = this.game.canResearch(tech.id);
    const isResearchingThis = researchState?.techId === tech.id;
    const isQueued = this.game.researchQueue.some((q) => q.techId === tech.id);
    const canQueue = this.game.canQueueResearch(tech.id);
    const outcomes = Array.isArray(tech.outcomes) ? tech.outcomes : [];
    const missingRequirementLabels = [
      ...prereqs.missingTechIds.map((id) => {
        const reqTech = this.data.tech[id];
        return reqTech ? `${reqTech.icon} ${reqTech.name}` : id;
      }),
      ...prereqs.missingBuildingIds.map((id) => {
        const reqBuilding = this.data.buildings[id];
        return reqBuilding ? `${reqBuilding.icon} ${reqBuilding.name}` : id;
      }),
    ];
    const outcomesHtml = outcomes.length
      ? `<div class="tech-outcomes">${outcomes.map((item) => `<span class="tech-outcome">${item}</span>`).join("")}</div>`
      : "";
    const requirementText =
      missingRequirementLabels.length > 0
        ? `Нужно: ${missingRequirementLabels.join(" · ")}`
        : "";

    const el = document.createElement("div");
    el.className = "tech-card";

    if (done) {
      el.classList.add("done");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status">✅ Изучено</span>
      `;
      this.setTooltip(el, [tech.name, tech.description, ...outcomes]);
      return el;
    }

    if (isResearchingThis) {
      el.classList.add("in-progress");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status is-pending">⏳ Исследуется — ${this.formatSeconds(researchState.remainingMs)}</span>
        <div class="project-mini-bar">
          <div class="project-mini-bar-fill" style="width:${researchState.progress * 100}%"></div>
        </div>
      `;
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "tech-cancel-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "✕ Отменить (−50% ресурсов)";
      cancelBtn.addEventListener("click", () => {
        this.game.cancelResearch();
        this.render({ forcePanels: true });
      });
      el.appendChild(cancelBtn);
      this.setTooltip(el, [
        `${tech.name}: исследование запущено`,
        `Осталось: ${this.formatSeconds(researchState.remainingMs)}`,
        ...outcomes,
      ]);
      return el;
    }

    if (isQueued) {
      el.classList.add("queued");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status is-pending">📋 В очереди — запустится автоматически</span>
      `;
      const dequeueBtn = document.createElement("button");
      dequeueBtn.className = "tech-cancel-btn";
      dequeueBtn.type = "button";
      dequeueBtn.textContent = "✕ Убрать из очереди (вернуть ресурсы)";
      dequeueBtn.addEventListener("click", () => {
        this.game.cancelQueuedResearch();
        this.render({ forcePanels: true });
      });
      el.appendChild(dequeueBtn);
      this.setTooltip(el, [
        tech.name,
        tech.description,
        "В очереди — ресурсы уже заняты",
        ...outcomes,
      ]);
      return el;
    }

    if (missingRequirementLabels.length > 0) {
      el.classList.add("locked");
      el.innerHTML = `
        <span class="tech-icon">🔒</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-req">${requirementText}</span>
      `;
      this.setTooltip(el, [
        tech.name,
        tech.description,
        requirementText,
        ...outcomes,
      ]);
      return el;
    }

    const costStr = this.formatResourcePairs(tech.cost);
    const researchTime = this.formatSeconds(
      this.game.getResearchDuration(tech.id),
    );

    // Build resource status string with specific missing resources
    let researchStatus;
    if (canQueue) {
      researchStatus = `Исследование в очереди: стоимость ${costStr}`;
    } else if (researchState && !isResearchingThis) {
      // Another tech is being researched
      researchStatus = `Идёт: ${researchState.icon} ${researchState.name}`;
    } else if (!this.game.hasResources(tech.cost)) {
      const missing = this.game.getMissingResources(tech.cost);
      const missingStr = missing
        .map(
          ({ id, missing: amount }) =>
            `${this.getResourceDisplayIcon(id)}${amount}`,
        )
        .join(" ");
      researchStatus = `Не хватает: ${missingStr}`;
    } else {
      researchStatus = `Стоит: ${costStr} · Время: ${researchTime}`;
    }

    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.type = "button";

    if (canQueue) {
      // Show queue button
      this.setButtonAvailability(btn, true);
      btn.innerHTML = `
        <span class="btn-icon">${tech.icon}</span>
        <span class="btn-label">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="btn-cost">Стоимость: ${costStr}</span>
        <span class="btn-efficiency">Время исследования: ${researchTime}</span>
        <span class="btn-queue-status tech-queue-hint">📋 Поставить в очередь</span>
      `;
      btn.addEventListener("click", () => {
        this.game.queueResearch(tech.id);
        this.render({ forcePanels: true });
      });
    } else {
      this.setButtonAvailability(btn, canDo);
      btn.innerHTML = `
        <span class="btn-icon">${tech.icon}</span>
        <span class="btn-label">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="btn-cost">Стоимость: ${costStr}</span>
        <span class="btn-efficiency">Время исследования: ${researchTime}</span>
        <span class="btn-queue-status">${researchStatus}</span>
      `;
      btn.addEventListener("click", () => {
        if (!this.game.research(tech.id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });
    }

    this.setTooltip(btn, [tech.name, tech.description, ...outcomes]);
    el.appendChild(btn);
    return el;
  }

  _renderPrologueInsightsBody(container) {
    container.innerHTML = "";

    const insights = this.game.getPrologueInsightsState();
    const unlockedCount = insights.filter((insight) => insight.unlocked).length;
    const currentStep = this.game.getCurrentOnboardingStep();

    const overview = document.createElement("div");
    overview.className = "research-overview";
    overview.innerHTML = `
      <div class="research-overview-summary">
        <span class="research-summary-chip">Озарения: ${unlockedCount}/${insights.length}</span>
        <span class="research-summary-chip">Книга знаний: ${this.game.getKnowledgeEntries().length}</span>
        <span class="research-summary-chip">Текущий шаг: ${this.game.onboarding.currentStep + 1}/${this.data.onboarding.steps.length}</span>
      </div>
      <div class="research-overview-text">${this.data.prologue?.insightsHint || ""}</div>
      ${currentStep ? `<div class="research-overview-text">Сейчас: ${currentStep.text}</div>` : ""}
    `;
    container.appendChild(overview);

    const grid = document.createElement("div");
    grid.className = "research-branches-grid";

    for (const insight of insights) {
      const card = document.createElement("div");
      card.className = `tech-card${insight.unlocked ? " done" : " locked"}`;
      card.innerHTML = `
        <span class="tech-icon">${insight.icon}</span>
        <span class="tech-name">${insight.name}</span>
        <span class="btn-desc">${insight.description}</span>
        ${insight.unlocked && insight.unlockText ? `<div class="prologue-inline-note">${insight.unlockText}</div>` : ""}
        ${Array.isArray(insight.outcomes) && insight.outcomes.length > 0 ? `<div class="tech-outcomes">${insight.outcomes.map((item) => `<span class="tech-outcome">${item}</span>`).join("")}</div>` : ""}
        <span class="tech-status ${insight.unlocked ? "" : "is-pending"}">${insight.unlocked ? "✅ Озарение открыто" : `🔍 ${insight.conditionText || "Открывается через действия"}`}</span>
      `;
      this.setTooltip(card, [
        insight.name,
        insight.description,
        insight.conditionText || "",
        ...(insight.outcomes || []),
      ]);
      grid.appendChild(card);
    }

    container.appendChild(grid);
  }

  _renderResearchBody(container) {
    container.innerHTML = "";

    const researchState = this.game.getResearchState();
    const branchState = this.game.getResearchBranchesState();
    const startedBranches = branchState.branches.filter(
      (branch) => branch.started,
    ).length;

    const overview = document.createElement("div");
    overview.className = "research-overview";
    overview.innerHTML = `
      <div class="research-overview-summary">
        <span class="research-summary-chip">Основа: ${branchState.foundation.filter((tech) => this.game.researched[tech.id]).length}/${branchState.foundation.length}</span>
        <span class="research-summary-chip">Ветви начаты: ${startedBranches}/${branchState.branches.length}</span>
        <span class="research-summary-chip">Изучено: ${Object.keys(this.game.researched).length}</span>
      </div>
      ${branchState.transitionText ? `<div class="research-overview-text">${branchState.transitionText}</div>` : ""}
    `;
    container.appendChild(overview);

    if (branchState.foundation.length > 0) {
      const foundation = document.createElement("section");
      foundation.className = "research-foundation";
      foundation.innerHTML = `
        <div class="research-branch-header is-foundation">
          <div class="research-branch-title">
            <span class="research-branch-icon">🪶</span>
            <div>
              <div class="research-branch-name">Основа эпохи</div>
              <div class="research-branch-desc">Без этих знаний ветви развития не складываются в общую систему.</div>
            </div>
          </div>
        </div>
      `;

      const foundationGrid = document.createElement("div");
      foundationGrid.className = "research-foundation-grid";
      for (const tech of branchState.foundation) {
        foundationGrid.appendChild(
          this.createResearchCard(tech, researchState),
        );
      }

      foundation.appendChild(foundationGrid);
      container.appendChild(foundation);
    }

    if (researchState) {
      const card = this.createTimedStatusCard({
        title: "Активное исследование",
        icon: researchState.icon,
        name: researchState.name,
        remainingMs: researchState.remainingMs,
        progress: researchState.progress,
        note: "Эффект технологии включится после завершения исследования.",
        variant: "research",
      });
      this.setTooltip(card, [
        `${researchState.name}: исследование в процессе`,
        `Осталось: ${this.formatSeconds(researchState.remainingMs)}`,
        "После завершения технология сразу усилит ваше поселение.",
      ]);
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "tech-cancel-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "✕ Отменить (−50% ресурсов)";
      cancelBtn.addEventListener("click", () => {
        this.game.cancelResearch();
        this.render({ forcePanels: true });
      });
      card.appendChild(cancelBtn);
      container.appendChild(card);
    }

    // Queue slot indicator
    if (this.game.researchQueue.length > 0) {
      const queuedTech = this.data.tech[this.game.researchQueue[0].techId];
      const queueSlot = document.createElement("div");
      queueSlot.className = "research-queue-slot";
      queueSlot.innerHTML = `
        <span class="research-queue-slot-label">📋 В очереди:</span>
        <span class="research-queue-slot-name">${queuedTech?.icon || ""} ${queuedTech?.name || "?"}</span>
        <span class="research-queue-slot-hint">запустится автоматически</span>
      `;
      const cancelQueueBtn = document.createElement("button");
      cancelQueueBtn.className = "tech-cancel-btn";
      cancelQueueBtn.type = "button";
      cancelQueueBtn.textContent = "✕ Убрать (вернуть ресурсы)";
      cancelQueueBtn.addEventListener("click", () => {
        this.game.cancelQueuedResearch();
        this.render({ forcePanels: true });
      });
      queueSlot.appendChild(cancelQueueBtn);
      container.appendChild(queueSlot);
    } else if (researchState) {
      const emptySlot = document.createElement("div");
      emptySlot.className = "research-queue-slot is-empty";
      emptySlot.innerHTML = `<span class="research-queue-slot-label">📋 Очередь пуста</span><span class="research-queue-slot-hint">Выберите следующее исследование ниже</span>`;
      container.appendChild(emptySlot);
    }

    const branchesGrid = document.createElement("div");
    branchesGrid.className = "research-branches-grid";

    for (const branch of branchState.branches) {
      const isComplete = branch.completed === branch.total && branch.total > 0;
      const section = document.createElement("section");
      section.className =
        "research-branch" + (isComplete ? " is-complete" : "");
      section.innerHTML = `
        <div class="research-branch-header">
          <div class="research-branch-title">
            <span class="research-branch-icon">${branch.icon}</span>
            <div>
              <div class="research-branch-name">${branch.label}</div>
              <div class="research-branch-desc">${branch.description}</div>
            </div>
          </div>
          <div class="research-branch-meta">${isComplete ? "✅" : `${branch.completed}/${branch.total}`}</div>
        </div>
        <div class="research-branch-leads">${branch.leadsTo}</div>
      `;

      const techList = document.createElement("div");
      techList.className = "research-branch-techs";
      for (const tech of branch.techs) {
        techList.appendChild(this.createResearchCard(tech, researchState));
      }

      section.appendChild(techList);
      branchesGrid.appendChild(section);
    }

    container.appendChild(branchesGrid);
  }

  renderLog() {
    const container = document.getElementById("log-panel");
    if (!container) return;

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = "📋 Журнал";
    container.appendChild(title);

    const logContainer = document.createElement("div");
    logContainer.className = "log-entries";

    const entries = this.game.log.slice(0, 15);
    if (entries.length === 0) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Здесь будут отображаться ваши действия";
      logContainer.appendChild(p);
    } else {
      for (const entry of entries) {
        const el = document.createElement("div");
        el.className = "log-entry";
        el.textContent = entry.message;
        logContainer.appendChild(el);
      }
    }

    container.appendChild(logContainer);
  }

  renderEraProgress() {
    const container = document.getElementById("era-progress-panel");
    if (!container) return;

    if (this.game.isPrologueActive()) {
      const totalSteps = this.data.onboarding.steps.length;
      const completedSteps = Math.min(
        this.game.onboarding.currentStep,
        totalSteps,
      );
      const progressPercent =
        totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      const campfireState = this.game.getPrologueCampfireState();

      container.innerHTML = `
        <h3>🔥 ${campfireState?.title || "Путь к первому костру"}</h3>
        <div class="era-description">${campfireState?.text || this.data.prologue?.subtitle || "Голые руки, первые материалы и первые озарения."}</div>
        <div class="era-progress-bar">
          <div class="era-progress-fill" style="width: ${progressPercent}%"></div>
          <span class="era-progress-text">${progressPercent}% (${completedSteps}/${totalSteps})</span>
        </div>
        <div class="era-milestones">
          <div class="era-milestone ${campfireState?.shelterBuilt ? "completed" : "pending"}">${campfireState?.shelterBuilt ? "✅" : "⏳"} Поставить первое жильё</div>
          <div class="era-milestone ${campfireState?.unlockedInsights >= campfireState?.totalInsights ? "completed" : "pending"}">${campfireState?.unlockedInsights >= campfireState?.totalInsights ? "✅" : "⏳"} Открыть все ранние озарения</div>
          <div class="era-milestone ${campfireState?.hasTool ? "completed" : "pending"}">${campfireState?.hasTool ? "✅" : "⏳"} Связать первое грубое орудие</div>
          <div class="era-milestone ${campfireState?.built ? "completed" : "pending"}">${campfireState?.built ? "✅" : "⏳"} Развести первый костёр</div>
        </div>
        <div class="era-stats">
          <span>✨ ${campfireState?.unlockedInsights || 0}/${campfireState?.totalInsights || 0}</span>
          <span>📚 ${this.game.getKnowledgeEntries().length}</span>
          <span>⚡ ${this.game.energy}/${this.game.maxEnergy}</span>
        </div>
      `;
      return;
    }

    const eraData = this.game.getEraData();
    if (!eraData) {
      container.innerHTML = "";
      return;
    }

    const eraProgress = this.game.getEraProgress();
    const progressPercent = Math.round(eraProgress.progress * 100);
    const summary = this.game.getProgressSummary();

    // Milestones
    let milestonesHtml = "";
    for (const milestone of eraProgress.milestones) {
      const statusIcon = milestone.completed ? "✅" : "⏳";
      const statusClass = milestone.completed ? "completed" : "pending";
      milestonesHtml += `<div class="era-milestone ${statusClass}">${statusIcon} ${milestone.text}</div>`;
    }

    // Tactical goal (compact)
    let goalHtml = "";
    const goal = this.game.getCurrentGoal();
    const goalProgress = this.game.getGoalProgress();

    if (
      this.game.isOnboardingActive() ||
      this.game.shouldShowOnboardingIntro()
    ) {
      // During onboarding, don't show goal block
      goalHtml = "";
    } else if (!goal) {
      goalHtml = `<div class="era-goal-done">✅ Все цели выполнены (${goalProgress.done}/${goalProgress.total})</div>`;
    } else {
      const pct = goalProgress.currentPct;
      goalHtml = `
        <div class="era-goal-block">
          <div class="era-goal-header">
            <span class="era-goal-label">Цель ${goalProgress.done + 1}/${goalProgress.total}:</span>
            <span class="era-goal-text">${goal.text}</span>
          </div>
          ${goal.hint ? `<div class="era-goal-hint">💡 ${goal.hint}</div>` : ""}
          <div class="era-goal-bar">
            <div class="era-goal-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }

    // Stats line
    const statsHtml = `
      <div class="era-stats">
        <span>🏗 ${summary.buildingsBuilt}</span>
        <span>🔬 ${summary.techResearched}</span>
        <span>📦 ${summary.resourcesOwned}</span>
      </div>
    `;

    container.innerHTML = `
      <h3>🌟 ${eraData.name}</h3>
      <div class="era-description">${eraData.description}</div>
      <div class="era-progress-bar">
        <div class="era-progress-fill" style="width: ${progressPercent}%"></div>
        <span class="era-progress-text">${progressPercent}% (${eraProgress.completed}/${eraProgress.total})</span>
      </div>
      <div class="era-milestones">
        ${milestonesHtml}
      </div>
      ${goalHtml}
      ${statsHtml}
    `;
  }

  renderSaveStatus() {
    const element = document.getElementById("save-status");
    if (!element) return;

    const status = this.game.getSaveStatus();
    element.textContent = status.text;
    element.classList.remove("is-saved", "is-error");
    if (status.state === "saved") {
      element.classList.add("is-saved");
    } else if (status.state === "error") {
      element.classList.add("is-error");
    }
  }
}

UI.prototype.getStoryEventKicker = function getStoryEventKicker(type) {
  switch (type) {
    case "transition":
      return "Новый этап";
    case "campfire":
      return "Рубеж пролога";
    case "character":
      return "Состояние персонажа";
    case "knowledge":
      return "Книга знаний";
    case "prologue":
      return "Первые шаги";
    case "map":
      return "Локальная карта";
    default:
      return "Озарение";
  }
};

UI.prototype.renderStoryEvent = function renderStoryEvent() {
  const layer = document.getElementById("story-event-layer");
  if (!layer) return;

  const event = this.game.getActiveStoryEvent();
  if (!event) {
    this.lastStoryEventId = "";
    layer.innerHTML = "";
    layer.style.display = "none";
    return;
  }

  if (event.id === this.lastStoryEventId) {
    layer.style.display = "block";
    return;
  }

  this.lastStoryEventId = event.id;

  layer.style.display = "block";
  layer.innerHTML = `
    <article class="story-event story-event--${event.type || "default"}">
      <div class="story-event-main">
        <div class="story-event-kicker">${this.getStoryEventKicker(event.type)}</div>
        <div class="story-event-title">${event.icon || "✦"} ${event.title}</div>
        <div class="story-event-text">${event.text || ""}</div>
      </div>
      <div class="story-event-actions">
        ${
          event.action === "insights"
            ? '<button class="story-event-action js-story-action" type="button">Озарения</button>'
            : event.action === "knowledge"
              ? '<button class="story-event-action js-story-action" type="button">Книга знаний</button>'
              : ""
        }
        <button class="story-event-close" type="button" aria-label="Закрыть">✕</button>
      </div>
    </article>
  `;

  layer.querySelector(".story-event-close")?.addEventListener("click", () => {
    this.game.dismissStoryEvent(event.id);
    this.render({ forcePanels: true });
  });

  layer.querySelector(".js-story-action")?.addEventListener("click", () => {
    if (event.action === "insights") {
      this.openResearchModal();
    } else if (event.action === "knowledge") {
      this.openKnowledgeModal();
    }
    this.game.dismissStoryEvent(event.id);
    this.render({ forcePanels: true });
  });
};
