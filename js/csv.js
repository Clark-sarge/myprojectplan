(function (global) {
  'use strict';

  var COLUMNS = ['ID', 'Task', 'Type', 'Parent', 'Start Date', 'End Date', 'Duration (days)', 'Depends On', 'Notes'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function isoDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function esc(v) {
    var s = v == null ? '' : String(v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function projectToCsv(project, sched) {
    var map = {};
    project.tasks.forEach(function (t) { map[t.id] = t; });

    var lines = [COLUMNS.join(',')];
    sched.rows.forEach(function (row) {
      var parentName = row.type === 'subtask' ? row.parentName : '';
      var depNames = (row.dependsOn || []).map(function (id) {
        return map[id] ? map[id].name : id;
      }).join('; ');
      lines.push([
        row.wbs,
        row.name,
        row.type === 'summary' ? 'Summary' : row.type === 'subtask' ? 'Subtask' : 'Task',
        parentName,
        isoDate(row.startDate),
        isoDate(row.endDate),
        row.durationDays,
        depNames,
        row.notes || ''
      ].map(esc).join(','));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  function slug(name) {
    var s = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'project';
  }

  function download(text, filename) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function exportProjectCsv(project, sched) {
    download(projectToCsv(project, sched), slug(project.name) + '-gantt.csv');
  }

  global.MPP = global.MPP || {};
  global.MPP.csv = {
    COLUMNS: COLUMNS,
    projectToCsv: projectToCsv,
    exportProjectCsv: exportProjectCsv,
    download: download
  };
})(typeof window !== 'undefined' ? window : globalThis);
