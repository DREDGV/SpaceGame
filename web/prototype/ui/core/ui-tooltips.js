// Tooltip delay logic.

Object.assign(UI.prototype, {

  _showTooltipDelayed(tooltipEl, text, delayMs = 1500) {
    if (this._tooltipTimer) clearTimeout(this._tooltipTimer);
    this._tooltipTimer = setTimeout(() => {
      this._tooltipTimer = null;
      tooltipEl.textContent = text;
      tooltipEl.hidden = false;
    }, delayMs);
  },

  _hideTooltip(tooltipEl) {
    if (this._tooltipTimer) {
      clearTimeout(this._tooltipTimer);
      this._tooltipTimer = null;
    }
    tooltipEl.hidden = true;
  },

});
