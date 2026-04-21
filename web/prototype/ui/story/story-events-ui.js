// Story event overlay.


UI.prototype.getStoryEventKicker = function getStoryEventKicker(type) {
  switch (type) {
    case "transition":
      return "Новый этап";
    case "campfire":
      return "Рубеж пролога";
    case "character":
      return "Состояние персонажа";
    case "knowledge":
      return "Книга знаний";
    case "prologue":
      return "Первые шаги";
    case "map":
      return "Локальная карта";
    default:
      return "Озарение";
  }
};

UI.prototype.renderStoryEvent = function renderStoryEvent() {
  const layer = document.getElementById("story-event-layer");
  if (!layer) return;

  const event = this.game.getActiveStoryEvent();
  if (!event) {
    this.lastStoryEventId = "";
    layer.innerHTML = "";
    layer.style.display = "none";
    return;
  }

  if (event.id === this.lastStoryEventId) {
    layer.style.display = "block";
    return;
  }

  this.lastStoryEventId = event.id;

  layer.style.display = "block";
  layer.innerHTML = `
    <article class="story-event story-event--${event.type || "default"}">
      <div class="story-event-main">
        <div class="story-event-kicker">${this.getStoryEventKicker(event.type)}</div>
        <div class="story-event-title">${event.icon || "✦"} ${event.title}</div>
        <div class="story-event-text">${event.text || ""}</div>
      </div>
      <div class="story-event-actions">
        ${
          event.action === "insights"
            ? '<button class="story-event-action js-story-action" type="button">Озарения</button>'
            : event.action === "knowledge"
              ? '<button class="story-event-action js-story-action" type="button">Книга знаний</button>'
              : ""
        }
        <button class="story-event-close" type="button" aria-label="Закрыть">✕</button>
      </div>
    </article>
  `;

  layer.querySelector(".story-event-close")?.addEventListener("click", () => {
    this.game.dismissStoryEvent(event.id);
    this.render({ forcePanels: true });
  });

  layer.querySelector(".js-story-action")?.addEventListener("click", () => {
    if (event.action === "insights") {
      this.openResearchModal();
    } else if (event.action === "knowledge") {
      this.openKnowledgeModal();
    }
    this.game.dismissStoryEvent(event.id);
    this.render({ forcePanels: true });
  });
};
