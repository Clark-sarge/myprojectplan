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

    // Project length is the latest end across all tasks.
    var totalDays = 0;
    tasks.forEach(function (t) {
      var end = computed[t.id].end;
      if (end > totalDays) totalDays = end;
    });

    // Backward pass: latest finish/start per leaf task; slack = LS - ES.
    var successors = {};
    tasks.forEach(function (t) {
      (expandedDeps[t.id] || []).forEach(function (depId) {
        (successors[depId] = successors[depId] || []).push(t.id);
      });
    });

    var lfMemo = {};
    function latestFinish(taskId) {
      if (lfMemo[taskId] != null) return lfMemo[taskId];
      var succs = successors[taskId] || [];
      var lf = totalDays;
      if (succs.length > 0) {
        lf = Infinity;
        succs.forEach(function (s) {
          var ls = latestFinish(s) - (computed[s].end - computed[s].start);
          if (ls < lf) lf = ls;
        });
      }
      lfMemo[taskId] = lf;
      return lf;
    }

    // Summaries are critical when any subtask is; their slack is the minimum.
    var cpInfo = {};
    tasks.forEach(function (t) {
      if ((childrenBy[t.id] || []).length > 0) return;
      var r = computed[t.id];
      var slack = latestFinish(t.id) - (r.end - r.start) - r.start;
      cpInfo[t.id] = { critical: slack === 0, slack: slack };
    });
    tasks.forEach(function (t) {
      var kids = childrenBy[t.id] || [];
      if (kids.length === 0) return;
      var crit = false;
      var minSlack = Infinity;
      kids.forEach(function (k) {
        if (cpInfo[k.id].critical) crit = true;
        if (cpInfo[k.id].slack < minSlack) minSlack = cpInfo[k.id].slack;
      });
      cpInfo[t.id] = { critical: crit, slack: minSlack };
    });

    var rows = [];
    var topIndex = 0;

    (childrenBy['_root'] || []).forEach(function (t) {
      topIndex += 1;
      var kids = childrenBy[t.id] || [];
      rows.push(makeRow(t, String(topIndex), 0, kids.length ? 'summary' : 'task', computed[t.id], map, projectStart, cpInfo[t.id]));
      kids.forEach(function (k, i) {
        rows.push(makeRow(k, topIndex + '.' + (i + 1), 1, 'subtask', computed[k.id], map, projectStart, cpInfo[k.id]));
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

  function makeRow(task, wbs, level, type, r, map, projectStart, cp) {
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
      notes: task.notes || '',
      slackDays: cp.slack,
      critical: cp.critical
    };
  }

  global.MPP = global.MPP || {};
  global.MPP.scheduler = {
    scheduleProject: scheduleProject,
    addDays: addDays
  };
})(typeof window !== 'undefined' ? window : globalThis);
