/* ═══ planner.js — 月度规划渲染 ═══
   来源：原 学习计划助手.html 第 811-1092 行。

   【第3步改动】renderPlanner 内单位耗时显示改用派生函数 getUnitCost(t.id)。
   原代码：${(t.pomoUnits||0)>0?Math.round((t.pomoProductive||0)/(t.pomoUnits||1))+'分/单位':'—'}
   新代码：调用 getUnitCost(t.id)（在 utils.js 中，对 doneDelta>0 的 session 派生，旧数据兜底）。
   */

// ═══════════ PLANNER ═══════════
function getViewMonth() {
    if (viewMonth) return viewMonth;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
}
function monthKey(vm) { return `${vm.year}-${vm.month+1}`; }

function formatDateRange(start, end) {
    if (!start && !end) return '—';
    const s = start ? start.replace(/^(\d{4})-0?(\d{1,2})-0?(\d{1,2})$/, '$1.$2.$3') : '?';
    const e = end ? end.replace(/^(\d{4})-0?(\d{1,2})-0?(\d{1,2})$/, '$1.$2.$3') : '?';
    if (s === e) return s;
    // If same year/month, shorten
    const sp = s.split('.');
    const ep = e.split('.');
    if (sp[0] === ep[0] && sp[1] === ep[1]) return `${s}-${ep[2]}`;
    if (sp[0] === ep[0]) return `${s}-${ep[1]}.${ep[2]}`;
    return `${s}-${e}`;
}

function renderPlanner() {
    document.getElementById('greeting').textContent =
        `👋 ${new Date().getHours()<12?'早上好':new Date().getHours()<18?'下午好':'晚上好'}`;
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-CN', { weekday: 'long',
        year: 'numeric', month: 'long', day: 'numeric' });

    const active = data.tasks.filter(t => t.status === 'active' && t.type !== 'rest');
    const behind = active.filter(t => calcKPI(t).gap < 0).length;
    const todayMins = getTodayPomoMinutes();

    // Sidebar stats
    document.getElementById('sidebar-today-min').textContent = formatTime(getTodayPomoMinutes());
    document.getElementById('sidebar-streak').textContent = calcStreak() + ' 天';

    // Temp checklist
    renderTempChecklist();
    renderTopCountdowns();
    renderTempChecklist();

    // Goal bar + month nav
    const vm = getViewMonth();
    const mk = monthKey(vm);
    document.getElementById('planner-month-title').textContent = `${vm.year}年${vm.month+1}月`;
    document.getElementById('goal-month-label').textContent = `${vm.month+1}月`;
    loadGoalLines();

    // Plan table — viewMonth's tasks
    const monthStart = `${vm.year}-${String(vm.month+1).padStart(2,'0')}-01`;
    const nextMonth = new Date(vm.year, vm.month + 1, 1);
    const monthEnd = new Date(nextMonth - 86400000).toISOString().slice(0, 10);

    const sortMode = document.getElementById('plan-sort').value;
    const monthTasks = data.tasks.filter(t => t.start <= monthEnd && t.end >= monthStart)
        .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        const ka = calcKPI(a), kb = calcKPI(b);
        switch (sortMode) {
            case 'actual-desc': return kb.actual - ka.actual;
            case 'actual-asc': return ka.actual - kb.actual;
            case 'gap-asc': return ka.gap - kb.gap;
            case 'gap-desc': return kb.gap - ka.gap;
            case 'pomo-desc': return getPomoMinutes(b.id) - getPomoMinutes(a.id);
            case 'pomo-asc': return getPomoMinutes(a.id) - getPomoMinutes(b.id);
            default: return (a.sortOrder || 0) - (b.sortOrder || 0);
        }
    });

    document.getElementById('plan-tbody').innerHTML = monthTasks.length ? monthTasks.map(t => {
        const k = calcKPI(t);
        const schedPct = Math.round(k.sched * 100);
        const actualPct = Math.round(k.actual * 100);
        const gapPct = (k.gap * 100).toFixed(1);
        const gapColor = k.gap >= 0 ? 'var(--green)' : 'var(--red)';
        const gapSign = k.gap >= 0 ? '+' : '';
        const typeClass = t.type === 'temp' ? 'tp-tag-temp' : t.type === 'rest' ? 'tp-tag-rest' :
            'tp-tag-regular';
        const typeLabel = t.type === 'temp' ? '临时' : t.type === 'rest' ? '休息' : '常规';
        const statusClass = t.status === 'done' ? 'tp-tag-done' : t.status === 'paused' ? 'tp-tag-rest' :
            '';
        const statusLabel = t.status === 'done' ? '✓' : t.status === 'paused' ? '⏸' : '';
        const dateRange = formatDateRange(t.start, t.end);
        const rowStyle2 = t.status === 'done' ? 'opacity:0.5;' : t.status === 'paused' ? 'opacity:0.4;' : '';
        // 【第3步】单位耗时改用纯派生函数（doneDelta>0 的 session 求和，旧数据兜底）
        const uc = getUnitCost(t.id);
        const ucText = uc ? uc + '分/单位' : '—';
        return `<tr style="${rowStyle2}" draggable="true" data-task-id="${t.id}" onclick="quickEdit('${t.id}')">
      <td><span class="drag-handle" onclick="event.stopPropagation()">⋮⋮</span></td>
      <td><div class="tp-name"><button class="tp-btn" style="margin-right:4px;" onclick="event.stopPropagation();startPomo('${t.id}','${t.name.replace(/'/g,"\\\\'")}')" title="🍅">🍅</button><span class="tp-dot" style="background:${getDisplayColor(t.color)}"></span>${t.name}</div></td>
      <td class="tp-pomo">${formatTime(getPomoMinutes(t.id))}<span style="font-size:10px;color:var(--text3);display:block;">${ucText}</span></td>
      <td style="font-size:12px;white-space:nowrap;">${dateRange}</td>
      <td class="tp-num">${t.total}</td><td class="tp-num">${t.done}</td>
      <td class="tp-num">${schedPct}%</td><td class="tp-num">${actualPct}%</td>
      <td class="tp-gap" style="color:${gapColor};font-size:13px;">${gapSign}${gapPct}%</td>
      <td class="tp-num" style="font-weight:600;">${k.daily.toFixed(1)}</td><td class="tp-num" style="color:var(--red)">${k.catchUp>0?k.catchUp.toFixed(1):'—'}</td>
      <td><span class="tp-tag ${typeClass}">${typeLabel}</span>${statusLabel?` <span class="tp-tag ${statusClass}">${statusLabel}</span>`:''}</td>
    </tr>`;
    }).join('') :
        '<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--text2);cursor:pointer;" onclick="showTaskModal()">本月暂无任务，点击 + 新建</td></tr>';

    renderPastMonths();
    setupDragListeners();
}

function renderTempChecklist() {
    const items = data.tempChecklist;
    document.getElementById('temp-list').innerHTML = items.length ? items.map(item => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-subtle);">
      <input type="checkbox" onchange="toggleTempTask('${item.id}')" style="cursor:pointer;accent-color:var(--accent);">
      <button class="btn btn-ghost btn-sm" style="padding:4px 8px;font-size:11px;" onclick="event.stopPropagation();startTempPomo('${item.id}','${item.name.replace(/'/g,"\\\\'")}')">🍅</button>
      <span style="flex:1;font-size:13px;">${item.name}</span>
      <span style="font-size:11px;color:var(--text2);">🍅${formatTime(getTempPomoMinutes(item.id))}</span>
    </div>`).join('') : '<div style="text-align:center;padding:12px;color:var(--text3);font-size:12px;">暂无待办</div>';
}

function addTempTask() {
    const input = document.getElementById('temp-input');
    const name = input.value.trim();
    if (!name) return;
    data.tempChecklist.push({ id: crypto.randomUUID(), name, done: false, completedDate: '', pomoMinutes: 0 });
    input.value = '';
    saveData();
    renderTempChecklist();
}

function toggleTempTask(id) {
    const item = data.tempChecklist.find(i => i.id === id);
    if (!item) return;
    // Delete immediately when checked
    data.tempChecklist = data.tempChecklist.filter(i => i.id !== id);
    saveData();
    renderTempChecklist();
}

function getTempPomoMinutes(id) {
    return data.pomodoroSessions.filter(s => s.taskId === id).reduce((s, x) => s + x.minutes, 0);
}

function startTempPomo(id, name) {
    // Use the same pomodoro, but tag it as a temp task
    pomoState.taskId = id;
    pomoState.taskName = name;
    pomoState.isTemp = true;
    startPomo(id, name);
}

function saveGoalLines() {
    const mk = monthKey(getViewMonth());
    const lines = [];
    document.querySelectorAll('.goal-line-input').forEach(inp => lines.push(inp.value.trim()));
    data.monthlyGoals[mk] = JSON.stringify(lines);
    saveData();
}

function loadGoalLines() {
    const mk = monthKey(getViewMonth());
    let lines = ['', '', ''];
    try {
        const saved = JSON.parse(data.monthlyGoals[mk] || '["","",""]');
        if (Array.isArray(saved)) lines = saved.slice(0, 3);
    } catch (e) { /* old format, ignore */ }
    document.querySelectorAll('.goal-line-input').forEach((inp, i) => {
        inp.value = lines[i] || '';
    });
}

function navPlannerMonth(dir) {
    const vm = getViewMonth();
    vm.month += dir;
    if (vm.month < 0) { vm.month = 11; vm.year--; }
    if (vm.month > 11) { vm.month = 0; vm.year++; }
    viewMonth = { year: vm.year, month: vm.month };
    renderPlanner();
}

function goPlannerToday() {
    viewMonth = null;
    renderPlanner();
}

function deleteTask(id) {
    const t = data.tasks.find(x => x.id === id);
    if (!t) return;
    if (!confirm(`确定删除「${t.name}」吗？此操作不可撤销。`)) return;
    data.tasks = data.tasks.filter(x => x.id !== id);
    // Also clean pomodoro sessions for this task
    data.pomodoroSessions = data.pomodoroSessions.filter(s => s.taskId !== id);
    saveData();
    renderPlanner();
    if (document.getElementById('page-today').classList.contains('active')) renderToday();
    showToast('🗑 已删除');
}

function renderPastMonths() {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    const months = {};
    data.tasks.forEach(t => {
        if (!t.start) return;
        const [y, m] = t.start.split('-').map(Number);
        const key = `${y}-${m-1}`;
        if (key !== currentKey) {
            if (!months[key]) months[key] = { year: y, month: m - 1, tasks: [] };
            months[key].tasks.push(t);
        }
    });
    const entries = Object.values(months).sort((a, b) => b.year - a.year || b.month - a.month);
    if (!entries.length) { document.getElementById('past-months').innerHTML = ''; return; }
    document.getElementById('past-months').innerHTML = `
    <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:12px;">📦 历史月份</div>
    ${entries.map((m,i)=>`
      <div class="past-month" onclick="togglePastMonth(${i})">
        <div class="past-month-header">
          <span class="chevron">▶</span><span style="font-weight:700;">${m.year}年${m.month+1}月</span>
          <span style="font-size:12px;color:var(--text2);">${m.tasks.filter(t=>t.status==='done').length}/${m.tasks.length} 已完成</span>
        </div>
        <div class="past-month-body" onclick="event.stopPropagation()">
          <div style="padding:0 20px 16px;">
            ${m.tasks.map(t=>{const k=calcKPI(t);const p=Math.min(100,Math.round(k.actual*100));return`<div style="display:flex;align-items:center;gap:12px;padding:8px 0;font-size:13px;">
              <span style="font-weight:600;flex:1;">${t.name}</span><span style="color:var(--text2);">${t.done}/${t.total}</span>
              <div style="width:80px;height:4px;background:var(--fill-strong);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${p}%;background:${getDisplayColor(t.color)};border-radius:2px;"></div></div>
              <span style="width:36px;text-align:right;font-weight:600;">${p}%</span></div>`;}).join('')}
          </div></div></div>`).join('')}`;
    window._pastMonthsData = entries;
}

function togglePastMonth(i) { document.querySelectorAll('.past-month')[i].classList.toggle('open'); }
