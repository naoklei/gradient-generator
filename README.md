# Gradient Backgrounds — Figma plugin

A Figma plugin that generates 19:9 gradient background frames from six presets
(or fully custom colours/type/softness/grain), using native Figma gradient
paints plus an optional baked-noise grain layer.

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
- `code.js` — the plugin's sandboxed main thread: builds the frame, native
  `GRADIENT_LINEAR` / `GRADIENT_RADIAL` paints, and an optional tiled noise
  image fill
- `ui.html` — the plugin panel UI (preview, presets, controls); runs in an
  iframe and talks to `code.js` via `postMessage`
- `design/` — original design reference from Claude Design (not built code):
  - `Gradient Backgrounds.dc.html` — browser prototype of the six gradient
    styles with live sliders
  - `HANDOFF.md` — full design handoff notes (tokens, layout, gradient math,
    known gaps) written when this plugin was first scaffolded

## How it works

- **Gradient math:** softness maps to how far the two colour stops sit from
  the 50% midpoint — `0` = a hard edge, `100` = a full-bleed blend. See
  `design/HANDOFF.md` for the exact formula and per-style defaults.
- **Grain:** Figma has no procedural noise, so `ui.html` renders a noise
  pattern to a `<canvas>`, exports it as PNG bytes, and `code.js` applies it
  as a tiled `IMAGE` fill with `OVERLAY` blend mode on top of the gradient.
- **Presets:** six built-in styles are hard-coded in `ui.html`; anything you
  save with "Save preset" is appended to `figma.clientStorage` (persisted per
  user/machine, not synced anywhere).

## Known gaps (from the original handoff)

- `linearTransform` / `radialTransform` in `code.js` were untested in real
  Figma — worth double-checking angle direction and radial framing against
  the CSS preview in `design/Gradient Backgrounds.dc.html`.
- No delete/rename for saved custom presets.
- Only two colour stops per style (no multi-stop gradients).
- No export to PNG/SVG.
