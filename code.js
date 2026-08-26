// Gradient Backgrounds — Figma plugin
// Applies a gradient spec from the UI directly onto the selected layer(s)
// (native gradient paint plus an optional native NOISE effect for grain).

figma.showUI(__html__, { width: 380, height: 800, themeColors: false });

const STORE_KEY = 'customPresets';

var loadedPresets = [];
figma.clientStorage.getAsync(STORE_KEY).then(function (saved) {
  loadedPresets = saved || [];
  figma.ui.postMessage({ type: 'presets', presets: loadedPresets });
});

function hexToRgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255
  };
}

// Figma gradient transforms map SHAPE space to PAINT space (confirmed by
// empirically calibrating radialTransform below against real Figma test
// results — this is the reverse of the naive "paint space to shape space"
// assumption both transforms started from, and it's the actual root cause
// behind every flip reported so far, not just a simple vertical mirror).
//
// For a linear gradient, paint space is 1-D: position 0 (color1) at u=0,
// position 1 (color2) at u=1. So the transform's u-row just needs to point
// along the gradient's direction vector (cos, sin) — computed the same way
// as before, via the CSS-equivalent start/end points on the unit square —
// scaled so u=0 at the start point and u=1 at the end point. Confirmed
// against two real Figma reports: a vertical preset (color order top/
// bottom) and a diagonal preset (slash direction + left/right color
// placement) both render correctly with this formula, with no separate
// flip step needed.
function linearTransform(angleDeg) {
  var a = ((angleDeg - 90) * Math.PI) / 180;
  var cos = Math.cos(a);
  var sin = Math.sin(a);
  return [
    [cos, sin, (1 - cos - sin) / 2],
    [-sin, cos, 0.5]
  ];
}

function radialTransform(cx, cy, rx, ry) {
  // Empirically calibrated against real Figma (two test points: default
  // position and an offset position, each compared against where the
  // center actually rendered on canvas). Figma's gradientTransform maps
  // SHAPE space to PAINT space — the reverse of what earlier attempts
  // assumed — and paint-space (0.5, 0.5) is the radial gradient's center.
  // So placing the visual center at shape-space (cx, cy) means solving
  // rx*cx + tx = 0.5 (and the same for y) for the translation:
  return [
    [rx, 0, 0.5 - rx * cx],
    [0, ry, 0.5 - ry * cy]
  ];
}

function buildPaint(spec) {
  var s = Math.max(0, Math.min(100, spec.softness));
  var a = Math.max(0, 50 - s * 0.5) / 100;
  var b = Math.min(100, 50 + s * 0.5) / 100;

  if (spec.type === 'radial') {
    // color2 sits in the centre, color1 at the edges (central radial blur).
    // Radial only ever uses the first two stops — no preset combines
    // radial with more than 2 colors, so 3+ stop center-out ordering was
    // never needed here.
    var c1 = hexToRgb(spec.colors[0]);
    var c2 = hexToRgb(spec.colors[1]);
    var offsetX = typeof spec.offsetX === 'number' ? spec.offsetX : 0;
    var offsetY = typeof spec.offsetY === 'number' ? spec.offsetY : 0;
    var cx = (50 + offsetX) / 100;
    var cy = (62 + offsetY) / 100;
    return {
      type: 'GRADIENT_RADIAL',
      gradientTransform: radialTransform(cx, cy, 0.7, 0.9),
      gradientStops: [
        { position: a, color: { r: c2.r, g: c2.g, b: c2.b, a: 1 } },
        { position: b, color: { r: c1.r, g: c1.g, b: c1.b, a: 1 } }
      ]
    };
  }

  var angle = spec.type === 'vertical' ? 180 : spec.angle;
  var n = spec.colors.length;
  var stops = spec.colors.map(function (hex, i) {
    var rgb = hexToRgb(hex);
    var position = a + (b - a) * (i / (n - 1));
    return { position: position, color: { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 } };
  });
  return {
    type: 'GRADIENT_LINEAR',
    gradientTransform: linearTransform(angle),
    gradientStops: stops
  };
}

// Native NoiseEffect (Effects panel "Noise"), monotone only for now.
// color is fixed mid-gray so OVERLAY blending can lighten/darken
// symmetrically regardless of the underlying gradient's own lightness —
// same reasoning the old baked-bitmap grain used grayscale + OVERLAY for.
// This is a first pass verified against the documented API shape, not
// against a live render yet (color/blendMode choice in particular may
// need adjusting once seen on canvas).
function buildEffects(spec) {
  if (!spec.grain) return [];
  var density = typeof spec.grainDensity === 'number' ? spec.grainDensity : 50;
  var sizeX = typeof spec.noiseSizeX === 'number' ? spec.noiseSizeX : 1;
  var sizeY = typeof spec.noiseSizeY === 'number' ? spec.noiseSizeY : 1;
  return [{
    type: 'NOISE',
    noiseType: 'MONOTONE',
    visible: true,
    blendMode: 'OVERLAY',
    color: { r: 0.5, g: 0.5, b: 0.5, a: spec.grain / 100 },
    noiseSize: sizeX,
    noiseSizeVector: { x: sizeX, y: sizeY },
    density: density / 100
  }];
}

function getFillableNodes() {
  return figma.currentPage.selection.filter(function (n) {
    return 'fills' in n;
  });
}

function postSelection() {
  var nodes = getFillableNodes();
  if (nodes.length === 0) {
    figma.ui.postMessage({ type: 'selection', hasSelection: false });
    return;
  }
  var first = nodes[0];
  figma.ui.postMessage({
    type: 'selection',
    hasSelection: true,
    count: nodes.length,
    width: first.width,
    height: first.height
  });
}

figma.on('selectionchange', postSelection);
postSelection();

figma.ui.onmessage = async function (msg) {
  if (msg.type === 'ui-ready') {
    // The UI just attached its listener — resend state in case the
    // startup messages fired before it was ready to receive them.
    figma.ui.postMessage({ type: 'presets', presets: loadedPresets });
    postSelection();
    return;
  }

  if (msg.type === 'save-presets') {
    await figma.clientStorage.setAsync(STORE_KEY, msg.presets);
    return;
  }

  if (msg.type !== 'apply') return;

  var nodes = getFillableNodes();
  if (nodes.length === 0) {
    figma.notify('Select a layer first');
    return;
  }

  var spec = msg.spec;
  var fills = [buildPaint(spec)];
  var effects = buildEffects(spec);

  nodes.forEach(function (n) {
    try {
      n.fills = fills;
      n.effects = effects;
    } catch (e) {
      // node doesn't accept this fill/effect set (e.g. locked) — skip it
    }
  });
};
