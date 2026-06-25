// 数据加载模块
import {
  loadVersionedResource,
  warmVersionedResources,
} from "../../services/dataService.js";

export let skillData = {
  正气需求: [],
  skills: {},
};
export let activeSkillData = null;
export let skillAutoData = null;
export let bookSkillUnlockData = null;
export let skillRelationData = null;
let backgroundRefreshPromise = null;

function warmRemainingDataFiles(files) {
  if (backgroundRefreshPromise) {
    return backgroundRefreshPromise;
  }

  backgroundRefreshPromise = warmVersionedResources(files)
    .catch((error) => {
      console.warn("Background refresh failed:", error);
    })
    .finally(() => {
      backgroundRefreshPromise = null;
    });

  return backgroundRefreshPromise;
}

// 从 JSON 文件加载数据（带缓存和版本检查，使用 gzip 压缩）
export async function loadSkillData() {
  if (skillData && Object.keys(skillData.skills).length > 0) {
    return skillData;
  }

  try {
    skillData = await loadVersionedResource("skill");
    void warmRemainingDataFiles([
      "activeZhao",
      "skillAuto",
      "meridianMapConfig",
      "acupointConfig",
      "meridianLinkConfig",
    ]);

    skillData.skills.yidaoliu.weapontype =
      "jianfa1,jianfa2,jianfa3,jianfa4,jianfa5,daofa1,daofa2,daofa3,daofa4,daofa5";
    return skillData;
  } catch (error) {
    console.error("Error loading skill data:", error);
    document.getElementById("skillList").innerHTML =
      '<div class="col-12"><div class="alert alert-danger">加载数据失败，请确保data/skill.json.gz文件存在且格式正确。</div></div>';
    throw error;
  }
}

// 加载主动技能数据（带缓存和版本检查，使用 gzip 压缩）
export async function loadActiveSkillData() {
  if (activeSkillData) return activeSkillData;

  try {
    activeSkillData = await loadVersionedResource("activeZhao");
    return activeSkillData;
  } catch (error) {
    console.error("Error loading active skill data:", error);
    return null;
  }
}

// 加载被动技能数据（带缓存和版本检查，使用 gzip 压缩）
export async function loadSkillAutoData() {
  if (skillAutoData) return skillAutoData;

  try {
    skillAutoData = await loadVersionedResource("skillAuto");
    return skillAutoData;
  } catch (error) {
    console.error("Error loading skill auto data:", error);
    return null;
  }
}

// 加载书页技能解锁数据（带缓存和版本检查，使用 gzip 压缩）
export async function loadBookSkillUnlockData() {
  if (bookSkillUnlockData) return bookSkillUnlockData;

  try {
    bookSkillUnlockData = await loadVersionedResource("bookSkills");
    return bookSkillUnlockData;
  } catch (error) {
    console.error("Error loading book skill unlock data:", error);
    return null;
  }
}

// 获取唯一的分类值
export function getUniqueValues(skills, key) {
  const values = new Set();

  Object.values(skills).forEach((skill) => {
    if (skill[key]) {
      let methodStr = String(skill[key]);
      if (methodStr.includes(",")) {
        const arrayValues = methodStr.split(",");
        arrayValues.forEach((v) => values.add(v.trim()));
      } else {
        values.add(methodStr);
      }
    }
  });
  return Array.from(values).filter((v) => v);
}

// 获取武学类型名称
export function getMethodName(methodId) {
  const methodNames = {
    1: "拳脚",
    2: "内功",
    3: "轻功",
    4: "招架",
    5: "剑法",
    6: "刀法",
    7: "棍法",
    8: "暗器",
    9: "鞭法",
    10: "双持",
    11: "乐器",
  };
  return methodNames[methodId] || methodId;
}

// 获取武学属性
export function getElementName(elementId) {
  const elementname = {
    1: "无性",
    3: "阳性",
    5: "阴性",
    7: "混元",
    9: "外功",
  };
  return elementname[elementId] || elementId;
}

export function getWeapontype(weapontypeId) {
  const elementname = {
    jianfa1: "长剑",
    jianfa2: "短剑",
    jianfa3: "软剑",
    jianfa4: "重剑",
    jianfa5: "刺剑",
    daofa1: "长刀",
    daofa2: "短刀",
    daofa3: "弯刀",
    daofa4: "大环刀",
    daofa5: "双刃斧",
    gunfa1: "长棍",
    gunfa2: "长枪",
    gunfa3: "三节棍",
    gunfa4: "狼牙棒",
    gunfa5: "战戟",
    bianfa1: "长鞭",
    bianfa2: "软鞭",
    bianfa3: "九节鞭",
    bianfa4: "杆子鞭",
    bianfa5: "链枷",
    anqi1: "锥形暗器",
    anqi2: "圆形暗器",
    anqi3: "针形暗器",
    shuangchi1: "双环",
    shuangchi2: "对剑",
    shuangchi3: "双钩",
    qinfa1: "古琴",
    qinfa2: "笛子",
  };
  return elementname[weapontypeId] || weapontypeId;
}

// 查找关联的主动技能
export function findActiveSkills(skillId, activeSkillDat, name) {
  if (!activeSkillData || !activeSkillData.skillRelation) return [];

  const relatedSkillGroups = [];

  for (const [activeSkillId, relation] of Object.entries(
    activeSkillData.skillRelation,
  )) {
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
            data: activeSkillData.ActiveZhao[currentId],
          });
        }
      }

      relatedSkillGroups.push({
        activeId: baseSkillId,
        baseActive: baseSkill,
        allActives: skills,
        name: name,
      });
    }
  }

  return relatedSkillGroups;
}

// 解析 effectId 字符串生成可点击链接
// 格式：EFFECTA#z1#z2#z3|EFFECTB#z1#z2#z3
export function createEffectIdLinks(effectIdStr) {
  if (!effectIdStr) return "";
  return effectIdStr
    .split("|")
    .map((part) => {
      const segs = part.split("#");
      const id = segs[0];
      const zValues = segs.slice(1).join(",");
      const zDisplay = segs.slice(1).join(",");
      return `{<span class="effect-link" data-effect-id="${id}" data-z="${zValues}" style="color: #007bff; text-decoration: underline; cursor: pointer;">"${id}"</span>,${zDisplay}}`;
    })
    .join(";");
}

// 查找当前重数对应的入场效果（enterEffect）链接
export function getEnterEffectLinks(activeSkillData, activeLevelId) {
  if (!activeSkillData?.enterEffect) return "";
  const links = [];
  for (const [key, entry] of Object.entries(activeSkillData.enterEffect)) {
    if (
      (entry.id === activeLevelId || key === activeLevelId) &&
      entry.effectId
    ) {
      links.push(createEffectIdLinks(entry.effectId));
    }
  }
  return links.join(" ");
}

// 查找当前重数对应的被动效果（passiveEffect）链接
export function getPassiveEffectLinks(activeSkillData, activeLevelId) {
  if (!activeSkillData?.passiveEffect) return "";
  const links = [];
  for (const [key, entry] of Object.entries(activeSkillData.passiveEffect)) {
    if (
      (entry.skillId === activeLevelId ||
        entry.id === activeLevelId ||
        key === activeLevelId) &&
      entry.effectId
    ) {
      links.push(createEffectIdLinks(entry.effectId));
    }
  }
  return links.join(" ");
}
