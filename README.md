# myProjectPlan

A lightweight, browser-based app for building Gantt charts for project planning.
No accounts, no server, no build step — everything runs locally in your browser.

## Features

- **Build page** — list tasks, add subtasks (one level), set durations in days,
  create finish-to-start dependencies, and set optional "earliest start" constraints.
- **Gantt page** — a waterfall-style Gantt chart with summary bars, dependency
  arrows, weekend shading, and a today marker, on its own page.
- **Critical path** — the longest chain of dependent tasks is computed
  (forward/backward pass) and highlighted in red; slack days per task are
  shown in tooltips and the CSV export.
- **CSV export** — download the full schedule (with computed dates) for Excel
  or any other tool.
- **Auto-save** — your project is stored in your browser (localStorage). Nothing
  leaves your machine.

## Getting started

No installation required. Open `index.html` in any modern browser, or serve the
folder over HTTP:

```
npx serve .
```

Then:

1. Enter a project name and start date.
2. Add tasks and subtasks, set durations, and pick dependencies.
3. Click **Build Gantt Chart** to open the chart.
4. Click **Export CSV** to download the schedule.

Tip: click **Load sample** on the build page to see a full worked example.

## Tests

```
npm test
npm run lint
```

Unit tests (`node:test`, zero runtime dependencies) cover data validation, the
scheduling engine (including critical path and slack), and CSV output. ESLint
and the test suite run in CI on every push (GitHub Actions).

## How scheduling works

- **Finish-to-start**: a task starts the day its dependencies finish (or later,
  if an earliest-start day is set).
- **Summary rows** (tasks with subtasks) automatically span their subtasks;
  their own duration and dependencies are ignored.
- **Depending on a summary row** means "after all of its subtasks finish".
- **Circular dependencies** are detected and reported with the task names.

## CSV format

| Column | Description |
|---|---|
| ID | WBS number (1, 1.1, 2, …) |
| Task | Task name |
| Type | Task, Subtask, or Summary |
| Parent | Parent task name (subtasks only) |
| Start Date | Computed start date (YYYY-MM-DD) |
| End Date | Computed finish date (YYYY-MM-DD, inclusive) |
| Duration (days) | Scheduled duration |
| Critical | Yes if the task is on the critical path (zero slack) |
| Slack (days) | Days the task can slip without delaying the project |
| Depends On | Dependency names, semicolon-separated |
| Notes | Free-form notes |

## Project structure

```
index.html      Build page
chart.html      Gantt chart page
css/styles.css  Styling
js/model.js     Data model, validation, localStorage persistence
js/scheduler.js Dependency resolution and scheduling engine
js/build.js     Build page logic
js/gantt.js     SVG chart renderer
js/csv.js       CSV export
tests/          Unit tests (node:test)
```

## Roadmap

**Phase 2 (in progress):** ~~critical path highlighting~~ (done) · milestones &
percent complete · zoom controls · drag-to-reschedule · save/load `.json`
project files · multiple named projects · print-friendly styling

**Phase 3 (future):** backend & user accounts · cloud sync and sharing ·
PDF/PNG export · project templates · resource assignment · offline/PWA
