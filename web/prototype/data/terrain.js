// Terrain & map data: baseTerrains, localCampMap tiles, logistics routes

Object.assign(GAME_DATA, {
  baseTerrains: {
    grass: {
      name: "Травы",
      icon: "🌾",
      description:
        "Равнина, покрытая травой и редким кустарником. Можно найти волокна.",
      terrainType: "grass",
    },
    brush: {
      name: "Кустарник",
      icon: "🌿",
      description:
        "Заросли кустарника и мелких деревьев. Источник веток и хвороста.",
      terrainType: "brush",
    },
    rocks: {
      name: "Камни",
      icon: "🪨",
      description:
        "Каменистая почва с выходами породы. Можно подобрать подходящие сколы.",
      terrainType: "rock",
    },
    water: {
      name: "Вода",
      icon: "💧",
      description:
        "Край ручья или небольшого озера. Пока просто часть местности.",
      terrainType: "water",
    },
    clearing: {
      name: "Поляна",
      icon: "🌲",
      description:
        "Открытое место, подходящее для будущих построек или отдыха.",
      terrainType: "clearing",
    },
  },

  localCampMap: {
    title: "Локальная карта лагеря",
    description:
      "Небольшая зона вокруг стоянки. Это не карта мира, а первое пространство, где лагерь рождается из случайных находок.",
    interactionHint:
      "Клетки различаются по запасу, тяжести пути и наличию троп. Ближние выходы проще, а дальние стоит связывать с лагерем удобным проходом.",
    tiles: {
      camp_clearing: {
        id: "camp_clearing",
        q: 0,
        r: 0,
        distanceFromCamp: 0,
        terrainType: "clearing",
        state: "camp_candidate",
        icon: "◉",
        name: "Открытая поляна",
        shortLabel: "Поляна",
        description:
          "Широкая, относительно ровная поляна в центре местности. Хорошее место для стоянки — открыто, но не слишком.",
        campCandidateHint:
          "Легко обозначить границы лагеря, удобный выход в разные стороны.",
        campChosenStory:
          "Ты выбрал простор: отсюда видно все стороны, и ветер приходит со всех сразу.",
        buildOptions: ["campfire"],
        isCampCandidate: true,
      },
      branch_patch: {
        id: "branch_patch",
        q: 1,
        r: 0,
        distanceFromCamp: 1,
        terrainType: "brush",
        state: "discovered",
        icon: TWIG_ICON_SVG,
        name: "Сухие ветви",
        description:
          "Кустарник и сухой хворост рядом со стоянкой. Здесь проще всего начать поиск топлива и первых заготовок.",
        actionId: "gather_wood",
        resourceType: "wood",
        resourceAmount: 10,
      },
      stone_patch: {
        id: "stone_patch",
        q: 0,
        r: 1,
        distanceFromCamp: 1,
        terrainType: "rock",
        state: "discovered",
        icon: "🪨",
        name: "Каменная россыпь",
        description:
          "Низкая россыпь у края стоянки. Здесь подбирают подходящие сколы и тяжёлые камни.",
        actionId: "gather_stone",
        resourceType: "stone",
        resourceAmount: 8,
      },
      fiber_patch: {
        id: "fiber_patch",
        q: -1,
        r: 1,
        distanceFromCamp: 1,
        terrainType: "grass",
        state: "discovered",
        icon: "🌾",
        name: "Трава и волокна",
        description:
          "Полоса жёсткой травы и волокон, из которых позже получится первая крепкая связка.",
        actionId: "gather_fiber",
        resourceType: "fiber",
        resourceAmount: 7,
      },
      windbreak: {
        id: "windbreak",
        q: -1,
        r: 0,
        distanceFromCamp: 1,
        terrainType: "grove",
        state: "camp_candidate",
        icon: "🌲",
        name: "Лесная опушка",
        shortLabel: "Опушка",
        description:
          "Край кустарника и молодых деревьев. Естественный заслон от ветра — хорошее место для стоянки.",
        campCandidateHint:
          "Укрытие от ветра, но меньше простора. Ближний сбор дерева улучшается.",
        campChosenStory:
          "Ты ушёл под заслон веток: здесь тише и пахнет хвоёй, а огонь меньше треплет.",
        buildOptions: ["campfire"],
        isCampCandidate: true,
      },
      starter_cache: {
        id: "starter_cache",
        q: -2,
        r: 0,
        distanceFromCamp: 2,
        terrainType: "clearing",
        state: "discovered",
        icon: "🧺",
        name: "Брошенные припасы",
        description:
          "Небольшая груда оставленного снаряжения: сухие ветви, несколько камней и вязанка волокна. Этого должно хватить, чтобы разжечь первый огонь и основать лагерь.",
        actionId: "gather_supplies",
        resourceAmount: 10,
      },
      tinder_hollow: {
        id: "tinder_hollow",
        q: 1,
        r: -1,
        distanceFromCamp: 1,
        terrainType: "grove",
        state: "hidden",
        icon: TWIG_ICON_SVG,
        name: "Сухая ложбина",
        description:
          "Неглубокая ложбина, где ветер меньше треплет траву и проще заметить сухой хворост для растопки.",
        actionId: "gather_wood",
        resourceType: "wood",
        resourceAmount: 6,
        discoveryHint:
          "Откроется с озарением о растопке или после двух наблюдений.",
        discoveryRequirements: (game) =>
          !!game.insights.dry_tinder || game.getUnlockedInsightsCount() >= 2,
      },
      reed_patch: {
        id: "reed_patch",
        q: -2,
        r: 1,
        distanceFromCamp: 2,
        terrainType: "grass",
        state: "hidden",
        icon: "🌾",
        name: "Кромка тростника",
        description:
          "Тонкий влажный пояс у воды. Здесь волокна мягче, но запас их невелик и быстро редеет.",
        actionId: "gather_fiber",
        resourceType: "fiber",
        resourceAmount: 16,
        discoveryHint: "Откроется после постройки костра.",
        discoveryRequirements: (game) => !!game.buildings.campfire,
      },
      cache_site: {
        id: "cache_site",
        q: 0,
        r: -1,
        distanceFromCamp: 1,
        terrainType: "ridge",
        state: "camp_candidate",
        icon: "🪨",
        name: "Сухой откос",
        shortLabel: "Откос",
        description:
          "Небольшой сухой откос с хорошим обзором. Возможно, здесь уже кто-то делал стоянку раньше.",
        campCandidateHint:
          "Хороший обзор, сухая почва. Ближний камень доступен с самого начала.",
        campChosenStory:
          "Ты поднялся на сухой гребень: дальше видно, но и сам ты виден дольше.",
        buildOptions: ["campfire"],
        isCampCandidate: true,
      },
      storage_site: {
        id: "storage_site",
        q: 2,
        r: -1,
        distanceFromCamp: 2,
        terrainType: "clearing",
        state: "hidden",
        icon: "□",
        name: "Сухой склад",
        description:
          "Сухое укрытое место рядом со стоянкой. Ничего не хранится само по себе, но место подходящее.",
        buildOptions: ["storage"],
        discoveryHint: "Откроется после постройки костра.",
        discoveryRequirements: (game) => !!game.buildings.campfire,
      },
      shelter_site: {
        id: "shelter_site",
        q: -1,
        r: -1,
        distanceFromCamp: 1,
        terrainType: "clearing",
        state: "hidden",
        icon: "▱",
        name: "Ровная площадка",
        description:
          "Небольшое ровное место рядом со стоянкой. Подходит для постройки укрытия или навеса.",
        buildOptions: ["rest_tent"],
        discoveryHint: "Откроется после основания лагеря.",
        discoveryRequirements: (game) => game.isCampSetupDone(),
      },
      workshop_site: {
        id: "workshop_site",
        q: 1,
        r: 1,
        distanceFromCamp: 1,
        terrainType: "worksite",
        state: "hidden",
        icon: "◇",
        name: "Твёрдая площадка",
        description:
          "Плотный ровный участок рядом со стоянкой. Подходит для мастерской или рабочего места.",
        buildOptions: ["workshop"],
        discoveryHint:
          "Откроется после постройки костра или исследования разделения труда.",
        discoveryRequirements: (game) =>
          !!game.buildings.campfire || !!game.researched.labor_division,
      },
      creek_edge: {
        id: "creek_edge",
        q: 2,
        r: 0,
        distanceFromCamp: 2,
        terrainType: "water",
        state: "hidden",
        icon: "💧",
        name: "Край ручья",
        description:
          "Чистый ручей с холодной водой. Здесь можно набрать запасы воды для лагеря.",
        actionId: "gather_water",
        resourceType: "water",
        resourceAmount: 25,
        discoveryHint: "Откроется после постройки костра.",
        discoveryRequirements: (game) => !!game.buildings.campfire,
      },
      stony_ridge: {
        id: "stony_ridge",
        q: 2,
        r: 1,
        distanceFromCamp: 2,
        terrainType: "rock",
        state: "hidden",
        icon: "🪨",
        name: "Каменный гребень",
        description:
          "Камень здесь попадается реже, чем у россыпи рядом со стоянкой, зато иногда встречаются более крепкие и удобные куски.",
        actionId: "gather_stone",
        resourceType: "stone",
        resourceAmount: 18,
        discoveryHint:
          "Откроется после постройки костра или озарения об остром крае.",
        discoveryRequirements: (game) =>
          !!game.insights.sharp_edge || !!game.buildings.campfire,
      },
      old_fire_ring: {
        id: "old_fire_ring",
        q: 0,
        r: -2,
        distanceFromCamp: 2,
        terrainType: "lore",
        state: "hidden",
        icon: "⭕",
        name: "Старый след очага",
        description:
          "Круг камней и золы, оставшийся здесь задолго до этой стоянки. Он напоминает, что люди уже учились удерживать огонь.",
        discoveryHint: "Откроется после изучения технологии 'Память предков'.",
        discoveryRequirements: (game) => !!game.researched.communal_memory,
      },
      clay_bank: {
        id: "clay_bank",
        q: -2,
        r: 2,
        distanceFromCamp: 2,
        terrainType: "clay",
        state: "hidden",
        icon: "🏺",
        name: "Глинистый берег",
        description:
          "Сырой берег с плотной глиной. Она пригодится, когда огонь перестанет быть просто теплом и станет ремесленным инструментом.",
        actionId: "gather_clay",
        resourceType: "clay",
        resourceAmount: 18,
        discoveryHint: "Откроется после постройки костра.",
        discoveryRequirements: (game) => !!game.buildings.campfire,
      },
      kiln_site: {
        id: "kiln_site",
        q: 0,
        r: 2,
        distanceFromCamp: 2,
        terrainType: "kiln",
        state: "hidden",
        icon: "○",
        name: "Жарное место",
        description:
          "Защищённая от ветра точка с хорошей тягой. Здесь огонь горит дольше и жарче.",
        buildOptions: ["kiln"],
        discoveryHint:
          "Откроется после постройки мастерской или исследования добычи.",
        discoveryRequirements: (game) =>
          !!game.buildings.workshop || !!game.researched.mining,
      },
      berry_patch: {
        id: "berry_patch",
        q: -1,
        r: 2,
        distanceFromCamp: 2,
        terrainType: "brush",
        state: "hidden",
        icon: "🫐",
        name: "Ягодная поляна",
        description:
          "Низкий кустарник с ягодами, съедобными корнями и дикими грибами. Первая дикая снедь рядом со стоянкой.",
        actionId: "gather_food",
        resourceType: "food",
        resourceAmount: 18,
        discoveryHint: "Откроется после постройки костра.",
        discoveryRequirements: (game) => !!game.buildings.campfire,
      },
    },
  },

  logistics: {
    pathLevels: {
      none: {
        id: "none",
        label: "Без тропы",
        icon: "·",
        routeRelief: 0,
        terrainRelief: 0,
        description:
          "Путь к участку ещё не натоптан, поэтому каждый выход ощущается тяжелее.",
      },
      trail: {
        id: "trail",
        label: "Тропа",
        icon: "⋯",
        routeRelief: 1,
        terrainRelief: 1,
        description:
          "Натоптанная тропа уменьшает тяжесть пути и делает выходы стабильнее.",
      },
    },
    trailProject: {
      id: "trail",
      name: "Натоптать тропу",
      icon: "🥾",
      description:
        "Простой путь от стоянки к участку. Он снижает затраты сил на перенос и делает дальние клетки полезнее.",
      requiresCampfire: true,
      baseCost: { wood: 2, fiber: 1 },
      terrainExtraCosts: {
        rock: { stone: 1 },
        clay: { wood: 1 },
        water: { wood: 1, fiber: 1 },
      },
      energyCost: 1,
    },
  },

  // ─── Regular goals (post-onboarding) ───
});
