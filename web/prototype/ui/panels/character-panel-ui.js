// Character panel rendering.

Object.assign(UI.prototype, {
  _cpLockInteraction(container, durationMs = 900) {
    if (!container) return;
    container.dataset.interactionLockUntil = String(Date.now() + durationMs);
  },

  _cpComputePanelStatus(state) {
    const risks = [];
    const auto = state.autoConsume || {};
    const rest = state.restProfile || {};
    const baseConditionId = state.condition?.id || "stable";

    if (auto.food?.enabled && auto.food.stock < 1) {
      risks.push("склад еды пуст");
    }
    if (auto.water?.enabled && auto.water.stock < 1) {
      risks.push("запас воды пуст");
    }
    if (!auto.shelter?.hasCampfire && (rest.energyGain || 0) <= 0) {
      risks.push("лагерь пока не держит силы отдыхом");
    }

    if (baseConditionId === "exhausted") {
      return {
        label: state.condition.label,
        note:
          risks.length > 0
            ? `${state.condition.description} Дополнительно: ${risks.join(", ")}.`
            : state.condition.description,
        tone: "bad",
      };
    }

    if (baseConditionId === "weakened") {
      return {
        label: state.condition.label,
        note:
          risks.length > 0
            ? `${state.condition.description} Дополнительно: ${risks.join(", ")}.`
            : state.condition.description,
        tone: "warn",
      };
    }

    if (risks.length > 0) {
      return {
        label: "Есть риск",
        note: `Сейчас показатели в норме, но ${risks.join(", ")}.`,
        tone: "warn",
      };
    }

    return {
      label: state.condition.label,
      note: state.condition.description,
      tone: "ok",
    };
  },

  _cpBuildRenderKey(state, status, chips, expanded) {
    const trip = state.tripProfile || null;
    const rest = state.restProfile || null;
    const round = (value, digits = 1) =>
      Number.isFinite(value)
        ? Number(this.formatNumber(value, digits).replace(",", "."))
        : null;

    return JSON.stringify({
      expanded,
      title: state.title,
      statusLabel: status.label,
      statusTone: status.tone,
      statusNote: status.note,
      chips: chips.map((chip) => `${chip.tone}:${chip.label}`).join("|"),
      energy: [round(state.energy.current, 0), round(state.energy.max, 0)],
      satiety: [round(state.satiety.current, 1), round(state.satiety.max, 0)],
      hydration: [
        round(state.hydration.current, 1),
        round(state.hydration.max, 0),
      ],
      restCooldownSec: Math.ceil((rest?.remainingMs || 0) / 1000),
      canRest: !!rest?.canRest,
      carry: {
        capacity: round(state.carry.capacity, 1),
        load: round(state.carry.carriedLoad, 1),
        available: round(state.carry.availableCapacity, 1),
      },
      restrictionText: state.restrictionText,
      recoverySummary: state.recovery?.summary || "",
      restNote: rest?.note || "",
      auto: {
        food: state.autoConsume?.food?.stock || 0,
        water: state.autoConsume?.water?.stock || 0,
      },
      trip: trip
        ? {
            kind: state.tripType,
            zone: trip.zoneLabel,
            path: trip.pathLabel || "",
            blocked: trip.blockedReason || "",
            load: round(trip.load, 1),
            energyCost: round(trip.energyCost, 2),
            satietyCost: round(trip.satietyCost, 2),
            hydrationCost: round(trip.hydrationCost, 2),
            deliveryTrips: trip.deliveryTrips || 0,
          }
        : null,
    });
  },

  _cpComputeStateChips(state) {
    // Возвращаем самые важные активные сигналы без противоречивых сочетаний.
    const chips = [];
    const pushChip = (priority, chip) => {
      chips.push({ ...chip, priority });
    };
    const sat = state.satiety.pct;
    const hyd = state.hydration.pct;
    const energy = state.energy.pct;
    if (hyd < 0.25) {
      pushChip(10, { icon: "🩸", label: "Сильная жажда", tone: "bad" });
    } else if (hyd < 0.5) {
      pushChip(20, { icon: "💧", label: "Лёгкая жажда", tone: "warn" });
    }
    if (sat < 0.25) {
      pushChip(11, { icon: "🍖", label: "Сильный голод", tone: "bad" });
    } else if (sat < 0.5) {
      pushChip(21, { icon: "🍖", label: "Голод", tone: "warn" });
    }
    if (energy < 0.2) {
      pushChip(12, { icon: "😫", label: "Истощён", tone: "bad" });
    } else if (energy < 0.4) {
      pushChip(22, { icon: "😕", label: "Устал", tone: "warn" });
    }
    const carry = state.carry?.capacity || 0;
    const carriedLoad = state.carry?.carriedLoad || 0;
    const carryLoad =
      carriedLoad > 0
        ? carriedLoad
        : !!this._campTravelAction
          ? state.tripProfile?.load
          : null;
    if (Number.isFinite(carryLoad) && carry > 0 && carryLoad > carry * 0.85) {
      pushChip(23, { icon: "🎒", label: "Перегружен", tone: "warn" });
    }
    const auto = state.autoConsume;
    if (auto && auto.food.enabled && auto.food.stock < 1) {
      pushChip(30, { icon: "🍖", label: "Склад еды пуст", tone: "warn" });
    }
    if (auto && auto.water.enabled && auto.water.stock < 1) {
      pushChip(31, {
        icon: "💧",
        label: "Запас воды пуст",
        tone: "warn",
      });
    }
    if (chips.length === 0 && energy >= 0.9 && sat >= 0.85 && hyd >= 0.75) {
      pushChip(90, { icon: "⚡", label: "Полон сил", tone: "ok" });
    }
    return chips
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3)
      .map(({ priority, ...chip }) => chip);
  },

  _cpBuildOverviewCards({
    state,
    status,
    trip,
    tripKind,
    rest,
    recoverySummary,
    rangeValue,
    enduranceNote,
    mobilityNote,
  }) {
    const auto = state.autoConsume || {};
    const foodStock = auto.food?.stock || 0;
    const waterStock = auto.water?.stock || 0;
    const tripSignalBits = [
      trip?.pathLabel || "",
      trip?.effortLabel || "",
      trip?.carryState?.label || "",
      trip?.needsImpact?.label || "",
    ]
      .filter(Boolean)
      .join(", ");

    let immediateCard = {
      title: "Сейчас главное",
      value: "Следующая цель не выбрана",
      note: "Кликните участок на карте, и здесь появится короткое объяснение цены выхода.",
      tone: "info",
    };

    if (auto.water?.enabled && waterStock < 1) {
      immediateCard = {
        title: "Сейчас главное",
        value: "Пополнить воду",
        note: "Запас воды уже пуст, поэтому лагерь не подстрахует следующий выход.",
        tone: "warn",
      };
    } else if (auto.food?.enabled && foodStock < 1) {
      immediateCard = {
        title: "Сейчас главное",
        value: "Найти еду",
        note: "Сытость ещё держится, но лагерь уже не закрывает следующий цикл отдыха и работы.",
        tone: "warn",
      };
    } else if (trip?.blockedReason) {
      immediateCard = {
        title: "Сейчас главное",
        value: "Выход пока не готов",
        note: trip.blockedReason,
        tone: "warn",
      };
    } else if (trip) {
      immediateCard = {
        title: "Сейчас главное",
        value: `${tripKind} · ${trip.zoneLabel}`,
        note:
          trip.needsImpact?.note ||
          tripSignalBits ||
          "Цель уже выбрана: здесь собрана краткая оценка пути и нагрузки.",
        tone: trip.needsImpact?.tone || (status.tone === "bad" ? "warn" : "ok"),
      };
    } else if (rest?.canRest) {
      immediateCard = {
        title: "Сейчас главное",
        value: "Можно перевести дух",
        note: rest.note,
        tone: "ok",
      };
    }

    const rangeCard = {
      title: "Безопасный выход",
      value: rangeValue,
      note: `${enduranceNote}. ${mobilityNote}`,
      tone:
        state.condition.maxSafeDistance <= 1
          ? "warn"
          : state.condition.maxSafeDistance >= 99
            ? "ok"
            : "info",
    };

    let supportValue = "Лагерь не подстрахует";
    let supportNote =
      "Запасы еды и воды нужно держать в лагере, иначе следующий цикл быстро станет рискованным.";
    let supportTone = "warn";

    if (foodStock > 0 && waterStock > 0) {
      supportValue = `Еда ${foodStock} · вода ${waterStock}`;
      supportNote = recoverySummary
        ? `Лагерь уже помогает жить ритмом, а не только руками: ${recoverySummary}.`
        : "В лагере уже есть базовый запас на следующий выход.";
      supportTone = "ok";
    } else if (foodStock > 0 || waterStock > 0) {
      supportValue =
        foodStock > 0
          ? `Еда ${foodStock}, воды нет`
          : `Вода ${waterStock}, еды нет`;
      supportNote = recoverySummary
        ? `${recoverySummary}. Но один из базовых запасов уже пуст.`
        : "Один из базовых запасов уже пуст, поэтому лагерь держится только частично.";
      supportTone = "warn";
    }

    return [
      immediateCard,
      rangeCard,
      {
        title: "Опора лагеря",
        value: supportValue,
        note: supportNote,
        tone: supportTone,
      },
    ];
  },

  _cpBuildConditionTooltip(condition) {
    // Тултип со списком активных штрафов состояния персонажа.
    if (!condition) return "";
    const lines = [condition.label];
    if (condition.description) {
      lines.push(condition.description);
    }
    const effects = [];
    if (condition.gatherOutputPenalty > 0) {
      effects.push(
        `−${condition.gatherOutputPenalty} к каждому ресурсу на выходе`,
      );
    }
    if (condition.gatherCostPenalty > 0) {
      effects.push(`+${condition.gatherCostPenalty} энергии к сбору и стройке`);
    }
    if (condition.regenPenaltyMs > 0) {
      const sec = (condition.regenPenaltyMs / 1000).toFixed(1);
      effects.push(`восстановление энергии медленнее на ${sec} с`);
    }
    if (condition.craftTimeMult && condition.craftTimeMult > 1) {
      const pct = Math.round((condition.craftTimeMult - 1) * 100);
      effects.push(`крафт медленнее на ${pct}%`);
    }
    if (
      Number.isFinite(condition.maxSafeDistance) &&
      condition.maxSafeDistance < 99
    ) {
      effects.push(
        `безопасная дистанция ограничена ${condition.maxSafeDistance}`,
      );
    }
    if (effects.length > 0) {
      lines.push("Штрафы: " + effects.join("; ") + ".");
    }
    // Экранируем кавычки — значение идёт в HTML-атрибут title.
    return lines.join("\n").replace(/"/g, "&quot;");
  },

  // HTML для кнопки возврата к текущей домашней точке + индикатора рюкзака.
  // До основания это ночёвка, после основания — лагерь.
  _cpBuildReturnButtonHtml() {
    const atCamp = this.game.isCharacterAtCamp?.();
    const campReady = this.game.isCampSetupDone?.() ?? false;
    const tripInv = this.game.getTripInventory?.() || {};
    const tripTotal = this.game.getTripInventoryTotal?.() || 0;
    if (atCamp && tripTotal <= 0) return "";
    const parts = Object.entries(tripInv)
      .filter(([, n]) => Number.isFinite(n) && n > 0)
      .map(([id, n]) => {
        const res = this.game.data.resources?.[id];
        return `${res?.icon || id}${n}`;
      });
    const tripLabel = parts.length ? parts.join(" ") : "пусто";
    const traveling = !!this._campTravelAction;
    const returnLabel = campReady ? "в лагерь" : "к ночёвке";
    const unloadLabel = campReady ? "в лагерь" : "у ночёвки";
    const label = atCamp
      ? `📥 Выгрузить ${unloadLabel} (${tripLabel})`
      : `🏠 Вернуться ${returnLabel}${tripTotal > 0 ? ` · ${tripLabel}` : ""}`;
    const disabled = traveling ? " disabled" : "";
    const title = traveling
      ? "Персонаж уже в пути"
      : atCamp
        ? `Сгрузить рюкзак ${unloadLabel}`
        : `Идти назад ${returnLabel} и сгрузить добычу`;
    return `<button id="character-return-btn" class="character-return-btn${disabled}" type="button" title="${title}"${disabled ? " disabled" : ""}>${label}</button>`;
  },

  renderCharacterPanel() {
    const container = document.getElementById("character-panel");
    if (!container) return;

    const state = this.game.getCharacterState();
    const energyPct = state.energy.pct * 100;
    const satietyPct = state.satiety.pct * 100;
    const hydrationPct = state.hydration.pct * 100;
    const regenIntervalSec = (state.regen.intervalMs / 1000).toFixed(1);
    const satietyRecovery = state.satiety.recoveryPerTick;
    const hydrationRecovery = state.hydration.recoveryPerTick;
    const status = this._cpComputePanelStatus(state);
    const chips = this._cpComputeStateChips(state);
    const ticksPerMin =
      state.regen.intervalMs > 0 ? 60000 / state.regen.intervalMs : 0;
    const auto = state.autoConsume || null;
    const satietyNetPerMin =
      satietyRecovery * ticksPerMin - (auto?.drain?.satietyPerMin || 0);
    const hydrationNetPerMin =
      hydrationRecovery * ticksPerMin - (auto?.drain?.hydrationPerMin || 0);
    const trip = state.tripProfile;
    const rest = state.restProfile;
    const totalRestEnergy =
      rest.energyGain + (rest.willUseWater ? rest.waterBonusEnergy || 0 : 0);
    const totalRestSatiety =
      rest.satietyGain + (rest.willUseFood ? rest.foodBonusSatiety || 0 : 0);
    const totalRestHydration = rest.willUseWater ? rest.hydrationGain || 0 : 0;
    const tripKind =
      state.tripType === "build"
        ? "Стройка"
        : state.tripType === "trail"
          ? "Прокладка тропы"
          : state.tripType === "gather"
            ? "Выход за ресурсом"
            : "Текущий выход";
    const recoverySummary = state.recovery?.summary || "";
    const carryBonusText =
      state.carry.capacityBonus > 0
        ? ` (+${this.formatNumber(state.carry.capacityBonus)})`
        : "";
    const satietyMaxBonusText =
      state.satiety.maxBonus > 0
        ? ` (+${this.formatNumber(state.satiety.maxBonus, 0)})`
        : "";
    const hydrationMaxBonusText =
      state.hydration.maxBonus > 0
        ? ` (+${this.formatNumber(state.hydration.maxBonus, 0)})`
        : "";
    const rangeChipText =
      state.condition.maxSafeDistance >= 99
        ? "🗺 вся открытая карта"
        : state.condition.maxSafeDistance <= 1
          ? "🗺 только ближние клетки"
          : `🗺 до дистанции ${state.condition.maxSafeDistance}`;
    const rangeSummaryValue =
      state.condition.maxSafeDistance >= 99
        ? "Вся открытая карта"
        : state.condition.maxSafeDistance <= 1
          ? "Только рядом с лагерем"
          : `До ${state.condition.maxSafeDistance} переходов`;
    const enduranceValue =
      state.stats.safeDistance >= 99
        ? "вся открытая карта"
        : state.stats.safeDistance <= 1
          ? "только рядом"
          : `до ${state.stats.safeDistance} клеток`;
    const enduranceNote =
      state.stats.enduranceBonus > 0
        ? `+${state.stats.enduranceBonus} к безопасной дальности`
        : "дальность пока держится только на текущих силах";
    const fieldcraftValue =
      state.stats.fieldcraft > 0
        ? `снимает до ${state.stats.fieldcraft} штрафа пути`
        : "без облегчения пути";
    const fieldcraftYieldBonus = state.stats.foragingYieldBonus || 0;
    const surveyRevealBonus = state.stats.surveyRevealBonus || 0;
    const fieldcraftNote =
      state.stats.fieldcraft > 0
        ? `хуже ощущаются тяжёлая местность и дальние выходы${fieldcraftYieldBonus > 0 ? `, а вода/еда/волокно дают +${fieldcraftYieldBonus}` : ""}${surveyRevealBonus > 0 ? ", при разведке может открыться соседняя клетка" : ""}`
        : "дистанция и тяжёлая почва бьют в полную силу";
    const useEarlySharedStock =
      this.game._shouldUseEarlySharedStock?.() || false;
    const carryValue =
      state.carry.carriedLoad > 0
        ? `${this.formatNumber(state.carry.carriedLoad)} / ${this.formatNumber(state.carry.capacity)} ед.`
        : `${this.formatNumber(state.carry.capacity)} ед.`;
    const carryNote =
      state.carry.carriedLoad > 0
        ? `свободно ещё ${this.formatNumber(state.carry.availableCapacity)} ед.`
        : useEarlySharedStock
          ? "до основания лагеря найденное сразу считается ранним запасом у ночёвки"
          : state.carry.capacityBonus > 0
            ? `лагерь и уклад дают +${this.formatNumber(state.carry.capacityBonus, 0)} к переноске`
            : "весь груз уносится на себе";
    const strengthCapacityBonus = state.carry.strengthCapacityBonus || 0;
    const heavyLoadPct = Math.round((state.carry.heavyThreshold || 0.85) * 100);
    const extractionYieldBonus = state.stats.extractionYieldBonus || 0;
    const strengthValue = `${this.formatNumber(state.stats.strength, 1)} ур.`;
    const strengthNote =
      strengthCapacityBonus > 0
        ? `+${this.formatNumber(strengthCapacityBonus, 1)} к переноске, тяжёлый груз с ${heavyLoadPct}%${extractionYieldBonus > 0 ? `, тяжёлая добыча +${extractionYieldBonus}` : ""}`
        : extractionYieldBonus > 0
          ? `тяжёлая добыча даёт +${extractionYieldBonus}, тяжёлый груз с ${heavyLoadPct}% переносимости`
          : `тяжёлый груз начинается с ${heavyLoadPct}% переносимости`;
    const travelGainPct = Math.max(
      0,
      Math.round((1 - (state.stats.travelSpeedMultiplier || 1)) * 100),
    );
    const needsRelief = state.stats.needsRelief || 0;
    const mobilityValue =
      travelGainPct > 0 ? `-${travelGainPct}% времени пути` : "базовый ход";
    const mobilityNote =
      needsRelief > 0
        ? `дальние выходы тратят на ${this.formatNumber(needsRelief, 2)} меньше еды/воды`
        : "еда и вода тратятся без снижения от хода";
    const ingenuityGainPct = Math.max(
      0,
      Math.round((1 - (state.stats.ingenuityTimeMultiplier || 1)) * 100),
    );
    const supplySalvageBonus = state.stats.supplySalvageBonus || 0;
    const restEfficiency = state.stats.restEfficiency || {
      food: 0,
      water: 0,
      energy: 0,
    };
    const ingenuityValue =
      ingenuityGainPct > 0
        ? `-${ingenuityGainPct}% к времени`
        : "базовый разбор";
    const ingenuityNote =
      ingenuityGainPct > 0
        ? `быстрее крафт, исследования и очередь знаний${supplySalvageBonus > 0 ? `, припасы дают +${supplySalvageBonus}` : ""}${surveyRevealBonus > 0 ? ", проще читать следы на карте" : ""}`
        : supplySalvageBonus > 0 || surveyRevealBonus > 0
          ? `припасы дают +${supplySalvageBonus}, а разведка лучше читает соседние следы`
          : "крафт и исследования идут без ускорения";
    const restValue =
      totalRestEnergy > 0 || totalRestSatiety > 0 || totalRestHydration > 0
        ? `+${totalRestEnergy} сил · +${this.formatNumber(totalRestSatiety, 1)} сытости · +${this.formatNumber(totalRestHydration, 1)} воды`
        : "передышка не нужна";
    const restNote = rest.blockedReason
      ? `${rest.note}${restEfficiency.food > 0 || restEfficiency.water > 0 || restEfficiency.energy > 0 ? ` Рацион даёт +${this.formatNumber(restEfficiency.food, 2)} сытости, +${this.formatNumber(restEfficiency.water, 2)} воды и до +${this.formatNumber(restEfficiency.energy, 2)} сил.` : ""} ${rest.blockedReason}`
      : `${rest.note}${restEfficiency.food > 0 || restEfficiency.water > 0 || restEfficiency.energy > 0 ? ` Рацион даёт +${this.formatNumber(restEfficiency.food, 2)} сытости, +${this.formatNumber(restEfficiency.water, 2)} воды и до +${this.formatNumber(restEfficiency.energy, 2)} сил.` : ""}`;
    const restButtonLabel = rest.canRest
      ? rest.label
      : rest.remainingMs > 0
        ? `⌛ ${this.formatCooldownMs(rest.remainingMs)}`
        : "Сейчас не нужно";
    const recoverySourcesHtml =
      state.recovery?.sources?.length > 0
        ? `<span class="character-chip chip-secondary">🏕 ${recoverySummary}</span>`
        : `<span class="character-chip chip-secondary is-empty">🏕 нет опоры отдыха</span>`;
    const energyTrendText =
      state.regen.perTick > 0
        ? `⚡ силы возвращаются сами каждые ${regenIntervalSec}с`
        : "⚡ силы сами не возвращаются";
    const satietyTrendText = auto?.food?.enabled
      ? auto.food.stock > 0
        ? "🍖 лагерь подхватывает сытость"
        : "🍖 лагерь сейчас не кормит"
      : "🍖 автоеда отключена";
    const hydrationTrendText = auto?.water?.enabled
      ? auto.water.stock > 0
        ? "💧 лагерь подхватывает воду"
        : "💧 лагерь сейчас не поит"
      : "💧 автовода отключена";
    const expanded = this.characterPanelExpanded;
    const overviewCards = this._cpBuildOverviewCards({
      state,
      status,
      trip,
      tripKind,
      rest,
      recoverySummary,
      rangeValue: rangeSummaryValue,
      enduranceNote,
      mobilityNote,
    });
    const visibleOverviewCards = expanded
      ? overviewCards
      : overviewCards.slice(0, 2);
    const cargoNote = [carryNote, strengthNote].filter(Boolean).join(". ");
    const capabilityCards = [
      {
        icon: "🗺",
        title: "Дальние выходы",
        value: rangeSummaryValue,
        note: `${enduranceNote}. ${mobilityNote}`,
      },
      {
        icon: "🥾",
        title: "Путь и сбор",
        value: fieldcraftValue,
        note: fieldcraftNote,
      },
      {
        icon: "🎒",
        title: "Груз",
        value: carryValue,
        note: cargoNote,
      },
      {
        icon: "🛠",
        title: "Ремесло и смекалка",
        value: ingenuityValue,
        note: ingenuityNote,
      },
    ];

    const renderKey = this._cpBuildRenderKey(state, status, chips, expanded);
    if (container.dataset.renderKey === renderKey) {
      return;
    }
    container.dataset.renderKey = renderKey;

    const compactRestHtml = !expanded
      ? rest.canRest
        ? `<button id="character-rest-compact-btn" class="character-rest-compact-btn" type="button">🛌 ${rest.label}</button>`
        : rest.remainingMs > 0
          ? `<span class="character-chip character-chip-cooldown">🛌 ⌛ ${this.formatCooldownMs(rest.remainingMs)}</span>`
          : ""
      : "";

    const compactTripHtml =
      !expanded && trip
        ? `<div class="character-trip-compact">
          <span class="character-trip-compact-kind">${tripKind}</span>
          <span>🗺 ${trip.zoneLabel}</span>
          ${Number.isFinite(trip.load) ? `<span>🎒 ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}</span>` : ""}
          ${Number.isFinite(trip.tripsRequired) && trip.tripsRequired > 1 ? `<span>📦 ${trip.tripsRequired} ходки</span>` : ""}
          ${trip.pathLabel ? `<span>${trip.pathIcon || "·"} ${trip.pathLabel}</span>` : ""}
          ${trip.effortLabel ? `<span>${trip.effortLabel}</span>` : ""}
          ${trip.blockedReason ? `<span class="character-trip-warning">${trip.blockedReason}</span>` : ""}
        </div>`
        : "";

    container.classList.remove("is-low", "is-critical");
    if (state.condition.id === "exhausted") {
      container.classList.add("is-critical");
    } else if (state.condition.id === "weakened") {
      container.classList.add("is-low");
    }
    container.classList.toggle("is-expanded-view", expanded);
    container.classList.toggle("is-compact-view", !expanded);

    const tripHtml = trip
      ? `
        <div class="character-trip">
          <div class="character-trip-label">Если идти сейчас</div>
          <div class="character-trip-title">${tripKind} · ${trip.zoneLabel}</div>
          <div class="character-trip-meta">
            ${
              Number.isFinite(trip.load)
                ? `<span>🎒 ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}</span>`
                : ""
            }
            ${
              trip.deliveryTrips > 1
                ? `<span>📦 ${trip.deliveryTrips} ходки</span>`
                : ""
            }
            ${
              Number.isFinite(trip.totalLoad) && trip.deliveryTrips > 1
                ? `<span>Σ ${this.formatNumber(trip.totalLoad)}</span>`
                : ""
            }
            ${trip.pathLabel ? `<span>${trip.pathIcon || "·"} ${trip.pathLabel}</span>` : ""}
            ${trip.effortLabel ? `<span>${trip.effortLabel}</span>` : ""}
            <span>⚡ -${this.formatNumber(trip.energyCost, 2)}</span>
            ${Number.isFinite(trip.satietyCost) ? `<span>🍖 -${this.formatNumber(trip.satietyCost, 2)}</span>` : ""}
            ${Number.isFinite(trip.hydrationCost) ? `<span>💧 -${this.formatNumber(trip.hydrationCost, 2)}</span>` : ""}
          </div>
          ${
            trip.blockedReason
              ? `<div class="character-trip-warning">${trip.blockedReason}</div>`
              : trip.needsImpact && trip.needsImpact.id !== "steady"
                ? `<div class="character-trip-warning">${trip.needsImpact.note}</div>`
                : ""
          }
        </div>
      `
      : `
        <div class="character-trip">
          <div class="character-trip-label">Следующий выход</div>
          <div class="character-trip-empty">Выберите участок на карте. Здесь появится короткий разбор цены пути, нагрузки и того, что этот выход изменит.</div>
        </div>
      `;

    const attributesHtml = `
      <div class="character-attribute-grid">
        ${capabilityCards
          .map(
            (card) => `
          <div class="character-attribute">
            <div class="character-attribute-label">${card.icon} ${card.title}</div>
            <div class="character-attribute-value">${card.value}</div>
            <div class="character-attribute-note">${card.note}</div>
          </div>`,
          )
          .join("")}
      </div>
    `;

    const restHtml = `
      <div class="character-rest">
        <div class="character-rest-top">
          <div class="character-rest-body">
            <div class="character-rest-title">🛌 ${rest.label}</div>
            <div class="character-rest-meta">
              <span>⚡ +${totalRestEnergy}</span>
              <span>🍖 +${this.formatNumber(totalRestSatiety, 1)}</span>
              <span>💧 +${this.formatNumber(totalRestHydration, 1)}</span>
              <span>⏱ откат ${this.formatSeconds(rest.cooldownMs)}</span>
            </div>
            <div class="character-rest-note">${restNote}</div>
          </div>
          <button
            id="character-rest-btn"
            class="character-rest-btn${rest.canRest ? "" : " disabled"}"
            type="button"
            ${rest.canRest ? "" : "disabled"}
          >
            ${restButtonLabel}
          </button>
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="character-topline">
        <div class="character-identity">
          <span class="character-title">🧍 ${state.title}</span>
          <span class="character-condition is-${status.tone === "bad" ? "exhausted" : status.tone === "warn" ? "weakened" : "stable"}" title="${this._cpBuildConditionTooltip(state.condition)}">${status.label}</span>
        </div>
        <div class="character-topline-right">
          ${this._cpBuildReturnButtonHtml()}
          <span class="character-carry">🎒 ${this.formatNumber(state.carry.capacity)} ед.${carryBonusText}</span>
          <button id="character-toggle-btn" class="character-toggle-btn" type="button" aria-expanded="${expanded}" title="${expanded ? "Свернуть" : "Развернуть"}">
            ${expanded ? "▾" : "▸"}
          </button>
        </div>
      </div>
      ${(() => {
        if (!chips.length) return "";
        return `<div class="character-state-chips">${chips
          .map(
            (c) =>
              `<span class="character-state-chip is-${c.tone}">${c.icon} ${c.label}</span>`,
          )
          .join("")}</div>`;
      })()}
      <div class="character-hud-grid">
        <div class="character-meter">
          <div class="character-meter-top">
            <span>⚡ Силы</span>
            <span>${this.formatNumber(state.energy.current, 0)} / ${this.formatNumber(state.energy.max, 0)}</span>
          </div>
          <div class="energy-bar-container character-bar-container">
            <div class="energy-bar-fill character-bar-energy" style="width:${energyPct}%"></div>
          </div>
        </div>
        <div class="character-meter">
          <div class="character-meter-top">
            <span>🍖 Сытость</span>
            <span>${this.formatNumber(state.satiety.current, 1)} / ${this.formatNumber(state.satiety.max, 0)}${satietyMaxBonusText}</span>
          </div>
          <div class="energy-bar-container character-bar-container is-satiety">
            <div class="energy-bar-fill character-bar-satiety" style="width:${satietyPct}%"></div>
          </div>
        </div>
        <div class="character-meter">
          <div class="character-meter-top">
            <span>💧 Вода</span>
            <span>${this.formatNumber(state.hydration.current, 1)} / ${this.formatNumber(state.hydration.max, 0)}${hydrationMaxBonusText}</span>
          </div>
          <div class="energy-bar-container character-bar-container is-hydration">
            <div class="energy-bar-fill character-bar-hydration" style="width:${hydrationPct}%"></div>
          </div>
        </div>
      </div>
      <div class="character-focus-grid">
        ${visibleOverviewCards
          .map(
            (card) => `
          <div class="character-focus-card is-${card.tone}">
            <div class="character-focus-label">${card.title}</div>
            <div class="character-focus-value">${card.value}</div>
            <div class="character-focus-note">${card.note}</div>
          </div>`,
          )
          .join("")}
      </div>
      <div class="character-chip-row${expanded ? "" : " is-compact"}">
        <span class="character-chip chip-secondary">${energyTrendText}</span>
        <span class="character-chip chip-secondary">${satietyTrendText}</span>
        <span class="character-chip chip-secondary">${hydrationTrendText}</span>
        ${recoverySourcesHtml}
        ${compactRestHtml}
      </div>
      ${compactTripHtml}
      <div class="character-expandable${expanded ? "" : " is-collapsed"}">
        <div class="character-detail-grid">
          <div class="character-detail-main">
            ${attributesHtml}
            <div class="character-note">
              <div class="character-note-title">Что это значит сейчас</div>
              <div>${status.note}</div>
            </div>
          </div>
          <div class="character-detail-side">
            ${restHtml}
            ${tripHtml}
          </div>
        </div>
      </div>
      <button id="character-open-modal-btn" class="character-panel-open-btn" type="button">👤 Открыть лист персонажа</button>
    `;

    if (!container._charModalBound) {
      container._charModalBound = true;
      const lockInteraction = () => this._cpLockInteraction(container);
      const handleFastControls = (e) => {
        const toggleBtn = e.target.closest("#character-toggle-btn");
        if (toggleBtn) {
          e.preventDefault();
          e.stopPropagation();
          this._cpToggleHandledAt = Date.now();
          this.characterPanelExpanded = !this.characterPanelExpanded;
          this.renderCharacterPanel();
          return true;
        }
        const modalBtn = e.target.closest("#character-open-modal-btn");
        if (modalBtn) {
          e.preventDefault();
          e.stopPropagation();
          this._cpOpenModalHandledAt = Date.now();
          this.openCharacterModal?.();
          return true;
        }
        return false;
      };
      container.addEventListener("pointerenter", lockInteraction);
      container.addEventListener("pointerdown", (e) => {
        lockInteraction();
        handleFastControls(e);
      });
      container.addEventListener("focusin", lockInteraction);
      container.addEventListener("click", (e) => {
        lockInteraction();
        if (e.target.closest("#character-toggle-btn")) {
          if (Date.now() - (this._cpToggleHandledAt || 0) < 600) return;
          this.characterPanelExpanded = !this.characterPanelExpanded;
          this.renderCharacterPanel();
          return;
        }
        if (
          e.target.closest("#character-rest-compact-btn") ||
          e.target.closest("#character-rest-btn")
        ) {
          if (!this.game.restCharacter()) {
            this.render({ forcePanels: true });
            return;
          }
          this.scheduleRestCooldownRefresh(
            this.game.getCharacterRestCooldownMs(),
          );
          this.render({ forcePanels: true });
          return;
        }
        if (e.target.closest("#character-return-btn")) {
          if (this._campTravelAction) return;
          this._startCampReturnTrip?.();
          return;
        }
        if (e.target.closest("#character-open-modal-btn")) {
          if (Date.now() - (this._cpOpenModalHandledAt || 0) < 600) return;
          this.openCharacterModal?.();
        }
      });
    }

    this.setTooltip(container, [
      `${state.title}: ${state.role}`,
      `Состояние: ${status.label}`,
      `Силы: ${this.formatNumber(state.energy.current, 0)} / ${this.formatNumber(state.energy.max, 0)}`,
      `Сытость: ${this.formatNumber(state.satiety.current, 1)} / ${this.formatNumber(state.satiety.max, 0)}`,
      `Вода: ${this.formatNumber(state.hydration.current, 1)} / ${this.formatNumber(state.hydration.max, 0)}`,
      `Выносливость: ${enduranceValue}`,
      `Походная сноровка: ${fieldcraftValue}`,
      `Переносимость: до ${this.formatNumber(state.carry.capacity)} единиц нагрузки за выход`,
      `Передышка: ${restValue}`,
      `Энергия: +${state.regen.perTick} каждые ${regenIntervalSec} с`,
      `Баланс сытости: ${this.formatNumber(satietyNetPerMin, 2)} в минуту`,
      `Баланс воды: ${this.formatNumber(hydrationNetPerMin, 2)} в минуту`,
      `Опора лагеря: ${recoverySummary}`,
      state.restrictionText,
      trip
        ? `Текущий выход: ${trip.zoneLabel}, ${Number.isFinite(trip.load) ? `нагрузка ${this.formatNumber(trip.load)} / ${this.formatNumber(trip.carryCapacity)}, ` : ""}энергия -${this.formatNumber(trip.energyCost, 2)}`
        : "Текущий выход: выберите участок на карте, чтобы оценить путь и нагрузку",
    ]);
  },
});
