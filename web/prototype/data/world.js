// World data: goals, storageCategories, resources, researchBranches, eras, energy

Object.assign(GAME_DATA, {
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
      flowLabel: "Вход цепочки",
      description: "Базовые ресурсы для первых цепочек и строительства.",
      order: 1,
    },
    materials: {
      id: "materials",
      label: "Материалы",
      flowLabel: "Обработка сырья",
      description:
        "Обработанные ресурсы для зданий и производственных рецептов.",
      order: 2,
    },
    components: {
      id: "components",
      label: "Компоненты",
      flowLabel: "Сборочные узлы",
      description:
        "Промежуточные детали для более сложных производственных узлов.",
      order: 3,
    },
    tools: {
      id: "tools",
      label: "Инструменты",
      flowLabel: "Усиление труда",
      description:
        "Оснастка, которая ускоряет ручной труд и усиливает экономику.",
      order: 4,
    },
    supplies: {
      id: "supplies",
      label: "Пища и вода",
      flowLabel: "Поддержка рабочих сил",
      description:
        "То, что поддерживает человека в выходах: еда, вода и короткие запасы для отдыха.",
      order: 5,
    },
  },

  resources: {
    wood: {
      name: "Дерево",
      prologueName: "Ветки",
      icon: `<img src="prototype/assets/icons/wood.png" class="game-icon-img" alt="" draggable="false">`,
      prologueIcon: TWIG_ICON_SVG,
      color: "#8B5A2B",
      description: "Базовое сырье для досок, топлива и строительства.",
      storageCategory: "raw",
      storageSize: 1,
      carryWeight: 1,
    },
    stone: {
      name: "Камень",
      icon: `<img src="prototype/assets/icons/stone.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#808080",
      description: "Твердое сырье для инструментов и строительных деталей.",
      storageCategory: "raw",
      storageSize: 1,
      carryWeight: 1.4,
    },
    clay: {
      name: "Глина",
      icon: `<img src="prototype/assets/icons/clay.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#B22222",
      description: "Сырье для кирпича и ранней обжиговой цепочки.",
      storageCategory: "raw",
      storageSize: 1,
      carryWeight: 2.2,
      futureStage: "post_fire_craft",
      presentationGate: {
        buildings: ["campfire"],
        hint: "Глина станет осмысленным ресурсом после первого устойчивого костра: когда жар начнёт быть не только теплом, но и ремесленным инструментом.",
      },
    },
    fiber: {
      name: "Волокно",
      icon: `<img src="prototype/assets/icons/fiber.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#228B22",
      description: "Легкий материал для связок, веревок и улучшений.",
      storageCategory: "raw",
      storageSize: 1,
      carryWeight: 0.5,
    },
    plank: {
      name: "Доски",
      icon: `<img src="prototype/assets/icons/plank.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#DEB887",
      description: "Обработанное дерево для зданий и более сложных рецептов.",
      storageCategory: "materials",
      storageSize: 1,
      carryWeight: 1.3,
      futureStage: "tooling_craft",
      presentationGate: {
        tooling: true,
        hint: "Доски появляются в языке игры только после первых орудий: до этого на карте и в запасах это ветки, жерди и хворост.",
      },
    },
    crude_tools: {
      name: "Простые инструменты",
      icon: `<img src="prototype/assets/icons/crude_tools.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#696969",
      description:
        "Повышают ручной сбор и открывают первые производственные развилки.",
      storageCategory: "tools",
      storageSize: 1,
      carryWeight: 1.7,
    },
    workshop_parts: {
      name: "Детали мастерской",
      icon: `<img src="prototype/assets/icons/workshop_parts.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#778899",
      description: "Переходный компонент для зданий и улучшенных инструментов.",
      storageCategory: "components",
      storageSize: 1,
      carryWeight: 1.8,
      futureStage: "labor_division",
      presentationGate: {
        tech: ["labor_division"],
        hint: "Детали мастерской становятся понятны только после разделения труда и идеи постоянного рабочего места.",
      },
    },
    improved_tools: {
      name: "Улучшенные инструменты",
      icon: `<img src="prototype/assets/icons/improved_tools.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#2F4F4F",
      description: "Сильнее ускоряют ручной сбор, чем примитивные инструменты.",
      storageCategory: "tools",
      storageSize: 1,
      carryWeight: 1.8,
      futureStage: "crafting",
      presentationGate: {
        tech: ["crafting"],
        hint: "Улучшенные инструменты не появляются до ремесленной практики и мастерской.",
      },
    },
    brick: {
      name: "Кирпичи",
      icon: `<img src="prototype/assets/icons/brick.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#CD5C5C",
      description:
        "Материал для прогрессивных построек и дальнейшего развития.",
      storageCategory: "materials",
      storageSize: 1,
      carryWeight: 2.4,
      futureStage: "post_fire_craft",
      presentationGate: {
        buildings: ["campfire"],
        hint: "Кирпичи появляются только после удержанного костра и первого понимания обжига.",
      },
    },
    food: {
      name: "Еда",
      icon: `<img src="prototype/assets/icons/food.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#7B2E8D",
      description:
        "Ягоды, корни и дикие грибы. Утоляет голод и восстанавливает сытость при отдыхе.",
      storageCategory: "supplies",
      storageSize: 1,
      carryWeight: 0.5,
    },
    water: {
      name: "Вода",
      icon: `<img src="prototype/assets/icons/water.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#1E90FF",
      description:
        "Чистая вода из ручья. Базовый набор без ёмкостей считается как 1 л и идёт на водный запас и короткий отдых.",
      storageCategory: "supplies",
      storageSize: 1,
      amountUnit: "л",
      amountDisplayDecimals: 1,
      carryWeight: 1.5,
    },
  },

  researchBranches: {
    foundation: {
      id: "foundation",
      label: "Основа эпохи",
      icon: "🪶",
      description:
        "Общие знания, без которых ветви эпохи остаются разрозненными.",
      leadsTo: "Открывает первые исследовательские ветви primitive-эпохи.",
      order: 0,
    },
    survival: {
      id: "survival",
      label: "Выживание",
      icon: "⛺",
      description: "Энергия, отдых и устойчивый ритм ранней общины.",
      leadsTo:
        "Ведёт к большей выносливости и стабильному темпу ручного труда.",
      order: 1,
    },
    craft: {
      id: "craft",
      label: "Ремесло",
      icon: "🛠️",
      description:
        "Орудия труда, мастерская и полезная экономия в ручном крафте.",
      leadsTo: "Ведёт к лучшим инструментам и более выгодному производству.",
      order: 2,
    },
    production: {
      id: "production",
      label: "Производство",
      icon: "🔥",
      description: "Управляемый обжиг и первые предсказуемые циклы выпуска.",
      leadsTo: "Ведёт к печи и более надёжной автоматизации.",
      order: 3,
    },
    community: {
      id: "community",
      label: "Развитие общины",
      icon: "👥",
      description:
        "Организация труда и подготовка к следующему производственному шагу.",
      leadsTo: "Ведёт к мастерской и к переходу в раннее производство.",
      order: 4,
    },
  },

  // ─── Eras ───
  eras: {
    current: "primitive",
    primitive: {
      name: "Примитивная эпоха",
      description: "Ручной труд и первые открытия",
      researchFoundation: ["communal_memory"],
      researchBranches: ["survival", "craft", "production", "community"],
      prologueResearchTransitionText:
        "Чтобы выйти из первых стоянок, община должна закрепить общее знание, разделить труд и научиться держать жар дольше одной ночи.",
      researchTransitionText:
        "Чтобы выйти к раннему производству, община должна закрепить общее знание, распределить труд и освоить контролируемый обжиг.",
      milestones: [
        {
          id: "research_foundation",
          text: "Закрепить память общины",
          check: (game) => !!game.researched.communal_memory,
        },
        {
          id: "research_first_branch",
          text: "Освоить первое направление развития",
          check: (game) =>
            !!(
              game.researched.basic_tools ||
              game.researched.rest_discipline ||
              game.researched.labor_division ||
              game.researched.mining
            ),
        },
        {
          id: "build_campfire",
          text: "Построить костёр",
          check: (game) => !!game.buildings.campfire,
        },
        {
          id: "build_workshop",
          prologueText: "Организовать первое рабочее место",
          text: "Построить мастерскую",
          check: (game) => !!game.buildings.workshop,
        },
        {
          id: "master_controlled_firing",
          prologueText: "Освоить устойчивый жар",
          text: "Освоить контролируемый обжиг",
          check: (game) => !!game.researched.mining && !!game.buildings.kiln,
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

  dayCycle: {
    startingDay: 1,
    startingPhase: "morning",
    phases: [
      {
        id: "morning",
        label: "Утро",
        icon: "🌤️",
        actionBudget: 3,
        description: "Лучшее время для выхода за ресурсами и разведки.",
      },
      {
        id: "day",
        label: "День",
        icon: "☀️",
        actionBudget: 4,
        description: "Основная часть дня: строительство, сбор, ремесло.",
      },
      {
        id: "evening",
        label: "Вечер",
        icon: "🌙",
        actionBudget: 2,
        description: "Последние действия перед ночёвкой.",
      },
      {
        id: "night",
        label: "Ночь",
        icon: "🌑",
        actionBudget: 0,
        description: "Лагерь переживает ночь и тратит припасы.",
      },
    ],
    nightNeeds: {
      food: 1,
      water: 1,
      woodWithCampfire: 1,
    },
    historyLimit: 8,
  },
});
