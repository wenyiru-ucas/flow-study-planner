/* ═══ taskModal.js — 任务编辑弹窗 ═══
   来源：原 学习计划助手.html 第 1417-1519 行。无逻辑改动。 */

// ═══════════ TASK MODAL ═══════════
function showTaskModal(task = null) {
    document.getElementById('task-modal').style.display = 'flex';
    document.getElementById('task-modal-title').textContent = task ? '编辑任务' : '新建任务';
    document.getElementById('edit-task-id').value = task ? task.id : '';
    document.getElementById('task-name').value = task ? task.name : '';
    document.getElementById('task-start').value = task ? task.start : '';
    document.getElementById('task-end').value = task ? task.end : '';
    document.getElementById('task-total').value = task ? task.total : '';
    document.getElementById('task-done').value = task ? task.done : '0';
    document.getElementById('task-days').value = task ? task.days : '0';
    document.getElementById('task-type').value = task ? task.type : 'regular';
    document.getElementById('task-timer-mode').value = task ? (task.timerMode || 'countdown') : 'countdown';
    document.getElementById('task-status').value = task ? task.status : 'active';
    document.getElementById('task-note').value = task ? task.note : '';
    document.getElementById('task-tags').value = task ? (task.tags || '') : '';
    document.getElementById('task-delete-btn').style.display = task ? 'inline-flex' : 'none';
    // Color picker
    const selColor = task ? task.color : getTaskColor(Math.floor(Math.random() * 10));
    document.getElementById('task-color').value = selColor;
    const pickerColors = (document.documentElement.getAttribute('data-theme') === 'dark') ? TASK_COLORS_DARK : TASK_COLORS;
    document.getElementById('color-picker').innerHTML = pickerColors.map(c =>
        `<span style="background:${c};width:26px;height:26px;border-radius:50%;cursor:pointer;border:2px solid ${c===selColor?'var(--text)':'transparent'};transition:all 0.2s;display:inline-block;" onclick="pickColor('${c}',this)"></span>`
    ).join('');
}

function pickColor(color, el) {
    document.getElementById('task-color').value = color;
    document.querySelectorAll('#color-picker span').forEach(s => s.style.borderColor = 'transparent');
    el.style.borderColor = 'var(--text)';
}

function closeTaskModal() { document.getElementById('task-modal').style.display = 'none'; }

function deleteTaskFromModal() {
    const id = document.getElementById('edit-task-id').value;
    if (!id) return;
    deleteTask(id);
    closeTaskModal();
}

function saveTask() {
    const id = document.getElementById('edit-task-id').value;
    const existing = data.tasks.find(t => t.id === id);
    const td = {
        id: id || crypto.randomUUID(),
        name: document.getElementById('task-name').value.trim(),
        start: document.getElementById('task-start').value,
        end: document.getElementById('task-end').value,
        total: parseFloat(document.getElementById('task-total').value) || 0,
        done: parseFloat(document.getElementById('task-done').value) || 0,
        days: parseInt(document.getElementById('task-days').value) || 0,
        type: document.getElementById('task-type').value,
        timerMode: document.getElementById('task-timer-mode').value || 'countdown',
        status: document.getElementById('task-status').value,
        note: document.getElementById('task-note').value,
        tags: document.getElementById('task-tags').value.trim(),
        pomoMinutes: existing ? (existing.pomoMinutes || 0) : 0,
        pomoUnits: existing ? (existing.pomoUnits || 0) : 0,
        pomoProductive: existing ? (existing.pomoProductive || 0) : 0,
        sortOrder: existing ? (existing.sortOrder || 0) : 0,
        color: document.getElementById('task-color').value || (existing ? existing.color : getTaskColor(Math.floor(Math.random() * 10))),
        completedDate: (document.getElementById('task-status').value === 'done') ? (existing?.completedDate || today()) : '',
    };
    if (!td.name) { showToast('请输入项目名称'); return; }
    const idx = data.tasks.findIndex(t => t.id === id);
    if (idx >= 0) {
        data.tasks[idx] = td;
        // 任务参数变化后刷新今日快照（含指纹，renderToday 也会二次校验）
        const dayKey = today();
        if (!data.dailyDone[dayKey]) data.dailyDone[dayKey] = { targets: {} };
        if (!data.dailyDone[dayKey].targets) data.dailyDone[dayKey].targets = {};
        if (!data.dailyDone[dayKey]._params) data.dailyDone[dayKey]._params = {};
        const fp = `${td.end || ''}|${td.total || 0}`;
        data.dailyDone[dayKey].targets[td.id] = +calcKPI(td).daily.toFixed(1);
        data.dailyDone[dayKey]._params[td.id] = fp;
    } else data.tasks.push(td);
    saveData();
    closeTaskModal();
    if (document.getElementById('page-planner').classList.contains('active')) renderPlanner();
    if (document.getElementById('page-today').classList.contains('active')) renderToday();
    showToast('✅ 已保存');
}

function quickEdit(id) { const t = data.tasks.find(x => x.id === id); if (t) showTaskModal(t); }

function checkInToday() {
    const td = today();
    if (data.checkins[td]) { showToast('今天已打卡 🔥'); return; }
    data.checkins[td] = { minutes: getTodayPomoMinutes(), tasks: {} };
    saveData();
    showToast('✅ 打卡成功！');
    if (document.getElementById('page-planner').classList.contains('active')) renderPlanner();
    if (document.getElementById('page-today').classList.contains('active')) renderToday();
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}
