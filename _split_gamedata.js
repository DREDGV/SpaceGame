/**
 * Phase 3 Refactor: split game-data.js into themed data modules.
 * Run: node _split_gamedata.js
 * From SpaceGame root directory.
 */

const fs = require("fs");
const path = require("path");

const SRC = "web/prototype/data/game-data.js";
const OUT_DIR = "web/prototype/data";

const raw = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const lines = raw.split("\n");
const total = lines.length;
console.log(`Source: ${SRC} — ${total} lines`);

/**
 * Each entry: [outputFile, description, startLine1, endLine1]
 * Lines are 1-based, inclusive.
 * Content will be wrapped in: Object.assign(GAME_DATA, { ... });
 */
const SECTIONS = [
  [
    "narrative.js",
    "Narrative data: camp founding intro, onboarding steps, prologue texts",
    4, // L4: comment before campFoundingIntro
    461, // L461: blank line before baseTerrains
  ],
  [
    "terrain.js",
    "Terrain & map data: baseTerrains, localCampMap tiles, logistics routes",
    462, // L462: baseTerrains
    828, // L828: comment before goals (last line of logistics section)
  ],
  [
    "world.js",
    "World data: goals, storageCategories, resources, researchBranches, eras, energy",
    829, // L829: goals
    1172, // L1172: blank after energy
  ],
  [
    "character.js",
    "Character & actions data: character stats/traits, gather actions",
    1173, // L1173: character
    1302, // L1302: comment before recipes
  ],
  [
    "production.js",
    "Production data: recipes, buildings, buildingUpgrades, tech",
    1303, // L1303: recipes
    1641, // L1641: last }, before GAME_DATA closing
  ],
];

// Build slim game-data.js: declaration + CHANGELOG_DATA
function buildSlimGameData() {
  const header = [
    lines[0], // // Game data definitions comment
    "",
    "const GAME_DATA = {};",
    "",
  ];
  // CHANGELOG_DATA section: L1643 onwards (0-indexed: 1642+)
  const changelog = lines.slice(1642); // L1643 to end
  const content = [...header, ...changelog].join("\n");

  const outPath = path.join(OUT_DIR, "game-data.js");
  fs.writeFileSync(outPath, content, { encoding: "utf8" });
  const lineCount = content.split("\n").length;
  console.log(`  Slim:    data/game-data.js  (${lineCount} lines)`);
}

// Build each section file
function buildSection(fileName, description, start1, end1) {
  const s = start1 - 1; // 0-indexed
  const e = Math.min(end1, total); // 0-indexed exclusive end
  let chunk = lines.slice(s, e);

  // Strip trailing blank lines
  while (chunk.length > 0 && chunk[chunk.length - 1].trim() === "") {
    chunk.pop();
  }

  const wrapper = [
    `// ${description}`,
    "",
    "Object.assign(GAME_DATA, {",
    ...chunk,
    "});",
    "",
  ];

  const outPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(outPath, wrapper.join("\n"), { encoding: "utf8" });
  console.log(
    `  Created: data/${fileName}  (${wrapper.length} lines, src L${start1}-L${e})`,
  );
}

// Run
buildSlimGameData();
for (const [file, desc, start, end] of SECTIONS) {
  buildSection(file, desc, start, end);
}

console.log("\nDone. Verify with: node --check web/prototype/data/*.js");
