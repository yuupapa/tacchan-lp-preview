/* v27: intro and mid-CTA no longer scroll as document blocks — both are viewport-fixed canvas content with the SAME gather/hold/dissolve motion as the telops. Intro text is anchored to the lower viewport with the photo soft-fading beside it on the canvas; beat 2's scroll progress drives assembleAmount only, so it dissolves before scene 3 and never rides a strip past the eye. The mid 「ここから。」 label is particle text anchored above the form; the UTAGE form fades in viewport-fixed (.settled) once the label assembles — keyboard focus forces it visible — and its top is pinned to the locked vh so it cannot drift from the canvas when the iOS URL bar shows/hides. v26 sampling fidelity is kept: computed styles (SANS intro text / SERIF mid label), shared tokenize/paintRuns, per-block fallback classes (particles-intro / particles-mid), per-message maxAlpha/shadowBlur, and the photo's soft-fade curve. v26: the たっちゃん intro text and the mid-CTA label 「ここから。」 run through the SAME canvas glyph-particle pipeline as the telops (gather → hold → dissolve, same curves/sprites); the intro photo soft-fades in sync with the text assembly; per-message body classes keep the DOM text as fallback whenever a block fails to sample. v25: intro strip visibility tied to beat 2 (observer root = lower ~40% of the viewport); scene-2 telop lift raised to 16% vh on phones. v24: scene-2 telop lifted ~12% vh; intro strip fade-in. v23: background activation reads every [data-scene] section. v21: desktop telop size bumped. v20: luminous light-mote particles + solid text crossfade; fit-to-width shrink; text anchor locked to a stable viewport center (no rebuild/jump when the iOS URL bar shows/hides) */
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Intro strip reveal — fallback for the no-particle path (v25 semantics):
  // the observer root is shrunk to the lower ~40% of the viewport, so the
  // strip only counts as "visible" while it sits low on screen — i.e. while
  // beat 2 is the active scene — and fades out before the scene-3 campfire
  // bg takes over. Armed synchronously before first paint; without JS the
  // strip simply stays visible (no body.intro-js class is added). Under
  // body.particles-intro the whole strip is hidden and the canvas draws both
  // text and photo, so this fade never fights the particle loop.
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

  // v26: read the real computed style so the sampled glyphs match the CSS
  // exactly, even if the stylesheet values change later.
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

  // v26 shared DOM walker: builds lines of styled runs ({text, em, bold}) from
  // an element's child nodes. <br> starts a new line (desktop hides .sp
  // breaks); whitespace-only lines are dropped.
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
        progressEl: sec,
        lines: lines,
        particles: [],
        useEm: sceneNum === 5,
        lift: lift,
        fontFamily: SERIF,
        fsFn: function () { return fontSizePx(); },
        trackFn: function () { return trackingEm(); },
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

  // たっちゃん intro: v26 sampling fidelity (computed SANS styles straight
  // from .intro-text, left-aligned lines) + v27 viewport-fixed anchoring: the
  // text column and photo form one group pinned to the lower viewport, and
  // beat 2's section rect drives assembleAmount exactly like the scene-2
  // telop above it — the block never scrolls.
  function parseIntroMessage() {
    var sec = document.querySelector('section.beat[data-scene="2"]');
    var strip = document.querySelector(".intro");
    var textEl = strip ? strip.querySelector(".intro-text") : null;
    if (!sec || !strip || !textEl) return null;
    var desktop = isDesktop();
    var lines = [];
    for (var i = 0; i < textEl.children.length; i++) {
      var p = textEl.children[i];
      var sub = tokenize(p, desktop, false, p.classList && p.classList.contains("intro-name"));
      for (var j = 0; j < sub.length; j++) lines.push(sub[j]);
    }
    if (!lines.length) return null;
    return {
      progressEl: sec,
      lines: lines,
      particles: [],
      useEm: false,
      lift: 0,
      introPhoto: true,
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

  // Mid-CTA label 「ここから。」: v26 sampling fidelity (computed SERIF styles
  // from the label) + v27 viewport-fixed anchoring just above the fixed form;
  // the mid-cta section's scroll progress drives it like a telop beat.
  function parseMidMessage() {
    var sec = document.querySelector("section.mid-cta");
    var label = sec ? sec.querySelector(".mid-cta-label") : null;
    if (!sec || !label) return null;
    var text = label.textContent.replace(/\s+/g, "");
    if (!text) return null;
    return {
      progressEl: sec,
      lines: [[{ text: text, em: false, bold: false }]],
      particles: [],
      useEm: false,
      lift: 0,
      midLabel: true,
      fontFamily: SERIF,
      fsFn: function () { return computedFs(label, 16); },
      trackFn: function (fs) { return computedTrackEm(label, fs, 0.18); },
      lineHFn: function () { return 2; },
      align: "center",
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

  // v27: the mid form is viewport-fixed while its beat is active, and the
  // intro photo is drawn on the canvas (soft fade) — both anchored to the
  // locked vw/vh so nothing drifts between rebuilds.
  var midInnerEl = document.querySelector(".mid-cta-inner");
  var midInnerTopPx = "";
  var introImg = new Image();
  var introImgReady = false;
  introImg.onload = function () { introImgReady = true; };
  introImg.src = "intro-tacchan.jpg?v=27";

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
  var introMsg = null;
  var midMsg = null;
  var dpr = 1;
  var vw = 1;
  var vh = 1;
  var ready = false;
  var rebuildTimer = 0;

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

  // v26: shared run painter — used for both the sampling probe and the solid
  // crossfade canvas so particle homes and solid glyphs coincide exactly.
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
    var phone = vw < 769;
    var fs = msg.fsFn(phone);
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

    // v27 anchors: every message is pinned to the locked viewport — telops
    // centered (scene 2 lifted), the intro group low, the mid label just
    // above the fixed form. Scroll only drives assembleAmount; nothing here
    // reads a live DOM rect.
    var ox, oy;
    if (msg.introPhoto) {
      // Intro block: circular photo + text grouped as one, anchored to the
      // lower viewport (bottom 7% phones / 10% desktop) — where the old DOM
      // strip sat when beat 2 was centered, but never scrolling.
      var pd = phone ? 48 : 67;
      var pgap = phone ? 11 : 18;
      var gx = (vw - (pd + pgap + w)) / 2;
      var blockH = Math.max(pd, h);
      var btop = vh - vh * (phone ? 0.07 : 0.10) - blockH;
      ox = gx + pd + pgap;
      oy = btop + (blockH - h) / 2;
      msg.photo = { x: gx, cy: btop + blockH / 2, d: pd };
    } else if (msg.midLabel) {
      // 「ここから。」 sits just above the viewport-fixed mid form.
      ox = (vw - w) / 2;
      var formH = midInnerEl ? midInnerEl.offsetHeight : 170;
      oy = vh / 2 - formH / 2 - 24 - fs * 0.5 - h / 2;
    } else {
      ox = (vw - w) / 2;
      oy = (vh - h) / 2 - (msg.lift ? vh * msg.lift : 0);
    }
    var spread = Math.min(vw, vh);
    var particles = [];
    for (var p = 0; p < candidates.length; p++) {
      var c = candidates[p];
      particles.push(makeParticle(ox + c.lx, oy + c.ly, c.a, c.em, spread));
    }
    if (msg.topUp) {
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
    }
    msg.particles = particles;
    msg.metrics = { w: w, h: h, fs: fs, count: particles.length, ox: ox, oy: oy };

    var solid = document.createElement("canvas");
    solid.width = probe.width;
    solid.height = probe.height;
    var sctx = solid.getContext("2d");
    sctx.setTransform(localDpr, 0, 0, localDpr, 0, 0);
    sctx.shadowColor = "rgba(0,0,0,0.85)";
    sctx.shadowBlur = msg.shadowBlur;
    // no Y offset: the solid phase must land exactly on the particle home
    // positions, otherwise the text appears to settle downward at crossfade
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
    introMsg = parseIntroMessage();
    if (introMsg) messages.push(introMsg);
    midMsg = parseMidMessage();
    if (midMsg) messages.push(midMsg);
    for (var i = 0; i < messages.length; i++) sampleMessage(messages[i]);
    ready = messages.some(function (m) { return m.particles.length > 80; });
    document.body.classList.toggle("particles-ready", ready);
    // v26 per-block fallbacks: only hide the DOM text of blocks that actually
    // produced particles, so a failed sample never blanks real copy.
    document.body.classList.toggle("particles-intro", !!(introMsg && introMsg.particles.length > 120));
    document.body.classList.toggle("particles-mid", !!(midMsg && midMsg.particles.length > 60));
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
    var midT = 0;
    var midFade = 0;
    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      if (!msg.particles.length) continue;
      var rec = msg.progressEl.getBoundingClientRect();
      var n = (rec.top + rec.height * 0.5) / vh;
      var fade = cloudFade(n);
      var t = assembleAmount(n);
      if (msg.midLabel) { midT = t; midFade = fade; }
      if (fade < 0.02) continue;
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
          ctx.globalAlpha = (0.30 + 0.58 * local) * p.a * p.shade * fade * pFade * msg.maxAlpha;
          ctx.drawImage(p.em ? emSprite : spriteLight, xy.x - size * 0.5, xy.y - size * 0.5, size, size);
        }
        ctx.globalCompositeOperation = "source-over";
      }

      var solidAlpha = solidTextAlpha(t) * fade * msg.maxAlpha;
      if (solidAlpha > 0.01 && msg.solidCanvas) {
        ctx.globalAlpha = solidAlpha;
        ctx.drawImage(msg.solidCanvas, msg.metrics.ox, msg.metrics.oy, msg.solidW, msg.solidH);
      }

      // Intro photo: v26's soft-fade curve (appears as the glyphs finish
      // gathering, leaves with the first half of the dissolve), drawn on the
      // canvas as a circular crop with the same border/shadow as the DOM strip.
      if (msg.introPhoto && msg.photo && introImgReady) {
        var pa = clamp((t - 0.45) / 0.35, 0, 1) * fade;
        if (pa > 0.01) {
          var ph = msg.photo;
          var pr = ph.d / 2;
          var pcx = ph.x + pr;
          var pcy = ph.cy;
          var iw = introImg.naturalWidth || 1;
          var ih = introImg.naturalHeight || 1;
          var ss = Math.min(iw, ih);
          ctx.save();
          ctx.globalAlpha = pa;
          ctx.beginPath();
          ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
          ctx.fillStyle = "#0a0a0a";
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = 22;
          ctx.shadowOffsetY = 6;
          ctx.fill();
          ctx.shadowColor = "rgba(0,0,0,0)";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.clip();
          ctx.drawImage(introImg, (iw - ss) / 2, (ih - ss) / 2, ss, ss, pcx - pr, pcy - pr, ph.d, ph.d);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = pa;
          ctx.beginPath();
          ctx.arc(pcx, pcy, pr - 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.28)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.globalAlpha = 1;
    }

    // Mid-CTA form (v27): fades in viewport-fixed once the label has
    // assembled, back out as the beat dissolves. v26 kept: keyboard focus
    // forces it visible so the input can never fade out while typing — but
    // only while the mid beat is still on screen, so a stale focused form
    // never hovers over later scenes. top is pinned to the locked vh so it
    // cannot drift from the canvas label when the mobile URL bar shows/hides
    // between rebuilds.
    if (midInnerEl) {
      var settle = midT > 0.88 && midFade > 0.4;
      if (midFade > 0.02 && midInnerEl.contains(document.activeElement)) settle = true;
      midInnerEl.classList.toggle("settled", settle);
      var midTop = Math.round(vh / 2) + "px";
      if (midInnerTopPx !== midTop) {
        midInnerEl.style.top = midTop;
        midInnerTopPx = midTop;
      }
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
