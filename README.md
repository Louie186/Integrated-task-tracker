# Lew's Tracker v10 — BIM Command Center

Live site: https://louie186.github.io/Integrated-task-tracker/

## How it is built — like a computer

- **`index.html` — the mother file (the case).** Login, menu, your own tracker tabs, and the **SKILL LIST** near the bottom.
- **`core/` — the motherboard.** You rarely touch it.
  - `app.js` / `app.css` — the tracker itself (Dashboard, To Do, Focus, Calendar, Notes, Finance, Settings)
  - `lt.js` — plugs the skills in (menu, ⚡ Skills launcher, Settings → Skills)
  - `theme.js` + `theme.css` — **one theme for every tab** (Gold, Pastel, Rose, 8-bit Game Boy, 8-bit Arcade · dark / light)
  - `projects.js` — 📁 switch between projects
  - `sync.js` — encrypted cloud backup (GitHub Gist)
- **`skills/` — the upgrade pieces.** One folder per skill.
- **`lib/`** — Excel and PDF libraries, so those features work offline.
- **`img/`** — pet artwork (only loaded when the pet is opened).

## The skills

| Skill | Type | What it does |
|---|---|---|
| Delegation | Page | Give tasks to your team or outsource. **✚ Checklist** generator, list / board / calendar, **📊 Overview** (people, groups, files, history). Makes an Excel planner and reads it back. |
| QA/QC | Page | Checklists, issues, team, PDF reports |
| MIDP Checker | Page | Load the MIDP, model list and submission lists. **Find** any drawing fast, make your own **lists**, and **track** what is due, late, sent or revised. |
| Register (classic) | Page | The previous register, switched off by default |
| Models by level | Tool | Pick a level (e.g. L16) to get the drawings on it, grouped by model. Uses the MIDP Checker. Can send them to Delegation. |
| Weekly report | Tool | A one-page printable report for the week |
| Project pulse | Add-on | Dashboard card for the open project |
| Reminders | Add-on | Daily due/overdue summary and a backup nudge |
| 8-bit sounds & XP | Add-on | Chiptune sounds and an XP level (8-bit skins only) |
| Urume-chan pet | Add-on | The desktop pet |

- **Page** = its own tab in the menu
- **Tool** = run it from **⚡ Skills** (or press **S**)
- **Add-on** = loads with the app
- Switch any skill off in **Settings → Skills**. It stays installed, so you can switch it back on.

## Add a new skill — 3 steps

1. **Make a folder** `skills/my-skill/` and put the file in it.
2. **Add one line** to the SKILL LIST in `index.html`. Copy a line of the same type and change it.
3. **Upload** both to GitHub. The skill shows up in the menu or in ⚡ Skills.

### Starter for a Tool (`skills/my-skill/my-skill.js`)

```js
(function () {
  LT.fn['my-skill'] = {
    run: function (ctx) {
      // ctx.drawingRegister() → MIDP drawings   ctx.qaqc() → QA/QC data
      // ctx.tracker()   → your To Do data    ctx.project() → open project
      // ctx.sendToDelegation([{ title, due, subs:[{ title }] }], 'Group name')
      ctx.modal('My skill', '<p>Hello from my skill</p>');
    }
  };
})();
```

### The matching SKILL LIST line

```js
{ id:'my-skill', type:'function', name:'My skill', icon:'★', version:'1.0',
  file:'skills/my-skill/my-skill.js', desc:'What it does, in one line.' },
```

### For a Page skill

- Make a normal `.html` page in `skills/my-page/`.
- Add these two lines in its `<head>`, so it follows the theme:

```html
<link rel="stylesheet" href="../../core/theme.css">
<script src="../../core/theme.js"></script>
```

- If it saves data that belongs to one project, list the storage names in `projectKeys`. They then move with the 📁 project switch.

## Projects

- **Moves with the project:** MIDP Checker (files, lists) and Delegation data.
- **Shared by all projects:** your To Do list, Notes, Finance and Calendar.
- **QA/QC** keeps its own project list. It opens the QA/QC project you last used with each project.
- **Parked safely:** projects you're not working on are kept in the browser's larger storage area. Switching never deletes anything.
- **Export / Import:** you can export a project to a `.json` file and import it on another computer.

## MIDP Checker — the 5 tabs

- **Find** → **Lookup** (search anything: number, title, typology, model, L16, T1) and **Lists**
- **Track** → Overview · Tracker · Chase list · Categories
- **Review** → Changes · Checks · Pre-check
- **Deliver** → Submissions · Models
- **Files** → load the MIDP, model list and submission lists

### Edit many rows in Excel

- **Export Excel** (everything, full Drawing_Tracker layout) or **⤓ Export this view** → exactly the columns you have on screen, in the same order, only the rows you see (or only the ticked rows). Filters on, yellow columns = yours.
- Edit in Excel (filter, fill down, paste). Work status has a drop-down.
- **Files → Your exported tracker** → you see every change (Now → From the file) and press **Apply**. Only your columns are read back (Work status, Assigned to, Notes, Tower, Typology, Model number, your own); info columns (Due, Sent, Rev…) are skipped. Each change goes in the history.

### Lists

- **Tick** lines and pick **Add to list**, or **drag** a line onto a list.
- You can add drawings, whole typologies or models. Typologies and models stay up to date with each new MIDP.
- **⚡ Save as list** keeps a search. It refreshes itself.
- **Quick lists** are made for you: per building, level, type, typology and status.
- Every list: Excel, Copy, or send to Delegation.
- The revision shown is always the MIDP's. Submissions only add history.

## Checklist generator + Overview (Delegation)

- **✚ Checklist** = the ADD TASK button from the Excel generator, in the website.
- One task + its items: type or paste a list, make numbered blank rows, or pick a **MIDP Checker list**.
- **Smart paste:** paste rows copied from Excel or the MIDP Checker (Copy). It finds the columns — e.g. *Drawing number + Title* as the item, plus *Assignee* and *Date* when present (05/11/2026, 5-Nov-26, Excel dates). Change the picks in the drop-downs; the header row is skipped.
- **Ctrl + V** on the Delegation page opens the Checklist generator with the list in it.
- In a task's edit window, **📋 Paste list** adds many subtasks at once.
- **Create & make Excel** goes straight to the file for that person.
- **📊 Overview**: per person (items, done, overdue, next due), per group progress, files sent and received, full history.
- **⬇ Summary Excel**: People, Groups and Activity sheets.

## Share tasks (Delegation → ⬇ Share tasks)

- **📄 Task Pack** (recommended): one `.html` file per person. Opens in Chrome / Edge, no login, no internet.
  - Big **To do / Doing / Done** buttons, a note on every line, **+ Add item**, **+ New task**, a message box.
  - Their work is kept on their computer. They press **📤 Save reply** (a small `.txt`) or **📋 Copy reply** (paste into email / Teams).
  - You: **⬆ Import update** (the file) or **📋 Paste reply** (the text). Same preview, tick boxes and history as Excel.
  - The app and the tasks inside are scrambled — Notepad shows gibberish. A reply can only change the tasks that were in its pack.
- **▦ Simple Excel**: a plain table to copy by hand. It can still be read back (ID / Status / Notes).
- **▤ Checklist Excel (.xlsm)**: Lew's Checklist template (`skills/delegate/templates/checklist-template.xlsm`) with the tasks filled in. ADD TASK / MAKE A COPY / EXECUTE GANTT buttons work once macros are allowed. A hidden *Website ID* column links rows back; rows added with ADD TASK come in as new tasks.
- **History with many files:** one person = one shared progress on their computer, so a newer Task Pack opens with their earlier clicks. A reply only carries what they changed, so an older file can't undo newer work. Pick several reply files at once in ⬆ Import update.

## Excel planner (Delegation)

- Click **⬇ Excel planner** and choose: everything, one group, or one person.
- Same look as the Checklist generator: purple title, blue task rows, sub-rows you open with **+ / −**.
- 2 sheets: **Tasks** and **Guide**. Yellow cells = what your team fills in.
- Your team changes only **Status** and **Notes** (yellow).
- When they send it back, use **⬆ Import update**. You see every change before it's applied.
- **Add more in the same file:** insert a row inside a task's group and leave **ID empty** → new sub-item. Use an empty **NEW** block at the bottom (already grouped with + / −) → new task with its items. Empty blocks are ignored; a new task takes the group of the task above.
- Import gives them proper IDs and notes it in each task's history. Importing the same file again doesn't add them twice.
- Opens in any Excel version. No macros.

## MIDP Checker offline (one file)

- Make it: `python3 tools/make-midp-offline.py` → `MIDP_Checker_offline.html` (about 2 MB).
- Double-click to open in Chrome / Edge. No website, no internet needed.
- Its data stays on that computer, separate from the website. Move work across with **Export Excel** → **Your exported tracker**.

## Before uploading changes

- Open the site and sign in.
- Click through every tab.
- Switch the theme once.
- Open the browser console (F12). It should show no red errors.
