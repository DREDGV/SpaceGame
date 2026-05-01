# TASK 03 — GOALS + NARRATIVE + AUTOMATION IMPROVEMENT

**Status:** IMPLEMENTED  
**Audit:** v0.1.18  
**Note:** Основной результат уже реализован; документ полезен как историческая спецификация.

## Goal

Improve player motivation, clarity, and immersion by:

- adding a simple narrative intro
- implementing goal system
- fixing automation behavior (campfire)

---

## 1. Narrative Introduction (REQUIRED)

### Implement:

Add a short intro text at game start (2–4 lines max)

### Example:

"You arrive in an unexplored land.
No tools, no production — only raw resources.
Your goal is to build the foundation of a new colony."

### Requirements:

- shown once at start OR visible in UI
- simple, not long
- no complex story system

### Purpose:

- give context
- increase immersion

---

## 2. Goal System (REQUIRED)

### Implement:

Simple sequential goals

Example:

1. Gather 10 wood
2. Craft crude_tools
3. Build workshop
4. Build campfire
5. Produce 3 bricks

### Requirements:

- show current goal
- update when completed
- automatically move to next goal

### Purpose:

- guide player
- give direction
- increase engagement

---

## 3. Campfire Automation Fix (REQUIRED)

### Improve:

- clear state system

States:

- Running (processing)
- Waiting for resources
- Idle (optional)

### UI Requirements:

- show current state text
- show progress bar only when running
- show what resource is missing

### Logic Requirements:

- do NOT reset progress incorrectly
- stable timer behavior
- process continues independently of UI

### Purpose:

- make automation understandable
- avoid confusion

---

## 4. Gameplay Flow Improvements (IMPORTANT)

- connect brick → building usage
- ensure automation has purpose
- reinforce progression chain

---

## 5. UI Improvements

- show current goal clearly
- show intro text or log message
- improve automation readability

---

## 6. Restrictions

DO NOT:

- add new large systems
- add new tiers
- add space mechanics
- expand content heavily

Focus only on:
clarity, motivation, and system stability

---

## 7. Acceptance Criteria

Task is complete when:

- player understands what to do next
- intro gives context
- goals guide progression
- campfire behavior is clear and stable
- automation feels predictable
- gameplay feels more directed and meaningful
