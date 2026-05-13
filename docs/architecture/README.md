# SpaceGame Architecture Map

Эта папка содержит расширяемую визуальную архитектурную карту SpaceGame. Карта устроена как data-driven инструмент: данные отдельно, стили отдельно, HTML-просмотрщик отдельно.

## Как открыть карту

Открыть файл в браузере:

```text
docs/architecture/SPACEGAME_ARCHITECTURE_MAP.html
```

## Где редактировать данные

Редактировать:

```text
docs/architecture/spacegame-architecture-data.js
```

Главный объект:

```js
window.SPACEGAME_ARCHITECTURE = {
  meta: {},
  eras: [],
  systems: [],
  dependencies: [],
  roadmap: [],
  uiScreens: []
};
```

## Что не трогать без необходимости

- HTML-структуру, если меняются только данные.
- CSS, если меняются только эпохи, периоды, системы, зависимости или roadmap.
- Игровые файлы в `web/prototype`.

## Как добавить эпоху

Добавить объект в массив `eras`.

Минимально нужны:

- `id`;
- `title`;
- `dates`;
- `summary`;
- `timePace`;
- `status`;
- `periods`;
- `systems`;
- `transition`.

## Как добавить период

Добавить объект в `era.periods`:

```js
{
  id: "A3",
  title: "Название периода",
  dates: "...",
  summary: "..."
}
```

## Как добавить систему

Добавить объект в `systems`:

```js
{
  id: "systemId",
  title: "Название",
  description: "Что делает система",
  appearsIn: "A",
  becomesCoreIn: "C",
  status: "designing",
  notes: "Проектные заметки"
}
```

## Как добавить зависимость

Добавить объект в `dependencies`:

```js
{
  from: "people",
  to: "needs",
  type: "requires",
  description: "Люди требуют еды, воды, жилья и безопасности"
}
```

## Статусы

- `prototype` — уже частично есть в прототипе.
- `designing` — проектируется сейчас.
- `planned` — запланировано для будущих этапов.
- `later` — поздняя игра или отложенный слой.

## Правило развития

Если новая идея не помещается в эпоху, систему, зависимость или переход, сначала расширяется карта. Игровой код меняется только после того, как место идеи в архитектуре понятно.
