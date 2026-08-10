/* ═══ config.js — 全局常量配置 ═══
   来源：原 学习计划助手.html 第 669-675 行、708 行。无逻辑改动。

   【痛点1改动】标签颜色精简为 4 色（红/琥珀黄/蓝/绿）：
   - TASK_COLORS：浅色基准色（存储统一用基准色）
   - TASK_COLORS_DARK：深色模式显示变体
   - getDisplayColor()：显示时按主题映射深色变体
   - migrateTaskColors()：按任务标签迁移（法考=红 / 考公=蓝 / 其他=绿） */

const STORAGE_KEY = 'flow_study_data';

// 4 色基准（浅色模式 = 存储标准值；琥珀黄避免刺眼）
const TASK_COLORS = ['#ff3b30', '#f5a623', '#0071e3', '#34c759'];  // 红 / 琥珀黄 / 蓝 / 绿
// 深色模式显示变体（更柔和，保证深色背景下不刺眼）
const TASK_COLORS_DARK = ['#ff6b6b', '#f0b960', '#5db8fe', '#5ce694'];

// ── 用户可配置色板（settings.palette，可手动增删） ──
function getPalette() {
    const pal = data.settings && data.settings.palette;
    return (Array.isArray(pal) && pal.length) ? pal : TASK_COLORS;
}

// 添加颜色到色板（返回是否成功；重复/非法返回 false）
function addPaletteColor(hex) {
    const c = String(hex || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(c)) return false;
    if (!data.settings.palette) data.settings.palette = [...TASK_COLORS];
    if (data.settings.palette.some(x => String(x).toLowerCase() === c)) return false;
    data.settings.palette.push(c);
    saveData();
    return true;
}

// 从色板删除颜色（至少保留 1 个；不影响已用该色的任务）
function removePaletteColor(hex) {
    const pal = getPalette();
    if (pal.length <= 1) return false;
    const c = String(hex || '').toLowerCase();
    const idx = pal.findIndex(x => String(x).toLowerCase() === c);
    if (idx < 0) return false;
    pal.splice(idx, 1);
    saveData();
    return true;
}

// 基准色 → 深色变体 映射（getDisplayColor 用）
const TASK_COLOR_DARK_MAP = {
    '#ff3b30': '#ff6b6b',
    '#f5a623': '#f0b960',
    '#0071e3': '#5db8fe',
    '#34c759': '#5ce694',
};

// 显示颜色：深色模式下把基准色映射为深色变体，浅色模式原样
function getDisplayColor(hex) {
    if (!hex) return hex;
    if (document.documentElement.getAttribute('data-theme') !== 'dark') return hex;
    return TASK_COLOR_DARK_MAP[hex.toLowerCase()] || hex;
}

// ── 标签颜色配置（data.settings.tagColors: { 标签名: 颜色 }） ──

// 标签 → 颜色：精确匹配优先 → 按配置键子串匹配（长键优先）→ 默认绿
function getTagColor(tag) {
    const cfg = (data.settings && data.settings.tagColors) || {};
    if (cfg[tag]) return cfg[tag];
    const keys = Object.keys(cfg).sort((a, b) => b.length - a.length);
    for (const k of keys) {
        if (tag.includes(k)) return cfg[k];
    }
    return TASK_COLORS[3];
}

// 任务颜色 = 任务所有标签中「已配置颜色」的标签优先，全部未配置则默认绿
function taskColorFor(task) {
    if (!task || !task.tags) return TASK_COLORS[3];
    const tags = String(task.tags).split(/[,，]/).map(s => s.trim()).filter(Boolean);
    for (const tag of tags) {
        const c = getTagColor(tag);
        if (c !== TASK_COLORS[3]) return c;
    }
    return TASK_COLORS[3];
}

// 初始化标签颜色配置（仅首次）：按旧规则生成（法考=红 / 考公=蓝 / 其他=绿），之后用户可自定义
function initTagColors() {
    if (!data.settings) data.settings = {};
    if (data.settings.tagColors) return;
    const cfg = {};
    const seen = new Set();
    (data.tasks || []).forEach(t => {
        String(t.tags || '').split(/[,，]/).map(s => s.trim()).filter(Boolean).forEach(tag => {
            if (seen.has(tag)) return;
            seen.add(tag);
            if (tag.includes('法考')) cfg[tag] = TASK_COLORS[0];
            else if (tag.includes('考公')) cfg[tag] = TASK_COLORS[2];
            else cfg[tag] = TASK_COLORS[3];
        });
    });
    data.settings.tagColors = cfg;
    saveData();
}

// 同步任务颜色到标签配置（幂等）：每个任务取标签配置色
function migrateTaskColors() {
    let changed = false;
    (data.tasks || []).forEach(t => {
        const target = taskColorFor(t);
        if (t.color !== target) { t.color = target; changed = true; }
    });
    if (changed) {
        saveData();
        showToast('🎨 已同步任务颜色与标签配置');
    }
    return changed;
}

const EXERCISE_MODULES = ['言语理解', '判断推理', '数量关系', '资料分析', '常识'];
