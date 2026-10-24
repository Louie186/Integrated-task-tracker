/* ═══ SKILL (add-on): Reminders ════════════════════════════════════
   • Once a day after you sign in: what is due today / overdue in your
     To Do list and in the open project's Delegation.
   • Optional desktop notifications (Settings → Reminders).
   • Backup nudge when your last Export / Cloud Sync is over 7 days old.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var esc = LT.esc;
  function today() { return LT.today(); }
  function who() { return LT.user(); }
  function key(k) { return 'lt_alerts_' + k + '_' + who(); }

  function collect() {
    var t = today(), out = { mineToday: [], mineLate: [], teamToday: [], teamLate: [] };
    ((LT.data() && LT.data().tasks) || []).forEach(function (x) {
      if (x.status === 'done' || !x.due) return;
      if (x.due === t) out.mineToday.push(x.title); else if (x.due < t) out.mineLate.push(x.title);
    });
    if (LT.isOn('delegate')) {
      var D = LT.readJSON('lt_delegate_v1', null);
      ((D && D.tasks) || []).forEach(function (task) {
        var list = task.subs && task.subs.length ? task.subs.map(function (s) { return { title: s.title, due: s.due || task.due, st: s.status, who: s.assignees }; }) : [{ title: task.title, due: task.due, st: task.status, who: task.assignees }];
        list.forEach(function (i) {
          if (i.st === 'Completed' || !i.due) return;
          var label = i.title + (i.who ? ' (' + i.who + ')' : '');
          if (i.due === t) out.teamToday.push(label); else if (i.due < t) out.teamLate.push(label);
        });
      });
    }
    return out;
  }
  function daily() {
    if (!LT.data() || !who()) return;
    if (localStorage.getItem(key('day')) === today()) return;
    localStorage.setItem(key('day'), today());
    var c = collect(), parts = [];
    var n = function (k, one, many) { return k + ' ' + (k === 1 ? one : many); };
    if (c.mineLate.length) parts.push(n(c.mineLate.length, 'of your tasks overdue', 'of your tasks overdue'));
    if (c.mineToday.length) parts.push(n(c.mineToday.length, 'task due today', 'tasks due today'));
    if (c.teamLate.length) parts.push(n(c.teamLate.length, 'team item overdue', 'team items overdue'));
    if (c.teamToday.length) parts.push(n(c.teamToday.length, 'team item due today', 'team items due today'));
    if (!parts.length) return;
    var msg = '🔔 ' + parts.join(' · ');
    setTimeout(function () { LT.toast(msg); }, 2600);
    if (localStorage.getItem(key('desk')) === '1' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification("Lew's Tracker — today", { body: parts.join('\n') + (c.teamLate.length ? '\nLate: ' + c.teamLate.slice(0, 3).join(', ') : ''), icon: 'icons/icon-192.png' });
      } catch (e) {}
    }
  }

  /* ---------- backup nudge ---------- */
  function lastBackup() {
    var t = function (k) { var v = localStorage.getItem(k); return v ? (Date.parse(v) || 0) : 0; };
    var a = t('lt_last_backup');
    var b = localStorage.getItem('lew_gist_token') ? t('lew_gist_local_updated') : 0;
    return Math.max(a, b);
  }
  function backupNudge() {
    if (!LT.data() || !who() || who() === 'guest') return;
    if (LT.data().settings && LT.data().settings.backupHint === false) return;
    if (localStorage.getItem(key('bk')) === today()) return;
    var hasData = (LT.data().tasks || []).length || (LT.data().notes || []).length;
    if (!hasData) return;
    var last = lastBackup(), days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    if (days !== null && days < 7) return;
    localStorage.setItem(key('bk'), today());
    setTimeout(function () { LT.toast('💾 ' + (days === null ? 'No backup yet' : 'Last backup ' + days + ' days ago') + ' — Export or Cloud Sync in Settings'); }, 6000);
  }
  // remember when you exported
  function wrapExport() {
    if (typeof window.exportData !== 'function' || window.exportData.__lt) return;
    var orig = window.exportData;
    window.exportData = function () { var r = orig.apply(this, arguments); try { localStorage.setItem('lt_last_backup', new Date().toISOString()); } catch (e) {} return r; };
    window.exportData.__lt = true;
  }

  /* ---------- Settings → Reminders card ---------- */
  function card() {
    var sec = document.getElementById('settings'); if (!sec || document.getElementById('ltAlertsCard')) return;
    var c = document.createElement('div'); c.className = 'card'; c.id = 'ltAlertsCard';
    var anchor = document.getElementById('ltSkillsCard');
    if (anchor && anchor.nextSibling) sec.insertBefore(c, anchor.nextSibling); else sec.appendChild(c);
    var br = document.createElement('br'); sec.insertBefore(br, c);
    paint();
  }
  function paint() {
    var c = document.getElementById('ltAlertsCard'); if (!c) return;
    var on = localStorage.getItem(key('desk')) === '1', perm = 'Notification' in window ? Notification.permission : 'unsupported';
    var last = lastBackup();
    c.innerHTML = '<h3>🔔 Reminders</h3><p class="small">Once a day after you sign in you get a short summary of what is due or overdue — your To Do list and your team (Delegation).</p>' +
      '<label class="small"><input type="checkbox" style="width:auto" ' + (on && perm === 'granted' ? 'checked' : '') + (perm === 'unsupported' ? ' disabled' : '') + ' onchange="LT.alerts.setDesktop(this.checked)"> Also show desktop notifications' + (perm === 'denied' ? ' (blocked in browser settings)' : '') + '</label>' +
      '<p class="small" style="margin-top:10px">Last backup: <b>' + (last ? esc(new Date(last).toLocaleString()) : 'never') + '</b> — you get a nudge after 7 days (switch off with “Remind me to export backups” above).</p>' +
      '<button class="btn" onclick="LT.alerts.preview()">Show today’s summary now</button>';
  }
  LT.alerts = {
    setDesktop: function (v) {
      if (!v) { localStorage.removeItem(key('desk')); paint(); return; }
      if (!('Notification' in window)) return;
      Notification.requestPermission().then(function (p) { if (p === 'granted') localStorage.setItem(key('desk'), '1'); paint(); });
    },
    preview: function () {
      var c = collect(), li = function (a) { return a.length ? '<ul>' + a.slice(0, 12).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="small">Nothing 🎉</p>'; };
      LT.modal('🔔 Today', '<h4>Your tasks — overdue</h4>' + li(c.mineLate) + '<h4>Your tasks — due today</h4>' + li(c.mineToday) +
        '<h4>Team — overdue</h4>' + li(c.teamLate) + '<h4>Team — due today</h4>' + li(c.teamToday), { width: 560 });
    }
  };

  // start once the tracker is signed in
  var tm = setInterval(function () {
    wrapExport();
    if (LT.data() && who()) { clearInterval(tm); card(); daily(); backupNudge(); }
  }, 1000);
})();
