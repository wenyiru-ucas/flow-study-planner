/* ═══ settings.js — 设置页 ═══
   来源：原 学习计划助手.html 第 1915-2010 行。

   【第2步新增】新增「数据备份与恢复」相关函数，并在 loadSettings 里渲染备份卡片。
   备份逻辑（writeSnapshot/listSnapshots/restoreSnapshot 等）在 data.js 中。 */

// ═══════════ SETTINGS ═══════════
function loadSettings() {
    document.getElementById('api-key').value = data.settings.apiKey || '';
    document.getElementById('reminder-time').value = data.settings.reminderTime || '09:00';
    document.getElementById('pomo-work').value = data.settings.pomoWork || 60;
    document.getElementById('pomo-break').value = data.settings.pomoBreak || 5;
    document.getElementById('wrong-tags-input').value = (data.settings.wrongTags || []).join(', ');
    // Reference times grid
    const refGrid = document.getElementById('ref-times-grid');
    const refTimes = data.settings.exerciseRefTimes || {};
    refGrid.innerHTML = EXERCISE_MODULES.map(m => {
        const val = refTimes[m] !== undefined ? refTimes[m] : '';
        return `<div style="display:flex;align-items:center;gap:4px;font-size:12px;"><span style="min-width:60px;">${m}</span><input type="number" step="0.1" min="0" data-ref-mod="${m}" value="${val}" placeholder="分钟/题" style="flex:1;padding:4px 8px;border:1px solid var(--border-input);border-radius:6px;font-size:12px;font-family:inherit;background:var(--input-bg);color:var(--text);outline:none;width:80px;"></div>`;
    }).join('');
    // Pomodoro session list
    renderPomoSessions();
    // 【第2步】渲染备份卡片统计
    renderBackupStats();
}

function renderPomoSessions() {
    const list = document.getElementById('pomo-session-list');
    if (!list) return;
    const sessions = (data.pomodoroSessions || []).slice().reverse().slice(0, 30);
    if (!sessions.length) { list.innerHTML = '<span style="color:var(--text3);">暂无记录</span>'; return; }
    list.innerHTML = sessions.map(s => {
        const task = data.tasks.find(t => t.id === s.taskId);
        const name = task ? task.name : (data.tempChecklist.find(i => i.id === s.taskId)?.name || '已删除任务');
        const icon = s.minutes > 180 ? '⚠️' : '🍅';
        return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-subtle);">
            <span>${icon}</span>
            <span style="flex:1;">${name}</span>
            <span style="color:${s.minutes>180?'var(--red)':'var(--text2)'};min-width:50px;text-align:right;">${s.minutes}分</span>
            <span style="font-size:10px;color:var(--text3);min-width:70px;text-align:right;">${s.date}</span>
            <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:2px 6px;font-size:10px;" onclick="deletePomoSession('${s.taskId}','${s.date}',${s.minutes})">✕</button>
        </div>`;
    }).join('');
}

function deletePomoSession(taskId, date, minutes) {
    if (!confirm(`确定删除这条${minutes}分钟的番茄钟记录吗？`)) return;
    const idx = data.pomodoroSessions.findIndex(s => s.taskId === taskId && s.date === date && s.minutes === minutes);
    if (idx >= 0) {
        const s = data.pomodoroSessions[idx];
        const task = data.tasks.find(t => t.id === s.taskId);
        if (task) task.pomoMinutes = Math.max(0, (task.pomoMinutes || 0) - s.minutes);
        if (data.checkins[s.date]) data.checkins[s.date].minutes = Math.max(0, (data.checkins[s.date].minutes || 0) - s.minutes);
        data.pomodoroSessions.splice(idx, 1);
        saveData();
        renderPomoSessions();
        showToast('🗑 已删除');
    }
}

function saveSettings() {
    data.settings.apiKey = document.getElementById('api-key').value.trim();
    data.settings.reminderTime = document.getElementById('reminder-time').value;
    data.settings.pomoWork = parseInt(document.getElementById('pomo-work').value) || 60;
    data.settings.pomoBreak = parseInt(document.getElementById('pomo-break').value) || 5;
    data.settings.wrongTags = document.getElementById('wrong-tags-input').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (!data.settings.wrongTags.length) data.settings.wrongTags = ['概念不熟', '粗心', '时间不够蒙的', '计算错误'];
    // Reference times
    const refTimes = {};
    document.querySelectorAll('#ref-times-grid input').forEach(inp => {
        const v = parseFloat(inp.value);
        if (!isNaN(v) && v >= 0) refTimes[inp.dataset.refMod] = v;
    });
    data.settings.exerciseRefTimes = refTimes;
    saveData();
    document.getElementById('saved-msg').style.display = 'inline';
    setTimeout(() => document.getElementById('saved-msg').style.display = 'none', 2000);
    scheduleReminder();
    showToast('💾 已保存');
}

function requestNotif() {
    if (!('Notification' in window)) { showToast('⚠️ 不支持'); return; }
    Notification.requestPermission().then(p => showToast(p === 'granted' ? '🔔 已开启' : '⚠️ 被拒绝'));
}

function scheduleReminder() {
    const t = data.settings.reminderTime;
    if (!t) return;
    const [h, m] = t.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target < now) target.setDate(target.getDate() + 1);
    setTimeout(() => {
        if (Notification.permission === 'granted') {
            const behind = data.tasks.filter(t => t.status === 'active' && calcKPI(t).gap < 0).length;
            const n = new Notification('🎯 学习提醒', { body: behind > 0 ? `⚠️ ${behind}个任务进度滞后` : '📚 新的一天开始',
                icon: '📚' });
            n.onclick = () => { window.focus(); n.close(); };
        }
        scheduleReminder();
    }, target - now);
}

// ═══════════ 【第2步新增】数据备份与恢复 ═══════════
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function formatTs(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

async function renderBackupStats() {
    const el = document.getElementById('backup-stats');
    if (!el) return;
    el.innerHTML = '<span style="color:var(--text3);">统计中…</span>';
    const stats = await getBackupStats();
    if (!stats.count) {
        el.innerHTML = '<span style="color:var(--text3);">暂无快照</span>';
        return;
    }
    el.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;">
            <span>📦 共 <strong style="color:var(--accent);">${stats.count}</strong> 份</span>
            <span>💾 占用 <strong>${formatSize(stats.totalSize)}</strong></span>
            <span>🕒 最新 <strong>${formatTs(stats.latest)}</strong></span>
            <span>🕐 最早 <strong>${formatTs(stats.earliest)}</strong></span>
        </div>`;
}

async function manualSnapshot() {
    const ok = await writeSnapshot('manual');
    showToast(ok ? '📦 已创建快照' : '⚠️ 快照失败');
    renderBackupStats();
    renderSnapshotList();
}

async function renderSnapshotList() {
    const el = document.getElementById('snapshot-list');
    if (!el) return;
    el.innerHTML = '<span style="color:var(--text3);">加载中…</span>';
    const list = await listSnapshots(20);
    if (!list.length) {
        el.innerHTML = '<span style="color:var(--text3);">暂无快照记录</span>';
        return;
    }
    const triggerLabel = { manual: '手工', interval: '自动', beforeunload: '关页', daily: '每日', migration: '迁移' };
    el.innerHTML = list.map(s => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-subtle);">
            <span style="font-size:10px;padding:1px 6px;border-radius:8px;background:var(--fill-medium);color:var(--text2);min-width:36px;text-align:center;">${triggerLabel[s.trigger] || s.trigger}</span>
            <span style="flex:1;font-size:12px;">${formatTs(s.timestamp)}</span>
            <span style="font-size:11px;color:var(--text3);">${formatSize(s.size || 0)}</span>
            <button class="btn btn-ghost btn-sm" style="color:var(--accent);padding:2px 8px;font-size:10px;" onclick="restoreSnapshotConfirm(${s.id})">⏪ 恢复</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:2px 6px;font-size:10px;" onclick="removeSnapshot(${s.id})">✕</button>
        </div>`).join('');
}

async function restoreSnapshotConfirm(id) {
    if (!confirm('⚠️ 将用此快照覆盖当前数据，确定恢复吗？\n（建议先导出当前 JSON 做保险）')) return;
    const ok = await restoreSnapshot(id);
    if (ok) {
        showToast('✅ 已恢复，正在刷新…');
        setTimeout(() => location.reload(), 800);
    } else {
        showToast('❌ 恢复失败');
    }
}

async function removeSnapshot(id) {
    if (!confirm('删除此快照？')) return;
    await deleteSnapshot(id);
    renderBackupStats();
    renderSnapshotList();
    showToast('🗑 已删除');
}

async function cleanupSnapshots() {
    if (!confirm('将清理旧快照，仅保留最近 10 份，确定？')) return;
    const n = await clearOldSnapshots(10);
    showToast(`🗑 已清理 ${n} 份`);
    renderBackupStats();
    renderSnapshotList();
}
