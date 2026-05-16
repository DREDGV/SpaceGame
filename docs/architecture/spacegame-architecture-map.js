/**
 * SpaceGame architecture map — render and interaction layer.
 * Data: spacegame-architecture-data.js (window.SPACEGAME_ARCHITECTURE)
 * Load order: data.js, then this file.
 */
(function () {
  'use strict';

  const architecture = window.SPACEGAME_ARCHITECTURE;

  // --- Constants and labels ---
    const statusLabels = {
      prototype: "Прототип",
      designing: "Проектируется",
      planned: "Запланировано",
      later: "Позже",
      needs_rework: "Требует пересмотра",
      blocked: "Заблокировано"
    };

    const statusColors = {
      prototype: "var(--blue)",
      designing: "var(--yellow)",
      planned: "var(--green)",
      later: "var(--gray)",
      needs_rework: "var(--orange)",
      blocked: "var(--red)"
    };

    /** Порядок строк «систем» внутри карточки эпохи (ключи объекта era.systems). */
    const eraSystemKeys = [
      "people",
      "needs",
      "labor",
      "resources",
      "storage",
      "craft",
      "production",
      "buildings",
      "buildingUpgrades",
      "knowledge",
      "research",
      "economy",
      "logistics",
      "trade",
      "map",
      "governance",
      "security",
      "transport",
      "energy",
      "goals",
      "events",
      "limits"
    ];

    const systemRowLabels = {
      time: "Время и эпохи",
      people: "Люди",
      needs: "Потребности",
      labor: "Труд",
      resources: "Ресурсы",
      storage: "Хранение",
      craft: "Ремесло",
      production: "Производство",
      buildings: "Постройки",
      buildingUpgrades: "Улучшения построек",
      knowledge: "Знания",
      research: "Исследования",
      economy: "Экономика",
      logistics: "Логистика",
      trade: "Торговля",
      map: "Карта",
      governance: "Управление и институты",
      security: "Безопасность",
      transport: "Транспорт",
      energy: "Энергия",
      goals: "Цели (слой)",
      events: "События (слой)",
      limits: "Ограничения (слой)",
      automation: "Автоматизация"
    };

    /** Канонический каркас `systems[]` (порядок отображения в разделе «Главные системы»). */
    const CANONICAL_SYSTEM_IDS = [
      "time",
      "people",
      "needs",
      "labor",
      "resources",
      "storage",
      "buildings",
      "production",
      "knowledge",
      "research",
      "logistics",
      "trade",
      "economy",
      "governance",
      "security",
      "events",
      "map",
      "goals",
      "automation",
      "ui"
    ];

    const eraColors = {
      A: "var(--a)",
      B: "var(--b)",
      C: "var(--c)",
      D: "var(--d)",
      E: "var(--e)",
      F: "var(--f)",
      G: "var(--g)",
      H: "var(--h)",
      I: "var(--i)",
      J: "var(--j)",
      K: "var(--k)"
    };

    const ERA_GROUPS = {
      ABC: ["A", "B", "C"],
      DEF: ["D", "E", "F"],
      GHIJK: ["G", "H", "I", "J", "K"]
    };

    const ERA_ORDER = "ABCDEFGHIJK";

    /** Человекочитаемые подписи проектных полей эпохи (не игровые характеристики). */
    const roleLabelsRu = {
      tutorial: "обучение",
      bridge: "мост",
      core_expansion: "ядро расширения",
      state_expansion: "государство / территория",
      transition: "переход",
      industrial_core: "индустрия",
      modern_core: "современность",
      planetary_core: "планета",
      space_core: "космос",
      endgame: "финал"
    };

    const designWeightLabelsRu = {
      light: "лёгкий",
      medium: "средний",
      heavy: "тяжёлый",
      core: "ядро"
    };

    const gameplayDensityLabelsRu = {
      low: "низкая",
      medium: "средняя",
      high: "высокая",
      very_high: "очень высокая"
    };

    const playerTimeShareLabelsRu = {
      short: "короткое",
      medium: "среднее",
      long: "долгое",
      very_long: "очень долгое",
      endgame: "endgame"
    };

    const dependencyTypeLabels = {
      requires: "требует",
      enables: "открывает",
      drives: "задаёт темп",
      feeds: "питает",
      unlocks: "разблокирует",
      amplifies: "усиливает",
      stabilizes: "стабилизирует",
      extends: "расширяет",
      pressures: "давит на",
      anchors: "закрепляет",
      shapes: "задаёт форму",
      allocates: "распределяет",
      risks: "рискует",
      funds: "финансирует",
      implements: "воплощает",
      frames: "обрамляет",
      tests: "проверяет",
      surfaces: "показывает",
      demands: "требует",
      depends: "зависит от"
    };

    const MAINLINE_CHAIN_IDS = [
      "people",
      "needs",
      "labor",
      "resources",
      "buildings",
      "production",
      "logistics",
      "trade",
      "economy",
      "governance"
    ];
    const MAINLINE_SUPPORT_IDS = [
      "storage",
      "knowledge",
      "research",
      "automation",
      "security",
      "events",
      "map",
      "goals",
      "ui"
    ];
    const MAINLINE_TIME_IDS = ["time"];

    const MAINLINE_SUPPORT_ROW = [
      "storage",
      "knowledge",
      "research",
      "automation",
      "security",
      "events",
      "map"
    ];

    const MAINLINE_RISK_IDS = new Set(["security", "events"]);

    const MAINLINE_NUMBERS = {
      people: 1,
      needs: 2,
      labor: 3,
      resources: 4,
      buildings: 5,
      production: 6,
      logistics: 7,
      trade: 8,
      economy: 9,
      governance: 10,
      storage: 11,
      knowledge: 12,
      research: 13,
      automation: 14,
      security: 15,
      events: 16,
      map: 17,
      ui: 18
    };

    const ERA_ICONS = {
      A: "🔥",
      B: "🏕",
      C: "🌾",
      D: "⚒",
      E: "🏛",
      F: "⛵",
      G: "🏭",
      H: "💻",
      I: "🌍",
      J: "🚀",
      K: "✦"
    };

    const SYSTEM_ICONS = {
      time: "⏳",
      goals: "🎯",
      people: "👥",
      needs: "🍞",
      labor: "⚒",
      resources: "🪨",
      buildings: "🏠",
      production: "⚙",
      logistics: "🛤",
      trade: "⚖",
      economy: "💰",
      governance: "🏛",
      storage: "📦",
      knowledge: "📜",
      research: "🔬",
      automation: "🤖",
      security: "🛡",
      events: "⚡",
      map: "🗺",
      ui: "🖥"
    };

    /** Ряды схемы магистрали — CSS Grid, без absolute-позиций (нет пересечений). */
    const MAINLINE_BANDS = [
      { key: "ctx", title: "Контекст", gridClass: "mainline-band-grid--ctx", ids: ["time", "goals"] },
      { key: "chain", title: "Основная цепочка", gridClass: "mainline-band-grid--chain", ids: MAINLINE_CHAIN_IDS },
      {
        key: "support",
        title: "Сквозные системы и карта",
        gridClass: "mainline-band-grid--support",
        ids: MAINLINE_SUPPORT_ROW
      },
      { key: "ui", title: "Интерфейс", gridClass: "mainline-band-grid--ui", ids: ["ui"] }
    ];

    const MAINLINE_IDLE_EDGE_MAX = 28;

    const SIDEBAR_NAV = [
      ["#section-dashboard", "Обзор карты", "🗺", ""],
      ["#section-timeline", "Эпохи", "⏳", "lower-gate-timeline"],
      ["#section-mainline", "Схема систем", "◎", ""],
      ["#section-systems", "Матрица", "▦", "lower-gate-systems"],
      ["#section-core-systems", "Каркас", "⬡", "lower-gate-systems"],
      ["#section-system-progression", "Сквозные", "↔", "lower-gate-systems"],
      ["#section-prototype-mapping", "Прототип", "⚙", "lower-gate-systems"],
      ["#section-dependencies", "Связи", "🔗", "lower-gate-catalog"],
      ["#section-game-catalog", "Каталог", "📦", "lower-gate-catalog"],
      ["#section-roadmap", "Roadmap", "🛤", "lower-gate-catalog"],
      ["#section-screens", "UI", "🖥", "lower-gate-catalog"]
    ];

    const ANCHOR_LOWER_SECTION = {
      "#section-timeline": "lower-gate-timeline",
      "#section-systems": "lower-gate-systems",
      "#section-core-systems": "lower-gate-systems",
      "#section-prototype-mapping": "lower-gate-systems",
      "#section-system-progression": "lower-gate-systems",
      "#section-game-catalog": "lower-gate-catalog",
      "#section-dependencies": "lower-gate-catalog",
      "#section-roadmap": "lower-gate-catalog",
      "#section-screens": "lower-gate-catalog"
    };

    const MATRIX_FOOTER_IDS = CANONICAL_SYSTEM_IDS;

    const MAINLINE_ALL_IDS = new Set([
      ...MAINLINE_CHAIN_IDS,
      ...MAINLINE_SUPPORT_ROW,
      "goals",
      "ui",
      "time"
    ]);

    const DEP_EDGE_UNLOCK = new Set(["enables", "unlocks", "opens"]);
    const DEP_EDGE_REQUIRE = new Set(["requires", "depends", "demands"]);
    const DEP_EDGE_INFLUENCE = new Set(["drives", "feeds", "amplifies", "funds", "extends", "enables", "unlocks", "opens"]);
    const DEP_EDGE_FEEDBACK = new Set(["pressures", "risks", "stabilizes", "tests", "frames", "surfaces"]);
    const DEP_EDGE_MANAGE = new Set(["allocates", "implements", "anchors", "shapes"]);

    function eraPhaseGroup(eraId) {
      if (ERA_GROUPS.ABC.includes(eraId)) return "abc";
      if (ERA_GROUPS.DEF.includes(eraId)) return "def";
      return "gk";
    }

    function mainlineNodeKind(id) {
      if (id === "goals") return "goals";
      if (id === "ui") return "infra";
      if (MAINLINE_RISK_IDS.has(id)) return "risk";
      if (id === "time") return "era";
      return "spine";
    }

    function truncateText(text, max) {
      const t = String(text || "").trim();
      if (t.length <= max) return t;
      return t.slice(0, max - 1) + "…";
    }

    function eraContentCounts(era) {
      const systemsFilled = eraSystemKeys.filter(
        (k) => era.systems && String(era.systems[k] || "").trim()
      ).length;
      return {
        periods: (era.periods || []).length,
        goals: (era.goals || []).length,
        events: (era.events || []).length,
        discoveries: (era.discoveries || []).length,
        limits: (era.limits || []).length,
        systems: systemsFilled
      };
    }

    /** Всегда видимый слой: периоды, цели, переход — без раскрытия details. */
    function renderEraDigestHtml(era, query, opts) {
      opts = opts || {};
      const compact = !!opts.compact;
      const c = eraContentCounts(era);
      const t = era.transition || {};
      const to = t.to != null && String(t.to).trim() !== "" ? String(t.to).trim() : null;
      const role = roleLabelsRu[era.role] || era.role || "";

      const chips = [];
      if (c.periods) chips.push(`<span class="era-chip">${c.periods} пер.</span>`);
      if (c.goals) chips.push(`<span class="era-chip">${c.goals} целей</span>`);
      if (c.events) chips.push(`<span class="era-chip">${c.events} событ.</span>`);
      if (c.systems) chips.push(`<span class="era-chip">${c.systems} слоёв</span>`);
      if (to)
        chips.push(
          `<button type="button" class="era-chip era-chip--next" data-era-chip-focus="${escapeHtml(to)}" title="Открыть эпоху ${escapeHtml(to)}">→ ${escapeHtml(to)}</button>`
        );
      if (role) chips.push(`<span class="era-chip era-chip--role">${escapeHtml(role)}</span>`);
      const progEarly = transitionChecklistProgress(era.id);
      if (progEarly.total > 0)
        chips.push(
          `<span class="era-chip era-chip--check" title="Чеклист перехода">✓ ${progEarly.done}/${progEarly.total}</span>`
        );

      let periodStrip = "";
      if ((era.periods || []).length) {
        const showSum = !compact;
        periodStrip = `<div class="era-period-strip" role="list" aria-label="Периоды эпохи">
          ${(era.periods || [])
            .map((p) => {
              const sum = showSum && p.summary ? `<span class="era-period-pill-sum">${highlightPlain(truncateText(p.summary, 100), query)}</span>` : "";
              return `<button type="button" class="era-period-pill" role="listitem" data-era-period-jump="${escapeHtml(era.id)}" data-period-id="${escapeHtml(p.id)}" title="Открыть период на шкале">
                <span class="era-period-pill-id">${highlightPlain(p.id, query)}</span>
                <span class="era-period-pill-title">${highlightPlain(p.title, query)}</span>
                ${sum}
              </button>`;
            })
            .join("")}
        </div>`;
      }

      const goalLimit = compact ? 2 : 4;
      const goalItems = (era.goals || []).slice(0, goalLimit);
      const goalsHtml = goalItems.length
        ? `<ul class="era-digest-goals">${goalItems.map((g) => `<li>${highlightPlain(g, query)}</li>`).join("")}</ul>`
        : "";

      const firstCheck =
        Array.isArray(t.checklist) && t.checklist.length ? String(t.checklist[0] || "").trim() : "";
      const transText = String(t.condition || firstCheck || "").trim();
      const transHtml = transText
        ? `<div class="era-digest-transition">
            <span class="era-digest-transition-label">Переход${to ? ` → ${escapeHtml(to)}` : ""}:</span>
            <span class="era-digest-transition-text">${highlightPlain(truncateText(transText, compact ? 110 : 200), query)}</span>
          </div>`
        : "";

      const eventTeaser =
        !compact && (era.events || []).length
          ? `<div class="era-digest-teaser"><span class="era-digest-teaser-label">События:</span> ${(era.events || [])
              .slice(0, 2)
              .map((e) => highlightPlain(truncateText(e, 72), query))
              .join(" · ")}</div>`
          : "";
      const discTeaser =
        !compact && (era.discoveries || []).length
          ? `<div class="era-digest-teaser"><span class="era-digest-teaser-label">Открытия:</span> ${highlightPlain(truncateText(era.discoveries[0], 90), query)}</div>`
          : "";

      const guideline =
        era.contentGuideline && String(era.contentGuideline).trim() && !compact
          ? `<p class="era-digest-guideline">${highlightPlain(truncateText(era.contentGuideline.trim(), 220), query)}</p>`
          : "";

      if (!chips.length && !periodStrip && !goalsHtml && !transHtml && !guideline && !eventTeaser && !discTeaser)
        return "";

      return `
        <div class="era-digest">
          <div class="era-digest-chips">${chips.join("")}</div>
          ${periodStrip}
          ${guideline}
          ${eventTeaser}
          ${discTeaser}
          ${goalsHtml ? `<div class="era-digest-block"><p class="era-digest-block-label">Фокус эпохи</p>${goalsHtml}</div>` : ""}
          ${transHtml}
        </div>`;
    }

    // --- State ---
    const state = {
      search: "",
      status: "all",
      designWeight: "all",
      visibleEraIds: null,
      periodsCollapsed: false,
      viewMode: "balanced",
      matrixHighlightSystemId: null,
      coreSystemsCategory: "all",
      dashboardView: "overview",
      focusedSystemId: null,
      focusedEraId: null,
      hoveredSystemId: null,
      applyingHash: false,
      lowerGateOpen: false,
      eraCompareActive: false,
      eraCompareLeft: "B",
      eraCompareRight: "C",
      selectedEntity: null,
      mainlineEdgePartner: null,
      mainlineEdgeKind: null,
      hoveredEraId: null,
      catalogFocus: null
    };

    const CATALOG_KIND_PREFIX = {
      resource: "res",
      research: "resch",
      technology: "tech",
      enterprise: "ent"
    };

    const TRANSITION_CHECKLIST_STORAGE_KEY = "sg-arch-transition-checklist-v1";

    function readTransitionChecklistStore() {
      try {
        const raw = localStorage.getItem(TRANSITION_CHECKLIST_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    function writeTransitionChecklistStore(store) {
      try {
        localStorage.setItem(TRANSITION_CHECKLIST_STORAGE_KEY, JSON.stringify(store));
      } catch {
        /* ignore quota / private mode */
      }
    }

    function getTransitionChecklistDone(eraId) {
      const store = readTransitionChecklistStore();
      const era = store[eraId];
      return era && typeof era === "object" ? era : {};
    }

    function setTransitionChecklistDone(eraId, index, checked) {
      const store = readTransitionChecklistStore();
      if (!store[eraId] || typeof store[eraId] !== "object") store[eraId] = {};
      if (checked) store[eraId][String(index)] = true;
      else delete store[eraId][String(index)];
      writeTransitionChecklistStore(store);
    }

    function transitionChecklistProgress(eraId) {
      const era = architecture.eras.find((e) => e && e.id === eraId);
      const ch = era && era.transition && Array.isArray(era.transition.checklist) ? era.transition.checklist : [];
      if (!ch.length) return { done: 0, total: 0 };
      const doneMap = getTransitionChecklistDone(eraId);
      let done = 0;
      ch.forEach((_, i) => {
        if (doneMap[String(i)]) done += 1;
      });
      return { done, total: ch.length };
    }

    // --- Entity inspector ---

    const ENTITY_KIND_LABELS = {
      system: "Система",
      era: "Эпоха",
      systemProgression: "Сквозная система",
      resource: "Ресурс",
      research: "Исследование",
      technology: "Технология",
      enterprise: "Предприятие",
      transition: "Переход эпох",
      bridge: "Мост эпох",
      prototype: "Модуль прототипа",
      roadmap: "Этап дорожной карты",
      dependency: "Зависимость слоя",
      uiScreen: "UI-экран"
    };

    const CATALOG_KIND_MAP = {
      resource: "gameResources",
      research: "gameResearch",
      technology: "gameTechnologies",
      enterprise: "gameEnterprises"
    };

    const CATALOG_MINIMUM_PASSPORT_FIELDS = ["id", "title", "summary", "status", "eraFrom", "eraTo", "systemIds"];
    const CATALOG_EXTENDED_PASSPORT_FIELDS = [
      "availabilityCondition",
      "requires",
      "unlocks",
      "usedIn",
      "producedBy",
      "prototypeRefs"
    ];

    function hasPassportValue(item, field) {
      const value = item ? item[field] : null;
      if (Array.isArray(value)) return value.some((v) => String(v || "").trim());
      return typeof value === "string" ? !!value.trim() : value != null;
    }

    function catalogPassportMissingFields(item) {
      return CATALOG_EXTENDED_PASSPORT_FIELDS.filter((field) => !hasPassportValue(item, field));
    }

    function catalogPassportLevel(item) {
      const minimumOk = CATALOG_MINIMUM_PASSPORT_FIELDS.every((field) => hasPassportValue(item, field));
      const extendedCount = CATALOG_EXTENDED_PASSPORT_FIELDS.reduce(
        (count, field) => count + (hasPassportValue(item, field) ? 1 : 0),
        0
      );
      return minimumOk && extendedCount >= 3 ? "extended" : "basic";
    }

    function entityKindClass(kind) {
      return String(kind || "").replace(/[^a-z0-9_-]/gi, "-");
    }

    function entityStatusFromFound(found) {
      const data = found && found.data;
      if (!data) return "";
      if (data.status) return data.status;
      if (data.module && data.module.status) return data.module.status;
      if (data.transition) return "designing";
      return "";
    }

    function eraIndex(id) {
      const i = ERA_ORDER.indexOf(id);
      return i >= 0 ? i : null;
    }

    function eraInRange(eraId, from, to) {
      const e = eraIndex(eraId);
      const a = eraIndex(from);
      const b = eraIndex(to);
      if (e == null || a == null || b == null) return false;
      return e >= Math.min(a, b) && e <= Math.max(a, b);
    }

    function encodeEntityHash(kind, id) {
      return `#entity:${kind}:${encodeURIComponent(String(id))}`;
    }

    function parseEntityHash(hash) {
      const h = (hash || "").replace(/^#/, "");
      const m = /^entity:([a-z]+):(.+)$/i.exec(h);
      if (!m) return null;
      try {
        return { kind: m[1], id: decodeURIComponent(m[2]) };
      } catch {
        return { kind: m[1], id: m[2] };
      }
    }

    function getSelectedEntity() {
      return state.selectedEntity;
    }

    function clearSelectedEntity(options) {
      const opts = options || {};
      state.selectedEntity = null;
      if (opts.clearSystemFocus !== false) {
        state.focusedSystemId = null;
        state.matrixHighlightSystemId = null;
        state.hoveredSystemId = null;
      }
      if (opts.clearEraFocus) state.focusedEraId = null;
      state.mainlineEdgePartner = null;
      state.mainlineEdgeKind = null;
      state.catalogFocus = null;
      syncEntityHash(null);
      applyMainlineHighlightClasses();
      renderEntityInspectorPanel();
      syncMatrixFocusRenders();
      renderFocusRecommendations();
      syncEntitySelectionDom();
    }

    function syncEntityHash(entity) {
      if (state.applyingHash) return;
      const base = location.pathname + location.search;
      if (!entity) {
        if (/^#entity:/i.test(location.hash)) history.replaceState(null, "", base);
        return;
      }
      const want = encodeEntityHash(entity.kind, entity.id);
      if (location.hash !== want) history.replaceState(null, "", base + want);
    }

    function findEntity(kind, id) {
      if (!kind || id == null) return null;
      const sid = String(id);
      switch (kind) {
        case "system":
          return getSystemById(sid) ? { kind, id: sid, data: getSystemById(sid) } : null;
        case "era": {
          const era = (architecture.eras || []).find((e) => e && e.id === sid);
          return era ? { kind, id: sid, data: era } : null;
        }
        case "systemProgression": {
          const row = (architecture.systemProgression || []).find((e) => e && e.systemId === sid);
          return row ? { kind, id: sid, data: row } : null;
        }
        case "resource":
        case "research":
        case "technology":
        case "enterprise": {
          const arr = architecture[CATALOG_KIND_MAP[kind]] || [];
          const item = arr.find((x) => x && x.id === sid);
          return item ? { kind, id: sid, data: item, catalogKind: kind } : null;
        }
        case "bridge": {
          const ab = architecture.architectureBridge;
          if (!ab || !ab[sid]) return null;
          return { kind, id: sid, data: ab[sid] };
        }
        case "roadmap": {
          const item = (architecture.roadmap || []).find((r) => r && r.id === sid);
          return item ? { kind, id: sid, data: item } : null;
        }
        case "transition": {
          const era = (architecture.eras || []).find((e) => e && e.id === sid);
          if (!era || !era.transition) return null;
          return { kind, id: sid, data: { era, transition: era.transition } };
        }
        case "prototype": {
          const parts = sid.split("|");
          const eraId = parts[0];
          const path = parts.slice(1).join("|");
          const pm = architecture.prototypeMapping;
          if (!pm || !Array.isArray(pm.eras)) return null;
          const row = pm.eras.find((r) => r && r.eraId === eraId);
          if (!row) return null;
          const mod = (row.modules || []).find((m) => m && m.path === path);
          if (!mod) return null;
          return { kind, id: sid, data: { eraId, module: mod, eraRow: row } };
        }
        case "dependency": {
          const parts = sid.split("|");
          if (parts.length < 2) return null;
          const from = parts[0];
          const to = parts[1];
          const type = parts[2] || "";
          const d = (architecture.dependencies || []).find(
            (x) => x && x.from === from && x.to === to && (!type || x.type === type)
          );
          return d ? { kind, id: sid, data: d } : null;
        }
        case "uiScreen": {
          const screen = (architecture.uiScreens || []).find((x) => x && x.id === sid);
          return screen ? { kind, id: sid, data: screen } : null;
        }
        default:
          return null;
      }
    }

    function dependencyEntityId(d) {
      if (!d || !d.from || !d.to) return "";
      return `${d.from}|${d.to}|${d.type || ""}`;
    }

    function prototypeModuleId(eraId, path) {
      return `${eraId}|${path}`;
    }

    function catalogItemsForEra(eraId) {
      const out = { resource: [], research: [], technology: [], enterprise: [] };
      for (const kind of Object.keys(CATALOG_KIND_MAP)) {
        const arr = architecture[CATALOG_KIND_MAP[kind]] || [];
        out[kind] = arr.filter((item) => item && eraInRange(eraId, item.eraFrom, item.eraTo));
      }
      return out;
    }

    function catalogItemsForSystem(systemId) {
      const out = { resource: [], research: [], technology: [], enterprise: [] };
      for (const kind of Object.keys(CATALOG_KIND_MAP)) {
        const arr = architecture[CATALOG_KIND_MAP[kind]] || [];
        out[kind] = arr.filter((item) => {
          const ids = resolveCatalogSystemIds(item, CATALOG_KIND_PREFIX[kind]);
          return ids.includes(systemId);
        });
      }
      return out;
    }

    function catalogKindPrefix(kind) {
      return CATALOG_KIND_PREFIX[kind] || "res";
    }

    function clearCatalogFocus() {
      if (!state.catalogFocus) return;
      state.catalogFocus = null;
      renderGameCatalog();
      syncEntitySelectionDom();
    }

    function catalogItemPassesFocus(item, catalogKind) {
      const f = state.catalogFocus;
      if (!f) return true;
      if (f.kinds && f.kinds.length && !f.kinds.includes(catalogKind)) return false;
      if (f.systemId) {
        const ids = resolveCatalogSystemIds(item, catalogKindPrefix(catalogKind));
        if (!ids.includes(f.systemId)) return false;
      }
      if (f.eraId && !eraInRange(f.eraId, item.eraFrom, item.eraTo)) return false;
      return true;
    }

    function focusCatalogForSystem(systemId, kinds) {
      const kindList =
        kinds && String(kinds).trim()
          ? String(kinds)
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : null;
      state.catalogFocus = {
        systemId: String(systemId),
        kinds: kindList
      };
      openLowerSection("lower-gate-catalog");
      renderGameCatalog();
      syncEntitySelectionDom();
      document.getElementById("section-game-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
      requestAnimationFrame(() => {
        const first = document.querySelector(".catalog-entity-card--focus-match");
        if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    function focusCatalogForEra(eraId) {
      state.catalogFocus = { eraId: String(eraId), kinds: null };
      openLowerSection("lower-gate-catalog");
      renderGameCatalog();
      syncEntitySelectionDom();
      document.getElementById("section-game-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function findCatalogItemByRef(ref) {
      if (!ref) return null;
      const r = String(ref);
      for (const kind of Object.keys(CATALOG_KIND_MAP)) {
        const arr = architecture[CATALOG_KIND_MAP[kind]] || [];
        const item = arr.find((x) => x && (x.id === r || x.title === r));
        if (item) return { kind, item };
      }
      return null;
    }

    function requiredByForCatalogItem(item) {
      const id = item && item.id ? String(item.id) : "";
      if (!id) return [];
      const hits = [];
      for (const kind of Object.keys(CATALOG_KIND_MAP)) {
        const arr = architecture[CATALOG_KIND_MAP[kind]] || [];
        arr.forEach((other) => {
          if (!other || other.id === id) return;
          const refs = [...(other.requires || []), ...(other.requiredBy || []), ...(other.usedIn || [])];
          if (refs.some((r) => String(r) === id)) hits.push({ kind, item: other });
        });
      }
      return hits.slice(0, 16);
    }

    function roadmapItemsForTransition(eraId, toEra) {
      const re = new RegExp(`\\b(${eraId}|${toEra || "x"})\\b`, "i");
      return (architecture.roadmap || [])
        .filter((item) => {
          if (!item) return false;
          const blob = [item.title, item.summary, item.id, ...(item.checklist || [])].join(" ");
          return re.test(blob);
        })
        .slice(0, 6);
    }

    function eraSystemsInspectorBlock(era, q) {
      const rows = eraSystemKeys
        .filter((k) => era.systems && String(era.systems[k] || "").trim())
        .map((k) => {
          const snippet = highlightPlain(truncateText(era.systems[k], 72), q);
          if (getSystemById(k))
            return `<li class="entity-era-sys-row">${renderEntityChip("system", k, systemRowLabels[k] || k)}<span class="entity-era-sys-snippet">${snippet}</span></li>`;
          return `<li class="entity-era-sys-row"><span class="entity-chip entity-chip--static">${escapeHtml(systemRowLabels[k] || k)}</span><span class="entity-era-sys-snippet">${snippet}</span></li>`;
        })
        .join("");
      if (!rows) return "";
      return `<details class="entity-inspector-section" open><summary class="entity-inspector-section-sum">Ключевые системы эпохи</summary><ul class="entity-inspector-list entity-era-sys-list">${rows}</ul></details>`;
    }

    function getRelatedDomContext() {
      const sel = state.selectedEntity;
      const ctx = {
        systemIds: new Set(),
        catalogKeys: new Set(),
        eraIds: new Set(),
        bridgeKeys: new Set()
      };
      if (!sel) return ctx;
      const found = findEntity(sel.kind, sel.id);
      if (!found) return ctx;
      if (sel.kind === "system") {
        const s = found.data;
        (s.relatedSystems || []).forEach((r) => r && r.systemId && ctx.systemIds.add(r.systemId));
        const cat = catalogItemsForSystem(s.id);
        for (const k of Object.keys(cat)) cat[k].forEach((it) => ctx.catalogKeys.add(`${k}:${it.id}`));
      } else if (sel.kind === "era") {
        const era = found.data;
        ctx.eraIds.add(sel.id);
        bridgeKeysForEra(sel.id).forEach((bk) => ctx.bridgeKeys.add(bk));
        const cat = catalogItemsForEra(sel.id);
        for (const k of Object.keys(cat)) cat[k].forEach((it) => ctx.catalogKeys.add(`${k}:${it.id}`));
        eraSystemKeys.forEach((k) => {
          if (era.systems && String(era.systems[k] || "").trim() && getSystemById(k)) ctx.systemIds.add(k);
        });
      } else if (["resource", "research", "technology", "enterprise"].includes(sel.kind)) {
        const item = found.data;
        resolveCatalogSystemIds(item, catalogKindPrefix(sel.kind)).forEach((sid) => ctx.systemIds.add(sid));
        if (item.eraFrom) ctx.eraIds.add(item.eraFrom);
        if (item.eraTo) ctx.eraIds.add(item.eraTo);
        requiredByForCatalogItem(item).forEach((h) => ctx.catalogKeys.add(`${h.kind}:${h.item.id}`));
        (item.requires || []).forEach((r) => {
          const hit = findCatalogItemByRef(String(r));
          if (hit) ctx.catalogKeys.add(`${hit.kind}:${hit.item.id}`);
        });
        (item.unlocks || []).forEach((r) => {
          const hit = findCatalogItemByRef(String(r));
          if (hit) ctx.catalogKeys.add(`${hit.kind}:${hit.item.id}`);
        });
      } else if (sel.kind === "systemProgression") {
        const e = found.data;
        ctx.systemIds.add(e.systemId);
        (e.relatedSystems || []).forEach((r) => r && r.systemId && ctx.systemIds.add(r.systemId));
      } else if (sel.kind === "dependency") {
        const d = found.data;
        if (getSystemById(d.from)) ctx.systemIds.add(d.from);
        if (getSystemById(d.to)) ctx.systemIds.add(d.to);
      }
      return ctx;
    }

    function actionFingerprint(a) {
      return [
        a.action,
        a.label,
        a.argKind || "",
        a.argId || "",
        a.anchor || "",
        a.kinds || "",
        a.field || ""
      ].join("\0");
    }

    function dedupeActions(actions) {
      const seen = new Set();
      const out = [];
      for (const a of actions) {
        const fp = actionFingerprint(a);
        if (seen.has(fp)) continue;
        seen.add(fp);
        out.push(a);
      }
      return out;
    }

    function inferActionTier(a) {
      if (a.tier) return a.tier;
      if (a.action === "copy-link") return "utility";
      if (a.action === "scroll" || a.action === "select") return "primary";
      return "context";
    }

    function finalizeInspectorActions(sel, actions) {
      let list = actions.filter((a) => a.action !== "clear");
      const found = findEntity(sel.kind, sel.id);
      if (!found) return dedupeActions(list);

      list = list.filter(
        (a) => !(a.action === "related-systems" && a.argKind === "system" && a.argId === sel.id)
      );

      if (sel.kind === "system") {
        const specificCatalog = list.filter(
          (a) => a.action === "catalog-system" && a.kinds && !/^resource,research,technology,enterprise$/.test(a.kinds)
        );
        if (specificCatalog.length) {
          list = list.filter(
            (a) =>
              !(
                a.action === "catalog-system" &&
                a.kinds === "resource,research,technology,enterprise"
              )
          );
        } else {
          const cat = catalogItemsForSystem(sel.id);
          const total = Object.keys(cat).reduce((n, k) => n + cat[k].length, 0);
          if (total && !list.some((a) => a.action === "catalog-system")) {
            list.push({
              action: "catalog-system",
              label: "Каталог",
              argId: sel.id,
              kinds: "resource,research,technology,enterprise",
              tier: "context"
            });
          }
        }
      }

      if (sel.kind === "era") {
        if (list.some((a) => a.anchor === `#era-${sel.id}`)) {
          list = list.filter((a) => a.action !== "scroll");
        }
        const eraCatalog = list.filter((a) => a.action === "catalog-era");
        if (eraCatalog.length > 1) {
          const keep =
            eraCatalog.find((a) => /сущност/i.test(a.label)) || eraCatalog[0];
          list = list.filter((a) => a.action !== "catalog-era" || a === keep);
        }
      }

      if (["resource", "research", "technology", "enterprise"].includes(sel.kind)) {
        list = list.filter((a) => a.label !== "Показать в каталоге");
        if (list.some((a) => a.label === "Перейти к каталогу")) {
          list = list.filter((a) => a.action !== "scroll");
        }
        const item = found.data;
        if (item.eraTo && item.eraTo !== item.eraFrom) {
          const hasEra = list.some((a) => a.action === "select" && a.argKind === "era");
          if (!hasEra) {
            list.push({
              action: "select",
              label: `Эпохи ${item.eraFrom}–${item.eraTo}`,
              argKind: "era",
              argId: item.eraFrom,
              tier: "context"
            });
          }
        }
      }

      if (sel.kind === "systemProgression") {
        const catalogs = list.filter((a) => a.action === "catalog-system");
        if (catalogs.length > 1) {
          const keep = catalogs.find((a) => a.label === "Каталог") || catalogs[0];
          list = list.filter((a) => a.action !== "catalog-system" || a === keep);
        } else if (!catalogs.length) {
          list.push({
            action: "catalog-system",
            label: "Каталог",
            argId: found.data.systemId,
            kinds: "resource,research,technology,enterprise",
            tier: "context"
          });
        }
      }

      if (sel.kind === "uiScreen") {
        list = list.filter((a) => a.action !== "scroll");
      }

      return dedupeActions(list);
    }

    function prototypeModulesForSystem(systemId) {
      const pm = architecture.prototypeMapping;
      if (!pm || !Array.isArray(pm.eras)) return [];
      const hits = [];
      pm.eras.forEach((row) => {
        (row.modules || []).forEach((mod) => {
          if (mod && Array.isArray(mod.systemIds) && mod.systemIds.includes(systemId)) {
            hits.push({ eraId: row.eraId, module: mod, eraRow: row });
          }
        });
      });
      return hits;
    }

    function prototypeRowForEra(eraId) {
      const pm = architecture.prototypeMapping;
      if (!pm || !Array.isArray(pm.eras)) return null;
      return pm.eras.find((r) => r && r.eraId === eraId) || null;
    }

    function bridgeKeysForEra(eraId) {
      const keys = [];
      if ((eraId === "B" || eraId === "C") && architecture.architectureBridge?.B_to_C) keys.push("B_to_C");
      if (eraId === "D" && architecture.architectureBridge?.C_to_D) keys.push("C_to_D");
      return keys;
    }

    function dependenciesTouchingSystem(systemId) {
      const requires = [];
      const enables = [];
      for (const d of architecture.dependencies || []) {
        if (!d || !d.from || !d.to) continue;
        if (d.to === systemId) requires.push(d);
        if (d.from === systemId) enables.push(d);
      }
      return { requires, enables };
    }

    function dependenciesTouchingCatalogItem(item, sysIds) {
      const hits = [];
      const seen = new Set();
      const id = item && item.id ? String(item.id) : "";
      for (const d of architecture.dependencies || []) {
        if (!d) continue;
        const key = `${d.from}|${d.to}|${d.type}`;
        if (seen.has(key)) continue;
        const inText = id && String(d.description || "").includes(id);
        const inSys = sysIds.some((sid) => d.from === sid || d.to === sid);
        if (inText || inSys) {
          seen.add(key);
          hits.push(d);
        }
      }
      return hits.slice(0, 12);
    }

    function renderDepRows(deps, q) {
      if (!deps || !deps.length) return "";
      return deps
        .map((d) => {
          const fromBtn = getSystemById(d.from)
            ? renderEntityChip("system", d.from, d.from)
            : escapeHtml(d.from);
          const toBtn = getSystemById(d.to)
            ? renderEntityChip("system", d.to, d.to)
            : escapeHtml(d.to);
          const type = dependencyTypeLabels[d.type] || d.type;
          return `<li><span class="entity-rel-type">${escapeHtml(type)}</span> ${fromBtn} → ${toBtn}<div class="entity-rel-note">${highlightPlain(String(d.description || ""), q)}</div></li>`;
        })
        .join("");
    }

    function renderUnifiedLinksSection(sectionsHtml) {
      const inner = sectionsHtml.filter(Boolean).join("");
      if (!inner) return "";
      return `<details class="entity-inspector-section" open><summary class="entity-inspector-section-sum">Связи</summary><div class="entity-inspector-links">${inner}</div></details>`;
    }

    function renderInspectorFactBlock(title, rows, options) {
      const opts = options || {};
      const clean = (rows || []).filter((row) => row && row.value != null && String(row.value).trim());
      if (!clean.length) return "";
      const open = opts.open === false ? "" : " open";
      const items = clean
        .map(
          (row) =>
            `<li><span class="entity-fact-label">${escapeHtml(row.label)}</span><span class="entity-fact-value">${row.value}</span></li>`
        )
        .join("");
      return `<details class="entity-inspector-section entity-inspector-facts"${open}><summary class="entity-inspector-section-sum">${escapeHtml(title)}</summary><ul class="entity-fact-list">${items}</ul></details>`;
    }

    function renderCatalogPassportBlock(item) {
      const level = catalogPassportLevel(item);
      const missing = catalogPassportMissingFields(item);
      const levelLabel = level === "extended" ? "Паспорт расширен." : "Паспорт: базовый.";
      const missingHtml = missing.length
        ? `<p class="entity-inspector-muted">Для полноценного паспорта не хватает:</p><ul class="entity-inspector-list">${missing
            .map((field) => `<li><code>${escapeHtml(field)}</code></li>`)
            .join("")}</ul>`
        : `<p class="entity-inspector-muted">Паспорт расширен.</p>`;
      return `<details class="entity-inspector-section entity-inspector-passport" open><summary class="entity-inspector-section-sum">${escapeHtml(levelLabel)}</summary>${missingHtml}</details>`;
    }

    function prototypeModulesForSystems(systemIds) {
      const hits = [];
      const seen = new Set();
      (systemIds || []).forEach((sid) => {
        prototypeModulesForSystem(sid).forEach((hit) => {
          const key = `${hit.eraId}|${hit.module.path}`;
          if (seen.has(key)) return;
          seen.add(key);
          hits.push(hit);
        });
      });
      return hits;
    }

    function renderBridgeInspectorBody(bridgeKey, bridge, q) {
      const listHtml = (items) =>
        items && items.length
          ? `<ul class="bridge-list">${items.map((t) => `<li>${highlightPlain(String(t), q)}</li>`).join("")}</ul>`
          : '<p class="bridge-empty">—</p>';
      const inheritsHtml =
        bridge.inherits && bridge.inherits.length
          ? `<ul class="bridge-inherits">${bridge.inherits
              .map(
                (r) =>
                  `<li>${renderEntityChip("system", r.system, r.system)} — ${highlightPlain(String(r.note || ""), q)}</li>`
              )
              .join("")}</ul>`
          : "";
      let html = `<p class="entity-inspector-sum">${highlightPlain(String(bridge.summary || ""), q)}</p>`;
      html += (bridge.shifts || [])
        .map(
          (s) =>
            `<details class="bridge-sec" open><summary class="bridge-sec-sum">${escapeHtml(s.title)}</summary><div class="bridge-sec-body">${listHtml(s.items)}</div></details>`
        )
        .join("");
      html += `<details class="bridge-sec"><summary class="bridge-sec-sum">Перестаёт быть нормой</summary><div class="bridge-sec-body">${listHtml(bridge.stopsDoing)}</div></details>`;
      if (bridgeKey === "B_to_C") {
        html += `<details class="bridge-sec"><summary class="bridge-sec-sum">Становится трудом поселения</summary><div class="bridge-sec-body">${listHtml(bridge.settlementLabor)}</div></details>`;
        html += `<details class="bridge-sec" open><summary class="bridge-sec-sum">Наследует прототип (системы)</summary><div class="bridge-sec-body">${inheritsHtml}</div></details>`;
        html += `<details class="bridge-sec"><summary class="bridge-sec-sum">UI становится второстепенным</summary><div class="bridge-sec-body">${listHtml(bridge.uiSecondary)}</div></details>`;
        html += `<details class="bridge-sec" open><summary class="bridge-sec-sum">Критерии перехода к C</summary><div class="bridge-sec-body">${listHtml(bridge.criteria)}</div></details>`;
        html += `<details class="bridge-sec"><summary class="bridge-sec-sum">Минимальный макет C до кода</summary><div class="bridge-sec-body">${listHtml(bridge.minDesignPack)}</div></details>`;
        if (bridge.docRef) html += `<p class="entity-inspector-meta"><code>${escapeHtml(bridge.docRef)}</code></p>`;
      } else {
        html += `<details class="bridge-sec" open><summary class="bridge-sec-sum">От поселения к городу</summary><div class="bridge-sec-body">${listHtml(bridge.settlementToCity)}</div></details>`;
        html += `<details class="bridge-sec" open><summary class="bridge-sec-sum">Наследует слой C (системы)</summary><div class="bridge-sec-body">${inheritsHtml}</div></details>`;
        html += `<details class="bridge-sec"><summary class="bridge-sec-sum">Фокус разблокировок</summary><div class="bridge-sec-body">${listHtml(bridge.unlocksFocus)}</div></details>`;
        html += `<details class="bridge-sec" open><summary class="bridge-sec-sum">Критерии перехода к D</summary><div class="bridge-sec-body">${listHtml(bridge.criteria)}</div></details>`;
      }
      html += `<details class="bridge-sec"><summary class="bridge-sec-sum">Запрещено до моста</summary><div class="bridge-sec-body">${listHtml(bridge.forbiddenUntilBridge)}</div></details>`;
      return html;
    }

    function renderEntityChip(kind, id, label, extraClass) {
      const found = findEntity(kind, id);
      if (!found && kind === "system" && !getSystemById(id)) {
        return `<span class="entity-chip entity-chip--static">${escapeHtml(label || id)}</span>`;
      }
      return `<button type="button" class="entity-chip entity-link${extraClass ? " " + extraClass : ""}" data-entity-select="${escapeHtml(kind)}" data-entity-id="${escapeHtml(id)}">${escapeHtml(label || id)}</button>`;
    }

    function renderStringList(title, items, q, fieldId) {
      if (!items || !items.length) return "";
      const lis = items
        .map((t) => `<li>${highlightPlain(String(t), q)}</li>`)
        .join("");
      const idAttr = fieldId ? ` id="inspector-field-${escapeHtml(fieldId)}"` : "";
      return `<details class="entity-inspector-section" open${idAttr}><summary class="entity-inspector-section-sum">${escapeHtml(title)}</summary><ul class="entity-inspector-list">${lis}</ul></details>`;
    }

    function renderRefList(title, refs, q) {
      if (!refs || !refs.length) return "";
      const lis = refs
        .map((r) => {
          if (typeof r === "string") return `<li>${highlightPlain(r, q)}</li>`;
          if (r && r.path)
            return `<li><code>${escapeHtml(r.path)}</code>${r.label ? ` — ${escapeHtml(r.label)}` : ""}</li>`;
          return `<li>${escapeHtml(String(r))}</li>`;
        })
        .join("");
      return `<details class="entity-inspector-section"><summary class="entity-inspector-section-sum">${escapeHtml(title)}</summary><ul class="entity-inspector-list">${lis}</ul></details>`;
    }

    function renderPrototypeBlock(hits, q, options) {
      const opts = options || {};
      const directRefs = Array.isArray(opts.directRefs) ? opts.directRefs.filter((ref) => String(ref || "").trim()) : [];
      const title = opts.title || "Связь с прототипом";
      const visibleHits = opts.limit ? (hits || []).slice(0, opts.limit) : hits || [];
      if (!visibleHits.length && !directRefs.length) {
        const suggestion = opts.suggestion
          ? `<p class="entity-inspector-muted">${escapeHtml(opts.suggestion)}</p>`
          : "";
        return `<details class="entity-inspector-section entity-inspector-prototype" open><summary class="entity-inspector-section-sum">${escapeHtml(title)}</summary><p class="entity-inspector-muted">Прямых связей с прототипом пока нет.</p>${suggestion}</details>`;
      }
      const directHtml = directRefs.length
        ? `<p class="entity-inspector-subhead">Прямые связи</p><ul class="entity-inspector-list">${directRefs
            .map((ref) => `<li><code>${highlightPlain(String(ref), q)}</code></li>`)
            .join("")}</ul>`
        : "";
      const cards = visibleHits
        .map((h) => {
          const pid = prototypeModuleId(h.eraId, h.module.path);
          return `<button type="button" class="prototype-ref-card entity-link" data-entity-select="prototype" data-entity-id="${escapeHtml(pid)}">
            <span class="prototype-ref-era">${escapeHtml(h.eraId)}</span>
            <span class="prototype-ref-label">${escapeHtml(h.module.label || h.module.path)}</span>
            <code class="prototype-ref-path">${escapeHtml(h.module.path)}</code>
            ${h.module.status ? `<span class="prototype-ref-status">${escapeHtml(statusLabels[h.module.status] || h.module.status)}</span>` : ""}
            ${h.module.note ? `<span class="prototype-ref-note">${highlightPlain(String(h.module.note), q)}</span>` : ""}
          </button>`;
        })
        .join("");
      const mappedHtml = cards
        ? `<p class="entity-inspector-subhead">${directRefs.length ? "Связанные модули карты" : "Есть прямые связи"}</p><div class="prototype-ref-grid">${cards}</div>`
        : "";
      const more = opts.limit && hits && hits.length > opts.limit ? `<p class="entity-inspector-muted">Показано ${opts.limit} из ${hits.length} модулей.</p>` : "";
      return `<details class="entity-inspector-section entity-inspector-prototype" open><summary class="entity-inspector-section-sum">${escapeHtml(title)}</summary>${directHtml}${mappedHtml}${more}</details>`;
    }

    function renderActionButton(a) {
      const tier = inferActionTier(a);
      let attrs = `data-entity-action="${escapeHtml(a.action)}"`;
      if (a.argKind) attrs += ` data-entity-action-kind="${escapeHtml(a.argKind)}"`;
      if (a.argId != null && a.argId !== "") attrs += ` data-entity-action-id="${escapeHtml(a.argId)}"`;
      if (a.anchor) attrs += ` data-entity-action-anchor="${escapeHtml(a.anchor)}"`;
      if (a.kinds) attrs += ` data-entity-action-kinds="${escapeHtml(a.kinds)}"`;
      if (a.field) attrs += ` data-entity-action-field="${escapeHtml(a.field)}"`;
      return `<button type="button" class="entity-action-btn entity-action-btn--${escapeHtml(tier)}" ${attrs}>${escapeHtml(a.label)}</button>`;
    }

    function renderActions(sel, actions) {
      const list = finalizeInspectorActions(sel, actions);
      if (!list.length) return "";
      const groups = { primary: [], context: [], utility: [] };
      list.forEach((a) => groups[inferActionTier(a)].push(a));
      const primaryHead = groups.primary.slice(0, 3);
      const overflowPrimary = groups.primary.slice(3).map((a) => ({ ...a, tier: "context" }));
      const contextList = [...groups.context, ...overflowPrimary, ...groups.utility.map((a) => ({ ...a, tier: "context" }))];
      const MAX_CONTEXT = 3;
      const ctxHead = contextList.slice(0, MAX_CONTEXT);
      const ctxMore = contextList.slice(MAX_CONTEXT);
      let html = "";
      if (primaryHead.length) {
        html += `<div class="entity-actions-block entity-actions-block--primary"><p class="entity-actions-label">Быстрые действия</p><div class="entity-actions entity-actions--primary">${primaryHead.map(renderActionButton).join("")}</div></div>`;
      }
      if (ctxHead.length) {
        html += `<div class="entity-actions-block"><p class="entity-actions-label">Дополнительно</p><div class="entity-actions entity-actions--context">${ctxHead.map(renderActionButton).join("")}</div></div>`;
      }
      if (ctxMore.length) {
        html += `<details class="entity-actions-more"><summary class="entity-actions-more-sum">Ещё действия (${ctxMore.length})</summary><div class="entity-actions entity-actions--context">${ctxMore.map(renderActionButton).join("")}</div></details>`;
      }
      return html;
    }

    function selectEntity(kind, id, options) {
      const opts = options || {};
      const found = findEntity(kind, id);
      if (!found) {
        if (!opts.silent) clearSelectedEntity({ clearEraFocus: false });
        return false;
      }
      state.selectedEntity = { kind, id: String(id) };

      if (kind === "system") {
        if (!opts.keepEdgePartner) {
          state.mainlineEdgePartner = null;
          state.mainlineEdgeKind = null;
        }
        state.focusedSystemId = String(id);
        state.matrixHighlightSystemId = String(id);
        state.hoveredSystemId = null;
        applyMainlineHighlightClasses();
        syncMatrixFocusRenders();
      } else if (kind === "era") {
        setEraFocus(String(id), { updateHash: false, scrollInspector: !!opts.scrollInspector, openTimeline: false });
        if (opts.scroll !== false) {
          scrollSpineCardIntoView(String(id));
          highlightTimelineEraCard(String(id));
          scrollToEra(String(id));
        }
      } else if (kind === "systemProgression") {
        const sys = getSystemById(String(id));
        if (sys) {
          state.focusedSystemId = String(id);
          state.matrixHighlightSystemId = String(id);
          applyMainlineHighlightClasses();
        }
      }

      if (opts.updateHash !== false) syncEntityHash(state.selectedEntity);
      renderEntityInspectorPanel();
      renderFocusRecommendations();
      syncEntitySelectionDom();
      if (opts.scroll) scrollToEntityAnchor(kind, id);
      if (opts.scrollInspector !== false && (kind === "system" || kind === "era")) scrollEntityInspectorIntoView();
      return true;
    }

    function scrollEntityInspectorIntoView() {
      const panel = document.getElementById("system-focus-panel");
      if (!panel) return;
      requestAnimationFrame(() => {
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }

    function focusMainlineEdge(from, to, kind) {
      if (!from || !getSystemById(from)) return;
      state.mainlineEdgePartner = to && getSystemById(to) && to !== from ? to : null;
      state.mainlineEdgeKind = kind && kind !== "focus" ? kind : null;
      selectEntity("system", from, {
        scroll: false,
        scrollInspector: true,
        updateHash: true,
        keepEdgePartner: true
      });
      state.hoveredSystemId = null;
      applyMainlineHighlightClasses();
      renderEntityInspectorPanel();
      if (kind && kind !== "focus") flashMainlineEdgeKind(kind);
    }

    function scrollToEntityAnchor(kind, id) {
      if (kind === "system") {
        scrollToSystem(id);
        return;
      }
      if (kind === "era") {
        const el = document.getElementById(`era-${id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const catalogAnchor = {
        resource: "res",
        research: "resch",
        technology: "tech",
        enterprise: "ent"
      };
      if (catalogAnchor[kind]) {
        const el = document.getElementById(`game-${catalogAnchor[kind]}-${id}`);
        if (el) {
          openLowerSection("lower-gate-catalog");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
      if (kind === "systemProgression") {
        const el = document.getElementById(`system-progression-${id}`);
        if (el) {
          openLowerSection("lower-gate-systems");
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      if (kind === "uiScreen") {
        openLowerSection("lower-gate-catalog");
        document.getElementById("section-screens")?.scrollIntoView({ behavior: "smooth", block: "start" });
        const card = document.getElementById(`screen-card-${id}`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    function syncEntitySelectionDom() {
      const sel = state.selectedEntity;
      const ctx = getRelatedDomContext();
      document.querySelectorAll("[data-entity-select]").forEach((el) => {
        const k = el.getAttribute("data-entity-select");
        const id = el.getAttribute("data-entity-id");
        const on = !!(sel && sel.kind === k && sel.id === id);
        el.classList.toggle("entity-card--selected", on);
        el.classList.toggle("entity-link--selected", on);
        let related = false;
        let muted = false;
        if (sel && !on) {
          if (k === "system" && ctx.systemIds.has(id)) related = true;
          if (["resource", "research", "technology", "enterprise"].includes(k) && ctx.catalogKeys.has(`${k}:${id}`))
            related = true;
          if (k === "era" && ctx.eraIds.has(id)) related = true;
          if (k === "bridge" && ctx.bridgeKeys.has(id)) related = true;
          if (sel.kind === "system" && k === "system") muted = !related;
          if (["resource", "research", "technology", "enterprise"].includes(sel.kind) && k === "system")
            muted = !related;
        }
        el.classList.toggle("entity-card--related", related);
        el.classList.toggle("entity-card--muted", muted);
      });
      document.querySelectorAll("[data-mainline-system]").forEach((el) => {
        const id = el.getAttribute("data-mainline-system");
        if (sel && sel.kind === "system") {
          el.classList.toggle("entity-card--selected", sel.id === id);
        }
      });
      document.querySelectorAll("[data-era-spine]").forEach((el) => {
        const id = el.getAttribute("data-era-spine");
        const on = !!(sel && sel.kind === "era" && sel.id === id);
        el.classList.toggle("entity-link--selected", on);
        el.classList.toggle("entity-card--selected", on);
      });
      document.querySelectorAll(".era-card[data-entity-select]").forEach((el) => {
        const k = el.getAttribute("data-entity-select");
        const id = el.getAttribute("data-entity-id");
        const on = !!(sel && sel.kind === k && sel.id === id);
        el.classList.toggle("entity-card--selected", on);
        el.classList.toggle("entity-link--selected", on);
      });
    }

    function setHoveredEraColumn(eraId) {
      state.hoveredEraId = eraId || null;
      document.querySelectorAll("[data-matrix-era]").forEach((el) => {
        el.classList.toggle("is-matrix-col-hover", !!(eraId && el.getAttribute("data-matrix-era") === eraId));
      });
      document.querySelectorAll("#timeline-grid .era-card").forEach((el) => {
        const id = el.getAttribute("data-entity-id") || (el.id || "").replace(/^era-/, "");
        el.classList.toggle("era-card--hover", !!(eraId && id === eraId));
      });
      const panel = document.getElementById("system-focus-panel");
      if (panel) {
        panel.classList.toggle("entity-inspector--era-hover", !!eraId);
        if (eraId && !state.selectedEntity) {
          const era = (architecture.eras || []).find((e) => e && e.id === eraId);
          if (era) {
            panel.classList.add("entity-inspector--active");
            panel.innerHTML = `<h3 class="dashboard-panel-title entity-inspector-title">Инспектор объекта</h3>
              <p class="entity-inspector-kind">Эпоха (наведение)</p>
              <div class="entity-inspector-card entity-inspector-card--preview">
                <h4 class="entity-inspector-name">${escapeHtml(era.title)}</h4>
                <p class="entity-inspector-id"><code>${escapeHtml(era.id)}</code></p>
                <p class="entity-inspector-sum">${escapeHtml(truncateText(era.summary || "", 160))}</p>
                <p class="entity-inspector-muted">Клик — зафиксировать выбор.</p>
              </div>`;
          }
        } else if (!eraId && !state.selectedEntity) {
          panel.classList.remove("entity-inspector--active", "entity-inspector--era-hover");
          panel.innerHTML = `<h3 class="dashboard-panel-title entity-inspector-title">Инспектор объекта</h3>
            <p class="entity-inspector-empty">Выберите эпоху, систему, ресурс, технологию или другой объект карты.</p>`;
        } else if (!eraId) {
          panel.classList.remove("entity-inspector--era-hover");
        }
      }
    }

    function copyEntityLink(kind, id, feedbackBtn) {
      const url = location.origin + location.pathname + location.search + encodeEntityHash(kind, id);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(url)
          .then(() => flashActionButton(feedbackBtn, "Скопировано"))
          .catch(() => flashActionButton(feedbackBtn, "Ссылка в адресе"));
      } else {
        flashActionButton(feedbackBtn, "Ссылка в адресе");
      }
      syncEntityHash({ kind, id: String(id) });
    }

    function flashActionButton(btn, message) {
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = message;
      btn.classList.add("is-flashed");
      btn.disabled = true;
      clearTimeout(btn._flashTimer);
      btn._flashTimer = setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("is-flashed");
        btn.disabled = false;
      }, 1400);
    }

    function renderInspectorEmptyHint() {
      return `<p class="entity-inspector-hint">Клик по узлу <strong>магистрали</strong>, эпохе на линии или карточке в каталоге открывает связи и действия здесь.</p>
        <p class="entity-inspector-hint entity-inspector-hint--examples">Примеры: ${renderEntityChip("system", "people", "Люди")} ${renderEntityChip("era", "C", "Эпоха C")}</p>`;
    }

    function renderEntityInspectorPanel() {
      const panel = document.getElementById("system-focus-panel");
      if (!panel) return;
      const q = state.search;
      let sel = state.selectedEntity;
      if (!sel && state.focusedSystemId) sel = { kind: "system", id: state.focusedSystemId };
      if (!sel && state.focusedEraId) sel = { kind: "era", id: state.focusedEraId };

      if (!sel) {
        panel.classList.remove("entity-inspector--active");
        panel.innerHTML = `<h3 class="dashboard-panel-title entity-inspector-title">Инспектор объекта</h3>
          <p class="entity-inspector-empty">Выберите эпоху, систему, ресурс, технологию или другой объект карты.</p>
          ${renderInspectorEmptyHint()}`;
        return;
      }

      const found = findEntity(sel.kind, sel.id);
      if (!found) {
        panel.innerHTML = `<h3 class="dashboard-panel-title">Инспектор объекта</h3><p class="entity-inspector-empty">Объект не найден.</p>`;
        return;
      }

      panel.classList.add("entity-inspector--active");
      panel.classList.remove("entity-inspector--era-hover");
      const kindLabel = ENTITY_KIND_LABELS[sel.kind] || sel.kind;
      const status = entityStatusFromFound(found);
      const statusBadge = status ? createStatusPill(status) : "";
      let body = "";
      const actions = [
        { action: "scroll", label: "Перейти к месту", tier: "primary", argKind: sel.kind, argId: sel.id },
        { action: "copy-link", label: "Скопировать ссылку", tier: "primary", argKind: sel.kind, argId: sel.id }
      ];

      if (sel.kind === "system") {
        body = renderInspectorSystem(found.data, q, actions);
      } else if (sel.kind === "era") {
        body = renderInspectorEra(found.data, q, actions);
      } else if (sel.kind === "systemProgression") {
        body = renderInspectorSystemProgression(found.data, q, actions);
      } else if (["resource", "research", "technology", "enterprise"].includes(sel.kind)) {
        body = renderInspectorCatalogItem(found.data, sel.kind, q, actions);
      } else if (sel.kind === "bridge") {
        body = renderInspectorBridge(sel.id, found.data, q, actions);
      } else if (sel.kind === "roadmap") {
        body = renderInspectorRoadmap(found.data, q, actions);
      } else if (sel.kind === "transition") {
        body = renderInspectorTransition(found.data, q, actions);
      } else if (sel.kind === "prototype") {
        body = renderInspectorPrototype(found.data, q, actions);
      } else if (sel.kind === "dependency") {
        body = renderInspectorDependency(found.data, q, actions);
      } else if (sel.kind === "uiScreen") {
        body = renderInspectorUiScreen(found.data, q, actions);
      } else {
        body = `<p class="entity-inspector-muted">Тип «${escapeHtml(sel.kind)}» пока без детального шаблона.</p>`;
      }

      panel.innerHTML = `<div class="entity-inspector-head">
          <h3 class="dashboard-panel-title entity-inspector-title">Инспектор объекта</h3>
          <button type="button" class="entity-inspector-clear-btn" id="btn-clear-system-focus" title="Сбросить выбор" aria-label="Сбросить выбор">Сбросить выбор</button>
        </div>
        <div class="entity-inspector-badges">
          <span class="entity-kind-badge entity-kind-badge--${escapeHtml(entityKindClass(sel.kind))}">${escapeHtml(kindLabel)}</span>
          ${statusBadge}
        </div>
        ${body}
        ${renderActions(sel, actions)}`;
    }

    function renderInspectorSystem(s, q, actions) {
      actions.push(
        { action: "select", label: "Магистраль", tier: "primary", argKind: "system", argId: s.id },
        { action: "anchor", label: "Карточка", tier: "context", anchor: `#core-system-card-${s.id}` },
        { action: "anchor", label: "Сквозная линия", tier: "context", anchor: `#system-progression-${s.id}` }
      );
      const titleMap = buildSystemTitleMap(architecture.systems);
      const rs = s.relatedSystems || [];
      const relInner = rs.length
        ? `<ul class="entity-inspector-rel">${rs
            .map((r) => {
              const tl = titleMap.get(r.systemId) || r.systemId;
              return `<li><span class="entity-rel-type">${escapeHtml(r.relation)}</span> ${renderEntityChip("system", r.systemId, tl)}<div class="entity-rel-note">${highlightPlain(String(r.note || ""), q)}</div></li>`;
            })
            .join("")}</ul>`
        : "";
      const deps = dependenciesTouchingSystem(s.id);
      const depInner =
        deps.requires.length || deps.enables.length
          ? `<p class="entity-inspector-subhead">Зависимости (слой)</p><ul class="entity-inspector-rel">${renderDepRows(deps.requires, q)}${renderDepRows(deps.enables, q)}</ul>`
          : "";
      const prog = (architecture.systemProgression || []).find((e) => e && e.systemId === s.id);
      const cat = catalogItemsForSystem(s.id);
      const catChips = Object.keys(cat)
        .flatMap((k) => cat[k].slice(0, 8).map((it) => renderEntityChip(k, it.id, it.title)))
        .join("");
      if (cat.resource.length)
        actions.push({
          action: "catalog-system",
          label: "Ресурсы",
          tier: "context",
          argId: s.id,
          kinds: "resource"
        });
      if (cat.technology.length || cat.research.length)
        actions.push({
          action: "catalog-system",
          label: "Технологии",
          tier: "context",
          argId: s.id,
          kinds: "research,technology"
        });
      const protoHits = prototypeModulesForSystem(s.id);
      const links = renderUnifiedLinksSection([
        relInner,
        depInner,
        catChips ? `<p class="entity-inspector-subhead">Каталог</p><div class="entity-chip-row">${catChips}</div>` : ""
      ]);
      const edgePartner = state.mainlineEdgePartner;
      const edgeKind = state.mainlineEdgeKind;
      const edgeBlock =
        edgePartner && getSystemById(edgePartner)
          ? `<p class="entity-inspector-edge-pair"><strong>Связь на схеме:</strong> ${renderEntityChip("system", s.id, s.title)} → ${renderEntityChip("system", edgePartner, getSystemById(edgePartner).title || edgePartner)}${edgeKind ? ` <span class="entity-rel-type">${escapeHtml(dependencyTypeLabels[edgeKind] || edgeKind)}</span>` : ""}</p>`
          : "";
      const main = renderInspectorFactBlock("Главное", [
        { label: "Эпохи", value: `${renderEntityChip("era", s.appearsIn, s.appearsIn)} → ${renderEntityChip("era", s.becomesCoreIn, s.becomesCoreIn)}` },
        { label: "Категория", value: escapeHtml(s.category || "") },
        { label: "Роль", value: highlightPlain(String(s.roleInGame || ""), q) },
        { label: "Сквозная линия", value: prog ? renderEntityChip("systemProgression", s.id, prog.title) : "" }
      ]);
      return `
        <div class="entity-inspector-card">
          ${edgeBlock}
          <h4 class="entity-inspector-name">${markInEscaped(escapeHtml(s.title), q)}</h4>
          <p class="entity-inspector-id"><code>${escapeHtml(s.id)}</code> · ${escapeHtml(s.category || "")}</p>
          <p class="entity-inspector-sum">${highlightPlain(String(s.summary || ""), q)}</p>
          ${main}
          ${links}
          ${renderPrototypeBlock(protoHits, q, { limit: 6 })}
        </div>`;
    }

    function renderInspectorEra(era, q, actions) {
      actions.push({ action: "anchor", label: "Карточка эпохи", tier: "primary", anchor: `#era-${era.id}` });
      actions.push({ action: "select", label: "Переход", tier: "context", argKind: "transition", argId: era.id });
      actions.push({ action: "catalog-era", label: "Каталог эпохи", tier: "context", argId: era.id });
      actions.push({ action: "related-systems", label: "Системы", tier: "context", argKind: "era", argId: era.id });
      const bridges = bridgeKeysForEra(era.id);
      const t = era.transition || {};
      const prog = transitionChecklistProgress(era.id);
      const pm = prototypeRowForEra(era.id);
      const cat = catalogItemsForEra(era.id);
      const catChips = Object.keys(cat)
        .flatMap((k) => cat[k].slice(0, 8).map((it) => renderEntityChip(k, it.id, it.title)))
        .join("");
      const pts = era.playerTimeShare ? playerTimeShareLabelsRu[era.playerTimeShare] || era.playerTimeShare : "—";
      const protoHits = pm
        ? (pm.modules || []).map((mod) => ({ eraId: pm.eraId, module: mod, eraRow: pm }))
        : [];
      const main = renderInspectorFactBlock("Главное", [
        { label: "Диапазон", value: escapeHtml(era.dates || "") },
        { label: "Роль", value: escapeHtml(roleLabelsRu[era.role] || era.role || "") },
        { label: "Вес", value: escapeHtml(designWeightLabelsRu[era.designWeight] || era.designWeight || "") },
        { label: "Плотность", value: escapeHtml(era.gameplayDensity || "") },
        { label: "Доля времени", value: escapeHtml(pts) },
        { label: "Чеклист", value: prog.total ? `${prog.done}/${prog.total}` : "" }
      ]);
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${markInEscaped(escapeHtml(era.title), q)}</h4>
          <p class="entity-inspector-id"><code>${escapeHtml(era.id)}</code> · ${escapeHtml(era.dates || "")}</p>
          <p class="entity-inspector-sum">${highlightPlain(String(era.summary || ""), q)}</p>
          ${main}
          <p class="entity-inspector-meta">${highlightPlain(String(era.contentGuideline || ""), q)}</p>
          ${t.condition ? `<p><strong>Переход → ${escapeHtml(t.to || "—")}:</strong> ${highlightPlain(String(t.condition), q)}</p>` : ""}
          ${bridges.length ? `<p><strong>Мост:</strong> ${bridges.map((k) => renderEntityChip("bridge", k, k.replace(/_/g, "→"))).join(" ")}</p>` : ""}
          ${eraSystemsInspectorBlock(era, q)}
          ${catChips ? `<details class="entity-inspector-section" open><summary class="entity-inspector-section-sum">Каталог в эпохе</summary><div class="entity-chip-row">${catChips}</div></details>` : ""}
          ${pm ? `<p><strong>Прототип (эпоха):</strong> ${escapeHtml(pm.summary || "")}</p>` : ""}
          ${renderPrototypeBlock(protoHits, q, { limit: 6 })}
        </div>`;
    }

    function renderInspectorCatalogItem(item, kind, q, actions) {
      const prefix = catalogKindPrefix(kind);
      actions.push({
        action: "anchor",
        label: "В каталоге",
        tier: "primary",
        anchor: `#game-${prefix}-${item.id}`
      });
      actions.push({ action: "select", label: `Эпоха ${item.eraFrom}`, tier: "context", argKind: "era", argId: item.eraFrom });
      actions.push({ action: "anchor", label: "Зависимости", tier: "context", anchor: "#section-dependencies" });
      if (item.requires && item.requires.length)
        actions.push({ action: "inspector-focus", label: "Требования", tier: "context", field: "requires" });
      if (item.unlocks && item.unlocks.length)
        actions.push({ action: "inspector-focus", label: "Открывает", tier: "context", field: "unlocks" });
      if (kind === "resource" || kind === "research" || kind === "technology" || kind === "enterprise")
        actions.push({ action: "anchor", label: "Прототип", tier: "context", anchor: "#prototype-dash-panel" });
      const sysIds = resolveCatalogSystemIds(item, prefix);
      const sysChips = sysIds.map((sid) => {
        const sys = getSystemById(sid);
        return renderEntityChip("system", sid, sys ? sys.title : sid);
      }).join("");
      const depHits = dependenciesTouchingCatalogItem(item, sysIds);
      const depInner = depHits.length
        ? `<ul class="entity-inspector-rel">${renderDepRows(depHits, q)}</ul>`
        : "";
      const reqBy = requiredByForCatalogItem(item);
      const reqByChips = reqBy.length
        ? `<p class="entity-inspector-subhead">Требуется для</p><div class="entity-chip-row">${reqBy
            .map((h) => renderEntityChip(h.kind, h.item.id, h.item.title))
            .join("")}</div>`
        : "";
      const extraKind =
        kind === "research" || kind === "technology"
          ? renderStringList("Связанные ресурсы", item.relatedResources, q) +
            renderStringList("Связанные постройки", item.relatedBuildings, q) +
            renderStringList("Связанные предприятия", item.relatedEnterprises, q)
          : kind === "enterprise"
            ? renderStringList("Требует ресурсы", item.requiresResources, q) +
              renderStringList("Требует труд", item.requiresLabor, q) +
              renderStringList("Производит", item.produces, q) +
              renderStringList("Хранит", item.stores, q) +
              renderStringList("Занятость", item.employs, q) +
              renderStringList("Апгрейд до", item.upgradesTo, q)
            : "";
      const links = renderUnifiedLinksSection([
        sysChips ? `<div class="entity-chip-row">${sysChips}</div>` : "",
        depInner,
        reqByChips,
        renderStringList("Требует", item.requires, q, "requires"),
        renderStringList("Открывает", item.unlocks, q, "unlocks"),
        renderStringList("Используется в", item.usedIn, q)
      ]);
      const passport = renderCatalogPassportBlock(item);
      const main = renderInspectorFactBlock("Главное", [
        { label: "Эпохи", value: `${renderEntityChip("era", item.eraFrom, item.eraFrom)} – ${renderEntityChip("era", item.eraTo, item.eraTo)}` },
        { label: "Системы", value: sysChips },
        { label: "Тип", value: escapeHtml(item.category || item.type || "") },
        { label: "Доступность", value: item.availabilityCondition ? highlightPlain(String(item.availabilityCondition), q) : "" }
      ]);
      const protoHits = prototypeModulesForSystems(sysIds);
      const detailsInner = [
        renderStringList("Производится", item.producedBy, q),
        renderStringList("Хранится в", item.storedIn, q),
        renderStringList("Транспорт", item.transportedBy, q),
        renderStringList("Риски", item.riskNotes, q),
        extraKind
      ]
        .filter(Boolean)
        .join("");
      const details = detailsInner
        ? `<details class="entity-inspector-section"><summary class="entity-inspector-section-sum">Детали</summary>${detailsInner}</details>`
        : "";
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${markInEscaped(escapeHtml(item.title), q)}</h4>
          <p class="entity-inspector-id"><code>${escapeHtml(item.id)}</code>${item.category ? ` · ${escapeHtml(item.category)}` : item.type ? ` · ${escapeHtml(item.type)}` : ""}</p>
          <p class="entity-inspector-sum">${highlightPlain(String(item.summary || ""), q)}</p>
          ${main}
          ${links}
          ${passport}
          ${item.requiredBy && item.requiredBy.length ? renderStringList("Требуется для (data)", item.requiredBy, q, "requiredBy") : ""}
          ${details}
          ${renderPrototypeBlock(protoHits, q, {
            directRefs: item.prototypeRefs,
            limit: 6,
            suggestion: "Подсказка: добавить prototypeRefs или связать сущность через prototypeMapping."
          })}
        </div>`;
    }

    function renderInspectorSystemProgression(entry, q, actions) {
      actions.push({ action: "select", label: "Показать систему", argKind: "system", argId: entry.systemId });
      actions.push({ action: "anchor", label: "Карточка сквозной линии", anchor: `#system-progression-${entry.systemId}` });
      const titleMap = buildSystemTitleMap(architecture.systems);
      const relInner =
        Array.isArray(entry.relatedSystems) && entry.relatedSystems.length
          ? `<ul class="entity-inspector-rel">${entry.relatedSystems
              .map((r) => {
                const tl = titleMap.get(r.systemId) || r.systemId;
                return `<li><span class="entity-rel-type">${escapeHtml(r.relation)}</span> ${renderEntityChip("system", r.systemId, tl)}<div class="entity-rel-note">${highlightPlain(String(r.note || ""), q)}</div></li>`;
              })
              .join("")}</ul>`
          : "";
      const eraSample = ERA_ORDER.filter((eid) => entry.byEra && entry.byEra[eid] && String(entry.byEra[eid]).trim())
        .slice(0, 3)
        .map((eid) => `<li><strong>${escapeHtml(eid)}:</strong> ${highlightPlain(truncateText(entry.byEra[eid], 100), q)}</li>`)
        .join("");
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${markInEscaped(escapeHtml(entry.title), q)}</h4>
          <p class="entity-inspector-id"><code>${escapeHtml(entry.systemId)}</code></p>
          ${createStatusPill(entry.status)}
          <p class="entity-inspector-sum">${highlightPlain(String(entry.summary || ""), q)}</p>
          <p>${renderEntityChip("system", entry.systemId, "Система " + entry.systemId)}</p>
          ${relInner ? renderUnifiedLinksSection([relInner]) : ""}
          ${eraSample ? `<details class="entity-inspector-section"><summary class="entity-inspector-section-sum">Линия по эпохам (фрагмент)</summary><ul class="entity-inspector-list">${eraSample}</ul></details>` : ""}
        </div>`;
    }

    function renderInspectorBridge(key, block, q, actions) {
      actions.push({
        action: "anchor",
        label: "Панель моста",
        anchor: "#bridge-panel-b-c"
      });
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${escapeHtml(block.title || key)}</h4>
          ${renderBridgeInspectorBody(key, block, q)}
        </div>`;
    }

    function renderInspectorUiScreen(screen, q, actions) {
      actions.push({ action: "anchor", label: "Список UI", tier: "primary", anchor: "#section-screens" });
      if (screen.appearsIn) {
        actions.push({
          action: "select",
          label: `Эпоха ${screen.appearsIn}`,
          tier: "context",
          argKind: "era",
          argId: screen.appearsIn
        });
      }
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${markInEscaped(escapeHtml(screen.title), q)}</h4>
          <p class="entity-inspector-id"><code>${escapeHtml(screen.id)}</code></p>
          ${createStatusPill(screen.status)}
          <p class="entity-inspector-sum">${highlightPlain(String(screen.summary || ""), q)}</p>
          <p><strong>Появление:</strong> ${renderEntityChip("era", screen.appearsIn, screen.appearsIn)}</p>
        </div>`;
    }

    function renderInspectorRoadmap(item, q, actions) {
      actions.push({ action: "anchor", label: "Roadmap", tier: "context", anchor: "#section-roadmap" });
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${markInEscaped(escapeHtml(item.title), q)}</h4>
          <p class="entity-inspector-id"><code>${escapeHtml(item.id)}</code></p>
          ${createStatusPill(item.status)}
          <p class="entity-inspector-sum">${highlightPlain(String(item.summary || ""), q)}</p>
          ${renderStringList("Чеклист", item.checklist, q)}
        </div>`;
    }

    function renderInspectorTransition(payload, q, actions) {
      const era = payload.era;
      const t = payload.transition;
      actions.push({ action: "select", label: "Эпоха «откуда»", argKind: "era", argId: era.id });
      if (t.to) actions.push({ action: "select", label: "Эпоха «куда»", argKind: "era", argId: t.to });
      actions.push({ action: "anchor", label: "Карточка на шкале", anchor: `#era-${era.id}` });
      const bridges = bridgeKeysForEra(era.id);
      const prog = transitionChecklistProgress(era.id);
      const doneMap = getTransitionChecklistDone(era.id);
      const checklist = (t.checklist || [])
        .map((c, i) => `<li class="${doneMap[String(i)] ? "is-done" : ""}">${highlightPlain(c, q)}</li>`)
        .join("");
      const roadmapHits = roadmapItemsForTransition(era.id, t.to);
      const roadmapChips = roadmapHits.map((r) => renderEntityChip("roadmap", r.id, r.title)).join("");
      const pm = prototypeRowForEra(era.id);
      const protoHits = pm
        ? (pm.modules || []).map((mod) => ({ eraId: pm.eraId, module: mod, eraRow: pm }))
        : [];
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${escapeHtml(era.id)} → ${escapeHtml(t.to || "—")}</h4>
          <p class="entity-inspector-id">${escapeHtml(era.title || "")}</p>
          ${prog.total ? `<p><strong>Чеклист (браузер):</strong> ${prog.done}/${prog.total}</p>` : ""}
          <p>${highlightPlain(String(t.condition || ""), q)}</p>
          ${checklist ? `<details class="entity-inspector-section" open><summary class="entity-inspector-section-sum">Чеклист перехода</summary><ul class="entity-inspector-list">${checklist}</ul></details>` : ""}
          ${renderStringList("Открывает", t.unlocks, q)}
          ${bridges.length ? `<p><strong>Мост:</strong> ${bridges.map((k) => renderEntityChip("bridge", k, k.replace(/_/g, "→"))).join(" ")}</p>` : ""}
          ${roadmapChips ? `<p><strong>Roadmap:</strong> ${roadmapChips}</p>` : ""}
          ${renderPrototypeBlock(protoHits, q)}
        </div>`;
    }

    function renderInspectorPrototype(payload, q, actions) {
      const mod = payload.module;
      const row = payload.eraRow;
      actions.push({ action: "select", label: "Эпоха", argKind: "era", argId: payload.eraId });
      actions.push({ action: "anchor", label: "Таблица прототипа", anchor: "#prototype-dash-panel" });
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${escapeHtml(mod.label || mod.path)}</h4>
          <p class="entity-inspector-id"><code>${escapeHtml(mod.path)}</code></p>
          ${mod.status ? createStatusPill(mod.status) : ""}
          ${mod.note ? `<p class="entity-inspector-sum">${highlightPlain(String(mod.note), q)}</p>` : ""}
          <p><strong>Эпоха карты:</strong> ${renderEntityChip("era", payload.eraId, payload.eraId)}</p>
          ${row && row.summary ? `<p class="entity-inspector-meta">${escapeHtml(row.summary)}</p>` : ""}
          <p><strong>Системы:</strong> ${(mod.systemIds || []).map((sid) => renderEntityChip("system", sid, sid)).join(" ") || "—"}</p>
        </div>`;
    }

    function renderInspectorDependency(d, q, actions) {
      actions.push({ action: "anchor", label: "Слой зависимостей", anchor: "#section-dependencies" });
      actions.push({ action: "select", label: "Система «откуда»", argKind: "system", argId: d.from });
      actions.push({ action: "select", label: "Система «куда»", argKind: "system", argId: d.to });
      const type = dependencyTypeLabels[d.type] || d.type;
      return `
        <div class="entity-inspector-card">
          <h4 class="entity-inspector-name">${escapeHtml(d.from)} → ${escapeHtml(d.to)}</h4>
          <p class="entity-inspector-id"><span class="entity-rel-type">${escapeHtml(type)}</span></p>
          <p class="entity-inspector-sum">${highlightPlain(String(d.description || ""), q)}</p>
          <p>${renderEntityChip("system", d.from, d.from)} → ${renderEntityChip("system", d.to, d.to)}</p>
        </div>`;
    }

    function applyEntityHashFromUrl() {
      const parsed = parseEntityHash(location.hash);
      if (!parsed) return false;
      state.applyingHash = true;
      selectEntity(parsed.kind, parsed.id, { updateHash: false, scroll: true, scrollInspector: true });
      state.applyingHash = false;
      return true;
    }

    function handleEntityActionClick(event) {
      const btn = event.target.closest("[data-entity-action]");
      if (!btn) return false;
      const action = btn.getAttribute("data-entity-action");
      if (action === "clear") {
        clearSelectedEntity();
        clearSystemFocus();
        clearEraFocus();
        return true;
      }
      const kind = btn.getAttribute("data-entity-action-kind");
      const id = btn.getAttribute("data-entity-action-id");
      if (action === "select" && kind && id) {
        selectEntity(kind, id, { scroll: true });
        return true;
      }
      if (action === "scroll" && kind && id) {
        selectEntity(kind, id, { scroll: true });
        return true;
      }
      if (action === "copy-link" && kind && id) {
        copyEntityLink(kind, id, btn);
        return true;
      }
      const anchor = btn.getAttribute("data-entity-action-anchor");
      if (action === "anchor" && anchor) {
        const el = document.querySelector(anchor);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      if (action === "catalog-system") {
        const systemId = btn.getAttribute("data-entity-action-id");
        const kinds = btn.getAttribute("data-entity-action-kinds");
        if (systemId) focusCatalogForSystem(systemId, kinds);
        return true;
      }
      if (action === "catalog-era") {
        const eraId = btn.getAttribute("data-entity-action-id");
        if (eraId) focusCatalogForEra(eraId);
        return true;
      }
      if (action === "related-systems") {
        const rk = btn.getAttribute("data-entity-action-kind");
        const rid = btn.getAttribute("data-entity-action-id");
        if (rk === "system" && rid) {
          selectEntity("system", rid, { scroll: true, scrollInspector: true });
        } else if (rk === "era" && rid) {
          selectEntity("era", rid, { scrollInspector: true, scroll: true });
          openLowerSection("lower-gate-systems");
          document.getElementById("section-core-systems")?.scrollIntoView({ behavior: "smooth", block: "start" });
          syncEntitySelectionDom();
        }
        return true;
      }
      if (action === "inspector-focus") {
        const field = btn.getAttribute("data-entity-action-field");
        const panel = document.getElementById("system-focus-panel");
        const el = field && panel ? panel.querySelector(`#inspector-field-${field}`) : null;
        if (el) {
          if (el.tagName === "DETAILS") el.open = true;
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        return true;
      }
      return false;
    }

    function handleEntitySelectClick(event) {
      if (event.target.closest("[data-stop-card-select]")) {
        event.stopPropagation();
      }
      const el = event.target.closest("[data-entity-select]");
      if (!el) return false;
      event.preventDefault();
      const kind = el.getAttribute("data-entity-select");
      const id = el.getAttribute("data-entity-id");
      if (!kind || !id) return false;
      if (kind === "system" && event.detail === 2) {
        selectEntity(kind, id, { scroll: false, scrollInspector: true });
        scrollToSystem(id);
        const core = document.getElementById("core-system-card-" + id);
        if (core) {
          openLowerSection("lower-gate-systems");
          core.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return true;
      }
      if (kind === "system") {
        state.mainlineEdgePartner = null;
        state.mainlineEdgeKind = null;
        const toggle = state.selectedEntity && state.selectedEntity.kind === "system" && state.selectedEntity.id === id;
        if (toggle && !event.shiftKey) {
          clearSelectedEntity();
          clearSystemFocus();
          return true;
        }
      }
      const onMainline = el.hasAttribute("data-mainline-system");
      selectEntity(kind, id, {
        scroll: kind !== "system" || onMainline,
        scrollInspector: true
      });
      return true;
    }


    function renderInteractiveTransitionChecklist(era, query) {
      const ch = era.transition && Array.isArray(era.transition.checklist) ? era.transition.checklist : [];
      if (!ch.length) return "";
      const doneMap = getTransitionChecklistDone(era.id);
      const prog = transitionChecklistProgress(era.id);
      const items = ch
        .map((text, i) => {
          const on = !!doneMap[String(i)];
          return `<li class="transition-check-item${on ? " is-done" : ""}">
            <label class="transition-check-label">
              <input type="checkbox" class="transition-check-input" data-transition-era="${escapeHtml(era.id)}" data-transition-idx="${i}"${on ? " checked" : ""} />
              <span>${highlightPlain(text, query)}</span>
            </label>
          </li>`;
        })
        .join("");
      return `<div class="transition-checklist-wrap transition-checklist-wrap--interactive">
        <p class="transition-checklist-heading">Чеклист перехода <span class="transition-checklist-progress">${prog.done}/${prog.total}</span></p>
        <ul class="transition-checklist">${items}</ul>
        <p class="transition-checklist-hint">Отметки сохраняются в браузере (проектный прогресс, не статус прототипа).</p>
      </div>`;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function escapeRegExp(s) {
      return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /** Подсветка первого вхождения запроса в уже экранированной строке (безопасно). */
    function markInEscaped(escaped, query) {
      const q = String(query || "").trim();
      if (!q || !escaped) return escaped;
      const qLower = q.toLowerCase();
      const lowerEsc = escaped.toLowerCase();
      const idx = lowerEsc.indexOf(qLower);
      if (idx < 0) return escaped;
      for (let end = idx + 1; end <= escaped.length; end++) {
        if (escaped.slice(idx, end).toLowerCase() === qLower) {
          return (
            escaped.slice(0, idx) +
            "<mark class=\"search-hit\">" +
            escaped.slice(idx, end) +
            "</mark>" +
            escaped.slice(end)
          );
        }
      }
      return escaped;
    }

    function highlightPlain(text, query) {
      return markInEscaped(escapeHtml(text), query);
    }

    function includesText(item, query) {
      if (!query) return true;
      return JSON.stringify(item).toLowerCase().includes(query.toLowerCase());
    }

    function isEraVisible(era) {
      const byEraGroup = !state.visibleEraIds || state.visibleEraIds.includes(era.id);
      const byStatus = state.status === "all" || era.status === state.status;
      const byWeight = state.designWeight === "all" || era.designWeight === state.designWeight;
      const bySearch = includesText(era, state.search);
      return byEraGroup && byStatus && byWeight && bySearch;
    }

    function eraSearchMatch(era) {
      return !!(state.search && includesText(era, state.search));
    }

    function timelineFlexGrow(era) {
      const span = era.timelineSpanYears;
      if (!span || span.from == null || span.to == null) return 1;
      const w = span.to - span.from;
      return Math.max(1, w);
    }

    /** Доля заполнения обязательной структуры в data.js (не «больше целей — лучше»). */
    function computeEraCompleteness(era) {
      let filled = 0;
      let total = 0;
      const bump = (ok) => {
        total += 1;
        if (ok) filled += 1;
      };
      bump((era.periods || []).length > 0);
      bump(!!(era.transition && String(era.transition.condition || "").trim()));
      bump(!!String(era.role || "").trim());
      bump(!!String(era.designWeight || "").trim());
      bump(!!String(era.gameplayDensity || "").trim());
      bump(!!String(era.playerTimeShare || "").trim());
      bump(!!String(era.contentGuideline || "").trim());
      const cl = era.transition && era.transition.checklist;
      bump(Array.isArray(cl) && cl.length > 0 && cl.every((x) => String(x || "").trim()));
      eraSystemKeys.forEach((key) => {
        total += 1;
        const v = era.systems && era.systems[key];
        if (v && String(v).trim()) filled += 1;
      });
      return { filled, total };
    }

    function eraMetaBadgesHtml(era) {
      const r = roleLabelsRu[era.role] || era.role || "—";
      const dw = designWeightLabelsRu[era.designWeight] || era.designWeight || "—";
      const gd = gameplayDensityLabelsRu[era.gameplayDensity] || era.gameplayDensity || "—";
      const pts = playerTimeShareLabelsRu[era.playerTimeShare] || era.playerTimeShare || "—";
      return `
        <div class="era-meta-badges" aria-label="Проектные метки эпохи">
          <span class="era-metric" title="Роль: ${escapeHtml(r)}">${escapeHtml(r)}</span>
          <span class="era-metric" title="Вес дизайна: ${escapeHtml(dw)}">${escapeHtml(dw)}</span>
          <span class="era-metric" title="Плотность решений: ${escapeHtml(gd)}">${escapeHtml(gd)}</span>
          <span class="era-metric" title="Доля игрового времени: ${escapeHtml(pts)}">${escapeHtml(pts)}</span>
        </div>`;
    }

    function matrixActiveEraIdSet(eras, systemId) {
      if (!systemId) return new Set();
      const sys = architecture.systems.find((s) => s.id === systemId);
      if (!sys) return new Set();
      return new Set(
        eras.filter((e) => systemPhase(sys, e.id).level !== "lvl0").map((e) => e.id)
      );
    }
    function systemPhase(system, eraId) {
      if (eraId < system.appearsIn) {
        return { level: "lvl0", label: "—", note: "еще не появляется" };
      }
      if (eraId === system.appearsIn && eraId === system.becomesCoreIn) {
        return { level: "lvl3", label: "ядро", note: system.status };
      }
      if (eraId === system.appearsIn) {
        return { level: "lvl1", label: "появляется", note: system.status };
      }
      if (eraId < system.becomesCoreIn) {
        return { level: "lvl2", label: "развивается", note: system.status };
      }
      return { level: "lvl3", label: "ключевая", note: system.status };
    }

    function createStatusPill(status) {
      return `<span class="status-pill">${escapeHtml(statusLabels[status] || status)}</span>`;
    }

    function renderListHtml(items, query) {
      if (!items || !items.length) return "";
      return `<ul class="era-bullets">${items.map((t) => `<li>${highlightPlain(t, query)}</li>`).join("")}</ul>`;
    }

    function renderDetailsSection(title, innerHtml, options) {
      if (!innerHtml || !String(innerHtml).trim()) return "";
      const open = options.open ? " open" : "";
      return `<details class="era-sec"${open}><summary class="era-sec-sum">${escapeHtml(title)}</summary><div class="era-sec-body">${innerHtml}</div></details>`;
    }

    function renderTransitionBlock(era, query) {
      const t = era.transition || {};
      const unlocks = (t.unlocks || []).map((u) => highlightPlain(u, query)).join(", ") || "—";
      const checklistBlock = renderInteractiveTransitionChecklist(era, query);
      const toLabel = t.to == null || t.to === "" ? "нет (конец шкалы A–K)" : String(t.to);
      const inner = `
        <p><strong>К ${escapeHtml(toLabel)}:</strong> ${highlightPlain(t.condition || "", query)}</p>
        <p><strong>Открывает:</strong> ${unlocks}</p>
        ${checklistBlock}
      `;
      return inner;
    }

    function renderEraCard(era, opts) {
      opts = opts || {};
      const forceExpanded = !!opts.forceExpanded;
      const inInspector = !!opts.inInspector;
      const query = state.search;
      const compact = !forceExpanded && state.viewMode === "compact";
      const balanced = !forceExpanded && state.viewMode === "balanced";
      const periodsOpen = forceExpanded || (!state.periodsCollapsed && !compact);
      const transOpen = forceExpanded || balanced || state.viewMode === "detailed";
      const secOpen = forceExpanded || balanced || state.viewMode === "detailed";

      const matchClass = eraSearchMatch(era) ? " is-search-match" : "";

      const goals = era.goals;
      const events = era.events;
      const discoveries = era.discoveries;
      const limits = era.limits;

      const periodsInner = (era.periods || [])
        .map(
          (p) => `
        <div class="period-line" id="era-${escapeHtml(era.id)}-period-${escapeHtml(p.id)}">
          <strong>${highlightPlain(p.id, query)}:</strong> ${highlightPlain(p.title, query)} · ${highlightPlain(p.dates, query)}
          <div class="period-sum">${highlightPlain(p.summary, query)}</div>
        </div>`
        )
        .join("");

      const systemRows = eraSystemKeys
        .map((key) => {
          const val = era.systems && era.systems[key];
          if (!val) return "";
          return `
            <div class="era-row">
              <b>${escapeHtml(systemRowLabels[key] || key)}</b>
              <span>${highlightPlain(val, query)}</span>
            </div>`;
        })
        .join("");

      const transitionInner = renderTransitionBlock(era, query);

      const principleInner =
        era.contentGuideline && String(era.contentGuideline).trim()
          ? `<p class="principle-text">${highlightPlain(era.contentGuideline.trim(), query)}</p>`
          : "";
      const principleOpen =
        forceExpanded ||
        balanced ||
        era.role === "bridge" ||
        era.role === "tutorial" ||
        state.viewMode === "detailed";
      const principleSection = principleInner
        ? renderDetailsSection("Принцип наполнения", principleInner, { open: principleOpen })
        : "";

      const comp = computeEraCompleteness(era);
      const compPct = comp.total ? Math.round((100 * comp.filled) / comp.total) : 0;
      const spanNote =
        era.timelineSpanYears && era.timelineSpanYears.note
          ? ` <abbr class="timeline-span-note" title="${escapeHtml(era.timelineSpanYears.note)}">*</abbr>`
          : "";
      const flexGrow = timelineFlexGrow(era);

      let bodyHtml = "";

      if (compact) {
        bodyHtml += renderDetailsSection(
          `Периоды (${(era.periods || []).length})`,
          periodsInner,
          { open: false }
        );
        bodyHtml += principleSection;
        if (goals && goals.length)
          bodyHtml += renderDetailsSection(`Цели (${goals.length})`, renderListHtml(goals, query), { open: false });
        if (limits && limits.length)
          bodyHtml += renderDetailsSection(`Ограничения (${limits.length})`, renderListHtml(limits, query), {
            open: false
          });
        bodyHtml += renderDetailsSection("Переход", transitionInner, { open: false });
      } else {
        bodyHtml += renderDetailsSection(`Периоды (${(era.periods || []).length})`, periodsInner, {
          open: periodsOpen
        });
        bodyHtml += principleSection;
        if (goals && goals.length)
          bodyHtml += renderDetailsSection("Цели", renderListHtml(goals, query), { open: secOpen });
        if (events && events.length)
          bodyHtml += renderDetailsSection("События", renderListHtml(events, query), { open: secOpen });
        if (discoveries && discoveries.length)
          bodyHtml += renderDetailsSection("Открытия", renderListHtml(discoveries, query), { open: secOpen });
        if (limits && limits.length)
          bodyHtml += renderDetailsSection("Ограничения", renderListHtml(limits, query), { open: secOpen });
        if (systemRows.trim())
          bodyHtml += renderDetailsSection("Системы", `<div class="era-list">${systemRows}</div>`, { open: secOpen });
        bodyHtml += renderDetailsSection("Переход", transitionInner, { open: transOpen });
      }

      const paceHtml = compact && !forceExpanded
        ? ""
        : `<div class="pace"><strong>Темп:</strong> ${highlightPlain(era.timePace || "", query)}</div>`;

      const completenessHtml = compact && !forceExpanded
        ? ""
        : `<div class="era-completeness" title="Чеклист обязательной структуры в data.js: периоды, проектные поля эпохи, условие перехода, непустой чеклист перехода, заполненные слои systems. Не оценка «чем больше целей/событий — тем лучше».">
            <span class="era-completeness-label">Полнота структуры</span>
            <span class="era-completeness-bar" aria-hidden="true"><i style="width:${compPct}%"></i></span>
            <span class="era-completeness-num">${comp.filled}/${comp.total}</span>
          </div>`;

      const dw = era.designWeight && String(era.designWeight).trim() ? String(era.designWeight).trim() : "medium";
      const counts = eraContentCounts(era);
      const tc = transitionChecklistProgress(era.id);
      const inspectorHero = inInspector
        ? `<header class="era-inspector-hero">
            <span class="era-inspector-hero-icon" aria-hidden="true">${ERA_ICONS[era.id] || "•"}</span>
            <div class="era-inspector-hero-text">
              <p class="era-inspector-hero-dates">${highlightPlain(era.dates, query)}${spanNote}</p>
              <p class="era-inspector-hero-sum">${highlightPlain(era.summary, query)}</p>
            </div>
            <div class="era-inspector-hero-stats">
              ${counts.periods ? `<span class="era-chip">${counts.periods} пер.</span>` : ""}
              ${counts.goals ? `<span class="era-chip">${counts.goals} целей</span>` : ""}
              ${tc.total ? `<span class="era-chip era-chip--check">✓ ${tc.done}/${tc.total}</span>` : ""}
            </div>
          </header>`
        : "";
      const toolbarHtml = inInspector
        ? ""
        : `<div class="era-card-toolbar">
            <button type="button" class="era-card-action" data-era-focus="${escapeHtml(era.id)}">Фокус</button>
            <button type="button" class="era-card-action" data-era-scroll="${escapeHtml(era.id)}">Шкала</button>
          </div>`;
      const titleHtml = inInspector
        ? ""
        : `<button type="button" class="era-title-btn entity-link" data-era-focus="${escapeHtml(era.id)}" data-entity-select="era" data-entity-id="${escapeHtml(era.id)}">
            <h3 class="era-title"><span class="era-code">${highlightPlain(era.id, query)}</span>${highlightPlain(era.title, query)}</h3>
          </button>`;

      return `
        <article class="era-card searchable era-card--interactive entity-link-card${inInspector ? " era-card--inspector" : ""} era-weight-${escapeHtml(dw)}${compact ? " is-compact" : ""}${balanced ? " is-balanced" : ""}${forceExpanded ? " is-expanded" : ""}${matchClass}" id="era-${escapeHtml(era.id)}" data-era-id="${escapeHtml(era.id)}"${inInspector ? "" : ` tabindex="0" data-entity-select="era" data-entity-id="${escapeHtml(era.id)}"`} data-status="${escapeHtml(era.status)}" data-design-weight="${escapeHtml(dw)}" style="--era-color: ${eraColors[era.id] || "var(--blue)"}; flex: ${flexGrow} 1 220px">
          ${inInspector ? "" : '<div class="era-dot"></div>'}
          ${inspectorHero}
          ${toolbarHtml}
          ${titleHtml}
          ${inInspector ? "" : `<p class="era-dates">${highlightPlain(era.dates, query)}${spanNote}</p>`}
          ${eraMetaBadgesHtml(era)}
          ${createStatusPill(era.status)}
          ${completenessHtml}
          ${inInspector ? "" : `<p class="summary">${highlightPlain(era.summary, query)}</p>`}
          ${renderEraDigestHtml(era, query, { compact: inInspector ? false : compact })}
          <div class="era-sections">${bodyHtml}</div>
          ${paceHtml}
        </article>`;
    }

    // --- Render: header / meta ---
    function renderMeta() {
      document.title = architecture.meta.title;
      document.getElementById("map-title").textContent = architecture.meta.title;
      document.getElementById("map-description").textContent = architecture.meta.description;
      document.getElementById("map-version").textContent = `v${architecture.meta.version} · обновлено ${architecture.meta.updatedAt}`;
      const footerMeta = document.getElementById("architecture-footer-meta");
      if (footerMeta) {
        const eras = (architecture.eras || []).length;
        const systems = (architecture.systems || []).length;
        const deps = (architecture.dependencies || []).length;
        footerMeta.textContent = `Схема v${architecture.meta.version} · ${eras} эпох · ${systems} систем · ${deps} связей · валидатор: node tools/validate-architecture-map.mjs`;
      }
    }

    function renderStatusFilter() {
      const select = document.getElementById("status-filter");
      const statuses = [
        ...new Set([
          ...architecture.eras.map((era) => era.status),
          ...architecture.systems.map((system) => system.status),
          ...(architecture.systemProgression || []).map((p) => p.status),
          ...architecture.roadmap.map((item) => item.status),
          ...(architecture.gameResources || []).map((x) => x.status),
          ...(architecture.gameResearch || []).map((x) => x.status),
          ...(architecture.gameTechnologies || []).map((x) => x.status),
          ...(architecture.gameEnterprises || []).map((x) => x.status),
          ...(architecture.gameCatalog && architecture.gameCatalog.status ? [architecture.gameCatalog.status] : [])
        ])
      ];
      while (select.options.length > 1) select.remove(1);
      statuses.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = statusLabels[status] || status;
        select.append(option);
      });
    }

    function renderLegend() {
      const legend = document.getElementById("status-legend");
      legend.innerHTML = Object.entries(statusLabels)
        .map(
          ([status, label]) =>
            `<span><i class="dot" style="background: ${statusColors[status]}"></i>${escapeHtml(label)}</span>`
        )
        .join("");
    }

    function renderSidebarNav() {
      const nav = document.getElementById("architecture-sidebar-nav");
      if (!nav) return;
      nav.innerHTML = SIDEBAR_NAV.map(([href, label, icon, lower]) => {
        const lowerAttr = lower ? ` data-lower-section="${escapeHtml(lower)}"` : "";
        return `<a class="architecture-sidebar-link" href="${escapeHtml(href)}"${lowerAttr}><span class="sidebar-link-icon" aria-hidden="true">${icon}</span><span class="sidebar-link-text">${escapeHtml(label)}</span></a>`;
      }).join("");
    }

    function renderSidebarStats() {
      const el = document.getElementById("sidebar-stats");
      if (!el) return;
      const eras = architecture.eras || [];
      const systems = architecture.systems || [];
      const deps = architecture.dependencies || [];
      const sp = architecture.systemProgression || [];
      let goals = 0;
      let events = 0;
      for (const e of eras) {
        if (e && Array.isArray(e.goals)) goals += e.goals.length;
        if (e && Array.isArray(e.events)) events += e.events.length;
      }
      const rows = [
        ["⏳", "Эпох", String(eras.length)],
        ["◎", "Систем", String(systems.length)],
        ["🔗", "Связей", String(deps.length)],
        ["↔", "Сквозных", String(sp.length)],
        ["🎯", "Целей", String(goals)],
        ["⚡", "Событий", String(events)]
      ];
      el.innerHTML = rows
        .map(
          ([icon, k, v]) =>
            `<div class="sidebar-stat-card"><span class="sidebar-stat-icon" aria-hidden="true">${icon}</span><div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div></div>`
        )
        .join("");
    }

    function openLowerGate(open) {
      const gate = document.getElementById("architecture-lower-gate");
      if (!gate) return;
      gate.open = open !== false;
      state.lowerGateOpen = gate.open;
      syncLowerGateButton();
    }

    function openLowerSection(sectionId) {
      openLowerGate(true);
      if (sectionId) {
        const sec = document.getElementById(sectionId);
        if (sec) sec.open = true;
      }
    }

    function openAllLowerSections(open) {
      ["lower-gate-timeline", "lower-gate-systems", "lower-gate-catalog"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.open = !!open;
      });
    }

    function syncLowerGateButton() {
      const btn = document.getElementById("btn-toggle-lower-gate");
      const gate = document.getElementById("architecture-lower-gate");
      if (!btn || !gate) return;
      btn.classList.toggle("is-active", gate.open);
      btn.textContent = gate.open ? "Скрыть подробные разделы" : "Подробные разделы";
    }

    function expandAllEraDetailSections() {
      state.periodsCollapsed = false;
      document
        .querySelectorAll("#timeline-grid details.era-sec, #era-inspector-root details.era-sec")
        .forEach((d) => {
          d.open = true;
        });
    }

    function resolveFocusedEraId() {
      const hash = (location.hash || "").replace(/^#/, "");
      const em = /^era-([A-K])$/i.exec(hash);
      return state.focusedEraId || (em ? em[1].toUpperCase() : null);
    }

    function openPeriodSection(eraId, periodId) {
      if (!eraId || !periodId) return;
      openLowerSection("lower-gate-timeline");
      scrollToEra(eraId);
      requestAnimationFrame(() => {
        const card = document.getElementById(`era-${eraId}`);
        if (!card) return;
        card.querySelectorAll("details.era-sec").forEach((d) => {
          const sum = d.querySelector(".era-sec-sum");
          if (sum && String(sum.textContent || "").includes("Периоды")) d.open = true;
        });
        const line = document.getElementById(`era-${eraId}-period-${periodId}`);
        if (line) {
          line.classList.add("period-line--focus");
          line.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => line.classList.remove("period-line--focus"), 2600);
        }
      });
    }

    function renderBridgePanel() {
      const panel = document.getElementById("bridge-panel-b-c");
      const root = document.getElementById("bridge-panel-root");
      const refEl = document.getElementById("bridge-panel-ref");
      const titleEl = document.getElementById("bridge-panel-title");
      if (!panel || !root) return;
      const ab = architecture.architectureBridge;
      const eraId = resolveFocusedEraId();
      let bridgeKey = null;
      if (eraId === "D" && ab && ab.C_to_D) bridgeKey = "C_to_D";
      else if ((eraId === "B" || eraId === "C") && ab && ab.B_to_C) bridgeKey = "B_to_C";
      const bridge = bridgeKey && ab ? ab[bridgeKey] : null;
      if (!bridge) {
        panel.hidden = true;
        root.innerHTML = "";
        return;
      }
      panel.hidden = false;
      if (titleEl) {
        const icon = titleEl.querySelector(".dashboard-section-icon");
        const iconHtml = icon ? icon.outerHTML : '<span class="dashboard-section-icon" aria-hidden="true">🌉</span> ';
        titleEl.innerHTML = `${iconHtml}${escapeHtml(bridge.title || bridgeKey)}`;
      }
      if (refEl) refEl.textContent = bridge.docRef ? `Документ: ${bridge.docRef}` : "";

      const listHtml = (items) =>
        items && items.length
          ? `<ul class="bridge-list">${items.map((t) => `<li>${escapeHtml(String(t))}</li>`).join("")}</ul>`
          : '<p class="bridge-empty">—</p>';

      const inheritsHtml =
        bridge.inherits && bridge.inherits.length
          ? `<ul class="bridge-inherits">${bridge.inherits
              .map(
                (r) =>
                  `<li><button type="button" class="bridge-system-link entity-link" data-entity-select="system" data-entity-id="${escapeHtml(r.system)}">${escapeHtml(r.system)}</button> — ${escapeHtml(r.note)}</li>`
              )
              .join("")}</ul>`
          : "";

      const shiftsHtml = (bridge.shifts || [])
        .map(
          (s) =>
            `<details class="bridge-sec" open><summary class="bridge-sec-sum">${escapeHtml(s.title)}</summary><div class="bridge-sec-body">${listHtml(s.items)}</div></details>`
        )
        .join("");

      let bodyHtml = `<p class="bridge-toolbar"><button type="button" class="entity-action-btn entity-link" data-entity-select="bridge" data-entity-id="${escapeHtml(bridgeKey)}">Открыть мост в инспекторе</button></p>`;
      bodyHtml += `<p class="bridge-summary">${escapeHtml(bridge.summary)}</p>${shiftsHtml}`;
      bodyHtml += `<details class="bridge-sec"><summary class="bridge-sec-sum">Перестаёт быть нормой</summary><div class="bridge-sec-body">${listHtml(bridge.stopsDoing)}</div></details>`;

      if (bridgeKey === "B_to_C") {
        bodyHtml += `<details class="bridge-sec"><summary class="bridge-sec-sum">Становится трудом поселения</summary><div class="bridge-sec-body">${listHtml(bridge.settlementLabor)}</div></details>`;
        bodyHtml += `<details class="bridge-sec" open><summary class="bridge-sec-sum">Наследует прототип (системы)</summary><div class="bridge-sec-body">${inheritsHtml}</div></details>`;
        bodyHtml += `<details class="bridge-sec"><summary class="bridge-sec-sum">UI становится второстепенным</summary><div class="bridge-sec-body">${listHtml(bridge.uiSecondary)}</div></details>`;
        bodyHtml += `<details class="bridge-sec" open><summary class="bridge-sec-sum">Критерии перехода к C</summary><div class="bridge-sec-body">${listHtml(bridge.criteria)}</div></details>`;
        bodyHtml += `<details class="bridge-sec"><summary class="bridge-sec-sum">Минимальный макет C до кода</summary><div class="bridge-sec-body">${listHtml(bridge.minDesignPack)}</div></details>`;
        bodyHtml += `<p class="bridge-hint">Полный текст — <code>A_B_TO_C_BRIDGE.md</code>. Чеклист B→C — в карточке эпохи B.</p>`;
      } else {
        bodyHtml += `<details class="bridge-sec" open><summary class="bridge-sec-sum">От поселения к городу</summary><div class="bridge-sec-body">${listHtml(bridge.settlementToCity)}</div></details>`;
        bodyHtml += `<details class="bridge-sec" open><summary class="bridge-sec-sum">Наследует слой C (системы)</summary><div class="bridge-sec-body">${inheritsHtml}</div></details>`;
        bodyHtml += `<details class="bridge-sec"><summary class="bridge-sec-sum">Фокус разблокировок</summary><div class="bridge-sec-body">${listHtml(bridge.unlocksFocus)}</div></details>`;
        bodyHtml += `<details class="bridge-sec" open><summary class="bridge-sec-sum">Критерии перехода к D</summary><div class="bridge-sec-body">${listHtml(bridge.criteria)}</div></details>`;
        bodyHtml += `<p class="bridge-hint">Чеклисты C→D и D→E — в карточках эпох C и D на шкале.</p>`;
      }
      bodyHtml += `<details class="bridge-sec"><summary class="bridge-sec-sum">Запрещено до моста</summary><div class="bridge-sec-body">${listHtml(bridge.forbiddenUntilBridge)}</div></details>`;
      root.innerHTML = bodyHtml;
    }

    function getPrototypeEraRow(eraId) {
      const pm = architecture.prototypeMapping;
      if (!pm || !Array.isArray(pm.eras)) return null;
      return pm.eras.find((r) => r && r.eraId === eraId) || null;
    }

    function renderPrototypeModulesHtml(row, compact) {
      if (!row || !row.modules || !row.modules.length) return '<p class="prototype-empty">Нет привязанных модулей.</p>';
      const eraId = row.eraId || "";
      const rows = row.modules
        .map((mod) => {
          const pid = prototypeModuleId(eraId, mod.path);
          const sys =
            mod.systemIds && mod.systemIds.length
              ? mod.systemIds
                  .map((sid) => {
                    const s = architecture.systems.find((x) => x && x.id === sid);
                    return `<button type="button" class="game-system-link entity-link" data-entity-select="system" data-entity-id="${escapeHtml(sid)}">${escapeHtml(s ? s.title : sid)}</button>`;
                  })
                  .join(" ")
              : "—";
          return `<tr class="prototype-module-row entity-link-card" tabindex="0" data-entity-select="prototype" data-entity-id="${escapeHtml(pid)}">
            <td><code class="prototype-path">${escapeHtml(mod.path)}</code></td>
            <td>${escapeHtml(mod.label)}</td>
            <td>${createStatusPill(mod.status || "planned")}</td>
            ${compact ? "" : `<td class="prototype-sys-cell">${sys}</td>`}
          </tr>`;
        })
        .join("");
      return `<table class="prototype-modules-table"><thead><tr>
        <th>Файл</th><th>Смысл</th><th>Статус</th>${compact ? "" : "<th>Системы</th>"}
      </tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderPrototypeDashPanel() {
      const panel = document.getElementById("prototype-dash-panel");
      const root = document.getElementById("prototype-dash-root");
      if (!panel || !root) return;
      const eraId = resolveFocusedEraId();
      if (!eraId || !["A", "B", "C"].includes(eraId)) {
        panel.hidden = true;
        root.innerHTML = "";
        return;
      }
      const pm = architecture.prototypeMapping;
      const row = getPrototypeEraRow(eraId);
      if (!pm || !row) {
        panel.hidden = true;
        root.innerHTML = "";
        return;
      }
      panel.hidden = false;
      const screens = (row.screens || []).join(", ") || "—";
      const gaps =
        row.gaps && row.gaps.length
          ? `<ul class="prototype-gaps">${row.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>`
          : "";
      root.innerHTML = `
        <p class="prototype-era-sum">${escapeHtml(row.summary)}</p>
        <p class="prototype-era-meta"><strong>Экраны:</strong> ${escapeHtml(screens)} · <strong>Ключ прототипа:</strong> <code>${escapeHtml(row.prototypeEraKey || "")}</code></p>
        ${renderPrototypeModulesHtml(row, true)}
        ${gaps ? `<details class="prototype-gaps-sec" open><summary>Пробелы до эпохи ${escapeHtml(eraId)}</summary>${gaps}</details>` : ""}
        <p class="prototype-dash-more"><button type="button" class="quick-action-btn" data-quick-scroll="#section-prototype-mapping">Полная таблица прототипа ↓</button></p>
      `;
    }

    function renderPrototypeMappingSection() {
      const root = document.getElementById("prototype-mapping-root");
      if (!root) return;
      const pm = architecture.prototypeMapping;
      if (!pm) {
        root.innerHTML = '<div class="empty-state">Нет данных prototypeMapping.</div>';
        return;
      }
      const blocks = (pm.eras || [])
        .map((row) => {
          const era = architecture.eras.find((e) => e && e.id === row.eraId);
          const gaps =
            row.gaps && row.gaps.length
              ? `<details class="prototype-gaps-sec"><summary>Пробелы / риски</summary><ul class="prototype-gaps">${row.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul></details>`
              : "";
          return `<div class="prototype-era-block" id="prototype-era-${escapeHtml(row.eraId)}">
            <h3 class="prototype-era-title"><span class="era-code">${escapeHtml(row.eraId)}</span> ${escapeHtml(era ? era.title : row.eraId)} ${createStatusPill(row.mapStatus || "planned")}</h3>
            <p>${escapeHtml(row.summary)}</p>
            ${renderPrototypeModulesHtml(row, false)}
            ${gaps}
          </div>`;
        })
        .join("");
      root.innerHTML = `
        <div class="prototype-mapping-intro">
          <p><strong>${escapeHtml(pm.title)}.</strong> ${escapeHtml(pm.summary)}</p>
          <p>Точка входа: <code>${escapeHtml(pm.entryPoint || "web/prototype.html")}</code>. ${escapeHtml(pm.note || "")}</p>
        </div>
        ${blocks}
      `;
    }

    function renderEraCompareField(label, left, right) {
      return `<tr><th>${escapeHtml(label)}</th><td>${left}</td><td>${right}</td></tr>`;
    }

    function eraCompareSelectOptions(selectedId) {
      return architecture.eras
        .filter(isEraVisible)
        .map(
          (e) =>
            `<option value="${escapeHtml(e.id)}"${e.id === selectedId ? " selected" : ""}>${escapeHtml(e.id)} — ${escapeHtml(
              truncateText(e.title, 48)
            )}</option>`
        )
        .join("");
    }

    function normalizeEraComparePair() {
      let left = state.eraCompareLeft || "B";
      let right = state.eraCompareRight || "C";
      const visible = new Set(architecture.eras.filter(isEraVisible).map((e) => e.id));
      if (!visible.has(left)) left = visible.has("B") ? "B" : [...visible][0] || "A";
      if (!visible.has(right)) right = visible.has("C") ? "C" : [...visible][1] || left;
      if (left === right) {
        const i = ERA_ORDER.indexOf(left);
        const next = ERA_ORDER[i + 1];
        if (next && visible.has(next)) right = next;
      }
      state.eraCompareLeft = left;
      state.eraCompareRight = right;
    }

    function renderEraComparePanel() {
      const panel = document.getElementById("era-compare-panel");
      const root = document.getElementById("era-compare-root");
      const btn = document.getElementById("btn-era-compare-bc");
      if (btn) btn.classList.toggle("is-active", !!state.eraCompareActive);
      if (!panel || !root) return;
      if (!state.eraCompareActive) {
        panel.hidden = true;
        root.innerHTML = "";
        return;
      }
      normalizeEraComparePair();
      const eraL = architecture.eras.find((e) => e && e.id === state.eraCompareLeft);
      const eraR = architecture.eras.find((e) => e && e.id === state.eraCompareRight);
      if (!eraL || !eraR) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      const query = state.search;
      const pickGoals = (era, n) =>
        `<ul class="era-compare-list">${(era.goals || [])
          .slice(0, n)
          .map((g) => `<li>${highlightPlain(g, query)}</li>`)
          .join("")}</ul>`;
      const sysSnippet = (era, key) => {
        const v = era.systems && era.systems[key] ? String(era.systems[key]).trim() : "";
        return v ? highlightPlain(truncateText(v, 220), query) : "—";
      };
      const transL = eraL.transition || {};
      const transR = eraR.transition || {};
      const toL = transL.to != null && String(transL.to).trim() !== "" ? String(transL.to).trim() : "";
      const toR = transR.to != null && String(transR.to).trim() !== "" ? String(transR.to).trim() : "";
      let checklistRow = "";
      if (toL === eraR.id) {
        const prog = transitionChecklistProgress(eraL.id);
        checklistRow = renderEraCompareField(
          `Чеклист ${eraL.id}→${eraR.id}`,
          `<span class="era-chip era-chip--check">${prog.done}/${prog.total}</span>`,
          "—"
        );
      } else if (toR === eraL.id) {
        const prog = transitionChecklistProgress(eraR.id);
        checklistRow = renderEraCompareField(
          `Чеклист ${eraR.id}→${eraL.id}`,
          "—",
          `<span class="era-chip era-chip--check">${prog.done}/${prog.total}</span>`
        );
      }
      const pickers = `<div class="era-compare-pickers">
          <label class="era-compare-label">Слева
            <select id="era-compare-select-left" class="era-compare-select" aria-label="Эпоха слева">${eraCompareSelectOptions(
              eraL.id
            )}</select>
          </label>
          <button type="button" class="era-compare-swap" id="btn-era-compare-swap" title="Поменять эпохи местами">⇄</button>
          <label class="era-compare-label">Справа
            <select id="era-compare-select-right" class="era-compare-select" aria-label="Эпоха справа">${eraCompareSelectOptions(
              eraR.id
            )}</select>
          </label>
        </div>`;
      root.innerHTML = `
        ${pickers}
        <table class="era-compare-table">
          <thead><tr><th></th><th>${escapeHtml(eraL.id)} — ${escapeHtml(eraL.title)}</th><th>${escapeHtml(eraR.id)} — ${escapeHtml(
        eraR.title
      )}</th></tr></thead>
          <tbody>
            ${renderEraCompareField("Роль", escapeHtml(roleLabelsRu[eraL.role] || eraL.role), escapeHtml(roleLabelsRu[eraR.role] || eraR.role))}
            ${renderEraCompareField("Вес", escapeHtml(designWeightLabelsRu[eraL.designWeight] || ""), escapeHtml(designWeightLabelsRu[eraR.designWeight] || ""))}
            ${renderEraCompareField("Резюме", highlightPlain(truncateText(eraL.summary, 280), query), highlightPlain(truncateText(eraR.summary, 280), query))}
            ${renderEraCompareField("Люди", sysSnippet(eraL, "people"), sysSnippet(eraR, "people"))}
            ${renderEraCompareField("Труд", sysSnippet(eraL, "labor"), sysSnippet(eraR, "labor"))}
            ${renderEraCompareField("Постройки", sysSnippet(eraL, "buildings"), sysSnippet(eraR, "buildings"))}
            ${renderEraCompareField("Экономика", sysSnippet(eraL, "economy"), sysSnippet(eraR, "economy"))}
            ${renderEraCompareField("Переход →", escapeHtml(toL || "—"), escapeHtml(toR || "—"))}
            ${renderEraCompareField("Условие перехода", highlightPlain(transL.condition || "", query), highlightPlain(transR.condition || "", query))}
            ${checklistRow}
            ${renderEraCompareField("Цели (до 4)", pickGoals(eraL, 4), pickGoals(eraR, 4))}
          </tbody>
        </table>
        <p class="era-compare-hint">Выберите любые две эпохи. Канон моста B→C — <code>architectureBridge</code> и карточки в data.js.</p>
      `;
    }

    function openEraCompare(leftId, rightId) {
      if (leftId) state.eraCompareLeft = leftId;
      if (rightId) state.eraCompareRight = rightId;
      if (!state.eraCompareLeft && state.focusedEraId) state.eraCompareLeft = state.focusedEraId;
      if (!state.eraCompareRight) {
        const i = ERA_ORDER.indexOf(state.eraCompareLeft || "B");
        const next = i >= 0 ? ERA_ORDER[i + 1] : "C";
        state.eraCompareRight = next || "C";
      }
      normalizeEraComparePair();
      state.eraCompareActive = true;
      renderEraComparePanel();
      requestAnimationFrame(() => {
        document.getElementById("era-compare-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }

    function toggleEraCompareBc() {
      if (state.eraCompareActive) {
        state.eraCompareActive = false;
        renderEraComparePanel();
        return;
      }
      openEraCompare(state.focusedEraId || "B", null);
    }

    function scrollSpineCardIntoView(eraId) {
      const card = document.querySelector(`.era-spine-card[data-era-spine="${eraId}"]`);
      if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    /** Клик по линии эпох / точкам — открыть инспектор, без прыжка на нижнюю шкалу. */
    function focusEraFromSpine(eraId, options) {
      const opts = options || {};
      if (!eraId) return;
      const era = architecture.eras.find((e) => e && e.id === eraId);
      if (!era || !isEraVisible(era)) return;
      if (state.focusedSystemId) {
        state.focusedSystemId = null;
        state.matrixHighlightSystemId = null;
        state.hoveredSystemId = null;
        applyMainlineHighlightClasses();
        renderSystemFocusPanel();
        syncMatrixFocusRenders();
      }
      setEraFocus(eraId, {
        updateHash: opts.updateHash !== false,
        scrollInspector: opts.scrollInspector !== false,
        openTimeline: false
      });
      scrollSpineCardIntoView(eraId);
      highlightTimelineEraCard(eraId);
    }

    function setEraFocus(eraId, options) {
      const opts = options || {};
      if (!eraId) return;
      state.focusedEraId = eraId;
      state.selectedEntity = { kind: "era", id: eraId };
      if (opts.openTimeline) {
        state.lowerGateOpen = true;
        openLowerSection("lower-gate-timeline");
      }
      if (opts.updateHash !== false && !state.applyingHash) {
        syncEntityHash({ kind: "era", id: eraId });
      }
      renderEraInspector();
      renderBridgePanel();
      renderPrototypeDashPanel();
      syncEraSpineActiveFromHash();
      renderEntityInspectorPanel();
      renderFocusRecommendations();
      syncEntitySelectionDom();
      if (opts.scrollInspector !== false) {
        requestAnimationFrame(() => {
          const panel = document.getElementById("era-inspector-panel");
          if (panel && !panel.hidden) {
            panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });
      }
    }

    function clearEraFocus() {
      state.focusedEraId = null;
      if (state.selectedEntity && state.selectedEntity.kind === "era") state.selectedEntity = null;
      const panel = document.getElementById("era-inspector-panel");
      if (panel) panel.hidden = true;
      const host = document.getElementById("era-inspector-root");
      if (host) host.innerHTML = "";
      renderBridgePanel();
      renderPrototypeDashPanel();
      renderEntityInspectorPanel();
    }

    function renderEraInspector() {
      const panel = document.getElementById("era-inspector-panel");
      const host = document.getElementById("era-inspector-root");
      const titleEl = document.getElementById("era-inspector-title");
      if (!panel || !host) return;
      const hash = (location.hash || "").replace(/^#/, "");
      const em = /^era-([A-K])$/i.exec(hash);
      const id = state.focusedEraId || (em ? em[1].toUpperCase() : null);
      if (!id) {
        panel.hidden = true;
        panel.classList.remove("is-open");
        host.innerHTML = "";
        if (titleEl) {
          titleEl.innerHTML =
            '<span class="dashboard-section-icon" aria-hidden="true">📋</span> Карточка эпохи';
        }
        return;
      }
      const era = architecture.eras.find((e) => e && e.id === id);
      if (!era || !isEraVisible(era)) {
        panel.hidden = true;
        panel.classList.remove("is-open");
        host.innerHTML = "";
        return;
      }
      state.focusedEraId = id;
      panel.hidden = false;
      panel.classList.add("is-open");
      if (titleEl) {
        titleEl.innerHTML = `<span class="dashboard-section-icon" aria-hidden="true">📋</span> Эпоха <span class="era-inspector-code">${escapeHtml(
          era.id
        )}</span> — ${escapeHtml(era.title)}`;
      }
      host.innerHTML = renderEraCard(era, { forceExpanded: true, inInspector: true });
      requestAnimationFrame(() => {
        host.querySelectorAll("details.era-sec").forEach((d) => {
          d.open = true;
        });
      });
    }

    function applyDashboardShellClass() {
      const shell = document.getElementById("architecture-shell");
      if (!shell) return;
      shell.classList.remove("dashboard-view-overview", "dashboard-view-systems", "dashboard-view-detailed");
      shell.classList.add(`dashboard-view-${state.dashboardView || "overview"}`);
      const gate = document.getElementById("architecture-lower-gate");
      if (gate) {
        if (state.dashboardView === "detailed") {
          gate.open = true;
          state.lowerGateOpen = true;
          openAllLowerSections(true);
        } else {
          gate.open = !!(state.lowerGateOpen || state.focusedEraId);
        }
        syncLowerGateButton();
      }
    }

    function progressionEraCoverage(byEra) {
      if (!byEra) return 0;
      let n = 0;
      for (let i = 0; i < ERA_ORDER.length; i++) {
        const id = ERA_ORDER[i];
        const v = byEra[id];
        if (v && String(v).trim()) n += 1;
      }
      return n / ERA_ORDER.length;
    }

    function collectDiagramEdges() {
      const edges = [];
      const seen = new Set();
      function add(from, to, kind) {
        if (!MAINLINE_ALL_IDS.has(from) || !MAINLINE_ALL_IDS.has(to) || from === to) return;
        const key = `${from}|${to}|${kind}`;
        if (seen.has(key)) return;
        seen.add(key);
        edges.push({ from, to, kind });
      }
      for (const id of MAINLINE_ALL_IDS) {
        const s = getSystemById(id);
        if (!s || !Array.isArray(s.relatedSystems)) continue;
        for (const r of s.relatedSystems) {
          if (r && r.systemId) add(id, r.systemId, "related");
        }
      }
      for (const d of architecture.dependencies || []) {
        if (!d || !d.from || !d.to) continue;
        add(d.from, d.to, d.type || "dep");
      }
      return edges;
    }

    function edgeStrokeClass(kind) {
      if (kind === "related") return "mainline-edge mainline-edge--aux";
      if (kind === "goal") return "mainline-edge mainline-edge--goal";
      if (kind === "chain") return "mainline-edge mainline-edge--chain";
      if (kind === "infra") return "mainline-edge mainline-edge--infra";
      if (DEP_EDGE_REQUIRE.has(kind)) return "mainline-edge mainline-edge--require";
      if (DEP_EDGE_UNLOCK.has(kind)) return "mainline-edge mainline-edge--unlock";
      if (DEP_EDGE_FEEDBACK.has(kind)) return "mainline-edge mainline-edge--feedback";
      if (DEP_EDGE_MANAGE.has(kind)) return "mainline-edge mainline-edge--manage";
      if (DEP_EDGE_INFLUENCE.has(kind)) return "mainline-edge mainline-edge--influence";
      return "mainline-edge mainline-edge--dep";
    }

    function mainlineEdgePriority(edge) {
      let score = 0;
      if (MAINLINE_CHAIN_IDS.includes(edge.from) && MAINLINE_CHAIN_IDS.includes(edge.to)) score += 6;
      if (MAINLINE_SUPPORT_ROW.includes(edge.from) || MAINLINE_SUPPORT_ROW.includes(edge.to)) score += 3;
      if (edge.kind === "related") score += 1;
      if (DEP_EDGE_REQUIRE.has(edge.kind) || DEP_EDGE_UNLOCK.has(edge.kind)) score += 4;
      return score;
    }

    function capIdleDiagramEdges(edges) {
      const sorted = edges.slice().sort((a, b) => mainlineEdgePriority(b) - mainlineEdgePriority(a));
      return sorted.slice(0, MAINLINE_IDLE_EDGE_MAX);
    }

    function setDashboardViewButtons() {
      document.querySelectorAll("[data-dashboard-view]").forEach((btn) => {
        const v = btn.getAttribute("data-dashboard-view");
        btn.classList.toggle("is-active", v === state.dashboardView);
      });
    }

    function getSystemById(id) {
      return (architecture.systems || []).find((s) => s && s.id === id) || null;
    }

    function relatedIdsForSystem(sys) {
      const rs = sys && sys.relatedSystems;
      if (!Array.isArray(rs)) return new Set();
      return new Set(rs.map((r) => r && r.systemId).filter(Boolean));
    }

    function getHighlightSystemId() {
      return state.focusedSystemId || state.hoveredSystemId;
    }

    function syncMatrixFocusRenders() {
      renderSystemsMatrix();
      renderDashboardMatrixPreview();
    }

    function applyMainlineHighlightClasses() {
      const activeId = getHighlightSystemId();
      const sys = activeId ? getSystemById(activeId) : null;
      const related = sys ? relatedIdsForSystem(sys) : new Set();
      document.querySelectorAll("[data-mainline-system]").forEach((el) => {
        const id = el.getAttribute("data-mainline-system");
        el.classList.remove(
          "mainline-node--active",
          "mainline-node--hover",
          "mainline-node--related",
          "mainline-node--muted"
        );
        if (!activeId) return;
        if (id === activeId) {
          el.classList.add(state.focusedSystemId === id ? "mainline-node--active" : "mainline-node--hover");
        } else if (state.mainlineEdgePartner && id === state.mainlineEdgePartner) {
          el.classList.add("mainline-node--related", "mainline-node--edge-partner");
        } else if (related.has(id)) {
          el.classList.add("mainline-node--related");
        } else {
          el.classList.add("mainline-node--muted");
        }
      });
      updateMainlineEdges();
    }

    function clearSystemHashIfAny() {
      if (/^#system-/i.test(location.hash)) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    }

    function syncSystemHash(systemId) {
      if (state.applyingHash) return;
      const base = location.pathname + location.search;
      if (systemId) {
        const want = `#system-${systemId}`;
        if (location.hash !== want) history.replaceState(null, "", base + want);
      } else {
        clearSystemHashIfAny();
      }
    }

    function clearSystemFocus() {
      state.focusedSystemId = null;
      state.hoveredSystemId = null;
      state.matrixHighlightSystemId = null;
      state.mainlineEdgePartner = null;
      state.mainlineEdgeKind = null;
      if (!state.selectedEntity || state.selectedEntity.kind === "system") state.selectedEntity = null;
      applyMainlineHighlightClasses();
      renderEntityInspectorPanel();
      renderFocusRecommendations();
      syncMatrixFocusRenders();
      if (!state.applyingHash) syncEntityHash(null);
    }

    function scrollToSystem(systemId) {
      const el = document.getElementById("mainline-card-" + systemId) || document.getElementById("core-system-card-" + systemId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function setSystemFocus(systemId, options) {
      const opts = options || {};
      if (opts.toggle && state.focusedSystemId === systemId) {
        clearSelectedEntity();
        clearSystemFocus();
        return;
      }
      if (!opts.keepEdgePartner) {
        state.mainlineEdgePartner = null;
        state.mainlineEdgeKind = null;
      }
      selectEntity("system", systemId, {
        updateHash: opts.updateHash !== false,
        scroll: !!opts.scroll,
        scrollInspector: opts.scrollInspector !== false
      });
    }

    function isOnMainlineDiagram(systemId) {
      return !!(systemId && MAINLINE_ALL_IDS.has(systemId));
    }

    function dependenciesForSystem(systemId) {
      const requires = [];
      const enables = [];
      for (const d of architecture.dependencies || []) {
        if (!d || !d.from || !d.to) continue;
        if (d.to === systemId && (DEP_EDGE_REQUIRE.has(d.type) || d.type === "depends")) {
          requires.push(d);
        }
        if (
          d.from === systemId &&
          (DEP_EDGE_UNLOCK.has(d.type) || DEP_EDGE_INFLUENCE.has(d.type) || d.type === "enables")
        ) {
          enables.push(d);
        }
      }
      return { requires, enables };
    }

    function progressionRadarPolygon(byEra) {
      const cx = 50;
      const cy = 50;
      const pts = [];
      for (let i = 0; i < ERA_ORDER.length; i++) {
        const eraId = ERA_ORDER[i];
        const angle = (i / ERA_ORDER.length) * Math.PI * 2 - Math.PI / 2;
        const v = byEra && byEra[eraId];
        const filled = v && String(v).trim();
        const r = 14 + (filled ? 28 : 10);
        pts.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
      }
      return pts.join(" ");
    }

    // --- Render: era spine ---
    function renderEraSpine() {
      const host = document.getElementById("era-spine-root");
      if (!host) return;
      const list = architecture.eras.filter(isEraVisible);
      const hash = (location.hash || "").replace(/^#/, "");
      const track = document.getElementById("era-spine-track");
      if (!list.length) {
        host.innerHTML = '<div class="empty-state">Нет эпох по фильтрам.</div>';
        if (track) track.innerHTML = "";
        return;
      }
      host.innerHTML = list
        .map((era) => {
          const dw = era.designWeight && String(era.designWeight).trim() ? String(era.designWeight).trim() : "medium";
          const pts = era.playerTimeShare ? playerTimeShareLabelsRu[era.playerTimeShare] || era.playerTimeShare : "—";
          const role = roleLabelsRu[era.role] || era.role || "";
          const phase = eraPhaseGroup(era.id);
          const icon = ERA_ICONS[era.id] || "•";
          const color = eraColors[era.id] || "var(--blue)";
          const active = hash === `era-${era.id}`;
          const c = eraContentCounts(era);
          const to =
            era.transition && era.transition.to != null && String(era.transition.to).trim() !== ""
              ? String(era.transition.to).trim()
              : "";
          const summary = truncateText(era.summary || "", 96);
          const firstPeriod = era.periods && era.periods[0];
          const periodHint = firstPeriod ? truncateText(firstPeriod.title, 42) : "";
          const tc = transitionChecklistProgress(era.id);
          const stats = [
            c.periods ? `${c.periods} пер.` : "",
            c.goals ? `${c.goals} целей` : "",
            to ? `→ ${to}` : "",
            tc.total ? `✓ ${tc.done}/${tc.total}` : ""
          ]
            .filter(Boolean)
            .join(" · ");
          const pressed = active ? "true" : "false";
          const entityActive =
            state.selectedEntity && state.selectedEntity.kind === "era" && state.selectedEntity.id === era.id;
          return `<button type="button" class="era-spine-card era-spine-card--phase-${escapeHtml(phase)} era-spine-card--dw-${escapeHtml(dw)}${active || entityActive ? " is-active" : ""} entity-link-card" data-era-spine="${escapeHtml(era.id)}" data-entity-select="era" data-entity-id="${escapeHtml(era.id)}" role="listitem" aria-pressed="${active || entityActive ? "true" : "false"}" style="--era-accent:${color}" title="${escapeHtml(era.summary || "")} — клик: инспектор справа">
            <span class="era-spine-icon" aria-hidden="true">${icon}</span>
            <span class="era-spine-head"><span class="era-spine-id">${escapeHtml(era.id)}</span>${role ? `<span class="era-spine-role">${escapeHtml(role)}</span>` : ""}</span>
            <span class="era-spine-title">${escapeHtml(era.title)}</span>
            <span class="era-spine-dates">${escapeHtml(era.dates || "")}</span>
            <span class="era-spine-summary">${escapeHtml(summary)}</span>
            ${stats ? `<span class="era-spine-stats">${escapeHtml(stats)}</span>` : ""}
            ${periodHint ? `<span class="era-spine-period" title="Первый период">${escapeHtml(periodHint)}</span>` : ""}
            <span class="era-spine-pts" title="Доля игрового времени">${escapeHtml(pts)}</span>
            <span class="era-spine-open-hint">Открыть ↓</span>
          </button>`;
        })
        .join("");
      if (track) {
        track.innerHTML = list
          .map((era) => {
            const active = hash === `era-${era.id}`;
            const entityActive =
              state.selectedEntity && state.selectedEntity.kind === "era" && state.selectedEntity.id === era.id;
            return `<button type="button" class="era-spine-dot${active || entityActive ? " is-active" : ""} entity-link" data-era-spine="${escapeHtml(era.id)}" data-entity-select="era" data-entity-id="${escapeHtml(era.id)}" style="--era-accent:${eraColors[era.id] || "var(--purple)"}" aria-label="Эпоха ${escapeHtml(era.id)}: ${escapeHtml(era.title)}"></button>`;
          })
          .join("");
      }
    }

    function syncEraSpineActiveFromHash() {
      const hash = (location.hash || "").replace(/^#/, "");
      const em = /^era-([A-K])$/i.exec(hash);
      const activeId = state.focusedEraId || (em ? em[1].toUpperCase() : null);
      document.querySelectorAll("[data-era-spine]").forEach((btn) => {
        const id = btn.getAttribute("data-era-spine");
        const on = !!(activeId && id === activeId);
        btn.classList.toggle("is-active", on);
        if (btn.classList.contains("era-spine-card")) {
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        }
      });
    }

    // --- Render: mainline systems ---
    function renderMainlineMap() {
      const root = document.getElementById("mainline-systems-root");
      if (!root) return;
      root.className = "core-system-map mainline-systems-canvas mainline-systems-bands";
      const activeId = getHighlightSystemId();
      const activeSys = activeId ? getSystemById(activeId) : null;
      const related = activeSys ? relatedIdsForSystem(activeSys) : new Set();
      const q = state.search;

      function nodeHtml(s) {
        if (!s) return "";
        const m = q && includesText(s, q) ? " is-search-match" : "";
        let mod = "";
        if (activeId) {
          if (s.id === activeId) {
            mod = state.focusedSystemId === activeId ? " mainline-node--active" : " mainline-node--hover";
          } else if (related.has(s.id)) mod = " mainline-node--related";
          else mod = " mainline-node--muted";
        }
        const kind = mainlineNodeKind(s.id);
        const num = MAINLINE_NUMBERS[s.id];
        const icon = SYSTEM_ICONS[s.id] || "◎";
        const numHtml = num ? `<span class="mainline-node-num">${num}</span>` : "";
        const banner = s.id === "goals" || s.id === "ui";
        const bannerClass = banner ? " mainline-node--banner" : "";
        const roleHint = s.roleInGame && String(s.roleInGame).trim() ? truncateText(s.roleInGame, 48) : "";
        const pressed = state.focusedSystemId === s.id;
        const ariaLabel = `${s.title}. Эпохи ${s.appearsIn}–${s.becomesCoreIn}. Клик — инспектор справа.`;
        const goalsTag =
          s.id === "goals" ? `<span class="mainline-node-tag mainline-node-tag--goals">Цели</span>` : "";
        return `<button type="button" class="mainline-node mainline-node--grid mainline-node--compact mainline-node--${kind} entity-link-card${bannerClass}${m}${mod}" data-mainline-system="${escapeHtml(s.id)}" data-entity-select="system" data-entity-id="${escapeHtml(s.id)}" id="mainline-card-${escapeHtml(s.id)}" aria-label="${escapeHtml(ariaLabel)}" aria-pressed="${pressed ? "true" : "false"}" title="${escapeHtml(ariaLabel)}">
          <span class="mainline-node-head">
            <span class="mainline-node-icon" aria-hidden="true">${icon}</span>
            ${numHtml}
            <span class="mainline-node-title">${markInEscaped(escapeHtml(s.title), q)}</span>
            ${goalsTag}
          </span>
          <span class="mainline-node-era"><code>${escapeHtml(s.appearsIn)}</code>→<code>${escapeHtml(s.becomesCoreIn)}</code></span>
          ${banner && s.summary ? `<span class="mainline-node-sum mainline-node-sum--banner">${markInEscaped(escapeHtml(truncateText(s.summary, 100)), q)}</span>` : roleHint ? `<span class="mainline-node-hint">${escapeHtml(roleHint)}</span>` : ""}
        </button>`;
      }

      root.innerHTML = MAINLINE_BANDS.map((band) => {
        const cells = band.ids
          .map((id) => nodeHtml(getSystemById(id)))
          .filter(Boolean)
          .join("");
        return `<section class="mainline-band" data-mainline-band="${escapeHtml(band.key)}" aria-label="${escapeHtml(band.title)}">
          <h3 class="mainline-band-title">${escapeHtml(band.title)}</h3>
          <div class="mainline-band-grid ${escapeHtml(band.gridClass)}">${cells}</div>
        </section>`;
      }).join("");

      requestAnimationFrame(() => updateMainlineEdges());
    }

    function updateMainlineEdges() {
      const svg = document.getElementById("mainline-edges");
      const diagram = document.getElementById("mainline-diagram");
      if (!svg || !diagram) return;
      diagram.classList.toggle("mainline-diagram--has-focus", !!getHighlightSystemId());
      const dRect = diagram.getBoundingClientRect();
      const w = Math.max(1, Math.round(dRect.width));
      const h = Math.max(1, Math.round(dRect.height));
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));

      function centerFor(id) {
        const el = document.getElementById(`mainline-card-${id}`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - dRect.left, y: r.top + r.height / 2 - dRect.top };
      }

      function edgePathD(p0, p1, bendSign) {
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const bend = Math.min(42, len * 0.28) * (bendSign || 1);
        const cx = mx - (dy / len) * bend;
        const cy = my + (dx / len) * bend;
        return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }

      function pathEl(p0, p1, cls, opacity, bendSign) {
        const op = opacity != null ? opacity : 1;
        return `<path d="${edgePathD(p0, p1, bendSign)}" fill="none" class="${cls}" opacity="${op}"/>`;
      }

      function hitPathEl(p0, p1, from, to, kind, bendSign) {
        const title = `${getSystemById(from)?.title || from} → ${getSystemById(to)?.title || to}`;
        return `<path d="${edgePathD(
          p0,
          p1,
          bendSign
        )}" fill="none" class="mainline-edge-hit" data-edge-from="${escapeHtml(from)}" data-edge-to="${escapeHtml(
          to
        )}" data-edge-kind="${escapeHtml(kind || "dep")}" stroke="transparent" stroke-width="16" tabindex="0" role="button" aria-label="${escapeHtml(
          title
        )}"><title>${escapeHtml(title)}</title></path>`;
      }

      function touchesActive(from, to, activeId) {
        return from === activeId || to === activeId;
      }

      const lines = [];
      const hits = [];
      const activeId = getHighlightSystemId();
      const diagramEdges = collectDiagramEdges();
      let bendFlip = 1;

      if (activeId) {
        const sys = getSystemById(activeId);
        const p0 = centerFor(activeId);
        if (sys && p0) {
          relatedIdsForSystem(sys).forEach((tid) => {
            const p1 = centerFor(tid);
            if (p1) {
              lines.push(pathEl(p0, p1, "mainline-edge mainline-edge--focus", 1, bendFlip));
              hits.push(hitPathEl(p0, p1, activeId, tid, "focus", bendFlip));
              bendFlip *= -1;
            }
          });
        }
        diagramEdges.forEach((e) => {
          if (!touchesActive(e.from, e.to, activeId)) return;
          const a = centerFor(e.from);
          const b = centerFor(e.to);
          if (a && b) {
            lines.push(pathEl(a, b, edgeStrokeClass(e.kind), 0.55, bendFlip));
            hits.push(hitPathEl(a, b, e.from, e.to, e.kind, bendFlip));
            bendFlip *= -1;
          }
        });
      } else {
        for (let i = 0; i < MAINLINE_CHAIN_IDS.length - 1; i++) {
          const from = MAINLINE_CHAIN_IDS[i];
          const to = MAINLINE_CHAIN_IDS[i + 1];
          const p0 = centerFor(from);
          const p1 = centerFor(to);
          if (p0 && p1) {
            lines.push(pathEl(p0, p1, "mainline-edge mainline-edge--chain", 0.62, 1));
            hits.push(hitPathEl(p0, p1, from, to, "chain", 1));
          }
        }
        const pg = centerFor("goals");
        if (pg) {
          MAINLINE_CHAIN_IDS.forEach((tid, i) => {
            const p1 = centerFor(tid);
            if (p1) {
              const bs = i % 2 ? 1 : -1;
              lines.push(pathEl(pg, p1, "mainline-edge mainline-edge--goal", 0.2, bs));
              hits.push(hitPathEl(pg, p1, "goals", tid, "goal", bs));
            }
          });
        }
        const pu = centerFor("ui");
        if (pu) {
          [...MAINLINE_SUPPORT_ROW, "governance", "economy"].forEach((tid, i) => {
            const p1 = centerFor(tid);
            if (p1) {
              const bs = i % 2 ? -1 : 1;
              lines.push(pathEl(pu, p1, "mainline-edge mainline-edge--infra", 0.18, bs));
              hits.push(hitPathEl(pu, p1, "ui", tid, "infra", bs));
            }
          });
        }
        capIdleDiagramEdges(diagramEdges).forEach((e) => {
          const a = centerFor(e.from);
          const b = centerFor(e.to);
          if (!a || !b) return;
          const isChain =
            MAINLINE_CHAIN_IDS.includes(e.from) &&
            MAINLINE_CHAIN_IDS.includes(e.to) &&
            Math.abs(MAINLINE_CHAIN_IDS.indexOf(e.from) - MAINLINE_CHAIN_IDS.indexOf(e.to)) === 1;
          if (isChain) return;
          const op = e.kind === "related" ? 0.22 : 0.18;
          lines.push(pathEl(a, b, edgeStrokeClass(e.kind), op, bendFlip));
          hits.push(hitPathEl(a, b, e.from, e.to, e.kind, bendFlip));
          bendFlip *= -1;
        });
      }
      svg.innerHTML = lines.join("") + hits.join("");
    }

    function matrixHeatOpacity(level) {
      if (level === "lvl3") return 0.88;
      if (level === "lvl2") return 0.58;
      if (level === "lvl1") return 0.34;
      return 0.1;
    }

    function renderDashboardMatrixPreview() {
      const host = document.getElementById("dashboard-matrix-preview");
      if (!host) return;
      host.className = "dashboard-matrix-preview dashboard-matrix-preview--full";
      const eras = architecture.eras.filter(isEraVisible);
      const systems = MATRIX_FOOTER_IDS.map((id) => getSystemById(id)).filter(Boolean);
      if (!eras.length || !systems.length) {
        host.innerHTML = '<div class="empty-state">Нет данных для матрицы.</div>';
        return;
      }
      const head = eras
        .map(
          (e) =>
            `<th><button type="button" class="matrix-era-head-btn" data-matrix-era="${escapeHtml(e.id)}" title="Фокус на эпохе ${escapeHtml(e.id)}">${escapeHtml(e.id)}</button></th>`
        )
        .join("");
      const body = systems
        .map((sys) => {
          const cells = eras
            .map((era) => {
              const ph = systemPhase(sys, era.id);
              const op = matrixHeatOpacity(ph.level);
              const hlSys = state.matrixHighlightSystemId || state.focusedSystemId;
              const hl = hlSys === sys.id && ph.level !== "lvl0" ? " heat-cell--hl" : "";
              const title = `${sys.title} · ${era.id}: ${ph.label}`;
              return `<td class="heat-cell-td"><button type="button" class="heat-cell-btn${hl}" data-heatmap-cell="${escapeHtml(sys.id)}" data-heatmap-era="${escapeHtml(era.id)}" style="--heat:${op}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"></button></td>`;
            })
            .join("");
          return `<tr class="heatmap-row"><th scope="row"><button type="button" class="matrix-system-head-btn" data-heatmap-system="${escapeHtml(sys.id)}" title="Фокус на системе">${escapeHtml(sys.title)}</button></th>${cells}</tr>`;
        })
        .join("");
      host.innerHTML = `<table class="heatmap-table"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }

    function focusRecDepLi(systemId, title, type, prefix) {
      const label = title || systemId || "—";
      if (systemId && getSystemById(systemId)) {
        return `<li>${prefix || ""}<button type="button" class="focus-rec-dep-btn entity-link" data-entity-select="system" data-entity-id="${escapeHtml(systemId)}">${escapeHtml(label)} <span class="focus-rec-dep-type">${escapeHtml(type)}</span></button></li>`;
      }
      return `<li>${prefix || ""}${escapeHtml(label)} <span class="focus-rec-dep-type">${escapeHtml(type)}</span></li>`;
    }

    function renderFocusRecommendations() {
      const host = document.getElementById("dashboard-focus-rec");
      if (!host) return;
      const sid = state.focusedSystemId;
      if (sid) {
        const s = getSystemById(sid);
        if (!s) {
          host.innerHTML = '<p class="focus-rec-muted">Система не найдена.</p>';
          return;
        }
        const titleMap = buildSystemTitleMap(architecture.systems);
        const deps = dependenciesForSystem(sid);
        const rs = Array.isArray(s.relatedSystems) ? s.relatedSystems : [];
        const risks = rs.filter((r) => /риск|блок|криз|угроз/i.test(String(r.relation || "") + String(r.note || "")));
        const wins = rs.filter((r) => /открывает|усиливает|питает|разблок/i.test(String(r.relation || "")));
        const depReq =
          deps.requires.length > 0
            ? `<div class="focus-rec-block focus-rec-block--risk"><strong>Требует</strong><ul>${deps.requires
                .slice(0, 4)
                .map((d) => focusRecDepLi(d.from, titleMap.get(d.from) || d.from, d.type, ""))
                .join("")}</ul></div>`
            : "";
        const depEn =
          deps.enables.length > 0
            ? `<div class="focus-rec-block focus-rec-block--win"><strong>Открывает / влияет</strong><ul>${deps.enables
                .slice(0, 4)
                .map((d) => focusRecDepLi(d.to, titleMap.get(d.to) || d.to, d.type, "→ "))
                .join("")}</ul></div>`
            : "";
        host.innerHTML = `
          <div class="focus-rec-current"><strong>Фокус:</strong> ${escapeHtml(s.title)}</div>
          ${depReq}
          ${depEn}
          ${risks.length ? `<div class="focus-rec-block focus-rec-block--risk"><strong>Связанные риски</strong><ul>${risks.map((r) => `<li>${escapeHtml(r.relation)} — ${escapeHtml(r.note || "")}</li>`).join("")}</ul></div>` : ""}
          ${wins.length ? `<div class="focus-rec-block focus-rec-block--win"><strong>Возможности</strong><ul>${wins.map((r) => `<li>${escapeHtml(r.relation)} — ${escapeHtml(r.note || "")}</li>`).join("")}</ul></div>` : ""}
          <p class="focus-rec-muted">Эпохи: <code>${escapeHtml(s.appearsIn)}</code>→<code>${escapeHtml(s.becomesCoreIn)}</code></p>
        `;
        return;
      }
      const hash = (location.hash || "").replace(/^#/, "");
      const em = /^era-([A-K])$/i.exec(hash);
      if (em) {
        const era = architecture.eras.find((e) => e.id === em[1].toUpperCase());
        if (era) {
          const t = era.transition || {};
          const to = t.to == null || t.to === "" ? "—" : String(t.to);
          const goals = Array.isArray(era.goals) ? era.goals.slice(0, 3) : [];
          const limits = Array.isArray(era.limits) ? era.limits.slice(0, 3) : [];
          host.innerHTML = `
            <div class="focus-rec-current"><strong>Эпоха ${escapeHtml(era.id)} → ${escapeHtml(to)}:</strong> ${escapeHtml(era.title)}</div>
            <p class="focus-rec-muted">${escapeHtml(truncateText(t.condition, 140))}</p>
            <button type="button" class="focus-rec-quick-btn" data-era-compare-open="${escapeHtml(era.id)}">Сравнить эпоху ⇔</button>
            ${goals.length ? `<div class="focus-rec-block focus-rec-block--win"><strong>Цели</strong><ul>${goals.map((g) => `<li>${escapeHtml(truncateText(g, 100))}</li>`).join("")}</ul></div>` : ""}
            ${limits.length ? `<div class="focus-rec-block focus-rec-block--risk"><strong>Ограничения</strong><ul>${limits.map((g) => `<li>${escapeHtml(truncateText(g, 100))}</li>`).join("")}</ul></div>` : ""}
          `;
          return;
        }
      }
      host.innerHTML = `
        <div class="focus-rec-current"><strong>Текущий фокус:</strong> системный каркас → сквозные линии → переходы A–B–C</div>
        <p class="focus-rec-muted">Кликните узел на схеме, ячейку матрицы или эпоху на шкале A–K.</p>
        <div class="focus-rec-quick" role="group" aria-label="Быстрый фокус">
          <button type="button" class="focus-rec-quick-btn" data-action-era="B">Эпоха B</button>
          <button type="button" class="focus-rec-quick-btn" data-action-era="C">Эпоха C</button>
          <button type="button" class="focus-rec-quick-btn" data-action-era="D">Эпоха D</button>
          <button type="button" class="focus-rec-quick-btn" data-action-system="goals">Цели</button>
          <button type="button" class="focus-rec-quick-btn" data-action-system="governance">Управление</button>
          <button type="button" class="focus-rec-quick-btn" data-action-system="ui">Интерфейс</button>
        </div>
      `;
    }

    function renderSystemFocusPanel() {
      renderEntityInspectorPanel();
    }

    function renderTransitionPanel() {
      const body = document.getElementById("transition-panel-body");
      if (!body) return;
      const eras = architecture.eras || [];
      const q = state.search;
      const rows = eras
        .map((era) => {
          const t = era.transition;
          if (!t) return "";
          const to = t.to;
          const toLabel = to == null || to === "" ? "—" : String(to);
          const cl = Array.isArray(t.checklist) ? t.checklist.length : 0;
          const head = `${escapeHtml(era.id)} → ${escapeHtml(toLabel)}`;
          const eraLine = truncateText(era.title, 48);
          const condShort = truncateText(t.condition, 72);
          return `<details class="transition-row"><summary><button type="button" class="transition-era-focus entity-link" data-entity-select="transition" data-entity-id="${escapeHtml(era.id)}"><strong>${head}</strong></button><span class="transition-era-title">${escapeHtml(eraLine)}</span><span class="transition-preview">${escapeHtml(condShort)}</span> <span class="transition-checkcount">${cl} п.</span></summary>
            <p class="transition-cond">${highlightPlain(String(t.condition || ""), q)}</p>
          </details>`;
        })
        .join("");
      body.innerHTML = rows || '<div class="empty-state">Нет данных переходов.</div>';
    }

    function renderProgressionRightNav() {
      const host = document.getElementById("progression-right-nav");
      if (!host) return;
      const list = architecture.systemProgression || [];
      if (!list.length) {
        host.innerHTML = '<div class="empty-state">Нет сквозных систем.</div>';
        return;
      }
      const palette = ["#9fd6ff", "#7dffb0", "#f5cf67", "#b98cff"];
      const polygons = list
        .map((entry, idx) => {
          const pts = progressionRadarPolygon(entry.byEra);
          const color = palette[idx % palette.length];
          const cov = Math.round(progressionEraCoverage(entry.byEra) * 100);
          return `<polygon class="progression-radar-poly" data-progression-jump="${escapeHtml(entry.systemId)}" role="button" tabindex="0" points="${pts}" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="1.2" opacity="0.92"><title>${escapeHtml(entry.title)} — ${cov}% эпох A–K. Клик — перейти</title></polygon>`;
        })
        .join("");
      host.innerHTML = `<div class="progression-right-wrap">
        <svg class="progression-radar" viewBox="0 0 100 100" aria-hidden="true"><polygon class="progression-radar-ring" points="50,12 88,50 50,88 12,50"/><polygon class="progression-radar-ring progression-radar-ring--inner" points="50,28 72,50 50,72 28,50"/>${polygons}</svg>
        <div class="progression-right-links">${list
          .map(
            (e) =>
              `<button type="button" class="progression-right-link entity-link" data-entity-select="systemProgression" data-entity-id="${escapeHtml(e.systemId)}">${escapeHtml(e.title)}</button>`
          )
          .join("")}</div></div>`;
    }

    function renderRightColumn() {
      renderSystemFocusPanel();
      renderTransitionPanel();
      renderProgressionRightNav();
    }

    function scrollToEra(eraId) {
      const el = document.getElementById(`era-${eraId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function applyHashFromUrl() {
      if (applyEntityHashFromUrl()) {
        syncEraSpineActiveFromHash();
        return;
      }
      const hash = (location.hash || "").replace(/^#/, "");
      const sm = /^system-([a-z0-9_]+)$/i.exec(hash);
      if (sm) {
        const id = sm[1];
        if (getSystemById(id) && state.focusedSystemId !== id) {
          state.applyingHash = true;
          selectEntity("system", id, { updateHash: false, scroll: true });
          state.applyingHash = false;
        }
        syncEraSpineActiveFromHash();
        return;
      }
      const m = /^era-([A-K])$/i.exec(hash);
      if (m) {
        if (state.focusedSystemId) {
          state.focusedSystemId = null;
          state.matrixHighlightSystemId = null;
          state.hoveredSystemId = null;
          applyMainlineHighlightClasses();
          renderSystemFocusPanel();
          renderFocusRecommendations();
          syncMatrixFocusRenders();
        }
        state.applyingHash = true;
        setEraFocus(m[1].toUpperCase(), { updateHash: false, scrollInspector: true, openTimeline: false });
        state.applyingHash = false;
        scrollSpineCardIntoView(m[1].toUpperCase());
        highlightTimelineEraCard(m[1].toUpperCase());
      } else {
        clearEraFocus();
      }
      syncEraSpineActiveFromHash();
    }

    function highlightTimelineEraCard(eraId) {
      document.querySelectorAll("#timeline-grid .era-card").forEach((el) => {
        el.classList.toggle("era-card--hash-focus", !!(eraId && el.id === `era-${eraId}`));
      });
    }

    function setAllPeriodDetails(open) {
      document.querySelectorAll("#timeline-grid details.era-sec").forEach((d) => {
        if (d.querySelector(".era-sec-sum")?.textContent?.startsWith("Периоды")) {
          d.open = open;
        }
      });
    }

    function renderTimeline() {
      const timeline = document.getElementById("timeline-grid");
      const visibleEras = architecture.eras.filter(isEraVisible);
      timeline.style.setProperty("--era-count", Math.max(visibleEras.length, 1));

      if (!visibleEras.length) {
        timeline.innerHTML = '<div class="empty-state">По текущим фильтрам эпохи не найдены.</div>';
        return;
      }

      timeline.innerHTML = visibleEras.map((era) => renderEraCard(era)).join("");

      if (state.periodsCollapsed) {
        setAllPeriodDetails(false);
      } else if (state.viewMode === "detailed" || state.viewMode === "balanced") {
        setAllPeriodDetails(state.viewMode === "detailed");
      }
      const hash = (location.hash || "").replace(/^#/, "");
      const em = /^era-([A-K])$/i.exec(hash);
      if (em) highlightTimelineEraCard(em[1].toUpperCase());
    }

    function renderSystemsMatrix() {
      const matrix = document.getElementById("systems-matrix");
      const eras = architecture.eras.filter(isEraVisible);
      const systems = architecture.systems.filter((system) => {
        const byStatus = state.status === "all" || system.status === state.status;
        const bySearch = includesText(system, state.search);
        return byStatus && bySearch;
      });

      matrix.classList.toggle("has-matrix-highlight", !!state.matrixHighlightSystemId);

      if (!eras.length) {
        matrix.innerHTML =
          '<div class="empty-state">Нет эпох по текущим фильтрам — матрица скрыта.</div>';
        return;
      }

      matrix.style.setProperty("--era-count", Math.max(eras.length, 1));

      const activeCols = matrixActiveEraIdSet(eras, state.matrixHighlightSystemId);

      const header = [
        '<div class="cell head corner">Система <span class="matrix-hint">(строка / столбец / ячейка)</span></div>',
        ...eras.map(
          (era) =>
            `<button type="button" class="cell head matrix-era-head${activeCols.has(era.id) ? " is-matrix-col-highlight" : ""}" data-matrix-era="${escapeHtml(era.id)}" title="Фокус на эпохе ${escapeHtml(era.id)}">${escapeHtml(era.id)}<small>${escapeHtml(era.title)}</small></button>`
        )
      ].join("");

      const rows = systems
        .map((system) => {
          const cells = eras
            .map((era) => {
              const phase = systemPhase(system, era.id);
              const colH = activeCols.has(era.id) ? " is-matrix-col-highlight" : "";
              const rowH = state.matrixHighlightSystemId === system.id ? " is-matrix-row-selected" : "";
              const cellTitle = `${system.title} · ${era.id}: ${phase.label}`;
              return `<button type="button" class="cell matrix-phase-cell ${phase.level}${colH}${rowH}" data-matrix-cell-system="${escapeHtml(system.id)}" data-matrix-era="${escapeHtml(era.id)}" title="${escapeHtml(cellTitle)}">${escapeHtml(phase.label)}<small>${escapeHtml(phase.note)}</small></button>`;
            })
            .join("");
          const rowSel =
            state.matrixHighlightSystemId === system.id ? " is-matrix-row-selected" : "";
          return `
          <div role="button" tabindex="0" class="cell system${rowSel}" data-matrix-system="${escapeHtml(system.id)}" title="Подсветить эпохи, где система уже в игре">${escapeHtml(system.title)}<small>${escapeHtml(system.description)}</small></div>
          ${cells}`;
        })
        .join("");

      matrix.innerHTML = systems.length
        ? header + rows
        : '<div class="empty-state">По текущим фильтрам системы не найдены.</div>';
    }

    function renderCoreSystems() {
      const root = document.getElementById("core-systems-root");
      if (!root) return;
      const canonicalSet = new Set(CANONICAL_SYSTEM_IDS);
      const titleMap = buildSystemTitleMap(architecture.systems);
      const cat = state.coreSystemsCategory || "all";
      const query = state.search;
      const list = CANONICAL_SYSTEM_IDS.map((id) => architecture.systems.find((s) => s && s.id === id)).filter(
        Boolean
      );
      const filtered = list.filter((s) => {
        if (cat !== "all" && s.category !== cat) return false;
        const byStatus = state.status === "all" || s.status === state.status;
        return byStatus && includesText(s, query);
      });
      const chips = `<div class="core-systems-toolbar" role="toolbar" aria-label="Фильтр категории каркаса">
          <span class="core-systems-toolbar-label">Категория:</span>
          <button type="button" class="core-systems-cat${cat === "all" ? " is-active" : ""}" data-core-systems-cat="all">все</button>
          <button type="button" class="core-systems-cat${cat === "spine" ? " is-active" : ""}" data-core-systems-cat="spine">spine</button>
          <button type="button" class="core-systems-cat${cat === "core" ? " is-active" : ""}" data-core-systems-cat="core">core</button>
        </div>`;
      function relBlock(sys) {
        const rs = sys.relatedSystems;
        if (!Array.isArray(rs) || !rs.length) return "";
        const rows = rs
          .map((r) => {
            const sid = r && r.systemId != null ? String(r.systemId) : "";
            const relation = r && r.relation != null ? String(r.relation) : "";
            const note = r && r.note != null ? String(r.note) : "";
            const tl = (sid && titleMap.get(sid)) || sid || "—";
            const hasMainCard = !!(sid && canonicalSet.has(sid));
            const nameHtml = hasMainCard
              ? renderEntityChip("system", sid, tl)
              : `<span class="core-related-label">${markInEscaped(escapeHtml(tl), query)}</span>`;
            const missing = hasMainCard ? "" : ` <span class="core-related-missing-badge">нет карточки</span>`;
            return `<li class="core-related-item"><div class="core-related-head">${nameHtml}${missing}<span class="core-related-relation"> — ${escapeHtml(relation)}</span></div><p class="core-related-note">${highlightPlain(String(note), query)}</p></li>`;
          })
          .join("");
        return `<section class="core-related" aria-label="Связанные системы"><h4 class="core-related-title">Связанные системы</h4><ul class="core-related-list">${rows}</ul></section>`;
      }
      if (!filtered.length) {
        root.innerHTML = chips + '<div class="empty-state">По текущим фильтрам нет систем каркаса.</div>';
        return;
      }
      const cards = filtered
        .map((s) => {
          const m = query && includesText(s, query) ? " is-search-match" : "";
          const catpill = s.category
            ? `<span class="core-system-cat-pill core-system-cat-pill--${escapeHtml(s.category)}">${escapeHtml(s.category)}</span>`
            : "";
          const meta = `<dl class="core-system-meta"><div><dt>Эпохи</dt><dd><code>${escapeHtml(s.appearsIn)}</code> → <code>${escapeHtml(s.becomesCoreIn)}</code></dd></div></dl>`;
          const roleLine =
            s.roleInGame && String(s.roleInGame).trim()
              ? `<p class="core-system-role"><strong>В игре:</strong> ${highlightPlain(String(s.roleInGame), query)}</p>`
              : "";
          const onDiagram = isOnMainlineDiagram(s.id);
          const diagramBtn = onDiagram
            ? `<button type="button" class="core-system-diagram-btn" data-focus-mainline="${escapeHtml(s.id)}">На схеме</button>`
            : "";
          return `<article class="core-system-card entity-link-card${m}" tabindex="0" data-entity-select="system" data-entity-id="${escapeHtml(s.id)}" id="core-system-card-${escapeHtml(s.id)}">
          <header class="core-system-card-head"><h3 class="core-system-card-title">${markInEscaped(escapeHtml(s.title), query)}</h3>${catpill}${createStatusPill(s.status)}${diagramBtn}</header>
          <p class="core-system-sum">${highlightPlain(String(s.summary || ""), query)}</p>
          ${roleLine}
          ${meta}
          ${relBlock(s)}
        </article>`;
        })
        .join("");
      root.innerHTML = chips + `<div class="core-systems-grid">${cards}</div>`;
    }

    function progressionEraRowVisible(eraId) {
      return !state.visibleEraIds || !state.visibleEraIds.length || state.visibleEraIds.includes(eraId);
    }

    function buildSystemTitleMap(systems) {
      const map = new Map();
      (systems || []).forEach((s) => {
        if (s && s.id) map.set(s.id, s.title || s.id);
      });
      return map;
    }

    function renderSystemRelatedBlock(entry, progressionIdSet, systemTitleMap, query) {
      const rel = entry.relatedSystems;
      if (!Array.isArray(rel) || !rel.length) return "";
      const rows = rel
        .map((r) => {
          const sid = r && r.systemId != null ? String(r.systemId) : "";
          const relation = r && r.relation != null ? String(r.relation) : "";
          const note = r && r.note != null ? String(r.note) : "";
          const title = (sid && systemTitleMap.get(sid)) || sid || "—";
          const hasProg = !!(sid && progressionIdSet.has(sid));
          const nameHtml = hasProg
            ? renderEntityChip("systemProgression", sid, title)
            : getSystemById(sid)
              ? renderEntityChip("system", sid, title)
              : `<span class="related-system-label">${markInEscaped(escapeHtml(title), query)}</span>`;
          const missing = hasProg
            ? ""
            : ` <span class="related-system-missing-badge" title="Нет карточки в systemProgression">ещё не описано</span>`;
          return `<li class="related-system-item">
            <div class="related-system-head">${nameHtml}${missing}<span class="related-system-relation"> — ${escapeHtml(relation)}</span></div>
            <p class="related-system-note">${highlightPlain(note, query)}</p>
          </li>`;
        })
        .join("");
      const rid = escapeHtml(entry.systemId || "sys");
      return `<section class="system-progression-related" aria-labelledby="related-title-${rid}">
        <h4 class="system-progression-related-title" id="related-title-${rid}">Связанные системы</h4>
        <ul class="system-progression-related-list">${rows}</ul>
      </section>`;
    }

    function renderSystemProgression() {
      const root = document.getElementById("system-progression-root");
      if (!root) return;
      const list = architecture.systemProgression;
      if (!Array.isArray(list) || !list.length) {
        root.innerHTML =
          '<div class="empty-state">В data нет массива <code>systemProgression</code> или он пуст.</div>';
        return;
      }
      const progressionIdSet = new Set(list.map((e) => e && e.systemId).filter(Boolean));
      const systemTitleMap = buildSystemTitleMap(architecture.systems);
      const items = list.filter((entry) => {
        const byStatus = state.status === "all" || entry.status === state.status;
        const bySearch = includesText(entry, state.search);
        return byStatus && bySearch;
      });
      if (!items.length) {
        root.innerHTML =
          '<div class="empty-state">По текущим фильтрам сквозные системы не найдены.</div>';
        return;
      }
      const query = state.search;
      const nav =
        items.length > 1
          ? `<nav class="system-progression-local-nav" aria-label="Навигация по сквозным системам">${items
              .map((e, i) => {
                const sep =
                  i > 0 ? '<span class="sys-prog-nav-sep" aria-hidden="true">|</span>' : "";
                return `${sep}<button type="button" class="sys-prog-nav-link entity-link" data-entity-select="systemProgression" data-entity-id="${escapeHtml(e.systemId)}">${escapeHtml(e.title)}</button>`;
              })
              .join("")}</nav>`
          : "";
      const cards = items
        .map((entry) => {
          const matchClass = query && includesText(entry, query) ? " is-search-match" : "";
          const eraRows = [...ERA_ORDER].filter((eid) => progressionEraRowVisible(eid));
          const tableBody = eraRows
            .map((eid) => {
              const text = entry.byEra && entry.byEra[eid];
              if (text == null || !String(text).trim()) return "";
              return `<tr><th scope="row">${escapeHtml(eid)}</th><td>${highlightPlain(String(text), query)}</td></tr>`;
            })
            .join("");
          const tableBlock = tableBody.trim()
            ? `<table class="system-progression-table"><thead><tr><th scope="col">Эпоха</th><th scope="col">Линия системы</th></tr></thead><tbody>${tableBody}</tbody></table>`
            : `<div class="empty-state">При выбранном фильтре эпох нет строк для этой системы.</div>`;
          const notes =
            Array.isArray(entry.designNotes) && entry.designNotes.length
              ? `<div class="system-progression-notes"><p class="system-progression-notes-title">Заметки дизайна</p><ul class="system-progression-notes-list">${entry.designNotes
                  .map((n) => `<li>${highlightPlain(String(n), query)}</li>`)
                  .join("")}</ul></div>`
              : "";
          const relatedBlock = renderSystemRelatedBlock(entry, progressionIdSet, systemTitleMap, query);
          return `
        <article class="system-progression-card entity-link-card${matchClass}" data-entity-select="systemProgression" data-entity-id="${escapeHtml(entry.systemId)}" id="system-progression-${escapeHtml(entry.systemId)}">
          <header class="system-progression-card-head">
            <h3 class="system-progression-card-title">${markInEscaped(escapeHtml(entry.title), query)}</h3>
            <div class="system-progression-card-actions">
              ${createStatusPill(entry.status)}
              <button type="button" class="entity-action-btn entity-action-btn--inline sys-prog-show-system" data-entity-select="system" data-entity-id="${escapeHtml(entry.systemId)}" data-stop-card-select="1">Система</button>
            </div>
          </header>
          <p class="system-progression-sum">${markInEscaped(escapeHtml(entry.summary), query)}</p>
          <p class="system-progression-meta"><code>${escapeHtml(entry.systemId)}</code></p>
          ${relatedBlock}
          ${tableBlock}
          ${notes}
        </article>`;
        })
        .join("");
      root.innerHTML = nav + cards;
    }

    function renderDependencies() {
      const list = document.getElementById("dependencies-list");
      const dependencies = architecture.dependencies.filter((d) => includesText(d, state.search));
      const matchClass = (d) => (state.search && includesText(d, state.search) ? " is-search-match" : "");
      list.innerHTML = dependencies.length
        ? dependencies
            .map(
              (dependency) => `
        <article class="dependency-card entity-link-card${matchClass(dependency)}" tabindex="0" data-entity-select="dependency" data-entity-id="${escapeHtml(dependencyEntityId(dependency))}">
          <h3 class="dependency-title">
            ${renderEntityChip("system", dependency.from, dependency.from)} → ${renderEntityChip("system", dependency.to, dependency.to)}
            <span class="dependency-type">${escapeHtml(dependencyTypeLabels[dependency.type] || dependency.type)}</span>
          </h3>
          <p>${markInEscaped(escapeHtml(dependency.description), state.search)}</p>
        </article>`
            )
            .join("")
        : '<div class="empty-state">По текущему поиску зависимости не найдены.</div>';
    }

    function renderRoadmap() {
      const list = document.getElementById("roadmap-list");
      const items = architecture.roadmap.filter((item) => {
        const byStatus = state.status === "all" || item.status === state.status;
        return byStatus && includesText(item, state.search);
      });
      const matchClass = (item) => (state.search && includesText(item, state.search) ? " is-search-match" : "");
      list.innerHTML = items.length
        ? items
            .map(
              (item) => `
        <article class="roadmap-item entity-link-card${matchClass(item)}" tabindex="0" data-entity-select="roadmap" data-entity-id="${escapeHtml(item.id)}">
          <h3>${markInEscaped(escapeHtml(item.title), state.search)}</h3>
          ${createStatusPill(item.status)}
          <p>${markInEscaped(escapeHtml(item.summary), state.search)}</p>
          ${
            item.checklist && item.checklist.length
              ? `<ul class="roadmap-checklist">${item.checklist
                  .map((c) => `<li>${markInEscaped(escapeHtml(c), state.search)}</li>`)
                  .join("")}</ul>`
              : ""
          }
        </article>`
            )
            .join("")
        : '<div class="empty-state">По текущим фильтрам этапы не найдены.</div>';
    }

    function catalogIntersectsVisibleEras(item) {
      if (!state.visibleEraIds || !state.visibleEraIds.length) return true;
      const a = ERA_ORDER.indexOf(item.eraFrom);
      const b = ERA_ORDER.indexOf(item.eraTo);
      if (a < 0 || b < 0) return true;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return state.visibleEraIds.some((eid) => {
        const i = ERA_ORDER.indexOf(eid);
        return i >= lo && i <= hi;
      });
    }

    function filterGameCatalogItems(items, catalogKind) {
      if (!items) return [];
      return items.filter((item) => {
        const byStatus = state.status === "all" || item.status === state.status;
        const bySearch = includesText(item, state.search);
        const byEra = catalogIntersectsVisibleEras(item);
        const byFocus = catalogKind ? catalogItemPassesFocus(item, catalogKind) : true;
        return byStatus && bySearch && byEra && byFocus;
      });
    }

    const CATALOG_RESOURCE_SYSTEM_IDS = {
      food: ["resources", "needs", "storage"],
      drink: ["resources", "needs"],
      fuel: ["resources", "production", "storage"],
      material: ["resources", "buildings", "production"],
      fiber: ["resources", "production"],
      metal_input: ["resources", "production", "trade"],
      metal_product: ["production", "economy"],
      trade_good: ["trade", "resources", "economy"],
      chemical: ["production", "research", "knowledge"],
      energy_carrier: ["production", "buildings", "economy"],
      information: ["knowledge", "research", "ui"],
      space_material: ["resources", "logistics"],
      space_volatiles: ["resources", "logistics"]
    };

    const CATALOG_ENTERPRISE_SYSTEM_IDS = {
      housing: ["buildings", "people", "needs"],
      production: ["production", "buildings", "labor"],
      trade: ["trade", "economy", "logistics"],
      civic: ["governance", "economy"],
      military: ["security", "governance"],
      energy: ["production", "buildings"],
      logistics: ["logistics", "trade"],
      information: ["knowledge", "ui", "research"],
      space: ["logistics", "production", "buildings"]
    };

    function resolveCatalogSystemIds(item, catalogKind) {
      if (item.systemIds && item.systemIds.length) return item.systemIds;
      if (catalogKind === "ent" && item.type) {
        return CATALOG_ENTERPRISE_SYSTEM_IDS[item.type] || ["buildings", "production"];
      }
      if (catalogKind === "resch") return ["research", "knowledge"];
      if (catalogKind === "tech") return ["research", "production"];
      const cat = item.category;
      return CATALOG_RESOURCE_SYSTEM_IDS[cat] || ["resources"];
    }

    function renderGameCatalog() {
      const root = document.getElementById("game-catalog-root");
      if (!root) return;
      const gc = architecture.gameCatalog || {};
      const resources = filterGameCatalogItems(architecture.gameResources || [], "resource");
      const research = filterGameCatalogItems(architecture.gameResearch || [], "research");
      const tech = filterGameCatalogItems(architecture.gameTechnologies || [], "technology");
      const ent = filterGameCatalogItems(architecture.gameEnterprises || [], "enterprise");
      const focusBanner = state.catalogFocus
        ? `<p class="game-catalog-focus-banner">Показаны записи${
            state.catalogFocus.systemId
              ? ` для системы <code>${escapeHtml(state.catalogFocus.systemId)}</code>`
              : ""
          }${
            state.catalogFocus.eraId ? ` в эпохе <code>${escapeHtml(state.catalogFocus.eraId)}</code>` : ""
          }${
            state.catalogFocus.kinds && state.catalogFocus.kinds.length
              ? ` (${escapeHtml(state.catalogFocus.kinds.join(", "))})`
              : ""
          }. <button type="button" class="entity-action-btn entity-action-btn--inline" data-catalog-focus-clear>Сбросить</button></p>`
        : "";

      function cardHtml(item, opts) {
        const catalogKind =
          opts.catalogKind === "res"
            ? "resource"
            : opts.catalogKind === "resch"
              ? "research"
              : opts.catalogKind === "tech"
                ? "technology"
                : "enterprise";
        const focusMatch = !state.catalogFocus || catalogItemPassesFocus(item, catalogKind);
        const match = state.search && includesText(item, state.search) ? " is-search-match" : "";
        const focusClass = focusMatch && state.catalogFocus ? " catalog-entity-card--focus-match" : "";
        const mutedClass = state.catalogFocus && !focusMatch ? " entity-card--muted" : "";
        const eraPill = `<span class="game-pill game-pill-era">${escapeHtml(item.eraFrom)}–${escapeHtml(item.eraTo)}</span>`;
        const cat = item.category || item.type;
        const catPill = cat
          ? `<span class="game-pill game-pill-cat">${escapeHtml(cat)}</span>`
          : "";
        const passportLevel = catalogPassportLevel(item);
        const passportPill = `<span class="game-pill game-pill-passport game-pill-passport--${passportLevel}">паспорт: ${passportLevel === "extended" ? "расширенный" : "базовый"}</span>`;
        let extra = "";
        if (opts.unlocks && item.unlocks && item.unlocks.length)
          extra += `<p class="game-extra"><strong>Открывает:</strong> ${item.unlocks
            .map((u) => highlightPlain(String(u), state.search))
            .join(", ")}</p>`;
        if (opts.requires && item.requires && item.requires.length)
          extra += `<p class="game-extra"><strong>Нужно:</strong> ${item.requires
            .map((u) => highlightPlain(String(u), state.search))
            .join(", ")}</p>`;
        const sysIds = resolveCatalogSystemIds(item, opts.catalogKind);
        if (sysIds.length) {
          const links = sysIds
            .map((sid) => {
              const sys = architecture.systems.find((s) => s && s.id === sid);
              const label = sys ? sys.title : sid;
              const inferred = !(item.systemIds && item.systemIds.length);
              return `<button type="button" class="game-system-link entity-link${inferred ? " game-system-link--inferred" : ""}" data-entity-select="system" data-entity-id="${escapeHtml(sid)}" title="${inferred ? "Проектная привязка по категории" : "Привязка в data.js"}">${escapeHtml(label)}</button>`;
            })
            .join("");
          extra += `<p class="game-extra game-system-links"><strong>Системы:</strong> ${links}</p>`;
        }
        const catalogEntityKind =
          opts.catalogKind === "res"
            ? "resource"
            : opts.catalogKind === "resch"
              ? "research"
              : opts.catalogKind === "tech"
                ? "technology"
                : "enterprise";
        return `
        <article class="game-card catalog-entity-card entity-link-card${match}${focusClass}${mutedClass}" tabindex="0" data-entity-select="${catalogEntityKind}" data-entity-id="${escapeHtml(item.id)}" id="game-${escapeHtml(opts.prefix)}-${escapeHtml(item.id)}">
          <h3 class="game-card-title">${markInEscaped(escapeHtml(item.title), state.search)}</h3>
          <div class="game-card-meta">${eraPill}${catPill}${createStatusPill(item.status)}${passportPill}</div>
          <p class="game-card-sum">${markInEscaped(escapeHtml(item.summary), state.search)}</p>
          ${extra}
        </article>`;
      }

      function block(title, items, opts) {
        if (!items.length)
          return `<div class="game-catalog-block"><h3 class="game-catalog-block-title">${escapeHtml(title)}</h3><div class="empty-state">По фильтрам нет записей.</div></div>`;
        return `<div class="game-catalog-block"><h3 class="game-catalog-block-title">${escapeHtml(title)}</h3><div class="game-grid">${items
          .map((it) => cardHtml(it, opts))
          .join("")}</div></div>`;
      }

      root.innerHTML = `
        <div class="game-catalog-intro">
          <p><strong>${escapeHtml(gc.title || "Каталог")}.</strong> ${markInEscaped(escapeHtml(gc.summary || ""), state.search)}</p>
          ${focusBanner}
        </div>
        ${block("Ресурсы", resources, { prefix: "res", catalogKind: "res" })}
        ${block("Исследования (темы и ветки)", research, { prefix: "resch", catalogKind: "resch", unlocks: true })}
        ${block("Технологии (применимые методы)", tech, { prefix: "tech", catalogKind: "tech", requires: true })}
        ${block("Предприятия и узлы", ent, { prefix: "ent", catalogKind: "ent" })}
      `;
    }

    function renderScreens() {
      const list = document.getElementById("screens-list");
      const items = architecture.uiScreens.filter((screen) => {
        const byStatus = state.status === "all" || screen.status === state.status;
        return byStatus && includesText(screen, state.search);
      });
      const matchClass = (s) => (state.search && includesText(s, state.search) ? " is-search-match" : "");
      list.innerHTML = items.length
        ? items
            .map(
              (screen) => `
        <article class="screen-card entity-link-card catalog-entity-card${matchClass(screen)}" tabindex="0" data-entity-select="uiScreen" data-entity-id="${escapeHtml(screen.id)}" id="screen-card-${escapeHtml(screen.id)}">
          <h3>${markInEscaped(escapeHtml(screen.title), state.search)}</h3>
          ${createStatusPill(screen.status)}
          <p><strong>Эпоха ${escapeHtml(screen.appearsIn)}.</strong> ${markInEscaped(escapeHtml(screen.summary), state.search)}</p>
        </article>`
            )
            .join("")
        : '<div class="empty-state">По текущим фильтрам экраны не найдены.</div>';
    }

    function renderAll() {
      applyDashboardShellClass();
      renderSidebarNav();
      renderSidebarStats();
      renderEraSpine();
      syncEraSpineActiveFromHash();
      renderEraInspector();
      renderBridgePanel();
      renderPrototypeDashPanel();
      renderEraComparePanel();
      renderMainlineMap();
      renderDashboardMatrixPreview();
      renderFocusRecommendations();
      syncEntitySelectionDom();
      renderRightColumn();
      renderTimeline();
      renderSystemsMatrix();
      renderCoreSystems();
      renderSystemProgression();
      renderPrototypeMappingSection();
      renderGameCatalog();
      renderDependencies();
      renderRoadmap();
      renderScreens();
      syncEraSpineActiveFromHash();
    }

    function focusSystemFromHeatmap(systemId) {
      if (state.selectedEntity && state.selectedEntity.kind === "system" && state.selectedEntity.id === systemId) {
        clearSelectedEntity();
        clearSystemFocus();
      } else {
        selectEntity("system", systemId, { scroll: true, scrollInspector: true });
      }
    }

    function focusMatrixInteraction(systemId, eraId, opts) {
      opts = opts || {};
      if (eraId) {
        state.focusedEraId = eraId;
        highlightTimelineEraCard(eraId);
        scrollSpineCardIntoView(eraId);
        if (opts.scrollEra !== false) {
          openLowerSection("lower-gate-timeline");
          scrollToEra(eraId);
        }
        renderBridgePanel();
        renderPrototypeDashPanel();
        syncEraSpineActiveFromHash();
      }
      if (systemId && getSystemById(systemId)) {
        selectEntity("system", systemId, { scroll: !!opts.scrollSystem, updateHash: true });
      } else if (eraId) {
        selectEntity("era", eraId, { scrollInspector: true, updateHash: true });
      }
    }

    function handleMapInteractionClick(event) {
      if (event.target.closest && event.target.closest("[data-entity-select]")) return false;
      const spineBtn = event.target.closest && event.target.closest("[data-era-spine]");
      if (spineBtn) {
        event.preventDefault();
        selectEntity("era", spineBtn.getAttribute("data-era-spine"), { scrollInspector: true });
        return true;
      }
      const edgeBtn = event.target.closest && event.target.closest("[data-edge-highlight]");
      if (edgeBtn) {
        event.preventDefault();
        flashMainlineEdgeKind(edgeBtn.getAttribute("data-edge-highlight"));
        return true;
      }
      const actionEra = event.target.closest && event.target.closest("[data-action-era]");
      if (actionEra) {
        event.preventDefault();
        const id = actionEra.getAttribute("data-action-era");
        if (state.focusedSystemId) {
          state.focusedSystemId = null;
          state.matrixHighlightSystemId = null;
          state.hoveredSystemId = null;
          applyMainlineHighlightClasses();
          renderSystemFocusPanel();
          syncMatrixFocusRenders();
        }
        focusEraFromSpine(id, { scrollInspector: true });
        return true;
      }
      const actionSys = event.target.closest && event.target.closest("[data-action-system]");
      if (actionSys) {
        event.preventDefault();
        selectEntity("system", actionSys.getAttribute("data-action-system"), { scroll: true });
        document.getElementById("section-mainline")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      const eraFocus = event.target.closest && event.target.closest("[data-era-focus]");
      if (eraFocus) {
        event.preventDefault();
        event.stopPropagation();
        const id = eraFocus.getAttribute("data-era-focus");
        if (state.focusedSystemId) {
          state.focusedSystemId = null;
          state.matrixHighlightSystemId = null;
          state.hoveredSystemId = null;
          applyMainlineHighlightClasses();
          renderSystemFocusPanel();
          syncMatrixFocusRenders();
        }
        selectEntity("era", id, { scrollInspector: true, scroll: true });
        scrollSpineCardIntoView(id);
        highlightTimelineEraCard(id);
        return true;
      }
      const eraScroll = event.target.closest && event.target.closest("[data-era-scroll]");
      if (eraScroll) {
        event.preventDefault();
        openLowerSection("lower-gate-timeline");
        const id = eraScroll.getAttribute("data-era-scroll");
        scrollToEra(id);
        highlightTimelineEraCard(id);
        setEraFocus(id, { scrollInspector: false, openTimeline: true });
        return true;
      }
      const chipEra = event.target.closest && event.target.closest("[data-era-chip-focus]");
      if (chipEra) {
        event.preventDefault();
        const id = chipEra.getAttribute("data-era-chip-focus");
        focusEraFromSpine(id, { scrollInspector: true });
        return true;
      }
      const matrixEra = event.target.closest && event.target.closest("[data-matrix-era]");
      if (matrixEra && !event.target.closest("[data-matrix-cell-system]")) {
        event.preventDefault();
        const id = matrixEra.getAttribute("data-matrix-era");
        focusEraFromSpine(id, { scrollInspector: true });
        return true;
      }
      const matrixCell = event.target.closest && event.target.closest("[data-matrix-cell-system]");
      if (matrixCell) {
        event.preventDefault();
        focusMatrixInteraction(
          matrixCell.getAttribute("data-matrix-cell-system"),
          matrixCell.getAttribute("data-matrix-era"),
          { scrollSystem: true, scrollEra: true }
        );
        return true;
      }
      const heatCell = event.target.closest && event.target.closest("[data-heatmap-cell]");
      if (heatCell) {
        event.preventDefault();
        focusMatrixInteraction(
          heatCell.getAttribute("data-heatmap-cell"),
          heatCell.getAttribute("data-heatmap-era"),
          { scrollSystem: true, scrollEra: false }
        );
        document.getElementById("section-mainline")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return true;
      }
      const heatSys = event.target.closest && event.target.closest("[data-heatmap-system]");
      if (heatSys) {
        event.preventDefault();
        focusSystemFromHeatmap(heatSys.getAttribute("data-heatmap-system"));
        return true;
      }
      const progJump = event.target.closest && event.target.closest("[data-progression-jump]");
      if (progJump) {
        event.preventDefault();
        const sid = progJump.getAttribute("data-progression-jump");
        selectEntity("systemProgression", sid, { scroll: true });
        openLowerSection("lower-gate-systems");
        const el = document.getElementById(`system-progression-${sid}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      const edgeHit = event.target.closest && event.target.closest("[data-edge-from]");
      if (edgeHit) {
        event.preventDefault();
        event.stopPropagation();
        focusMainlineEdge(
          edgeHit.getAttribute("data-edge-from"),
          edgeHit.getAttribute("data-edge-to"),
          edgeHit.getAttribute("data-edge-kind")
        );
        return true;
      }
      const compareOpen = event.target.closest && event.target.closest("[data-era-compare-open]");
      if (compareOpen) {
        event.preventDefault();
        const id = compareOpen.getAttribute("data-era-compare-open");
        openEraCompare(id, null);
        return true;
      }
      return false;
    }

    const MAINLINE_EDGE_FLASH_CLASSES = ["chain", "require", "unlock", "influence", "feedback", "goal", "infra", "manage", "aux", "dep"];

    function flashMainlineEdgeKind(kind) {
      const diagram = document.getElementById("mainline-diagram");
      if (!diagram || !kind) return;
      MAINLINE_EDGE_FLASH_CLASSES.forEach((k) => diagram.classList.remove(`mainline-diagram--edges-${k}`));
      diagram.classList.add(`mainline-diagram--edges-${kind}`);
      diagram.scrollIntoView({ behavior: "smooth", block: "nearest" });
      clearTimeout(state._edgeFlashTimer);
      state._edgeFlashTimer = setTimeout(() => {
        diagram.classList.remove(`mainline-diagram--edges-${kind}`);
      }, 2800);
    }

    function focusSystemFromCatalog(systemId) {
      if (!systemId) return;
      if (isOnMainlineDiagram(systemId)) {
        setSystemFocus(systemId, { scroll: true });
        return;
      }
      openLowerGate(true);
      openLowerSection("lower-gate-systems");
      requestAnimationFrame(() => {
        const el = document.getElementById(`core-system-card-${systemId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    function refreshTransitionChecklistUi(eraId) {
      const prog = transitionChecklistProgress(eraId);
      document.querySelectorAll(`[data-transition-era="${eraId}"]`).forEach((input) => {
        const li = input.closest(".transition-check-item");
        if (li) li.classList.toggle("is-done", input.checked);
      });
      document.querySelectorAll(".transition-checklist-progress").forEach((el) => {
        const wrap = el.closest(".transition-checklist-wrap");
        if (wrap && wrap.querySelector(`[data-transition-era="${eraId}"]`)) {
          el.textContent = `${prog.done}/${prog.total}`;
        }
      });
    }

    function initSidebarScrollSpy() {
      const links = document.querySelectorAll(".architecture-sidebar-link");
      if (!links.length) return;
      const sectionIds = [];
      links.forEach((a) => {
        const href = a.getAttribute("href");
        if (href && href.startsWith("#")) sectionIds.push(href.slice(1));
      });
      const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
      if (!sections.length) return;
      const obs = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (!visible.length) return;
          const id = visible[0].target.id;
          links.forEach((a) => {
            const href = a.getAttribute("href");
            a.classList.toggle("is-active", href === `#${id}`);
          });
        },
        { rootMargin: "-20% 0px -55% 0px", threshold: [0.08, 0.2, 0.4] }
      );
      sections.forEach((sec) => obs.observe(sec));
    }

    // --- Interactions / controls ---
    function bindControls() {
      document.getElementById("search-input").addEventListener("input", (event) => {
        state.search = event.target.value.trim();
        renderAll();
      });

      document.getElementById("status-filter").addEventListener("change", (event) => {
        state.status = event.target.value;
        renderAll();
      });

      document.getElementById("design-weight-filter").addEventListener("change", (event) => {
        state.designWeight = event.target.value;
        renderAll();
      });

      document.querySelectorAll("[data-filter-eras]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.getAttribute("data-filter-eras");
          state.visibleEraIds = key === "all" ? null : [...(ERA_GROUPS[key] || [])];
          renderAll();
        });
      });

      document.getElementById("collapse-periods").addEventListener("click", () => {
        state.periodsCollapsed = true;
        renderTimeline();
        setAllPeriodDetails(false);
      });

      document.getElementById("expand-periods").addEventListener("click", () => {
        expandAllEraDetailSections();
        renderTimeline();
        renderEraInspector();
      });

      const btnLower = document.getElementById("btn-toggle-lower-gate");
      if (btnLower) {
        btnLower.addEventListener("click", () => {
          const gate = document.getElementById("architecture-lower-gate");
          if (!gate) return;
          const willOpen = !gate.open;
          openLowerGate(willOpen);
          if (willOpen) openLowerSection("lower-gate-timeline");
        });
      }

      const btnExpandEra = document.getElementById("btn-expand-era-sections");
      if (btnExpandEra) {
        btnExpandEra.addEventListener("click", () => {
          openLowerSection("lower-gate-timeline");
          expandAllEraDetailSections();
          renderTimeline();
          renderEraInspector();
        });
      }

      const btnCompareBc = document.getElementById("btn-era-compare-bc");
      if (btnCompareBc && !btnCompareBc.dataset.bound) {
        btnCompareBc.dataset.bound = "1";
        btnCompareBc.addEventListener("click", () => toggleEraCompareBc());
      }
      const btnCompareClose = document.getElementById("btn-era-compare-close");
      if (btnCompareClose && !btnCompareClose.dataset.bound) {
        btnCompareClose.dataset.bound = "1";
        btnCompareClose.addEventListener("click", () => {
          state.eraCompareActive = false;
          renderEraComparePanel();
        });
      }

      const sidebarNav = document.getElementById("architecture-sidebar-nav");
      if (sidebarNav && !sidebarNav.dataset.bound) {
        sidebarNav.dataset.bound = "1";
        sidebarNav.addEventListener("click", (event) => {
          const link = event.target.closest("a[href^='#']");
          if (!link) return;
          const href = link.getAttribute("href");
          const lower = link.getAttribute("data-lower-section") || ANCHOR_LOWER_SECTION[href];
          if (lower) {
            openLowerSection(lower);
            state.lowerGateOpen = true;
          }
        });
      }

      document.querySelectorAll("[data-dashboard-view]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const v = btn.getAttribute("data-dashboard-view") || "detailed";
          state.dashboardView = v;
          if (v === "overview") state.viewMode = "balanced";
          else state.viewMode = "detailed";
          setDashboardViewButtons();
          applyDashboardShellClass();
          renderAll();
          if (v === "systems") {
            requestAnimationFrame(() => {
              document.getElementById("section-mainline")?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }
        });
      });

      const diagram = document.getElementById("mainline-diagram");
      if (diagram && !diagram.dataset.keyBound) {
        diagram.dataset.keyBound = "1";
        diagram.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const edge = event.target.closest("[data-edge-from]");
          if (!edge) return;
          event.preventDefault();
          focusMainlineEdge(
            edge.getAttribute("data-edge-from"),
            edge.getAttribute("data-edge-to"),
            edge.getAttribute("data-edge-kind")
          );
        });
      }

      const spineWrap = document.querySelector(".era-spine-wrap");
      if (spineWrap && !spineWrap.dataset.hoverBound) {
        spineWrap.dataset.hoverBound = "1";
        spineWrap.addEventListener("mouseover", (event) => {
          const btn = event.target.closest("[data-era-spine]");
          if (!btn) return;
          setHoveredEraColumn(btn.getAttribute("data-era-spine"));
        });
        spineWrap.addEventListener("mouseout", (event) => {
          const from = event.target.closest("[data-era-spine]");
          if (!from) return;
          const to = event.relatedTarget && event.relatedTarget.closest("[data-era-spine]");
          if (to) return;
          setHoveredEraColumn(null);
        });
      }

      if (diagram && !diagram.dataset.hoverBound) {
        diagram.dataset.hoverBound = "1";
        diagram.addEventListener("mouseover", (event) => {
          const node = event.target.closest("[data-mainline-system]");
          if (!node) return;
          const id = node.getAttribute("data-mainline-system");
          if (state.hoveredSystemId === id) return;
          state.hoveredSystemId = id;
          applyMainlineHighlightClasses();
        });
        diagram.addEventListener("mouseout", (event) => {
          const from = event.target.closest("[data-mainline-system]");
          if (!from) return;
          const to = event.relatedTarget && event.relatedTarget.closest("[data-mainline-system]");
          if (to) return;
          state.hoveredSystemId = null;
          applyMainlineHighlightClasses();
        });
      }

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".catalog-entity-card[data-entity-select]");
        if (!card || event.target.closest("button, a, input, textarea, select")) return;
        event.preventDefault();
        const kind = card.getAttribute("data-entity-select");
        const id = card.getAttribute("data-entity-id");
        if (kind && id) selectEntity(kind, id, { scroll: true });
      });

      document.addEventListener("click", (event) => {
        if (event.target.closest("[data-catalog-focus-clear]")) {
          clearCatalogFocus();
          return;
        }
        if (handleEntityActionClick(event)) return;
        if (handleEntitySelectClick(event)) return;
        if (event.target && event.target.closest("#btn-clear-system-focus")) {
          clearSelectedEntity();
          clearSystemFocus();
          clearEraFocus();
        }
        const jmp = event.target.closest && event.target.closest("[data-focus-jump]");
        if (jmp) {
          const id = jmp.getAttribute("data-focus-jump");
          if (id) selectEntity("system", id, { scroll: true });
        }
        const mainlineBtn = event.target.closest && event.target.closest("[data-focus-mainline]");
        if (mainlineBtn) {
          const id = mainlineBtn.getAttribute("data-focus-mainline");
          if (!id) return;
          state.dashboardView = "overview";
          applyDashboardShellClass();
          setDashboardViewButtons();
          setSystemFocus(id, { scroll: true });
          document.getElementById("section-mainline")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

      document.getElementById("btn-matrix-clear").addEventListener("click", () => {
        clearSystemFocus();
      });

      document.getElementById("systems-matrix").addEventListener("click", (event) => {
        if (handleMapInteractionClick(event)) return;
        const cell = event.target.closest("[data-matrix-system]");
        if (!cell) return;
        const id = cell.getAttribute("data-matrix-system");
        selectEntity("system", id, { scroll: true });
      });

      document.getElementById("systems-matrix").addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (handleMapInteractionClick(event)) return;
        const cell = event.target.closest("[data-matrix-system]");
        if (!cell) return;
        event.preventDefault();
        const id = cell.getAttribute("data-matrix-system");
        if (state.selectedEntity && state.selectedEntity.kind === "system" && state.selectedEntity.id === id) {
          clearSelectedEntity();
          clearSystemFocus();
        } else {
          selectEntity("system", id, { scroll: true });
        }
      });

      const coreSection = document.getElementById("section-core-systems");
      if (coreSection && !coreSection.dataset.coreCatBound) {
        coreSection.dataset.coreCatBound = "1";
        coreSection.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-core-systems-cat]");
          if (!btn) return;
          state.coreSystemsCategory = btn.getAttribute("data-core-systems-cat") || "all";
          renderCoreSystems();
        });
      }

      document.querySelectorAll("[data-quick-scroll]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sel = btn.getAttribute("data-quick-scroll");
          const lower = sel && ANCHOR_LOWER_SECTION[sel];
          if (lower) openLowerSection(lower);
          const el = sel && document.querySelector(sel);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      const btnEraClose = document.getElementById("btn-era-inspector-close");
      if (btnEraClose) {
        btnEraClose.addEventListener("click", () => {
          clearEraFocus();
          if (/^#(era-|entity:)/i.test(location.hash)) {
            history.replaceState(null, "", location.pathname + location.search);
          }
          highlightTimelineEraCard(null);
          renderFocusRecommendations();
        });
      }

      const btnEraTimeline = document.getElementById("btn-era-inspector-timeline");
      if (btnEraTimeline) {
        btnEraTimeline.addEventListener("click", () => {
          const id = state.focusedEraId;
          if (!id) return;
          openLowerSection("lower-gate-timeline");
          scrollToEra(id);
          highlightTimelineEraCard(id);
        });
      }

      const btnEraCompare = document.getElementById("btn-era-inspector-compare");
      if (btnEraCompare && !btnEraCompare.dataset.bound) {
        btnEraCompare.dataset.bound = "1";
        btnEraCompare.addEventListener("click", () => {
          const id = state.focusedEraId;
          if (!id) return;
          openEraCompare(id, null);
        });
      }

      const eraComparePanel = document.getElementById("era-compare-panel");
      if (eraComparePanel && !eraComparePanel.dataset.bound) {
        eraComparePanel.dataset.bound = "1";
        eraComparePanel.addEventListener("change", (event) => {
          if (event.target.id === "era-compare-select-left") {
            state.eraCompareLeft = event.target.value;
            renderEraComparePanel();
          } else if (event.target.id === "era-compare-select-right") {
            state.eraCompareRight = event.target.value;
            renderEraComparePanel();
          }
        });
        eraComparePanel.addEventListener("click", (event) => {
          if (event.target.id === "btn-era-compare-swap") {
            const t = state.eraCompareLeft;
            state.eraCompareLeft = state.eraCompareRight;
            state.eraCompareRight = t;
            renderEraComparePanel();
          }
        });
      }

      const lowerGate = document.getElementById("architecture-lower-gate");
      if (lowerGate && !lowerGate.dataset.bound) {
        lowerGate.dataset.bound = "1";
        lowerGate.addEventListener("toggle", () => {
          state.lowerGateOpen = lowerGate.open;
          syncLowerGateButton();
          if (lowerGate.open) requestAnimationFrame(() => updateMainlineEdges());
        });
      }

      let resizeTimer;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => updateMainlineEdges(), 120);
      });

      window.addEventListener("hashchange", () => {
        applyHashFromUrl();
        renderFocusRecommendations();
      });

      const matrixPreview = document.getElementById("dashboard-matrix-preview");
      if (matrixPreview && !matrixPreview.dataset.bound) {
        matrixPreview.dataset.bound = "1";
        matrixPreview.addEventListener("click", (event) => {
          handleMapInteractionClick(event);
        });
      }

      if (!document.body.dataset.archMapDelegates) {
        document.body.dataset.archMapDelegates = "1";
        document.addEventListener("change", (event) => {
          const input = event.target.closest && event.target.closest(".transition-check-input");
          if (!input) return;
          const eraId = input.getAttribute("data-transition-era");
          const idx = input.getAttribute("data-transition-idx");
          if (!eraId || idx == null) return;
          setTransitionChecklistDone(eraId, Number(idx), input.checked);
          refreshTransitionChecklistUi(eraId);
          renderEraSpine();
        });
        document.addEventListener("click", (event) => {
            if (handleMapInteractionClick(event)) return;
            const periodBtn = event.target.closest && event.target.closest("[data-era-period-jump]");
            if (periodBtn) {
              event.preventDefault();
              openPeriodSection(
                periodBtn.getAttribute("data-era-period-jump"),
                periodBtn.getAttribute("data-period-id")
              );
              return;
            }
            const catSys = event.target.closest && event.target.closest("[data-catalog-system]");
            if (catSys) {
              event.preventDefault();
              selectEntity("system", catSys.getAttribute("data-catalog-system"), { scroll: true });
            }
          },
          true
        );
      }
    }

    // --- Init ---
    renderMeta();
    renderStatusFilter();
    renderLegend();
    renderSidebarNav();
    renderSidebarStats();
    applyDashboardShellClass();
    setDashboardViewButtons();
    bindControls();
    renderAll();
    initSidebarScrollSpy();
    applyHashFromUrl();
})();
