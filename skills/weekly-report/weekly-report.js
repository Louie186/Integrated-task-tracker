/* ═══ SKILL (tool): Weekly report ══════════════════════════════════
   One printable page for the open project, last 7 days + next 7 days:
     • your To Do list — finished, overdue, coming up
     • team (Delegation) — progress per group, overdue, due next week
     • QA/QC — items, verified, open issues
   Opens in a new tab: Print → "Save as PDF" to send it.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function k(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function nice(s) { if (!s) return ''; var d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); }

  function build(ctx) {
    var esc = ctx.esc, now = new Date(), today = k(now);
    var a = new Date(now); a.setDate(a.getDate() - 7); var from = k(a);
    var b = new Date(now); b.setDate(b.getDate() + 7); var to = k(b);
    var p = ctx.project(), T = ctx.tracker(), user = LT.user();
    var li = function (arr, f) { return arr.length ? '<ul>' + arr.map(f).join('') + '</ul>' : '<p class="none">None</p>'; };

    // 1. my tasks
    var tasks = ((T && T.tasks) || []);
    var doneWk = tasks.filter(function (t) { return t.status === 'done' && (t.completedAt || '') >= from; });
    var late = tasks.filter(function (t) { return t.status !== 'done' && t.due && t.due < today; });
    var soon = tasks.filter(function (t) { return t.status !== 'done' && t.due && t.due >= today && t.due <= to; }).sort(function (x, y) { return x.due.localeCompare(y.due); });
    var mine = '<h2>My tasks</h2><div class="kp"><span><b>' + doneWk.length + '</b> finished this week</span><span class="' + (late.length ? 'bad' : '') + '"><b>' + late.length + '</b> overdue</span><span><b>' + soon.length + '</b> due next 7 days</span></div>' +
      '<div class="cols"><div><h3>Finished</h3>' + li(doneWk, function (t) { return '<li>' + esc(t.title) + '</li>'; }) + '</div>' +
      '<div><h3>Overdue</h3>' + li(late, function (t) { return '<li>' + esc(t.title) + ' <i>' + nice(t.due) + '</i></li>'; }) + '</div>' +
      '<div><h3>Coming up</h3>' + li(soon, function (t) { return '<li>' + esc(t.title) + ' <i>' + nice(t.due) + '</i></li>'; }) + '</div></div>';

    // 2. team
    var team = '';
    var D = LT.isOn('delegate') ? ctx.delegation() : null;
    if (D && D.tasks && D.tasks.length) {
      var gname = function (id) { var g = (D.groups || []).filter(function (x) { return x.id === id; })[0]; return g ? g.name : 'No group'; };
      var val = function (s) { return s === 'Completed' ? 1 : s === 'In progress' ? 0.5 : 0; };
      var groups = {}, tl = [], ts = [];
      D.tasks.forEach(function (t) {
        var items = t.subs && t.subs.length ? t.subs.map(function (s) { return { code: s.code, title: t.title + ' › ' + s.title, who: s.assignees || t.assignees, due: s.due || t.due, st: s.status }; }) : [{ code: t.code, title: t.title, who: t.assignees, due: t.due, st: t.status }];
        var g = groups[gname(t.group)] = groups[gname(t.group)] || { n: 0, p: 0 };
        items.forEach(function (i) {
          g.n++; g.p += val(i.st);
          if (i.st !== 'Completed' && i.due && i.due < today) tl.push(i);
          else if (i.st !== 'Completed' && i.due && i.due <= to) ts.push(i);
        });
      });
      team = '<h2>Team (Delegation)</h2><table><tr><th>Group</th><th>Items</th><th>Progress</th></tr>' +
        Object.keys(groups).sort().map(function (n) { var g = groups[n], pc = Math.round(g.p / g.n * 100); return '<tr><td>' + esc(n) + '</td><td>' + g.n + '</td><td><div class="bar"><i style="width:' + pc + '%"></i></div> ' + pc + '%</td></tr>'; }).join('') + '</table>' +
        '<div class="cols"><div><h3>Overdue</h3>' + li(tl, function (i) { return '<li><b>' + esc(i.code) + '</b> ' + esc(i.title) + ' — ' + esc(i.who || '?') + ' <i>' + nice(i.due) + '</i></li>'; }) + '</div>' +
        '<div><h3>Due next 7 days</h3>' + li(ts, function (i) { return '<li><b>' + esc(i.code) + '</b> ' + esc(i.title) + ' — ' + esc(i.who || '?') + ' <i>' + nice(i.due) + '</i></li>'; }) + '</div></div>';
    }

    // 3. QA/QC
    var qa = '';
    var Q = LT.isOn('qaqc') ? ctx.qaqc() : null;
    var qp = Q && Q.projects && (Q.projects.filter(function (x) { return x.id === Q.activeId; })[0] || Q.projects[0]);
    if (qp && (qp.sheets || []).length) {
      var sh = qp.sheets.filter(function (s) { return !s.archived; }), st = function (s) { return typeof qaqcStatus === 'function' ? qaqcStatus(s) : (s.verified ? 'done' : 'todo'); };
      var issues = sh.filter(function (s) { return st(s) === 'issue'; }), ver = sh.filter(function (s) { return st(s) === 'done'; });
      qa = '<h2>QA/QC — ' + esc(qp.name) + '</h2><div class="kp"><span><b>' + sh.length + '</b> items</span><span><b>' + ver.length + '</b> verified</span><span class="' + (issues.length ? 'bad' : '') + '"><b>' + issues.length + '</b> with issues</span></div>' +
        (issues.length ? '<h3>Open issues</h3>' + li(issues.slice(0, 15), function (s) { return '<li><b>' + esc(s.number || '') + '</b> ' + esc(s.title || '') + '</li>'; }) : '');
    }

    return '<!doctype html><html><head><meta charset="utf-8"><title>Weekly report — ' + esc(p.name) + '</title><style>' +
      'body{font:13px/1.45 Inter,Segoe UI,Arial,sans-serif;color:#1e221f;margin:28px;max-width:980px}h1{margin:0;font-size:22px}h2{margin:22px 0 8px;font-size:16px;border-bottom:2px solid #d8b76d;padding-bottom:4px}' +
      'h3{margin:8px 0 4px;font-size:13px;color:#5a6360}.sub{color:#5a6360;margin-bottom:6px}.kp{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}.kp span{border:1px solid #ddd;border-radius:10px;padding:6px 12px}.kp b{font-size:18px;margin-right:4px}.kp .bad b{color:#c0392b}' +
      '.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}ul{margin:0;padding-left:18px}li{margin:2px 0}i{color:#7a7f7a;font-style:normal}.none{color:#9aa;margin:0}' +
      'table{width:100%;border-collapse:collapse;margin:6px 0}th,td{text-align:left;border-bottom:1px solid #e5e5e5;padding:5px 8px}th{font-size:11px;text-transform:uppercase;color:#777}' +
      '.bar{display:inline-block;width:140px;height:8px;background:#eee;border-radius:9px;vertical-align:middle;overflow:hidden}.bar i{display:block;height:100%;background:#7aa65f}' +
      '.noprint{margin-bottom:16px}@media print{.noprint{display:none}body{margin:12mm}}</style></head><body>' +
      '<div class="noprint"><button onclick="print()">🖨 Print / Save as PDF</button></div>' +
      '<h1>Weekly report — ' + esc((p.code ? p.code + ' ' : '') + p.name) + '</h1><div class="sub">' + nice(from) + ' – ' + nice(to) + ' · prepared ' + esc(now.toLocaleString()) + (user ? ' by ' + esc(user) : '') + '</div>' +
      mine + team + qa + '<p class="sub" style="margin-top:26px">Made with Lew’s Tracker — Weekly report skill.</p></body></html>';
  }

  LT.fn['weekly-report'] = {
    build: build,
    run: function (ctx) {
      var html = build(ctx);
      var w = window.open('', '_blank');
      if (!w) { ctx.download('Weekly_report_' + ctx.today() + '.html', new Blob([html], { type: 'text/html' })); ctx.toast('Pop-up blocked — downloaded the report instead'); return; }
      w.document.open(); w.document.write(html); w.document.close();
    }
  };
})();
