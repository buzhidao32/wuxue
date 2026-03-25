import { getDataUrlCandidates, getRemoteBaseUrls } from '../runtimeConfig.js';
import { debugError, debugInfo, debugWarn } from './debugLogService.js';

const PATH_FORMAT_HINTS = new Map();
const ORIGIN_FAILURES = new Map();
const ORIGIN_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

function getPreferredFormat(path) {
    if (PATH_FORMAT_HINTS.has(path)) {
        return PATH_FORMAT_HINTS.get(path);
    }

    return path.endsWith('version.json') ? 'json' : 'gzip';
}

function getJsonUrlVariants(url, preferredFormat = 'json') {
    if (url.endsWith('.json.gz')) {
        return preferredFormat === 'gzip'
            ? [url, url.replace(/\.gz$/, '')]
            : [url.replace(/\.gz$/, ''), url];
    }

    if (url.endsWith('.json')) {
        return preferredFormat === 'gzip'
            ? [`${url}.gz`, url]
            : [url, `${url}.gz`];
    }

    return [url];
}

function isOriginCoolingDown(candidate) {
    const url = new URL(candidate, window.location.href);
    const retryAt = ORIGIN_FAILURES.get(url.origin);
    if (!retryAt) {
        return false;
    }

    if (retryAt <= Date.now()) {
        ORIGIN_FAILURES.delete(url.origin);
        return false;
    }

    return true;
}

function markOriginFailure(candidate) {
    const url = new URL(candidate, window.location.href);
    ORIGIN_FAILURES.set(url.origin, Date.now() + ORIGIN_FAILURE_COOLDOWN_MS);
    debugWarn('origin.cooldown.started', {
        origin: url.origin,
        candidate,
        cooldownMs: ORIGIN_FAILURE_COOLDOWN_MS
    });
}

function clearOriginFailure(candidate) {
    const url = new URL(candidate, window.location.href);
    ORIGIN_FAILURES.delete(url.origin);
}

function shouldCooldownOrigin(error) {
    if (!error) {
        return false;
    }

    const message = String(error.message || '');
    if (message.startsWith('HTTP error!')) {
        return false;
    }

    return true;
}

function getFetchUrlCandidates(path, options = {}) {
    const normalizedPath = path.replace(/^\/+/, '');
    const preferredFormat = options.preferFormat ?? getPreferredFormat(normalizedPath);
    const baseCandidates = options.remoteOnly
        ? getRemoteBaseUrls().map(baseUrl => new URL(normalizedPath, baseUrl).toString())
        : getDataUrlCandidates(path, options);
    const candidates = [];

    for (const baseUrl of baseCandidates) {
        for (const variant of getJsonUrlVariants(baseUrl, preferredFormat)) {
            if (!candidates.includes(variant)) {
                candidates.push(variant);
            }
        }
    }

    const activeCandidates = candidates.filter(candidate => !isOriginCoolingDown(candidate));
    debugInfo('fetch.candidates.resolved', {
        path: normalizedPath,
        preferRemote: options.preferRemote,
        remoteOnly: options.remoteOnly,
        preferFormat: preferredFormat,
        candidates,
        activeCandidates
    });
    return activeCandidates.length > 0 ? activeCandidates : candidates;
}

async function decodeGzipResponse(response) {
    if (typeof DecompressionStream === 'undefined' || !response.body?.pipeThrough) {
        throw new Error('DecompressionStream is not available for gzip response');
    }

    const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
    }

    const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return JSON.parse(new TextDecoder('utf-8').decode(result));
}

async function fetchJsonFromCandidate(candidate) {
    const response = await fetch(candidate, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = candidate.endsWith('.gz')
        ? await decodeGzipResponse(response)
        : await response.json();

    return {
        data,
        url: candidate
    };
}

async function fetchJsonFromCandidates(path, options = {}) {
    let lastError = null;
    const normalizedPath = path.replace(/^\/+/, '');
    const candidates = getFetchUrlCandidates(path, options);

    for (const candidate of candidates) {
        try {
            debugInfo('fetch.attempt.started', {
                path: normalizedPath,
                candidate
            });
            const result = await fetchJsonFromCandidate(candidate);
            PATH_FORMAT_HINTS.set(normalizedPath, candidate.endsWith('.gz') ? 'gzip' : 'json');
            clearOriginFailure(candidate);
            debugInfo('fetch.attempt.succeeded', {
                path: normalizedPath,
                candidate,
                resolvedFormat: candidate.endsWith('.gz') ? 'gzip' : 'json'
            });
            return result;
        } catch (error) {
            lastError = error;
            debugWarn('fetch.attempt.failed', {
                path: normalizedPath,
                candidate,
                message: String(error.message || error)
            });
            if (shouldCooldownOrigin(error)) {
                markOriginFailure(candidate);
            }
        }
    }

    debugError('fetch.exhausted', {
        path: normalizedPath,
        candidates,
        message: String(lastError?.message || lastError || `Unable to load data from ${path}`)
    });
    throw lastError || new Error(`Unable to load data from ${path}`);
}

async function fetchJsonData(path, options = {}) {
    const result = await fetchJsonFromCandidates(path, options);
    return result.data;
}

export {
    fetchJsonData,
    fetchJsonFromCandidates,
    getFetchUrlCandidates
};
