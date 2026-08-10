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
    // Color picker（用户可配置色板：渲染 palette + ➕添加 + 色点删除）
    const selColor = task ? task.color : getTaskColor(Math.floor(Math.random() * getPalette().length));
    document.getElementById('task-color').value = selColor;
    renderColorPicker(selColor);

    // ── 08-06#2：渲染该任务的秒表分段记录（复盘用） ──
    renderTaskStopwatchLogs(task);
}

// 渲染颜色选择器（色板全部颜色 + 添加按钮 + 每个色点可删除）
function renderColorPicker(selColor) {
    const picker = document.getElementById('color-picker');
    if (!picker) return;
    const sel = (selColor || '').toLowerCase();
    picker.innerHTML = getPalette().map(c => `
        <span style="position:relative;display:inline-block;" class="cp-wrap">
            <span class="cp-swatch" style="background:${c};width:26px;height:26px;border-radius:50%;cursor:pointer;border:2px solid ${c.toLowerCase()===sel?'var(--text)':'transparent'};transition:all 0.2s;display:inline-block;" onclick="pickColor('${c}',this)"></span>
            <span class="cp-del" onclick="event.stopPropagation();delPaletteColor('${c}')" title="删除该颜色">✕</span>
        </span>`).join('') + `
        <label class="cp-add" title="添加颜色" style="position:relative;display:inline-block;">
            <input type="color" value="#0071e3" onchange="addPaletteColorUI(this.value)" style="position:absolute;inset:0;opacity:0;cursor:pointer;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:2px dashed var(--border-outline);color:var(--text2);font-size:14px;cursor:pointer;">＋</span>
        </label>`;
}

// 添加颜色（UI 包装：数据写入 + 重渲染 + 提示）
function addPaletteColorUI(hex) {
    if (!addPaletteColor(hex)) { showToast('⚠️ 该颜色已存在或格式无效'); return; }
    const cur = document.getElementById('task-color').value;
    renderColorPicker(cur);
    showToast('🎨 已添加颜色到色板');
}

// 删除颜色（UI 包装：数据删除 + 重渲染 + 提示，不影响已用该色的任务）
function delPaletteColor(hex) {
    if (!removePaletteColor(hex)) { showToast('⚠️ 至少保留 1 个颜色'); return; }
    const cur = document.getElementById('task-color').value;
    renderColorPicker(cur);
    showToast('🎨 已删除该颜色（不影响已用任务）');
}

// 渲染任务弹窗中的秒表分段记录（含补填题数/答对数）
function renderTaskStopwatchLogs(task) {
    const group = document.getElementById('task-sw-log-group');
    const box = document.getElementById('task-stopwatch-logs');
    if (!group || !box) return;
    const logs = (task && task.stopwatchLogs) || [];
    if (!logs.length) { group.style.display = 'none'; return; }
    group.style.display = '';
    const taskId = task ? task.id : document.getElementById('edit-task-id').value;
    box.innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:6px;">
            <button class="btn btn-ghost btn-sm" onclick="toggleManualSwLog()" style="padding:2px 10px;">➕ 手动录入</button>
        </div>
        <div style="display:none;gap:6px;flex-wrap:wrap;align-items:center;padding:8px 10px;background:var(--fill-subtle);border-radius:10px;margin-bottom:8px;" id="manual-sw-log">
            <input type="date" id="msl-date" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;outline:none;">
            <input type="number" id="msl-c" placeholder="答对" min="0" style="width:64px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;text-align:center;outline:none;">
            <input type="number" id="msl-q" placeholder="题数" min="0" style="width:64px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;text-align:center;outline:none;">
            <input type="number" id="msl-m" placeholder="分" min="0" style="width:56px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;text-align:center;outline:none;">
            <input type="number" id="msl-s" placeholder="秒" min="0" max="59" style="width:56px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;text-align:center;outline:none;">
            <input list="sw-category-list" id="msl-cat" placeholder="类别" style="flex:1;min-width:100px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;outline:none;">
            <input type="text" id="msl-item" placeholder="名称" style="flex:1;min-width:100px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;outline:none;">
            <button class="btn btn-primary btn-sm" onclick="saveManualSwLog()">💾 保存</button>
        </div>
        <datalist id="sw-category-list">
            <option value="资料分析"><option value="图形推理"><option value="言语理解"><option value="数量关系"><option value="判断推理"><option value="常识判断"><option value="政治理论"><option value="其他">
        </datalist>
    ` + logs.slice().reverse().map(log => {
        // 同模块合并显示
        const lapAgg = {};
        (log.laps || []).forEach(l => {
            if (!lapAgg[l.name]) lapAgg[l.name] = { ms: 0, count: 0 };
            lapAgg[l.name].ms += l.ms;
            lapAgg[l.name].count += 1;
        });
        const mods = Object.keys(lapAgg).map(n => {
            const a = lapAgg[n];
            return `<span style="display:inline-block;padding:1px 8px;margin:2px 4px 2px 0;border-radius:10px;background:${getDisplayColor(getTagColor(n))}22;border:1px solid ${getDisplayColor(getTagColor(n))}55;">${n} ${formatClock(a.ms)}${a.count > 1 ? `×${a.count}` : ''}</span>`;
        }).join('');
        const totalMs = log.totalMs || 0;
        const rate = log.questions ? `<span>正确率 <b style="color:var(--accent);">${Math.round(log.correct / log.questions * 100)}%</b> (${log.correct}/${log.questions})</span>` : '';
        const speed = log.questions ? `<span style="color:var(--text2);">单题 ${formatMinSec(log.totalMs / 1000 / log.questions)}</span>` : '';
        const key = log.createdAt;
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                <span style="color:var(--text2);">📅 ${log.date}</span>
                ${log.category ? `<span style="font-size:11px;padding:1px 8px;border-radius:10px;background:var(--accent)22;border:1px solid var(--accent)55;color:var(--accent);">${String(log.category).replace(/&/g,'&amp;').replace(/</g,'&lt;')}${log.item ? ' · ' + String(log.item).replace(/&/g,'&amp;').replace(/</g,'&lt;') : ''}</span>` : ''}
                <span style="font-weight:600;">总 ${formatClock(totalMs)}</span>
                ${speed}
                ${rate}
                <button class="btn btn-ghost btn-sm" style="padding:1px 8px;margin-left:auto;" onclick="toggleStopwatchScore('${taskId}','${key}')" title="填写题数/答对数/类别/名称">✏️</button>
            </div>
            <div>${mods || '<span style="color:var(--text3);">无分段</span>'}</div>
            <div style="display:none;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;padding:8px 10px;background:var(--fill-subtle);border-radius:10px;" id="sw-score-${key}">
                <input type="date" id="swd-${key}" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;outline:none;">
                <input type="number" id="swc-${key}" placeholder="答对" min="0" style="width:64px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;text-align:center;outline:none;">
                <input type="number" id="swq-${key}" placeholder="题数" min="0" style="width:64px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;text-align:center;outline:none;">
                <input type="number" id="swm-${key}" placeholder="分" min="0" style="width:56px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;text-align:center;outline:none;">
                <input type="number" id="sws-${key}" placeholder="秒" min="0" max="59" style="width:56px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;text-align:center;outline:none;">
                <input list="sw-category-list" id="swcat-${key}" placeholder="类别（如资料分析）" style="flex:1;min-width:110px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;outline:none;">
                <input type="text" id="switem-${key}" placeholder="名称（如A老师第7套）" style="flex:1;min-width:110px;padding:4px 8px;border-radius:8px;border:1px solid var(--border-outline);background:var(--input-bg);color:var(--text);font-size:12px;font-family:inherit;outline:none;">
                <button class="btn btn-primary btn-sm" onclick="saveStopwatchScore('${taskId}','${key}')">💾 保存</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteStopwatchLog('${taskId}','${key}')" title="删除该条记录">🗑 删除</button>
            </div>
        </div>`;
    }).join('');
}

// 展开/收起练习成绩填写（含日期/用时修正）
function toggleStopwatchScore(taskId, createdAt) {
    const el = document.getElementById('sw-score-' + createdAt);
    if (!el) return;
    const show = el.style.display !== 'flex';
    el.style.display = show ? 'flex' : 'none';
    if (show) {
        const task = data.tasks.find(t => t.id === taskId);
        const log = task && task.stopwatchLogs.find(l => l.createdAt == createdAt);
        if (log) {
            const d = document.getElementById('swd-' + createdAt);
            const c = document.getElementById('swc-' + createdAt);
            const q = document.getElementById('swq-' + createdAt);
            const m = document.getElementById('swm-' + createdAt);
            const s = document.getElementById('sws-' + createdAt);
            const cat = document.getElementById('swcat-' + createdAt);
            const item = document.getElementById('switem-' + createdAt);
            if (d) d.value = log.date || '';
            if (q) q.value = log.questions || '';
            if (c) c.value = log.correct || '';
            if (m) m.value = Math.floor((log.totalMs || 0) / 60000);
            if (s) s.value = Math.round(((log.totalMs || 0) % 60000) / 1000);
            if (cat) cat.value = log.category || '';
            if (item) item.value = log.item || '';
        }
    }
}

// 保存练习成绩（可修正日期/答对数/题数/用时/类别/名称）
function saveStopwatchScore(taskId, createdAt) {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;
    const log = task.stopwatchLogs.find(l => l.createdAt == createdAt);
    if (!log) return;
    const q = parseInt(document.getElementById('swq-' + createdAt).value) || 0;
    const c = parseInt(document.getElementById('swc-' + createdAt).value) || 0;
    const m = parseInt(document.getElementById('swm-' + createdAt).value) || 0;
    const s = parseInt(document.getElementById('sws-' + createdAt).value) || 0;
    const d = document.getElementById('swd-' + createdAt).value;
    const catEl = document.getElementById('swcat-' + createdAt);
    const itemEl = document.getElementById('switem-' + createdAt);
    if (d) log.date = d;
    if (m > 0 || s > 0) {
        const newTotal = (m * 60 + s) * 1000;
        if (newTotal > 0) log.totalMs = newTotal;
    }
    log.questions = q > 0 ? q : null;
    log.correct = q > 0 ? c : null;
    if (catEl) log.category = catEl.value.trim() || null;
    if (itemEl) log.item = itemEl.value.trim() || null;
    saveData();
    renderTaskStopwatchLogs(task);
    showToast('✅ 已更新（正确率/用时/日期/类别/名称）');
}

// 删除单条分段计时记录
function deleteStopwatchLog(taskId, createdAt) {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!confirm('确定删除这条分段计时记录吗？')) return;
    task.stopwatchLogs = (task.stopwatchLogs || []).filter(l => l.createdAt != createdAt);
    saveData();
    renderTaskStopwatchLogs(task);
    showToast('🗑 已删除该条记录');
}

// 展开/收起手动录入表单
function toggleManualSwLog() {
    const el = document.getElementById('manual-sw-log');
    if (!el) return;
    const show = el.style.display !== 'flex';
    el.style.display = show ? 'flex' : 'none';
    if (show) {
        const dateEl = document.getElementById('msl-date');
        if (dateEl) dateEl.value = today();
    }
}

// 手动录入练习记录（补录历史做题情况：日期/答对/题数/用时）
function saveManualSwLog() {
    const taskId = document.getElementById('edit-task-id').value;
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;
    const q = parseInt(document.getElementById('msl-q').value) || 0;
    const c = parseInt(document.getElementById('msl-c').value) || 0;
    const m = parseInt(document.getElementById('msl-m').value) || 0;
    const s = parseInt(document.getElementById('msl-s').value) || 0;
    const date = document.getElementById('msl-date').value || today();
    if (q <= 0) { showToast('⚠️ 请填写题数'); return; }
    const totalMs = (m * 60 + s) * 1000;
    if (totalMs <= 0) { showToast('⚠️ 请填写用时（分/秒）'); return; }
    if (!task.stopwatchLogs) task.stopwatchLogs = [];
    task.stopwatchLogs.push({
        date,
        laps: [],
        totalMs,
        questions: q,
        correct: Math.min(c, q),
        category: (document.getElementById('msl-cat').value || '').trim() || null,
        item: (document.getElementById('msl-item').value || '').trim() || null,
        createdAt: Date.now(),
        manual: true,
    });
    saveData();
    renderTaskStopwatchLogs(task);
    showToast('✅ 已手动录入练习记录');
}

function pickColor(color, el) {
    document.getElementById('task-color').value = color;
    document.querySelectorAll('#color-picker .cp-swatch').forEach(s => s.style.borderColor = 'transparent');
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
        color: document.getElementById('task-color').value || (existing ? existing.color : getTaskColor(Math.floor(Math.random() * TASK_COLORS.length))),
        stopwatchLogs: existing ? (existing.stopwatchLogs || []) : [],   // 保留秒表分段记录
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
