/* Vector Wordmark (vanilla JS port of the Originkit React component)
 *
 * Usage:
 *   <div id="wordmark" style="height:260px"></div>
 *   <script src="js/vector-wordmark.js"></script>
 *   <script>VectorWordmark(document.getElementById("wordmark"), { text: "JOBS" });</script>
 */
(function () {
  "use strict";

  var MAX_DPR = 2, REF_WIDTH = 1200, MAX_TEX = 4096;
  var HANDLES = 3, CELL_ASPECT = 0.6;
  var DRIFT_X = 0.08, DRIFT_Y = 0.04, DRIFT_RATE = 1.3, DRIFT_RATE_Y = 1.3 * 1.3;
  var SWEEP_RATE = 0.5, SWEEP_BAND = 0.28, RESNAP = 0.2;
  var DAMP_REF = 20, SPEED_REF = 50, LABEL_MAX = 0.6;
  var DOT_DIAMETER = 4 / 440, DOT_PITCH = 12 / 440;

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var fract = function (x) { return x - Math.floor(x); };

  function parseColor(input, fallback) {
    if (!input) return fallback;
    var s = String(input).trim();
    if (s[0] === "#") {
      var h = s.slice(1);
      if (h.length === 3 || h.length === 4) {
        var x = "";
        for (var i = 0; i < h.length; i++) x += h[i] + h[i];
        h = x;
      }
      if (h.length === 6) h += "ff";
      if (h.length !== 8 || /[^0-9a-f]/i.test(h)) return fallback;
      return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
        parseInt(h.slice(6, 8), 16) / 255
      ];
    }
    var m = s.match(/^(rgba?)\(([^)]*)\)$/i);
    if (!m) return fallback;
    var parts = m[2].split(/[\s,/]+/).filter(function (p) { return p.length > 0; });
    if (parts.length < 3) return fallback;
    var num = function (t, scale) {
      var v = parseFloat(t);
      if (!isFinite(v)) return 0;
      return t.indexOf("%") >= 0 ? (v / 100) * scale : v;
    };
    return [
      clamp(num(parts[0], 255) / 255, 0, 1),
      clamp(num(parts[1], 255) / 255, 0, 1),
      clamp(num(parts[2], 255) / 255, 0, 1),
      parts.length > 3 ? clamp(num(parts[3], 1), 0, 1) : 1
    ];
  }

  var VERT =
    "attribute vec2 aPos;\nvarying vec2 vUv;\n" +
    "void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";

  var FRAG = [
    "precision highp float;",
    "uniform sampler2D uMap;",
    "uniform vec2 uRes;",
    "uniform vec2 uAtlas;",
    "uniform vec2 uPtr;",
    "uniform float uReach;",
    "uniform vec3 uText;",
    "uniform vec3 uShade;",
    "uniform vec4 uAccent;",
    "uniform vec2 uV0;",
    "uniform vec2 uV1;",
    "uniform vec2 uV2;",
    "uniform float uHalf;",
    "varying vec2 vUv;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }",
    "vec2 blurRG(vec2 uv, float e){",
    "  vec4 sum = vec4(0.0);",
    "  for (int i = 0; i < 6; i++) {",
    "    float fi = float(i);",
    "    float th = radians(fi / 6.0 * 360.0);",
    "    vec2 dir = vec2(cos(th), sin(th));",
    "    vec2 off = dir * (hash(vec2(fi, uv.x + uv.y)) + e);",
    "    sum += texture2D(uMap, uv + off * e);",
    "  }",
    "  return (sum / 6.0).rg;",
    "}",
    "vec2 segment(vec2 p, vec2 a, vec2 b){",
    "  vec2 ab = b - a; vec2 ap = p - a;",
    "  float t = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);",
    "  return vec2(length(ap - ab * t), t);",
    "}",
    "float stroke(float d, float lw, float px){ return 1.0 - smoothstep(lw, lw + px, d); }",
    "float dashedLine(vec2 p, vec2 a, vec2 b, float lw, float px){",
    "  vec2 s = segment(p, a, b);",
    "  float dash = step(0.5, fract(s.y * length(b - a) * 100.0));",
    "  return stroke(s.x, lw, px) * dash;",
    "}",
    "float boxEdge(vec2 p, vec2 c, float h, float lw, float px){",
    "  vec2 q = abs(p - c) - vec2(h);",
    "  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);",
    "  return stroke(abs(d), lw, px);",
    "}",
    "void main(){",
    "  float aspect = uRes.x / uRes.y;",
    "  vec2 E = (vUv * uRes - (uRes - uAtlas) * 0.5) / uAtlas;",
    "  float inside = step(0.0, E.x) * step(E.x, 1.0) * step(0.0, E.y) * step(E.y, 1.0);",
    "  vec2 safeUv = clamp(E, 0.0, 1.0);",
    "  float b = clamp(1.0 - E.y * 3.5, 0.0, 1.0) * 0.008;",
    "  vec2 soft = blurRG(safeUv, b);",
    "  vec2 sharp = blurRG(safeUv, b * 0.1);",
    "  float d = length((vUv - uPtr) / vec2(1.0, aspect));",
    "  float k = 1.0 - pow(smoothstep(0.0, max(uReach, 1e-4), d), 3.0);",
    "  float mask = mix(soft.r, sharp.g, k) * inside;",
    "  vec3 fill = mix(uShade, uText, smoothstep(0.0, 1.0, E.y));",
    "  vec2 P = vec2(vUv.x * aspect, vUv.y);",
    "  float px = 1.0 / uRes.y;",
    "  float lw = px * 0.2;",
    "  float lines = max(max(dashedLine(P, uV0, uV1, lw, px), dashedLine(P, uV1, uV2, lw, px)), dashedLine(P, uV2, uV0, lw, px));",
    "  float boxes = max(max(boxEdge(P, uV0, uHalf, lw, px), boxEdge(P, uV1, uHalf, lw, px)), boxEdge(P, uV2, uHalf, lw, px));",
    "  float A = max(lines, boxes) * uAccent.a * (1.0 - vUv.y);",
    "  vec4 card = vec4(fill * mask, mask);",
    "  vec4 comp = vec4(uAccent.rgb * A, A) + card * (1.0 - A);",
    "  gl_FragColor = comp * pow(clamp(E.y, 0.0, 1.0), 0.7);",
    "}"
  ].join("\n");

  function compile(gl, vs, fs) {
    var make = function (type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
      }
      return sh;
    };
    var p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    return p;
  }

  function fontString(f, px) {
    return f.style + " " + f.weight + " " + px + "px " + f.family;
  }

  function buildAtlas(text, f, drawFontPx, dpr) {
    var probe = document.createElement("canvas").getContext("2d");
    if (!probe) return null;

    var setFont = function (ctx, px) {
      ctx.font = fontString(f, px);
      try {
        if ("letterSpacing" in ctx) ctx.letterSpacing = f.letterSpacing;
      } catch (e) {}
    };
    var measure = function (px) {
      setFont(probe, px);
      var m = probe.measureText(text);
      return {
        w: Math.max(1, m.width),
        asc: m.actualBoundingBoxAscent || px * 0.8,
        desc: m.actualBoundingBoxDescent || px * 0.22
      };
    };

    var fpx = Math.max(8, drawFontPx * dpr);
    var m = measure(fpx);
    var pad = fpx * 0.12;
    var over = Math.max((m.w + pad * 2) / MAX_TEX, (m.asc + m.desc + pad * 2) / MAX_TEX);
    if (over > 1) {
      fpx = Math.max(8, fpx / over);
      m = measure(fpx);
      pad = fpx * 0.12;
    }

    var w = Math.max(1, Math.ceil(m.w + pad * 2));
    var h = Math.max(1, Math.ceil(m.asc + m.desc + pad * 2));
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    setFont(ctx, fpx);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.globalCompositeOperation = "lighter";

    ctx.fillStyle = "#ff0000";
    ctx.fillText(text, pad, pad + m.asc);

    var block = m.asc + m.desc;
    ctx.strokeStyle = "#00ff00";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, block * DOT_DIAMETER);
    ctx.setLineDash([0, Math.max(2, block * DOT_PITCH)]);
    ctx.strokeText(text, pad, pad + m.asc);

    var cssPerPx = drawFontPx / fpx;
    return { canvas: canvas, cssW: w * cssPerPx, cssH: h * cssPerPx };
  }

  var DEFAULTS = {
    text: "VECTOR",
    fontFamily: "Inter",
    fontWeight: 800,
    fontSize: 200,
    fontStyle: "normal",
    letterSpacing: "-0.02em",
    background: "#000000",
    textColor: "#FFFFFF",
    shade: "#FFFFFF",
    accent: "#FFFFFF",
    reach: 290,
    speed: 50,
    damping: 60,
    handleSize: 109,
    handleSpread: 27,
    labels: true
  };

  window.VectorWordmark = function (host, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});

    host.style.position = "relative";
    host.style.overflow = "hidden";
    host.style.background = opts.background;

    var canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.appendChild(canvas);

    var labelEls = [];
    var labelWrap = document.createElement("div");
    host.appendChild(labelWrap);

    function makeLabels() {
      labelWrap.innerHTML = "";
      labelEls = [];
      if (!opts.labels) return;
      var ac = parseColor(opts.accent, [1, 1, 1, 0.4]);
      var color = "rgb(" + Math.round(ac[0] * 255) + "," + Math.round(ac[1] * 255) + "," + Math.round(ac[2] * 255) + ")";
      for (var i = 0; i < HANDLES; i++) {
        var el = document.createElement("div");
        el.style.cssText =
          "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;" +
          "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.08em;" +
          "opacity:" + LABEL_MAX + ";color:" + color;
        labelWrap.appendChild(el);
        labelEls.push(el);
      }
    }
    makeLabels();

    var attrs = {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: "high-performance"
    };
    var gl = canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
    if (!gl) {
      console.warn("VectorWordmark: WebGL not available");
      return { update: function () {}, destroy: function () {} };
    }
    var isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;

    var prog = compile(gl, VERT, FRAG);
    var U = {};
    ["uMap", "uRes", "uAtlas", "uPtr", "uReach", "uText", "uShade", "uAccent", "uV0", "uV1", "uV2", "uHalf"]
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var alive = true;
    var boxW = Math.max(1, host.offsetWidth);
    var boxH = Math.max(1, host.offsetHeight);
    var boxDirty = true;
    var dpr = 1, bufW = 0, bufH = 0;
    var atlasRatioW = 1, atlasRatioH = 1, atlasKey = "";

    function fontSpec() {
      return {
        family: opts.fontFamily + ", system-ui, sans-serif",
        weight: String(opts.fontWeight),
        style: opts.fontStyle === "italic" ? "italic" : "normal",
        letterSpacing: String(opts.letterSpacing)
      };
    }
    function drawFontPx() {
      return Math.max(8, opts.fontSize) * (boxW / REF_WIDTH);
    }

    function resize() {
      boxW = Math.max(1, host.offsetWidth);
      boxH = Math.max(1, host.offsetHeight);
      dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      var w = Math.max(1, Math.round(boxW * dpr));
      var h = Math.max(1, Math.round(boxH * dpr));
      if (w === bufW && h === bufH) return;
      bufW = w; bufH = h;
      canvas.width = w;
      canvas.height = h;
    }

    function rebuildAtlas() {
      var f = fontSpec();
      var px = Math.max(8, drawFontPx());
      var atlas = buildAtlas(opts.text || " ", f, px, dpr);
      if (!atlas) return;
      atlasRatioW = Math.max(1e-4, atlas.cssW / px);
      atlasRatioH = Math.max(1e-4, atlas.cssH / px);

      if (document.fonts) {
        try {
          var probe = fontString(f, 64);
          if (!document.fonts.check(probe)) {
            var again = function () { if (alive) atlasKey = ""; };
            document.fonts.load(probe, opts.text).then(again, again);
          }
        } catch (e) {}
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      var cw = atlas.canvas.width, ch = atlas.canvas.height;
      var pot = (cw & (cw - 1)) === 0 && (ch & (ch - 1)) === 0;
      if (isGL2 || pot) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
    }

    var target = { x: -0.5, y: 0.5 };
    var eased = { x: -0.5, y: 0.5 };
    var cells = [], verts = [];
    for (var i = 0; i < HANDLES; i++) {
      cells.push({ x: -0.5, y: 0.5 });
      verts.push({ x: -0.5, y: 0.5 });
    }
    var hasPointer = false, sweepClock = 0, driftT = 0;

    function snap(x, y, cw, ch) {
      var cx = Math.floor(x / cw), cy = Math.floor(y / ch);
      var found = [];
      for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
          var px = (cx + i + 0.5) * cw, py = (cy + j + 0.5) * ch;
          found.push({ x: px, y: py, d: Math.hypot(px - x, py - y) });
        }
      }
      found.sort(function (a, b) { return a.d - b.d; });
      for (var k = 0; k < HANDLES; k++) {
        cells[k].x = found[k + 1].x;
        cells[k].y = found[k + 1].y;
      }
    }

    function onMove(e) {
      hasPointer = true;
      var r = host.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      target.x = (e.clientX - r.left) / r.width;
      target.y = 1 - (e.clientY - r.top) / r.height;
    }
    host.addEventListener("pointermove", onMove);

    var raf = 0, last = 0, running = true;

    function sync() {
      if (boxDirty) { boxDirty = false; resize(); }
      var f = fontSpec();
      var key = [opts.text, f.family, f.weight, f.style, f.letterSpacing, dpr,
        Math.ceil(drawFontPx() / 64)].join("|");
      if (key !== atlasKey) { atlasKey = key; rebuildAtlas(); }
    }

    function step(dt) {
      var rate = Math.max(0, opts.speed) / SPEED_REF;
      var cw = Math.max(0.01, opts.handleSpread / 100);
      var ch = cw * CELL_ASPECT;
      var aspect = boxW / boxH;

      if (!hasPointer) {
        var band = (atlasRatioH * drawFontPx()) / boxH;
        target.x += dt * SWEEP_RATE * rate;
        target.y = (1 - band) / 2 + SWEEP_BAND * band;
        if (target.x > 1.5) { target.x = -0.5; eased.x = -0.5; }
        sweepClock += dt;
        if (sweepClock >= RESNAP) {
          sweepClock = 0;
          snap(target.x * aspect, target.y, cw, ch);
        }
      } else {
        snap(target.x * aspect, target.y, cw, ch);
      }

      var damp = clamp((opts.damping / 100) * DAMP_REF * dt, 0, 1);
      eased.x += (target.x - eased.x) * damp;
      eased.y += (target.y - eased.y) * damp;

      driftT += dt * rate;
      for (var i = 0; i < HANDLES; i++) {
        var c = cells[i];
        var sx = Math.round(c.x / cw - 0.5);
        var sy = Math.round(c.y / ch - 0.5);
        var h1 = fract(Math.sin(sx * 127.1 + sy * 311.7) * 43758.5453);
        var h2 = fract(Math.sin(sx * 269.5 + sy * 183.3) * 43758.5453);
        verts[i].x = c.x + DRIFT_X * cw * Math.sin(driftT * DRIFT_RATE + h1 * Math.PI * 2);
        verts[i].y = c.y + DRIFT_Y * ch * Math.sin(driftT * DRIFT_RATE_Y + h2 * Math.PI * 2);
      }
    }

    function writeLabels() {
      var aspect = boxW / boxH;
      var half = opts.handleSize / 2;
      for (var i = 0; i < labelEls.length; i++) {
        var el = labelEls[i];
        var bx = verts[i].x / aspect, by = verts[i].y;
        var gx = Math.round(clamp(bx * 100, 0, 100));
        var gy = Math.round(clamp(by * 100, 0, 100));
        el.style.transform = "translate(" + (bx * boxW - half) + "px," + ((1 - by) * boxH - half) + "px)";
        el.textContent = gx + ", " + gy;
      }
    }

    function draw() {
      var tc = parseColor(opts.textColor, [0.859, 0.918, 0.992, 1]);
      var sc = parseColor(opts.shade, [0.035, 0.063, 0.102, 1]);
      var ac = parseColor(opts.accent, [1, 1, 1, 0.4]);

      gl.viewport(0, 0, bufW, bufH);
      gl.useProgram(prog);
      gl.uniform1i(U.uMap, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform2f(U.uRes, boxW, boxH);
      var px = drawFontPx();
      gl.uniform2f(U.uAtlas, atlasRatioW * px, atlasRatioH * px);
      gl.uniform2f(U.uPtr, eased.x, eased.y);
      gl.uniform1f(U.uReach, Math.max(1, opts.reach) / boxW);
      gl.uniform3f(U.uText, tc[0], tc[1], tc[2]);
      gl.uniform3f(U.uShade, sc[0], sc[1], sc[2]);
      gl.uniform4f(U.uAccent, ac[0], ac[1], ac[2], ac[3]);
      gl.uniform2f(U.uV0, verts[0].x, verts[0].y);
      gl.uniform2f(U.uV1, verts[1].x, verts[1].y);
      gl.uniform2f(U.uV2, verts[2].x, verts[2].y);
      gl.uniform1f(U.uHalf, opts.handleSize / 2 / boxH);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function frame(now) {
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      sync();
      step(dt);
      writeLabels();
      draw();
      raf = requestAnimationFrame(frame);
    }

    function gate() {
      if (running && !document.hidden) {
        if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    var ro = new ResizeObserver(function () { boxDirty = true; });
    ro.observe(host);
    document.addEventListener("visibilitychange", gate);

    if (document.fonts) {
      document.fonts.ready.then(function () { if (alive) atlasKey = ""; }, function () {});
    }

    gate();

    return {
      update: function (next) {
        var prevLabels = opts.labels, prevAccent = opts.accent;
        Object.assign(opts, next || {});
        host.style.background = opts.background;
        if (opts.labels !== prevLabels || opts.accent !== prevAccent) makeLabels();
      },
      destroy: function () {
        alive = false;
        running = false;
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        host.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", gate);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        if (labelWrap.parentNode) labelWrap.parentNode.removeChild(labelWrap);
      }
    };
  };
})();
