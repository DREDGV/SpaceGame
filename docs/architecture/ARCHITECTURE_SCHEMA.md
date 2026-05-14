# SpaceGame — схема данных архитектурной карты

Источник правды: `spacegame-architecture-data.js`. Просмотрщик: `SPACEGAME_ARCHITECTURE_MAP.html`. Игровой код (`web/prototype/`) в эту схему не входит.

Объект верхнего уровня:

```js
window.SPACEGAME_ARCHITECTURE = {
  meta: {},
  eras: [],
  systems: [],
  dependencies: [],
  roadmap: [],
  uiScreens: [],
  gameCatalog: {},
  gameResources: [],
  gameResearch: [],
  gameTechnologies: [],
  gameEnterprises: []
};
```

---

## `meta`

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | string | Заголовок карты |
| `description` | string | Подзаголовок |
| `version` | string | Версия набора данных |
| `updatedAt` | string | Дата обновления (человекочитаемо) |

---

## `eras[]`

Каждая эпоха — один объект. Идентификаторы эпох: **A–K** (см. таблицу дат в правилах и в индексе карты).

**Перечень полей объекта эпохи (ориентир):** `id`, опционально `timelineSpanYears`, `title`, `dates`, `summary`, `timePace`, `status`, `role`, `designWeight`, `gameplayDensity`, `playerTimeShare`, `contentGuideline`, `periods`, опционально `goals`, `events`, `discoveries`, `limits`, `systems`, `transition` (внутри: `to`, `condition`, `unlocks`, опционально `checklist`).

### Обязательные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | `A` … `K`, уникальный |
| `title` | string | Название эпохи |
| `dates` | string | Диапазон для человека (может содержать «до н.э.», «+») |
| `summary` | string | Смысл эпохи |
| `timePace` | string | Игровой темп / масштаб решений |
| `status` | string | `prototype` \| `designing` \| `planned` \| `later` \| `needs_rework` \| `blocked` |
| `periods` | array | Список периодов (см. ниже) |
| `systems` | object | Текстовые слои по ключам (см. просмотрщик `eraSystemKeys`) |
| `transition` | object | Переход к следующей эпохе: `to`, `condition`, `unlocks[]`, опционально **`checklist[]`** (критерии перехода; см. ниже) |

### Проектный вес и роль (стабилизация наполнения)

| Поле | Тип | Допустимые значения |
|------|-----|----------------------|
| `role` | string | `tutorial`, `bridge`, `core_expansion`, `state_expansion`, `transition`, `industrial_core`, `modern_core`, `planetary_core`, `space_core`, `endgame` |
| `designWeight` | string | `light`, `medium`, `heavy`, `core` |
| `gameplayDensity` | string | `low`, `medium`, `high`, `very_high` |
| `playerTimeShare` | string | `short`, `medium`, `long`, `very_long`, `endgame` |
| `contentGuideline` | string | Краткий текст: насколько глубоко наполнять эпоху и чего избегать |

**Смысл:** одинаковая *форма* эпох не означает одинаковый *объём* списков `goals` / `events` и т.д. Вес задаёт приоритет проработки в дизайне, а не требование числа строк.

### Опциональные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `timelineSpanYears` | object | `{ from, to }` в астрономических годах (до н.э. — отрицательные); для пропорции полосы на HTML-карте. Опционально `note` (строка). |
| `goals`, `events`, `discoveries`, `limits` | string[] | Проектные списки; пустой массив допустим |

### `era.periods[]`

| Поле | Тип |
|------|-----|
| `id` | string (например `C1`) |
| `title` | string |
| `dates` | string |
| `summary` | string |

### `era.transition`

| Поле | Тип | Описание |
|------|-----|----------|
| `to` | string \| null | Следующая эпоха (`B` … `K`) или `null` у финальной |
| `condition` | string | Условие перехода |
| `unlocks` | string[] | Краткие теги открываемого масштаба |
| `checklist` | string[] (опционально) | Критерии осмысленного перехода: что должно быть в дизайне/реализации; не лор. Если массив пустой — в HTML блок не показывается. Валидатор: если поле есть, это массив непустых строк. |

## `systems[]`

Глоссарий игровых систем в матрице «эпоха × система».

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный id (латиница, snake_case) |
| `title` | string | Заголовок |
| `description` | string | Что это за слой |
| `appearsIn` | string | Эпоха A–K, с которой система появляется в проекте |
| `becomesCoreIn` | string | Эпоха, где система становится «ядром» |
| `status` | string | Как у эпох |
| `notes` | string | Проектные заметки |

Правило: `appearsIn` и `becomesCoreIn` должны быть валидными буквами A–K и `appearsIn` не правее `becomesCoreIn` по порядку алфавита A–K.

---

## `dependencies[]`

| Поле | Тип |
|------|-----|
| `from` | string (id системы или слоя из глоссария) |
| `to` | string |
| `type` | string (код связи; в HTML может отображаться по-русски) |
| `description` | string |

---

## `roadmap[]`

| Поле | Тип |
|------|-----|
| `id` | string |
| `title` | string |
| `status` | string |
| `summary` | string |
| `checklist` | string[] (опционально) |

---

## `uiScreens[]`

| Поле | Тип |
|------|-----|
| `id` | string |
| `title` | string |
| `appearsIn` | string (эпоха A–K) |
| `status` | string |
| `summary` | string |

---

## `gameCatalog`

Один объект-заголовок слоя каталога:

| Поле | Тип |
|------|-----|
| `title` | string |
| `summary` | string |
| `status` | string |

---

## `gameResources[]` | `gameResearch[]` | `gameTechnologies[]` | `gameEnterprises[]`

Общие поля:

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный внутри массива |
| `title` | string | Название сущности |
| `eraFrom`, `eraTo` | string | Эпохи A–K; `eraFrom` не правее `eraTo` по порядку A–K |
| `summary` | string | Смысл в игре |
| `status` | string | Как у эпох |

Дополнительно:

- **gameResources:** `category` (string).
- **gameResearch:** `unlocks` (string[], опционально) — теги последствий.
- **gameTechnologies:** `requires` (string[], опционально) — id зависимостей (соглашение проекта).
- **gameEnterprises:** `type` (string) — роль узла (например `production`, `space`).

Каталог не должен расти быстрее, чем зафиксированы эпохи и системы: новая строка должна иметь ясные `eraFrom`/`eraTo` и связь с системами в тексте или в будущих полях связи.

---

## Проверка

```bash
node tools/validate-architecture-map.mjs
```

При успехе: `Architecture map validation passed.`  
При ошибках: список проблем и код выхода `1`.

Валидатор проверяет структуру и допустимые перечисления, **не** требует одинаковой длины списков целей/событий у всех эпох. Для эпох: ровно **11** записей с id **A–K** по одному разу; объект **`transition`** с непустым **`condition`**; для **A–J** поле **`to`** — строго следующая буква по шкале; для **K** — `to` равен `null` или `""`; **`checklist`** — непустой массив непустых строк; **`unlocks`** при наличии — массив. Объект **`gameCatalog`**, если есть: `title`, `summary`, `status`.
