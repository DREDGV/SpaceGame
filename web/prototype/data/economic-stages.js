// Economic development stages (Stage 1A) — definitions only; current stage is computed from game state.

Object.assign(GAME_DATA, {
  economicStagesById: {
    lone_survivor: {
      id: "lone_survivor",
      title: "Одинокий выживший",
      description:
        "Ручной сбор, первые озарения и минимальный уклад: материалы приходят из шагов и внимания, а не из готовой экономики.",
      summary: "Руки, находки, первые связи между материалами.",
      requirements: [
        "Собрать базовые материалы (дерево, камень, волокно).",
        "Открыть первые озарения о материалах и растопке.",
        "Связать грубое орудие и подготовить место у огня.",
      ],
      unlocks: [
        "Ручной сбор веток, камня и волокна.",
        "Поиск материалов для растопки (через сбор).",
        "Обработка края камня и сбор (одна механика).",
      ],
      nextStageId: "campfire_camp",
    },
    campfire_camp: {
      id: "campfire_camp",
      title: "Стоянка у огня",
      description:
        "Огонь закреплён: появляется устойчивый центр стоянки, можно держать цикл тепла и первую автоматизацию костра.",
      summary: "Костёр как узел: тепло, ритм, простые циклы.",
      requirements: [
        "Построен костёр.",
        "Есть запас материалов для поддержания огня и простых дел.",
      ],
      unlocks: [
        "Поддержание огня через цикл костра.",
        "Связка грубого орудия (ремесленный шаг через крафт).",
        "Подготовка к рабочему месту (детали мастерской в крафте).",
      ],
      nextStageId: "early_workshop",
    },
    early_workshop: {
      id: "early_workshop",
      title: "Раннее ремесленное место",
      description:
        "Мастерская подняла пропускную способность: обработка и сборка выходят на уровень повторяемых решений, а не разовых находок.",
      summary: "Производство как привычка: очередь, детали, инструмент.",
      requirements: ["Построена мастерская."],
      unlocks: [
        "Крафт деталей мастерской и улучшенных инструментов по правилам игры.",
        "Дальнейшие цели эпохи и цепочки из данных игры.",
      ],
      nextStageId: null,
    },
  },

  /**
   * @param {object} game — экземпляр GameState
   * @returns {"lone_survivor"|"campfire_camp"|"early_workshop"}
   */
  computeEconomicStageId(game) {
    if (game.buildings?.workshop) return "early_workshop";
    if (game.buildings?.campfire) return "campfire_camp";
    return "lone_survivor";
  },

  /** Short navigator lines when regular goals are not active (пролог и т.п.). */
  economicNavigatorByStageId: {
    lone_survivor: {
      headline: "Соберите ветки, камень и волокно; откройте первые озарения и грубые инструменты.",
      detail: "Следующий этап — стоянка у огня: нужен костёр и устойчивый ритм тепла.",
    },
    campfire_camp: {
      headline: "Держите огонь и материалы; развивайте крафт и готовьте детали мастерской.",
      detail: "Следующий этап — мастерская как постоянное рабочее место.",
    },
    early_workshop: {
      headline: "Используйте мастерскую: детали, улучшенные инструменты и цепочки из целей эпохи.",
      detail: "Дальше — автоматизация, запасы и постройки по открытым рецептам.",
    },
  },

  /** UI-навигация для активных целей из `goals` (после онбординга). */
  economicGoalNavigatorById: {
    goal_accelerate_gathering: {
      actionId: "work_bind_crude_tool",
      targetMode: "production",
      targetPanel: "shell-economic-core",
      highlightId: "work_bind_crude_tool",
      ctaLabel: "К работе",
    },
    goal_prepare_throughput: {
      actionId: "work_prepare_workplace",
      targetMode: "production",
      targetPanel: "shell-economic-core",
      highlightId: "work_prepare_workplace",
      ctaLabel: "К работе",
    },
    goal_first_chain: {
      actionId: "work_prepare_workplace",
      targetMode: "production",
      targetPanel: "shell-economic-core",
      highlightId: "work_prepare_workplace",
      ctaLabel: "К работе",
    },
    goal_automate_bricks: {
      actionId: "work_maintain_fire",
      targetMode: "production",
      targetPanel: "shell-economic-core",
      highlightId: "work_maintain_fire",
      ctaLabel: "К работе",
    },
    goal_unlock_kiln: {
      actionId: null,
      targetMode: "map",
      targetPanel: "buildings-panel",
      highlightId: "buildings-panel",
      ctaLabel: "К постройкам",
    },
  },

  /** Навигация по этапу, когда цели `goals` ещё не активны. */
  economicStageNavigatorDefaults: {
    lone_survivor: {
      actionId: "work_gather_branches",
      targetMode: "production",
      targetPanel: "shell-economic-core",
      highlightId: "work_gather_branches",
      ctaLabel: "К работе",
    },
    campfire_camp: {
      actionId: "work_maintain_fire",
      targetMode: "production",
      targetPanel: "shell-economic-core",
      highlightId: "work_maintain_fire",
      ctaLabel: "К работе",
    },
    early_workshop: {
      actionId: "work_prepare_workplace",
      targetMode: "production",
      targetPanel: "shell-economic-core",
      highlightId: "work_prepare_workplace",
      ctaLabel: "К работе",
    },
  },

  /**
   * Следующий шаг + подсказки для UI (режим, панель, подсветка). Не сохраняется.
   * headline/detail — совместимость с Stage 1B; title/description — расширение 1C.
   *
   * @param {object} game
   * @returns {{
   *   id: string,
   *   title: string,
   *   headline: string,
   *   description: string,
   *   detail: string,
   *   source: "goal"|"stage"|"complete"|"onboarding",
   *   goalId: string|null,
   *   goalText: string|null,
   *   actionId: string|null,
   *   targetMode: string,
   *   targetPanel: string|null,
   *   highlightId: string|null,
   *   ctaLabel: string,
   * }}
   */
  getEconomicNextStep(game) {
    const stageId = this.computeEconomicStageId(game);
    const def = this.economicStagesById?.[stageId] || null;
    const nav = this.economicNavigatorByStageId?.[stageId] || null;

    const truncate = (s, max = 140) => {
      const t = String(s || "").trim();
      if (t.length <= max) return t;
      return `${t.slice(0, max - 1)}…`;
    };

    const mergeNav = (partial, navUi) => {
      const ui = navUi || {};
      const cta = ui.ctaLabel || "Перейти";
      const mode = ui.targetMode || "production";
      const panel = ui.targetPanel != null ? ui.targetPanel : "shell-economic-core";
      const act = ui.actionId != null ? ui.actionId : null;
      const hid =
        ui.highlightId != null ? ui.highlightId : act || "economic-core";
      return {
        ...partial,
        title: partial.headline,
        description: partial.detail,
        actionId: act,
        targetMode: mode,
        targetPanel: panel,
        highlightId: hid,
        ctaLabel: cta,
      };
    };

    if (typeof game.isOnboardingActive === "function" && game.isOnboardingActive()) {
      const step =
        typeof game.getCurrentOnboardingStep === "function"
          ? game.getCurrentOnboardingStep()
          : null;
      const headline = step?.text || "Шаг пролога";
      const detail = truncate(
        step?.hint || step?.sceneText || nav?.detail || def?.summary || "",
        160,
      );
      const stepKey = step?.id || "onboarding";
      return mergeNav(
        {
          id: `onboarding_${stepKey}`,
          stageId,
          headline,
          detail,
          source: "onboarding",
          goalId: null,
          goalText: null,
        },
        {
          actionId: null,
          targetMode: "map",
          targetPanel: "onboarding-step-panel",
          highlightId: "onboarding-step-panel",
          ctaLabel: "К шагу",
        },
      );
    }

    const goal =
      typeof game.getCurrentGoal === "function" ? game.getCurrentGoal() : null;

    if (goal) {
      const hint = goal.hint || goal.description || def?.summary || "";
      const navUi = this.economicGoalNavigatorById?.[goal.id] || {};
      return mergeNav(
        {
          id: `goal_${goal.id}`,
          stageId,
          headline: goal.text || "Текущая цель",
          detail: truncate(hint, 160),
          source: "goal",
          goalId: goal.id || null,
          goalText: goal.text || null,
        },
        navUi,
      );
    }

    if (game.allGoalsComplete) {
      return mergeNav(
        {
          id: "all_goals_complete",
          stageId,
          headline:
            "Базовые цели выполнены — опирайтесь на эпоху, знания и открытые цепочки.",
          detail: truncate(def?.summary || nav?.detail || "", 160),
          source: "complete",
          goalId: null,
          goalText: null,
        },
        {
          actionId: null,
          targetMode: "production",
          targetPanel: "shell-economic-core",
          highlightId: "economic-core",
          ctaLabel: "Открыть производство",
        },
      );
    }

    const stageUi = this.economicStageNavigatorDefaults?.[stageId] || {};
    return mergeNav(
      {
        id: `stage_${stageId}`,
        stageId,
        headline: nav?.headline || def?.requirements?.[0] || def?.summary || "",
        detail: truncate(nav?.detail || def?.summary || "", 160),
        source: "stage",
        goalId: null,
        goalText: null,
      },
      stageUi,
    );
  },
});
