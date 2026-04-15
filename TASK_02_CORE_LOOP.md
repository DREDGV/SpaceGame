# TASK 02 — CORE GAME LOOP UPGRADE

## Goal
Transform the prototype from a basic click-based system into an early-stage economic system with constraints, automation, and meaningful decisions.

---

## 1. Player Energy System (REQUIRED)

### Mechanics
- Player has energy (e.g. 10 max)
- Gathering actions consume energy
- Energy regenerates over time

### Purpose
- Prevent infinite clicking
- Force prioritization
- Introduce decision-making

---

## 2. First Automation Layer (REQUIRED)

### Implement:
At least 1 building that performs automatic actions over time.

Example:
- Campfire:
  - converts clay → brick every X seconds

### Requirements:
- runs automatically
- consumes input resources
- produces output resources
- visible in UI

### Purpose:
- shift from manual play to system thinking

---

## 3. Tool Impact System (REQUIRED)

### Mechanics:
Tools affect gathering efficiency.

Example:
- no tools → +1 wood
- crude_tools → +2 wood

### Purpose:
- reward crafting
- create progression feel

---

## 4. Resource Flow Clarity (REQUIRED)

### Add:
- visual or textual indication of:
  - input → output
  - what produces what
  - what consumes what

### Purpose:
- help player understand system

---

## 5. Basic Bottleneck System (IMPORTANT)

At least one limitation must exist:
- storage limit OR
- energy limit OR
- production speed limit

### Purpose:
- force decisions
- prevent mindless accumulation

---

## 6. UI Adjustments

- show energy clearly
- show automation (what runs)
- highlight locked vs unlocked actions
- keep UI simple

---

## 7. Code Requirements

- keep logic separated from UI
- avoid duplication
- small clear files
- no overengineering

---

## 8. Acceptance Criteria

The upgrade is complete when:

- player cannot spam actions infinitely
- at least one system runs without player input
- tools meaningfully change gameplay
- player must choose what to do next
- gameplay feels like a system, not just clicking

---

## 9. Restrictions

DO NOT add:
- multiplayer
- backend
- space systems
- new large content expansions
- many new resources
- complex character systems

Focus only on improving the core loop.