/**
 * App — entry point. Boots the game and starts the render loop.
 * Core Loop v4:
 * - Onboarding system (intro, steps, hints, skip, localStorage)
 * - Energy regeneration
 * - Automation ticking
 */
(function () {
  "use strict";

  // Initialize game
  const game = new GameState(GAME_DATA);
  const ui = new UI(game);

  // Expose to dev panel (dev-only, safe to remove in production)
  window.game = game;
  window.ui = ui;

  // Initial render
  ui.render({ forcePanels: true });

  // Tick intervals
  const UI_TICK = 200; // UI refresh every 200ms
  const AUTO_TICK = 500; // Automation check every 500ms
  const WORK_TICK = 200; // Craft, construction and research checks
  let lastUiTick = 0;
  let lastAutoTick = 0;
  let lastWorkTick = 0;
  let lastSaveTick = 0;

  function tick(timestamp) {
    // Energy regen check
    game.regenEnergy();

    // Automation tick
    if (timestamp - lastAutoTick >= AUTO_TICK) {
      game.tickAutomation();
      lastAutoTick = timestamp;
    }

    if (timestamp - lastWorkTick >= WORK_TICK) {
      game.tickCraftQueue();
      if (typeof game.tickWorkQueue === "function") game.tickWorkQueue();
      game.tickConstruction();
      game.tickResearch();
      lastWorkTick = timestamp;
    }

    if (timestamp - lastSaveTick >= game.saveIntervalMs) {
      game.autoSaveIfNeeded();
      lastSaveTick = timestamp;
    }

    // UI refresh
    if (timestamp - lastUiTick >= UI_TICK) {
      ui.render();
      lastUiTick = timestamp;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  if (!game.loadedFromSave) {
    game.addLog("🌍 Путь начинается с голых рук и первых наблюдений.");
    game.addLog(
      "🖐️ Собирайте ветки, камни и волокно, чтобы открыть первые озарения.",
    );
    game.addLog("📚 Первые открытия будут складываться в Книгу знаний.");
    game.markDirty();
    game.saveGame(true);
  }
  ui.render({ forcePanels: true });

  window.addEventListener("beforeunload", () => {
    game.autoSaveIfNeeded(true);
  });

  // Dev helper: reset save in console
  window.resetGameProgress = function () {
    game.resetProgress();
    location.reload();
  };
})();
