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

    let markerX = startCoord.x;
    let markerY = startCoord.y;
    if (travelState.phase === "outbound") {
      markerX =
        startCoord.x + (targetCoord.x - startCoord.x) * travelState.progress;
      markerY =
        startCoord.y + (targetCoord.y - startCoord.y) * travelState.progress;
    } else if (travelState.phase === "gather") {
      markerX = targetCoord.x;
      markerY = targetCoord.y;
    } else {
      markerX =
        targetCoord.x + (startCoord.x - targetCoord.x) * travelState.progress;
      markerY =
        targetCoord.y + (startCoord.y - targetCoord.y) * travelState.progress;
    }

    const routeClass =
      travelState.phase === "return"
        ? "camp-map-travel-route is-return"
        : "camp-map-travel-route";
    const markerClass =
      travelState.phase === "gather"
        ? "camp-map-travel-marker is-gathering"
        : "camp-map-travel-marker";

    return `<g class="camp-map-travel-layer" aria-hidden="true">
      <path class="${routeClass}" d="M ${startCoord.x.toFixed(1)} ${startCoord.y.toFixed(1)} L ${targetCoord.x.toFixed(1)} ${targetCoord.y.toFixed(1)}" />
      <circle class="${markerClass}" cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="8" />
      <text class="camp-map-travel-icon" x="${markerX.toFixed(1)}" y="${(markerY + 0.5).toFixed(1)}">🧍</text>
      <text class="camp-map-travel-timer" x="${markerX.toFixed(1)}" y="${(markerY - 14).toFixed(1)}">${this.formatCooldownMs(travelState.totalRemainingMs)}</text>
    </g>`;
  },

