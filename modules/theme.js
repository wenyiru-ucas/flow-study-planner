/* ═══ theme.js — 主题切换 ═══
   来源：原 学习计划助手.html 第 677-704 行。无逻辑改动。 */

// ── Theme ──
function getTheme() {
    const saved = localStorage.getItem('flow_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('theme-toggle').textContent = t === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('flow_theme', t);
}
function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
    // Re-render charts if analytics is visible
    if (document.getElementById('page-analytics').classList.contains('active')) renderAnalytics();
}
// Listen for system theme changes (only when user hasn't set a preference)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('flow_theme')) applyTheme(e.matches ? 'dark' : 'light');
});
function getTaskColor(idx) {
    const colors = (document.documentElement.getAttribute('data-theme') === 'dark') ? TASK_COLORS_DARK : TASK_COLORS;
    return colors[idx % colors.length];
}
function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
