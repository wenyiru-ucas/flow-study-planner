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
        data.pomodoroSessions.push({ taskId: pomoState.taskId, minutes, date: today(), doneDelta: 0, startedAt: pomoState.startedAt });
        const task = data.tasks.find(t => t.id === pomoState.taskId);
        if (task) task.pomoMinutes = (task.pomoMinutes || 0) + minutes;
        if (!data.checkins[today()]) { data.checkins[today()] = { minutes, tasks: {} }; } else { data.checkins[today()].minutes = (data.checkins[today()].minutes || 0) + minutes; }
        saveData();
        pomoState.savedMinutes = minutes;
        document.getElementById('pomo-phase-label').textContent = '✅ 专注完成！';
        document.getElementById('pomo-timer').textContent = '00:00';
        document.getElementById('pomo-pause-btn').textContent = '—';
        document.getElementById('pomo-pause-btn').disabled = true;
        document.getElementById('pomo-duration-input').value = minutes;
        document.getElementById('pomo-post-input').style.display = 'block';
        document.getElementById('pomo-done-input').focus();
        pomoState.running = false;
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
        // Update the just-saved pomodoro session with corrected duration + doneDelta
        const sessions = data.pomodoroSessions;
        let updated = false;
        if (sessions.length > 0) {
            const last = sessions[sessions.length - 1];
            if (last.taskId === pomoState.taskId && last.date === today() && last.minutes === Math.round(pomoState.savedMinutes || pomoState.elapsedSec / 60)) {
                const diff = productiveMin - last.minutes;
                last.minutes = productiveMin;
                last.doneDelta = val || 0;   // 【第3步】回填本次完成量
                if (task) task.pomoMinutes = (task.pomoMinutes || 0) + diff;
                if (data.checkins[today()]) data.checkins[today()].minutes = (data.checkins[today()].minutes || 0) + diff;
                updated = true;
            }
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
        if (task && val > 0) showToast(`📝 「${task.name}」+${val}，进度已更新`);
        else if (task) showToast('⏱ 时长已记录，未完成单位');
        // If task has an exercise module tag, offer to record exercise stats
        if (task && val > 0 && getExerciseModule(task)) {
            setTimeout(() => openExerciseModal(task.id, task.name), 600);
        }
    }
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
            data.pomodoroSessions.push({ taskId: pomoState.taskId, minutes, date: today(), doneDelta: 0, startedAt: pomoState.startedAt });
            const task = data.tasks.find(t => t.id === pomoState.taskId);
            if (task) task.pomoMinutes = (task.pomoMinutes || 0) + minutes;
            if (!data.checkins[today()]) { data.checkins[today()] = { minutes, tasks: {} }; }
            else { data.checkins[today()].minutes = (data.checkins[today()].minutes || 0) + minutes; }
            saveData();
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
        return;
    }
    pomoState.running = false;
    document.getElementById('pomo-overlay').style.display = 'none';
    document.getElementById('mini-pomo').style.display = 'none';
    document.getElementById('pomo-post-input').style.display = 'none';
    document.getElementById('pomo-pause-btn').disabled = false;
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
    window.electronAPI.sendPomoState({
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
