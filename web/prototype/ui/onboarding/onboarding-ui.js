// Onboarding intro, steps, hide helpers.

Object.assign(UI.prototype, {
  renderOnboardingIntro() {
    const container = document.getElementById("onboarding-intro-panel");
    if (!container) return;

    container.style.display = "block";
    const lines = this.data.onboarding.introLines;
    const prologue = this.data.prologue || {};
    const lede = lines[0] || "";
    const rest = lines.slice(1);
    container.innerHTML = `
      <img class="intro-hero-image" src="assets/intro-campfire.jpg" alt="" aria-hidden="true" onerror="this.src='assets/intro-campfire.svg'; this.onerror=null;">
      <div class="intro-hero-overlay"></div>
      <div class="onboarding-intro-content">
        <img class="intro-logo" src="assets/logo.png" alt="Начало пути" onerror="this.style.display='none'">
        <p class="intro-era-label">${prologue.eraLabel || "— Пролог —"}</p>
        <h2 class="onboarding-intro-title">🌍 ${prologue.title || "На заре человечества"}</h2>
        ${prologue.subtitle ? `<p class="intro-subtitle">${prologue.subtitle}</p>` : ""}
        <div class="onboarding-intro-text">
          <p class="intro-lede">${lede}</p>
          ${rest.map((l) => `<p>${l}</p>`).join("")}
        </div>
        <div class="intro-divider"><span>✦</span></div>
        <div class="onboarding-intro-buttons">
          <button id="obStartBtn" class="ob-btn ob-btn-start">🌄 Войти в историю</button>
          <button id="obSkipBtn" class="ob-btn ob-btn-skip">Пропустить пролог</button>
        </div>
      </div>
    `;

    document.getElementById("obStartBtn").addEventListener("click", () => {
      this.game.startOnboarding();
      this.render({ forcePanels: true });
    });

    document.getElementById("obSkipBtn").addEventListener("click", () => {
      this.game.skipOnboarding();
      container.style.display = "none";
      this.render({ forcePanels: true });
    });
  },

  renderOnboardingStep() {
    const container = document.getElementById("onboarding-step-panel");
    if (!container) return;

    container.style.display = "block";
    const step = this.game.getCurrentOnboardingStep();
    if (!step) {
      container.style.display = "none";
      return;
    }

    const steps = this.data.onboarding.steps;
    const currentIdx = this.game.onboarding.currentStep;
    const progressPct = Math.round((currentIdx / steps.length) * 100);
    const campfireState = this.game.getPrologueCampfireState();
    const insightsCount = this.game.getUnlockedInsightsCount();
    const knowledgeCount = this.game.getKnowledgeEntries().length;
    const campfireChecklist = [
      {
        done: !!campfireState?.shelterBuilt,
        text: "Поставлено первое жильё",
      },
      {
        done:
          campfireState &&
          campfireState.unlockedInsights >= campfireState.totalInsights,
        text: `Замечены свойства материалов (${campfireState?.unlockedInsights || 0}/${campfireState?.totalInsights || 0})`,
      },
      {
        done: !!campfireState?.hasTool,
        text: "Связано первое грубое орудие",
      },
      {
        done: !!campfireState?.built,
        text: "Разведён первый костёр",
      },
    ];

    container.innerHTML = `
      <div class="onboarding-step-content">
        <div class="onboarding-step-header">
          <h3>${this.data.prologue?.stepTitle || "Сейчас главное"}</h3>
          <button id="obSkipStepBtn" class="ob-btn ob-btn-skip-small">Пропустить пролог</button>
        </div>
        <div class="prologue-focus-layout">
          <div class="prologue-focus-main">
            <div class="prologue-focus-kicker">${this.data.prologue?.stepSubtitle || ""}</div>
            <div class="onboarding-step-text">${step.text}</div>
            <div class="onboarding-step-hint">💡 ${step.hint}</div>
            ${
              step.sceneText
                ? `<div class="prologue-scene-text">${step.sceneText}</div>`
                : ""
            }
            <div class="onboarding-step-bar">
              <div class="onboarding-step-bar-fill" style="width:${progressPct}%"></div>
            </div>
            <div class="prologue-step-meta">
              <span class="prologue-step-chip">Шаг ${currentIdx + 1}/${steps.length}</span>
              <span class="prologue-step-chip">Озарения ${insightsCount}/${this.game.getPrologueInsights().length}</span>
              <span class="prologue-step-chip">Книга ${knowledgeCount}</span>
            </div>
            <div class="prologue-step-actions">
              <button id="prologueInsightsBtn" class="prologue-link-btn" type="button">✨ Озарения</button>
              <button id="prologueBookBtn" class="prologue-link-btn" type="button">📚 Книга знаний</button>
            </div>
          </div>
          <aside class="prologue-focus-aside">
            <div class="prologue-focus-aside-title">${campfireState?.title || "Путь к костру"}</div>            <div class="prologue-focus-aside-progress">
              <div class="prologue-focus-aside-bar">
                <div class="prologue-focus-aside-bar-fill" style="width:${progressPct}%"></div>
              </div>
              <span class="prologue-focus-aside-pct">Шаг ${currentIdx + 1}/${steps.length}</span>
            </div>            <div class="prologue-focus-aside-text">${campfireState?.text || ""}</div>
            <div class="prologue-fire-readiness">
              ${campfireChecklist
                .map(
                  (item) =>
                    `<div class="prologue-fire-item ${item.done ? "done" : ""}">${item.done ? "✓" : "•"} ${item.text}</div>`,
                )
                .join("")}
            </div>
          </aside>
        </div>
      </div>
    `;

    document.getElementById("obSkipStepBtn").addEventListener("click", () => {
      this.game.skipOnboarding();
      this.render({ forcePanels: true });
    });
    document
      .getElementById("prologueInsightsBtn")
      ?.addEventListener("click", () => {
        this.openResearchModal();
      });
    document
      .getElementById("prologueBookBtn")
      ?.addEventListener("click", () => {
        this.openKnowledgeModal();
      });
  },

  hideOnboarding() {
    const intro = document.getElementById("onboarding-intro-panel");
    const step = document.getElementById("onboarding-step-panel");
    if (intro) intro.style.display = "none";
    if (step) step.style.display = "none";
  },

  hideOnboardingIntro() {
    const intro = document.getElementById("onboarding-intro-panel");
    if (intro) intro.style.display = "none";
  },

  hideOnboardingStep() {
    const step = document.getElementById("onboarding-step-panel");
    if (step) step.style.display = "none";
  },
});
