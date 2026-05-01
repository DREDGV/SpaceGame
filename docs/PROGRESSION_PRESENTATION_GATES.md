# PROGRESSION PRESENTATION GATES

## Назначение

Этот документ фиксирует правило для ранней карты SpaceGame:

```text
Сущность не должна появляться на карте, в списках ресурсов, действиях, рецептах или постройках раньше, чем игрок получил знание, исследование, постройку или практический опыт, который делает эту сущность понятной.
```

Проблема, из-за которой введено правило: ранний этап может технически выйти из онбординга, но всё ещё оставаться доинструментальным. Поэтому нельзя завязывать историческую подачу только на `isPrologueActive()`.

## Главный принцип

Разделяем два состояния:

- **onboarding/prologue UI** — активен ли обучающий сценарий;
- **material progression** — что община реально уже понимает и умеет.

Для исторической и технологической подачи использовать:

```js
GameState.isEarlyProgressionMode();
GameState.hasToolingPresentationUnlock();
GameState.isProgressionGateMet(gate);
```

Не использовать один `isPrologueActive()` как источник правды для иконок, названий и доступа к будущим сущностям.

## Поля данных

### `presentationGate`

Используется у ресурсов, действий, рецептов и построек.

Пример:

```js
clay: {
  name: "Глина",
  futureStage: "post_fire_craft",
  presentationGate: {
    buildings: ["campfire"],
    hint: "Глина станет осмысленным ресурсом после первого устойчивого костра."
  }
}
```

### `mapRevealGate`

Используется у клеток локальной карты. Даже если клетка попала в радиус разведки или была раскрыта старым сохранением, карта не должна показывать её ресурс, действие или будущую роль до выполнения gate.

Пример:

```js
clay_bank: {
  actionId: "gather_clay",
  resourceType: "clay",
  mapRevealGate: {
    buildings: ["campfire"],
    hint: "Глинистый берег скрыт до первого устойчивого костра."
  }
}
```

## Поддерживаемые условия gate

```js
{
  insights: ["sharp_edge"],
  tech: ["labor_division"],
  buildings: ["campfire"],
  resources: ["crude_tools"],
  resourceTotals: ["crude_tools"],
  tooling: true,
  campSetupDone: true,
  notEarlyProgression: true,
  anyOf: [{ tech: ["basic_tools"] }, { buildings: ["workshop"] }],
  allOf: [{ buildings: ["campfire"] }, { tech: ["mining"] }],
  hint: "Текст причины для locked-клетки."
}
```

## Кодовый контракт

Все проверки должны идти через `GameState`:

- `isResourcePresentationUnlocked(resourceId)`
- `isGatherActionPresentationUnlocked(actionId)`
- `isRecipePresentationUnlocked(recipeId)`
- `isBuildingPresentationUnlocked(buildingId)`
- `isCampTilePresentationUnlocked(tile)`
- `getCampTilePresentationLockHint(tile)`

Карта, сбор, крафт, строительство и боковые панели не должны вручную решать, “можно ли уже показывать” будущую сущность. UI может только отображать результат этих методов.

## Правила для карты

1. Клетка с будущим ресурсом должна иметь `mapRevealGate` или `discoveryRequirements`.
2. Клетка с `resourceType`, у которого есть `presentationGate`, не раскрывается без выполнения gate.
3. Клетка с `actionId`, у которого есть `presentationGate`, не раскрывается без выполнения gate.
4. `visible_locked` можно показывать как неизвестный/закрытый участок, но без будущей иконки, названия ресурса, действия сбора или изображения.
5. Клик по такой клетке не должен обходить gate через ручную разведку.
6. Раскрытие маршрута и ручная разведка — разные сценарии:

- ручная разведка использует строгий `canExploreCampTile()` / `_canTileMeetDiscoveryRules()`;
- физический проход по маршруту может раскрыть обычный туман через `_canRevealCampTileByTraversal()`;
- проход по маршруту не должен раскрывать `presentationGate` / `mapRevealGate` сущности из будущего.

7. Поиск пути должен стараться обходить `presentationLocked` клетки, если они не являются самой целью маршрута.

## Правила для UI

1. Для названий и иконок ресурсов использовать `getResourceDisplayName()` и `getResourceDisplayIcon()`.
2. Для действий, рецептов и построек использовать `getGatherActionCopy()`, `getRecipeCopy()`, `getBuildingCopy()`.
3. Не выводить raw `resource.icon`, `action.icon`, `building.icon` там, где сущность может зависеть от прогресса.
4. Раннее дерево показывается как ветки/хворост до `hasToolingPresentationUnlock()`.

## Чеклист добавления новой сущности

Перед добавлением ресурса, действия, рецепта, постройки или клетки карты ответить:

1. Это природная вещь, которую человек раннего этапа уже может распознать?
2. Если нет, какое озарение, исследование, постройка или инструмент делает её понятной?
3. Есть ли `presentationGate` у ресурса/действия/рецепта/постройки?
4. Есть ли `mapRevealGate` у клетки карты, если она может раскрыться через разведку?
5. Есть ли раннее название/иконка, если сущность существует физически, но ещё не осмыслена технологически?

## Текущие зафиксированные правила

- `wood` до первых орудий показывается как ветки/хворост.
- `clay` и `gather_clay` открываются после `campfire`.
- `brick` открывается после `campfire`.
- `plank` открывается после первого инструментального шага (`tooling`).
- `workshop_parts` открываются после `labor_division`.
- `improved_tools` открываются после `crafting`.
- `storage_site` открывается после первых орудий и `campfire`.
- `workshop_site` открывается после `labor_division`.
- `kiln_site` открывается после `workshop` и `mining`.
