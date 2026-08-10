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
    renderPracticeCharts();
}

// ═══════════ 练习趋势（按「类别」聚合，每次练习一个点，hover 显示名称） ═══════════
function renderPracticeCharts() {
    const chartText = getCSSVar('--chart-text');
    const chartGrid = getCSSVar('--chart-grid');
    const range = getPeriodRange();

    // 按「类别」聚合：category（未归类→任务名兜底）→ 每次记录一个点
    const series = {};   // category -> { name, color, points: [{date, createdAt, rate, speed, item}] }
    const pal = getPalette();
    let catIdx = 0;
    data.tasks.forEach(t => {
        const logs = (t.stopwatchLogs || []).filter(l => l.questions > 0 && l.date >= range.start && l.date <= range.end);
        if (!logs.length) return;
        logs.forEach(l => {
            const cat = l.category || t.name;   // 未归类记录按任务名兜底（数据不丢）
            if (!series[cat]) {
                series[cat] = {
                    name: cat,
                    color: getDisplayColor(t.color) || pal[catIdx % pal.length],
                    points: [],
                };
                catIdx += 1;
            }
            series[cat].points.push({
                date: l.date,
                createdAt: l.createdAt || Date.parse(l.date),
                rate: Math.round(l.correct / l.questions * 100),
                speed: l.totalMs / 1000 / l.questions,   // 秒/题
                item: l.item || '',                       // 名称（题本）
            });
        });
    });

    const ids = Object.keys(series);
    if (!ids.length) {
        destroyChart('practice-accuracy');
        destroyChart('practice-speed');
        return;
    }
    // X 轴 = 全局按时间排序的每次记录（同日期多次重复显示）
    const allPoints = ids.flatMap(id => series[id].points.map(p => ({ cat: id, ...p })));
    allPoints.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const labels = allPoints.map(p => p.date);

    // 正确率趋势
    destroyChart('practice-accuracy');
    const accDatasets = ids.map(id => ({
        label: series[id].name,
        data: allPoints.map(p => p.cat === id ? p.rate : null),
        borderColor: series[id].color,
        backgroundColor: series[id].color + '30',
        tension: 0.3, pointRadius: 4, spanGaps: false, borderWidth: 2,
    }));
    charts['practice-accuracy'] = new Chart(document.getElementById('chart-practice-accuracy').getContext('2d'), {
        type: 'line',
        data: { labels, datasets: accDatasets },
        options: {
            responsive: true,
            scales: { x: { ticks: { color: chartText, maxRotation: 45, minRotation: 0, autoSkip: true } }, y: { max: 100, ticks: { color: chartText, callback: v => v + '%' }, grid: { color: chartGrid } } },
            plugins: {
                legend: { labels: { color: chartText, usePointStyle: true, padding: 12 }, position: 'bottom' },
                tooltip: { callbacks: { label: ctx => {
                    const pt = allPoints[ctx.dataIndex];
                    const nm = pt && pt.item ? ` · ${pt.item}` : '';
                    return `${ctx.dataset.label}${nm}: ${ctx.raw !== null ? ctx.raw + '%' : '无数据'}`;
                } } }
            }
        }
    });

    // 单题耗时趋势（秒/题，格式 X分X秒）
    destroyChart('practice-speed');
    const speedDatasets = ids.map(id => ({
        label: series[id].name,
        data: allPoints.map(p => p.cat === id ? p.speed : null),
        borderColor: series[id].color,
        backgroundColor: series[id].color + '30',
        tension: 0.3, pointRadius: 4, spanGaps: false, borderWidth: 2,
    }));
    charts['practice-speed'] = new Chart(document.getElementById('chart-practice-speed').getContext('2d'), {
        type: 'line',
        data: { labels, datasets: speedDatasets },
        options: {
            responsive: true,
            scales: { x: { ticks: { color: chartText, maxRotation: 45, minRotation: 0, autoSkip: true } }, y: { ticks: { color: chartText, callback: v => formatMinSec(v) }, grid: { color: chartGrid }, beginAtZero: true } },
            plugins: {
                legend: { labels: { color: chartText, usePointStyle: true, padding: 12 }, position: 'bottom' },
                tooltip: { callbacks: { label: ctx => {
                    const pt = allPoints[ctx.dataIndex];
                    const nm = pt && pt.item ? ` · ${pt.item}` : '';
                    return `${ctx.dataset.label}${nm}: ${ctx.raw !== null ? formatMinSec(ctx.raw) + '/题' : '无数据'}`;
                } } }
            }
        }
    });
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

// ═══════════ 图表卡片拖拽排序 ═══════════
const CHART_ORDER_KEY = 'flow_chart_order';

// 进入数据分析页时应用保存的排序
function applyChartOrder() {
    let ids = null;
    try { ids = JSON.parse(localStorage.getItem(CHART_ORDER_KEY)); } catch (e) {}
    if (!Array.isArray(ids) || !ids.length) return;
    const grid = document.querySelector('.chart-grid');
    if (!grid) return;
    ids.forEach(id => {
        const card = grid.querySelector(`.chart-card[data-chart-id="${id}"]`);
        if (card) grid.appendChild(card);
    });
}

function saveChartOrder() {
    const cards = document.querySelectorAll('.chart-grid .chart-card');
    localStorage.setItem(CHART_ORDER_KEY, JSON.stringify([...cards].map(c => c.dataset.chartId)));
}

function setupChartDrag() {
    const grid = document.querySelector('.chart-grid');
    if (!grid) return;
    if (grid.dataset.dragInit) return;   // 已初始化（避免切换页面重复绑定监听）
    grid.dataset.dragInit = '1';
    // 标记每张卡片的 chart-id（HTML 已静态标记，此处兜底）
    const canvases = ['chart-subject', 'chart-tags', 'chart-trend', 'chart-progress',
        'chart-exercise-accuracy', 'chart-exercise-speed', 'chart-exercise-trend',
        'chart-practice-accuracy', 'chart-practice-speed'];
    canvases.forEach(id => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const card = canvas.closest('.chart-card');
        if (card && !card.dataset.chartId) card.dataset.chartId = id;
    });

    let dragCard = null;
    grid.addEventListener('mousedown', e => {
        const card = e.target.closest('.chart-card');
        if (!card) return;
        // 只在标题区域（顶部 28px）触发拖拽
        const rect = card.getBoundingClientRect();
        if (e.clientY - rect.top > 28) return;
        dragCard = card;
        card.style.opacity = '0.4';
        card.style.cursor = 'grabbing';
        e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
        if (!dragCard) return;
        const cards = [...grid.children];
        let after = null;
        for (const c of cards) {
            if (c === dragCard) continue;
            const mid = c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2;
            if (e.clientY < mid) { after = c; break; }
        }
        if (after && after !== dragCard) {
            grid.insertBefore(dragCard, after);
        } else if (!after && cards[cards.length - 1] !== dragCard) {
            grid.appendChild(dragCard);
        }
    });
    document.addEventListener('mouseup', () => {
        if (!dragCard) return;
        dragCard.style.opacity = '';
        dragCard.style.cursor = '';
        saveChartOrder();
        dragCard = null;
    });
}


