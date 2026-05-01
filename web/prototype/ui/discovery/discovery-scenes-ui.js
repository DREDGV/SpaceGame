// Discovery scene modal for prologue insights.

Object.assign(UI.prototype, {
  _getDiscoveryEffectIcon(effect) {
    switch (effect?.type) {
      case "knowledge_entry":
        return "📚";
      case "insight_progress":
        return "✨";
      case "next_step":
        return "➡";
      default:
        return "•";
    }
  },

  _getDiscoveryTitleIcon(icon) {
    if (typeof icon !== "string") return "🧠";
    return icon.includes("<svg") ? "✦" : icon;
  },

  _getDiscoverySceneRenderKey(scene) {
    return JSON.stringify({
      sceneId: scene.sceneId,
      isReview: !!scene.isReview,
      status: scene.status,
      feedback: scene.feedback,
      selectedOptionId: scene.selectedOptionId,
      attempts: scene.attempts,
      resolvedAt: scene.resolvedAt,
      canDismiss: scene.canDismiss,
      insightUnlocked: scene.insightUnlocked,
    });
  },

  _resetDiscoveryModalScroll() {
    const body = document.getElementById("discovery-modal-body");
    const panel = body?.closest(".modal-panel");
    const modal = document.getElementById("discovery-modal");
    if (body) body.scrollTop = 0;
    if (panel) panel.scrollTop = 0;
    if (modal) modal.scrollTop = 0;
  },

  bindDiscoveryModal() {
    const modal = document.getElementById("discovery-modal");
    const closeBtn = document.getElementById("discovery-modal-close-btn");
    const body = document.getElementById("discovery-modal-body");
    if (!modal || !closeBtn || !body || modal.dataset.bound === "true") return;

    const hide = () => {
      this._discoveryReviewScene = null;
      modal.style.display = "none";
      document.body.style.overflow = "";
      body.dataset.renderKey = "";
      modal.dataset.discoveryMode = "";
    };

    const closeIfResolved = () => {
      if (modal.dataset.discoveryMode === "review") {
        hide();
        return true;
      }
      if (!this.game.dismissPendingDiscoveryScene?.()) return false;
      hide();
      this.render({ forcePanels: true });
      return true;
    };

    modal.dataset.bound = "true";

    closeBtn.addEventListener("click", () => {
      closeIfResolved();
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeIfResolved();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || modal.style.display !== "flex") return;
      closeIfResolved();
    });

    body.addEventListener("click", (event) => {
      const optionBtn = event.target.closest("[data-discovery-option]");
      if (optionBtn) {
        const result = this.game.resolveDiscoveryScene?.(
          optionBtn.dataset.discoveryOption || "",
        );
        if (result?.ok) {
          this.render({ forcePanels: true });
        }
        return;
      }

      if (event.target.closest("[data-discovery-confirm]")) {
        const result = this.game.resolveDiscoveryScene?.();
        if (result?.ok) {
          this.render({ forcePanels: true });
        }
        return;
      }

      if (event.target.closest("[data-discovery-dismiss]")) {
        closeIfResolved();
        return;
      }

      if (event.target.closest("[data-discovery-knowledge]")) {
        if (!closeIfResolved()) return;
        this.openKnowledgeModal?.();
      }
    });
  },

  _createInsightDiscoveryReviewScene(insightId) {
    const insight = this.game
      .getPrologueInsightsState?.()
      ?.find((item) => item.id === insightId);
    if (!insight?.unlocked) return null;

    const scene = insight.discoveryScene || null;
    if (!scene?.id) return null;

    const interaction = scene.interaction || { type: "confirm" };
    const correctOption = Array.isArray(interaction.options)
      ? interaction.options.find((option) => option.correct) || null
      : null;
    const knowledgeEntry = insight.knowledgeEntry
      ? this.data.prologue?.knowledgeEntries?.[insight.knowledgeEntry] || null
      : null;

    return {
      ...scene,
      sceneId: scene.id,
      insightId: insight.id,
      insightName: insight.name,
      title: scene.title || insight.name || "Озарение",
      icon: insight.icon || "🧠",
      knowledgeEntry,
      interaction,
      effects: Array.isArray(scene.effects) ? scene.effects : [],
      status: "success",
      feedback: correctOption?.result || insight.unlockText || "",
      selectedOptionId: correctOption?.id || "",
      attempts: 0,
      resolvedAt: Date.now(),
      canDismiss: true,
      insightUnlocked: true,
      isReview: true,
    };
  },

  openInsightDiscoveryPreview(insightId) {
    const modal = document.getElementById("discovery-modal");
    const body = document.getElementById("discovery-modal-body");
    if (!modal || !body) return false;

    const scene = this._createInsightDiscoveryReviewScene(insightId);
    if (!scene) return false;

    this.bindDiscoveryModal?.();
    this._discoveryReviewScene = scene;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    this.renderDiscoveryModalContent();
    this._resetDiscoveryModalScroll();
    document.getElementById("discovery-modal-close-btn")?.focus();
    return true;
  },

  syncDiscoveryModal() {
    const modal = document.getElementById("discovery-modal");
    const body = document.getElementById("discovery-modal-body");
    if (!modal || !body) return;

    const scene =
      this._discoveryReviewScene ||
      this.game.getPendingDiscoveryScene?.() ||
      null;
    if (!scene) {
      if (modal.style.display === "flex") {
        modal.style.display = "none";
        document.body.style.overflow = "";
      }
      body.dataset.renderKey = "";
      modal.dataset.discoveryMode = "";
      return;
    }

    const wasHidden = modal.style.display !== "flex";
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    this.renderDiscoveryModalContent();

    if (wasHidden) {
      this._resetDiscoveryModalScroll();
      const firstAction = scene.isReview
        ? document.getElementById("discovery-modal-close-btn")
        : body.querySelector(
            "[data-discovery-option], [data-discovery-confirm], [data-discovery-dismiss], [data-discovery-knowledge]",
          );
      firstAction?.focus();
    }
  },

  renderDiscoveryModalContent() {
    const container = document.getElementById("discovery-modal-body");
    const title = document.getElementById("discovery-modal-title");
    const closeBtn = document.getElementById("discovery-modal-close-btn");
    if (!container || !title || !closeBtn) return;

    const scene = this._discoveryReviewScene || this.game.getPendingDiscoveryScene?.();
    if (!scene) {
      container.innerHTML = "";
      container.dataset.renderKey = "";
      title.textContent = "🧠 Озарение";
      closeBtn.disabled = true;
      const modal = document.getElementById("discovery-modal");
      if (modal) modal.dataset.discoveryMode = "";
      return;
    }

    const renderKey = this._getDiscoverySceneRenderKey(scene);
    const modal = document.getElementById("discovery-modal");
    if (modal) {
      modal.dataset.discoveryMode = scene.isReview ? "review" : "pending";
    }
    closeBtn.disabled = !scene.canDismiss;
    title.textContent = `${this._getDiscoveryTitleIcon(scene.icon)} Озарение: ${scene.title}`;
    if (container.dataset.renderKey === renderKey) return;
    container.dataset.renderKey = renderKey;
    this._resetDiscoveryModalScroll();

    const interaction = scene.interaction || { type: "confirm" };
    const promptTitle = interaction.prompt || "Что стало ясно?";
    const options = Array.isArray(interaction.options)
      ? interaction.options
      : [];
    const isSuccess = scene.status === "success";
    const effects =
      Array.isArray(scene.effects) && scene.effects.length
        ? scene.effects
        : Array.isArray(scene.outcomes)
          ? scene.outcomes.map((label) => ({ type: "outcome", label }))
          : [];
    const imageCandidates = this._getInsightImageCandidates({
      imagePath: scene.image || "",
      insightId: scene.insightId || scene.id || "",
    });
    const hasImage = imageCandidates.length > 0;
    const fallbackCopy = hasImage
      ? scene.alt || scene.title
      : scene.observationText ||
        scene.introText ||
        scene.description ||
        scene.title;
    const promptMarkup =
      interaction.type === "choice"
        ? `
          <section class="discovery-scene-block discovery-scene-block--interaction">
            <div class="discovery-block-label">Наблюдение</div>
            <div class="discovery-prompt">${promptTitle}</div>
            <div class="discovery-choice-list">
              ${options
                .map(
                  (option, index) => `
                    <button
                      type="button"
                      class="discovery-choice-btn${scene.selectedOptionId === option.id ? " is-selected" : ""}"
                      data-discovery-option="${option.id}"
                    >
                      <span class="discovery-choice-index">${index + 1}</span>
                      <span>${option.label}</span>
                    </button>`,
                )
                .join("")}
            </div>
            <div class="discovery-choice-note">Ошибочный выбор не ломает прогресс. Можно присмотреться и выбрать снова.</div>
          </section>`
        : `
          <section class="discovery-scene-block discovery-scene-block--interaction">
            <div class="discovery-block-label">Наблюдение</div>
            <div class="discovery-prompt">${promptTitle}</div>
            <button type="button" class="discovery-btn discovery-btn--primary" data-discovery-confirm>Понять</button>
          </section>`;
    const feedbackMarkup = scene.feedback
      ? `
        <div class="discovery-feedback${isSuccess ? " is-success" : " is-hint"}">
          ${scene.feedback}
        </div>`
      : "";
    const successMarkup = isSuccess
      ? `
        <section class="discovery-scene-block discovery-scene-block--success">
          <div class="discovery-block-label">Вывод</div>
          <div class="discovery-success-title">${scene.successTitle || "Стало ясно"}</div>
          <div class="discovery-success-text">${scene.successText || scene.feedback || ""}</div>
        </section>`
      : "";
    const effectsMarkup = isSuccess
      ? `
        <section class="discovery-scene-block discovery-scene-block--effects">
          <div class="discovery-block-label">${scene.effectsTitle || "Что изменилось"}</div>
          <ul class="discovery-effects-list">
            ${effects
              .map(
                (effect) => `
                  <li class="discovery-effect-item">
                    <span class="discovery-effect-icon">${this._getDiscoveryEffectIcon(effect)}</span>
                    <span>${effect.label || effect.target || "Новый след понимания"}</span>
                  </li>`,
              )
              .join("")}
          </ul>
        </section>`
      : "";
    const footerMarkup = isSuccess
      ? `
        <div class="discovery-footer">
          ${scene.knowledgeEntry ? '<button type="button" class="discovery-btn discovery-btn--ghost" data-discovery-knowledge>Открыть книгу знаний</button>' : ""}
          <button type="button" class="discovery-btn discovery-btn--primary" data-discovery-dismiss>Понятно</button>
        </div>`
      : "";

    container.innerHTML = `
      <div class="discovery-scene-shell${hasImage ? "" : " is-text-forward"}">
        <div class="discovery-scene-media${hasImage ? "" : " is-fallback"}">
          ${
            hasImage
              ? this._renderAutoResolvedImageMarkup({
                  className: "discovery-scene-image",
                  alt: scene.alt || scene.title,
                  candidates: imageCandidates,
                })
              : ""
          }
          <div class="discovery-scene-fallback"${hasImage ? " hidden" : ""}>
            <div class="discovery-scene-fallback-kicker">След наблюдения</div>
            <div class="discovery-scene-fallback-stage">
              <div class="discovery-scene-fallback-icon" aria-hidden="true">${scene.icon}</div>
              <div class="discovery-scene-fallback-title">${scene.title}</div>
            </div>
            <div class="discovery-scene-fallback-copy">${fallbackCopy}</div>
          </div>
        </div>

        <div class="discovery-scene-copy">
          <div class="discovery-scene-kicker">Раннее наблюдение</div>
          <h3 class="discovery-scene-name">${scene.title}</h3>
          <p class="discovery-scene-intro">${scene.introText || scene.description || ""}</p>
          ${
            scene.observationText
              ? `<p class="discovery-scene-observation">${scene.observationText}</p>`
              : ""
          }
          ${isSuccess ? "" : promptMarkup}
          ${feedbackMarkup}
          ${successMarkup}
          ${effectsMarkup}
          ${footerMarkup}
        </div>
      </div>
    `;

    const image = container.querySelector(".discovery-scene-image");
    const media = container.querySelector(".discovery-scene-media");
    const fallback = container.querySelector(".discovery-scene-fallback");
    if (image && media && fallback) {
      const activateFallback = () => {
        if (this._tryAdvanceAutoImageSource(image)) return;
        image.hidden = true;
        image.setAttribute("aria-hidden", "true");
        media.classList.add("is-fallback");
        fallback.hidden = false;
      };

      image.addEventListener("error", activateFallback);

      if (image.complete && !image.naturalWidth) {
        activateFallback();
      }
    }
  },
});
