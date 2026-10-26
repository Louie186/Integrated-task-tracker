/* ═══ core/offline.js — "⬇ Offline copy" of a feature ══════════════
   Makes ONE .html file of a feature page (Delegation, QA/QC, MIDP
   Checker) that works with no website and no internet:
     • the page, its scripts, styles and Excel libraries are put inside
     • files the page fetches (the .xlsm checklist template) are put inside
     • your current data for that feature comes along as a starting point
   In the offline copy a small bar offers "⬇ Save work for website".
   That file is read back here with "⬆ Bring offline work back"
   (Settings → Data & backup → Offline copies).
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var FEAT = {
    delegate: { name: 'Delegation', page: 'skills/delegate/delegate.html', file: 'Delegation',
      libs: ['lib/exceljs.min.js', 'lib/jszip.min.js'], files: ['skills/delegate/templates/checklist-template.xlsm'],
      keys: ['lt_delegate_v1', 'lt_delegate_ui_v1', 'lews_team_v1', 'lews_myname'] },
    qaqc: { name: 'QA/QC', page: 'skills/qaqc/qaqc.html', file: 'QAQC',
      keys: ['lews_qaqc_state_v1', 'lews_qaqc_colw_v1', 'lews_team_v1'] },
    tidp: { name: 'MIDP Checker', page: 'skills/midp/midp.html', file: 'MIDP_Checker', prefix: 'tidp-checker:', skip: ['tidp-checker:index'],
      keys: [], note: 'Drop the latest TIDP in Files once — your tracker entries, lists and corrections are already in.' }
  };
  var THEME = 'lt_theme_v1';

  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function toast(m) { if (window.LT && LT.toast) LT.toast(m); else alert(m); }
  function keysOf(f) {
    var out = f.keys.slice();
    if (f.prefix) for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(f.prefix) === 0 && (f.skip || []).indexOf(k) < 0) out.push(k); }
    return out;
  }
  function snapshot(f) {
    var o = {};
    keysOf(f).concat([THEME]).forEach(function (k) { var v = localStorage.getItem(k); if (v !== null) o[k] = v; });
    return o;
  }
  function text(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('Could not read ' + url); return r.text(); }); }
  function b64(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('Could not read ' + url); return r.arrayBuffer(); }).then(function (buf) {
      var s = '', a = new Uint8Array(buf);
      for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
      return btoa(s);
    });
  }
  function scriptTag(code) { return '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>'; }
  function json(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }

  /* What runs first in the offline copy: puts the data in (asking before it replaces
     offline work), serves the packed files to fetch(), and shows the small bar. */
  function shim(id, f, seed, files, made) {
    var info = { id: id, name: f.name, file: f.file, made: made, keys: keysOf(f), prefix: f.prefix || '', note: f.note || '' };
    return scriptTag('(' + function (INFO, SEED, FILES) {
      var MARK = 'lt_offline_made:' + INFO.id;
      try {
        var had = localStorage.getItem(MARK);
        if (had !== INFO.made) {
          var mine = Object.keys(SEED).some(function (k) { var v = localStorage.getItem(k); return k !== 'lt_theme_v1' && v !== null && v !== SEED[k]; });
          var take = !had || !mine || confirm('This offline copy of ' + INFO.name + ' was made on ' + INFO.made + ' with the data from the website.\n\nThis computer already has offline work for ' + INFO.name + ' (from a copy made ' + had + ').\n\nOK = use the data in this new copy (the older offline work is replaced)\nCancel = keep the offline work on this computer');
          if (take) Object.keys(SEED).forEach(function (k) { if (k !== 'lt_theme_v1' || localStorage.getItem(k) === null) localStorage.setItem(k, SEED[k]); });
          localStorage.setItem(MARK, INFO.made);
        }
      } catch (e) { /* storage blocked: the page still opens, empty */ }
      // the packed files (e.g. the checklist template) for fetch()
      var of = window.fetch;
      window.fetch = function (u, o) {
        var s = String(u && u.url || u), hit = Object.keys(FILES).filter(function (k) { return s === k || s.slice(-k.length) === k || k.slice(-s.length) === s; })[0];
        if (hit) { var b = atob(FILES[hit]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return Promise.resolve(new Response(a.buffer, { status: 200 })); }
        return of ? of.apply(this, arguments) : Promise.reject(new Error('Offline'));
      };
      window.LT_OFFLINE = INFO;
      function save() {
        var keys = {};
        try {
          INFO.keys.forEach(function (k) { var v = localStorage.getItem(k); if (v !== null) keys[k] = v; });
          if (INFO.prefix) for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(INFO.prefix) === 0) keys[k] = localStorage.getItem(k); }
        } catch (e) { alert('Could not read the saved work: ' + e.message); return; }
        var d = new Date(), t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var blob = new Blob([JSON.stringify({ lt_offline_work: 1, feature: INFO.id, name: INFO.name, made: INFO.made, saved: new Date().toISOString(), keys: keys })], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = INFO.file + '_offline_work_' + t + '.json';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }
      function bar() {
        var b = document.createElement('div'); b.id = 'ltOffBar';
        b.innerHTML = '<span title="Made ' + INFO.made + '. Your work is saved in this browser on this computer.">📴 Offline copy</span><button type="button">⬇ Save work for website</button><button type="button" aria-label="Hide" title="Hide">✕</button>';
        b.children[1].onclick = save; b.children[2].onclick = function () { b.remove(); };
        var st = document.createElement('style');
        st.textContent = '#ltOffBar{position:fixed;right:10px;bottom:10px;z-index:99999;display:flex;gap:6px;align-items:center;padding:5px 6px 5px 10px;border-radius:999px;background:rgba(20,22,20,.92);color:#f3efe6;font:12px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)}' +
          '#ltOffBar button{font:inherit;border:0;border-radius:999px;padding:4px 10px;background:#d8b76d;color:#1b1b1b;cursor:pointer}#ltOffBar button:last-child{background:transparent;color:#bbb;padding:4px 6px}';
        document.head.appendChild(st); document.body.appendChild(b);
        if (INFO.note && !localStorage.getItem(MARK + ':noted')) { try { localStorage.setItem(MARK + ':noted', '1'); } catch (e) {} setTimeout(function () { alert('Offline copy of ' + INFO.name + '\n\n' + INFO.note); }, 600); }
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bar); else bar();
    }.toString() + ')(' + json(info) + ',' + json(seed) + ',' + json(files) + ');');
  }

  /* Build the file */
  function make(id) {
    var f = FEAT[id];
    if (!f) return Promise.reject(new Error('No offline copy for ' + id));
    var base = new URL(f.page, location.href), made = today();
    toast('Making the offline copy of ' + f.name + '…');
    var files = {};
    return Promise.all([
      text(base.href),
      Promise.all((f.libs || []).map(function (l) { return text(new URL(l, location.href).href); })),
      Promise.all((f.files || []).map(function (p) { return b64(new URL(p, location.href).href).then(function (d) { files[p.split('/').slice(-2).join('/')] = d; }); }))
    ]).then(function (r) {
      var html = r[0], libs = r[1], jobs = [];
      // every local <script src> and stylesheet goes inside the page
      html.replace(/<script([^>]*?)\ssrc="([^"]+)"([^>]*)><\/script>/g, function (m, a, src) {
        if (/^(https?:)?\/\//.test(src)) return m;
        jobs.push(text(new URL(src, base).href).then(function (code) { return [m, scriptTag(code)]; }));
        return m;
      });
      html.replace(/<link([^>]*?)rel="stylesheet"([^>]*?)href="([^"]+)"([^>]*)>/g, function (m, a, b, href) {
        if (/^(https?:)?\/\//.test(href)) return m;
        jobs.push(text(new URL(href, base).href).then(function (code) { return [m, '<style>\n' + code + '\n</style>']; }));
        return m;
      });
      return Promise.all(jobs).then(function (pairs) {
        pairs.forEach(function (p) { html = html.split(p[0]).join(p[1]); });
        var head = shim(id, f, snapshot(f), files, made) + libs.map(scriptTag).join('\n');
        html = html.replace(/<head([^>]*)>/i, function (m) { return m + '\n<!-- ' + f.name + ' — offline copy made ' + made + ' with Lew’s Tracker -->\n' + head; });
        html = html.replace(/<title>([^<]*)<\/title>/i, function (m, t) { return '<title>' + t + ' (offline)</title>'; });
        var blob = new Blob([html], { type: 'text/html' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f.file + '_offline_' + made + '.html';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        toast('⬇ ' + f.name + ' offline copy ready (' + (blob.size / 1e6).toFixed(1) + ' MB)');
        return blob;
      });
    }).catch(function (e) { console.error(e); toast('⚠ Offline copy: ' + e.message); throw e; });
  }

  /* Bring the work done in an offline copy back into the website */
  function bringBack(file) {
    return file.text().then(function (t) {
      var o = JSON.parse(t);
      if (!o || !o.lt_offline_work || !o.keys || !FEAT[o.feature]) throw new Error('This is not a "Save work for website" file');
      var f = FEAT[o.feature], n = Object.keys(o.keys).length;
      var when = o.saved ? new Date(o.saved).toLocaleString() : '?';
      if (!confirm('Bring back ' + f.name + ' work saved offline on ' + when + '?\n\nIt replaces the ' + f.name + ' data of the project open now (' + n + ' saved parts).\nThe current website data is kept for one undo (Settings → Offline copies → Undo).')) return false;
      var undo = { feature: o.feature, at: new Date().toISOString(), keys: {} };
      keysOf(f).forEach(function (k) { undo.keys[k] = localStorage.getItem(k); });
      Object.keys(o.keys).forEach(function (k) { if (!(k in undo.keys)) undo.keys[k] = localStorage.getItem(k); });
      try { localStorage.setItem('lt_offline_undo', JSON.stringify(undo)); } catch (e) { if (!confirm('No room to keep an undo copy. Bring the work back anyway?')) return false; }
      if (f.prefix) keysOf(f).forEach(function (k) { if (!(k in o.keys) && k.indexOf(f.prefix) === 0) localStorage.removeItem(k); });
      Object.keys(o.keys).forEach(function (k) { if (k !== THEME) localStorage.setItem(k, o.keys[k]); });
      reloadFeature(o.feature);
      toast('⬆ ' + f.name + ' work brought back');
      paint();
      return true;
    }).catch(function (e) { toast('⚠ ' + e.message); });
  }
  function undoBack() {
    var u; try { u = JSON.parse(localStorage.getItem('lt_offline_undo') || 'null'); } catch (e) { u = null; }
    if (!u || !confirm('Put back the ' + (FEAT[u.feature] || {}).name + ' data from before the offline work was brought back?')) return;
    Object.keys(u.keys).forEach(function (k) { if (u.keys[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, u.keys[k]); });
    localStorage.removeItem('lt_offline_undo');
    reloadFeature(u.feature); toast('Undone'); paint();
  }
  function reloadFeature(id) {
    document.querySelectorAll('iframe').forEach(function (fr) { try { if (fr.src.indexOf(FEAT[id].page) >= 0) fr.contentWindow.location.reload(); } catch (e) {} });
  }

  /* Settings → Data & backup → Offline copies */
  function paint() {
    var box = document.getElementById('ltOfflineBtns'); if (!box) return;
    var on = function (id) { return !(window.LT && LT.isOn) || LT.isOn(id); };
    var hasUndo = !!localStorage.getItem('lt_offline_undo');
    box.innerHTML = Object.keys(FEAT).filter(on).map(function (id) { return '<button class="btn" type="button" data-offmake="' + id + '">⬇ ' + FEAT[id].name + '</button>'; }).join('') +
      '<label class="btn">⬆ Bring offline work back<input type="file" accept=".json" hidden data-offback></label>' +
      (hasUndo ? '<button class="btn" type="button" data-offundo>↶ Undo bring back</button>' : '');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-offmake]');
    if (b) { b.disabled = true; make(b.getAttribute('data-offmake')).then(function () { b.disabled = false; }, function () { b.disabled = false; }); }
    if (e.target.closest && e.target.closest('[data-offundo]')) undoBack();
  });
  document.addEventListener('change', function (e) { if (e.target.matches && e.target.matches('[data-offback]') && e.target.files[0]) { bringBack(e.target.files[0]); e.target.value = ''; } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();

  window.LTOffline = { make: make, bringBack: bringBack, FEAT: FEAT, paint: paint };
})();
