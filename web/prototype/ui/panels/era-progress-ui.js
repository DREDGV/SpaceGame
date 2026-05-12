// Era progress panel rendering.

Object.assign(UI.prototype, {
  renderEraProgress() {
    const container = document.getElementById("era-progress-panel");
    if (!container) return;

    if (this.game.isPrologueActive()) {
      const totalSteps = this.data.onboarding.steps.length;
      const completedSteps = Math.min(
        this.game.onboarding.currentStep,
        totalSteps,
      );
      const progressPercent =
        totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      const insightsCount = this.game.getUnlockedInsightsCount();
      const totalInsights = this.game.getPrologueInsights().length;

      container.innerHTML = `
        <div class="era-prologue-strip">
          <span class="era-prologue-strip-label">🌄 Пролог</span>
          <div class="era-prologue-strip-bar">
            <div class="era-prologue-strip-fill" style="width:${progressPercent}%"></div>
          </div>
          <span class="era-prologue-strip-chips">
            <span class="era-prologue-chip">${completedSteps}/${totalSteps} шагов</span>
            <span class="era-prologue-chip">✨ ${insightsCount}/${totalInsights}</span>
          </span>
        </div>
      `;
      return;
    }

    const eraData = this.game.getEraData();
    if (!eraData) {
      container.innerHTML = "";
      return;
    }

    const eraProgress = this.game.getEraProgress();
    const progressPercent = Math.round(eraProgress.progress * 100);

    // Milestones — show pending ones; collapse completed into a summary line
    const completedMilestones = eraProgress.milestones.filter(
      (m) => m.completed,
    );
    const pendingMilestones = eraProgress.milestones.filter(
      (m) => !m.completed,
    );

    let milestonesHtml = "";
    if (completedMilestones.length > 0) {
      milestonesHtml += `<div class="era-milestone-summary">✅ Выполнено: ${completedMilestones.length}</div>`;
    }
    for (const milestone of pendingMilestones) {
      milestonesHtml += `<div class="era-milestone pending">⏳ ${milestone.text}</div>`;
    }

    // Tactical goal (compact)
    let goalHtml = "";
    const goal = this.game.getCurrentGoal();
    const goalProgress = this.game.getGoalProgress();
    const currentFocus = this.game.getCurrentFocus?.();
    const goalChain = this.game.getCurrentGoalChain?.();

    const focusHtml =
      currentFocus &&
      !this.game.isOnboardingActive() &&
      !this.game.shouldShowOnboardingIntro()
        ? `
        <div class="era-focus-block is-${currentFocus.tone || "info"}">
          <div class="era-focus-label">Сейчас главное</div>
          <div class="era-focus-title">${currentFocus.value || currentFocus.title}</div>
          <div class="era-focus-note">${currentFocus.note || "Главное узкое место лагеря."}</div>
        </div>
      `
        : "";

    const chainIcon = {
      done: "✓",
      active: "↻",
      current: "→",
      waiting: "·",
    };
    const chainHtml =
      goalChain?.steps?.length &&
      !this.game.isOnboardingActive() &&
      !this.game.shouldShowOnboardingIntro()
        ? `
        <div class="era-chain-block">
          <div class="era-chain-head">
            <span class="era-chain-label">Цепочка вехи</span>
            <span class="era-chain-count">${goalChain.progress.done}/${goalChain.progress.total}</span>
          </div>
          <div class="era-chain-title">${goalChain.title}</div>
          ${goalChain.note ? `<div class="era-chain-note">${goalChain.note}</div>` : ""}
          <div class="era-chain-list">
            ${goalChain.steps
              .map(
                (step) => `
                  <div class="era-chain-step is-${step.status || "waiting"}">
                    <span class="era-chain-step-mark">${chainIcon[step.status] || "·"}</span>
                    <div class="era-chain-step-body">
                      <div class="era-chain-step-line">
                        <span class="era-chain-step-title">${step.title}</span>
                        ${step.meta ? `<span class="era-chain-step-meta">${step.meta}</span>` : ""}
                      </div>
                      <div class="era-chain-step-note">${step.note}</div>
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
      `
        : "";

    if (
      this.game.isOnboardingActive() ||
      this.game.shouldShowOnboardingIntro()
    ) {
      // During onboarding, don't show goal block
      goalHtml = "";
    } else if (!goal) {
      goalHtml = `<div class="era-goal-done">✅ Все цели выполнены (${goalProgress.done}/${goalProgress.total})</div>`;
    } else {
      const pct = goalProgress.currentPct;
      goalHtml = `
        <div class="era-goal-block">
          <div class="era-goal-header">
            <span class="era-goal-label">Веха ${goalProgress.done + 1}/${goalProgress.total}:</span>
            <span class="era-goal-text">${goal.text}</span>
          </div>
          ${goal.hint ? `<div class="era-goal-hint">💡 ${goal.hint}</div>` : ""}
          <div class="era-goal-bar">
            <div class="era-goal-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <h3>🌟 ${eraData.name}</h3>

      <div class="era-progress-bar">
        <div class="era-progress-fill" style="width: ${progressPercent}%"></div>
        <span class="era-progress-text">${progressPercent}% (${eraProgress.completed}/${eraProgress.total})</span>
      </div>
      <div class="era-milestones">
        ${milestonesHtml}
      </div>
      ${focusHtml}
      ${chainHtml}
      ${goalHtml}
    `;
  },
});
