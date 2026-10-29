import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/model.js';

const M = globalThis.MPP.model;

function validProject() {
  const a = M.createTask('A', { durationDays: 2 });
  const b = M.createTask('B', { durationDays: 3, dependsOn: [a.id] });
  return { name: 'Demo', startDate: '2026-01-05', tasks: [a, b] };
}

test('createTask applies defaults', () => {
  const t = M.createTask('A');
  assert.equal(t.name, 'A');
  assert.equal(t.durationDays, 1);
  assert.equal(t.parentId, null);
  assert.equal(t.startDay, null);
  assert.deepEqual(t.dependsOn, []);
  assert.equal(t.notes, '');
  assert.ok(t.id);
});

test('a valid project passes validation', () => {
  assert.deepEqual(M.validateProject(validProject()), []);
});

test('missing project name is an error', () => {
  const p = validProject();
  p.name = '   ';
  assert.ok(M.validateProject(p).some(e => e.includes('Project name')));
});

test('missing or malformed start date is an error', () => {
  for (const bad of ['', 'not-a-date', '2026-13-99']) {
    const p = validProject();
    p.startDate = bad;
    assert.ok(M.validateProject(p).some(e => e.includes('start date')), `start date "${bad}"`);
  }
});

test('empty task list is an error', () => {
  const errors = M.validateProject({ name: 'x', startDate: '2026-01-05', tasks: [] });
  assert.ok(errors.some(e => e.includes('at least one task')));
});

test('invalid durations are rejected', () => {
  for (const bad of [0, -2, 1.5, '', null]) {
    const p = validProject();
    p.tasks[0].durationDays = bad;
    assert.ok(M.validateProject(p).some(e => e.includes('duration')), `duration ${bad}`);
  }
});

test('invalid earliest start days are rejected', () => {
  for (const bad of [-1, 2.5, 'x']) {
    const p = validProject();
    p.tasks[0].startDay = bad;
    assert.ok(M.validateProject(p).some(e => e.includes('earliest start day')), `start day ${bad}`);
  }
});

test('missing task name is an error', () => {
  const p = validProject();
  p.tasks[0].name = '';
  assert.ok(M.validateProject(p).some(e => e.includes('name is required')));
});

test('summary rows cannot have dependencies', () => {
  const a = M.createTask('A', { durationDays: 1 });
  const c = M.createTask('C', { parentId: a.id, durationDays: 1 });
  a.dependsOn = [c.id];
  const errors = M.validateProject({ name: 'x', startDate: '2026-01-05', tasks: [a, c] });
  assert.ok(errors.some(e => e.includes('cannot have its own dependencies')));
});

test('self-dependency is an error', () => {
  const p = validProject();
  p.tasks[1].dependsOn = [p.tasks[1].id];
  assert.ok(M.validateProject(p).some(e => e.includes('depend on itself')));
});

test('a subtask cannot depend on its parent', () => {
  const a = M.createTask('A', { durationDays: 1 });
  const c = M.createTask('C', { parentId: a.id, durationDays: 1, dependsOn: [a.id] });
  const errors = M.validateProject({ name: 'x', startDate: '2026-01-05', tasks: [a, c] });
  assert.ok(errors.some(e => e.includes('cannot depend on its parent')));
});

test('a task cannot depend on its own subtask', () => {
  const a = M.createTask('A', { durationDays: 1 });
  const c = M.createTask('C', { parentId: a.id, durationDays: 1 });
  a.dependsOn = [c.id];
  const errors = M.validateProject({ name: 'x', startDate: '2026-01-05', tasks: [a, c] });
  assert.ok(errors.some(e => e.includes('own subtask')));
});

test('nesting deeper than one level is an error', () => {
  const a = M.createTask('A', { durationDays: 1 });
  const c = M.createTask('C', { parentId: a.id, durationDays: 1 });
  const gc = M.createTask('GC', { parentId: c.id, durationDays: 1 });
  const errors = M.validateProject({ name: 'x', startDate: '2026-01-05', tasks: [a, c, gc] });
  assert.ok(errors.some(e => e.includes('one level')));
});

test('dependency on a missing task is an error', () => {
  const p = validProject();
  p.tasks[1].dependsOn = ['nope'];
  assert.ok(M.validateProject(p).some(e => e.includes('no longer exists')));
});

test('sample project passes validation', () => {
  assert.deepEqual(M.validateProject(M.sampleProject()), []);
});
