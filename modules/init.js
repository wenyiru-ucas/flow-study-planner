/* ═══ init.js — 初始化 & 全局事件绑定 ═══
   来源：原 学习计划助手.html 第 2270-2372 行。

   【第2步新增】
   - init() 末尾：beforeunload 兜底保存快照；孤儿备份检测（localStorage 空但 IndexedDB 有数据 → 提示恢复）
   - 全局事件绑定（modal 点击关闭、Escape、analytics-period 切换）保留
   - init() 调用、就绪日志保留
*/

function resetData() {
    if (!confirm('确定清空？建议先导出备份。')) return;
    data = { tasks: [], checkins: {}, pomodoroSessions: [], dailyDone: {}, tempChecklist: [], countdowns: [], monthlyGoals: {}, settings: data.settings, exerciseRecords: [] };
    saveData();
    showToast('🗑 已清空');
    renderPlanner();
    renderToday();
}

function showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// ═══════════ INIT ═══════════
function init() {
    applyTheme(getTheme());
    loadData();
    if (data.tasks.length === 0) {
        const td = today();
        const eom = new Date();
        eom.setMonth(eom.getMonth() + 1, 0);
        const eomStr = eom.toISOString().slice(0, 10);
        const mid = new Date();
        mid.setDate(15);
        const midStr = mid.toISOString().slice(0, 10);
        data.tasks = [
            { id: crypto.randomUUID(), name: '毕业论文', start: td, end: eomStr, total: 40000, done: 15000,
                days: 20, type: 'regular', status: 'active', pomoMinutes: 0, note: '',
            color: getTaskColor(0) },
            { id: crypto.randomUUID(), name: '刑法-精讲卷', start: td, end: midStr, total: 424, done: 100,
                days: 10, type: 'regular', status: 'active', pomoMinutes: 0, note: '',
            color: getTaskColor(1) },
            { id: crypto.randomUUID(), name: '英语-听力练习', start: td, end: eomStr, total: 25, done: 8, days: 15,
                type: 'regular', status: 'active', pomoMinutes: 0, note: '', color: getTaskColor(2) },
            { id: crypto.randomUUID(), name: '行政法-每日一题', start: td, end: eomStr, total: 30, done: 18,
                days: 18, type: 'regular', status: 'active', pomoMinutes: 0, note: '',
            color: getTaskColor(3) },
        ];
        saveData();
    }
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-CN', { weekday: 'long',
        year: 'numeric', month: 'long', day: 'numeric' });
    renderPlanner();
    loadSettings();
    scheduleReminder();

    // 4am auto-refresh for today page
    let lastDay = today();
    setInterval(() => {
        const cur = today();
        if (cur !== lastDay) {
            lastDay = cur;
            document.getElementById('today-date').textContent = new Date().toLocaleDateString('zh-CN', { weekday: 'long',
                year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('greeting').textContent = `👋 ${new Date().getHours()<12?'早上好':new Date().getHours()<18?'下午好':'晚上好'}`;
            if (document.getElementById('page-planner').classList.contains('active')) renderPlanner();
            if (document.getElementById('page-today').classList.contains('active')) renderToday();
            showToast('🌅 新的一天，今日任务已更新');
        }
    }, 60000);

    // 【第2步】beforeunload 兜底：页面关闭/刷新前立即写一份快照
    window.addEventListener('beforeunload', () => {
        try { writeSnapshot('beforeunload'); } catch (e) {}
    });

    // 【第2步】孤儿备份检测：localStorage 空但 IndexedDB 有快照（对话1 #20 数据消失的兜底）
    checkOrphanBackup().then(stats => {
        if (stats && stats.count > 0) {
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:400;background:var(--red);color:#fff;padding:14px 24px;border-radius:14px;box-shadow:var(--shadow-lg);font-size:13px;font-weight:600;display:flex;gap:12px;align-items:center;max-width:90vw;';
            banner.innerHTML = `<span>⚠️ 检测到本地数据为空，但有 ${stats.count} 份历史备份（最新：${new Date(stats.latest).toLocaleString('zh-CN')}）</span>` +
                `<button class="btn btn-sm" style="background:#fff;color:var(--red);" onclick="showRestorePanel()">📦 恢复数据</button>` +
                `<button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;" onclick="this.parentElement.remove()">忽略</button>`;
            document.body.appendChild(banner);
        }
    }).catch(() => {});
}

// 【第2步】孤儿备份恢复面板：跳转到设置页并展开快照列表
function showRestorePanel() {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-page="settings"]').classList.add('active');
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.getElementById('page-settings').classList.add('active');
    loadSettings();
    renderSnapshotList();
    setTimeout(() => {
        const card = document.getElementById('backup-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// 全局事件绑定
document.getElementById('task-modal').addEventListener('click', function(e) { if (e.target === this)
        closeTaskModal(); });
document.getElementById('ai-modal').addEventListener('click', function(e) { if (e.target === this)
    document.getElementById('ai-modal').style.display = 'none'; });
document.getElementById('exercise-modal').addEventListener('click', function(e) { if (e.target === this)
        closeExerciseModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeTaskModal();
        document.getElementById('ai-modal').style.display = 'none'; closeExerciseModal(); } });

// Analytics period toggle
document.querySelectorAll('.analytics-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        analyticsPeriod = btn.dataset.period;
        if (document.getElementById('page-analytics').classList.contains('active')) renderAnalytics();
    });
});

init();
console.log('🎯 Flow v4 (拆分版) — 就绪');
