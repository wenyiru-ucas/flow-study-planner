/* ═══ dragSort.js — 鼠标拖拽排序 ═══
   来源：原 学习计划助手.html 第 954-1010 行。无逻辑改动。
   dragState 在 state.js 中声明。 */

// ═══════ MOUSE DRAG SORT ═══════
function setupDragListeners() {
    const tbody = document.getElementById('plan-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('.drag-handle').forEach(handle => {
        handle.addEventListener('mousedown', onDragMouseDown);
    });
}

function onDragMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const tr = e.target.closest('tr');
    if (!tr || !tr.dataset.taskId) return;
    const tbody = document.getElementById('plan-tbody');
    const rows = [...tbody.querySelectorAll('tr[draggable]')];
    if (rows.length < 2) return;
    dragState = { srcId: tr.dataset.taskId, srcTr: tr, startY: e.clientY, rows };
    tr.style.opacity = '0.35';
    document.addEventListener('mousemove', onDragMouseMove);
    document.addEventListener('mouseup', onDragMouseUp);
}

function onDragMouseMove(e) {
    if (!dragState) return;
    const rows = [...document.getElementById('plan-tbody').querySelectorAll('tr[draggable]')];
    const srcIdx = rows.indexOf(dragState.srcTr);
    let after = null;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i] === dragState.srcTr) continue;
        const mid = rows[i].getBoundingClientRect().top + rows[i].getBoundingClientRect().height / 2;
        if (e.clientY < mid) { after = rows[i]; break; }
    }
    if (after && after !== dragState.srcTr) {
        document.getElementById('plan-tbody').insertBefore(dragState.srcTr, after);
    } else if (!after) {
        document.getElementById('plan-tbody').appendChild(dragState.srcTr);
    }
}

function onDragMouseUp(e) {
    document.removeEventListener('mousemove', onDragMouseMove);
    document.removeEventListener('mouseup', onDragMouseUp);
    if (!dragState) return;
    dragState.srcTr.style.opacity = '';
    const finalRows = [...document.getElementById('plan-tbody').querySelectorAll('tr[draggable]')];
    finalRows.forEach((tr, i) => {
        const task = data.tasks.find(t => t.id === tr.dataset.taskId);
        if (task) task.sortOrder = i;
    });
    saveData();
    renderPlanner();
    showToast('↕ 排序已更新');
    dragState = null;
}
