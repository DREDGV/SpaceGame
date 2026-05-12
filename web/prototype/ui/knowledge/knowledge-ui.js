// Knowledge book modal.

Object.assign(UI.prototype, {
  _getKnowledgeEntrySourceMeta(entry) {
    if (entry?.sourceInsight) {
      return {
        label: `${entry.sourceInsight.icon} ${entry.sourceInsight.name}`,
        className: "knowledge-tag--source",
      };
    }

    if (entry?.id === this.data.prologue?.startKnowledgeEntryId) {
      return {
        label: "Начало пролога",
        className: "knowledge-tag--milestone",
      };
    }

    return {
      label: "Веха уклада",
      className: "knowledge-tag--milestone",
    };
  },

  _renderKnowledgeEntryMarkup(entry, { compact = false } = {}) {
    const source = this._getKnowledgeEntrySourceMeta(entry);
    const lines = compact
      ? entry.previewLine
        ? [entry.previewLine]
        : Array.isArray(entry.lines)
          ? entry.lines.slice(0, 1)
          : []
      : Array.isArray(entry.lines)
        ? entry.lines
        : [];

    const tags = [
      `<span class="knowledge-tag ${source.className}">${source.label}</span>`,
    ];
    if (!compact && Array.isArray(entry.relatedOutcomes)) {
      for (const outcome of entry.relatedOutcomes) {
        tags.push(
          `<span class="knowledge-tag knowledge-tag--outcome">${outcome}</span>`,
        );
      }
    }

    return `
      <article class="knowledge-entry${compact ? " is-compact" : ""}">
        <div class="knowledge-entry-header">
          <div>
            <div class="knowledge-entry-meta">Запись ${entry.unlockedIndex || 1}</div>
            <h3 class="knowledge-entry-title">${entry.title}</h3>
          </div>
          ${compact ? "" : `<div class="knowledge-entry-counter">#${entry.unlockedIndex || 1}</div>`}
        </div>
        <div class="knowledge-entry-tags">${tags.join("")}</div>
        <div class="knowledge-entry-body">
          ${lines.map((line) => `<p>${line}</p>`).join("")}
        </div>
      </article>
    `;
  },

  bindKnowledgeModal() {
    const modal = document.getElementById("knowledge-modal");
    const closeBtn = document.getElementById("knowledge-modal-close-btn");
    if (!modal || !closeBtn) return;

    const open = () => this.openKnowledgeModal();

    const close = () => {
      modal.style.display = "none";
      document.body.style.overflow = "";
    };

    // delegated — widget is re-rendered dynamically
    document.addEventListener("click", (e) => {
      if (e.target?.closest?.(".js-knowledge-open")) open();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (!e.target?.closest?.(".js-knowledge-open")) return;
      e.preventDefault();
      open();
    });

    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.style.display === "flex") close();
    });
  },

  renderKnowledgeWidget() {
    const container = document.getElementById("knowledge-widget");
    if (!container) return;

    const entries = this.game.getKnowledgeEntries?.() ?? [];
    const count = entries.length;
    const hasEntries = count > 0;
    const latestEntry = hasEntries ? entries[entries.length - 1] : null;
    const latestSource = latestEntry
      ? this._getKnowledgeEntrySourceMeta(latestEntry)
      : null;
    const insightsTotal = this.game.getPrologueInsights?.().length || 0;
    const insightsUnlocked = this.game.getUnlockedInsightsCount?.() || 0;
    const researchedCount = Object.keys(this.game.researched || {}).length;
    const renderKey = [
      this.game.isPrologueActive() ? "prologue" : "era",
      count,
      latestEntry?.id || "",
      latestEntry?.unlockedIndex || "",
      insightsUnlocked,
      insightsTotal,
      researchedCount,
    ].join("§");

    if (container.dataset.renderKey === renderKey) return;
    container.dataset.renderKey = renderKey;

    container.innerHTML = `
      <div class="science-card science-card--knowledge${hasEntries ? " has-entries" : ""} js-knowledge-open" role="button" tabindex="0">
        <div class="science-card-top">
          <div class="science-card-title">
            <span class="science-card-icon">📚</span>
            <span>Книга знаний</span>
            ${hasEntries ? '<span class="rw-dot has-available"></span>' : ""}
          </div>
          <span class="science-card-counter">${count} ${this._pluralEntries(count)}</span>
        </div>
        <div class="science-card-line">
          ${latestEntry ? `Последняя запись: ${latestEntry.title}` : "Пока нет записей"}
        </div>
        <div class="science-card-hint">
          ${
            latestEntry
              ? `${latestSource.label} · ${this.game.isPrologueActive() ? `Озарения: ${insightsUnlocked}/${insightsTotal}` : `Исследования: ${researchedCount}`}`
              : this.game.isPrologueActive()
                ? `Озарения: ${insightsUnlocked}/${insightsTotal}`
                : "Записи фиксируют важные открытия эпохи"
          }
        </div>
        <button class="science-open-btn" type="button">
          <span>Открыть</span><span class="science-open-arrow">↗</span>
        </button>
      </div>
    `;
  },

  _pluralEntries(n) {
    if (n % 10 === 1 && n % 100 !== 11) return "запись";
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20))
      return "записи";
    return "записей";
  },

  openKnowledgeModal() {
    const modal = document.getElementById("knowledge-modal");
    const closeBtn = document.getElementById("knowledge-modal-close-btn");
    if (!modal || !closeBtn) return;
    this.renderKnowledgeModalContent();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  },

  // ─── Camp founding confirmation + camp screen ───

  renderKnowledgeModalContent() {
    const container = document.getElementById("knowledge-modal-body");
    if (!container) return;

    const entries = this.game.getKnowledgeEntries();
    const insightsTotal = this.game.getPrologueInsights?.().length || 0;
    const insightsUnlocked = this.game.getUnlockedInsightsCount?.() || 0;
    const researchedCount = Object.keys(this.game.researched || {}).length;
    const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;

    if (entries.length === 0) {
      container.innerHTML =
        '<p class="knowledge-empty">Пока в Книге знаний нет записей. Первые наблюдения появятся во время пролога.</p>';
      return;
    }

    const intro = this.data.prologue?.knowledgeIntro
      ? `<div class="knowledge-intro">${this.data.prologue.knowledgeIntro}</div>`
      : "";

    const overview = `
      <section class="knowledge-overview">
        <div class="knowledge-overview-head">
          <div>
            <div class="knowledge-overview-title">Следы понимания</div>
            <div class="knowledge-overview-subtitle">Короткие записи связывают практические открытия пролога с будущим укладом и исследованиями эпохи.</div>
          </div>
          ${latestEntry ? `<div class="knowledge-entry-counter">#${latestEntry.unlockedIndex || entries.length}</div>` : ""}
        </div>
        <div class="knowledge-overview-stats">
          <span class="knowledge-overview-stat">📚 ${entries.length} ${this._pluralEntries(entries.length)}</span>
          <span class="knowledge-overview-stat">✨ ${insightsUnlocked}/${insightsTotal} озарений</span>
          <span class="knowledge-overview-stat">🔬 ${researchedCount} исследований</span>
        </div>
        ${latestEntry ? `<div class="knowledge-overview-latest">Последний след: ${latestEntry.title}</div>` : ""}
      </section>
    `;

    container.innerHTML =
      intro +
      overview +
      entries.map((entry) => this._renderKnowledgeEntryMarkup(entry)).join("");
  },
});
