import { isNativeApp } from '../runtimeConfig.js';
import { getCachedData, saveCachedData } from './cacheService.js';
import { debugError, debugInfo, debugWarn } from './debugLogService.js';
import { fetchJsonFromCandidates } from './fetchService.js';
import { getResourceDefinition, getVersionedResourceIds } from './resourceRegistry.js';

const inflightRemoteVersionRequests = new Map();
const recentRemoteVersions = new Map();
const REMOTE_VERSION_CACHE_MS = 3000;

function getChangedResourceIds(localVersion, serverVersion, resourceIds) {
    if (!resourceIds.length) {
        return [];
    }

    if (!localVersion?.files || !serverVersion?.files) {
        return [...resourceIds];
    }

    return resourceIds.filter(resourceId => {
        const definition = getResourceDefinition(resourceId);
        return localVersion.files[definition.versionKey] !== serverVersion.files[definition.versionKey];
    });
}

async function getRemoteVersion(options = {}) {
    const preferRemote = options.preferRemote ?? isNativeApp();
    const cacheKey = preferRemote ? 'remote' : 'local-first';
    const cached = recentRemoteVersions.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < REMOTE_VERSION_CACHE_MS) {
        debugInfo('version.remote.cache.hit', {
            cacheKey,
            ageMs: Date.now() - cached.timestamp
        });
        return cached.result;
    }

    if (inflightRemoteVersionRequests.has(cacheKey)) {
        debugInfo('version.remote.singleflight.hit', { cacheKey });
        return inflightRemoteVersionRequests.get(cacheKey);
    }

    debugInfo('version.remote.request.started', {
        cacheKey,
        preferRemote
    });
    const request = fetchJsonFromCandidates('data/version.json', {
        preferRemote,
        remoteOnly: preferRemote,
        preferFormat: 'json'
    }).then(result => {
        debugInfo('version.remote.request.succeeded', {
            cacheKey,
            preferRemote,
            url: result.url,
            version: result.data?.version ?? null
        });
        recentRemoteVersions.set(cacheKey, {
            timestamp: Date.now(),
            result
        });
        return result;
    }).catch(error => {
        debugError('version.remote.request.failed', {
            cacheKey,
            preferRemote,
            message: String(error.message || error)
        });
        throw error;
    }).finally(() => {
        inflightRemoteVersionRequests.delete(cacheKey);
    });

    inflightRemoteVersionRequests.set(cacheKey, request);
    return request;
}

async function getVersionState(resourceIds = [], options = {}) {
    const preferRemote = options.preferRemote ?? isNativeApp();
    const targetResourceIds = resourceIds.length ? resourceIds : getVersionedResourceIds();
    const localVersion = await getCachedData('version.json');
    const remoteVersion = await getRemoteVersion({ preferRemote });
    const changedResourceIds = getChangedResourceIds(localVersion, remoteVersion.data, targetResourceIds);
    const versionChanged = !localVersion || localVersion.version !== remoteVersion.data.version;

    debugInfo('version.state.resolved', {
        preferRemote,
        resourceIds: targetResourceIds,
        localVersion: localVersion?.version ?? null,
        remoteVersion: remoteVersion.data?.version ?? null,
        changedResourceIds,
        versionChanged
    });

    return {
        localVersion,
        serverVersion: remoteVersion.data,
        serverVersionUrl: remoteVersion.url,
        changedResourceIds,
        versionChanged
    };
}

async function fetchAndCacheResource(resourceId, options = {}) {
    const definition = getResourceDefinition(resourceId);
    const preferRemote = options.preferRemote ?? isNativeApp();
    const remoteOnly = options.remoteOnly ?? false;
    const result = await fetchJsonFromCandidates(definition.requestPath, {
        preferRemote,
        remoteOnly
    });

    await saveCachedData(definition.cacheKey, result.data, {
        source: result.url,
        version: options.version ?? null
    });

    debugInfo('resource.cached', {
        resourceId: definition.id,
        cacheKey: definition.cacheKey,
        source: result.url,
        version: options.version ?? null
    });

    return {
        resourceId: definition.id,
        cacheKey: definition.cacheKey,
        data: result.data,
        url: result.url
    };
}

async function syncVersionedResources(resourceIds, options = {}) {
    const preferRemote = options.preferRemote ?? isNativeApp();
    let versionState;

    debugInfo('sync.started', {
        resourceIds,
        preferRemote
    });

    try {
        versionState = await getVersionState(resourceIds, { preferRemote });
    } catch (error) {
        console.error('Remote version check failed:', error);
        debugError('sync.version_check.failed', {
            resourceIds,
            preferRemote,
            message: String(error.message || error)
        });
        return {
            localVersion: await getCachedData('version.json'),
            serverVersion: null,
            serverVersionUrl: null,
            changedResourceIds: [],
            versionChanged: false,
            resourceIdsToUpdate: [],
            updatedResourceIds: [],
            failedResourceIds: [],
            savedVersion: false,
            versionCheckFailed: true,
            error
        };
    }

    const resourceIdsToUpdate = versionState.localVersion
        ? versionState.changedResourceIds
        : [...resourceIds];
    const updatedResourceIds = [];
    const failedResourceIds = [];

    for (const resourceId of resourceIdsToUpdate) {
        try {
            await fetchAndCacheResource(resourceId, {
                preferRemote,
                remoteOnly: preferRemote,
                version: versionState.serverVersion?.files?.[getResourceDefinition(resourceId).versionKey] ?? null
            });
            updatedResourceIds.push(resourceId);
        } catch (error) {
            console.error(`Remote fetch failed for ${resourceId}:`, error);
            debugWarn('sync.resource.failed', {
                resourceId,
                preferRemote,
                message: String(error.message || error)
            });
            failedResourceIds.push(resourceId);
        }
    }

    const shouldSaveVersion = failedResourceIds.length === 0
        && (updatedResourceIds.length > 0 || versionState.versionChanged);

    if (shouldSaveVersion) {
        await saveCachedData('version.json', versionState.serverVersion, {
            source: versionState.serverVersionUrl ?? 'remote',
            version: versionState.serverVersion.version ?? null
        });
        debugInfo('sync.version.saved', {
            version: versionState.serverVersion.version ?? null,
            source: versionState.serverVersionUrl ?? 'remote'
        });
    }

    debugInfo('sync.completed', {
        resourceIds,
        preferRemote,
        resourceIdsToUpdate,
        updatedResourceIds,
        failedResourceIds,
        savedVersion: shouldSaveVersion,
        versionChanged: versionState.versionChanged
    });
    return {
        ...versionState,
        resourceIdsToUpdate,
        updatedResourceIds,
        failedResourceIds,
        savedVersion: shouldSaveVersion,
        versionCheckFailed: false
    };
}

export {
    fetchAndCacheResource,
    getRemoteVersion,
    getVersionState,
    syncVersionedResources
};
