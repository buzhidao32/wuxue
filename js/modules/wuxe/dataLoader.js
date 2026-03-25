// 数据加载模块
import { getData, saveData, fetchGzip, checkVersion, syncVersionedDataFiles } from '../../db.js';

export let skillData = {
    "正气需求": [],
    "skills": {}
};
export let activeSkillData = null;
export let skillAutoData = null;
export let skillRelationData = null;
let backgroundRefreshPromise = null;

function warmRemainingDataFiles(files) {
    if (backgroundRefreshPromise) {
        return backgroundRefreshPromise;
    }

    backgroundRefreshPromise = syncVersionedDataFiles(files, {
        preferRemote: true
    }).catch(error => {
        console.warn('Background refresh failed:', error);
    }).finally(() => {
        backgroundRefreshPromise = null;
    });

    return backgroundRefreshPromise;
}

// 检查是否需要更新缓存
async function checkAndUpdateCache(filename) {
    try {
        console.log('检查版本...');
        const files = [
            'skill.json.gz',
            'activeZhao.json.gz',
            'skillAuto.json.gz',
            'MeridianMapConfig.json.gz',
            'AcupointConfig.json.gz',
            'MeridianLinkConfig.json.gz'
        ];
        const normalizedFilename = filename.endsWith('.gz')
            ? filename
            : `${filename}.gz`;
        const syncResult = await syncVersionedDataFiles([normalizedFilename], {
            preferRemote: true
        });
        const needUpdate = !syncResult.localVersion || syncResult.filesToUpdate.length > 0 || syncResult.savedVersion;

        if (needUpdate) {
            console.log('检测到新版本，开始更新缓存...');
            const primaryData = await getData(filename.replace('.gz', ''));
            const remainingFiles = files.filter(file => file !== normalizedFilename);
            void warmRemainingDataFiles(remainingFiles);
            console.log('缓存更新完成');
            return primaryData || await getData(filename.replace('.gz', ''));
        }

        console.log('版本一致，使用本地缓存');
        return null;
    } catch (error) {
        console.error('检查版本失败:', error);
        return null;
    }
}

// 从 JSON 文件加载数据（带缓存和版本检查，使用 gzip 压缩）
export async function loadSkillData() {
    if (skillData && Object.keys(skillData.skills).length > 0) {
        return skillData;
    }

    try {
        const cachedData = await getData('skill.json');

        if (cachedData) {
            const versionInfo = await checkVersion();
            if (versionInfo.needUpdate) {
                console.log('检测到新版本，开始更新缓存...');
                const newData = await checkAndUpdateCache('skill.json');
                if (newData) {
                    skillData = newData;
                    console.log('从服务器重新加载 skill.json.gz（版本更新）');
                } else {
                    skillData = cachedData;
                    console.warn('skill.json update failed, using cached data');
                }
            } else {
                console.log('从缓存读取 skill.json');
                skillData = cachedData;
            }
        } else {
            console.log('从服务器加载 skill.json.gz（首次加载）');
            skillData = await fetchGzip('data/skill.json.gz');
            saveData('skill.json', skillData).catch(err => console.warn('保存 skill.json 缓存失败:', err));
        }

        skillData.skills.yidaoliu.weapontype = "jianfa1,jianfa2,jianfa3,jianfa4,jianfa5,daofa1,daofa2,daofa3,daofa4,daofa5";
        return skillData;
    } catch (error) {
        console.error('Error loading skill data:', error);
        document.getElementById('skillList').innerHTML =
            '<div class="col-12"><div class="alert alert-danger">加载数据失败，请确保data/skill.json.gz文件存在且格式正确。</div></div>';
        throw error;
    }
}

// 加载主动技能数据（带缓存和版本检查，使用 gzip 压缩）
export async function loadActiveSkillData() {
    if (activeSkillData) return activeSkillData;

    try {
        const cachedData = await getData('activeZhao.json');

        if (cachedData) {
            const syncResult = await syncVersionedDataFiles(['activeZhao.json.gz'], {
                preferRemote: true
            });
            if (syncResult.updatedFiles.length > 0) {
                console.log('检测到新版本，更新 activeZhao.json...');
                const newData = await getData('activeZhao.json');
                if (newData) {
                    activeSkillData = newData;
                    console.log('从服务器重新加载 activeZhao.json.gz（版本更新）');
                    return activeSkillData;
                }
                activeSkillData = cachedData;
                console.warn('activeZhao.json update failed, using cached data');
                return activeSkillData;
            }
            console.log('从缓存读取 activeZhao.json');
            activeSkillData = cachedData;
            return activeSkillData;
        }

        console.log('从服务器加载 activeZhao.json.gz（首次加载）');
        activeSkillData = await fetchGzip('data/activeZhao.json.gz');
        saveData('activeZhao.json', activeSkillData).catch(err => console.warn('保存 activeZhao.json 缓存失败:', err));
        return activeSkillData;
    } catch (error) {
        console.error('Error loading active skill data:', error);
        return null;
    }
}

// 加载被动技能数据（带缓存和版本检查，使用 gzip 压缩）
export async function loadSkillAutoData() {
    if (skillAutoData) return skillAutoData;

    try {
        const cachedData = await getData('skillAuto.json');

        if (cachedData) {
            const syncResult = await syncVersionedDataFiles(['skillAuto.json.gz'], {
                preferRemote: true
            });
            if (syncResult.updatedFiles.length > 0) {
                console.log('检测到新版本，更新 skillAuto.json...');
                const newData = await getData('skillAuto.json');
                if (newData) {
                    skillAutoData = newData;
                    console.log('从服务器重新加载 skillAuto.json.gz（版本更新）');
                    return skillAutoData;
                }
                skillAutoData = cachedData;
                console.warn('skillAuto.json update failed, using cached data');
                return skillAutoData;
            }
            console.log('从缓存读取 skillAuto.json');
            skillAutoData = cachedData;
            return skillAutoData;
        }

        console.log('从服务器加载 skillAuto.json.gz（首次加载）');
        skillAutoData = await fetchGzip('data/skillAuto.json.gz');
        saveData('skillAuto.json', skillAutoData).catch(err => console.warn('保存 skillAuto.json 缓存失败:', err));
        return skillAutoData;
    } catch (error) {
        console.error('Error loading skill auto data:', error);
        return null;
    }
}

// 获取唯一的分类值
export function getUniqueValues(skills, key) {
    const values = new Set();

    Object.values(skills).forEach(skill => {
        if (skill[key]) {
            let methodStr = String(skill[key]);
            if (methodStr.includes(',')) {
                const arrayValues = methodStr.split(',');
                arrayValues.forEach(v => values.add(v.trim()));
            } else {
                values.add(methodStr);
            }
        }
    });
    return Array.from(values).filter(v => v);
}

// 获取武学类型名称
export function getMethodName(methodId) {
    const methodNames = {
        "1": "拳脚",
        "2": "内功",
        "3": "轻功",
        "4": "招架",
        "5": "剑法",
        "6": "刀法",
        "7": "棍法",
        "8": "暗器",
        "9": "鞭法",
        "10": "双持",
        "11": "乐器"
    };
    return methodNames[methodId] || methodId;
}

// 获取武学属性
export function getElementName(elementId) {
    const elementname = {
        "1": "无属性",
        "3": "阳属性",
        "5": "阴属性",
        "7": "混元",
        "9": "外功"
    };
    return elementname[elementId] || elementId;
}

export function getWeapontype(weapontypeId) {
    const elementname = {
        "jianfa1": "长剑",
        "jianfa2": "短剑",
        "jianfa3": "软剑",
        "jianfa4": "重剑",
        "jianfa5": "刺剑",
        "daofa1": "长刀",
        "daofa2": "短刀",
        "daofa3": "弯刀",
        "daofa4": "大环刀",
        "daofa5": "双刀斩",
        "gunfa1": "长棍",
        "gunfa2": "长枪",
        "gunfa3": "三节棍",
        "gunfa4": "狼牙棒",
        "gunfa5": "战戟",
        "bianfa1": "长鞭",
        "bianfa2": "软鞭",
        "bianfa3": "九节鞭",
        "bianfa4": "杖子鞭",
        "bianfa5": "链子镖",
        "anqi1": "锥形暗器",
        "anqi2": "圆形暗器",
        "anqi3": "针形暗器",
        "shuangchi1": "双环",
        "shuangchi2": "对剑",
        "shuangchi3": "双钩",
        "qinfa1": "古琴",
        "qinfa2": "笛子"
    };
    return elementname[weapontypeId] || weapontypeId;
}

// 查找关联的主动技能
export function findActiveSkills(skillId, activeSkillDat, name) {
    if (!activeSkillData || !activeSkillData.skillRelation) return [];

    const relatedSkillGroups = [];

    for (const [activeSkillId, relation] of Object.entries(activeSkillData.skillRelation)) {
        if (relation.skillId === skillId) {
            const baseSkillId = relation.id;
            const skills = [];
            const baseSkill = activeSkillData.ActiveZhao[baseSkillId];

            if (!baseSkill) continue;

            for (let i = 1; i <= 11; i++) {
                const currentId = i === 1 ? baseSkillId : `${baseSkillId}${i}`;
                if (activeSkillData.ActiveZhao[currentId]) {
                    skills.push({
                        id: currentId,
                        level: i,
                        data: activeSkillData.ActiveZhao[currentId]
                    });
                }
            }

            relatedSkillGroups.push({
                activeId: baseSkillId,
                baseActive: baseSkill,
                allActives: skills,
                name: name
            });
        }
    }

    return relatedSkillGroups;
}
