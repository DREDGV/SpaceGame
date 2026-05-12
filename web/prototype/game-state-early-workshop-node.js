// Stage 2D — ремесленное место: оценка, очередь через queueCraft, навигатор, связка с распорядком.

(() => {
  if (typeof GameState !== "function") return;

  const ROUTINE_RES = ["wood", "stone", "fiber"];

  function nodeDef(game) {
    return game?.data?.earlyWorkshopNode || null;
  }

  GameState.prototype._isEarlyWorkshopNodeVisible = function () {
    if (typeof this.isOnboardingActive === "function" && this.isOnboardingActive())
      return false;
    const stage =
      typeof this.getComputedEconomicStageId === "function"
        ? this.getComputedEconomicStageId()
        : "lone_survivor";
    if (stage !== "campfire_camp" && stage !== "early_workshop") return false;
    const def = nodeDef(this);
    if (!def?.recipeIds?.length) return false;
    return def.recipeIds.some((id) => this.isRecipePresentationUnlocked?.(id));
  };

  GameState.prototype._earlyWorkshopNodeRecipeInScope = function (recipeId) {
    const def = nodeDef(this);
    if (!def?.recipeIds?.includes(recipeId)) return false;
    const recipe = this.data.recipes?.[recipeId];
    if (!recipe) return false;
    if (!this.isRecipePresentationUnlocked?.(recipeId)) return false;
    if (!this.unlockedRecipes?.has?.(recipeId)) return false;
    if (recipe.requires && !this.buildings?.[recipe.requires]) return false;
    if (this.isEarlyProgressionMode?.()) {
      const allowed = this.data.prologue?.recipeIds || [];
      if (!allowed.includes(recipeId) || recipe.hiddenInPrologue) return false;
      if (recipe.requiresInsights?.some((i) => !this.insights?.[i])) return false;
    }
    return true;
  };

  /** Дефицит сырья по рецептам узла (для распорядка и навигатора). */
  GameState.prototype._earlyWorkshopIngredientShortfallForRoutine = function () {
    const out = { wood: 0, stone: 0, fiber: 0 };
    if (!this._isEarlyWorkshopNodeVisible?.()) return out;
    if ((this.craftQueue?.length || 0) >= (this.maxCraftQueueSize ?? 3))
      return out;
    const def = nodeDef(this);
    for (const recipeId of def.recipeIds || []) {
      if (!this._earlyWorkshopNodeRecipeInScope(recipeId)) continue;
      const cost = this.getRecipeCost(recipeId);
      if (this.hasResources?.(cost)) continue;
      for (const rid of ROUTINE_RES) {
        const need = cost[rid];
        if (!Number.isFinite(need) || need <= 0) continue;
        const have = Number(this.resources?.[rid]) || 0;
        out[rid] = Math.max(out[rid], need - have);
      }
    }
    return out;
  };

  GameState.prototype._earlyWorkshopRoutineExtraDeficit = function (resourceId) {
    const m = this._earlyWorkshopIngredientShortfallForRoutine();
    return Math.max(0, m[resourceId] || 0);
  };

  GameState.prototype.getEarlyWorkshopNodePanelModel = function () {
    const def = nodeDef(this);
    const visible = !!this._isEarlyWorkshopNodeVisible?.();
    if (!visible || !def)
      return { visible: false, title: "", recipes: [], status: "hidden" };

    const recipes = [];
    let anyQueue = false;
    let anyShort = false;
    for (const recipeId of def.recipeIds || []) {
      if (!this._earlyWorkshopNodeRecipeInScope(recipeId)) continue;
      const recipe = this.data.recipes[recipeId];
      const cost = this.getRecipeCost(recipeId);
      const canQueue = !!this.canQueueCraft?.(recipeId);
      if (canQueue) anyQueue = true;
      const miss = [];
      for (const [rid, amt] of Object.entries(cost)) {
        const have = Number(this.resources?.[rid]) || 0;
        if (have < amt) {
          const rmeta = this.data.resources?.[rid];
          miss.push({
            id: rid,
            label: rmeta?.name || rid,
            need: amt,
            have,
            delta: amt - have,
          });
        }
      }
      if (miss.length) anyShort = true;
      let blockedReason = "";
      if (!canQueue) {
        if ((this.craftQueue?.length || 0) >= (this.maxCraftQueueSize ?? 3))
          blockedReason = "Очередь крафта заполнена.";
        else if (!this.hasResources?.(cost))
          blockedReason = "Не хватает сырья по складу.";
        else blockedReason = "Крафт сейчас недоступен.";
      }
      recipes.push({
        id: recipeId,
        name: this.isPrologueActive?.()
          ? recipe.prologueName || recipe.name
          : recipe.name,
        icon: recipe.icon || "🧰",
        canQueue,
        missing: miss,
        blockedReason,
      });
    }

    let status = "available";
    if (!recipes.length) status = "locked";
    else if (anyQueue) status = "ready";
    else if (anyShort) status = "needs_materials";
    else status = "blocked";

    return {
      visible: true,
      nodeId: def.id,
      title: def.title,
      lead: def.lead || "",
      recipes,
      status,
      queueFull:
        (this.craftQueue?.length || 0) >= (this.maxCraftQueueSize ?? 3),
    };
  };

  /** UI / эконом-навигация: постановка только через queueCraft (не gather). */
  GameState.prototype.queueCraftFromEarlyWorkshopNode = function (recipeId) {
    if (!this._earlyWorkshopNodeRecipeInScope(recipeId)) return false;
    return this.queueCraft(recipeId);
  };

  GameState.prototype._earlyWorkshopNextStepOverlay = function (base) {
    if (!base || typeof base !== "object") return null;
    if (base.source === "onboarding" || base.source === "goal") return null;
    if (base.source === "complete") return null;
    if (!this._isEarlyWorkshopNodeVisible?.()) return null;

    const model = this.getEarlyWorkshopNodePanelModel();
    if (!model.visible || !model.recipes.length) return null;

    const ready = model.recipes.filter((r) => r.canQueue);
    if (model.queueFull) {
      return {
        ...base,
        id: "early_workshop_next",
        headline: "Очередь крафта заполнена",
        title: "Очередь крафта заполнена",
        detail:
          "Освободите слот или дождитесь готовности — затем снова используйте ремесленное место.",
        description:
          "Освободите слот или дождитесь готовности — затем снова используйте ремесленное место.",
        highlightId: "early_workshop_node",
        targetPanel: "shell-economic-core",
        targetMode: "production",
        ctaLabel: "К производству",
        actionId: null,
      };
    }
    if (ready.length) {
      const r = ready[0];
      const d = `Можно поставить в очередь: ${r.icon} ${r.name}.`;
      return {
        ...base,
        id: "early_workshop_next",
        headline: "Ремесленное место готово к работе",
        title: "Ремесленное место готово к работе",
        detail: d,
        description: d,
        highlightId: "early_workshop_node",
        targetPanel: "shell-economic-core",
        targetMode: "production",
        ctaLabel: "К ремеслу",
        actionId: null,
      };
    }
    const firstMiss = model.recipes.find((r) => r.missing?.length);
    if (firstMiss) {
      const parts = firstMiss.missing.map(
        (m) => `${m.label}: не хватает ${m.delta}`,
      );
      const d = parts.join(" · ");
      return {
        ...base,
        id: "early_workshop_next",
        headline: "Подготовьте сырьё для ремесленного места",
        title: "Подготовьте сырьё для ремесленного места",
        detail: d,
        description: d,
        highlightId: "early_workshop_node",
        targetPanel: "shell-economic-core",
        targetMode: "production",
        ctaLabel: "К производству",
        actionId: null,
      };
    }
    const d =
      "Сейчас нельзя поставить крафт — проверьте озарения, этап или очередь.";
    return {
      ...base,
      id: "early_workshop_next",
      headline: "Ремесленное место",
      title: "Ремесленное место",
      detail: d,
      description: d,
      highlightId: "early_workshop_node",
      targetPanel: "shell-economic-core",
      targetMode: "production",
      ctaLabel: "К производству",
      actionId: null,
    };
  };

  const origNext = GameState.prototype.getEconomicNextStep;
  GameState.prototype.getEconomicNextStep = function () {
    const step =
      typeof origNext === "function" ? origNext.call(this) : null;
    const overlay = this._earlyWorkshopNextStepOverlay?.(step);
    return overlay || step;
  };
})();
