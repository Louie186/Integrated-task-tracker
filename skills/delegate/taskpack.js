/* ═══════════════════════════════════════════════════════════════════
   skills/delegate/taskpack.js — share tasks with people who don't use the website
   ───────────────────────────────────────────────────────────────────
   build(pack)          → one self-contained .html "Task Pack" (works offline,
                          no login). Its app + data are scrambled inside, so
                          opening it in Notepad shows nothing readable.
   parseReply(text)     → { meta, rows, message, name } from the reply the
                          person sends back (file or pasted code). rows use
                          the same shape as the Excel reader, so Delegation's
                          import treats both the same way.
   simpleExcel(ExcelJS, plan) → a plain Excel table (no formulas, no grouping,
                          no drop-downs) for people who prefer to copy by hand.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var MARK = 'LTUPDATE1:';

  /* ---------- the app that runs inside the Task Pack (kept free of comments: it is embedded) ---------- */
  function runtime(P) {
    var KEY = 'ltpack:' + P.id;
    var ST = [['Not started', 'To do'], ['In progress', 'Doing'], ['Completed', 'Done']];
    var TODAY = (function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    var S;
    try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
    S = S || { items: {}, newItems: {}, newTasks: [], msg: '', name: P.person || '', filter: 'all', q: '', help: true };
    S.items = S.items || {}; S.newItems = S.newItems || {}; S.newTasks = S.newTasks || [];
    var saveOk = true;
    function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); saveOk = true; } catch (e) { saveOk = false; } }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function lid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
    function fmt(d) { if (!d) return ''; var x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
    function cur(code, base) { var o = S.items[code] || {}; return { status: o.status || base.status || 'Not started', notes: o.notes != null ? o.notes : (base.notes || '') }; }
    function lines() {
      var out = [];
      P.tasks.forEach(function (t) {
        if (!t.subs.length) out.push({ t: t, code: t.code, base: t, due: t.due });
        t.subs.forEach(function (s) { out.push({ t: t, code: s.code, base: s, due: s.due || t.due }); });
        (S.newItems[t.code] || []).forEach(function (n) { out.push({ t: t, n: n, due: n.due || t.due }); });
      });
      S.newTasks.forEach(function (nt) { (nt.items.length ? nt.items : [nt]).forEach(function (n) { out.push({ nt: nt, n: n, due: n.due || nt.due }); }); });
      return out;
    }
    function stOf(l) { return l.n ? l.n.status : cur(l.code, l.base).status; }
    function late(l) { var s = stOf(l); return l.due && l.due < TODAY && s !== 'Completed'; }

    var css = document.createElement('style');
    css.textContent = [
      ':root{--ink:#1f2430;--muted:#5f6675;--line:#d9dce5;--bg:#f4f5f9;--card:#fff;--acc:#5b3e7e;--acc2:#3d2b56;--ok:#2e7d4f;--ip:#b7791f;--bad:#c0392b;--soft:#f0ecf6}',
      '*{box-sizing:border-box}body{margin:0;font:16px/1.45 "Segoe UI",Calibri,system-ui,sans-serif;color:var(--ink);background:var(--bg)}',
      '.top{background:linear-gradient(135deg,var(--acc2),var(--acc));color:#fff;padding:18px 20px 16px}.top h1{margin:0;font-size:22px;letter-spacing:.02em}.top .sub{opacity:.85;font-size:14px;margin-top:2px}',
      '.wrap{max-width:900px;margin:0 auto;padding:16px 14px 120px}',
      '.prog{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:14px}.bar{flex:1;height:10px;background:rgba(255,255,255,.25);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:#9be37b}',
      '.help{background:#fffbea;border:1px solid #f0d98c;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:15px}.help ol{margin:6px 0 0 20px;padding:0}.help button{float:right}',
      '.bar2{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}.bar2 input{flex:1 1 200px}',
      'input,textarea{font:inherit;color:inherit;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:#fff;width:100%}textarea{min-height:40px;resize:vertical}',
      'button{font:inherit;cursor:pointer;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);padding:7px 14px;font-weight:600}button:hover{border-color:var(--acc)}',
      'button.main{background:var(--acc);border-color:var(--acc);color:#fff}button.chip.on{background:var(--soft);border-color:var(--acc);color:var(--acc)}',
      '.card{background:var(--card);border:1px solid var(--line);border-radius:16px;margin-bottom:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)}',
      '.ch{padding:12px 16px;background:var(--soft);display:flex;gap:10px;flex-wrap:wrap;align-items:baseline}.ch b{font-size:17px}.code{font:600 13px Consolas,monospace;color:var(--muted)}.grp{font-size:13px;color:var(--muted)}.due{margin-left:auto;font-size:14px;color:var(--muted)}.due.late{color:var(--bad);font-weight:700}',
      '.lew{padding:8px 16px;font-size:14px;color:var(--muted);border-bottom:1px solid var(--line)}',
      '.it{padding:10px 16px;border-top:1px solid var(--line);display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center}.it:first-of-type{border-top:0}',
      '.it .nm{font-weight:600}.it .nm small{display:block;font-weight:400;color:var(--muted);font-size:13px}.it .nm small.late{color:var(--bad);font-weight:700}.it.done .nm span{text-decoration:line-through;opacity:.6}',
      '.sts{display:flex;gap:4px}.sts button{padding:6px 12px;font-size:14px}.sts button.on.s0{background:#e9ebf0;border-color:#9aa1b0}.sts button.on.s1{background:#fdf1d8;border-color:var(--ip);color:#8a5a0c}.sts button.on.s2{background:#dff3e6;border-color:var(--ok);color:var(--ok)}',
      '.it textarea{grid-column:1/-1;min-height:36px;font-size:14px}.new{background:#fbfaff}.tag{font-size:11px;font-weight:700;color:var(--acc);border:1px solid var(--acc);border-radius:99px;padding:0 6px;margin-left:6px}',
      '.x{border:0;background:none;color:var(--bad);padding:2px 6px;font-size:18px}',
      '.add{padding:10px 16px;border-top:1px dashed var(--line);display:flex;gap:8px}.add input{flex:1}',
      '.nt{padding:14px 16px;display:grid;gap:8px}.lbl{font-size:13px;color:var(--muted)}',
      '.foot{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);padding:10px 14px;box-shadow:0 -2px 10px rgba(0,0,0,.06)}.foot .in{max-width:900px;margin:0 auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.foot .hint{font-size:13px;color:var(--muted);flex:1 1 220px}',
      '.saved{font-size:13px;color:var(--ok)}.saved.no{color:var(--bad)}',
      '.modal{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:16px;z-index:9}.modal .box{background:#fff;border-radius:16px;padding:18px;max-width:560px;width:100%}.modal textarea{min-height:160px;font:12px Consolas,monospace}',
      '@media(max-width:600px){.it{grid-template-columns:1fr}.sts button{flex:1}.due{margin-left:0;width:100%}}',
      '@media print{.foot,.help,.bar2,.add,.x,.newtask,.msg{display:none!important}.it textarea{border:0;padding:0}.wrap{padding-bottom:0}.card{break-inside:avoid}}'
    ].join('\n');
    document.head.appendChild(css);
    document.title = 'Tasks — ' + (P.label || P.person || '');

    function itemHtml(l) {
      var key = l.n ? 'n:' + l.n.lid : 'c:' + l.code, st = stOf(l), notes = l.n ? l.n.notes : cur(l.code, l.base).notes;
      var title = l.n ? l.n.title : (l.base === l.t ? 'This task' : l.base.title);
      return '<div class="it' + (st === 'Completed' ? ' done' : '') + (l.n ? ' new' : '') + '"><div class="nm"><span>' + esc(title) + '</span>' + (l.n ? '<span class="tag">NEW</span>' : '') +
        (l.n ? ' <button class="x" data-del="' + key + '" title="Remove">×</button>' : '') +
        '<small class="' + (late(l) ? 'late' : '') + '">' + (l.code ? esc(l.code) + ' · ' : '') + (l.due ? (late(l) ? 'Overdue — ' : 'Due ') + esc(fmt(l.due)) : 'No date') + '</small></div>' +
        '<div class="sts">' + ST.map(function (s, i) { return '<button class="s' + i + (s[0] === st ? ' on' : '') + '" data-st="' + key + '" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
        '<textarea data-note="' + key + '" placeholder="Your note (optional)…">' + esc(notes) + '</textarea></div>';
    }
    function match(l) {
      var q = (S.q || '').toLowerCase(), st = stOf(l);
      if (S.filter === 'open' && st === 'Completed') return false;
      if (S.filter === 'done' && st !== 'Completed') return false;
      if (q) { var h = [(l.t || l.nt).title, l.n ? l.n.title : l.base.title, l.code || ''].join(' ').toLowerCase(); if (h.indexOf(q) < 0) return false; }
      return true;
    }
    function render() {
      var all = lines(), done = all.filter(function (l) { return stOf(l) === 'Completed'; }).length, lateN = all.filter(late).length;
      var pct = all.length ? Math.round(done / all.length * 100) : 0;
      var h = '<div class="top"><h1>TASKS FOR ' + esc((P.label || '').toUpperCase()) + '</h1><div class="sub">' + esc(P.project) + ' · from ' + esc(P.by || '—') + ' · ' + esc(fmt(P.at)) + '</div>' +
        '<div class="prog"><span>' + done + ' of ' + all.length + ' done' + (lateN ? ' · <b>' + lateN + ' overdue</b>' : '') + '</span><div class="bar"><i style="width:' + pct + '%"></i></div><span>' + pct + '%</span></div></div><div class="wrap">';
      if (S.help) h += '<div class="help"><button data-help="0">Got it</button><b>How to use this page</b><ol><li>Click <b>To do</b>, <b>Doing</b> or <b>Done</b> on each line.</li><li>Write a note if you need to (optional).</li><li>Press <b>📤 Save reply</b> at the bottom and email / Teams that file to ' + esc(P.by || 'me') + '.</li></ol><div style="margin-top:6px;font-size:14px">Your work is kept on this computer — you can close the page and come back.</div></div>';
      h += '<div class="bar2"><input id="q" placeholder="Search…" value="' + esc(S.q) + '">' + [['all', 'All'], ['open', 'Still to do'], ['done', 'Done']].map(function (f) { return '<button class="chip' + (S.filter === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
      P.tasks.forEach(function (t) {
        var ls = all.filter(function (l) { return l.t === t && match(l); });
        if (!ls.length && (S.q || S.filter !== 'all')) return;
        var tl = { due: t.due, t: t, code: t.code, base: t }, tlate = t.due && t.due < TODAY && all.some(function (l) { return l.t === t && stOf(l) !== 'Completed'; });
        h += '<div class="card"><div class="ch"><span class="code">' + esc(t.code) + '</span><b>' + esc(t.title) + '</b>' + (t.group ? '<span class="grp">' + esc(t.group) + '</span>' : '') +
          '<span class="due' + (tlate ? ' late' : '') + '">' + (t.due ? (tlate ? 'Overdue — ' : 'Due ') + esc(fmt(t.due)) : '') + '</span></div>' +
          (t.notes ? '<div class="lew">📝 ' + esc(t.notes) + '</div>' : '') + ls.map(itemHtml).join('') +
          '<div class="add"><input data-addin="' + esc(t.code) + '" placeholder="+ Add an item to this task…"><button data-add="' + esc(t.code) + '">Add</button></div></div>';
      });
      S.newTasks.forEach(function (nt) {
        var ls = all.filter(function (l) { return l.nt === nt && match(l); });
        h += '<div class="card"><div class="ch"><span class="tag">NEW TASK</span><b>' + esc(nt.title) + '</b><button class="x" data-delt="' + nt.lid + '" title="Remove this new task">×</button>' +
          '<span class="due">' + (nt.due ? 'Due ' + esc(fmt(nt.due)) : '') + '</span></div>' + ls.map(itemHtml).join('') +
          '<div class="add"><input data-addin="t:' + nt.lid + '" placeholder="+ Add an item…"><button data-add="t:' + nt.lid + '">Add</button></div></div>';
      });
      h += '<div class="card newtask"><div class="ch"><b>+ New task</b><span class="grp">something extra you are working on</span></div><div class="nt">' +
        '<input id="ntT" placeholder="Task name"><textarea id="ntI" placeholder="Items — one per line (optional)"></textarea>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="lbl">Target date</span><input id="ntD" type="date" style="width:auto"><button class="main" data-newtask="1">Add task</button></div></div></div>';
      h += '<div class="card msg"><div class="ch"><b>Message</b><span class="grp">optional — goes with your reply</span></div><div class="nt"><input id="nm" placeholder="Your name" value="' + esc(S.name) + '"><textarea id="msg" placeholder="Anything to tell ' + esc(P.by || 'me') + '?">' + esc(S.msg) + '</textarea></div></div>';
      h += '</div><div class="foot"><div class="in"><span class="hint">Press <b>Save reply</b>, then send that file back. <span class="saved' + (saveOk ? '' : ' no') + '">' + (saveOk ? '✓ Kept on this computer' : '⚠ Could not keep your work — save a reply now') + '</span></span>' +
        '<button class="main" data-act="reply">📤 Save reply</button><button data-act="copy">📋 Copy reply</button><button data-act="print">🖨 Print</button><button data-act="csv">⬇ Excel</button></div></div>';
      document.getElementById('app').innerHTML = h;
    }
    function find(key) {
      if (key.indexOf('n:') === 0) {
        var id = key.slice(2), hit = null;
        Object.keys(S.newItems).forEach(function (c) { S.newItems[c].forEach(function (n) { if (n.lid === id) hit = n; }); });
        S.newTasks.forEach(function (nt) { if (nt.lid === id) hit = nt; nt.items.forEach(function (n) { if (n.lid === id) hit = n; }); });
        return hit;
      }
      var code = key.slice(2); return S.items[code] = S.items[code] || {};
    }
    function reply() {
      var items = [], rows = [];
      P.tasks.forEach(function (t) {
        var tc = cur(t.code, t);
        rows.push({ id: t.code, title: t.title, status: t.subs.length ? '' : tc.status, notes: tc.notes, derived: !!t.subs.length });
        t.subs.forEach(function (s) { var c = cur(s.code, s); rows.push({ id: s.code, title: s.title, status: c.status, notes: c.notes }); });
        (S.newItems[t.code] || []).forEach(function (n) { rows.push({ id: '', title: n.title, status: n.status, notes: n.notes, due: n.due || '' }); });
      });
      S.newTasks.forEach(function (nt) {
        rows.push({ id: 'NEW', title: nt.title, status: nt.items.length ? '' : nt.status, notes: nt.notes || '', due: nt.due || '' });
        nt.items.forEach(function (n) { rows.push({ id: '', title: n.title, status: n.status, notes: n.notes, due: n.due || nt.due || '' }); });
      });
      var body = JSON.stringify({ kind: 'lt-taskpack-reply', v: 1, pack: P.id, projectId: P.projectId, project: P.project, person: P.person || '', label: P.label, name: S.name, message: S.msg, at: new Date().toISOString(), rows: rows });
      var b64 = btoa(unescape(encodeURIComponent(body))).replace(/(.{76})/g, '$1\n');
      return "Lew's Tracker — task update\nFrom: " + (S.name || P.label) + '   Tasks for: ' + P.label + '   Project: ' + P.project + '\nSent: ' + new Date().toLocaleString() + '\n\n(Please do not change the lines below.)\n' + P.MARK + '\n' + b64 + '\n';
    }
    function download(name, text, type) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }
    function fileName(s) { return String(s || 'Tasks').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_'); }
    function csv() {
      var rows = [['ID', 'Task', 'Item', 'Due date', 'Status', 'Notes']];
      lines().forEach(function (l) {
        var st = stOf(l), notes = l.n ? l.n.notes : cur(l.code, l.base).notes, task = (l.t || l.nt).title;
        var item = l.n ? (l.nt && l.n === l.nt ? '' : l.n.title) : (l.base === l.t ? '' : l.base.title);
        rows.push([l.code || 'NEW', task, item, l.due || '', st, notes || '']);
      });
      return '\ufeff' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    }
    function showCopy(text) {
      var m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = '<div class="box"><b>Copy this and paste it into an email or Teams message</b><textarea readonly>' + esc(text) + '</textarea><div style="text-align:right;margin-top:8px"><button class="main" data-close="1">Close</button></div></div>';
      document.body.appendChild(m); var ta = m.querySelector('textarea'); ta.focus(); ta.select();
      m.addEventListener('click', function (e) { if (e.target === m || e.target.getAttribute('data-close')) m.remove(); });
    }
    document.addEventListener('click', function (e) {
      var el = e.target.closest('button'); if (!el) return;
      var a = function (k) { return el.getAttribute(k); };
      if (a('data-st')) { var o = find(a('data-st')); if (o) { o.status = a('data-v'); save(); render(); } }
      else if (a('data-f')) { S.filter = a('data-f'); save(); render(); }
      else if (a('data-help')) { S.help = false; save(); render(); }
      else if (a('data-add')) {
        var k = a('data-add'), inp = document.querySelector('[data-addin="' + k + '"]'), v = inp.value.trim(); if (!v) { inp.focus(); return; }
        var n = { lid: lid(), title: v, status: 'Not started', notes: '' };
        if (k.indexOf('t:') === 0) { S.newTasks.forEach(function (nt) { if (nt.lid === k.slice(2)) nt.items.push(n); }); }
        else (S.newItems[k] = S.newItems[k] || []).push(n);
        save(); render(); var again = document.querySelector('[data-addin="' + k + '"]'); if (again) again.focus();
      }
      else if (a('data-del')) {
        var id = a('data-del').slice(2);
        Object.keys(S.newItems).forEach(function (c) { S.newItems[c] = S.newItems[c].filter(function (n) { return n.lid !== id; }); });
        S.newTasks.forEach(function (nt) { nt.items = nt.items.filter(function (n) { return n.lid !== id; }); });
        save(); render();
      }
      else if (a('data-delt')) { if (confirm('Remove this new task?')) { S.newTasks = S.newTasks.filter(function (nt) { return nt.lid !== a('data-delt'); }); save(); render(); } }
      else if (a('data-newtask')) {
        var t = document.getElementById('ntT').value.trim(); if (!t) { document.getElementById('ntT').focus(); return; }
        var its = document.getElementById('ntI').value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
        S.newTasks.push({ lid: lid(), title: t, due: document.getElementById('ntD').value, status: 'Not started', notes: '', items: its.map(function (x) { return { lid: lid(), title: x, status: 'Not started', notes: '' }; }) });
        save(); render();
      }
      else if (a('data-act') === 'reply') download('Reply_' + fileName(S.name || P.label) + '_' + TODAY + '.txt', reply(), 'text/plain');
      else if (a('data-act') === 'copy') { var txt = reply(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { alert('Copied. Now paste it into an email or Teams message to ' + (P.by || 'me') + '.'); }, function () { showCopy(txt); }); }
      else if (a('data-act') === 'print') window.print();
      else if (a('data-act') === 'csv') download(fileName(P.label) + '_Tasks_' + TODAY + '.csv', csv(), 'text/csv');
    });
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t.getAttribute('data-note')) { var o = find(t.getAttribute('data-note')); if (o) { o.notes = t.value; save(); } }
      else if (t.id === 'msg') { S.msg = t.value; save(); }
      else if (t.id === 'nm') { S.name = t.value; save(); }
      else if (t.id === 'q') { S.q = t.value; save(); clearTimeout(window.__qt); window.__qt = setTimeout(function () { render(); var q = document.getElementById('q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('data-addin')) { var b = document.querySelector('[data-add="' + e.target.getAttribute('data-addin') + '"]'); if (b) b.click(); } });
    render();
  }

  /* ---------- scramble: the app + data are XOR-ed with a random key and base64-ed ---------- */
  function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); }
  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); }
  function scramble(text, key) { var u = utf8(text); for (var i = 0; i < u.length; i++) u[i] ^= key.charCodeAt(i % key.length); return b64(u); }
  function randKey() { var s = ''; for (var i = 0; i < 24; i++) s += String.fromCharCode(33 + Math.floor(Math.random() * 90)); return s.replace(/["\\]/g, 'x'); }
  function htmlEsc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* pack = { id, projectId, project, by, at (ISO), label, person, tasks:[{code, group, title, due, status, notes, subs:[{code, title, due, status, notes}]}] } */
  function build(pack) {
    var data = Object.assign({}, pack, { MARK: MARK });
    var src = runtime.toString();
    src = src.slice(src.indexOf('{') + 1, src.lastIndexOf('}'));
    var key = randKey(), blob = scramble(src + '\u0000' + JSON.stringify(data), key);
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Tasks — ' + htmlEsc(pack.label) + '</title></head><body>' +
      '<div id="app" style="font:16px system-ui;padding:24px">Opening your tasks…</div>' +
      '<noscript><p style="font:16px system-ui;padding:24px">Please open this file in Chrome or Edge.</p></noscript>' +
      '<script>(function(k,d){try{var b=atob(d),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i)^k.charCodeAt(i%k.length);' +
      'var s=new TextDecoder().decode(u),j=s.indexOf("\\u0000");new Function("P",s.slice(0,j))(JSON.parse(s.slice(j+1)));}' +
      'catch(e){document.getElementById("app").textContent="This file could not open. Please use Chrome or Edge, or ask for a new file.";}})(' +
      JSON.stringify(key) + ',"' + blob + '");</script></body></html>';
  }

  /* ---------- the reply that comes back (a .txt file or the pasted text) ---------- */
  function parseReply(text) {
    var i = String(text || '').indexOf(MARK);
    if (i < 0) throw new Error('This is not a Task Pack reply (no update code found).');
    var code = text.slice(i + MARK.length).replace(/[^A-Za-z0-9+/=]/g, '');
    var json;
    try {
      var bin = atob(code), u = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
      json = JSON.parse(new TextDecoder().decode(u));
    } catch (e) { throw new Error('The update code is damaged — ask them to send the reply file instead of copying it.'); }
    if (!json || json.kind !== 'lt-taskpack-reply' || !Array.isArray(json.rows)) throw new Error('This is not a Task Pack reply.');
    var clean = function (v) { return String(v == null ? '' : v).slice(0, 4000); };
    var rows = json.rows.slice(0, 5000).map(function (r) {
      return { id: clean(r.id), title: clean(r.title), group: '', assignees: '', due: /^\d{4}-\d{2}-\d{2}$/.test(r.due || '') ? r.due : '',
        status: clean(r.status), derived: !!r.derived, notes: r.notes == null ? null : clean(r.notes) };
    });
    return { meta: { exportId: json.pack, projectId: json.projectId, project: json.project, person: json.person, label: json.label, name: clean(json.name), message: clean(json.message), at: json.at }, rows: rows };
  }

  /* ---------- plain Excel: a table to copy by hand (can still be read back: ID / Status / Notes) ---------- */
  function simpleExcel(ExcelJS, plan) {
    var wb = new ExcelJS.Workbook();
    wb.creator = "Lew's Tracker"; wb.views = [{ x: 0, y: 0, width: 28800, height: 15000, firstSheet: 0, activeTab: 0 }];
    var ws = wb.addWorksheet('Tasks', { views: [{ state: 'frozen', ySplit: 3, xSplit: 0 }] });
    var cols = [['ID', 9], ['Task', 40], ['Item', 40], ['Assigned to', 18], ['Due date', 13], ['Status', 14], ['Notes', 44]];
    var thin = { style: 'thin', color: { argb: 'FFBFC5D2' } }, box = { top: thin, left: thin, bottom: thin, right: thin };
    var clean = function (v) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, ' ').slice(0, 32000); };
    var date = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
    ws.getCell('A1').value = clean('Tasks for ' + plan.scope + '  —  ' + plan.project + '  —  from ' + (plan.issuedBy || '') + ', ' + new Date(plan.issuedAt || Date.now()).toDateString().slice(4));
    ws.getCell('A1').font = { bold: true, size: 13 };
    cols.forEach(function (c, i) { var h = ws.getCell(3, i + 1); h.value = c[0]; h.font = { bold: true }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E9EF' } }; h.border = box; ws.getColumn(i + 1).width = c[1]; });
    var r = 4;
    var put = function (vals, bold) {
      vals.forEach(function (v, i) { var c = ws.getCell(r, i + 1); if (v !== '' && v != null) c.value = v; c.border = box; c.alignment = { vertical: 'top', wrapText: i === 1 || i === 2 || i === 6 }; if (bold && i < 3) c.font = { bold: true }; if (i === 4) c.numFmt = 'dd mmm yyyy'; });
      r++;
    };
    (plan.tasks || []).forEach(function (t) {
      put([clean(t.code), clean(t.title), '', clean(t.assignees), date(t.due), t.subs.length ? '' : clean(t.status), clean(t.notes)], true);
      t.subs.forEach(function (s) { put([clean(s.code), '', clean(s.title), clean(s.assignees), date(s.due || t.due), clean(s.status), clean(s.notes)], false); });
    });
    return wb;
  }

  var api = { build: build, parseReply: parseReply, simpleExcel: simpleExcel, MARK: MARK };
  root.LTTaskPack = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
