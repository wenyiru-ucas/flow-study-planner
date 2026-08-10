/* ═══ pomodoro.js — 番茄钟 ═══
   来源：原 学习计划助手.html 第 1171-1415 行。

   【第3步改动】番茄钟 session 升级：
   - push 时增加 doneDelta（默认0）和 startedAt（时间戳）字段
   - submitPomoProgress 用户填完成量时回填 doneDelta 到对应 session
   - 匹配不上的兜底：push 一条新 session 带 doneDelta
   原有逻辑（task.done 累加、task.pomoProductive/pomoUnits 维护、checkins 同步）全部保留，
   保持向后兼容（旧数据可继续用兜底字段算单位耗时）。

   audioCtx 在 state.js 中声明。 */

// ═══════════ POMODORO ═══════════
function playBeep() {
    try {
        if (!audioCtx) audioCtx = new(window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
}

function startPomo(taskId, taskName) {
    // ── 痛点2修复：点击按钮后立即失焦，防止后续空格误触 ──
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const task = data.tasks.find(t => t.id === taskId);
    const isCountUp = task && task.timerMode === 'countup';
    const workMin = data.settings.pomoWork || 60;
    pomoState.taskId = taskId;
    pomoState.taskName = taskName;
    pomoState.totalSec = isCountUp ? Infinity : workMin * 60;
    pomoState.startedAt = Date.now();
    pomoState.endTime = isCountUp ? Infinity : pomoState.startedAt + pomoState.totalSec * 1000;
    pomoState.elapsedSec = 0;
    pomoState.isBreak = false;
    pomoState.running = true;
    pomoState.pausedRemaining = null;
    pomoState.isCountUp = isCountUp;

    document.getElementById('pomo-overlay').style.display = 'flex';
    document.getElementById('pomo-task-name').textContent = taskName;
    document.getElementById('pomo-phase-label').textContent = isCountUp ? '⏫ 专注中（正计时）' : '🍅 专注中';
    document.getElementById('pomo-timer').classList.remove('break-time');
    document.getElementById('pomo-ring').classList.remove('break-ring');
    document.getElementById('pomo-ring').style.strokeDashoffset = isCountUp ? '628' : '0';
    document.getElementById('pomo-pause-btn').textContent = '⏸ 暂停';
    document.getElementById('pomo-post-input').style.display = 'none';
    document.getElementById('pomo-done-input').value = '';

    // ── 08-06#2：新番茄钟开始时 ──
    // 秒表直接展开（无需手动点击）；名称由用户自行填写
    if (!stopwatch.open) toggleStopwatch();
    // 清掉上一轮待修正的 session / 秒表记录引用
    pomoState.pendingSession = null;
    pomoState.pendingSwLog = null;

    updatePomoDisplay();
    if (pomoState.interval) clearInterval(pomoState.interval);
    pomoState.interval = setInterval(pomoTick, 250);

    // ── Electron: 通知主进程启动独立 Tray 计时器 ──
    if (window.electronAPI) {
        window.electronAPI.sendPomoStarted({
            startedAt: pomoState.startedAt,
            totalSec: pomoState.totalSec,
            isCountUp: pomoState.isCountUp,
            taskName: taskName,
        });
    }
    syncPomoToTray();
}

function pomoTick() {
    if (!pomoState.running) return;
    const now = Date.now();
    const elapsed = Math.round((now - pomoState.startedAt) / 1000);
    pomoState.elapsedSec = pomoState.isCountUp ? elapsed : Math.min(elapsed, pomoState.totalSec);
    if (!pomoState.isCountUp && pomoState.elapsedSec >= pomoState.totalSec) {
        updatePomoDisplay();
        clearInterval(pomoState.interval);
        playBeep();
        finishPomoSession();
        return;
    }
    updatePomoDisplay();
    // ── Electron: 每 250ms 同步状态到主进程，更新菜单栏 Tray 倒计时 ──
    syncPomoToTray();
}

function finishPomoSession() {
    const minutes = Math.round(pomoState.elapsedSec / 60);
    if (!pomoState.isBreak) {
        // 【第3步】session 加 doneDelta（默认0）和 startedAt
        const sess = { taskId: pomoState.taskId, minutes, date: today(), doneDelta: 0, startedAt: pomoState.startedAt };
        data.pomodoroSessions.push(sess);
        // 【修复】记录本次 session 引用，提交时直接修正（替代脆弱的"最后一条匹配"）
        pomoState.pendingSession = sess;
        const task = data.tasks.find(t => t.id === pomoState.taskId);
        if (task) task.pomoMinutes = (task.pomoMinutes || 0) + minutes;
        if (!data.checkins[today()]) { data.checkins[today()] = { minutes, tasks: {} }; } else { data.checkins[today()].minutes = (data.checkins[today()].minutes || 0) + minutes; }
        saveData();
        // ── 痛点3修复：立即刷新左下角今日时长 ──
        updateSidebarStats();
        pomoState.savedMinutes = minutes;
        document.getElementById('pomo-phase-label').textContent = '✅ 专注完成！';
        document.getElementById('pomo-timer').textContent = '00:00';
        document.getElementById('pomo-pause-btn').textContent = '—';
        document.getElementById('pomo-pause-btn').disabled = true;
        document.getElementById('pomo-duration-input').value = minutes;
        document.getElementById('pomo-post-input').style.display = 'block';
        document.getElementById('pomo-done-input').focus();
        pomoState.running = false;
        // ── 本次练习结束：保存秒表分段记录（仅启动过秒表时弹窗显示正确率） ──
        const swSaved = saveStopwatchRecord(pomoState.taskId, pomoState.taskName);
        showPomoScoreArea(swSaved);
        resetStopwatch();
        document.getElementById('pomo-q-input').value = '';
        document.getElementById('pomo-c-input').value = '';
        document.getElementById('pomo-category-input').value = '';
        document.getElementById('pomo-item-input').value = '';
        if (window.electronAPI) {
            window.electronAPI.sendPomoFinished({
                taskName: pomoState.taskName,
                minutes,
                isBreak: false
            });
        } else if (Notification.permission === 'granted') {
            const n = new Notification('🍅 番茄钟完成！', { body: `${pomoState.taskName} — ${formatTime(minutes)}专注`, icon: '✅' });
            n.onclick = () => { window.focus(); n.close(); };
        }
    } else {
        stopPomo(true);
        if (window.electronAPI) {
            window.electronAPI.sendPomoFinished({
                taskName: '',
                minutes: 0,
                isBreak: true
            });
        } else if (Notification.permission === 'granted') {
            const n = new Notification('☕ 休息结束', { body: '准备下一轮专注', icon: '🍅' });
            n.onclick = () => { window.focus(); n.close(); };
        }
    }
}

function submitPomoProgress() {
    const val = parseFloat(document.getElementById('pomo-done-input').value);
    const durMin = parseInt(document.getElementById('pomo-duration-input').value) || Math.round(pomoState.elapsedSec / 60);
    const task = data.tasks.find(t => t.id === pomoState.taskId);
    const tempItem = data.tempChecklist.find(i => i.id === pomoState.taskId);
    const productiveMin = Math.max(1, durMin);
    if (!isNaN(val) && val >= 0 && productiveMin > 0) {
        // 【修复】直接用本次 session 引用修正时长（替代脆弱的"最后一条三元匹配"）
        const sessions = data.pomodoroSessions;
        let updated = false;
        const last = pomoState.pendingSession
            ? sessions.find(s => s === pomoState.pendingSession)
            : sessions[sessions.length - 1];
        if (last && last.taskId === pomoState.taskId && last.date === today()) {
            const diff = productiveMin - last.minutes;
            last.minutes = productiveMin;
            last.doneDelta = val || 0;   // 【第3步】回填本次完成量
            if (task) task.pomoMinutes = (task.pomoMinutes || 0) + diff;
            if (data.checkins[today()]) data.checkins[today()].minutes = (data.checkins[today()].minutes || 0) + diff;
            updated = true;
        }
        // 【第3步】兜底：若三元匹配失败，单独 push 一条带 doneDelta 的 session，避免完成量丢失
        if (!updated && val > 0) {
            console.warn('[pomodoro] doneDelta 三元匹配失败，启用兜底 push — 请关注是否存在重复 session', {
                taskId: pomoState.taskId,
                savedMinutes: pomoState.savedMinutes,
                productiveMin,
                val,
                lastSession: sessions.length > 0 ? sessions[sessions.length - 1] : null
            });
            data.pomodoroSessions.push({ taskId: pomoState.taskId, minutes: productiveMin, date: today(), doneDelta: val, startedAt: pomoState.startedAt });
        }
        if (task) {
            task.pomoProductive = (task.pomoProductive || 0) + productiveMin;
            if (val > 0) {
                task.done = Math.min(task.total, task.done + val);
                task.days += 1;
                task.pomoUnits = (task.pomoUnits || 0) + val;
                if (task.done >= task.total) { task.status = 'done'; task.completedDate = today(); }
            }
        }
        if (tempItem) {
            tempItem.pomoMinutes = (tempItem.pomoMinutes || 0) + productiveMin;
        }
        if (task) {
            const td = today();
            if (!data.dailyDone[td]) data.dailyDone[td] = {};
            if (val > 0) data.dailyDone[td][task.id] = (data.dailyDone[td][task.id] || 0) + val;
        }
        saveData();
        // ── 痛点3修复：时长修正后刷新左下角今日时长 ──
        updateSidebarStats();
        if (task && val > 0) showToast(`📝 「${task.name}」+${val}，进度已更新`);
        else if (task) showToast('⏱ 时长已记录，未完成单位');
        // If task has an exercise module tag, offer to record exercise stats
        if (task && val > 0 && getExerciseModule(task)) {
            setTimeout(() => openExerciseModal(task.id, task.name), 600);
        }
    }
    // ── 【修复】本次练习正确率（独立保存，即使未填完成量也生效） ──
    const swQ = parseInt(document.getElementById('pomo-q-input').value) || 0;
    const swC = parseInt(document.getElementById('pomo-c-input').value) || 0;
    if (swQ > 0 && pomoState.pendingSwLog) {
        pomoState.pendingSwLog.questions = swQ;
        pomoState.pendingSwLog.correct = Math.min(swC, swQ);
        saveData();
    }
    // ── 类别 / 名称（选填）写入刚保存的秒表记录 ──
    if (pomoState.pendingSwLog) {
        const catEl = document.getElementById('pomo-category-input');
        const itemEl = document.getElementById('pomo-item-input');
        const cat = catEl ? catEl.value.trim() : '';
        const item = itemEl ? itemEl.value.trim() : '';
        let changed = false;
        if (cat) { pomoState.pendingSwLog.category = cat; changed = true; }
        if (item) { pomoState.pendingSwLog.item = item; changed = true; }
        if (changed) saveData();
    }
    pomoState.pendingSwLog = null;
    // Start break
    pomoState.isBreak = true;
    pomoState.totalSec = (data.settings.pomoBreak || 5) * 60;
    pomoState.startedAt = Date.now();
    pomoState.endTime = pomoState.startedAt + pomoState.totalSec * 1000;
    pomoState.running = true;
    document.getElementById('pomo-phase-label').textContent = '☕ 休息一下';
    document.getElementById('pomo-timer').classList.add('break-time');
    document.getElementById('pomo-ring').classList.add('break-ring');
    document.getElementById('pomo-post-input').style.display = 'none';
    document.getElementById('pomo-pause-btn').disabled = false;
    document.getElementById('pomo-pause-btn').textContent = '⏸ 暂停';
    updatePomoDisplay();
    pomoState.interval = setInterval(pomoTick, 250);
}

function updatePomoDisplay() {
    let display;
    let progress;
    const circumference = 2 * Math.PI * 100;
    if (pomoState.isCountUp) {
        const mins = Math.floor(pomoState.elapsedSec / 60);
        const secs = pomoState.elapsedSec % 60;
        display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        progress = Math.min(1, pomoState.elapsedSec / 3600); // ring fills over 60 min
    } else {
        const remaining = Math.max(0, pomoState.totalSec - pomoState.elapsedSec);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        progress = remaining / pomoState.totalSec;
    }
    document.getElementById('pomo-timer').textContent = display;
    document.getElementById('mini-pomo-timer').textContent = display;
    document.getElementById('pomo-ring').style.strokeDashoffset = circumference * (1 - progress);
    document.getElementById('pomo-ring').setAttribute('stroke-dasharray', circumference);
}

function togglePomo() {
    if (pomoState.running) {
        // Pause
        pomoState.running = false;
        pomoState.pausedElapsed = pomoState.elapsedSec;
        if (!pomoState.isCountUp) {
            // 【修复】记录剩余秒数，恢复时才能从暂停点继续
            pomoState.pausedRemaining = Math.max(0, pomoState.totalSec - pomoState.elapsedSec);
        }
        clearInterval(pomoState.interval);
        document.getElementById('pomo-pause-btn').textContent = '▶ 继续';
    } else {
        // Resume
        if (pomoState.isCountUp) {
            pomoState.startedAt = Date.now() - (pomoState.pausedElapsed || 0) * 1000;
        } else {
            const pr = pomoState.pausedRemaining || pomoState.totalSec;
            pomoState.totalSec = pr;
            pomoState.startedAt = Date.now() - (pomoState.totalSec - pr) * 1000;
        }
        pomoState.running = true;
        pomoState.pausedRemaining = null;
        pomoState.pausedElapsed = null;
        document.getElementById('pomo-pause-btn').textContent = '⏸ 暂停';
        pomoState.interval = setInterval(pomoTick, 250);
        // 【修复】同步最新 startedAt/totalSec 到主进程，Tray 计时从暂停点继续
        if (window.electronAPI) {
            window.electronAPI.sendPomoStarted({
                startedAt: pomoState.startedAt,
                totalSec: pomoState.totalSec,
                isCountUp: pomoState.isCountUp,
                taskName: pomoState.taskName || '',
            });
        }
    }
    syncPomoToTray();
}

function minimizePomo() {
    document.getElementById('pomo-overlay').style.display = 'none';
    document.getElementById('mini-pomo').style.display = 'flex';
    document.getElementById('mini-pomo-name').textContent = pomoState.taskName;
}

function restorePomo() {
    document.getElementById('mini-pomo').style.display = 'none';
    document.getElementById('pomo-overlay').style.display = 'flex';
}

function stopPomo(silent = false) {
    clearInterval(pomoState.interval);
    if (pomoState.running && !pomoState.isBreak && !silent) {
        const minutes = Math.round(pomoState.elapsedSec / 60);
        if (minutes > 0) {
            // 【第3步】手动停止的 session 也加 doneDelta/startedAt
            const sess = { taskId: pomoState.taskId, minutes, date: today(), doneDelta: 0, startedAt: pomoState.startedAt };
            data.pomodoroSessions.push(sess);
            // 【修复】记录本次 session 引用，提交时直接修正
            pomoState.pendingSession = sess;
            const task = data.tasks.find(t => t.id === pomoState.taskId);
            if (task) task.pomoMinutes = (task.pomoMinutes || 0) + minutes;
            if (!data.checkins[today()]) { data.checkins[today()] = { minutes, tasks: {} }; }
            else { data.checkins[today()].minutes = (data.checkins[today()].minutes || 0) + minutes; }
            saveData();
            // ── 痛点3修复：手动停止也立即刷新左下角今日时长 ──
            updateSidebarStats();
            pomoState.savedMinutes = minutes;
        }
        // Show progress input instead of closing
        document.getElementById('pomo-phase-label').textContent = '✅ 专注完成！';
        document.getElementById('pomo-timer').textContent = '00:00';
        document.getElementById('pomo-pause-btn').textContent = '—';
        document.getElementById('pomo-pause-btn').disabled = true;
        document.getElementById('pomo-duration-input').value = Math.round(pomoState.elapsedSec / 60);
        document.getElementById('pomo-post-input').style.display = 'block';
        document.getElementById('pomo-done-input').value = '';
        document.getElementById('pomo-done-input').focus();
        pomoState.running = false;
        // ── 08-06#2：训练结束（手动结束）→ 保存秒表分段记录（仅启动过秒表时弹窗显示正确率） ──
        const swSaved = saveStopwatchRecord(pomoState.taskId, pomoState.taskName);
        showPomoScoreArea(swSaved);
        resetStopwatch();
        document.getElementById('pomo-q-input').value = '';
        document.getElementById('pomo-c-input').value = '';
        document.getElementById('pomo-category-input').value = '';
        document.getElementById('pomo-item-input').value = '';
        return;
    }
    pomoState.running = false;
    document.getElementById('pomo-overlay').style.display = 'none';
    document.getElementById('mini-pomo').style.display = 'none';
    document.getElementById('pomo-post-input').style.display = 'none';
    document.getElementById('pomo-pause-btn').disabled = false;
    // ── 番茄钟结束：自动暂停秒表（数据保留可回看） ──
    pauseStopwatch();
    saveData();
    if (document.getElementById('page-planner').classList.contains('active')) renderPlanner();
    if (document.getElementById('page-today').classList.contains('active')) renderToday();
    // ── Electron: 清除菜单栏 Tray 状态 ──
    if (window.electronAPI) window.electronAPI.clearPomoState();
}

/* ═══ Electron IPC 集成（仅在 Electron 环境下生效，浏览器中自动忽略） ═══ */

// 每秒通知主进程当前番茄钟状态，用于更新菜单栏 Tray 倒计时 & 右键菜单
function syncPomoToTray() {
    if (!window.electronAPI) return;
    // 剩余秒数：暂停时用 pausedRemaining，否则实时计算
    let remain;
    if (pomoState.isCountUp) {
        remain = pomoState.elapsedSec;
    } else if (!pomoState.running && pomoState.pausedRemaining != null) {
        remain = pomoState.pausedRemaining;
    } else {
        remain = Math.max(0, pomoState.totalSec - pomoState.elapsedSec);
    }
    const m = Math.floor(remain / 60);
    const s = remain % 60;
    window.electronAPI.sendPomoState({
        timeStr: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        running: !!pomoState.running,
        paused: !pomoState.running && pomoState.pausedElapsed != null,
        isBreak: !!pomoState.isBreak,
        taskName: pomoState.taskName || '',
    });
}

// 监听 Tray 右键菜单操作
if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.onTrayAction((action) => {
        switch (action) {
            case 'pause':
                // 暂停当前计时
                if (pomoState.running && !pomoState.pausedElapsed) {
                    togglePomo();
                }
                break;
            case 'resume':
                // 继续计时
                if (!pomoState.running && pomoState.pausedElapsed != null) {
                    togglePomo();
                }
                break;
            case 'end':
                // 结束当前番茄钟 → 弹窗记录完成量
                if (pomoState.running && !pomoState.isBreak) {
                    stopPomo(false);
                }
                break;
            case 'skip-break':
                // 跳过休息
                if (pomoState.isBreak && pomoState.interval) {
                    clearInterval(pomoState.interval);
                    stopPomo(true);
                }
                break;
            case 'restart':
                // 再来一组：关闭当前 overlay 后重新开始
                pomoState.running = false;
                if (pomoState.interval) clearInterval(pomoState.interval);
                document.getElementById('pomo-overlay').style.display = 'none';
                document.getElementById('mini-pomo').style.display = 'none';
                document.getElementById('pomo-post-input').style.display = 'none';
                if (pomoState.taskId) {
                    const task = data.tasks.find(t => t.id === pomoState.taskId);
                    if (task) startPomo(pomoState.taskId, task.name);
                }
                break;
        }
    });
}

// 监听原生菜单栏操作
if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.onMenuAction((action) => {
        switch (action) {
            case 'export':
                if (typeof exportData === 'function') exportData();
                break;
            case 'import':
                document.getElementById('import-file')?.click();
                break;
            case 'open-settings':
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                const sBtn = document.querySelector('.nav-item[data-page="settings"]');
                if (sBtn) sBtn.classList.add('active');
                document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
                document.getElementById('page-settings')?.classList.add('active');
                if (typeof loadSettings === 'function') loadSettings();
                break;
            case 'nav-today':
            case 'nav-planner':
            case 'nav-analytics':
            case 'nav-settings': {
                const page = action.replace('nav-', '');
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                const btn = document.querySelector(`.nav-item[data-page="${page}"]`);
                if (btn) btn.classList.add('active');
                document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
                document.getElementById(`page-${page}`)?.classList.add('active');
                if (page === 'planner' && typeof renderPlanner === 'function') renderPlanner();
                if (page === 'today' && typeof renderToday === 'function') renderToday();
                if (page === 'analytics' && typeof renderAnalytics === 'function') renderAnalytics();
                if (page === 'settings' && typeof loadSettings === 'function') loadSettings();
                break;
            }
        }
    });
}

/* ═══════ 秒表（分段计时，独立于番茄钟） ═══════
   用途：定时训练时记录各模块用时。
   - 与番茄钟互不干扰，可同时运行
   - 支持分段命名（如"言语理解"、"判断推理"）
   - 番茄钟结束（overlay 关闭）时自动暂停，数据保留可回看 */

const stopwatch = {
    open: false,        // 面板是否展开
    running: false,     // 是否计时中
    baseMs: 0,          // 已累计时长（暂停时冻结）
    runningStart: 0,    // 本次运行起点 (Date.now)
    lapBaseMs: 0,       // 当前分段起点（相对总时长的累计值）
    currentName: '',    // 当前分段名称
    laps: [],           // [{ name, ms }]
    interval: null,
};

function formatClock(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}时${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
}

function stopwatchTotal() {
    return stopwatch.baseMs + (stopwatch.running ? Date.now() - stopwatch.runningStart : 0);
}function stopwatchLapMs() {
    return Math.max(0, stopwatchTotal() - stopwatch.lapBaseMs);
}

function stopwatchTick() {
    if (!stopwatch.running) return;
    document.getElementById('sw-total').textContent = formatClock(stopwatchTotal());
    document.getElementById('sw-cur').textContent = formatClock(stopwatchLapMs());
}

function toggleStopwatch() {
    stopwatch.open = !stopwatch.open;
    document.getElementById('stopwatch-body').style.display = stopwatch.open ? 'flex' : 'none';
    document.getElementById('sw-arrow').textContent = stopwatch.open ? '▴' : '▾';
    if (stopwatch.open) {
        // 展开时同步一次显示
        if (stopwatch.running) {
            stopwatchTick();
        } else if (stopwatch.laps.length || stopwatch.lapBaseMs > 0) {
            const total = stopwatchTotal();
            document.getElementById('sw-total').textContent = formatClock(total);
            document.getElementById('sw-cur').textContent = formatClock(stopwatchLapMs());
        }
        renderStopwatchLaps();
    }
}

function toggleStopwatchRun() {
    const btn = document.getElementById('sw-run-btn');
    if (!stopwatch.running) {
        stopwatch.running = true;
        stopwatch.runningStart = Date.now();
        // 首次开始：自动建立第 1 段（名称实时取自输入框）
        if (stopwatch.laps.length === 0 && stopwatch.lapBaseMs === 0) {
            stopwatch.currentName = document.getElementById('sw-name-input').value.trim() || '第1段';
            stopwatch.lapBaseMs = 0;
        }
        btn.textContent = '⏸ 暂停';
        stopwatch.interval = setInterval(stopwatchTick, 200);
    } else {
        stopwatch.baseMs = stopwatchTotal();
        stopwatch.running = false;
        clearInterval(stopwatch.interval);
        btn.textContent = '▶ 继续';
    }
    updateStopwatchStatusHint();
    stopwatchTick();
}

// 输入框实时同步当前段名称（修复：运行中改名称不再错位）
function onStopwatchNameInput() {
    stopwatch.currentName = document.getElementById('sw-name-input').value.trim() || '';
}

function stopwatchLap() {
    if (!stopwatch.running) return;
    const lapMs = stopwatchLapMs();
    stopwatch.laps.push({ name: stopwatch.currentName || `第${stopwatch.laps.length + 1}段`, ms: lapMs });
    stopwatch.lapBaseMs = stopwatchTotal();
    // 新段名称：清空输入框，等待用户输入下一段名称
    document.getElementById('sw-name-input').value = '';
    stopwatch.currentName = '';
    renderStopwatchLaps();
    stopwatchTick();
    showToast(`⏱ 第${stopwatch.laps.length}段「${stopwatch.laps[stopwatch.laps.length - 1].name}」已记录`);
}

function resetStopwatch() {
    stopwatch.running = false;
    clearInterval(stopwatch.interval);
    stopwatch.baseMs = 0;
    stopwatch.runningStart = 0;
    stopwatch.lapBaseMs = 0;
    stopwatch.currentName = '';
    stopwatch.laps = [];
    document.getElementById('sw-run-btn').textContent = '▶ 开始';
    document.getElementById('sw-total').textContent = '00:00';
    document.getElementById('sw-cur').textContent = '00:00';
    document.getElementById('sw-name-input').value = '';
    renderStopwatchLaps();
    updateStopwatchStatusHint();
}

// 暂停秒表（保留数据）——番茄钟结束时调用
function pauseStopwatch() {
    if (!stopwatch.running) return;
    stopwatch.baseMs = stopwatchTotal();
    stopwatch.running = false;
    clearInterval(stopwatch.interval);
    const btn = document.getElementById('sw-run-btn');
    if (btn) btn.textContent = '▶ 继续';
    updateStopwatchStatusHint();
}

function updateStopwatchStatusHint() {
    const hint = document.getElementById('sw-status-hint');
    if (!hint) return;
    if (stopwatch.running) {
        hint.textContent = '● 计时中';
    } else if (stopwatch.laps.length || stopwatch.baseMs > 0) {
        hint.textContent = `已记录 ${stopwatch.laps.length} 段`;
    } else {
        hint.textContent = '';
    }
}

// ── 08-06#2：保存本次训练的秒表分段记录到任务（复盘用） ──
// 返回 true = 保存了记录（本次启动过秒表）；false = 秒表未启动
function saveStopwatchRecord(taskId, taskName) {
    const hasData = stopwatch.laps.length > 0 || stopwatch.baseMs > 0 || stopwatch.running;
    if (!hasData) return false;
    // 结算当前进行段
    const laps = [...stopwatch.laps];
    if (stopwatch.baseMs > 0 || stopwatch.running) {
        const cur = stopwatchLapMs();
        if (cur > 0) laps.push({ name: stopwatch.currentName || '未命名段', ms: Math.round(cur) });
    }
    if (!laps.length) return false;
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return false;
    if (!task.stopwatchLogs) task.stopwatchLogs = [];
    const log = {
        date: today(),
        laps: laps.map(l => ({ name: l.name, ms: Math.round(l.ms) })),
        totalMs: laps.reduce((s, l) => s + l.ms, 0),
        questions: null,   // 题数（弹窗/任务弹窗补填）
        correct: null,     // 答对数（弹窗/任务弹窗补填）
        category: null,    // 类别（大模块，如资料分析）
        item: null,        // 名称（具体题本，如 A老师第7套）
        createdAt: Date.now(),
    };
    task.stopwatchLogs.push(log);
    // 记录引用，供结束弹窗填写正确率
    pomoState.pendingSwLog = log;
    saveData();
    showToast(`⏱ 秒表分段已保存（${laps.length} 段）`);
    return true;
}

// 结束弹窗：仅当本次启动过秒表时才显示正确率填写区
function showPomoScoreArea(saved) {
    const section = document.getElementById('pomo-score-section');
    if (section) section.style.display = saved ? '' : 'none';
}

function renderStopwatchLaps() {
    const list = document.getElementById('sw-lap-list');
    if (!list) return;
    list.innerHTML = '';
    if (!stopwatch.laps.length) {
        const empty = document.createElement('div');
        empty.className = 'sw-empty';
        empty.textContent = '暂无分段记录 — 点「⏱ 分段」开始记录各模块用时';
        list.appendChild(empty);
        return;
    }
    let totalMs = 0;
    stopwatch.laps.forEach((l, i) => {
        totalMs += l.ms;
        const row = document.createElement('div');
        row.className = 'sw-lap-row';
        const idx = document.createElement('span');
        idx.className = 'sw-lap-idx';
        idx.textContent = String(i + 1).padStart(2, '0');
        const name = document.createElement('span');
        name.className = 'sw-lap-name';
        name.textContent = l.name;
        const time = document.createElement('span');
        time.className = 'sw-lap-time';
        time.textContent = formatClock(l.ms);
        row.appendChild(idx);
        row.appendChild(name);
        row.appendChild(time);
        list.appendChild(row);
    });
    // 总计行
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

/* ═══ 痛点3修复：轻量刷新侧边栏统计（今日时长/连续天数） ═══
   番茄钟记录后调用，无需整页重渲染，左下角数据即时更新 */

function updateSidebarStats() {
    const el = document.getElementById('sidebar-today-min');
    if (el) el.textContent = formatTime(getTodayPomoMinutes());
    const el2 = document.getElementById('sidebar-streak');
    if (el2) el2.textContent = calcStreak() + ' 天';
}

/* ═══ 痛点2修复：番茄钟活动期间拦截空格键 ═══
   根因：空格会触发当前聚焦按钮的点击 → 误触"开始"重新计时。
   输入框/文本域中不拦截（允许正常输入空格）。 */

document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    const overlay = document.getElementById('pomo-overlay');
    const mini = document.getElementById('mini-pomo');
    const active = (overlay && overlay.style.display !== 'none') || (mini && mini.style.display !== 'none');
    if (active) {
        e.preventDefault();
        e.stopPropagation();
    }
});
