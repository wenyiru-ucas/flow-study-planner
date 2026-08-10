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
    refreshThemePages();
}
// 主题切换后重渲染当前可见页面（getDisplayColor 深色映射生效）
function refreshThemePages() {
    if (document.getElementById('page-planner').classList.contains('active')) renderPlanner();
    if (document.getElementById('page-today').classList.contains('active')) renderToday();
    if (document.getElementById('page-analytics').classList.contains('active')) renderAnalytics();
}
// Listen for system theme changes (only when user hasn't set a preference)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('flow_theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
        refreshThemePages();
    }
});
function getTaskColor(idx) {
    // 从用户可配置色板取色（存储标准值），显示时由 getDisplayColor 做深色映射
    const pal = getPalette();
    return pal[idx % pal.length];
}
function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
