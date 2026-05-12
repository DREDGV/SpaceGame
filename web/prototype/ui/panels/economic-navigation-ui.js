// Stage 1C — navigate from economic navigator (no auto-actions).

Object.assign(UI.prototype, {
  clearEconomicGuideHighlight() {
    try {
      if (this._economicGuideTimer) {
        clearTimeout(this._economicGuideTimer);
        this._economicGuideTimer = null;
      }
      document
        .querySelectorAll(".is-guided-highlight")
        .forEach((el) => el.classList.remove("is-guided-highlight"));
    } catch (_) {
      /* ignore */
    }
  },

  applyEconomicGuideHighlight(el) {
    if (!el || typeof el.classList === "undefined") return;
    try {
      this.clearEconomicGuideHighlight();
      el.classList.add("is-guided-highlight");
      this._economicGuideTimer = setTimeout(() => {
        try {
          el.classList.remove("is-guided-highlight");
        } catch (_) {
          /* ignore */
        }
        this._economicGuideTimer = null;
      }, 2200);
    } catch (_) {
      /* ignore */
    }
  },

  /**
   * Переход по подсказке: режим → при необходимости раскрыть доп. панели → рендер → скролл → подсветка.
   * Не вызывает gather/craft/build.
   */
  runEconomicNextStepNavigation(overrideStep) {
    let step = overrideStep;
    try {
      step =
        step ||
        (typeof this.game.getEconomicNextStep === "function"
          ? this.game.getEconomicNextStep()
          : null);
    } catch (_) {
      step = null;
    }
    if (!step) return;

    try {
      this.clearEconomicGuideHighlight();

      const mode = step.targetMode || "production";
      if (typeof this.setShellMode === "function") this.setShellMode(mode);

      const panelId = step.targetPanel || null;
      const extraIds = new Set([
        "gather-panel",
        "buildings-panel",
        "science-panel",
        "automation-panel",
      ]);
      if (panelId && extraIds.has(panelId)) {
        const det = document.getElementById("shell-extra-systems");
        if (det) det.setAttribute("open", "open");
      }

      this.render({ forcePanels: true });

      const findTarget = () => {
        let el = null;
        const hid = step.highlightId;
        const esc =
          typeof CSS !== "undefined" && typeof CSS.escape === "function"
            ? CSS.escape(String(hid))
            : String(hid).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

        if (hid) {
          el = document.querySelector(
            `[data-economic-highlight-id="${esc}"]`,
          );
        }
        if (!el && hid) {
          const core = document.getElementById("shell-economic-core");
          if (core) {
            el = core.querySelector(
              `[data-economic-highlight-id="${esc}"]`,
            );
          }
        }
        if (!el && panelId) {
          el = document.getElementById(panelId);
        }
        if (!el && mode === "production") {
          el =
            document.querySelector(
              '[data-economic-highlight-id="economic-core"]',
            ) || document.getElementById("shell-economic-core");
        }
        return el;
      };

      const run = () => {
        try {
          const el = findTarget();
          if (
            el &&
            typeof el.scrollIntoView === "function" &&
            el.id !== "onboarding-step-panel"
          ) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
          this.applyEconomicGuideHighlight(el);
        } catch (_) {
          /* ignore */
        }
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimeout(run, 70));
      });
    } catch (_) {
      /* ignore */
    }
  },
});
