/* ═══ nav.js — 侧边栏导航/页面切换 ═══
   来源：原 学习计划助手.html 第 795-809 行（匿名监听）。无逻辑改动。 */

// ═══════════ NAVIGATION ═══════════
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const p = btn.dataset.page;
        document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
        document.getElementById('page-' + p).classList.add('active');
        if (p === 'planner') renderPlanner();
        if (p === 'today') renderToday();
        if (p === 'exam') renderExam();
        if (p === 'analytics') { applyChartOrder(); setupChartDrag(); renderAnalytics(); }
        if (p === 'countdown') renderCountdown();
        if (p === 'settings') loadSettings();
        if (p === 'wrongbook') renderWrongBook();
    });
});
