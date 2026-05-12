// Work catalog (Stage 1A) — each entry wraps existing gather/craft/automation APIs via execute.

Object.assign(GAME_DATA, {
  workActions: {
    work_gather_branches: {
      id: "work_gather_branches",
      title: "Сбор веток",
      category: "gathering",
      description: "Сухие ветви и хворост для каркаса, топлива и первых связок.",
      workDurationMs: 4800,
      execute: { type: "gather", id: "gather_wood" },
    },
    work_gather_stone: {
      id: "work_gather_stone",
      title: "Сбор камня",
      category: "gathering",
      description: "Подбор камня с полезными сколами для опоры и орудия.",
      workDurationMs: 5200,
      execute: { type: "gather", id: "gather_stone" },
    },
    work_gather_fiber: {
      id: "work_gather_fiber",
      title: "Сбор волокна",
      category: "gathering",
      description: "Трава и длинные волокна для связок и первых узлов.",
      workDurationMs: 4600,
      execute: { type: "gather", id: "gather_fiber" },
    },
    work_search_tinder: {
      id: "work_search_tinder",
      title: "Поиск сухих волокон и растопки",
      category: "gathering",
      description:
        "Сухие волокна и мелкий сухой материал для растопки и первого огня; в прототипе это тот же шаг, что и сбор волокна.",
      workDurationMs: 4600,
      execute: { type: "gather", id: "gather_fiber" },
    },
    work_maintain_fire: {
      id: "work_maintain_fire",
      title: "Поддержать огонь",
      category: "camp",
      description:
        "Запустить или подтвердить цикл костра: снабжение и обжиг по правилам автоматизации костра.",
      execute: { type: "campfire_automation" },
    },
    work_shape_stone_edge: {
      id: "work_shape_stone_edge",
      title: "Обработать край камня",
      category: "gathering",
      description:
        "Подобрать и присмотреть камень с режущим сколом; механически используется тот же сбор камня.",
      workDurationMs: 5000,
      execute: { type: "gather", id: "gather_stone" },
    },
    work_bind_crude_tool: {
      id: "work_bind_crude_tool",
      title: "Связать грубое орудие",
      category: "craft",
      description: "Рецепт «Простые инструменты» в очереди крафта.",
      execute: { type: "craft", id: "craft_crude_tools" },
    },
    work_prepare_workplace: {
      id: "work_prepare_workplace",
      title: "Подготовить ремесленное место",
      category: "craft",
      description: "Поставить в очередь выпуск деталей мастерской — шаг к постоянному рабочему месту.",
      execute: { type: "craft", id: "craft_workshop_parts" },
    },
  },

  /** @returns {string[]} stable order for UI */
  workActionIdsOrdered: [
    "work_gather_branches",
    "work_gather_stone",
    "work_gather_fiber",
    "work_search_tinder",
    "work_maintain_fire",
    "work_shape_stone_edge",
    "work_bind_crude_tool",
    "work_prepare_workplace",
  ],
});
