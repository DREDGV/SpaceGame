# Отчёт: универсальный инспектор сущностей (architecture map)

## 1. Изменённые файлы

- `docs/architecture/spacegame-architecture-map.js` — модель выбора, инспекторы, клики, hash, магистраль
- `docs/architecture/spacegame-architecture-map.css` — стили entity-inspector, кликабельности, hover эпох
- `docs/architecture/SPACEGAME_ARCHITECTURE_MAP.html` — подпись магистрали, aria SVG
- `docs/architecture/ARCHITECTURE_SCHEMA.md` — hash и опциональные поля каталога
- `docs/architecture/README.md` — раздел про инспектор
- `docs/architecture/ARCHITECTURE_MAP_RULES.md` — правила кликабельности
- `docs/architecture/SPACEGAME_ARCHITECTURE_MAP.md` — краткое описание
- `tools/validate-architecture-map.mjs` — опциональные поля каталога

## 2. `selectedEntity`

`state.selectedEntity = { kind, id }` синхронизируется с `focusedSystemId` / `focusedEraId` для систем и эпох. API: `selectEntity`, `clearSelectedEntity`, `getSelectedEntity`, `findEntity`.

## 3. Типы инспектора

`system`, `era`, `systemProgression`, `resource`, `research`, `technology`, `enterprise`, `transition`, `bridge`, `prototype`, `roadmap`, `dependency`.

## 4. Hash `#entity:kind:id`

При выборе — `history.replaceState` с `#entity:…`. При загрузке — `applyEntityHashFromUrl()` (приоритет над legacy). Legacy `#era-X`, `#system-id`, якоря секций работают.

## 5–8. Клики

- **Система (магистраль):** `selectEntity("system")`, инспектор справа, подсветка связей; клик по линии — пара в инспекторе (`mainlineEdgePartner`).
- **Эпоха:** spine, карточки шкалы, кнопки «Фокус» — `selectEntity("era")`; hover spine подсвечивает столбец матрицы.
- **Каталог:** карточки с `data-entity-select`, Enter/Space.
- **Сквозные / roadmap / dependencies / prototype / bridge:** кликабельные карточки и чипы.

## 9–10. Связи и прототип

Секция «Связи» в инспекторе: relatedSystems, dependencies, каталог, чипы. Блок «Связь с прототипом» через `prototypeMapping` и `prototypeRefs`.

## 11–12. CSS и валидатор

Классы: `entity-link`, `entity-chip`, `entity-inspector`, `entity-card--selected`, `catalog-entity-card`, и др. Валидатор: `node tools/validate-architecture-map.mjs` → passed.

## 13. Проверки

- `node --check` на `spacegame-architecture-map.js`
- Валидатор данных
- Ручная проверка в браузере: магистраль, инспектор, hash, каталог (рекомендуется)

## 14. Не трогалось

`web/prototype/`, игровой код, массовое наполнение `data.js`.

## 15. Commit message

```
docs: add clickable entity inspector to architecture map
```
