// Game data definitions — Primitive Stage (Core Loop v4: Onboarding)

const TWIG_ICON_SVG = `<svg class="branch-icon-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 50 C24 42, 34 32, 48 18" stroke="#8a5a2b" stroke-width="6" />
    <path d="M25 39 L18 29" stroke="#8a5a2b" stroke-width="4.5" />
    <path d="M34 30 L28 20" stroke="#8a5a2b" stroke-width="4.2" />
    <path d="M41 23 L52 22" stroke="#8a5a2b" stroke-width="4" />
    <path d="M16 50 L12 57" stroke="#6f451e" stroke-width="5" />
    <path d="M47 18 L53 11" stroke="#6f451e" stroke-width="3.5" />
  </g>
</svg>`;

const GAME_DATA = {
  // ─── Camp founding intro (shown over the map before chooseCamp) ───
  campFoundingIntro: {
    skipLabel: "Пропустить вступление",
    steps: [
      {
        id: "arrival",
        icon: "🚶",
        title: "Ты пришёл сюда один.",
        text: "Зима была долгой. За спиной — пустая тропа, впереди — холмы, где ветер ещё гуляет над камнем. Здесь можно остановиться.",
        cta: "▶ Нажмите, чтобы осмотреться",
        advanceMode: "click",
        autoAdvanceMs: 9000,
      },
      {
        id: "survey",
        icon: "👁️",
        title: "Три места зовут остановиться.",
        text: "Светящиеся участки — это то, что ты успел разглядеть. Наведись на каждый, чтобы понять, каким будет лагерь.",
        cta: "Наведись на любое из светящихся мест",
        advanceMode: "hover-candidate",
        autoAdvanceMs: 12000,
      },
      {
        id: "choose",
        icon: "🏕️",
        title: "Выбери место для лагеря.",
        text: "От выбора зависит, с какой стороны ты начнёшь открывать карту. Нажми на любом открытом участке и подтверди выбор.",
        cta: "Выберите любое открытое место на карте (три подсвеченных — рекомендованные)",
        advanceMode: "choose",
      },
    ],

    // ─── Founding ritual: cost, quest, stories ───
    cost: { wood: 4, stone: 3, fiber: 2 },
    energyCost: 2,
    questTitle: "🏕️ Подготовка к основанию лагеря",
    questIntro:
      "Пустое место не становится лагерем само. Соберите опору — дерево, камень, волокно — и присмотритесь к подходящим участкам.",
    questReadyText: "Всё готово. Выберите место и основайте лагерь.",
    questSurveyThreshold: 2,
    questSteps: [
      {
        id: "camp_quest_wood",
        text: "Соберите 4 дерева для каркаса",
        hint: "Каркас и щепа для круга — из сухих ветвей рядом со стоянкой.",
        check: (game) => (game.resources.wood || 0) >= 4,
      },
      {
        id: "camp_quest_stone",
        text: "Соберите 3 камня для круга",
        hint: "Камни лягут в круг, который удержит первый огонь.",
        check: (game) => (game.resources.stone || 0) >= 3,
      },
      {
        id: "camp_quest_fiber",
        text: "Соберите 2 волокна для связки",
        hint: "Связка удержит каркас и опоры между собой.",
        check: (game) => (game.resources.fiber || 0) >= 2,
      },
      {
        id: "camp_quest_survey",
        text: "Осмотрите не меньше двух подходящих мест",
        hint: "Наведите взгляд на светящиеся участки, чтобы понять, каким будет ваш лагерь.",
        check: (game) => game.getCampCandidatesSurveyedCount() >= 2,
      },
    ],
    readyStory: {
      icon: "🧺",
      title: "Теперь есть чем обустроить место",
      text: "Сухое дерево, крепкий камень и тугое волокно уже ждут в руках. Осталось выбрать землю, на которой огонь удержится.",
      ttlMs: 6000,
    },
    ritualStory: {
      icon: "🏕️",
      title: "Круг на земле",
      text: "Камни легли в круг, ветви встали по краю, связка стянула всё в одно. Отсюда и начинается лагерь.",
      ttlMs: 6500,
    },
    enterStory: {
      icon: "🚪",
      title: "Шаг за порог",
      text: "Лагерь перестал быть точкой на карте — изнутри у него появляется свой уклад.",
      ttlMs: 5500,
    },
    confirmTitle: "Основать лагерь здесь?",
    confirmConfirmLabel: "🏕️ Основать лагерь",
    confirmCancelLabel: "Отмена",
    enterPromptLabel: "🏕️ Войти в лагерь",
  },

  // ─── Onboarding ───
  onboarding: {
    introLines: [
      "Двенадцать тысяч лет назад лёд ещё не успел забыть землю. Он отступал медленно — оставляя за собой мокрые долины, голые холмы и тишину, в которой не было ни слов, ни имён.",
      "Где-то в этой тишине — человек. Без дома. Без записей. Без уверенности, что завтра будет легче, чем сегодня. В его руках — несколько веток, выбранных не наугад: чуть суше, чуть прямее других. Это всё, что сейчас отделяет его от ночного холода.",
      "Всё великое, что придёт после — поля, города, корабли, книги — начнётся не с откровения и не с приказа. С того, как один человек замечает: этот камень режет лучше, чем другой. Это волокно держит крепче. Эта ветка не сломается.",
      "Ты не знаешь ещё, куда ведёт этот путь. Никто не знал. Но первый шаг — всегда один и тот же: поднять голову, осмотреться и сделать то, что можно сделать прямо сейчас.",
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
        id: "prologue_build_shelter",
        text: "Поставьте первое жильё",
        hint: "Лагерь должен сначала стать пригодным для жизни. Поставьте простую палатку, чтобы у стоянки появилась защита от ветра и место для сна.",
        sceneText:
          "До очага стоянке нужна хотя бы одна вещь, которая делает её не случайной ночёвкой, а местом, где можно задержаться.",
        check: (game) => !!game.buildings.rest_tent,
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
    eraLabel: "~ 10\u202f000 лет до нашей эры ~",
    subtitle:
      "Конец ледникового периода. Мир ещё холодный, безымянный — и только-только начинает становиться человеческим.",
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
      "Очаг не появляется сразу. Сначала стоянка должна стать жилым местом: появится укрытие, накопится запас и только потом огонь станет устойчивым центром жизни.",
    campfireBuiltText:
      "Огонь разгорелся. Теперь у общины есть место, вокруг которого можно сидеть ближе друг к другу, сушить сырьё и повторять одни и те же действия уже не вслепую.",
    transitionTitle: "Начинается более организованная жизнь",
    transitionText:
      "Когда у общины появляются первое жильё, грубое орудие и удержанный костёр, случайные находки превращаются в более устойчивый уклад. С этого момента начинается уже знакомая primitive-эпоха.",
    postTransitionText:
      "После первого костра жизнь перестаёт быть только хаотичным поиском. У стоянки уже есть жильё, ритм и первые решения, которые можно повторять от дня к дню.",
    startKnowledgeEntryId: "after_ice",
    gatherActionIds: [
      "gather_wood",
      "gather_stone",
      "gather_fiber",
      "gather_supplies",
      "gather_water",
      "gather_food",
    ],
    visibleResourceIds: ["wood", "stone", "fiber", "crude_tools"],
    recipeIds: ["craft_crude_tools"],
    buildingIds: ["rest_tent", "campfire"],
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
        icon: TWIG_ICON_SVG,
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
        icon: "🌿",
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
        resourceAmount: 22,
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
        resourceAmount: 16,
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
        resourceAmount: 14,
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
        resourceAmount: 8,
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
        resourceAmount: 3,
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
        icon: "⛰️",
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
        icon: "📦",
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
          "Небольшое ровное место рядом с основанной стоянкой. Здесь можно поставить первое жильё ещё до того, как появится устойчивый очаг.",
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
        icon: "🔧",
        name: "Место под мастерскую",
        description:
          "Площадка рядом со стоянкой, где можно перейти от случайных связок к более повторяемому ремеслу.",
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
        resourceAmount: 8,
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
        icon: "🔥",
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
        icon: "🧱",
        name: "Место под печь",
        description:
          "Более защищённая точка для жаркой и долгой работы с огнём, когда лагерь уже умеет держать ремесленный ритм.",
        buildOptions: ["kiln"],
        discoveryHint:
          "Откроется после постройки мастерской или исследования добычи.",
        discoveryRequirements: (game) =>
          !!game.buildings.workshop || !!game.researched.mining,
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
    supplies: {
      id: "supplies",
      label: "Пища и вода",
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
      icon: `<img src="prototype/assets/icons/icon_r2c0.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#B22222",
      description: "Сырье для кирпича и ранней обжиговой цепочки.",
      storageCategory: "raw",
      storageSize: 1,
      carryWeight: 2.2,
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
      _iconSvgLegacy: `<svg class="plank-icon-svg" viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
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
      carryWeight: 1.3,
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
    },
    improved_tools: {
      name: "Улучшенные инструменты",
      icon: `<img src="prototype/assets/icons/improved_tools.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#2F4F4F",
      description: "Сильнее ускоряют ручной сбор, чем примитивные инструменты.",
      storageCategory: "tools",
      storageSize: 1,
      carryWeight: 1.8,
    },
    brick: {
      name: "Кирпичи",
      icon: `<img src="prototype/assets/icons/icon_r2c1.png" class="game-icon-img" alt="" draggable="false">`,
      color: "#CD5C5C",
      description:
        "Материал для прогрессивных построек и дальнейшего развития.",
      storageCategory: "materials",
      storageSize: 1,
      carryWeight: 2.4,
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
        "Чистая вода из ручья. Восстанавливает водный запас и немного сил при отдыхе.",
      storageCategory: "supplies",
      storageSize: 1,
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

  character: {
    title: "Ведущий стоянки",
    role: "Один человек, через которого ранняя стоянка ощущает усталость, голод и тяжесть каждого выхода.",
    satiety: {
      max: 10,
      gatherDrain: 0.35,
      buildDrain: 0.45,
      passiveRecoveryPerTick: 0.04,
      campfireRecoveryPerTick: 0.18,
      restTentRecoveryBonusPerTick: 0.08,
      // Auto-consume: при сытости ниже порога в лагере тратим 1 ед. еды
      // со склада и возвращаем foodRecovery ед. сытости.
      autoConsumeThreshold: 0.7,
      // Гистерезис: после кормления не едим снова, пока не наполнимся
      // как минимум до этого порога. Убирает «пилу» вокруг threshold.
      autoConsumeStopThreshold: 0.95,
      foodRecovery: 1.5,
      // Мягкий пассивный расход в лагере. Компенсируется авто-едой,
      // если на складе есть food. Если еды нет — сытость медленно падает.
      passiveDrainPerTick: 0.02,
      // Множители расхода в зависимости от построек лагеря.
      shelterDrainMultiplier: 0.5,
      campfireDrainMultiplier: 0.75,
    },
    hydration: {
      max: 10,
      passiveRecoveryPerTick: 0,
      passiveDrainPerTick: 0.04,
      // Авто-питьё в лагере.
      autoConsumeThreshold: 0.75,
      autoConsumeStopThreshold: 0.95,
      waterRecovery: 3,
      restTentRecoveryBonusPerTick: 0.05,
      storageRecoveryBonusPerTick: 0.02,
      shelterDrainMultiplier: 0.6,
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
        description: "Силы и сытость позволяют работать без явных штрафов.",
        regenPenaltyMs: 0,
        gatherOutputPenalty: 0,
        gatherCostPenalty: 0,
        maxSafeDistance: 99,
      },
      weakened: {
        id: "weakened",
        label: "Ослаблен",
        description: "Низкие силы или голод делают выходы заметно тяжелее.",
        regenPenaltyMs: 600,
        gatherOutputPenalty: 0,
        gatherCostPenalty: 1,
        maxSafeDistance: 2,
      },
      exhausted: {
        id: "exhausted",
        label: "Истощён",
        description:
          "Персонаж тянет работу с трудом, медленнее восстанавливается и уносит меньше.",
        regenPenaltyMs: 1400,
        gatherOutputPenalty: 1,
        gatherCostPenalty: 1,
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
    gather_supplies: {
      id: "gather_supplies",
      name: "Взять припасы",
      icon: "🧺",
      output: { wood: 2, stone: 2, fiber: 1 },
      energyCost: 0,
      cooldown: 1200,
      unlockedBy: null,
      mapOnly: true,
      deliveryMode: "multi-trip",
      description: "Из тайника сразу выходит дерево, камень и немного волокна.",
      prologueDescription:
        "Чьи-то брошенные припасы. В одной связке — ветки, камни и волокно. Этого хватит для первого костра.",
    },
    gather_water: {
      id: "gather_water",
      name: "Набрать воду",
      icon: "💧",
      output: { water: 1 },
      energyCost: 1,
      cooldown: 800,
      unlockedBy: null,
      description: "Холодная вода из ручья. При отдыхе восстанавливает силы.",
    },
    gather_food: {
      id: "gather_food",
      name: "Собрать еду",
      icon: "🫐",
      output: { food: 1 },
      energyCost: 1,
      cooldown: 1000,
      unlockedBy: null,
      description: "Ягоды, корни и грибы. При отдыхе восстанавливают сытость.",
    },
  },

  // ─── Recipes ───
  recipes: {
    craft_plank: {
      id: "craft_plank",
      name: "Сделать доски",
      icon: `<img src="prototype/assets/icons/plank.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/workshop_parts.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/crude_tools.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/improved_tools.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/brick.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/storage.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/campfire.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/workshop.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/rest_tent.png" class="game-icon-img" alt="" draggable="false">`,
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
      icon: `<img src="prototype/assets/icons/kiln.png" class="game-icon-img" alt="" draggable="false">`,
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

    // ── Ветвь «Выживание» — промежуточные узлы ───────────────────────────
    foraging: {
      id: "foraging",
      branch: "survival",
      order: 0,
      name: "Следы и сезоны",
      icon: "🌿",
      description:
        "Ягоды, коренья и волокна не случайны — у них есть места и время. Охотники замечают повторяющиеся следы и начинают искать намеренно, а не блуждать.",
      cost: { wood: 3, fiber: 2 },
      researchTimeMs: 7000,
      effect: { gatherBonus: 1 },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: [
        "Ручной сбор: +1 к каждому действию",
        "Общий опыт передвижения по местности улучшается",
      ],
    },
    body_conditioning: {
      id: "body_conditioning",
      branch: "survival",
      order: 2,
      name: "Закалка тела",
      icon: "💪",
      description:
        "Регулярные вылазки и отдых у огня постепенно закаляют тело. Усталость приходит позже, а дальние выходы становятся привычным делом.",
      cost: { fiber: 4, crude_tools: 1 },
      researchTimeMs: 10000,
      effect: { character: { enduranceBonus: 2, recoveryRatingBonus: 1 } },
      requires: "campfire",
      requiresTech: ["rest_discipline"],
      outcomes: [
        "Дальность безопасного выхода +2",
        "Восстановление в лагере становится заметнее",
        "Тяжёлая местность ощущается мягче",
      ],
    },

    // ── Ветвь «Производство» — промежуточные узлы ───────────────────────
    clay_reading: {
      id: "clay_reading",
      branch: "production",
      order: 0,
      name: "Чтение глины",
      icon: "🏺",
      description:
        "Не всякая глина одинакова. Опытный глазок замечает влажность, цвет и зернистость — и выбирает ту, что лучше ляжет в обжиг.",
      cost: { clay: 3, wood: 2 },
      researchTimeMs: 8000,
      effect: { automationIntervalMultiplier: 0.9 },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: [
        "Автоматизация работает немного быстрее",
        "Ранние производственные циклы становятся стабильнее",
      ],
    },
    kiln_practice: {
      id: "kiln_practice",
      branch: "production",
      order: 2,
      name: "Печная практика",
      icon: "🔥",
      description:
        "Жар жару рознь. Научившись управлять тягой и температурой, мастера добиваются равномерного обжига и заметно меньше брака.",
      cost: { brick: 3, clay: 3 },
      researchTimeMs: 11000,
      effect: { automationIntervalMultiplier: 0.85 },
      requires: "kiln",
      requiresTech: ["mining"],
      outcomes: [
        "Обжиг ускоряется ещё сильнее",
        "Производственные циклы становятся предсказуемее",
      ],
    },

    // ── Ветвь «Развитие общины» — промежуточные узлы ────────────────────
    camp_planning: {
      id: "camp_planning",
      branch: "community",
      order: 0,
      name: "Устройство стоянки",
      icon: "🗺️",
      description:
        "Когда каждый знает, где что лежит и куда нести добытое, лагерь перестаёт быть беспорядочной грудой. Строительство идёт заметно легче.",
      cost: { wood: 2, fiber: 3 },
      researchTimeMs: 8000,
      effect: { buildTimeMultiplier: 0.9 },
      requires: null,
      requiresTech: ["communal_memory"],
      outcomes: [
        "Строительство идёт немного быстрее",
        "Лагерь начинает работать как связная система",
      ],
    },
    work_rhythm: {
      id: "work_rhythm",
      branch: "community",
      order: 2,
      name: "Рабочий ритм",
      icon: "🥁",
      description:
        "В слаженном коллективе каждый знает, когда строить, а когда отдыхать. Простои сокращаются, работа движется ровнее.",
      cost: { plank: 4, crude_tools: 1 },
      researchTimeMs: 10000,
      effect: { buildTimeMultiplier: 0.8, character: { ingenuityBonus: 1 } },
      requires: "workshop",
      requiresTech: ["labor_division"],
      outcomes: [
        "Строительство ускоряется",
        "Разбор и крафт идут быстрее",
        "Слаженный труд становится основой перехода к следующей эпохе",
      ],
    },

    // ── Ветвь «Ремесло» — дополнительные узлы ───────────────────────────
    tool_sharpening: {
      id: "tool_sharpening",
      branch: "craft",
      order: 2,
      name: "Заточка орудий",
      icon: "⚡",
      description:
        "Тупое орудие — потерянное время. Умея поддерживать режущий край, мастера добывают больше за тот же путь и реже возвращаются с пустыми руками.",
      cost: { crude_tools: 2, stone: 3 },
      researchTimeMs: 9000,
      effect: { gatherBonus: 1, character: { fieldcraftBonus: 1 } },
      requires: null,
      requiresTech: ["basic_tools"],
      outcomes: [
        "Ручной сбор: ещё +1 к каждому действию",
        "Путь по тяжёлой местности ощущается легче",
      ],
    },
    material_sense: {
      id: "material_sense",
      branch: "craft",
      order: 3,
      name: "Чувство материала",
      icon: "🔩",
      description:
        "Мастер знает, где волокно даст слабину, а где дерево расколется. Заготовки расходуются точнее, и обрезки идут в дело, а не в отходы.",
      cost: { plank: 6, crude_tools: 2 },
      researchTimeMs: 12000,
      effect: { craftDiscount: 0.1, character: { ingenuityBonus: 1 } },
      requires: "workshop",
      requiresTech: ["crafting"],
      outcomes: [
        "Стоимость крафта снижается ещё на 10%",
        "Разбор и крафт становятся быстрее",
        "Мастерская начинает работать как настоящий производственный узел",
      ],
    },
  },
};

// ─── Changelog data ─────────────────────────────────────────────────────────
const CHANGELOG_DATA = [
  {
    version: "v0.1.16",
    date: "2026-04-22",
    title: "Еда, вода и исправление краша карты",
    changes: [
      {
        type: "added",
        text: "Еда и вода добавлены как отдельные ресурсы и включены в ранний цикл",
      },
      {
        type: "improved",
        text: "Вода теперь участвует в состоянии персонажа, логистике и отдыхе",
      },
      {
        type: "improved",
        text: "Карта, персонаж и панели интерфейса показывают расход еды и воды",
      },
      {
        type: "fixed",
        text: "Устранён краш при сборе еды и воды на карте",
      },
      {
        type: "fixed",
        text: "Технические SVG-фрагменты больше не попадают в подсказки как мусорный текст",
      },
      {
        type: "fixed",
        text: "Клик по тайлам карты больше не оставляет лишнюю рамку фокуса",
      },
    ],
  },
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
