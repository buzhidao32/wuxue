import { isNativeApp } from '../runtimeConfig.js';
import { replaceAllCachedData } from './cacheService.js';
import { debugError, debugInfo, debugWarn } from './debugLogService.js';
import { fetchJsonFromCandidates } from './fetchService.js';
import { getResourceDefinition, getVersionedResourceIds } from './resourceRegistry.js';

const VERSION_PATH = 'data/version.json';

const LOCAL_VERSION_OPTIONS = {
    preferRemote: false,
    localOnly: true,
    preferFormat: 'json'
};
const REMOTE_VERSION_OPTIONS = {
    preferRemote: true,
    remoteOnly: true,
    preferFormat: 'json'
};
const LOCAL_RESOURCE_OPTIONS = {
    preferRemote: false,
    localOnly: true
};
const REMOTE_RESOURCE_OPTIONS = {
    preferRemote: true,
    remoteOnly: true
};

function createAbortBridge(signal) {
    const controller = new AbortController();

    if (!signal) {
        return {
            signal: controller.signal,
            abort() {
                controller.abort();
            },
            dispose() {}
        };
    }

    if (signal.aborted) {
        controller.abort();
        return {
            signal: controller.signal,
            abort() {
                controller.abort();
            },
            dispose() {}
        };
    }

    const onAbort = () => {
        controller.abort();
    };

    signal.addEventListener('abort', onAbort, { once: true });

    return {
        signal: controller.signal,
        abort() {
            controller.abort();
        },
        dispose() {
            signal.removeEventListener('abort', onAbort);
        }
    };
}

function emitProgress(options, progress) {
    if (typeof options.onProgress === 'function') {
        options.onProgress(progress);
    }
}

function throwIfAborted(signal) {
    if (signal?.aborted) {
        throw new DOMException('操作已超时', 'AbortError');
    }
}

function getAbortReason(...settledResults) {
    return settledResults.find((result) => (
        result.status === 'rejected' && result.reason?.name === 'AbortError'
    ))?.reason;
}

function parseDateVersion(version) {
    if (typeof version !== 'string') {
        return null;
    }

    const match = version.trim().match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\..+)?$/);
    if (!match) {
        return null;
    }

    return {
        year: Number.parseInt(match[1], 10),
        month: Number.parseInt(match[2], 10),
        day: Number.parseInt(match[3], 10)
    };
}

function compareParsedDateVersions(left, right) {
    if (left.year !== right.year) {
        return left.year > right.year ? 1 : -1;
    }

    if (left.month !== right.month) {
        return left.month > right.month ? 1 : -1;
    }

    if (left.day !== right.day) {
        return left.day > right.day ? 1 : -1;
    }

    return 0;
}

function getUsableVersionResult(source, settledResult) {
    if (settledResult.status !== 'fulfilled') {
        return null;
    }

    const parsedVersion = parseDateVersion(settledResult.value.data?.version);
    if (!parsedVersion) {
        return null;
    }

    return {
        source,
        data: settledResult.value.data,
        url: settledResult.value.url,
        parsedVersion
    };
}

async function resolveForceRefreshSource(options = {}) {
    const platform = isNativeApp() ? 'native' : 'browser';
    const signal = options.signal;
    const [localSettled, remoteSettled] = await Promise.allSettled([
        fetchJsonFromCandidates(VERSION_PATH, { ...LOCAL_VERSION_OPTIONS, signal }),
        fetchJsonFromCandidates(VERSION_PATH, { ...REMOTE_VERSION_OPTIONS, signal })
    ]);
    const abortReason = getAbortReason(localSettled, remoteSettled);
    if (signal?.aborted && abortReason) {
        throw abortReason;
    }
    throwIfAborted(signal);

    const localResult = getUsableVersionResult('local', localSettled);
    const remoteResult = getUsableVersionResult('remote', remoteSettled);

    if (localResult && remoteResult) {
        const comparison = compareParsedDateVersions(remoteResult.parsedVersion, localResult.parsedVersion);
        if (comparison >= 0) {
            return {
                sourceMode: comparison === 0 ? `${platform}-remote-equal` : `${platform}-remote-newer`,
                versionResult: remoteResult,
                resourceOptions: REMOTE_RESOURCE_OPTIONS
            };
        }

        return {
            sourceMode: `${platform}-local-newer`,
            versionResult: localResult,
            resourceOptions: LOCAL_RESOURCE_OPTIONS
        };
    }

    if (remoteResult) {
        return {
            sourceMode: `${platform}-remote-only`,
            versionResult: remoteResult,
            resourceOptions: REMOTE_RESOURCE_OPTIONS
        };
    }

    if (localResult) {
        return {
            sourceMode: `${platform}-local-only`,
            versionResult: localResult,
            resourceOptions: LOCAL_RESOURCE_OPTIONS
        };
    }

    throw new Error('无法获取可用的 version.json');
}

async function clearSiteCacheStorage() {
    if (!('caches' in window)) {
        return [];
    }

    try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        return cacheNames;
    } catch (error) {
        debugWarn('force_refresh.cache_storage_clear_failed', {
            message: String(error.message || error)
        });
        return [];
    }
}

async function forceRefreshAllData(options = {}) {
    const resourceIds = getVersionedResourceIds();
    const totalSteps = resourceIds.length + 3;
    let completedSteps = 0;

    const updateProgress = (stage) => {
        emitProgress(options, {
            completed: completedSteps,
            total: totalSteps,
            stage
        });
    };

    debugInfo('force_refresh.started', {
        resourceIds
    });
    updateProgress('正在准备数据源');

    try {
        throwIfAborted(options.signal);
        const refreshSource = await resolveForceRefreshSource(options);
        const versionResult = refreshSource.versionResult;
        const resourceAbortBridge = createAbortBridge(options.signal);
        completedSteps += 1;
        updateProgress('正在下载数据');
        let resourceResults;

        try {
            resourceResults = await Promise.all(resourceIds.map(async (resourceId) => {
                try {
                    throwIfAborted(resourceAbortBridge.signal);
                    const definition = getResourceDefinition(resourceId);
                    const result = await fetchJsonFromCandidates(definition.requestPath, {
                        ...refreshSource.resourceOptions,
                        signal: resourceAbortBridge.signal
                    });
                    completedSteps += 1;
                    updateProgress('正在下载数据');
                    return {
                        definition,
                        result
                    };
                } catch (error) {
                    resourceAbortBridge.abort();
                    throw error;
                }
            }));
        } finally {
            resourceAbortBridge.dispose();
        }

        throwIfAborted(options.signal);
        updateProgress('正在写入缓存');
        const records = [
            {
                filename: 'version.json',
                data: versionResult.data,
                source: versionResult.url,
                version: versionResult.data?.version ?? null
            },
            ...resourceResults.map(({ definition, result }) => ({
                filename: definition.cacheKey,
                data: result.data,
                source: result.url,
                version: versionResult.data?.files?.[definition.versionKey] ?? versionResult.data?.version ?? null
            }))
        ];
        const replaced = await replaceAllCachedData(records);

        if (!replaced) {
            throw new Error('新数据已下载，但写入本地缓存失败');
        }

        completedSteps += 1;
        updateProgress('正在清理浏览器缓存');
        throwIfAborted(options.signal);
        const clearedCacheStorageNames = await clearSiteCacheStorage();
        completedSteps += 1;
        updateProgress('即将刷新页面');

        debugInfo('force_refresh.completed', {
            sourceMode: refreshSource.sourceMode,
            version: versionResult.data?.version ?? null,
            versionSource: versionResult.url,
            resourceIds,
            clearedCacheStorageNames
        });

        return {
            sourceMode: refreshSource.sourceMode,
            version: versionResult.data?.version ?? null,
            versionSource: versionResult.url,
            resourceIds,
            clearedCacheStorageNames
        };
    } catch (error) {
        debugError('force_refresh.failed', {
            message: String(error.message || error)
        });
        throw error;
    }
}

export {
    forceRefreshAllData
};
