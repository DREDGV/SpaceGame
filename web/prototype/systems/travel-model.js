// TravelModel: shared travel and logistics calculations (scale-agnostic).
// Loaded as a plain script (no modules). Safe to use from GameState/UI.

(() => {
  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

  const metersPerSecondFromKmh = (kmh) => (Number(kmh) || 0) / 3.6;

  const PATH_LEVEL_RANK = {
    none: 0,
    trace: 1,
    footpath: 2,
    stable_footpath: 3,
    trail: 4,
    built_trail: 4,
    dirt_road: 5,
  };

  const PATH_SPEED_MULTIPLIER = {
    // Multiplier on baseline speed when the route is mostly of this quality.
    // This is intentionally conservative; higher scales can override later.
    none: 0.85,
    trace: 0.92,
    footpath: 1.0,
    stable_footpath: 1.08,
    trail: 1.12,
    built_trail: 1.15,
    dirt_road: 1.22,
  };

  const DEFAULT_TRANSPORTS = {
    foot: {
      id: "foot",
      label: "Пешком",
      baseSpeedKmh: 4,
      loadPenaltyMax: 0.25, // at max load factor
    },
    pack: {
      id: "pack",
      label: "С грузом",
      baseSpeedKmh: 3,
      loadPenaltyMax: 0.3,
    },
    cart: {
      id: "cart",
      label: "Повозка",
      baseSpeedKmh: 6,
      loadPenaltyMax: 0.18,
      requiresPathRank: 2, // footpath+
    },
    caravan: {
      id: "caravan",
      label: "Караван",
      baseSpeedKmh: 8,
      loadPenaltyMax: 0.22,
      requiresPathRank: 4, // trail+
    },
  };

  function getPathRank(pathLevel = "none") {
    return PATH_LEVEL_RANK[pathLevel] || 0;
  }

  function getPathSpeedMultiplier(pathLevel = "none") {
    return PATH_SPEED_MULTIPLIER[pathLevel] || PATH_SPEED_MULTIPLIER.none;
  }

  function canUseTransportOnPath(transport, pathLevel = "none") {
    const def = DEFAULT_TRANSPORTS[transport] || null;
    if (!def) return false;
    const required = Number(def.requiresPathRank) || 0;
    return getPathRank(pathLevel) >= required;
  }

  /**
   * Compute travel time for a route as a single segment.
   *
   * Inputs are intentionally generic so this can be reused on
   * surroundings/region/world scales.
   */
  function computeTravelTimeMs({
    distanceMeters = 0,
    transport = "foot",
    pathLevel = "none",
    // 0..1; 0 means no extra load, 1 means max-load (slowest).
    loadFactor = 0,
    // 0.6..1.6; terrain difficulty multiplier when there is no solid path.
    terrainFactor = 1,
    // 0.6..1.6; safety/threat/visibility penalty multiplier (optional).
    riskFactor = 1,
  } = {}) {
    const dist = Math.max(0, Number(distanceMeters) || 0);
    const def = DEFAULT_TRANSPORTS[transport] || DEFAULT_TRANSPORTS.foot;

    const baseSpeed = metersPerSecondFromKmh(def.baseSpeedKmh || 4);
    const pathMult = getPathSpeedMultiplier(pathLevel);
    const loadPenaltyMax = clamp(Number(def.loadPenaltyMax) || 0, 0, 0.6);
    const loadMult = 1 - clamp(loadFactor, 0, 1) * loadPenaltyMax;

    const useTerrainFactor = getPathRank(pathLevel) <= PATH_LEVEL_RANK.none;
    const terrainMult = useTerrainFactor ? 1 / clamp(terrainFactor, 0.6, 1.6) : 1;
    const riskMult = 1 / clamp(riskFactor, 0.6, 1.6);

    const speed = Math.max(0.25, baseSpeed * pathMult * loadMult * terrainMult * riskMult);
    return Math.round((dist / speed) * 1000);
  }

  function computeDistanceMeters({
    hexCount = 0,
    metersPerHex = 20,
  } = {}) {
    const steps = Math.max(0, Math.floor(Number(hexCount) || 0));
    const scale = Math.max(1, Number(metersPerHex) || 20);
    return steps * scale;
  }

  window.TravelModel = Object.freeze({
    getPathRank,
    getPathSpeedMultiplier,
    canUseTransportOnPath,
    computeTravelTimeMs,
    computeDistanceMeters,
    DEFAULT_TRANSPORTS: Object.freeze({ ...DEFAULT_TRANSPORTS }),
    PATH_LEVEL_RANK: Object.freeze({ ...PATH_LEVEL_RANK }),
  });
})();

