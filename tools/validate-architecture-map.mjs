/**
 * Validates docs/architecture/spacegame-architecture-data.js structure.
 * No dependencies. Run: node tools/validate-architecture-map.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = join(ROOT, "docs/architecture/spacegame-architecture-data.js");

const ERA_ORDER = "ABCDEFGHIJK";
const ERA_IDS = new Set([...ERA_ORDER]);

const ALLOWED = {
  role: [
    "tutorial",
    "bridge",
    "core_expansion",
    "state_expansion",
    "transition",
    "industrial_core",
    "modern_core",
    "planetary_core",
    "space_core",
    "endgame"
  ],
  designWeight: ["light", "medium", "heavy", "core"],
  gameplayDensity: ["low", "medium", "high", "very_high"],
  playerTimeShare: ["short", "medium", "long", "very_long", "endgame"]
};

const errors = [];

function err(msg) {
  errors.push(msg);
}

function eraIndex(id) {
  const i = ERA_ORDER.indexOf(id);
  return i < 0 ? null : i;
}

function loadArchitecture() {
  const code = readFileSync(DATA_PATH, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.SPACEGAME_ARCHITECTURE;
}

function validateEras(architecture) {
  const eras = architecture.eras;
  if (!Array.isArray(eras)) {
    err("eras must be an array");
    return;
  }
  const seen = new Set();
  for (const era of eras) {
    const id = era.id;
    if (!id || typeof id !== "string") err(`era: missing id`);
    else {
      if (seen.has(id)) err(`duplicate era id: ${id}`);
      seen.add(id);
      if (!ERA_IDS.has(id)) err(`era id must be A–K: ${id}`);
    }
    if (!era.title) err(`era ${id}: missing title`);
    if (!era.dates) err(`era ${id}: missing dates`);
    if (!era.summary) err(`era ${id}: missing summary`);
    if (!era.timePace) err(`era ${id}: missing timePace`);
    if (!era.status) err(`era ${id}: missing status`);
    if (!Array.isArray(era.periods)) err(`era ${id}: periods must be an array`);
    if (!era.systems || typeof era.systems !== "object") err(`era ${id}: systems must be an object`);

    for (const key of [
      "role",
      "designWeight",
      "gameplayDensity",
      "playerTimeShare",
      "contentGuideline"
    ]) {
      if (era[key] == null || era[key] === "") err(`era ${id}: missing ${key}`);
    }
    if (!ALLOWED.role.includes(era.role)) err(`era ${id}: invalid role "${era.role}"`);
    if (!ALLOWED.designWeight.includes(era.designWeight))
      err(`era ${id}: invalid designWeight "${era.designWeight}"`);
    if (!ALLOWED.gameplayDensity.includes(era.gameplayDensity))
      err(`era ${id}: invalid gameplayDensity "${era.gameplayDensity}"`);
    if (!ALLOWED.playerTimeShare.includes(era.playerTimeShare))
      err(`era ${id}: invalid playerTimeShare "${era.playerTimeShare}"`);

    const t = era.transition;
    if (!t || typeof t !== "object") {
      err(`era ${id}: transition must be an object`);
    } else {
      if (!String(t.condition || "").trim()) err(`era ${id}: transition.condition must be a non-empty string`);

      if (id === "K") {
        if (t.to != null && t.to !== "") err(`era K: transition.to must be null or empty string`);
      } else {
        const fromIdx = eraIndex(id);
        if (fromIdx != null && fromIdx < ERA_ORDER.length - 1) {
          const next = ERA_ORDER[fromIdx + 1];
          if (t.to !== next) err(`era ${id}: transition.to must be "${next}", got ${JSON.stringify(t.to)}`);
        }
      }

      if (!Array.isArray(t.checklist) || t.checklist.length === 0) {
        err(`era ${id}: transition.checklist must be a non-empty array`);
      } else {
        t.checklist.forEach((item, i) => {
          if (typeof item !== "string" || !String(item).trim()) {
            err(`era ${id}: transition.checklist[${i}] must be a non-empty string`);
          }
        });
      }

      if (t.unlocks != null && !Array.isArray(t.unlocks)) err(`era ${id}: transition.unlocks must be an array`);
    }

    const tsy = era.timelineSpanYears;
    if (tsy && tsy.from != null && tsy.to != null && tsy.from >= tsy.to) {
      err(`era ${id}: timelineSpanYears.from must be < timelineSpanYears.to`);
    }
  }

  if (seen.size !== 11) err(`eras: expected exactly 11 unique ids (A–K), found ${seen.size}`);
  for (const c of ERA_ORDER) {
    if (!seen.has(c)) err(`eras: missing era id ${c}`);
  }
}

function validateGameCatalog(architecture) {
  const gc = architecture.gameCatalog;
  if (gc == null || gc === undefined) return;
  if (typeof gc !== "object" || Array.isArray(gc)) {
    err("gameCatalog must be a non-array object");
    return;
  }
  if (!gc.title) err("gameCatalog: missing title");
  if (!gc.summary) err("gameCatalog: missing summary");
  if (!gc.status) err("gameCatalog: missing status");
}

function validateCatalogArray(name, items, eraIds) {
  if (!items) return;
  if (!Array.isArray(items)) {
    err(`${name} must be an array`);
    return;
  }
  const seen = new Set();
  for (const item of items) {
    const id = item.id;
    if (!id) err(`${name}: item missing id`);
    else {
      if (seen.has(id)) err(`${name}: duplicate id ${id}`);
      seen.add(id);
    }
    if (!item.title) err(`${name} ${id}: missing title`);
    if (!item.summary) err(`${name} ${id}: missing summary`);
    if (!item.status) err(`${name} ${id}: missing status`);
    const a = eraIndex(item.eraFrom);
    const b = eraIndex(item.eraTo);
    if (a == null || !ERA_IDS.has(item.eraFrom)) err(`${name} ${id}: invalid eraFrom`);
    if (b == null || !ERA_IDS.has(item.eraTo)) err(`${name} ${id}: invalid eraTo`);
    if (a != null && b != null && a > b) err(`${name} ${id}: eraFrom must be <= eraTo in A–K order`);
  }
}

function validateSystems(systems) {
  if (!Array.isArray(systems)) {
    err("systems must be an array");
    return new Set();
  }
  const seen = new Set();
  for (const s of systems) {
    if (!s.id) err("system: missing id");
    else {
      if (seen.has(s.id)) err(`duplicate system id: ${s.id}`);
      seen.add(s.id);
    }
    if (!s.title) err(`system ${s.id}: missing title`);
    if (!ERA_IDS.has(s.appearsIn)) err(`system ${s.id}: invalid appearsIn`);
    if (!ERA_IDS.has(s.becomesCoreIn)) err(`system ${s.id}: invalid becomesCoreIn`);
    const ai = eraIndex(s.appearsIn);
    const bi = eraIndex(s.becomesCoreIn);
    if (ai != null && bi != null && ai > bi) err(`system ${s.id}: appearsIn must be <= becomesCoreIn`);
  }
  return seen;
}

function validateSystemProgression(architecture, systemIds) {
  const sp = architecture.systemProgression;
  if (sp == null || sp === undefined) return;
  if (!Array.isArray(sp)) {
    err("systemProgression must be an array when present");
    return;
  }
  const ids = systemIds instanceof Set ? systemIds : new Set(architecture.systems?.map((s) => s.id) || []);

  sp.forEach((entry, idx) => {
    const label = `systemProgression[${idx}]`;
    if (!entry || typeof entry !== "object") {
      err(`${label}: must be an object`);
      return;
    }
    if (!entry.systemId || typeof entry.systemId !== "string" || !String(entry.systemId).trim()) {
      err(`${label}: systemId is required`);
    } else if (!ids.has(entry.systemId)) {
      err(`${label}: systemId "${entry.systemId}" must match an id in systems[]`);
    }
    if (!entry.title || typeof entry.title !== "string" || !String(entry.title).trim()) err(`${label}: title is required`);
    if (!entry.summary || typeof entry.summary !== "string" || !String(entry.summary).trim())
      err(`${label}: summary is required`);
    if (!entry.status || typeof entry.status !== "string" || !String(entry.status).trim()) err(`${label}: status is required`);

    const byEra = entry.byEra;
    if (!byEra || typeof byEra !== "object" || Array.isArray(byEra)) {
      err(`${label}: byEra must be an object`);
      return;
    }
    for (const key of Object.keys(byEra)) {
      if (!ERA_IDS.has(key)) err(`${label}: byEra has invalid key "${key}" (only A–K)`);
    }

    if (entry.systemId === "people") {
      for (const c of ERA_ORDER) {
        const v = byEra[c];
        if (typeof v !== "string" || !String(v).trim()) err(`${label}: byEra.${c} must be a non-empty string`);
      }
    } else {
      for (const key of Object.keys(byEra)) {
        const v = byEra[key];
        if (typeof v !== "string" || !String(v).trim()) err(`${label}: byEra.${key} must be a non-empty string when present`);
      }
    }

    if (entry.designNotes != null) {
      if (!Array.isArray(entry.designNotes)) err(`${label}: designNotes must be an array when present`);
      else {
        entry.designNotes.forEach((n, i) => {
          if (typeof n !== "string") err(`${label}: designNotes[${i}] must be a string`);
        });
      }
    }
  });
}

function validateDependencies(deps) {
  if (!Array.isArray(deps)) {
    err("dependencies must be an array");
    return;
  }
  for (const d of deps) {
    if (!d.from) err("dependency: missing from");
    if (!d.to) err("dependency: missing to");
    if (!d.type) err("dependency: missing type");
    if (!d.description) err("dependency: missing description");
  }
}

const architecture = loadArchitecture();
validateEras(architecture);
validateGameCatalog(architecture);
const systemIdSet = validateSystems(architecture.systems || []);
validateSystemProgression(architecture, systemIdSet);
validateDependencies(architecture.dependencies || []);
validateCatalogArray("gameResources", architecture.gameResources, ERA_IDS);
validateCatalogArray("gameResearch", architecture.gameResearch, ERA_IDS);
validateCatalogArray("gameTechnologies", architecture.gameTechnologies, ERA_IDS);
validateCatalogArray("gameEnterprises", architecture.gameEnterprises, ERA_IDS);

if (errors.length) {
  console.error("Architecture map validation failed:\n");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("Architecture map validation passed.");
