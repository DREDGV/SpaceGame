// Camp founding UI — modals, progress, resource guidance, founding quest widget.

Object.assign(UI.prototype, {
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
  },

  getCampFoundingProgressItems(cost = this.game.getCampFoundingCost()) {
    return Object.entries(cost || {}).map(([resId, needed]) => {
      const resDef = this.data.resources?.[resId] || {};
      const have = this.game.resources[resId] || 0;
      const missing = Math.max(0, needed - have);
      return {
        resId,
        icon: this.getResourceDisplayIcon(resId),
        name: this.getResourceDisplayName(resId),
        have,
        needed,
        missing,
        done: missing === 0,
      };
    });
  },

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
  },

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
  },

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
      missingParts.push(
        `${this.getResourceDisplayIcon(resId)} ${this.getResourceDisplayName(resId)}: не хватает ${amount}`,
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
        <div class="camp-found-confirm-cost-line">⛺ ${costStr} · ⚡ −${energyCost}</div>
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
  },

  closeCampFoundConfirm() {
    const modal = document.getElementById("camp-found-confirm-modal");
    if (!modal) return;
    modal.style.display = "none";
    document.body.style.overflow = "";
    this._pendingCampFoundTileId = null;
  },

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
      : `<div class="camp-quest-summary">Ритуал основания: ⛺ ${costStr} · ⚡ −${energyCost}</div>`;

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
  },
});
