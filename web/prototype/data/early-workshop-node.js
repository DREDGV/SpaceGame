// Stage 2D — первый производственный узел «Ремесленное место» (данные).

(function () {
  if (typeof GAME_DATA === "undefined") return;

  GAME_DATA.earlyWorkshopNode = {
    id: "early_workshop_node",
    title: "Ремесленное место",
    lead:
      "Простой стол у стоянки: соединяйте ветки, камень и волокно в заготовки через общую очередь крафта.",
    /** Рецепты узла (только уже существующие id). */
    recipeIds: ["craft_crude_tools", "craft_plank"],
    /** Сырьё, на которое распорядок может подтянуть приоритет «базовые материалы». */
    routineResourceIds: ["wood", "stone", "fiber"],
  };
})();
