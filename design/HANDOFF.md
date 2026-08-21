# Handoff: Gradient generator (web preview + Figma plugin)

## Overview
Two related deliverables:

1. **Gradient Backgrounds.dc.html** — a browser page showing six 19:9 gradient panels, each with per-panel softness and grain sliders.
2. **figma-plugin/** — a working Figma plugin that generates the same gradients as real Figma frames, with the six panels as presets plus custom presets.

The intended next step is a fuller gradient generator: more transition types, export, better preset management.

## About the design files
The `.dc.html` file is a **design reference** — a streaming HTML prototype showing the intended look and behaviour, not production code to lift directly. Recreate it in whatever environment the target project uses (React, Vue, plain TS). The `figma-plugin/` folder is different: it is **real, runnable plugin source** and can be developed further in place.

## Fidelity
**High fidelity.** Colours, type, spacing, radii, and motion are all final and follow the Loan Le design system (dark editorial). Recreate pixel-for-pixel.

## Screens / views

### A. Gradient preview page (`Gradient Backgrounds.dc.html`)
**Purpose:** review the six gradient styles and tune each one.

**Layout**
- Page background `#0c0c0a`, padding `80px 48px`, `min-height:100vh`.
- Inner column `max-width:1200px`, centred, `display:flex; flex-direction:column; gap:64px`.
- Header block: `max-width:560px`, `gap:16px` — eyebrow (Space Grotesk 13px, uppercase, +0.08em, `#7a7670`), title (Kumbh Sans 34px/300, `-0.01em`), body (Kumbh Sans 18px/300, line-height 1.6, `#7a7670`).
- Each panel block: `gap:16px` — the gradient frame, then a caption row.
- Gradient frame: `width:100%`, `aspect-ratio:19/9`, `border-radius:12px`, `border:1px solid rgba(255,255,255,0.06)`, `box-shadow:0 4px 20px rgba(0,0,0,0.25)`, `overflow:hidden`.
- Caption row: flex, `align-items:center`, `gap:8px 24px`, wraps. Space Grotesk 13px uppercase +0.06em. Style name `#d6d2ca`, metadata `#706c67`, then a right-aligned (`margin-left:auto`) controls group with two labelled sliders (`gap:24px` between them, `gap:12px` inside each).
- Sliders: 120px wide, 2px track `rgba(255,255,255,0.12)`, 10px square thumb with 2px radius, `#d6d2ca` → `#86efac` on hover, 150ms ease. Numeric readout 12px, 30px wide, right-aligned, tabular-nums.
- Footer line: 12px uppercase `#706c67`, above it a 1px `rgba(255,255,255,0.06)` rule with 24px padding.

**Panel data** (name · type · colours · default softness)
| Name | Type | Colour 1 | Colour 2 | Softness |
|---|---|---|---|---|
| Vibrant Mint / Orange | diagonal | `#98FFD9` | `#FF6B00` | 50 |
| Cool Sage / Oat | soft linear (160°, mid `#B9C7A8` at 50%) | `#8DAA81` | `#F5E8D3` | 90 |
| Coral / Navy | central radial | `#1A374D` (edge) | `#E08E8D` (centre) | 85 |
| Rose / Plum | vertical linear (180°) | `#4D1A40` | `#B56576` | 100 |
| Futuristic Purple | diagonal | `#FF00FF` | `#1A1A4D` | 50 |
| Forest / Sky Blue | sharp angular (115°) | `#1A4D2E` | `#87CEEB` | 8 |

**Gradient maths (the whole engine)**
```
a = max(0, 50 - softness * 0.5)   // first stop %
b = min(100, 50 + softness * 0.5) // second stop %
linear:  linear-gradient(<angle>deg, c1 a%, c2 b%)
radial:  radial-gradient(ellipse 70% 90% at 50% 62%, c2 a%, c1 b%)
```
Softness 0 = hard edge at 50%; softness 100 = full-bleed blend.

**Grain**
An inline SVG `feTurbulence` layer stacked above the gradient in the same `background` shorthand:
```
type='fractalNoise' baseFrequency=<grainScale> numOctaves='3' stitchTiles='stitch'
feColorMatrix saturate=0, rect opacity=<grain/100>
```
`grain` is per panel (0–60, default 18). `grainScale` is global (0.2–2.0, default 0.8).

### B. Figma plugin panel (`figma-plugin/ui.html`)
**Purpose:** generate a gradient frame on canvas.

- 380 × 640 panel, same dark palette and type as above.
- Top: 19:9 live preview (`border-radius:12px`, hairline border, resting shadow).
- Preset grid: 3 columns, 8px gap, 19:9 swatches, `border-radius:2px`; hover lifts `-2px` and borders `rgba(255,255,255,0.12)`; active swatch borders `#86efac`.
- Controls: style name, two colour pairs (native colour input + hex text), transition type select, then sliders for angle / softness / grain / grain scale, then W and H numbers (default 1140 × 540).
- Fixed bottom bar: `rgba(12,12,10,0.72)` + `backdrop-filter:blur(16px)`, 1px top border, two buttons ("Save preset", "Create frame ↗"), 2px radius, uppercase Space Grotesk 13px, hover fills `rgba(134,239,172,0.07)` with `#86efac` border and text.

## Interactions & behaviour
- **Preview page:** sliders update state on `input`; each panel keeps its own softness and grain. Global Tweaks props (`softness`, `diagonalAngle`, `grain`, `grainScale`) seed the per-panel values.
- **Plugin:** clicking a preset loads it into the form (size and grain scale persist). "Create frame" generates the noise PNG in the panel, posts the spec + bytes to `code.js`, which builds the frame, centres it in the viewport, selects it, and zooms to it. "Save preset" appends the current spec to `figma.clientStorage` under `customPresets`.
- **Motion:** colour/opacity 150–200ms ease; transforms 300ms ease-out. No spring, no bounce.

## State
Preview page: `soft: number[6]`, `grain: number[6]`, both lazily initialised from props.
Plugin: `spec` (name, color1, color2, type, angle, softness, grain, grainScale, width, height), `custom: Preset[]`, `activeIndex`.

## Design tokens
- Colours: `#0c0c0a` page · `#131311` card · `#1c1c19` hover · `#d6d2ca` text primary · `#7a7670` secondary · `#706c67` muted · `#86efac` accent · borders `rgba(255,255,255,0.06)` / `rgba(255,255,255,0.12)`.
- Type: Kumbh Sans 300/400/500 (content), Space Grotesk 400/500 (labels, always uppercase +0.06/0.08em at ≤13px). Scale 34 · 28 · 22 · 20 · 18 · 15 · 13 · 12.
- Spacing: 8 · 16 · 24 · 32 · 48 · 64 · 80.
- Radii: 12px cards, 2px controls.
- Shadows: rest `0 4px 20px rgba(0,0,0,0.25)`, lift `0 12px 40px rgba(0,0,0,0.45)`.

## Assets
None. Fonts load from Google Fonts CDN (Kumbh Sans, Space Grotesk). The grain PNG is generated at runtime; no bundled images.

## Files
- `Gradient Backgrounds.dc.html` — the preview page (design reference)
- `figma-plugin/manifest.json` · `code.js` · `ui.html` · `README.md` — runnable plugin source

## Known gaps to pick up in Claude Code
- The plugin's `linearTransform` / `radialTransform` matrices are untested in Figma; verify angle direction and radial framing against the CSS preview.
- Grain is baked as a tiled 512px PNG (`TILE`, `scalingFactor 0.5`, `OVERLAY`) because Figma has no procedural noise. Tune tile size vs. frame size.
- No delete/rename for saved custom presets.
- No multi-stop gradients, and no export to PNG/SVG from the web page.
- Only two colour stops per style; the sage/oat mid stop is hard-coded in the web version and dropped in the plugin.
