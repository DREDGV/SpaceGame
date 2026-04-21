// Production data: recipes, buildings, buildingUpgrades, tech

Object.assign(GAME_DATA, {
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
      hiddenInPrologue: true,
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
      hiddenInPrologue: true,
    },
    craft_crude_tools: {
      id: "craft_crude_tools",
      name: "Простые инструменты",
      prologueName: "Связать грубое орудие",
      prologueIcon: "🪢",
      icon: "🪓",
      output: { crude_tools: 1 },
      ingredients: { wood: 1, stone: 2 },
      prologueIngredients: { wood: 2, stone: 3, fiber: 1 },
      craftTimeMs: 4500,
      requires: null,
      unlockedBy: null,
      description: "Дерево + Камень → Инструменты",
      prologueDescription:
        "Ветки, камень и волокно соединяются в первое грубое орудие, сделанное ещё не ремеслом, а прямым опытом.",
      requiresInsights: [
        "sharp_edge",
        "sturdy_branch",
        "fiber_bindings",
        "materials_work_together",
      ],
    },
    craft_improved_tools: {
      id: "craft_improved_tools",
      name: "Улучшенные инструменты",
      icon: "🛠️",
      output: { improved_tools: 1 },
      ingredients: { plank: 2, fiber: 2, crude_tools: 1 },
      craftTimeMs: 5500,
      requires: "workshop",
      unlockedBy: "crafting",
      description:
        "Доски + Волокно + Простой инструмент → Улучшенные инструменты",
      hiddenInPrologue: true,
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
      hiddenInPrologue: true,
    },
  },

  // ─── Buildings ───
  buildings: {
    storage: {
      id: "storage",
      name: "Хранилище",
      icon: "🏚️",
      description:
        "Увеличивает лимит ресурсов до 150 и делает быт стоянки устойчивее.",
      cost: { wood: 8, fiber: 5, plank: 2 },
      buildTimeMs: 6000,
      effect: {
        maxResourceCap: 150,
        character: { recoveryBonusPerTick: 0.03, carryCapacityBonus: 1 },
      },
      unlockedBy: null,
      hiddenInPrologue: true,
    },
    campfire: {
      id: "campfire",
      name: "Костёр",
      prologueName: "Первый костёр",
      icon: "🔥",
      description:
        "Автоматически обжигает кирпичи из глины и древесного топлива (1 кирпич / 7 сек). Открывает ручной крафт кирпича.",
      cost: { wood: 4, stone: 3 },
      prologueCost: { wood: 6, stone: 4, fiber: 3 },
      buildTimeMs: 6500,
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
      prologueDescription:
        "Тепло, свет и защита. Первый удержанный костёр превращает короткую стоянку в место, куда можно возвращаться не наугад.",
      requires: "rest_tent",
      requiresInsights: [
        "sharp_edge",
        "sturdy_branch",
        "fiber_bindings",
        "dry_tinder",
        "hearth_circle",
        "hearth_needs_reserve",
      ],
      requiresPrologueTool: true,
    },
    workshop: {
      id: "workshop",
      name: "Мастерская",
      icon: "🔧",
      description: "Открывает улучшенные инструменты и сложные цепочки",
      cost: { wood: 6, plank: 3, workshop_parts: 2 },
      buildTimeMs: 8000,
      effect: { unlocks: ["craft_improved_tools"] },
      unlockedBy: "labor_division",
      hiddenInPrologue: true,
    },
    rest_tent: {
      id: "rest_tent",
      name: "Палатка отдыха",
      prologueName: "Первое жильё",
      icon: "⛺",
      description:
        "Повышает запас энергии, запас сытости и ускоряет восстановление.",
      prologueDescription:
        "Первая палатка делает стоянку жилой: в ней можно укрыться от ветра, переждать сырость и впервые отдыхать не прямо на голой земле.",
      cost: { wood: 4, plank: 2, fiber: 4 },
      prologueCost: { wood: 5, fiber: 4 },
      buildTimeMs: 7000,
      effect: {
        energy: { maxBonus: 3, regenIntervalBonusMs: 1500 },
        character: {
          maxSatietyBonus: 2,
          maxHydrationBonus: 1,
          enduranceBonus: 1,
          recoveryRatingBonus: 1,
        },
      },
      unlockedBy: null,
    },
    kiln: {
      id: "kiln",
      name: "Печь для обжига",
      icon: "🏺",
      description: "Требуется для поздних производственных шагов",
      cost: { clay: 6, stone: 4, brick: 3, workshop_parts: 1 },
      buildTimeMs: 10000,
      effect: {},
      unlockedBy: "mining",
      requires: "workshop",
      hiddenInPrologue: true,
    },
  },

  // ─── Building upgrades ───────────────────────────────────────────────────
  // Each upgrade is tied to a specific already-built building and improves it.
  // Fields: id, name, icon, targetBuilding, description, cost, energyCost,
  //         effect (same shape as building.effect), unlockedBy (tech id or null)
  buildingUpgrades: {
    campfire_stone_hearth: {
      id: "campfire_stone_hearth",
      name: "Каменный очаг",
      icon: "🪨🔥",
      targetBuilding: "campfire",
      description:
        "Обложить кострище камнями и обмазать глиной. Жар держится дольше — обжиг кирпича идёт на 30% быстрее.",
      cost: { stone: 8, clay: 4 },
      energyCost: 2,
      effect: {
        automation: {
          targetId: "campfire_brick",
          intervalMultiplier: 0.7,
        },
      },
      unlockedBy: "mining",
    },
    storage_reinforced: {
      id: "storage_reinforced",
      name: "Укреплённое хранилище",
      icon: "🏚️⬆️",
      targetBuilding: "storage",
      description:
        "Дополнительные полки и крепкие стены. Хранилище вмещает вдвое больше — лимит ресурсов вырастает до 250.",
      cost: { plank: 4, stone: 6, workshop_parts: 1 },
      energyCost: 2,
      effect: {
        maxResourceCap: 250,
        character: { carryCapacityBonus: 1 },
      },
      unlockedBy: "labor_division",
    },
    rest_tent_shelter: {
      id: "rest_tent_shelter",
      name: "Укреплённая палатка",
      icon: "⛺⬆️",
      targetBuilding: "rest_tent",
      description:
        "Камень вместо кольев, глиняная обмазка от ветра. Запас энергии увеличивается ещё на 2, восстановление становится немного быстрее.",
      cost: { stone: 5, clay: 3, plank: 2 },
      energyCost: 2,
      effect: {
        energy: { maxBonus: 2, regenIntervalBonusMs: 1000 },
        character: { enduranceBonus: 1, recoveryRatingBonus: 1 },
      },
      unlockedBy: "rest_discipline",
    },
  },

  // ─── Tech ───
  tech: {
    communal_memory: {
      id: "communal_memory",
      branch: "foundation",
      order: 0,
      name: "Память общины",
      icon: "🪶",
      description:
        "Община начинает сохранять полезные приёмы и передавать опыт, а знания перестают исчезать вместе с каждым днём.",
      cost: { wood: 4, fiber: 2 },
      researchTimeMs: 7000,
      effect: {},
      outcomes: [
        "Открывает первые исследовательские ветви primitive-эпохи",
        "Становится опорой для прогресса текущей эпохи",
      ],
      requires: null,
      requiresTech: [],
    },
    basic_tools: {
      id: "basic_tools",
      branch: "craft",
      order: 1,
      name: "Орудия труда",
      icon: "🛠️",
      description:
        "Община осваивает простые, но надёжные орудия. Каждый ручной выход начинает приносить больше пользы.",
      cost: { crude_tools: 2 },
      researchTimeMs: 8000,
      effect: { gatherBonus: 1, character: { fieldcraftBonus: 1 } },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: [
        "Ручной сбор: +1 к каждому действию",
        "Первые вылазки чуть легче переносят путь и тяжёлую почву",
        "Открывает путь к ремесленной практике",
      ],
    },
    crafting: {
      id: "crafting",
      branch: "craft",
      order: 2,
      name: "Ремесленная практика",
      icon: "⚒️",
      description:
        "Мастерская становится местом не только сборки, но и экономии: заготовки расходуются точнее, а работа идёт увереннее.",
      cost: { plank: 5, crude_tools: 1 },
      researchTimeMs: 10000,
      effect: { craftDiscount: 0.1 },
      requires: "workshop",
      requiresTech: ["basic_tools"],
      outcomes: [
        "Снижает стоимость крафта на 10%",
        "Открывает улучшенные инструменты в мастерской",
      ],
    },
    labor_division: {
      id: "labor_division",
      branch: "community",
      order: 1,
      name: "Разделение труда",
      icon: "👥",
      description:
        "Община закрепляет роли: кто-то заготавливает, кто-то собирает детали, кто-то ведёт постройку. Большие проекты перестают буксовать.",
      cost: { plank: 3, fiber: 3, crude_tools: 1 },
      researchTimeMs: 10000,
      effect: { buildTimeMultiplier: 0.85 },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: ["Открывает мастерскую", "Строительство идёт быстрее"],
    },
    rest_discipline: {
      id: "rest_discipline",
      branch: "survival",
      order: 1,
      name: "Уклад отдыха",
      icon: "🛏️",
      description:
        "Отдых у огня становится частью распорядка. Люди меньше выгорают на раннем ручном труде и быстрее возвращаются к работе.",
      cost: { fiber: 4, crude_tools: 1 },
      researchTimeMs: 9000,
      effect: {
        energy: { maxBonus: 1, regenIntervalBonusMs: 500 },
        character: { recoveryBonusPerTick: 0.03, recoveryRatingBonus: 1 },
      },
      requires: "campfire",
      requiresTech: ["communal_memory"],
      outcomes: [
        "Запас энергии +1",
        "Восстановление энергии ускоряется",
        "Короткая передышка у лагеря становится заметно полезнее",
        "Бытовой распорядок чуть улучшает восстановление сытости",
        "Открывает укрепление палатки",
      ],
    },
    mining: {
      id: "mining",
      branch: "production",
      order: 1,
      name: "Контролируемый обжиг",
      icon: "🔥",
      description:
        "Жар перестаёт быть случайностью. Община учится держать обжиг ровным и превращает костёр в предсказуемый производственный узел.",
      cost: { clay: 4, brick: 2, crude_tools: 1 },
      researchTimeMs: 12000,
      effect: { automationIntervalMultiplier: 0.8 },
      requires: "campfire",
      requiresTech: ["communal_memory"],
      outcomes: ["Ускоряет автоматический обжиг", "Открывает печь для обжига"],
    },

    // ── Выживание: дополнительные ──────────────────────────────────────────

    foraging: {
      id: "foraging",
      branch: "survival",
      order: 0,
      name: "Поиск пропитания",
      icon: "🌿",
      description:
        "Люди учатся замечать съедобные корни, ягоды и листья прямо по пути. Каждый выход из лагеря начинает давать не только материалы, но и силы.",
      cost: { fiber: 3, wood: 2 },
      researchTimeMs: 7000,
      effect: {
        energy: { maxBonus: 1 },
        character: { maxSatietyBonus: 1 },
      },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: [
        "Запас энергии +1",
        "Запас сытости +1",
        "Выход за пределы лагеря становится менее затратным",
      ],
    },
    body_conditioning: {
      id: "body_conditioning",
      branch: "survival",
      order: 2,
      name: "Закалка тела",
      icon: "💪",
      description:
        "Размеренный режим труда и отдыха укрепляет людей. Тело привыкает к нагрузке, и тяжёлый груз уже не так давит в дороге.",
      cost: { fiber: 3, plank: 2, crude_tools: 1 },
      researchTimeMs: 10000,
      effect: {
        character: { enduranceBonus: 2, carryCapacityBonus: 1 },
      },
      requires: null,
      requiresTech: ["rest_discipline"],
      outcomes: [
        "Выносливость персонажа +2",
        "Грузоподъёмность +1",
        "Дальние вылазки проходят заметно легче",
      ],
    },

    // ── Ремесло: дополнительные ────────────────────────────────────────────

    tool_sharpening: {
      id: "tool_sharpening",
      branch: "craft",
      order: 2,
      name: "Заточка орудий",
      icon: "🪨",
      description:
        "Острый камень работает иначе, чем тупой. Община осваивает заточку: орудия теперь добывают больше за тот же удар.",
      cost: { crude_tools: 1, stone: 4 },
      researchTimeMs: 9000,
      effect: { gatherBonus: 1 },
      requires: null,
      requiresTech: ["basic_tools"],
      outcomes: [
        "Ручной сбор: ещё +1 к каждому действию",
        "Путь к ремесленной практике остаётся открытым",
      ],
    },
    material_sense: {
      id: "material_sense",
      branch: "craft",
      order: 3,
      name: "Чувство материала",
      icon: "✋",
      description:
        "Опытный мастер знает, где срезать лишнее, а где добавить. Сырьё расходуется точнее, и отходы производства сокращаются.",
      cost: { plank: 3, improved_tools: 1 },
      researchTimeMs: 12000,
      effect: { craftDiscount: 0.1 },
      requires: "workshop",
      requiresTech: ["crafting"],
      outcomes: [
        "Стоимость крафта снижается ещё на 10%",
        "Суммируется с ремесленной практикой: итого −20%",
      ],
    },

    // ── Производство: дополнительные ──────────────────────────────────────

    clay_reading: {
      id: "clay_reading",
      branch: "production",
      order: 0,
      name: "Чтение глины",
      icon: "🏺",
      description:
        "Глина бывает жирной и тощей, сухой и влажной. Умение различать её сорта позволяет лепить и обжигать с первого раза, без лишних переделок.",
      cost: { clay: 4, wood: 2 },
      researchTimeMs: 8000,
      effect: { automationIntervalMultiplier: 0.9 },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: [
        "Автоматизация костра/обжига ускоряется на 10%",
        "Полезно ещё до постройки костра — готовит почву",
      ],
    },
    kiln_practice: {
      id: "kiln_practice",
      branch: "production",
      order: 2,
      name: "Мастерство обжига",
      icon: "🔶",
      description:
        "С опытом обжиг в печи идёт без лишних потерь: нужная температура держится ровно столько, сколько нужно.",
      cost: { clay: 5, brick: 3 },
      researchTimeMs: 13000,
      effect: { automationIntervalMultiplier: 0.8 },
      requires: "kiln",
      requiresTech: ["mining"],
      outcomes: [
        "Автоматизация печи ускоряется ещё на 20%",
        "Суммируется с контролируемым обжигом: ощутимый прирост",
      ],
    },

    // ── Развитие общины: дополнительные ───────────────────────────────────

    camp_planning: {
      id: "camp_planning",
      branch: "community",
      order: 0,
      name: "Планировка лагеря",
      icon: "🗺️",
      description:
        "Договориться, где ставить костёр, где хранить запасы, а где работать — это уже знание. Лагерь, выстроенный с умом, строится быстрее.",
      cost: { wood: 3, fiber: 3 },
      researchTimeMs: 8000,
      effect: { buildTimeMultiplier: 0.9 },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: [
        "Время строительства сокращается на 10%",
        "Конкурирует с чтением глины — выбирай приоритет сам",
      ],
    },
    work_rhythm: {
      id: "work_rhythm",
      branch: "community",
      order: 2,
      name: "Ритм труда",
      icon: "⚙️",
      description:
        "Когда каждый знает свой шаг в общем деле, мастерская перестаёт простаивать. Постройки идут быстрее, а производство не сбивается с темпа.",
      cost: { plank: 4, crude_tools: 2 },
      researchTimeMs: 12000,
      effect: { buildTimeMultiplier: 0.85, automationIntervalMultiplier: 0.9 },
      requires: "workshop",
      requiresTech: ["labor_division"],
      outcomes: [
        "Строительство ускоряется ещё на 15%",
        "Автоматизация ускоряется на 10%",
        "Суммируется с предыдущими эффектами",
      ],
    },
  },
});
