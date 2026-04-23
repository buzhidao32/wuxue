const DB_NAME = 'wuxue_data_cache';
const DB_VERSION = 1;
const STORE_NAME = 'json_data';

let dbPromise = null;
const memoryCache = new Map();

function logCacheRead(source, filename) {
    console.log(`Read ${filename} from ${source} cache`);
}

function initCacheDB() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB open failed:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'filename' });
            }
        };
    });

    return dbPromise;
}

async function getCachedRecord(filename) {
    try {
        if (memoryCache.has(filename)) {
            logCacheRead('memory', filename);
            return memoryCache.get(filename);
        }

        const db = await initCacheDB();
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(filename);

            request.onsuccess = () => {
                if (!request.result) {
                    resolve(null);
                    return;
                }

                logCacheRead('IndexedDB', filename);
                memoryCache.set(filename, request.result);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error(`Read ${filename} failed:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Get cached record failed for ${filename}:`, error);
        return null;
    }
}

async function getCachedData(filename) {
    const record = await getCachedRecord(filename);
    return record?.data ?? null;
}

async function saveCachedData(filename, data, meta = {}) {
    try {
        const record = {
            filename,
            data,
            timestamp: Date.now(),
            source: meta.source ?? 'unknown',
            version: meta.version ?? null
        };

        memoryCache.set(filename, record);

        const db = await initCacheDB();
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(record);

            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.error(`Save ${filename} failed:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Save cached data failed for ${filename}:`, error);
        return false;
    }
}

async function clearCachedData(filename) {
    try {
        memoryCache.delete(filename);

        const db = await initCacheDB();
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(filename);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Clear cached data failed for ${filename}:`, error);
        return false;
    }
}

async function clearAllCachedData() {
    try {
        const db = await initCacheDB();
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                memoryCache.clear();
                console.log('Cache cleared');
                resolve(true);
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Clear cache failed:', error);
        return false;
    }
}

async function replaceAllCachedData(records) {
    try {
        const timestamp = Date.now();
        const nextMemoryCache = new Map();
        const normalizedRecords = records.map(record => {
            const normalizedRecord = {
                filename: record.filename,
                data: record.data,
                timestamp,
                source: record.source ?? 'unknown',
                version: record.version ?? null
            };

            nextMemoryCache.set(normalizedRecord.filename, normalizedRecord);
            return normalizedRecord;
        });

        const db = await initCacheDB();
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            transaction.oncomplete = () => {
                memoryCache.clear();
                for (const [filename, record] of nextMemoryCache) {
                    memoryCache.set(filename, record);
                }
                console.log('Cache replaced');
                resolve(true);
            };

            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);

            try {
                store.clear();
                for (const record of normalizedRecords) {
                    store.put(record);
                }
            } catch (error) {
                transaction.abort();
                reject(error);
            }
        });
    } catch (error) {
        console.error('Replace cache failed:', error);
        return false;
    }
}

async function getCacheSnapshot() {
    try {
        const db = await initCacheDB();
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const items = request.result;
                let totalSize = 0;

                for (const item of items) {
                    totalSize += JSON.stringify(item.data).length * 2;
                }

                resolve({
                    count: items.length,
                    size: totalSize,
                    items: items.map(item => ({
                        filename: item.filename,
                        timestamp: new Date(item.timestamp).toLocaleString(),
                        source: item.source ?? 'unknown',
                        version: item.version ?? null
                    }))
                });
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Get cache snapshot failed:', error);
        return null;
    }
}

export {
    clearAllCachedData,
    clearCachedData,
    getCacheSnapshot,
    getCachedData,
    getCachedRecord,
    initCacheDB,
    replaceAllCachedData,
    saveCachedData
};
