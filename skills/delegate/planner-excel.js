/* ═══════════════════════════════════════════════════════════════════
   skills/delegate/planner-excel.js — the Excel "planner" file
   ───────────────────────────────────────────────────────────────────
   build(ExcelJS, plan) → workbook with 3 sheets (+1 hidden):
     Tasks     list view — your team edits only Status + Notes (green)
     Calendar  month grid — pick a month and a person in the green cells
     Guide     how to fill it in
     _lt       hidden: which project / export this file came from
   read(ExcelJS, buffer) → { meta, rows:[{id, status, notes}] }  for import.
   Works in the browser and in Node (same code).
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var STATUSES = ['Not started', 'In progress', 'Completed'];
  var C = { ink: 'FF1E2A1A', acc: 'FF3F7A3A', panel: 'FFF3F6E6', zebra: 'FFECF0DC', green: 'FFD8ECB0', muted: 'FF4E5E44', grid: 'FF9AA88C', red: 'FFC2452F', ok: 'FF2F8A4A', today: 'FFFFF3B0', other: 'FFF7F8F2', otherInk: 'FFB8C2AE', white: 'FFF3F6E6' };
  var MONO = 'Consolas';
  var thin = { style: 'thin', color: { argb: C.grid } };
  var box = { top: thin, left: thin, bottom: thin, right: thin };
  var H = 5;            // header row on the Tasks sheet
  var EXTRA = 60;       // spare rows that still get formulas (for rows your team adds)

  function fill(argb) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; }
  function toDate(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s) ? null : s;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s), d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    return d && !isNaN(d) ? d : null;
  }
  // Excel refuses the whole sheet if a cell holds characters XML can't carry (pasted tabs/bells/odd symbols)
  function clean(v) {
    if (v == null) return '';
    return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, ' ')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1').slice(0, 32000);
  }

  /* plan = { project, issuedBy, issuedAt (Date), scope, month (Date), people:[], exportId, projectId,
              tasks:[{code, group, title, assignees, due, status, notes, subs:[{code, title, assignees, due, status, notes}]}] } */
  function build(ExcelJS, plan) {
    var wb = new ExcelJS.Workbook();
    wb.creator = "Lew's Tracker"; wb.created = plan.issuedAt || new Date();
    var ws = wb.addWorksheet('Tasks', { properties: { tabColor: { argb: C.acc }, outlineLevelRow: 1, outlineProperties: { summaryBelow: false } }, views: [{ state: 'frozen', ySplit: H, xSplit: 0 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    var widths = [9, 22, 34, 32, 18, 12, 14, 11, 40, 4];
    widths.forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    ws.getColumn(10).hidden = true;

    ws.getCell('A1').value = 'TASK PLAN'; ws.getCell('A1').font = { name: MONO, bold: true, size: 16, color: { argb: C.ink } };
    var issued = plan.issuedAt || new Date();
    ws.getCell('A2').value = clean('Project: ' + (plan.project || '') + '   |   Issued by: ' + (plan.issuedBy || '') + '   |   Issued: ' + issued.toDateString().slice(4) + (plan.scope ? '   |   ' + plan.scope : ''));
    ws.getCell('A2').font = { size: 10, color: { argb: C.muted } };
    ws.getCell('A3').value = 'Only change the GREEN columns: Status and Notes.  Progress fills in by itself.';
    ws.getCell('A3').font = { size: 10, italic: true, color: { argb: C.acc } };

    var hdr = ['ID', 'Group', 'Task', 'Subtask', 'Assigned to', 'Due date', 'Status', 'Progress', 'Notes', '_label'];
    hdr.forEach(function (h, i) {
      var c = ws.getCell(H, i + 1); c.value = h;
      c.font = { name: MONO, bold: true, color: { argb: C.white } };
      c.fill = fill(h === 'Status' || h === 'Notes' ? C.acc : C.ink);
      c.alignment = { vertical: 'middle' }; c.border = box;
    });
    ws.getRow(H).height = 22;

    var r = H + 1, statusRows = [];
    var okStatus = function (v) { return STATUSES.indexOf(v) > -1 ? v : 'Not started'; };
    var pct = function (row) { return 'IF(G' + row + '="Completed",1,IF(G' + row + '="In progress",0.5,0))'; };
    (plan.tasks || []).forEach(function (t) {
      var subs = t.subs || [];
      var vals = [clean(t.code), clean(t.group), clean(t.title), '', clean(t.assignees), toDate(t.due), subs.length ? null : okStatus(t.status), null, clean(t.notes)];
      vals.forEach(function (v, i) { var c = ws.getCell(r, i + 1); if (v !== null) c.value = v; c.border = box; c.fill = fill(C.zebra); });
      ws.getCell(r, 3).font = { bold: true };
      if (subs.length) {
        var first = r + 1, last = r + subs.length;
        ws.getCell(r, 8).value = { formula: 'AVERAGE(H' + first + ':H' + last + ')' };
        ws.getCell(r, 7).value = { formula: 'IF(H' + r + '=1,"Completed",IF(H' + r + '>0,"In progress","Not started"))' };
        ws.getCell(r, 7).font = { italic: true, color: { argb: C.muted } };
      } else { ws.getCell(r, 8).value = { formula: pct(r) }; statusRows.push(r); }
      r++;
      subs.forEach(function (s) {
        var sv = [clean(s.code), clean(t.group), '', '↳ ' + clean(s.title), clean(s.assignees), toDate(s.due) || toDate(t.due), okStatus(s.status), null, clean(s.notes)];
        sv.forEach(function (v, i) { var c = ws.getCell(r, i + 1); if (v !== null) c.value = v; c.border = box; });
        ws.getCell(r, 8).value = { formula: pct(r) };
        ws.getRow(r).outlineLevel = 1;
        Object.defineProperty(ws.getRow(r), 'collapsed', { value: false });   // shown rows must not be marked "collapsed"
        statusRows.push(r);
        r++;
      });
    });
    var LAST = Math.max(r - 1, H + 1), MAXR = LAST + EXTRA;
    for (var rr = H + 1; rr <= MAXR; rr++) {
      ws.getCell(rr, 10).value = { formula: 'IF(OR(F' + rr + '="",AND(C' + rr + '="",D' + rr + '="")),"",IF(G' + rr + '="Completed","✔ ","• ")&IF(D' + rr + '<>"",SUBSTITUTE(D' + rr + ',"↳ ",""),C' + rr + ')&" - "&E' + rr + ')' };
      ws.getCell(rr, 6).numFmt = 'dd mmm yy';
      ws.getCell(rr, 8).numFmt = '0%';
      ws.getCell(rr, 9).alignment = { wrapText: true, vertical: 'top' };
      ws.getCell(rr, 9).protection = { locked: false };
    }
    statusRows.forEach(function (row) {
      var c = ws.getCell(row, 7);
      c.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + STATUSES.join(',') + '"'], showErrorMessage: true, errorTitle: 'Status', error: 'Pick Not started, In progress or Completed' };
      c.protection = { locked: false }; c.fill = fill(C.green);
    });
    ws.autoFilter = { from: { row: H, column: 1 }, to: { row: LAST, column: 9 } };
    var rng = 'A' + (H + 1) + ':I' + LAST;
    ws.addConditionalFormatting({ ref: rng, rules: [
      { type: 'expression', priority: 1, formulae: ['AND($F' + (H + 1) + '<TODAY(),$G' + (H + 1) + '<>"Completed",$F' + (H + 1) + '<>"")'], style: { font: { color: { argb: C.red }, bold: true } } },
      { type: 'expression', priority: 2, formulae: ['$G' + (H + 1) + '="Completed"'], style: { font: { color: { argb: C.ok }, strike: true } } }
    ] });
    ws.addConditionalFormatting({ ref: 'H' + (H + 1) + ':H' + LAST, rules: [
      { type: 'expression', priority: 3, formulae: ['AND(ISNUMBER(H' + (H + 1) + '),H' + (H + 1) + '>=1)'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF8FD16A' } } } },
      { type: 'expression', priority: 4, formulae: ['AND(ISNUMBER(H' + (H + 1) + '),H' + (H + 1) + '>0,H' + (H + 1) + '<1)'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFE3F2C4' } } } }
    ] });
    // summary (top right)
    var sum = [['F1', 'Tasks', 'G1', 'COUNTA(A' + (H + 1) + ':A' + LAST + ')'], ['F2', 'Completed', 'G2', 'COUNTIF(G' + (H + 1) + ':G' + LAST + ',"Completed")'],
      ['F3', 'Overdue', 'G3', 'SUMPRODUCT((F' + (H + 1) + ':F' + LAST + '<TODAY())*(F' + (H + 1) + ':F' + LAST + '<>"")*(G' + (H + 1) + ':G' + LAST + '<>"Completed"))'],
      ['H1', 'Overall', 'I1', 'IFERROR(AVERAGE(H' + (H + 1) + ':H' + LAST + '),0)']];
    sum.forEach(function (x) {
      ws.getCell(x[0]).value = x[1]; ws.getCell(x[0]).font = { name: MONO, bold: true, size: 9, color: { argb: C.muted } };
      ws.getCell(x[2]).value = { formula: x[3] }; ws.getCell(x[2]).font = { name: MONO, bold: true, size: 12, color: { argb: x[1] === 'Overdue' ? C.red : C.ink } };
    });
    ws.getCell('I1').numFmt = '0%';

    /* ---------- Calendar ---------- */
    var cs = wb.addWorksheet('Calendar', { properties: { tabColor: { argb: 'FF2F6FA8' } }, pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });
    cs.getCell('A1').value = 'CALENDAR'; cs.getCell('A1').font = { name: MONO, bold: true, size: 16, color: { argb: C.ink } };
    cs.getCell('A2').value = 'Month (type any date):';
    var m = plan.month ? new Date(plan.month) : null; if (m && isNaN(m)) m = null;
    cs.getCell('C2').value = m ? new Date(Date.UTC(m.getFullYear(), m.getMonth(), 1)) : { formula: 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)' };
    cs.getCell('C2').numFmt = 'mmmm yyyy';
    cs.getCell('E2').value = 'Show person / group:';
    cs.getCell('G2').value = 'All';
    ['C2', 'G2'].forEach(function (a) { var c = cs.getCell(a); c.fill = fill(C.green); c.font = { name: MONO, bold: true }; c.border = box; c.protection = { locked: false }; });
    var names = ['All'].concat(plan.people || []).map(function (n) { return clean(n).replace(/[",]/g, ' ').trim(); }).filter(Boolean);
    var list = names.join(',');
    if (list.length < 250) cs.getCell('G2').dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + list + '"'] };
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d, i) {
      var c = cs.getCell(4, i + 1); c.value = d; c.font = { name: MONO, bold: true, color: { argb: C.white } }; c.fill = fill(C.ink); c.alignment = { horizontal: 'center' };
      cs.getColumn(i + 1).width = 24;
    });
    var T = 'Tasks!';
    for (var w = 0; w < 6; w++) {
      var dr = 5 + w * 2, tr = dr + 1;
      cs.getRow(tr).height = 78;
      for (var d = 0; d < 7; d++) {
        var col = String.fromCharCode(65 + d);
        var dc = cs.getCell(col + dr);
        dc.value = { formula: '$C$2-WEEKDAY($C$2,2)+1+' + (w * 7 + d) };
        dc.numFmt = 'd'; dc.font = { name: MONO, bold: true, size: 10 }; dc.border = { left: thin, right: thin, top: thin };
        var f = '_xlfn.TEXTJOIN(CHAR(10),TRUE,IF((' + T + '$F$' + (H + 1) + ':$F$' + MAXR + '=' + col + dr + ')*((($G$2="All")+ISNUMBER(SEARCH($G$2,' + T + '$B$' + (H + 1) + ':$B$' + MAXR + '&" "&' + T + '$E$' + (H + 1) + ':$E$' + MAXR + ')))>0),' + T + '$J$' + (H + 1) + ':$J$' + MAXR + ',""))';
        var tc = cs.getCell(col + tr);
        tc.value = { formula: f, shareType: 'array', ref: col + tr };
        tc.alignment = { wrapText: true, vertical: 'top' }; tc.font = { size: 9 }; tc.border = { left: thin, right: thin, bottom: thin };
      }
      var ref = 'A' + dr + ':G' + tr;
      cs.addConditionalFormatting({ ref: ref, rules: [
        { type: 'expression', priority: 1, formulae: ['A$' + dr + '=TODAY()'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.today } } } },
        { type: 'expression', priority: 2, formulae: ['MONTH(A$' + dr + ')<>MONTH($C$2)'], style: { font: { color: { argb: C.otherInk } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.other } } } }
      ] });
    }
    cs.getCell('A18').value = '✔ = completed   • = open   |   Change the month or the person in the green cells above.   (Needs Excel 2019 / Microsoft 365.)';
    cs.getCell('A18').font = { size: 9, italic: true, color: { argb: C.muted } };

    /* ---------- Guide ---------- */
    var g = wb.addWorksheet('Guide');
    g.getColumn(1).width = 92;
    ['HOW TO USE THIS FILE', '',
      '1.  Go to the Tasks sheet.',
      '2.  Find the rows with your name in "Assigned to".',
      '3.  Change Status (drop-down): Not started / In progress / Completed.',
      '4.  Write your updates in Notes.',
      '5.  Progress fills in by itself. A main task updates from its subtasks.',
      '6.  Use the + / − on the left to open or close subtasks.',
      '7.  Calendar sheet: pick a month and your name to see your deadlines.',
      '8.  Save the file and send it back. Please do not rename it or change the IDs.',
      '', 'Red text = overdue.   Green with a line through = completed.',
      '', 'Made with Lew\'s Tracker — Delegation skill.'].forEach(function (t, i) {
      var c = g.getCell(i + 1, 1); c.value = t; c.font = i === 0 ? { name: MONO, bold: true, size: 14 } : { size: 11 };
    });

    /* ---------- hidden: where this file came from ---------- */
    var meta = wb.addWorksheet('_lt', { state: 'veryHidden' });
    meta.getCell('A1').value = 'lt-planner'; meta.getCell('B1').value = 1;
    meta.getCell('A2').value = clean(plan.projectId); meta.getCell('A3').value = clean(plan.exportId); meta.getCell('A4').value = issued.toISOString();
    meta.getCell('A5').value = clean(plan.project);

    ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, sort: true, formatColumns: true, formatRows: true });
    cs.protect('', { selectLockedCells: true, selectUnlockedCells: true });
    return wb;
  }

  /* ---------- read a returned file ---------- */
  function text(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(function (x) { return x.text; }).join('');
      if (v.result !== undefined) return text(v.result);
      if (v.text !== undefined) return String(v.text);
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return '';
    }
    return String(v);
  }
  function read(ExcelJS, buffer) {
    var wb = new ExcelJS.Workbook();
    return wb.xlsx.load(buffer).then(function () {
      var meta = {};
      var m = wb.getWorksheet('_lt');
      if (m) meta = { projectId: text(m.getCell('A2').value), exportId: text(m.getCell('A3').value), exportedAt: text(m.getCell('A4').value), project: text(m.getCell('A5').value) };
      var ws = wb.getWorksheet('Tasks');
      if (!ws) throw new Error('No "Tasks" sheet in this file — is it a task plan from the Delegation skill?');
      var head = 0, col = {};
      for (var r = 1; r <= Math.min(20, ws.rowCount); r++) {
        var row = ws.getRow(r), found = {};
        row.eachCell(function (c, i) { var t = text(c.value).trim().toLowerCase(); if (t) found[t] = i; });
        if (found.id && found.status) { head = r; col = found; break; }
      }
      if (!head) throw new Error('Could not find the header row (ID … Status … Notes) on the Tasks sheet.');
      var rows = [];
      for (var i = head + 1; i <= ws.rowCount; i++) {
        var id = text(ws.getRow(i).getCell(col.id).value).trim();
        if (!id) continue;
        var stCell = ws.getRow(i).getCell(col.status);
        rows.push({
          id: id,
          status: text(stCell.value).trim(),
          derived: !!(stCell.value && typeof stCell.value === 'object' && stCell.value.formula),
          notes: col.notes ? text(ws.getRow(i).getCell(col.notes).value) : null
        });
      }
      return { meta: meta, rows: rows };
    });
  }

  var api = { build: build, read: read, STATUSES: STATUSES };
  root.LTPlannerExcel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
