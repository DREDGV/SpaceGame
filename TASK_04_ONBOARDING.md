# TASK 04 — ONBOARDING SYSTEM

## Goal

Implement a simple onboarding system that:

- introduces the player to the game
- guides early actions
- can be skipped or disabled

---

## 1. Intro Screen (REQUIRED)

Show at first launch:

"You arrive in an unexplored land.
No tools, no production — only raw resources.
Start gathering and build the foundation of your colony."

Buttons:

- Start tutorial
- Skip tutorial

---

## 2. Step-by-step Goals (REQUIRED)

Implement sequential onboarding goals:

1. Gather 5 wood
2. Craft plank
3. Craft crude_tools
4. Build campfire
5. Produce 2 bricks via automation

---

## 3. Goal System Behavior

- show current goal in UI
- update automatically when completed
- show short feedback message after completion
- move to next goal

---

## 4. UI Requirements

- visible goal panel
- highlight relevant buttons (optional)
- small messages after completion

---

## 5. Skip / Disable System (REQUIRED)

- allow skipping tutorial at start
- allow skipping during tutorial
- store choice (localStorage)
- disable goals and hints if skipped

---

## 6. Data Persistence

Store:

- tutorial completed / skipped
- current onboarding step

---

## 7. Design Rules

- short texts only
- no long dialogs
- no blocking UI
- player always has control

---

## 8. Acceptance Criteria

- onboarding appears on first launch
- player understands first steps
- goals guide progression
- tutorial can be skipped anytime
- game works normally without tutorial
