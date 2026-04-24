// Day / night survival panel.

Object.assign(UI.prototype, {
  renderDayCyclePanel() {
    const container = document.getElementById("day-cycle-panel");
    if (!container || !this.game.getDayState) return;

    const state = this.game.getDayState();
    const phase = state.phase || {};
    const maxActions = Math.max(0, phase.actionBudget || 0);
    const leftActions = Math.max(0, state.actionsLeftInPhase || 0);
    const spentActions = Math.max(0, maxActions - leftActions);
    const progressPct =
      maxActions > 0 ? Math.min(100, (spentActions / maxActions) * 100) : 100;
    const forecast = state.nightForecast || {};
    const lastNight = state.lastNightResult;

    const phaseSteps = (state.phases || [])
      .map((item) => {
        const isActive = item.id === phase.id;
        const isNight = item.id === "night";
        return `
          <div class="day-cycle-step ${isActive ? "is-active" : ""} ${isNight ? "is-night" : ""}">
            <span class="day-cycle-step-icon">${item.icon || "🕒"}</span>
            <span class="day-cycle-step-label">${item.label || item.id}</span>
          </div>
        `;
      })
      .join("");

    const actionDots =
      maxActions > 0
        ? Array.from({ length: maxActions })
            .map((_, index) => {
              const isAvailable = index < leftActions;
              return `<span class="day-cycle-action-dot ${isAvailable ? "is-available" : ""}"></span>`;
            })
            .join("")
        : `<span class="day-cycle-night-note">Ночная проверка</span>`;

    const needs = (forecast.needs || [])
      .map((need) => {
        const status = need.ok ? "ok" : "bad";
        return `
          <div class="day-cycle-need is-${status}">
            <span class="day-cycle-need-icon">${need.icon || ""}</span>
            <span class="day-cycle-need-label">${need.label}</span>
            <span class="day-cycle-need-count">${need.have} / ${need.need}</span>
          </div>
        `;
      })
      .join("");

    const lastNightHtml = lastNight
      ? `
        <div class="day-cycle-last-night is-${lastNight.status}">
          <div class="day-cycle-last-title">
            <span>${lastNight.icon || "🌑"}</span>
            <strong>${lastNight.label || "Прошлая ночь"}</strong>
          </div>
          <div class="day-cycle-last-text">${lastNight.text || ""}</div>
          <div class="day-cycle-effects">
            <span>⚡ ${this._formatDayDelta(lastNight.effects?.energy)}</span>
            <span>🍖 ${this._formatDayDelta(lastNight.effects?.satiety)}</span>
            <span>💧 ${this._formatDayDelta(lastNight.effects?.hydration)}</span>
          </div>
        </div>
      `
      : `<div class="day-cycle-empty-night">Первая ночь ещё впереди.</div>`;

    container.innerHTML = `
      <div class="panel-header">
        <h2>День и ночь</h2>
        <span class="panel-badge">День ${state.dayNumber}</span>
      </div>

      <div class="day-cycle-current">
        <div class="day-cycle-phase-main">
          <span class="day-cycle-phase-icon">${phase.icon || "🕒"}</span>
          <div>
            <div class="day-cycle-phase-name">${phase.label || "Фаза"}</div>
            <div class="day-cycle-phase-desc">${phase.description || ""}</div>
          </div>
        </div>
        <div class="day-cycle-progress" aria-hidden="true">
          <span style="width:${progressPct}%"></span>
        </div>
        <div class="day-cycle-actions">
          <span>Действия</span>
          <div class="day-cycle-action-dots">${actionDots}</div>
          <strong>${leftActions} / ${maxActions}</strong>
        </div>
      </div>

      <div class="day-cycle-steps">${phaseSteps}</div>

      <div class="day-cycle-forecast is-${forecast.status || "good"}">
        <div class="day-cycle-section-title">
          <span>🌑</span>
          <strong>Прогноз ночи</strong>
        </div>
        <div class="day-cycle-forecast-summary">${forecast.summary || ""}</div>
        <div class="day-cycle-needs">${needs || `<span class="day-cycle-no-needs">Ночь без расхода припасов.</span>`}</div>
      </div>

      ${lastNightHtml}
    `;
  },

  _formatDayDelta(value) {
    if (!Number.isFinite(value) || value === 0) return "0";
    return value > 0 ? `+${this.formatNumber(value)}` : this.formatNumber(value);
  },
});
