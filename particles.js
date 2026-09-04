/* v16: glyph-sampled canvas particles (iOS Safari / Chrome) */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var bgs = [null,
    document.getElementById("bg1"),
    document.getElementById("bg2"),
    document.getElementById("bg3"),
    document.getElementById("bg4"),
    document.getElementById("bg5"),
    document.getElementById("bg6")
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function assembleAmount(n) {
    if (n > 0.90) return 0;
    if (n > 0.70) return ease(1 - (n - 0.70) / 0.20);
    if (n >= 0.22) return 1;
    if (n > 0.06) return ease((n - 0.06) / 0.16);
    return 0;
  }

  function cloudFade(n) {
    if (n > 0.96) return 0;
    if (n > 0.86) return ease(1 - (n - 0.86) / 0.10);
    if (n >= 0.10) return 1;
    if (n > 0.02) return ease((n - 0.02) / 0.08);
    return 0;
  }

  function isDesktop() { return window.innerWidth >= 769; }

  function fontSizePx() {
    var w = window.innerWidth;
    if (w < 769) return Math.max(24.8, Math.min(34.4, w * 0.064));
    return Math.max(32, Math.min(48, w * 0.028));
  }

  function trackingEm() { return isDesktop() ? 0.12 : 0.07; }

  function viewSize() {
    var vv = window.visualViewport;
    return {
      w: Math.max(1, (vv && vv.width) || window.innerWidth || 1),
      h: Math.max(1, (vv && vv.height) || window.innerHeight || 1)
    };
  }

  function parseMessages() {
    var desktop = isDesktop();
    var messages = [];
    document.querySelectorAll("section.beat").forEach(function (sec) {
      var p = sec.querySelector(".lines p");
      if (!p) return;
      var lines = [[]];
      function pushRun(text, em) {
        if (!text) return;
        var line = lines[lines.length - 1];
        var last = line[line.length - 1];
        if (last && last.em === em) last.text += text;
        else line.push({ text: text, em: !!em });
      }
      function walk(node, em) {
        if (node.nodeType === 3) {
          pushRun(node.textContent, em);
        } else if (node.nodeName === "BR") {
          var hide = desktop && node.classList && node.classList.contains("sp");
          if (!hide) lines.push([]);
        } else if (node.nodeType === 1) {
          var nextEm = em || (node.classList && node.classList.contains("em"));
          node.childNodes.forEach(function (child) { walk(child, nextEm); });
        }
      }
      p.childNodes.forEach(function (node) { walk(node, false); });
      lines = lines.filter(function (line) {
        return line.some(function (run) { return /[^\s]/.test(run.text); });
      });
      messages.push({ section: sec, lines: lines, particles: [] });
    });
    return messages;
  }

  function setActiveBg(active) {
    for (var i = 1; i < bgs.length; i++) {
      if (!bgs[i]) continue;
      var on = i === active;
      bgs[i].style.opacity = on ? "1" : "0";
      if (on && !bgs[i].classList.contains("kb-active")) {
        bgs[i].classList.remove("kb-active");
        void bgs[i].offsetWidth;
        bgs[i].classList.add("kb-active");
      } else if (!on) {
        bgs[i].classList.remove("kb-active");
      }
    }
  }

  function tickBackgrounds() {
    var vh = viewSize().h;
    var active = 1;
    document.querySelectorAll("[data-scene]").forEach(function (sec) {
      var r = sec.getBoundingClientRect();
      if (r.top < vh * 0.55 && r.bottom > vh * 0.35) {
        active = Number(sec.getAttribute("data-scene"));
      }
    });
    setActiveBg(active);
  }

  if (reduceMotion) {
    function onBg() { tickBackgrounds(); }
    window.addEventListener("scroll", onBg, { passive: true });
    window.addEventListener("resize", onBg);
    onBg();
    return;
  }

  var canvas = document.createElement("canvas");
  canvas.id = "glyph-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });

  var messages = [];
  var dpr = 1;
  var vw = 1;
  var vh = 1;
  var ready = false;
  var rebuildTimer = 0;

  function measureLine(ctx2, runs, fs, track) {
    var total = 0;
    var glyphs = [];
    runs.forEach(function (run) {
      var size = run.em ? fs * 1.12 : fs;
      var weight = run.em ? 500 : 400;
      ctx2.font = weight + " " + size + "px \"Noto Serif JP\", \"Hiragino Mincho ProN\", serif";
      for (var i = 0; i < run.text.length; i++) {
        var ch = run.text.charAt(i);
        var w = ctx2.measureText(ch).width;
        var tr = size * track;
        glyphs.push({ ch: ch, w: w, tr: tr, size: size, weight: weight, em: run.em });
        total += w + tr;
      }
    });
    if (glyphs.length) total -= glyphs[glyphs.length - 1].tr;
    return { width: total, glyphs: glyphs };
  }

  function sampleMessage(msg) {
    var fs = fontSizePx();
    var track = trackingEm();
    var lineH = fs * 2;
    var probe = document.createElement("canvas");
    var pctx = probe.getContext("2d", { willReadFrequently: true });
    var maxLineW = 0;
    var measured = msg.lines.map(function (runs) {
      var m = measureLine(pctx, runs, fs, track);
      if (m.width > maxLineW) maxLineW = m.width;
      return m;
    });
    var pad = Math.max(28, fs);
    var w = Math.ceil(Math.min(vw * 0.96, maxLineW + pad * 2));
    var h = Math.ceil(msg.lines.length * lineH + pad * 2);
    var localDpr = Math.min(window.devicePixelRatio || 1, 2);
    probe.width = Math.max(1, Math.floor(w * localDpr));
    probe.height = Math.max(1, Math.floor(h * localDpr));
    pctx.setTransform(localDpr, 0, 0, localDpr, 0, 0);
    pctx.clearRect(0, 0, w, h);
    pctx.textAlign = "left";
    pctx.textBaseline = "middle";

    measured.forEach(function (m, li) {
      var x = (w - m.width) / 2;
      var y = pad + lineH * li + lineH / 2;
      m.glyphs.forEach(function (g) {
        pctx.font = g.weight + " " + g.size + "px \"Noto Serif JP\", \"Hiragino Mincho ProN\", serif";
        pctx.fillStyle = g.em ? "#ffcc80" : "#ffffff";
        pctx.fillText(g.ch, x, y);
        x += g.w + g.tr;
      });
    });

    var img = pctx.getImageData(0, 0, probe.width, probe.height);
    var data = img.data;
    var step = 1;
    var phone = vw < 769;
    var maxPts = phone ? 5000 : 7200;
    var candidates = [];
    for (var y = 0; y < probe.height; y += step) {
      for (var x = 0; x < probe.width; x += step) {
        var i = (y * probe.width + x) * 4;
        var a = data[i + 3];
        if (a > 72) {
          candidates.push({
            lx: x / localDpr,
            ly: y / localDpr,
            a: a / 255,
            em: data[i + 2] < 210
          });
        }
      }
    }
    if (candidates.length > maxPts) {
      var kept = [];
      var stride = candidates.length / maxPts;
      for (var k = 0; k < maxPts; k++) kept.push(candidates[Math.floor(k * stride)]);
      candidates = kept;
    }

    var ox = (vw - w) / 2;
    var oy = (vh - h) / 2;
    var spread = Math.min(vw, vh);
    var particles = [];
    for (var p = 0; p < candidates.length; p++) {
      var c = candidates[p];
      var seed = Math.random();
      var angIn = Math.random() * Math.PI * 2;
      var angOut = Math.random() * Math.PI * 2;
      var radIn = 36 + Math.random() * spread * 0.46;
      var radOut = 36 + Math.random() * spread * 0.50;
      particles.push({
        hx: ox + c.lx,
        hy: oy + c.ly,
        a: c.a,
        em: c.em,
        seed: seed,
        sxIn: ox + c.lx + Math.cos(angIn) * radIn * 0.85,
        syIn: oy + c.ly + Math.abs(Math.sin(angIn)) * radIn + 28 + Math.random() * 90,
        sxOut: ox + c.lx + Math.cos(angOut) * radOut * 0.9,
        syOut: oy + c.ly - Math.abs(Math.sin(angOut)) * radOut - 28 - Math.random() * 90,
        size: (c.em ? 1.25 : 1.05) + Math.random() * 1.15,
        shade: 0.72 + Math.random() * 0.28,
        delay: seed * 0.30
      });
    }
    msg.particles = particles;
    msg.metrics = { w: w, h: h, fs: fs };
  }

  function rebuild() {
    var vs = viewSize();
    vw = vs.w;
    vh = vs.h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(vw * dpr));
    canvas.height = Math.max(1, Math.floor(vh * dpr));
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    messages = parseMessages();
    for (var i = 0; i < messages.length; i++) sampleMessage(messages[i]);
    ready = messages.some(function (m) { return m.particles.length > 80; });
    if (ready) document.body.classList.add("particles-ready");
    else document.body.classList.remove("particles-ready");
  }

  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 120);
  }

  function draw() {
    var now = performance.now();
    ctx.clearRect(0, 0, vw, vh);
    var vs = viewSize();
    if (Math.abs(vs.w - vw) > 2 || Math.abs(vs.h - vh) > 2) {
      rebuild();
    }

    var active = 1;
    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var rec = msg.section.getBoundingClientRect();
      var n = (rec.top + rec.height * 0.5) / vh;
      if (rec.top < vh * 0.55 && rec.bottom > vh * 0.35) {
        active = Number(msg.section.getAttribute("data-scene")) || (m + 1);
      }
      var fade = cloudFade(n);
      if (fade < 0.02) continue;
      var t = assembleAmount(n);
      var fromBelow = n > 0.5;
      var pts = msg.particles;
      var darkA = 0.20 * fade;

      if (t > 0.28) {
        for (var d = 0; d < pts.length; d++) {
          var dp = pts[d];
          var ld = clamp((t - dp.delay) / 0.70, 0, 1);
          ld = ease(ld);
          if (ld < 0.28) continue;
          var sx = fromBelow ? dp.sxIn : dp.sxOut;
          var sy = fromBelow ? dp.syIn : dp.syOut;
          var j = (1 - ld) * 9 + 0.8;
          var x = lerp(sx, dp.hx, ld) + Math.sin(now * 0.0016 + dp.seed * 11.0) * j;
          var y = lerp(sy, dp.hy, ld) + Math.cos(now * 0.0012 + dp.seed * 8.0) * j * 0.75;
          var s = dp.size * (0.7 + 0.7 * ld);
          ctx.fillStyle = "rgba(8,6,4," + (darkA * ld).toFixed(3) + ")";
          ctx.fillRect(x - s * 0.75, y - s * 0.75, s * 2.15, s * 2.15);
        }
      }

      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var local = clamp((t - p.delay) / 0.70, 0, 1);
        local = ease(local);
        var psx = fromBelow ? p.sxIn : p.sxOut;
        var psy = fromBelow ? p.syIn : p.syOut;
        var jitter = (1 - local) * 11 + 1.05;
        var px = lerp(psx, p.hx, local) + Math.sin(now * 0.0016 + p.seed * 11.0) * jitter;
        var py = lerp(psy, p.hy, local) + Math.cos(now * 0.0012 + p.seed * 8.0) * jitter * 0.75;
        var size = p.size * (0.52 + 0.62 * local);
        var alpha = (0.40 + 0.60 * local) * p.a * p.shade * fade;
        var r, g, b;
        if (p.em) {
          r = Math.floor(255 * (0.92 + 0.08 * p.shade));
          g = Math.floor(210 + 28 * p.shade);
          b = Math.floor(150 + 40 * p.shade);
        } else {
          r = Math.floor(244 + 11 * p.shade);
          g = Math.floor(236 + 14 * p.shade);
          b = Math.floor(220 + 18 * p.shade);
        }
        ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + alpha.toFixed(3) + ")";
        ctx.fillRect(px, py, size, size);
      }
    }

    var cta = document.querySelector("section.cta");
    if (cta) {
      var cr = cta.getBoundingClientRect();
      if (cr.top < vh * 0.55 && cr.bottom > vh * 0.35) active = 6;
    }
    setActiveBg(active);
  }

  var running = true;
  function loop() {
    if (!running) return;
    if (document.visibilityState !== "hidden") draw();
    requestAnimationFrame(loop);
  }

  function start() {
    rebuild();
    requestAnimationFrame(loop);
  }

  function whenFonts(cb) {
    var once = false;
    function go() {
      if (once) return;
      once = true;
      cb();
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setTimeout(go, 40); });
      setTimeout(go, 1600);
    } else {
      setTimeout(go, 240);
    }
  }

  window.addEventListener("resize", scheduleRebuild);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleRebuild);
  }
  document.addEventListener("visibilitychange", function () {
    running = document.visibilityState !== "hidden";
    if (running) requestAnimationFrame(loop);
  });

  whenFonts(start);
})();
