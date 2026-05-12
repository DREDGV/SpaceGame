// Stage 2C — каталог приоритетов «распорядок стоянки» (только данные).

(function () {
  if (typeof GAME_DATA === "undefined") return;

  GAME_DATA.campRoutinePriorityOrder = [
    "keep_fuel_stock",
    "keep_stone_stock",
    "keep_fiber_stock",
    "prepare_basic_materials",
  ];

  GAME_DATA.campRoutineDefaultTargets = {
    wood: 8,
    stone: 6,
    fiber: 6,
  };

  GAME_DATA.campRoutinePrioritiesById = {
    keep_fuel_stock: {
      id: "keep_fuel_stock",
      gatherActionId: "gather_wood",
      resourceId: "wood",
    },
    keep_stone_stock: {
      id: "keep_stone_stock",
      gatherActionId: "gather_stone",
      resourceId: "stone",
    },
    keep_fiber_stock: {
      id: "keep_fiber_stock",
      gatherActionId: "gather_fiber",
      resourceId: "fiber",
    },
    prepare_basic_materials: {
      id: "prepare_basic_materials",
      mode: "min_deficit",
      resourceIds: ["wood", "stone", "fiber"],
      gatherByResource: {
        wood: "gather_wood",
        stone: "gather_stone",
        fiber: "gather_fiber",
      },
    },
  };
})();
