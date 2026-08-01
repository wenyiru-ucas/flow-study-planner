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

// 统计周期起止（日期字符串 YYYY-MM-DD）：week=近7天 / month=近30天 / year=近365天
function getPeriodRange() {
    const end = today();
    const d = new Date();
    const days = analyticsPeriod === 'week' ? 6 : analyticsPeriod === 'month' ? 29 : 364;
    d.setDate(d.getDate() - days);
    return { start: d.toISOString().slice(0, 10), end };
}

// 周期内某任务的番茄钟分钟数
function getPomoMinutesInRange(taskId, start, end) {
    return (data.pomodoroSessions || [])
        .filter(s => s.taskId === taskId && s.date >= start && s.date <= end)
        .reduce((sum, s) => sum + (s.minutes || 0), 0);
}

function renderAnalytics() {
    // 图表表头标注当前统计周期（本周/本月/本年）
    updateChartPeriodLabels();
    // 当前统计周期范围
    const range = getPeriodRange();
    // 统计周期内有番茄钟记录的任务
    const all = data.tasks.filter(t => getPomoMinutesInRange(t.id, range.start, range.end) > 0);
    const chartText = getCSSVar('--chart-text');
    const chartGrid = getCSSVar('--chart-grid');
    const chartBorder = getCSSVar('--chart-border');
    const chartFillSched = getCSSVar('--chart-fill-sched');
    const accent = getCSSVar('--accent');

    destroyChart('subject');
    const subjectData = all.map(t => Math.max(0, getPomoMinutesInRange(t.id, range.start, range.end)));
    const hasSubjectData = subjectData.reduce((s, v) => s + v, 0) > 0;
    charts.subject = new Chart(document.getElementById('chart-subject').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: all.map(t => t.name),
            datasets: [{
                data: subjectData,
                backgroundColor: all.map(t => getDisplayColor(t.color)),
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

    // Tag distribution（按统计周期过滤）
    destroyChart('tags');
    const tagMap = {};
    data.tasks.filter(t => t.type !== 'rest').forEach(t => {
        const tags = (t.tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
        if (tags.length === 0) tags.push('未分类');
        const mins = getPomoMinutesInRange(t.id, range.start, range.end);
        tags.forEach(tag => { tagMap[tag] = (tagMap[tag] || 0) + mins; });
    });
    charts.tags = new Chart(document.getElementById('chart-tags').getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(tagMap),
            datasets: [{
                data: Object.values(tagMap),
                backgroundColor: Object.keys(tagMap).map(tag => getDisplayColor(getTagColor(tag))),
                borderRadius: 6,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            scales: { x: { ticks: { color: chartText }, grid: { display: false } }, y: { ticks: { color: chartText, callback: v => formatTime(v) }, grid: { color: chartGrid }, beginAtZero: true } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => formatTime(ctx.raw) } } }
        }
    });
    renderExerciseCharts();
}

// 给所有图表卡片标题追加统计周期标注（本周/本月/本年）
function updateChartPeriodLabels() {
    const label = analyticsPeriod === 'week' ? '本周' : analyticsPeriod === 'month' ? '本月' : '本年';
    document.querySelectorAll('.chart-card h3').forEach(h3 => {
        if (!h3.dataset.base) {
            h3.dataset.base = h3.textContent.replace(/\s*[（(](本周|本月|本年|近7天)[）)]\s*$/, '').trim();
        }
        h3.textContent = `${h3.dataset.base}（${label}）`;
    });
}


