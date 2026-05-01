# MAP_DATA_MODEL_V1_RU

## SpaceGame — модель данных локальной карты V1

Документ для ИИ-агентов и разработчиков.  
Цель — описать минимальную, но расширяемую модель данных для первой версии локальной карты SpaceGame.

Этот документ дополняет `MAP_SYSTEM_V1_RU.md`.

Главный принцип:

```text
Сначала простая рабочая модель данных.
Потом расширения: регионы, планета, логистика, экология, фракции, космос.
```

---

## 1. Что должна поддерживать модель V1

Модель данных должна поддерживать:

- локальную flat-top hex-карту;
- выбор гекса;
- тип местности;
- вместимость участка;
- занятое место;
- тип участка;
- постройки внутри участка;
- базовые качества участка;
- ресурсы участка;
- дороги/тропы между соседними гексами;
- базовый контроль территории;
- сохранение и загрузку состояния.

В V1 не нужно полноценно моделировать:

- региональную карту;
- планету;
- орбиту;
- космос;
- сложные фракции;
- войны;
- электросети;
- трубопроводы;
- железные дороги;
- сложную экологию;
- внутренние карты зданий;
- свободное строительство.

Но некоторые поля можно заложить заранее как заготовку.

---

## 2. Основные сущности V1

Минимальный набор сущностей:

```text
LocalMap
HexTile
Building
RoadLink
ResourceNode
PlayerState / FactionState
MapSelectionState
```

Желательные заготовки на будущее:

```text
Zone
Complex
Territory
WorkerAssignment
Route
Upgrade
Event
```

В V1 их можно не реализовывать полностью, но важно не закрыть возможность добавить их позже.

---

## 3. LocalMap

`LocalMap` — объект локальной карты.

Он хранит:

- размеры карты;
- список гексов;
- список дорожных связей;
- seed генерации;
- стартовую позицию;
- версию схемы данных.

### Рекомендуемая структура

```text
LocalMap:
  id
  name
  width
  height
  orientation
  scaleMetersPerHex
  seed
  hexes[]
  roadLinks[]
  startHexId
  createdAt
  updatedAt
  schemaVersion
```

### Пояснение полей

| Поле | Назначение |
|---|---|
| `id` | уникальный идентификатор карты |
| `name` | название карты, например `Стоянка у ручья` |
| `width` | ширина карты в гексах |
| `height` | высота карты в гексах |
| `orientation` | всегда `flat-top` |
| `scaleMetersPerHex` | для V1: `20` |
| `seed` | seed генерации карты |
| `hexes[]` | список гексов карты |
| `roadLinks[]` | список связей между гексами |
| `startHexId` | стартовый гекс лагеря |
| `schemaVersion` | версия структуры данных |

### Важное правило

В V1 рекомендуется стартовать с карты:

```text
32×32
```

Позже можно перейти к:

```text
48×48
64×64
```

---

## 4. HexTile

`HexTile` — ключевая сущность локальной карты.

Гекс — это участок территории.

### Рекомендуемая структура

```text
HexTile:
  id
  q
  r
  terrainType
  biome
  elevation
  moisture
  fertility

  plotType
  capacity
  usedCapacity

  buildings[]
  resourceNodeId

  farmQuality
  buildQuality
  resourceQuality
  logisticsQuality

  ownerId
  controllerId
  discovered
  controlled

  roadLinkIds[]
  status[]

  pollution
```

---

## 5. Координаты гекса

Для hex-карты рекомендуется использовать axial coordinates:

```text
q
r
```

Для flat-top hex это удобная базовая модель.

### Пример

```text
HexTile:
  q: 4
  r: 7
```

### Почему axial

- удобно искать соседей;
- удобно считать расстояние;
- удобно хранить карту;
- удобно расширять на региональные карты.

### Соседи flat-top hex

У каждого гекса 6 соседей.

Важно: конкретные направления должны быть реализованы стабильно и одинаково во всём проекте.

Рекомендуемые направления:

```text
E
NE
NW
W
SW
SE
```

Для axial coordinates можно использовать стандартные смещения, но агент должен проверить, какая система уже используется в проекте, если карта уже есть.

---

## 6. terrainType

`terrainType` — базовая местность гекса.

Рекомендуемые значения V1:

```text
plain
fertile_plain
forest
river_bank
stone
clay
hill
swamp
water
```

### Пояснение

| Значение | Смысл |
|---|---|
| `plain` | ровная поляна / равнина |
| `fertile_plain` | плодородная земля |
| `forest` | лес |
| `river_bank` | берег / ручей |
| `stone` | каменистый участок |
| `clay` | глина |
| `hill` | холм / склон |
| `swamp` | болото |
| `water` | вода |

В V1 можно начать с меньшего набора:

```text
plain
forest
river_bank
stone
clay
water
```

---

## 7. capacity и usedCapacity

`capacity` — доступная вместимость участка.  
`usedCapacity` — сколько вместимости уже занято постройками.

### Базовая логика

```text
capacity зависит от terrainType
usedCapacity = сумма spaceCost всех построек на гексе
```

### Пример

```text
capacity: 16
usedCapacity: 7
```

Это значит:

```text
Свободно: 9
```

### Рекомендуемые стартовые значения capacity

| terrainType | capacity |
|---|---:|
| `plain` | 20 |
| `fertile_plain` | 20 |
| `river_bank` | 16 |
| `forest` | 14 |
| `stone` | 10 |
| `clay` | 12 |
| `hill` | 8 |
| `swamp` | 5 |
| `water` | 0 |

Для воды можно позже разрешить специальные постройки, но в V1 проще считать воду непригодной для обычной застройки.

---

## 8. plotType

`plotType` — тип участка с точки зрения застройки/использования.

Рекомендуемые значения V1:

```text
empty
camp
residential
storage
craft
agriculture
extraction
defense
resource
water
```

### Пояснение

| plotType | Назначение |
|---|---|
| `empty` | пустой участок |
| `camp` | лагерный центр |
| `residential` | жильё |
| `storage` | склад |
| `craft` | ремесло / мастерская |
| `agriculture` | поле / сельское хозяйство |
| `extraction` | добыча |
| `defense` | оборона |
| `resource` | природный ресурсный участок |
| `water` | водный участок |

В V1 `plotType` можно менять при строительстве первой постройки.

Пример:

```text
Построили склад → plotType = storage
```

---

## 9. buildings[]

`buildings[]` — список построек внутри гекса.

В V1 это может быть массив объектов `Building` или массив `buildingIds`.

Для простоты в текущем прототипе можно хранить постройки прямо внутри гекса.  
Для более чистой архитектуры лучше хранить отдельную коллекцию построек и ссылаться по `id`.

### Вариант для простого прототипа

```text
HexTile:
  buildings: [
    {
      id
      type
      level
      condition
    }
  ]
```

### Вариант для расширяемой модели

```text
HexTile:
  buildingIds[]
```

```text
Buildings:
  byId
```

Рекомендация:

```text
Если текущий код проекта простой — можно начать с buildings[] внутри HexTile.
Если уже есть централизованный state — лучше использовать buildingIds[].
```

---

## 10. Building

`Building` — постройка внутри участка.

### Рекомендуемая структура

```text
Building:
  id
  type
  name
  hexId
  plotType
  spaceCost

  level
  condition

  workersRequired
  workersAssigned

  inputResources
  outputResources
  storage

  productionRate
  status[]

  createdAt
  upgradedAt
```

---

## 11. Building type

Рекомендуемые типы построек V1:

```text
campfire
shelter
storage
workshop
field
clay_pit
stone_pit
watch_post
```

### Таблица V1

| type | Название | spaceCost | plotType |
|---|---|---:|---|
| `campfire` | Костёр | 2 | `camp` |
| `shelter` | Укрытие | 4 | `residential` |
| `storage` | Склад | 5 | `storage` |
| `workshop` | Мастерская | 6 | `craft` |
| `field` | Поле | 8 | `agriculture` |
| `clay_pit` | Глиняная яма | 4 | `extraction` |
| `stone_pit` | Каменоломня | 6 | `extraction` |
| `watch_post` | Сторожевой пост | 3 | `defense` |

Цифры предварительные и могут быть изменены балансировкой.

---

## 12. Проверка возможности строительства

Перед строительством нужно проверить:

```text
1. Гекс открыт игроком?
2. Гекс контролируется игроком?
3. terrainType подходит?
4. plotType совместим?
5. хватает capacity?
6. хватает ресурсов?
7. нет запрещающего статуса?
```

### Базовая формула

```text
canBuild = 
  discovered
  && controlled
  && terrainAllowed
  && plotTypeAllowed
  && usedCapacity + building.spaceCost <= capacity
  && resourcesEnough
```

### Пример отказа

Если `usedCapacity = 13`, `capacity = 16`, а постройка требует `spaceCost = 5`, строительство запрещено:

```text
Недостаточно места: нужно 5, доступно 3
```

---

## 13. Качества участка

Для V1 рекомендуется хранить несколько простых качеств:

```text
farmQuality
buildQuality
resourceQuality
logisticsQuality
```

Значения можно хранить как числа:

```text
0–100
```

И показывать игроку категориями:

```text
низкая / средняя / высокая
```

### Назначение

| Поле | Влияет на |
|---|---|
| `farmQuality` | урожайность |
| `buildQuality` | удобство строительства |
| `resourceQuality` | добычу |
| `logisticsQuality` | движение/подключение |

В V1 эти качества можно использовать частично. Например, только `farmQuality` для поля и `resourceQuality` для добычи.

---

## 14. ResourceNode

`ResourceNode` — ресурсная характеристика участка.

В V1 можно упростить и хранить прямо в `HexTile`:

```text
resourceType
resourceAmount
```

Но лучше понимать будущую модель.

### Простая структура V1

```text
HexTile:
  resourceType
  resourceAmount
```

### Возможные resourceType

```text
wood
stone
clay
water
food
none
```

### Позже

Можно вынести в отдельную сущность:

```text
ResourceNode:
  id
  hexId
  type
  amount
  maxAmount
  regenerationRate
  quality
```

---

## 15. RoadLink

`RoadLink` — связь между двумя соседними гексами.

В логике игры дороги не должны быть постройкой внутри одного гекса.  
Дорога — это связь между двумя гексами.

### Рекомендуемая структура

```text
RoadLink:
  id
  fromHexId
  toHexId
  direction
  type
  level
  capacity
  condition
  ownerId
  traffic
  status[]
```

### type V1

```text
none
trail
road
```

Для V1 можно хранить только существующие связи, то есть не хранить `none`.

### Позже

```text
rail
power_line
pipeline
canal
highway
```

---

## 16. RoadLink direction

`direction` показывает направление от `fromHexId` к `toHexId`.

Рекомендуемые направления:

```text
E
NE
NW
W
SW
SE
```

Для обратной стороны должна быть функция получения противоположного направления.

Пример:

```text
E ↔ W
NE ↔ SW
NW ↔ SE
```

---

## 17. RoadLink как двусторонняя связь

В V1 дороги лучше считать двусторонними.

```text
Гекс A соединён с гексом B
Гекс B соединён с гексом A
```

В данных можно хранить одну запись `RoadLink`, но при поиске пути учитывать её в обе стороны.

---

## 18. Отображение RoadLink

Визуал дороги можно менять позже.

Для V1 важно только:

- roadLink соединяет соседние гексы;
- тип дороги виден на карте;
- путь совпадает с направлением перемещения;
- визуал не должен ломать арт гекса.

Визуальные варианты можно менять без изменения модели данных.

---

## 19. Territory / контроль

В V1 территория минимальная.

В `HexTile` достаточно:

```text
ownerId
controllerId
discovered
controlled
```

### Значения

| Поле | Назначение |
|---|---|
| `ownerId` | формальный владелец |
| `controllerId` | фактический контролёр |
| `discovered` | открыт ли гекс игроком |
| `controlled` | можно ли строить/использовать |

На старте:

- гекс лагеря controlled = true;
- соседние гексы могут быть controlled = true;
- дальние гексы discovered = false или controlled = false.

---

## 20. Status

`status[]` — список состояний гекса или постройки.

### Возможные статусы гекса

```text
blocked
under_construction
needs_road
low_capacity
polluted
danger
unknown
```

### Возможные статусы постройки

```text
active
inactive
under_construction
damaged
no_workers
no_resources
storage_full
```

В V1 достаточно нескольких:

```text
under_construction
no_workers
no_resources
damaged
```

---

## 21. Pollution

`pollution` лучше добавить сразу, но не делать полноценную экологию в V1.

```text
pollution: 0
```

Позже это поле пригодится для:

- фабрик;
- загрязнения почвы;
- качества воды;
- штрафов к жилью;
- экологии;
- болезней;
- лояльности;
- технологий очистки.

В V1 можно просто хранить поле и не использовать его активно.

---

## 22. MapSelectionState

Для UI нужна отдельная сущность состояния выбора.

### Рекомендуемая структура

```text
MapSelectionState:
  selectedHexId
  selectedBuildingId
  selectedRoadLinkId
  activeMapMode
  buildModeBuildingType
```

### activeMapMode

```text
overview
build
logistics
territory
resources
```

В V1 достаточно:

```text
overview
build
```

Позже добавить:

```text
logistics
territory
resources
```

---

## 23. PlayerState / FactionState

Для V1 нужно минимально хранить ресурсы игрока и идентификатор фракции.

### Рекомендуемая структура

```text
PlayerState:
  id
  name
  resources
```

### resources

```text
wood
stone
clay
food
fiber
tools
```

Позже:

```text
money
metal
energy
science
influence
components
fuel
```

---

## 24. Сохранение

Состояние карты должно сохраняться.

Сохранять нужно:

```text
LocalMap
HexTile[]
Building[]
RoadLink[]
PlayerState
MapSelectionState можно не сохранять
```

Если в проекте уже есть save system, агент должен встроить карту в существующую систему сохранения, а не создавать параллельный несовместимый механизм.

---

## 25. Генерация стартовой карты

Для V1 можно использовать простую генерацию:

- 32×32;
- стартовый лагерь в центре или рядом с ручьём;
- рядом лес;
- рядом камень;
- рядом глина;
- несколько плодородных участков;
- часть карты не открыта.

### Стартовая область

```text
startHex:
  plotType = camp
  building = campfire
  controlled = true
  discovered = true
```

Соседние гексы:

```text
discovered = true
controlled = true
```

Дальние:

```text
discovered = false
controlled = false
```

---

## 26. Минимальные игровые операции

V1 должна поддерживать операции:

```text
selectHex(hexId)
buildOnHex(hexId, buildingType)
removeBuilding(buildingId)
upgradePlot(hexId, upgradeType)
createRoadLink(fromHexId, toHexId, type)
removeRoadLink(roadLinkId)
```

На первом этапе можно не реализовывать все, но модель должна их поддерживать.

---

## 27. Важные ограничения V1

Не добавлять:

- свободные координаты X/Y для построек;
- произвольный поворот построек;
- сложный footprint на несколько гексов;
- внутренние мини-гексы;
- сложную физическую симуляцию дорог;
- динамические реки;
- полноценные фракционные границы;
- продвинутую экологию.

Если агент считает, что это нужно, он должен сначала предложить отдельный план, а не внедрять это самовольно.

---

## 28. Совместимость с будущими системами

Модель V1 должна позволять позже добавить:

- региональные карты;
- зоны из нескольких гексов;
- комплексы из нескольких гексов;
- маршруты доставки;
- рабочие назначения;
- влияние фракций;
- загрязнение;
- железные дороги;
- ЛЭП;
- трубопроводы;
- портовые и космические объекты.

Но в V1 эти системы не реализуются полностью.

---

## 29. Итоговая рекомендуемая структура V1

```text
GameState
  localMap
    hexes[]
    roadLinks[]
  buildings[]
  playerState
  ui.mapSelection
```

Или, если проект использует модульную структуру:

```text
state.map.localMap
state.map.hexes
state.map.roadLinks
state.map.buildings
state.player.resources
state.ui.selectedHexId
```

Агент должен адаптироваться к текущей архитектуре проекта и не ломать существующий код без необходимости.

---

## 30. Критерии готовности модели данных V1

Модель данных считается готовой, если:

- можно создать карту 32×32;
- каждый гекс имеет `q`, `r`, `terrainType`, `capacity`, `plotType`;
- можно выбрать гекс;
- можно построить постройку, если хватает вместимости;
- `usedCapacity` пересчитывается корректно;
- нельзя строить сверх вместимости;
- можно создать `RoadLink` между соседними гексами;
- roadLink хранит тип `trail` или `road`;
- состояние карты можно сохранить и загрузить;
- данные не мешают будущему добавлению зон, маршрутов и территорий.

---

## 31. Главный принцип для агента

```text
Не усложнять V1.
Сначала сделать стабильную локальную карту.
Все спорные визуальные и крупномасштабные системы оставить расширениями.
```
