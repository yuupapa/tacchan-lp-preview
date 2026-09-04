/* v25: intro strip visibility is tied to beat 2 — the observer root is the lower ~40% of the viewport, so the strip fades out before the scene-3 campfire bg takes over (and back in on return), instead of staying stuck on once shown; scene-2 telop lift raised to 16% vh on phones. v24: scene-2 telop lifted ~12% vh to make room for the compact intro strip below it; intro strip fade-in via IntersectionObserver (no-JS keeps it visible). v23: background activation reads every [data-scene] section (including the mid CTA), so the bg no longer falls back to the morning scene while the mid form is in view. v21: desktop telop size bumped (~+29%); v20: luminous light-mote particles + solid text crossfade; fit-to-width shrink so long lines never clip; text anchor locked to a stable viewport center (no rebuild/jump when the iOS URL bar shows/hides on scroll) */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Intro strip reveal (v25). Armed synchronously before first paint; without
  // JS the strip simply stays visible (no body.intro-js class is added).
  // The observer root is shrunk to the lower ~40% of the viewport, so the
  // strip only counts as "visible" while it sits low on screen — i.e. while
  // beat 2 is the active scene. It fades out as it rises past ~60vh, which
  // happens before the background switches to the scene-3 campfire (scene 2's
  // bottom edge crossing 55vh), and fades back in when beat 2 returns.
  var introEl = document.querySelector(".intro");
  if (introEl && "IntersectionObserver" in window) {
    document.body.classList.add("intro-js");
    var introIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) introEl.classList.add("visible");
        else introEl.classList.remove("visible");
      });
    }, { threshold: 0.35, rootMargin: "-60% 0px 0px 0px" });
    introIO.observe(introEl);
  }

  var bgs = [null,
    document.getElementById("bg1"),
    document.getElementById("bg2"),
    document.getElementById("bg3"),
    document.getElementById("bg4"),
    document.getElementById("bg5"),
    document.getElementById("bg6")
  ];

  // Static NodeList of every section that pins a background, including the
  // mid CTA (data-scene="3") which is not a .beat and has no particles.
  var sceneSections = document.querySelectorAll("[data-scene]");

  var EM_COLOR = "#7DFFB2";
  var EM_RGB = "125,255,178";

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t * t * (3 - 2 * t); }

  function assembleAmount(n) {
    if (n > 1.02) return 0;
    if (n > 0.68) return ease(1 - (n - 0.68) / 0.34);
    if (n >= 0.22) return 1;
    if (n > -0.04) return ease((n + 0.04) / 0.26);
    return 0;
  }

  function cloudFade(n) {
    if (n > 1.12) return 0;
    if (n > 0.88) return ease(1 - (n - 0.88) / 0.24);
    if (n >= 0.06) return 1;
    if (n > -0.14) return ease((n + 0.14) / 0.20);
    return 0;
  }

  function solidTextAlpha(t) {
    if (t < 0.82) return 0;
    return ease((t - 0.82) / 0.18);
  }

  function particleFadeOut(t) {
    if (t < 0.75) return 1;
    if (t > 0.95) return 0;
    return 1 - ease((t - 0.75) / 0.20);
  }

  function isDesktop() { return window.innerWidth >= 769; }

  function fontSizePx() {
    var w = window.innerWidth;
    if (w < 769) return Math.max(24.8, Math.min(34.4, w * 0.064));
    return Math.max(40, Math.min(62.4, w * 0.036));
  }

  function trackingEm() { return isDesktop() ? 0.12 : 0.07; }

  // Layout viewport only. visualViewport shrinks/grows on iOS during scroll
  // (URL bar) and pinch-zoom; anchoring text to it makes the glyph field drift.
  function viewSize() {
    return {
      w: Math.max(1, window.innerWidth || 1),
      h: Math.max(1, window.innerHeight || 1)
    };
  }

  function parseMessages() {
    var desktop = isDesktop();
    var messages = [];
    document.querySelectorAll("section.beat").forEach(function (sec) {
      var p = sec.querySelector(".lines p");
      if (!p) return;
      var sceneNum = Number(sec.getAttribute("data-scene")) || 0;
      var useEm = sceneNum === 5;
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
      // Scene 2 carries the compact intro strip in its lower area, so its
      // telop is lifted above the viewport center to make room. v25: phones
      // lift further (0.16) so the strip never crowds the telop on ~390px
      // screens; desktop keeps the v24 lift.
      var lift = sceneNum === 2 ? (desktop ? 0.12 : 0.16) : 0;
      messages.push({ section: sec, lines: lines, particles: [], useEm: useEm, lift: lift });
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
    var ctaInnerRm = document.querySelector(".cta-inner");
    function onBg() {
      tickBackgrounds();
      if (ctaInnerRm) {
        var ctaRm = document.querySelector("section.cta");
        if (ctaRm) {
          var crRm = ctaRm.getBoundingClientRect();
          var visRm = crRm.top < window.innerHeight * 0.55 && crRm.bottom > window.innerHeight * 0.35;
          if (visRm) ctaInnerRm.classList.add("visible");
          else ctaInnerRm.classList.remove("visible");
        }
      }
    }
    window.addEventListener("scroll", onBg, { passive: true });
    window.addEventListener("resize", onBg);
    onBg();
    return;
  }

  var canvas = document.createElement("canvas");
  canvas.id = "glyph-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d", { alpha: true });

  function makeSprite(rgb) {
    var s = document.createElement("canvas");
    s.width = 10;
    s.height = 10;
    var c = s.getContext("2d");
    var g = c.createRadialGradient(5, 5, 0, 5, 5, 5);
    g.addColorStop(0, "rgba(" + rgb + ",1)");
    g.addColorStop(0.22, "rgba(" + rgb + ",0.62)");
    g.addColorStop(0.55, "rgba(" + rgb + ",0.20)");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 10, 10);
    return s;
  }
  var spriteLight = makeSprite("255,250,240");
  var spriteGold = makeSprite("255,216,170");
  var spriteEm = makeSprite(EM_RGB);

  function makeParticle(hx, hy, a, em, spread) {
    var seed = Math.random();
    var angIn = Math.random() * Math.PI * 2;
    var angOut = Math.random() * Math.PI * 2;
    var radIn = 22 + Math.random() * spread * 0.34;
    var radOut = 22 + Math.random() * spread * 0.38;
    return {
      hx: hx,
      hy: hy,
      a: a,
      em: em,
      seed: seed,
      nx: (Math.random() - 0.5) * 16,
      ny: (Math.random() - 0.5) * 18,
      sxIn: hx + Math.cos(angIn) * radIn * 0.8,
      syIn: hy + Math.abs(Math.sin(angIn)) * radIn + 18 + Math.random() * 56,
      sxOut: hx + Math.cos(angOut) * radOut * 0.85,
      syOut: hy - Math.abs(Math.sin(angOut)) * radOut - 18 - Math.random() * 56,
      size: (em ? 1.55 : 1.35) + Math.random() * 0.7,
      shade: 0.78 + Math.random() * 0.22,
      delay: seed * 0.22
    };
  }

  function particleXY(p, local, fromBelow, now) {
    var k = 1 - local;
    var farx = fromBelow ? p.sxIn : p.sxOut;
    var fary = fromBelow ? p.syIn : p.syOut;
    var x, y;
    if (k < 0.42) {
      var u = ease(k / 0.42);
      x = p.hx + p.nx * u;
      y = p.hy + p.ny * u;
    } else {
      var u2 = ease((k - 0.42) / 0.58);
      x = p.hx + p.nx + (farx - p.hx - p.nx) * u2;
      y = p.hy + p.ny + (fary - p.hy - p.ny) * u2;
    }
    var jitter = 0.45 + k * 5.5;
    x += Math.sin(now * 0.0017 + p.seed * 11.0) * jitter;
    y += Math.cos(now * 0.0013 + p.seed * 8.0) * jitter * 0.72;
    return { x: x, y: y };
  }

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
    var probe = document.createElement("canvas");
    var pctx = probe.getContext("2d", { willReadFrequently: true });
    var useEm = msg.useEm;
    // Fit-to-width: shrink fs until the longest line fits inside vw*0.96 including padding,
    // so long lines (e.g. scene 3 「ひとりでつくるものじゃない。」) never clip left/right on phones.
    var maxLineW = 0;
    var measured = [];
    var pad = 28;
    for (var fit = 0; fit < 5; fit++) {
      maxLineW = 0;
      measured = msg.lines.map(function (runs) {
        var m = measureLine(pctx, runs, fs, track);
        if (m.width > maxLineW) maxLineW = m.width;
        return m;
      });
      pad = Math.max(28, fs);
      var avail = vw * 0.96 - pad * 2;
      if (maxLineW <= avail || fs <= 13) break;
      fs = Math.max(13, fs * (avail / maxLineW) * 0.985);
    }
    var lineH = fs * 2;
    var w = Math.ceil(Math.min(vw * 0.96, maxLineW + pad * 2));
    var h = Math.ceil(msg.lines.length * lineH + pad * 2);
    var localDpr = Math.min(window.devicePixelRatio || 1, 2);
    probe.width = Math.max(1, Math.floor(w * localDpr));
    probe.height = Math.max(1, Math.floor(h * localDpr));
    pctx.setTransform(localDpr, 0, 0, localDpr, 0, 0);
    pctx.clearRect(0, 0, w, h);
    pctx.textAlign = "left";
    pctx.textBaseline = "middle";

    var emColor = useEm ? EM_COLOR : "#ffcc80";
    measured.forEach(function (m, li) {
      var x = (w - m.width) / 2;
      var y = pad + lineH * li + lineH / 2;
      m.glyphs.forEach(function (g) {
        pctx.font = g.weight + " " + g.size + "px \"Noto Serif JP\", \"Hiragino Mincho ProN\", serif";
        pctx.fillStyle = g.em ? emColor : "#ffffff";
        pctx.fillText(g.ch, x, y);
        x += g.w + g.tr;
      });
    });

    var img = pctx.getImageData(0, 0, probe.width, probe.height);
    var data = img.data;
    var phone = vw < 769;
    var target = phone ? 6800 : 9000;
    var candidates = [];
    for (var y = 0; y < probe.height; y += 1) {
      for (var x = 0; x < probe.width; x += 1) {
        var i = (y * probe.width + x) * 4;
        var a = data[i + 3];
        if (a > 64) {
          candidates.push({
            lx: x / localDpr,
            ly: y / localDpr,
            a: a / 255,
            em: data[i + 2] < 210
          });
        }
      }
    }
    if (!candidates.length) {
      msg.particles = [];
      return;
    }
    if (candidates.length > target) {
      var kept = [];
      var stride = candidates.length / target;
      for (var k = 0; k < target; k++) kept.push(candidates[Math.floor(k * stride)]);
      candidates = kept;
    }

    var ox = (vw - w) / 2;
    var oy = (vh - h) / 2 - (msg.lift ? vh * msg.lift : 0);
    var spread = Math.min(vw, vh);
    var particles = [];
    for (var p = 0; p < candidates.length; p++) {
      var c = candidates[p];
      particles.push(makeParticle(ox + c.lx, oy + c.ly, c.a, c.em, spread));
    }
    var extra = 0;
    while (particles.length < target && extra < target) {
      var src = candidates[extra % candidates.length];
      particles.push(makeParticle(
        ox + src.lx + (Math.random() - 0.5) * 1.15,
        oy + src.ly + (Math.random() - 0.5) * 1.15,
        src.a,
        src.em,
        spread
      ));
      extra++;
    }
    msg.particles = particles;
    msg.metrics = { w: w, h: h, fs: fs, count: particles.length, ox: ox, oy: oy };

    var solid = document.createElement("canvas");
    solid.width = probe.width;
    solid.height = probe.height;
    var sctx = solid.getContext("2d");
    sctx.setTransform(localDpr, 0, 0, localDpr, 0, 0);
    sctx.textAlign = "left";
    sctx.textBaseline = "middle";
    sctx.shadowColor = "rgba(0,0,0,0.85)";
    sctx.shadowBlur = 18;
    // no Y offset: the solid phase must land exactly on the particle home
    // positions, otherwise the text appears to settle downward at crossfade
    sctx.shadowOffsetY = 0;
    measured.forEach(function (m, li) {
      var x = (w - m.width) / 2;
      var y = pad + lineH * li + lineH / 2;
      m.glyphs.forEach(function (g) {
        sctx.font = g.weight + " " + g.size + "px \"Noto Serif JP\", \"Hiragino Mincho ProN\", serif";
        sctx.fillStyle = g.em ? emColor : "#ffffff";
        sctx.fillText(g.ch, x, y);
        x += g.w + g.tr;
      });
    });
    msg.solidCanvas = solid;
    msg.solidW = w;
    msg.solidH = h;
    msg.solidDpr = localDpr;
    msg.useEm = useEm;
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
    // No per-frame viewport polling here: vw/vh stay at the values captured by the
    // last (debounced, width-guarded) rebuild, so the text anchor cannot drift
    // between scroll frames.

    var active = 1;
    for (var s = 0; s < sceneSections.length; s++) {
      var srec = sceneSections[s].getBoundingClientRect();
      if (srec.top < vh * 0.55 && srec.bottom > vh * 0.35) {
        active = Number(sceneSections[s].getAttribute("data-scene")) || active;
      }
    }
    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var rec = msg.section.getBoundingClientRect();
      var n = (rec.top + rec.height * 0.5) / vh;
      var fade = cloudFade(n);
      if (fade < 0.02) continue;
      var t = assembleAmount(n);
      var fromBelow = n > 0.5;
      var pts = msg.particles;
      var delaySpan = 0.78;

      var pFade = particleFadeOut(t);
      var emSprite = msg.useEm ? spriteEm : spriteGold;

      if (pFade > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var local = ease(clamp((t - p.delay) / delaySpan, 0, 1));
          var xy = particleXY(p, local, fromBelow, now);
          var size = p.size * (0.9 + 0.7 * local);
          ctx.globalAlpha = (0.30 + 0.58 * local) * p.a * p.shade * fade * pFade;
          ctx.drawImage(p.em ? emSprite : spriteLight, xy.x - size * 0.5, xy.y - size * 0.5, size, size);
        }
        ctx.globalCompositeOperation = "source-over";
      }

      var solidAlpha = solidTextAlpha(t) * fade;
      if (solidAlpha > 0.01 && msg.solidCanvas) {
        ctx.globalAlpha = solidAlpha;
        var ox = msg.metrics.ox;
        var oy = msg.metrics.oy;
        ctx.drawImage(msg.solidCanvas, ox, oy, msg.solidW, msg.solidH);
      }

      ctx.globalAlpha = 1;
    }

    var cta = document.querySelector("section.cta");
    var ctaInner = cta ? cta.querySelector(".cta-inner") : null;
    if (cta) {
      var cr = cta.getBoundingClientRect();
      var ctaVisible = cr.top < vh * 0.55 && cr.bottom > vh * 0.35;
      if (ctaVisible) active = 6;
      if (ctaInner) {
        if (ctaVisible) ctaInner.classList.add("visible");
        else ctaInner.classList.remove("visible");
      }
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

  // iOS Safari fires resize on scroll while the URL bar shows/hides (height-only
  // change). Rebuilding then re-randomizes the particle field and re-anchors the
  // text, which reads as a visible jump. Rebuild only on width change (rotation /
  // genuine resize); on desktop there is no collapsing URL bar, so height-only
  // changes rebuild too and keep the text centered.
  function onViewportResize() {
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    if (Math.abs(w - vw) > 2 || (w >= 769 && Math.abs(h - vh) > 2)) scheduleRebuild();
  }
  window.addEventListener("resize", onViewportResize);
  document.addEventListener("visibilitychange", function () {
    running = document.visibilityState !== "hidden";
    if (running) requestAnimationFrame(loop);
  });

  whenFonts(start);
})();
