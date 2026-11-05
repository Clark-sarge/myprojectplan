(function (global) {
  'use strict';

  var STORAGE_KEY = 'myprojectplan.project.v1';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function generateId(prefix) {
    return (prefix || 't') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function createProject(name, startDate) {
    return {
      id: generateId('p'),
      name: name || '',
      startDate: startDate || todayIso(),
      tasks: []
    };
  }

  function createTask(name, opts) {
    opts = opts || {};
    return {
      id: opts.id || generateId('t'),
      name: name || '',
      parentId: opts.parentId || null,
      durationDays: opts.durationDays != null ? opts.durationDays : 1,
      startDay: opts.startDay != null ? opts.startDay : null,
      dependsOn: opts.dependsOn ? opts.dependsOn.slice() : [],
      notes: opts.notes || ''
    };
  }

  function taskMap(tasks) {
    var m = {};
    for (var i = 0; i < tasks.length; i++) m[tasks[i].id] = tasks[i];
    return m;
  }

  function childrenOf(tasks, parentId) {
    return tasks.filter(function (t) { return t.parentId === parentId; });
  }

  function isSummary(task, tasks) {
    return childrenOf(tasks, task.id).length > 0;
  }

  function validateProject(project) {
    var errors = [];
    if (!project || typeof project !== 'object') return ['Project is missing.'];

    if (!project.name || !String(project.name).trim()) errors.push('Project name is required.');

    if (!project.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(project.startDate)) ||
        isNaN(new Date(project.startDate + 'T00:00:00').getTime())) {
      errors.push('Project start date is required (YYYY-MM-DD).');
    }

    if (!Array.isArray(project.tasks) || project.tasks.length === 0) {
      errors.push('Add at least one task.');
      return errors;
    }

    var map = taskMap(project.tasks);

    project.tasks.forEach(function (task, i) {
      var label = task.name && String(task.name).trim() ? '"' + String(task.name).trim() + '"' : 'task #' + (i + 1);

      if (!task.name || !String(task.name).trim()) {
        errors.push('Task #' + (i + 1) + ': name is required.');
      }

      var dur = Number(task.durationDays);
      if (!isFinite(dur) || Math.floor(dur) !== dur || dur < 1) {
        errors.push(label + ': duration must be a whole number of days (1 or more).');
      }

      if (task.startDay != null && task.startDay !== '') {
        var sd = Number(task.startDay);
        if (!isFinite(sd) || Math.floor(sd) !== sd || sd < 0) {
          errors.push(label + ': earliest start day must be a whole number (0 or more).');
        }
      }

      if (task.parentId != null) {
        var parent = map[task.parentId];
        if (!parent) errors.push(label + ': parent task not found.');
        else if (parent.id === task.id) errors.push(label + ': a task cannot be its own parent.');
        else if (parent.parentId != null) errors.push(label + ': subtasks can only be nested one level deep.');
      }

      var hasChildren = childrenOf(project.tasks, task.id).length > 0;
      if (hasChildren && task.dependsOn && task.dependsOn.length > 0) {
        errors.push(label + ' has subtasks, so it cannot have its own dependencies. Set them on its subtasks instead.');
      }

      (task.dependsOn || []).forEach(function (depId) {
        var dep = map[depId];
        if (!dep) { errors.push(label + ': depends on a task that no longer exists.'); return; }
        if (dep.id === task.id) errors.push(label + ': a task cannot depend on itself.');
        else if (dep.id === task.parentId) errors.push(label + ': cannot depend on its parent task.');
        else if (dep.parentId === task.id) errors.push(label + ': cannot depend on its own subtask.');
      });
    });

    return errors;
  }

  function saveProject(project) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      return true;
    } catch { return false; }
  }

  function loadProject() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function clearProject() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch { /* localStorage unavailable */ }
  }

  function sampleProject() {
    var p = createProject('Website Launch', todayIso());

    var planning = createTask('Planning', { durationDays: 5 });
    var requirements = createTask('Requirements', { parentId: planning.id, durationDays: 3 });
    var budget = createTask('Budget approval', { parentId: planning.id, durationDays: 2, dependsOn: [requirements.id] });
    p.tasks.push(planning, requirements, budget);

    var design = createTask('Design', { durationDays: 9 });
    var wireframes = createTask('Wireframes', { parentId: design.id, durationDays: 4, dependsOn: [requirements.id] });
    var visual = createTask('Visual design', { parentId: design.id, durationDays: 5, dependsOn: [wireframes.id] });
    p.tasks.push(design, wireframes, visual);

    var development = createTask('Development', { durationDays: 11 });
    var frontend = createTask('Frontend build', { parentId: development.id, durationDays: 8, dependsOn: [visual.id] });
    var backend = createTask('Backend build', { parentId: development.id, durationDays: 6, dependsOn: [wireframes.id] });
    var integration = createTask('Integration', { parentId: development.id, durationDays: 3, dependsOn: [frontend.id, backend.id] });
    p.tasks.push(development, frontend, backend, integration);

    var launch = createTask('Launch', { durationDays: 5 });
    var testing = createTask('Testing', { parentId: launch.id, durationDays: 4, dependsOn: [integration.id] });
    var deploy = createTask('Deploy', { parentId: launch.id, durationDays: 1, dependsOn: [testing.id] });
    p.tasks.push(launch, testing, deploy);

    return p;
  }

  global.MPP = global.MPP || {};
  global.MPP.model = {
    STORAGE_KEY: STORAGE_KEY,
    generateId: generateId,
    todayIso: todayIso,
    createProject: createProject,
    createTask: createTask,
    taskMap: taskMap,
    childrenOf: childrenOf,
    isSummary: isSummary,
    validateProject: validateProject,
    saveProject: saveProject,
    loadProject: loadProject,
    clearProject: clearProject,
    sampleProject: sampleProject
  };
})(typeof window !== 'undefined' ? window : globalThis);
