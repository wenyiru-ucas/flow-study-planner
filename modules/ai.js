/* ═══ ai.js — DeepSeek AI Agent ═══
   来源：原 学习计划助手.html 第 1723-1913 行。
   pendingActions 在 state.js 中已声明，此处不重复。
   【小幅增强】DeepSeek 请求加 response_format 强制 JSON 模式（避免偶发非 JSON 输出导致 parse 失败）。 */

function triggerAI() {
    document.getElementById('ai-modal').style.display = 'flex';
    document.getElementById('ai-output').style.display = 'none';
    document.getElementById('ai-actions-row').style.display = 'none';
    document.getElementById('ai-submit-row').style.display = 'flex';
    document.getElementById('ai-context').value = '';
    pendingActions = [];
}

function closeAIModal() { document.getElementById('ai-modal').style.display = 'none'; }

async function runAI() {
    const apiKey = data.settings.apiKey || document.getElementById('api-key').value;
    if (!apiKey) { showToast('⚠️ 请填入 API Key'); return; }
    data.settings.apiKey = apiKey;
    saveData();
    const btn = document.getElementById('ai-btn');
    btn.disabled = true;
    btn.textContent = '⏳ ...';
    const output = document.getElementById('ai-output');
    output.style.display = 'block';
    output.innerHTML = '<span style="color:var(--accent);">🤖 AI 正在处理…</span>';
    document.getElementById('ai-actions-row').style.display = 'none';
    document.getElementById('ai-submit-row').style.display = 'none';

    const ctx = document.getElementById('ai-context').value.trim();
    if (!ctx) { output.innerHTML = '⚠️ 请输入指令'; btn.disabled = false; btn.textContent = '🚀 发送指令';
        document.getElementById('ai-submit-row').style.display = 'flex'; return; }

    const tasksInfo = data.tasks.map(t => {
        const k = calcKPI(t);
        return { id: t.id, name: t.name, start: t.start, end: t.end, total: t.total, done: t.done, type: t.type,
            status: t.status, gap: +(k.gap * 100).toFixed(1), daily: +k.daily.toFixed(1) };
    });

    const systemPrompt = `你是学习计划助手的AI Agent。你可以直接操作用户的任务列表。

当前任务数据（JSON）：
${JSON.stringify(tasksInfo, null, 2)}
当前日期：${today()}

用户指令：${ctx}

请根据指令返回一个JSON对象，包含以下字段：
- "explanation": 简短说明你的操作（中文，≤100字）
- "actions": 操作数组，每个操作包含 "action" 字段：

支持的操作类型：
1. add_task: { "action":"add_task", "name":"任务名", "start":"YYYY-MM-DD", "end":"YYYY-MM-DD", "total":数字, "type":"regular" }
2. update_progress: { "action":"update_progress", "taskId":"...", "done":数字 }
3. reschedule: { "action":"reschedule", "taskId":"...", "newEnd":"YYYY-MM-DD" }  或同时改 start
4. mark_done: { "action":"mark_done", "taskId":"..." }
5. delete_task: { "action":"delete_task", "taskId":"..." }
6. set_rest_day: { "action":"set_rest_day", "date":"YYYY-MM-DD" }

如果指令和任务操作无关，返回：{ "explanation":"你的回答", "actions":[] }

只返回JSON，不要其他文字。`;

    try {
        const resp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: systemPrompt }],
                max_tokens: 2000,
                temperature: 0.3,
                response_format: { type: 'json_object' }
            })
        });
        const j = await resp.json();
        if (j.error) throw new Error(j.error.message);
        let raw = j.choices[0].message.content || '{}';
        // Strip markdown code fences if present
        raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const result = JSON.parse(raw);

        pendingActions = result.actions || [];
        output.innerHTML = `<strong>🤖 AI：</strong>${result.explanation || '已完成分析'}` +
            (pendingActions.length > 0 ?
                `<br><br><span style="color:var(--accent);">📋 将执行 ${pendingActions.length} 个操作：</span><br>` +
                pendingActions.map((a, i) => {
                    switch (a.action) {
                        case 'add_task':
                            return `${i+1}. ➕ 新建「${a.name}」(${a.start}→${a.end}，总额${a.total})`;
                        case 'update_progress':
                            return `${i+1}. 📝 更新进度 done=${a.done}`;
                        case 'reschedule':
                            return `${i+1}. 📅 调整截止日期`;
                        case 'mark_done':
                            return `${i+1}. ✅ 标记为已完成`;
                        case 'delete_task':
                            return `${i+1}. 🗑 删除任务`;
                        case 'set_rest_day':
                            return `${i+1}. 😴 标记${a.date}为休息日`;
                        default:
                            return `${i+1}. 未知操作`;
                    }
                }).join('<br>') :
                '');

        if (pendingActions.length > 0) {
            document.getElementById('ai-actions-row').style.display = 'flex';
        } else {
            document.getElementById('ai-submit-row').style.display = 'flex';
        }
    } catch (e) {
        output.innerHTML = `❌ ${e.message}<br><span style="font-size:11px;color:var(--text2);">请重试，或检查指令是否清晰</span>`;
        document.getElementById('ai-submit-row').style.display = 'flex';
    }
    btn.disabled = false;
    btn.textContent = '🚀 发送指令';
}

function executeAIActions() {
    if (!pendingActions.length) return;
    let count = 0;
    pendingActions.forEach(a => {
        try {
            switch (a.action) {
                case 'add_task':
                    const newT = {
                        id: crypto.randomUUID(),
                        name: a.name || '新任务',
                        start: a.start || today(),
                        end: a.end || today(),
                        total: a.total || 100,
                        done: 0,
                        days: 0,
                        type: a.type || 'regular',
                        status: 'active',
                        note: '',
                        pomoMinutes: 0,
                        color: getTaskColor(Math.floor(Math.random() * TASK_COLORS.length)),
                        completedDate: ''
                    };
                    data.tasks.push(newT);
                    count++;
                    break;
                case 'update_progress':
                    const ut = data.tasks.find(t => t.id === a.taskId);
                    if (ut && a.done !== undefined) { ut.done = Math.min(ut.total, a.done);
                        ut.days++; if (ut.done >= ut.total) { ut.status = 'done';
                        ut.completedDate = today(); } count++; }
                    break;
                case 'reschedule':
                    const rt = data.tasks.find(t => t.id === a.taskId);
                    if (rt) {
                        if (a.newEnd) rt.end = a.newEnd;
                        if (a.newStart) rt.start = a.newStart;
                        // 同步更新今日快照（含指纹）
                        const dk = today();
                        if (!data.dailyDone[dk]) data.dailyDone[dk] = { targets: {} };
                        if (!data.dailyDone[dk].targets) data.dailyDone[dk].targets = {};
                        if (!data.dailyDone[dk]._params) data.dailyDone[dk]._params = {};
                        const fp = `${rt.end || ''}|${rt.total || 0}`;
                        data.dailyDone[dk].targets[rt.id] = +calcKPI(rt).daily.toFixed(1);
                        data.dailyDone[dk]._params[rt.id] = fp;
                        count++;
                    }
                    break;
                case 'mark_done':
                    const mt = data.tasks.find(t => t.id === a.taskId);
                    if (mt) { mt.status = 'done';
                        mt.done = mt.total;
                        mt.completedDate = today();
                        count++; }
                    break;
                case 'delete_task':
                    const idx = data.tasks.findIndex(t => t.id === a.taskId);
                    if (idx >= 0) { data.tasks.splice(idx, 1);
                        data.pomodoroSessions = data.pomodoroSessions.filter(s => s.taskId !== a.taskId);
                        count++; }
                    break;
                case 'set_rest_day':
                    if (a.date) { data.checkins[a.date] = data.checkins[a.date] || { minutes: 0,
                            tasks: {} };
                        count++; }
                    break;
            }
        } catch (e) { console.error('Action failed:', a, e); }
    });
    saveData();
    pendingActions = [];
    document.getElementById('ai-modal').style.display = 'none';
    showToast(`🤖 已执行 ${count} 个操作`);
    if (document.getElementById('page-planner').classList.contains('active')) renderPlanner();
    if (document.getElementById('page-today').classList.contains('active')) renderToday();
}
