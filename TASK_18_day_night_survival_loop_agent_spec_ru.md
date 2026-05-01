# TASK_16_DAY_NIGHT_SURVIVAL_LOOP

**Status:** IMPLEMENTED  
**Audit:** v0.1.18  
**Note:** Основной результат уже реализован; документ полезен как историческая спецификация.

## Задача для ИИ-агента в VS Code

Проект: `DREDGV/SpaceGame`  
Цель задачи: добавить в игру первый полноценный survival-loop: **день проходит через действия игрока → вечером игрок готовится к ночи → ночью лагерь получает последствия → утром начинается новый день**.

Эта задача должна сделать раннюю primitive-эпоху интереснее, но без расширения игры в новые эпохи и без добавления лишних систем.

---

# 1. Контекст проекта

Текущий прототип запускается через:

```txt
web/prototype.html
```

В проекте уже есть:

- `web/prototype/game-state.js` — основной класс `GameState`, логика игры, ресурсы, сохранение, прогресс.
- `web/prototype/app.js` — точка входа и основной tick-loop.
- `web/prototype/data/world.js` — ресурсы, цели, эпохи, энергия.
- `web/prototype/data/character.js` — персонаж, сытость, вода, переносимый вес, действия сбора.
- `web/prototype/data/production.js` — рецепты, здания, улучшения, технологии.
- `web/prototype/data/terrain.js` — локальная карта лагеря, клетки, ресурсы, места построек, тропы.
- `web/prototype/ui.js` — основной UI-класс.
- `web/prototype/ui/panels/` — UI-модули панелей.
- `web/prototype/css/` — стили отдельных частей интерфейса.

В игре уже есть:

- пролог;
- основание лагеря;
- локальная hex-карта;
- сбор ресурсов;
- энергия;
- сытость;
- вода;
- крафт;
- строительство;
- исследования;
- автоматизация;
- сохранение прогресса в localStorage;
- лог событий;
- story events.

---

# 2. Главная идея задачи

Сейчас игрок в основном выполняет последовательность правильных действий:

```txt
собрать ресурсы → сделать инструмент → построить костёр → построить мастерскую → развивать производство
```

Нужно добавить простой, понятный и ощутимый ритм:

```txt
День → действия игрока → подготовка к ночи → ночь → последствия → новое утро
```

Игрок должен начать думать:

```txt
Успею ли я подготовиться к ночи?
Хватит ли дерева?
Есть ли еда и вода?
Нужно ли сначала поставить укрытие?
Рискнуть ещё одним сбором или сохранить силы?
```

---

# 3. Жёсткие ограничения

## Нельзя делать в этой задаче

Не добавлять:

- новые эпохи;
- глобальную карту мира;
- сезоны;
- сложную погоду;
- болезни;
- смерть персонажа;
- нападения зверей;
- боёвку;
- охоту;
- мораль общины;
- население;
- сложную экономику;
- новые десятки ресурсов;
- крупный редизайн интерфейса;
- переписывание архитектуры проекта.

## Нельзя ломать

Нельзя ломать:

- существующий пролог;
- основание лагеря;
- сбор ресурсов;
- карту лагеря;
- крафт;
- строительство;
- исследования;
- автоматизацию;
- сохранение и загрузку;
- существующий UI.

## Принцип реализации

Работать маленьким устойчивым шагом.  
Не придумывать параллельную архитектуру.  
Встраивать механику суток в существующий `GameState`.

---

# 4. Что нужно реализовать

Нужно реализовать три связанных блока:

1. Состояние суток в `GameState`.
2. Ночную проверку выживания.
3. UI-панель `День и ночь`.

---

# 5. Блок 1 — Цикл суток

## 5.1. Добавить конфиг в `world.js`

Файл:

```txt
web/prototype/data/world.js
```

Рядом с блоком `energy` добавить новый блок `dayCycle`:

```js
dayCycle: {
  startingDay: 1,
  startingPhase: "morning",

  phases: [
    {
      id: "morning",
      label: "Утро",
      icon: "🌅",
      actionBudget: 4,
      description: "Время коротких выходов и планирования дня."
    },
    {
      id: "day",
      label: "День",
      icon: "☀️",
      actionBudget: 6,
      description: "Лучшее время для сбора, строительства и разведки."
    },
    {
      id: "evening",
      label: "Вечер",
      icon: "🌇",
      actionBudget: 4,
      description: "Последний шанс подготовиться к ночи."
    },
    {
      id: "night",
      label: "Ночь",
      icon: "🌙",
      actionBudget: 0,
      autoResolve: true,
      description: "Ночью лагерь проверяется на устойчивость."
    }
  ],

  nightNeeds: {
    baseWood: 2,
    food: 1,
    water: 1
  },

  historyLimit: 10
}
```

Если в `world.js` уже есть похожий конфиг, не дублировать. Аккуратно расширить существующий.

---

## 5.2. Добавить поля в `GameState`

Файл:

```txt
web/prototype/game-state.js
```

В `constructor` добавить состояние суток.

Новые поля:

```js
this.dayNumber = 1;
this.dayPhase = "morning";
this.actionsLeftInPhase = 4;
this.lastNightResult = null;
this.dayHistory = [];
```

Но не задавать значения жёстко, если есть конфиг `this.data.dayCycle`.

Использовать значения из конфига:

- `startingDay`;
- `startingPhase`;
- `actionBudget` текущей стартовой фазы.

---

## 5.3. Добавить методы в `GameState`

Добавить методы:

```js
getDayCycleConfig();
getCurrentPhaseDef();
getCurrentPhaseIndex();
getDayState();
advanceDayAction(reason);
advanceToNextPhase();
resolveNight();
getNightForecast();
```

---

## 5.4. Метод `getDayCycleConfig()`

Метод должен вернуть конфиг `this.data.dayCycle` с безопасными дефолтами.

Если конфиг отсутствует, использовать:

```js
{
  startingDay: 1,
  startingPhase: "morning",
  phases: [
    { id: "morning", label: "Утро", icon: "🌅", actionBudget: 4 },
    { id: "day", label: "День", icon: "☀️", actionBudget: 6 },
    { id: "evening", label: "Вечер", icon: "🌇", actionBudget: 4 },
    { id: "night", label: "Ночь", icon: "🌙", actionBudget: 0, autoResolve: true }
  ],
  nightNeeds: { baseWood: 2, food: 1, water: 1 },
  historyLimit: 10
}
```

---

## 5.5. Метод `getCurrentPhaseDef()`

Метод должен вернуть объект текущей фазы по `this.dayPhase`.

Если текущая фаза не найдена, вернуть фазу `morning`.

---

## 5.6. Метод `getCurrentPhaseIndex()`

Метод должен вернуть индекс текущей фазы в массиве `phases`.

Если фаза не найдена, вернуть `0`.

---

## 5.7. Метод `getDayState()`

Метод должен вернуть объект для UI и отладки:

```js
{
  dayNumber: this.dayNumber,
  phase: this.dayPhase,
  phaseLabel: currentPhase.label,
  phaseIcon: currentPhase.icon,
  phaseDescription: currentPhase.description,
  actionsLeft: this.actionsLeftInPhase,
  actionsTotal: currentPhase.actionBudget,
  lastNightResult: this.lastNightResult,
  dayHistory: this.dayHistory
}
```

---

## 5.8. Метод `advanceDayAction(reason)`

Метод вызывается после значимого действия игрока.

### Значимые действия

Должны тратить 1 действие суток:

- ручной сбор ресурса;
- сбор ресурса с клетки карты;
- начало крафта;
- начало строительства;
- начало исследования;
- основание лагеря;
- улучшение здания;
- прокладка тропы, если такая функция уже есть.

### Незначимые действия

Не должны тратить действие суток:

- открытие модального окна;
- закрытие модального окна;
- просмотр книги знаний;
- просмотр исследований;
- выбор клетки карты;
- наведение на клетку;
- переключение UI;
- вход/выход из экрана лагеря;
- автосохранение;
- автоматическое производство;
- регенерация энергии;
- обновление UI;
- tick-loop.

### Логика метода

```js
advanceDayAction(reason) {
  const phase = this.getCurrentPhaseDef();
  if (!phase || this.dayPhase === "night") return false;

  const budget = Number.isFinite(phase.actionBudget) ? phase.actionBudget : 0;
  if (budget <= 0) return false;

  this.actionsLeftInPhase = Math.max(0, this.actionsLeftInPhase - 1);
  this.markDirty();

  if (this.actionsLeftInPhase <= 0) {
    this.advanceToNextPhase();
  }

  return true;
}
```

`reason` можно пока использовать только для отладки/будущего расширения. Не обязательно выводить его в UI.

---

## 5.9. Метод `advanceToNextPhase()`

Логика:

1. Получить список фаз.
2. Найти текущую фазу.
3. Перейти к следующей фазе.
4. Если следующая фаза — `night`, вызвать `resolveNight()`.
5. После ночи автоматически начать новое утро следующего дня.

Пример поведения:

```txt
День 1, Утро → День 1, День → День 1, Вечер → Ночь → День 2, Утро
```

Если следующая фаза обычная:

```js
this.dayPhase = nextPhase.id;
this.actionsLeftInPhase = nextPhase.actionBudget;
```

Если следующая фаза `night`:

```js
this.dayPhase = "night";
this.actionsLeftInPhase = 0;
this.resolveNight();
```

После `resolveNight()`:

```js
this.dayNumber += 1;
this.dayPhase = "morning";
this.actionsLeftInPhase = morningPhase.actionBudget;
```

Добавить лог при смене фаз:

- утром: `🌅 Наступило утро дня N.`
- днём: `☀️ День в разгаре.`
- вечером: `🌇 Наступает вечер. Пора подумать о ночи.`
- ночью: лог должен идти из `resolveNight()`.

Не спамить логом слишком сильно.

---

# 6. Блок 2 — Ночная проверка выживания

## 6.1. Метод `getNightForecast()`

Метод должен возвращать прогноз готовности к ночи.

Формат:

```js
{
  day: this.dayNumber,
  phase: this.dayPhase,
  phaseLabel: "Утро",
  phaseIcon: "🌅",
  actionsLeft: 4,
  actionsTotal: 4,

  night: {
    woodNeeded: 2,
    woodHave: 1,
    hasEnoughWood: false,

    foodNeeded: 1,
    foodHave: 0,
    hasFood: false,

    waterNeeded: 1,
    waterHave: 1,
    hasWater: true,

    hasCampfire: true,
    hasShelter: false,

    readiness: "good" | "stable" | "rough" | "bad",
    summary: "Ночь будет тяжёлой. Нужны дрова, еда или вода."
  }
}
```

---

## 6.2. Правила readiness

### `good`

Условия:

- есть костёр;
- хватает дерева;
- есть еда;
- есть вода;
- есть укрытие.

Текст:

```txt
Лагерь готов к ночи.
```

### `stable`

Условия:

- есть костёр;
- хватает дерева;
- но не хватает одного из факторов: еда, вода или укрытие.

Текст:

```txt
Ночь переживём, но запасов мало.
```

### `rough`

Условия:

- костёр есть, но дерева не хватает;
- или костра нет, но есть укрытие и хотя бы часть запасов.

Текст:

```txt
Ночь будет тяжёлой. Нужно усилить подготовку.
```

### `bad`

Условия:

- нет костра;
- нет укрытия;
- нет еды или воды.

Текст:

```txt
Ночь будет очень тяжёлой. Нужны тепло, вода и укрытие.
```

---

## 6.3. Метод `resolveNight()`

Метод должен подвести итог ночи.

### Что проверять

Проверить:

```js
const hasCampfire = !!this.buildings.campfire;
const hasShelter = !!this.buildings.rest_tent;
const woodHave = this.resources.wood || 0;
const foodHave = this.resources.food || 0;
const waterHave = this.resources.water || 0;
```

Потребности брать из `this.data.dayCycle.nightNeeds`.

Базово:

```js
woodNeeded = 2;
foodNeeded = 1;
waterNeeded = 1;
```

### Списание ресурсов

Если есть костёр:

- попытаться списать дерево;
- списать можно только сколько есть;
- в минус не уходить.

```js
woodSpent = Math.min(woodHave, woodNeeded);
this.resources.wood -= woodSpent;
```

Еду:

```js
foodSpent = Math.min(foodHave, foodNeeded);
this.resources.food -= foodSpent;
```

Воду:

```js
waterSpent = Math.min(waterHave, waterNeeded);
this.resources.water -= waterSpent;
```

Если костра нет, дерево ночью не списывать.

---

## 6.4. Типы результата ночи

Нужно получить результат:

```js
"good" | "stable" | "rough" | "bad";
```

Можно использовать `getNightForecast().night.readiness` как основу, но итог должен учитывать фактическое списание ресурсов.

---

## 6.5. Эффекты ночи

Ночь не должна убивать игрока. Эффекты должны быть мягкими.

### good

Условия:

- есть костёр;
- хватило дерева;
- есть еда;
- есть вода;
- есть палатка.

Эффект:

```js
this.energy = Math.max(this.energy, Math.ceil(this.maxEnergy * 0.7));
this.satiety = Math.max(0, Math.min(this.maxSatiety, this.satiety - 0.2));
this.hydration = Math.max(0, Math.min(this.maxHydration, this.hydration - 0.2));
```

Сообщение:

```txt
🌅 Ночь прошла спокойно. Лагерь удержал тепло и порядок.
```

---

### stable

Условия:

- есть костёр;
- хватило дерева;
- но не хватает еды, воды или укрытия.

Эффект:

```js
this.energy = Math.max(this.energy, Math.ceil(this.maxEnergy * 0.5));
this.satiety = Math.max(0, this.satiety - 0.7);
this.hydration = Math.max(0, this.hydration - 0.7);
```

Сообщение:

```txt
🌙 Ночь прошла терпимо, но лагерь ещё неустойчив.
```

---

### rough

Условия:

- костёр есть, но дерева не хватило;
- или нет костра, но есть укрытие или часть запасов.

Эффект:

```js
this.energy = Math.min(this.energy, Math.ceil(this.maxEnergy * 0.5));
this.energy = Math.max(1, this.energy);
this.satiety = Math.max(0, this.satiety - 1.2);
this.hydration = Math.max(0, this.hydration - 1.2);
```

Если есть палатка, смягчить штрафы примерно на 25%.

Сообщение:

```txt
🥶 Ночь выдалась тяжёлой. Тепла и запасов не хватило.
```

---

### bad

Условия:

- нет костра;
- нет укрытия;
- не хватает еды или воды.

Эффект:

```js
this.energy = Math.min(this.energy, Math.ceil(this.maxEnergy * 0.35));
this.energy = Math.max(1, this.energy);
this.satiety = Math.max(0, this.satiety - 1.8);
this.hydration = Math.max(0, this.hydration - 1.8);
```

Сообщение:

```txt
🌑 Ночь прошла плохо. Без тепла, воды и укрытия люди проснулись разбитыми.
```

---

## 6.6. Обновить состояние персонажа

После применения эффектов ночи вызвать существующую логику пересчёта состояния персонажа, если она уже есть.

Например, если в `GameState` есть метод вроде:

```js
this._syncCharacterConditionState(...)
```

использовать его аккуратно.

Не создавать вторую независимую систему состояний персонажа.

---

## 6.7. Сформировать `lastNightResult`

После ночи сохранить:

```js
this.lastNightResult = {
  day: this.dayNumber,
  result,
  woodNeeded,
  woodSpent,
  foodNeeded,
  foodSpent,
  waterNeeded,
  waterSpent,
  hadCampfire: hasCampfire,
  hadShelter: hasShelter,
  message,
  effects: {
    energyBefore,
    energyAfter: this.energy,
    satietyBefore,
    satietyAfter: this.satiety,
    hydrationBefore,
    hydrationAfter: this.hydration,
  },
};
```

---

## 6.8. Добавить запись в `dayHistory`

Добавить в `this.dayHistory` краткую запись:

```js
this.dayHistory.push({
  day: this.dayNumber,
  result,
  message,
  woodSpent,
  foodSpent,
  waterSpent,
});
```

Хранить только последние 10 записей или лимит из конфига:

```js
const limit = this.getDayCycleConfig().historyLimit || 10;
this.dayHistory = this.dayHistory.slice(-limit);
```

---

## 6.9. Добавить лог и story event

Добавить лог:

```js
this.addLog(message);
```

Если в проекте есть `_pushStoryEvent`, использовать его.

Пример:

```js
this._pushStoryEvent({
  type: "survival",
  icon:
    result === "good"
      ? "🌅"
      : result === "stable"
        ? "🌙"
        : result === "rough"
          ? "🥶"
          : "🌑",
  title: "Итог ночи",
  text: message,
  ttlMs: result === "good" ? 4500 : 6500,
});
```

Не создавать несколько story events за одну ночь. Одного достаточно.

---

# 7. Блок 3 — UI-панель `День и ночь`

## 7.1. Изменить `prototype.html`

Файл:

```txt
web/prototype.html
```

Сейчас в левом сайдбаре есть примерно такой блок:

```html
<aside id="game-sidebar">
  <div id="era-progress-panel" class="panel panel-era-progress"></div>
  <section id="resources-panel" class="panel"></section>
</aside>
```

Нужно вставить новую панель между прогрессом эпохи и ресурсами:

```html
<aside id="game-sidebar">
  <div id="era-progress-panel" class="panel panel-era-progress"></div>
  <section id="day-cycle-panel" class="panel panel-day-cycle"></section>
  <section id="resources-panel" class="panel"></section>
</aside>
```

---

## 7.2. Подключить CSS

В `prototype.html` подключить новый CSS-файл рядом с остальными:

```html
<link rel="stylesheet" href="prototype/css/day-cycle.css" />
```

Создать файл:

```txt
web/prototype/css/day-cycle.css
```

---

## 7.3. Подключить JS-модуль UI

Создать файл:

```txt
web/prototype/ui/panels/day-cycle-ui.js
```

Подключить его в `prototype.html` рядом с другими `ui/panels` скриптами:

```html
<script src="prototype/ui/panels/day-cycle-ui.js"></script>
```

Лучше подключить после:

```html
<script src="prototype/ui/panels/era-progress-ui.js"></script>
```

и до research/knowledge/onboarding модулей.

---

## 7.4. Реализовать `renderDayCyclePanel`

В файле:

```txt
web/prototype/ui/panels/day-cycle-ui.js
```

Добавить:

```js
UI.prototype.renderDayCyclePanel = function () {
  const el = document.getElementById("day-cycle-panel");
  if (!el) return;

  const forecast = this.game.getNightForecast?.();
  if (!forecast) {
    el.innerHTML = "";
    return;
  }

  // render HTML here
};
```

UI должен брать готовую логику из `game.getNightForecast()`.  
Не дублировать расчёт готовности к ночи внутри UI.

---

## 7.5. Вызвать рендер панели из общего render

Найти в `web/prototype/ui.js` метод `render()`.

Добавить вызов:

```js
this.renderDayCyclePanel?.();
```

Вызов должен быть рядом с другими render-панелями.

---

## 7.6. Что должна показывать панель

Панель должна показывать:

1. Номер дня.
2. Текущую фазу.
3. Сколько действий осталось до смены фазы.
4. Мини-прогресс текущей фазы.
5. Подготовку к ночи:
   - костёр;
   - дрова;
   - еда;
   - вода;
   - укрытие.
6. Краткую подсказку по готовности.
7. Последний итог ночи, если он есть.

---

## 7.7. Пример HTML-структуры

Пример итоговой структуры внутри панели:

```html
<div class="day-cycle-card is-rough">
  <div class="day-cycle-header">
    <div class="day-cycle-title">
      <span class="day-cycle-icon">🌅</span>
      <span>День 1 — Утро</span>
    </div>
    <strong class="day-cycle-actions">4 действия</strong>
  </div>

  <div class="day-cycle-progress" aria-label="Прогресс фазы">
    <span class="is-filled"></span>
    <span class="is-filled"></span>
    <span></span>
    <span></span>
  </div>

  <div class="night-forecast">
    <div class="night-forecast-title">🌙 Подготовка к ночи</div>

    <ul class="night-check-list">
      <li class="is-ok">🔥 Костёр: есть</li>
      <li class="is-warn">🪵 Дрова: 1/2</li>
      <li class="is-missing">🍖 Еда: нет</li>
      <li class="is-ok">💧 Вода: есть</li>
      <li class="is-missing">⛺ Укрытие: нет</li>
    </ul>

    <div class="night-summary">
      Ночь будет тяжёлой. Нужно усилить подготовку.
    </div>
  </div>

  <div class="last-night-result">
    Прошлая ночь: 🌙 Ночь прошла терпимо, но лагерь ещё неустойчив.
  </div>
</div>
```

Точный HTML может отличаться, но информация должна быть такой.

---

## 7.8. Правила классов состояния

Использовать классы:

```txt
.is-good
.is-stable
.is-rough
.is-bad
.is-ok
.is-warn
.is-missing
```

Не использовать inline-цвета.

---

## 7.9. CSS-стиль

Файл:

```txt
web/prototype/css/day-cycle.css
```

Стиль должен быть:

- компактный;
- тёмный;
- спокойный;
- похожий на существующий стиль SpaceGame;
- без кислотных цветов;
- без мультяшного перегруза.

Примерные элементы:

```css
.panel-day-cycle {
  overflow: hidden;
}

.day-cycle-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.day-cycle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.day-cycle-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 700;
}

.day-cycle-actions {
  font-size: 0.85rem;
  opacity: 0.85;
}

.day-cycle-progress {
  display: grid;
  grid-template-columns: repeat(var(--phase-budget, 4), 1fr);
  gap: 0.25rem;
}

.day-cycle-progress span {
  height: 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.day-cycle-progress span.is-filled {
  background: rgba(255, 220, 150, 0.75);
}

.night-check-list {
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
  font-size: 0.88rem;
}

.night-check-list li {
  opacity: 0.9;
}

.night-check-list li.is-ok {
  opacity: 1;
}

.night-check-list li.is-warn {
  opacity: 0.95;
}

.night-check-list li.is-missing {
  opacity: 0.75;
}

.night-summary {
  margin-top: 0.55rem;
  font-size: 0.86rem;
  line-height: 1.35;
  opacity: 0.9;
}

.last-night-result {
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.82rem;
  opacity: 0.78;
}
```

Можно улучшить CSS, но не делать огромный редизайн.

---

# 8. Где вызывать `advanceDayAction()`

Нужно найти реальные методы в `GameState`, которые выполняют действия игрока.

Перед изменениями обязательно найти методы, отвечающие за:

- сбор ресурсов вручную;
- сбор с клетки карты;
- старт крафта;
- старт строительства;
- старт исследования;
- основание лагеря;
- улучшение здания;
- создание тропы, если уже есть.

После успешного выполнения действия вызывать:

```js
this.advanceDayAction("gather");
```

или другой reason:

```js
this.advanceDayAction("craft");
this.advanceDayAction("build");
this.advanceDayAction("research");
this.advanceDayAction("found_camp");
this.advanceDayAction("upgrade");
this.advanceDayAction("trail");
```

Важно: вызывать только после успешного действия.  
Если действие не выполнено из-за нехватки ресурсов, энергии или блокировки — время не тратить.

---

# 9. Сохранение и загрузка

## 9.1. Что нужно сохранить

Добавить в save-state:

```js
dayNumber: this.dayNumber,
dayPhase: this.dayPhase,
actionsLeftInPhase: this.actionsLeftInPhase,
lastNightResult: this.lastNightResult,
dayHistory: this.dayHistory
```

---

## 9.2. Что нужно загрузить

При загрузке:

- если `dayNumber` есть и число — использовать;
- если нет — взять `startingDay`;
- если `dayPhase` есть и такая фаза существует — использовать;
- если нет — взять `startingPhase`;
- если `actionsLeftInPhase` есть и число — использовать;
- если нет — взять `actionBudget` текущей фазы;
- если `lastNightResult` есть — использовать;
- если нет — `null`;
- если `dayHistory` массив — использовать последние 10 записей;
- если нет — пустой массив.

Старые сохранения не должны ломаться.

---

# 10. Баланс на первое внедрение

Пока использовать такой баланс:

```txt
Утро: 4 действия
День: 6 действий
Вечер: 4 действия
Ночь: авторазрешение
```

Итого игрок имеет 14 действий до ночи.

Потребность ночи:

```txt
Дерево: 2, если есть костёр
Еда: 1
Вода: 1
```

Эффекты ночи должны быть мягкими.  
Игрок не должен застрять из-за одной плохой ночи.

---

# 11. Ручная проверка после выполнения

После реализации проверить вручную:

## Проверка 1 — отображение панели

1. Открыть `web/prototype.html`.
2. Убедиться, что в левом сайдбаре появилась панель `День и ночь`.
3. Должно быть видно:
   - день;
   - фазу;
   - действия;
   - подготовку к ночи.

## Проверка 2 — действия двигают время

1. Выполнить сбор ресурса.
2. Проверить, что действий стало меньше.
3. Выполнить ещё несколько действий.
4. Проверить переход:
   - утро → день;
   - день → вечер;
   - вечер → ночь → новое утро.

## Проверка 3 — ночь с плохой подготовкой

1. Не собирать еду/воду/дерево.
2. Дойти до ночи.
3. Проверить, что появился плохой или тяжёлый итог ночи.
4. Проверить, что энергия/сытость/вода изменились.
5. Проверить, что игра не сломалась и не стала непроходимой.

## Проверка 4 — ночь с хорошей подготовкой

1. Построить костёр, если возможно.
2. Иметь дерево, еду, воду и укрытие.
3. Дойти до ночи.
4. Проверить хороший итог ночи.

## Проверка 5 — сохранение

1. Дойти до другой фазы, например до вечера.
2. Обновить страницу.
3. Проверить, что день, фаза и действия восстановились.
4. Проверить, что последний итог ночи сохраняется.

## Проверка 6 — старое сохранение

1. Проверить загрузку существующего сохранения без новых полей.
2. Ошибок быть не должно.
3. Новые поля должны подставиться автоматически.

---

# 12. Acceptance Criteria

## Игровой результат

Задача считается выполненной, если:

- игрок видит текущий день и фазу суток;
- игрок видит, сколько действий осталось до смены фазы;
- значимые действия двигают время;
- ночь наступает автоматически после вечера;
- ночь проверяет подготовку лагеря;
- костёр, дерево, еда, вода и укрытие реально влияют на итог ночи;
- утром игрок получает понятные последствия;
- плохая ночь неприятна, но не ломает прохождение;
- хорошая ночь ощущается как награда за подготовку;
- появляется смысл готовиться заранее.

## Технический результат

Задача считается выполненной, если:

- нет ошибок в консоли;
- старые сохранения не ломаются;
- новые поля сохраняются и загружаются;
- существующий пролог работает;
- существующая карта лагеря работает;
- сбор ресурсов работает;
- крафт работает;
- строительство работает;
- исследования работают;
- автоматизация работает;
- UI не ломает существующие панели;
- ночь не зависит от реального времени, а зависит от действий игрока.

---

# 13. Что НЕ делать после выполнения

После выполнения этой задачи не нужно сразу добавлять:

- случайные события;
- погоду;
- риск клеток;
- зверей;
- охоту;
- болезни;
- население;
- мораль;
- сезоны;
- новые эпохи.

Это будет следующая отдельная задача.

Сейчас нужно качественно завершить только:

```txt
Действия дня → подготовка → ночь → последствия → новое утро
```

---

# 14. Отчёт после выполнения

После завершения работы агент должен написать краткий отчёт:

```markdown
## Что сделано

- ...

## Изменённые файлы

- ...

## Где вызывается advanceDayAction()

- ...

## Как работает resolveNight()

- ...

## Как проверить вручную

- ...

## Что можно улучшить позже

- ...
```

---

# 15. Главная формулировка для агента

Выполни только `TASK_16_DAY_NIGHT_SURVIVAL_LOOP`.

Не расширяй игру в стороны.  
Не добавляй новые большие системы.  
Не переписывай архитектуру.  
Добавь первый survival-loop через сутки, подготовку к ночи и мягкие последствия ночи.

Цель — чтобы ранняя игра стала интереснее не за счёт количества кнопок, а за счёт понятного напряжения:

```txt
успеть подготовиться до ночи
```
