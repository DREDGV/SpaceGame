  _buildTravelOverlaySvg(tileCoordById, mapState) {
    if (!this._campTravelAction) return "";
    const targetCoord = tileCoordById[this._campTravelAction.tileId] || null;
    const campTile =
      mapState.tiles.find((t) => t.state === "camp") ||
      mapState.tiles.find((t) => t.id === "camp_clearing") ||
      mapState.tiles.find((t) => (t.distanceFromCamp || 0) === 0) ||
      null;
    const startCoord = campTile ? tileCoordById[campTile.id] : null;
    if (!targetCoord || !startCoord) return "";
    const travelState = this._getCampTravelPhaseState(this._campTravelAction);
    if (!travelState) return "";
    const targetTile =
      mapState.tiles.find(
        (tile) => tile.id === this._campTravelAction.tileId,
      ) || null;
    const actionId = this._campTravelAction.actionId || "";
    const action = this.data.gatherActions?.[actionId] || null;
    const outputIds = Object.keys(action?.output || {});
    const carriedResourceId =
      targetTile?.resourceType ||
      outputIds[0] ||
      (actionId === "gather_supplies" ? "supplies" : "");
    const resourceClass = carriedResourceId
      ? ` resource-${String(carriedResourceId).replace(/[^a-z0-9_-]/gi, "")}`
      : "";

    // ── Tile-by-tile path interpolation ──
    const task = this._campTravelAction;
    const outPath = task.path;
    const outTimings = task.pathTimings;
    const retPath = task.returnPath;
    const retTimings = task.returnTimings;

    let markerX = startCoord.x;
    let markerY = startCoord.y;

    if (travelState.phase === "outbound" && outPath?.length > 1 && outTimings) {
      const pos = this._interpolateAlongPath(
        outPath,
        outTimings,
        travelState.progress,
        tileCoordById,
      );
      markerX =
        pos?.x ??
        startCoord.x + (targetCoord.x - startCoord.x) * travelState.progress;
      markerY =
        pos?.y ??
        startCoord.y + (targetCoord.y - startCoord.y) * travelState.progress;
    } else if (travelState.phase === "gather") {
      markerX = targetCoord.x;
      markerY = targetCoord.y;
    } else if (
      travelState.phase === "return" &&
      retPath?.length > 1 &&
      retTimings
    ) {
      const pos = this._interpolateAlongPath(
        retPath,
        retTimings,
        travelState.progress,
        tileCoordById,
      );
      markerX =
        pos?.x ??
        targetCoord.x + (startCoord.x - targetCoord.x) * travelState.progress;
      markerY =
        pos?.y ??
        targetCoord.y + (startCoord.y - targetCoord.y) * travelState.progress;
    } else {
      // Fallback: linear interpolation (no path data)
      if (travelState.phase === "outbound") {
        markerX =
          startCoord.x + (targetCoord.x - startCoord.x) * travelState.progress;
        markerY =
          startCoord.y + (targetCoord.y - startCoord.y) * travelState.progress;
      } else if (travelState.phase === "return") {
        markerX =
          targetCoord.x + (startCoord.x - targetCoord.x) * travelState.progress;
        markerY =
          targetCoord.y + (startCoord.y - targetCoord.y) * travelState.progress;
      }
    }

    // ── Route line: polyline through hex tile centres ──
    let routeD;
    if (outPath?.length > 1) {
      const pathCoords = outPath.map((id) => tileCoordById[id]).filter(Boolean);
      routeD = pathCoords
        .map(
          (c, i) =>
            `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
        )
        .join(" ");
    } else {
      routeD = `M ${startCoord.x.toFixed(1)} ${startCoord.y.toFixed(1)} L ${targetCoord.x.toFixed(1)} ${targetCoord.y.toFixed(1)}`;
    }

    const routeClass =
      travelState.phase === "return"
        ? "camp-map-travel-route is-return"
        : "camp-map-travel-route";
    const markerClass =
      travelState.phase === "gather"
        ? "camp-map-travel-marker is-gathering"
        : "camp-map-travel-marker";
    const actionLabel =
      travelState.phase === "gather"
        ? travelState.phaseLabel
        : travelState.phase === "return"
          ? "Несёт добычу"
          : "Идёт к участку";
    const phaseClass = ` phase-${travelState.phase}`;
    const directionClass =
      travelState.phase === "return" ? " facing-home" : " facing-target";
    const bob =
      travelState.phase === "gather" ? 0 : Math.sin(Date.now() / 120) * 1.4;
    const footDust =
      travelState.phase === "gather"
        ? ""
        : `<g class="camp-map-traveler-dust">
            <circle cx="-13" cy="16" r="1.7" />
            <circle cx="12" cy="17" r="1.2" />
          </g>`;
    const gatherFx =
      travelState.phase === "gather"
        ? `<g class="camp-map-gather-fx${resourceClass}">
            <path class="gather-fx-spark a" d="M -18 -4 L -10 -10" />
            <path class="gather-fx-spark b" d="M 13 -8 L 21 -15" />
            <circle class="gather-fx-dot" cx="18" cy="1" r="2" />
          </g>`
        : "";

    return `<g class="camp-map-travel-layer" aria-hidden="true">
      <path class="${routeClass}" d="${routeD}" />
      <circle class="${markerClass}" cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="11" />
      <g class="camp-map-traveler${phaseClass}${directionClass}${resourceClass}" transform="translate(${markerX.toFixed(1)} ${(markerY + bob).toFixed(1)})">
        <ellipse class="traveler-shadow" cx="0" cy="19" rx="14" ry="4.8" />
        ${footDust}
        <g class="traveler-body-wrap">
          <!-- Sleek minimalist icon/meeple body -->
          <path class="traveler-pawn-body" d="M 0 -7 C -9 -5, -11 11, -9 18 C -8 21, -6 20, -4 14 C -3 10, 3 10, 4 14 C 6 20, 8 21, 9 18 C 11 11, 9 -5, 0 -7 Z" />
          <!-- Head -->
          <circle class="traveler-pawn-head" cx="0" cy="-15" r="5.5" />

          <!-- Spear (minimalist) -->
          <path class="traveler-tool" d="M 12 -22 L 10 14" />
          <circle class="traveler-tool-head" cx="12" cy="-22" r="2.5" />

          <!-- Carry items (back, visible on return) -->
          <g class="traveler-carry">
            <path class="carry-wood" d="M -11 -5 L -18 -15 M -8 -6 L -14 -17 M -4 -5 L -10 -16" />
            <path class="carry-sack" d="M -10 0 C -17 3 -15 11 -8 13 C -2 10 -3 2 -10 0 Z" />
            <circle class="carry-water" cx="-11" cy="5" r="4" />
          </g>
        </g>
        ${gatherFx}
      </g>
      <g class="camp-map-travel-label" transform="translate(${markerX.toFixed(1)} ${(markerY - 28).toFixed(1)})">
        <text class="camp-map-travel-action" x="0" y="-8">${actionLabel}</text>
        <text class="camp-map-travel-timer" x="0" y="5">${this.formatCooldownMs(travelState.totalRemainingMs)}</text>
      </g>
    </g>`;
  },

  getCampTileStateLabel(state) {
    switch (state) {
      case "developed":
        return "Освоено";
