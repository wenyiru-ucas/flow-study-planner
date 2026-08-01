/* ═══ utils.js — 工具函数 & KPI 计算 ═══
   来源：原 学习计划助手.html 第 745-792 行。

   【测试改动】today() 加入可选的全局时间注入点 _now，便于单元测试冻结时间。
   生产环境下 _now 为 undefined，行为与原版完全一致（读真实 new Date()）。 */

function today() {
    const d = typeof _now !== 'undefined' && _now ? new Date(_now) : new Date();
    if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime(minutes) {
    const m = Math.round(minutes || 0);
    const h = Math.floor(m / 60);
    const r = m % 60;
    return h > 0 ? `${h}时${r > 0 ? r + '分' : ''}` : `${m}分`;
}

function daysBetween(a, b) { return Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000) + 1); }

function calcKPI(t) {
    const td = today();
    if (!t.start || !t.end || !t.total) return { sched: 0, actual: 0, gap: 0, daily: 0, catchUp: 0, totalDays: 1,
        elapsed: 0, remainDays: 1 };
    const totalD = daysBetween(t.start, t.end);
    const elapsed = td < t.start ? 0 : Math.min(daysBetween(t.start, td), totalD);
    const sched = elapsed / totalD;
    const actual = t.done / t.total;
    const gap = actual - sched;
    const remainD = Math.max(1, daysBetween(td, t.end));
    const daily = t.total > t.done ? (t.total - t.done) / remainD : 0;
    const catchUp = gap < 0 ? Math.abs(gap) * t.total : 0;
    return { sched, actual, gap, daily, catchUp, totalDays: totalD, elapsed, remainDays: remainD };
}

function calcStreak() {
    let s = 0;
    const td = new Date();
    for (let i = 0; i < 365; i++) {
        const d = new Date(td);
        d.setDate(d.getDate() - i);
        if (data.checkins[d.toISOString().slice(0, 10)]) s++;
        else break;
    }
    return s;
}

function getPomoMinutes(taskId) { return data.pomodoroSessions.filter(s => s.taskId === taskId).reduce((sum, s) => sum +
        s.minutes, 0); }

function getTodayPomoMinutes() {
    return data.pomodoroSessions.filter(s => s.date === today()).reduce((sum, s) => sum + s.minutes, 0);
}

// 【第3步】单位耗时：纯派生量，从 pomodoroSessions 的 doneDelta 聚合
function getUnitCost(taskId) {
    // 优先从 sessions 中 doneDelta>0 的记录派生
    const taskSessions = data.pomodoroSessions.filter(s => s.taskId === taskId && (s.doneDelta || 0) > 0);
    const totalMin = taskSessions.reduce((sum, s) => sum + (s.minutes || 0), 0);
    const totalDone = taskSessions.reduce((sum, s) => sum + (s.doneDelta || 0), 0);
    if (totalDone > 0) return Math.round(totalMin / totalDone);
    // 兜底：无 doneDelta 的历史数据，回退到旧累加字段
    const task = data.tasks.find(t => t.id === taskId);
    if (task && (task.pomoUnits || 0) > 0) {
        return Math.round((task.pomoProductive || 0) / task.pomoUnits);
    }
    return null;  // 显示 '—'
}
