(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  var COLORS = {
    gridDay: '#e2e8f0',
    gridWeek: '#cbd5e1',
    gridMonth: '#94a3b8',
    weekend: '#eef2f7',
    stripe: '#f8fafc',
    headerBg: '#f1f5f9',
    label: '#1e293b',
    sublabel: '#475569',
    dateText: '#64748b',
    dep: '#64748b',
    today: '#ef4444',
    task: '#2563eb',
    taskStroke: '#1d4ed8',
    subtask: '#60a5fa',
    subtaskStroke: '#3b82f6',
    summary: '#1e293b',
    critical: '#dc2626',
    criticalStroke: '#b91c1c'
  };

  function el(name, attrs, parent) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(x, y, content, attrs, parent) {
    var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = content;
    return t;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(d) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtShort(d) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmtMonth(d) {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }

  function dayDiff(a, b) {
    var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / 86400000);
  }

  function addDays(date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function renderChart(container, project, sched) {
    var rows = sched.rows;
    var totalDays = Math.max(sched.totalDays, 1);
    var pxPerDay = totalDays <= 35 ? 26 : totalDays <= 90 ? 13 : totalDays <= 240 ? 6.5 : totalDays <= 480 ? 3.5 : 2.5;
    var unit = pxPerDay >= 13 ? 'day' : pxPerDay >= 6.5 ? 'week' : 'month';

    var LABEL_W = 250, ROW_H = 36, HEADER_H = 46, PAD_R = 60, PAD_B = 14;
    var chartW = LABEL_W + Math.ceil(totalDays * pxPerDay) + PAD_R;
    var chartH = HEADER_H + rows.length * ROW_H + PAD_B;
    function dayX(day) { return LABEL_W + day * pxPerDay; }
    function rowCy(i) { return HEADER_H + i * ROW_H + ROW_H / 2; }

    var taskById = {};
    project.tasks.forEach(function (t) { taskById[t.id] = t; });

    var svg = el('svg', {
      width: chartW,
      height: chartH,
      viewBox: '0 0 ' + chartW + ' ' + chartH,
      'class': 'gantt-svg',
      role: 'img'
    });

    var defs = el('defs', {}, svg);
    var marker = el('marker', {
      id: 'dep-arrow',
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: 'auto-start-reverse'
    }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: COLORS.dep }, marker);
    var critMarker = el('marker', {
      id: 'dep-arrow-critical',
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: 'auto-start-reverse'
    }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', fill: COLORS.critical }, critMarker);

    // backgrounds
    el('rect', { x: 0, y: 0, width: chartW, height: chartH, fill: '#ffffff' }, svg);
    rows.forEach(function (row, i) {
      if (i % 2 === 1) {
        el('rect', { x: 0, y: HEADER_H + i * ROW_H, width: chartW, height: ROW_H, fill: COLORS.stripe }, svg);
      }
    });
    el('rect', { x: 0, y: 0, width: chartW, height: HEADER_H, fill: COLORS.headerBg }, svg);
    el('line', { x1: 0, y1: HEADER_H, x2: chartW, y2: HEADER_H, stroke: COLORS.gridMonth, 'stroke-width': 1 }, svg);

    // weekend shading (daily scale)
    if (unit === 'day') {
      for (var wd = 0; wd < totalDays; wd++) {
        var wdate = addDays(sched.projectStart, wd);
        if (wdate.getDay() === 0 || wdate.getDay() === 6) {
          el('rect', {
            x: dayX(wd), y: HEADER_H,
            width: pxPerDay, height: chartH - HEADER_H,
            fill: COLORS.weekend
          }, svg);
        }
      }
    }

    // vertical gridlines
    if (unit === 'day') {
      for (var gd = 0; gd <= totalDays; gd++) {
        el('line', { x1: dayX(gd), y1: HEADER_H, x2: dayX(gd), y2: chartH, stroke: COLORS.gridDay, 'stroke-width': 1 }, svg);
      }
    } else if (unit === 'week') {
      for (var gwk = 0; gwk <= totalDays; gwk++) {
        if (addDays(sched.projectStart, gwk).getDay() === 1) {
          el('line', { x1: dayX(gwk), y1: HEADER_H, x2: dayX(gwk), y2: chartH, stroke: COLORS.gridWeek, 'stroke-width': 1 }, svg);
        }
      }
    }

    // month lines + labels (top header row)
    var month = new Date(sched.projectStart.getFullYear(), sched.projectStart.getMonth(), 1);
    var timelineEnd = addDays(sched.projectStart, totalDays);
    while (month <= timelineEnd) {
      var mx = dayX(dayDiff(sched.projectStart, month));
      if (mx >= LABEL_W) {
        el('line', { x1: mx, y1: 0, x2: mx, y2: chartH, stroke: COLORS.gridMonth, 'stroke-width': 1 }, svg);
      }
      var labelX = mx < LABEL_W ? LABEL_W : mx;
      text(labelX + 6, 16, fmtMonth(month), { 'font-size': 12, 'font-weight': 600, fill: COLORS.sublabel }, svg);
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    }

    // second header row
    if (unit === 'day') {
      for (var dd = 0; dd < totalDays; dd++) {
        var ddate = addDays(sched.projectStart, dd);
        text(dayX(dd) + pxPerDay / 2, 38, String(ddate.getDate()),
          { 'font-size': 10, 'text-anchor': 'middle', fill: COLORS.sublabel }, svg);
      }
    } else if (unit === 'week') {
      for (var wk = 0; wk <= totalDays; wk++) {
        var wdate2 = addDays(sched.projectStart, wk);
        if (wdate2.getDay() === 1) {
          text(dayX(wk) + 3, 38, (wdate2.getMonth() + 1) + '/' + wdate2.getDate(),
            { 'font-size': 10, fill: COLORS.sublabel }, svg);
        }
      }
    }

    // divider between labels and timeline
    el('line', { x1: LABEL_W, y1: 0, x2: LABEL_W, y2: chartH, stroke: COLORS.gridMonth, 'stroke-width': 1 }, svg);

    // today marker
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var todayDay = dayDiff(sched.projectStart, today);
    var todayX = null;
    if (todayDay >= 0 && todayDay <= totalDays) {
      todayX = dayX(todayDay);
      el('line', {
        x1: todayX, y1: HEADER_H, x2: todayX, y2: chartH,
        stroke: COLORS.today, 'stroke-width': 1.5, 'stroke-dasharray': '5 4'
      }, svg);
    }

    // rows: labels + bars
    var rowsById = {};
    rows.forEach(function (r) { rowsById[r.id] = r; });

    rows.forEach(function (row, i) {
      var cy = rowCy(i);
      var x = dayX(row.startDay);
      var w = Math.max(row.durationDays * pxPerDay, 3);

      text(12 + row.level * 22, cy + 4, row.wbs + '  ' + row.name, {
        'font-size': 13,
        'font-weight': row.type === 'summary' ? 700 : 400,
        fill: COLORS.label
      }, svg);

      var g = el('g', {}, svg);
      var title = el('title', {}, g);
      var depNames = (row.dependsOn || []).map(function (id) {
        return taskById[id] ? taskById[id].name : '';
      }).filter(Boolean).join(', ');
      title.textContent = row.name + ' (' + row.wbs + ')\n' +
        'Start: ' + fmtDate(row.startDate) + '\n' +
        'Finish: ' + fmtDate(row.endDate) + '\n' +
        'Duration: ' + row.durationDays + ' day' + (row.durationDays === 1 ? '' : 's') +
        (depNames ? '\nDepends on: ' + depNames : '') +
        (row.type === 'summary' ? '\nSummary — spans its subtasks' : '') +
        (row.critical ? '\nCritical path — no slack'
          : '\nSlack: ' + row.slackDays + ' day' + (row.slackDays === 1 ? '' : 's'));

      if (row.type === 'summary') {
        var sy = cy - 5;
        var summaryFill = row.critical ? COLORS.critical : COLORS.summary;
        el('rect', { x: x, y: sy, width: w, height: 10, fill: summaryFill }, g);
        el('polygon', {
          points: x + ',' + (sy - 3) + ' ' + (x + 9) + ',' + (sy + 5) + ' ' + x + ',' + (sy + 13),
          fill: summaryFill
        }, g);
        el('polygon', {
          points: (x + w) + ',' + (sy - 3) + ' ' + (x + w - 9) + ',' + (sy + 5) + ' ' + (x + w) + ',' + (sy + 13),
          fill: summaryFill
        }, g);
      } else {
        var fill = row.critical ? COLORS.critical
          : row.type === 'subtask' ? COLORS.subtask : COLORS.task;
        var stroke = row.critical ? COLORS.criticalStroke
          : row.type === 'subtask' ? COLORS.subtaskStroke : COLORS.taskStroke;
        el('rect', {
          x: x, y: cy - 9, width: w, height: 18, rx: 4,
          fill: fill, stroke: stroke, 'stroke-width': 1
        }, g);
      }

      // date range next to the bar, when there is room
      if (unit !== 'month' && x + w + 92 < chartW - 6) {
        text(x + w + 6, cy + 4, fmtShort(row.startDate) + ' \u2013 ' + fmtShort(row.endDate),
          { 'font-size': 10, fill: COLORS.dateText }, svg);
      }
    });

    // dependency arrows
    rows.forEach(function (row, i) {
      (sched.expandedDeps[row.id] || []).forEach(function (depId) {
        var dep = rowsById[depId];
        if (!dep) return;
        var di = rows.indexOf(dep);
        var x1 = dayX(dep.endDay);
        var y1 = rowCy(di);
        var x2 = dayX(row.startDay);
        var y2 = rowCy(i);
        var midX = (x2 - 10 >= x1 + 10) ? x2 - 10 : x1 + 10;
        var arrowCritical = row.critical && dep.critical;
        el('path', {
          d: 'M ' + x1 + ' ' + y1 + ' H ' + midX + ' V ' + y2 + ' H ' + (x2 - 1),
          fill: 'none',
          stroke: arrowCritical ? COLORS.critical : COLORS.dep,
          'stroke-width': 1.5,
          'marker-end': arrowCritical ? 'url(#dep-arrow-critical)' : 'url(#dep-arrow)'
        }, svg);
      });
    });

    // today label on top of everything
    if (todayX != null && todayX > LABEL_W) {
      text(todayX + 4, 38, 'Today', { 'font-size': 10, 'font-weight': 700, fill: COLORS.today }, svg);
    }

    container.appendChild(svg);
  }

  function renderHeader(project, sched) {
    var head = document.getElementById('chart-header');
    var taskCount = sched.rows.filter(function (r) { return r.type !== 'summary'; }).length;
    head.innerHTML = '<h1>' + escapeHtml(project.name) + '</h1>' +
      '<p class="chart-meta"><strong>Start:</strong> ' + fmtDate(sched.projectStart) +
      ' &nbsp;&middot;&nbsp; <strong>Finish:</strong> ' + fmtDate(sched.finishDate) +
      ' &nbsp;&middot;&nbsp; <strong>Duration:</strong> ' + sched.totalDays + ' days' +
      ' &nbsp;&middot;&nbsp; <strong>Tasks:</strong> ' + taskCount + '</p>';
  }

  function renderLegend() {
    document.getElementById('legend').innerHTML =
      '<span class="lg"><span class="sw sw-task"></span>Task</span>' +
      '<span class="lg"><span class="sw sw-sub"></span>Subtask</span>' +
      '<span class="lg"><span class="sw sw-summary"></span>Summary</span>' +
      '<span class="lg"><span class="sw sw-critical"></span>Critical</span>' +
      '<span class="lg"><svg width="26" height="10" viewBox="0 0 26 10" aria-hidden="true">' +
      '<line x1="0" y1="5" x2="18" y2="5" stroke="#64748b" stroke-width="1.5"/>' +
      '<path d="M18,1 L26,5 L18,9 z" fill="#64748b"/></svg>Dependency</span>' +
      '<span class="lg"><span class="sw sw-today"></span>Today</span>';
  }

  function showErrors(list) {
    var panel = document.getElementById('error-panel');
    panel.innerHTML = '<h2>Cannot show the chart</h2><ul>' +
      list.map(function (e) { return '<li>' + escapeHtml(e) + '</li>'; }).join('') + '</ul>' +
      '<p><a href="index.html">&#8592; Back to the build page</a></p>';
    panel.classList.remove('hidden');
  }

  function init() {
    var project = global.MPP.model.loadProject();
    var card = document.getElementById('chart-card');

    if (!project || !Array.isArray(project.tasks) || project.tasks.length === 0) {
      card.hidden = true;
      showErrors(['No project found. Build one on the build page first.']);
      return;
    }
    var validation = global.MPP.model.validateProject(project);
    if (validation.length) {
      card.hidden = true;
      showErrors(validation);
      return;
    }
    var sched = global.MPP.scheduler.scheduleProject(project);
    if (!sched.ok) {
      card.hidden = true;
      showErrors(sched.errors);
      return;
    }

    renderHeader(project, sched);
    renderLegend();
    renderChart(document.getElementById('gantt-scroll'), project, sched);

    document.getElementById('btn-export-csv').addEventListener('click', function () {
      global.MPP.csv.exportProjectCsv(project, sched);
    });
  }

  init();
})(typeof window !== 'undefined' ? window : globalThis);
