/* ═══ preload.js — 安全的 Electron IPC 桥接层 ═══
   使用 contextBridge 向渲染进程暴露最小化 API，
   不开启 nodeIntegration，遵循安全最佳实践。 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ── 番茄钟启动 → 主进程（启动独立 Tray 计时器） ──
    sendPomoStarted: (info) => ipcRenderer.send('pomo-started', info),

    // ── 番茄钟状态 → 主进程（更新 Tray 标题 & 菜单） ──
    sendPomoState: (state) => ipcRenderer.send('pomo-state', state),

    // ── 番茄钟结束 → 主进程（弹原生通知） ──
    sendPomoFinished: (data) => ipcRenderer.send('pomo-finished', data),

    // ── UI 通知 → 主进程（原生通知） ──
    showNotification: (options) => ipcRenderer.send('show-notification', options),

    // ── 监听 Tray 菜单操作 ← 主进程 ──
    onTrayAction: (callback) => {
        ipcRenderer.on('tray-action', (_event, action) => callback(action));
    },

    // ── 监听原生菜单操作 ← 主进程 ──
    onMenuAction: (callback) => {
        ipcRenderer.on('menu-action', (_event, action) => callback(action));
    },

    // ── 停用番茄钟（清空 Tray） ──
    clearPomoState: () => ipcRenderer.send('pomo-clear'),
});
