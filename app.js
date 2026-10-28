(() => {
  'use strict';
  const STORAGE_KEY = 'focusdeck-v1';
  const TIMER_STORAGE_KEY = 'focusdeck-timer-v1';
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const todayKey = (date = new Date()) => {
    const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };
  const makeId = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const dateLabel = (date = new Date(), options = { weekday: 'short', month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat(undefined, options).format(date);
  const safeNumber = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const defaultGoals = () => [
    { id: makeId(), text: 'Finish my most important task', done: false },
    { id: makeId(), text: 'Spend time learning something', done: false },
    { id: makeId(), text: 'Take a proper break', done: false }
  ];
  const freshState = () => ({
    version: 1, tasks: [], goalsByDate: { [todayKey()]: defaultGoals() },
    notes: '', theme: 'dark', activity: {}, sessions: [], taskFilter: 'all'
  });
  let state = loadState();
  let timer = loadTimer();
  let activeView = 'dashboard';
  let currentTaskFilter = 'all';
  let toastTimer = null;
  const CIRCUMFERENCE = 2 * Math.PI * 98;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) return freshState();
      return {
        ...freshState(), ...parsed,
        tasks: parsed.tasks.map(t => ({ id: String(t.id || makeId()), title: String(t.title || 'Untitled task').slice(0,180), description: String(t.description || '').slice(0,1000), priority: ['high','medium','low'].includes(t.priority) ? t.priority : 'medium', category: String(t.category || 'Personal').slice(0,50), dueDate: typeof t.dueDate === 'string' ? t.dueDate : '', repeat: ['daily','weekdays','weekly','monthly'].includes(t.repeat) ? t.repeat : 'none', recurrenceId: String(t.recurrenceId || t.id || makeId()), createdAt: safeNumber(t.createdAt, Date.now()), completed: Boolean(t.completed), completedAt: safeNumber(t.completedAt, 0) })),
        goalsByDate: parsed.goalsByDate && typeof parsed.goalsByDate === 'object' ? parsed.goalsByDate : { [todayKey()]: defaultGoals() },
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        theme: parsed.theme === 'light' ? 'light' : 'dark',
        activity: parsed.activity && typeof parsed.activity === 'object' ? parsed.activity : {},
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions.filter(s => s && typeof s.date === 'string').map(s => ({ date: s.date, minutes: Math.max(0, safeNumber(s.minutes)), mode: safeNumber(s.mode, 25), completedAt: safeNumber(s.completedAt, Date.now()) })) : []
      };
    } catch (error) {
      console.warn('FocusDeck could not read saved data:', error);
      return freshState();
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      showToast('Could not save. Your browser storage may be full.', 'error');
      return false;
    }
  }
  function loadTimer() {
    const fallback = { duration: 1500, remaining: 1500, running: false, endAt: null, interval: null, mode: 25, completed: false };
    try {
      const saved = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) || 'null');
      if (!saved || !Number.isFinite(Number(saved.mode))) return fallback;
      const mode = Math.min(180, Math.max(1, Math.round(Number(saved.mode))));
      const duration = mode * 60;
      const running = Boolean(saved.running) && Number.isFinite(Number(saved.endAt));
      const remaining = running ? Math.max(0, Math.min(duration, Math.ceil((Number(saved.endAt) - Date.now()) / 1000))) : Math.max(0, Math.min(duration, safeNumber(saved.remaining, duration)));
      return { duration, remaining, running, endAt: running ? Number(saved.endAt) : null, interval: null, mode, completed: Boolean(saved.completed) };
    } catch (_) { return fallback; }
  }
  function persistTimer() {
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
        mode: timer.mode, duration: timer.duration, remaining: timer.remaining,
        running: timer.running, endAt: timer.endAt, completed: timer.completed
      }));
    } catch (_) { /* Timer persistence is optional if browser storage is unavailable. */ }
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function showToast(message, type = 'success') {
    const region = $('toast-region');
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3300);
  }
  function getGoals() {
    const key = todayKey();
    if (!Array.isArray(state.goalsByDate[key])) state.goalsByDate[key] = defaultGoals();
    return state.goalsByDate[key];
  }
  function getTodayTasks() { return state.tasks.filter(t => !t.dueDate || t.dueDate <= todayKey()); }
  function getTodaySessions() { return state.sessions.filter(s => s.date === todayKey()); }
  function getTodayFocusMinutes() { return getTodaySessions().reduce((sum, s) => sum + s.minutes, 0); }
  function setTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = state.theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = state.theme === 'dark' ? '#0b0f14' : '#f4f7fa';
    saveState();
  }
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = state.theme === 'dark' ? '#0b0f14' : '#f4f7fa';
  }
  function setView(view) {
    if (view === 'settings') view = 'settings';
    if (!$('view-' + view)) view = 'dashboard';
    activeView = view;
    $$('.view').forEach(el => el.classList.toggle('active', el.dataset.viewPanel === view));
    $$('.nav-item[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    const labels = { dashboard: 'Overview', tasks: 'My tasks', focus: 'Focus timer', notes: 'Quick notes', insights: 'Insights', settings: 'Settings & backup' };
    $('breadcrumb-current').textContent = labels[view] || 'Overview';
    $('sidebar').classList.remove('open');
    if (view === 'tasks') renderFullTasks();
    if (view === 'insights') renderInsights();
    if (view === 'focus') renderTimer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function taskMarkup(task, compact = false) {
    const overdue = task.dueDate && task.dueDate < todayKey() && !task.completed;
    const due = task.dueDate ? dateLabel(new Date(task.dueDate + 'T12:00:00'), { month: 'short', day: 'numeric' }) : '';
    const meta = '<span><i class="priority-dot priority-' + task.priority + '"></i>' + task.priority[0].toUpperCase() + task.priority.slice(1) + '</span>' +
      '<span>·</span><span>' + escapeHTML(task.category) + '</span>' +
      (due ? '<span>·</span><span class="' + (overdue ? 'due-overdue' : '') + '">' + (overdue ? 'Overdue · ' : 'Due ') + escapeHTML(due) + '</span>' : '') + (task.repeat && task.repeat !== 'none' ? '<span class="task-repeat">↻ ' + ({daily:'Daily',weekdays:'Weekdays',weekly:'Weekly',monthly:'Monthly'}[task.repeat] || 'Repeats') + '</span>' : '');
    return '<div class="task-row ' + (task.completed ? 'completed' : '') + '" data-task-row="' + escapeHTML(task.id) + '">' +
      '<input class="task-check" type="checkbox" data-action="toggle-task" data-id="' + escapeHTML(task.id) + '" ' + (task.completed ? 'checked' : '') + ' aria-label="' + (task.completed ? 'Mark incomplete' : 'Complete') + ' ' + escapeHTML(task.title) + '">' +
      '<div class="task-main"><span class="task-title">' + escapeHTML(task.title) + '</span>' + (task.description ? '<span class="task-description">' + escapeHTML(task.description) + '</span>' : '') + '<div class="task-meta">' + meta + '</div></div>' +
      '<div class="task-actions"><button class="mini-action" data-action="edit-task" data-id="' + escapeHTML(task.id) + '" aria-label="Edit task" title="Edit">✎</button><button class="mini-action" data-action="delete-task" data-id="' + escapeHTML(task.id) + '" aria-label="Delete task" title="Delete">×</button></div></div>';
  }
  function emptyMarkup(title, copy, icon = '✳', compact = false) {
    return '<div class="empty-state ' + (compact ? 'compact' : '') + '"><div class="empty-icon">' + icon + '</div><strong>' + escapeHTML(title) + '</strong><p>' + escapeHTML(copy) + '</p></div>';
  }
  function renderDashboard() {
    const now = new Date();
    $('top-date').textContent = dateLabel(now, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const hour = now.getHours();
    $('greeting-title').innerHTML = (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening') + '<span class="title-period">.</span>';
    $('greeting-subtitle').textContent = 'A little progress adds up. Let’s make it a good one.';
    const todayTasks = getTodayTasks();
    const done = todayTasks.filter(t => t.completed).length;
    $('stat-completed').textContent = done;
    $('stat-total').textContent = todayTasks.length;
    const pct = todayTasks.length ? Math.round(done / todayTasks.length * 100) : 0;
    $('daily-progress-fill').style.width = pct + '%';
    $('daily-progress-label').textContent = todayTasks.length ? pct + "% of today's tasks complete" : 'Add a task to get started';
    $('stat-focus').textContent = getTodayFocusMinutes();
    $('focus-stat-caption').textContent = getTodayFocusMinutes() ? 'Time well spent today' : 'Every focused minute counts';
    const goals = getGoals(), goalsDone = goals.filter(g => g.done).length;
    $('stat-goals').textContent = goalsDone;
    $('stat-goals-total').textContent = goals.length;
    $('goal-stat-caption').textContent = goals.length ? (goalsDone === goals.length ? 'You did what you set out to do' : (goals.length - goalsDone) + ' goals left for today') : 'Choose what matters today';
    $('nav-task-count').textContent = state.tasks.filter(t => !t.completed).length;
    const filterTasks = currentTaskFilter === 'done' ? todayTasks.filter(t => t.completed) : currentTaskFilter === 'open' ? todayTasks.filter(t => !t.completed) : todayTasks;
    const sorted = [...filterTasks].sort((a,b) => Number(a.completed) - Number(b.completed) || ({high:0,medium:1,low:2}[a.priority] - {high:0,medium:1,low:2}[b.priority]) || b.createdAt-a.createdAt);
    $('dashboard-task-list').innerHTML = sorted.length ? sorted.slice(0, 7).map(t => taskMarkup(t, true)).join('') : emptyMarkup(currentTaskFilter === 'done' ? 'Nothing completed yet' : currentTaskFilter === 'open' ? 'All caught up' : 'A fresh start', currentTaskFilter === 'done' ? 'Complete a task and it will show up here.' : 'Add your first task and take the next step.', '☷', true);
    $('filter-all-count').textContent = todayTasks.length;
    $('filter-open-count').textContent = todayTasks.filter(t => !t.completed).length;
    $('filter-done-count').textContent = todayTasks.filter(t => t.completed).length;
    $$('.filter-chip').forEach(b => b.classList.toggle('active', b.dataset.taskFilter === currentTaskFilter));
    renderGoals();
    $('dashboard-note').value = state.notes.slice(0, 5000);
    $('note-character-count').textContent = state.notes.length + ' / 5000';
    $('full-note').value = state.notes;
    $('full-note-count').textContent = state.notes.length + ' / 20000';
    $('insight-tasks').textContent = state.tasks.filter(t => t.completed).length;
    $('insight-focus').textContent = state.sessions.reduce((sum,s) => sum + s.minutes, 0);
    $('insight-days').textContent = Object.keys(state.activity).filter(k => state.activity[k] && (state.activity[k].tasks > 0 || state.activity[k].minutes > 0)).length;
  }
  function renderGoals() {
    const goals = getGoals();
    $('goals-list').innerHTML = goals.map(g => '<div class="goal-row ' + (g.done ? 'done' : '') + '"><input class="goal-check" type="checkbox" data-action="toggle-goal" data-id="' + escapeHTML(g.id) + '" ' + (g.done ? 'checked' : '') + ' aria-label="Complete goal"><span class="goal-text">' + escapeHTML(g.text) + '</span><button class="goal-edit" data-action="edit-goal" data-id="' + escapeHTML(g.id) + '" aria-label="Edit goal">✎</button></div>').join('');
  }
  function renderFullTasks() {
    const search = $('task-search').value.trim().toLowerCase();
    const status = $('task-status-filter').value, sort = $('task-sort').value;
    const category = $('task-category-filter').value;
    const dateFilter = $('task-date-filter').value;
    const today = todayKey();
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekKey = todayKey(nextWeek);
    let tasks = state.tasks.filter(t => {
      const matchesSearch = !search || (t.title + ' ' + t.category + ' ' + (t.description || '')).toLowerCase().includes(search);
      const matchesStatus = status === 'all' || (status === 'done' ? t.completed : !t.completed);
      const matchesCategory = category === 'all' || t.category === category;
      const matchesDate = dateFilter === 'all' ||
        (dateFilter === 'today' && t.dueDate === today) ||
        (dateFilter === 'overdue' && Boolean(t.dueDate) && t.dueDate < today && !t.completed) ||
        (dateFilter === 'upcoming' && Boolean(t.dueDate) && t.dueDate > today && t.dueDate <= nextWeekKey) ||
        (dateFilter === 'undated' && !t.dueDate);
      return matchesSearch && matchesStatus && matchesCategory && matchesDate;
    });
    if (sort === 'priority') tasks.sort((a,b) => Number(a.completed)-Number(b.completed) || ({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]) || b.createdAt-a.createdAt);
    else if (sort === 'date') tasks.sort((a,b) => Number(a.completed)-Number(b.completed) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    else tasks.sort((a,b) => b.createdAt-a.createdAt);
    $('full-task-list').innerHTML = tasks.length ? tasks.map(t => taskMarkup(t)).join('') : emptyMarkup(search ? 'No matching tasks' : status === 'done' ? 'No completed tasks yet' : status === 'open' ? 'Nothing on your list' : 'Your list is clear', search ? 'Try another search term.' : 'Add a task to make a plan for your day.', '☷');
  }
  function renderInsights() {
    const totalDone = state.tasks.filter(t => t.completed).length;
    const totalMinutes = state.sessions.reduce((sum,s) => sum + s.minutes, 0);
    const activeDays = Object.keys(state.activity).filter(k => state.activity[k] && (state.activity[k].tasks > 0 || state.activity[k].minutes > 0)).length;
    $('insight-tasks').textContent = totalDone;
    $('insight-focus').textContent = totalMinutes;
    $('insight-days').textContent = activeDays;
    const chart = $('activity-chart'), days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(); date.setDate(date.getDate() - i);
      const key = todayKey(date), item = state.activity[key] || { tasks: 0, minutes: 0 };
      const val = safeNumber(item.tasks) + Math.round(safeNumber(item.minutes) / 25);
      days.push({ key, label: dateLabel(date, { weekday: 'short' }), val, tasks: safeNumber(item.tasks), minutes: safeNumber(item.minutes), today: i === 0 });
    }
    const max = Math.max(1, ...days.map(d => d.val));
    chart.innerHTML = days.map(d => '<div class="activity-day ' + (d.today ? 'today' : '') + '" title="' + d.tasks + ' tasks completed, ' + d.minutes + ' focus minutes"><span class="activity-day-value">' + (d.val || '—') + '</span><div class="activity-bar-track"><div class="activity-bar" style="height:' + Math.max(d.val ? 7 : 2, d.val / max * 100) + '%"></div></div><span class="activity-day-label">' + d.label + '</span></div>').join('');
  }
  function openTaskModal(id = '') {
    $('task-form').reset();
    $('task-id').value = '';
    $('task-modal-title').textContent = id ? 'Edit task' : 'Add a task';
    $('task-save').innerHTML = id ? 'Save changes <span>→</span>' : 'Save task <span>→</span>';
    $('task-repeat').value = 'none';
    $('task-description').value = '';
    if (id) {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
      $('task-id').value = task.id;
      $('task-title').value = task.title;
      $('task-description').value = task.description || '';
      $('task-priority').value = task.priority;
      $('task-category').value = task.category;
      $('task-due-date').value = task.dueDate;
      $('task-repeat').value = task.repeat || 'none';
    } else {
      $('task-priority').value = 'medium';
      $('task-category').value = 'Personal';
      $('task-due-date').value = todayKey();
    }
    $('task-modal-backdrop').hidden = false;
    window.setTimeout(() => $('task-title').focus(), 50);
  }
  function closeTaskModal() {
    $('task-modal-backdrop').hidden = true;
  }
  function upsertTask(event) {
    event.preventDefault();
    const title = $('task-title').value.trim();
    if (!title) { $('task-title').focus(); return; }
    const id = $('task-id').value;
    const existing = state.tasks.find(t => t.id === id);
    const task = {
      id: existing ? existing.id : makeId(), title, description: $('task-description').value.trim().slice(0,1000), priority: $('task-priority').value,
      category: $('task-category').value, dueDate: $('task-due-date').value, repeat: $('task-repeat').value,
      recurrenceId: existing ? (existing.recurrenceId || existing.id) : makeId(),
      createdAt: existing ? existing.createdAt : Date.now(),
      completed: existing ? existing.completed : false,
      completedAt: existing ? existing.completedAt : 0
    };
    if (existing) state.tasks = state.tasks.map(t => t.id === id ? task : t);
    else state.tasks.unshift(task);
    saveState(); closeTaskModal(); renderAll(); showToast(existing ? 'Task updated.' : 'Task added.');
  }
  function nextDueDate(date, repeat) {
    const base = new Date((date || todayKey()) + 'T12:00:00');
    if (repeat === 'daily') base.setDate(base.getDate() + 1);
    else if (repeat === 'weekdays') {
      do { base.setDate(base.getDate() + 1); } while (base.getDay() === 0 || base.getDay() === 6);
    } else if (repeat === 'weekly') base.setDate(base.getDate() + 7);
    else if (repeat === 'monthly') {
      const day = base.getDate();
      base.setDate(1);
      base.setMonth(base.getMonth() + 1);
      const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(day, lastDay));
    }
    return todayKey(base);
  }
  function toggleTask(id, checked) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const previousCompletedAt = task.completedAt;
    task.completed = checked;
    task.completedAt = checked ? Date.now() : 0;
    let recurrenceCreated = false;
    if (checked && task.repeat && task.repeat !== 'none') {
      const nextDate = nextDueDate(task.dueDate, task.repeat);
      const seriesId = task.recurrenceId || task.id;
      const alreadyScheduled = state.tasks.some(t => (t.recurrenceId || t.id) === seriesId && t.dueDate === nextDate && !t.completed);
      if (!alreadyScheduled) {
        state.tasks.unshift({ ...task, id: makeId(), recurrenceId: seriesId, dueDate: nextDate, createdAt: Date.now(), completed: false, completedAt: 0 });
        recurrenceCreated = true;
      }
    }
    const activityDate = checked ? todayKey() : (previousCompletedAt ? todayKey(new Date(previousCompletedAt)) : todayKey());
    if (!state.activity[activityDate]) state.activity[activityDate] = { tasks: 0, minutes: 0 };
    state.activity[activityDate].tasks = Math.max(0, safeNumber(state.activity[activityDate].tasks) + (checked ? 1 : -1));
    saveState(); renderAll();
    if (recurrenceCreated) showToast('Task completed. Next occurrence scheduled.');
  }
  function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (!window.confirm('Delete “' + task.title + '”?')) return;
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState(); renderAll(); showToast('Task deleted.');
  }
  function handleTaskAction(event) {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    if (action === 'toggle-task') toggleTask(id, el.checked);
    if (action === 'edit-task') openTaskModal(id);
    if (action === 'delete-task') deleteTask(id);
    if (action === 'toggle-goal') {
      const goal = getGoals().find(g => g.id === id);
      if (goal) { goal.done = el.checked; saveState(); renderAll(); }
    }
    if (action === 'edit-goal') {
      const goal = getGoals().find(g => g.id === id);
      if (!goal) return;
      const text = window.prompt('Edit this daily goal:', goal.text);
      if (text === null) return;
      if (!text.trim()) { showToast('A goal needs a name.', 'error'); return; }
      goal.text = text.trim().slice(0, 140); saveState(); renderAll();
    }
  }
  function editGoals() {
    const goals = getGoals();
    const current = goals.map(g => g.text).join('\n');
    const input = window.prompt('Write up to 5 daily goals, one per line:', current);
    if (input === null) return;
    const items = input.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);
    if (!items.length) { showToast('Keep at least one goal, or cancel to leave them unchanged.', 'error'); return; }
    const old = new Map(goals.map(g => [g.text, g]));
    state.goalsByDate[todayKey()] = items.map(text => old.get(text) || ({ id: makeId(), text: text.slice(0,140), done: false }));
    saveState(); renderAll(); showToast('Daily goals updated.');
  }
  function saveNote(value) {
    state.notes = value.slice(0, 20000);
    saveState();
    $('note-character-count').textContent = state.notes.length + ' / 5000';
    $('full-note-count').textContent = state.notes.length + ' / 20000';
    $('note-save-state').textContent = 'Saved on this device';
    $('notes-last-saved').textContent = 'Saved just now';
  }
  function timerModeLabel(mode) { return mode === 5 ? 'SHORT BREAK' : mode === 15 ? 'LONG BREAK' : 'FOCUS SESSION'; }
  function chooseTimerMode(minutes) {
    if (timer.running) pauseTimer();
    timer.mode = Number(minutes);
    timer.duration = timer.mode * 60;
    timer.remaining = timer.duration;
    timer.completed = false;
    persistTimer();
    renderTimer();
    $$('.timer-mode').forEach(b => b.classList.toggle('active', Number(b.dataset.duration) === timer.mode));
  }
  function startTimer() {
    if (timer.running) { pauseTimer(); return; }
    if (timer.remaining <= 0) { timer.remaining = timer.duration; timer.completed = false; }
    timer.running = true;
    timer.endAt = Date.now() + timer.remaining * 1000;
    persistTimer();
    timer.interval = window.setInterval(tickTimer, 250);
    updateTimerButtons();
    renderTimer();
    if (activeView === 'dashboard' || activeView === 'focus') showToast(timer.mode === 25 ? 'Focus session started. You’ve got this.' : 'Break started. Take a breath.');
  }
  function pauseTimer() {
    if (!timer.running) return;
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    timer.running = false;
    timer.endAt = null;
    window.clearInterval(timer.interval);
    timer.interval = null;
    persistTimer();
    renderTimer();
  }
  function resetTimer() {
    if (timer.interval) window.clearInterval(timer.interval);
    timer.running = false; timer.endAt = null; timer.remaining = timer.duration; timer.completed = false; timer.interval = null;
    persistTimer();
    renderTimer();
  }
  function tickTimer() {
    if (!timer.running || !timer.endAt) return;
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    if (timer.remaining <= 0) completeTimer();
    else renderTimer();
  }
  function completeTimer() {
    if (timer.interval) window.clearInterval(timer.interval);
    timer.interval = null; timer.running = false; timer.endAt = null; timer.remaining = 0; timer.completed = true;
    persistTimer();
    if (timer.mode === 25) {
      const key = todayKey();
      state.sessions.push({ date: key, minutes: 25, mode: 25, completedAt: Date.now() });
      if (!state.activity[key]) state.activity[key] = { tasks: 0, minutes: 0 };
      state.activity[key].minutes = safeNumber(state.activity[key].minutes) + 25;
      saveState();
    }
    renderAll(); renderTimer();
    showToast(timer.mode === 25 ? 'Focus session complete. Nice work!' : 'Break complete. Ready when you are.');
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('FocusDeck', { body: timer.mode === 25 ? 'Focus session complete. Take a short break.' : 'Your break is over. Ready for another session?' });
    } catch (_) {}
  }
  function renderTimer() {
    if (timer.running && timer.endAt) timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    const mins = Math.floor(timer.remaining / 60), secs = timer.remaining % 60;
    const display = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    const progress = timer.duration ? timer.remaining / timer.duration : 0;
    const offset = CIRCUMFERENCE * (1 - progress);
    ['timer-display','timer-display-large'].forEach(id => { if ($(id)) $(id).textContent = display; });
    ['timer-ring-progress','timer-ring-progress-large'].forEach(id => { if ($(id)) $(id).style.strokeDashoffset = String(offset); });
    ['timer-status','timer-status-large'].forEach(id => { if ($(id)) $(id).textContent = timer.completed ? 'SESSION COMPLETE' : timer.running ? timerModeLabel(timer.mode) + ' IN PROGRESS' : timer.remaining < timer.duration ? 'SESSION PAUSED' : 'READY WHEN YOU ARE'; });
    ['timer-caption','timer-caption-large'].forEach(id => { if ($(id)) $(id).textContent = timer.mode === 25 ? 'minutes of focused work' : 'minutes to reset'; });
    ['timer-footnote','timer-footnote-large'].forEach(id => { if ($(id)) $(id).textContent = timer.completed ? 'Take a breath. You made time for what matters.' : timer.running ? 'Stay with one thing. You are doing fine.' : 'Put distractions aside. You’ve got this.'; });
    updateTimerButtons();
    if ($('focus-sessions-total')) $('focus-sessions-total').textContent = state.sessions.filter(s => s.mode === 25).length;
    if ($('focus-page-minutes')) $('focus-page-minutes').textContent = getTodayFocusMinutes();
  }
  function updateTimerButtons() {
    const label = timer.running ? 'Pause session' : timer.completed ? 'Start again' : timer.remaining < timer.duration ? 'Resume session' : timer.mode === 25 ? 'Start focus' : 'Start break';
    ['timer-start','timer-start-large'].forEach(id => {
      if ($(id)) $(id).innerHTML = label + ' <span>' + (timer.running ? 'Ⅱ' : '→') + '</span>';
    });
  }
  function exportData() {
    const data = JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'FocusDeck' }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'focusdeck-backup-' + todayKey() + '.json'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url); showToast('Backup exported.');
  }
  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || parsed.app !== 'FocusDeck' || !Array.isArray(parsed.tasks)) throw new Error('This file is not a valid FocusDeck backup.');
        if (!window.confirm('Import this backup and replace the data currently saved in FocusDeck?')) return;
        const cleaned = {
          ...freshState(), ...parsed,
          tasks: parsed.tasks.map(t => ({ id: String(t.id || makeId()), title: String(t.title || '').slice(0,180), description: String(t.description || '').slice(0,1000), priority: ['high','medium','low'].includes(t.priority) ? t.priority : 'medium', category: String(t.category || 'Personal').slice(0,50), dueDate: typeof t.dueDate === 'string' ? t.dueDate : '', repeat: ['daily','weekdays','weekly','monthly'].includes(t.repeat) ? t.repeat : 'none', recurrenceId: String(t.recurrenceId || t.id || makeId()), createdAt: safeNumber(t.createdAt, Date.now()), completed: Boolean(t.completed), completedAt: safeNumber(t.completedAt, 0) })).filter(t => t.title.trim()),
          notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0,20000) : '',
          theme: parsed.theme === 'light' ? 'light' : 'dark',
          goalsByDate: parsed.goalsByDate && typeof parsed.goalsByDate === 'object' ? parsed.goalsByDate : {},
          activity: parsed.activity && typeof parsed.activity === 'object' ? parsed.activity : {},
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
        };
        state = cleaned; applyTheme(); saveState(); renderAll(); showToast('Backup imported successfully.');
      } catch (error) { showToast(error.message || 'Could not import this file.', 'error'); }
      $('import-data').value = '';
    };
    reader.onerror = () => showToast('Could not read this file.', 'error');
    reader.readAsText(file);
  }
  function resetData() {
    if (!window.confirm('Reset FocusDeck on this device? Your tasks, notes, goals and activity will be permanently removed from this browser. Export a backup first if you may need them.')) return;
    if (timer.interval) window.clearInterval(timer.interval);
    timer = { duration: 1500, remaining: 1500, running: false, endAt: null, interval: null, mode: 25, completed: false };
    persistTimer();
    state = freshState(); applyTheme(); saveState(); currentTaskFilter = 'all'; renderAll(); setView('dashboard'); showToast('Your workspace has been reset.');
  }
  function renderAll() {
    renderDashboard();
    if (activeView === 'tasks') renderFullTasks();
    if (activeView === 'insights') renderInsights();
    renderTimer();
  }
  function bindEvents() {
    $$('.nav-item[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    $$('[data-open-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.openView)));
    $('quick-add-task').addEventListener('click', () => openTaskModal());
    $('inline-add-task').addEventListener('click', () => openTaskModal());
    $('tasks-add-button').addEventListener('click', () => openTaskModal());
    $('task-modal-close').addEventListener('click', closeTaskModal);
    $('task-cancel').addEventListener('click', closeTaskModal);
    $('task-modal-backdrop').addEventListener('click', e => { if (e.target === $('task-modal-backdrop')) closeTaskModal(); });
    $('task-form').addEventListener('submit', upsertTask);
    $('dashboard-task-list').addEventListener('click', handleTaskAction);
    $('dashboard-task-list').addEventListener('change', handleTaskAction);
    $('full-task-list').addEventListener('click', handleTaskAction);
    $('full-task-list').addEventListener('change', handleTaskAction);
    $('goals-list').addEventListener('click', handleTaskAction);
    $('goals-list').addEventListener('change', handleTaskAction);
    $$('.filter-chip').forEach(b => b.addEventListener('click', () => { currentTaskFilter = b.dataset.taskFilter; renderDashboard(); }));
    $('task-search').addEventListener('input', renderFullTasks);
    $('task-status-filter').addEventListener('change', renderFullTasks);
    $('task-category-filter').addEventListener('change', renderFullTasks);
    $('task-sort').addEventListener('change', renderFullTasks);
    $('task-date-filter').addEventListener('change', renderFullTasks);
    $('edit-goals').addEventListener('click', editGoals);
    $('dashboard-note').addEventListener('input', e => { saveNote(e.target.value); $('full-note').value = e.target.value; });
    $('full-note').addEventListener('input', e => { saveNote(e.target.value); $('dashboard-note').value = e.target.value.slice(0,5000); });
    $('timer-start').addEventListener('click', () => timer.running ? pauseTimer() : startTimer());
    $('timer-start-large').addEventListener('click', () => timer.running ? pauseTimer() : startTimer());
    $('timer-reset').addEventListener('click', resetTimer);
    $('timer-reset-large').addEventListener('click', resetTimer);
    $$('.timer-mode').forEach(b => b.addEventListener('click', () => chooseTimerMode(Number(b.dataset.duration))));
    $('focus-shortcut').addEventListener('click', () => { setView('focus'); if (!timer.running && timer.remaining === timer.duration) startTimer(); });
    $('theme-toggle').addEventListener('click', () => { setTheme(state.theme === 'dark' ? 'light' : 'dark'); showToast('Theme updated.'); });
    $('settings-theme-toggle').addEventListener('click', () => { setTheme(state.theme === 'dark' ? 'light' : 'dark'); showToast('Theme updated.'); });
    $('settings-button').addEventListener('click', () => setView('settings'));
    $('mobile-menu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    document.addEventListener('click', e => { if (window.innerWidth <= 900 && $('sidebar').classList.contains('open') && !e.target.closest('#sidebar') && !e.target.closest('#mobile-menu')) $('sidebar').classList.remove('open'); });
    $('export-data').addEventListener('click', exportData);
    $('import-data').addEventListener('change', e => importData(e.target.files && e.target.files[0]));
    $('reset-data').addEventListener('click', resetData);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeTaskModal(); $('sidebar').classList.remove('open'); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openTaskModal(); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && timer.running) tickTimer(); });
    window.addEventListener('beforeunload', () => { if (timer.running) { timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000)); timer.running = false; if (timer.interval) window.clearInterval(timer.interval); } });
  }
  function init() {
    applyTheme();
    bindEvents();
    renderAll();
    if (timer.running) {
      if (timer.remaining <= 0) tickTimer();
      else timer.interval = window.setInterval(tickTimer, 250);
    }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Offline support unavailable:', err)));
    }
  }
  init();
})();