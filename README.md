# Gradient Backgrounds — Figma plugin

A Figma plugin that applies a gradient fill to the currently selected layer(s)
from six presets (or fully custom colours/type/softness/grain), using native
Figma gradient paints plus an optional baked-noise grain layer. Select a
layer, pick or tweak a style, and it updates live — no separate "create"
step, and the fill inherits the selected layer's size.

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
- **Live apply:** clicking a preset, or changing any control (colour, type,
  angle, softness, grain), immediately re-applies the gradient to the
  selected layer(s) — no "create frame" button. Size is never set by the
  plugin; the fill just paints onto whatever geometry is selected, so it
  inherits that layer's width/height automatically (Figma's gradient
  transforms are defined in unit space, not pixels).
- **Gradient math:** softness maps to how far the two colour stops sit from
  the 50% midpoint — `0` = a hard edge, `100` = a full-bleed blend. See
  `design/HANDOFF.md` for the exact formula and per-style defaults.
- **Grain:** Figma has no procedural noise, so `ui.html` renders a noise
  pattern to a `<canvas>`, exports it as PNG bytes, and `code.js` applies it
  as a tiled `IMAGE` fill with `OVERLAY` blend mode on top of the gradient.
- **Presets:** six built-in styles are hard-coded in `ui.html`. The "Save
  preset" text link only appears once you've changed something from the
  loaded preset (or from the last save); clicking it appends the current spec
  to `figma.clientStorage` (persisted per user/machine, not synced anywhere).

## Known gaps

- `linearTransform` / `radialTransform` in `code.js` were untested in real
  Figma — worth double-checking angle direction and radial framing against
  the CSS preview in `design/Gradient Backgrounds.dc.html`.
- No delete/rename for saved custom presets.
- Only two colour stops per style (no multi-stop gradients).
- No export to PNG/SVG.
- Applying to a multi-selection with mixed sizes reuses the same paint object
  for every node — fine since the transform is unit-space, but grain image
  fills are tiled at a fixed scale so very differently sized layers may look
  inconsistent.
