/**
 * @file conditionToCN.js
 * @author XiaoZhiWei (original Lua), converted to JS
 * @time 2017/02/23 21:33:46 (original)
 * @desc 条件转换为中文 — 从 ActiveZhao.lua 提取并转换为 JavaScript
 *
 * 依赖说明：
 *   - 技能名称查询直接引用 skillData.skills（来自 dataLoader.js），无需外部注入。
 *   - Role.getCHAttrName  的属性映射表已内嵌（提取自 Role.lua），无需额外引用。
 *   - Family.getFamily    的门派名映射表已内嵌（提取自 family.lua），无需额外引用。
 */

import {
  skillData,
  activeSkillData,
  bookSkillUnlockData,
} from "./dataLoader.js";

// =========================== 工具函数 ===========================

/**
 * 模拟 Lua 的 switch 语义：
 *   switch(value, {
 *       ["key1"] = function() return ... end,   -- 匹配时执行函数并返回
 *       ["key2"] = someValue,                    -- 匹配时直接返回该值
 *       default  = fallbackValue                 -- 默认值 / 默认函数
 *   })
 *
 * - 当 cases 是「数字键数组」(如 {0: "拳脚", 1: "内功"}) 时，将 value 视为索引返回对应元素。
 * - 当 cases 是「字符串键映射」时，先查找精确匹配；命中函数则调用，否则直接返回值。
 * - 均未命中时返回 cases.default（若是函数则调用）。
 *
 * @param {string|number} value
 * @param {Object} cases
 * @returns {*}
 */
function switchLua(value, cases) {
  if (!cases || typeof cases !== "object") {
    return undefined;
  }

  // 情况1：数字键数组风格  { 1: "拳脚", 2: "内功", ... }
  // 检测方式：存在数字键 1，且 default 未定义或为特殊哨兵
  if (
    typeof cases[1] !== "undefined" &&
    !(cases.default !== undefined && Object.keys(cases).length === 1)
  ) {
    // 进一步确认：所有键都是数字（或可转为数字）
    const keys = Object.keys(cases).filter((k) => k !== "default");
    const allNumeric = keys.every((k) => /^\d+$/.test(k));
    if (allNumeric && keys.length > 0) {
      // Lua 下标从 1 开始 → JS 直接使用数字键
      const idx = Number(value);
      if (cases[idx] !== undefined) {
        const hit = cases[idx];
        return typeof hit === "function" ? hit() : hit;
      }
      // fallthrough 到 default
    }
  }

  // 情况2：字符串键映射风格
  if (value !== undefined && value !== null && cases[value] !== undefined) {
    const hit = cases[value];
    return typeof hit === "function" ? hit() : hit;
  }

  // default
  if (cases.default !== undefined) {
    const def = cases.default;
    return typeof def === "function" ? def() : def;
  }

  return undefined;
}

/**
 * 模拟 Lua 的 MapIsEmpty — 判断对象/Map 是否为空
 * @param {Object|Map|Array|null|undefined} obj
 * @returns {boolean}
 */
function mapIsEmpty(obj) {
  if (obj == null) return true;
  if (obj instanceof Map) return obj.size === 0;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === "object") return Object.keys(obj).length === 0;
  return true;
}

// =========================== 中文转换映射 ===========================

/** 逻辑运算符 → 中文 */
const LOGIC_CN_MAP = {
  小于: "低于",
  小于等于: "不高于",
  等于: "为",
  大于等于: "不低于",
  大于: "高于",
};
LOGIC_CN_MAP.default = "";

/** 装备技能类型 → 中文（Lua 中通过 switch 数字索引映射） */
const METHOD_CN_TABLE = {
  1: "拳脚",
  2: "内功",
  3: "轻功",
  4: "招架",
  5: "兵器",
};

/**
 * 获取技能准备类型的中文名称
 * @param {number} stype
 * @returns {string}
 */
function getMethodCN(stype) {
  return METHOD_CN_TABLE[stype] || "";
}

// =========================== 属性名映射（提取自 Role.lua : getCHAttrName） ===========================

/**
 * 角色属性 ID → 中文名称 映射表
 * 直接提取自 Role.lua 的 getCHAttrName 函数，忽略了外部 CurrencyUtil 模块引用。
 */
const ATTR_NAME_MAP = {
  age: "年龄",
  sex: "性别",
  exp: "经验",
  pot: "潜能",
  money: "碎银",
  gold: "黄金",
  looks: "容貌",
  luck: "福缘",
  str: "臂力",
  int: "悟性",
  con: "根骨",
  dex: "身法",
  currStr: "臂力",
  currInt: "悟性",
  currCon: "根骨",
  currDex: "身法",
  secStr: "臂力",
  secInt: "悟性",
  secCon: "根骨",
  secDex: "身法",
  jing: "精力",
  jingMax: "最大精力",
  qi: "气血",
  qiMax: "气血最大值",
  neili: "内力",
  neiliMax: "内力最大值",
  lv: "等级",
  yuanbao: "元宝",
  weight: "背包容量",
  zhengqi: "侠义正气",
  kill: "杀死人数",
  yueli: "江湖阅历",
  killPlayer: "杀玩家数",
  weiwang: "江湖威望",
  dead: "死亡次数",
  meili: "风度魅力",
  deadReason: "上次死因",
  jindu: "江湖进度",
  lunhui: "轮回次数",
  mengjing: "梦境层数",
  panshi: "判师次数",
  qiPercent: "气血上限",
  decorativeLimit: "装饰箱容量",
  meridianExp: "经脉经验",
  breathVal: "真气",
  leftRightFightExp: "左右互搏熟练度",
  meiyu: "江湖美誉",
  gongxiandian: "师门贡献点",
  yinpiao: "银票",
  zjjifen: "战绩积分",
  prestige: "师门声望",
  intimacy: "亲密度",
  dreamCoins: "梦境币",
  dreamPoints: "碎银",
  jiaozi: "游字令",
  emotion: "情绪",
  sober: "清醒值",
  pijuan: "疲倦值",
  zhounianqin_jf: "新春礼券",
  zhounianliquan: "七夕礼券",
  daily_point: "积分",
  mingbi: "冥币",
  baoyu: "宝玉",
  spcl: "饰品材料",
  yxjianghuling1: "江湖令",
  dreamYiYu: "梦内呓语",
  xiangnang: "香囊",
  zongheng: "雪矾",
  molizhu: "墨璃珠",
  anecdote: "轶闻",
  amartial: "武学要领",
  bmartial: "武学心得",
  cmartial: "武学至极",
  dmartial: "功法学识",
  baiduo: "白堕",
  canghuangling: "苍黄令",
  xizhaoling: "昔朝令",
  minditem1: "清心散",
  minditem2: "谧心丸",
  minditem3: "凝心露",
  minditem4: "聚心丹",
  miyao: "密钥",
  guanyingquan: "观影券",
  zhounianjf: "丹青",
  accpoint: "固身元气",
  characterPoint: "特性见解",
  lianGongTiLi: "笃志",
  ningshendan: "凝神丹",
  reputation: "个人功绩",
  diligent: "勤建之志",
  sgbpoint: "贡献昌盛度",
  gbpoint: "师门昌盛度",
  renown: "资历",
  bmaterials1: "三合土",
  bmaterials2: "青石砖",
  bmaterials3: "楠木",
  bmaterials4: "汉白玉",
  bmaterials5: "琉璃瓦",
  bmaterials6: "生漆",
  donate: "佳绩",
  featscount: "名绩点",
  paymaskmake: "鹿胶",
  ygpill: "养真丹",
  guidancecount: "师门指点次数",
};

/**
 * 获取属性中文名称（内嵌实现，无需依赖外部 Role 模块）
 * @param {string} attr - 属性 ID
 * @returns {string} 中文名称，查不到返回空字符串
 */
function getCHAttrName(attr) {
  if (!attr) {
    return "";
  }
  // 注：原 Lua 中有一段 CurrencyUtil 货币判断逻辑，此处已忽略
  return ATTR_NAME_MAP[attr] || "";
}

// =========================== 门派名映射（提取自 Family.lua : getFamily + family.lua 数据） ===========================

/** 旧门派 ID → 新门派 ID 映射（兼容老存档） */
const FAMILY_ID_ALIAS = {
  xiaoyao: "tianshan",
  lingjiugong: "tianshan",
};

/**
 * 门派 ID → 中文名称 映射表
 * 提取自 script/family/family.lua 数据文件，内嵌实现无需依赖外部 Family 模块。
 */
const FAMILY_NAME_MAP = {
  baituoshan: "鸩羽山",
  dali: "天龙寺",
  emei: "峨眉派",
  gaibang: "丐帮",
  guanfu: "官府",
  gumu: "问情宫",
  haijing: "海鲸帮",
  huashan: "华山",
  jinqianbang: "财神帮",
  kongtong: "崆峒派",
  kunlun: "昆仑派",
  luoyue: "落月山庄",
  mingjiao: "明教",
  mizong: "雪山寺",
  murong: "燕氏皇族",
  quanzhen: "全真教",
  riyueshenjiao: "拜日教",
  seclusion: "归隐",
  shaolin: "少林派",
  tangmen: "唐门",
  taohuadao: "蓬莱岛",
  tianjingmen: "天竞门",
  tianshan: "虚渺宫",
  tiezhang: "伏龙山",
  wudang: "武当派",
  wudu: "万灵谷",
  xingxiu: "天狼教",
  yongyelou: "永夜楼",
  youming: "幽冥教",
  youxia: "散人",
};

/**
 * 获取门派中文名称（内嵌实现，无需依赖外部 Family 模块）
 * @param {string} id - 门派 ID
 * @returns {string} 中文名称，查不到返回空字符串
 */
function getFamilyName(id) {
  if (!id) {
    return "";
  }
  // 兼容旧门派 ID 映射（如 xiaoyao → tianshan）
  const resolvedId = FAMILY_ID_ALIAS[id] || id;
  return FAMILY_NAME_MAP[resolvedId] || "";
}

// =========================== 技能查询（直接引用 skillData.skills） ===========================

const Skill = {
  /**
   * @param {string} id - 技能 ID
   * @returns {{ name: string, _NoColorName: string } | null}
   */
  getSkill(id) {
    const skill = skillData.skills[id];
    if (!skill) return null;
    return {
      name: skill.name,
      // JSON 数据中的 name 已为纯净文本，直接用做 _NoColorName
      _NoColorName: skill.name,
    };
  },
};

// =========================== 核心函数 ===========================

/**
 * 将单条条件转换为中文描述文本
 *
 * @param {string} ctype  - 条件类型: "属性" | "武功" | "装备技能" | "门派" | "使用武学" | "使用武学属于门派"
 * @param {string} id     - 条件 ID（可能包含 " or " 分隔的多个值）
 * @param {string} logic  - 逻辑运算符: "小于" | "小于等于" | "等于" | "大于等于" | "大于" | "不等于"
 * @param {string} value  - 条件值（可能包含 " or " 分隔的多个值）
 * @returns {string|undefined} 中文描述，无法处理时返回 undefined
 */
function conditionToCN(ctype, id, logic, value) {
  const logicWord =
    LOGIC_CN_MAP[logic] !== undefined
      ? LOGIC_CN_MAP[logic]
      : LOGIC_CN_MAP.default;

  return switchLua(ctype, {
    // ----------------------------------------------------------
    ["属性"]: function () {
      return "【" + getCHAttrName(id) + "】" + logicWord + String(value);
    },

    // ----------------------------------------------------------
    ["武功"]: function () {
      const skill = Skill.getSkill(id);
      if (!mapIsEmpty(skill)) {
        return (
          "【" + String(skill.name) + "】" + logicWord + String(value) + "级"
        );
      }
      // Lua 原逻辑：MapIsEmpty 为 true 时无返回值 → undefined
    },

    // ----------------------------------------------------------
    ["装备技能"]: function () {
      const list = id.split(" or ");
      let str = "";
      for (let i = 0; i < list.length; i++) {
        const sid = list[i];
        const skill = Skill.getSkill(sid);
        if (!mapIsEmpty(skill)) {
          if (i === 0) {
            str += "【" + String(skill._NoColorName) + "】";
          } else {
            str += "或【" + String(skill._NoColorName) + "】";
          }
        }
      }

      let prefix = "";
      if (logic === "不等于") {
        prefix = "禁止";
      }

      if (value === "是") {
        return prefix + "准备" + str;
      } else if (!isNaN(Number(value))) {
        return prefix + "准备" + str + "为" + getMethodCN(Number(value));
      } else if (value.indexOf(" or ") !== -1) {
        const valueList = value.split(" or ");
        let text = "";
        for (let k = 0; k < valueList.length; k++) {
          const v = valueList[k];
          if (k === 0) {
            text = prefix + "准备" + str + "为" + getMethodCN(Number(v));
          } else {
            text += "或" + getMethodCN(Number(v));
          }
        }
        return text;
      } else {
        return "未准备" + str;
      }
    },

    // ----------------------------------------------------------
    ["门派"]: function () {
      const list = id.split(" or ");
      let str = "[门派]为";
      for (let i = 0; i < list.length; i++) {
        const name = getFamilyName(list[i]);
        if (name) {
          if (i === 0) {
            str += "【" + name + "】";
          } else {
            str += "或【" + name + "】";
          }
        }
      }
      return str;
    },

    // ----------------------------------------------------------
    ["使用武学"]: function () {
      const skillIdList = id.split(" or ");
      let str = "";
      for (let i = 0; i < skillIdList.length; i++) {
        const sid = skillIdList[i];
        const skill = Skill.getSkill(sid);
        if (!mapIsEmpty(skill)) {
          if (i === 0) {
            str += "【" + String(skill._NoColorName) + "】";
          } else {
            str += "或【" + String(skill._NoColorName) + "】";
          }
        } else {
          console.log("找不到技能：" + sid);
        }
      }

      if (str !== "") {
        return "战斗中使用" + "【" + value + "】" + "为" + str;
      }
    },

    // ----------------------------------------------------------
    ["使用武学属于门派"]: function () {
      const skilType = id;
      const familyList = value.split(" or ");
      let str = "战斗中使用" + "【" + skilType + "】";

      for (let i = 0; i < familyList.length; i++) {
        const name = getFamilyName(familyList[i]);
        if (name) {
          if (i === 0) {
            str += "为【" + name + "】";
          } else {
            str += "或【" + name + "】";
          }
        }
      }

      str += "武学";
      return str;
    },

    default: undefined,
  });
}

/**
 * 获取通过书页学习招式的描述文本
 * 对应 Lua: BookSkillsHelper:getActiveSkillLearnForBookText(activeId)
 *
 * @param {string} activeId - 主动招式 ID（可能带末尾数字编号，如 "shengsijie10"）
 * @returns {string} 描述文本，如 "学习3本残页名称后习得"；不适用时返回 ""
 */
function getActiveSkillLearnForBookText(activeId) {
  // 规范化 activeId：去掉结尾的数字，例如 "shengsijie10" → "shengsijie"
  const activeIdStr = String(activeId);
  const normalizedActiveId = activeIdStr.match(/^(.*?)\d*$/)
    ? activeIdStr.match(/^(.*?)\d*$/)[1]
    : activeIdStr;

  const activeZhao = activeSkillData.ActiveZhao[normalizedActiveId];
  if (!activeZhao || activeZhao.learnMethod !== 1) {
    return "此技能自动解锁";
  }

  const skillRelation = activeSkillData.skillRelation?.[normalizedActiveId];
  if (!skillRelation?.skillId) {
    return "";
  }
  const skillId = skillRelation.skillId;

  const bookLearnData = bookSkillUnlockData.activeZhao[skillId];
  if (!bookLearnData) {
    return "";
  }

  // 遍历 pageName1..pageName10，查找匹配 ${normalizedActiveId}canye 的条目
  const targetPageName = normalizedActiveId + "canye";
  for (let i = 1; i <= 10; i++) {
    const pageName = bookLearnData["pageName" + i];
    const pageCount = bookLearnData["pageCount" + i];
    if (pageName === targetPageName && pageCount && pageCount > 0) {
      return "此技能需要 " + pageCount + " 张残页解锁";
    }
  }

  return "";
}

// =========================== 导出 ===========================

export {
  conditionToCN,
  switchLua,
  mapIsEmpty,
  getMethodCN,
  getCHAttrName,
  getFamilyName,
  getActiveSkillLearnForBookText,
  ATTR_NAME_MAP,
  FAMILY_NAME_MAP,
  FAMILY_ID_ALIAS,
  LOGIC_CN_MAP,
  METHOD_CN_TABLE,
};
