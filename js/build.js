(function (global) {
  'use strict';

  var M = global.MPP.model;

  var state = M.loadProject() || M.createProject('', M.todayIso());

  var els = {
    name: document.getElementById('project-name'),
    start: document.getElementById('project-start'),
    list: document.getElementById('task-list'),
    empty: document.getElementById('tasks-empty'),
    errors: document.getElementById('error-panel'),
    build: document.getElementById('btn-build'),
    addTask: document.getElementById('btn-add-task'),
    sample: document.getElementById('btn-sample'),
    clear: document.getElementById('btn-clear')
  };

  /* ---------- helpers ---------- */

  function save() { M.saveProject(state); }

  function findTask(id) { return state.tasks.find(function (t) { return t.id === id; }); }
  function topLevels() { return state.tasks.filter(function (t) { return t.parentId == null; }); }
  function childrenOf(id) { return state.tasks.filter(function (t) { return t.parentId === id; }); }
  function hasChildren(id) { return childrenOf(id).length > 0; }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function depCandidates(task) {
    return state.tasks.filter(function (t) {
      return t.id !== task.id && t.id !== task.parentId && t.parentId !== task.id;
    });
  }

  /* ---------- structural operations ----------
     The flat tasks array always keeps a parent directly followed by its children. */

  function blockRange(task) {
    var s = state.tasks.indexOf(task);
    var e = s;
    while (e + 1 < state.tasks.length && state.tasks[e + 1].parentId === task.id) e++;
    return { start: s, end: e };
  }

  function canMoveUp(task) {
    if (task.parentId == null) return topLevels().indexOf(task) > 0;
    return childrenOf(task.parentId).indexOf(task) > 0;
  }

  function canMoveDown(task) {
    var list = task.parentId == null ? topLevels() : childrenOf(task.parentId);
    var i = list.indexOf(task);
    return i !== -1 && i < list.length - 1;
  }

  function canIndent(task) {
    return task.parentId == null && !hasChildren(task.id) && topLevels().indexOf(task) > 0;
  }

  function swapBlocks(task, other) {
    var r1 = blockRange(task), r2 = blockRange(other);
    var lo = Math.min(r1.start, r2.start), hi = Math.max(r1.end, r2.end);
    var taskBlock = state.tasks.slice(r1.start, r1.end + 1);
    var otherBlock = state.tasks.slice(r2.start, r2.end + 1);
    var middle = r1.start < r2.start ? otherBlock.concat(taskBlock) : taskBlock.concat(otherBlock);
    state.tasks = state.tasks.slice(0, lo).concat(middle, state.tasks.slice(hi + 1));
  }

  function moveUp(task) {
    if (task.parentId == null) {
      var tops = topLevels();
      var i = tops.indexOf(task);
      if (i > 0) swapBlocks(task, tops[i - 1]);
    } else {
      moveSibling(task, -1);
    }
  }

  function moveDown(task) {
    if (task.parentId == null) {
      var tops = topLevels();
      var i = tops.indexOf(task);
      if (i !== -1 && i < tops.length - 1) swapBlocks(task, tops[i + 1]);
    } else {
      moveSibling(task, 1);
    }
  }

  function moveSibling(task, dir) {
    var sibs = childrenOf(task.parentId);
    var i = sibs.indexOf(task);
    var j = i + dir;
    if (i === -1 || j < 0 || j >= sibs.length) return;
    var other = sibs[j];
    var a = state.tasks.indexOf(task);
    var b = state.tasks.indexOf(other);
    state.tasks[a] = other;
    state.tasks[b] = task;
  }

  function indent(task) {
    if (!canIndent(task)) return;
    var tops = topLevels();
    var newParent = tops[tops.indexOf(task) - 1];
    // A task cannot keep dependencies on its new parent.
    task.dependsOn = (task.dependsOn || []).filter(function (d) { return d !== newParent.id; });
    // The new parent becomes a summary row, which cannot carry dependencies.
    if (!hasChildren(newParent.id)) newParent.dependsOn = [];
    var idx = state.tasks.indexOf(task);
    state.tasks.splice(idx, 1);
    state.tasks.splice(blockRange(newParent).end + 1, 0, task);
    task.parentId = newParent.id;
  }

  function outdent(task) {
    if (task.parentId == null) return;
    var formerParent = findTask(task.parentId);
    var idx = state.tasks.indexOf(task);
    state.tasks.splice(idx, 1);
    task.parentId = null;
    if (formerParent) {
      state.tasks.splice(blockRange(formerParent).end + 1, 0, task);
    } else {
      state.tasks.splice(idx, 0, task);
    }
  }

  function addSubtask(parent) {
    if (parent.parentId != null) return; // only one nesting level
    if (!hasChildren(parent.id)) parent.dependsOn = []; // summary rows carry no dependencies
    var child = M.createTask('', { parentId: parent.id, durationDays: 1 });
    state.tasks.splice(blockRange(parent).end + 1, 0, child);
  }

  function deleteTask(task) {
    var kids = childrenOf(task.id);
    if (kids.length > 0) {
      if (!global.confirm('Delete "' + (task.name || 'this task') + '" and its ' + kids.length + ' subtask(s)?')) return;
    }
    var removed = {};
    removed[task.id] = true;
    kids.forEach(function (k) { removed[k.id] = true; });
    state.tasks = state.tasks.filter(function (t) { return !removed[t.id]; });
    state.tasks.forEach(function (t) {
      t.dependsOn = (t.dependsOn || []).filter(function (d) { return !removed[d]; });
    });
  }

  /* ---------- rendering ---------- */

  function render() {
    els.name.value = state.name || '';
    els.start.value = state.startDate || '';
    renderTasks();
  }

  function renderTasks() {
    els.list.innerHTML = '';
    els.empty.style.display = state.tasks.length ? 'none' : '';
    topLevels().forEach(function (t, i) {
      els.list.appendChild(renderRow(t, String(i + 1), 0));
      childrenOf(t.id).forEach(function (c, j) {
        els.list.appendChild(renderRow(c, (i + 1) + '.' + (j + 1), 1));
      });
    });
  }

  function renderRow(task, wbs, level) {
    var row = document.createElement('div');
    row.className = 'task-row' + (level ? ' sub' : '');
    row.dataset.taskId = task.id;

    var isSummary = hasChildren(task.id);
    var deps = task.dependsOn || [];

    var chipsHtml = deps.map(function (did) {
      var d = findTask(did);
      return '<span class="chip">' + escapeHtml(d ? d.name : '(missing)') +
        '<button type="button" data-action="remove-dep" data-dep-id="' + did + '" title="Remove dependency">&times;</button></span>';
    }).join('');

    var depSelect = '';
    if (!isSummary) {
      var options = depCandidates(task)
        .filter(function (t) { return deps.indexOf(t.id) === -1 && String(t.name || '').trim() !== ''; })
        .map(function (t) { return '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>'; })
        .join('');
      depSelect = '<select data-field="dep" class="dep-select"' + (options ? '' : ' disabled') + '>' +
        '<option value="">+ add dependency&hellip;</option>' + options + '</select>';
    }

    var durCell = isSummary
      ? '<span class="auto-badge" title="Calculated from subtasks">auto</span>'
      : '<input type="number" min="1" step="1" data-field="durationDays" value="' + escapeHtml(task.durationDays) + '" aria-label="Duration in days">';

    var startCell = isSummary
      ? ''
      : '<input type="number" min="0" step="1" data-field="startDay" value="' +
        (task.startDay == null ? '' : escapeHtml(task.startDay)) +
        '" placeholder="auto" title="Cannot start before this day (day 0 = project start date)" aria-label="Earliest start day">';

    var depsCell = isSummary ? '<span class="hint">set on subtasks</span>' : chipsHtml + depSelect;

    row.innerHTML =
      '<div class="row-num">' + wbs + '</div>' +
      '<div class="row-controls">' +
        '<button type="button" data-action="up" title="Move up"' + (canMoveUp(task) ? '' : ' disabled') + '>&#9650;</button>' +
        '<button type="button" data-action="down" title="Move down"' + (canMoveDown(task) ? '' : ' disabled') + '>&#9660;</button>' +
      '</div>' +
      '<input class="t-name" type="text" data-field="name" value="' + escapeHtml(task.name) + '" placeholder="Task name">' +
      '<div class="cell dur">' + durCell + '</div>' +
      '<div class="cell start">' + startCell + '</div>' +
      '<div class="cell deps">' + depsCell + '</div>' +
      '<div class="row-actions">' +
        (level === 0
          ? '<button type="button" data-action="indent" title="Make subtask of the task above"' + (canIndent(task) ? '' : ' disabled') + '>&#8594;</button>'
          : '<button type="button" data-action="outdent" title="Move to top level">&#8592;</button>') +
        (level === 0 ? '<button type="button" data-action="add-sub" title="Add subtask">+ sub</button>' : '') +
        '<button type="button" data-action="delete" class="danger" title="Delete task">&times;</button>' +
      '</div>';
    return row;
  }

  /* ---------- events ---------- */

  els.name.addEventListener('input', function () { state.name = els.name.value; save(); });
  els.start.addEventListener('change', function () { state.startDate = els.start.value; save(); });

  els.list.addEventListener('input', function (e) {
    var rowEl = e.target.closest('.task-row');
    if (!rowEl) return;
    var task = findTask(rowEl.dataset.taskId);
    if (!task) return;
    var field = e.target.dataset.field;
    if (field === 'name') { task.name = e.target.value; save(); }
    else if (field === 'durationDays') { task.durationDays = e.target.value === '' ? '' : Number(e.target.value); save(); }
    else if (field === 'startDay') { task.startDay = e.target.value === '' ? null : Number(e.target.value); save(); }
  });

  els.list.addEventListener('change', function (e) {
    var rowEl = e.target.closest('.task-row');
    if (!rowEl) return;
    var task = findTask(rowEl.dataset.taskId);
    if (!task) return;
    var field = e.target.dataset.field;
    if (field === 'dep') {
      var depId = e.target.value;
      if (depId && (task.dependsOn || []).indexOf(depId) === -1) {
        task.dependsOn = (task.dependsOn || []).concat([depId]);
        save();
      }
      renderTasks();
    } else if (field === 'name' || field === 'durationDays' || field === 'startDay') {
      renderTasks();
    }
  });

  els.list.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    var rowEl = e.target.closest('.task-row');
    var task = rowEl && findTask(rowEl.dataset.taskId);
    if (!task) return;
    switch (btn.dataset.action) {
      case 'up': moveUp(task); break;
      case 'down': moveDown(task); break;
      case 'indent': indent(task); break;
      case 'outdent': outdent(task); break;
      case 'add-sub': addSubtask(task); break;
      case 'delete': deleteTask(task); break;
      case 'remove-dep':
        var depId = btn.dataset.depId;
        task.dependsOn = (task.dependsOn || []).filter(function (d) { return d !== depId; });
        break;
    }
    save();
    renderTasks();
  });

  els.addTask.addEventListener('click', function () {
    state.tasks.push(M.createTask('', { durationDays: 1 }));
    save();
    renderTasks();
    focusLastRowName();
  });

  function focusLastRowName() {
    var rows = els.list.querySelectorAll('.task-row');
    if (rows.length) {
      var input = rows[rows.length - 1].querySelector('.t-name');
      if (input) input.focus();
    }
  }

  els.sample.addEventListener('click', function () {
    if (state.tasks.length && !global.confirm('Replace your current tasks with the sample project?')) return;
    var s = M.sampleProject();
    state.name = s.name;
    state.startDate = s.startDate;
    state.tasks = s.tasks;
    save();
    render();
  });

  els.clear.addEventListener('click', function () {
    if (!global.confirm('Clear the whole project? This cannot be undone.')) return;
    state.name = '';
    state.startDate = M.todayIso();
    state.tasks = [];
    save();
    render();
  });

  /* ---------- validation + build ---------- */

  function showErrors(list) {
    els.errors.innerHTML = '<h2>Please fix the following:</h2><ul>' +
      list.map(function (e) { return '<li>' + escapeHtml(e) + '</li>'; }).join('') + '</ul>';
    els.errors.classList.remove('hidden');
    els.errors.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideErrors() { els.errors.classList.add('hidden'); }

  function validateAndSchedule() {
    state.name = els.name.value.trim();
    state.startDate = els.start.value;
    save();
    var errors = M.validateProject(state);
    if (errors.length) { showErrors(errors); return null; }
    var sched = global.MPP.scheduler.scheduleProject(state);
    if (!sched.ok) { showErrors(sched.errors); return null; }
    hideErrors();
    return sched;
  }

  els.build.addEventListener('click', function () {
    if (validateAndSchedule()) global.location.href = 'chart.html';
  });

  render();
})(typeof window !== 'undefined' ? window : globalThis);
