// UI utility helpers — formatting, tooltips-text, DOM helpers.

Object.assign(UI.prototype, {
  formatResourcePairs(resourceMap, { plus = false, decimals = 0 } = {}) {
    return Object.entries(resourceMap)
      .map(([id, amount]) => {
        const value = this.formatResourceAmount(id, amount, {
          decimals,
          stripTrailingZeros: decimals <= 0,
        });
        return `${this.getResourceDisplayIcon(id)}${plus ? "+" : ""}${value}`;
      })
      .join(" ");
  },

  formatResourcePairsPlain(resourceMap, { plus = false, decimals = 0 } = {}) {
    return Object.entries(resourceMap)
      .map(([id, amount]) => {
        const value = this.formatResourceAmount(id, amount, {
          decimals,
          stripTrailingZeros: decimals <= 0,
        });
        return `${this.getResourceDisplayName(id)} ${plus ? "+" : ""}${value}`;
      })
      .join(", ");
  },

  formatResourceAmount(
    resourceId,
    amount,
    { decimals, includeUnit = true, stripTrailingZeros = true } = {},
  ) {
    const resource = this.data.resources?.[resourceId] || null;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) return String(amount);

    const resolvedDecimals = Number.isFinite(decimals)
      ? decimals
      : Number.isFinite(resource?.amountDisplayDecimals)
        ? resource.amountDisplayDecimals
        : Number.isInteger(numericAmount)
          ? 0
          : 1;

    let value = numericAmount.toFixed(resolvedDecimals);
    if (stripTrailingZeros && resolvedDecimals > 0) {
      value = value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    }

    const unit = includeUnit && resource?.amountUnit ? ` ${resource.amountUnit}` : "";
    return `${value}${unit}`;
  },

  formatSeconds(ms) {
    return `${(ms / 1000).toFixed(1)}с`;
  },

  formatCooldownMs(ms) {
    if (ms <= 0) return "0.0с";
    const deciseconds = Math.ceil(ms / 100);
    const shown = Math.max(1, deciseconds) / 10;
    return `${shown.toFixed(1)}с`;
  },

  formatNumber(value, decimals = 1) {
    return Number(value).toFixed(decimals);
  },

  formatTooltipText(lines) {
    return lines
      .filter((line) => typeof line === "string" && line.trim().length > 0)
      .map((line) =>
        line
          .trim()
          .replace(/<svg[\s\S]*?<\/svg>/gi, "")
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((line) => line.length > 0)
      .join("\n");
  },

  setTooltip(element, lines) {
    if (!element) return;
    const text = this.formatTooltipText(lines);
    if (!text) return;
    element.classList.add("has-tooltip");
    element.setAttribute("data-tooltip", text);
  },

  setButtonAvailability(button, isAvailable) {
    if (!button) return;
    button.disabled = false;
    button.classList.toggle("disabled", !isAvailable);
    button.setAttribute("aria-disabled", isAvailable ? "false" : "true");
  },

  getPlainIcon(icon, fallback = "") {
    if (typeof icon !== "string") return fallback;
    return icon.includes("<") ? fallback : icon;
  },

  hasToolingPresentationUnlock() {
    return (
      (this.game.resources?.crude_tools || 0) >= 1 ||
      (this.game.resourceTotals?.crude_tools || 0) >= 1 ||
      (this.game.resources?.improved_tools || 0) >= 1 ||
      (this.game.resourceTotals?.improved_tools || 0) >= 1 ||
      !!this.game.researched?.basic_tools
    );
  },

  shouldUseEarlyProgressionCopy() {
    if (typeof this.game.isEarlyProgressionMode === "function") {
      return this.game.isEarlyProgressionMode();
    }
    return this.game.isPrologueActive() || !this.hasToolingPresentationUnlock();
  },

  getGatherActionCopy(action) {
    if (!action) {
      return {
        name: "Неизвестное действие",
        description:
          "Данные действия не найдены. Это нужно проверить в настройках карты.",
        icon: "?",
      };
    }

    if (this.shouldUseEarlyProgressionCopy()) {
      return {
        name: action.prologueName || action.name,
        description: action.prologueDescription || action.description,
        icon: action.prologueIcon || action.icon,
      };
    }

    return {
      name: action.name,
      description: action.description,
      icon: action.icon,
    };
  },

  getRecipeCopy(recipe) {
    if (this.shouldUseEarlyProgressionCopy()) {
      return {
        name: recipe.prologueName || recipe.name,
        description: recipe.prologueDescription || recipe.description,
        icon: recipe.prologueIcon || recipe.icon,
      };
    }

    return {
      name: recipe.name,
      description: recipe.description,
      icon: recipe.icon,
    };
  },

  getBuildingCopy(building) {
    if (this.shouldUseEarlyProgressionCopy()) {
      return {
        name: building.prologueName || building.name,
        description: building.prologueDescription || building.description,
        icon: building.prologueIcon || building.icon,
      };
    }

    return {
      name: building.name,
      description: building.description,
      icon: building.icon,
    };
  },

  getResourceDisplayName(resourceId) {
    const resource = this.data.resources?.[resourceId];
    if (!resource) return resourceId;
    if (this.shouldUseEarlyProgressionCopy() && resource.prologueName) {
      return resource.prologueName;
    }
    return resource.name || resourceId;
  },

  getResourceDisplayIcon(resourceId) {
    const resource = this.data.resources?.[resourceId];
    if (!resource) return "";
    if (this.shouldUseEarlyProgressionCopy() && resource.prologueIcon) {
      return resource.prologueIcon;
    }
    return resource.icon || "";
  },

  isPanelHovered(panelId) {
    if (!panelId) return false;
    const panel = document.getElementById(panelId);
    return !!panel && panel.matches(":hover");
  },

  createTimedStatusCard({
    title,
    icon,
    name,
    remainingMs,
    progress,
    note,
    variant,
  }) {
    const card = document.createElement("div");
    card.className = `project-status-card${variant ? ` is-${variant}` : ""}`;
    card.innerHTML = `
      <div class="project-status-top">
        <span class="project-status-title">${title}</span>
        <span class="project-status-remaining">${this.formatSeconds(remainingMs)}</span>
      </div>
      <div class="project-status-name">${icon} ${name}</div>
      ${note ? `<div class="project-status-note">${note}</div>` : ""}
      <div class="project-status-bar">
        <div class="project-status-bar-fill" style="width:${progress * 100}%"></div>
      </div>
    `;
    return card;
  },

  _getInsightImageCandidates({ imagePath = "", insightId = "" } = {}) {
    const EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];
    const candidates = [];
    const seen = new Set();

    const addCandidate = (candidate) => {
      if (typeof candidate !== "string") return;
      const normalized = candidate.trim().replace(/\\/g, "/");
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push(normalized);
    };

    const addPathVariants = (path) => {
      const normalized = typeof path === "string"
        ? path.trim().replace(/\\/g, "/")
        : "";
      if (!normalized) return;

      const match = normalized.match(/^(.*?)(\.[a-zA-Z0-9]+)$/);
      if (match) {
        const [, basePath, extension] = match;
        addCandidate(normalized);
        for (const ext of EXTENSIONS) {
          if (ext === extension.toLowerCase()) continue;
          addCandidate(`${basePath}${ext}`);
        }
      } else {
        for (const ext of EXTENSIONS) {
          addCandidate(`${normalized}${ext}`);
        }
      }
    };

    const addLegacyMirrorVariants = (path) => {
      const normalized = typeof path === "string"
        ? path.trim().replace(/\\/g, "/")
        : "";
      if (!normalized) return;

      if (normalized.startsWith("assets/insights/")) {
        addPathVariants(
          `assets/${normalized.slice("assets/insights/".length)}`,
        );
        addPathVariants(
          `prototype/assets/insights/${normalized.slice("assets/insights/".length)}`,
        );
        addPathVariants(
          `prototype/assets/${normalized.slice("assets/insights/".length)}`,
        );
      }

      if (normalized.startsWith("prototype/assets/insights/")) {
        addPathVariants(
          `assets/insights/${normalized.slice("prototype/assets/insights/".length)}`,
        );
        addPathVariants(
          `assets/${normalized.slice("prototype/assets/insights/".length)}`,
        );
        addPathVariants(
          `prototype/assets/${normalized.slice("prototype/assets/insights/".length)}`,
        );
      }

      if (normalized.startsWith("assets/")) {
        addPathVariants(
          `prototype/${normalized}`,
        );
      }

      if (normalized.startsWith("prototype/assets/")) {
        addPathVariants(
          normalized.slice("prototype/".length),
        );
      }
    };

    addPathVariants(imagePath);
    addLegacyMirrorVariants(imagePath);

    if (insightId) {
      addPathVariants(`assets/insights/${insightId}`);
      addPathVariants(`assets/${insightId}`);
      addPathVariants(`prototype/assets/insights/${insightId}`);
      addPathVariants(`prototype/assets/${insightId}`);
    }

    return candidates;
  },

  _renderAutoResolvedImageMarkup({
    className,
    alt,
    candidates,
  }) {
    if (!Array.isArray(candidates) || candidates.length === 0) return "";

    const [primarySource, ...fallbackSources] = candidates;
    const fallbackAttr = fallbackSources.length
      ? ` data-image-candidates="${fallbackSources.join("||")}"`
      : "";

    return `<img class="${className}" src="${primarySource}" alt="${alt}"${fallbackAttr} />`;
  },

  _tryAdvanceAutoImageSource(image) {
    if (!image) return false;
    const rawCandidates = image.dataset.imageCandidates || "";
    if (!rawCandidates) return false;

    const remaining = rawCandidates.split("||").filter(Boolean);
    if (!remaining.length) return false;

    const [nextSource, ...nextRemaining] = remaining;
    image.dataset.imageCandidates = nextRemaining.join("||");
    image.hidden = false;
    image.removeAttribute("aria-hidden");
    image.src = nextSource;
    return true;
  },
});
