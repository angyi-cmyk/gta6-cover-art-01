/* Neon Coast cover engine: draws GTA-style poster art on a canvas.
   Pure canvas 2D, no network, no dependencies. All sizes derive from the
   export width and height, so the same state renders a small live preview
   and a full-size export. Photos are HTMLImageElements supplied by the
   caller; nothing is fetched here. */
var CoverEngine = (function () {
  'use strict';

  var SIZES = {
    square: { w: 1080, h: 1080, label: '1080 × 1080' },
    portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
    wide: { w: 1920, h: 1080, label: '1920 × 1080' }
  };

  var LAYOUTS = {
    grid4: { panels: 4, label: 'Grid 2×2' },
    hero3: { panels: 4, label: 'Hero + 3' },
    full: { panels: 1, label: 'Full bleed' },
    tilt: { panels: 3, label: 'Tilted snaps' }
  };

  var GRADES = {
    sunset: { label: 'Sunset' },
    neon: { label: 'Neon' },
    vice: { label: 'Vice' },
    noir: { label: 'Noir' },
    none: { label: 'None' }
  };

  /* Deterministic random numbers, so an export never changes between runs. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Panel rectangles for a layout, in export pixels. */
  function layoutPanels(layout, W, H) {
    var g = Math.max(4, Math.round(W * 0.012));
    if (layout === 'grid4') {
      var w = (W - g * 3) / 2;
      var h = (H - g * 3) / 2;
      return [
        { x: g, y: g, w: w, h: h },
        { x: g * 2 + w, y: g, w: w, h: h },
        { x: g, y: g * 2 + h, w: w, h: h },
        { x: g * 2 + w, y: g * 2 + h, w: w, h: h }
      ];
    }
    if (layout === 'hero3') {
      var heroH = (H - g * 3) * 0.6;
      var rowH = H - g * 3 - heroH;
      var cw = (W - g * 4) / 3;
      var by = g * 2 + heroH;
      return [
        { x: g, y: g, w: W - g * 2, h: heroH },
        { x: g, y: by, w: cw, h: rowH },
        { x: g * 2 + cw, y: by, w: cw, h: rowH },
        { x: g * 3 + cw * 2, y: by, w: cw, h: rowH }
      ];
    }
    if (layout === 'full') {
      return [{ x: 0, y: 0, w: W, h: H }];
    }
    /* tilt: three snapshots, rotated, on a sunset backdrop. */
    var pw = W * 0.4;
    var ph = H * 0.5;
    return [
      { x: W * 0.07, y: H * 0.06, w: pw, h: ph, rot: -0.12 },
      { x: W * 0.31, y: H * 0.12, w: pw, h: ph, rot: 0.03 },
      { x: W * 0.55, y: H * 0.06, w: pw, h: ph, rot: 0.12 }
    ];
  }

  /* Panels for a new layout, keeping each photo assignment where it fits. */
  function panelsForLayout(layout, prevPanels) {
    var count = LAYOUTS[layout].panels;
    var out = [];
    for (var i = 0; i < count; i++) {
      var prev = prevPanels[i] || prevPanels[0] || { photo: 0, ox: 0, oy: 0, scale: 1 };
      out.push({ photo: prev.photo, ox: 0, oy: 0, scale: 1 });
    }
    return out;
  }

  /* Which panel holds point (x, y) in preview/export pixels, or -1. */
  function panelAt(layout, W, H, x, y) {
    var rects = layoutPanels(layout, W, H);
    for (var i = rects.length - 1; i >= 0; i--) {
      var r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  /* One photo drawn cover-fit into a rectangle, with pan and zoom. */
  function drawPhotoCover(ctx, img, rect, panel) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) {
      var grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      grad.addColorStop(0, '#3a2c63');
      grad.addColorStop(1, '#17112a');
      ctx.fillStyle = grad;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      return;
    }
    var scale = Math.max(rect.w / iw, rect.h / ih) * (panel.scale || 1);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = rect.x + (rect.w - dw) / 2 + (panel.ox || 0);
    var dy = rect.y + (rect.h - dh) / 2 + (panel.oy || 0);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* A photo layer: every panel's photo, gutters left as the page colour. */
  function drawPhotoLayer(layer, W, H, state) {
    var ctx = layer.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    var rects = layoutPanels(state.layout, W, H);
    var border = Math.max(4, Math.round(W * 0.012));
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var panel = state.panels[i];
      if (!panel) continue;
      var photo = state.photos[panel.photo];
      var img = photo && photo.img ? photo.img : photo;
      ctx.save();
      if (state.layout === 'tilt') {
        var cx = r.x + r.w / 2;
        var cy = r.y + r.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(r.rot || 0);
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = W * 0.02;
        ctx.shadowOffsetY = H * 0.01;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-r.w / 2 - border, -r.h / 2 - border, r.w + border * 2, r.h + border * 2);
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.rect(-r.w / 2, -r.h / 2, r.w, r.h);
        ctx.clip();
        if (img) drawPhotoCover(ctx, img, { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h }, panel);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.clip();
        if (img) drawPhotoCover(ctx, img, r, panel);
        ctx.restore();
      }
    }
  }

  /* Colour grade over the photos: gradient washes, vignette, grain. */
  function applyGrade(ctx, W, H, grade) {
    if (grade === 'none') return;
    var wash = ctx.createLinearGradient(0, 0, 0, H);
    if (grade === 'sunset') {
      wash.addColorStop(0, 'rgba(255,110,40,0.16)');
      wash.addColorStop(1, 'rgba(255,40,110,0.20)');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(255,150,70,0.10)';
      ctx.fillRect(0, 0, W, H);
    } else if (grade === 'neon') {
      wash.addColorStop(0, 'rgba(255,0,140,0.20)');
      wash.addColorStop(1, 'rgba(0,220,255,0.20)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,60,160,0.10)';
      ctx.fillRect(0, H * 0.5, W, H * 0.5);
    } else if (grade === 'vice') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(0,180,180,0.14)';
      ctx.fillRect(0, 0, W, H);
      wash.addColorStop(0, 'rgba(0,0,0,0)');
      wash.addColorStop(1, 'rgba(255,80,160,0.20)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    /* Vignette. */
    var vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(5,0,15,0)');
    vig.addColorStop(1, 'rgba(5,0,15,0.30)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    /* Grain, seeded so exports never vary. */
    var rnd = mulberry32(1337);
    var dots = Math.floor((W * H) / 220);
    for (var i = 0; i < dots; i++) {
      var v = rnd();
      ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    }
  }

  function starPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = i % 2 === 0 ? r : r * 0.45;
      var x = cx + Math.cos(ang) * rad;
      var y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* Split a caption into at most two lines that fit maxWidth. */
  function wrapCaption(ctx, text, maxWidth) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    var lines = [''];
    for (var i = 0; i < words.length; i++) {
      var test = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width <= maxWidth || lines[lines.length - 1] === '') {
        lines[lines.length - 1] = test;
      } else if (lines.length < 2) {
        lines.push(words[i]);
      } else {
        lines[1] += ' ' + words[i];
      }
    }
    return lines;
  }

  /* Bold title lettering with a gradient fill and a dark outline. */
  function drawCaption(ctx, W, H, state) {
    var caption = (state.caption || '').trim();
    var subtitle = (state.subtitle || '').trim();
    if (!caption && !subtitle) return;
    var tilted = state.layout === 'tilt';
    var bandTop = tilted ? H * 0.66 : H * 0.6;
    var scrim = ctx.createLinearGradient(0, bandTop, 0, H);
    scrim.addColorStop(0, 'rgba(10,6,20,0)');
    scrim.addColorStop(1, 'rgba(10,6,20,0.78)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, bandTop, W, H - bandTop);
    /* Halftone dots fading into the scrim. */
    var rnd = mulberry32(4242);
    var gap = Math.max(9, W * 0.014);
    for (var y = bandTop + gap; y < H; y += gap) {
      for (var x = gap / 2; x < W; x += gap) {
        var a = 0.05 + 0.1 * ((y - bandTop) / (H - bandTop)) * rnd();
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, gap * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    var fs = H * 0.105 * (state.captionScale || 1);
    var maxW = W * 0.9;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    var gradStops = {
      sunset: ['#ffffff', '#ffd166'],
      neon: ['#ffffff', '#ff5ea8'],
      vice: ['#ffffff', '#7df9ff'],
      noir: ['#ffffff', '#cfcfcf'],
      none: ['#ffffff', '#ffe9a8']
    }[state.grade] || ['#ffffff', '#ffd166'];
    if (caption) {
      ctx.font = '700 ' + Math.round(fs) + 'px CoverBold, "Arial Black", sans-serif';
      try { ctx.letterSpacing = Math.round(fs * 0.05) + 'px'; } catch (e) { /* older canvas: no letter spacing */ }
      var lines = wrapCaption(ctx, caption, maxW);
      var lineH = fs * 1.04;
      var baseY = tilted ? H * 0.85 : H * 0.875;
      if (lines.length === 2) baseY -= lineH / 2;
      var fill = ctx.createLinearGradient(0, baseY - fs, 0, baseY + fs * 0.15);
      fill.addColorStop(0, gradStops[0]);
      fill.addColorStop(1, gradStops[1]);
      for (var li = 0; li < lines.length; li++) {
        var ly = baseY + li * lineH;
        ctx.strokeStyle = 'rgba(25,5,45,0.85)';
        ctx.lineWidth = Math.max(2, fs * 0.055);
        ctx.strokeText(lines[li], W / 2, ly);
        ctx.fillStyle = fill;
        ctx.fillText(lines[li], W / 2, ly);
      }
      try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
      if (subtitle) {
        var sfs = Math.round(H * 0.028);
        ctx.font = '400 ' + sfs + 'px CoverText, "Liberation Sans", Arial, sans-serif';
        try { ctx.letterSpacing = Math.round(sfs * 0.42) + 'px'; } catch (e) { /* older canvas */ }
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(subtitle, W / 2, baseY + lines.length * lineH * 0.55 + sfs);
        try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
      }
      if (state.showStars) {
        var sr = Math.max(5, H * 0.011);
        var sy = baseY + lines.length * lineH * 0.55 + H * 0.028 + sr * 2.4;
        var total = sr * 2 * 5 + sr * 4;
        for (var s = 0; s < 5; s++) {
          var sx = W / 2 - total / 2 + sr + s * (sr * 2 + sr);
          starPath(ctx, sx, sy, sr);
          ctx.fillStyle = '#ffd166';
          ctx.fill();
        }
      }
    } else if (subtitle) {
      var sfs2 = Math.round(H * 0.032);
      ctx.font = '400 ' + sfs2 + 'px CoverText, "Liberation Sans", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(subtitle, W / 2, H * 0.88);
    }
  }

  /* The whole cover: sunset backdrop for tilt, photos, grade, caption. */
  function renderCover(ctx, W, H, state) {
    ctx.clearRect(0, 0, W, H);
    if (state.layout === 'tilt') {
      var bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#2b1055');
      bg.addColorStop(0.55, '#ff5e78');
      bg.addColorStop(1, '#ffb347');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
    var layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    drawPhotoLayer(layer, W, H, state);
    if (state.grade === 'noir') {
      ctx.filter = 'grayscale(1) contrast(1.18) brightness(1.02)';
    }
    ctx.drawImage(layer, 0, 0);
    ctx.filter = 'none';
    applyGrade(ctx, W, H, state.grade);
    drawCaption(ctx, W, H, state);
  }

  /* A fresh canvas with the cover rendered at W by H. */
  function renderToCanvas(W, H, state) {
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    renderCover(canvas.getContext('2d'), W, H, state);
    return canvas;
  }

  return {
    SIZES: SIZES,
    LAYOUTS: LAYOUTS,
    GRADES: GRADES,
    layoutPanels: layoutPanels,
    panelsForLayout: panelsForLayout,
    panelAt: panelAt,
    renderCover: renderCover,
    renderToCanvas: renderToCanvas
  };
})();
