/* ═══ core/todo-link.js — "➕ My To Do" inside a feature page ═══════
   Used by Delegation, QA/QC and the MIDP Checker.
   • Inside Lew's Tracker it talks to the To Do list (window.parent.LTLinks).
   • In an offline copy it uses LT_OFFLINE_TODO (made by core/offline.js):
     it shows the To Do tasks that were linked when the copy was made, and
     new "➕ My To Do" tasks wait in the copy until "Save work for website".
   A link: { f:'midp'|'qaqc'|'deleg', t:'d'|'l'|'s'|'t', k:key, … }
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function api() {
    try { if (window.parent !== window && window.parent.LTLinks) return window.parent.LTLinks; } catch (e) { /* other site */ }
    return window.LT_OFFLINE_TODO || null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var ST = { todo: 'To do', progress: 'Doing', waiting: 'Waiting', done: 'Done', queued: 'Saved for website' };
  function chip(t) {
    return '<button type="button" class="ltt-chip' + (t.status === 'done' ? ' done' : '') + '" data-todo-open="' + esc(t.id) + '" title="Open in my To Do">📝 ' + esc(t.title) +
      ' <span>' + esc(ST[t.status] || t.status || '') + (t.due ? ' · ' + esc(t.due) : '') + '</span></button>';
  }
  /* The To Do tasks linked to this item, and a button to add one */
  function html(link, o) {
    var a = api(); if (!a) return '';
    o = o || {};
    var list = a.tasksFor(link) || [];
    return '<span class="ltt" data-ltt="' + esc(JSON.stringify(link)) + '">' + list.map(chip).join('') +
      '<button type="button" class="ltt-add' + (o.small ? ' sm' : '') + '" data-todo-add title="Make a task in my To Do list, linked to this">➕ ' + (list.length ? 'Another To Do' : 'My To Do') + '</button></span>';
  }
  /* Just a small 📝 mark when a To Do task is linked (for list rows) */
  function badge(link) {
    var a = api(); if (!a) return '';
    var n = (a.tasksFor(link) || []).filter(function (t) { return t.status !== 'done'; }).length;
    return n ? '<span class="ltt-badge" title="' + n + ' task' + (n > 1 ? 's' : '') + ' in my To Do">📝' + (n > 1 ? n : '') + '</span>' : '';
  }
  document.addEventListener('click', function (e) {
    var add = e.target.closest && e.target.closest('[data-todo-add]'), open = e.target.closest && e.target.closest('[data-todo-open]');
    if (!add && !open) return;
    e.preventDefault(); e.stopPropagation();
    var a = api(); if (!a) return;
    if (open) { a.openTask(open.getAttribute('data-todo-open')); return; }
    var box = add.closest('[data-ltt]'), link;
    try { link = JSON.parse(box.getAttribute('data-ltt')); } catch (er) { return; }
    var t = a.addFromFeature(link);
    if (t) box.outerHTML = html(link);
  }, true);

  var st = document.createElement('style');
  st.textContent = '.ltt{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center}' +
    '.ltt-chip,.ltt-add{font:inherit;font-size:12px;line-height:1.3;border:1px solid currentColor;border-radius:999px;padding:3px 10px;background:transparent;color:inherit;cursor:pointer;text-align:left}' +
    '.ltt-chip span{opacity:.65}.ltt-chip.done{opacity:.55;text-decoration:line-through}.ltt-add{border-style:dashed;opacity:.85}.ltt-add.sm{padding:2px 8px;font-size:11px}' +
    '.ltt-badge{font-size:11px;margin-left:4px;cursor:default}';
  (document.head || document.documentElement).appendChild(st);
  window.LTTodoLink = { html: html, badge: badge, api: api };
})();
