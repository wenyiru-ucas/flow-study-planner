/* ═══ data.js — 数据加载与保存 ═══
   来源：原 学习计划助手.html 第 714-743 行。

   saveData() 已按计划改造：
   - localStorage 主存储保持不变，但加了 try/catch（配额超限时不崩溃）
   - 末尾调用 scheduleBackup() 触发去抖的 IndexedDB 快照（第 2 步注入）

   IndexedDB 备份逻辑也集中在本文件：
   - SCHEMA_VERSION：数据结构版本号，未来 schema 演进用
   - openBackupDB / writeSnapshot / scheduleBackup / listSnapshots 等
   - 所有操作 try/catch 降级，隐私模式或禁用 IndexedDB 时不影响主功能
*/

// ── localStorage 数据读写 ──
function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) try { data = JSON.parse(raw); } catch (e) {}
    data.tasks = (data.tasks || []).map(t => ({ id: t.id || crypto.randomUUID(), name: t.name || '', start: t.start ||
            '', end: t.end || '', total: t.total || 0, done: t.done || 0, days: t.days || 0, type: t.type ||
            'regular', status: t.status || 'active', note: t.note || '', pomoMinutes: t.pomoMinutes || 0, color: t
            .color || getTaskColor(Math.floor(Math.random() * TASK_COLORS.length)),
        completedDate: t.completedDate || '',
        sortOrder: t.sortOrder || 0,
        tags: t.tags || '',
        timerMode: t.timerMode || 'countdown',
        pomoUnits: t.pomoUnits || 0,
        pomoProductive: t.pomoProductive || 0,
    }));
    if (!data.pomodoroSessions) data.pomodoroSessions = [];
    if (!data.settings) data.settings = { apiKey: '', reminderTime: '09:00', pomoWork: 60, pomoBreak: 5 };
    if (!data.settings.wrongTags) data.settings.wrongTags = ['概念不熟', '粗心', '时间不够蒙的', '计算错误'];
    if (!data.settings.exerciseRefTimes) data.settings.exerciseRefTimes = { '言语理解': 1.0, '判断推理': 1.0, '数量关系': 1.5, '资料分析': 1.5, '常识': 0.8 };
    if (!data.exerciseRecords) data.exerciseRecords = [];
    if (!data.dailyDone) data.dailyDone = {};
    if (!data.tempChecklist) data.tempChecklist = [];
    if (!data.countdowns) data.countdowns = [];
    if (!data.monthlyGoals) data.monthlyGoals = {};
    if (data.monthlyGoal && !data.monthlyGoals[`${new Date().getFullYear()}-${new Date().getMonth()+1}`]) {
        data.monthlyGoals[`${new Date().getFullYear()}-${new Date().getMonth()+1}`] = data.monthlyGoal;
        delete data.monthlyGoal;
    }
}

function saveData() {
    const payload = JSON.stringify(data);
    try {
        localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
        console.error('localStorage 写入失败（可能配额超限），已尝试备份到 IndexedDB', e);
        if (typeof showToast === 'function') showToast('⚠️ 本地存储写入失败，已尝试备份');
    }
    scheduleBackup();
}

// ── IndexedDB 自动备份 + 版本快照 ──
const SCHEMA_VERSION = 1;
const BACKUP_DB_NAME = 'flow_study_backup';
const BACKUP_STORE = 'snapshots';
const MAX_SNAPSHOTS = 50;          // 最多保留 50 份快照
const BACKUP_DEBOUNCE_MS = 30000;  // 去抖窗口：30 秒内最多写一份

let _dbPromise = null;
let _lastBackupTs = 0;
let _backupTimer = null;
let _todayBackedUp = false;

function openBackupDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        try {
            if (!('indexedDB' in window)) { reject(new Error('no indexeddb')); return; }
            const req = indexedDB.open(BACKUP_DB_NAME, 1);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(BACKUP_STORE)) {
                    db.createObjectStore(BACKUP_STORE, { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (e) { reject(e); }
    });
    return _dbPromise;
}

// 实际写入一条快照（异步，失败静默降级）
async function writeSnapshot(trigger = 'interval') {
    try {
        const db = await openBackupDB();
        const tx = db.transaction(BACKUP_STORE, 'readwrite');
        const store = tx.objectStore(BACKUP_STORE);
        const payload = JSON.stringify(data);
        const todayStr = typeof today === 'function' ? today() : '';
        store.add({
            timestamp: Date.now(),
            date: todayStr,
            schemaVersion: SCHEMA_VERSION,
            data: payload,
            theme: localStorage.getItem('flow_theme') || '',
            trigger,
            size: payload.length
        });
        // 超出上限删最早的
        store.count().onsuccess = e => {
            const cnt = e.target.result;
            if (cnt > MAX_SNAPSHOTS) {
                // 用游标删最早 (cnt - MAX_SNAPSHOTS) 条
                const del = store.openCursor();
                let toDel = cnt - MAX_SNAPSHOTS;
                del.onsuccess = ev => {
                    const cursor = ev.target.result;
                    if (cursor && toDel > 0) {
                        cursor.delete();
                        toDel--;
                        cursor.continue();
                    }
                };
            }
        };
        _lastBackupTs = Date.now();
        if (todayStr) _todayBackedUp = true;
        return true;
    } catch (e) {
        console.warn('IndexedDB 快照写入失败（已降级，不影响主功能）', e);
        return false;
    }
}

// 去抖：30 秒内最多一份快照；但每日首份强制写入
function scheduleBackup() {
    // 1. 每日首份快照（保证每天至少有一份历史可恢复）
    const td = (typeof today === 'function') ? today() : '';
    if (td && !_todayBackedUp) {
        writeSnapshot('daily');
        return;
    }
    // 2. 去抖：距上次写入不足窗口则跳过
    if (Date.now() - _lastBackupTs < BACKUP_DEBOUNCE_MS) {
        if (_backupTimer) clearTimeout(_backupTimer);
        _backupTimer = setTimeout(() => writeSnapshot('interval'), BACKUP_DEBOUNCE_MS);
        return;
    }
    writeSnapshot('interval');
}

// 列出全部快照（按时间倒序，给设置页用）
async function listSnapshots(limit = 20) {
    try {
        const db = await openBackupDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_STORE, 'readonly');
            const store = tx.objectStore(BACKUP_STORE);
            const req = store.getAll();
            req.onsuccess = () => {
                const all = (req.result || []).slice().sort((a, b) => b.timestamp - a.timestamp);
                resolve(limit ? all.slice(0, limit) : all);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('读取快照列表失败', e);
        return [];
    }
}

// 统计信息（快照总数 / 占用估算 / 最早最新时间）
async function getBackupStats() {
    const all = await listSnapshots(0);
    if (!all.length) return { count: 0, totalSize: 0, earliest: null, latest: null };
    const totalSize = all.reduce((s, x) => s + (x.size || 0), 0);
    return {
        count: all.length,
        totalSize,
        earliest: all[all.length - 1].timestamp,
        latest: all[0].timestamp
    };
}

// 恢复到指定快照 id
async function restoreSnapshot(id) {
    try {
        const db = await openBackupDB();
        const rec = await new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_STORE, 'readonly');
            const req = tx.objectStore(BACKUP_STORE).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        if (!rec || !rec.data) throw new Error('快照不存在');
        const parsed = JSON.parse(rec.data);
        if (!parsed.tasks) throw new Error('快照数据无效');
        data = parsed;
        localStorage.setItem(STORAGE_KEY, rec.data);
        if (rec.theme) localStorage.setItem('flow_theme', rec.theme);
        return true;
    } catch (e) {
        console.error('恢复快照失败', e);
        return false;
    }
}

// 清理旧快照（保留最近 N 条）
async function clearOldSnapshots(keep = 10) {
    try {
        const db = await openBackupDB();
        const all = await listSnapshots(0);
        const toRemove = all.slice(keep);
        const tx = db.transaction(BACKUP_STORE, 'readwrite');
        const store = tx.objectStore(BACKUP_STORE);
        toRemove.forEach(r => store.delete(r.id));
        return toRemove.length;
    } catch (e) {
        console.warn('清理快照失败', e);
        return 0;
    }
}

// 删除单条快照
async function deleteSnapshot(id) {
    try {
        const db = await openBackupDB();
        const tx = db.transaction(BACKUP_STORE, 'readwrite');
        tx.objectStore(BACKUP_STORE).delete(id);
        return true;
    } catch (e) { return false; }
}

// 启动检测：localStorage 空但 IndexedDB 有快照（对话1 #20 数据消失的兜底）
async function checkOrphanBackup() {
    try {
        const localEmpty = !localStorage.getItem(STORAGE_KEY);
        if (!localEmpty) return null;
        const stats = await getBackupStats();
        if (stats.count === 0) return null;
        return stats;
    } catch (e) { return null; }
}
