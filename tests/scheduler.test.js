import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/model.js';
import '../js/scheduler.js';

const M = globalThis.MPP.model;
const S = globalThis.MPP.scheduler;

function proj(tasks, startDate) {
  return { name: 'T', startDate: startDate || '2026-01-05', tasks };
}

function byName(sched, name) {
  return sched.rows.find(r => r.name === name);
}

test('tasks without dependencies start on day 0', () => {
  const sched = S.scheduleProject(proj([
    M.createTask('A', { durationDays: 2 }),
    M.createTask('B', { durationDays: 3 })
  ]));
  assert.equal(sched.ok, true);
  const a = byName(sched, 'A');
  const b = byName(sched, 'B');
  assert.equal(a.startDay, 0);
  assert.equal(a.endDay, 2);
  assert.equal(b.startDay, 0);
  assert.equal(b.endDay, 3);
  assert.equal(sched.totalDays, 3);
});

test('finish-to-start chain: successor starts when predecessor ends', () => {
  const a = M.createTask('A', { durationDays: 2 });
  const b = M.createTask('B', { durationDays: 3, dependsOn: [a.id] });
  const sched = S.scheduleProject(proj([a, b]));
  const bb = byName(sched, 'B');
  assert.equal(bb.startDay, 2);
  assert.equal(bb.endDay, 5);
});

test('task with multiple dependencies starts after the latest one', () => {
  const a = M.createTask('A', { durationDays: 2 });
  const b = M.createTask('B', { durationDays: 5, dependsOn: [a.id] });
  const c = M.createTask('C', { durationDays: 2, dependsOn: [a.id] });
  const d = M.createTask('D', { durationDays: 1, dependsOn: [b.id, c.id] });
  const sched = S.scheduleProject(proj([a, b, c, d]));
  assert.equal(byName(sched, 'D').startDay, 7);
});

test('earliest start later than dependencies is respected', () => {
  const a = M.createTask('A', { durationDays: 2 });
  const b = M.createTask('B', { durationDays: 1, dependsOn: [a.id], startDay: 10 });
  const sched = S.scheduleProject(proj([a, b]));
  assert.equal(byName(sched, 'B').startDay, 10);
});

test('a dependency pushes a task past its earlier manual start', () => {
  const a = M.createTask('A', { durationDays: 5 });
  const b = M.createTask('B', { durationDays: 1, dependsOn: [a.id], startDay: 1 });
  const sched = S.scheduleProject(proj([a, b]));
  assert.equal(byName(sched, 'B').startDay, 5);
});

test('negative earliest start is clamped to day 0', () => {
  const sched = S.scheduleProject(proj([M.createTask('A', { durationDays: 1, startDay: -3 })]));
  assert.equal(byName(sched, 'A').startDay, 0);
});

test('invalid durations are treated as 1 day', () => {
  const sched = S.scheduleProject(proj([M.createTask('A', { durationDays: 0 })]));
  assert.equal(byName(sched, 'A').endDay, 1);
});

test('summary rows span their subtasks and ignore their own duration', () => {
  const parent = M.createTask('Phase', { durationDays: 99 });
  const c1 = M.createTask('One', { parentId: parent.id, durationDays: 2 });
  const c2 = M.createTask('Two', { parentId: parent.id, durationDays: 3, dependsOn: [c1.id] });
  const sched = S.scheduleProject(proj([parent, c1, c2]));
  const p = byName(sched, 'Phase');
  assert.equal(p.type, 'summary');
  assert.equal(p.startDay, 0);
  assert.equal(p.endDay, 5);
  assert.equal(p.durationDays, 5);
  assert.equal(byName(sched, 'One').wbs, '1.1');
  assert.equal(byName(sched, 'Two').wbs, '1.2');
  assert.equal(byName(sched, 'One').type, 'subtask');
});

test('rows are ordered parent-first with subtasks nested', () => {
  const p1 = M.createTask('P1', { durationDays: 1 });
  const p2 = M.createTask('P2', { durationDays: 1 });
  const c1 = M.createTask('C1', { parentId: p2.id, durationDays: 1 });
  const c2 = M.createTask('C2', { parentId: p2.id, durationDays: 1 });
  const sched = S.scheduleProject(proj([p1, p2, c1, c2]));
  assert.deepEqual(sched.rows.map(r => r.name), ['P1', 'P2', 'C1', 'C2']);
});

test('depending on a summary row means after all of its subtasks', () => {
  const phase = M.createTask('Phase', { durationDays: 1 });
  const c1 = M.createTask('One', { parentId: phase.id, durationDays: 3 });
  const c2 = M.createTask('Two', { parentId: phase.id, durationDays: 2, dependsOn: [c1.id] });
  const x = M.createTask('After', { durationDays: 1, dependsOn: [phase.id] });
  const sched = S.scheduleProject(proj([phase, c1, c2, x]));
  assert.equal(byName(sched, 'After').startDay, 5);
});

test('dates are computed from the project start date', () => {
  const sched = S.scheduleProject(proj([M.createTask('A', { durationDays: 5 })], '2026-01-05'));
  const r = byName(sched, 'A');
  assert.equal(r.startDate.getFullYear(), 2026);
  assert.equal(r.startDate.getMonth(), 0);
  assert.equal(r.startDate.getDate(), 5);
  assert.equal(r.endDate.getDate(), 9);
  assert.equal(sched.finishDate.getDate(), 9);
});

test('direct circular dependency is reported with task names', () => {
  const a = M.createTask('A');
  const b = M.createTask('B', { dependsOn: [a.id] });
  a.dependsOn = [b.id];
  const sched = S.scheduleProject(proj([a, b]));
  assert.equal(sched.ok, false);
  assert.match(sched.errors[0], /Circular dependency/);
  assert.match(sched.errors[0], /"A"/);
  assert.match(sched.errors[0], /"B"/);
});

test('indirect circular dependency is reported', () => {
  const a = M.createTask('A');
  const b = M.createTask('B', { dependsOn: [a.id] });
  const c = M.createTask('C', { dependsOn: [b.id] });
  a.dependsOn = [c.id];
  const sched = S.scheduleProject(proj([a, b, c]));
  assert.equal(sched.ok, false);
  assert.match(sched.errors[0], /Circular dependency/);
});

test('cycles through summary rollup are detected', () => {
  const phase = M.createTask('Phase');
  const child = M.createTask('Child', { parentId: phase.id, durationDays: 2 });
  const x = M.createTask('X', { durationDays: 1, dependsOn: [phase.id] });
  child.dependsOn = [x.id];
  const sched = S.scheduleProject(proj([phase, child, x]));
  assert.equal(sched.ok, false);
  assert.match(sched.errors[0], /Circular dependency/);
});

test('sample project schedules successfully', () => {
  const p = M.sampleProject();
  const sched = S.scheduleProject(p);
  assert.equal(sched.ok, true);
  assert.ok(sched.totalDays > 0);
  assert.equal(byName(sched, 'Deploy').startDay, 27);
  assert.equal(sched.totalDays, 28);
});

test('a simple chain is all critical with zero slack', () => {
  const a = M.createTask('A', { durationDays: 2 });
  const b = M.createTask('B', { durationDays: 3, dependsOn: [a.id] });
  const sched = S.scheduleProject(proj([a, b]));
  assert.equal(byName(sched, 'A').critical, true);
  assert.equal(byName(sched, 'A').slackDays, 0);
  assert.equal(byName(sched, 'B').critical, true);
  assert.equal(byName(sched, 'B').slackDays, 0);
});

test('the longer of two parallel paths is critical; the other has slack', () => {
  const a = M.createTask('A', { durationDays: 2 });
  const b = M.createTask('B', { durationDays: 5, dependsOn: [a.id] });
  const c = M.createTask('C', { durationDays: 2, dependsOn: [a.id] });
  const d = M.createTask('D', { durationDays: 1, dependsOn: [b.id, c.id] });
  const sched = S.scheduleProject(proj([a, b, c, d]));
  assert.equal(byName(sched, 'A').critical, true);
  assert.equal(byName(sched, 'B').critical, true);
  assert.equal(byName(sched, 'B').slackDays, 0);
  assert.equal(byName(sched, 'C').critical, false);
  assert.equal(byName(sched, 'C').slackDays, 3);
  assert.equal(byName(sched, 'D').critical, true);
});

test('a standalone task is critical', () => {
  const sched = S.scheduleProject(proj([M.createTask('A', { durationDays: 4 })]));
  assert.equal(byName(sched, 'A').critical, true);
  assert.equal(byName(sched, 'A').slackDays, 0);
});

test('sample project: expected critical chain and slack values', () => {
  const sched = S.scheduleProject(M.sampleProject());
  const names = ['Requirements', 'Wireframes', 'Visual design', 'Frontend build', 'Integration', 'Testing', 'Deploy'];
  names.forEach(function (name) {
    const r = byName(sched, name);
    assert.equal(r.critical, true, name + ' should be critical');
    assert.equal(r.slackDays, 0);
  });
  assert.equal(byName(sched, 'Backend build').critical, false);
  assert.equal(byName(sched, 'Backend build').slackDays, 7);
  assert.equal(byName(sched, 'Budget approval').slackDays, 23);
});

test('summary rows inherit criticality and minimum slack from subtasks', () => {
  const phase = M.createTask('Phase', { durationDays: 9 });
  const one = M.createTask('One', { parentId: phase.id, durationDays: 3 });
  const two = M.createTask('Two', { parentId: phase.id, durationDays: 1 });
  const sched = S.scheduleProject(proj([phase, one, two]));
  const p = byName(sched, 'Phase');
  assert.equal(p.critical, true);
  assert.equal(p.slackDays, 0);
  assert.equal(byName(sched, 'Two').critical, false);
  assert.equal(byName(sched, 'Two').slackDays, 2);
});
