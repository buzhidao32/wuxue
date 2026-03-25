const RESOURCE_DEFINITIONS = Object.freeze({
    skill: {
        id: 'skill',
        cacheKey: 'skill.json',
        versionKey: 'skill.json',
        requestPath: 'data/skill.json',
        versioned: true
    },
    activeZhao: {
        id: 'activeZhao',
        cacheKey: 'activeZhao.json',
        versionKey: 'activeZhao.json',
        requestPath: 'data/activeZhao.json',
        versioned: true
    },
    skillAuto: {
        id: 'skillAuto',
        cacheKey: 'skillAuto.json',
        versionKey: 'skillAuto.json',
        requestPath: 'data/skillAuto.json',
        versioned: true
    },
    meridianMapConfig: {
        id: 'meridianMapConfig',
        cacheKey: 'MeridianMapConfig.json',
        versionKey: 'MeridianMapConfig.json',
        requestPath: 'data/MeridianMapConfig.json',
        versioned: true
    },
    acupointConfig: {
        id: 'acupointConfig',
        cacheKey: 'AcupointConfig.json',
        versionKey: 'AcupointConfig.json',
        requestPath: 'data/AcupointConfig.json',
        versioned: true
    },
    meridianLinkConfig: {
        id: 'meridianLinkConfig',
        cacheKey: 'MeridianLinkConfig.json',
        versionKey: 'MeridianLinkConfig.json',
        requestPath: 'data/MeridianLinkConfig.json',
        versioned: true
    }
});

const RESOURCE_ALIASES = new Map();

for (const definition of Object.values(RESOURCE_DEFINITIONS)) {
    RESOURCE_ALIASES.set(definition.id, definition.id);
    RESOURCE_ALIASES.set(definition.cacheKey, definition.id);
    RESOURCE_ALIASES.set(`${definition.cacheKey}.gz`, definition.id);
    RESOURCE_ALIASES.set(definition.requestPath, definition.id);
    RESOURCE_ALIASES.set(`${definition.requestPath}.gz`, definition.id);
}

function normalizeResourceId(resourceId) {
    if (!resourceId) {
        throw new Error('Missing resource identifier');
    }

    const normalized = String(resourceId).replace(/^\/+/, '');
    const resolved = RESOURCE_ALIASES.get(normalized);

    if (!resolved) {
        throw new Error(`Unknown resource identifier: ${resourceId}`);
    }

    return resolved;
}

function getResourceDefinition(resourceId) {
    return RESOURCE_DEFINITIONS[normalizeResourceId(resourceId)];
}

function getVersionedResourceIds() {
    return Object.values(RESOURCE_DEFINITIONS)
        .filter(definition => definition.versioned)
        .map(definition => definition.id);
}

export {
    getResourceDefinition,
    getVersionedResourceIds,
    normalizeResourceId
};
