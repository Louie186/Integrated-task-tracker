/* ═══════════════════════════════════════════════════════════════════
   skills/register/register-core.js — the Register's "brain"
   ───────────────────────────────────────────────────────────────────
   Pure functions (no screen code) so they can be tested on their own:
     dates        readDate()            Excel numbers, 15/8/2025, 15-Aug-2025
     numbers      parseNo()             5013-KEO-T1-ZZ-PLN-INT-10100-T1
     MIDP         detectLayout(), readMidp(), diffMidp()
     lists        readModelList(), readSubmission()
     matching     buildIndex()          drawing → typology → model, with
                                        ✅ sure · 🟡 likely · ⚠ check
   Rule: the revision shown is ALWAYS the MIDP's. Submissions only add
   history ("became T2 at PTA #3"). Nothing changes until a new MIDP.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12 };

  /* ---------- small helpers ---------- */
  function txt(v) {
    if (v == null) return '';
    if (v instanceof Date) return isNaN(v) ? '' : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    return String(v).replace(/ /g, ' ').trim();
  }
  function up(v) { return txt(v).toUpperCase(); }
  function norm(v) { return up(v).replace(/[^A-Z0-9]/g, ''); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function validYMD(y, m, d) { if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return false; return d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  /* ---------- dates: day first, every format flagged when unclear ---------- */
  // returns null (empty), {iso} (good) or {bad:'reason', raw}
  function readDate(v, monthFirst) {
    if (v == null) return null;
    if (v instanceof Date) { if (isNaN(v)) return { bad: 'Not a date', raw: String(v) }; return { iso: iso(v.getFullYear(), v.getMonth() + 1, v.getDate()) }; }
    if (typeof v === 'number') {
      if (v === 0) return null;
      if (v < 20000 || v > 80000) return { bad: 'Not a date', raw: String(v) };
      var t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return { iso: iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()) };
    }
    var s = txt(v);
    if (!s || /^[-–—.\s]+$/.test(s) || /^(N\/?A|TBC|TBA|NONE|NIL)$/i.test(s)) return null;
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return validYMD(+m[1], +m[2], +m[3]) ? { iso: iso(+m[1], +m[2], +m[3]) } : { bad: 'Day or month does not exist', raw: s };
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s);
    if (m) {
      var a = +m[1], b = +m[2], y = +m[3];
      if (m[3].length === 3) return { bad: 'Year is incomplete', raw: s };
      if (m[3].length === 2) y += 2000;
      var d = monthFirst ? b : a, mo = monthFirst ? a : b;
      return validYMD(y, mo, d) ? { iso: iso(y, mo, d) } : { bad: 'Day or month does not exist', raw: s };
    }
    m = /^(\d{1,2})[\s\-\/.]*([A-Za-z]{3,9})[\s\-\/.,]*(\d{2,4})$/.exec(s);
    if (m && MON[m[2].toUpperCase().slice(0, 4)] || m && MON[m[2].toUpperCase().slice(0, 3)]) {
      var mm = MON[m[2].toUpperCase().slice(0, 4)] || MON[m[2].toUpperCase().slice(0, 3)], yy = +m[3] + (m[3].length === 2 ? 2000 : 0);
      return validYMD(yy, mm, +m[1]) ? { iso: iso(yy, mm, +m[1]) } : { bad: 'Day or month does not exist', raw: s };
    }
    return { bad: 'Not a date', raw: s };
  }
  function fmtDate(isoStr) {
    if (!isoStr) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoStr); if (!m) return isoStr;
    return m[3] + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + '-' + m[1];
  }

  /* ---------- document numbers ---------- */
  // 7 parts = the drawing itself, the 8th part = revision
  var DOC_RE = /^[A-Z0-9]{2,8}(-[A-Z0-9]{1,8}){5,7}-?$/i;
  function isDocNo(v) { var s = txt(v).replace(/\s+/g, ''); return DOC_RE.test(s) && /\d/.test(s); }
  function findDocNo(v) { var m = txt(v).toUpperCase().match(/[A-Z0-9]{2,8}(?:-[A-Z0-9]{1,8}){6,7}/); return m ? m[0] : ''; }
  function parseNo(v) {
    var s = txt(v).replace(/\s+/g, '').toUpperCase().replace(/-+$/, '');
    var p = s.split('-');
    if (p.length < 7) return null;
    return { num: s, key: p.slice(0, 7).join('-'), proj: p[0], orig: p[1], bld: p[2], lvl: p[3], type: p[4], disc: p[5], seq: p[6], rev: p[7] || '' };
  }
  function revRank(r) {
    var m = /^([A-Z]*)(\d+)$/i.exec(txt(r)); if (!m) return null;
    return { p: m[1].toUpperCase(), n: +m[2] };
  }
  // -1 a older · 0 same · 1 a newer · null can't tell (different letters)
  function revCompare(a, b) {
    if (up(a) === up(b)) return 0;
    var x = revRank(a), y = revRank(b); if (!x || !y || x.p !== y.p) return null;
    return x.n < y.n ? -1 : x.n > y.n ? 1 : 0;
  }

  /* ---------- MIDP: find where things are ---------- */
  // rows = array of arrays (sheet_to_json header:1)
  function docCount(rows, col, upto) { var n = 0; for (var i = 0; i < Math.min(rows.length, upto || 600); i++) if (isDocNo((rows[i] || [])[col])) n++; return n; }
  function bestSheet(sheets) {
    var names = Object.keys(sheets), best = names[0], bc = -1;
    names.forEach(function (n) {
      if (/^INT$/i.test(n.trim())) { best = n; bc = 1e9; return; }
      var rows = sheets[n], c = 0; for (var j = 0; j < 12; j++) c = Math.max(c, docCount(rows, j, 400));
      if (c > bc) { bc = c; best = n; }
    });
    return best;
  }
  function detectLayout(rows) {
    var width = 0; rows.slice(0, 60).forEach(function (r) { width = Math.max(width, (r || []).length); });
    width = Math.min(width, 60);
    // 1. the header row = the row with the most header-like words (first 40 rows)
    var HW = /REV|DESCRIPTION|TITLE|DATE|STATUS|NUMBER|DELIVERABLE|DISCIPLINE|ORIGINATOR|DOCUMENT|SCALE|OWNER|FORMAT|SEQUENCE|PROJECT/;
    var head = -1, best = 2;
    for (var h = 0; h < Math.min(rows.length, 40); h++) {
      var sc = (rows[h] || []).filter(function (x) { return HW.test(up(x)); }).length;
      if (sc > best) { best = sc; head = h; }
    }
    // 2. the number column = the column with the most drawing numbers under the header
    var below = rows.slice(head + 1), numCol = 0, nc = -1;
    for (var j = 0; j < width; j++) { var c = docCount(below, j); if (c > nc) { nc = c; numCol = j; } }
    if (nc < 5 && head >= 0) {   // numbers not readable (e.g. formulas without saved values): use the header name
      var hh = (rows[head] || []).map(up);
      for (var k0 = 0; k0 < hh.length; k0++) if (/DELIVERABLE|DRAWING (NUMBER|NO)|DOCUMENT (NUMBER|NO)|FILE NAME/.test(hh[k0])) { numCol = k0; break; }
    }
    var first = -1;
    for (var i = head + 1; i < rows.length; i++) if (isDocNo((rows[i] || [])[numCol])) { first = i; break; }
    if (head < 0) {   // no header words at all: the row just above the first number
      for (var h2 = first - 1; h2 >= 0; h2--) if ((rows[h2] || []).filter(function (x) { return txt(x) !== ''; }).length >= 2) { head = h2; break; }
    }
    var H = (rows[head] || []).map(up);
    var find = function (re, not) { for (var k = 0; k < H.length; k++) if (re.test(H[k]) && (not == null || not.indexOf(k) < 0)) return k; return -1; };
    var titleCol = find(/DESCRIPTION|TITLE|DRAWING NAME|SHEET NAME/, [numCol]); if (titleCol < 0) titleCol = numCol + 1;
    // the separate code columns (Project … Sequence) — used when the number cell is empty (e.g. a formula with no saved value)
    var parts = [find(/PROJECT (CODE|NO|NUMBER)/), find(/ORIGINATOR/), find(/FUNCTIONAL|VOLUME|ZONE|BUILDING/), find(/SPATIAL|^LEVEL|LOCATION/),
                 find(/DOCUMENT TYPE|^TYPE$|FILE TYPE/), find(/DISCIPLINE|^ROLE/), find(/SEQUENCE|^NUMBER$/)];
    if (parts.filter(function (x) { return x >= 0; }).length < 7) parts = null;
    var revCol = find(/^REV(ISION)?\b/), statusCol = find(/^STATUS/);
    var stages = [];
    H.forEach(function (x, k) {
      if (!/DATE/.test(x)) return;
      var name = '';
      for (var u = head - 1; u >= Math.max(0, head - 4) && !name; u--) {
        var t = txt((rows[u] || [])[k]);
        if (t && !/^(STAGE|PROGRAMME|PROGRAM)\b/i.test(t)) name = t;
      }
      stages.push({ col: k, name: name || txt((rows[head] || [])[k]) || ('Stage ' + (stages.length + 1)) });
    });
    return { headerRow: head, firstRow: first, numCol: numCol, titleCol: titleCol, revCol: revCol, statusCol: statusCol, stages: stages, parts: parts, headers: (rows[head] || []).map(txt) };
  }

  /* ---------- MIDP: read the drawings ---------- */
  function readMidp(rows, L, opt) {
    opt = opt || {};
    var out = [], models = [], issues = [], seen = {}, section = '';
    var start = (L.headerRow >= 0 ? L.headerRow : 0) + 1, off = opt.rowOffset || 0;
    for (var i = start; i < rows.length; i++) {
      var r = rows[i] || [], cell = r[L.numCol];
      if (!isDocNo(cell) && L.parts && !txt(cell)) cell = fromParts(r, L) || cell;
      if (!isDocNo(cell)) {
        var label = txt(r[0]) || txt(r[L.numCol]) || txt(r[L.titleCol]);
        var others = r.filter(function (x) { return txt(x) !== ''; }).length;
        if (label && others <= 2 && !/^X+$/.test(label)) section = label;
        else if (txt(cell) && /-/.test(txt(cell))) issues.push({ kind: 'number', row: i + 1 + off, text: 'Not a valid drawing number: ' + txt(cell) });
        else if (!txt(cell) && others >= 4 && txt(r[L.titleCol])) issues.push({ kind: 'number', row: i + 1 + off, text: 'No readable drawing number for "' + txt(r[L.titleCol]).slice(0, 60) + '" — skipped' });
        continue;
      }
      var p = parseNo(cell);
      if (!p) { issues.push({ kind: 'number', row: i + 1 + off, text: 'Not a valid drawing number: ' + txt(cell) }); continue; }
      var revCell = L.revCol >= 0 ? up(r[L.revCol]) : '';
      if (revCell === 'XX') revCell = '';
      var rev = revCell || p.rev;
      var d = { key: p.key, num: p.num, title: txt(r[L.titleCol]), section: section, bld: p.bld, lvl: p.lvl, type: p.type, disc: p.disc, seq: p.seq,
        rev: rev, status: L.statusCol >= 0 ? txt(r[L.statusCol]) : '', row: i + 1 + off, stages: [] };
      if (!rev) issues.push({ kind: 'rev', key: d.key, row: d.row, text: 'No revision in the number or the REVISION column' });
      else if (p.rev && revCell && p.rev !== revCell) issues.push({ kind: 'rev', key: d.key, row: d.row, text: 'Number says ' + p.rev + ', REVISION column says ' + revCell + ' (using ' + revCell + ')' });
      (L.stages || []).forEach(function (s) {
        var v = readDate(r[s.col], opt.monthFirst);
        if (v && v.bad) issues.push({ kind: 'date', key: d.key, row: d.row, text: s.name + ': "' + v.raw + '" — ' + v.bad });
        d.stages.push({ name: s.name, date: v && v.iso ? v.iso : '' });
      });
      if (seen[d.key]) { issues.push({ kind: 'dup', key: d.key, row: d.row, text: 'Same drawing listed twice (rows ' + seen[d.key] + ' and ' + d.row + ') — the first is kept' }); continue; }
      seen[d.key] = d.row;
      if (d.type === 'BIM' || /MODEL/i.test(section) && /BIM|RVT/i.test(d.type + ' ' + d.title)) models.push({ num: d.key, name: d.title, bld: d.bld, lvl: d.lvl, src: 'midp' });
      else out.push(d);
    }
    return { rows: out, models: models, issues: issues };
  }

  // 5013 | KEO | T1 | ZZ | PLN | INT | 10100 (+ revision) → 5013-KEO-T1-ZZ-PLN-INT-10100-T1
  function fromParts(r, L) {
    var v = L.parts.map(function (c) { return txt(r[c]); });
    if (v.some(function (x) { return !x || /\s/.test(x); })) return '';
    if (/^\d+$/.test(v[6]) && v[6].length < 5) v[6] = v[6].padStart(5, '0');
    var rev = L.revCol >= 0 ? up(r[L.revCol]) : '';
    var n = v.join('-').toUpperCase() + (rev && rev !== 'XX' ? '-' + rev : '');
    return isDocNo(n) ? n : '';
  }

  /* ---------- compare two MIDP versions ---------- */
  function diffMidp(oldRows, newRows) {
    var o = {}, n = {}, res = { added: [], removed: [], rev: [], title: [], dates: [] };
    (oldRows || []).forEach(function (d) { o[d.key] = d; });
    (newRows || []).forEach(function (d) { n[d.key] = d; });
    Object.keys(n).forEach(function (k) {
      var a = o[k], b = n[k];
      if (!a) { res.added.push(k); return; }
      if (a.rev !== b.rev) res.rev.push({ key: k, from: a.rev, to: b.rev });
      if (a.title !== b.title) res.title.push({ key: k, from: a.title, to: b.title });
      b.stages.forEach(function (s) {
        var old = (a.stages || []).filter(function (x) { return x.name === s.name; })[0];
        if (old && old.date !== s.date && (old.date || s.date)) {
          var days = old.date && s.date ? Math.round((Date.parse(s.date) - Date.parse(old.date)) / 86400000) : null;
          res.dates.push({ key: k, stage: s.name, from: old.date, to: s.date, days: days });
        }
      });
    });
    Object.keys(o).forEach(function (k) { if (!n[k]) res.removed.push(k); });
    return res;
  }

  /* ---------- model list (any layout) ---------- */
  function detectModelLayout(rows) {
    var head = -1, H = [];
    for (var i = 0; i < Math.min(rows.length, 30); i++) {
      var r = (rows[i] || []).map(up);
      if (r.some(function (x) { return /MODEL/.test(x); }) && r.filter(Boolean).length >= 2) { head = i; H = r; break; }
    }
    var f = function (re, skip) { for (var k = 0; k < H.length; k++) if (re.test(H[k]) && (skip || []).indexOf(k) < 0) return k; return -1; };
    var num = f(/MODEL.*(NUMBER|NO\b|NUM|CODE|FILE)/); if (num < 0) num = f(/^MODEL$|MODEL NAME/);
    var name = f(/DESCRIPTION|MODEL NAME|TITLE|^NAME$/, [num]);
    return { headerRow: head, num: num, name: name, bld: f(/BUILDING|TOWER|BLOCK/), typology: f(/TYPOLOGY|APARTMENT|UNIT TYPE|^TYPE$/), levels: f(/LEVEL|FLOOR/), cat: f(/CATEGORY|DISCIPLINE/), headers: (rows[head] || []).map(txt) };
  }
  function readModelList(rows, L) {
    var out = [], seen = {};
    for (var i = L.headerRow + 1; i < rows.length; i++) {
      var r = rows[i] || [], num = up(r[L.num]); if (!num) continue;
      var p = parseNo(num), key = p ? p.key : num;
      if (seen[key]) continue; seen[key] = 1;
      out.push({ num: key, name: L.name >= 0 ? txt(r[L.name]) : '', bld: L.bld >= 0 ? txt(r[L.bld]) : (p ? p.bld : ''), typology: L.typology >= 0 ? txt(r[L.typology]) : '',
        levels: L.levels >= 0 ? txt(r[L.levels]) : '', cat: L.cat >= 0 ? txt(r[L.cat]) : '', lvl: p ? p.lvl : '', src: 'list' });
    }
    return out;
  }

  /* ---------- submission list: just find the drawing numbers ---------- */
  function readSubmission(rows) {
    var items = [], seen = {}, revCol = -1;
    for (var i = 0; i < Math.min(rows.length, 30) && revCol < 0; i++) (rows[i] || []).forEach(function (c, j) { if (revCol < 0 && /^REV(ISION)?\.?$/i.test(txt(c))) revCol = j; });
    rows.forEach(function (r) {
      r = r || [];
      for (var j = 0; j < r.length; j++) {
        var no = findDocNo(r[j]); if (!no) continue;
        var p = parseNo(no); if (!p || seen[p.key]) return;
        var rev = p.rev || (revCol >= 0 ? up(r[revCol]) : '');
        var title = ''; for (var k = j + 1; k < r.length && !title; k++) { var t = txt(r[k]); if (t && !findDocNo(t) && t.length > 3 && !/^REV/i.test(t) && !revRank(t)) title = t; }
        seen[p.key] = 1; items.push({ key: p.key, rev: rev, title: title });
        return;
      }
    });
    return items;
  }
  // "PTA3_LOD 20261005.xlsx" → { name:'PTA #3', date:'2026-10-05' }
  function guessFromFileName(n) {
    var s = txt(n).replace(/\.[a-z0-9]+$/i, ''), out = { name: s, date: '' };
    var m = /([A-Z]{2,5})\s*[#_\- ]?\s*0*(\d{1,3})(?![\d])/i.exec(s); if (m) out.name = m[1].toUpperCase() + ' #' + (+m[2]);
    var d = /(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/.exec(s); if (d && validYMD(+d[1], +d[2], +d[3])) out.date = iso(+d[1], +d[2], +d[3]);
    return out;
  }

  /* ---------- typology from the title ---------- */
  // "UNIT TYPE 1 BR - Type A (Res.1) - DETAILED PLANS"  → "UNIT TYPE 1 BR - TYPE A (RES.1)"
  function typologyFromTitle(title) {
    var t = txt(title).replace(/\s+/g, ' ');
    // a short bracketed tag that ends in a number marks the unit's building, e.g. "(Res.1)", "(Tower 2)", "(Block 3)"
    var m = /^(.*?\(\s*([A-Z][A-Z.]{0,11}\.?\s*\d{1,2})\s*)(\)|\s-|$)/i.exec(t);
    if (!m || /^(TYPE|OPT|OPTION|NO|NR|SHEET|PART|PHASE|STAGE|DET|DETAIL|REV|FIG|ITEM|ZONE|AREA)\b/i.test(m[2])) return null;   // "(Type 3)" is not a building tag
    var name = (m[1] + ')').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s*-\s*/g, ' - ').trim().toUpperCase();
    return { name: name, tag: m[2].toUpperCase().replace(/\s+/g, '') };
  }

  /* ---------- the big join: drawing → typology → model, + history ---------- */
  var DEFAULT_CODES = { T1: 'Tower 1', T2: 'Tower 2', T3: 'Tower 3', T4: 'Tower 4', PD: 'Podium', XX: 'General', ZZ: 'Several buildings' };
  function bldName(code, codes) { codes = codes || DEFAULT_CODES; return codes[code] || code; }
  function lvlName(code) {
    var c = up(code);
    if (c === 'ZZ') return 'Several levels'; if (c === 'XX' || !c) return 'No level';
    if (c === 'GR' || c === 'GF' || c === '00') return 'Ground'; if (c === 'RF') return 'Roof';
    var m = /^B(\d+)$/.exec(c); if (m) return 'Basement ' + (+m[1]);
    if (/^\d+$/.test(c)) return 'Level ' + (+c);
    return c;
  }
  function familyOf(d) { return d.bld + ':' + String(d.seq).slice(-4); }
  function ruleHits(rule, d) {
    var ok = function (want, have) { return !want || up(want) === up(have); };
    if (!ok(rule.bld, d.bld) || !ok(rule.lvl, d.lvl) || !ok(rule.type, d.type)) return false;
    if (rule.section && up(d.section).indexOf(up(rule.section)) < 0) return false;
    if (rule.text && (up(d.title) + ' ' + up(d.typology && d.typology.name)).indexOf(up(rule.text)) < 0) return false;
    if (rule.seqFrom && +d.seq < +rule.seqFrom) return false;
    if (rule.seqTo && +d.seq > +rule.seqTo) return false;
    return true;
  }

  // S = saved state { midp:{rows,models}, models:{rows}, subs:[], overrides:{model:{},typo:{}}, rules:[], codes:{} }
  function buildIndex(S, today) {
    today = today || iso(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    var rows = (S.midp && S.midp.rows) || [], ov = S.overrides || { model: {}, typo: {} }, codes = S.codes || DEFAULT_CODES;
    var listModels = (S.models && S.models.rows) || [], midpModels = (S.midp && S.midp.models) || [];
    var allModels = {}, modelArr = [];
    midpModels.concat(listModels).forEach(function (m) {
      var k = up(m.num); if (allModels[k]) { Object.keys(m).forEach(function (x) { if (m[x]) allModels[k][x] = m[x]; }); return; }
      allModels[k] = Object.assign({}, m); modelArr.push(allModels[k]);
    });
    // 1. typology
    var fam = {}, canon = {}, seenN = {};
    var canonical = function (name) {   // "TYPE E 1(RES.1)" and "TYPE E1 (RES.1)" are the same typology
      var k = norm(name); if (!k) return '';
      seenN[k] = seenN[k] || {}; seenN[k][name] = (seenN[k][name] || 0) + 1;
      return k;
    };
    rows.forEach(function (d) {
      var o = ov.typo && ov.typo[d.key];
      if (o) d.typology = { name: o, conf: 'sure', why: 'Set by you' };
      else {
        var t = typologyFromTitle(d.title);
        if (t) d.typology = { name: t.name, conf: 'sure', why: 'From the title', tag: t.tag };
        else {
          var hit = null;
          listModels.forEach(function (m) { if (m.typology && !hit && up(d.title).indexOf(up(m.typology)) > -1) hit = m.typology; });
          d.typology = hit ? { name: up(hit), conf: 'sure', why: 'Typology name is in the title' } : { name: '', conf: '', why: '' };
        }
      }
      if (d.typology.name) d.typology.k = canonical(d.typology.name);
    });
    // show each typology with its most common spelling
    Object.keys(seenN).forEach(function (k) { var v = seenN[k]; canon[k] = Object.keys(v).sort(function (a, b) { return v[b] - v[a]; })[0]; });
    rows.forEach(function (d) {
      if (d.typology.k) d.typology.name = canon[d.typology.k];
      if (d.typology.conf === 'sure' && d.typology.name) { var f = familyOf(d); (fam[f] = fam[f] || {})[d.typology.name] = 1; }
    });
    rows.forEach(function (d) {
      if (d.typology.name) return;
      var f = fam[familyOf(d)], names = f ? Object.keys(f) : [];
      if (names.length === 1) d.typology = { name: names[0], conf: 'likely', why: 'Same number family as other ' + names[0] + ' drawings (…' + String(d.seq).slice(-4) + ')' };
      else if (names.length > 1) d.typology = { name: '', conf: 'check', why: 'Number family is shared by ' + names.join(', '), alts: names };
    });
    // 2. model
    rows.forEach(function (d) {
      var o = ov.model && ov.model[d.key], r, cands;
      if (o) { d.model = { num: o, conf: 'sure', why: 'Set by you' }; return; }
      r = (S.rules || []).filter(function (x) { return x.model && ruleHits(x, d); })[0];
      if (r) { d.model = { num: r.model, conf: 'sure', why: 'Your rule: ' + ruleLabel(r) }; return; }
      if (d.typology.name) {
        cands = listModels.filter(function (m) { return m.typology && norm(m.typology) === norm(d.typology.name) && (!m.bld || !d.bld || norm(m.bld) === norm(d.bld) || norm(m.bld) === norm(bldName(d.bld, codes))); });
        if (cands.length === 1) { d.model = { num: cands[0].num, conf: d.typology.conf === 'sure' ? 'sure' : 'likely', why: 'Model list: typology ' + d.typology.name }; return; }
        if (cands.length > 1) { d.model = { num: '', conf: 'check', why: cands.length + ' models have typology ' + d.typology.name, alts: cands.map(function (m) { return m.num; }) }; return; }
      }
      cands = midpModels.filter(function (m) { return m.bld === d.bld; });
      var exact = cands.filter(function (m) { return m.lvl === d.lvl; });
      var whole = cands.filter(function (m) { return m.lvl === 'ZZ'; });
      if (exact.length === 1) d.model = { num: exact[0].num, conf: 'likely', why: 'Same building and level code as the model (' + d.bld + '-' + d.lvl + ')' };
      else if (whole.length === 1) d.model = { num: whole[0].num, conf: 'likely', why: 'Main model of ' + bldName(d.bld, codes) + ' (' + d.bld + '-ZZ)', alts: cands.map(function (m) { return m.num; }) };
      else if (cands.length === 1) d.model = { num: cands[0].num, conf: 'likely', why: 'Only model for ' + bldName(d.bld, codes) };
      else if (cands.length > 1) d.model = { num: '', conf: 'check', why: cands.length + ' models for ' + bldName(d.bld, codes) + ' — pick one or add a rule', alts: cands.map(function (m) { return m.num; }) };
      else d.model = { num: '', conf: '', why: 'No model found' };
    });
    // 3. submissions → history (the MIDP rev is never changed here)
    var subs = (S.subs || []).slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || (a.added || 0) - (b.added || 0); });
    var byKey = {}; rows.forEach(function (d) { byKey[d.key] = d; d.history = []; d.flags = []; });
    var notInMidp = [];
    subs.forEach(function (s) {
      (s.items || []).forEach(function (it) {
        var d = byKey[it.key];
        if (!d) { notInMidp.push({ key: it.key, sub: s.name, rev: it.rev }); return; }
        var prev = d.history[d.history.length - 1];
        var became = !prev ? (it.rev ? 'first sent as ' + it.rev : 'first sent') : (it.rev && prev.rev !== it.rev ? 'became ' + it.rev : 'sent again' + (it.rev ? ' (' + it.rev + ')' : ''));
        d.history.push({ sub: s.name, subId: s.id, date: s.date, rev: it.rev, note: became });
      });
    });
    rows.forEach(function (d) {
      var last = d.history[d.history.length - 1];
      d.lastSub = last || null;
      if (last && last.rev && d.rev) {
        var c = revCompare(last.rev, d.rev);
        if (c === 1) d.flags.push('Sent as ' + last.rev + ' but the MIDP still says ' + d.rev + ' — MIDP may be out of date');
        else if (c === -1) d.flags.push('Last sent as ' + last.rev + ', MIDP is at ' + d.rev + ' — not sent at ' + d.rev + ' yet');
        else if (c === null && up(last.rev) !== up(d.rev)) d.flags.push('Sent as ' + last.rev + ', MIDP says ' + d.rev);
      }
      // dates: next stage date, and "due but not sent"
      var dated = d.stages.filter(function (s) { return s.date; });
      d.next = dated.filter(function (s) { return s.date >= today; })[0] || null;
      var passed = dated.filter(function (s) { return s.date < today; }).pop() || null;
      d.overdue = !!(passed && !d.history.some(function (h) { return h.date && h.date >= passed.date; })) ? passed : null;
      d.bldName = bldName(d.bld, codes); d.lvlName = lvlName(d.lvl);
      d.hay = [d.key, d.num, d.title, d.section, d.typology.name, (allModels[up(d.model.num)] || {}).name || d.model.num, d.bldName, d.lvlName, d.type, 'L' + (+d.lvl || d.lvl), d.rev].join(' ').toUpperCase();
    });
    // 4. models & typologies summary
    modelArr.forEach(function (m) { m.drawings = []; m.sent = 0; m.levels2 = {}; m.typos = {}; m.blds = {}; });
    rows.forEach(function (d) {
      var m = d.model.num && allModels[up(d.model.num)];
      if (!m) return;
      m.drawings.push(d); if (d.history.length) m.sent++;
      if (d.lvl && d.lvl !== 'ZZ' && d.lvl !== 'XX') m.levels2[d.lvlName] = 1;
      if (d.typology.name) m.typos[d.typology.name] = 1;
      m.blds[d.bldName] = 1;
    });
    var typos = {};
    rows.forEach(function (d) {
      if (!d.typology.name) return;
      var t = typos[d.typology.name] = typos[d.typology.name] || { name: d.typology.name, drawings: [], models: {}, blds: {} };
      t.drawings.push(d); if (d.model.num) t.models[d.model.num] = 1; t.blds[d.bldName] = 1;
    });
    return { drawings: rows, byKey: byKey, models: modelArr, modelByNum: allModels, typologies: Object.keys(typos).sort().map(function (k) { return typos[k]; }), notInMidp: notInMidp, subs: subs, today: today };
  }
  function ruleLabel(r) {
    var p = [];
    if (r.bld) p.push('building ' + r.bld); if (r.lvl) p.push('level ' + r.lvl); if (r.type) p.push('type ' + r.type);
    if (r.section) p.push('section has "' + r.section + '"'); if (r.text) p.push('title has "' + r.text + '"');
    if (r.seqFrom || r.seqTo) p.push('number ' + (r.seqFrom || '…') + '–' + (r.seqTo || '…'));
    return (p.join(', ') || 'every drawing') + ' → ' + r.model;
  }

  /* ---------- search: every word must match ---------- */
  function search(IX, q, limit) {
    var words = up(q).split(/[\s,]+/).filter(Boolean).map(function (w) {
      var m = /^L(?:EVEL)?0*(\d+)$/.exec(w); return m ? 'LEVEL ' + (+m[1]) : w;
    });
    if (!words.length) return { drawings: [], models: [], typologies: [] };
    var hit = function (hay) { return words.every(function (w) { return hay.indexOf(w) > -1; }); };
    // best first: number starts with what you typed › the exact phrase › every word somewhere
    var phrase = up(q).replace(/\s+/g, ' ').trim();
    var score = function (d) { return d.key.indexOf(phrase) === 0 || d.seq === phrase ? 0 : d.hay.indexOf(phrase) > -1 ? 1 : 2; };
    var dr = IX.drawings.filter(function (d) { return hit(d.hay); })
      .map(function (d, i) { return { d: d, s: score(d), i: i }; }).sort(function (a, b) { return a.s - b.s || a.i - b.i; }).map(function (x) { return x.d; });
    var md = IX.models.filter(function (m) { return hit([m.num, m.name, m.typology, m.bld, Object.keys(m.blds || {}).join(' '), Object.keys(m.typos || {}).join(' '), Object.keys(m.levels2 || {}).join(' ')].join(' ').toUpperCase()); });
    var ty = IX.typologies.filter(function (t) { return hit([t.name, Object.keys(t.blds).join(' '), Object.keys(t.models).join(' ')].join(' ').toUpperCase()); });
    return { drawings: dr, models: md, typologies: ty };
  }

  var api = { txt: txt, readDate: readDate, fmtDate: fmtDate, isDocNo: isDocNo, findDocNo: findDocNo, parseNo: parseNo, revCompare: revCompare,
    bestSheet: bestSheet, detectLayout: detectLayout, readMidp: readMidp, diffMidp: diffMidp, detectModelLayout: detectModelLayout, readModelList: readModelList,
    readSubmission: readSubmission, guessFromFileName: guessFromFileName, typologyFromTitle: typologyFromTitle, buildIndex: buildIndex, search: search,
    ruleLabel: ruleLabel, bldName: bldName, lvlName: lvlName, DEFAULT_CODES: DEFAULT_CODES };
  root.RegCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
