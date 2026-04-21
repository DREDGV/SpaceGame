// Research modal, widget, branches, insights.

Object.assign(UI.prototype, {
  bindResearchModal() {
    const modal = document.getElementById("research-modal");
    const closeBtn = document.getElementById("research-modal-close-btn");
    if (!modal || !closeBtn) return;

    const close = () => {
      modal.style.display = "none";
      document.body.style.overflow = "";
    };

    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") close();
    });
  },

  openResearchModal() {
    const modal = document.getElementById("research-modal");
    if (!modal) return;
    this.renderResearchModalContent();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.getElementById("research-modal-close-btn")?.focus();
  },

  renderResearchWidget() {
    const container = document.getElementById("research-widget");
    if (!container) return;

    const openModal = () => this.openResearchModal();

    if (this.game.isPrologueActive()) {
      const insights = this.game.getPrologueInsightsState();
      const unlockedCount = insights.filter((i) => i.unlocked).length;
      const total = insights.length;
      const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;
      const latestUnlocked = [...insights].reverse().find((i) => i.unlocked);
      const nextInsight = insights.find((i) => !i.unlocked);
      const hasNew = unlockedCount < total;

      container.innerHTML = `
        <div class="science-card science-card--insights${hasNew ? " has-available" : ""} js-research-card" role="button" tabindex="0">
          <div class="science-card-top">
            <div class="science-card-title">
              <span class="science-card-icon">✨</span>
              <span>${this.data.prologue?.insightsTitle || "Озарения"}</span>
              ${hasNew ? '<span class="rw-dot has-available"></span>' : ""}
            </div>
            <span class="science-card-counter">${unlockedCount}/${total}</span>
          </div>
          <div class="science-card-line">
            ${
              latestUnlocked
                ? `Последнее: ${latestUnlocked.icon} ${latestUnlocked.name}`
                : "Первые открытия придут из действий руками"
            }
          </div>
          <div class="science-card-hint">
            ${
              nextInsight
                ? `Следующее: ${nextInsight.conditionText || "продолжайте действовать"}`
                : "Все ранние озарения открыты"
            }
          </div>
          <div class="science-mini-progress" aria-hidden="true">
            <div class="science-mini-progress-fill" style="width:${pct}%"></div>
          </div>
          <button class="science-open-btn js-research-open" type="button">
            <span>Открыть</span><span class="science-open-arrow">↗</span>
          </button>
        </div>
      `;
      this._bindScienceWidgetOpen(container, ".js-research-card", openModal);
      return;
    }

    const researchState = this.game.getResearchState();
    const totalDone = Object.keys(this.game.researched).length;
    const branchState = this.game.getResearchBranchesState();
    const researchItems = [
      ...branchState.foundation,
      ...branchState.branches.flatMap((branch) => branch.techs),
    ];
    const availableTechs = researchItems.filter((t) =>
      this.game.canResearch(t.id),
    );
    const nextTech = availableTechs[0];
    const hasAvailable = availableTechs.length > 0;

    const indicatorClass = researchState
      ? "is-active"
      : hasAvailable
        ? "has-available"
        : "";
    const branchProgress = `${branchState.branches.filter((b) => b.started).length}/${branchState.branches.length}`;

    let progressHtml = "";
    if (researchState) {
      const pct = Math.round(researchState.progress * 100);
      const queuedTech =
        this.game.researchQueue.length > 0
          ? this.data.tech[this.game.researchQueue[0].techId]
          : null;
      progressHtml = `
        <div class="science-live-strip">
          <div class="science-live-row">
            <span class="science-live-label">Идёт исследование</span>
            <span class="science-live-time">${this.formatSeconds(researchState.remainingMs)}</span>
          </div>
          <div class="science-live-name">${researchState.icon} ${researchState.name}</div>
          <div class="rw-progress-bar"><div class="rw-progress-fill" style="width:${pct}%"></div></div>
          <div class="science-live-foot">
            <span>${pct}% завершено</span>
            ${queuedTech ? `<span>Очередь: ${queuedTech.icon} ${queuedTech.name}</span>` : "<span>Очередь пуста</span>"}
          </div>
        </div>`;
    }

    container.innerHTML = `
      <div class="science-card science-card--research${researchState ? " is-researching" : hasAvailable ? " has-available" : ""} js-research-card" role="button" tabindex="0">
        <div class="science-card-top">
          <div class="science-card-title">
            <span class="science-card-icon">🔬</span>
            <span>Исследования</span>
            ${indicatorClass ? `<span class="rw-dot ${indicatorClass}"></span>` : ""}
          </div>
          <span class="science-card-counter">${totalDone} изучено</span>
        </div>
        <div class="science-card-line">
          ${researchState ? "Процесс активен" : hasAvailable ? `Доступно: ${nextTech.icon} ${nextTech.name}` : "Нет доступных исследований"}
        </div>
        <div class="science-card-hint">Ветви развития: ${branchProgress}</div>
        ${progressHtml}
        <button class="science-open-btn js-research-open${researchState ? " is-researching" : hasAvailable ? " has-available" : ""}" type="button">
          <span>${researchState ? "Управлять" : "Открыть"}</span><span class="science-open-arrow">↗</span>
        </button>
      </div>
    `;
    this._bindScienceWidgetOpen(container, ".js-research-card", openModal);
  },

  _bindScienceWidgetOpen(container, selector, openModal) {
    const card = container.querySelector(selector);
    if (!card) return;

    card.addEventListener("click", (event) => {
      event.preventDefault();
      openModal();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openModal();
    });
  },

  renderResearchModalContent() {
    const container = document.getElementById("research-modal-body");
    if (!container) return;
    const title = document.getElementById("research-modal-title");
    if (this.game.isPrologueActive()) {
      if (title) title.textContent = "✨ Озарения";
      this._renderPrologueInsightsBody(container);
      return;
    }
    if (title) title.textContent = "🔬 Исследования эпохи";
    this._renderResearchBody(container);
  },

  _renderPrologueInsightsBody(container) {
    container.innerHTML = "";

    const insights = this.game.getPrologueInsightsState();
    const unlockedCount = insights.filter((i) => i.unlocked).length;
    const total = insights.length;
    const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

    const header = document.createElement("div");
    header.className = "insight-map-header";
    header.innerHTML = `
      <div class="insight-map-title">Карта мыслей</div>
      <div class="insight-map-subtitle">${this.data.prologue?.insightsHint || "Озарения приходят из практики, а не из меню."}</div>
      <div class="insight-map-progress">
        <div class="insight-map-bar"><div class="insight-map-bar-fill" style="width:${pct}%"></div></div>
        <span class="insight-map-count">${unlockedCount} / ${total}</span>
      </div>
    `;
    container.appendChild(header);

    const map = document.createElement("div");
    map.className = "insight-map";

    for (const insight of insights) {
      const node = document.createElement("div");
      node.className = `insight-node${insight.unlocked ? " is-unlocked" : " is-hidden"}`;

      if (insight.unlocked) {
        const outcomesHtml =
          Array.isArray(insight.outcomes) && insight.outcomes.length > 0
            ? `<div class="insight-node-outcomes">${insight.outcomes.map((o) => `<span>${o}</span>`).join("")}</div>`
            : "";
        node.innerHTML = `
          <div class="insight-node-icon">${insight.icon}</div>
          <div class="insight-node-name">${insight.name}</div>
          <div class="insight-node-desc">${insight.description}</div>
          ${insight.unlockText ? `<div class="insight-node-note">${insight.unlockText}</div>` : ""}
          ${outcomesHtml}
        `;
        this.setTooltip(node, [
          insight.name,
          insight.description,
          ...(insight.outcomes || []),
        ]);
      } else {
        node.innerHTML = `
          <div class="insight-node-icon">🔍</div>
          <div class="insight-node-name">???</div>
          <div class="insight-node-cond">${insight.conditionText || "Открывается из действий"}</div>
        `;
        this.setTooltip(node, [
          insight.conditionText || "Продолжайте действовать",
        ]);
      }

      map.appendChild(node);
    }

    container.appendChild(map);
  },

  _renderResearchBody(container) {
    container.innerHTML = "";

    const researchState = this.game.getResearchState();
    const branchState = this.game.getResearchBranchesState();

    // ── Active research strip ─────────────────────────────────────
    if (researchState) {
      const pct = Math.round(researchState.progress * 100);
      const strip = document.createElement("div");
      strip.className = "research-active-strip";
      strip.innerHTML = `
        <div class="research-active-strip-row">
          <span class="research-active-strip-label">Исследуется:</span>
          <span class="research-active-strip-name">${researchState.icon} ${researchState.name}</span>
          <span class="research-active-strip-time">${this.formatSeconds(researchState.remainingMs)}</span>
        </div>
        <div class="rw-progress-bar"><div class="rw-progress-fill" style="width:${pct}%"></div></div>
      `;
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "tech-cancel-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "✕ Отменить (−50% ресурсов)";
      cancelBtn.addEventListener("click", () => {
        this.game.cancelResearch();
        this.render({ forcePanels: true });
      });
      strip.appendChild(cancelBtn);
      container.appendChild(strip);
    }

    // ── Queue slot ────────────────────────────────────────────────
    if (this.game.researchQueue.length > 0) {
      const queuedTech = this.data.tech[this.game.researchQueue[0].techId];
      const queueSlot = document.createElement("div");
      queueSlot.className = "research-queue-slot";
      queueSlot.innerHTML = `
        <span class="research-queue-slot-label">📋 В очереди:</span>
        <span class="research-queue-slot-name">${queuedTech?.icon || ""} ${queuedTech?.name || "?"}</span>
        <span class="research-queue-slot-hint">запустится автоматически</span>
      `;
      const cancelQueueBtn = document.createElement("button");
      cancelQueueBtn.className = "tech-cancel-btn";
      cancelQueueBtn.type = "button";
      cancelQueueBtn.textContent = "✕ Убрать (вернуть ресурсы)";
      cancelQueueBtn.addEventListener("click", () => {
        this.game.cancelQueuedResearch();
        this.render({ forcePanels: true });
      });
      queueSlot.appendChild(cancelQueueBtn);
      container.appendChild(queueSlot);
    }

    // ── Node-graph tree ───────────────────────────────────────────
    this._renderResearchTree(container, researchState);

    if (branchState.transitionText) {
      const note = document.createElement("div");
      note.className = "research-overview-text";
      note.style.marginTop = "0.75rem";
      note.textContent = branchState.transitionText;
      container.appendChild(note);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Node-graph tech tree
  // ─────────────────────────────────────────────────────────────────────────

  _renderResearchTree(container, researchState) {
    // ── Layout constants ────────────────────────────────────────
    const NODE_W = 160;
    const NODE_H = 68;
    const COL_W = 210;
    const ROW_H = 96;
    const PAD_X = 28;
    const PAD_Y = 24;

    // pixel centre of node (col, row)
    const nx = (col) => PAD_X + col * COL_W + NODE_W / 2;
    const ny = (row) => PAD_Y + row * ROW_H + NODE_H / 2;

    // ── Fixed grid positions (col, row) ─────────────────────────
    //  col 0 = foundation root
    //  col 1 = order-0 branches  (forag, clay, camp)
    //  col 2 = order-1 branches  (rest, mining, labor, basic)
    //  col 3 = order-2 branches  (body, kiln, rhythm, crafting, sharp)
    //  col 4 = order-3 branches  (material)
    //
    //  row 0 = survival
    //  row 1 = production
    //  row 2 = community / CM root
    //  row 3 = craft main
    //  row 4 = craft branch (tool_sharpening)
    const POS = {
      communal_memory: { col: 0, row: 2 },
      foraging: { col: 1, row: 0 },
      clay_reading: { col: 1, row: 1 },
      camp_planning: { col: 1, row: 2 },
      rest_discipline: { col: 2, row: 0 },
      mining: { col: 2, row: 1 },
      labor_division: { col: 2, row: 2 },
      basic_tools: { col: 2, row: 3 },
      body_conditioning: { col: 3, row: 0 },
      kiln_practice: { col: 3, row: 1 },
      work_rhythm: { col: 3, row: 2 },
      crafting: { col: 3, row: 3 },
      tool_sharpening: { col: 3, row: 4 },
      material_sense: { col: 4, row: 3 },
    };

    const COLS = 5;
    const ROWS = 5;
    const canvasW = PAD_X * 2 + COLS * COL_W - (COL_W - NODE_W);
    const canvasH = PAD_Y * 2 + ROWS * ROW_H - (ROW_H - NODE_H);

    // ── Branch accent colours ────────────────────────────────────
    const BCOLOR = {
      foundation: "#f59e0b",
      survival: "#34d399",
      production: "#fb923c",
      community: "#a78bfa",
      craft: "#60a5fa",
    };

    // ── Per-tech state ───────────────────────────────────────────
    const tstate = {};
    for (const id of Object.keys(POS)) {
      const prereqs = this.game.getTechPrerequisites(id);
      tstate[id] = {
        done: !!this.game.researched[id],
        available: this.game.canResearch(id),
        isResearching: researchState?.techId === id,
        isQueued: this.game.researchQueue.some((q) => q.techId === id),
        locked:
          prereqs.missingTechIds.length > 0 ||
          prereqs.missingBuildingIds.length > 0,
      };
    }

    // ── SVG bezier connections ───────────────────────────────────
    const lines = [];
    for (const [id, pos] of Object.entries(POS)) {
      const tech = this.data.tech[id];
      if (!tech?.requiresTech?.length) continue;
      for (const reqId of tech.requiresTech) {
        if (!POS[reqId]) continue;
        const sp = POS[reqId];
        const x1 = nx(sp.col) + NODE_W / 2;
        const y1 = ny(sp.row);
        const x2 = nx(pos.col) - NODE_W / 2;
        const y2 = ny(pos.row);
        const dx = Math.abs(x2 - x1) * 0.45;
        const d = `M${x1} ${y1} C${x1 + dx} ${y1},${x2 - dx} ${y2},${x2} ${y2}`;
        const color = BCOLOR[tech.branch] || "#6b7280";
        const active = tstate[reqId]?.done && tstate[id]?.done;
        const ready = tstate[reqId]?.done && !tstate[id]?.done;
        lines.push({ d, color, active, ready });
      }
    }

    // ── DOM ──────────────────────────────────────────────────────
    const wrap = document.createElement("div");
    wrap.className = "rt-wrap";

    // Legend
    const legend = document.createElement("div");
    legend.className = "rt-legend";
    const LEGEND = [
      { id: "foundation", label: "Основа", icon: "🪶" },
      { id: "survival", label: "Выживание", icon: "⛺" },
      { id: "production", label: "Производство", icon: "🔥" },
      { id: "community", label: "Община", icon: "👥" },
      { id: "craft", label: "Ремесло", icon: "🛠️" },
    ];
    for (const b of LEGEND) {
      const chip = document.createElement("span");
      chip.className = "rt-legend-chip";
      chip.style.setProperty("--c", BCOLOR[b.id]);
      chip.innerHTML = `${b.icon} ${b.label}`;
      legend.appendChild(chip);
    }
    wrap.appendChild(legend);

    // Scroll + canvas
    const scroll = document.createElement("div");
    scroll.className = "rt-scroll";

    const canvas = document.createElement("div");
    canvas.className = "rt-canvas";
    canvas.style.width = canvasW + "px";
    canvas.style.height = canvasH + "px";

    // SVG layer
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", canvasW);
    svg.setAttribute("height", canvasH);
    svg.classList.add("rt-svg");
    for (const l of lines) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", l.d);
      p.setAttribute("fill", "none");
      if (l.active) {
        p.setAttribute("stroke", l.color);
        p.setAttribute("stroke-width", "2.5");
        p.setAttribute("stroke-opacity", "0.85");
      } else if (l.ready) {
        p.setAttribute("stroke", "#ffffff");
        p.setAttribute("stroke-width", "1.5");
        p.setAttribute("stroke-opacity", "0.3");
        p.setAttribute("stroke-dasharray", "6 3");
      } else {
        p.setAttribute("stroke", "#ffffff");
        p.setAttribute("stroke-width", "1");
        p.setAttribute("stroke-opacity", "0.08");
        p.setAttribute("stroke-dasharray", "3 5");
      }
      svg.appendChild(p);
    }
    canvas.appendChild(svg);

    // Detail panel (below canvas — ref created before nodes so nodes can fill it)
    const detail = document.createElement("div");
    detail.className = "rt-detail";
    detail.innerHTML = `<div class="rt-detail-hint">← нажмите на исследование</div>`;

    // Nodes
    for (const [id, pos] of Object.entries(POS)) {
      const tech = this.data.tech[id];
      if (!tech) continue;
      const st = tstate[id];
      const color = BCOLOR[tech.branch] || "#6b7280";

      const node = document.createElement("div");
      node.className = "rt-node";
      node.dataset.techId = id;
      node.style.cssText = [
        `left:${nx(pos.col) - NODE_W / 2}px`,
        `top:${ny(pos.row) - NODE_H / 2}px`,
        `width:${NODE_W}px`,
        `height:${NODE_H}px`,
        `--branch-color:${color}`,
      ].join(";");

      if (st.done) node.classList.add("rt-done");
      else if (st.isResearching) node.classList.add("rt-researching");
      else if (st.isQueued) node.classList.add("rt-queued");
      else if (st.available) node.classList.add("rt-available");
      else node.classList.add("rt-locked");

      node.innerHTML = `
        <span class="rt-node-icon">${st.locked && !st.done ? "🔒" : tech.icon}</span>
        <span class="rt-node-name">${tech.name}</span>
        ${st.done ? `<span class="rt-node-badge rt-badge-done">✓</span>` : ""}
        ${st.isResearching ? `<span class="rt-node-badge rt-badge-act">⏳</span>` : ""}
        ${st.isQueued ? `<span class="rt-node-badge rt-badge-q">📋</span>` : ""}
      `;

      node.addEventListener("click", () => {
        canvas
          .querySelectorAll(".rt-node.rt-selected")
          .forEach((n) => n.classList.remove("rt-selected"));
        node.classList.add("rt-selected");
        this._renderResearchDetail(detail, tech, st, researchState);
      });

      canvas.appendChild(node);
    }

    scroll.appendChild(canvas);
    wrap.appendChild(scroll);
    wrap.appendChild(detail);
    container.appendChild(wrap);

    // ── Drag-to-pan ─────────────────────────────────────────────
    let isDragging = false;
    let startX = 0,
      startY = 0;
    let scrollLeft = 0,
      scrollTop = 0;
    let dragMoved = false;

    const onPointerDown = (e) => {
      if (e.target.closest(".rt-node") || e.button !== 0) return;
      isDragging = true;
      dragMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = scroll.scrollLeft;
      scrollTop = scroll.scrollTop;
      scroll.classList.add("rt-panning");
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      scroll.scrollLeft = scrollLeft - dx;
      scroll.scrollTop = scrollTop - dy;
    };
    const onPointerUp = () => {
      isDragging = false;
      scroll.classList.remove("rt-panning");
    };

    scroll.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);

    // Prevent click on node if user was dragging
    scroll.addEventListener(
      "click",
      (e) => {
        if (dragMoved) {
          e.stopPropagation();
          dragMoved = false;
        }
      },
      true,
    );

    // Cleanup on modal close
    const modal = document.getElementById("research-modal");
    const cleanup = () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      modal?.removeEventListener("transitionend", cleanup);
    };
    if (modal) {
      // bind once — will fire when modal hides
      const observer = new MutationObserver(() => {
        if (modal.style.display === "none") {
          cleanup();
          observer.disconnect();
        }
      });
      observer.observe(modal, { attributes: true, attributeFilter: ["style"] });
    }
  },

  _renderResearchDetail(panel, tech, state, researchState) {
    const prereqs = this.game.getTechPrerequisites(tech.id);
    const outcomes = Array.isArray(tech.outcomes) ? tech.outcomes : [];
    const costStr = this.formatResourcePairs(tech.cost);
    const timeStr = this.formatSeconds(this.game.getResearchDuration(tech.id));

    const missingLabels = [
      ...prereqs.missingTechIds.map((id) => {
        const t = this.data.tech[id];
        return t ? `${t.icon} ${t.name}` : id;
      }),
      ...prereqs.missingBuildingIds.map((id) => {
        const b = this.data.buildings[id];
        return b ? `${b.icon} ${b.name}` : id;
      }),
    ];

    const outcomesHtml = outcomes.length
      ? `<div class="rt-detail-outcomes">${outcomes.map((o) => `<span>${o}</span>`).join("")}</div>`
      : "";

    let actionHtml = "";
    if (state.done) {
      actionHtml = `<span class="rt-detail-status rt-status-done">✅ Изучено</span>`;
    } else if (state.isResearching) {
      const pct = Math.round((researchState?.progress || 0) * 100);
      actionHtml = `
        <div class="rt-detail-progress">
          <div class="rw-progress-bar"><div class="rw-progress-fill" style="width:${pct}%"></div></div>
          <span class="rt-detail-progress-time">${this.formatSeconds(researchState.remainingMs)} осталось</span>
        </div>
        <button class="tech-cancel-btn" data-action="cancel">✕ Отменить (−50% ресурсов)</button>
      `;
    } else if (state.isQueued) {
      actionHtml = `
        <span class="rt-detail-status rt-status-queued">📋 В очереди — запустится автоматически</span>
        <button class="tech-cancel-btn" data-action="dequeue">✕ Убрать из очереди</button>
      `;
    } else if (missingLabels.length > 0) {
      actionHtml = `<span class="rt-detail-status rt-status-locked">🔒 Требуется: ${missingLabels.join(" · ")}</span>`;
    } else {
      const canDo = this.game.canResearch(tech.id);
      const canQueue = this.game.canQueueResearch(tech.id);
      const activeR = this.game.getResearchState();
      const btnLabel = canDo
        ? "🔬 Исследовать"
        : activeR
          ? `⏳ Занято: ${activeR.icon} ${activeR.name}`
          : "❌ Не хватает ресурсов";

      if (canQueue) {
        actionHtml = `
          <div class="rt-detail-cost-row">
            <span class="rt-detail-cost">Стоит: ${costStr}</span>
            <span class="rt-detail-time">· ${timeStr}</span>
          </div>
          <button class="action-btn rt-research-btn" data-action="queue">📋 В очередь</button>
        `;
      } else {
        actionHtml = `
          <div class="rt-detail-cost-row">
            <span class="rt-detail-cost">Стоит: ${costStr}</span>
            <span class="rt-detail-time">· ${timeStr}</span>
          </div>
          <button class="action-btn rt-research-btn${canDo ? "" : " is-disabled"}"
                  data-action="research"${canDo ? "" : " disabled"}>
            ${btnLabel}
          </button>
        `;
      }
    }

    panel.innerHTML = `
      <div class="rt-detail-inner">
        <div class="rt-detail-head">
          <span class="rt-detail-icon">${tech.icon}</span>
          <div class="rt-detail-title">
            <div class="rt-detail-name">${tech.name}</div>
            <div class="rt-detail-branch">${this._getBranchLabel(tech.branch)}</div>
          </div>
        </div>
        <p class="rt-detail-desc">${tech.description}</p>
        ${outcomesHtml}
        <div class="rt-detail-actions">${actionHtml}</div>
      </div>
    `;

    panel
      .querySelector('[data-action="cancel"]')
      ?.addEventListener("click", () => {
        this.game.cancelResearch();
        this.render({ forcePanels: true });
      });
    panel
      .querySelector('[data-action="dequeue"]')
      ?.addEventListener("click", () => {
        this.game.cancelQueuedResearch();
        this.render({ forcePanels: true });
      });
    panel
      .querySelector('[data-action="queue"]')
      ?.addEventListener("click", () => {
        this.game.queueResearch(tech.id);
        this.render({ forcePanels: true });
      });
    panel
      .querySelector('[data-action="research"]')
      ?.addEventListener("click", () => {
        this.game.research(tech.id);
        this.render({ forcePanels: true });
      });
  },

  _getBranchLabel(branchId) {
    const labels = {
      foundation: "🪶 Основа эпохи",
      survival: "⛺ Выживание",
      craft: "🛠️ Ремесло",
      production: "🔥 Производство",
      community: "👥 Развитие общины",
    };
    return labels[branchId] || branchId;
  },

  createResearchCard(tech, researchState) {
    const prereqs = this.game.getTechPrerequisites(tech.id);
    const done = this.game.researched[tech.id];
    const canDo = this.game.canResearch(tech.id);
    const isResearchingThis = researchState?.techId === tech.id;
    const isQueued = this.game.researchQueue.some((q) => q.techId === tech.id);
    const canQueue = this.game.canQueueResearch(tech.id);
    const outcomes = Array.isArray(tech.outcomes) ? tech.outcomes : [];
    const missingRequirementLabels = [
      ...prereqs.missingTechIds.map((id) => {
        const reqTech = this.data.tech[id];
        return reqTech ? `${reqTech.icon} ${reqTech.name}` : id;
      }),
      ...prereqs.missingBuildingIds.map((id) => {
        const reqBuilding = this.data.buildings[id];
        return reqBuilding ? `${reqBuilding.icon} ${reqBuilding.name}` : id;
      }),
    ];
    const outcomesHtml = outcomes.length
      ? `<div class="tech-outcomes">${outcomes.map((item) => `<span class="tech-outcome">${item}</span>`).join("")}</div>`
      : "";
    const requirementText =
      missingRequirementLabels.length > 0
        ? `Нужно: ${missingRequirementLabels.join(" · ")}`
        : "";

    const el = document.createElement("div");
    el.className = "tech-card";

    if (done) {
      el.classList.add("done");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status">✅ Изучено</span>
      `;
      this.setTooltip(el, [tech.name, tech.description, ...outcomes]);
      return el;
    }

    if (isResearchingThis) {
      el.classList.add("in-progress");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status is-pending">⏳ Исследуется — ${this.formatSeconds(researchState.remainingMs)}</span>
        <div class="project-mini-bar">
          <div class="project-mini-bar-fill" style="width:${researchState.progress * 100}%"></div>
        </div>
      `;
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "tech-cancel-btn";
      cancelBtn.type = "button";
      cancelBtn.textContent = "✕ Отменить (−50% ресурсов)";
      cancelBtn.addEventListener("click", () => {
        this.game.cancelResearch();
        this.render({ forcePanels: true });
      });
      el.appendChild(cancelBtn);
      this.setTooltip(el, [
        `${tech.name}: исследование запущено`,
        `Осталось: ${this.formatSeconds(researchState.remainingMs)}`,
        ...outcomes,
      ]);
      return el;
    }

    if (isQueued) {
      el.classList.add("queued");
      el.innerHTML = `
        <span class="tech-icon">${tech.icon}</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-status is-pending">📋 В очереди — запустится автоматически</span>
      `;
      const dequeueBtn = document.createElement("button");
      dequeueBtn.className = "tech-cancel-btn";
      dequeueBtn.type = "button";
      dequeueBtn.textContent = "✕ Убрать из очереди (вернуть ресурсы)";
      dequeueBtn.addEventListener("click", () => {
        this.game.cancelQueuedResearch();
        this.render({ forcePanels: true });
      });
      el.appendChild(dequeueBtn);
      this.setTooltip(el, [
        tech.name,
        tech.description,
        "В очереди — ресурсы уже заняты",
        ...outcomes,
      ]);
      return el;
    }

    if (missingRequirementLabels.length > 0) {
      el.classList.add("locked");
      el.innerHTML = `
        <span class="tech-icon">🔒</span>
        <span class="tech-name">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="tech-req">${requirementText}</span>
      `;
      this.setTooltip(el, [
        tech.name,
        tech.description,
        requirementText,
        ...outcomes,
      ]);
      return el;
    }

    const costStr = this.formatResourcePairs(tech.cost);
    const researchTime = this.formatSeconds(
      this.game.getResearchDuration(tech.id),
    );

    // Build resource status string with specific missing resources
    let researchStatus;
    if (canQueue) {
      researchStatus = `Исследование в очереди: стоимость ${costStr}`;
    } else if (researchState && !isResearchingThis) {
      // Another tech is being researched
      researchStatus = `Идёт: ${researchState.icon} ${researchState.name}`;
    } else if (!this.game.hasResources(tech.cost)) {
      const missing = this.game.getMissingResources(tech.cost);
      const missingStr = missing
        .map(
          ({ id, missing: amount }) =>
            `${this.getResourceDisplayIcon(id)}${amount}`,
        )
        .join(" ");
      researchStatus = `Не хватает: ${missingStr}`;
    } else {
      researchStatus = `Стоит: ${costStr} · Время: ${researchTime}`;
    }

    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.type = "button";

    if (canQueue) {
      // Show queue button
      this.setButtonAvailability(btn, true);
      btn.innerHTML = `
        <span class="btn-icon">${tech.icon}</span>
        <span class="btn-label">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="btn-cost">Стоимость: ${costStr}</span>
        <span class="btn-efficiency">Время исследования: ${researchTime}</span>
        <span class="btn-queue-status tech-queue-hint">📋 Поставить в очередь</span>
      `;
      btn.addEventListener("click", () => {
        this.game.queueResearch(tech.id);
        this.render({ forcePanels: true });
      });
    } else {
      this.setButtonAvailability(btn, canDo);
      btn.innerHTML = `
        <span class="btn-icon">${tech.icon}</span>
        <span class="btn-label">${tech.name}</span>
        <span class="btn-desc">${tech.description}</span>
        ${outcomesHtml}
        <span class="btn-cost">Стоимость: ${costStr}</span>
        <span class="btn-efficiency">Время исследования: ${researchTime}</span>
        <span class="btn-queue-status">${researchStatus}</span>
      `;
      btn.addEventListener("click", () => {
        if (!this.game.research(tech.id)) {
          this.render({ forcePanels: true });
          return;
        }
        this.render({ forcePanels: true });
      });
    }

    this.setTooltip(btn, [tech.name, tech.description, ...outcomes]);
    el.appendChild(btn);
    return el;
  },
});
