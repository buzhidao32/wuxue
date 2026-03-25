import { isNativeApp } from '../runtimeConfig.js';
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
        fallback: 'rescue-fetch'
    });
    const rescue = await fetchAndCacheResource(resourceId, {
        preferRemote: options.preferRemote,
        remoteOnly: false
    });
    console.log(`从 ${rescue.url} 恢复 ${definition.cacheKey}`);
    debugInfo('data.rescue.succeeded', {
        resourceId: definition.id,
        cacheKey: definition.cacheKey,
        source: rescue.url
    });
    return rescue.data;
}

async function loadVersionedResource(resourceId, options = {}) {
    const preferRemote = options.preferRemote ?? isNativeApp();
    const definition = getResourceDefinition(resourceId);

    return withSingleFlight(inflightLoads, definition.id, async () => {
        debugInfo('data.load.started', {
            resourceId: definition.id,
            cacheKey: definition.cacheKey,
            preferRemote
        });
        const syncResult = await syncVersionedResources([definition.id], {
            preferRemote
        });

        if (syncResult.versionCheckFailed) {
            console.warn(`远端版本检查失败，回退缓存 ${definition.cacheKey}`);
            debugWarn('data.load.version_check_failed', {
                resourceId: definition.id,
                cacheKey: definition.cacheKey
            });
            return resolveCachedOrRescue(definition.id, { preferRemote });
        }

        const shouldUseRemoteData = !syncResult.localVersion
            || syncResult.updatedResourceIds.length > 0
            || syncResult.savedVersion;

        if (shouldUseRemoteData) {
            const freshData = await getCachedData(definition.cacheKey);
            if (freshData) {
                console.log(`优先使用远端 ${definition.cacheKey}`);
                debugInfo('data.load.completed', {
                    resourceId: definition.id,
                    cacheKey: definition.cacheKey,
                    source: 'remote-or-refreshed-cache',
                    updatedResourceIds: syncResult.updatedResourceIds,
                    savedVersion: syncResult.savedVersion
                });
                return freshData;
            }
        }

        console.log(`远端版本未变化，使用缓存 ${definition.cacheKey}`);
        debugInfo('data.load.completed', {
            resourceId: definition.id,
            cacheKey: definition.cacheKey,
            source: 'cache',
            updatedResourceIds: syncResult.updatedResourceIds,
            savedVersion: syncResult.savedVersion
        });
        return resolveCachedOrRescue(definition.id, { preferRemote });
    });
}

async function loadVersionedResources(resourceIds, options = {}) {
    const result = {};

    for (const resourceId of resourceIds) {
        const definition = getResourceDefinition(resourceId);
        result[definition.id] = await loadVersionedResource(definition.id, options);
    }

    return result;
}

async function warmVersionedResources(resourceIds = getVersionedResourceIds(), options = {}) {
    const preferRemote = options.preferRemote ?? isNativeApp();
    const ids = resourceIds.map(resourceId => getResourceDefinition(resourceId).id).sort();
    const key = ids.join('|');

    return withSingleFlight(inflightWarmups, key, async () => {
        debugInfo('data.warmup.started', {
            resourceIds: ids,
            preferRemote
        });
        const syncResult = await syncVersionedResources(ids, { preferRemote });
        if (syncResult.versionCheckFailed) {
            console.warn('Background refresh skipped because remote version check failed');
            debugWarn('data.warmup.version_check_failed', {
                resourceIds: ids
            });
        }
        debugInfo('data.warmup.completed', {
            resourceIds: ids,
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
