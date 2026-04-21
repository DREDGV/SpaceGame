// Log panel rendering.

Object.assign(UI.prototype, {
  renderLog() {
    const container = document.getElementById("log-panel");
    if (!container) return;

    // Preserve collapsed state across renders
    const wasCollapsed = container.classList.contains("is-collapsed");
    const isCollapsed =
      this._logCollapsed !== undefined ? this._logCollapsed : true;

    container.innerHTML = "";

    const header = document.createElement("div");
    header.className = "log-header";

    const title = document.createElement("h3");
    title.textContent = "📋 Журнал";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "log-toggle-btn";
    toggleBtn.type = "button";
    toggleBtn.setAttribute("aria-expanded", !isCollapsed);
    toggleBtn.textContent = isCollapsed ? "▸" : "▾";
    toggleBtn.title = isCollapsed ? "Развернуть" : "Свернуть";

    header.appendChild(title);
    header.appendChild(toggleBtn);
    container.appendChild(header);

    // Latest entry always visible as preview
    const entries = this.game.log.slice(0, 15);
    if (entries.length > 0) {
      const preview = document.createElement("div");
      preview.className = "log-preview";
      preview.textContent = entries[0].message;
      container.appendChild(preview);
    }

    const logContainer = document.createElement("div");
    logContainer.className = "log-entries" + (isCollapsed ? " is-hidden" : "");

    if (entries.length === 0) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Здесь будут отображаться ваши действия";
      logContainer.appendChild(p);
    } else {
      for (const entry of entries) {
        const el = document.createElement("div");
        el.className = "log-entry";
        el.textContent = entry.message;
        logContainer.appendChild(el);
      }
    }

    container.appendChild(logContainer);

    toggleBtn.addEventListener("click", () => {
      this._logCollapsed = !isCollapsed;
      this.renderLog();
    });
  },
});
