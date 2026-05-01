"""
Phase 2 Refactor: split style.css into themed modules under web/prototype/css/
Run once from SpaceGame root:  python _split_css.py
"""

import os

SRC = r'web\prototype\style.css'
OUT_DIR = r'web\prototype\css'

# (filename, start_line_1based, end_line_1based_inclusive)
# Boundaries verified against actual CSS comments
SECTIONS = [
    ('base.css',                  1,    359),   # root, layout, header, save popup, main content
    ('map-local.css',           360,    758),   # SVG local camp map tiles, fills, animations
    ('prologue-onboarding.css', 759,   1149),   # panels base, intro panel, hero, onboarding steps
    ('resources.css',          1150,   1368),   # resource grid
    ('character.css',          1369,   1808),   # character panel
    ('actions.css',            1809,   1914),   # action buttons
    ('buildings.css',          1915,   2379),   # buildings, tech cards, research queue slots
    ('automation.css',         2380,   2450),   # automation panel
    ('log-tooltips.css',       2451,   2537),   # log entries, tooltips
    ('era-progress.css',       2538,   2701),   # era progress, tactical goals, compact stats
    ('research.css',           2702,   2899),   # research widget + modal
    ('modals.css',             2900,   3102),   # changelog button, modal overlay, changelog content
    ('hex-map.css',            3103,   4037),   # hex world map, intro overlay, navigation panel
    ('camp-founding.css',      4038,   4402),   # camp founding modals, quest widget, pre-camp gather
    ('camp-screen.css',        4403,   99999),  # camp interior screen (to end of file)
]

def main():
    with open(SRC, 'r', encoding='utf-8') as f:
        raw = f.read()

    # Normalize line endings
    lines = raw.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    total = len(lines)
    print(f'Source: {SRC} — {total} lines')

    os.makedirs(OUT_DIR, exist_ok=True)

    created = []
    for fname, start1, end1 in SECTIONS:
        s = start1 - 1          # 0-indexed start
        e = min(end1, total)    # 0-indexed end (exclusive slice)
        chunk = lines[s:e]

        # Strip trailing blank lines, keep one newline at end
        while chunk and chunk[-1].strip() == '':
            chunk.pop()
        chunk.append('')  # single trailing newline

        out_path = os.path.join(OUT_DIR, fname)
        with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(chunk))

        line_count = len(chunk) - 1
        print(f'  Created: css/{fname}  ({line_count} lines, src L{start1}-L{min(end1, total)})')
        created.append(fname)

    print(f'\nDone: {len(created)} files created in {OUT_DIR}')

    # Verify total coverage
    covered = sum(
        min(e, total) - (s - 1)
        for _, s, e in SECTIONS
    )
    print(f'Lines covered: {covered} / {total}')
    if covered < total:
        print(f'WARNING: {total - covered} lines NOT covered (check boundaries)')


if __name__ == '__main__':
    main()
