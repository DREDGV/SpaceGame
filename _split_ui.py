"""
Split ui.js into module files for Phase 1 UI refactoring.
Run once: python _split_ui.py
"""
import os, re

SRC = r'C:\Users\dr-ed\SpaceGame\web\prototype\ui.js'
BASE = r'C:\Users\dr-ed\SpaceGame\web\prototype'

with open(SRC, 'r', encoding='utf-8') as f:
    raw = f.read()

# Normalise line endings
raw = raw.replace('\r\n', '\n').replace('\r', '\n')
lines = raw.split('\n')
total = len(lines)

# ── Method start lines (0-indexed, from 1-indexed grep output) ─────────────
METHOD_STARTS = {
    'constructor':                    5,
    '_showTooltipDelayed':           23,
    '_hideTooltip':                  32,
    '_scheduleGatherCooldownRefresh':40,
    '_getCampTravelPlan':            56,
    '_estimateCampActionTravelMs':  181,
    '_getCampTravelPhaseState':     185,
    '_startCampTileTravel':         229,
    '_clearCampTileTravel':         254,
    '_scheduleCampTileTravelTick':  262,
    '_finalizeCampTileTravel':      279,
    'bindStaticControls':           292,
    'bindChangelogModal':           382,
    '_renderChangelogContent':      412,
    'bindResearchModal':            448,
    'openResearchModal':            467,
    'bindKnowledgeModal':           476,
    'openKnowledgeModal':           500,
    'bindCampModals':               511,
    'getCampFoundingProgressItems': 578,
    'getCampFoundingResourceGuidance': 595,
    'guideToCampFoundingResources': 635,
    'openCampFoundConfirm':         666,
    'closeCampFoundConfirm':        759,
    'openCampScreen':               767,
    'closeCampScreen':              780,
    '_getCampSlotLayout':           790,
    '_getCampStage':                850,
    '_getCampfireSlotPresentation': 863,
    '_getCampSlotPresentation':     926,
    'renderCampScreen':             946,
    '_renderCampTopbar':            959,
    '_getCampfireSceneVariant':    1016,
    '_renderCampfireSceneArt':     1024,
    '_renderCampScene':            1059,
    '_renderCampDock':             1203,
    '_renderCampDetail':           1272,
    '_renderCampDetailEffects':    1385,
    '_renderCampDetailAutomation': 1418,
    '_renderCampDetailUpgrades':   1446,
    '_renderCampDetailBuildSection':1498,
    '_renderCampInfoSummary':      1575,
    '_bindCampDetailActions':      1594,
    'renderCampFoundingQuest':     1618,
    'renderHeaderModeState':       1669,
    'renderPrologueLayoutState':   1691,
    'getCampTileStateLabel':       1733,
    'renderCampMap':               1746,
    'renderResearchWidget':        2625,
    'renderResearchModalContent':  2740,
    'renderKnowledgeModalContent': 2753,
    'renderStoryEvent_CLASS':      2785,   # will be REMOVED (replaced by prototype ver)
    'formatResourcePairs':         2841,
    'formatResourcePairsPlain':    2851,
    'formatSeconds':               2861,
    'formatCooldownMs':            2865,
    'formatNumber':                2872,
    'scheduleRestCooldownRefresh': 2876,
    'formatTooltipText':           2893,
    'setTooltip':                  2907,
    'setButtonAvailability':       2915,
    'getGatherActionCopy':         2922,
    'getRecipeCopy':               2938,
    'getBuildingCopy':             2954,
    'getResourceDisplayName':      2970,
    'getResourceDisplayIcon':      2979,
    'isPanelHovered':              2988,
    'render':                      2994,
    'renderOnboardingIntro':       3065,
    'renderOnboardingStep':        3105,
    'hideOnboarding':              3204,
    'hideOnboardingIntro':         3211,
    'hideOnboardingStep':          3216,
    'renderCharacterPanel':        3221,
    'renderResources':             3529,
    'renderGather':                3837,
    '_renderGatherPrologue':       3859,
    '_renderGatherPreCamp':        3941,
    '_renderGatherPostCamp':       4066,
    'renderCrafting':              4229,
    'createTimedStatusCard':       4400,
    'renderBuildingsPanel':        4425,
    'renderAutomationPanel':       4674,
    'renderBuildings':             4686,
    'renderAutomation':            4878,
    'createResearchCard':          4988,
    '_renderPrologueInsightsBody': 5174,
    '_renderResearchBody':         5220,
    'renderLog':                   5357,
    'renderEraProgress':           5387,
    'renderSaveStatus':            5494,
}

# The class body ends with a lone `}` at column 0, right after renderSaveStatus.
# Search FORWARD from renderSaveStatus start for the first `}` at column 0.
renderSaveStatus_start = METHOD_STARTS['renderSaveStatus']  # 0-indexed
CLASS_END = None
for i in range(renderSaveStatus_start, total):
    if lines[i] == '}':
        CLASS_END = i
        break
assert CLASS_END is not None, "Could not find class end"
print(f"Class ends at line {CLASS_END + 1} (1-indexed)")

# Prototype methods live after CLASS_END
# Find UI.prototype.getStoryEventKicker and UI.prototype.renderStoryEvent
PROTO_START = CLASS_END + 1
# The rest of file after class (prototype methods)
PROTO_LINES = lines[PROTO_START:]

# Sort method names by start line
sorted_methods = sorted(METHOD_STARTS.items(), key=lambda x: x[1])
method_names = [m[0] for m in sorted_methods]
method_line_starts = [m[1] for m in sorted_methods]

def get_method_lines(name):
    """Return lines for the given method (strips trailing blank lines)."""
    idx = method_names.index(name)
    start = method_line_starts[idx]
    # End = start of next method - 1, or CLASS_END - 1 for last
    if idx + 1 < len(method_names):
        end = method_line_starts[idx + 1]
    else:
        end = CLASS_END  # exclusive (CLASS_END is the lone `}`)
    block = lines[start:end]
    # Strip trailing blank lines
    while block and not block[-1].strip():
        block.pop()
    return block

def method_block_to_object_property(name):
    """
    Convert a class method block to an object property with trailing comma.
    The block looks like:
        methodName(args) {
          ...
        }
    We need to add a trailing comma to the closing }.
    """
    block = get_method_lines(name)
    if not block:
        return []
    # Find last line that is exactly '  }' (method's own closing brace)
    # It should be the last non-blank line
    for i in range(len(block) - 1, -1, -1):
        if block[i].rstrip() == '  }':
            block[i] = '  },'
            break
    return block

# ─── Module groupings ──────────────────────────────────────────────────────

# Methods that stay in ui.js (class body)
KEEP_IN_UI = {
    'constructor',
    '_scheduleGatherCooldownRefresh',
    'scheduleRestCooldownRefresh',
    'bindStaticControls',
    'bindChangelogModal',
    '_renderChangelogContent',
    'render',
    'renderHeaderModeState',
    'renderPrologueLayoutState',
    'renderSaveStatus',
}

# renderStoryEvent_CLASS is removed (replaced by prototype version)
REMOVE_FROM_CLASS = {'renderStoryEvent_CLASS'}

MODULES = {
    'ui/core/ui-utils.js': [
        'formatResourcePairs',
        'formatResourcePairsPlain',
        'formatSeconds',
        'formatCooldownMs',
        'formatNumber',
        'formatTooltipText',
        'setTooltip',
        'setButtonAvailability',
        'getGatherActionCopy',
        'getRecipeCopy',
        'getBuildingCopy',
        'getResourceDisplayName',
        'getResourceDisplayIcon',
        'isPanelHovered',
        'createTimedStatusCard',
    ],
    'ui/core/ui-tooltips.js': [
        '_showTooltipDelayed',
        '_hideTooltip',
    ],
    'ui/map/camp-map-ui.js': [
        '_getCampTravelPlan',
        '_estimateCampActionTravelMs',
        '_getCampTravelPhaseState',
        '_startCampTileTravel',
        '_clearCampTileTravel',
        '_scheduleCampTileTravelTick',
        '_finalizeCampTileTravel',
        'getCampTileStateLabel',
        'renderCampMap',
    ],
    'ui/camp/camp-screen-ui.js': [
        'bindCampModals',
        'getCampFoundingProgressItems',
        'getCampFoundingResourceGuidance',
        'guideToCampFoundingResources',
        'openCampFoundConfirm',
        'closeCampFoundConfirm',
        'openCampScreen',
        'closeCampScreen',
        '_getCampSlotLayout',
        '_getCampStage',
        '_getCampfireSlotPresentation',
        '_getCampSlotPresentation',
        'renderCampScreen',
        '_renderCampTopbar',
        '_getCampfireSceneVariant',
        '_renderCampfireSceneArt',
        '_renderCampScene',
        '_renderCampDock',
        '_renderCampDetail',
        '_renderCampDetailEffects',
        '_renderCampDetailAutomation',
        '_renderCampDetailUpgrades',
        '_renderCampDetailBuildSection',
        '_renderCampInfoSummary',
        '_bindCampDetailActions',
        'renderCampFoundingQuest',
    ],
    'ui/panels/character-panel-ui.js': [
        'renderCharacterPanel',
    ],
    'ui/panels/resources-ui.js': [
        'renderResources',
    ],
    'ui/panels/gather-ui.js': [
        'renderGather',
        '_renderGatherPrologue',
        '_renderGatherPreCamp',
        '_renderGatherPostCamp',
    ],
    'ui/panels/crafting-ui.js': [
        'renderCrafting',
    ],
    'ui/panels/buildings-ui.js': [
        'renderBuildingsPanel',
        'renderAutomationPanel',
        'renderBuildings',
        'renderAutomation',
    ],
    'ui/panels/log-ui.js': [
        'renderLog',
    ],
    'ui/panels/era-progress-ui.js': [
        'renderEraProgress',
    ],
    'ui/research/research-ui.js': [
        'bindResearchModal',
        'openResearchModal',
        'renderResearchWidget',
        'renderResearchModalContent',
        '_renderPrologueInsightsBody',
        '_renderResearchBody',
        'createResearchCard',
    ],
    'ui/knowledge/knowledge-ui.js': [
        'bindKnowledgeModal',
        'openKnowledgeModal',
        'renderKnowledgeModalContent',
    ],
    'ui/onboarding/onboarding-ui.js': [
        'renderOnboardingIntro',
        'renderOnboardingStep',
        'hideOnboarding',
        'hideOnboardingIntro',
        'hideOnboardingStep',
    ],
    'ui/story/story-events-ui.js': [],  # will be handled specially (prototype methods)
}

MODULE_COMMENTS = {
    'ui/core/ui-utils.js':           '// UI utility helpers — formatting, tooltips-text, DOM helpers.',
    'ui/core/ui-tooltips.js':        '// Tooltip delay logic.',
    'ui/map/camp-map-ui.js':         '// Camp map rendering, travel animation, tile interaction.',
    'ui/camp/camp-screen-ui.js':     '// Camp management screen — scene, dock, detail panel, founding.',
    'ui/panels/character-panel-ui.js': '// Character panel rendering.',
    'ui/panels/resources-ui.js':     '// Resources / storage panel rendering.',
    'ui/panels/gather-ui.js':        '// Gather panel — prologue, pre-camp, post-camp modes.',
    'ui/panels/crafting-ui.js':      '// Crafting panel rendering.',
    'ui/panels/buildings-ui.js':     '// Buildings and automation panels.',
    'ui/panels/log-ui.js':           '// Log panel rendering.',
    'ui/panels/era-progress-ui.js':  '// Era progress panel rendering.',
    'ui/research/research-ui.js':    '// Research modal, widget, branches, insights.',
    'ui/knowledge/knowledge-ui.js':  '// Knowledge book modal.',
    'ui/onboarding/onboarding-ui.js':'// Onboarding intro, steps, hide helpers.',
    'ui/story/story-events-ui.js':   '// Story event overlay.',
}

def write_module(rel_path, method_list):
    abs_path = os.path.join(BASE, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    
    comment = MODULE_COMMENTS.get(rel_path, '')
    out_lines = []
    
    if rel_path == 'ui/story/story-events-ui.js':
        # Special: use prototype methods from end of file
        out_lines.append(comment)
        out_lines.append('')
        out_lines.extend(PROTO_LINES)
    else:
        out_lines.append(comment)
        out_lines.append('')
        out_lines.append('Object.assign(UI.prototype, {')
        out_lines.append('')
        for name in method_list:
            block = method_block_to_object_property(name)
            out_lines.extend(block)
            out_lines.append('')
        out_lines.append('});')
        out_lines.append('')
    
    content_out = '\n'.join(out_lines)
    with open(abs_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content_out)
    print(f"  ✓ {rel_path} ({len(out_lines)} lines)")

# ─── Write all module files ────────────────────────────────────────────────
print("\n=== Writing module files ===")
for rel_path, method_list in MODULES.items():
    write_module(rel_path, method_list)

# ─── Write slim ui.js ─────────────────────────────────────────────────────
print("\n=== Writing slim ui.js ===")

# Build set of all extracted method start lines (to know what to skip)
all_extracted = set()
for method_list in MODULES.values():
    all_extracted.update(method_list)
all_extracted.add('renderStoryEvent_CLASS')  # also remove this

# Methods to keep as a class body:
keep_starts = sorted([METHOD_STARTS[m] for m in KEEP_IN_UI])

# Build slim ui.js:
# Keep lines in ranges:
#   - file header comment: lines 0-4 (before class)
#   - class declaration line (lines[4] == 'class UI {')
#   - for each KEEP method: lines from its start to next_start-1
#   - class closing brace: lines[CLASS_END]
# Then strip prototype methods (they moved to story-events-ui.js)

slim_lines = []

# File header: lines 0 through start of constructor - 1 (i.e. lines 0..4)
# Line 0..4 = first 5 lines (header comment + class opening)
constructor_start = METHOD_STARTS['constructor']  # 0-indexed = 5
# Header = lines[0:constructor_start]  (includes `class UI {` on line 4)
slim_lines.extend(lines[0:constructor_start])

# Now add each kept method
keep_method_list = [
    'constructor',
    '_scheduleGatherCooldownRefresh',
    'scheduleRestCooldownRefresh',
    'bindStaticControls',
    'bindChangelogModal',
    '_renderChangelogContent',
    'renderHeaderModeState',
    'renderPrologueLayoutState',
    'render',
    'renderSaveStatus',
]
# Sort by original line number so order is preserved
keep_method_list.sort(key=lambda m: METHOD_STARTS[m])

for name in keep_method_list:
    slim_lines.append('')  # blank line separator
    block = get_method_lines(name)
    slim_lines.extend(block)

# Class closing brace
slim_lines.append(lines[CLASS_END])
slim_lines.append('')

# Final output
slim_content = '\n'.join(slim_lines)
slim_path = os.path.join(BASE, 'ui.js')
with open(slim_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(slim_content)

# Count lines
slim_line_count = len(slim_lines)
print(f"  ✓ ui.js ({slim_line_count} lines, was {total})")

print("\n=== Done ===")
print("Run: node --check web/prototype/ui.js")
for rel_path in MODULES:
    print(f"     node --check web/prototype/{rel_path}")
