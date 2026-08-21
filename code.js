// Gradient Backgrounds — Figma plugin
// Applies a gradient spec from the UI directly onto the selected layer(s)
// (native gradient paint plus an optional tiled noise image fill for grain).

figma.showUI(__html__, { width: 380, height: 620, themeColors: false });

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

// Figma gradient transforms map gradient space -> object space (unit square),
// so they don't depend on the target node's actual size.
//
// Both transforms below are built in familiar CSS/screen space (Y=0 at the
// top, growing downward, matching the panel preview). Figma's rendered
// result comes out vertically mirrored relative to that — confirmed by
// testing every preset/type in real Figma — so every matrix is passed
// through flipY() once here before use, rather than each transform having
// to remember to compensate individually.
function flipY(m) {
  return [
    [m[0][0], m[0][1], m[0][2]],
    [-m[1][0], -m[1][1], 1 - m[1][2]]
  ];
}

function linearTransform(angleDeg) {
  // CSS angles run clockwise from "to top"; convert to the vector Figma expects.
  var a = ((angleDeg - 90) * Math.PI) / 180;
  var cos = Math.cos(a);
  var sin = Math.sin(a);
  return flipY([
    [cos, -sin, (1 - cos + sin) / 2],
    [sin, cos, (1 - sin - cos) / 2]
  ]);
}

function radialTransform(cx, cy, rx, ry) {
  // Figma places the gradient's center handle at the translation (cx, cy),
  // with the horizontal/vertical radius handles offset by (rx, 0) and (0, ry).
  return flipY([
    [rx, 0, cx],
    [0, ry, cy]
  ]);
}

function buildPaint(spec) {
  var s = Math.max(0, Math.min(100, spec.softness));
  var a = Math.max(0, 50 - s * 0.5) / 100;
  var b = Math.min(100, 50 + s * 0.5) / 100;
  var c1 = hexToRgb(spec.color1);
  var c2 = hexToRgb(spec.color2);

  if (spec.type === 'radial') {
    // color2 sits in the centre, color1 at the edges (central radial blur)
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
  return {
    type: 'GRADIENT_LINEAR',
    gradientTransform: linearTransform(angle),
    gradientStops: [
      { position: a, color: { r: c1.r, g: c1.g, b: c1.b, a: 1 } },
      { position: b, color: { r: c2.r, g: c2.g, b: c2.b, a: 1 } }
    ]
  };
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

  if (spec.grain > 0 && msg.noise) {
    var image = figma.createImage(new Uint8Array(msg.noise));
    fills.push({
      type: 'IMAGE',
      imageHash: image.hash,
      scaleMode: 'TILE',
      scalingFactor: 0.5,
      opacity: spec.grain / 100,
      blendMode: 'OVERLAY'
    });
  }

  nodes.forEach(function (n) {
    try {
      n.fills = fills;
    } catch (e) {
      // node doesn't accept this fill set (e.g. locked) — skip it
    }
  });
};
