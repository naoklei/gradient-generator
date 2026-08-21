# Gradient Backgrounds — Figma plugin

A Figma plugin that applies a gradient fill to the currently selected layer(s)
from six presets (or fully custom colours/type/softness/grain), using native
Figma gradient paints plus an optional baked-noise grain layer. Select a
layer, pick a preset or dial in your own settings, then hit Apply — the fill
inherits the selected layer's size, no separate "create" step.

## Run it in Figma (development)

1. Open the **Figma desktop app** (the plugin dev workflow isn't available in
   the browser version).
2. Clone this repo locally and `cd` into it.
3. In Figma: **Plugins → Development → Import plugin from manifest…**
4. Select `manifest.json` from this repo.
5. Open any file, then **Plugins → Development → Gradient Backgrounds** to
   launch it.
6. After editing `code.js` or `ui.html`, close and re-run the plugin (or use
   **Plugins → Development → Hot reload plugin** if you have it enabled) to
   pick up changes — no build step required, it's plain JS/HTML.

Console errors from `code.js` show up in Figma's **Plugins → Development →
Open console**.

## Files

- `manifest.json` — plugin manifest (id, entry points, permissions)
- `code.js` — the plugin's sandboxed main thread: tracks selection, builds
  native `GRADIENT_LINEAR` / `GRADIENT_RADIAL` paints, and applies them (plus
  an optional tiled noise image fill) to the selected node(s)
- `ui.html` — the plugin panel UI (preview, presets, controls); runs in an
  iframe and talks to `code.js` via `postMessage`
- `design/` — original design reference from Claude Design (not built code):
  - `Gradient Backgrounds.dc.html` — browser prototype of the six gradient
    styles with live sliders
  - `HANDOFF.md` — full design handoff notes (tokens, layout, gradient math,
    known gaps) written when this plugin was first scaffolded

## How it works

- **Selection-driven:** `code.js` listens for `figma.on('selectionchange', …)`
  and tells the UI whether anything fillable (`'fills' in node`) is selected.
  With nothing selected, the panel shows a prompt and the preset/controls
  section is disabled — there's nothing to apply to yet.
- **Preset click = instant apply; everything else needs Apply:** clicking a
  preset swatch immediately re-applies that gradient to the selected
  layer(s) — it's a single discrete action, not something you drag. Slider
  and colour edits (angle, softness, grain, radial position, etc.) only
  update the live panel preview as you adjust them; nothing is written to
  the canvas until you click the **Apply** button (top-right, above the
  preview). This split exists because writing to the Figma document on
  every slider tick made dragging visibly laggy — decoupling edit-from-apply
  keeps the panel responsive regardless of how expensive the eventual write
  is. Size is never set by the plugin; the fill just paints onto whatever
  geometry is selected, so it inherits that layer's width/height
  automatically (Figma's gradient transforms are defined in unit space, not
  pixels).
- **Gradient math:** softness maps to how far the two colour stops sit from
  the 50% midpoint — `0` = a hard edge, `100` = a full-bleed blend. See
  `design/HANDOFF.md` for the exact formula and per-style defaults.
- **Radial positioning:** the "Central radial blur" type exposes Center X /
  Center Y sliders (0–100%, default 50/62 to match the original preset) that
  move the blur's center; both the live preview and the applied Figma paint
  read from the same `spec.centerX`/`centerY` values.
- **Grain:** Figma has no procedural noise, so `ui.html` renders a noise
  pattern to a `<canvas>`, exports it as PNG bytes, and `code.js` applies it
  as a tiled `IMAGE` fill with `OVERLAY` blend mode on top of the gradient.
- **Presets:** six built-in styles are hard-coded in `ui.html`. The "Save
  preset" text link only appears once you've changed something from the
  loaded preset (or from the last save); clicking it appends the current spec
  to `figma.clientStorage` (persisted per user/machine, not synced anywhere).

## Known gaps

- `linearTransform` is still untested against real Figma — worth double
  checking angle direction against the CSS preview. `radialTransform` had a
  bug (the gradient's true center landed far outside the layer instead of at
  the intended position) that's now fixed, but the corrected version hasn't
  been confirmed on canvas yet either — verify the radial preset looks
  centered and matches the panel preview after pulling this change.
- No delete/rename for saved custom presets.
- Only two colour stops per style (no multi-stop gradients).
- No export to PNG/SVG.
- Applying to a multi-selection with mixed sizes reuses the same paint object
  for every node — fine since the transform is unit-space, but grain image
  fills are tiled at a fixed scale so very differently sized layers may look
  inconsistent.
