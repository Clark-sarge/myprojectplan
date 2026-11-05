# myProjectPlan — Project Status

_Last updated: 2026-11-05_

## Current state: Phase 2 in progress — critical path done ✅

Phase 1 (MVP) is complete. The repo now lives on GitHub at
https://github.com/Clark-sarge/myprojectplan with CI running lint + tests on
every push. First Phase 2 feature shipped: critical path highlighting with
slack tracking.

## Completed (Phase 2, so far)

| # | Deliverable | Commit |
|---|---|---|
| 1 | ESLint config + `npm run lint` | `8d3f623` |
| 2 | GitHub Actions CI (lint + tests) | `b44521d` |
| 3 | Critical path & slack in scheduler (backward pass) | `56ad72b` |
| 4 | Critical path in Gantt, legend, CSV; slack tooltips | `2e56ce6` |

## Completed (Phase 1)

| # | Deliverable | Commit |
|---|---|---|
| 1 | Repo scaffold (README, package.json, .gitignore) | `5fad959` |
| 2 | Data model, validation, localStorage persistence | `436a551` |
| 3 | Scheduler: dependencies, summary rollups, cycle detection | `4795896` |
| 4 | Build page: tasks, subtasks, durations, dependencies | `63bdae6` |
| 5 | Gantt chart page (SVG) + CSV export | `5b467ab` |
| 6 | CSV export button on build page | `f124955` |

## Verification

- 37/37 unit tests pass (`npm test` — validation, scheduling incl. critical
  path & slack, CSV output)
- `npm run lint` clean; `node --check` clean on all JS files
- Headless smoke test of the render path (critical bars, arrows, marker,
  legend, header): PASSED — 11 critical rects, 6 critical arrows, 3 normal
- CI green on GitHub: https://github.com/Clark-sarge/myprojectplan/actions
- Working tree: clean

## How to run

Open `index.html` in a browser (no server needed), or `npm start`.
Click **Load sample** → **Build Gantt Chart** → **Export CSV** for a full demo.
On the chart, red bars/arrows mark the critical path (zero slack); hover a bar
for its slack days.

## Phase 2 — Next up (priority order)

1. ~~Critical path highlighting~~ — done
2. Save/load project as .json files
3. Milestones & percent-complete tracking (add a normalize-on-load migration
   for existing localStorage data)
4. Zoom controls (day/week/month) — parameterize the scale in `renderChart`
5. Drag bars to reschedule (drag = manual constraint overriding dependency
   dates; conflicts shown as warnings)
6. Multiple named projects
7. Print-friendly styling

## Phase 3 — Future

Backend + user accounts · cloud sync & sharing · PDF/PNG export ·
project templates · resource assignment · PWA/offline
