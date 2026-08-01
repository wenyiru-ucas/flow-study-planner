/* ═══ countdown.js — 倒数日 ═══
   来源：原 学习计划助手.html 第 1521-1587 行。无逻辑改动。 */

// ═══════════ COUNTDOWN ═══════════
function renderCountdown() {
    const items = data.countdowns;
    document.getElementById('countdown-list').innerHTML = items.length ? items.map(cd => {
        const days = Math.ceil((new Date(cd.date) - new Date(today())) / 86400000);
        const dayStr = days > 0 ? `还有 ${days} 天` : days === 0 ? '今天！' : `已过 ${Math.abs(days)} 天`;
        const dayColor = days <= 7 && days > 0 ? 'var(--orange)' : days <= 0 ? 'var(--red)' : 'var(--accent)';
        return `<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:var(--surface);border-radius:var(--radius);margin-bottom:8px;border:1px solid var(--border-subtle);">
      <span style="font-weight:700;font-size:15px;flex:1;">${cd.name}</span>
      <span style="font-size:13px;color:var(--text2);">${cd.date}</span>
      <span style="font-size:15px;font-weight:700;color:${dayColor};">${dayStr}</span>
      <label style="font-size:11px;color:var(--text2);cursor:pointer;display:flex;align-items:center;gap:4px;">
        <input type="checkbox" ${cd.show?'checked':''} onchange="toggleCDShow('${cd.id}')" style="accent-color:var(--accent);"> 置顶
      </label>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="removeCountdown('${cd.id}')">🗑</button>
    </div>`;
    }).join('') : '<div style="text-align:center;padding:48px;color:var(--text2);">暂无倒数日，添加一个吧</div>';
}

function addCountdown() {
    const name = document.getElementById('cd-name').value.trim();
    const date = document.getElementById('cd-date').value;
    if (!name || !date) { showToast('请填写名称和日期'); return; }
    data.countdowns.push({ id: crypto.randomUUID(), name, date, show: false });
    document.getElementById('cd-name').value = '';
    document.getElementById('cd-date').value = '';
    saveData();
    renderCountdown();
    showToast('✅ 已添加');
}

function removeCountdown(id) {
    data.countdowns = data.countdowns.filter(c => c.id !== id);
    saveData();
    renderCountdown();
    if (document.getElementById('page-planner').classList.contains('active')) renderTopCountdowns();
}

function toggleCDShow(id) {
    const cd = data.countdowns.find(c => c.id === id);
    if (!cd) return;
    const showing = data.countdowns.filter(c => c.show).length;
    if (!cd.show && showing >= 3) { showToast('最多置顶3个倒数日'); renderCountdown(); return; }
    cd.show = !cd.show;
    saveData();
    renderCountdown();
    if (document.getElementById('page-planner').classList.contains('active')) renderTopCountdowns();
}

function renderTopCountdowns() {
    const showing = data.countdowns.filter(c => c.show).slice(0, 3);
    const el = document.getElementById('top-countdowns');
    if (!el) return;
    el.innerHTML = showing.map(cd => {
        const days = Math.ceil((new Date(cd.date) - new Date(today())) / 86400000);
        const dayNum = days > 0 ? days : days === 0 ? '今' : Math.abs(days);
        const dayUnit = days > 0 ? '天' : days === 0 ? '' : '天前';
        const dayColor = days <= 7 && days > 0 ? 'var(--orange)' : days <= 0 ? 'var(--red)' : 'var(--accent)';
        return `<div class="countdown-badge">
      <div class="cd-num" style="color:${dayColor};">${dayNum}</div>
      <div class="cd-info">
        <span class="cd-unit">${dayUnit}</span>
        <span class="cd-name" title="${cd.name}">${cd.name}</span>
      </div>
    </div>`;
    }).join('');
}
