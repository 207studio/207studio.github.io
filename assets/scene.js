/* 207 Studio clay scene engine.
   A small hand-built renderer: smooth clay meshes, soft contact shadows, and a
   gentle idle float. It wakes after the poster and pauses off-screen. */

(function () {
  "use strict";

  var reduceMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

  function initScene() {
    var canvas = document.getElementById("clay-scene");
    if (!canvas) return;
    var stage = canvas.closest("[data-scene]");

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var TAU = Math.PI * 2;
    var CAMERA_Z = 760;
    var FOCAL = 760;
    var reduced = reduceMedia.matches;
    var isKo = document.documentElement.lang === "ko";
    var hint = document.querySelector("[data-scene-hint]");
    var W = 0;
    var H = 0;
    var dpr = 1;
    var unit = 1;
    var elapsed = 1.2;
    var lastTime = 0;
    var raf = 0;
    var running = false;
    var inView = true;
    var drag = null;
    var pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false, mouse: false };
    var light = normalize([-0.4, 0.72, 0.6]);
    var detail = Math.min(window.innerWidth, window.innerHeight) < 760 ? 0.7 : 1;

    if (reduced && hint) {
      hint.textContent = isKo ? "정적 장면 · 모션 줄임" : "Static scene · reduced motion";
    }

    /* --- mesh helpers --- */

    function part(vertices, faces, color, center, options) {
      var o = options || {};
      return {
        vertices: vertices,
        faces: faces,
        color: color,
        center: center || [0, 0, 0],
        gloss: o.gloss || 0,
        bias: o.bias || 0
      };
    }

    function addOffset(vertices, offset) {
      if (!offset) return vertices;
      return vertices.map(function (v) {
        return [v[0] + offset[0], v[1] + offset[1], v[2] + offset[2]];
      });
    }

    function box(w, h, d, color, offset, options) {
      var x = w / 2;
      var y = h / 2;
      var z = d / 2;
      var o = offset || [0, 0, 0];
      var v = addOffset([
        [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
        [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]
      ], o);
      var f = [
        [4, 5, 6, 7],
        [1, 0, 3, 2],
        [5, 1, 2, 6],
        [0, 4, 7, 3],
        [7, 6, 2, 3],
        [0, 1, 5, 4]
      ];
      return part(v, f, color, o, options);
    }

    function cylinder(r, h, segments, color, offset, options) {
      var o = offset || [0, 0, 0];
      var v = [];
      var i;
      var a;
      for (i = 0; i < segments; i++) {
        a = (TAU * i) / segments;
        v.push([r * Math.cos(a), -h / 2, r * Math.sin(a)]);
      }
      for (i = 0; i < segments; i++) {
        a = (TAU * i) / segments;
        v.push([r * Math.cos(a), h / 2, r * Math.sin(a)]);
      }
      var bottomCenter = v.length;
      v.push([0, -h / 2, 0]);
      var topCenter = v.length;
      v.push([0, h / 2, 0]);
      v = addOffset(v, o);

      var faces = [];
      for (i = 0; i < segments; i++) {
        var n = (i + 1) % segments;
        faces.push([i, n, segments + n, segments + i]);
        faces.push([topCenter, segments + i, segments + n]);
        faces.push([bottomCenter, n, i]);
      }
      return part(v, faces, color, o, options);
    }

    function cone(r, h, segments, color, offset, phase, options) {
      var o = offset || [0, 0, 0];
      var p = phase || 0;
      var v = [];
      var i;
      for (i = 0; i < segments; i++) {
        var a = p + (TAU * i) / segments;
        v.push([r * Math.cos(a), -h / 2, r * Math.sin(a)]);
      }
      var apex = v.length;
      v.push([0, h / 2, 0]);
      var bottomCenter = v.length;
      v.push([0, -h / 2, 0]);
      v = addOffset(v, o);

      var faces = [];
      for (i = 0; i < segments; i++) {
        var n = (i + 1) % segments;
        faces.push([i, n, apex]);
        if (!(options && options.open)) faces.push([bottomCenter, n, i]);
      }
      return part(v, faces, color, o, options);
    }

    function sphere(r, rings, segments, color, filter, offset, scale, options) {
      var o = offset || [0, 0, 0];
      var s = scale || [1, 1, 1];
      var v = [];
      var i;
      var j;

      for (i = 0; i <= rings; i++) {
        var phi = (Math.PI * i) / rings;
        for (j = 0; j < segments; j++) {
          var theta = (TAU * j) / segments;
          v.push([
            r * Math.sin(phi) * Math.cos(theta) * s[0] + o[0],
            r * Math.cos(phi) * s[1] + o[1],
            r * Math.sin(phi) * Math.sin(theta) * s[2] + o[2]
          ]);
        }
      }

      var faces = [];
      for (i = 0; i < rings; i++) {
        for (j = 0; j < segments; j++) {
          var nj = (j + 1) % segments;
          var a = i * segments + j;
          var b = i * segments + nj;
          var c = (i + 1) * segments + j;
          var d = (i + 1) * segments + nj;

          var ab = sub(v[b], v[a]);
          var ac = sub(v[c], v[a]);
          if (length(cross(ab, ac)) < 0.000001) continue;

          if (filter) {
            var mx = (v[a][0] + v[b][0] + v[c][0] + v[d][0]) / 4 - o[0];
            var my = (v[a][1] + v[b][1] + v[c][1] + v[d][1]) / 4 - o[1];
            var mz = (v[a][2] + v[b][2] + v[c][2] + v[d][2]) / 4 - o[2];
            if (!filter(mx, my, mz)) continue;
          }

          faces.push([a, c, d, b]);
        }
      }

      return part(v, faces, color, o, options);
    }

    function star(rOuter, rInner, depth, points, color, options) {
      var v = [];
      var i;
      var a;
      var half = depth / 2;

      for (i = 0; i < points * 2; i++) {
        a = -Math.PI / 2 + (i * Math.PI) / points;
        var rr = i % 2 === 0 ? rOuter : rInner;
        v.push([Math.cos(a) * rr, Math.sin(a) * rr, half]);
      }
      for (i = 0; i < points * 2; i++) {
        a = -Math.PI / 2 + (i * Math.PI) / points;
        var rb = i % 2 === 0 ? rOuter : rInner;
        v.push([Math.cos(a) * rb, Math.sin(a) * rb, -half]);
      }
      var frontCenter = v.length;
      v.push([0, 0, half]);
      var backCenter = v.length;
      v.push([0, 0, -half]);

      var faces = [];
      var total = points * 2;
      for (i = 0; i < total; i++) {
        var n = (i + 1) % total;
        faces.push([frontCenter, i, n]);
        faces.push([backCenter, total + n, total + i]);
        faces.push([i, total + i, total + n, n]);
      }
      return part(v, faces, color, [0, 0, 0], options);
    }

    /* --- the other pieces --- */

    function consoleParts() {
      return [
        box(1.56, 0.3, 0.96, "#a9c3cb", null, { gloss: 0.35 }),
        box(0.92, 0.03, 0.54, "#354d43", [0, 0.17, 0], { gloss: 0.45, bias: 2 }),
        box(0.22, 0.035, 0.22, "#e4bb63", [-0.55, 0.18, -0.02], { gloss: 0.3, bias: 2 }),
        cylinder(0.075, 0.04, 12, "#c78365", [0.55, 0.18, -0.13], { gloss: 0.35, bias: 2 }),
        cylinder(0.075, 0.04, 12, "#ddafa8", [0.55, 0.18, 0.08], { gloss: 0.35, bias: 2 })
      ];
    }

    function pencilParts() {
      return [
        cylinder(0.135, 1.45, 12, "#e4bb63", null, { gloss: 0.35 }),
        cone(0.135, 0.35, 12, "#c78365", [0, 0.9, 0], 0, { gloss: 0.25 }),
        cone(0.045, 0.13, 10, "#2a2520", [0, 1.0, 0], 0, { gloss: 0.3 }),
        cylinder(0.14, 0.12, 12, "#6d665b", [0, -0.79, 0], { gloss: 0.25 }),
        cylinder(0.13, 0.14, 12, "#ddafa8", [0, -0.92, 0], { gloss: 0.3 })
      ];
    }

    function houseParts() {
      return [
        box(1.02, 0.8, 0.6, "#efe3cc", [0, -0.1, 0], { gloss: 0.12 }),
        cone(0.66, 0.46, 4, "#c78365", [0, 0.53, 0], Math.PI / 4, { gloss: 0.2, open: true }),
        box(0.24, 0.4, 0.06, "#4d6457", [0, -0.28, 0.45], { gloss: 0.2 }),
        box(0.17, 0.17, 0.05, "#e4bb63", [0.27, 0.02, 0.45], { gloss: 0.2 }),
        cylinder(0.085, 0.3, 10, "#c78365", [0.28, 0.62, -0.13], { gloss: 0.2 })
      ];
    }

    function makeObject(name, key, parts, options) {
      var o = {
        name: name,
        key: key,
        parts: parts,
        x: 0,
        y: 0,
        z: 0,
        scale: 50,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        baseRotX: 0,
        baseRotY: 0,
        baseRotZ: 0,
        spin: 0.1,
        sway: 0,
        bob: 4,
        phase: 0,
        vx: 0,
        vy: 0,
        dy: 0,
        hitRadius: 1
      };
      Object.keys(options || {}).forEach(function (keyName) {
        o[keyName] = options[keyName];
      });
      o.baseRotX = o.rotX;
      o.baseRotY = o.rotY;
      o.baseRotZ = o.rotZ;
      o.hx = o.x;
      o.hy = o.y;
      return o;
    }

    var objects = [
      makeObject("console", "console", consoleParts(), {
        x: 0, y: 0, z: -5, scale: 62, rotX: 0.86, rotY: 0.38, rotZ: -0.08,
        spin: 0.06, bob: 4, phase: 2.1, hitRadius: 62
      }),
      makeObject("pencil", "pencil", pencilParts(), {
        x: 0, y: 0, z: -20, scale: 56, rotX: 0.10, rotY: 0.30, rotZ: -0.98,
        spin: -0.05, bob: 3, phase: 4.2, hitRadius: 72
      }),
      makeObject("star", "star", [star(1, 0.45, 0.32, 5, "#e8c66f", { gloss: 0.55 })], {
        x: 0, y: 0, z: 40, scale: 40, rotX: 0.14, rotY: 0.45, rotZ: -0.06,
        spin: 0.1, bob: 5, phase: 1.1, hitRadius: 46
      }),
      makeObject("house", "house", houseParts(), {
        x: 0, y: 0, z: -40, scale: 50, rotX: 0.05, rotY: -0.22, rotZ: 0.02,
        spin: 0.04, bob: 3, phase: 3.4, hitRadius: 50
      }),
      makeObject("bead", "beadPink", [sphere(0.35, 18, 14, "#ddafa8", null, null, [1, 1, 1], { gloss: 0.7 })], {
        x: 0, y: 0, z: 60, scale: 30, rotX: 0.2, rotY: 0.2, spin: 0.14, bob: 6, phase: 5.5, hitRadius: 26
      }),
      makeObject("bead", "beadSage", [sphere(0.35, 18, 14, "#a8bda0", null, null, [1, 1, 1], { gloss: 0.55 })], {
        x: 0, y: 0, z: 70, scale: 34, rotX: 0.1, rotY: -0.3, spin: 0.12, bob: 5, phase: 2.8, hitRadius: 28
      })
    ];

    /* --- composition --- */

    var WIDE = {
      console: { fx: 0.93, fy: 0.75, z: -5, scale: 62 },
      pencil: { fx: 0.665, fy: 0.835, z: -20, scale: 56 },
      star: { fx: 0.675, fy: 0.125, z: 40, scale: 40 },
      house: { fx: 0.87, fy: 0.205, z: -40, scale: 50 },
      beadPink: { fx: 0.945, fy: 0.49, z: 60, scale: 34 },
      beadSage: { fx: 0.475, fy: 0.735, z: 70, scale: 38 }
    };

    var MEDIUM = {
      console: { fx: 0.84, fy: 0.7, z: -5, scale: 50 },
      pencil: { fx: 0.66, fy: 0.84, z: -20, scale: 48 },
      star: { fx: 0.84, fy: 0.12, z: 40, scale: 34 },
      house: { fx: 0.92, fy: 0.23, z: -40, scale: 40 },
      beadPink: { fx: 0.965, fy: 0.48, z: 60, scale: 28 },
      beadSage: { fx: 0.44, fy: 0.76, z: 70, scale: 30 }
    };

    var TALL = {
      console: { fx: 0.16, fy: 0.56, z: -5, scale: 50 },
      pencil: { fx: 0.42, fy: 0.62, z: -20, scale: 44 },
      star: { fx: 0.47, fy: 0.33, z: 40, scale: 30 },
      house: { fx: 0.13, fy: 0.33, z: -40, scale: 39 },
      beadPink: { fx: 0.6, fy: 0.5, z: 60, scale: 26 },
      beadSage: { fx: 0.06, fy: 0.45, z: 70, scale: 30 }
    };

    function applyLayout() {
      var layout = W > 1100 ? WIDE : W > 700 ? MEDIUM : TALL;
      objects.forEach(function (o) {
        var c = layout[o.key];
        if (!c) return;
        var persp = FOCAL / (CAMERA_Z + c.z);
        o.z = c.z;
        o.scale = c.scale;
        o.hx = (c.fx * W - W / 2) / (unit * persp);
        o.hy = (H / 2 - c.fy * H) / (unit * persp);
        o.x = o.hx;
        o.y = o.hy;
        o.vx = 0;
        o.vy = 0;
        o.dy = 0;
        o.hitRadius = Math.max(c.scale * 0.9, o.hitRadius * 0.6);
      });
    }

    /* --- vector maths --- */

    function sub(a, b) {
      return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }

    function cross(a, b) {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
    }

    function dot(a, b) {
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    function length(v) {
      return Math.sqrt(dot(v, v));
    }

    function normalize(v) {
      var l = length(v) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    }

    function cameraPoint(v) {
      var s = FOCAL / Math.max(1, CAMERA_Z + v[2]);
      return [W / 2 + v[0] * unit * s, H / 2 - v[1] * unit * s];
    }

    function transformPoint(v, o) {
      var x = v[0] * o.scale;
      var y = v[1] * o.scale;
      var z = v[2] * o.scale;
      var c;
      var s;

      c = Math.cos(o.rotZ);
      s = Math.sin(o.rotZ);
      var x1 = x * c - y * s;
      var y1 = x * s + y * c;

      c = Math.cos(o.rotX);
      s = Math.sin(o.rotX);
      var y2 = y1 * c - z * s;
      var z2 = y1 * s + z * c;

      c = Math.cos(o.rotY);
      s = Math.sin(o.rotY);
      var x3 = x1 * c + z2 * s;
      var z3 = -x1 * s + z2 * c;

      return [x3 + o.x, y2 + o.y + o.dy, z3 + o.z];
    }

    /* --- colour --- */

    var rgbCache = {};

    function hexToRgb(hex) {
      if (rgbCache[hex]) return rgbCache[hex];
      var h = hex.replace("#", "");
      if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      }
      var n = parseInt(h, 16);
      var rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache[hex] = rgb;
      return rgb;
    }

    function shadeColor(hex, n, view, gloss) {
      var c = hexToRgb(hex);
      var lambert = Math.max(0, dot(n, light));
      var k = 0.54 + 0.62 * lambert;
      var half = normalize([light[0] + view[0], light[1] + view[1], light[2] + view[2]]);
      var spec = Math.pow(Math.max(0, dot(n, half)), 18) * gloss * 255;
      var rim = Math.pow(1 - Math.max(0, dot(n, view)), 3) * 10;

      return (
        "rgb(" +
        Math.min(255, Math.round(c[0] * k + 18 + spec * 0.98 + rim)) + "," +
        Math.min(255, Math.round(c[1] * k + 15 + spec * 0.94 + rim * 0.92)) + "," +
        Math.min(255, Math.round(c[2] * k + 10 + spec * 0.86 + rim * 0.78)) +
        ")"
      );
    }

    /* --- render --- */

    function drawShadow(o) {
      var drop = o.scale * 0.64;
      var p = cameraPoint([o.x + 6, o.y + o.dy - drop, o.z]);
      var s = FOCAL / Math.max(1, CAMERA_Z + o.z);
      var r = Math.max(10, o.scale * 0.64 * unit * s);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.scale(1, 0.3);
      var strength = 1;
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, "rgba(45, 36, 26, " + (0.17 * strength) + ")");
      g.addColorStop(0.55, "rgba(45, 36, 26, " + (0.07 * strength) + ")");
      g.addColorStop(1, "rgba(45, 36, 26, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function render() {
      ctx.clearRect(0, 0, W, H);

      objects.forEach(drawShadow);

      var all = [];

      objects.forEach(function (o) {
        o._sx = cameraPoint([o.x, o.y + o.dy, o.z])[0];
        o._sy = cameraPoint([o.x, o.y + o.dy, o.z])[1];

        o.parts.forEach(function (piece) {
          var world = piece.vertices.map(function (v) {
            return transformPoint(v, o);
          });
          var pieceCenter = transformPoint(piece.center, o);

          piece.faces.forEach(function (indexes) {
            var a = world[indexes[0]];
            var b = world[indexes[1]];
            var c = world[indexes[2]];
            var n = normalize(cross(sub(b, a), sub(c, a)));
            if (length(n) === 0) return;

            var center = [0, 0, 0];
            indexes.forEach(function (idx) {
              center[0] += world[idx][0] / indexes.length;
              center[1] += world[idx][1] / indexes.length;
              center[2] += world[idx][2] / indexes.length;
            });

            if (dot(n, sub(center, pieceCenter)) < 0) {
              n = [-n[0], -n[1], -n[2]];
            }

            var view = normalize([-center[0], -center[1], CAMERA_Z - center[2]]);
            if (dot(n, view) <= 0.002) return;

            var points = [];
            for (var i = 0; i < indexes.length; i++) {
              points.push(cameraPoint(world[indexes[i]]));
            }

            all.push({
              z: center[2] + piece.bias,
              points: points,
              fill: shadeColor(piece.color, n, view, piece.gloss)
            });
          });
        });
      });

      all.sort(function (a, b) {
        return a.z - b.z;
      });

      for (var i = 0; i < all.length; i++) {
        var face = all[i];
        var points = face.points;
        if (points.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (var j = 1; j < points.length; j++) {
          ctx.lineTo(points[j][0], points[j][1]);
        }
        ctx.closePath();
        ctx.fillStyle = face.fill;
        ctx.fill();
        ctx.strokeStyle = face.fill;
        ctx.lineWidth = 0.55;
        ctx.stroke();
      }

    }

    /* --- physics --- */

    function clampObject(o) {
      var bx = W / (2 * unit) - 20;
      var by = H / (2 * unit) - 20;
      if (o.x > bx) {
        o.x = bx;
        o.vx *= -0.35;
      } else if (o.x < -bx) {
        o.x = -bx;
        o.vx *= -0.35;
      }
      if (o.y > by) {
        o.y = by;
        o.vy *= -0.35;
      } else if (o.y < -by) {
        o.y = -by;
        o.vy *= -0.35;
      }
    }

    function step(dt) {
      if (pointer.inside && pointer.mouse && !drag) {
        objects.forEach(function (o) {
          var dx = o.x - pointer.x;
          var dy = o.y - pointer.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var reach = 88;
          if (d > 0.001 && d < reach) {
            var force = (1 - d / reach) * 420 * dt;
            o.vx += (dx / d) * force;
            o.vy += (dy / d) * force;
          }
        });
      }

      objects.forEach(function (o) {
        if (!drag || drag.obj !== o) {
          o.vx += (o.hx - o.x) * 30 * dt;
          o.vy += (o.hy - o.y) * 30 * dt;
          var damp = Math.exp(-6.4 * dt);
          o.vx *= damp;
          o.vy *= damp;
          o.vx = Math.max(-520, Math.min(520, o.vx));
          o.vy = Math.max(-520, Math.min(520, o.vy));
          o.x += o.vx * dt;
          o.y += o.vy * dt;
          clampObject(o);
        }

        if (drag && drag.obj === o) {
          o.dy = 0;
        } else {
          o.dy = Math.sin(elapsed * 1.05 + o.phase) * o.bob;
        }

        if (o.sway) {
          o.rotY = o.baseRotY + Math.sin(elapsed * 0.5 + o.phase) * o.sway;
        } else {
          o.rotY += o.spin * dt;
        }
        o.rotX = o.baseRotX + Math.sin(elapsed * 0.62 + o.phase) * 0.035;
        o.rotZ = o.baseRotZ + Math.cos(elapsed * 0.55 + o.phase) * 0.018;
      });
    }

    /* --- pointer interaction --- */

    function pointerPosition(event) {
      var rect = canvas.getBoundingClientRect();
      var sx = ((event.clientX - rect.left) / rect.width) * W;
      var sy = ((event.clientY - rect.top) / rect.height) * H;
      return {
        sx: sx,
        sy: sy,
        x: (sx - W / 2) / unit,
        y: (H / 2 - sy) / unit
      };
    }

    function objectAt(sx, sy) {
      var best = null;
      var bestDistance = Infinity;
      objects.forEach(function (o) {
        var dx = o._sx - sx;
        var dy = o._sy - sy;
        var d = Math.sqrt(dx * dx + dy * dy);
        var r = Math.max(30, o.hitRadius * unit);
        if (d < r && d < bestDistance) {
          bestDistance = d;
          best = o;
        }
      });
      return best;
    }

    function resetObject(o) {
      o.x = o.hx;
      o.y = o.hy;
      o.vx = 0;
      o.vy = 0;
      o.dy = 0;
      o.rotX = o.baseRotX;
      o.rotY = o.baseRotY;
      o.rotZ = o.baseRotZ;
    }

    function isInteractive(target) {
      return Boolean(target && target.closest && target.closest("a, button, input, textarea, select, label"));
    }

    function onPointerDown(event) {
      if (reduced || isInteractive(event.target)) return;
      var p = pointerPosition(event);
      var hit = objectAt(p.sx, p.sy);

      if (hit) {
        drag = { obj: hit, id: event.pointerId, dx: hit.x - p.x, dy: hit.y - p.y, sx: p.sx, sy: p.sy };
        stage.classList.add("is-dragging");
        try {
          stage.setPointerCapture(event.pointerId);
        } catch (err) {}
      } else {
        objects.forEach(function (o) {
          var dx = o.x - p.x;
          var dy = o.y - p.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > 0.001 && d < 190) {
            var strength = (1 - d / 190) * 240;
            o.vx += (dx / d) * strength;
            o.vy += (dy / d) * strength;
          }
        });
      }

      start();
    }

    function onPointerMove(event) {
      if (reduced) return;
      var p = pointerPosition(event);
      pointer.sx = p.sx;
      pointer.sy = p.sy;
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.inside = true;
      pointer.mouse = event.pointerType !== "touch";

      if (drag && drag.id === event.pointerId) {
        var nx = p.x + drag.dx;
        var ny = p.y + drag.dy;
        drag.obj.vx = Math.max(-480, Math.min(480, (nx - drag.obj.x) * 14));
        drag.obj.vy = Math.max(-480, Math.min(480, (ny - drag.obj.y) * 14));
        drag.obj.x = nx;
        drag.obj.y = ny;
        clampObject(drag.obj);
        start();
      }
    }

    function endDrag(event) {
      if (!drag) return;
      if (event && event.pointerId !== drag.id) return;
      stage.classList.remove("is-dragging");
      try {
        stage.releasePointerCapture(drag.id);
      } catch (err) {}
      drag = null;
    }

    function onPointerUp(event) {
      endDrag(event);
    }

    function onPointerLeave() {
      pointer.inside = false;
    }

    function onPointerCancel(event) {
      pointer.inside = false;
      endDrag(event);
    }

    function onDoubleClick(event) {
      if (isInteractive(event.target)) return;
      objects.forEach(resetObject);
      render();
    }

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove, { passive: true });
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerCancel);
    stage.addEventListener("pointerleave", onPointerLeave);
    stage.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("blur", function () {
      endDrag();
    });

    /* --- sizing and loop --- */

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1 : 1.35);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      unit = Math.min(W, H) / 500;
      applyLayout();
      if (reduced || !running) render();
    }

    var lastRender = 0;
    var frameInterval = 33;

    function frame(now) {
      if (!running) return;
      raf = window.requestAnimationFrame(frame);
      if (now - lastRender < frameInterval) return;
      if (!lastTime) lastTime = now;
      var dt = Math.min(0.05, (now - lastTime) / 1000);
      if (!dt || dt < 0) dt = 0.016;
      lastTime = now;
      lastRender = now;
      elapsed += dt;
      step(dt);
      render();
    }

    function start() {
      if (reduced || running || !inView || document.hidden) return;
      running = true;
      lastTime = 0;
      lastRender = 0;
      frameInterval = W < 700 ? 45 : 33;
      raf = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    if ("ResizeObserver" in window) {
      new ResizeObserver(resize).observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          inView = entries[0].isIntersecting;
          if (inView) start();
          else stop();
        },
        { threshold: 0.05 }
      ).observe(canvas);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    if (reduceMedia.addEventListener) {
      reduceMedia.addEventListener("change", function (event) {
        reduced = event.matches;
        if (hint) {
          hint.textContent = reduced
            ? isKo ? "정적 장면 · 모션 줄임" : "Static scene · reduced motion"
            : isKo ? "끌어서 밀어 보세요 · 놓으면 돌아와요" : "Drag the pieces · they settle back";
        }
        if (reduced) {
          stop();
          objects.forEach(resetObject);
          render();
        } else {
          start();
        }
      });
    }

    resize();
    render();
    start();
    if (stage) stage.classList.add("is-live");
  }

  window.initClayScene = initScene;
})();
