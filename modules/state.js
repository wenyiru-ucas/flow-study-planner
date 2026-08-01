/* ═══ state.js — 全局状态变量集中声明 ═══
   来源：原 学习计划助手.html 第 706-712、955、1172、1590、1723 行。
   传统多 script 加载方式下，所有文件共享同一全局作用域，
   其它文件直接读写这些变量，无需 import/export。 */

let data = { tasks: [], checkins: {}, pomodoroSessions: [], dailyDone: {}, tempChecklist: [], countdowns: [], monthlyGoals: {}, settings: { apiKey: '', reminderTime: '09:00',
        pomoWork: 60, pomoBreak: 5, wrongTags: ['概念不熟', '粗心', '时间不够蒙的', '计算错误'], exerciseRefTimes: { '言语理解': 1.0, '判断推理': 1.0, '数量关系': 1.5, '资料分析': 1.5, '常识': 0.8 } }, exerciseRecords: [] };

let pomoState = { taskId: null, taskName: '', totalSec: 3600, remaining: 3600, isBreak: false, running: false,
    interval: null, elapsedSec: 0 };

let viewMonth = null; // {year, month} — null means current month
let analyticsPeriod = 'week';

// dragSort.js 用（原 955 行声明）
let dragState = null;

// pomodoro.js 用（原 1172 行声明）
let audioCtx = null;

// analytics.js 用（原 1590 行声明）
let charts = {};

// ai.js 用（原 1723 行声明）
let pendingActions = [];
