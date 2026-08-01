/* ═══ io.js — 数据导入导出 ═══
   来源：原 学习计划助手.html 第 2013-2020 行（exportData）+ 2335-2352 行（importData）。无逻辑改动。 */

// ═══════════ DATA ═══════════
function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Flow_备份_${today()}.json`;
    a.click();
    showToast('📥 已导出');
}

function importData(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        try {
            const d = JSON.parse(ev.target.result);
            if (!d.tasks) throw new Error('');
            data = d;
            saveData();
            showToast('📤 已导入');
            if (document.getElementById('page-planner').classList.contains('active')) renderPlanner();
            if (document.getElementById('page-today').classList.contains('active')) renderToday();
        } catch (x) { showToast('❌ 格式错误'); }
    };
    r.readAsText(f);
    e.target.value = '';
}
