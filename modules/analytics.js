/* ═══ analytics.js — 数据分析（图表） ═══
   来源：原 学习计划助手.html 第 1589-1722 行。

   改动：
   - 各科学习时长统计全部任务（含已完成），环形图内嵌名称+时长标签，去除图例
   - 删除 30 天打卡记录 */

// ═══════════ ANALYTICS ═══════════
function destroyChart(k) { if (charts[k]) { charts[k].destroy();
        charts[k] = null; } }

// ── 环形图内嵌标签插件 ──
const doughnutLabelPlugin = {
    id: 'doughnutLabels',
    afterDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;
        const dataset = chart.data.datasets[0];
        const labels = chart.data.labels;
        const total = dataset.data.reduce((s, v) => s + (v || 0), 0);
        if (total === 0) return;
        meta.data.forEach((arc, i) => {
            const value = dataset.data[i];
            if (!value) return;
            const angle = (arc.startAngle + arc.endAngle) / 2;
            const outerR = (arc.outerRadius + arc.innerRadius) / 2;
            // 短弧往更外侧偏移
            const arcLen = Math.abs(arc.endAngle - arc.startAngle);
            const r = arcLen < 0.3 ? arc.outerRadius + 16 : outerR;
            const x = arc.x + Math.cos(angle) * r;
            const y = arc.y + Math.sin(angle) * r;
            ctx.save();
            ctx.font = '600 11px -apple-system, "PingFang SC", sans-serif';
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const name = (labels[i] || '').length > 6 ? (labels[i] || '').slice(0, 6) + '…' : (labels[i] || '');
            ctx.fillText(name, x, y - 7);
            ctx.font = '10px -apple-system, "PingFang SC", sans-serif';
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
            ctx.fillText(formatTime(value), x, y + 8);
            ctx.restore();
        });
    }
};

function renderAnalytics() {
    // 统计全部任务（含已完成/暂停），只要有过番茄钟记录就出现
    const all = data.tasks.filter(t => getPomoMinutes(t.id) > 0);
    const chartText = getCSSVar('--chart-text');
    const chartGrid = getCSSVar('--chart-grid');
    const chartBorder = getCSSVar('--chart-border');
    const chartFillSched = getCSSVar('--chart-fill-sched');
    const accent = getCSSVar('--accent');
    const tagColors = (document.documentElement.getAttribute('data-theme') === 'dark')
        ? ['#5db8fe','#c792fc','#f5c842','#5ce694','#ff6b80','#6ecdfa']
        : ['#0071e3','#af52de','#ff9500','#34c759','#ff2d55','#5ac8fa'];

    destroyChart('subject');
    const subjectData = all.map(t => Math.max(0, getPomoMinutes(t.id)));
    const hasSubjectData = subjectData.reduce((s, v) => s + v, 0) > 0;
    charts.subject = new Chart(document.getElementById('chart-subject').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: all.map(t => t.name),
            datasets: [{
                data: subjectData,
                backgroundColor: all.map(t => t.color),
                borderColor: chartBorder,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatTime(ctx.raw)}` } }
            }
        },
        plugins: hasSubjectData ? [doughnutLabelPlugin] : []
    });

    // Update period buttons
    document.querySelectorAll('.analytics-period-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.period === analyticsPeriod);
    });

    destroyChart('trend');
    const days = [];
    const mins = [];
    let trendDays;
    if (analyticsPeriod === 'week') trendDays = 7;
    else if (analyticsPeriod === 'month') trendDays = 30;
    else trendDays = 365;
    for (let i = trendDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = analyticsPeriod === 'year'
            ? d.toLocaleDateString('zh-CN', { month: 'short' })
            : d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        days.push(label);
        mins.push(data.checkins[key] ? data.checkins[key].minutes || 0 : 0);
    }
    const periodLabel = analyticsPeriod === 'week' ? '近7天' : analyticsPeriod === 'month' ? '本月' : '本年';
    document.querySelector('#chart-trend').parentElement.querySelector('h3').textContent = `${periodLabel}学习趋势`;
    charts.trend = new Chart(document.getElementById('chart-trend').getContext('2d'), {
        type: 'bar',
        data: { labels: days, datasets: [{ data: mins, backgroundColor: accent, borderRadius: 8,
                barThickness: 28 }] },
        options: {
            responsive: true,
            scales: { x: { ticks: { color: chartText }, grid: { display: false } }, y: { ticks: { color: chartText },
                    grid: { color: chartGrid }, beginAtZero: true } },
            plugins: { legend: { display: false },
                tooltip: { callbacks: { label: ctx => `${formatTime(ctx.raw)}` } } }
        }
    });

    destroyChart('progress');
    const progressTasks = data.tasks.filter(t => t.type !== 'rest');
    const pd = progressTasks.map(t => ({ n: t.name.substring(0, 10), s: Math.round(calcKPI(t).sched * 100),
        a: Math.round(calcKPI(t).actual * 100) }));
    charts.progress = new Chart(document.getElementById('chart-progress').getContext('2d'), {
        type: 'bar',
        data: {
            labels: pd.map(d => d.n),
            datasets: [
                { label: '序时%', data: pd.map(d => d.s), backgroundColor: chartFillSched,
                    borderRadius: 6, barThickness: 16 },
                { label: '实际%', data: pd.map(d => d.a), backgroundColor: accent, borderRadius: 6,
                    barThickness: 16 }
            ]
        },
        options: {
            responsive: true,
            scales: { x: { ticks: { color: chartText }, grid: { display: false } }, y: { ticks: { color: chartText },
                    grid: { color: chartGrid }, max: 100 } },
            plugins: { legend: { labels: { color: chartText, font: { size: 11 }, usePointStyle: true,
                    padding: 16 }, position: 'bottom' } }
        }
    });

    // Tag distribution
    destroyChart('tags');
    const tagMap = {};
    data.tasks.filter(t => t.type !== 'rest').forEach(t => {
        const tags = (t.tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
        if (tags.length === 0) tags.push('未分类');
        const mins = getPomoMinutes(t.id);
        tags.forEach(tag => { tagMap[tag] = (tagMap[tag] || 0) + mins; });
    });
    charts.tags = new Chart(document.getElementById('chart-tags').getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(tagMap),
            datasets: [{ data: Object.values(tagMap), backgroundColor: tagColors, borderRadius: 6, barThickness: 24 }]
        },
        options: {
            responsive: true,
            scales: { x: { ticks: { color: chartText }, grid: { display: false } }, y: { ticks: { color: chartText, callback: v => formatTime(v) }, grid: { color: chartGrid }, beginAtZero: true } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatTime(ctx.raw) } } }
        }
    });
    renderExerciseCharts();
}


