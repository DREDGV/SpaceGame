// Game data definitions — Primitive Stage (Core Loop v4: Onboarding)

const GAME_DATA = {
  // ─── Onboarding ───
  onboarding: {
    introLines: [
      "Около 12 тысяч лет назад лёд уже отступал, но мир всё ещё оставался холодным, ветреным и ненадёжным. Люди часто жили короткими стоянками и берегли всё, что давало тепло, острый край и крепкую связку.",
      "Пока ещё нет полей, постоянных домов и оформленных ремёсел. Есть только ветви, каменные сколы, волокна, сырой холод и первые попытки понять, как удержать порядок вокруг себя.",
      "В начале нужно не добывать, а замечать: какие ветви суше, какой камень режет, какое волокно держит лучше, где ветер меньше гасит огонь.",
      "Лишь после грубого орудия и первого костра жизнь перестаёт быть набором случайных находок. Тогда и начинается более привычная primitive-эпоха.",
    ],

    steps: [
      {
        id: "prologue_gather_branches",
        text: "Соберите 4 ветки",
        hint: "Ищите сухие ветки и хворост. В ранней стоянке это и топливо, и заготовка, и первая опора для рук.",
        sceneText:
          "В начале человек не заготавливает, а различает: что ломается сразу, а что можно унести и сохранить до ночи.",
        check: (game) => (game.resourceTotals.wood || 0) >= 4,
      },
      {
        id: "prologue_gather_stones",
        text: "Подберите 4 камня",
        hint: "Среди россыпи ищите не тяжесть, а форму. Острый скол важнее целого булыжника.",
        sceneText:
          "Камень пока не добывают. Его подбирают, переворачивают в ладони и смотрят, может ли край помочь руке.",
        check: (game) => (game.resourceTotals.stone || 0) >= 4,
      },
      {
        id: "prologue_gather_fiber",
        text: "Соберите 3 волокна",
        hint: "Трава, лыко и длинные волокна ценятся не сами по себе: ими держится то, что не удержать пальцами.",
        sceneText:
          "На такой стоянке мало вещей, которые можно назвать своими. Связка волокон — одна из первых.",
        check: (game) => (game.resourceTotals.fiber || 0) >= 3,
      },
      {
        id: "prologue_find_tinder",
        text: "Найдите сухой хворост для растопки",
        hint: "Не каждая ветка годится для огня. Нужен сухой хворост и лёгкий материал, который схватывает жар быстрее.",
        sceneText:
          "Огонь рождается не из силы, а из правильной мелочи: сухого внутреннего слоя коры, травы, хвороста и терпения.",
        check: (game) => !!game.insights.dry_tinder,
      },
      {
        id: "prologue_find_hearth_place",
        text: "Присмотрите место для очага",
        hint: "Огонь держится лучше там, где ветер слабее, а камни могут удержать жар и не дать ему расползтись по земле.",
        sceneText:
          "Очаг — это уже не просто пламя. Это место, которое выбирают и запоминают.",
        check: (game) => !!game.insights.hearth_circle,
      },
      {
        id: "prologue_make_tool",
        text: "Свяжите грубое орудие",
        hint: "Когда первые озарения уже собраны, соедините ветвь, камень и волокно в грубое, но полезное орудие.",
        sceneText:
          "Такое орудие ещё нельзя назвать ремеслом. Но именно с него рука перестаёт быть совсем безоружной.",
        check: (game) => (game.resourceTotals.crude_tools || 0) >= 1,
      },
      {
        id: "prologue_prepare_fire_stock",
        text: "Подготовьте запас для первого костра",
        hint: "Чтобы огонь не умер сразу, нужно заранее собрать достаточно топлива, камня и связки для простого очага.",
        sceneText:
          "Первый костёр — это не щелчок и не кнопка. Это несколько вещей, собранных заранее, пока ещё светло и сухо.",
        check: (game) => game.hasResources(game.getBuildingCost("campfire")),
      },
      {
        id: "prologue_first_fire",
        text: "Разведите первый костёр",
        hint: "Первый костёр даёт не только тепло. Он делает стоянку местом, к которому можно возвращаться и которое можно удержать.",
        sceneText:
          "Когда огонь удержался хотя бы одну ночь, жизнь уже не кажется совсем случайной.",
        check: (game) => !!game.buildings.campfire,
      },
    ],

    completeMessage:
      "🌄 Пролог завершён. Теперь община готова к первой оформленной эпохе.",
  },

  prologue: {
    title: "На рубеже льда и леса",
    subtitle:
      "Около 12 тысяч лет назад: короткая стоянка, холодный воздух, голые руки и первые догадки.",
    stepTitle: "Сейчас главное",
    stepSubtitle:
      "Первые минуты должны ощущаться как медленный и осторожный поиск опоры в мире, а не как готовая экономика.",
    actionsTitle: "Поиск руками",
    actionsHint:
      "Сначала вы не добываете и не производите. Вы замечаете, подбираете и собираете то, что можно удержать при себе до следующей холодной ночи.",
    resourcesTitle: "При себе",
    resourcesHint:
      "Это не склад и не хозяйство. Только то, что удалось найти, унести и не растратить слишком рано.",
    insightsTitle: "Первые озарения",
    insightsHint:
      "Озарения не изучаются по кнопке. Они приходят медленно, когда руки и глаза начинают различать свойства материала, ветра и огня.",
    knowledgeIntro:
      "Книга знаний хранит не энциклопедию, а короткие следы того, как люди ранних стоянок начинали понимать холодный мир вокруг себя.",
    campfireTitle: "Путь к первому костру",
    campfireText:
      "Огонь — первая организованная точка жизни. Пока его нет, стоянка остаётся набором случайных находок, которые легко теряются в темноте и ветре.",
    campfireBuiltText:
      "Огонь разгорелся. Теперь у общины есть место, вокруг которого можно сидеть ближе друг к другу, сушить сырьё и повторять одни и те же действия уже не вслепую.",
    transitionTitle: "Начинается более организованная жизнь",
    transitionText:
      "Когда у общины появляется грубое орудие и первый удержанный костёр, случайные находки превращаются в более устойчивый уклад. С этого момента начинается уже знакомая primitive-эпоха.",
    postTransitionText:
      "После первого костра жизнь перестаёт быть только хаотичным поиском. Появляются ремесло, более осмысленные исследования и решения, которые можно повторять от дня к дню.",
    startKnowledgeEntryId: "after_ice",
    gatherActionIds: ["gather_wood", "gather_stone", "gather_fiber"],
    visibleResourceIds: ["wood", "stone", "fiber", "crude_tools"],
    recipeIds: ["craft_crude_tools"],
    buildingIds: ["campfire"],
    insights: {
      sharp_edge: {
        id: "sharp_edge",
        order: 1,
        name: "Острый край",
        icon: "🪨",
        description:
          "Некоторые расколотые камни годятся не только для броска. Ими можно резать, скоблить и подготавливать ветви.",
        conditionText: "Открывается после того, как собрано 4 камня.",
        unlockText:
          "Сколы камня можно использовать как режущий край. Это первый шаг к грубому орудию.",
        momentText:
          "Один из камней оказался не просто тяжёлым. Его край режет лучше, чем ноготь и кожа.",
        condition: (game) => (game.resourceTotals.stone || 0) >= 4,
        outcomes: [
          "Открывает понимание, как придать камню полезную форму",
          "Приближает создание грубого орудия",
        ],
        knowledgeEntry: "sharp_stone",
      },
      sturdy_branch: {
        id: "sturdy_branch",
        order: 2,
        name: "Прочная палка",
        icon: "🪵",
        description:
          "Среди ветвей встречаются более крепкие заготовки. Они могут стать основой для первого простого орудия.",
        conditionText: "Открывается после того, как собрано 4 ветки.",
        unlockText:
          "Крепкая ветвь годится не только на топливо. Из неё можно сделать основу орудия.",
        momentText:
          "Не каждая ветка ломается одинаково. Некоторые сами ложатся в руку как опора для будущего орудия.",
        condition: (game) => (game.resourceTotals.wood || 0) >= 4,
        outcomes: [
          "Даёт основу для первого грубого орудия",
          "Подталкивает к первому укладу у костра",
        ],
        knowledgeEntry: "branches_bundle",
      },
      fiber_bindings: {
        id: "fiber_bindings",
        order: 3,
        name: "Связка волокон",
        icon: "🌾",
        description:
          "Волокна можно скручивать и связывать. Они помогают соединять разные материалы в один предмет.",
        conditionText: "Открывается после того, как собрано 3 волокна.",
        unlockText:
          "Волокна можно скрутить в простую связку. Теперь материалы начинают работать вместе.",
        momentText:
          "Тонкие волокна почти ничего не весят по отдельности, но вместе удерживают то, что руками не удержать.",
        condition: (game) => (game.resourceTotals.fiber || 0) >= 3,
        outcomes: [
          "Открывает возможность связать грубое орудие",
          "Готовит почву для первого костра и уклада",
        ],
        knowledgeEntry: "fiber_bindings",
      },
      materials_work_together: {
        id: "materials_work_together",
        order: 4,
        name: "Материалы работают вместе",
        icon: "🪢",
        description:
          "По отдельности ветвь, скол и волокно почти бесполезны. Но если соединить их правильно, они начинают усиливать руку друг друга.",
        conditionText:
          "Открывается, когда собраны все первые наблюдения и при себе есть хотя бы 2 ветки, 2 камня и 2 волокна.",
        unlockText:
          "Полезность рождается не только из находки, но и из соединения. Именно так начинается технология.",
        momentText:
          "Стало видно, что мир помогает не по частям. Камень, ветвь и волокно начинают работать только вместе.",
        condition: (game) =>
          !!game.insights.sharp_edge &&
          !!game.insights.sturdy_branch &&
          !!game.insights.fiber_bindings &&
          (game.resources.wood || 0) >= 2 &&
          (game.resources.stone || 0) >= 2 &&
          (game.resources.fiber || 0) >= 2,
        outcomes: [
          "Подводит к созданию первого грубого орудия",
          "Делает следующий шаг зависимым от сочетания, а не от одной находки",
        ],
        knowledgeEntry: "binding_begins_craft",
      },
      dry_tinder: {
        id: "dry_tinder",
        order: 5,
        name: "Сухая растопка",
        icon: "🌿",
        description:
          "Для первого огня нужен не просто хворост, а сухая мелочь: трава, тонкая кора, ломкие веточки и волокно, которое быстро схватывает жар.",
        conditionText:
          "Открывается, когда собрано не меньше 6 веток и 3 волокон.",
        unlockText:
          "Огонь начинается не с полена, а с лёгкой сухой растопки, которую можно разжечь и удержать.",
        momentText:
          "Пламя лучше держится не на грубой ветке, а на сухой мелочи, которая быстро темнеет, скручивается и ловит жар.",
        condition: (game) =>
          (game.resourceTotals.wood || 0) >= 6 &&
          (game.resourceTotals.fiber || 0) >= 3 &&
          !!game.insights.sturdy_branch &&
          !!game.insights.fiber_bindings,
        outcomes: [
          "Делает первый костёр реальной, а не случайной целью",
          "Учит различать топливо по тому, как оно горит, а не по размеру",
        ],
        knowledgeEntry: "dry_tinder",
      },
      hearth_circle: {
        id: "hearth_circle",
        order: 6,
        name: "Круг очага",
        icon: "⭕",
        description:
          "Огонь лучше держится там, где место для него выбрано заранее: земля очищена, а камни помогают удержать жар и не дать ветру разнести его.",
        conditionText:
          "Открывается, когда собрано не меньше 6 камней и 5 веток, а растопка уже понятна.",
        unlockText:
          "Очаг — это уже не просто огонь, а место, которое выбирают, обкладывают и запоминают.",
        momentText:
          "Стало ясно, что огонь живёт дольше там, где его не бросают на голую землю, а держат в выбранном месте.",
        condition: (game) =>
          (game.resourceTotals.stone || 0) >= 6 &&
          (game.resourceTotals.wood || 0) >= 5 &&
          !!game.insights.sharp_edge &&
          !!game.insights.dry_tinder,
        outcomes: [
          "Готовит переход от случайного пламени к удержанному очагу",
          "Подводит к строительству первого костра как центра стоянки",
        ],
        knowledgeEntry: "hearth_circle",
      },
      hearth_needs_reserve: {
        id: "hearth_needs_reserve",
        order: 7,
        name: "Очаг любит запас",
        icon: "🔥",
        description:
          "Огонь держится не на одной удачной искре. Ему нужен заранее собранный запас сухого топлива и материала, к которому можно быстро дотянуться.",
        conditionText:
          "Открывается после грубого орудия, когда собрано не меньше 8 веток и 4 волокон.",
        unlockText:
          "Первый костёр — это не мгновенное событие, а запас, подготовленный заранее.",
        momentText:
          "Понемногу становится ясно: очаг умирает быстро, если всё топливо ищут только после того, как вспыхнул первый жар.",
        condition: (game) =>
          (game.resourceTotals.crude_tools || 0) >= 1 &&
          (game.resourceTotals.wood || 0) >= 8 &&
          (game.resourceTotals.fiber || 0) >= 4,
        outcomes: [
          "Замедляет выход к первому костру и делает его подготовленным",
          "Подчёркивает, что уклад рождается из запаса и повторяемости",
        ],
        knowledgeEntry: "reserve_for_hearth",
      },
    },
    knowledgeEntries: {
      after_ice: {
        id: "after_ice",
        order: 0,
        title: "Земля после льда",
        lines: [
          "Около 12 тысяч лет назад лёд уже отступал, но многие земли оставались холодными, ветренными и неудобными для долгой стоянки.",
          "Люди часто жили переходами, а потому особенно ценили сухое топливо, острый камень и место, где можно удержать ночной огонь.",
        ],
      },
      sharp_stone: {
        id: "sharp_stone",
        order: 1,
        title: "Острый камень",
        lines: [
          "Даже простой камень может стать полезным, если у него есть острый край.",
          "Ранние люди часто замечали свойства материала раньше, чем создавали ремесло.",
        ],
      },
      branches_bundle: {
        id: "branches_bundle",
        order: 2,
        title: "Ветки и хворост",
        lines: [
          "Сухие ветви годятся не только на костёр. Крепкая палка становится основой первого орудия.",
          "Собирать приходится руками, поэтому каждая находка важна сама по себе.",
        ],
      },
      fiber_bindings: {
        id: "fiber_bindings",
        order: 3,
        title: "Волокна и связки",
        lines: [
          "Волокна помогают соединять предметы и удерживать форму примитивных конструкций.",
          "До ремесла ещё далеко, но первые связки уже делают жизнь устойчивее.",
        ],
      },
      binding_begins_craft: {
        id: "binding_begins_craft",
        order: 4,
        title: "Связка — начало ремесла",
        lines: [
          "До мастерской ещё далеко. Но когда палка, камень и волокно держатся вместе, начинается технология.",
          "Первое орудие рождается не из редкого материала, а из умения соединить обычные вещи в одно целое.",
        ],
      },
      dry_tinder: {
        id: "dry_tinder",
        order: 5,
        title: "Сухой хворост и растопка",
        lines: [
          "В первые эпохи огонь чаще всего проигрывал не холоду, а сырости и спешке. Сухая растопка была ценнее крупной ветви.",
          "Люди замечали, что трава, тонкая кора и ломкий хворост схватывают жар быстрее, чем тяжёлое сырое дерево.",
        ],
      },
      hearth_circle: {
        id: "hearth_circle",
        order: 6,
        title: "Очаг и короткая стоянка",
        lines: [
          "Даже короткая стоянка становится устойчивее, когда огонь держат в выбранном месте, а не бросают где придётся.",
          "Камни вокруг очага не только ограничивают жар, но и делают место огня заметным и повторяемым для всей группы.",
        ],
      },
      reserve_for_hearth: {
        id: "reserve_for_hearth",
        order: 7,
        title: "Очаг держится запасом",
        lines: [
          "Для ранних групп огонь был важен не только как находка, но и как обязанность: его приходилось кормить заранее собранным сухим топливом.",
          "Там, где есть запас хвороста и растопки, огонь удерживается дольше, а ночь перестаёт быть полностью враждебной.",
        ],
      },
      campfire_center: {
        id: "campfire_center",
        order: 8,
        title: "Костёр как центр жизни",
        lines: [
          "Костёр даёт тепло, свет и точку, вокруг которой можно возвращаться к одним и тем же действиям.",
          "С него начинается переход от случайного выживания к более организованному укладу.",
        ],
      },
    },
  },

  localCampMap: {
    title: "Локальная карта лагеря",
    description:
      "Небольшая зона вокруг стоянки. Это не карта мира, а первое пространство, где лагерь рождается из случайных находок.",
    interactionHint:
      "Клетки теперь различаются по насыщенности: одни богаче, другие быстро пустеют, а часть остаётся просто местностью под лагерь и будущие решения.",
    tiles: {
      camp_clearing: {
        id: "camp_clearing",
        q: 0,
        r: 0,
        distanceFromCamp: 0,
        terrainType: "camp",
        state: "discovered",
        icon: "◉",
        name: "Стоянка",
        description:
          "Небольшая открытая площадка, где можно держать вещи при себе и где позже появится первый костёр.",
        buildOptions: ["campfire"],
      },
      branch_patch: {
        id: "branch_patch",
        q: 1,
        r: 0,
        distanceFromCamp: 1,
        terrainType: "brush",
        state: "discovered",
        icon: "🌿",
        name: "Сухие ветви",
        description:
          "Кустарник и сухой хворост рядом со стоянкой. Здесь проще всего начать поиск топлива и первых заготовок.",
        actionId: "gather_wood",
        resourceType: "wood",
        resourceAmount: 9,
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
        resourceAmount: 6,
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
        resourceAmount: 5,
      },
      windbreak: {
        id: "windbreak",
        q: -1,
        r: 0,
        distanceFromCamp: 1,
        terrainType: "grove",
        state: "hidden",
        icon: "🌲",
        name: "Ветровая кромка",
        description:
          "Небольшой заслон из кустарника и молодых деревьев. Здесь стоянка ощущается менее открытой ветру.",
        discoveryHint: "Откроется с первым озарением — когда вы что-то поймёте о местности.",
        discoveryRequirements: (game) => game.getUnlockedInsightsCount() >= 1,
      },
      tinder_hollow: {
        id: "tinder_hollow",
        q: 1,
        r: -1,
        distanceFromCamp: 1,
        terrainType: "grove",
        state: "hidden",
        icon: "🍂",
        name: "Сухая ложбина",
        description:
          "Неглубокая ложбина, где ветер меньше треплет траву и проще заметить сухой хворост для растопки.",
        actionId: "gather_wood",
        resourceType: "wood",
        resourceAmount: 4,
        discoveryHint: "Откроется с озарением о растопке или после двух наблюдений.",
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
        resourceAmount: 3,
        discoveryHint: "Откроется после постройки костра.",
        discoveryRequirements: (game) => !!game.buildings.campfire,
      },
      cache_site: {
        id: "cache_site",
        q: 0,
        r: -1,
        distanceFromCamp: 1,
        terrainType: "clearing",
        state: "hidden",
        icon: "🧺",
        name: "Место под запас",
        description:
          "Сухое место рядом со стоянкой, где вещи уже можно складывать не только в руках, но и держать рядом с огнём.",
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
        icon: "⛺",
        name: "Место под укрытие",
        description:
          "Небольшое ровное место, где уже можно думать не только об огне, но и о более устойчивом отдыхе.",
        buildOptions: ["rest_tent"],
        discoveryHint: "Откроется после постройки костра.",
        discoveryRequirements: (game) => !!game.buildings.campfire,
      },
      workshop_site: {
        id: "workshop_site",
        q: 1,
        r: 1,
        distanceFromCamp: 1,
        terrainType: "worksite",
        state: "hidden",
        icon: "🔧",
        name: "Место под мастерскую",
        description:
          "Площадка рядом со стоянкой, где можно перейти от случайных связок к более повторяемому ремеслу.",
        buildOptions: ["workshop"],
        discoveryHint: "Откроется после постройки костра или исследования разделения труда.",
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
          "Вода, мягкий берег и более влажная земля. Пока это просто часть местности, но позже она станет полезной.",
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
        resourceAmount: 3,
        discoveryHint: "Откроется после постройки костра или озарения об остром крае.",
        discoveryRequirements: (game) =>
          !!game.insights.sharp_edge || !!game.buildings.campfire,
      },
      old_fire_ring: {
        id: "old_fire_ring",
        q: 2,
        r: -1,
        distanceFromCamp: 2,
        terrainType: "lore",
        state: "hidden",
        icon: "🪵",
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
        resourceAmount: 7,
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
        icon: "🏺",
        name: "Место под печь",
        description:
          "Более защищённая точка для жаркой и долгой работы с огнём, когда лагерь уже умеет держать ремесленный ритм.",
        buildOptions: ["kiln"],
        discoveryHint: "Откроется после постройки мастерской или исследования добычи.",
        discoveryRequirements: (game) =>
          !!game.buildings.workshop || !!game.researched.mining,
      },
    },
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
      icon: "🪓",
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
      description:
        "Энергия, отдых и устойчивый ритм ранней общины.",
      leadsTo: "Ведёт к большей выносливости и стабильному темпу ручного труда.",
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
      description:
        "Управляемый обжиг и первые предсказуемые циклы выпуска.",
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
          text: "Построить мастерскую",
          check: (game) => !!game.buildings.workshop,
        },
        {
          id: "master_controlled_firing",
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

  // ─── Gathering ───
  gatherActions: {
    gather_wood: {
      id: "gather_wood",
      name: "Собрать дерево",
      prologueName: "Собрать ветки",
      prologueIcon: "🌿",
      icon: "🪓",
      output: { wood: 1 },
      energyCost: 1,
      cooldown: 1000,
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
      cooldown: 1200,
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
      cooldown: 1000,
      unlockedBy: null,
      description: "Запускает ветку кирпича и обжига.",
      hiddenInPrologue: true,
    },
    gather_fiber: {
      id: "gather_fiber",
      name: "Собрать волокно",
      prologueName: "Собрать волокно",
      prologueIcon: "🌾",
      icon: "🌾",
      output: { fiber: 1 },
      energyCost: 1,
      cooldown: 800,
      unlockedBy: null,
      description:
        "Полезно для улучшений и построек, где нужен связующий материал.",
      prologueDescription:
        "Трава и волокна пригодятся для первых связок, когда община начнёт собирать материалы вместе.",
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
      description: "Увеличивает лимит ресурсов до 150",
      cost: { wood: 8, fiber: 5, plank: 2 },
      buildTimeMs: 6000,
      effect: { maxResourceCap: 150 },
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
      icon: "⛺",
      description: "Повышает запас энергии и ускоряет восстановление",
      cost: { wood: 4, plank: 2, fiber: 4 },
      buildTimeMs: 7000,
      effect: {
        energy: { maxBonus: 3, regenIntervalBonusMs: 1500 },
      },
      unlockedBy: "rest_discipline",
      hiddenInPrologue: true,
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
      effect: { gatherBonus: 1 },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: [
        "Ручной сбор: +1 к каждому действию",
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
      outcomes: [
        "Открывает мастерскую",
        "Строительство идёт быстрее",
      ],
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
      },
      requires: "campfire",
      requiresTech: ["communal_memory"],
      outcomes: [
        "Запас энергии +1",
        "Восстановление энергии ускоряется",
        "Открывает палатку отдыха",
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
      outcomes: [
        "Ускоряет автоматический обжиг",
        "Открывает печь для обжига",
      ],
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
