import { getDataUrlCandidates, isNativeApp } from './runtimeConfig.js';

const DB_NAME = 'wuxue_data_cache';
const DB_VERSION = 1;
const STORE_NAME = 'json_data';

let dbPromise = null;
let memoryCache = new Map();

function getJsonUrlVariants(url) {
    if (url.endsWith('.json.gz')) {
        return [url.replace(/\.gz$/, ''), url];
    }
    if (url.endsWith('.json')) {
        return [url, `${url}.gz`];
    }
    return [url];
}

function getFetchUrlCandidates(path, options = {}) {
    const baseCandidates = getDataUrlCandidates(path, options);
    const candidates = [];

    for (const baseUrl of baseCandidates) {
        for (const variant of getJsonUrlVariants(baseUrl)) {
            if (!candidates.includes(variant)) {
                candidates.push(variant);
            }
        }
    }

    return candidates;
}

async function fetchJsonFromCandidates(path, options = {}) {
    let lastError = null;

    for (const candidate of getFetchUrlCandidates(path, options)) {
        try {
            if (candidate.endsWith('.gz')) {
                const response = await fetch(candidate, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                if (typeof DecompressionStream === 'undefined' || !response.body?.pipeThrough) {
                    throw new Error('DecompressionStream is not available for gzip response');
                }

                const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
                const reader = stream.getReader();
                const chunks = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }

                const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                const result = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                }

                return JSON.parse(new TextDecoder('utf-8').decode(result));
            }

            const response = await fetch(candidate, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error(`Unable to load data from ${path}`);
}

async function fetchDataJson(path, options = {}) {
    return fetchJsonFromCandidates(path, options);
}

function initDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB open failed:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'filename' });
            }
        };
    });

    return dbPromise;
}

async function getData(filename) {
    try {
        if (memoryCache.has(filename)) {
            console.log(`Read ${filename} from memory cache`);
            return memoryCache.get(filename);
        }

        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(filename);

            request.onsuccess = () => {
                if (request.result) {
                    console.log(`Read ${filename} from IndexedDB cache`);
                    memoryCache.set(filename, request.result.data);
                    resolve(request.result.data);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error(`Read ${filename} failed:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Get data failed for ${filename}:`, error);
        return null;
    }
}

async function saveData(filename, data) {
    try {
        memoryCache.set(filename, data);

        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ filename, data, timestamp: Date.now() });

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                console.error(`Save ${filename} failed:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Save data failed for ${filename}:`, error);
        return false;
    }
}

async function checkVersion() {
    try {
        const localVersion = await getData('version.json');
        const serverVersion = await fetchJsonFromCandidates('data/version.json', {
            preferRemote: isNativeApp()
        });

        if (!localVersion) {
            return { needUpdate: true, serverVersion };
        }

        const needUpdate = localVersion.version !== serverVersion.version;
        return { needUpdate, localVersion, serverVersion };
    } catch (error) {
        console.error('Check version failed:', error);
        return { needUpdate: false, error };
    }
}

async function fetchGzip(url) {
    return fetchJsonFromCandidates(url, {
        preferRemote: isNativeApp()
    });
}

async function fetchAndCacheData(filename) {
    try {
        const isGzip = filename.endsWith('.gz');
        const url = `data/${filename}`;

        console.log(`Downloading ${filename}...`);

        const data = isGzip
            ? await fetchGzip(url)
            : await fetchJsonFromCandidates(url, {
                preferRemote: isNativeApp()
            });

        const cacheFilename = isGzip ? filename.replace('.gz', '') : filename;
        await saveData(cacheFilename, data);

        console.log(`Downloaded and cached ${filename}`);
        return data;
    } catch (error) {
        console.error(`Download failed for ${filename}:`, error);
        return null;
    }
}

async function loadAllData(filenames) {
    const versionInfo = await checkVersion();
    const result = {};

    if (versionInfo.needUpdate) {
        console.log('Detected a new version, refreshing cache');

        await fetchAndCacheData('version.json');

        for (const filename of filenames) {
            const data = await fetchAndCacheData(filename);
            if (data) {
                result[filename] = data;
            }
        }
    } else {
        console.log('Using local cache');

        for (const filename of filenames) {
            let data = await getData(filename);
            if (!data) {
                console.warn(`${filename} was not found in cache, downloading`);
                data = await fetchAndCacheData(filename);
            }
            if (data) {
                result[filename] = data;
            }
        }
    }

    return result;
}

async function clearCache() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('Cache cleared');
                memoryCache.clear();
                resolve(true);
            };

            request.onerror = () => {
                console.error('Clear cache failed:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Clear cache failed:', error);
        return false;
    }
}

async function getCacheInfo() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const items = request.result;
                let totalSize = 0;
                items.forEach(item => {
                    const jsonStr = JSON.stringify(item.data);
                    totalSize += jsonStr.length * 2;
                });
                resolve({
                    count: items.length,
                    size: totalSize,
                    items: items.map(item => ({
                        filename: item.filename,
                        timestamp: new Date(item.timestamp).toLocaleString()
                    }))
                });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Get cache info failed:', error);
        return null;
    }
}

export {
    initDB,
    getData,
    saveData,
    checkVersion,
    fetchDataJson,
    fetchAndCacheData,
    fetchGzip,
    loadAllData,
    clearCache,
    getCacheInfo
};
