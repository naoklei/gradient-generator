# Gradient Backgrounds — Figma plugin

A Figma plugin that applies a gradient fill to the currently selected layer(s)
from six presets (or fully custom colours/type/softness/grain), using native
Figma gradient paints plus an optional native NOISE layer effect for grain.
Select a layer, pick a preset or dial in your own settings, then hit Apply —
the fill inherits the selected layer's size, no separate "create" step.

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
  an optional native `NOISE` layer effect) to the selected node(s)
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
- **Preset click = instant apply; everything else auto-applies once you
  settle:** clicking a preset swatch immediately re-applies that gradient
  to the selected layer(s) — it's a single discrete action, not something
  you drag. Slider and colour edits update the live panel preview
  continuously on `input` (no canvas write — that's what caused visible lag
  while dragging), then auto-apply once the edit settles, via the native
  `change` event (mouse-up on a slider, blur/Enter on a text field, closing
  the native colour picker) — no arbitrary debounce delay to tune, just the
  browser's own "this interaction just ended" signal. Renaming the style
  (the "Style name" field) is excluded from auto-apply since the name isn't
  part of the rendered gradient at all. Size is never set by the plugin;
  the fill just paints onto whatever geometry is selected, so it inherits
  that layer's width/height automatically (Figma's gradient transforms are
  defined in unit space, not pixels).
- **Apply button (next to Randomize, above the preview) only appears when
  there's something unapplied** — `appliedSpec` tracks what was last
  actually pushed to canvas, compared against the live `spec` (via
  `isUnapplied()`); with auto-apply already handling settled slider/colour
  edits, Apply mostly only shows up right after clicking **Randomize**
  (which deliberately doesn't auto-apply — see below), or briefly mid-drag
  before `change` fires. Trade-off: `appliedSpec` isn't reset on selection
  change, so it no longer offers a standing way to push the *current*,
  unchanged settings onto a newly-selected different layer — nudge a
  slider or reselect the preset if you need that.
- **Gradient math:** softness maps to how far the outer colour stops sit
  from the 50% midpoint — `0` = a hard edge, `100` = a full-bleed blend.
  Each style has a `colors: string[]` array (2 or 3 stops); stop `i` of
  `n` sits at `a + (b-a)*i/(n-1)` where `a`/`b` are the softness-derived
  outer positions — for 2 stops that's exactly `[a, b]`, for 3 it's
  `[a, 50, b]` (the middle stop stays anchored at the midpoint, only the
  outer two move with softness). See `design/HANDOFF.md` for the original
  2-stop formula this generalizes. Only `Rose / Plum` and `Futuristic
  Purple` currently use 3 stops; the radial type only ever reads
  `colors[0]`/`colors[1]` (no preset combines radial with 3+ stops, so
  center-out stop ordering for 3+ was never needed).
- **Randomize** (next to Apply, above the preview) regenerates the current
  style's colours (keeping whatever stop count — 2 or 3 — is currently
  loaded) using actual colour theory rather than uniform-random RGB: a
  random base hue anchors a randomly chosen harmony scheme (complementary
  or analogous for 2 stops; triadic, split-complementary, or analogous for
  3), saturation is constrained to a moderate 45-68% range (avoids both
  neon-max and muddy/desaturated results), and each stop draws lightness
  from a fixed, well-separated band by index (contrast guaranteed by
  construction, not by validating and retrying). It only updates the
  preview/colour swatches — like any other edit, it needs Apply (which
  appears once you randomize, since the result is now unapplied) or a
  settled `change` to reach the canvas, so an unreviewed random combo never
  silently overwrites the selected layer.
- **Radial positioning:** the "Central radial blur" type exposes Position X /
  Position Y number fields (laid out as a 2-column grid, -50 to +50, default
  0/0) that *offset* the blur's center from the style's baseline position
  (50%, 62%) — `0/0` reproduces the original look. Both the live preview and
  the applied Figma paint compute their center from the same
  `spec.offsetX`/`offsetY` values.
- **Angle field + flip buttons:** Angle is a direct-entry number field (not
  a slider) with two buttons next to it — ⇋ mirrors the gradient
  left↔right (`angle → 360 - angle`), ⇅ mirrors it top↔bottom
  (`angle → 180 - angle`), both using the CSS angle convention this app
  already follows (`0deg` = "to top", clockwise). Both are one-shot,
  predictable actions, so — unlike Randomize — they auto-apply immediately
  rather than waiting for Apply or a settled edit.
- **Gradient transforms, calibrated against real Figma:** neither
  `radialTransform` nor `linearTransform` in `code.js` is derived purely
  from the Plugin API docs — both were fixed using real test results from
  applying presets in Figma and comparing where colors/centers actually
  landed against the panel preview. That process revealed `gradientTransform`
  maps *shape space to paint space* (the reverse of the initial
  assumption): for radial, paint-space `(0.5, 0.5)` is the center; for
  linear, paint-space position 0/1 runs along the gradient's direction
  vector directly, with no extra flip step needed. Both were confirmed
  against multiple independent reports (radial center position; a vertical
  preset's top/bottom color order; a diagonal preset's slash direction and
  left/right color placement).
- **Grain:** uses Figma's native `NOISE` layer effect (Plugin API, currently
  **beta** — the shape may change) rather than a baked bitmap fill. Only the
  `MONOTONE` variant is used (grayscale grain via a single fixed mid-gray
  colour); the API also supports `DUOTONE`/`MULTITONE` but those aren't
  exposed in this UI. `Grain` (0-100) sets the effect's opacity (`color.a`);
  `Density` (0-100%) maps directly to the effect's `density`; `Noise size`
  is a 2-column X/Y number input (0-5, decimal, matching the API's
  `noiseSize`/`noiseSizeVector` — Figma requires `noiseSizeVector.x` to
  equal `noiseSize`, so `code.js` always sets both from the X value). Blend
  mode is fixed at `OVERLAY` so the grain lightens/darkens symmetrically
  regardless of the gradient's own lightness underneath, mirroring the old
  bitmap approach's grayscale+overlay look. The colour/blend-mode choice is
  a first pass based on the documented API shape, not yet confirmed against
  a live render — flag if the grain looks off (too strong/weak, wrong
  contrast direction) so it can be recalibrated. The panel's live preview
  still approximates grain with an SVG `feTurbulence` filter (`cssNoise` in
  `ui.html`), since a browser can't render Figma's native effect — treat the
  preview's grain as a rough stand-in, not a pixel match, for the applied
  result.
- **Presets:** six built-in styles are hard-coded in `ui.html`; anything
  you save is appended to a `custom` array persisted in
  `figma.clientStorage` (per user/machine, not synced anywhere). The
  Presets header shows **Delete** whenever the currently active preset is
  one of your saved custom ones (there's nothing to delete for a built-in
  — it isn't stored anywhere), and **Save preset** whenever the live spec
  has diverged from whatever preset was loaded (`isDirty()`) — the two can
  show together, e.g. after tweaking a custom preset you haven't saved
  over. Deleting doesn't touch the live preview/spec, just removes that
  entry from the grid and storage.

## Known gaps

- Both gradient transforms have been calibrated against real Figma test
  results (see "Gradient transforms" above) — they should now match the
  panel preview for every preset/type. If anything still looks off after
  pulling this, report exactly what and where (which color, which corner,
  what position) rather than "still wrong" — that's what made both fixes
  possible instead of repeated guessing.
- No rename for saved custom presets (delete exists; rename doesn't).
- Stop count (2 or 3) is fixed per preset by whoever authors it — there's
  no UI for users to add/remove a stop on an arbitrary style.
- No export to PNG/SVG.
- Applying to a multi-selection with mixed sizes reuses the same paint/effect
  objects for every node — fine since the gradient transform is unit-space
  and the native noise effect isn't geometry-relative either.
- The native `NOISE` effect is a **beta** Plugin API — its shape could
  change in a future Figma release. Only `MONOTONE` is implemented; the
  grain colour/blend-mode/default size/density values are a first pass, not
  yet verified against a live canvas render (see "Grain" above).
