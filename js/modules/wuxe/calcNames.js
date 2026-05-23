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
  buff1Num: "增益数量",
  buff2Num: "减益数量",
  cost: "技能内力消耗",
  zhengqi: "侠义值",
  qimax: "当前气血上限",
  qiMax2: "对方气血上限",
  W1: "武器重量",
  qi: "当前气血",
  neili: "当前内力",
  neiliMax: "内力上限",
  neili3: "对方当前内力",
  neiliMax3: "对方内力上限",
  roleLv: "人物等级",
  jingMax: "精力上限",
  augment7num: "仙蛊层数（上限16）",
  fragile4num: "毒蛊层数（上限16）",
  fragile5num: "和息层数（上限4）",
  currjqdamage: "单系谙技值",
  jqdamage: "双系谙技值",
};

// 选择框参数配置：匹配参数名的正则 -> { label, options: [{label, value}], default }
export const calcSelectParams = [
  {
    pattern: /^combatStack\d+num$/,
    label: "隐脉加成",
    options: [
      { label: "无", value: 0 },
      { label: "有", value: 1 },
    ],
    default: 0,
  },
];
