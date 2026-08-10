/* ═══ main.js — Electron 主进程 ═══
   职责：
   1. 创建主窗口（加载 index.html）
   2. 创建菜单栏 Tray 图标 + 实时计时文字 + 右键操作菜单
   3. IPC 桥接：接收渲染进程的番茄钟状态 → 更新 Tray
   4. 原生 macOS 通知（主进程 + 渲染进程双保险）
   5. 原生菜单栏（文件/编辑/视图/帮助）
   6. 窗口关闭时隐藏到后台，菜单栏图标常驻 */

const {
    app, BrowserWindow, Tray, Menu, Notification,
    nativeImage, ipcMain, shell
} = require('electron');
const path = require('path');

// ═══════════ 修复：Chromium 用户数据目录 ═══════════
// 开发模式：指向项目目录，避免系统目录权限问题
// 打包后：使用 macOS 标准路径 ~/Library/Application Support/Flow学习计划助手/
if (!app.isPackaged) {
    app.setPath('userData', path.join(__dirname, 'electron-userdata'));
}

// ═══════════ 修复：禁用 Chromium 沙箱（macOS 系统级 sandbox 冲突时需要） ═══════════
app.commandLine.appendSwitch('no-sandbox');

// ═══════════ 全局状态 ═══════════
let win = null;
let tray = null;
let idleIcon = null;
let runningIcon = null;
let pomoTimer = null;
let pomoState = {
    timeStr: '',
    running: false,
    paused: false,
    isBreak: false,
    taskName: '',
    startedAt: 0,
    totalSec: 0,
    isCountUp: false,
};

// ═══════════ Tray 图标 ═══════════

// 空闲图标：简洁环形（○），macOS 模板图自动适配深色/浅色菜单栏
function createIdleIcon() {
    const size = 22, cx = 11, cy = 11, r = 7.5, sw = 1.8;
    const buf = Buffer.alloc(size * size * 4, 0);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dist = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
            if (dist <= r && dist >= r - sw) {
                const offset = (y * size + x) * 4;
                // 边缘抗锯齿
                const alpha = Math.min(1, Math.min(dist - (r - sw), r - dist) / 0.8);
                buf[offset] = 0;
                buf[offset + 1] = 0;
                buf[offset + 2] = 0;
                buf[offset + 3] = Math.round(255 * Math.max(0, alpha));
            }
        }
    }
    const icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
    icon.setTemplateImage(true);
    return icon;
}

// 运行中图标：暖橙色实心圆（●），视觉上类似番茄的暖色调，非模板图保持色彩
function createRunningIcon() {
    const size = 22, cx = 11, cy = 11, r = 7;
    const buf = Buffer.alloc(size * size * 4, 0);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dist = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
            if (dist <= r) {
                const offset = (y * size + x) * 4;
                const edge = Math.min(1, (r - dist) / 1.2);
                // 暖番茄色 #ff6b3d
                buf[offset] = 255;
                buf[offset + 1] = Math.round(107 * edge);
                buf[offset + 2] = Math.round(61 * edge);
                buf[offset + 3] = Math.round(255 * edge);
            }
        }
    }
    return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

// ═══════════ 构建 Tray 右键菜单 ═══════════
function buildTrayMenu() {
    const { timeStr, running, paused, isBreak, taskName } = pomoState;
    const items = [];

    if (running) {
        items.push({
            label: `⏱ ${timeStr}  —  ${taskName || '番茄钟'}`,
            enabled: false
        });
    } else {
        items.push({ label: 'Flow 学习计划助手', enabled: false });
    }
    items.push({ type: 'separator' });

    items.push({
        label: '📊 打开主窗口',
        click: () => { win.show(); win.focus(); }
    });

    if (running && !isBreak) {
        items.push({ type: 'separator' });
        items.push({
            label: paused ? '▶ 继续计时' : '⏸ 暂停计时',
            click: () => win.webContents.send('tray-action', paused ? 'resume' : 'pause')
        });
        items.push({
            label: '⏹ 结束计时并记录完成量',
            click: () => { win.show(); win.focus(); win.webContents.send('tray-action', 'end'); }
        });
    }

    if (running && isBreak) {
        items.push({ type: 'separator' });
        items.push({
            label: '⏭ 跳过休息',
            click: () => win.webContents.send('tray-action', 'skip-break')
        });
    }

    if (!running && taskName && !isBreak) {
        items.push({ type: 'separator' });
        items.push({
            label: `🔄 再来一组「${taskName}」`,
            click: () => win.webContents.send('tray-action', 'restart')
        });
    }

    items.push({ type: 'separator' });
    items.push({
        label: '退出 Flow',
        click: () => { app.isQuitting = true; app.quit(); }
    });

    return Menu.buildFromTemplate(items);
}

// ═══════════ 原生菜单栏 ═══════════
function buildAppMenu() {
    const template = [
        {
            label: 'Flow',
            submenu: [
                { label: '关于 Flow 学习计划助手', role: 'about' },
                { type: 'separator' },
                { label: '偏好设置…', accelerator: 'Cmd+,',
                    click: () => win?.webContents.send('menu-action', 'open-settings') },
                { type: 'separator' },
                { label: '隐藏 Flow', accelerator: 'Cmd+H', role: 'hide' },
                { label: '隐藏其他', accelerator: 'Cmd+Shift+H', role: 'hideOthers' },
                { type: 'separator' },
                { label: '退出 Flow', accelerator: 'Cmd+Q',
                    click: () => { app.isQuitting = true; app.quit(); } }
            ]
        },
        {
            label: '文件',
            submenu: [
                { label: '导出数据…', accelerator: 'Cmd+Shift+E',
                    click: () => win?.webContents.send('menu-action', 'export') },
                { label: '导入数据…', accelerator: 'Cmd+Shift+I',
                    click: () => win?.webContents.send('menu-action', 'import') }
            ]
        },
        { label: '编辑', submenu: [
            { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
            { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
        ]},
        {
            label: '视图',
            submenu: [
                { label: '今日任务', accelerator: 'Cmd+1', click: () => win?.webContents.send('menu-action', 'nav-today') },
                { label: '月度规划', accelerator: 'Cmd+2', click: () => win?.webContents.send('menu-action', 'nav-planner') },
                { label: '数据分析', accelerator: 'Cmd+3', click: () => win?.webContents.send('menu-action', 'nav-analytics') },
                { label: '设置',       accelerator: 'Cmd+4', click: () => win?.webContents.send('menu-action', 'nav-settings') },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
            ]
        },
        {
            label: '帮助',
            submenu: [
                { label: '使用说明', click: () => {} }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ═══════════ 创建主窗口 ═══════════
function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 840,
        minHeight: 620,
        title: 'Flow 学习计划助手',
        backgroundColor: '#f5f5f7',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
        }
    });

    win.loadFile('index.html');

    win.once('ready-to-show', () => {
        win.show();
    });

    // 关闭按钮 → 隐藏到后台
    win.on('close', (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            win.hide();
        }
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// ═══════════ IPC 处理器 ═══════════

// 主进程独立计时器：从 wall clock 计算倒计时，不受窗口隐藏/节流影响
function startTrayTimer() {
    if (pomoTimer) clearInterval(pomoTimer);
    pomoTimer = setInterval(() => {
        if (!pomoState.running || pomoState.isBreak) return;
        const elapsed = Math.round((Date.now() - pomoState.startedAt) / 1000);
        const remain = pomoState.isCountUp
            ? elapsed
            : Math.max(0, pomoState.totalSec - elapsed);
        const m = Math.floor(remain / 60);
        const s = remain % 60;
        pomoState.timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (tray) tray.setTitle(pomoState.timeStr);
    }, 500);
}

function setupIPC() {
    // ── 番茄钟启动 → 主进程启动独立计时器 ──
    ipcMain.on('pomo-started', (_event, info) => {
        pomoState.startedAt = info.startedAt;
        pomoState.totalSec = info.totalSec;
        pomoState.isCountUp = info.isCountUp;
        pomoState.running = true;
        pomoState.paused = false;
        pomoState.isBreak = false;
        pomoState.taskName = info.taskName || '';
        if (tray) tray.setImage(runningIcon);
        startTrayTimer();
    });

    // ── 番茄钟状态同步（渲染进程 → 主进程，用于暂停/继续/结束） ──
    ipcMain.on('pomo-state', (_event, state) => {
        const wasRunning = pomoState.running && !pomoState.isBreak;
        pomoState.running = state.running;
        pomoState.paused = state.paused;
        pomoState.isBreak = state.isBreak;
        pomoState.taskName = state.taskName || '';
        const isRunning = pomoState.running && !pomoState.isBreak;

        if (tray) {
            if (wasRunning !== isRunning) {
                tray.setImage(isRunning ? runningIcon : idleIcon);
            }
            // 暂停：冻结显示剩余时间；未运行：清空
            if (state.paused && state.timeStr) {
                tray.setTitle(state.timeStr);
            } else if (!isRunning) {
                tray.setTitle('');
            }
            // 菜单改为右键动态弹出，不再常驻 setContextMenu（避免左键误弹）
        }

        // 暂停时停止主进程计时器；继续时重启
        if (!pomoState.running && pomoTimer) {
            clearInterval(pomoTimer);
            pomoTimer = null;
        }
        if (pomoState.running && !pomoState.isBreak && !pomoTimer) {
            startTrayTimer();
        }
    });

    // 番茄钟结束 → 原生通知 + 清除计时器
    ipcMain.on('pomo-finished', (_event, data) => {
        if (pomoTimer) { clearInterval(pomoTimer); pomoTimer = null; }
        try {
            const n = new Notification({
                title: data.isBreak ? '☕ 休息结束' : '🍅 番茄钟完成！',
                body: data.taskName
                    ? `${data.taskName} — ${data.minutes} 分钟${data.isBreak ? '休息' : '专注'}`
                    : `${data.minutes} 分钟`,
                silent: false,
            });
            n.on('click', () => { win.show(); win.focus(); });
            n.show();
        } catch (e) {
            console.error('[notification] 失败:', e.message);
        }
        if (tray) {
            tray.setImage(idleIcon);
            tray.setTitle('');
        }
    });

    // 通用通知
    ipcMain.on('show-notification', (_event, options) => {
        try {
            const n = new Notification({
                title: options.title || 'Flow',
                body: options.body || '',
                silent: options.silent || false,
            });
            n.show();
        } catch (e) {
            console.error('[notification]', e.message);
        }
    });

    // 停用番茄钟
    ipcMain.on('pomo-clear', () => {
        if (pomoTimer) { clearInterval(pomoTimer); pomoTimer = null; }
        pomoState = { timeStr: '', running: false, paused: false, isBreak: false, taskName: '',
            startedAt: 0, totalSec: 0, isCountUp: false };
        if (tray) {
            tray.setImage(idleIcon);
            tray.setTitle('');
        }
    });
}

// ═══════════ 应用生命周期 ═══════════
app.whenReady().then(() => {
    setupIPC();
    createWindow();
    buildAppMenu();

    // 预生成两个图标
    idleIcon = createIdleIcon();
    runningIcon = createRunningIcon();

    // 创建托盘：默认显示空闲图标
    tray = new Tray(idleIcon);
    tray.setToolTip('Flow 学习计划助手');

    // 左键点击：只切换窗口显示/隐藏（不弹菜单）
    tray.on('click', () => {
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    });

    // 右键点击：动态弹出快捷菜单（不常驻菜单，避免左键误弹）
    tray.on('right-click', () => {
        tray.popUpContextMenu(buildTrayMenu());
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            win.show();
            win.focus();
        }
    });
});

app.on('window-all-closed', () => { /* macOS 保持托盘运行 */ });

app.on('before-quit', () => {
    app.isQuitting = true;
});
