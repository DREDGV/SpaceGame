# Insight Images

Place live insight illustrations in this folder.

Naming convention:

- Use the insight id as the base filename.
- Examples: sharp_edge.webp, sturdy_branch.png, fiber_bindings.jpg
- Supported formats in runtime auto-detection: .webp, .png, .jpg, .jpeg

Current UI contract:

- insight.image points to the image used in the insight map and focus card.
- discoveryScene.image can point to the same file when one illustration is enough.
- insight.imageAlt provides fallback alt text.
- Insight ids are content ids, not guaranteed player unlock order: players can discover early prologue insights in different sequences depending on play.
- Runtime now auto-tries common extensions and both assets/insights/ and prototype/assets/insights/ before falling back, but the recommended live folder is still web/assets/insights/.
- Runtime also tolerates an accidental drop into web/assets/, but that is only a forgiving fallback, not the preferred location.

Simplest future workflow:

- Drop the file into web/assets/insights/.
- Name it exactly as the insight id.
- Use any one of: .webp, .png, .jpg, .jpeg.
- No manual image path edits are needed if the file follows that convention.

Recommended art parameters:

- Preferred source aspect ratio: portrait 4:5 or 3:4.
- Recommended minimum size: 1200x1500.
- Keep the face / hand / key object inside the central safe zone of about 60% width and 65% height.
- Do not place the key object too close to the top or side edges: the insight scheme uses a tighter portrait crop than the discovery modal.

Optional framing metadata in web/prototype/data/narrative.js:

- imagePosition: shared object-position fallback.
- imageNodePosition: crop focus for the small insight node in the scheme.
- imageFocusPosition: crop focus for the selected insight card.

Runtime path examples:

- assets/insights/sharp_edge.webp
- assets/insights/sturdy_branch.webp

Current configured asset:

- sharp_edge -> sharp_edge.webp
