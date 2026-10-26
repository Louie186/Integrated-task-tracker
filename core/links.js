/* ═══ core/links.js — To Do links + "All tasks" ═════════════════════
   • 🔗 Link a To Do task to MIDP drawings / lists, QA/QC checklists or a
     Delegation task. A link is kept ON the To Do task (t.links) with the
     project it belongs to and a key that does not change:
       MIDP drawing  { f:'midp', t:'d', p, k: number without revision, ok: number before your correction }
       MIDP list     { f:'midp', t:'l', p, k: list id }
       QA/QC         { f:'qaqc', t:'s', qp: QA/QC project id, k: checklist id }
       Delegation    { f:'deleg', t:'t', p, k: task id }
     Each link also keeps a label, so it still reads well when the item is
     in another project, gone, or in an offline copy.
   • Status comes live from each feature (read only — a link never changes
     the MIDP, QA/QC or Delegation). When all linked work is finished the
     task asks "Mark done?"; an earlier MIDP / team date shows a warning.
   • ⇶ Delegate a To Do task, 📣 Chase late team work.
   • 🌐 All tasks: your To Do + team + QA/QC + MIDP in one list, only
     what needs action unless you choose "Everything".
   • Feature pages use LTLinks through core/todo-link.js (➕ My To Do).
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var UIKEY = 'lt_alltasks_ui';
  var UI = Object.assign({ on: false, scope: 'action', src: { mine: true, team: true, qa: true, midp: true }, q: '', midpOpen: false }, LT.readJSON(UIKEY, {}));
  function saveUI() { LT.writeJSON(UIKEY, UI); }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ICON = { midp: '▦', qaqc: '☑', deleg: '⇶', mine: '📝' };
  function today() { return LT.today(); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function nice(iso) { if (!iso) return ''; var d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); }
  function proj() { return window.LTProjects ? LTProjects.active() : { id: 'default', name: 'Project' }; }
  function projName(id) { var l = window.LTProjects ? LTProjects.list() : []; var p = l.filter(function (x) { return x.id === id; })[0]; return p ? p.name : 'another project'; }
  function tasks() { var d = LT.data(); return (d && d.tasks) || []; }
  function taskById(id) { return tasks().filter(function (t) { return String(t.id) === String(id); })[0]; }
  function persist() { try { save(); renderAll(); } catch (e) { /* app not ready */ } }
  function U(s) { return String(s == null ? '' : s).toUpperCase().trim(); }

  /* ---------- reading each feature (cached until its data changes) ---------- */
  var cache = {};
  function cached(key, fn) {
    var raw = localStorage.getItem(key);
    if (cache[key] && cache[key].raw === raw) return cache[key].v;
    var v = null; try { v = fn(raw ? JSON.parse(raw) : null); } catch (e) { v = null; }
    cache[key] = { raw: raw, v: v }; return v;
  }
  function midp() {
    return cached('tidp-checker:index', function (X) {
      if (!X || !X.rows) return null;
      var byBase = new Map(), byKey = new Map(), rows = X.rows.map(function (r) {
        return { key: r[0], num: r[1], title: r[2], rev: r[3], base: r[12] || U(r[1]), due: r[13] || '', dueIso: r[14] || '', stage: r[15] || '', sends: +r[16] || 0, obase: r[17] || '' };
      });
      rows.forEach(function (d) { byKey.set(d.key, d); if (!byBase.has(d.base)) byBase.set(d.base, d); if (d.obase && !byBase.has(d.obase)) byBase.set(d.obase, d); });
      var lists = new Map(); (X.lists || []).forEach(function (l) { lists.set(l[0], { id: l[0], name: l[1], keys: l[2] || [] }); });
      return { rows: rows, byBase: byBase, byKey: byKey, lists: lists, file: X.file };
    });
  }
  function qa() { return cached('lews_qaqc_state_v1', function (d) { return d && d.projects ? d : null; }); }
  function team() { return cached('lt_delegate_v1', function (d) { return d && d.tasks ? d : null; }); }
  function qaState(s) {
    var items = s.items || [], ch = s.checks || {}, vals = Object.keys(ch).map(function (k) { return ch[k]; });
    var pass = vals.filter(function (v) { return v === 'pass'; }).length, fail = vals.filter(function (v) { return v === 'fail'; }).length;
    return { st: s.verified ? 'done' : fail ? 'issue' : items.length && pass === items.length ? 'ready' : pass || fail ? 'prog' : 'todo', pass: pass, fail: fail, n: items.length };
  }
  function teamStatus(t) {
    if (t.subs && t.subs.length) { var done = t.subs.filter(function (s) { return s.status === 'Completed'; }).length; return done === t.subs.length ? 'Completed' : done || t.subs.some(function (s) { return s.status === 'In progress'; }) ? 'In progress' : 'Not started'; }
    return t.status || 'Not started';
  }

  /* ---------- one link → what it is now ---------- */
  // state: done · open · late · soon · gone (not found) · away (other project) · nodata (feature not loaded yet)
  function resolve(l) {
    var here = !l.p || l.p === proj().id, r = { icon: ICON[l.f] || '🔗', label: l.label || l.k, state: 'open', sub: '', due: '' };
    if (!here && l.f !== 'qaqc') { r.state = 'away'; r.sub = 'In ' + projName(l.p); return r; }
    if (l.f === 'midp') {
      var M = midp(); if (!M) { r.state = 'nodata'; r.sub = 'Open the MIDP Checker once to see its status'; return r; }
      if (l.t === 'l') {
        var li = M.lists.get(l.k); if (!li) { r.state = 'gone'; r.sub = 'List not found'; return r; }
        var ds = li.keys.map(function (k) { return M.byKey.get(k); }).filter(Boolean), sent = ds.filter(function (d) { return d.sends; }).length;
        r.label = '📌 ' + li.name; r.sub = sent + ' of ' + ds.length + ' sent';
        r.state = ds.length && sent === ds.length ? 'done' : ds.some(function (d) { return d.due === 'overdue' && !d.sends; }) ? 'late' : 'open';
        r.due = ds.filter(function (d) { return !d.sends && d.dueIso; }).map(function (d) { return d.dueIso; }).sort()[0] || '';
        return r;
      }
      var d = M.byBase.get(l.k) || (l.ok && M.byBase.get(l.ok));
      if (!d) { r.state = 'gone'; r.sub = 'Not in the latest TIDP'; return r; }
      r.label = d.num; r.title = d.title; r.key = d.key;
      r.state = d.sends ? 'done' : d.due === 'overdue' ? 'late' : d.due === 'soon' ? 'soon' : 'open';
      r.sub = d.sends ? 'Sent ' + d.sends + '×' : d.stage ? d.stage + (d.dueIso ? ' · due ' + nice(d.dueIso) : '') : 'Not sent';
      r.due = d.sends ? '' : d.dueIso; return r;
    }
    if (l.f === 'qaqc') {
      var Q = qa(), p = Q && Q.projects.filter(function (x) { return x.id === l.qp; })[0], s = p && (p.sheets || []).filter(function (x) { return x.id === l.k; })[0];
      if (!s) { r.state = 'gone'; r.sub = 'Checklist not found'; return r; }
      var q = qaState(s);
      r.label = s.number + (s.title ? ' — ' + s.title : '');
      r.state = q.st === 'done' ? 'done' : q.st === 'issue' ? 'late' : 'open';
      r.sub = q.st === 'done' ? 'Verified' : q.pass + '/' + q.n + ' checked' + (q.fail ? ' · ' + q.fail + ' issue' + (q.fail > 1 ? 's' : '') : '');
      return r;
    }
    if (l.f === 'deleg') {
      var T = team(), t = T && T.tasks.filter(function (x) { return x.id === l.k; })[0];
      if (!t) { r.state = 'gone'; r.sub = 'Team task not found'; return r; }
      var st = teamStatus(t);
      r.label = t.code + ' ' + t.title; r.due = st === 'Completed' ? '' : t.due || '';
      r.state = st === 'Completed' ? 'done' : t.due && t.due < today() ? 'late' : t.due && t.due <= addDays(7) ? 'soon' : 'open';
      r.sub = (t.assignees ? t.assignees + ' · ' : '') + st + (t.due && st !== 'Completed' ? ' · due ' + nice(t.due) : '');
      return r;
    }
    return r;
  }
  function summary(t) {
    var ls = t.links || [], rs = ls.map(resolve);
    var known = rs.filter(function (r) { return r.state !== 'away' && r.state !== 'nodata'; });
    var allDone = rs.length > 0 && known.length === rs.length && rs.every(function (r) { return r.state === 'done'; });
    var due = rs.map(function (r) { return r.due; }).filter(Boolean).sort()[0] || '';
    return { rs: rs, allDone: allDone, due: due, early: due && t.status !== 'done' && (!t.due || due < t.due) ? due : '' };
  }

  /* ---------- on the To Do rows ---------- */
  function rowChips(t) {
    if (!t.links || !t.links.length) return '';
    var s = summary(t), h = '';
    s.rs.slice(0, 2).forEach(function (r, i) { h += '<span class="ltl ltl-' + r.state + '" data-ltl="open" data-t="' + t.id + '" data-i="' + i + '" title="' + esc(r.sub) + '">' + r.icon + ' ' + esc(r.label) + '</span>'; });
    if (s.rs.length > 2) h += '<span class="ltl">+' + (s.rs.length - 2) + '</span>';
    if (s.early) h += '<span class="pill overdue" title="A linked item is due earlier than this task">⚠ due ' + esc(nice(s.early)) + '</span>';
    if (s.allDone && t.status !== 'done') h += '<button class="ltl ltl-ask" data-ltl="markdone" data-t="' + t.id + '" title="Everything linked to this task is finished">✓ Linked work done — mark done?</button>';
    return h;
  }
  function openPanel(t) {
    var s = summary(t);
    return '<div class="ltl-panel"><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" data-ltl="link" data-t="' + t.id + '">🔗 Link to MIDP / QA/QC / team</button>' +
      '<button class="btn" data-ltl="delegate" data-t="' + t.id + '">⇶ Delegate</button></div>' +
      (s.rs.length ? '<div class="ltl-list">' + s.rs.map(function (r, i) {
        return '<div class="ltl-li"><span class="ltl ltl-' + r.state + '" data-ltl="open" data-t="' + t.id + '" data-i="' + i + '">' + r.icon + ' ' + esc(r.label) + '</span>' +
          '<span class="small">' + esc(r.title ? r.title + ' · ' : '') + esc(r.sub) + '</span><button class="icon" data-ltl="unlink" data-t="' + t.id + '" data-i="' + i + '" title="Remove this link (nothing else is deleted)">×</button></div>';
      }).join('') + '</div>' : '') + '</div>';
  }

  /* ---------- opening a linked item in its feature ---------- */
  function inFrame(id, ready, fn) {
    if (typeof show === 'function') show(id);
    var n = 0, tick = function () {
      var f = LT.frame(id), w = null; try { w = f && f.contentWindow; } catch (e) { w = null; }
      if (w && ready(w)) { try { fn(w); } catch (e) { console.error(e); } return; }
      if (++n < 60) setTimeout(tick, 200);
    };
    setTimeout(tick, 150);
  }
  function openLink(l) {
    if (l.f !== 'qaqc' && l.p && l.p !== proj().id) {
      if (confirm('This is in the project "' + projName(l.p) + '". Open that project now?')) LTProjects.switchTo(l.p);
      return;
    }
    if (l.f === 'midp') {
      var M = midp(), d = M && (M.byBase.get(l.k) || (l.ok && M.byBase.get(l.ok)));
      inFrame('tidp', function (w) { return w.MIDP && w.MIDP.S && w.MIDP.S.built; }, function (w) {
        if (l.t === 'l') { w.MIDP.go('lists'); if (w.MIDP.ACTIONS.lsopen) w.MIDP.ACTIONS.lsopen({ getAttribute: function () { return l.k; } }); }
        else if (d) w.MIDP.openDetail(d.key);
      });
    } else if (l.f === 'qaqc') inFrame('qaqc', function (w) { return typeof w.QAQC_OPEN === 'function'; }, function (w) { w.QAQC_OPEN(l.qp, l.k); });
    else if (l.f === 'deleg') inFrame('delegate', function (w) { return typeof w.DELEG_OPEN === 'function'; }, function (w) { w.DELEG_OPEN(l.k); });
  }
  function openTask(id) {
    if (UI.on) { UI.on = false; saveUI(); }
    if (typeof show === 'function') show('tasks');
    try { openTaskId = Number(id) || id; renderTasks(); } catch (e) { /* app not ready */ }
    setTimeout(function () { var el = document.querySelector('[data-tid="' + id + '"]'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 120);
  }

  /* ---------- links made from a feature page (➕ My To Do) ---------- */
  function cleanLink(l) {
    var o = { f: l.f, t: l.t, k: l.k, label: l.label || l.k };
    if (l.ok && l.ok !== l.k) o.ok = l.ok;
    if (l.f === 'qaqc') o.qp = l.qp; else o.p = l.p || proj().id;
    return o;
  }
  function same(a, b) {
    if (a.f !== b.f || a.t !== b.t) return false;
    if (a.f === 'qaqc') return a.qp === b.qp && a.k === b.k;
    if (a.f !== 'qaqc' && a.p && b.p && a.p !== b.p) return false;
    return a.k === b.k || (a.f === 'midp' && a.t === 'd' && ((b.ok && a.k === b.ok) || (a.ok && (a.ok === b.k || a.ok === b.ok))));
  }
  function tasksFor(link) {
    var l = cleanLink(link);
    return tasks().filter(function (t) { return (t.links || []).some(function (x) { return same(x, l); }); })
      .map(function (t) { return { id: t.id, title: t.title, status: t.status, due: t.due }; });
  }
  function addTask(o) {
    if (typeof createTask !== 'function') { LT.toast('Open the tracker first'); return null; }
    var t = createTask({ title: o.title || 'Untitled', due: o.due || today(), tags: o.tags || [], refs: o.refs || '', links: (o.links || []).map(cleanLink), fromInbox: o.fromInbox || undefined });
    return t;
  }
  function addFromFeature(link) {
    var title = link.title || link.label || 'Linked task';
    var t = addTask({ title: title, due: link.due && link.due >= today() ? link.due : today(), links: [link], tags: [link.f === 'midp' ? 'MIDP' : link.f === 'qaqc' ? 'QAQC' : 'Team'] });
    if (t) LT.toast('📝 Added to your To Do: ' + title);
    return t ? { id: t.id, title: t.title, status: t.status, due: t.due } : null;
  }
  /* for offline copies: the To Do tasks linked to one feature of this project */
  function snapshotFor(fid) {
    var f = fid === 'tidp' ? 'midp' : fid === 'delegate' ? 'deleg' : fid, p = proj().id;
    return tasks().filter(function (t) { return (t.links || []).some(function (l) { return l.f === f && (f === 'qaqc' || !l.p || l.p === p); }); })
      .map(function (t) { return { id: t.id, title: t.title, status: t.status, due: t.due, links: (t.links || []).filter(function (l) { return l.f === f; }) }; });
  }
  /* after offline work comes back: add its queued To Do tasks, then count links that no longer point anywhere */
  function fromOffline(fid, inbox) {
    var have = {}, n = 0;
    tasks().forEach(function (t) { if (t.fromInbox) have[t.fromInbox] = 1; });
    (inbox || []).forEach(function (q) { if (have[q.id]) return; addTask({ title: q.title, due: q.due, links: q.links, tags: q.tags, fromInbox: q.id }); n++; });
    var f = fid === 'tidp' ? 'midp' : fid === 'delegate' ? 'deleg' : fid, gone = 0, all = 0;
    tasks().forEach(function (t) { (t.links || []).forEach(function (l) { if (l.f !== f) return; all++; if (resolve(l).state === 'gone') gone++; }); });
    return { added: n, links: all, gone: gone };
  }

  /* ---------- 🔗 Link dialog ---------- */
  var DLG = null;
  function linkDialog(id) {
    var t = taskById(id); if (!t) return;
    DLG = { id: t.id, tab: midp() ? 'midp' : qa() ? 'qaqc' : 'deleg', q: '', pick: [] };
    LT.modal('🔗 Link “' + esc(t.title) + '”', '<div id="ltlDlg"></div>', { width: 720 });
    drawDialog();
  }
  function drawDialog() {
    var box = document.getElementById('ltlDlg'); if (!box || !DLG) return;
    var t = taskById(DLG.id), have = (t.links || []), q = U(DLG.q), rows = [];
    var tab = function (k, label) { return '<button class="btn' + (DLG.tab === k ? ' primary' : '') + '" data-ltl="dtab" data-v="' + k + '">' + label + '</button>'; };
    var picked = function (l) { return DLG.pick.some(function (x) { return same(x, l); }) || have.some(function (x) { return same(x, l); }); };
    var p = proj().id;
    if (DLG.tab === 'midp') {
      var M = midp();
      if (M) {
        M.lists.forEach(function (li) { if (!q || U(li.name).indexOf(q) >= 0) rows.push({ l: { f: 'midp', t: 'l', p: p, k: li.id, label: '📌 ' + li.name }, a: '📌 ' + li.name, b: li.keys.length + ' drawings (list)' }); });
        M.rows.forEach(function (d) { if (q && U(d.num + ' ' + d.title).indexOf(q) < 0) return; rows.push({ l: { f: 'midp', t: 'd', p: p, k: d.base, ok: d.obase, label: d.num }, a: d.num, b: d.title + (d.dueIso && !d.sends ? ' · due ' + nice(d.dueIso) : d.sends ? ' · sent' : '') }); });
      }
    } else if (DLG.tab === 'qaqc') {
      var Q = qa();
      (Q ? Q.projects : []).forEach(function (pr) {
        (pr.sheets || []).forEach(function (s) {
          if (s.archived) return; var lab = s.number + (s.title ? ' — ' + s.title : '');
          if (q && U(lab + ' ' + pr.name).indexOf(q) < 0) return;
          var st = qaState(s); rows.push({ l: { f: 'qaqc', t: 's', qp: pr.id, k: s.id, label: lab }, a: lab, b: (pr.code ? pr.code + ' ' : '') + pr.name + ' · ' + st.pass + '/' + st.n + ' checked' });
        });
      });
    } else {
      var T = team();
      (T ? T.tasks : []).forEach(function (x) {
        if (q && U(x.code + ' ' + x.title + ' ' + x.assignees).indexOf(q) < 0) return;
        rows.push({ l: { f: 'deleg', t: 't', p: p, k: x.id, label: x.code + ' ' + x.title }, a: x.code + ' ' + x.title, b: (x.assignees || 'No one yet') + ' · ' + teamStatus(x) + (x.due ? ' · due ' + nice(x.due) : '') });
      });
    }
    DLG.rows = rows.slice(0, 80);
    var empty = DLG.tab === 'midp' ? (midp() ? 'Nothing matches.' : 'No MIDP yet — open the MIDP Checker and load the TIDP first.') : DLG.tab === 'qaqc' ? 'No QA/QC checklists match.' : 'No team tasks match.';
    box.innerHTML = '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">' + tab('midp', '▦ MIDP drawings & lists') + tab('qaqc', '☑ QA/QC') + tab('deleg', '⇶ Team tasks') + '</div>' +
      '<input id="ltlQ" placeholder="Search number, title, name…" value="' + esc(DLG.q) + '" autocomplete="off">' +
      '<div class="ltl-pick">' + (DLG.rows.map(function (r, i) {
        var on = picked(r.l), was = have.some(function (x) { return same(x, r.l); });
        return '<label class="ltl-row' + (on ? ' on' : '') + '"><input type="checkbox" data-ltl="pick" data-i="' + i + '"' + (on ? ' checked' : '') + (was ? ' disabled' : '') + '><span><b>' + esc(r.a) + '</b><small>' + esc(r.b) + (was ? ' · already linked' : '') + '</small></span></label>';
      }).join('') || '<div class="small" style="padding:10px">' + empty + '</div>') + (rows.length > 80 ? '<div class="small" style="padding:6px">Showing 80 of ' + rows.length + ' — search to narrow it down.</div>' : '') + '</div>' +
      '<div class="row" style="justify-content:space-between;margin-top:10px"><span class="small">' + DLG.pick.length + ' to add</span><span class="row" style="gap:6px"><button class="btn" onclick="LT.closeModal()">Cancel</button><button class="btn primary" data-ltl="dsave">Save links</button></span></div>';
  }

  /* ---------- ⇶ Delegate dialog ---------- */
  function delegateDialog(id) {
    var t = taskById(id); if (!t) return;
    var T = team() || { groups: [] }, people = LT.ctx.team();
    var checks = (t.checklist || []).filter(function (c) { return c.text; });
    LT.modal('⇶ Delegate “' + esc(t.title) + '”',
      '<datalist id="ltlPpl">' + people.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<div class="ltl-form"><label>Give it to<input id="ltlWho" list="ltlPpl" placeholder="Name (or names, comma between)"></label>' +
      '<label>Group<select id="ltlGrp"><option value="">No group</option>' + (T.groups || []).map(function (g) { return '<option>' + esc(g.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>Due<input id="ltlDue" type="date" value="' + esc(t.due || '') + '"></label>' +
      (checks.length ? '<label class="ltl-chk"><input type="checkbox" id="ltlSubs" checked style="width:auto"> Its ' + checks.length + ' checklist item' + (checks.length > 1 ? 's' : '') + ' become subtasks</label>' : '') +
      '<p class="small">It goes to Delegation (open project: ' + esc(proj().name) + '). Your To Do task stays, set to <b>Waiting</b> and linked — it asks to be marked done when the team finishes.</p></div>' +
      '<div class="row" style="justify-content:flex-end;gap:6px"><button class="btn" onclick="LT.closeModal()">Cancel</button><button class="btn primary" data-ltl="dgo" data-t="' + t.id + '">⇶ Delegate</button></div>', { width: 520 });
  }
  function doDelegate(id) {
    var t = taskById(id); if (!t) return;
    var who = document.getElementById('ltlWho').value.trim(), grp = document.getElementById('ltlGrp').value, due = document.getElementById('ltlDue').value;
    if (!who) { LT.toast('Who is it for?'); document.getElementById('ltlWho').focus(); return; }
    var subs = document.getElementById('ltlSubs') && document.getElementById('ltlSubs').checked ? (t.checklist || []).filter(function (c) { return c.text; }).map(function (c) { return { title: c.text, assignees: who, due: due }; }) : [];
    var made = LT.ctx.sendToDelegation([{ title: t.title, assignees: who, due: due, notes: t.refs || '', subs: subs }], grp);
    var d = made && made[0]; if (!d) return;
    t.links = t.links || []; t.links.push(cleanLink({ f: 'deleg', t: 't', k: d.id, label: d.code + ' ' + d.title }));
    if (t.status !== 'done') t.status = 'waiting';
    LT.closeModal(); persist();
  }
  function chase(k) {
    var T = team(), x = T && T.tasks.filter(function (y) { return y.id === k; })[0]; if (!x) return;
    addTask({ title: 'Chase ' + (x.assignees || 'team') + ': ' + x.code + ' ' + x.title, due: today(), tags: ['Chase'], links: [{ f: 'deleg', t: 't', k: x.id, label: x.code + ' ' + x.title }] });
    LT.toast('📣 Chase added to your To Do'); if (UI.on) draw();
  }
  function teamDone(k) {
    var D = LT.readJSON('lt_delegate_v1', null), x = D && D.tasks.filter(function (y) { return y.id === k; })[0]; if (!x) return;
    if (!confirm('Mark ' + x.code + ' "' + x.title + '" as completed in Delegation?')) return;
    var now = new Date().toISOString();
    x.status = 'Completed'; (x.subs || []).forEach(function (s) { s.status = 'Completed'; });
    x.history = x.history || []; x.history.push({ at: now, text: 'Marked completed from All tasks' }); x.updated = now;
    LT.writeJSON('lt_delegate_v1', D);
    var f = LT.frame('delegate'); if (f && f.getAttribute('src')) f.src = f.getAttribute('data-src');
    persist();
  }

  /* ---------- 🌐 All tasks ---------- */
  function allItems() {
    var out = [], soon = addDays(7), td = today(), act = UI.scope === 'action', p = proj().id;
    var linkedTo = function (l) { return tasks().some(function (t) { return t.status !== 'done' && (t.links || []).some(function (x) { return same(x, l); }); }); };
    if (UI.src.mine) tasks().forEach(function (t) {
      if (t.status === 'done') return;
      var s = summary(t), need = (t.due && t.due <= soon) || s.early || s.allDone || t.status === 'progress';
      if (act && !need) return;
      out.push({ src: 'mine', id: t.id, title: t.title, due: t.due, late: t.due && t.due < td, sub: (t.links || []).length ? (t.links.length + ' link' + (t.links.length > 1 ? 's' : '')) : statusText(t.status), ask: s.allDone, chips: rowChips(t) });
    });
    var T = team();
    if (UI.src.team && T) T.tasks.forEach(function (x) {
      var st = teamStatus(x); if (st === 'Completed') return;
      var late = x.due && x.due < td; if (act && !(x.due && x.due <= soon)) return;
      var l = { f: 'deleg', t: 't', p: p, k: x.id };
      out.push({ src: 'deleg', id: x.id, title: x.code + ' ' + x.title, due: x.due, late: late, sub: (x.assignees || 'No one yet') + ' · ' + st, link: l, chased: linkedTo(l) });
    });
    var Q = qa();
    if (UI.src.qa && Q) Q.projects.forEach(function (pr) {
      if (Q.projects.length > 1 && Q.activeId && pr.id !== Q.activeId) return;
      (pr.sheets || []).forEach(function (s) {
        if (s.archived) return; var q = qaState(s); if (q.st === 'done') return;
        if (act && !(q.st === 'issue' || q.st === 'ready')) return;
        var l = { f: 'qaqc', t: 's', qp: pr.id, k: s.id, label: s.number + (s.title ? ' — ' + s.title : '') };
        out.push({ src: 'qaqc', id: s.id, title: l.label, due: '', late: q.st === 'issue', sub: q.st === 'issue' ? q.fail + ' issue' + (q.fail > 1 ? 's' : '') : q.st === 'ready' ? 'Ready to verify' : q.pass + '/' + q.n + ' checked', link: l, chased: linkedTo(l) });
      });
    });
    // MIDP: a whole TIDP can have hundreds of late drawings, so it is ONE summary line
    // until you press "Show them" (or search for a number)
    var M = midp(), q = U(UI.q), mrows = [], late = 0, soonN = 0;
    if (UI.src.midp && M) M.rows.forEach(function (d) {
      if (d.sends || !d.dueIso) return;
      if (d.due === 'overdue') late++; else if (d.due === 'soon') soonN++;
      if (act && !(d.due === 'overdue' || d.due === 'soon')) return;
      var l = { f: 'midp', t: 'd', p: p, k: d.base, ok: d.obase, label: d.num };
      mrows.push({ src: 'midp', id: d.key, title: d.num, due: d.dueIso, late: d.due === 'overdue', sub: d.title + (d.stage ? ' · ' + d.stage : ''), link: l, chased: linkedTo(l) });
    });
    if (q) out = out.filter(function (i) { return U(i.title + ' ' + i.sub).indexOf(q) >= 0; });
    var ORDER = { mine: 0, deleg: 1, qaqc: 2, midp: 3 };
    out.sort(function (a, b) { return (ORDER[a.src] - ORDER[b.src]) || (b.late - a.late) || String(a.due || '9999').localeCompare(String(b.due || '9999')); });
    if (mrows.length) {
      var shown = UI.midpOpen || q ? mrows.filter(function (i) { return !q || U(i.title + ' ' + i.sub).indexOf(q) >= 0; }) : [];
      shown.sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); });
      if (!q || shown.length) out.push({ src: 'midp', sum: true, n: mrows.length, late: late, soon: soonN, open: UI.midpOpen || !!q });
      out = out.concat(shown);
    }
    return out;
  }
  function statusText(s) { return { todo: 'To do', progress: 'In progress', waiting: 'Waiting', done: 'Done' }[s] || s; }
  var LIMIT = 150;
  function allView() {
    var items = allItems(), counts = { mine: 0, deleg: 0, qaqc: 0, midp: 0 };
    items.forEach(function (i) { if (i.sum) counts.midp = i.n; else if (i.src !== 'midp') counts[i.src]++; });
    var chip = function (k, src, label) { return '<button class="chip-btn' + (UI.src[k] ? ' on' : '') + '" data-ltl="src" data-v="' + k + '">' + label + ' <b>' + counts[src] + '</b></button>'; };
    var h = '<div class="ltl-allbar"><div class="row" style="gap:6px;flex-wrap:wrap">' +
      '<button class="chip-btn' + (UI.scope === 'action' ? ' on' : '') + '" data-ltl="scope" data-v="action" title="Late, due in the next 7 days, issues, or linked work finished">⚡ Needs action</button>' +
      '<button class="chip-btn' + (UI.scope === 'all' ? ' on' : '') + '" data-ltl="scope" data-v="all">Everything open</button><span class="ltl-sep"></span>' +
      chip('mine', 'mine', '📝 Mine') + chip('team', 'deleg', '⇶ Team') + chip('qa', 'qaqc', '☑ QA/QC') + chip('midp', 'midp', '▦ MIDP') + '</div>' +
      '<input id="ltlAllQ" placeholder="Search all tasks…" value="' + esc(UI.q) + '"></div>';
    if (!items.length) return h + '<div class="empty"><span class="e-ic">✨</span>' + (UI.scope === 'action' ? 'Nothing needs action right now. Choose “Everything open” to see the rest.' : 'Nothing open.') + '</div>';
    h += '<div class="list ltl-all">' + items.slice(0, LIMIT).map(function (i) {
      var acts = '';
      if (i.sum) {
        return '<div class="item ltl-item ltl-sum' + (i.late ? ' late' : '') + '"><span class="ltl-src">▦</span><div class="ltl-main"><b>MIDP drawings not sent yet</b><small>' +
          (i.late ? '<span style="color:var(--red)">' + i.late + ' late</span> · ' : '') + i.soon + ' due soon' + (UI.scope === 'all' ? ' · ' + i.n + ' with a date' : '') + ' — the full chase list is in the MIDP Checker</small></div><span class="ltl-due"></span>' +
          '<div class="ltl-acts"><button class="btn" data-ltl="midpchase">Open chase list</button><button class="btn" data-ltl="midptoggle">' + (i.open ? 'Hide them' : 'Show them (' + i.n + ')') + '</button></div></div>';
      }
      if (i.src === 'mine') acts = (i.ask ? '<button class="btn" data-ltl="markdone" data-t="' + i.id + '">✓ Mark done</button>' : '') + '<button class="btn" data-ltl="opentodo" data-t="' + i.id + '">Open</button>';
      else {
        var lk = esc(JSON.stringify(i.link));
        acts = '<button class="btn" data-ltl="openlink" data-l="' + lk + '">Open</button>' +
          (i.src === 'deleg' ? (i.chased ? '<span class="small">📝 in To Do</span>' : '<button class="btn" data-ltl="chase" data-k="' + esc(i.id) + '" title="Add a reminder to your To Do to chase this">📣 Chase</button>') + '<button class="btn" data-ltl="teamdone" data-k="' + esc(i.id) + '">✓ Done</button>'
            : (i.chased ? '<span class="small">📝 in To Do</span>' : '<button class="btn" data-ltl="addlink" data-l="' + lk + '">➕ To Do</button>'));
      }
      return '<div class="item ltl-item' + (i.late ? ' late' : '') + '"><span class="ltl-src">' + (ICON[i.src] || '') + '</span>' +
        '<div class="ltl-main"><b>' + esc(i.title) + '</b><small>' + esc(i.sub) + '</small>' + (i.chips ? '<div class="ltl-chips">' + i.chips + '</div>' : '') + '</div>' +
        '<span class="ltl-due' + (i.late ? ' late' : '') + '">' + (i.due ? esc(nice(i.due)) : '') + (i.late ? ' · late' : '') + '</span><div class="ltl-acts">' + acts + '</div></div>';
    }).join('') + '</div>' + (items.length > LIMIT ? '<div class="small" style="padding:8px">Showing ' + LIMIT + ' of ' + items.length + ' — search or untick a source to narrow it down.</div>' : '');
    return h;
  }
  function draw() { if (typeof renderTasks === 'function') renderTasks(); paintBtn(); }
  function paintBtn() { var b = document.getElementById('allTasksBtn'); if (b) { b.textContent = UI.on ? '📝 My list' : '🌐 All tasks'; b.classList.toggle('primary', !!UI.on); } }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-ltl]'); if (!el) return;
    var a = el.getAttribute('data-ltl'), tid = el.getAttribute('data-t'), i = +el.getAttribute('data-i');
    if (a === 'pick') return;                                    // tick boxes: handled on change
    e.preventDefault(); e.stopPropagation();
    var t = tid ? taskById(tid) : null;
    if (a === 'open' && t) openLink(t.links[i]);
    else if (a === 'unlink' && t) { var l = t.links[i]; if (confirm('Remove the link to ' + (l.label || l.k) + '? Nothing else is deleted.')) { t.links.splice(i, 1); persist(); } }
    else if (a === 'markdone' && t) { if (typeof toggleDone === 'function' && t.status !== 'done') toggleDone(t.id); }
    else if (a === 'link') linkDialog(tid);
    else if (a === 'delegate') delegateDialog(tid);
    else if (a === 'dgo') doDelegate(tid);
    else if (a === 'dtab') { DLG.tab = el.getAttribute('data-v'); DLG.q = ''; drawDialog(); }
    else if (a === 'dsave') {
      var tt = taskById(DLG.id); tt.links = tt.links || [];
      DLG.pick.forEach(function (l) { if (!tt.links.some(function (x) { return same(x, l); })) tt.links.push(cleanLink(l)); });
      var n = DLG.pick.length; DLG = null; LT.closeModal(); persist(); if (n) LT.toast('🔗 ' + n + ' link' + (n > 1 ? 's' : '') + ' added');
    }
    else if (a === 'scope') { UI.scope = el.getAttribute('data-v'); saveUI(); draw(); }
    else if (a === 'src') { var k = el.getAttribute('data-v'); UI.src[k] = !UI.src[k]; saveUI(); draw(); }
    else if (a === 'opentodo') openTask(tid);
    else if (a === 'openlink') openLink(JSON.parse(el.getAttribute('data-l')));
    else if (a === 'addlink') { addFromFeature(JSON.parse(el.getAttribute('data-l'))); draw(); }
    else if (a === 'chase') chase(el.getAttribute('data-k'));
    else if (a === 'teamdone') teamDone(el.getAttribute('data-k'));
    else if (a === 'midptoggle') { UI.midpOpen = !UI.midpOpen; saveUI(); draw(); }
    else if (a === 'midpchase') inFrame('tidp', function (w) { return w.MIDP && w.MIDP.S && w.MIDP.S.built; }, function (w) { w.MIDP.go('chase'); });
  }, true);
  document.addEventListener('change', function (e) {
    var el = e.target; if (!el.matches || !el.matches('[data-ltl="pick"]') || !DLG) return;
    var r = DLG.rows[+el.getAttribute('data-i')]; if (!r) return;
    DLG.pick = DLG.pick.filter(function (x) { return !same(x, r.l); });
    if (el.checked) DLG.pick.push(r.l);
    drawDialog();
  });
  var qT = null;
  document.addEventListener('input', function (e) {
    if (e.target.id === 'ltlQ' && DLG) { clearTimeout(qT); var v = e.target.value; qT = setTimeout(function () { DLG.q = v; drawDialog(); var q = document.getElementById('ltlQ'); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } }, 200); }
    if (e.target.id === 'ltlAllQ') { clearTimeout(qT); var w = e.target.value; qT = setTimeout(function () { UI.q = w; saveUI(); draw(); var q = document.getElementById('ltlAllQ'); if (q) { q.focus(); q.setSelectionRange(w.length, w.length); } }, 250); }
  });
  // another tab or a feature page changed its data → refresh what is on screen
  window.addEventListener('storage', function (e) { if (/^(tidp-checker:index|lews_qaqc_state_v1|lt_delegate_v1)$/.test(e.key || '')) draw(); });

  window.LTLinks = {
    rowChips: rowChips, openPanel: openPanel, allOn: function () { return !!UI.on; }, allView: allView,
    toggleAll: function () { UI.on = !UI.on; saveUI(); draw(); },
    tasksFor: tasksFor, addFromFeature: addFromFeature, openTask: openTask, openLink: openLink,
    resolve: resolve, summary: summary, snapshotFor: snapshotFor, fromOffline: fromOffline, same: same
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintBtn); else paintBtn();
})();
