/* ═══ SKILL (tool): Models by level ════════════════════════════════
   Pick a level (16, L16, Level 16, GF, RF …) and optionally a tower.
   Uses the Register's data to list, sorted by tower then name:
     • federation models on that floor
     • apartment typologies whose level range covers it (+ their models)
     • unit models of those typologies
     • drawings whose number carries that level code
   Then: copy, download CSV, or send to Delegation as tasks
   (one task per tower, one subtask per model).
   Works with the MIDP Checker first, else the Register (classic).
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var esc = LT.esc;

  // "Level 16" / "L16" / "16" / "016" → "16";  "GF", "RF", "B1" stay as they are
  function norm(s) {
    s = String(s == null ? '' : s).toUpperCase().replace(/LEVEL|LVL/g, '').replace(/\s+/g, '');
    var m = /^L?0*(\d+)$/.exec(s);
    return m ? String(+m[1] || 0) : s;
  }
  // does a typology level text like "L10-L20, 25, 30–32" include this level?
  function inRange(text, lv) {
    if (!text) return false;
    var n = /^\d+$/.test(lv) ? +lv : null;
    return String(text).split(/[,;&/]+/).some(function (part) {
      part = part.trim(); if (!part) return false;
      var m = /^L?\s*(\d+)\s*[-–—to]+\s*L?\s*(\d+)$/i.exec(part);
      if (m && n !== null) return n >= +m[1] && n <= +m[2];
      return norm(part) === lv;
    });
  }
  function byTower(a, b) { return String(a.tower || '').localeCompare(String(b.tower || '')) || String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true }); }

  function search(R, lvInput, tower) {
    var lv = norm(lvInput), tw = tower || '';
    var okTower = function (t) { return !tw || String(t || '') === tw; };
    var fed = (R.federation || []).filter(function (f) { return norm(f.lvl) === lv && okTower(f.tower); })
      .map(function (f) { return { tower: f.tower, name: f.model || '(no model)', tier: f.tier, cls: f.cls, wset: f.wset, typos: f.typos }; }).sort(byTower);
    var typoNames = {};
    fed.forEach(function (f) { String(f.typos || '').split(/[,;]+/).forEach(function (t) { t = t.trim(); if (t) typoNames[t.toUpperCase()] = 1; }); });
    var typos = (R.typologies || []).filter(function (t) { return okTower(t.tower) && (inRange(t.levels, lv) || typoNames[String(t.key).toUpperCase()]); })
      .map(function (t) { return { tower: t.tower, name: t.key, model: t.model, unit: t.unit_type, levels: t.levels }; }).sort(byTower);
    var keys = {}; typos.forEach(function (t) { keys[String(t.name).toUpperCase()] = 1; });
    var models = (R.models || []).filter(function (m) { return okTower(m.tower) && (keys[String(m.apt || '').toUpperCase()] || keys[String(m.akey || '').toUpperCase()]); })
      .map(function (m) { return { tower: m.tower, name: m.num, desc: m.desc, apt: m.apt, cat: m.cat }; }).sort(byTower);
    var drawings = (R.drawings || []).filter(function (d) { return norm(d.level_code) === lv && okTower(d.tower); })
      .map(function (d) { return { tower: d.tower, name: d.drg, desc: d.desc, status: d.status || '' }; }).sort(byTower);
    return { lv: lv, tower: tw, fed: fed, typos: typos, models: models, drawings: drawings };
  }

  function table(title, cols, rows) {
    if (!rows.length) return '';
    return '<h4 style="margin:14px 0 6px">' + esc(title) + ' <span class="small">(' + rows.length + ')</span></h4><table><tr>' +
      cols.map(function (c) { return '<th>' + esc(c[0]) + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + esc(r[c[1]] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }
  function asRows(res) {
    var out = [['Section', 'Tower', 'Name', 'Details']];
    res.fed.forEach(function (r) { out.push(['Federation model', r.tower, r.name, [r.tier, r.cls, r.wset].filter(Boolean).join(' · ')]); });
    res.typos.forEach(function (r) { out.push(['Typology', r.tower, r.name, [r.model, r.unit, r.levels].filter(Boolean).join(' · ')]); });
    res.models.forEach(function (r) { out.push(['Unit model', r.tower, r.name, [r.desc, r.apt].filter(Boolean).join(' · ')]); });
    res.drawings.forEach(function (r) { out.push(['Drawing', r.tower, r.name, [r.desc, r.status].filter(Boolean).join(' · ')]); });
    return out;
  }

  LT.fn['level-filter'] = {
    search: search, norm: norm, inRange: inRange, onLevel: onLevel,      // exposed for testing
    run: function (ctx) {
      // the MIDP Checker comes first; the classic register data is the fallback
      return ctx.drawingRegister().then(function (reg) { if (reg) return runMidp(ctx, reg.index); runClassic(ctx); });
    }
  };

  /* ---------- new Register: drawings on a level, grouped by model ---------- */
  function onLevel(d, lv) {
    if (norm(d.lvl) === lv) return true;
    var n = /^\d+$/.test(lv) ? +lv : null, t = String(d.title || '').toUpperCase();
    if (n !== null) return new RegExp('\\b(LEVEL|LVL|L)\\s*0*' + n + '\\b').test(t) || new RegExp('LEVELS?\\s+[A-Z0-9]*\\s*-\\s*0*' + n + '\\b').test(t);
    return new RegExp('\\bLEVEL\\s*' + lv + '\\b').test(t);
  }
  function runMidp(ctx, IX) {
    var last = localStorage.getItem('lt_levelfilter_last') || '';
    var blds = {}; IX.drawings.forEach(function (d) { blds[d.bldName] = 1; });
    var body = ctx.modal('⇅ Models by level',
      '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">' +
      '<label class="small" style="flex:1;min-width:140px">Level<input id="lfLv" value="' + esc(last) + '" placeholder="e.g. 3, L16, GR, B2"></label>' +
      '<label class="small" style="min-width:140px">Building<select id="lfTw"><option value="">All</option>' + Object.keys(blds).sort().map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn primary" id="lfGo">Find</button></div><p class="small">Uses the MIDP Checker: the level code in the number, or "Level 3" in the title. Most unit drawings are "several levels" (ZZ) and are not listed here.</p><div id="lfOut"></div>', { width: 860 });
    var res = null;
    function go() {
      var lv = norm(body.querySelector('#lfLv').value), tw = body.querySelector('#lfTw').value; if (!lv) return;
      localStorage.setItem('lt_levelfilter_last', body.querySelector('#lfLv').value.trim());
      var list = IX.drawings.filter(function (d) { return onLevel(d, lv) && (!tw || d.bldName === tw); });
      var byModel = {};
      list.forEach(function (d) { var k = (d.model && d.model.num) || '(no model yet)'; (byModel[k] = byModel[k] || []).push(d); });
      res = { lv: lv, list: list, byModel: byModel };
      var name = function (k) { var m = IX.modelByNum[k.toUpperCase()]; return m ? (m.name || k) : k; };
      body.querySelector('#lfOut').innerHTML = !list.length ? '<p class="small">Nothing on level <b>' + esc(lv) + '</b>.</p>' :
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin:6px 0"><b style="align-self:center">' + list.length + ' drawings · ' + Object.keys(byModel).length + ' models</b>' +
        '<button class="btn" id="lfCopy">📋 Copy</button><button class="btn" id="lfCsv">⬇ CSV</button>' + (LT.isOn('delegate') ? '<button class="btn primary" id="lfSend">⇶ Send to Delegation</button>' : '') + '</div>' +
        Object.keys(byModel).sort().map(function (k) {
          return '<h4 style="margin:12px 0 4px">' + esc(name(k)) + ' <span class="small">(' + byModel[k].length + ')</span></h4><table><tr><th>Drawing</th><th>Title</th><th>Typology</th><th>MIDP rev</th></tr>' +
            byModel[k].sort(function (a, b) { return a.key.localeCompare(b.key); }).map(function (d) { return '<tr><td>' + esc(d.key) + '</td><td>' + esc(d.title) + '</td><td>' + esc(d.typology.name) + '</td><td>' + esc(d.rev) + '</td></tr>'; }).join('') + '</table>';
        }).join('');
    }
    var rows = function () { var o = [['Model', 'Drawing', 'Title', 'Typology', 'MIDP rev']]; Object.keys(res.byModel).sort().forEach(function (k) { res.byModel[k].forEach(function (d) { o.push([k, d.key, d.title, d.typology.name, d.rev]); }); }); return o; };
    body.addEventListener('click', function (e) {
      var id = e.target.id;
      if (id === 'lfGo') go();
      else if (id === 'lfCopy' && res) (navigator.clipboard ? navigator.clipboard.writeText(rows().map(function (r) { return r.join('\t'); }).join('\n')) : Promise.reject()).then(function () { ctx.toast('Copied'); }, function () { ctx.toast('Copy blocked — use CSV'); });
      else if (id === 'lfCsv' && res) ctx.download('Level_' + res.lv + '_' + ctx.today() + '.csv', new Blob(['\ufeff' + rows().map(function (r) { return r.map(function (c) { return '"' + String(c || '').replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n')], { type: 'text/csv' }));
      else if (id === 'lfSend' && res) {
        var group = prompt('Group for these tasks', 'Level ' + res.lv); if (group === null) return;
        var tasks = Object.keys(res.byModel).sort().map(function (k) {
          var m = IX.modelByNum[k.toUpperCase()];
          return { title: 'Level ' + res.lv + ' — ' + (m ? m.name || k : k), notes: 'From ⇅ Models by level', subs: res.byModel[k].map(function (d) { return { title: d.key + ' — ' + d.title }; }) };
        });
        ctx.sendToDelegation(tasks, group.trim() || 'Level ' + res.lv); ctx.close(); if (typeof show === 'function') show('delegate');
      }
    });
    body.querySelector('#lfLv').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { var i = body.querySelector('#lfLv'); i.focus(); if (i.value) go(); }, 60);
  }

  /* ---------- Register (classic) data ---------- */
  var classic = {
    run: function (ctx) {
      var R = ctx.register();
      if (!R || !((R.federation || []).length || (R.typologies || []).length || (R.drawings || []).length)) {
        ctx.modal('⇅ Models by level', '<div class="empty" style="padding:24px;text-align:center"><b>No Register data in this project yet</b><br>Open <b>Register → Import / Export</b> and load the project file or Excel registers first.</div>' +
          '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn primary" onclick="LT.closeModal();show(\'register\')">Open Register</button></div>', { width: 520 });
        return;
      }
      var towers = {};
      ['federation', 'typologies', 'models', 'drawings'].forEach(function (k) { (R[k] || []).forEach(function (x) { if (x.tower) towers[x.tower] = 1; }); });
      var levels = {};
      (R.federation || []).forEach(function (f) { if (f.lvl) levels[norm(f.lvl)] = f.lvl; });
      var last = localStorage.getItem('lt_levelfilter_last') || '';
      var body = ctx.modal('⇅ Models by level',
        '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">' +
        '<label class="small" style="flex:1;min-width:140px">Level<input id="lfLv" list="lfLevels" value="' + esc(last) + '" placeholder="e.g. 16, L16, GF"></label>' +
        '<datalist id="lfLevels">' + Object.keys(levels).sort(function (a, b) { return (+a || 0) - (+b || 0) || a.localeCompare(b); }).map(function (k) { return '<option value="' + esc(levels[k]) + '">'; }).join('') + '</datalist>' +
        '<label class="small" style="min-width:140px">Tower<select id="lfTw"><option value="">All towers</option>' + Object.keys(towers).sort().map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
        '<button class="btn primary" id="lfGo">Find</button></div><div id="lfOut" style="margin-top:8px"></div>', { width: 860 });
      var res = null;
      function go() {
        var lv = body.querySelector('#lfLv').value.trim(); if (!lv) return;
        localStorage.setItem('lt_levelfilter_last', lv);
        res = search(R, lv, body.querySelector('#lfTw').value);
        var n = res.fed.length + res.typos.length + res.models.length + res.drawings.length;
        body.querySelector('#lfOut').innerHTML = !n ? '<p class="small">Nothing found on level <b>' + esc(lv) + '</b>. Check how levels are written in the Register (e.g. L16 or 16).</p>' :
          '<div class="row" style="gap:8px;flex-wrap:wrap;margin:6px 0"><b style="align-self:center">Level ' + esc(res.lv) + (res.tower ? ' · ' + esc(res.tower) : '') + ' — ' + n + ' items</b>' +
          '<button class="btn" id="lfCopy">📋 Copy</button><button class="btn" id="lfCsv">⬇ CSV</button>' + (LT.isOn('delegate') ? '<button class="btn primary" id="lfSend">⇶ Send to Delegation</button>' : '') + '</div>' +
          table('Federation models', [['Tower', 'tower'], ['Model', 'name'], ['Tier', 'tier'], ['Class', 'cls'], ['Workset', 'wset']], res.fed) +
          table('Apartment typologies', [['Tower', 'tower'], ['Typology', 'name'], ['Model', 'model'], ['Unit type', 'unit'], ['Levels', 'levels']], res.typos) +
          table('Unit models', [['Tower', 'tower'], ['Model no.', 'name'], ['Description', 'desc'], ['Typology', 'apt']], res.models) +
          table('Drawings', [['Tower', 'tower'], ['Drawing', 'name'], ['Description', 'desc'], ['Status', 'status']], res.drawings);
      }
      body.addEventListener('click', function (e) {
        var id = e.target.id;
        if (id === 'lfGo') go();
        else if (id === 'lfCopy' && res) {
          var tsv = asRows(res).map(function (r) { return r.join('\t'); }).join('\n');
          (navigator.clipboard ? navigator.clipboard.writeText(tsv) : Promise.reject()).then(function () { ctx.toast('Copied — paste into Excel or an email'); }, function () { ctx.toast('Copy blocked by the browser — use CSV'); });
        } else if (id === 'lfCsv' && res) {
          var csv = asRows(res).map(function (r) { return r.map(function (c) { return '"' + String(c || '').replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
          ctx.download('Level_' + res.lv + (res.tower ? '_' + res.tower.replace(/\W+/g, '') : '') + '_' + ctx.today() + '.csv', new Blob(['﻿' + csv], { type: 'text/csv' }));
        } else if (id === 'lfSend' && res) {
          var group = prompt('Group for these tasks (e.g. "Outsource - Studio X")', 'Level ' + res.lv);
          if (group === null) return;
          var due = prompt('Due date for all (YYYY-MM-DD, optional)', '') || '';
          var perTower = {};
          res.fed.concat(res.models).forEach(function (m) {
            var t = m.tower || 'General';
            (perTower[t] = perTower[t] || []).push(m.name + (m.desc ? ' — ' + m.desc : ''));
          });
          var tasks = Object.keys(perTower).sort().map(function (t) {
            var seen = {};
            return { title: 'Level ' + res.lv + ' — ' + t + ' model check', due: due, notes: 'From ⇅ Models by level', subs: perTower[t].filter(function (n) { if (seen[n]) return false; seen[n] = 1; return true; }).map(function (n) { return { title: n }; }) };
          });
          if (!tasks.length) { ctx.toast('No models to send'); return; }
          ctx.sendToDelegation(tasks, group.trim() || ('Level ' + res.lv));
          ctx.close();
          if (typeof show === 'function') show('delegate');
        }
      });
      body.querySelector('#lfLv').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      setTimeout(function () { var i = body.querySelector('#lfLv'); i.focus(); if (i.value) go(); }, 60);
    }
  };
  function runClassic(ctx) { return classic.run(ctx); }
})();
