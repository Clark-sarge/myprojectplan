import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/model.js';
import '../js/scheduler.js';
import '../js/csv.js';

const M = globalThis.MPP.model;
const S = globalThis.MPP.scheduler;
const C = globalThis.MPP.csv;

function sampleCsv() {
  const project = M.sampleProject();
  return C.projectToCsv(project, S.scheduleProject(project));
}

test('csv header includes critical and slack columns', () => {
  const header = sampleCsv().split('\r\n')[0].replace(/^\uFEFF/, '');
  assert.equal(
    header,
    'ID,Task,Type,Parent,Start Date,End Date,Duration (days),Critical,Slack (days),Depends On,Notes'
  );
});

test('critical tasks are flagged with zero slack in csv rows', () => {
  const lines = sampleCsv().split('\r\n');
  const deploy = lines.find(l => l.includes('Deploy'));
  assert.ok(deploy.includes(',Yes,0,'));
  const backend = lines.find(l => l.includes('Backend build'));
  assert.ok(backend.includes(',No,7,'));
});
