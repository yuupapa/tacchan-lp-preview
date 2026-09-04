/* v26: the たっちゃん intro text and the mid-CTA label 「ここから。」 run through the SAME canvas glyph-particle pipeline as the telops (gather → hold → dissolve, same curves/sprites). Particle homes are now stored block-local with a per-frame anchor, so the intro strip and mid label stay glued to their DOM position while moving like telops; the intro photo soft-fades in sync with the text assembly; the mid form settles in scroll-linked and stays clickable (keyboard focus forces it fully visible). Per-message body classes (particles-intro / particles-mid) keep the DOM text as fallback whenever a block fails to sample. v25: intro strip visibility tied to beat 2 (observer root = lower ~40% of the viewport); scene-2 telop lift raised to 16% vh on phones. v24: scene-2 telop lifted ~12% vh; intro strip fade-in. v23: background activation reads every [data-scene] section. v21: desktop telop size bumped. v20: luminous light-mote particles + solid text crossfade; fit-to-width shrink; text anchor locked to a stable viewport center (no rebuild/jump when the iOS URL bar shows/hides) */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Intro strip reveal — fallback for the no-particle path (v25 semantics):
  // the observer root is shrunk to the lower ~40% of the viewport, so the
  // strip only counts as "visible" while it sits low on screen — i.e. while
  // beat 2 is the active scene — and fades out before the scene-3 campfire
  // bg takes over. Armed synchronously before first paint; without JS the
  // strip simply stays visible (no body.intro-js class is added). Under
  // particles-intro the particle loop drives the photo opacity instead and
  // CSS neutralizes this fade.

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
  var SERIF = "\"Noto Serif JP\", \"Hiragino Mincho ProN\", serif";
  var SANS = "\"Noto Sans JP\", \"Hiragino Kaku Gothic ProN\", sans-serif";

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

  // Read the real computed style so the sampled glyphs match the CSS exactly,
  // even if the stylesheet values change later.
  function computedFs(el, fallback) {
    var v = parseFloat(window.getComputedStyle(el).fontSize);
    return isFinite(v) && v > 0 ? v : fallback;
  }
  function computedTrackEm(el, fs, fallback) {
    var v = parseFloat(window.getComputedStyle(el).letterSpacing);
    return isFinite(v) && fs > 0 ? v / fs : fallback;
  }
  function computedLineHEm(el, fs, fallback) {
    var v = parseFloat(window.getComputedStyle(el).lineHeight);
    return isFinite(v) && fs > 0 ? v / fs : fallback;
  }

  // Shared DOM walker: builds lines of styled runs ({text, em, bold}) from an
  // element's child nodes. <br> starts a new line (desktop hides .sp breaks);
  // whitespace-only lines are dropped.
  function tokenize(root, desktop, initEm, initBold) {
    var lines = [[]];
    function pushRun(text, em, bold) {
      if (!text) return;
      var line = lines[lines.length - 1];
      var last = line[line.length - 1];
      if (last && last.em === em && last.bold === bold) last.text += text;
      else line.push({ text: text, em: !!em, bold: !!bold });
    }
    function walk(node, em, bold) {
      if (node.nodeType === 3) {
        pushRun(node.textContent, em, bold);
      } else if (node.nodeName === "BR") {
        var hide = desktop && node.classList && node.classList.contains("sp");
        if (!hide) lines.push([]);
      } else if (node.nodeType === 1) {
        var nextEm = em || (node.classList && node.classList.contains("em"));
        var nextBold = bold || (node.classList && node.classList.contains("intro-name"));
        for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], nextEm, nextBold);
      }
    }
    for (var i = 0; i < root.childNodes.length; i++) walk(root.childNodes[i], initEm, initBold);
    return lines.filter(function (line) {
      return line.some(function (run) { return /[^\s]/.test(run.text); });
    });
  }

  function parseTelopMessages() {
    var desktop = isDesktop();
    var messages = [];
    document.querySelectorAll("section.beat").forEach(function (sec) {
      var p = sec.querySelector(".lines p");
      if (!p) return;
      var sceneNum = Number(sec.getAttribute("data-scene")) || 0;
      var lines = tokenize(p, desktop, false, false);
      // Scene 2 carries the compact intro strip in its lower area, so its
      // telop is lifted above the viewport center to make room. v25: phones
      // lift further (0.16) so the strip never crowds the telop on ~390px
      // screens; desktop keeps the v24 lift.
      var lift = sceneNum === 2 ? (desktop ? 0.12 : 0.16) : 0;
      messages.push({
        kind: "telop",
        progressEl: sec,
        anchorEl: null,
        lines: lines,
        particles: [],
        useEm: sceneNum === 5,
        lift: lift,
        fontFamily: SERIF,
        fsFn: fontSizePx,
        trackFn: trackingEm,
        lineHFn: function () { return 2; },
        align: "center",
        maxAlpha: 1,
        shadowBlur: 18,
        minFs: 13,
        padFn: function (fs) { return Math.max(28, fs); },
        availFn: function (vw, pad) { return vw * 0.96 - pad * 2; },
        targetFn: function (phone) { return phone ? 6800 : 9000; },
        topUp: true
      });
    });
    return messages;
  }

  // たっちゃん intro (v26): the text column becomes glyph particles anchored to
  // its live DOM rect inside scene 2, so it gathers/holds/dissolves like a
  // telop while staying glued to the photo (which soft-fades separately).
  function parseIntroMessage() {
    var strip = document.querySelector(".intro");
    var textEl = strip ? strip.querySelector(".intro-text") : null;
    if (!strip || !textEl) return null;
    var desktop = isDesktop();
    var lines = [];
    for (var i = 0; i < textEl.children.length; i++) {
      var p = textEl.children[i];
      var sub = tokenize(p, desktop, false, p.classList && p.classList.contains("intro-name"));
      for (var j = 0; j < sub.length; j++) lines.push(sub[j]);
    }
    if (!lines.length) return null;
    return {
      kind: "intro",
      progressEl: strip,
      anchorEl: textEl,
      lines: lines,
      particles: [],
      useEm: false,
      lift: 0,
      fontFamily: SANS,
      fsFn: function () { return computedFs(textEl, 12.8); },
      trackFn: function (fs) { return computedTrackEm(textEl, fs, 0.05); },
      lineHFn: function (fs) { return computedLineHEm(textEl, fs, 1.95); },
      align: "left",
      maxAlpha: 0.88,
      shadowBlur: 10,
      minFs: 8,
      padFn: function (fs) { return Math.max(14, fs); },
      availFn: function () {
        var r = textEl.getBoundingClientRect();
        return Math.max(60, r.width * 0.995);
      },
      targetFn: function (phone) { return phone ? 2200 : 2600; },
      topUp: false
    };
  }

  // Mid-CTA label 「ここから。」 (v26): same particle system, centered on the
  // label's own box; the form below it only fades/settles and stays clickable.
  function parseMidLabelMessage() {
    var label = document.querySelector(".mid-cta-label");
    if (!label) return null;
    var text = label.textContent.replace(/\s+/g, "");
    if (!text) return null;
    return {
      kind: "mid",
      progressEl: label,
      anchorEl: label,
      lines: [[{ text: text, em: false, bold: false }]],
      particles: [],
      useEm: false,
      lift: 0,
      fontFamily: SERIF,
      fsFn: function () { return computedFs(label, 16); },
      trackFn: function (fs) { return computedTrackEm(label, fs, 0.18); },
      lineHFn: function () { return 2; },
      align: "center-el",
      maxAlpha: 0.82,
      shadowBlur: 12,
      minFs: 11,
      padFn: function () { return 16; },
      availFn: function (vw) { return vw * 0.9; },
      targetFn: function () { return 1000; },
      topUp: false
    };
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

  // Particle homes (lx/ly) are LOCAL to the message's sampled block; the draw
  // loop adds the per-frame anchor, so moving blocks (intro / mid label) reuse
  // the exact same motion math as the pinned telops.
  function makeParticle(lx, ly, a, em, spread) {
    var seed = Math.random();
    var angIn = Math.random() * Math.PI * 2;
    var angOut = Math.random() * Math.PI * 2;
    var radIn = 22 + Math.random() * spread * 0.34;
    var radOut = 22 + Math.random() * spread * 0.38;
    return {
      lx: lx,
      ly: ly,
      a: a,
      em: em,
      seed: seed,
      nx: (Math.random() - 0.5) * 16,
      ny: (Math.random() - 0.5) * 18,
      dxIn: Math.cos(angIn) * radIn * 0.8,
      dyIn: Math.abs(Math.sin(angIn)) * radIn + 18 + Math.random() * 56,
      dxOut: Math.cos(angOut) * radOut * 0.85,
      dyOut: -Math.abs(Math.sin(angOut)) * radOut - 18 - Math.random() * 56,
      size: (em ? 1.55 : 1.35) + Math.random() * 0.7,
      shade: 0.78 + Math.random() * 0.22,
      delay: seed * 0.22
    };
  }

  function particleXY(p, local, fromBelow, now, hx, hy) {
    var k = 1 - local;
    var farx = hx + (fromBelow ? p.dxIn : p.dxOut);
    var fary = hy + (fromBelow ? p.dyIn : p.dyOut);
    var x, y;
    if (k < 0.42) {
      var u = ease(k / 0.42);
      x = hx + p.nx * u;
      y = hy + p.ny * u;
    } else {
      var u2 = ease((k - 0.42) / 0.58);
      x = hx + p.nx + (farx - hx - p.nx) * u2;
      y = hy + p.ny + (fary - hy - p.ny) * u2;
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
  var introPhoto = document.querySelector(".intro-photo");
  var introParticlesOn = false;
  var midSectionEl = document.querySelector("section.mid-cta");
  var midForm = midSectionEl ? midSectionEl.querySelector("form") : null;
  var midParticlesOn = false;

  function measureLine(ctx2, runs, fs, track, family) {
    var total = 0;
    var glyphs = [];
    runs.forEach(function (run) {
      var size = run.em ? fs * 1.12 : fs;
      var weight = run.em ? 500 : (run.bold ? 600 : 400);
      ctx2.font = weight + " " + size + "px " + family;
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

  function paintRuns(ctxR, measured, opts) {
    ctxR.textAlign = "left";
    ctxR.textBaseline = "middle";
    measured.forEach(function (m, li) {
      var x = opts.align === "left" ? opts.pad : (opts.w - m.width) / 2;
      var y = opts.pad + opts.lineH * li + opts.lineH / 2;
      m.glyphs.forEach(function (g) {
        ctxR.font = g.weight + " " + g.size + "px " + opts.family;
        ctxR.fillStyle = g.em ? opts.emColor : "#ffffff";
        ctxR.fillText(g.ch, x, y);
        x += g.w + g.tr;
      });
    });
  }

  function sampleMessage(msg) {
    var fs = msg.fsFn();
    var track = msg.trackFn(fs);
    var probe = document.createElement("canvas");
    var pctx = probe.getContext("2d", { willReadFrequently: true });
    var useEm = msg.useEm;
    // Fit-to-width: shrink fs until the longest line fits the message's
    // available width, so long lines never clip left/right on phones.
    var maxLineW = 0;
    var measured = [];
    var pad = msg.padFn(fs);
    for (var fit = 0; fit < 5; fit++) {
      maxLineW = 0;
      measured = msg.lines.map(function (runs) {
        var m = measureLine(pctx, runs, fs, track, msg.fontFamily);
        if (m.width > maxLineW) maxLineW = m.width;
        return m;
      });
      pad = msg.padFn(fs);
      var avail = msg.availFn(vw, pad);
      if (maxLineW <= avail || fs <= msg.minFs) break;
      fs = Math.max(msg.minFs, fs * (avail / maxLineW) * 0.985);
    }
    var lineH = fs * msg.lineHFn(fs);
    var w = Math.ceil(Math.min(vw * 0.96, maxLineW + pad * 2));
    var h = Math.ceil(msg.lines.length * lineH + pad * 2);
    var localDpr = Math.min(window.devicePixelRatio || 1, 2);
    probe.width = Math.max(1, Math.floor(w * localDpr));
    probe.height = Math.max(1, Math.floor(h * localDpr));
    pctx.setTransform(localDpr, 0, 0, localDpr, 0, 0);
    pctx.clearRect(0, 0, w, h);

    var emColor = useEm ? EM_COLOR : "#ffcc80";
    paintRuns(pctx, measured, { align: msg.align, pad: pad, lineH: lineH, w: w, family: msg.fontFamily, emColor: emColor });

    var img = pctx.getImageData(0, 0, probe.width, probe.height);
    var data = img.data;
    var phone = vw < 769;
    var target = msg.targetFn(phone);
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

    var spread = Math.min(vw, vh);
    var particles = [];
    for (var p = 0; p < candidates.length; p++) {
      var c = candidates[p];
      particles.push(makeParticle(c.lx, c.ly, c.a, c.em, spread));
    }
    if (msg.topUp) {
      var extra = 0;
      while (particles.length < target && extra < target) {
        var src = candidates[extra % candidates.length];
        particles.push(makeParticle(
          src.lx + (Math.random() - 0.5) * 1.15,
          src.ly + (Math.random() - 0.5) * 1.15,
          src.a,
          src.em,
          spread
        ));
        extra++;
      }
    }
    msg.particles = particles;
    msg.metrics = { w: w, h: h, fs: fs, count: particles.length, pad: pad };
    if (msg.kind === "telop") {
      // Static viewport-centered anchor: captured at rebuild time so the text
      // anchor cannot drift between scroll frames (iOS URL bar).
      msg.metrics.ox = (vw - w) / 2;
      msg.metrics.oy = (vh - h) / 2 - (msg.lift ? vh * msg.lift : 0);
    }

    var solid = document.createElement("canvas");
    solid.width = probe.width;
    solid.height = probe.height;
    var sctx = solid.getContext("2d");
    sctx.setTransform(localDpr, 0, 0, localDpr, 0, 0);
    // no Y offset: the solid phase must land exactly on the particle home
    // positions, otherwise the text appears to settle downward at crossfade
    sctx.shadowColor = "rgba(0,0,0,0.85)";
    sctx.shadowBlur = msg.shadowBlur;
    sctx.shadowOffsetY = 0;
    paintRuns(sctx, measured, { align: msg.align, pad: pad, lineH: lineH, w: w, family: msg.fontFamily, emColor: emColor });
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
    messages = parseTelopMessages();
    var introMsg = parseIntroMessage();
    if (introMsg) messages.push(introMsg);
    var midMsg = parseMidLabelMessage();
    if (midMsg) messages.push(midMsg);
    for (var i = 0; i < messages.length; i++) sampleMessage(messages[i]);
    ready = messages.some(function (m) { return m.particles.length > 80; });
    document.body.classList.toggle("particles-ready", ready);
    // Per-block fallbacks: only hide the DOM text of blocks that actually
    // produced particles, so a failed sample never blanks real copy.
    introParticlesOn = !!(introMsg && introMsg.particles.length > 120);
    midParticlesOn = !!(midMsg && midMsg.particles.length > 60);
    document.body.classList.toggle("particles-intro", introParticlesOn);
    document.body.classList.toggle("particles-mid", midParticlesOn);
    if (!introParticlesOn && introPhoto) introPhoto.style.opacity = "";
    if (!midParticlesOn && midForm) {
      midForm.style.opacity = "";
      midForm.style.transform = "";
    }
  }

  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, 120);
  }

  // Per-frame anchor for each message. Telops keep their static
  // viewport-centered origin; the intro/mid blocks track their live DOM rect.
  function anchorFor(msg, progressRec) {
    if (msg.kind === "telop") return { x: msg.metrics.ox, y: msg.metrics.oy };
    var r = (msg.anchorEl === msg.progressEl) ? progressRec : msg.anchorEl.getBoundingClientRect();
    if (msg.align === "left") {
      return { x: r.left - msg.metrics.pad, y: r.top - msg.metrics.pad };
    }
    return {
      x: r.left + (r.width - msg.metrics.w) / 2,
      y: r.top + (r.height - msg.metrics.h) / 2
    };
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
      if (!msg.particles.length) continue;
      var rec = msg.progressEl.getBoundingClientRect();
      var n = (rec.top + rec.height * 0.5) / vh;
      var fade = cloudFade(n);
      var t = assembleAmount(n);
      if (msg.kind === "intro" && introParticlesOn && introPhoto) {
        // Soft fade synced to the text: appears as the glyphs finish
        // gathering, leaves with the first half of the dissolve.
        introPhoto.style.opacity = (clamp((t - 0.45) / 0.35, 0, 1) * fade).toFixed(3);
      }
      if (fade < 0.02) continue;
      var fromBelow = n > 0.5;
      var anchor = anchorFor(msg, rec);
      var pts = msg.particles;
      var delaySpan = 0.78;

      var pFade = particleFadeOut(t);
      var emSprite = msg.useEm ? spriteEm : spriteGold;

      if (pFade > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var local = ease(clamp((t - p.delay) / delaySpan, 0, 1));
          var xy = particleXY(p, local, fromBelow, now, anchor.x + p.lx, anchor.y + p.ly);
          var size = p.size * (0.9 + 0.7 * local);
          ctx.globalAlpha = (0.30 + 0.58 * local) * p.a * p.shade * fade * pFade * msg.maxAlpha;
          ctx.drawImage(p.em ? emSprite : spriteLight, xy.x - size * 0.5, xy.y - size * 0.5, size, size);
        }
        ctx.globalCompositeOperation = "source-over";
      }

      var solidAlpha = solidTextAlpha(t) * fade * msg.maxAlpha;
      if (solidAlpha > 0.01 && msg.solidCanvas) {
        ctx.globalAlpha = solidAlpha;
        ctx.drawImage(msg.solidCanvas, anchor.x, anchor.y, msg.solidW, msg.solidH);
      }

      ctx.globalAlpha = 1;
    }

    // Mid-CTA form (v26): scroll-linked settle under the particle label.
    // Opacity/transform only — hit-testing is untouched, and keyboard focus
    // forces full visibility so the input can never fade out while typing.
    if (midForm && midParticlesOn) {
      var fr = midSectionEl.getBoundingClientRect();
      var fin = ease(clamp((vh * 0.98 - fr.top) / (vh * 0.36), 0, 1));
      var fout = fr.bottom < vh * 0.30 ? clamp((fr.bottom - vh * 0.06) / (vh * 0.24), 0, 1) : 1;
      var fa = fin * fout;
      if (midForm.contains(document.activeElement)) fa = 1;
      midForm.style.opacity = fa.toFixed(3);
      midForm.style.transform = "translateY(" + ((1 - fin) * 14).toFixed(1) + "px)";
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
