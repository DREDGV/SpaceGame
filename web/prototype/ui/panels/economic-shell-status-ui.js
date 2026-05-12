// Stage 1B — compact economic status in sidebar (navigator).

Object.assign(UI.prototype, {
  renderEconomicShellStatus() {
    const container = document.getElementById("shell-economic-status");
    if (!container) return;

    if (this.game.shouldShowOnboardingIntro?.()) {
      container.hidden = true;
      container.innerHTML = "";
      this.lastEconomicShellStatusKey = "";
      return;
    }

    const bundle = this.game.getCurrentEconomicStageBundle?.() || {
      id: "lone_survivor",
      def: null,
    };
    const def = bundle.def;
    const nextId = def?.nextStageId || null;
    const nextDef = nextId
      ? this.game.getEconomicStageDefinition?.(nextId)
      : null;
    const nextStep =
      this.game.getEconomicNextStep?.() || {
        headline: "",
        detail: "",
        source: "stage",
        goalId: null,
      };
    const critical = this.game.getEconomicCriticalCampProblems?.(2) || [];

    const oneLineDesc = (def?.summary || def?.description || "").trim();
    const descShort =
      oneLineDesc.length > 120 ? `${oneLineDesc.slice(0, 117)}…` : oneLineDesc;

    const nextStageLine = nextDef
      ? `Дальше: ${nextDef.title}`
      : "Дальнейшие этапы — по постройкам и цепочкам.";

    const metaBits = [];
    if (nextStep.source === "goal" && nextStep.goalId) {
      metaBits.push(`цель: ${nextStep.goalId}`);
    } else if (nextStep.source === "complete") {
      metaBits.push("цели выполнены");
    } else if (nextStep.source === "onboarding") {
      metaBits.push("пролог");
    } else {
      metaBits.push("фокус этапа");
    }

    const renderKey = JSON.stringify({
      id: bundle.id,
      next: nextId,
      h: nextStep.headline,
      s: nextStep.source,
      g: nextStep.goalId,
      c: critical.map((p) => p.text),
      cta: nextStep.ctaLabel,
      tm: nextStep.targetMode,
      th: nextStep.highlightId,
    });
    if (renderKey === this.lastEconomicShellStatusKey) return;
    this.lastEconomicShellStatusKey = renderKey;

    container.hidden = false;

    const stageTitle = this._ecoreEscapeHtml(def?.title || "Этап развития");
    const descHtml = descShort
      ? `<p class="econ-status-desc">${this._ecoreEscapeHtml(descShort)}</p>`
      : "";
    const detailHtml =
      nextStep.detail && nextStep.detail !== descShort
        ? `<p class="econ-status-desc">${this._ecoreEscapeHtml(nextStep.detail)}</p>`
        : "";

    const problemsHtml = critical.length
      ? `<ul class="econ-status-problems">${critical
          .map(
            (p) =>
              `<li class="${p.tone === "bad" ? "is-bad" : ""}">${this._ecoreEscapeHtml(p.text)}</li>`,
          )
          .join("")}</ul>`
      : "";

    const ctaLabel = this._ecoreEscapeHtml(
      nextStep.ctaLabel || "Перейти",
    );

    container.innerHTML = `
      <p class="econ-status-kicker">Экономический фокус</p>
      <p class="econ-status-stage">${stageTitle}</p>
      ${descHtml}
      <p class="econ-status-next-stage">${this._ecoreEscapeHtml(nextStageLine)}</p>
      <p class="econ-status-step-label">Следующий шаг</p>
      <p class="econ-status-step">${this._ecoreEscapeHtml(nextStep.headline || "Следуйте подсказкам сценария.")}</p>
      ${detailHtml}
      ${problemsHtml}
      <div class="econ-status-foot">
        <span class="econ-status-meta">${this._ecoreEscapeHtml(metaBits.join(" · "))}</span>
        <button type="button" class="econ-status-cta" data-economic-nav-cta="1" aria-label="${ctaLabel}">${ctaLabel}</button>
      </div>
    `;

    const btn = container.querySelector("[data-economic-nav-cta]");
    if (btn) {
      btn.addEventListener("click", () => {
        this.runEconomicNextStepNavigation?.();
      });
    }
  },
});
