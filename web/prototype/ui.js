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
    this.bindStaticControls();
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

  renderHeaderModeState() {
    const isPrologue = this.game.isPrologueActive();
    document.body.classList.toggle("is-prologue-active", isPrologue);

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
      case "settled":
        return "Освоено";
      case "exploited":
        return "Используется";
      case "discovered":
        return "Замечено";
      default:
        return "Туман";
    }
  }

  renderCampMap() {
    const container = document.getElementById("camp-map-panel");
    if (!container) return;

    const mapState = this.game.getCampMapState();
    const selected = this.game.getCampMapTileDetails(mapState.selectedTileId);
    if (!selected) {
      container.innerHTML = "";
      return;
    }

    // Flat-top honeycomb: full 61-cell field (radius 4)
    // tileWidth = 2R, tileHeight = √3·R, colStep = 1.5R, rowStep = √3·R
    const hexRadius = 40;
    const tileWidth = hexRadius * 2;                            // 80
    const tileHeight = Math.round(Math.sqrt(3) * hexRadius);    // 69
    const horizontalStep = Math.round(hexRadius * 1.5);         // 60
    const verticalStep = tileHeight;                            // 69
    const scenePadding = 20;
    const gridRadius = 4; // 61 cells total

    // Index named tiles by "q,r" for O(1) lookup
    const namedByCoord = new Map();
    for (const tile of mapState.tiles) {
      namedByCoord.set(`${tile.q},${tile.r}`, tile);
    }

    // Generate every hex within gridRadius using axial coordinates
    const allCoords = [];
    for (let q = -gridRadius; q <= gridRadius; q++) {
      const rMin = Math.max(-gridRadius, -q - gridRadius);
      const rMax = Math.min(gridRadius, -q + gridRadius);
      for (let r = rMin; r <= rMax; r++) {
        allCoords.push({ q, r });
      }
    }

    // Compute flat-top pixel position for each hex
    const allLayouts = allCoords.map(({ q, r }) => {
      const centerX = q * horizontalStep;
      const centerY = Math.round((r + q * 0.5) * verticalStep);
      return { q, r, left: centerX - tileWidth / 2, top: centerY - tileHeight / 2 };
    });

    const minX = Math.min(...allLayouts.map((t) => t.left));
    const maxX = Math.max(...allLayouts.map((t) => t.left + tileWidth));
    const minY = Math.min(...allLayouts.map((t) => t.top));
    const maxY = Math.max(...allLayouts.map((t) => t.top + tileHeight));
    const sceneWidth = Math.ceil(maxX - minX + scenePadding * 2);
    const sceneHeight = Math.ceil(maxY - minY + scenePadding * 2);

    // Deterministic pseudo-random terrain for filler hexes
    const FILLER_TERRAINS = ["void", "void", "filler-brush", "filler-rock", "void", "filler-grass"];

    const renderedTiles = allLayouts.map(({ q, r, left, top }) => {
      const px = left - minX + scenePadding;
      const py = top - minY + scenePadding;
      const sizeStyle = `left:${px}px; top:${py}px; width:${tileWidth}px; height:${tileHeight}px;`;
      const tile = namedByCoord.get(`${q},${r}`);

      if (!tile) {
        const ti = Math.abs((q * 7 + r * 13 + q * r * 3) % FILLER_TERRAINS.length);
        return `<div class="camp-tile camp-tile--filler terrain-${FILLER_TERRAINS[ti]}" style="${sizeStyle}" aria-hidden="true"></div>`;
      }

      const tileStateLabel = this.getCampTileStateLabel(tile.state);
      const displayIcon =
        tile.construction?.icon ||
        tile.building?.icon ||
        tile.icon ||
        "•";
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
      if (tile.resourceType && Number.isFinite(tile.resourceRemaining) && tile.state !== "hidden") {
        const cap = tile.resourceCapacity || 1;
        const pct = tile.resourceRemaining / cap;
        if (pct >= 0.67) classes.push("res-rich");
        else if (pct >= 0.34) classes.push("res-medium");
        else classes.push("res-sparse");
      }

      return `
        <button
          class="${classes.join(" ")}"
          type="button"
          data-tile-id="${tile.id}"
          style="${sizeStyle}"
          aria-label="${tile.name}"
        >
          <span class="camp-tile-inner">
            ${tile.state !== "hidden" ? `
              <span class="camp-tile-icon">${displayIcon}</span>
              <span class="camp-tile-name">${tile.name}</span>
              <span class="camp-tile-state">${tileStateLabel}</span>
            ` : ""}
          </span>
        </button>
      `;
    }).join("");

    const selectedStateLabel = this.getCampTileStateLabel(selected.state);
    const selectedActionCopy = selected.action
      ? this.getGatherActionCopy(selected.action)
      : null;
    const selectedBuildingCopy = selected.nextBuilding
      ? this.getBuildingCopy(selected.nextBuilding)
      : null;
    const selectedPlacedBuildingCopy = selected.placedBuilding
      ? this.getBuildingCopy(selected.placedBuilding)
      : null;
    const selectedActionOutput = selected.action
      ? this.formatResourcePairs(this.game.getGatherOutput(selected.action.id), {
          plus: true,
        })
      : "";
    const selectedResourceStock = Number.isFinite(selected.resourceRemaining)
      ? `${selected.resourceRemaining}/${selected.resourceCapacity}`
      : "";
    const selectedActionCooldown = selected.action
      ? this.game.getCooldownRemaining(selected.action.id)
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
    } else if (selected.action && selectedActionCopy) {
      detailsActionBlock = `
        <div class="camp-map-action-meta">
          <span>Находка: ${selectedActionOutput}</span>
          <span>Энергия: -${selected.action.energyCost}</span>
          <span>Зона: ${selected.distanceFromCamp === 0 ? "центр" : selected.distanceFromCamp === 1 ? "ближняя" : "дальняя"}</span>
        </div>
        ${
          selectedActionCooldown > 0
            ? `<div class="camp-map-note is-waiting">Нужно подождать ещё ${this.formatCooldownMs(selectedActionCooldown)}.</div>`
            : ""
        }
        <button
          id="camp-map-primary-action"
          class="camp-map-primary-btn${selected.canGather ? "" : " disabled"}"
          type="button"
          aria-disabled="${selected.canGather ? "false" : "true"}"
        >
          ${selectedActionCopy.icon} ${selectedActionCopy.name}
        </button>
      `;
      if (selectedResourceStock) {
        detailsActionBlock += `<div class="camp-map-note">Запас участка: ${selectedResourceStock}</div>`;
      }
      if (selected.isDepleted) {
        detailsActionBlock += `<div class="camp-map-note is-empty">Этот участок уже вычищен. Полезного сырья здесь пока не осталось.</div>`;
      }
    } else if (selected.nextBuilding && selectedBuildingCopy) {
      const missingInsights = (selected.nextBuilding.requiresInsights || []).filter(
        (insightId) => !this.game.insights[insightId],
      );
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

      detailsActionBlock = `
        <div class="camp-map-action-meta">
          <span>Место под: ${selectedBuildingCopy.icon} ${selectedBuildingCopy.name}</span>
          <span>Стоимость: ${buildCost}</span>
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
    } else {
      detailsActionBlock = `
        <div class="camp-map-note">
          Этот участок пока важен как часть местности. Позже он может дать новую опору лагерю.
        </div>
      `;
    }

    container.innerHTML = `
      <div class="camp-map-header">
        <div>
          <h3>${mapState.title}</h3>
          <div class="camp-map-description">${mapState.description}</div>
        </div>
        <div class="camp-map-chips">
          <span class="camp-map-chip">Открыто ${mapState.discoveredCount}/${mapState.totalCount}</span>
          <span class="camp-map-chip">Освоено ${mapState.settledCount}</span>
        </div>
      </div>
      <div class="camp-map-body">
        <div class="camp-map-scene-wrap">
          <div class="camp-map-scene" id="camp-map-scene">
            <div id="camp-map-canvas" class="camp-map-canvas" style="width:${sceneWidth}px; height:${sceneHeight}px;">
              ${renderedTiles}
            </div>
          </div>
          <div class="camp-map-legend">${mapState.interactionHint}</div>
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

    for (const tile of mapState.tiles) {
      const button = container.querySelector(`[data-tile-id="${tile.id}"]`);
      if (!button) continue;

      if (tile.state !== "hidden" && Number.isFinite(tile.resourceRemaining)) {
        const tileInner = button.querySelector(".camp-tile-inner");
        if (tileInner) {
          const stock = document.createElement("span");
          stock.className = `camp-tile-stock${tile.isDepleted ? " is-empty" : ""}`;
          stock.textContent = String(tile.resourceRemaining);
          tileInner.prepend(stock);
        }
      }

      if (tile.state === "hidden") {
        this.setTooltip(button, [
          "Неизвестный участок",
          tile.discoveryHint || "Пока эта часть местности скрыта туманом и откроется позже.",
        ]);
      } else {
        const tooltipLines = [
          tile.name,
          tile.description,
          `Состояние: ${this.getCampTileStateLabel(tile.state)}`,
          `Дистанция от стоянки: ${tile.distanceFromCamp}`,
        ];
        if (tile.actionId) {
          const action = this.data.gatherActions[tile.actionId];
          const actionCopy = this.getGatherActionCopy(action);
          tooltipLines.push(`Действие: ${actionCopy.icon} ${actionCopy.name}`);
        }
        if (tile.buildingId) {
          tooltipLines.push(
            `Постройка: ${tile.building.icon} ${tile.building.name}`,
          );
        } else if (Array.isArray(tile.buildOptions) && tile.buildOptions.length > 0) {
          const optionNames = tile.buildOptions
            .map((buildingId) => this.data.buildings[buildingId]?.name || buildingId)
            .join(", ");
          tooltipLines.push(`Участок: ${optionNames}`);
        }
        this.setTooltip(button, tooltipLines);
      }

      button.addEventListener("click", () => {
        const wasDrag = this._mapDragMoved;
        this._mapDragMoved = false;
        if (wasDrag) return;
        if (tile.state === "hidden") return;
        const wasSelected = this.game.getSelectedCampTileId() === tile.id;
        this.game.selectCampTile(tile.id);
        if (wasSelected) {
          this.game.performCampTileAction(tile.id);
        }
        this.render({ forcePanels: true });
      });
    }

    const primaryAction = document.getElementById("camp-map-primary-action");
    if (primaryAction) {
      primaryAction.addEventListener("click", () => {
        if (primaryAction.getAttribute("aria-disabled") === "true") {
          this.render({ forcePanels: true });
          return;
        }
        if (!this.game.performCampTileAction(selected.id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });
    }

    // ── Map pan: apply stored transform, init centering on first render ──────
    const sceneEl = document.getElementById("camp-map-scene");
    const canvasEl = document.getElementById("camp-map-canvas");
    if (sceneEl && canvasEl) {
      if (this._mapPanX === undefined) {
        this._mapPanX = Math.round((sceneEl.clientWidth  - sceneWidth)  / 2);
        this._mapPanY = Math.round((sceneEl.clientHeight - sceneHeight) / 2);
      }
      canvasEl.style.transform = `translate(${this._mapPanX}px, ${this._mapPanY}px)`;
    }

    // ── Bind drag events once (survive innerHTML rebuilds) ───────────────────
    if (!this._mapPanBound) {
      this._mapPanBound = true;

      container.addEventListener("mousedown", (e) => {
        const scene = document.getElementById("camp-map-scene");
        if (!scene || !scene.contains(e.target)) return;
        // LMB on named tile → normal click, not drag
        if (e.button === 0 && e.target.closest("[data-tile-id]")) return;
        if (e.button !== 0 && e.button !== 1) return;
        if (e.button === 1) e.preventDefault();
        this._mapDragging  = true;
        this._mapDragMoved = false;
        this._mapDragSX    = e.clientX - (this._mapPanX ?? 0);
        this._mapDragSY    = e.clientY - (this._mapPanY ?? 0);
        scene.classList.add("is-dragging");
      });

      document.addEventListener("mousemove", (e) => {
        if (!this._mapDragging) return;
        this._mapDragMoved = true;
        this._mapPanX = e.clientX - this._mapDragSX;
        this._mapPanY = e.clientY - this._mapDragSY;
        const cv = document.getElementById("camp-map-canvas");
        if (cv) cv.style.transform = `translate(${this._mapPanX}px, ${this._mapPanY}px)`;
      });

      document.addEventListener("mouseup", () => {
        if (!this._mapDragging) return;
        this._mapDragging = false;
        const scene = document.getElementById("camp-map-scene");
        if (scene) scene.classList.remove("is-dragging");
      });
    }
  }

  renderResearchWidget() {
    const container = document.getElementById("research-widget");
    if (!container) return;

    if (this.game.isPrologueActive()) {
      const insights = this.game.getPrologueInsightsState();
      const unlockedCount = insights.filter((insight) => insight.unlocked).length;
      const hasAvailable = insights.some((insight) => !insight.unlocked);
      const latestUnlocked = [...insights].reverse().find((insight) => insight.unlocked);

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

      container.querySelector(".js-research-open")?.addEventListener("click", () => {
        this.openResearchModal();
      });

      return;
    }

    const researchState = this.game.getResearchState();
    const branchState = this.game.getResearchBranchesState();
    const totalDone = Object.keys(this.game.researched).length;
    const startedBranches = branchState.branches.filter((b) => b.started).length;

    const hasAvailable =
      branchState.branches.some((b) => b.techs.some((t) => this.game.canResearch(t.id))) ||
      branchState.foundation.some((t) => this.game.canResearch(t.id));

    let activeHtml = "";
    if (researchState) {
      const pct = Math.round(researchState.progress * 100);
      const queuedTech = this.game.researchQueue.length > 0
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

    const indicatorClass = researchState ? "is-active" : hasAvailable ? "has-available" : "";
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

    container.querySelector(".js-research-open")?.addEventListener("click", () => {
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
        return `${this.data.resources[id].icon}${plus ? "+" : ""}${value}`;
      })
      .join(" ");
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

  formatTooltipText(lines) {
    return lines
      .filter((line) => typeof line === "string" && line.trim().length > 0)
      .map((line) => line.trim())
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
      this.renderEnergy();
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

    if (forcePanels || !this.isPanelHovered("energy-panel")) {
      this.renderEnergy();
    }
    if (forcePanels || !this.isPanelHovered("camp-map-panel")) {
      this.renderCampMap();
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
    this.renderResearchWidget();
    const _rModal = document.getElementById("research-modal");
    if (_rModal && _rModal.style.display !== "none" && !this.isPanelHovered("research-modal-body")) {
      this.renderResearchModalContent();
    }
    const _kModal = document.getElementById("knowledge-modal");
    if (_kModal && _kModal.style.display !== "none" && !this.isPanelHovered("knowledge-modal-body")) {
      this.renderKnowledgeModalContent();
    }
    this.renderLog();
    this.renderEraProgress();
    this.renderSaveStatus();
  }

  renderOnboardingIntro() {
    const container = document.getElementById("onboarding-intro-panel");
    if (!container) return;

    container.style.display = "block";
    const lines = this.data.onboarding.introLines;
    const prologue = this.data.prologue || {};
    container.innerHTML = `
      <img class="intro-hero-image" src="assets/intro-campfire.jpg" alt="" aria-hidden="true" onerror="this.src='assets/intro-campfire.svg'; this.onerror=null;">
      <div class="intro-hero-overlay"></div>
      <div class="onboarding-intro-content">
        <p class="intro-era-label">— Ранний пролог —</p>
        <h2 class="onboarding-intro-title">🌍 ${prologue.title || "На заре человечества"}</h2>
        ${prologue.subtitle ? `<p class="intro-era-label">${prologue.subtitle}</p>` : ""}
        <div class="onboarding-intro-text">
          ${lines.map((l) => `<p>${l}</p>`).join("")}
        </div>
        <div class="onboarding-intro-buttons">
          <button id="obStartBtn" class="ob-btn ob-btn-start">🌄 Начать пролог</button>
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
    document.getElementById("prologueInsightsBtn")?.addEventListener("click", () => {
      this.openResearchModal();
    });
    document.getElementById("prologueBookBtn")?.addEventListener("click", () => {
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

  renderEnergy() {
    const container = document.getElementById("energy-panel");
    if (!container) return;

    container.innerHTML = "";
    const pct = (this.game.energy / this.game.maxEnergy) * 100;
    const regenSec = (this.game.getEnergyRegenRemaining() / 1000).toFixed(1);
    const modifiers = this.game.getEnergyModifiers();
    const regenDeltaSec = (modifiers.regenIntervalBonusMs / 1000).toFixed(1);

    container.classList.remove("is-low", "is-critical");
    if (pct <= 10) {
      container.classList.add("is-critical");
    } else if (pct < 20) {
      container.classList.add("is-low");
    }

    const isPrologue = this.game.isPrologueActive();
    const warning =
      pct <= 10
        ? `<span class="energy-warning">${isPrologue ? "Нужна передышка: силы почти на исходе" : "Нужна пауза: энергии почти не осталось"}</span>`
        : pct < 20
          ? `<span class="energy-warning">${isPrologue ? "Сил мало: выбирайте только самое важное" : "Мало энергии: выбирайте действия осторожно"}</span>`
          : "";

    container.innerHTML = `
      <div class="energy-topline">
        <span class="energy-title">${isPrologue ? "⚡ Силы" : "⚡ Энергия"}</span>
        <span class="energy-value">${this.game.energy} / ${this.game.maxEnergy}</span>
      </div>
      <div class="energy-bar-container">
        <div class="energy-bar-fill" style="width:${pct}%"></div>
        <span class="energy-bar-text">${Math.round(pct)}%</span>
      </div>
      <div class="energy-info">
        <span>${isPrologue ? "🫀" : "🔄"} +${this.game.energyRegenPerTick} через ${regenSec}с</span>
        ${modifiers.maxBonus > 0 ? `<span class="energy-bonus">🔋 запас +${modifiers.maxBonus}</span>` : ""}
        ${modifiers.regenIntervalBonusMs > 0 ? `<span class="energy-bonus">⏱ восстановление -${regenDeltaSec}с</span>` : ""}
      </div>
      ${warning}
    `;

    this.setTooltip(container, [
      "Энергия: тратится на ручной сбор",
      `Сейчас: ${this.game.energy} / ${this.game.maxEnergy}`,
      pct < 20
        ? "Низкая энергия: выбирайте только приоритетные действия"
        : "Чем выше энергия, тем дольше можно собирать без паузы",
    ]);
  }

  renderResources() {
    const container = document.getElementById("resources-panel");
    if (!container) return;

    if (this.game.isPrologueActive() && !this.game.getPrologueRevealState().showResources) {
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
      title.textContent = this.data.prologue?.resourcesTitle || "🌿 Найденные материалы";
      container.appendChild(title);

      const hint = document.createElement("div");
      hint.className = "storage-summary";
      hint.textContent = this.data.prologue?.resourcesHint ||
        "Пока это не склад и не производство — только то, что удалось найти руками.";
      container.appendChild(hint);

      const list = document.createElement("div");
      list.className = "storage-resource-list";

      for (const id of visibleIds) {
        const resource = this.data.resources[id];
        if (!resource) continue;
        const resourceName = id === "wood"
          ? "Ветки"
          : id === "stone"
            ? "Камни"
            : id === "fiber"
              ? "Волокна"
              : id === "crude_tools"
                ? "Грубое орудие"
                : resource.name;
        const resourceDesc = id === "wood"
          ? "Сухие ветви, которые можно унести руками и пустить на первое орудие или костёр."
          : id === "stone"
            ? "Подобранные камни и сколы. Среди них встречаются острые края."
            : id === "fiber"
              ? "Трава и волокна, пригодные для простых связок."
              : id === "crude_tools"
                ? "Первое связанное орудие, собранное из ветви, камня и волокна."
                : resource.description;

        const item = document.createElement("div");
        item.className = "resource-item prologue-resource-item";
        item.innerHTML = `
          <span class="resource-icon" style="color:${resource.color}">${resource.icon}</span>
          <div class="resource-text">
            <span class="resource-name">${resourceName}</span>
            <span class="resource-desc">${resourceDesc}</span>
            <span class="prologue-resource-total">Найдено всего: ${this.game.resourceTotals[id] || 0}</span>
          </div>
          <span class="resource-count">${this.game.resources[id] || 0}</span>
        `;
        this.setTooltip(item, [
          resourceName,
          resourceDesc || "Материал раннего пролога",
          `Сейчас при себе: ${this.game.resources[id] || 0}`,
          `Всего найдено: ${this.game.resourceTotals[id] || 0}`,
        ]);
        list.appendChild(item);
      }

      container.appendChild(list);
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
      overflowNotice.textContent = `Переполнение: ${resource.icon} ${resource.name} -${recentOverflow.lost}`;
      this.setTooltip(overflowNotice, [
        "Последнее переполнение склада",
        `${resource.name}: потеряно ${recentOverflow.lost}`,
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

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = this.game.isPrologueActive()
      ? (this.data.prologue?.actionsTitle || "🖐️ Первые действия")
      : "🖐️ Сбор ресурсов";
    container.appendChild(title);

    if (this.game.isPrologueActive()) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        this.data.prologue?.actionsHint ||
        "Первые шаги — это не добыча, а поиск того, что можно подобрать, унести и использовать.";
      container.appendChild(hint);
    }

    for (const id of this.game.getVisibleGatherActions()) {
      const action = this.data.gatherActions[id];
      if (!action) continue;

      const copy = this.getGatherActionCopy(action);
      const btn = document.createElement("button");
      btn.className = `action-btn${this.game.isPrologueActive() ? " action-btn--prologue" : ""}`;
      btn.type = "button";

      const cooldown = this.game.getCooldownRemaining(id);
      const disabled = cooldown > 0 || !this.game.hasEnergy(action.energyCost);
      const output = this.game.getGatherOutput(id);
      const outputStr = this.formatResourcePairs(output, { plus: true });
      const perAction = `Эффективность: ${outputStr} / действие`;

      if (this.game.isPrologueActive()) {
        btn.innerHTML = `
          <span class="btn-icon">${copy.icon}</span>
          <span class="btn-label">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          <div class="btn-meta-inline">
            <span class="btn-output">Находка: ${outputStr}</span>
            <span class="btn-cost">⚡ -${action.energyCost}</span>
          </div>
          ${cooldown > 0 ? `<span class="btn-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
          ${!this.game.hasEnergy(action.energyCost) && cooldown === 0 ? '<span class="btn-cooldown">⚡ Нет сил</span>' : ""}
        `;
      } else {
        btn.innerHTML = `
          <span class="btn-icon">${copy.icon}</span>
          <span class="btn-label">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          <span class="btn-output">${outputStr}</span>
          <span class="btn-efficiency">${perAction}</span>
          <span class="btn-cost">⚡ -${action.energyCost}</span>
          ${cooldown > 0 ? `<span class="btn-cooldown">⏳ ${this.formatCooldownMs(cooldown)}</span>` : ""}
          ${!this.game.hasEnergy(action.energyCost) && cooldown === 0 ? '<span class="btn-cooldown">⚡ Нет энергии</span>' : ""}
        `;
      }

      btn.classList.toggle("cooldown", disabled);
      btn.classList.toggle("busy", cooldown > 0);
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
      this.setTooltip(btn, [
        copy.name,
        copy.description,
        `Выход: ${outputStr}`,
        `Энергия: -${action.energyCost}`,
      ]);

      btn.addEventListener("click", () => {
        if (!this.game.gather(id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });

      container.appendChild(btn);
    }
  }

  renderCrafting() {
    const container = document.getElementById("craft-panel");
    if (!container) return;

    if (this.game.isPrologueActive() && !this.game.getPrologueRevealState().showCraft) {
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
        const reqName = missingInsights.length > 0
          ? missingInsights
              .map(
                (insightId) =>
                  this.data.prologue?.insights?.[insightId]?.name || insightId,
              )
              .join(" · ")
          : !unlocked && recipe.unlockedBy
          ? this.data.tech[recipe.unlockedBy]?.name || recipe.unlockedBy
          : recipe.requires
            ? this.data.buildings[recipe.requires]?.name || recipe.requires
            : null;
        const reqType = missingInsights.length > 0
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

    if (this.game.isPrologueActive() && !this.game.getPrologueRevealState().showBuildings) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = this.game.isPrologueActive()
      ? "🔥 Первый костёр"
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
        const lockedByName = missingInsights.length > 0
          ? missingInsights
              .map(
                (insightId) =>
                  this.data.prologue?.insights?.[insightId]?.name || insightId,
              )
              .join(" · ")
          : missingPrologueTool
            ? "Грубое орудие"
            : !unlockedByTech
              ? this.data.tech[building.unlockedBy]?.name || building.unlockedBy
              : this.data.buildings[building.requires]?.name || building.requires;
        const lockedByType = missingInsights.length > 0
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
        } else if (this.game.isPrologueActive() && id === "campfire" && canDo) {
          buildStatus = "Можно разжечь первый костёр";
        } else if (!this.game.hasResources(this.game.getBuildingCost(id))) {
          buildStatus = "Не хватает ресурсов";
        }

        btn.innerHTML = `
          <span class="btn-icon">${building.icon}</span>
          <span class="btn-label">${copy.name}</span>
          ${copy.description ? `<span class="btn-desc">${copy.description}</span>` : ""}
          ${unlocksInfo}
          <span class="btn-cost">Стоимость: ${costStr}</span>
          <span class="btn-efficiency">Время строительства: ${buildTime}</span>
          <span class="btn-queue-status">${buildStatus}</span>
        `;
        this.setTooltip(btn, [
          copy.name,
          copy.description || "Ранняя постройка",
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

      this.setTooltip(el, [
        copy.name,
        copy.description || "Ранняя постройка",
      ]);
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
              `${this.data.resources[id].icon}${amount}`,
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
      this.setTooltip(el, [tech.name, tech.description, "В очереди — ресурсы уже заняты", ...outcomes]);
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
      this.setTooltip(el, [tech.name, tech.description, requirementText, ...outcomes]);
      return el;
    }

    const costStr = this.formatResourcePairs(tech.cost);
    const researchTime = this.formatSeconds(this.game.getResearchDuration(tech.id));

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
        .map(({ id, missing: amount }) => `${this.data.resources[id].icon}${amount}`)
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
    const startedBranches = branchState.branches.filter((branch) => branch.started)
      .length;

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
        foundationGrid.appendChild(this.createResearchCard(tech, researchState));
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
      section.className = "research-branch" + (isComplete ? " is-complete" : "");
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
      const completedSteps = Math.min(this.game.onboarding.currentStep, totalSteps);
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
