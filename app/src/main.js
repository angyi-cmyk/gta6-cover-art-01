/* Neon Coast editor: wires the cover engine to the page. Photos are read
   on this machine only (file input or the bundled samples) and never
   uploaded anywhere. */
(function () {
  'use strict';

  var PREVIEW_MAX = 560;

  var state = {
    size: 'square',
    layout: 'grid4',
    grade: 'sunset',
    caption: 'VICE CITY',
    subtitle: 'STATE OF LEONIDA',
    captionScale: 1,
    showStars: true,
    photos: [],
    panels: [],
    selectedPanel: 0
  };

  var preview = document.getElementById('preview');
  var pctx = preview.getContext('2d');

  /* ---- fonts: the bundled Liberation faces, loaded before first paint ---- */
  function loadFonts() {
    var faces = [
      new FontFace('CoverBold', 'url(fonts/LiberationSans-Bold.ttf)'),
      new FontFace('CoverText', 'url(fonts/LiberationSans-Regular.ttf)')
    ];
    faces.forEach(function (face) {
      face.load().then(function (loaded) {
        document.fonts.add(loaded);
        render();
      }).catch(function () { /* fall back to system sans */ });
    });
  }

  /* ---- photos ---- */
  function addPhoto(img, name) {
    state.photos.push({ img: img, name: name });
    renderPhotoList();
    return state.photos.length - 1;
  }

  function loadSample(url, name) {
    var img = new Image();
    img.onload = function () {
      addPhoto(img, name);
      if (state.photos.length <= 2) {
        state.panels.forEach(function (panel, i) { panel.photo = i % 2; });
      }
      render();
    };
    img.src = url;
  }

  function renderPhotoList() {
    var list = document.getElementById('photoList');
    list.innerHTML = '';
    state.photos.forEach(function (photo, i) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'photo-chip' + (state.panels[state.selectedPanel] && state.panels[state.selectedPanel].photo === i ? ' sel' : '');
      chip.title = photo.name + ' — click to put in the selected panel';
      var thumb = document.createElement('img');
      thumb.src = photo.img.src;
      thumb.alt = photo.name;
      var label = document.createElement('span');
      label.textContent = photo.name;
      chip.appendChild(thumb);
      chip.appendChild(label);
      chip.addEventListener('click', function () {
        var panel = state.panels[state.selectedPanel];
        if (panel) {
          panel.photo = i;
          panel.ox = 0;
          panel.oy = 0;
          panel.scale = 1;
        }
        render();
      });
      list.appendChild(chip);
    });
  }

  /* ---- preview ---- */
  function previewSize() {
    var size = CoverEngine.SIZES[state.size];
    var scale = Math.min(1, PREVIEW_MAX / Math.max(size.w, size.h));
    return { w: Math.round(size.w * scale), h: Math.round(size.h * scale), scale: scale };
  }

  function render() {
    var ps = previewSize();
    if (preview.width !== ps.w || preview.height !== ps.h) {
      preview.width = ps.w;
      preview.height = ps.h;
    }
    CoverEngine.renderCover(pctx, ps.w, ps.h, state);
    updatePanelInfo();
  }

  function updatePanelInfo() {
    var count = CoverEngine.LAYOUTS[state.layout].panels;
    var panel = state.panels[state.selectedPanel];
    var name = panel && state.photos[panel.photo] ? state.photos[panel.photo].name : 'none';
    document.getElementById('panelInfo').textContent =
      'Panel ' + (state.selectedPanel + 1) + ' of ' + count + ' — photo: ' + name;
    var zoom = document.getElementById('zoomSlider');
    if (panel) zoom.value = Math.round(panel.scale * 100);
  }

  /* ---- controls ---- */
  function bindButtons(rowId, attr, apply) {
    var row = document.getElementById(rowId);
    row.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button');
      if (!btn) return;
      row.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      apply(btn.getAttribute(attr));
      render();
    });
  }

  bindButtons('sizeRow', 'data-size', function (v) { state.size = v; });
  bindButtons('layoutRow', 'data-layout', function (v) {
    state.layout = v;
    state.panels = CoverEngine.panelsForLayout(v, state.panels);
    state.selectedPanel = 0;
  });
  bindButtons('gradeRow', 'data-grade', function (v) { state.grade = v; });

  document.getElementById('captionInput').addEventListener('input', function (ev) {
    state.caption = ev.target.value;
    render();
  });
  document.getElementById('subtitleInput').addEventListener('input', function (ev) {
    state.subtitle = ev.target.value;
    render();
  });
  document.getElementById('captionSize').addEventListener('input', function (ev) {
    state.captionScale = Number(ev.target.value) / 100;
    render();
  });
  document.getElementById('starsToggle').addEventListener('change', function (ev) {
    state.showStars = ev.target.checked;
    render();
  });
  document.getElementById('zoomSlider').addEventListener('input', function (ev) {
    var panel = state.panels[state.selectedPanel];
    if (panel) {
      panel.scale = Number(ev.target.value) / 100;
      render();
    }
  });
  document.getElementById('resetPanel').addEventListener('click', function () {
    var panel = state.panels[state.selectedPanel];
    if (panel) {
      panel.ox = 0;
      panel.oy = 0;
      panel.scale = 1;
      render();
    }
  });
  document.getElementById('fillAll').addEventListener('click', function () {
    var panel = state.panels[state.selectedPanel];
    if (!panel) return;
    state.panels.forEach(function (p) {
      p.photo = panel.photo;
      p.ox = 0;
      p.oy = 0;
      p.scale = 1;
    });
    render();
  });

  document.getElementById('fileInput').addEventListener('change', function (ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    files.forEach(function (file) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        addPhoto(img, file.name.replace(/\.[^.]+$/, ''));
        render();
      };
      img.src = url;
    });
    ev.target.value = '';
  });

  document.getElementById('sampleBoulevard').addEventListener('click', function () {
    loadSample('samples/boulevard.jpg', 'Boulevard');
  });
  document.getElementById('samplePier').addEventListener('click', function () {
    loadSample('samples/pier.jpg', 'Pier');
  });

  /* ---- drag to pan, wheel to zoom ---- */
  var drag = null;
  function canvasPoint(ev) {
    var rect = preview.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (preview.width / rect.width),
      y: (ev.clientY - rect.top) * (preview.height / rect.height)
    };
  }
  preview.addEventListener('pointerdown', function (ev) {
    var pt = canvasPoint(ev);
    var idx = CoverEngine.panelAt(state.layout, preview.width, preview.height, pt.x, pt.y);
    if (idx < 0) return;
    state.selectedPanel = idx;
    drag = { panel: state.panels[idx], x: pt.x, y: pt.y };
    preview.setPointerCapture(ev.pointerId);
    render();
  });
  preview.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    var pt = canvasPoint(ev);
    var ps = previewSize();
    var size = CoverEngine.SIZES[state.size];
    var k = size.w / ps.w;
    drag.panel.ox += (pt.x - drag.x) * k;
    drag.panel.oy += (pt.y - drag.y) * k;
    drag.x = pt.x;
    drag.y = pt.y;
    render();
  });
  preview.addEventListener('pointerup', function () { drag = null; });
  preview.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var panel = state.panels[state.selectedPanel];
    if (!panel) return;
    var factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
    panel.scale = Math.min(4, Math.max(1, panel.scale * factor));
    render();
  }, { passive: false });

  /* ---- export ---- */
  document.getElementById('exportBtn').addEventListener('click', function () {
    var size = CoverEngine.SIZES[state.size];
    var canvas = CoverEngine.renderToCanvas(size.w, size.h, state);
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'neon-coast-cover-' + state.size + '-' + size.w + 'x' + size.h + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    }, 'image/png');
  });

  /* ---- start: default panels, then the two sample photos ---- */
  state.panels = CoverEngine.panelsForLayout('grid4', []);
  loadFonts();
  loadSample('samples/boulevard.jpg', 'Boulevard');
  loadSample('samples/pier.jpg', 'Pier');
  render();
})();
