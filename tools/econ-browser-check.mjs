/**
 * Smoke: prototype.html, economic API, optional v1 save load.
 * Run from repo: temp dir + npm i playwright, or: npx --package=playwright node tools/econ-browser-check.mjs
 */
import { chromium } from "playwright";

const base = process.env.ECON_CHECK_URL || "http://127.0.0.1:8765/prototype.html";

const logs = [];
const pageErrors = [];

const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
});

const page = await browser.newPage();
page.on("console", (msg) => {
  const t = msg.type();
  if (t === "error" || t === "warning") logs.push({ t, text: msg.text() });
});
page.on("pageerror", (err) => pageErrors.push(String(err.message)));

await page.goto(base, { waitUntil: "load", timeout: 120000 });

await page.waitForFunction(() => typeof window.game !== "undefined", {
  timeout: 60000,
});

const result = await page.evaluate(() => {
  const g = window.game;
  const d = g?.data;
  const out = {
    economicStagesById: !!d?.economicStagesById,
    workActions: !!d?.workActions,
    computeOk: typeof d?.computeEconomicStageId === "function",
    getNextOk: typeof d?.getEconomicNextStep === "function",
    stageId: null,
    nextStep: null,
    evalGather: null,
    dispatchGather: null,
    renderError: null,
    shellStatusError: null,
  };
  try {
    out.stageId = d.computeEconomicStageId(g);
  } catch (e) {
    out.computeErr = String(e);
  }
  try {
    out.nextStep = d.getEconomicNextStep?.(g);
    out.nextStepNav =
      !!out.nextStep &&
      typeof out.nextStep.targetMode === "string" &&
      typeof out.nextStep.ctaLabel === "string";
  } catch (e) {
    out.nextStepErr = String(e);
  }
  try {
    out.evalGather = g.evaluateWorkActionAvailability("work_gather_branches");
  } catch (e) {
    out.evalGatherErr = String(e);
  }
  try {
    out.dispatchGather = g.dispatchWorkAction("work_gather_branches");
  } catch (e) {
    out.dispatchErr = String(e);
  }
  try {
    const ui = window.ui;
    if (typeof g.startOnboarding === "function") g.startOnboarding();
    if (typeof ui.setShellMode === "function") ui.setShellMode("production");
    ui.renderEconomicCorePanel();
    const el = document.getElementById("shell-economic-core");
    out.productionPanelPopulated =
      el && !el.hidden && el.innerHTML.includes("ecore-work-card");
    ui.renderEconomicShellStatus?.();
    const st = document.getElementById("shell-economic-status");
    out.shellStatusVisible = !!(st && !st.hidden && st.innerHTML.length > 40);
  } catch (e) {
    out.renderError = String(e);
  }

  const b0 = { ...g.buildings };
  try {
    const initial = d.computeEconomicStageId(g);
    g.buildings = { ...b0, campfire: { count: 1, isAutomationRunning: true } };
    const withCampfire = d.computeEconomicStageId(g);
    g.buildings = {
      ...b0,
      campfire: { count: 1, isAutomationRunning: true },
      workshop: { count: 1, isAutomationRunning: true },
    };
    const withWorkshop = d.computeEconomicStageId(g);
    out.stageTransitions = { initial, withCampfire, withWorkshop };
  } finally {
    g.buildings = b0;
  }

  return out;
});

/** Minimal version:1 payload — post-onboarding skip + костёр (этап campfire_camp). */
const v1Payload = {
  version: 1,
  savedAt: Date.now(),
  state: {
    onboarding: {
      started: false,
      skipped: true,
      completed: false,
      currentStep: 0,
      handoff: false,
    },
    buildings: {
      campfire: { count: 1, isAutomationRunning: true },
    },
  },
};

const ctx2 = await browser.newContext();
const page2 = await ctx2.newPage();
page2.on("console", (msg) => {
  const t = msg.type();
  if (t === "error" || t === "warning") logs.push({ t, text: msg.text() });
});
page2.on("pageerror", (err) => pageErrors.push(String(err.message)));

await page2.addInitScript(
  ([key, json]) => {
    localStorage.setItem(key, json);
  },
  ["spacegame_save_v1", JSON.stringify(v1Payload)],
);

await page2.goto(base, { waitUntil: "load", timeout: 120000 });
await page2.waitForFunction(() => typeof window.game !== "undefined", {
  timeout: 60000,
});

const saveLoad = await page2.evaluate(() => {
  const g = window.game;
  const d = g?.data;
  const ns = d?.getEconomicNextStep?.(g);
  return {
    loadedFromSave: !!g.loadedFromSave,
    loadErrorMessage: g.loadErrorMessage || "",
    stage: d?.computeEconomicStageId?.(g),
    nextHeadline: ns?.headline || "",
    nextTargetMode: ns?.targetMode,
    nextHighlightId: ns?.highlightId,
  };
});

await ctx2.close();
await browser.close();

const benign404 = (t) =>
  /Failed to load resource:.*404/i.test(t) ||
  t.includes("favicon") ||
  t.includes("apple-touch-icon") ||
  t.includes("/site.webmanifest");
const seriousLogs = logs.filter(
  (x) => x.t === "error" && !benign404(x.text),
);

console.log(
  JSON.stringify({ logs, pageErrors, result, saveLoad }, null, 2),
);
if (pageErrors.length) process.exitCode = 1;
if (seriousLogs.length) process.exitCode = 1;
if (!saveLoad.loadedFromSave || saveLoad.stage !== "campfire_camp") {
  process.exitCode = 1;
}
if (!result.nextStepNav) process.exitCode = 1;
if (!saveLoad.nextTargetMode) process.exitCode = 1;
