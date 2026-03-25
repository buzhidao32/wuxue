const DEFAULT_REMOTE_BASE_URLS = [
    'https://buzhidao32.github.io/wuxue/',
    'https://cdn.jsdelivr.net/gh/buzhidao32/wuxue@main/',
    'https://buzhidao159.netlify.app/'
];

export function isNativeApp() {
    return Boolean(window.Capacitor?.isNativePlatform?.());
}

export function getRemoteBaseUrl() {
    const override = window.WUXUE_REMOTE_BASE_URL;
    if (typeof override === 'string' && override.trim()) {
        return override.trim().replace(/\/+$/, '/');
    }
    return DEFAULT_REMOTE_BASE_URLS[0];
}

export function getRemoteBaseUrls() {
    const override = window.WUXUE_REMOTE_BASE_URL;
    if (typeof override === 'string' && override.trim()) {
        return [override.trim().replace(/\/+$/, '/')];
    }
    return DEFAULT_REMOTE_BASE_URLS;
}

export function getDataUrlCandidates(path, options = {}) {
    const normalizedPath = path.replace(/^\/+/, '');
    const preferRemote = options.preferRemote ?? isNativeApp();
    const remoteUrls = getRemoteBaseUrls().map(baseUrl => new URL(normalizedPath, baseUrl).toString());
    const localUrl = normalizedPath;

    return preferRemote
        ? [...remoteUrls, localUrl]
        : [localUrl, ...remoteUrls];
}
