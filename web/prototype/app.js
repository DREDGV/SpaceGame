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

  // Initial render
  ui.render();

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
    game.addLog("🌍 Добро пожаловать на заре цивилизации!");
    game.addLog("💡 Собирайте ресурсы, создавайте предметы, стройте здания!");
    game.addLog("⚡ Ваша энергия ограничена — планируйте действия!");
    game.markDirty();
    game.saveGame(true);
  }
  ui.render();

  window.addEventListener("beforeunload", () => {
    game.autoSaveIfNeeded(true);
  });

  // Dev helper: reset save in console
  window.resetGameProgress = function () {
    game.resetProgress();
    location.reload();
  };
})();
