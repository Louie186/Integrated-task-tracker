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
| Delegation | Page | Give tasks to your team or outsource. List, board and calendar views. Makes an Excel planner and reads it back. |
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

### Lists

- **Tick** lines and pick **Add to list**, or **drag** a line onto a list.
- You can add drawings, whole typologies or models. Typologies and models stay up to date with each new MIDP.
- **⚡ Save as list** keeps a search. It refreshes itself.
- **Quick lists** are made for you: per building, level, type, typology and status.
- Every list: Excel, Copy, or send to Delegation.
- The revision shown is always the MIDP's. Submissions only add history.

## Excel planner (Delegation)

- Click **⬇ Excel planner** and choose: everything, one group, or one person.
- The file has 3 sheets: **Tasks** (list), **Calendar** (month grid) and **Guide**.
- Your team changes only **Status** and **Notes**. Everything else is locked.
- When they send it back, use **⬆ Import update**. You see every change before it's applied.
- The Calendar sheet needs **Excel 2019 or Microsoft 365**.

## Before uploading changes

- Open the site and sign in.
- Click through every tab.
- Switch the theme once.
- Open the browser console (F12). It should show no red errors.
