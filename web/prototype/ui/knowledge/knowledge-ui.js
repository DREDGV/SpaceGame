// Knowledge book modal.

Object.assign(UI.prototype, {
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
      if (e.target.closest(".js-knowledge-open")) open();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (!e.target.closest(".js-knowledge-open")) return;
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
    const insightsTotal = this.game.getPrologueInsights?.().length || 0;
    const insightsUnlocked = this.game.getUnlockedInsightsCount?.() || 0;

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
          ${this.game.isPrologueActive() ? `Озарения: ${insightsUnlocked}/${insightsTotal}` : "Записи фиксируют важные открытия эпохи"}
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
    if (entries.length === 0) {
      container.innerHTML =
        '<p class="knowledge-empty">Пока в Книге знаний нет записей. Первые наблюдения появятся во время пролога.</p>';
      return;
    }

    const intro = this.data.prologue?.knowledgeIntro
      ? `<div class="knowledge-intro">${this.data.prologue.knowledgeIntro}</div>`
      : "";

    container.innerHTML =
      intro +
      entries
        .map(
          (entry, index) => `
          <article class="knowledge-entry">
            <div class="knowledge-entry-meta">Запись ${index + 1}</div>
            <h3 class="knowledge-entry-title">${entry.title}</h3>
            <div class="knowledge-entry-body">
              ${entry.lines.map((line) => `<p>${line}</p>`).join("")}
            </div>
          </article>
        `,
        )
        .join("");
  },
});
