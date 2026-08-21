// Gradient Backgrounds — Figma plugin
// Receives a gradient spec from the UI and creates a frame with native gradient paint
// (plus an optional tiled noise image fill for grain).

figma.showUI(__html__, { width: 380, height: 640, themeColors: false });

const STORE_KEY = 'customPresets';

figma.clientStorage.getAsync(STORE_KEY).then(function (saved) {
  figma.ui.postMessage({ type: 'presets', presets: saved || [] });
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

// Figma gradient transforms map gradient space -> object space (unit square).
function linearTransform(angleDeg) {
  // CSS angles run clockwise from "to top"; convert to the vector Figma expects.
  var a = ((angleDeg - 90) * Math.PI) / 180;
  var cos = Math.cos(a);
  var sin = Math.sin(a);
  return [
    [cos, -sin, (1 - cos + sin) / 2],
    [sin, cos, (1 - sin - cos) / 2]
  ];
}

function radialTransform(cx, cy, rx, ry) {
  return [
    [rx, 0, cx - rx / 2],
    [0, ry, cy - ry / 2]
  ];
}

function buildPaint(spec) {
  var s = Math.max(0, Math.min(100, spec.softness));
  var a = Math.max(0, 50 - s * 0.5) / 100;
  var b = Math.min(100, 50 + s * 0.5) / 100;
  var c1 = hexToRgb(spec.color1);
  var c2 = hexToRgb(spec.color2);

  if (spec.type === 'radial') {
    // color2 sits in the centre, color1 at the edges (central radial blur)
    return {
      type: 'GRADIENT_RADIAL',
      gradientTransform: radialTransform(0.5, 0.62, 1.4, 1.8),
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

figma.ui.onmessage = async function (msg) {
  if (msg.type === 'save-presets') {
    await figma.clientStorage.setAsync(STORE_KEY, msg.presets);
    return;
  }

  if (msg.type !== 'create') return;

  var spec = msg.spec;
  var frame = figma.createFrame();
  frame.name = spec.name || 'Gradient';
  frame.resize(spec.width, spec.height);
  frame.cornerRadius = spec.radius || 0;
  frame.clipsContent = true;

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

  frame.fills = fills;

  var vp = figma.viewport.center;
  frame.x = Math.round(vp.x - spec.width / 2);
  frame.y = Math.round(vp.y - spec.height / 2);

  figma.currentPage.appendChild(frame);
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.notify(frame.name + ' · ' + spec.width + ' × ' + spec.height);
};
