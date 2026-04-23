import {
    clearAllCachedData,
    getCacheSnapshot,
    getCachedData,
    initCacheDB,
    saveCachedData
} from './services/cacheService.js';
import { fetchJsonData } from './services/fetchService.js';
import {
    fetchAndCacheResource,
    getVersionState as getUnifiedVersionState,
    syncVersionedResources
} from './services/versionService.js';
import { getResourceDefinition, getVersionedResourceIds } from './services/resourceRegistry.js';
import { loadVersionedResources } from './services/dataService.js';

function normalizeResourceFilename(filename) {
    return String(filename).replace(/^data\//, '').replace(/\.gz$/, '');
}

async function getData(filename) {
    return getCachedData(normalizeResourceFilename(filename));
}

async function saveData(filename, data) {
    return saveCachedData(normalizeResourceFilename(filename), data);
}

async function checkVersion(options = {}) {
    try {
        const versionState = await getUnifiedVersionState(getVersionedResourceIds(), options);

        return {
            needUpdate: versionState.versionChanged,
            remoteNeedUpdate: versionState.remoteVersionChanged ?? false,
            localVersion: versionState.localVersion,
            serverVersion: versionState.serverVersion,
            serverVersionUrl: versionState.serverVersionUrl,
            selectedSource: versionState.selectedSource,
            selectedVersion: versionState.selectedVersion
        };
    } catch (error) {
        console.error('Check version failed:', error);
        return { needUpdate: false, error };
    }
}

async function getVersionState(filenames = [], options = {}) {
    const resourceIds = filenames.length
        ? filenames.map(filename => getResourceDefinition(normalizeResourceFilename(filename)).id)
        : getVersionedResourceIds();

    return getUnifiedVersionState(resourceIds, options);
}

async function fetchDataJson(path, options = {}) {
    return fetchJsonData(path, options);
}

async function fetchGzip(path) {
    return fetchJsonData(path);
}

async function fetchAndCacheData(filename, options = {}) {
    try {
        const definition = getResourceDefinition(normalizeResourceFilename(filename));
        const syncResult = await syncVersionedResources([definition.id], options);
        const cachedData = await getCachedData(definition.cacheKey);

        if (cachedData) {
            console.log(`Downloaded and cached ${normalizeResourceFilename(filename)}`);
            return cachedData;
        }

        if (syncResult.selectedSource === 'cache' && syncResult.fallbackSource) {
            const result = await fetchAndCacheResource(definition.id, {
                source: syncResult.fallbackSource,
                saveToCache: false
            });
            return result.data;
        }

        const result = await fetchAndCacheResource(definition.id, options);
        console.log(`Downloaded and cached ${normalizeResourceFilename(filename)}`);
        return result.data;
    } catch (error) {
        console.error(`Download failed for ${filename}:`, error);
        return null;
    }
}

async function syncVersionedDataFiles(filenames, options = {}) {
    const resourceIds = filenames.map(filename => getResourceDefinition(normalizeResourceFilename(filename)).id);
    const result = await syncVersionedResources(resourceIds, options);

    return {
        ...result,
        filesToUpdate: result.resourceIdsToUpdate.map(resourceId => `${getResourceDefinition(resourceId).cacheKey}.gz`),
        updatedFiles: result.updatedResourceIds.map(resourceId => `${getResourceDefinition(resourceId).cacheKey}.gz`),
        failedFiles: result.failedResourceIds.map(resourceId => `${getResourceDefinition(resourceId).cacheKey}.gz`)
    };
}

async function loadAllData(filenames, options = {}) {
    const resourceIds = filenames.map(filename => getResourceDefinition(normalizeResourceFilename(filename)).id);
    const loaded = await loadVersionedResources(resourceIds, options);
    const result = {};

    for (const resourceId of resourceIds) {
        const definition = getResourceDefinition(resourceId);
        result[definition.cacheKey] = loaded[definition.id];
        result[`${definition.cacheKey}.gz`] = loaded[definition.id];
    }

    return result;
}

async function clearCache() {
    return clearAllCachedData();
}

async function getCacheInfo() {
    return getCacheSnapshot();
}

export {
    checkVersion,
    clearCache,
    fetchAndCacheData,
    fetchDataJson,
    fetchGzip,
    getCacheInfo,
    getData,
    getVersionState,
    initCacheDB as initDB,
    loadAllData,
    saveData,
    syncVersionedDataFiles
};
