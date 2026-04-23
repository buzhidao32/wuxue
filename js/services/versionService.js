import { isNativeApp } from '../runtimeConfig.js';
import { getCachedData, getCachedRecord, saveCachedData } from './cacheService.js';
import { debugError, debugInfo, debugWarn } from './debugLogService.js';
import { fetchJsonFromCandidates } from './fetchService.js';
import { getResourceDefinition, getVersionedResourceIds } from './resourceRegistry.js';

const VERSION_PATH = 'data/version.json';
const SOURCE_CACHE = 'cache';
const SOURCE_LOCAL = 'local';
const SOURCE_REMOTE = 'remote';
const inflightSourceVersionRequests = new Map();
const recentSourceVersions = new Map();
const VERSION_SOURCE_CACHE_MS = 3000;

function getChangedResourceIds(localVersion, selectedVersion, resourceIds) {
    if (!resourceIds.length) {
        return [];
    }

    if (!localVersion?.files || !selectedVersion?.files) {
        return [...resourceIds];
    }

    return resourceIds.filter(resourceId => {
        const definition = getResourceDefinition(resourceId);
        return !areVersionsEquivalent(
            localVersion.files[definition.versionKey],
            selectedVersion.files[definition.versionKey]
        );
    });
}

function parseDateVersion(version) {
    if (typeof version !== 'string') {
        return null;
    }

    const match = version.trim().match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\..+)?$/);
    if (!match) {
        return null;
    }

    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    return { year, month, day };
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

function compareDateVersionStrings(leftVersion, rightVersion) {
    const left = parseDateVersion(leftVersion);
    const right = parseDateVersion(rightVersion);

    if (!left || !right) {
        return null;
    }

    return compareParsedDateVersions(left, right);
}

function areVersionsEquivalent(leftVersion, rightVersion) {
    const comparison = compareDateVersionStrings(leftVersion, rightVersion);

    if (comparison !== null) {
        return comparison === 0;
    }

    return leftVersion === rightVersion;
}

function getVersionRequestOptions(source) {
    if (source === SOURCE_REMOTE) {
        return {
            preferRemote: true,
            remoteOnly: true,
            preferFormat: 'json'
        };
    }

    return {
        preferRemote: false,
        localOnly: true,
        preferFormat: 'json'
    };
}

function getResourceRequestOptions(source) {
    if (source === SOURCE_REMOTE) {
        return {
            preferRemote: true,
            remoteOnly: true
        };
    }

    return {
        preferRemote: false,
        localOnly: true
    };
}

async function getMissingCachedResourceIds(resourceIds) {
    const results = await Promise.all(resourceIds.map(async (resourceId) => {
        const definition = getResourceDefinition(resourceId);
        const cachedRecord = await getCachedRecord(definition.cacheKey);

        if (!cachedRecord || cachedRecord.data === null || cachedRecord.data === undefined) {
            return definition.id;
        }
        return null;
    }));

    return results.filter(Boolean);
}

function uniqueResourceIds(resourceIds) {
    return [...new Set(resourceIds)];
}

function normalizeSource(source) {
    return source === SOURCE_REMOTE ? SOURCE_REMOTE : SOURCE_LOCAL;
}

function resolveForcedVersionSource(options = {}) {
    if (options.source === SOURCE_LOCAL || options.source === SOURCE_REMOTE) {
        return options.source;
    }

    if (typeof options.preferRemote === 'boolean') {
        return options.preferRemote ? SOURCE_REMOTE : SOURCE_LOCAL;
    }

    return null;
}

async function getSourceVersion(source) {
    const normalizedSource = normalizeSource(source);
    const cached = recentSourceVersions.get(normalizedSource);
    if (cached && (Date.now() - cached.timestamp) < VERSION_SOURCE_CACHE_MS) {
        debugInfo('version.source.cache.hit', {
            source: normalizedSource,
            ageMs: Date.now() - cached.timestamp
        });
        return cached.result;
    }

    if (inflightSourceVersionRequests.has(normalizedSource)) {
        debugInfo('version.source.singleflight.hit', {
            source: normalizedSource
        });
        return inflightSourceVersionRequests.get(normalizedSource);
    }

    debugInfo('version.source.request.started', {
        source: normalizedSource
    });
    const request = fetchJsonFromCandidates(VERSION_PATH, getVersionRequestOptions(normalizedSource)).then(result => {
        debugInfo('version.source.request.succeeded', {
            source: normalizedSource,
            url: result.url,
            version: result.data?.version ?? null
        });
        recentSourceVersions.set(normalizedSource, {
            timestamp: Date.now(),
            result
        });
        return result;
    }).catch(error => {
        debugWarn('version.source.request.failed', {
            source: normalizedSource,
            message: String(error.message || error)
        });
        throw error;
    }).finally(() => {
        inflightSourceVersionRequests.delete(normalizedSource);
    });

    inflightSourceVersionRequests.set(normalizedSource, request);
    return request;
}

function getUsableSourceResult(source, settledResult) {
    if (settledResult.status !== 'fulfilled') {
        return null;
    }

    const parsedVersion = parseDateVersion(settledResult.value.data?.version);
    if (!parsedVersion) {
        debugWarn('version.source.invalid', {
            source,
            url: settledResult.value.url,
            version: settledResult.value.data?.version ?? null
        });
        return null;
    }

    return {
        source,
        data: settledResult.value.data,
        url: settledResult.value.url,
        parsedVersion
    };
}

function selectSourceVersion(localResult, remoteResult) {
    if (localResult && remoteResult) {
        const comparison = compareParsedDateVersions(localResult.parsedVersion, remoteResult.parsedVersion);
        if (comparison >= 0) {
            return {
                selectedSource: SOURCE_LOCAL,
                selectedResult: localResult,
                reason: comparison === 0 ? 'equal-prefer-local' : 'local-newer'
            };
        }

        return {
            selectedSource: SOURCE_REMOTE,
            selectedResult: remoteResult,
            reason: 'remote-newer'
        };
    }

    if (localResult) {
        return {
            selectedSource: SOURCE_LOCAL,
            selectedResult: localResult,
            reason: 'remote-unavailable'
        };
    }

    if (remoteResult) {
        return {
            selectedSource: SOURCE_REMOTE,
            selectedResult: remoteResult,
            reason: 'local-unavailable'
        };
    }

    return null;
}

async function resolveSelectedSourceVersion(options = {}) {
    const forcedSource = resolveForcedVersionSource(options);
    if (forcedSource) {
        const forcedResult = await getSourceVersion(forcedSource);
        const selection = {
            selectedSource: forcedSource,
            selectedVersion: forcedResult.data,
            selectedVersionUrl: forcedResult.url,
            localSourceVersion: forcedSource === SOURCE_LOCAL ? forcedResult.data : null,
            localSourceVersionUrl: forcedSource === SOURCE_LOCAL ? forcedResult.url : null,
            remoteSourceVersion: forcedSource === SOURCE_REMOTE ? forcedResult.data : null,
            remoteSourceVersionUrl: forcedSource === SOURCE_REMOTE ? forcedResult.url : null
        };

        debugInfo('version.source.selected', {
            selectedSource: selection.selectedSource,
            selectedVersion: selection.selectedVersion?.version ?? null,
            localVersion: selection.localSourceVersion?.version ?? null,
            remoteVersion: selection.remoteSourceVersion?.version ?? null,
            reason: 'forced-source'
        });

        return selection;
    }

    const [localSettled, remoteSettled] = await Promise.allSettled([
        getSourceVersion(SOURCE_LOCAL),
        getSourceVersion(SOURCE_REMOTE)
    ]);
    const localResult = getUsableSourceResult(SOURCE_LOCAL, localSettled);
    const remoteResult = getUsableSourceResult(SOURCE_REMOTE, remoteSettled);
    const selection = selectSourceVersion(localResult, remoteResult);

    if (!selection) {
        debugError('version.source.selection.failed', {
            localStatus: localSettled.status,
            remoteStatus: remoteSettled.status,
            localMessage: localSettled.status === 'rejected'
                ? String(localSettled.reason?.message || localSettled.reason)
                : null,
            remoteMessage: remoteSettled.status === 'rejected'
                ? String(remoteSettled.reason?.message || remoteSettled.reason)
                : null
        });
        throw new Error('Unable to resolve any usable version.json source');
    }

    debugInfo('version.source.selected', {
        selectedSource: selection.selectedSource,
        selectedVersion: selection.selectedResult.data?.version ?? null,
        localVersion: localResult?.data?.version ?? null,
        remoteVersion: remoteResult?.data?.version ?? null,
        reason: selection.reason
    });

    return {
        selectedSource: selection.selectedSource,
        selectedVersion: selection.selectedResult.data,
        selectedVersionUrl: selection.selectedResult.url,
        localSourceVersion: localResult?.data ?? null,
        localSourceVersionUrl: localResult?.url ?? null,
        remoteSourceVersion: remoteResult?.data ?? null,
        remoteSourceVersionUrl: remoteResult?.url ?? null
    };
}

async function getRemoteVersion() {
    return getSourceVersion(SOURCE_REMOTE);
}

async function getVersionState(resourceIds = [], options = {}) {
    const targetResourceIds = resourceIds.length ? resourceIds : getVersionedResourceIds();
    const localVersion = await getCachedData('version.json');
    const sourceSelection = await resolveSelectedSourceVersion(options);
    let effectiveSelection = {
        ...sourceSelection,
        fallbackSource: null,
        fallbackVersion: null,
        fallbackVersionUrl: null
    };
    const cachedVsSelected = compareDateVersionStrings(
        localVersion?.version,
        sourceSelection.selectedVersion?.version
    );

    if (cachedVsSelected !== null && cachedVsSelected > 0) {
        effectiveSelection = {
            ...sourceSelection,
            selectedSource: SOURCE_CACHE,
            selectedVersion: localVersion,
            selectedVersionUrl: null,
            fallbackSource: sourceSelection.selectedSource,
            fallbackVersion: sourceSelection.selectedVersion,
            fallbackVersionUrl: sourceSelection.selectedVersionUrl
        };

        debugWarn('version.cache.newer_than_selected_source', {
            cachedVersion: localVersion?.version ?? null,
            selectedSource: sourceSelection.selectedSource,
            selectedVersion: sourceSelection.selectedVersion?.version ?? null
        });
    }

    const changedResourceIds = getChangedResourceIds(
        localVersion,
        effectiveSelection.selectedVersion,
        targetResourceIds
    );
    const versionChanged = !localVersion
        || !areVersionsEquivalent(localVersion.version, effectiveSelection.selectedVersion.version);
    const remoteVersionChanged = !localVersion || !sourceSelection.remoteSourceVersion
        ? false
        : !areVersionsEquivalent(localVersion.version, sourceSelection.remoteSourceVersion.version);

    debugInfo('version.state.resolved', {
        resourceIds: targetResourceIds,
        cachedVersion: localVersion?.version ?? null,
        localSourceVersion: sourceSelection.localSourceVersion?.version ?? null,
        remoteSourceVersion: sourceSelection.remoteSourceVersion?.version ?? null,
        selectedSource: effectiveSelection.selectedSource,
        selectedVersion: effectiveSelection.selectedVersion?.version ?? null,
        fallbackSource: effectiveSelection.fallbackSource,
        changedResourceIds,
        versionChanged
    });

    return {
        localVersion,
        serverVersion: sourceSelection.remoteSourceVersion,
        serverVersionUrl: sourceSelection.remoteSourceVersionUrl,
        selectedSource: effectiveSelection.selectedSource,
        selectedVersion: effectiveSelection.selectedVersion,
        selectedVersionUrl: effectiveSelection.selectedVersionUrl,
        fallbackSource: effectiveSelection.fallbackSource,
        fallbackVersion: effectiveSelection.fallbackVersion,
        fallbackVersionUrl: effectiveSelection.fallbackVersionUrl,
        remoteVersionChanged,
        localSourceVersion: sourceSelection.localSourceVersion,
        localSourceVersionUrl: sourceSelection.localSourceVersionUrl,
        remoteSourceVersion: sourceSelection.remoteSourceVersion,
        remoteSourceVersionUrl: sourceSelection.remoteSourceVersionUrl,
        changedResourceIds,
        versionChanged
    };
}

function resolveResourceSource(options = {}) {
    if (options.source === SOURCE_REMOTE || options.source === SOURCE_LOCAL) {
        return options.source;
    }

    if (typeof options.preferRemote === 'boolean') {
        return options.preferRemote ? SOURCE_REMOTE : SOURCE_LOCAL;
    }

    return isNativeApp() ? SOURCE_REMOTE : SOURCE_LOCAL;
}

async function fetchAndCacheResource(resourceId, options = {}) {
    const definition = getResourceDefinition(resourceId);
    const source = resolveResourceSource(options);
    const result = await fetchJsonFromCandidates(
        definition.requestPath,
        getResourceRequestOptions(source)
    );

    if (options.saveToCache !== false) {
        await saveCachedData(definition.cacheKey, result.data, {
            source: result.url,
            version: options.version ?? null
        });
    }

    debugInfo(options.saveToCache === false ? 'resource.fetched' : 'resource.cached', {
        resourceId: definition.id,
        cacheKey: definition.cacheKey,
        source: result.url,
        selectedSource: source,
        version: options.version ?? null
    });

    return {
        resourceId: definition.id,
        cacheKey: definition.cacheKey,
        data: result.data,
        url: result.url,
        selectedSource: source
    };
}

async function syncVersionedResources(resourceIds, options = {}) {
    let versionState;

    debugInfo('sync.started', {
        resourceIds
    });

    try {
        versionState = await getVersionState(resourceIds, options);
    } catch (error) {
        console.error('Version source resolution failed:', error);
        debugError('sync.version_check.failed', {
            resourceIds,
            message: String(error.message || error)
        });
        return {
            localVersion: await getCachedData('version.json'),
            serverVersion: null,
            serverVersionUrl: null,
            selectedSource: null,
            selectedVersion: null,
            selectedVersionUrl: null,
            localSourceVersion: null,
            localSourceVersionUrl: null,
            remoteSourceVersion: null,
            remoteSourceVersionUrl: null,
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

    const missingResourceIds = await getMissingCachedResourceIds(resourceIds);
    const resourceIdsToUpdate = versionState.localVersion
        ? uniqueResourceIds([
            ...versionState.changedResourceIds,
            ...missingResourceIds
        ])
        : [...resourceIds];
    const updatedResourceIds = [];
    const failedResourceIds = [];

    if (versionState.selectedSource === SOURCE_CACHE) {
        debugInfo('sync.completed', {
            resourceIds,
            selectedSource: versionState.selectedSource,
            resourceIdsToUpdate: [],
            missingResourceIds,
            updatedResourceIds: [],
            failedResourceIds: [],
            savedVersion: false,
            versionChanged: false
        });

        return {
            ...versionState,
            resourceIdsToUpdate: [],
            updatedResourceIds,
            failedResourceIds,
            savedVersion: false,
            versionCheckFailed: false
        };
    }

    const settledResourceUpdates = await Promise.allSettled(resourceIdsToUpdate.map(async (resourceId) => {
        await fetchAndCacheResource(resourceId, {
            source: versionState.selectedSource,
            version: versionState.selectedVersion?.files?.[getResourceDefinition(resourceId).versionKey] ?? null
        });
        return resourceId;
    }));

    settledResourceUpdates.forEach((result, index) => {
        const resourceId = resourceIdsToUpdate[index];
        if (result.status === 'fulfilled') {
            updatedResourceIds.push(result.value);
            return;
        }

        console.error(`Source fetch failed for ${resourceId}:`, result.reason);
        debugWarn('sync.resource.failed', {
            resourceId,
            selectedSource: versionState.selectedSource,
            message: String(result.reason?.message || result.reason)
        });
        failedResourceIds.push(resourceId);
    });

    const shouldSaveVersion = failedResourceIds.length === 0
        && (updatedResourceIds.length > 0 || versionState.versionChanged);

    if (shouldSaveVersion) {
        await saveCachedData('version.json', versionState.selectedVersion, {
            source: versionState.selectedVersionUrl ?? versionState.selectedSource,
            version: versionState.selectedVersion.version ?? null
        });
        debugInfo('sync.version.saved', {
            selectedSource: versionState.selectedSource,
            version: versionState.selectedVersion.version ?? null,
            source: versionState.selectedVersionUrl ?? versionState.selectedSource
        });
    }

    debugInfo('sync.completed', {
        resourceIds,
        selectedSource: versionState.selectedSource,
        resourceIdsToUpdate,
        missingResourceIds,
        updatedResourceIds,
        failedResourceIds,
        savedVersion: shouldSaveVersion,
        versionChanged: versionState.versionChanged
    });

    return {
        ...versionState,
        resourceIdsToUpdate,
        missingResourceIds,
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
