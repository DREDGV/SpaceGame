// Character & actions data: character stats/traits, gather actions

Object.assign(GAME_DATA, {
  character: {
    stats: {
      endurance: { base: 1 },
      fieldcraft: { base: 0 },
      strength: { base: 1 },
      mobility: { base: 1 },
      ingenuity: { base: 1 },
      recovery: { base: 0 },
    },
    title: "Ведущий стоянки",
    role: "Один человек, через которого ранняя стоянка ощущает усталость, голод и тяжесть каждого выхода.",
    satiety: {
      max: 10,
      gatherDrain: 0.35,
      buildDrain: 0.45,
      foodRecovery: 1.5,
      passiveRecoveryPerTick: 0.04,
      campfireRecoveryPerTick: 0.18,
      restTentRecoveryBonusPerTick: 0.08,
    },
    hydration: {
      max: 10,
      gatherDrain: 0.28,
      buildDrain: 0.36,
      passiveRecoveryPerTick: 0,
      restTentRecoveryBonusPerTick: 0.02,
      storageRecoveryBonusPerTick: 0.01,
      waterRecovery: 3,
    },
    carry: {
      baseCapacity: 5,
      heavyThreshold: 0.85,
    },
    rest: {
      cooldownMs: 14000,
      baseEnergy: 1,
      baseSatiety: 0.35,
      campfireEnergyBonus: 1,
      campfireSatietyBonus: 0.35,
      shelterEnergyBonus: 1,
      shelterSatietyBonus: 0.45,
      storageSatietyBonus: 0.12,
    },
    conditions: {
      stable: {
        id: "stable",
        label: "В порядке",
        description:
          "Силы, сытость и водный запас позволяют работать без явных штрафов.",
        regenPenaltyMs: 0,
        gatherOutputPenalty: 0,
        gatherCostPenalty: 0,
        craftTimeMult: 1,
        maxSafeDistance: 99,
      },
      weakened: {
        id: "weakened",
        label: "Ослаблен",
        description:
          "Низкие силы, голод или жажда делают выходы заметно тяжелее, а работа руками — медленнее.",
        regenPenaltyMs: 600,
        gatherOutputPenalty: 0,
        gatherCostPenalty: 1,
        craftTimeMult: 1.25,
        maxSafeDistance: 2,
      },
      exhausted: {
        id: "exhausted",
        label: "Истощён",
        description:
          "Персонаж тянет работу с трудом: без еды, воды и отдыха дальние выходы почти срываются, и даже крафт в лагере идёт туго.",
        regenPenaltyMs: 1400,
        gatherOutputPenalty: 1,
        gatherCostPenalty: 1,
        craftTimeMult: 1.6,
        maxSafeDistance: 1,
      },
    },
  },

  // ─── Gathering ───
  gatherActions: {
    gather_wood: {
      id: "gather_wood",
      name: "Собрать дерево",
      prologueName: "Собрать ветки",
      prologueIcon: TWIG_ICON_SVG,
      icon: "🪓",
      output: { wood: 1 },
      energyCost: 1,
      cooldown: 1600,
      unlockedBy: null,
      description: "Базовый сбор для всех ранних цепочек.",
      prologueDescription:
        "Сухие ветви и хворост — первый материал, который можно собрать голыми руками.",
    },
    gather_stone: {
      id: "gather_stone",
      name: "Добыть камень",
      prologueName: "Подобрать камни",
      prologueIcon: "🪨",
      icon: "⛏️",
      output: { stone: 1 },
      energyCost: 1,
      cooldown: 1900,
      unlockedBy: null,
      description: "Нужен для инструментов и деталей мастерской.",
      prologueDescription:
        "Камни пока не добывают — их подбирают и осматривают в поиске полезных сколов.",
    },
    gather_clay: {
      id: "gather_clay",
      name: "Собрать глину",
      icon: "🤲",
      output: { clay: 1 },
      energyCost: 1,
      cooldown: 1700,
      unlockedBy: null,
      description: "Запускает ветку кирпича и обжига.",
      hiddenInPrologue: true,
      presentationGate: {
        buildings: ["campfire"],
        hint: "Глину нельзя показывать как ресурс до первого устойчивого костра: раньше это просто сырой берег, а не ремесленный материал.",
      },
    },
    gather_fiber: {
      id: "gather_fiber",
      name: "Собрать волокно",
      prologueName: "Собрать волокно",
      prologueIcon: "🌾",
      icon: "🌾",
      output: { fiber: 1 },
      energyCost: 1,
      cooldown: 1500,
      unlockedBy: null,
      description:
        "Полезно для улучшений и построек, где нужен связующий материал.",
      prologueDescription:
        "Трава и волокна пригодятся для первых связок, когда община начнёт собирать материалы вместе.",
    },
    gather_supplies: {
      id: "gather_supplies",
      name: "Осмотреть старый привал",
      icon: "🔥",
      output: { wood: 2, stone: 2, fiber: 1 },
      energyCost: 0,
      cooldown: 2200,
      unlockedBy: null,
      mapOnly: true,
      deliveryMode: "multi-trip",
      description:
        "След прежнего привала: здесь можно подобрать сухие ветви, удобные камни и спутанные волокна.",
      prologueDescription:
        "Круг старого кострища и следы короткой стоянки. Здесь ещё осталось немного сухих ветвей, камней и волокон — этого хватит для первых шагов лагеря.",
    },
    gather_water: {
      id: "gather_water",
      name: "Набрать воду",
      icon: "💧",
      output: { water: 1 },
      energyCost: 1,
      cooldown: 1200,
      unlockedBy: null,
      description:
        "Вода из ручья. Нужна для восстановления водного запаса и дальних выходов.",
    },
    gather_food: {
      id: "gather_food",
      name: "Собрать еду",
      icon: "🫐",
      output: { food: 1 },
      energyCost: 1,
      cooldown: 1400,
      unlockedBy: null,
      description:
        "Ягоды, корни и съедобные находки. Нужны для восстановления сытости.",
    },
  },

  // Recipes/buildings/buildingUpgrades/tech are owned by production.js.
});
