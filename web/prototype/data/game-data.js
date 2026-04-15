// Game data definitions — Primitive Stage (Core Loop v4: Onboarding)

const GAME_DATA = {
  // ─── Onboarding ───
  onboarding: {
    introLines: [
      "Вы прибыли в неизвестную землю.",
      "Ни инструментов, ни производства — только сырые ресурсы.",
      "Начните собирать ресурсы и постройте основу колонии.",
    ],

    steps: [
      {
        id: "ob_gather_wood",
        text: "Соберите 5 дерева",
        hint: "Нажмите «Собрать дерево» в панели сбора ресурсов",
        check: (game) => (game.resources.wood || 0) >= 5,
      },
      {
        id: "ob_craft_plank",
        text: "Сделайте доски",
        hint: "Крафт → Сделать доски: 2 дерева → 1 доска",
        check: (game) => (game.resources.plank || 0) >= 1,
      },
      {
        id: "ob_craft_tools",
        text: "Создайте простые инструменты",
        hint: "Крафт → Простые инструменты: 1 дерево + 2 камня",
        check: (game) => (game.resources.crude_tools || 0) >= 1,
      },
      {
        id: "ob_build_campfire",
        text: "Постройте костёр",
        hint: "Здания → Костёр: 5 дерева + 3 камня. Он начнёт автоматически жечь кирпичи!",
        check: (game) => !!game.buildings.campfire,
      },
      {
        id: "ob_auto_brick",
        text: "Костёр произвёл кирпич! Наблюдайте за автоматизацией",
        hint: "Костёр работает сам — собирайте глину, и он будет жечь кирпичи каждые 10 секунд",
        check: (game) => (game.resources.brick || 0) >= 1,
      },
    ],

    completeMessage:
      "🎉 Обучение пройдено! Теперь вы знаете основы. Играйте свободнее!",
  },

  // ─── Regular goals (post-onboarding) ───
  goals: [
    {
      id: "goal_wood_10",
      text: "Соберите 10 дерева",
      target: 10,
      progress: (game) => game.resourceTotals.wood || 0,
      check: (game) => (game.resourceTotals.wood || 0) >= 10,
      description: "Это первая сырьевая опора экономики. Дерево нужно для досок, топлива и ранних построек.",
      hint: "Нажимайте «Собрать дерево» до достижения 10 добытых единиц. Тратиться дерево может, но прогресс цели считается по добыче.",
    },
    {
      id: "goal_tools",
      text: "Создайте простые инструменты",
      target: 1,
      progress: (game) => ((game.resourceTotals.crude_tools || 0) >= 1 ? 1 : 0),
      check: (game) => (game.resourceTotals.crude_tools || 0) >= 1,
      description: "Инструменты повышают эффективность ручного труда и открывают ранние производственные развилки.",
      hint: "Сначала соберите 1 дерево и 2 камня, затем откройте крафт простых инструментов и создайте хотя бы один набор.",
    },
    {
      id: "goal_workshop",
      text: "Постройте мастерскую",
      target: 1,
      progress: (game) => (game.buildings.workshop ? 1 : 0),
      check: (game) => !!game.buildings.workshop,
      description: "Мастерская переводит игру в более глубокую производственную цепочку.",
      hint: "Потребуются дерево, доски и детали мастерской. Сначала откройте их через крафт.",
    },
    {
      id: "goal_campfire",
      text: "Постройте костёр",
      target: 1,
      progress: (game) => (game.buildings.campfire ? 1 : 0),
      check: (game) => !!game.buildings.campfire,
      description: "Костёр запускает первую автоматизацию: обжиг кирпича без постоянного ручного действия.",
      hint: "Соберите 5 дерева и 3 камня, затем постройте костёр в панели зданий.",
    },
    {
      id: "goal_brick_3",
      text: "Произведите 3 кирпича (ручной крафт или автоматизация)",
      target: 3,
      progress: (game) => game.resourceTotals.brick || 0,
      check: (game) => (game.resourceTotals.brick || 0) >= 3,
      description: "Кирпичи нужны для более плотной производственной базы и следующих построек.",
      hint: "Достаточно суммарно произвести 3 кирпича. Можно обжигать вручную или дать это костру.",
    },
    {
      id: "goal_kiln",
      text: "Постройте печь для обжига — начало индустриализации",
      target: 1,
      progress: (game) => (game.buildings.kiln ? 1 : 0),
      check: (game) => !!game.buildings.kiln,
      description: "Печь замыкает раннюю цепочку обжига и открывает поздние технологические шаги.",
      hint: "Потребуются глина, камень, кирпичи и детали мастерской. Сначала подготовьте ресурсы и постройте мастерскую.",
    },
  ],

  // ─── Resources ───
  resources: {
    wood: {
      name: "Дерево",
      icon: "🪵",
      color: "#8B5A2B",
      description: "Базовое сырье для досок, топлива и строительства.",
    },
    stone: {
      name: "Камень",
      icon: "🪨",
      color: "#808080",
      description: "Твердое сырье для инструментов и строительных деталей.",
    },
    clay: {
      name: "Глина",
      icon: "🏺",
      color: "#B22222",
      description: "Сырье для кирпича и ранней обжиговой цепочки.",
    },
    fiber: {
      name: "Волокно",
      icon: "🌿",
      color: "#228B22",
      description: "Легкий материал для связок, веревок и улучшений.",
    },
    plank: {
      name: "Доски",
      icon: "▭▭",
      color: "#DEB887",
      description: "Обработанное дерево для зданий и более сложных рецептов.",
    },
    crude_tools: {
      name: "Простые инструменты",
      icon: "🔧",
      color: "#696969",
      description: "Повышают ручной сбор и открывают первые производственные развилки.",
    },
    workshop_parts: {
      name: "Детали мастерской",
      icon: "🔩",
      color: "#778899",
      description: "Переходный компонент для зданий и улучшенных инструментов.",
    },
    improved_tools: {
      name: "Улучшенные инструменты",
      icon: "🛠️",
      color: "#2F4F4F",
      description: "Сильнее ускоряют ручной сбор, чем примитивные инструменты.",
    },
    brick: {
      name: "Кирпичи",
      icon: "🧱",
      color: "#CD5C5C",
      description: "Материал для прогрессивных построек и дальнейшего развития.",
    },
  },

  // ─── Energy ───
  energy: {
    max: 10,
    regenPerTick: 1,
    regenIntervalMs: 5000,
  },

  // ─── Gathering ───
  gatherActions: {
    gather_wood: {
      id: "gather_wood",
      name: "Собрать дерево",
      icon: "🪓",
      output: { wood: 1 },
      energyCost: 1,
      cooldown: 1000,
      unlockedBy: null,
      description: "Базовый сбор для всех ранних цепочек.",
    },
    gather_stone: {
      id: "gather_stone",
      name: "Добыть камень",
      icon: "⛏️",
      output: { stone: 1 },
      energyCost: 1,
      cooldown: 1200,
      unlockedBy: null,
      description: "Нужен для инструментов и деталей мастерской.",
    },
    gather_clay: {
      id: "gather_clay",
      name: "Собрать глину",
      icon: "🤲",
      output: { clay: 1 },
      energyCost: 1,
      cooldown: 1000,
      unlockedBy: null,
      description: "Запускает ветку кирпича и обжига.",
    },
    gather_fiber: {
      id: "gather_fiber",
      name: "Собрать волокно",
      icon: "🌾",
      output: { fiber: 1 },
      energyCost: 1,
      cooldown: 800,
      unlockedBy: null,
      description: "Полезно для улучшений и построек, где нужен связующий материал.",
    },
  },

  // ─── Recipes ───
  recipes: {
    craft_plank: {
      id: "craft_plank",
      name: "Сделать доски",
      icon: "🪵",
      output: { plank: 1 },
      ingredients: { wood: 2 },
      requires: null,
      unlockedBy: null,
      description: "Дерево → Доски",
    },
    craft_workshop_parts: {
      id: "craft_workshop_parts",
      name: "Детали мастерской",
      icon: "🔩",
      output: { workshop_parts: 1 },
      ingredients: { wood: 2, stone: 2 },
      requires: null,
      unlockedBy: null,
      description: "Дерево + камень → Детали мастерской",
    },
    craft_crude_tools: {
      id: "craft_crude_tools",
      name: "Простые инструменты",
      icon: "🔨",
      output: { crude_tools: 1 },
      ingredients: { wood: 1, stone: 2 },
      requires: null,
      unlockedBy: null,
      description: "Дерево + Камень → Инструменты",
    },
    craft_improved_tools: {
      id: "craft_improved_tools",
      name: "Улучшенные инструменты",
      icon: "🛠️",
      output: { improved_tools: 1 },
      ingredients: { plank: 2, fiber: 2, crude_tools: 1 },
      requires: "workshop",
      unlockedBy: null,
      description: "Доски + Волокно + Простой инструмент → Улучшенные инструменты",
    },
    craft_brick: {
      id: "craft_brick",
      name: "Обжечь кирпич",
      icon: "🔥",
      output: { brick: 1 },
      ingredients: { clay: 2, wood: 1 },
      requires: "campfire",
      unlockedBy: null,
      description: "Глина + Древесина → Кирпич (требует Костёр)",
    },
  },

  // ─── Buildings ───
  buildings: {
    storage: {
      id: "storage",
      name: "Хранилище",
      icon: "🏚️",
      description: "Увеличивает лимит ресурсов до 120",
      cost: { wood: 8, fiber: 5, plank: 2 },
      effect: { maxResourceCap: 120 },
      unlockedBy: null,
    },
    campfire: {
      id: "campfire",
      name: "Костёр",
      icon: "🔥",
      description:
        "Автоматически обжигает кирпичи из глины и древесного топлива (1 кирпич / 10 сек). Открывает ручной крафт кирпича.",
      cost: { wood: 5, stone: 3 },
      effect: {
        unlocks: ["craft_brick"],
        automation: {
          id: "campfire_brick",
          name: "Обжиг кирпича",
          input: { clay: 1, wood: 1 },
          output: { brick: 1 },
          intervalMs: 10000,
          description: "Глина + Древесина → Кирпич",
        },
      },
      unlockedBy: null,
    },
    workshop: {
      id: "workshop",
      name: "Мастерская",
      icon: "🔧",
      description: "Открывает улучшенные инструменты и сложные цепочки",
      cost: { wood: 6, plank: 3, workshop_parts: 2 },
      effect: { unlocks: ["craft_improved_tools"] },
      unlockedBy: null,
    },
    rest_tent: {
      id: "rest_tent",
      name: "Палатка отдыха",
      icon: "⛺",
      description: "Повышает запас энергии и ускоряет восстановление",
      cost: { wood: 4, plank: 2, fiber: 4 },
      effect: {
        energy: { maxBonus: 3, regenIntervalBonusMs: 1500 },
      },
      unlockedBy: "rest_discipline",
    },
    kiln: {
      id: "kiln",
      name: "Печь для обжига",
      icon: "🏺",
      description: "Требуется для поздних производственных шагов",
      cost: { clay: 8, stone: 5, brick: 3, workshop_parts: 1 },
      effect: {},
      unlockedBy: null,
      requires: "workshop",
    },
  },

  // ─── Tech ───
  tech: {
    basic_tools: {
      id: "basic_tools",
      name: "Базовые инструменты",
      icon: "🛠️",
      description: "Добавляет +1 к ручному сбору ресурсов",
      cost: { crude_tools: 2 },
      effect: { gatherBonus: 1 },
      unlockedBy: null,
      requires: null,
    },
    crafting: {
      id: "crafting",
      name: "Ремесло",
      icon: "⚒️",
      description: "Снижает стоимость крафта на 10%",
      cost: { plank: 5, crude_tools: 1 },
      effect: { craftDiscount: 0.1 },
      unlockedBy: null,
      requires: "workshop",
    },
    rest_discipline: {
      id: "rest_discipline",
      name: "Режим отдыха",
      icon: "🛏️",
      description: "Увеличивает запас энергии и слегка ускоряет восстановление",
      cost: { fiber: 4, crude_tools: 1 },
      effect: {
        energy: { maxBonus: 1, regenIntervalBonusMs: 500 },
      },
      unlockedBy: null,
      requires: "campfire",
    },
    mining: {
      id: "mining",
      name: "Горное дело",
      icon: "⛏️",
      description: "(Заглушка) Открывает глубокую добычу",
      cost: { stone: 20, crude_tools: 3 },
      effect: {},
      unlockedBy: null,
      requires: "kiln",
    },
  },
};
