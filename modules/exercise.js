/* ═══ exercise.js — 行测做题记录 & 错题本 ═══
   来源：原 学习计划助手.html 第 2022-2268 行。无逻辑改动。 */

// ═══════════ EXERCISE RECORDS ═══════════
function getExerciseModule(task) {
    if (!task || !task.tags) return null;
    const tags = task.tags.split(/[,，]/).map(s => s.trim());
    for (const t of tags) {
        const found = EXERCISE_MODULES.find(m => m.includes(t) || t.includes(m));
        if (found) return found;
    }
    return null;
}

function openExerciseModal(taskId, taskName) {
    const task = data.tasks.find(t => t.id === taskId);
    const mod = task ? getExerciseModule(task) : null;
    document.getElementById('exercise-modal').style.display = 'flex';
    document.getElementById('exercise-task-name').textContent = taskName;
    document.getElementById('exercise-date').value = today();
    document.getElementById('exercise-total').value = '';
    document.getElementById('exercise-correct').value = '';
    document.getElementById('exercise-time').value = '';
    document.getElementById('exercise-wrong-tags-group').style.display = 'none';
    // Populate module dropdown
    const sel = document.getElementById('exercise-module');
    sel.innerHTML = '<option value="">自动识别</option>' + EXERCISE_MODULES.map(m => `<option value="${m}" ${mod===m?'selected':''}>${m}</option>`).join('');
    if (mod) sel.value = mod;
    // Wrong tags checkboxes
    const tagContainer = document.getElementById('exercise-wrong-tags');
    const tags = data.settings.wrongTags || [];
    tagContainer.innerHTML = tags.map(t => `<label style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;background:var(--fill-subtle);padding:4px 10px;border-radius:12px;"><input type="checkbox" value="${t}" onchange="updateWrongTagsDisplay()"> ${t}</label>`).join('');
    // Listen for correct < total to show wrong tags
    document.getElementById('exercise-total').oninput = updateWrongTagsDisplay;
    document.getElementById('exercise-correct').oninput = updateWrongTagsDisplay;
}

function updateWrongTagsDisplay() {
    const total = parseInt(document.getElementById('exercise-total').value) || 0;
    const correct = parseInt(document.getElementById('exercise-correct').value) || 0;
    document.getElementById('exercise-wrong-tags-group').style.display = (correct < total) ? 'block' : 'none';
}

function closeExerciseModal() { document.getElementById('exercise-modal').style.display = 'none'; }

function saveExerciseRecord() {
    const modSel = document.getElementById('exercise-module').value;
    const taskName = document.getElementById('exercise-task-name').textContent;
    const taskId = data.tasks.find(t => t.name === taskName)?.id;
    let module = modSel;
    if (!module && taskId) { const t = data.tasks.find(x => x.id === taskId); module = t ? getExerciseModule(t) : ''; }
    if (!module) { showToast('请选择模块'); return; }
    const total = parseInt(document.getElementById('exercise-total').value) || 0;
    const correct = parseInt(document.getElementById('exercise-correct').value) || 0;
    const time = parseInt(document.getElementById('exercise-time').value) || 0;
    if (!total || !time) { showToast('请填写题数和用时'); return; }
    const checkedTags = [];
    document.querySelectorAll('#exercise-wrong-tags input:checked').forEach(cb => checkedTags.push(cb.value));
    data.exerciseRecords.push({
        id: crypto.randomUUID(), taskId: taskId || '', module, date: document.getElementById('exercise-date').value || today(),
        totalQuestions: total, correctQuestions: Math.min(correct, total), timeMinutes: time, wrongTags: checkedTags
    });
    saveData();
    closeExerciseModal();
    showToast('✅ 做题记录已保存');
}

function deleteExerciseRecord(id) {
    data.exerciseRecords = data.exerciseRecords.filter(r => r.id !== id);
    saveData();
    renderWrongBook();
    showToast('🗑 已删除');
}

function renderWrongBook() {
    const modFilter = document.getElementById('wb-module-filter').value;
    const tagFilter = document.getElementById('wb-tag-filter').value;
    // Populate module filter
    const modSel = document.getElementById('wb-module-filter');
    const usedMods = [...new Set(data.exerciseRecords.map(r => r.module))];
    modSel.innerHTML = '<option value="">全部模块</option>' + usedMods.map(m => `<option value="${m}" ${m===modFilter?'selected':''}>${m}</option>`).join('');
    // Populate tag filter
    const tagSel = document.getElementById('wb-tag-filter');
    const usedTags = [...new Set(data.exerciseRecords.flatMap(r => r.wrongTags || []))];
    tagSel.innerHTML = '<option value="">全部标签</option>' + usedTags.map(t => `<option value="${t}" ${t===tagFilter?'selected':''}>${t}</option>`).join('');

    let records = data.exerciseRecords;
    if (modFilter) records = records.filter(r => r.module === modFilter);
    if (tagFilter) records = records.filter(r => (r.wrongTags || []).includes(tagFilter));
    records.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    const totalQ = records.reduce((s, r) => s + r.totalQuestions, 0);
    const totalC = records.reduce((s, r) => s + r.correctQuestions, 0);
    const totalT = records.reduce((s, r) => s + r.timeMinutes, 0);
    document.getElementById('wb-summary').textContent = `共 ${records.length} 条记录 · 累计正确率 ${totalQ>0?(totalC/totalQ*100).toFixed(1):0}% · 总用时 ${totalT} 分`;

    if (!records.length) {
        document.getElementById('wb-tbody').innerHTML = '';
        document.getElementById('wb-empty').style.display = 'block';
        return;
    }
    document.getElementById('wb-empty').style.display = 'none';
    document.getElementById('wb-tbody').innerHTML = records.map(r => {
        const acc = r.totalQuestions > 0 ? (r.correctQuestions / r.totalQuestions * 100).toFixed(1) : '0';
        const avgTime = r.totalQuestions > 0 ? (r.timeMinutes / r.totalQuestions).toFixed(2) : '0';
        return `<tr>
            <td style="white-space:nowrap;font-size:11px;">${r.date}</td><td style="font-weight:600;text-align:center;">${r.module}</td>
            <td class="tp-num">${r.totalQuestions}</td><td class="tp-num">${r.correctQuestions}</td>
            <td class="tp-num" style="color:${+acc>=70?'var(--green)':+acc>=50?'var(--orange)':'var(--red)'}">${acc}%</td>
            <td class="tp-num">${r.timeMinutes}</td><td class="tp-num">${avgTime}分/题</td>
            <td>${(r.wrongTags||[]).map(t=>`<span class="tp-tag tp-tag-temp" style="margin:1px;">${t}</span>`).join('')}</td>
            <td><button class="btn btn-ghost btn-sm" style="color:var(--red);padding:2px 8px;" onclick="deleteExerciseRecord('${r.id}')">🗑</button></td>
        </tr>`;
    }).join('');
}

function renderExerciseCharts() {
    const records = data.exerciseRecords;
    const chartText = getCSSVar('--chart-text');
    const chartGrid = getCSSVar('--chart-grid');
    const accent = getCSSVar('--accent');
    const red = getCSSVar('--red');
    const modColors = ['#5db8fe','#c792fc','#f5c842','#5ce694','#ff6b80'];
    const modColorsDark = ['#5db8fe','#c792fc','#f5c842','#5ce694','#ff6b80'];
    const modCols = (document.documentElement.getAttribute('data-theme') === 'dark') ? modColorsDark : ['#0071e3','#af52de','#ff9500','#34c759','#ff2d55'];

    // Aggregate by module
    const modStats = {};
    EXERCISE_MODULES.forEach(m => { modStats[m] = { total: 0, correct: 0, time: 0, questions: 0 }; });
    records.forEach(r => {
        if (modStats[r.module]) {
            modStats[r.module].total += r.totalQuestions;
            modStats[r.module].correct += r.correctQuestions;
            modStats[r.module].time += r.timeMinutes;
            modStats[r.module].questions += r.totalQuestions;
        }
    });
    const mods = EXERCISE_MODULES.filter(m => modStats[m].total > 0);

    // Accuracy horizontal bar chart
    destroyChart('exercise-accuracy');
    if (mods.length) {
        const ctx1 = document.getElementById('chart-exercise-accuracy').getContext('2d');
        charts['exercise-accuracy'] = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: mods,
                datasets: [{
                    label: '正确率 %', data: mods.map(m => modStats[m].total > 0 ? +(modStats[m].correct / modStats[m].total * 100).toFixed(1) : 0),
                    backgroundColor: mods.map((_, i) => modCols[i % modCols.length]), borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y', responsive: true,
                scales: { x: { max: 100, ticks: { color: chartText }, grid: { color: chartGrid } }, y: { ticks: { color: chartText } } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `正确率: ${ctx.raw}%` } } }
            }
        });
    }

    // Speed chart with reference lines
    destroyChart('exercise-speed');
    if (mods.length) {
        const ctx2 = document.getElementById('chart-exercise-speed').getContext('2d');
        const refTimes = data.settings.exerciseRefTimes || {};
        const refPlugin = {
            id: 'refLines',
            afterDraw(chart) {
                const ctx = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;
                const meta = chart.getDatasetMeta(0);
                ctx.save();
                mods.forEach((m, i) => {
                    const ref = refTimes[m];
                    if (!ref || !meta.data[i]) return;
                    const x = xAxis.getPixelForValue(ref);
                    const bar = meta.data[i];
                    const yMid = (bar.y + bar.base) / 2;
                    ctx.setLineDash([4, 3]);
                    ctx.strokeStyle = getCSSVar('--red');
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, yMid - 8);
                    ctx.lineTo(x, yMid + 8);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = getCSSVar('--red');
                    ctx.font = 'bold 10px -apple-system, sans-serif';
                    ctx.fillText(ref + '′', x + 4, yMid + 4);
                });
                ctx.restore();
            }
        };
        charts['exercise-speed'] = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: mods,
                datasets: [{
                    label: '平均单题耗时(分)', data: mods.map(m => modStats[m].questions > 0 ? +(modStats[m].time / modStats[m].questions).toFixed(2) : 0),
                    backgroundColor: mods.map((_, i) => modCols[i % modCols.length]), borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y', responsive: true,
                scales: { x: { ticks: { color: chartText }, grid: { color: chartGrid } }, y: { ticks: { color: chartText } } },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `平均: ${ctx.raw}分/题` } }
                }
            },
            plugins: [refPlugin]
        });
    }

    // Trend line chart by module
    destroyChart('exercise-trend');
    const dateMap = {};
    records.forEach(r => {
        if (!dateMap[r.date]) dateMap[r.date] = {};
        if (!dateMap[r.date][r.module]) dateMap[r.date][r.module] = { total: 0, correct: 0 };
        dateMap[r.date][r.module].total += r.totalQuestions;
        dateMap[r.date][r.module].correct += r.correctQuestions;
    });
    const dates = Object.keys(dateMap).sort();
    if (dates.length > 0 && mods.length > 0) {
        const ctx3 = document.getElementById('chart-exercise-trend').getContext('2d');
        const datasets = mods.map((m, i) => ({
            label: m,
            data: dates.map(d => {
                const st = dateMap[d][m];
                return st && st.total > 0 ? +(st.correct / st.total * 100).toFixed(1) : null;
            }),
            borderColor: modCols[i % modCols.length], backgroundColor: modCols[i % modCols.length] + '30',
            tension: 0.3, pointRadius: 4, spanGaps: false, borderWidth: 2
        }));
        charts['exercise-trend'] = new Chart(ctx3, {
            type: 'line',
            data: { labels: dates, datasets },
            options: {
                responsive: true,
                scales: { x: { ticks: { color: chartText } }, y: { max: 100, ticks: { color: chartText, callback: v => v + '%' }, grid: { color: chartGrid } } },
                plugins: {
                    legend: { labels: { color: chartText, usePointStyle: true, padding: 12 }, position: 'bottom' },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw !== null ? ctx.raw + '%' : '无数据'}` } }
                }
            }
        });
    }
}
