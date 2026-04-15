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
    },
    {
      id: "goal_tools",
      text: "Создайте простые инструменты",
      target: 1,
      progress: (game) => ((game.resourceTotals.crude_tools || 0) >= 1 ? 1 : 0),
      check: (game) => (game.resourceTotals.crude_tools || 0) >= 1,
    },
    {
      id: "goal_workshop",
      text: "Постройте мастерскую",
      target: 1,
      progress: (game) => (game.buildings.workshop ? 1 : 0),
      check: (game) => !!game.buildings.workshop,
    },
    {
      id: "goal_campfire",
      text: "Постройте костёр",
      target: 1,
      progress: (game) => (game.buildings.campfire ? 1 : 0),
      check: (game) => !!game.buildings.campfire,
    },
    {
      id: "goal_brick_3",
      text: "Произведите 3 кирпича (ручной крафт или автоматизация)",
      target: 3,
      progress: (game) => game.resourceTotals.brick || 0,
      check: (game) => (game.resourceTotals.brick || 0) >= 3,
    },
    {
      id: "goal_kiln",
      text: "Постройте печь для обжига — начало индустриализации",
      target: 1,
      progress: (game) => (game.buildings.kiln ? 1 : 0),
      check: (game) => !!game.buildings.kiln,
    },
  ],

  // ─── Resources ───
  resources: {
    wood: { name: "Дерево", icon: "🪵", color: "#8B5A2B" },
    stone: { name: "Камень", icon: "🪨", color: "#808080" },
    clay: { name: "Глина", icon: "🧱", color: "#B22222" },
    fiber: { name: "Волокно", icon: "🌿", color: "#228B22" },
    plank: { name: "Доски", icon: "📦", color: "#DEB887" },
    crude_tools: { name: "Простые инструменты", icon: "🔧", color: "#696969" },
    brick: { name: "Кирпичи", icon: "🧱", color: "#CD5C5C" },
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
    },
    gather_stone: {
      id: "gather_stone",
      name: "Добыть камень",
      icon: "⛏️",
      output: { stone: 1 },
      energyCost: 1,
      cooldown: 1200,
      unlockedBy: null,
    },
    gather_clay: {
      id: "gather_clay",
      name: "Собрать глину",
      icon: "🤲",
      output: { clay: 1 },
      energyCost: 1,
      cooldown: 1000,
      unlockedBy: null,
    },
    gather_fiber: {
      id: "gather_fiber",
      name: "Собрать волокно",
      icon: "🌾",
      output: { fiber: 1 },
      energyCost: 1,
      cooldown: 800,
      unlockedBy: null,
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
    craft_brick: {
      id: "craft_brick",
      name: "Обжечь кирпич",
      icon: "🔥",
      output: { brick: 1 },
      ingredients: { clay: 2 },
      requires: "campfire",
      unlockedBy: null,
      description: "Глина → Кирпич (требует Костёр)",
    },
  },

  // ─── Buildings ───
  buildings: {
    storage: {
      id: "storage",
      name: "Хранилище",
      icon: "🏚️",
      description: "Увеличивает лимит ресурсов до 200",
      cost: { wood: 10, fiber: 5 },
      effect: { maxResourceCap: 200 },
      unlockedBy: null,
    },
    campfire: {
      id: "campfire",
      name: "Костёр",
      icon: "🔥",
      description:
        "Автоматически обжигает кирпичи из глины (1 кирпич / 10 сек). Открывает ручной крафт кирпича.",
      cost: { wood: 5, stone: 3 },
      effect: {
        unlocks: ["craft_brick"],
        automation: {
          id: "campfire_brick",
          name: "Обжиг кирпича",
          input: { clay: 1 },
          output: { brick: 1 },
          intervalMs: 10000,
          description: "Глина → Кирпич",
        },
      },
      unlockedBy: null,
    },
    workshop: {
      id: "workshop",
      name: "Мастерская",
      icon: "🔧",
      description: "Улучшает крафт инструментов",
      cost: { wood: 8, plank: 3 },
      effect: {},
      unlockedBy: null,
    },
    kiln: {
      id: "kiln",
      name: "Печь для обжига",
      icon: "🏺",
      description: "Улучшает производство (открывает исследования)",
      cost: { clay: 10, stone: 5, brick: 3 },
      effect: {},
      unlockedBy: null,
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
