import sys

with open("web/prototype/ui/map/camp-map-ui.js", "r", encoding="utf-8") as f:
    code = f.read()

with open("to_replace.js", "r", encoding="utf-8") as f:
    old_method = f.read()

with open("meeple.js", "r", encoding="utf-8") as f:
    new_travel_method = f.read().strip()

idle_method = """

  _buildIdleCharacterOverlaySvg(tileCoordById, mapState) {
    if (this._campTravelAction) return "";
    const campTile =
      mapState.tiles.find((t) => t.state === "camp") ||
      mapState.tiles.find((t) => t.id === "camp_clearing") ||
      mapState.tiles.find((t) => (t.distanceFromCamp || 0) === 0) ||
      null;
    const startCoord = campTile ? tileCoordById[campTile.id] : null;
    if (!startCoord) return "";

    const markerX = startCoord.x;
    const markerY = startCoord.y;
    const bob = Math.sin(Date.now() / 200) * 1.5;

    return `<g class="camp-map-travel-layer idle-character" aria-hidden="true">
      <g class="camp-map-traveler phase-gather" transform="translate(${markerX.toFixed(1)} ${(markerY + bob).toFixed(1)})">
        <ellipse class="traveler-shadow" cx="0" cy="19" rx="14" ry="4.8" />
        <g class="traveler-body-wrap">
          <!-- Sleek minimalist icon/meeple body -->
          <path class="traveler-pawn-body" d="M 0 -7 C -9 -5, -11 11, -9 18 C -8 21, -6 20, -4 14 C -3 10, 3 10, 4 14 C 6 20, 8 21, 9 18 C 11 11, 9 -5, 0 -7 Z" />
          <!-- Head -->
          <circle class="traveler-pawn-head" cx="0" cy="-15" r="5.5" />
          
          <!-- Spear (minimalist) - resting -->
          <path class="traveler-tool" d="M 12 -20 L 10 16" />
          <circle class="traveler-tool-head" cx="12" cy="-20" r="2.5" />
        </g>
      </g>
    </g>`;
  },
"""

# Replace the travel method and insert the idle method right below it
new_code = code.replace(old_method, new_travel_method + idle_method)

# Inject the idle overlay call in updateCampMap
old_inject = """      const travelOverlay = this._buildTravelOverlaySvg(
        tileCoordById,
        mapState,
      );

      svgEl.innerHTML = `${tileGroups}${travelOverlay}`;"""

new_inject = """      const travelOverlay = this._buildTravelOverlaySvg(
        tileCoordById,
        mapState,
      );
      const idleOverlay = this._buildIdleCharacterOverlaySvg(
        tileCoordById,
        mapState,
      );

      svgEl.innerHTML = `${tileGroups}${travelOverlay}${idleOverlay}`;"""

if old_inject in new_code:
    new_code = new_code.replace(old_inject, new_inject)
else:
    print("WARNING: Could not find old_inject block in updateCampMap!")

with open("web/prototype/ui/map/camp-map-ui.js", "w", encoding="utf-8") as f:
    f.write(new_code)

print("Done replacing.")
