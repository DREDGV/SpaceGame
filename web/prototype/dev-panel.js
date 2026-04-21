/**
 * dev-panel.js — Временная панель разработчика для быстрого тестирования.
 * Подключается только во время разработки. Удалить перед релизом.
 *
 * Переключение: клавиша ` (тильда) или Ctrl+Shift+D
 * Или добавить ?dev=1 в URL для автооткрытия.
 */
(function () {
  "use strict";

  // ── Данные игры ──────────────────────────────────────────────────────────────

  var ALL_RESOURCES = [
    "wood",
    "stone",
    "clay",
    "fiber",
    "plank",
    "crude_tools",
    "workshop_parts",
    "improved_tools",
    "brick",
  ];

  var ALL_TECH = [
    "communal_memory",
    "basic_tools",
    "crafting",
    "labor_division",
    "rest_discipline",
    "mining",
  ];

  var ALL_BUILDINGS = ["rest_tent", "campfire", "storage", "workshop", "kiln"];

  var ALL_INSIGHTS = [
    "sharp_edge",
    "sturdy_branch",
    "fiber_bindings",
    "materials_work_together",
    "dry_tinder",
    "hearth_circle",
    "hearth_needs_reserve",
  ];

  var PROLOGUE_STEPS = [
    "arrival",
    "survey",
    "choose",
    "camp_quest_wood",
    "camp_quest_stone",
    "camp_quest_fiber",
    "camp_quest_survey",
  ];

  // ── Хелперы ──────────────────────────────────────────────────────────────────

  function g() {
    return window.game;
  }
  function u() {
    return window.ui;
  }

  function refresh() {
    var ui = u();
    if (ui) ui.render({ forcePanels: true });
  }

  function setStatus(msg) {
    var el = document.getElementById("dp-status");
    if (!el) return;
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.textContent = "";
    }, 2500);
  }

  // ── Читы ─────────────────────────────────────────────────────────────────────

  function fillResources(amount) {
    var game = g();
    if (!game) return;
    game.maxResourceCap = Math.max(game.maxResourceCap, amount);
    ALL_RESOURCES.forEach(function (id) {
      if (Object.prototype.hasOwnProperty.call(game.resources, id)) {
        game.resources[id] = amount;
      }
      if (Object.prototype.hasOwnProperty.call(game.resourceTotals || {}, id)) {
        game.resourceTotals[id] = Math.max(
          game.resourceTotals[id] || 0,
          amount,
        );
      }
    });
    game._recalculateDerivedState();
    game.markDirty();
    refresh();
  }

  function clearResources() {
    var game = g();
    if (!game) return;
    ALL_RESOURCES.forEach(function (id) {
      if (Object.prototype.hasOwnProperty.call(game.resources, id)) {
        game.resources[id] = 0;
      }
    });
    game.markDirty();
    refresh();
  }

  function maxCharacter() {
    var game = g();
    if (!game) return;
    game.energy = game.maxEnergy;
    game.satiety = game.maxSatiety;
    game.markDirty();
    refresh();
  }

  function unlockAllResearch() {
    var game = g();
    if (!game) return;
    ALL_TECH.forEach(function (id) {
      game.researched[id] = true;
    });
    game._recalculateDerivedState();
    game.markDirty();
    refresh();
  }

  function buildAllBuildings() {
    var game = g();
    if (!game) return;
    ALL_BUILDINGS.forEach(function (id) {
      if (!game.buildings[id]) {
        game.buildings[id] = { count: 1, isAutomationRunning: false };
      }
    });
    game._recalculateDerivedState();
    game.markDirty();
    refresh();
  }

  function unlockAllInsights() {
    var game = g();
    if (!game) return;
    ALL_INSIGHTS.forEach(function (id) {
      game.insights[id] = true;
    });
    game.markDirty();
    refresh();
  }

  // ── Сценарии ─────────────────────────────────────────────────────────────────

  /** Сценарий: только что завершён пролог, базовые ресурсы */
  function scenarioAfterPrologue() {
    var game = g();
    if (!game) return;
    game.skipOnboarding();
    game.maxResourceCap = Math.max(game.maxResourceCap, 30);
    var starter = { wood: 12, stone: 10, fiber: 8, clay: 6 };
    Object.keys(starter).forEach(function (id) {
      if (Object.prototype.hasOwnProperty.call(game.resources, id)) {
        game.resources[id] = starter[id];
        game.resourceTotals[id] = Math.max(
          game.resourceTotals[id] || 0,
          starter[id] + 10,
        );
      }
    });
    // Все озарения пролога открыты
    ALL_INSIGHTS.forEach(function (id) {
      game.insights[id] = true;
    });
    game._recalculateDerivedState();
    game.markDirty();
    refresh();
  }

  /** Сценарий: середина игры — все исследования, все здания, ресурсы */
  function scenarioMidGame() {
    var game = g();
    if (!game) return;
    if (!game.onboarding.completed && !game.onboarding.skipped) {
      game.completeOnboarding();
    }
    game.maxResourceCap = 60;
    ALL_RESOURCES.forEach(function (id) {
      if (Object.prototype.hasOwnProperty.call(game.resources, id)) {
        game.resources[id] = 25;
        game.resourceTotals[id] = Math.max(game.resourceTotals[id] || 0, 30);
      }
    });
    ALL_TECH.forEach(function (id) {
      game.researched[id] = true;
    });
    ALL_BUILDINGS.forEach(function (id) {
      if (!game.buildings[id]) {
        game.buildings[id] = { count: 1, isAutomationRunning: false };
      }
    });
    ALL_INSIGHTS.forEach(function (id) {
      game.insights[id] = true;
    });
    game._recalculateDerivedState();
    game.markDirty();
    refresh();
  }

  /** Сценарий: только начало пролога, нулевые ресурсы */
  function scenarioFreshPrologue() {
    var game = g();
    if (!game) return;
    game.restartOnboarding();
    refresh();
  }

  // ── Обработчик кнопок ────────────────────────────────────────────────────────

  function handleAction(action) {
    var game = g();
    if (!game) {
      setStatus("⚠ game не готов");
      return;
    }
    try {
      switch (action) {
        case "sc-fresh":
          scenarioFreshPrologue();
          setStatus("✓ Новый пролог");
          break;
        case "sc-after-prologue":
          scenarioAfterPrologue();
          setStatus("✓ После пролога");
          break;
        case "sc-midgame":
          scenarioMidGame();
          setStatus("✓ Середина игры");
          break;
        case "fill-20":
          fillResources(20);
          setStatus("✓ ×20 ресурсов");
          break;
        case "fill-50":
          fillResources(50);
          setStatus("✓ ×50 ресурсов");
          break;
        case "clear-res":
          clearResources();
          setStatus("✓ Ресурсы обнулены");
          break;
        case "max-char":
          maxCharacter();
          setStatus("✓ Энергия и сытость макс");
          break;
        case "all-research":
          unlockAllResearch();
          setStatus("✓ Все исследования");
          break;
        case "all-buildings":
          buildAllBuildings();
          setStatus("✓ Все здания");
          break;
        case "all-insights":
          unlockAllInsights();
          setStatus("✓ Все озарения");
          break;
        case "skip-prologue":
          game.skipOnboarding();
          refresh();
          setStatus("✓ Пролог пропущен");
          break;
        case "end-prologue":
          game.completeOnboarding();
          refresh();
          setStatus("✓ Пролог завершён");
          break;
        case "restart-prologue":
          game.restartOnboarding();
          refresh();
          setStatus("✓ Пролог перезапущен");
          break;
        case "save":
          game.saveGame(true);
          setStatus("✓ Сохранено");
          break;
        case "reset":
          if (
            confirm("Сбросить весь прогресс? Это действие нельзя отменить.")
          ) {
            window.resetGameProgress();
          }
          break;
        default:
          setStatus("⚠ Неизвестное действие: " + action);
      }
    } catch (err) {
      setStatus("⚠ " + err.message);
      console.error("[DevPanel]", err);
    }
  }

  // ── Построение панели ────────────────────────────────────────────────────────

  var CSS = [
    "#dev-panel{position:fixed;top:60px;right:10px;width:250px;background:#12121e;",
    "border:1px solid #3a3a5e;border-radius:8px;font-family:monospace;font-size:12px;",
    "color:#c8c8e0;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.7);user-select:none;}",
    ".dp-head{display:flex;justify-content:space-between;align-items:center;",
    "padding:7px 10px;background:#1e1e34;border-radius:8px 8px 0 0;",
    "border-bottom:1px solid #3a3a5e;cursor:move;font-weight:bold;font-size:12px;}",
    ".dp-close{background:none;border:none;color:#666;cursor:pointer;font-size:15px;",
    "line-height:1;padding:0 1px;}.dp-close:hover{color:#fff;}",
    ".dp-body{padding:8px 8px 4px;}",
    ".dp-sec{margin-bottom:7px;}",
    ".dp-sec-title{font-size:10px;color:#7070a0;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px;}",
    ".dp-row{display:flex;flex-wrap:wrap;gap:3px;}",
    ".dp-row button{flex:1 1 auto;min-width:55px;padding:4px 5px;background:#1e1e34;",
    "border:1px solid #44449e;border-radius:4px;color:#b0b0d8;cursor:pointer;",
    "font-size:11px;font-family:monospace;transition:background .12s;}",
    ".dp-row button:hover{background:#2a2a50;color:#fff;}",
    ".dp-row button:active{background:#44449e;}",
    ".dp-row button.dp-danger{border-color:#884444;color:#ff9999;}",
    ".dp-row button.dp-danger:hover{background:#2e1818;}",
    ".dp-hint{font-size:10px;color:#44445e;margin-top:5px;text-align:center;}",
    "#dp-status{min-height:15px;font-size:11px;color:#66cc66;",
    "text-align:center;margin-top:4px;padding-bottom:4px;}",
  ].join("");

  var HTML = [
    '<div class="dp-head"><span>🛠 Dev Panel</span>',
    '<button class="dp-close" id="dp-close-btn">✕</button></div>',
    '<div class="dp-body">',

    '<div class="dp-sec">',
    '<div class="dp-sec-title">🎮 Сценарии</div>',
    '<div class="dp-row">',
    '<button data-a="sc-fresh">Новый пролог</button>',
    '<button data-a="sc-after-prologue">После пролога</button>',
    '<button data-a="sc-midgame">Середина игры</button>',
    "</div></div>",

    '<div class="dp-sec">',
    '<div class="dp-sec-title">💰 Ресурсы</div>',
    '<div class="dp-row">',
    '<button data-a="fill-20">×20 всех</button>',
    '<button data-a="fill-50">×50 всех</button>',
    '<button data-a="clear-res">Обнулить</button>',
    "</div></div>",

    '<div class="dp-sec">',
    '<div class="dp-sec-title">🧪 Персонаж</div>',
    '<div class="dp-row">',
    '<button data-a="max-char">⚡ Макс. энергия и сытость</button>',
    "</div></div>",

    '<div class="dp-sec">',
    '<div class="dp-sec-title">🔬 Прогресс</div>',
    '<div class="dp-row">',
    '<button data-a="all-research">Все исследования</button>',
    '<button data-a="all-buildings">Все здания</button>',
    '<button data-a="all-insights">Все озарения</button>',
    "</div></div>",

    '<div class="dp-sec">',
    '<div class="dp-sec-title">📖 Пролог</div>',
    '<div class="dp-row">',
    '<button data-a="skip-prologue">Пропустить</button>',
    '<button data-a="end-prologue">Завершить</button>',
    '<button data-a="restart-prologue">Перезапустить</button>',
    "</div></div>",

    '<div class="dp-sec">',
    '<div class="dp-sec-title">💾 Данные</div>',
    '<div class="dp-row">',
    '<button data-a="save">Сохранить</button>',
    '<button data-a="reset" class="dp-danger">⚠ Сбросить всё</button>',
    "</div></div>",

    '<div id="dp-status"></div>',
    '<div class="dp-hint">` или Ctrl+Shift+D — переключить</div>',
    "</div>",
  ].join("");

  // ── Жизненный цикл панели ────────────────────────────────────────────────────

  var panelEl = null;
  var isVisible = false;

  function buildPanel() {
    // Inject styles
    var styleEl = document.createElement("style");
    styleEl.id = "dev-panel-css";
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    // Build element
    var el = document.createElement("div");
    el.id = "dev-panel";
    el.innerHTML = HTML;

    // Close button
    el.querySelector("#dp-close-btn").addEventListener("click", function () {
      togglePanel();
    });

    // Delegate action clicks
    el.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-a]");
      if (btn) handleAction(btn.getAttribute("data-a"));
    });

    // Drag
    makeDraggable(el);

    document.body.appendChild(el);
    return el;
  }

  function makeDraggable(el) {
    var head = el.querySelector(".dp-head");
    head.addEventListener("mousedown", function (e) {
      if (e.target.id === "dp-close-btn") return;
      e.preventDefault();
      var rect = el.getBoundingClientRect();
      var ox = rect.left,
        oy = rect.top;
      var sx = e.clientX,
        sy = e.clientY;

      function onMove(e) {
        el.style.left = ox + e.clientX - sx + "px";
        el.style.top = oy + e.clientY - sy + "px";
        el.style.right = "auto";
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function togglePanel() {
    if (!panelEl) {
      panelEl = buildPanel();
      isVisible = true;
    } else {
      isVisible = !isVisible;
      panelEl.style.display = isVisible ? "" : "none";
    }
  }

  // ── Клавиатурный хоткей ──────────────────────────────────────────────────────

  document.addEventListener("keydown", function (e) {
    // Игнорировать, если фокус на поле ввода
    var tag = (e.target || document.activeElement || {}).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    var isToggle =
      e.key === "`" ||
      (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d"));
    if (isToggle) {
      e.preventDefault();
      togglePanel();
    }
  });

  // ── Автооткрытие по ?dev=1 ───────────────────────────────────────────────────

  if (
    typeof location !== "undefined" &&
    location.search.indexOf("dev=1") !== -1
  ) {
    // Ждём инициализации игры
    setTimeout(function () {
      togglePanel();
    }, 600);
  }

  // Глобальный хелпер для консоли
  window._devPanel = { toggle: togglePanel };
})();
