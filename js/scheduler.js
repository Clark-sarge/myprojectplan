(function (global) {
  'use strict';

  function addDays(date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function findCycle(tasks, depsOf) {
    var color = {}, stack = [], cycle = null;
    tasks.forEach(function (t) { color[t.id] = 0; });

    function dfs(u) {
      if (cycle) return;
      color[u] = 1;
      stack.push(u);
      var deps = depsOf[u] || [];
      for (var i = 0; i < deps.length; i++) {
        var v = deps[i];
        if (color[v] === 1) {
          cycle = stack.slice(stack.indexOf(v)).concat([v]);
          return;
        }
        if (color[v] === 0) dfs(v);
        if (cycle) return;
      }
      color[u] = 2;
      stack.pop();
    }

    for (var i = 0; i < tasks.length && !cycle; i++) {
      if (color[tasks[i].id] === 0) dfs(tasks[i].id);
    }
    return cycle;
  }

  function scheduleProject(project) {
    var tasks = project.tasks;
    var map = global.MPP.model.taskMap(tasks);

    var childrenBy = {};
    tasks.forEach(function (t) {
      var key = t.parentId || '_root';
      (childrenBy[key] = childrenBy[key] || []).push(t);
    });

    // Depending on a summary row is equivalent to depending on each of its subtasks.
    var expandedDeps = {};
    tasks.forEach(function (t) {
      var out = [], seen = {};
      (t.dependsOn || []).forEach(function (depId) {
        var kids = childrenBy[depId];
        var targets = kids && kids.length ? kids.map(function (k) { return k.id; }) : [depId];
        targets.forEach(function (id) {
          if (!seen[id] && id !== t.id) { seen[id] = true; out.push(id); }
        });
      });
      expandedDeps[t.id] = out;
    });

    var cycle = findCycle(tasks, expandedDeps);
    if (cycle) {
      return {
        ok: false,
        errors: ['Circular dependency: ' + cycle.map(function (id) {
          return '"' + (map[id] ? map[id].name : id) + '"';
        }).join(' \u2192 ')]
      };
    }

    // Forward pass: earliest start/finish per task, memoized depth-first.
    var computed = {};
    function compute(taskId) {
      if (computed[taskId]) return computed[taskId];
      var t = map[taskId];
      var kids = childrenBy[taskId] || [];
      var start, end;

      if (kids.length > 0) {
        // Summary row: spans its subtasks.
        start = Infinity;
        end = -Infinity;
        kids.forEach(function (k) {
          var r = compute(k.id);
          if (r.start < start) start = r.start;
          if (r.end > end) end = r.end;
        });
      } else {
        start = (t.startDay != null && t.startDay !== '') ? Math.max(0, Number(t.startDay) || 0) : 0;
        expandedDeps[taskId].forEach(function (depId) {
          var r = compute(depId);
          if (r.end > start) start = r.end;
        });
        var dur = Number(t.durationDays);
        if (!isFinite(dur) || dur < 1) dur = 1;
        end = start + Math.floor(dur);
      }

      computed[taskId] = { start: start, end: end };
      return computed[taskId];
    }
    tasks.forEach(function (t) { compute(t.id); });

    var projectStart = new Date(project.startDate + 'T00:00:00');
    if (isNaN(projectStart.getTime())) projectStart = new Date();

    var rows = [];
    var totalDays = 0;
    var topIndex = 0;

    (childrenBy['_root'] || []).forEach(function (t) {
      topIndex += 1;
      var kids = childrenBy[t.id] || [];
      var r = computed[t.id];
      totalDays = Math.max(totalDays, r.end);
      rows.push(makeRow(t, String(topIndex), 0, kids.length ? 'summary' : 'task', r, map, projectStart));
      kids.forEach(function (k, i) {
        var kr = computed[k.id];
        totalDays = Math.max(totalDays, kr.end);
        rows.push(makeRow(k, topIndex + '.' + (i + 1), 1, 'subtask', kr, map, projectStart));
      });
    });

    return {
      ok: true,
      rows: rows,
      expandedDeps: expandedDeps,
      totalDays: totalDays,
      projectStart: projectStart,
      finishDate: addDays(projectStart, Math.max(totalDays - 1, 0))
    };
  }

  function makeRow(task, wbs, level, type, r, map, projectStart) {
    var parent = task.parentId ? map[task.parentId] : null;
    return {
      id: task.id,
      name: task.name,
      wbs: wbs,
      level: level,
      type: type,
      parentName: parent ? parent.name : '',
      startDay: r.start,
      endDay: r.end,
      durationDays: r.end - r.start,
      startDate: addDays(projectStart, r.start),
      endDate: addDays(projectStart, r.end - 1),
      dependsOn: (task.dependsOn || []).slice(),
      notes: task.notes || ''
    };
  }

  global.MPP = global.MPP || {};
  global.MPP.scheduler = {
    scheduleProject: scheduleProject,
    addDays: addDays
  };
})(typeof window !== 'undefined' ? window : globalThis);
