const DB_NAME = 'wuxue_data_cache';
const DB_VERSION = 1;
const STORE_NAME = 'json_data';

let dbPromise = null;
let memoryCache = new Map();

function initDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB 打开失败:', request.error);
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
        // 先检查内存缓存
        if (memoryCache.has(filename)) {
            console.log(`从内存缓存读取 ${filename}`);
            return memoryCache.get(filename);
        }

        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(filename);

            request.onsuccess = () => {
                if (request.result) {
                    console.log(`从IndexedDB缓存读取 ${filename}`);
                    memoryCache.set(filename, request.result.data);
                    resolve(request.result.data);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error(`读取 ${filename} 失败:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`获取数据失败 ${filename}:`, error);
        return null;
    }
}

async function saveData(filename, data) {
    try {
        // 更新内存缓存
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
                console.error(`保存 ${filename} 失败:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`保存数据失败 ${filename}:`, error);
        return false;
    }
}

async function checkVersion() {
    try {
        const localVersion = await getData('version.json');
        const response = await fetch('data/version.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const serverVersion = await response.json();

        if (!localVersion) {
            return { needUpdate: true, serverVersion };
        }

        const needUpdate = localVersion.version !== serverVersion.version;
        return { needUpdate, localVersion, serverVersion };
    } catch (error) {
        console.error('检查版本失败:', error);
        return { needUpdate: true, error };
    }
}

async function fetchGzip(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 检测是否为有效的 gzip 响应
    const contentType = response.headers.get('Content-Type') || '';
    const isGzipResponse = contentType.includes('gzip') || url.endsWith('.gz');

    try {
        if (typeof DecompressionStream !== 'undefined' && isGzipResponse) {
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

            const decoder = new TextDecoder('utf-8');
            return JSON.parse(decoder.decode(result));
        } else {
            // 如果不支持 DecompressionStream 或不是 gzip 响应，直接返回 JSON
            return response.json();
        }
    } catch (error) {
        console.warn('gzip 解压失败，尝试直接解析 JSON:', error);
        return response.json();
    }
}

async function fetchAndCacheData(filename) {
    try {
        const isGzip = filename.endsWith('.gz');
        const url = `data/${filename}`;

        console.log(`从服务器下载 ${filename}...`);

        let data;
        if (isGzip) {
            data = await fetchGzip(url);
        } else {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
        }

        const cacheFilename = isGzip ? filename.replace('.gz', '') : filename;
        await saveData(cacheFilename, data);

        console.log(`下载并缓存 ${filename} 完成`);
        return data;
    } catch (error) {
        console.error(`下载 ${filename} 失败:`, error);
        return null;
    }
}

async function loadAllData(filenames) {
    const versionInfo = await checkVersion();
    const result = {};

    if (versionInfo.needUpdate) {
        console.log('检测到新版本，开始更新缓存...');

        await fetchAndCacheData('version.json');

        for (const filename of filenames) {
            const data = await fetchAndCacheData(filename);
            if (data) {
                result[filename] = data;
            }
        }

        console.log('缓存更新完成');
    } else {
        console.log('使用本地缓存');

        for (const filename of filenames) {
            const data = await getData(filename);
            if (data) {
                result[filename] = data;
            } else {
                console.warn(`${filename} 在缓存中不存在，从服务器下载...`);
                const data = await fetchAndCacheData(filename);
                if (data) {
                    result[filename] = data;
                }
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
                console.log('缓存已清除');
                resolve(true);
            };

            request.onerror = () => {
                console.error('清除缓存失败:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('清除缓存失败:', error);
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
        console.error('获取缓存信息失败:', error);
        return null;
    }
}

export {
    initDB,
    getData,
    saveData,
    checkVersion,
    fetchAndCacheData,
    fetchGzip,
    loadAllData,
    clearCache,
    getCacheInfo
};
