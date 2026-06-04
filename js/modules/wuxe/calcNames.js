/*
 * @Author: whife 3449861455@qq.com
 * @Date: 2026-04-25 15:59:14
 * @LastEditors: whife 3449861455@qq.com
 * @LastEditTime: 2026-04-26 15:42:52
 * @FilePath: \wuxue\js\modules\wuxe\calcNames.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
export const calcParamNames = {
  currstr: "总臂力",
  currdex: "总身法",
  currcon: "总根骨",
  z1: "技能系数",
  avgqiatk: "平均气血攻击",
  wdamage: "武器伤害力",
  buff1Num: "自身增益数量",
  buff2Num: "自身减益或毒数量",
  buff3Num: "对方增益数量",
  buff4Num: "对方减益或毒数量",
  cost: "技能内力消耗",
  zhengqi: "侠义值",
  qimax: "当前气血上限",
  qiMax2: "对方气血上限",
  W1: "武器重量",
  qi: "当前气血",
  qi2: "对方当前气血",
  neili: "当前内力",
  neili3: "对方当前内力",
  neiliMax: "内力上限",
  neiliMax3: "对方内力上限",
  roleLv: "人物等级",
  jingMax: "精力上限",
  currjqdamage: "单系谙技值",
  jqdamage: "双系谙技值",
  CN: "淬炼次数",
  nengGongRecoverNeiLiFactor: "内功内力系数",
  jiaLi: "当前加力值",
  jiaLiMax: "加力最大值",
  recordDamage: "受到实际伤害",
  shieldDeductedHP: "护盾吸收量",
  shieldCurrentHP: "护盾剩余吸收量",
  damageToHurt: "业果承血量",
  augment1num: "激昂层数（上限12）",
  augment2num: "隐元层数（上限32）",
  augment3num: "洞明层数（上限3）",
  augment5num: "隐元层数（上限32）",
  augment6num: "骁勇层数（上限60）",
  augment7num: "仙蛊层数（上限16）",
  augment8num: "着相层数（上限10）",
  augment10num: "长庚层数（上限5）",
  despairForce: "血志层数（上限15）",
  combatStack1num: "创伤层数（上限5）",
  combatStack1num2: "创伤层数（上限5）",
  combatStack2num: "蓄势层数（上限5）",
  combatStack3num: "【金】层数（上限3）",
  combatStack3num2: "【金】层数（上限3）",
  combatStack4num: "生辉层数（上限10）",
  combatStack5num: "天和层数（上限7）",
  combatStack5num2: "天和层数（上限7）",
  combatStack7num: "【镝】层数（上限7）",
  combatStack8num: "复还层数（上限6）",
  combatStack9num: "潜亏层数（上限5）",
  combatStack10num: "驱霆层数（上限10）",
  combatStack11num: "苏生层数（上限10）",
  combatStack13num: "速朽层数（上限40）",
  combatStack22num: "隐逸层数（上限5）",
  combatStack24num: "业因层数（上限10）",
  combatStack26num: "乱脉层数（上限9）",
  fragile4num: "毒蛊层数（上限16）",
  fragile5num: "和息层数（上限4）"
};

// 选择框参数配置：匹配参数名的正则 -> { label, options: [{label, value}], default }
export const calcSelectParams = [
  {
    pattern: /^augment4num$/,
    label: "【扬武】效果",
    options: [
      { label: "无", value: 0 },
      { label: "有", value: 18 },
    ],
    default: 0,
  },
  {
    pattern: /^combatStack6num$/,
    label: "【缓】效果",
    options: [
      { label: "无", value: 0 },
      { label: "有", value: 1 },
    ],
    default: 0,
  },
  {
    pattern: /^combatStack23num$/,
    label: "【心痴】层数",
    options: [
      { label: "三层", value: 3 },
      { label: "二层", value: 2 },
      { label: "一层", value: 1 },
    ],
    default: 3,
  },
  {
    pattern: /^combatStack27num$/,
    label: "【通明】效果",
    options: [
      { label: "无", value: 0 },
      { label: "有", value: 1 },
    ],
    default: 0,
  },
  {
    pattern: /^combatStack(14|15|16|17|19|20|21)num$/,
    label: "隐脉加成",
    options: [
      { label: "无", value: 0 },
      { label: "有", value: 1 },
    ],
    default: 0,
  },
];
