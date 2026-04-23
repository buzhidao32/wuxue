import { getCachedData } from './cacheService.js';
import { debugInfo, debugWarn } from './debugLogService.js';
import { fetchAndCacheResource, syncVersionedResources } from './versionService.js';
import { getResourceDefinition, getVersionedResourceIds } from './resourceRegistry.js';

const inflightLoads = new Map();
const inflightWarmups = new Map();

function withSingleFlight(map, key, factory) {
    if (map.has(key)) {
        return map.get(key);
    }

    const promise = factory().finally(() => {
        map.delete(key);
    });

    map.set(key, promise);
    return promise;
}

async function resolveCachedOrRescue(resourceId, options = {}) {
    const definition = getResourceDefinition(resourceId);
    const cachedData = await getCachedData(definition.cacheKey);
    if (cachedData) {
        debugInfo('data.cache.hit', {
            resourceId: definition.id,
            cacheKey: definition.cacheKey,
            mode: 'direct'
        });
        return cachedData;
    }

    console.warn(`缓存缺失，尝试恢复 ${definition.cacheKey}`);
    debugWarn('data.cache.miss', {
        resourceId: definition.id,
        cacheKey: definition.cacheKey,
        fallback: 'rescue-fetch',
        selectedSource: options.source ?? null,
        fallbackSource: options.fallbackSource ?? null
    });

    if (options.source === 'cache' && options.fallbackSource) {
        const rescue = await fetchAndCacheResource(resourceId, {
            source: options.fallbackSource,
            saveToCache: false
        });
        console.log(`缓存缺失，临时使用${options.fallbackSource === 'remote' ? '远端' : '本地'} ${definition.cacheKey}`);
        debugWarn('data.cache.miss.degraded_fallback', {
            resourceId: definition.id,
            cacheKey: definition.cacheKey,
            fallbackSource: options.fallbackSource,
            source: rescue.url
        });
        return rescue.data;
    }

    const rescue = await fetchAndCacheResource(resourceId, {
        source: options.source
    });
    console.log(`从 ${rescue.url} 恢复 ${definition.cacheKey}`);
    debugInfo('data.rescue.succeeded', {
        resourceId: definition.id,
        cacheKey: definition.cacheKey,
        source: rescue.url,
        selectedSource: rescue.selectedSource ?? options.source ?? null
    });
    return rescue.data;
}

async function loadVersionedResource(resourceId, options = {}) {
    const definition = getResourceDefinition(resourceId);

    return withSingleFlight(inflightLoads, definition.id, async () => {
        debugInfo('data.load.started', {
            resourceId: definition.id,
            cacheKey: definition.cacheKey
        });
        const syncResult = await syncVersionedResources([definition.id], options);

        if (syncResult.versionCheckFailed) {
            console.warn(`版本源检查失败，回退缓存 ${definition.cacheKey}`);
            debugWarn('data.load.version_check_failed', {
                resourceId: definition.id,
                cacheKey: definition.cacheKey,
                message: String(syncResult.error?.message || syncResult.error || 'version-check-failed')
            });
            const cachedData = await getCachedData(definition.cacheKey);
            if (cachedData) {
                debugInfo('data.load.completed', {
                    resourceId: definition.id,
                    cacheKey: definition.cacheKey,
                    source: 'cache-after-version-check-failed'
                });
                return cachedData;
            }

            throw syncResult.error || new Error(`Unable to load ${definition.cacheKey} without a valid version source`);
        }

        const shouldUseSelectedSourceData = !syncResult.localVersion
            || syncResult.updatedResourceIds.length > 0
            || syncResult.savedVersion;

        if (shouldUseSelectedSourceData) {
            const freshData = await getCachedData(definition.cacheKey);
            if (freshData) {
                console.log(`优先使用${syncResult.selectedSource === 'remote' ? '远端' : '本地'} ${definition.cacheKey}`);
                debugInfo('data.load.completed', {
                    resourceId: definition.id,
                    cacheKey: definition.cacheKey,
                    source: 'selected-source-or-refreshed-cache',
                    selectedSource: syncResult.selectedSource,
                    updatedResourceIds: syncResult.updatedResourceIds,
                    savedVersion: syncResult.savedVersion
                });
                return freshData;
            }
        }

        console.log(`选中来源版本未变化，使用缓存 ${definition.cacheKey}`);
        debugInfo('data.load.completed', {
            resourceId: definition.id,
            cacheKey: definition.cacheKey,
            source: 'cache',
            selectedSource: syncResult.selectedSource,
            fallbackSource: syncResult.fallbackSource,
            updatedResourceIds: syncResult.updatedResourceIds,
            savedVersion: syncResult.savedVersion
        });
        return resolveCachedOrRescue(definition.id, {
            source: syncResult.selectedSource,
            fallbackSource: syncResult.fallbackSource
        });
    });
}

async function loadVersionedResources(resourceIds, options = {}) {
    const entries = await Promise.all(resourceIds.map(async (resourceId) => {
        const definition = getResourceDefinition(resourceId);
        const data = await loadVersionedResource(definition.id, options);
        return [definition.id, data];
    }));

    return Object.fromEntries(entries);
}

async function warmVersionedResources(resourceIds = getVersionedResourceIds(), options = {}) {
    const ids = resourceIds.map(resourceId => getResourceDefinition(resourceId).id).sort();
    const key = ids.join('|');

    return withSingleFlight(inflightWarmups, key, async () => {
        debugInfo('data.warmup.started', {
            resourceIds: ids
        });
        const syncResult = await syncVersionedResources(ids, options);
        if (syncResult.versionCheckFailed) {
            console.warn('Background refresh skipped because version source resolution failed');
            debugWarn('data.warmup.version_check_failed', {
                resourceIds: ids,
                message: String(syncResult.error?.message || syncResult.error || 'version-check-failed')
            });
        }
        debugInfo('data.warmup.completed', {
            resourceIds: ids,
            selectedSource: syncResult.selectedSource,
            updatedResourceIds: syncResult.updatedResourceIds,
            failedResourceIds: syncResult.failedResourceIds,
            savedVersion: syncResult.savedVersion
        });
        return syncResult;
    });
}

export {
    loadVersionedResource,
    loadVersionedResources,
    warmVersionedResources
};
