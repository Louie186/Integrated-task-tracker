/* ═══ SKILL (add-on): Project pulse ════════════════════════════════
   A dashboard card for the open project: team tasks (Delegation),
   QA/QC issues and the Register — tap a tile to jump there.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var esc = LT.esc;
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function delegation() {
    var D = LT.readJSON('lt_delegate_v1', null); if (!D || !D.tasks) return null;
    var today = iso(new Date()), week = new Date(); week.setDate(week.getDate() + 7); var wk = iso(week);
    var open = 0, late = 0, soon = 0, items = 0, done = 0;
    D.tasks.forEach(function (t) {
      var list = t.subs && t.subs.length ? t.subs.map(function (s) { return { due: s.due || t.due, st: s.status }; }) : [{ due: t.due, st: t.status }];
      list.forEach(function (x) {
        items++;
        if (x.st === 'Completed') { done++; return; }
        open++;
        if (x.due && x.due < today) late++; else if (x.due && x.due <= wk) soon++;
      });
    });
    return { open: open, late: late, soon: soon, pct: items ? Math.round(done / items * 100) : 0 };
  }
  function qaqc() {
    var q = LT.readJSON('lews_qaqc_state_v1', null); if (!q || !q.projects) return null;
    var p = q.projects.filter(function (x) { return x.id === q.activeId; })[0] || q.projects[0]; if (!p) return null;
    var sheets = (p.sheets || []).filter(function (s) { return !s.archived; }), issues = 0, done = 0;
    sheets.forEach(function (s) {
      var st = typeof qaqcStatus === 'function' ? qaqcStatus(s) : (s.verified ? 'done' : '');
      if (st === 'issue') issues++; if (st === 'done') done++;
    });
    return { name: p.name, items: sheets.length, issues: issues, done: done };
  }
  function register() {
    var r = LT.readJSON('lt_dreg_v1', null); if (!r || !r.midp) return null;
    var sent = {}; (r.subs || []).forEach(function (s) { (s.items || []).forEach(function (it) { sent[it.key] = 1; }); });
    var rows = r.midp.rows || [], n = rows.filter(function (d) { return sent[d.key]; }).length;
    return { drawings: rows.length, sent: n, models: (r.midp.models || []).length + ((r.models && r.models.rows) || []).length };
  }
  function tile(view, big, label, sub, bad) {
    return '<button class="pulse-tile' + (bad ? ' bad' : '') + '" onclick="show(\'' + view + '\')"><b>' + big + '</b><span>' + esc(label) + '</span><small>' + esc(sub) + '</small></button>';
  }
  function render() {
    var dash = document.getElementById('dashboard'); if (!dash || !LT.data()) return;
    var card = document.getElementById('pulseCard');
    if (!card) {
      card = document.createElement('div'); card.id = 'pulseCard'; card.className = 'card pulse-card';
      var anchor = dash.querySelector('.grid.auto'); dash.insertBefore(card, anchor || dash.firstChild);
      var br = document.createElement('br'); dash.insertBefore(br, card.nextSibling);
    }
    var p = window.LTProjects ? LTProjects.active() : { name: 'Project' };
    var d = LT.isOn('delegate') ? delegation() : null, q = LT.isOn('qaqc') ? qaqc() : null, r = LT.isOn('register') ? register() : null;
    var tiles = '';
    if (LT.isOn('delegate')) tiles += d ? tile('delegate', d.open, 'Team tasks open', d.pct + '% done', false) + tile('delegate', d.late, 'Overdue', d.soon + ' due in 7 days', d.late > 0)
      : tile('delegate', '0', 'Team tasks', 'Give out the first one', false);
    if (q) tiles += tile('qaqc', q.issues, 'QA/QC issues', q.done + ' / ' + q.items + ' verified', q.issues > 0);
    if (r && r.drawings) tiles += tile('register', r.drawings, 'Drawings in MIDP', r.sent + ' sent · ' + r.models + ' models', false);
    card.innerHTML = '<div class="task-head" style="margin-bottom:8px"><h3 style="margin:0">📁 ' + esc(p.name) + ' <span class="small">— project pulse</span></h3>' +
      '<button class="btn" onclick="LTProjects.open()">Switch project</button></div><div class="pulse-grid">' + tiles + '</div>';
  }
  var css = document.createElement('style');
  css.textContent = '.pulse-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}' +
    '.pulse-tile{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:12px 14px;border:1px solid var(--line);border-radius:16px;background:var(--soft);color:var(--ink);cursor:pointer;text-align:left;font:inherit}' +
    '.pulse-tile:hover{border-color:var(--accent)}.pulse-tile b{font-size:1.6rem;line-height:1}.pulse-tile span{font-weight:700;font-size:.8rem}.pulse-tile small{color:var(--muted);font-size:.72rem}' +
    '.pulse-tile.bad b{color:var(--red)}html.lt-pixel .pulse-tile{border:2px solid var(--edge)!important;box-shadow:3px 3px 0 var(--edge)}html.lt-pixel .pulse-tile b{font-family:var(--px-font);font-weight:400}';
  document.head.appendChild(css);
  // refresh whenever the dashboard redraws, and when a skill saves
  if (typeof window.dashboard === 'function') {
    var orig = window.dashboard;
    window.dashboard = function () { var r = orig.apply(this, arguments); try { render(); } catch (e) { console.warn('pulse', e); } return r; };
  }
  // skill pages save into the same browser storage → the "storage" event tells us
  window.addEventListener('storage', function (e) { if (/^(lt_delegate_v1|lews_qaqc_state_v1|lt_dreg_v1)$/.test(e.key || '')) render(); });
  setTimeout(render, 300);
  LT.pulse = render;
})();
