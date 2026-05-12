(() => {
  const renderLocalCampMap = UI.prototype.renderCampMap;
  const SCENE_WIDTH = 920;
  const SCENE_HEIGHT = 520;
  const HEX_W = 68;
  const HEX_SIZE = HEX_W / 2;
  const SQRT3 = Math.sqrt(3);
  const ringConnections = [
    ["camp_core", "sunny_meadow"],
    ["camp_core", "forest_edge"],
    ["camp_core", "stream_bend"],
    ["camp_core", "clay_hollow"],
    ["camp_core", "stone_ridge"],
    ["camp_core", "old_path"],
    ["sunny_meadow", "stream_bend"],
    ["stream_bend", "forest_edge"],
    ["forest_edge", "old_path"],
    ["old_path", "stone_ridge"],
    ["stone_ridge", "clay_hollow"],
    ["clay_hollow", "sunny_meadow"],
  ];
  const nodeLayouts = {
    camp_core: { x: 268, y: 218, auraRx: 120, auraRy: 86 },
    old_path: { x: 96, y: 144, auraRx: 104, auraRy: 74 },
    stone_ridge: { x: 122, y: 306, auraRx: 116, auraRy: 82 },
    clay_hollow: { x: 286, y: 348, auraRx: 116, auraRy: 80 },
    sunny_meadow: { x: 402, y: 286, auraRx: 126, auraRy: 88 },
    stream_bend: { x: 470, y: 152, auraRx: 126, auraRy: 82 },
    forest_edge: { x: 260, y: 102, auraRx: 116, auraRy: 80 },
  };
  const terrainCells = [
    { x: 86, y: 74, tone: "unknown", label: "" },
    { x: 176, y: 74, tone: "forest", label: "" },
    { x: 266, y: 74, tone: "forest", label: "" },
    { x: 356, y: 74, tone: "water", label: "" },
    { x: 446, y: 74, tone: "clay", label: "" },
    { x: 536, y: 74, tone: "unknown", label: "" },
    { x: 626, y: 74, tone: "locked", label: "?" },
    { x: 42, y: 152, tone: "path", label: "" },
    { x: 132, y: 152, tone: "forest", label: "" },
    { x: 222, y: 152, tone: "camp", label: "" },
    { x: 312, y: 152, tone: "meadow", label: "" },
    { x: 402, y: 152, tone: "water", label: "" },
    { x: 492, y: 152, tone: "ridge", label: "" },
    { x: 582, y: 152, tone: "locked", label: "?" },
    { x: 86, y: 230, tone: "path", label: "" },
    { x: 176, y: 230, tone: "forest", label: "" },
    { x: 266, y: 230, tone: "camp", label: "" },
    { x: 356, y: 230, tone: "meadow", label: "" },
    { x: 446, y: 230, tone: "water", label: "" },
    { x: 536, y: 230, tone: "forest", label: "" },
    { x: 626, y: 230, tone: "locked", label: "?" },
    { x: 42, y: 308, tone: "unknown", label: "?" },
    { x: 132, y: 308, tone: "ridge", label: "" },
    { x: 222, y: 308, tone: "clay", label: "" },
    { x: 312, y: 308, tone: "meadow", label: "" },
    { x: 402, y: 308, tone: "water", label: "" },
    { x: 492, y: 308, tone: "forest", label: "" },
    { x: 582, y: 308, tone: "unknown", label: "" },
    { x: 86, y: 386, tone: "unknown", label: "" },
    { x: 176, y: 386, tone: "ridge", label: "" },
    { x: 266, y: 386, tone: "meadow", label: "" },
    { x: 356, y: 386, tone: "clay", label: "" },
    { x: 446, y: 386, tone: "water", label: "" },
    { x: 536, y: 386, tone: "unknown", label: "" },
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getNodePosition(node) {
    if (nodeLayouts[node.id]) {
      return nodeLayouts[node.id];
    }
    const size = 78;
    const centerX = 270;
    const centerY = 190;
    const x = centerX + size * 1.5 * (node.q || 0);
    const y =
      centerY +
      size *
        ((Math.sqrt(3) / 2) * (node.q || 0) + Math.sqrt(3) * (node.r || 0));
    return { x: Math.round(x), y: Math.round(y) };
  }

  function getNodeIcon(node) {
    if (node.isCamp || node.id === "camp_core") return "⌂";
    switch (node.tone) {
      case "forest":
        return "♞";
      case "water":
        return "≈";
      case "clay":
        return "◒";
      case "ridge":
        return "▲";
      case "path":
        return "✧";
      case "meadow":
        return "✹";
      default:
        return "•";
    }
  }

  function axialToPixel(q, r) {
    const centerX = SCENE_WIDTH / 2;
    const centerY = SCENE_HEIGHT / 2;
    const x = centerX + HEX_SIZE * 1.5 * (q || 0);
    const y = centerY + HEX_SIZE * (SQRT3 * (r || 0) + (SQRT3 / 2) * (q || 0));
    return { x, y };
  }

  function formatDuration(ms) {
    const safe = Math.max(0, Math.round(Number(ms) || 0));
    if (safe <= 0) return "здесь";
    const minutes = Math.max(1, Math.round(safe / 60000));
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? `${hours} ч ${rem} мин` : `${hours} ч`;
  }

  function axialToCube(q, r) {
    const x = q;
    const z = r;
    const y = -x - z;
    return { x, y, z };
  }

  function cubeToAxial(cube) {
    return { q: cube.x, r: cube.z };
  }

  function cubeRound(cube) {
    let rx = Math.round(cube.x);
    let ry = Math.round(cube.y);
    let rz = Math.round(cube.z);

    const xDiff = Math.abs(rx - cube.x);
    const yDiff = Math.abs(ry - cube.y);
    const zDiff = Math.abs(rz - cube.z);

    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }

    return { x: rx, y: ry, z: rz };
  }

  function cubeLerp(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }

  function hexLineAxial(from, to) {
    const a = axialToCube(from.q, from.r);
    const b = axialToCube(to.q, to.r);
    const n = Math.max(
      0,
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z)),
    );
    if (n <= 0) return [from];
    const out = [];
    for (let i = 0; i <= n; i += 1) {
      const t = n === 0 ? 0 : i / n;
      out.push(cubeToAxial(cubeRound(cubeLerp(a, b, t))));
    }
    return out;
  }

  Object.assign(UI.prototype, {
    renderCampMap() {
      if (this.game?.getActiveStrategicMapView?.() === "surroundings") {
        return this.renderSurroundingsMap();
      }

      const result = renderLocalCampMap.call(this);
      this._decorateStrategicMapViewSwitch();
      this._decorateStrategicObjectiveBridge();
      return result;
    },

    _getStrategicMapViewSwitchMarkup(activeView = "local") {
      const canOpenSurroundings = !!this.game?.canOpenSurroundingsMap?.();
      const targetNodeId = this.game?.getSurroundingsTargetNodeId?.() || null;
      const targetNode = targetNodeId
        ? this.game?.getSurroundingsNodeDetails?.(targetNodeId) || null
        : null;

      return `
        <div class="strategic-map-view-switch" role="group" aria-label="Масштаб карты">
          <button
            class="strategic-map-view-btn${activeView === "local" ? " is-active" : ""}"
            type="button"
            data-strategic-map-view="local"
            aria-pressed="${activeView === "local" ? "true" : "false"}"
          >Локально</button>
          <button
            class="strategic-map-view-btn${activeView === "surroundings" ? " is-active" : ""}"
            type="button"
            data-strategic-map-view="surroundings"
            aria-pressed="${activeView === "surroundings" ? "true" : "false"}"
            ${canOpenSurroundings ? "" : "disabled"}
          >Окрестности</button>
          ${targetNode ? `<span class="strategic-map-target-chip">Цель: ${escapeHtml(targetNode.title)}</span>` : ""}
        </div>
      `;
    },

    _bindStrategicMapViewSwitch(root = document) {
      root.querySelectorAll("[data-strategic-map-view]").forEach((button) => {
        button.addEventListener("click", () => {
          const nextView =
            button.getAttribute("data-strategic-map-view") || "local";
          if (!this.game?.setActiveStrategicMapView?.(nextView)) return;
          this.render({ forcePanels: true });
        });
      });
    },

    _decorateStrategicMapViewSwitch() {
      const panel = document.getElementById("camp-map-panel");
      if (!panel) return;

      const headerRight =
        panel.querySelector(".camp-map-header-right") ||
        panel.querySelector(".camp-map-header");
      if (!headerRight) return;

      headerRight.querySelector(".strategic-map-view-switch")?.remove();
      headerRight.insertAdjacentHTML(
        "afterbegin",
        this._getStrategicMapViewSwitchMarkup("local"),
      );
      this._bindStrategicMapViewSwitch(headerRight);
    },

    _getStrategicObjectiveBridgeMarkup() {
      const canOpenSurroundings = !!this.game?.canOpenSurroundingsMap?.();
      if (!canOpenSurroundings) return "";

      const targetNodeId = this.game?.getSurroundingsTargetNodeId?.() || null;
      const targetNode = targetNodeId
        ? this.game?.getSurroundingsNodeDetails?.(targetNodeId) || null
        : null;

      if (!targetNode) {
        return `
          <div class="strategic-map-objective-bridge is-empty">
            <div class="strategic-map-objective-copy">
              <div class="strategic-map-objective-overline">Окрестности доступны</div>
              <div class="strategic-map-objective-title">Выберите район, чтобы задать фокус следующей вылазки</div>
              <div class="strategic-map-objective-text">Внешняя карта уже открыта. Через неё можно выбрать направление и вернуть его в локальную карту как рабочую цель.</div>
            </div>
            <div class="strategic-map-objective-actions">
              <button class="strategic-map-objective-btn" type="button" data-strategic-open-surroundings="true">Открыть карту окрестностей</button>
            </div>
          </div>
        `;
      }

      const resourceMarkup = Array.isArray(targetNode.resources)
        ? targetNode.resources
            .slice(0, 3)
            .map(
              (resource) =>
                `<span class="strategic-map-objective-pill">${escapeHtml(resource)}</span>`,
            )
            .join("")
        : "";

      return `
        <div class="strategic-map-objective-bridge tone-${escapeHtml(targetNode.tone || "neutral")}">
          <div class="strategic-map-objective-copy">
            <div class="strategic-map-objective-overline">Фокус окрестностей</div>
            <div class="strategic-map-objective-title">Готовить выход: ${escapeHtml(targetNode.title)}</div>
            <div class="strategic-map-objective-text">${escapeHtml(targetNode.detail || targetNode.description || "")}</div>
          </div>
          <div class="strategic-map-objective-meta">
            <div class="strategic-map-objective-chip-row">
              <span class="strategic-map-objective-chip">${escapeHtml(targetNode.distanceLabel || "")}</span>
              <span class="strategic-map-objective-chip">${escapeHtml(targetNode.travelLabel || "")}</span>
              <span class="strategic-map-objective-chip">${escapeHtml(targetNode.subtitle || "")}</span>
            </div>
            ${resourceMarkup ? `<div class="strategic-map-objective-pill-row">${resourceMarkup}</div>` : ""}
          </div>
          <div class="strategic-map-objective-actions">
            <button class="strategic-map-objective-btn" type="button" data-strategic-open-surroundings="true">Изменить район</button>
            <button class="strategic-map-objective-btn is-secondary" type="button" data-strategic-clear-target="true">Снять фокус</button>
          </div>
        </div>
      `;
    },

    _bindStrategicObjectiveBridge(root = document) {
      root
        .querySelectorAll("[data-strategic-open-surroundings]")
        .forEach((button) => {
          button.addEventListener("click", () => {
            if (!this.game?.setActiveStrategicMapView?.("surroundings")) return;
            this.render({ forcePanels: true });
          });
        });

      root
        .querySelectorAll("[data-strategic-clear-target]")
        .forEach((button) => {
          button.addEventListener("click", () => {
            if (!this.game?.setSurroundingsTargetNode?.(null)) return;
            this.render({ forcePanels: true });
          });
        });
    },

    _decorateStrategicObjectiveBridge() {
      const panel = document.getElementById("camp-map-panel");
      if (!panel) return;

      panel.querySelector(".strategic-map-objective-bridge")?.remove();
      const bridgeMarkup = this._getStrategicObjectiveBridgeMarkup();
      if (!bridgeMarkup) return;

      const header = panel.querySelector(".camp-map-header");
      const body = panel.querySelector(".camp-map-body");
      if (body) {
        body.insertAdjacentHTML("beforebegin", bridgeMarkup);
        this._bindStrategicObjectiveBridge(panel);
        return;
      }

      if (header) {
        header.insertAdjacentHTML("afterend", bridgeMarkup);
        this._bindStrategicObjectiveBridge(panel);
      }
    },

    _renderSurroundingsMapDetails(details) {
      if (!details) return "";

      const actionDisabled = details.action?.disabled ? "true" : "false";
      const actionLabel = details.action?.label || "Выбрать";
      const distanceLabel =
        details.distanceMeters >= 1000
          ? `${(details.distanceMeters / 1000).toFixed(1)} км`
          : `${details.distanceMeters} м`;
      const travelLabel = formatDuration(details.travelMs);
      const stateLabel =
        details.hexKey === "0,0"
          ? "Якорь"
          : details.state === "locked"
            ? "Туман"
            : "Открыто";

      return `
        <div class="surroundings-map-details tone-${escapeHtml(details.tone || "neutral")}">
          <div class="surroundings-map-details-hero">
            <div>
              <div class="surroundings-map-details-overline">${escapeHtml(stateLabel)}</div>
              <div class="surroundings-map-details-title">${escapeHtml(details.hexKey === "0,0" ? "Лагерь" : "Окрестности")}</div>
            </div>
            <div class="surroundings-map-details-meta">
              <span class="surroundings-map-chip">${escapeHtml(distanceLabel)}</span>
              <span class="surroundings-map-chip">${escapeHtml(travelLabel)}</span>
            </div>
          </div>

          <div class="surroundings-map-details-text">${escapeHtml(details.action?.note || "")}</div>

          <div class="surroundings-map-action-box">
            <button
              class="surroundings-map-primary-action"
              type="button"
              data-surroundings-hex-action="${escapeHtml(details.action?.id || "")}"
              data-hex-key="${escapeHtml(details.hexKey || "")}"
              aria-disabled="${actionDisabled}"
            >${escapeHtml(actionLabel)}</button>
            <div class="surroundings-map-action-note">${escapeHtml(details.action?.note || "")}</div>
            ${
              details.companionAction
                ? `
            <button
              class="surroundings-map-companion-action"
              type="button"
              data-surroundings-hex-companion-action="${escapeHtml(details.companionAction.id || "")}"
              data-hex-key="${escapeHtml(details.hexKey || "")}"
              aria-disabled="${details.companionAction.disabled ? "true" : "false"}"
            >${escapeHtml(details.companionAction.label || "")}</button>
            <div class="surroundings-map-action-note">${escapeHtml(details.companionAction.note || "")}</div>`
                : ""
            }
          </div>
        </div>
      `;
    },

    renderSurroundingsMap() {
      const panel = document.getElementById("camp-map-panel");
      const inspectorHost = document.getElementById("shell-map-inspector-host");
      if (!panel) return;

      const mapState = this.game?.getSurroundingsHexMapState?.();
      if (!mapState) return;

      const details = this.game?.getSurroundingsHexDetails?.(
        mapState.selectedHexKey,
      );

      const terrainMarkup = (mapState.tiles || [])
        .map((tile) => {
          const pos = axialToPixel(tile.q || 0, tile.r || 0);
          const label = "";
          return `
            <button
              class="surroundings-map-hex terrain-${escapeHtml(tile.tone)}${tile.selected ? " is-selected" : ""}${tile.targeted ? " is-targeted" : ""}${tile.scoutable ? " is-scoutable" : ""}"
              style="left:${((pos.x / SCENE_WIDTH) * 100).toFixed(3)}%; top:${((pos.y / SCENE_HEIGHT) * 100).toFixed(3)}%;"
              type="button"
              data-surroundings-hex="${escapeHtml(tile.hexKey)}"
              aria-pressed="${tile.selected ? "true" : "false"}"
              title="${tile.scoutable ? "Разведка: 1⚡ · гекс и соседи" : ""}"
            >${label ? `<span>${escapeHtml(label)}</span>` : ""}</button>
          `;
        })
        .join("");

      const poiMarkup = (mapState.pois || [])
        .map((poi) => {
          const pos = axialToPixel(poi.q || 0, poi.r || 0);
          const eta = formatDuration(poi.travelMs || 0);
          return `
            <button
              class="surroundings-map-poi tone-${escapeHtml(poi.tone || "unknown")}"
              type="button"
              data-surroundings-hex="${escapeHtml(poi.hexKey)}"
              style="left:${((pos.x / SCENE_WIDTH) * 100).toFixed(3)}%; top:${((pos.y / SCENE_HEIGHT) * 100).toFixed(3)}%;"
              aria-label="${escapeHtml(poi.title || "Точка интереса")} (${escapeHtml(eta)})"
              title="${escapeHtml(poi.title || "")} · ${escapeHtml(eta)}"
            >
              <span class="surroundings-map-poi-icon" aria-hidden="true">${escapeHtml(poi.icon || "•")}</span>
              <span class="surroundings-map-poi-label" aria-hidden="true">${escapeHtml(poi.title || "")}</span>
            </button>
          `;
        })
        .join("");

      const selectedTile = (mapState.tiles || []).find((t) => t.selected) || null;
      const targetTile = (mapState.tiles || []).find((t) => t.targeted) || null;
      const routeFrom = { q: 0, r: 0 };
      const routeTo =
        mapState.campReady && (targetTile || selectedTile)
          ? {
              q: (targetTile || selectedTile).q || 0,
              r: (targetTile || selectedTile).r || 0,
            }
          : null;
      const routePoints = routeTo ? hexLineAxial(routeFrom, routeTo) : [];
      const routeSvgPoints = routePoints
        .map((p) => {
          const pos = axialToPixel(p.q || 0, p.r || 0);
          return `${pos.x.toFixed(1)},${pos.y.toFixed(1)}`;
        })
        .join(" ");
      const routeSvg =
        routeSvgPoints && routePoints.length > 1 && mapState.campReady
          ? `
            <svg class="surroundings-map-route" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <polyline class="surroundings-map-route-line" points="${routeSvgPoints}"></polyline>
            </svg>
          `
          : "";

      const travelSummary = (() => {
        if (!mapState.campReady) return null;
        const ref = targetTile || selectedTile;
        if (!ref) return null;
        const meters = Number(ref.distanceMeters) || 0;
        const kmLabel =
          meters >= 1000 ? `${(meters / 1000).toFixed(1)} км` : `${meters} м`;
        const eta = formatDuration(ref.travelMs || 0);
        return { kmLabel, eta, isTarget: !!targetTile };
      })();

      panel.innerHTML = `
        <div class="surroundings-map-root">
          <div class="surroundings-map-header">
            <div>
              <h3>${escapeHtml(mapState.title)}</h3>
              <div class="surroundings-map-description">${escapeHtml(mapState.description)}</div>
            </div>
            <div class="surroundings-map-header-right">
              ${this._getStrategicMapViewSwitchMarkup("surroundings")}
              <div class="surroundings-map-chip-row">
                <span class="surroundings-map-chip">${escapeHtml(mapState.scaleLabel)}</span>
                <span class="surroundings-map-chip">Гексов ${mapState.mapHexCount || 217}</span>
                <span class="surroundings-map-chip">Открыто: радиус ${mapState.startingOpenRadius || 0}</span>
              </div>
            </div>
          </div>

          <div class="surroundings-map-scene-wrap">
            <div class="surroundings-map-board">
              <aside class="surroundings-map-map-legend" aria-label="Легенда окрестностей">
                <div class="surroundings-map-map-legend-title">Легенда</div>
                <span><i class="legend-swatch tone-camp"></i>Лагерь</span>
                <span><i class="legend-swatch tone-forest"></i>Лес</span>
                <span><i class="legend-swatch tone-water"></i>Река / ручей</span>
                <span><i class="legend-swatch tone-clay"></i>Глинистый берег</span>
                <span><i class="legend-swatch tone-ridge"></i>Гряда</span>
                <span><i class="legend-swatch tone-unknown"></i>Неизвестно</span>
              </aside>
              <div class="surroundings-map-scene${mapState.campReady ? "" : " is-pre-camp"}">
                ${!mapState.campReady ? '<div class="surroundings-map-pre-camp-hint" aria-hidden="true"></div>' : ""}
                ${terrainMarkup}
                ${poiMarkup}
                ${routeSvg}
                <div class="surroundings-map-fog-overlay" aria-hidden="true"></div>
                <div class="surroundings-map-compass" aria-hidden="true"><span>N</span></div>
                <div class="surroundings-map-scale" aria-hidden="true"><span></span><b>0</b><b>250</b><b>500 м</b></div>
                ${
                  travelSummary
                    ? `<div class="surroundings-map-travel-hud" aria-hidden="true">
                        <span class="surroundings-map-travel-chip">${escapeHtml(travelSummary.isTarget ? "Цель" : "Выбрано")}</span>
                        <span class="surroundings-map-travel-chip">${escapeHtml(travelSummary.kmLabel)}</span>
                        <span class="surroundings-map-travel-chip">${escapeHtml(travelSummary.eta)}</span>
                      </div>`
                    : ""
                }
                <div class="surroundings-map-scene-caption">Окрестности — слой вылазок и маршрутов. Здесь нет “хождения” по каждому гексу, только расчёты расстояний и выбор целей.</div>
              </div>
            </div>
            <div class="surroundings-map-legend">${escapeHtml(mapState.interactionHint)}</div>
          </div>
        </div>
      `;

      if (inspectorHost) {
        inspectorHost.setAttribute(
          "aria-label",
          "Инспектор района окрестностей",
        );
        inspectorHost.innerHTML = this._renderSurroundingsMapDetails(details);
        inspectorHost.hidden = !details;
      }

      this._bindStrategicMapViewSwitch(panel);

      panel.querySelectorAll("[data-surroundings-hex]").forEach((button) => {
        button.addEventListener("click", () => {
          const hexKey = button.getAttribute("data-surroundings-hex") || "";
          if (!hexKey) return;
          this.game?.selectSurroundingsHexByKey?.(hexKey);
          this.render({ forcePanels: true });
        });

        button.addEventListener("dblclick", () => {
          const hexKey = button.getAttribute("data-surroundings-hex") || "";
          if (!hexKey || hexKey === "0,0") return;
          this.game?.selectSurroundingsHexByKey?.(hexKey);
          this.game?.setSurroundingsHexTarget?.(hexKey);
          this.render({ forcePanels: true });
        });
      });

      const bindSurroundingsInspectorAction = (button, isCompanion) => {
        if (!button) return;
        button.addEventListener("click", () => {
          const hexKey =
            button.getAttribute("data-hex-key") || details?.hexKey || "0,0";
          if (isCompanion) {
            const id = button.getAttribute("data-surroundings-hex-companion-action");
            if (
              !details?.companionAction ||
              details.companionAction.disabled ||
              id !== details.companionAction.id
            ) {
              return;
            }
            if (id === "enter_local_edge") {
              this.game?.focusLocalMapFromSurroundingsHex?.(hexKey);
            }
            this.render({ forcePanels: true });
            return;
          }

          if (!details?.action || details.action.disabled) return;

          switch (details.action.id) {
            case "enter_local":
              this.game?.focusLocalMapFromSurroundingsHex?.(hexKey);
              break;
            case "scout":
              this.game?.scoutSurroundingsHex?.(hexKey);
              break;
            case "set_target":
              this.game?.setSurroundingsHexTarget?.(hexKey);
              break;
            case "clear_target":
              this.game?.setSurroundingsHexTarget?.(null);
              break;
            default:
              return;
          }

          this.render({ forcePanels: true });
        });
      };

      bindSurroundingsInspectorAction(
        inspectorHost?.querySelector("[data-surroundings-hex-action]"),
        false,
      );
      bindSurroundingsInspectorAction(
        inspectorHost?.querySelector("[data-surroundings-hex-companion-action]"),
        true,
      );
    },
  });
})();
