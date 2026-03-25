const DEBUG_LOG_LIMIT = 200;
const DEBUG_NAMESPACE = 'remote-update';

function ensureDebugStore() {
    if (!window.__WUXUE_DEBUG_LOGS) {
        window.__WUXUE_DEBUG_LOGS = [];
    }

    return window.__WUXUE_DEBUG_LOGS;
}

function isDebugEnabled() {
    return window.WUXUE_DEBUG_REMOTE_UPDATE !== false;
}

function normalizeDetails(details = {}) {
    return Object.fromEntries(
        Object.entries(details).filter(([, value]) => value !== undefined)
    );
}

function appendDebugLog(level, event, details = {}) {
    const logs = ensureDebugStore();
    const entry = {
        timestamp: new Date().toISOString(),
        namespace: DEBUG_NAMESPACE,
        level,
        event,
        details: normalizeDetails(details)
    };

    logs.push(entry);
    if (logs.length > DEBUG_LOG_LIMIT) {
        logs.shift();
    }

    if (!isDebugEnabled()) {
        return entry;
    }

    const consoleMethod = console[level] ?? console.log;
    consoleMethod(`[wuxue:${DEBUG_NAMESPACE}] ${event}`, entry.details);
    return entry;
}

function debugInfo(event, details) {
    return appendDebugLog('info', event, details);
}

function debugWarn(event, details) {
    return appendDebugLog('warn', event, details);
}

function debugError(event, details) {
    return appendDebugLog('error', event, details);
}

function getDebugLogs() {
    return [...ensureDebugStore()];
}

function clearDebugLogs() {
    ensureDebugStore().length = 0;
}

window.WUXUE_DEBUG = window.WUXUE_DEBUG || {};
window.WUXUE_DEBUG.getRemoteUpdateLogs = getDebugLogs;
window.WUXUE_DEBUG.clearRemoteUpdateLogs = clearDebugLogs;

export {
    clearDebugLogs,
    debugError,
    debugInfo,
    debugWarn,
    getDebugLogs,
    isDebugEnabled
};
