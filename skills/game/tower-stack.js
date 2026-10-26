/* ═══ SKILL (tool): Tower Stack — a 2-minute break game ═════════════
   A floor slab slides across the top of your tower. Tap (or Space) to
   drop it. The part that hangs over the floor below is cut off, so the
   slabs get smaller. Line it up exactly for a PERFECT (the slab grows
   back a little). How many floors can you build?
   • Crane assists: one per task you finished today (max 3). A crane
     assist lines up the next slab perfectly — press C or the 🏗 button.
   • Best height is kept per user. Sounds follow the 8-bit sounds skill.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var BOX = null, G = null, raf = 0;

  function css(v, d) { var s = getComputedStyle(document.body).getPropertyValue(v).trim(); return s || d; }
  function bestKey() { return 'lt_game_tower_best_' + ((window.LT && LT.user && LT.user()) || 'guest'); }
  function best() { try { return +localStorage.getItem(bestKey()) || 0; } catch (e) { return 0; } }
  function setBest(n) { try { localStorage.setItem(bestKey(), String(n)); } catch (e) { /* private mode */ } }
  function sfx(k) { try { if (window.LT && LT.sfx && LT.sfx[k]) LT.sfx[k](); } catch (e) { /* no sound */ } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function assistsToday() {
    var t = today(), tasks = (window.LT && LT.data && LT.data() && LT.data().tasks) || [];
    return Math.min(3, tasks.filter(function (x) { return x.status === 'done' && String(x.completedAt || '').slice(0, 10) === t; }).length);
  }
  function floorName(n) { return n === 0 ? 'GF' : n % 10 === 0 ? 'L' + n + ' ★' : 'L' + n; }

  /* ---------- the game ---------- */
  function newGame() {
    var W = G.W;
    G.slabs = [{ x: W * 0.2, w: W * 0.6 }];       // the ground floor
    G.cur = { x: 0, w: W * 0.6, dir: 1 };
    G.speed = W / 170; G.cam = 0; G.camTo = 0;
    G.bits = []; G.pop = null; G.combo = 0; G.over = false; G.score = 0; G.newBest = false;
    G.assists = assistsToday();
    hud();
  }
  function drop(assist) {
    if (G.over) { newGame(); return; }
    var top = G.slabs[G.slabs.length - 1], c = G.cur;
    if (assist) { c.x = top.x; }
    var l = Math.max(c.x, top.x), r = Math.min(c.x + c.w, top.x + top.w), w = r - l;
    if (w <= 0) { G.bits.push({ x: c.x, w: c.w, y: G.slabs.length, vy: 0 }); gameOver(); return; }
    var perfect = Math.abs(c.x - top.x) <= Math.max(3, G.W * 0.008);
    if (perfect) { l = top.x; w = top.w; G.combo++; if (G.combo >= 3) { var g = Math.min(G.W * 0.05, G.W * 0.8 - w); if (g > 0) { l -= g / 2; w += g; } } sfx('done'); G.pop = { t: 40, text: G.combo > 1 ? 'PERFECT ×' + G.combo : 'PERFECT' }; }
    else {
      G.combo = 0; sfx('blip');
      if (c.x < l) G.bits.push({ x: c.x, w: l - c.x, y: G.slabs.length, vy: 0 });
      if (c.x + c.w > r) G.bits.push({ x: r, w: c.x + c.w - r, y: G.slabs.length, vy: 0 });
    }
    G.slabs.push({ x: l, w: w });
    G.score = G.slabs.length - 1;
    var n = G.slabs.length;
    G.cur = { x: n % 2 ? -w : G.W, w: w, dir: n % 2 ? 1 : -1 };
    G.speed = Math.min(G.W / 60, G.W / 170 + n * 0.12);
    if (n % 10 === 1 && n > 1) { G.pop = { t: 50, text: 'LEVEL ' + (n - 1) + '!' }; sfx('level'); }
    G.camTo = Math.max(0, (n - 6) * G.H_SLAB);
    hud();
  }
  function useAssist() { if (G.over || !G.assists) return; G.assists--; drop(true); }
  function gameOver() {
    G.over = true;
    if (G.score > best()) { setBest(G.score); G.newBest = true; sfx('level'); }
    hud();
  }

  function step() {
    var c = G.cur;
    if (!G.over) {
      c.x += c.dir * G.speed;
      if (c.x > G.W - c.w * 0.15 && c.dir > 0) c.dir = -1;
      if (c.x < -c.w * 0.85 && c.dir < 0) c.dir = 1;
    }
    G.cam += (G.camTo - G.cam) * 0.12;
    G.bits.forEach(function (b) { b.vy += 0.6; b.yOff = (b.yOff || 0) + b.vy; });
    G.bits = G.bits.filter(function (b) { return b.yOff < G.Hpx + 200; });
    if (G.pop) G.pop.t--;
    draw();
    raf = requestAnimationFrame(step);
  }

  function draw() {
    var x = G.ctx, W = G.W, H = G.Hpx, h = G.H_SLAB, base = H - 40 + G.cam;
    var bg = css('--bg', '#0b0d0b'), acc = css('--accent', '#e0b84f'), ink = css('--ink', '#e8e8e8'), mut = css('--muted', '#888');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    // pixel grid in the sky
    x.fillStyle = 'rgba(128,128,128,.07)';
    for (var gx = 0; gx < W; gx += 16) x.fillRect(gx, 0, 1, H);
    for (var gy = (G.cam % 16); gy < H; gy += 16) x.fillRect(0, gy, W, 1);
    // ground
    x.fillStyle = mut; x.fillRect(0, base, W, H);
    var slab = function (s, i, col) {
      var y = base - (i + 1) * h;
      if (y > H || y < -h) return;
      x.fillStyle = col; x.fillRect(Math.round(s.x), Math.round(y), Math.round(s.w), h - 2);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(Math.round(s.x), Math.round(y + h - 6), Math.round(s.w), 4);
      // windows
      x.fillStyle = 'rgba(255,255,255,.35)';
      for (var wx = s.x + 6; wx < s.x + s.w - 10; wx += 14) x.fillRect(Math.round(wx), Math.round(y + 5), 6, Math.max(3, h - 14));
      if (s.w > 40) { x.fillStyle = bg; x.font = '10px ' + G.font; x.fillText(floorName(i), Math.round(s.x + 4), Math.round(y + h - 8)); }
    };
    G.slabs.forEach(function (s, i) { slab(s, i, i % 2 ? acc : shade(acc)); });
    if (!G.over) slab(G.cur, G.slabs.length, ink);
    G.bits.forEach(function (b) { x.fillStyle = mut; x.fillRect(Math.round(b.x), Math.round(base - (b.y + 1) * h + b.yOff), Math.round(b.w), h - 2); });
    // crane hook over the moving slab
    if (!G.over) {
      var cy = base - (G.slabs.length + 1) * h;
      x.fillStyle = mut; x.fillRect(Math.round(G.cur.x + G.cur.w / 2), 0, 2, Math.max(0, cy));
    }
    if (G.pop && G.pop.t > 0) { x.fillStyle = acc; x.font = '18px ' + G.font; x.textAlign = 'center'; x.fillText(G.pop.text, W / 2, H * 0.3 - (40 - G.pop.t)); x.textAlign = 'left'; }
    if (G.over) {
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, H * 0.3, W, 120);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '20px ' + G.font;
      x.fillText(G.newBest ? 'NEW RECORD! ' + G.score + ' FLOORS' : 'TOPPED OUT AT ' + G.score, W / 2, H * 0.3 + 48);
      x.font = '12px ' + G.font; x.fillText('Tap or press Space to build again', W / 2, H * 0.3 + 80); x.textAlign = 'left';
    }
  }
  function shade(c) {                       // a darker version of the accent for every other floor
    var m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return c;
    var n = parseInt(m[1], 16), f = function (v) { return Math.round(v * 0.72); };
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  function hud() {
    if (!BOX) return;
    BOX.querySelector('.ts-score').textContent = G.score + (G.score === 1 ? ' floor' : ' floors');
    BOX.querySelector('.ts-best').textContent = 'Best ' + Math.max(best(), G.score);
    var a = BOX.querySelector('.ts-assist');
    a.textContent = '🏗 ×' + G.assists; a.disabled = !G.assists || G.over;
    a.title = G.assists ? 'Crane assist: drops the next slab perfectly (C)' : 'Finish a task today to earn a crane assist (max 3)';
  }

  /* ---------- open / close ---------- */
  function size() {
    var cv = BOX.querySelector('canvas'), r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    var oldW = G.W || r.width;
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    G.ctx = cv.getContext('2d'); G.ctx.setTransform(d, 0, 0, d, 0, 0); G.ctx.imageSmoothingEnabled = false;
    G.W = r.width; G.Hpx = r.height; G.H_SLAB = Math.max(18, Math.min(30, Math.round(r.height / 22)));
    if (G.slabs && oldW !== G.W) { var k = G.W / oldW; G.slabs.forEach(function (s) { s.x *= k; s.w *= k; }); G.cur.x *= k; G.cur.w *= k; }
  }
  function onKey(e) {
    if (!BOX) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); drop(); }
    if (e.key === 'c' || e.key === 'C') useAssist();
  }
  function close() {
    cancelAnimationFrame(raf); raf = 0;
    document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', size);
    if (BOX) BOX.remove(); BOX = null;
  }
  function open() {
    if (BOX) return;
    BOX = document.createElement('div'); BOX.className = 'ts-wrap';
    BOX.innerHTML = '<div class="ts-bar"><b>🏗 Tower Stack</b><span class="ts-score"></span><span class="ts-best"></span><span style="flex:1"></span>' +
      '<button class="btn ts-assist" type="button"></button><button class="btn ts-x" type="button" aria-label="Close">✕</button></div>' +
      '<canvas aria-label="Tower Stack game. Tap or press Space to drop the slab."></canvas>' +
      '<div class="ts-help">Tap / Space = drop · C = crane assist (1 per task finished today) · Esc = close</div>';
    document.body.appendChild(BOX);
    G = { font: css('--px-font', '') || '"Silkscreen", "Press Start 2P", monospace' };
    size(); newGame();
    var cv = BOX.querySelector('canvas');
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); drop(); });
    BOX.querySelector('.ts-x').onclick = close;
    BOX.querySelector('.ts-assist').onclick = useAssist;
    document.addEventListener('keydown', onKey, true); window.addEventListener('resize', size);
    raf = requestAnimationFrame(step);
  }

  var st = document.createElement('style');
  st.textContent = '.ts-wrap{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:var(--bg,#0b0d0b);color:var(--ink,#eee)}' +
    '.ts-bar{display:flex;align-items:center;gap:12px;padding:8px 12px;border-bottom:1px solid var(--line,#333);font-family:var(--px-font,inherit);font-size:.8rem;flex-wrap:wrap}' +
    '.ts-bar b{color:var(--accent,#e0b84f)}.ts-best{color:var(--muted,#888)}.ts-bar .btn{min-height:0;padding:4px 10px}' +
    '.ts-wrap canvas{flex:1;width:min(100%,520px);align-self:center;min-height:0;touch-action:none;cursor:pointer;display:block;border-left:1px solid var(--line,#333);border-right:1px solid var(--line,#333)}' +
    '.ts-help{padding:6px 12px;font-size:.7rem;color:var(--muted,#888);text-align:center}';
  document.head.appendChild(st);

  window.LT = window.LT || {}; LT.fn = LT.fn || {};
  LT.fn.game = { run: open, close: close, _state: function () { return G; } };
})();
