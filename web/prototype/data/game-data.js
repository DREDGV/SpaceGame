// Game data definitions — Primitive Stage (Core Loop v4: Onboarding)

const GAME_DATA = {
  // ─── Onboarding ───
  onboarding: {
    introLines: [
      "Десятки тысяч лет назад человек был лишь хрупкой частью сурового мира. Вокруг простирались леса, камень, холодные реки и тьма ночи. Не было ни городов, ни дорог, ни мастерских — только природа, страх, голод и медленно рождающийся разум.",
      "Ваши люди ещё не знают ремёсел, не владеют сложными орудиями и не умеют подчинять мир своей воле. Каждый собранный ресурс, каждый инструмент, каждый костёр — это не мелочь, а шаг к выживанию. Из простого укрытия однажды вырастет поселение. Из поселения — общество. Из общества — цивилизация.",
      "Сейчас у вас нет почти ничего: лишь руки, воля к жизни и возможность сделать первый выбор.",
      "Так начинается долгий путь человечества — от первого костра к великому будущему.",
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
        hint: "Здания → Костёр: 4 дерева + 3 камня. Он начнёт автоматически жечь кирпичи!",
        check: (game) => !!game.buildings.campfire,
      },
      {
        id: "ob_auto_brick",
        text: "Костёр произвёл кирпич! Наблюдайте за автоматизацией",
        hint: "Костёр работает сам — собирайте глину, и он будет жечь кирпичи каждые 7 секунд",
        check: (game) => (game.resources.brick || 0) >= 1,
      },
    ],

    completeMessage:
      "🎉 Обучение пройдено! Теперь вы знаете основы. Играйте свободнее!",
  },

  // ─── Regular goals (post-onboarding) ───
  goals: [
    {
      id: "goal_accelerate_gathering",
      text: "Ускорьте добычу ресурсов",
      target: 1,
      progress: (game) => (game._getGatherBonus() >= 1 ? 1 : 0),
      check: (game) => game._getGatherBonus() >= 1,
      description:
        "Ручной труд должен стать эффективнее. Иначе энергия и время будут сжигаться впустую.",
      hint: "Сделайте простые инструменты или изучите базовые инструменты, чтобы получать больше ресурсов за одно действие.",
      completeText:
        "Добыча ускорилась. Теперь каждое ручное действие даёт больше и открывает пространство для планирования.",
    },
    {
      id: "goal_prepare_throughput",
      text: "Подготовьте производственную основу",
      target: 3,
      progress: (game) => {
        let value = 0;
        if ((game.resourceTotals.plank || 0) >= 2) value += 1;
        if ((game.resourceTotals.workshop_parts || 0) >= 1) value += 1;
        if (game.buildings.storage) value += 1;
        return value;
      },
      check: (game) =>
        (game.resourceTotals.plank || 0) >= 2 &&
        (game.resourceTotals.workshop_parts || 0) >= 1 &&
        !!game.buildings.storage,
      description:
        "Нужна минимальная пропускная способность: обработанное дерево, детали и место для накопления.",
      hint: "Сделайте хотя бы 2 доски, 1 комплект деталей мастерской и постройте хранилище, чтобы перестать упираться в лимит.",
      completeText:
        "База производства готова. Теперь можно не только собирать, но и держать темп без постоянной потери ресурсов.",
    },
    {
      id: "goal_first_chain",
      text: "Постройте первую производственную цепочку",
      target: 1,
      progress: (game) =>
        game.buildings.workshop &&
        ((game.resourceTotals.improved_tools || 0) >= 1 ||
          (game.resourceTotals.workshop_parts || 0) >= 2)
          ? 1
          : 0,
      check: (game) =>
        !!game.buildings.workshop &&
        ((game.resourceTotals.improved_tools || 0) >= 1 ||
          (game.resourceTotals.workshop_parts || 0) >= 2),
      description:
        "Цепочка должна работать как система: дерево в доски, доски и детали в мастерскую, мастерская в ускорение.",
      hint: "Постройте мастерскую и используйте её либо для улучшенных инструментов, либо хотя бы для устойчивого выпуска деталей.",
      completeText:
        "Цепочка замкнулась. Прогресс теперь зависит не от одного клика, а от связки ресурсов, крафта и зданий.",
    },
    {
      id: "goal_automate_bricks",
      text: "Автоматизируйте производство кирпича",
      target: 1,
      progress: (game) =>
        game.buildings.campfire && game.automationProduction.brick >= 1 ? 1 : 0,
      check: (game) =>
        !!game.buildings.campfire && game.automationProduction.brick >= 1,
      description:
        "Кирпич должен пойти в здания не вручную, а через первую работающую автоматизацию.",
      hint: "Постройте костёр, снабдите его глиной и деревом и дождитесь хотя бы одного кирпича от автоматического цикла.",
      completeText:
        "Автоматизация запущена. Теперь часть прогресса идёт без ручного клика, и решения становятся важнее спама.",
    },
    {
      id: "goal_unlock_kiln",
      text: "Закрепите развитие через кирпич и здание",
      target: 1,
      progress: (game) => (game.buildings.kiln ? 1 : 0),
      check: (game) => !!game.buildings.kiln,
      description:
        "Кирпич должен стать обязательным узлом, без которого дальнейшее развитие не происходит.",
      hint: "Используйте кирпичи, камень, глину и детали мастерской для постройки печи. Это подтвердит, что цепочка реально работает.",
      completeText:
        "Развитие закреплено: кирпич стал обязательным звеном, а постройки теперь открывают путь дальше.",
    },
  ],

  // ─── Resources ───
  storageCategories: {
    raw: {
      id: "raw",
      label: "Сырьё",
      description: "Базовые ресурсы для первых цепочек и строительства.",
      order: 1,
    },
    materials: {
      id: "materials",
      label: "Материалы",
      description:
        "Обработанные ресурсы для зданий и производственных рецептов.",
      order: 2,
    },
    components: {
      id: "components",
      label: "Компоненты",
      description:
        "Промежуточные детали для более сложных производственных узлов.",
      order: 3,
    },
    tools: {
      id: "tools",
      label: "Инструменты",
      description:
        "Оснастка, которая ускоряет ручной труд и усиливает экономику.",
      order: 4,
    },
  },

  resources: {
    wood: {
      name: "Дерево",
      icon: "🪵",
      color: "#8B5A2B",
      description: "Базовое сырье для досок, топлива и строительства.",
      storageCategory: "raw",
      storageSize: 1,
    },
    stone: {
      name: "Камень",
      icon: "🪨",
      color: "#808080",
      description: "Твердое сырье для инструментов и строительных деталей.",
      storageCategory: "raw",
      storageSize: 1,
    },
    clay: {
      name: "Глина",
      icon: "🏺",
      color: "#B22222",
      description: "Сырье для кирпича и ранней обжиговой цепочки.",
      storageCategory: "raw",
      storageSize: 1,
    },
    fiber: {
      name: "Волокно",
      icon: "🌿",
      color: "#228B22",
      description: "Легкий материал для связок, веревок и улучшений.",
      storageCategory: "raw",
      storageSize: 1,
    },
    plank: {
      name: "Доски",
      icon: `<svg class="plank-icon-svg" viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
        <g transform="translate(1 4)">
          <path d="M6 24 L28 12 L46 20 L24 32 Z" fill="#c98533" stroke="#7a4716" stroke-width="1.4" />
          <path d="M6 24 L6 31 L24 40 L24 32 Z" fill="#8e4f1c" stroke="#7a4716" stroke-width="1.4" />
          <path d="M9 23.8 L29 13.5 L44.5 20.2 L24.2 30.5 Z" fill="#ffe2a2" opacity="0.28" />
          <path d="M12 23.5 L29 15" stroke="#fff0c7" stroke-width="1.2" stroke-linecap="round" opacity="0.95" />
          <path d="M16 25.8 L33 17.5" stroke="#eab85f" stroke-width="1.05" stroke-linecap="round" opacity="0.9" />
          <path d="M19 28 L36 20" stroke="#ffe6b0" stroke-width="0.95" stroke-linecap="round" opacity="0.85" />
        </g>
        <g transform="translate(8 10)">
          <path d="M6 24 L28 12 L46 20 L24 32 Z" fill="#d89a44" stroke="#7a4716" stroke-width="1.4" />
          <path d="M6 24 L6 31 L24 40 L24 32 Z" fill="#9b5a21" stroke="#7a4716" stroke-width="1.4" />
          <path d="M9 23.8 L29 13.5 L44.5 20.2 L24.2 30.5 Z" fill="#fff0c8" opacity="0.22" />
          <path d="M12 23.5 L29 15" stroke="#fff5d6" stroke-width="1.15" stroke-linecap="round" opacity="0.95" />
          <path d="M16 25.8 L33 17.5" stroke="#efc46d" stroke-width="1.0" stroke-linecap="round" opacity="0.88" />
          <path d="M19 28 L36 20" stroke="#ffe8b6" stroke-width="0.9" stroke-linecap="round" opacity="0.82" />
        </g>
        <g transform="translate(15 16)">
          <path d="M6 24 L28 12 L46 20 L24 32 Z" fill="#b96f2c" stroke="#7a4716" stroke-width="1.4" />
          <path d="M6 24 L6 31 L24 40 L24 32 Z" fill="#7b4317" stroke="#7a4716" stroke-width="1.4" />
          <path d="M9 23.8 L29 13.5 L44.5 20.2 L24.2 30.5 Z" fill="#ffd98a" opacity="0.18" />
          <path d="M12 23.5 L29 15" stroke="#ffdca4" stroke-width="1.1" stroke-linecap="round" opacity="0.9" />
          <path d="M16 25.8 L33 17.5" stroke="#deaa53" stroke-width="0.95" stroke-linecap="round" opacity="0.87" />
          <path d="M19 28 L36 20" stroke="#ffe2a0" stroke-width="0.85" stroke-linecap="round" opacity="0.78" />
        </g>
      </svg>`,
      color: "#DEB887",
      description: "Обработанное дерево для зданий и более сложных рецептов.",
      storageCategory: "materials",
      storageSize: 1,
    },
    crude_tools: {
      name: "Простые инструменты",
      icon: "🔧",
      color: "#696969",
      description:
        "Повышают ручной сбор и открывают первые производственные развилки.",
      storageCategory: "tools",
      storageSize: 1,
    },
    workshop_parts: {
      name: "Детали мастерской",
      icon: "🔩",
      color: "#778899",
      description: "Переходный компонент для зданий и улучшенных инструментов.",
      storageCategory: "components",
      storageSize: 1,
    },
    improved_tools: {
      name: "Улучшенные инструменты",
      icon: "🛠️",
      color: "#2F4F4F",
      description: "Сильнее ускоряют ручной сбор, чем примитивные инструменты.",
      storageCategory: "tools",
      storageSize: 1,
    },
    brick: {
      name: "Кирпичи",
      icon: "🧱",
      color: "#CD5C5C",
      description:
        "Материал для прогрессивных построек и дальнейшего развития.",
      storageCategory: "materials",
      storageSize: 1,
    },
  },

  // ─── Eras ───
  eras: {
    current: "primitive",
    primitive: {
      name: "Примитивная эпоха",
      description: "Ручной труд и первые открытия",
      milestones: [
        {
          id: "create_crude_tools",
          text: "Создать простые инструменты",
          check: (game) => (game.resources.crude_tools || 0) >= 1,
        },
        {
          id: "build_campfire",
          text: "Построить костёр",
          check: (game) => !!game.buildings.campfire,
        },
        {
          id: "start_automation",
          text: "Запустить автоматизацию",
          check: (game) => (game.resources.brick || 0) >= 1,
        },
        {
          id: "build_workshop",
          text: "Построить мастерскую",
          check: (game) => !!game.buildings.workshop,
        },
        {
          id: "build_kiln",
          text: "Построить печь для обжига",
          check: (game) => !!game.buildings.kiln,
        },
      ],
      nextEra: "early_production",
    },
    early_production: {
      name: "Раннее производство",
      description: "Переход к системному производству",
      milestones: [],
      nextEra: null,
    },
  },

  // ─── Energy ───
  energy: {
    max: 12,
    regenPerTick: 1,
    regenIntervalMs: 3000,
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
      description:
        "Полезно для улучшений и построек, где нужен связующий материал.",
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
      craftTimeMs: 2500,
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
      craftTimeMs: 3500,
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
      craftTimeMs: 3500,
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
      craftTimeMs: 5500,
      requires: "workshop",
      unlockedBy: null,
      description:
        "Доски + Волокно + Простой инструмент → Улучшенные инструменты",
    },
    craft_brick: {
      id: "craft_brick",
      name: "Обжечь кирпич",
      icon: "🔥",
      output: { brick: 1 },
      ingredients: { clay: 2, wood: 1 },
      craftTimeMs: 4500,
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
      description: "Увеличивает лимит ресурсов до 150",
      cost: { wood: 8, fiber: 5, plank: 2 },
      buildTimeMs: 6000,
      effect: { maxResourceCap: 150 },
      unlockedBy: null,
    },
    campfire: {
      id: "campfire",
      name: "Костёр",
      icon: "🔥",
      description:
        "Автоматически обжигает кирпичи из глины и древесного топлива (1 кирпич / 7 сек). Открывает ручной крафт кирпича.",
      cost: { wood: 4, stone: 3 },
      buildTimeMs: 5000,
      effect: {
        unlocks: ["craft_brick"],
        automation: {
          id: "campfire_brick",
          name: "Обжиг кирпича",
          input: { clay: 1, wood: 1 },
          output: { brick: 1 },
          intervalMs: 7000,
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
      buildTimeMs: 8000,
      effect: { unlocks: ["craft_improved_tools"] },
      unlockedBy: null,
    },
    rest_tent: {
      id: "rest_tent",
      name: "Палатка отдыха",
      icon: "⛺",
      description: "Повышает запас энергии и ускоряет восстановление",
      cost: { wood: 4, plank: 2, fiber: 4 },
      buildTimeMs: 7000,
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
      cost: { clay: 6, stone: 4, brick: 3, workshop_parts: 1 },
      buildTimeMs: 10000,
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
      researchTimeMs: 8000,
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
      researchTimeMs: 10000,
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
      researchTimeMs: 9000,
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
      researchTimeMs: 12000,
      effect: {},
      unlockedBy: null,
      requires: "kiln",
    },
  },
};

// ─── Changelog data ─────────────────────────────────────────────────────────
const CHANGELOG_DATA = [
  {
    version: "v0.1.14",
    date: "2026-04-17",
    title: "Асинхронные стройки и исследования, более умное автосохранение",
    changes: [
      {
        type: "improved",
        text: "Здания теперь строятся по таймеру, а не появляются мгновенно по клику",
      },
      {
        type: "improved",
        text: "Исследования теперь запускаются отдельно и завершаются через время",
      },
      {
        type: "improved",
        text: "Автосохранение переведено на периодический режим + важные события вместо частых мгновенных записей",
      },
      {
        type: "improved",
        text: "Лимит ручной настройки интервала автосохранения увеличен до 300 секунд",
      },
    ],
  },
  {
    version: "v0.1.13",
    date: "2026-04-16",
    title: "Пересборка UI-иерархии: эра → цель → прогресс",
    changes: [
      {
        type: "improved",
        text: "Эра, цели и прогресс объединены в один компактный блок в боковой панели",
      },
      {
        type: "removed",
        text: "Убраны отдельные панели «Цели» и «Прогресс» из основной области",
      },
      {
        type: "improved",
        text: "Текущая цель отображается как тактическая карточка с мини-прогресс-баром",
      },
      {
        type: "improved",
        text: "Статистика (здания, технологии, ресурсы) — компактная строка внизу блока эры",
      },
      {
        type: "improved",
        text: "Кнопка «Начать обучение заново» перенесена в шапку рядом с сохранением",
      },
    ],
  },
  {
    version: "v0.1.12",
    date: "2026-04-16",
    title: "Баланс и темп раннего цикла",
    changes: [
      {
        type: "improved",
        text: "Энергия: запас 10 → 12, регенерация 3.5с → 3.0с",
      },
      {
        type: "improved",
        text: "Костёр: цикл автоматизации 10с → 7с, стоимость 5🪵 → 4🪵",
      },
      {
        type: "improved",
        text: "Крафт досок 3.0с → 2.5с, простые инструменты 5.0с → 3.5с",
      },
      { type: "improved", text: "Крафт деталей мастерской 4.5с → 3.5с" },
      { type: "improved", text: "Крафт улучшенных инструментов 7.0с → 5.5с" },
      { type: "improved", text: "Ручной обжиг кирпича 5.5с → 4.5с" },
      { type: "improved", text: "Хранилище: лимит 120 → 150" },
      { type: "improved", text: "Печь: глина 8 → 6, камень 5 → 4" },
    ],
  },
  {
    version: "v0.1.11",
    date: "2026-04-16",
    title: "Система прогресса эпох и переработка интерфейса",
    changes: [
      {
        type: "new",
        text: "Система прогресса эпох: вехи (milestones) и автопереход между эпохами",
      },
      {
        type: "new",
        text: "Переключатель запуска/остановки автоматизации для каждого здания",
      },
      {
        type: "new",
        text: "Двухколоночный интерфейс: постоянный боковой sidebar с ресурсами",
      },
      {
        type: "new",
        text: "Модальное окно «Журнал изменений» с историей версий",
      },
      {
        type: "improved",
        text: "Интерфейс хранилища: сжатие и категоризация ресурсов",
      },
      {
        type: "improved",
        text: "Система сохранений: эпоха и вехи прогресса сохраняются",
      },
      { type: "improved", text: "Подсказки и хинты в игровом интерфейсе" },
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-04-01",
    title: "Первый играбельный прототип",
    changes: [
      { type: "new", text: "Начальный играбельный прототип примитивной эпохи" },
      {
        type: "new",
        text: "Базовые механики: сбор ресурсов, крафт, постройки, автоматизация",
      },
      { type: "new", text: "Онбординг и начальные игровые цели" },
    ],
  },
];
