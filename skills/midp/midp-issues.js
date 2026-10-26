/* ═══════════════════════════════════════════════════════════════════
   skills/midp/midp-issues.js — the Issues tab of the MIDP Checker
   ───────────────────────────────────────────────────────────────────
   Plugs into midp.html through window.MIDP_ISSUES (after midp-plus.js).

   • Issues   = the TIDP checks + extra ones found here:
                possible typos in titles and number codes, odd spacing,
                level in the number vs the title, type code vs the title.
   • Fixes    = your own corrections of a number and/or title. Nothing is
                changed on its own: every fix is one you saved or ticked.
                Kept in S.store.fix (saved with your tracker entries) and
                put back on the TIDP every time it is read (MIDP_FIX).
   • Ignore   = hide one issue (S.store.ign) or a whole kind (S.store.ignRule).
   ═══════════════════════════════════════════════════════════════════ */
window.MIDP_ISSUES = function (A) {
  'use strict';
  var S = A.S, T = A.T, esc = A.esc;
  var sel = new Set();          // ticked issues (ids) — or ticked fixes in "Your corrections"
  var ISS = [], BYID = new Map(), RP = null, REVIEW = null;

  var KINDS = {
    typo:  { label: 'Possible typo',      help: 'A word in the title is written like a common word in this TIDP, with one letter different. Check it and fix it, or ignore it.' },
    ntypo: { label: 'Code typo',          help: 'A code in the number is almost the same as a code most other drawings use (one letter different).' },
    space: { label: 'Spacing / symbols',  help: 'Extra spaces, spaces inside brackets or odd symbols in the number or title.' },
    lvl:   { label: 'Level differs',      help: 'The level in the number is not the level written in the title.' },
    type:  { label: 'Type vs title',      help: 'The type code in the number (PLN, SEC…) does not match the word in the title (Plan, Section…).' }
  };
  function kindInfo(k) { return KINDS[k] || (k.indexOf('ck_') === 0 && T.CHECKS[k.slice(3)]) || { label: k, help: '' }; }

  function store() {
    S.store.fix = S.store.fix || {}; S.store.ign = S.store.ign || {}; S.store.ignRule = S.store.ignRule || {};
    return S.store;
  }
  function U(s) { return String(s == null ? '' : s).toUpperCase(); }

  /* ---------- 1. Fixes: put your corrections on the TIDP (called by compute) ---------- */
  function fixId(it, items) {
    var k = it._o ? it._o.key : it.key, n = 0;
    (items || A.itemsNow()).forEach(function (x) { if ((x._o ? x._o.key : x.key) === k) n++; });
    return n > 1 ? k + '@' + it.row : k;               // the same number twice: each row has its own fix
  }
  window.MIDP_FIX = function (items) {
    var fx = store().fix;
    items.forEach(function (it) {
      if (!it._o) it._o = { num: it.num, title: it.title, key: it.key };
      var o = it._o, f = fx[o.key + '@' + it.row] || fx[o.key];
      var num = f ? f.num : o.num, title = f ? f.title : o.title;
      if (it.num !== num || it.title !== title) { it.num = num; it.title = title; T.enrich(it); }
      it.fixed = !!f;
    });
  };
  /* Save (or remove, with null) your correction of one drawing */
  function setFix(it, num, title, quiet) {
    var fx = store().fix, id = fixId(it), o = it._o || { num: it.num, title: it.title, key: it.key };
    var oldK = it.key;
    var undo = num == null;
    num = T.txt(num); title = T.txt(title);
    if (undo || (num === o.num && title === o.title)) { delete fx[id]; num = o.num; title = o.title; }
    else fx[id] = { num: num, title: title, onum: o.num, otitle: o.title, at: Date.now() };
    // your tracker entries follow the drawing to its new number
    var newK = T.keyOf(num, title);
    if (newK !== oldK && id.indexOf('@') < 0 && S.store.rows[oldK] && !S.store.rows[newK]) { S.store.rows[newK] = S.store.rows[oldK]; delete S.store.rows[oldK]; }
    if (!quiet) { A.saveStore(); A.compute(); }
  }
  function itemByKey(k) { return A.itemsNow().find(function (it) { return it.key === k; }); }

  /* ---------- 2. Finding issues ---------- */
  var TYPE_WORD = {
    PLN: /\bPLANS?\b/, SEC: /\bSECTION(S|AL)?\b/, ELV: /\bELEVATIONS?\b/, ELE: /\bELEVATIONS?\b/,
    DET: /\bDETAILS?\b/, DTL: /\bDETAILS?\b/, RCP: /\b(REFLECTED|CEILING)\b/, SCH: /\bSCHEDULES?\b/
  };
  /* true when a and b differ by one letter: added, missing or two swapped.
     A changed letter only counts in long words (short ones are often real words: TOWER / POWER, LIST / LIFT). */
  function dist1(a, b, minSub) {
    if (a === b) return false;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0; while (i < la && i < lb && a[i] === b[i]) i++;
    if (la === lb) {
      if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return true;
      return la >= (minSub || 0) && a.slice(i + 1) === b.slice(i + 1);
    }
    if (a + 'S' === b || b + 'S' === a) return false;           // plural, not a typo
    return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  }
  function words(t) { return U(t).match(/[A-Z]{4,}/g) || []; }
  function cleanTitle(t) {
    return T.txt(String(t).replace(/\s+([,.;:)\]])/g, '$1').replace(/([(\[])\s+/g, '$1').replace(/([,;])(?=[A-Za-z])/g, '$1 ').replace(/([,.;:\-])\1+/g, '$1').replace(/[^\x20-\x7E£°²³±–—’‘“”&]/g, ''));
  }
  function cleanNum(n) {
    var trail = /-\s*$/.test(n);
    var c = U(n).replace(/[–—_\s]+/g, function (m) { return /\s/.test(m) && !/[–—_]/.test(m) ? '' : '-'; }).replace(/-{2,}/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/^-+/, '');
    return trail ? c.replace(/-*$/, '-') : c.replace(/-+$/, '');
  }
  function swapPart(num, from, to) {
    var segs = num.split('-'), idx = [];
    segs.forEach(function (s, i) { if (U(s.trim()) === from) idx.push(i); });
    if (idx.length !== 1) return '';
    segs[idx[0]] = to; return segs.join('-');
  }
  function levelOfCode(c) {
    c = U(c); var m = /^L?(\d{1,3})$/.exec(c); return m ? +m[1] : null;
  }

  function find() {
    var items = A.itemsNow(), out = [], seen = new Set();
    var add = function (kind, it, detail, sug) {
      var id = kind + '|' + it.key + '|' + (it.row || '') + '|' + detail;
      if (seen.has(id)) return {}; seen.add(id);
      var i = { id: id, kind: kind, item: it, detail: detail, sug: sug || null };
      out.push(i); return i;
    };
    // the TIDP checks (with a suggested fix where the answer is clear)
    (S.checks || []).forEach(function (c) {
      var it = c.item, sug = null, m;
      if (c.kind === 'odd' && (m = /is (\S+), almost all others use (\S+)$/.exec(c.detail))) { var n2 = swapPart(it.num, m[1], m[2]); if (n2) sug = { num: n2 }; }
      if (c.kind === 'norev' && it.revCol && /^\d+$/.test(it.parts[it.parts.length - 1] || '')) sug = { num: it.num.replace(/-?$/, '') + '-' + it.revCol };
      add('ck_' + c.kind, it, c.detail, sug);
    });

    // word counts across all titles, and code counts per number position
    var wf = new Map(), cf = [];
    items.forEach(function (it) {
      words(it.title).forEach(function (w) { wf.set(w, (wf.get(w) || 0) + 1); });
      (it.parts || []).forEach(function (p, i) {
        if (i === 0 || i >= (it.parts.length - 2) || !/^[A-Z]{2,}$/.test(p)) return;    // not the project code, sequence or revision
        cf[i] = cf[i] || new Map(); cf[i].set(p, (cf[i].get(p) || 0) + 1);
      });
    });
    var ok = store().okWords || {};
    var common = []; wf.forEach(function (n, w) { if (n >= 3) common.push(w); });
    var near = new Map();
    wf.forEach(function (n, w) {
      if (n > 2 || ok[w]) return;
      var best = null, bn = 0;
      common.forEach(function (c) { if (wf.get(c) > bn && wf.get(c) >= n * 3 && dist1(w, c, 7)) { best = c; bn = wf.get(c); } });
      if (best) near.set(w, best);
    });
    var codeNear = cf.map(function (m) {
      if (!m) return null;
      var r = new Map(), big = []; m.forEach(function (n, c) { if (n >= 5) big.push(c); });
      m.forEach(function (n, c) {
        if (n > 2) return;
        var best = null, bn = 0; big.forEach(function (b) { if (m.get(b) > bn && b.length === c.length && dist1(c, b, 3)) { best = b; bn = m.get(b); } });
        if (best) r.set(c, best);
      });
      return r;
    });

    items.forEach(function (it) {
      if (!it.num && !it.title) return;
      var t = U(it.title);
      // typos in the title
      var fixT = it.title, hits = [], bad = [];
      (it.title.match(/[A-Za-z]{4,}/g) || []).forEach(function (w) {
        var to = near.get(U(w)); if (!to) return;
        var rep = w === U(w) ? to : w[0] === U(w[0]) ? to[0] + to.slice(1).toLowerCase() : to.toLowerCase();
        fixT = fixT.replace(new RegExp('\\b' + w + '\\b'), rep); hits.push(w + ' → ' + rep); bad.push(U(w));
      });
      if (hits.length) add('typo', it, hits.join(', ') + ' (used ' + hits.map(function (h) { return wf.get(U(h.split(' → ')[1])) + '×'; }).join(', ') + ' in other titles)', { title: fixT }).words = bad;
      // typos in number codes
      (it.parts || []).forEach(function (p, i) {
        var to = codeNear[i] && codeNear[i].get(p); if (!to) return;
        var n2 = swapPart(it.num, p, to);
        add('ntypo', it, 'Code ' + p + ' — ' + cf[i].get(to) + ' other drawings use ' + to, n2 ? { num: n2 } : null);
      });
      // spacing and symbols
      var ct = cleanTitle(it.title), cn = it.num ? cleanNum(it.num) : '';
      if (ct !== it.title) add('space', it, 'Title: "' + it.title + '"', { title: ct });
      if (it.num && cn !== it.num) add('space', it, 'Number: "' + it.num + '"', { num: cn });
      // level in the number vs the title
      var lc = it.parts && it.parts.length > 4 ? levelOfCode(it.parts[3]) : null, lm = /\b(?:LEVEL|LVL)\s*0*(\d{1,3})\b/.exec(t);
      if (lc != null && lm && +lm[1] !== lc && !new RegExp('\\b(?:LEVEL|LVL)S?\\s*0*' + lc + '\\b').test(t) && !/\b(TO|-|&|AND)\s*(LEVEL\s*)?\d/.test(t)) {
        add('lvl', it, 'Number says level ' + lc + ', title says Level ' + (+lm[1]));
      }
      // type code vs the title
      var own = TYPE_WORD[it.type];
      if (own && !own.test(t)) {
        var other = Object.keys(TYPE_WORD).filter(function (k) { return TYPE_WORD[k] !== own && TYPE_WORD[k].test(t); });
        if (other.length) add('type', it, 'Type ' + it.type + ', but the title says ' + t.match(TYPE_WORD[other[0]])[0]);
      }
    });
    return out;
  }

  function refresh() {
    ISS = S.latest ? find() : []; BYID = new Map(); ISS.forEach(function (i) { BYID.set(i.id, i); });
  }
  function ignored(i) { var s = store(); return !!(s.ignRule[i.kind] || s.ign[i.id]); }
  function openIssues() { return ISS.filter(function (i) { return !ignored(i); }); }
  window.MIDP_ISSUES_COUNT = function () { return openIssues().length; };

  /* ---------- 3. The Issues tab ---------- */
  var U0 = S.ui.checks; U0.mode = U0.mode || 'open'; U0.kind = U0.kind || '';
  function fixedItems() { var fx = store().fix; return Object.keys(fx).map(function (id) { return { id: id, f: fx[id] }; }); }
  function sugText(i) {
    if (!i.sug) return '';
    return [i.sug.num ? i.sug.num : '', i.sug.title ? i.sug.title : ''].filter(Boolean).join(' · ');
  }
  function bar(n, inner) { return '<div class="banner info picked iss-bar"><span><b>' + n + ' ticked.</b></span><span class="toolbar" style="margin:0">' + inner + '</span></div>'; }

  A.VIEWS.checks = function () {
    var u = S.ui.checks, s = store();
    var open = openIssues(), ign = ISS.filter(ignored), fixes = fixedItems();
    var h = '<div class="toolbar"><div class="chips">' +
      A.chip('checks.mode', 'open', 'To review', open.length, u.mode) + A.chip('checks.mode', 'ign', 'Ignored', ign.length, u.mode) + A.chip('checks.mode', 'fix', 'Your corrections', fixes.length, u.mode) +
      '</div><span class="grow"></span><button class="btn small" type="button" data-act="isrep">Find &amp; replace…</button></div>';
    if (u.mode === 'fix') return h + fixesHtml(fixes);
    var base = u.mode === 'ign' ? ign : open, q = T.norm(u.q), counts = {};
    base.forEach(function (i) { counts[i.kind] = (counts[i.kind] || 0) + 1; });
    var kinds = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (u.kind && !counts[u.kind]) u.kind = '';
    var list = base.filter(function (i) { return (!u.kind || i.kind === u.kind) && (!q || T.norm(i.item.num + ' ' + i.item.title + ' ' + i.detail).indexOf(q) >= 0); });
    h += '<div class="toolbar"><div class="chips">' + A.chip('checks.kind', '', 'All', base.length, u.kind) +
      kinds.map(function (k) { return A.chip('checks.kind', k, kindInfo(k).label, counts[k], u.kind, k.indexOf('ck_') ? 'var(--warn)' : 'var(--odd)'); }).join('') + '</div>' +
      '<span class="grow"></span><label class="hint"><input type="checkbox" data-change="checks.sameType"' + (u.sameType ? ' checked' : '') + '> Sequences: same type only</label>' +
      '<input type="search" id="ckQ" data-input="checks.q" placeholder="Search" value="' + esc(u.q) + '" aria-label="Search issues"></div>';
    if (u.kind) {
      var ki = kindInfo(u.kind);
      h += '<div class="banner info"><span><b>' + esc(ki.label) + '.</b> ' + esc(ki.help) + '</span>' +
        (u.mode === 'ign' ? (s.ignRule[u.kind] ? '<button class="btn small" type="button" data-act="isrule" data-v="' + esc(u.kind) + '">Show this kind again</button>' : '')
          : '<button class="btn small" type="button" data-act="isrule" data-v="' + esc(u.kind) + '" title="Hide every issue of this kind, now and in later TIDPs">Ignore this kind</button>') + '</span></div>';
    }
    if (u.mode === 'ign' && Object.keys(s.ignRule).length && !u.kind) h += '<div class="banner info"><span>Whole kinds ignored: ' + Object.keys(s.ignRule).map(function (k) { return '<b>' + esc(kindInfo(k).label) + '</b> <a href="#" data-act="isrule" data-v="' + esc(k) + '">show again</a>'; }).join(' · ') + '</span></div>';
    if (!base.length) return h + '<div class="box empty"><b>' + (u.mode === 'ign' ? 'Nothing ignored' : 'All good') + '</b>' + (u.mode === 'ign' ? 'Issues you ignore are kept here, so you can bring them back.' : 'No naming, typo, revision or date problems left to review.') + '</div>';

    // ticks only count for rows still shown
    var shown = new Set(list.map(function (i) { return i.id; }));
    sel.forEach(function (id) { if (!shown.has(id)) sel.delete(id); });
    if (sel.size) {
      var nSug = list.filter(function (i) { return sel.has(i.id) && i.sug; }).length;
      h += bar(sel.size, (nSug ? '<button class="btn small primary" type="button" data-act="isbulkfix">✔ Review suggested fixes (' + nSug + ')</button>' : '') +
        (u.mode === 'ign' ? '<button class="btn small" type="button" data-act="isunign">Show again</button>' : '<button class="btn small" type="button" data-act="isign">Ignore</button>') +
        '<button class="btn small" type="button" data-act="isrep" data-v="sel">Find &amp; replace in ticked…</button><button class="btn small" type="button" data-act="isclear">Clear ticks</button>');
    }
    var all = list.length && list.every(function (i) { return sel.has(i.id); });
    var cols = [
      { k: 'pick', label: '', w: 34, stick: true, nosort: true, nofilter: true, head: '<input type="checkbox" data-act="isall"' + (all ? ' checked' : '') + ' aria-label="Tick all shown">', text: function () { return ''; },
        html: function (i) { return '<input type="checkbox" data-isel="' + esc(i.id) + '"' + (sel.has(i.id) ? ' checked' : '') + ' aria-label="Tick">'; } },
      { k: 'num', label: 'Document number', w: 230, stick: true, cls: 'mono', text: function (i) { return i.item.num || '(no number)'; }, html: function (i) { return A.numLink(i.item.num, i.item.key) + (i.item.fixed ? ' <span class="tag c-info" title="You corrected this drawing">✎</span>' : ''); } },
      { k: 'kind', label: 'Issue', w: 140, text: function (i) { return kindInfo(i.kind).label; }, html: function (i) { return A.tag(kindInfo(i.kind).label, i.kind.indexOf('ck_') ? 'c-warn' : 'c-odd', false, kindInfo(i.kind).help); } },
      { k: 'title', label: 'Title', w: 280, text: function (i) { return i.item.title; } },
      { k: 'detail', label: 'What is wrong', w: 300, text: function (i) { return i.detail; } },
      { k: 'sug', label: 'Suggested fix', w: 260, text: sugText, html: function (i) { return i.sug ? '<span class="iss-sug">' + esc(sugText(i)) + '</span>' : '<span class="muted">—</span>'; } },
      { k: 'do', label: '', w: 150, nosort: true, nofilter: true, text: function () { return ''; }, html: function (i) {
        return '<span class="iss-do">' + (i.sug ? '<button class="btn small" type="button" data-act="isone" data-v="' + esc(i.id) + '" title="Check and save the suggested fix">✔</button>' : '') +
          '<button class="btn small" type="button" data-act="isedit" data-v="' + esc(i.item.key) + '" title="Fix the number or title yourself">✎</button>' +
          (u.mode === 'ign' ? '<button class="btn small" type="button" data-act="isunign" data-v="' + esc(i.id) + '">Show</button>' : '<button class="btn small" type="button" data-act="isign" data-v="' + esc(i.id) + '" title="Ignore this one">Ignore</button>') + '</span>'; } },
      { k: 'cat', label: 'Category', w: 220, text: function (i) { return [i.item.grp, A.catText(i.item)].filter(Boolean).join(' › '); } },
      { k: 'row', label: 'Excel row', w: 70, cls: 'num', text: function (i) { return String(i.item.row || ''); }, sortKey: function (i) { return i.item.row || ''; } }
    ];
    return h + A.grid('checks', list, cols, { title: 'Issues', key: function (i) { return i.id; }, empty: 'No issues match.' }).html;
  };

  function fixesHtml(fixes) {
    if (!fixes.length) return '<div class="box empty"><b>No corrections yet</b>Use ✎ on an issue (or in a drawing’s side panel) to fix a number or title. The TIDP file itself is never changed.</div>';
    var ids = new Set(fixes.map(function (x) { return x.id; }));
    sel.forEach(function (id) { if (!ids.has(id)) sel.delete(id); });
    var cur = new Map(); A.itemsNow().forEach(function (it) { if (it._o) { cur.set(it._o.key, it); cur.set(it._o.key + '@' + it.row, it); } });
    var h = sel.size ? bar(sel.size, '<button class="btn small" type="button" data-act="isundo">↶ Undo ticked</button><button class="btn small" type="button" data-act="isclear">Clear ticks</button>') : '';
    var all = fixes.every(function (x) { return sel.has(x.id); });
    var ch = function (a, b) { return a === b ? '<span class="muted">' + esc(a) + '</span>' : '<s class="muted">' + esc(a) + '</s><br><b>' + esc(b) + '</b>'; };
    var cols = [
      { k: 'pick', label: '', w: 34, stick: true, nosort: true, nofilter: true, head: '<input type="checkbox" data-act="isall"' + (all ? ' checked' : '') + ' aria-label="Tick all">', text: function () { return ''; },
        html: function (x) { return '<input type="checkbox" data-isel="' + esc(x.id) + '"' + (sel.has(x.id) ? ' checked' : '') + ' aria-label="Tick">'; } },
      { k: 'num', label: 'Number (was → now)', w: 300, cls: 'mono', text: function (x) { return x.f.onum + ' → ' + x.f.num; }, html: function (x) { return ch(x.f.onum, x.f.num); } },
      { k: 'title', label: 'Title (was → now)', w: 360, text: function (x) { return x.f.otitle + ' → ' + x.f.title; }, html: function (x) { return ch(x.f.otitle, x.f.title); } },
      { k: 'when', label: 'Saved', w: 110, text: function (x) { return x.f.at ? T.todayIso(new Date(x.f.at)) : ''; } },
      { k: 'state', label: 'In this TIDP', w: 120, text: function (x) { return cur.has(x.id) ? 'Applied' : 'Not found'; }, html: function (x) { return cur.has(x.id) ? A.tag('Applied', 'c-ok') : A.tag('Not found', 'c-mute', false, 'This drawing is not in the TIDP you loaded (maybe the author fixed it already).'); } },
      { k: 'do', label: '', w: 110, nosort: true, nofilter: true, text: function () { return ''; }, html: function (x) {
        var it = cur.get(x.id);
        return '<span class="iss-do">' + (it ? '<button class="btn small" type="button" data-act="isedit" data-v="' + esc(it.key) + '">✎</button>' : '') + '<button class="btn small" type="button" data-act="isundo" data-v="' + esc(x.id) + '">↶ Undo</button></span>'; } }
    ];
    return h + '<div class="banner info"><span>These are your own corrections. They show everywhere in the checker (Tracker, Lookup, exports) — the TIDP file is not changed. Send them to the TIDP author to fix at source.</span></div>' +
      A.grid('fixes', fixes, cols, { title: 'Corrections', key: function (x) { return x.id; } }).html;
  }

  /* ---------- 4. Dialogs ---------- */
  function editDialog(it) {
    var o = it._o || it, f = store().fix[fixId(it)];
    A.openDialog('<h2>✎ Correct this drawing</h2>' +
      '<p class="hint">Only this checker uses your correction. The original stays in the list of corrections, so you can undo it any time.</p>' +
      '<div class="row"><label class="field" style="flex:1"><span>Document number</span><input type="text" id="isNum" class="mono" value="' + esc(it.num) + '" autocomplete="off"></label></div>' +
      '<div class="hint">Was: <span class="mono">' + esc(o.num || '(no number)') + '</span></div>' +
      '<div class="row"><label class="field" style="flex:1"><span>Title</span><textarea id="isTitle" rows="2">' + esc(it.title) + '</textarea></label></div>' +
      '<div class="hint">Was: ' + esc(o.title || '—') + '</div>' +
      '<div class="acts">' + (f ? '<button class="btn" type="button" data-act="isfixdel" data-v="' + esc(it.key) + '">↶ Undo correction</button>' : '') +
      '<button class="btn" type="button" data-act="dlgclose">Cancel</button><button class="btn primary" type="button" data-act="isfixsave" data-v="' + esc(it.key) + '">Save</button></div>');
  }
  /* The review list: every change is shown and can be unticked before it is saved */
  function reviewDialog(title, changes, note) {
    REVIEW = changes;
    changes.forEach(function (c) { c.on = true; });
    var row = function (c, k) {
      var it = c.it, d = [];
      if (c.num !== it.num) d.push('<span class="mono"><s class="muted">' + esc(it.num) + '</s> → <b>' + esc(c.num) + '</b></span>');
      if (c.title !== it.title) d.push('<s class="muted">' + esc(it.title) + '</s><br>→ <b>' + esc(c.title) + '</b>');
      return '<label class="cf-i iss-rv"><input type="checkbox" data-isrv="' + k + '" checked><span class="cf-t"><span class="mono hint">' + esc(it.num || '(no number)') + '</span><br>' + d.join('<br>') + '</span></label>';
    };
    A.openDialog('<h2>' + esc(title) + '</h2><p class="hint">' + (note || 'Untick anything that is not right, then save.') + '</p>' +
      (changes.length ? '<div class="cf-list iss-rvl">' + changes.slice(0, 1000).map(row).join('') + '</div>' + (changes.length > 1000 ? '<p class="hint">Showing the first 1000.</p>' : '') : '<div class="box empty">Nothing to change.</div>') +
      '<div class="acts"><span class="hint" id="isRvN" style="margin-right:auto">' + A.plural(changes.length, 'change') + '</span>' +
      '<button class="btn" type="button" data-act="dlgclose">Cancel</button>' + (changes.length ? '<button class="btn primary" type="button" data-act="isrvok">Save ticked changes</button>' : '') + '</div>');
  }
  function sugChanges(list) {
    var by = new Map();                                       // one change per drawing, even with several suggestions
    list.forEach(function (i) {
      if (!i.sug) return;
      var it = i.item, c = by.get(it) || { it: it, num: it.num, title: it.title };
      if (i.sug.num) c.num = i.sug.num;
      if (i.sug.title) c.title = c.title === it.title ? i.sug.title : c.title;
      by.set(it, c);
    });
    return Array.from(by.values()).filter(function (c) { return c.num !== c.it.num || c.title !== c.it.title; });
  }

  function repDialog(scope) {
    RP = { scope: scope || 'all', find: '', to: '', where: 'title', word: true, cs: false };
    A.openDialog('<h2>Find &amp; replace</h2><p class="hint">For a typo that repeats on many drawings. You see every change before it is saved.</p>' +
      '<div class="row"><label class="field" style="flex:1"><span>Find</span><input type="text" id="rpFind" autocomplete="off"></label><label class="field" style="flex:1"><span>Replace with</span><input type="text" id="rpTo" autocomplete="off"></label></div>' +
      '<div class="row"><label class="field"><span>In</span><select id="rpWhere"><option value="title">Titles</option><option value="num">Document numbers</option><option value="both">Both</option></select></label>' +
      '<label class="field" style="flex:1"><span>Drawings</span><select id="rpScope"><option value="all"' + (RP.scope === 'all' ? ' selected' : '') + '>All drawings in this TIDP</option>' + (sel.size ? '<option value="sel"' + (RP.scope === 'sel' ? ' selected' : '') + '>Only the ticked issues (' + sel.size + ')</option>' : '') + '</select></label></div>' +
      '<div class="row"><label class="hint"><input type="checkbox" id="rpWord" checked> Whole words only</label><label class="hint"><input type="checkbox" id="rpCase"> Match capitals</label></div>' +
      '<div class="acts"><button class="btn" type="button" data-act="dlgclose">Cancel</button><button class="btn primary" type="button" data-act="isrepgo">Preview changes</button></div>');
  }
  function repChanges() {
    var g = function (id) { return document.getElementById(id); };
    RP.find = g('rpFind').value; RP.to = g('rpTo').value; RP.where = g('rpWhere').value; RP.scope = g('rpScope').value; RP.word = g('rpWord').checked; RP.cs = g('rpCase').checked;
    if (!RP.find) return null;
    var src = RP.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(RP.word ? '(^|[^A-Za-z0-9])' + src + '(?![A-Za-z0-9])' : src, RP.cs ? 'g' : 'gi');
    var rep = function (s) { return RP.word ? s.replace(re, function (m, a) { return a + RP.to; }) : s.replace(re, RP.to); };
    var items = RP.scope === 'sel' ? Array.from(new Set(Array.from(sel).map(function (id) { return BYID.get(id); }).filter(Boolean).map(function (i) { return i.item; }))) : A.itemsNow();
    return items.map(function (it) {
      return { it: it, num: RP.where !== 'title' ? T.txt(rep(it.num)) : it.num, title: RP.where !== 'num' ? T.txt(rep(it.title)) : it.title };
    }).filter(function (c) { return c.num !== c.it.num || c.title !== c.it.title; });
  }

  /* ---------- 5. Buttons ---------- */
  function rerender() { A.compute(); A.render(); }
  function ignore(ids, on) {
    var s = store();
    s.okWords = s.okWords || {};
    ids.forEach(function (id) {
      if (on) s.ign[id] = Date.now(); else delete s.ign[id];
      var i = BYID.get(id);
      if (i && i.words) i.words.forEach(function (w) { if (on) s.okWords[w] = 1; else delete s.okWords[w]; });   // a word you accept is never flagged again
    });
    if (ids.some(function (id) { var i = BYID.get(id); return i && i.words; })) refresh();
    A.saveStore(); sel.clear(); A.render();
    A.toast((on ? 'Ignored ' : 'Showing again: ') + A.plural(ids.length, 'issue'));
  }
  Object.assign(A.ACTIONS, {
    isall: function (el) {
      var on = el.checked;
      document.querySelectorAll('[data-isel]').forEach(function (b) { if (on) sel.add(b.getAttribute('data-isel')); else sel.delete(b.getAttribute('data-isel')); });
      A.render();
    },
    isclear: function () { sel.clear(); A.render(); },
    isign: function (el) { ignore(el.getAttribute('data-v') ? [el.getAttribute('data-v')] : Array.from(sel), true); },
    isunign: function (el) {
      var id = el.getAttribute('data-v'), ids = id ? [id] : Array.from(sel), s = store();
      var rules = ids.map(function (x) { return BYID.get(x); }).filter(function (i) { return i && s.ignRule[i.kind] && !s.ign[i.id]; });
      if (rules.length) { A.toast('Part of a kind you ignored — use “Show this kind again”'); }
      ignore(ids, false);
    },
    isrule: function (el) {
      var k = el.getAttribute('data-v'), s = store();
      if (s.ignRule[k]) delete s.ignRule[k]; else s.ignRule[k] = Date.now();
      A.saveStore(); S.ui.checks.kind = ''; sel.clear(); A.render();
      A.toast(s.ignRule[k] ? '“' + kindInfo(k).label + '” ignored — find it under Ignored' : '“' + kindInfo(k).label + '” shown again');
    },
    isone: function (el) { var i = BYID.get(el.getAttribute('data-v')); if (i) reviewDialog('Check this fix', sugChanges([i])); },
    isbulkfix: function () { reviewDialog('Review suggested fixes', sugChanges(ISS.filter(function (i) { return sel.has(i.id); }))); },
    isedit: function (el) { var it = itemByKey(el.getAttribute('data-v')); if (it) editDialog(it); },
    isfixsave: function (el) {
      var it = itemByKey(el.getAttribute('data-v')); if (!it) return;
      var num = document.getElementById('isNum').value, title = document.getElementById('isTitle').value;
      if (!T.txt(num) && !T.txt(title)) { A.toast('Type a number or a title'); return; }
      setFix(it, num, title); A.closeDialog(); A.render(); A.toast('Correction saved');
    },
    isfixdel: function (el) { var it = itemByKey(el.getAttribute('data-v')); if (it) { setFix(it, null); A.closeDialog(); A.render(); A.toast('Correction undone'); } },
    isrvok: function () {
      var on = (REVIEW || []).filter(function (c, k) { var b = document.querySelector('[data-isrv="' + k + '"]'); return b && b.checked; });
      if (!on.length) { A.toast('Nothing ticked'); return; }
      on.forEach(function (c) { setFix(c.it, c.num, c.title, true); });
      A.saveStore(); sel.clear(); REVIEW = null; A.closeDialog(); rerender();
      A.toast('Saved ' + A.plural(on.length, 'correction') + ' — see “Your corrections” to undo');
    },
    isundo: function (el) {
      var fx = store().fix, ids = el.getAttribute('data-v') ? [el.getAttribute('data-v')] : Array.from(sel), n = 0;
      ids.forEach(function (id) {
        var it = A.itemsNow().find(function (x) { return x._o && (x._o.key === id || x._o.key + '@' + x.row === id); });
        if (it) setFix(it, null, null, true); else delete fx[id];
        n++;
      });
      A.saveStore(); sel.clear(); rerender(); A.toast('Undone ' + A.plural(n, 'correction'));
    },
    isrep: function (el) { repDialog(el.getAttribute('data-v')); },
    isrepgo: function () {
      var ch = repChanges();
      if (!ch) { A.toast('Type the text to find'); return; }
      var rp = RP; reviewDialog('Replace “' + rp.find + '” with “' + rp.to + '”', ch, A.plural(ch.length, 'drawing') + ' would change. Untick any you want to keep as they are.');
    }
  });
  if (!A.ACTIONS.dlgclose) A.ACTIONS.dlgclose = A.closeDialog;

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches && el.matches('[data-isel]')) {
      var id = el.getAttribute('data-isel');
      if (el.checked) sel.add(id); else sel.delete(id);
      A.render();
    }
    if (el.matches && el.matches('[data-isrv]')) {
      var n = document.querySelectorAll('[data-isrv]:checked').length, lab = document.getElementById('isRvN');
      if (lab) lab.textContent = n + ' of ' + A.plural(REVIEW.length, 'change') + ' ticked';
    }
  });

  /* ---------- 6. Hooks: after each compute, and the drawing side panel ---------- */
  var ext = window.MIDP_EXT || (window.MIDP_EXT = {});
  var prevAfter = ext.afterCompute, prevDetail = ext.detailExtra;
  ext.afterCompute = function () { if (prevAfter) prevAfter(); refresh(); };
  ext.detailExtra = function (r) {
    var h = prevDetail ? prevDetail(r) : '';
    var it = itemByKey(r.key);
    if (!it) return h;
    var mine = openIssues().filter(function (i) { return i.item === it; });
    h += '<h2 style="margin-top:16px">Issues</h2>';
    if (it.fixed && it._o) h += '<div class="banner info"><span>You corrected this drawing. Was: <span class="mono">' + esc(it._o.num) + '</span> · ' + esc(it._o.title) + '</span></div>';
    h += (mine.length ? '<ul class="list">' + mine.map(function (i) { return '<li><span>' + A.tag(kindInfo(i.kind).label, 'c-odd') + ' ' + esc(i.detail) + '</span></li>'; }).join('') + '</ul>' : '<p class="hint">No open issues.</p>') +
      '<div class="toolbar"><button class="btn small" type="button" data-act="isedit" data-v="' + esc(it.key) + '">✎ ' + (it.fixed ? 'Edit correction' : 'Correct number / title') + '</button></div>';
    return h;
  };
  refresh();

  var css = document.createElement('style');
  css.textContent = '.iss-do{display:inline-flex;gap:4px}.iss-do .btn{padding:2px 8px}.iss-sug{color:var(--ok,#2e7d32)}' +
    '.iss-rvl{max-height:55vh;overflow:auto}.iss-rv{align-items:flex-start;padding:6px 4px;border-bottom:1px solid var(--line,#ddd)}.iss-rv .cf-t{white-space:normal;line-height:1.35}' +
    '@media (max-width:640px){.iss-bar{flex-direction:column;align-items:flex-start}.iss-bar .toolbar{flex-wrap:wrap}}';
  document.head.appendChild(css);
};
