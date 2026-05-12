(() => {
  if (typeof GameState !== "function") return;

  GameState.prototype._getWorkActionDef = function (workId) {
    return this.data.workActions?.[workId] || null;
  };

  GameState.prototype.getComputedEconomicStageId = function () {
    const fn = this.data.computeEconomicStageId;
    if (typeof fn === "function") return fn(this);
    return "lone_survivor";
  };

  GameState.prototype.getEconomicStageDefinition = function (stageId) {
    return this.data.economicStagesById?.[stageId] || null;
  };

  GameState.prototype.getCurrentEconomicStageBundle = function () {
    const id = this.getComputedEconomicStageId();
    return { id, def: this.getEconomicStageDefinition(id) };
  };

  GameState.prototype.getEconomicNextStep = function () {
    const fn = this.data.getEconomicNextStep;
    if (typeof fn !== "function") {
      const id = this.getComputedEconomicStageId();
      return {
        stageId: id,
        headline: "",
        detail: "",
        source: "stage",
        goalId: null,
        goalText: null,
      };
    }
    return fn.call(this.data, this);
  };

  GameState.prototype._collectRawCampEconomicProblems = function () {
    const problems = [];
    const energyRatio =
      this.maxEnergy > 0 ? this.energy / this.maxEnergy : 1;
    if (energyRatio < 0.22 && this.maxEnergy >= 4) {
      problems.push({
        tone: "warn",
        text: "Мало энергии — отдохните или сократите ручные выходы, иначе работы будут простаивать.",
      });
    }
    if (this.maxSatiety > 0 && this.satiety / this.maxSatiety < 0.25) {
      problems.push({
        tone: "warn",
        text: "Низкая сытость — решения по сбору и крафту обходятся дороже.",
      });
    }
    if (this.maxHydration > 0 && this.hydration / this.maxHydration < 0.25) {
      problems.push({
        tone: "warn",
        text: "Мало воды — дальние действия на карте и в лагере тяжелее.",
      });
    }
    if (this.lastOverflow?.at) {
      const age = Date.now() - this.lastOverflow.at;
      if (age >= 0 && age < 120000) {
        problems.push({
          tone: "bad",
          text: "Недавно было переполнение склада — освободите место или расширьте хранение.",
        });
      }
    }
    return problems;
  };

  /** До 2 сигналов для компактного HUD (без «всё ок»). */
  GameState.prototype.getEconomicCriticalCampProblems = function (max = 2) {
    const raw = this._collectRawCampEconomicProblems();
    const ordered = [
      ...raw.filter((p) => p.tone === "bad"),
      ...raw.filter((p) => p.tone === "warn"),
    ];
    return ordered.slice(0, Math.max(0, max));
  };

  GameState.prototype.getCampEconomicProblems = function () {
    const critical = this._collectRawCampEconomicProblems();
    const ordered = [
      ...critical.filter((p) => p.tone === "bad"),
      ...critical.filter((p) => p.tone === "warn"),
    ].slice(0, 3);
    if (ordered.length === 0) {
      ordered.push({
        tone: "ok",
        text: "Срочных проблем по энергии, еде и воде не видно.",
      });
    }
    return ordered;
  };

  GameState.prototype._dispatchEnsureCampfireAutomation = function () {
    if (!this.buildings?.campfire) return false;
    const buildingMeta = this.data.buildings?.campfire;
    if (!buildingMeta?.effect?.automation) return false;

    const data = this.buildings.campfire;
    const running =
      typeof data === "object" &&
      data !== null &&
      data.isAutomationRunning !== false;

    if (running) {
      this.addLog("🔥 Цикл костра уже запущен.");
      this.markDirty();
      return true;
    }

    return this.toggleAutomation("campfire");
  };

  /**
   * @returns {{ available: boolean, reasons: string[], missing: string[] }}
   */
  GameState.prototype.evaluateWorkActionAvailability = function (
    workId,
    options = {},
  ) {
    const reasons = [];
    const missing = [];
    const work = this._getWorkActionDef(workId);
    if (!work?.execute?.type) {
      reasons.push("Работа не описана в каталоге.");
      missing.push("definition");
      return { available: false, reasons, missing };
    }

    const ex = work.execute;

    if (ex.type === "gather") {
      const gid = ex.id;
      if (!this.data.gatherActions?.[gid]) {
        reasons.push("Неизвестное действие сбора.");
        missing.push(`gather:${gid}`);
        return { available: false, reasons, missing };
      }

      const available = this.canGather(gid, options);
      if (available) {
        return { available: true, reasons: [], missing: [] };
      }
      {
        if (!this.isGatherActionPresentationUnlocked(gid)) {
          reasons.push("Этот сбор пока скрыт правилами этапа.");
          missing.push("presentation");
        }
        if (this.isPrologueActive()) {
          const allowed = this.data.prologue?.gatherActionIds || [];
          if (!allowed.includes(gid)) {
            reasons.push("В прологе этот сбор сейчас недоступен.");
            missing.push("prologue");
          }
        }
        if (this.getCooldownRemaining(gid, options) > 0) {
          reasons.push("Нужно дождаться перезарядки.");
          missing.push("cooldown");
        }
        const profile = this.getGatherProfile(gid, options);
        const energyCost =
          profile?.energyCost ?? this.data.gatherActions[gid].energyCost ?? 0;
        if (!this.hasEnergy(energyCost)) {
          reasons.push("Недостаточно энергии.");
          missing.push("energy");
        }
        if (profile?.blockedReason) {
          reasons.push(profile.blockedReason);
          missing.push("blocked");
        }
        if (reasons.length === 0) {
          reasons.push("Сбор сейчас недоступен.");
        }
      }
      return { available: false, reasons, missing };
    }

    if (ex.type === "craft") {
      const recipeId = ex.id;
      const recipe = this.data.recipes?.[recipeId];
      if (!recipe) {
        reasons.push("Неизвестный рецепт.");
        missing.push(`recipe:${recipeId}`);
        return { available: false, reasons, missing };
      }

      const available = this.canQueueCraft(recipeId);
      if (available) {
        return { available: true, reasons: [], missing: [] };
      }
      {
        if (this.craftQueue.length >= this.maxCraftQueueSize) {
          reasons.push("Очередь крафта заполнена.");
          missing.push("queue");
        }
        if (this.isEarlyProgressionMode()) {
          const allowed = this.data.prologue?.recipeIds || [];
          if (!allowed.includes(recipeId) || recipe.hiddenInPrologue) {
            reasons.push("В этом этапе пролога рецепт недоступен.");
            missing.push("prologue");
          }
        }
        if (!this.isRecipePresentationUnlocked(recipeId)) {
          reasons.push("Рецепт скрыт условиями развития.");
          missing.push("presentation");
        } else if (!this.unlockedRecipes.has(recipeId)) {
          reasons.push("Рецепт ещё не разблокирован.");
          missing.push("unlock");
        } else if (recipe.requires && !this.buildings[recipe.requires]) {
          const bn =
            this.data.buildings?.[recipe.requires]?.name || recipe.requires;
          reasons.push(`Нужно здание: ${bn}.`);
          missing.push(`building:${recipe.requires}`);
        } else if (
          Array.isArray(recipe.requiresInsights) &&
          recipe.requiresInsights.some((id) => !this.insights?.[id])
        ) {
          reasons.push("Не хватает озарений для этого рецепта.");
          missing.push("insights");
        } else if (!this.hasResources(this.getRecipeCost(recipeId))) {
          reasons.push("Не хватает материалов для крафта.");
          missing.push("resources");
        }
        if (reasons.length === 0) {
          reasons.push("Нельзя поставить рецепт в очередь.");
        }
      }
      return { available: false, reasons, missing };
    }

    if (ex.type === "campfire_automation") {
      if (!this.buildings?.campfire) {
        reasons.push("Сначала нужен костёр.");
        missing.push("campfire");
        return { available: false, reasons, missing };
      }
      if (!this.data.buildings?.campfire?.effect?.automation) {
        reasons.push("У костра нет цикла автоматизации.");
        missing.push("automation");
        return { available: false, reasons, missing };
      }
      return { available: true, reasons, missing };
    }

    reasons.push("Неизвестный тип действия.");
    missing.push(`execute:${ex.type}`);
    return { available: false, reasons, missing };
  };

  GameState.prototype.dispatchWorkAction = function (workId, options = {}) {
    const work = this._getWorkActionDef(workId);
    if (!work) return false;

    const gate = this.evaluateWorkActionAvailability(workId, options);
    if (!gate.available) return false;

    const ex = work.execute;
    // Intentional direct gather path: when game-state-work-queue.js is not loaded, gather stays immediate. With normal prototype script order that file overrides dispatchWorkAction and routes gather work to enqueueGatherWork instead.
    if (ex.type === "gather") return this.gather(ex.id, options);
    if (ex.type === "craft") return this.queueCraft(ex.id);
    if (ex.type === "campfire_automation")
      return this._dispatchEnsureCampfireAutomation();
    return false;
  };
})();
