/* ═══ today.js — 今日任务渲染 ═══
   来源：原 学习计划助手.html 第 1095-1169 行。无逻辑改动。 */

// ═══════════ TODAY PAGE ═══════════
function renderToday() {
    const td = today();
    const todayMins = getTodayPomoMinutes();
    // Show ALL active tasks — regardless of date range.
    // This ensures new tasks, future-start tasks, and overdue tasks are all visible.
    const activeTasks = data.tasks.filter(t => t.status === 'active' && t.type !== 'rest');
    const completedToday = data.tasks.filter(t => t.status === 'done' && t.completedDate === td);

    // Deduplicate
    const seen = new Set();
    const allTodayUnsorted = [];
    for (const t of activeTasks) { if (!seen.has(t.id)) { seen.add(t.id); allTodayUnsorted.push(t); } }
    for (const t of completedToday) { if (!seen.has(t.id)) { seen.add(t.id); allTodayUnsorted.push(t); } }

    // Sort: overdue → today's → upcoming → completed
    const allToday = allTodayUnsorted.sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        // Among active: 0=overdue, 1=today's, 2=upcoming
        const aCat = a.end && a.end < td ? 0 : (a.start && a.start > td ? 2 : 1);
        const bCat = b.end && b.end < td ? 0 : (b.start && b.start > td ? 2 : 1);
        if (aCat !== bCat) return aCat - bCat;
        // Within same category, show behind-schedule first
        return calcKPI(a).gap - calcKPI(b).gap;
    });
    if (!allToday.length) {
        document.getElementById('today-task-list').innerHTML =
            '<div style="text-align:center;padding:48px;color:var(--text2);">✨ 没有进行中的任务</div>';
        return;
    }
    // Lock daily targets at start of day — refresh if task params changed
    if (!data.dailyDone[td]) data.dailyDone[td] = { targets: {} };
    if (!data.dailyDone[td].targets) data.dailyDone[td].targets = {};
    if (!data.dailyDone[td]._params) data.dailyDone[td]._params = {};
    allToday.forEach(t => {
        const fp = `${t.end || ''}|${t.total || 0}`;
        const oldFp = data.dailyDone[td]._params[t.id];
        if (!data.dailyDone[td].targets[t.id] || oldFp !== fp) {
            data.dailyDone[td].targets[t.id] = +calcKPI(t).daily.toFixed(1);
            data.dailyDone[td]._params[t.id] = fp;
        }
    });
    saveData();

    document.getElementById('today-task-list').innerHTML = allToday.map(t => {
        const k = calcKPI(t);
        const pct = Math.min(100, Math.round(k.actual * 100));
        const isDone = t.status === 'done';
        const todayDone = +(data.dailyDone[td] && data.dailyDone[td][t.id] || 0).toFixed(1);
        const dailyTarget = data.dailyDone[td].targets[t.id] || +k.daily.toFixed(1);
        const exceeded = !isDone && todayDone > 0 && todayDone >= dailyTarget && dailyTarget > 0;
        const cardStyle = isDone ? 'opacity:0.6;' : (exceeded ? 'box-shadow:var(--badge-exceeded-shadow);opacity:0.55;' : '');
        const isOverdue = t.end && t.end < td && t.status === 'active';
        const isUpcoming = t.start && t.start > td && t.status === 'active';
        const btnDisabled = isDone || exceeded;
        const hasExercise = getExerciseModule(t);
        return `<div class="today-task-card" style="${cardStyle}" onclick="${btnDisabled ? '' : `quickEdit('${t.id}')`}">
      <div class="tt-color" style="background:${getDisplayColor(t.color)}"></div>
      <div class="tt-info">
        <div class="tt-name">${btnDisabled ? '' : `<button class="btn btn-primary btn-sm" style="margin-right:6px;padding:4px 10px;font-size:12px;" onclick="event.stopPropagation();startPomo('${t.id}','${t.name.replace(/'/g,"\\\\'")}')">🍅</button>`}${hasExercise ? `<button class="btn btn-ghost btn-sm" style="margin-right:6px;padding:4px 8px;font-size:11px;" onclick="event.stopPropagation();openExerciseModal('${t.id}','${t.name.replace(/'/g,"\\\\'")}')" title="录入做题记录">📝</button>` : ''}${t.name}${isDone ? ' <span style="font-size:11px;color:var(--green);">✓</span>' : ''}${exceeded ? ' <span style="font-size:11px;color:var(--orange);">🔥</span>' : ''}${isOverdue ? ' <span style="font-size:11px;color:var(--red);">⚠ 已逾期</span>' : ''}${isUpcoming ? ' <span style="font-size:11px;color:var(--accent);">📅 即将开始</span>' : ''}</div>
        <div class="tt-meta">已完成 ${t.done}/${t.total} · 进度 ${pct}% · 🍅 ${formatTime(getPomoMinutes(t.id))}</div>
        ${!isDone ? `<div style="height:5px;background:var(--fill-strong);border-radius:3px;margin-top:6px;overflow:hidden;"><div style="height:100%;width:${Math.min(100,Math.round(todayDone/Math.max(1,dailyTarget)*100))}%;background:${todayDone>=dailyTarget?'var(--progress-bar-ok)':todayDone>=dailyTarget*0.5?'var(--progress-bar-warn)':'var(--progress-bar-behind)'};border-radius:3px;transition:width 0.5s;"></div></div>` : ''}
      </div>
      <div class="tt-target">
        ${isDone
            ? '<div class="tt-target-num" style="color:var(--green);">✓</div><div class="tt-target-label">已完成</div>'
            : `<div style="display:flex;gap:12px;align-items:center;">
                <div style="text-align:center;"><div class="tt-target-num" style="color:var(--accent);">${todayDone}</div><div class="tt-target-label" style="font-size:9px;">今日已做</div></div>
                <div style="color:var(--text3);font-size:16px;">/</div>
                <div style="text-align:center;"><div class="tt-target-num">${dailyTarget}</div><div class="tt-target-label" style="font-size:9px;">今日至少</div></div>
               </div>`}
      </div>
    </div>`;
    }).join('');
}
