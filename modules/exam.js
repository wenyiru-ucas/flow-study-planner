/* ═══ exam.js — 考场模拟 ═══
   功能：
   1. 全真模拟考场电子钟：自定义开考时间 + 考试时长，12/24 小时制。
      开始 / 暂停 / 继续 / 结束 / 重置；暂停时模块计时联动暂停；
      到时屏幕红色闪烁提醒 + 系统通知。
   2. 模块计时秒表：预设行测六大模块按钮，同模块多次计时自动合并。
   3. 每次模考结束自动保存分模块用时到 data.examRecords，可回顾。 */

// ═══════════ EXAM ROOM ═══════════

const examModules = ['政治理论', '常识判断', '言语理解', '数量关系', '判断推理', '资料分析'];

const examState = {
    running: false,
    paused: false,
    ended: false,       // 是否已到点提醒
    startReal: 0,       // 本段运行起点 (Date.now)
    pausedSec: 0,       // 已累计的走表秒数（暂停冻结）
    simBaseSec: 0,      // 设定开考时间 = 当天 00:00 起的秒数
    durationSec: 0,     // 考试总时长（秒）；0 表示不限时
    interval: null,
    hour12: false,      // 12 小时制
};

// ── 电子钟 ──
function toggleExam() {
    if (!examState.running) startExam();
    else stopExam();
}

function startExam() {
    examState.hour12 = document.getElementById('exam-hour-format').value === '12';
    const timeVal = document.getElementById('exam-start-time').value;
    if (!timeVal) { showToast('⚠️ 请先设置开考时间'); return; }
    const [h, m] = timeVal.split(':').map(Number);
    examState.simBaseSec = h * 3600 + m * 60;

    const durH = parseInt(document.getElementById('exam-dur-h').value) || 0;
    const durM = parseInt(document.getElementById('exam-dur-m').value) || 0;
    examState.durationSec = durH * 3600 + durM * 60;
    if (examState.durationSec <= 0) { showToast('⚠️ 请设置考试时长'); return; }

    examState.running = true;
    examState.paused = false;
    examState.ended = false;
    examState.pausedSec = 0;
    examState.startReal = Date.now();
    document.getElementById('exam-run-btn').textContent = '⏹ 结束';
    document.getElementById('exam-pause-btn').textContent = '⏸ 暂停';
    document.getElementById('exam-pause-btn').disabled = false;
    document.getElementById('exam-clock').classList.remove('exam-timeout');
    document.getElementById('exam-timeup-banner').style.display = 'none';
    if (examState.interval) clearInterval(examState.interval);
    examState.interval = setInterval(tickExam, 1000);
    tickExam();
    try { localStorage.setItem('flow_exam_setup', JSON.stringify({ format: examState.hour12 ? '12' : '24', time: timeVal, durH, durM })); } catch (e) {}
    showToast('🏫 考场模拟开始');
}

function stopExam(silent = false) {
    examState.running = false;
    examState.paused = false;
    if (examState.interval) { clearInterval(examState.interval); examState.interval = null; }
    document.getElementById('exam-run-btn').textContent = '▶ 开始';
    document.getElementById('exam-pause-btn').textContent = '⏸ 暂停';
    document.getElementById('exam-pause-btn').disabled = true;
    // 结束考试：结算最后一阶段用时 → 停止模块计时
    if (examSw.running) {
        examSwLap();          // 当前阶段计入对应模块
        examSwPause();        // 停止计时
        examSw.autoPaused = false;
    }
    // 自动保存本次分模块数据（有记录且未保存过）
    if (!examSw.saved && examSw.laps.length) saveExamRecord();
    if (!silent) showToast('⏹ 已结束');
}

function pauseExam() {
    if (!examState.running || examState.paused) return;
    examState.paused = true;
    examState.pausedSec += Math.floor((Date.now() - examState.startReal) / 1000);
    clearInterval(examState.interval);
    examState.interval = null;
    document.getElementById('exam-pause-btn').textContent = '▶ 继续';
    // 联动：模块计时一起暂停
    if (examSw.running && !examSw.autoPaused) {
        examSwPause();
        examSw.autoPaused = true;
    }
}

function resumeExam() {
    if (!examState.running || !examState.paused) return;
    examState.paused = false;
    examState.startReal = Date.now();
    examState.interval = setInterval(tickExam, 1000);
    document.getElementById('exam-pause-btn').textContent = '⏸ 暂停';
    // 联动：恢复模块计时
    if (examSw.autoPaused) {
        examSwResume();
        examSw.autoPaused = false;
    }
    tickExam();
}

function toggleExamPause() {
    if (!examState.running) return;
    if (examState.paused) resumeExam();
    else pauseExam();
}

function resetExam() {
    stopExam(true);
    examState.pausedSec = 0;
    examState.simBaseSec = 0;
    examState.durationSec = 0;
    document.getElementById('exam-clock').textContent = '--:--:--';
    document.getElementById('exam-clock').classList.remove('exam-timeout');
    document.getElementById('exam-timeup-banner').style.display = 'none';
}

function tickExam() {
    if (!examState.running) return;
    const elapsedSec = examState.pausedSec + (examState.paused ? 0 : Math.floor((Date.now() - examState.startReal) / 1000));
    const simSec = examState.simBaseSec + elapsedSec;
    document.getElementById('exam-clock').textContent = formatExamClock(simSec, examState.hour12);
    // 到点检查
    if (examState.durationSec > 0 && elapsedSec >= examState.durationSec && !examState.ended) {
        examState.ended = true;
        examTimeUp();
    }
}

// 到点：红色闪烁 + 横幅 + 系统通知 + 自动保存 + 结束
function examTimeUp() {
    document.getElementById('exam-clock').classList.add('exam-timeout');
    const banner = document.getElementById('exam-timeup-banner');
    if (banner) banner.style.display = 'block';
    showToast('⏰ 考试时间到！');
    if (window.electronAPI) {
        window.electronAPI.showNotification({ title: '🏫 考场模拟 — 时间到！', body: '本场考试已结束，请停止作答', silent: false });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
            const n = new Notification('🏫 考场模拟 — 时间到！', { body: '本场考试已结束，请停止作答' });
            n.onclick = () => { window.focus(); n.close(); };
        } catch (e) {}
    }
    // 自动保存本次数据 + 结束
    stopExam(true);
}

function formatExamClock(totalSec, hour12) {
    totalSec = ((totalSec % 86400) + 86400) % 86400;
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (hour12) {
        const ampm = h < 12 ? '上午' : '下午';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}`;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── 模块计时秒表（预设模块，点击即分段；同模块自动合并） ──
const examSw = {
    running: false,
    baseMs: 0,          // 已累计时长（暂停冻结）
    runningStart: 0,    // 本次运行起点
    lapBaseMs: 0,       // 当前分段起点（相对总时长的累计值）
    currentName: '',    // 当前分段名称
    laps: [],           // [{ name, ms }] 明细（渲染时按模块聚合）
    interval: null,
    autoPaused: false,  // 是否被考场暂停联动暂停
    saved: false,       // 当前数据是否已保存
};

function examSwTotal() {
    return examSw.baseMs + (examSw.running ? Date.now() - examSw.runningStart : 0);
}

function examSwLapMs() {
    return Math.max(0, examSwTotal() - examSw.lapBaseMs);
}

function examSwTick() {
    if (!examSw.running) return;
    document.getElementById('ex-sw-total').textContent = formatClock(examSwTotal());
    document.getElementById('ex-sw-cur').textContent = formatClock(examSwLapMs());
}

// 点击预设模块：未运行→以该模块开始计时；运行中→分段并切换到该模块
function examSwStartModule(name) {
    if (!examSw.running) {
        examSw.running = true;
        examSw.runningStart = Date.now();
        examSw.lapBaseMs = 0;
        examSw.currentName = name;
        examSw.saved = false;
        examSw.interval = setInterval(examSwTick, 200);
        document.getElementById('ex-sw-run-btn').textContent = '⏸ 暂停';
        document.getElementById('ex-sw-cur-name').textContent = name;
        highlightExamModule(name);
    } else {
        examSwLap();
        examSw.currentName = name;
        document.getElementById('ex-sw-cur-name').textContent = name;
        highlightExamModule(name);
    }
    examSwTick();
}

// 手动暂停/继续
function examSwToggleRun() {
    examSw.autoPaused = false;   // 用户手动接管
    if (!examSw.running) {
        examSw.running = true;
        examSw.runningStart = Date.now();
        if (examSw.laps.length === 0 && examSw.lapBaseMs === 0) {
            examSw.currentName = examSw.currentName || '第1段';
            examSw.lapBaseMs = 0;
        }
        examSw.saved = false;
        examSw.interval = setInterval(examSwTick, 200);
        document.getElementById('ex-sw-run-btn').textContent = '⏸ 暂停';
    } else {
        examSwPause();
    }
    examSwTick();
}

// 暂停模块计时（不区分手动/联动，保持数据）
function examSwPause() {
    if (!examSw.running) return;
    examSw.baseMs = examSwTotal();
    examSw.running = false;
    clearInterval(examSw.interval);
    document.getElementById('ex-sw-run-btn').textContent = '▶ 继续';
    examSwTick();
}

// 恢复模块计时
function examSwResume() {
    if (examSw.running) return;
    examSw.running = true;
    examSw.runningStart = Date.now();
    examSw.interval = setInterval(examSwTick, 200);
    document.getElementById('ex-sw-run-btn').textContent = '⏸ 暂停';
    examSwTick();
}

function examSwLap() {
    if (!examSw.running) return;
    const ms = examSwLapMs();
    examSw.laps.push({ name: examSw.currentName || `第${examSw.laps.length + 1}段`, ms });
    examSw.lapBaseMs = examSwTotal();
    examSw.currentName = '';
    examSw.saved = false;
    examSwRender();
    examSwTick();
}

function examSwReset() {
    examSw.running = false;
    clearInterval(examSw.interval);
    examSw.baseMs = 0;
    examSw.runningStart = 0;
    examSw.lapBaseMs = 0;
    examSw.currentName = '';
    examSw.laps = [];
    examSw.autoPaused = false;
    examSw.saved = false;
    document.getElementById('ex-sw-run-btn').textContent = '▶ 开始';
    document.getElementById('ex-sw-total').textContent = '0分0秒';
    document.getElementById('ex-sw-cur').textContent = '0分0秒';
    document.getElementById('ex-sw-cur-name').textContent = '—';
    examSwRender();
    clearExamModuleHighlight();
}

function highlightExamModule(name) {
    document.querySelectorAll('.ex-sw-module').forEach(b => {
        b.classList.toggle('active', b.dataset.mod === name);
    });
}

function clearExamModuleHighlight() {
    document.querySelectorAll('.ex-sw-module').forEach(b => b.classList.remove('active'));
}

// 渲染：同模块多次计时合并统计
function examSwRender() {
    const list = document.getElementById('ex-sw-lap-list');
    if (!list) return;
    list.innerHTML = '';
    if (!examSw.laps.length) {
        const empty = document.createElement('div');
        empty.className = 'sw-empty';
        empty.textContent = '暂无记录 — 点击左侧模块按钮开始计时';
        list.appendChild(empty);
        return;
    }
    const agg = {};
    examSw.laps.forEach(l => {
        if (!agg[l.name]) agg[l.name] = { ms: 0, count: 0 };
        agg[l.name].ms += l.ms;
        agg[l.name].count += 1;
    });
    let totalMs = 0;
    Object.keys(agg).forEach((name, i) => {
        const a = agg[name];
        totalMs += a.ms;
        const row = document.createElement('div');
        row.className = 'sw-lap-row';
        const idx = document.createElement('span');
        idx.className = 'sw-lap-idx';
        idx.textContent = String(i + 1).padStart(2, '0');
        const nm = document.createElement('span');
        nm.className = 'sw-lap-name';
        nm.textContent = a.count > 1 ? `${name}（${a.count}次）` : name;
        const time = document.createElement('span');
        time.className = 'sw-lap-time';
        time.textContent = formatClock(a.ms);
        row.appendChild(idx);
        row.appendChild(nm);
        row.appendChild(time);
        list.appendChild(row);
    });
    const totalRow = document.createElement('div');
    totalRow.className = 'sw-lap-row';
    totalRow.style.fontWeight = '700';
    const tidx = document.createElement('span');
    tidx.className = 'sw-lap-idx';
    tidx.textContent = 'Σ';
    const tname = document.createElement('span');
    tname.className = 'sw-lap-name';
    tname.textContent = '合计';
    const ttime = document.createElement('span');
    ttime.className = 'sw-lap-time';
    ttime.textContent = formatClock(totalMs);
    totalRow.appendChild(tidx);
    totalRow.appendChild(tname);
    totalRow.appendChild(ttime);
    list.appendChild(totalRow);
}

// ── 历史记录：自动保存 + 渲染 ──
function saveExamRecord() {
    if (!examSw.laps.length) return;
    const rec = {
        id: crypto.randomUUID(),
        date: today(),
        startTime: examBaseToHM(examState.simBaseSec),
        durationSec: examState.durationSec,
        laps: examSw.laps.map(l => ({ name: l.name, ms: l.ms })),
        totalMs: examSw.laps.reduce((s, l) => s + l.ms, 0),
        createdAt: Date.now(),
    };
    if (!data.examRecords) data.examRecords = [];
    data.examRecords.push(rec);
    examSw.saved = true;
    saveData();
    renderExamHistory();
    showToast('📚 本次模考分模块用时已保存');
}

function examBaseToHM(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function deleteExamRecord(id) {
    if (!confirm('确定删除这条模考记录吗？')) return;
    data.examRecords = (data.examRecords || []).filter(r => r.id !== id);
    saveData();
    renderExamHistory();
    showToast('🗑 已删除该条模考记录');
}

function renderExamHistory() {
    const list = document.getElementById('exam-history-list');
    if (!list) return;
    const recs = (data.examRecords || []).slice().reverse();
    if (!recs.length) {
        list.innerHTML = '<span style="color:var(--text3);">暂无记录 — 完成一次模考后自动保存</span>';
        return;
    }
    list.innerHTML = recs.map(r => {
        const agg = {};
        (r.laps || []).forEach(l => {
            if (!agg[l.name]) agg[l.name] = 0;
            agg[l.name] += l.ms;
        });
        const paperSafe = String(r.paperName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const scores = r.modScores || {};
        const mods = Object.keys(agg)
            .map(n => {
                const sc = scores[n];
                const rate = sc && sc.q > 0 ? ` · <b style="color:var(--accent);">${Math.round(sc.c / sc.q * 100)}%</b>` : '';
                return `<span class="eh-mod" style="background:${getDisplayColor(getTagColor(n))}22;border:1px solid ${getDisplayColor(getTagColor(n))}55;color:var(--text);">${n} ${formatClock(agg[n])}${rate}</span>`;
            })
            .join('');
        const totalStr = formatClock(r.totalMs || (r.laps || []).reduce((s, l) => s + l.ms, 0));
        const scoreStr = r.totalScore != null ? `<span style="font-weight:700;color:var(--green);">得分 ${r.totalScore}</span>` : '';
        const editBtns = Object.keys(agg)
            .map(n => `<div class="eh-edit-row">
                    <span class="eh-edit-name">${n}</span>
                    <input type="number" id="eq-${r.id}-${n}-q" placeholder="题数" min="0" style="width:70px;">
                    <input type="number" id="eq-${r.id}-${n}-c" placeholder="答对" min="0" style="width:70px;">
                </div>`)
            .join('');
        return `<div class="eh-row">
            <div class="eh-head">
                <span style="font-weight:600;">${r.date}</span>
                ${r.paperName ? `<span style="font-weight:600;color:var(--accent);">📄 ${paperSafe}</span>` : ''}
                <span style="color:var(--text2);font-size:12px;">开考 ${r.startTime || '--:--'}${r.durationSec ? ' · 时长 ' + formatExamRemain(r.durationSec) : ''}</span>
                <span style="color:var(--accent);font-weight:700;margin-left:auto;">总用时 ${totalStr}</span>
                ${scoreStr}
                <button class="btn btn-ghost btn-sm" style="padding:2px 8px;" onclick="toggleExamEdit('${r.id}')" title="填写成绩">✏️</button>
                <button class="btn btn-ghost btn-sm" style="padding:2px 8px;color:var(--red);" onclick="deleteExamRecord('${r.id}')">🗑</button>
            </div>
            <div class="eh-mods">${mods || '<span style="color:var(--text3);font-size:12px;">无模块计时</span>'}</div>
            <div class="eh-edit" id="eh-edit-${r.id}" style="display:none;">
                <div class="eh-edit-title">填写试卷名称与各模块题数 / 答对数</div>
                <div class="eh-edit-row">
                    <span class="eh-edit-name">试卷名称</span>
                    <input type="text" id="ep-${r.id}" placeholder="如：2025国考行测真题" style="width:200px;text-align:left;">
                </div>
                ${editBtns}
                <div class="eh-edit-row">
                    <span class="eh-edit-name">本场总得分</span>
                    <input type="number" id="et-${r.id}" placeholder="总分" min="0" step="0.5" style="width:90px;">
                </div>
                <button class="btn btn-primary btn-sm" onclick="saveExamScore('${r.id}')" style="margin-top:8px;">💾 保存成绩</button>
            </div>
        </div>`;
    }).join('');
}

// 展开/收起成绩填写区（预填已保存的成绩）
function toggleExamEdit(id) {
    const el = document.getElementById('eh-edit-' + id);
    if (!el) return;
    const show = el.style.display !== 'block';
    el.style.display = show ? 'block' : 'none';
    if (!show) return;
    const rec = (data.examRecords || []).find(r => r.id === id);
    if (!rec) return;
    const scores = rec.modScores || {};
    Object.keys(scores).forEach(n => {
        const q = document.getElementById(`eq-${id}-${n}-q`);
        const c = document.getElementById(`eq-${id}-${n}-c`);
        if (q) q.value = scores[n].q;
        if (c) c.value = scores[n].c;
    });
    const t = document.getElementById(`et-${id}`);
    if (t && rec.totalScore != null) t.value = rec.totalScore;
    const ep = document.getElementById(`ep-${id}`);
    if (ep && rec.paperName) ep.value = rec.paperName;
}

// 保存该次模考的各模块成绩
function saveExamScore(id) {
    const rec = (data.examRecords || []).find(r => r.id === id);
    if (!rec) return;
    const agg = {};
    (rec.laps || []).forEach(l => {
        if (!agg[l.name]) agg[l.name] = 0;
        agg[l.name] += l.ms;
    });
    const scores = {};
    Object.keys(agg).forEach(n => {
        const qEl = document.getElementById(`eq-${id}-${n}-q`);
        const cEl = document.getElementById(`eq-${id}-${n}-c`);
        const q = parseInt(qEl ? qEl.value : '') || 0;
        const c = parseInt(cEl ? cEl.value : '') || 0;
        scores[n] = { q, c };
    });
    const tEl = document.getElementById(`et-${id}`);
    const totalScore = tEl && tEl.value !== '' ? parseFloat(tEl.value) : null;
    const epEl = document.getElementById(`ep-${id}`);
    const paperName = epEl ? epEl.value.trim() : '';
    rec.modScores = scores;
    rec.totalScore = totalScore;
    if (paperName) rec.paperName = paperName;
    else delete rec.paperName;
    saveData();
    renderExamHistory();
    showToast('✅ 成绩已保存');
}

function formatExamRemain(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}时${m}分`;
    return `${m}分${s}秒`;
}

// ── 页面进入 ──
function renderExam() {
    try {
        const saved = JSON.parse(localStorage.getItem('flow_exam_setup') || 'null');
        if (saved) {
            document.getElementById('exam-hour-format').value = saved.format || '24';
            document.getElementById('exam-start-time').value = saved.time || '';
            if (saved.durH !== undefined) document.getElementById('exam-dur-h').value = saved.durH;
            if (saved.durM !== undefined) document.getElementById('exam-dur-m').value = saved.durM;
        }
    } catch (e) {}
    const timeInp = document.getElementById('exam-start-time');
    if (!timeInp.value) {
        const now = new Date();
        timeInp.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    renderExamHistory();
    if (examState.running) tickExam();
    if (examSw.running) {
        examSwTick();
        highlightExamModule(examSw.currentName);
    }
}
