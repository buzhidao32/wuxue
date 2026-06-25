// 武学展示逻辑模块
import {
  findActiveSkills,
  getMethodName,
  getElementName,
  getWeapontype,
  skillData,
  createEffectIdLinks,
  getEnterEffectLinks,
  getPassiveEffectLinks,
} from "./dataLoader.js";
import { calcParamNames, calcSelectParams } from "./calcNames.js";
import { jsonModal, modalManager, effectModal } from "./uiManager.js";
import {
  conditionToCN,
  getCHAttrName,
  getMethodCN,
  getActiveSkillLearnForBookText,
} from "./conditionToCN.js";

// 禁止公式函数访问的全局对象白名单（Bug 7：变量访问安全边界）
const _BLOCKED_GLOBALS = [
  "window",
  "document",
  "globalThis",
  "self",
  "location",
  "history",
  "navigator",
  "fetch",
  "XMLHttpRequest",
  "eval",
  "Function",
  "setTimeout",
  "setInterval",
  "alert",
  "confirm",
  "prompt",
  "localStorage",
  "sessionStorage",
];

// 渲染优化参数
const renderBatchSize = 20; // 每次渲染的卡片数量
let renderTimeout = null; // 渲染超时定时器

function renderLoadingState(container) {
  container.innerHTML = `
        <div class="loading" id="initialLoading">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p>加载数据中...</p>
        </div>
    `;
}

// 解析effects字符串，返回效果ID数组
function parseEffects(effectsStr) {
  if (!effectsStr) return [];
  const effects = [];
  const regex = /\{"([^"]+)"/g;
  let match;
  while ((match = regex.exec(effectsStr)) !== null) {
    effects.push(match[1]);
  }
  return effects;
}

// 创建效果链接
export function createEffectLinks(effectsStr, cost) {
  if (!effectsStr) return effectsStr;
  const regex = /\{"([^"]+)"((?:\s*,\s*[^,}]+)*)\}/g;
  let result = effectsStr.replace(regex, (match, id, args) => {
    let zValues = "";
    if (args && args.trim().startsWith(",")) {
      zValues = args.trim().substring(1);
    }
    const costAttr = cost !== undefined ? ` data-cost="${cost}"` : "";
    return `{<span class="effect-link" data-effect-id="${id}" data-z="${zValues}"${costAttr} style="color: #007bff; text-decoration: underline; cursor: pointer;">"${id}"</span>${args}}`;
  });
  return result;
}

// 检查字符串是否可能是效果ID
// 规律分析（基于2445个实际效果ID）：
// 1. 以大写字母开头（占99%）：可包含大写、数字、小写
//    - 纯大写+数字（占74%）：JIQU12, DYC1
//    - 大写+驼峰（混合大小写）：HJTJIN1CheckBJ
// 2. 以ff_开头的格式（占1%，全部618个）：ff_GJS_J4Lv3
function isPotentialEffectId(str) {
  if (typeof str !== "string" || str.length < 2) return false;

  // 排除已知的参数字段名
  const excludedFields = new Set([
    "arg1",
    "arg2",
    "arg3",
    "arg4",
    "arg5",
    "duration",
    "effectType",
    "cost",
    "name",
    "type",
    "target",
    "id",
    "property",
    "beginDesc",
    "endDesc",
    "doDesc",
    "activeZhaoAtkDamageClass",
    "activeZhaoAtkDamageParam",
    "skillText",
    "action",
    "atk",
    "dam",
    "hitRate",
    "lv",
    "preDuration",
    "aftDuration",
    "damageType",
    "effects",
    ...Object.keys(calcParamNames), // 排除所有计算参数名
  ]);

  if (excludedFields.has(str)) return false;

  // 动态检查是否匹配calcSelectParams中的任何参数模式
  for (const selectParam of calcSelectParams) {
    if (selectParam.pattern.test(str)) {
      return false; // 匹配了选择框参数，排除
    }
  }

  // 规则1：以大写字母开头，后续为大写/数字/小写的任意组合（占99%）
  // 例: JIQU12, DYC1, HJTJIN1CheckBJ
  if (/^[A-Z][A-Z0-9a-z]*$/.test(str)) return true;

  // 规则2：精确匹配ff_开头的格式（占1%，全部小写开头ID都是这个模式）
  // 例: ff_GJS_J4Lv3, ff_GJJSB2_J4Lv8
  if (/^ff_[A-Z_]/.test(str)) return true;

  return false;
}

// 递归处理JSON对象中的效果ID
function processEffectIds(obj, currentId, processedIds = new Set()) {
  if (!obj) return obj;

  if (processedIds.has(currentId)) return obj;
  processedIds.add(currentId);

  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    if (
      key.startsWith("arg") &&
      isPotentialEffectId(value) &&
      value !== currentId
    ) {
      result[key] =
        `<span class="effect-link json-effect-link" data-effect-id="${value}" style="color: #007bff; text-decoration: underline; cursor: pointer;">${value}</span>`;
    } else if (typeof value === "object" && value !== null) {
      result[key] = processEffectIds(value, currentId, new Set(processedIds));
    } else {
      result[key] = value;
    }
  }

  return result;
}

// 将对象转换为带有效果链接的HTML
function jsonToHtmlWithEffectLinks(obj, currentId) {
  const processed = processEffectIds(obj, currentId);
  return JSON.stringify(processed, null, 2)
    .replace(/\\"/g, '"')
    .replace(/"<span/g, "<span")
    .replace(/<\/span>"/g, "</span>");
}

// 显示效果详情
export function showEffectDetails(
  effectId,
  activeSkillData,
  defaultParams = {},
) {
  if (!activeSkillData?.Effect?.[effectId]) {
    console.log("Effect not found:", effectId);
    return;
  }

  try {
    const effectData = activeSkillData.Effect[effectId];
    const modalElement = document.getElementById("effectModal");
    document.getElementById("effectModalLabel").textContent =
      `效果详情: ${effectId}`;

    const modalBody = modalElement.querySelector(".modal-body");

    // 移除旧的计算器UI
    const oldCalc = modalBody.querySelector(".effect-calculator");
    if (oldCalc) oldCalc.remove();

    const contentElement = document.getElementById("effectContent");

    // 克隆一份数据处理特定字段用于展示
    const displayData = { ...effectData };
    if (displayData.activeZhaoAtkDamageClass) {
      displayData.activeZhaoAtkDamageClass = getElementName(
        displayData.activeZhaoAtkDamageClass,
      );
    }

    contentElement.innerHTML = jsonToHtmlWithEffectLinks(displayData, effectId);

    // if (effectData.type === "属性变化") {
    const formulas = [];
    for (const key in effectData) {
      if (key.startsWith("arg")) {
        const val = effectData[key];
        if (typeof val === "string") {
          if (
            !isPotentialEffectId(val) &&
            val.trim() !== "" &&
            (/\bz\d+\b/.test(val) ||
              val.includes("return") ||
              /[+\-*\/]/.test(val))
          ) {
            formulas.push({ key, script: val });
          }
        }
      }
    }

    if (formulas.length > 0) {
      const calcContainer = document.createElement("div");
      calcContainer.className =
        "effect-calculator mb-3 p-3 border rounded bg-light";

      // 解析Lua风格脚本为JS
      const parseScriptToJS = (luaScript) => {
        let jsScript = luaScript
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .replace(/\belseif\b\s+(.*?)\s+\bthen\b/g, "} else if ($1) {")
          .replace(/\bif\b\s+(.*?)\s+\bthen\b/g, "if ($1) {")
          .replace(/\belse\b(?!\s*if)/g, "} else {")
          .replace(/\bend\b/g, "}")
          .replace(/\band\b/g, "&&")
          .replace(/\bor\b/g, "||")
          .replace(/\^/g, "**")
          .replace(/\brandom\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, "($1 + $2) / 2");

        jsScript = jsScript
          .split("\n")
          .map((line) => {
            if (line.includes("return") && !line.trim().endsWith(";")) {
              return line + ";";
            }
            return line;
          })
          .join("\n");

        if (!jsScript.includes("return")) {
          jsScript = `return ${jsScript};`;
        }
        return jsScript;
      };

      const extractVariables = (script) => {
        const varRegex = /[a-zA-Z_]\w*/g;
        const keywords = [
          "if",
          "then",
          "else",
          "elseif",
          "end",
          "return",
          "and",
          "or",
          "math",
          "floor",
          "ceil",
          "abs",
          "min",
          "max",
        ];
        const vars = new Set();
        let match;
        while ((match = varRegex.exec(script)) !== null) {
          if (!keywords.includes(match[0])) {
            vars.add(match[0]);
          }
        }
        return Array.from(vars);
      };

      let allVars = new Set();
      const compiledFormulas = formulas.map((f) => {
        const jsScript = parseScriptToJS(f.script);
        const vars = extractVariables(jsScript);
        vars.forEach((v) => allVars.add(v));
        return { key: f.key, jsScript, vars };
      });

      // 提取 duration 中的变量，确保它们也能生成输入框
      if (typeof effectData.duration === "string") {
        const durScript = parseScriptToJS(effectData.duration);
        const durVars = extractVariables(durScript);
        durVars.forEach((v) => allVars.add(v));
      }

      allVars = Array.from(allVars);

      // z2、z3 不显示在输入框，直接从 defaultParams 取
      allVars = allVars.filter((v) => v !== "z2" && v !== "z3");

      // 检测特殊arg1类型判断
      const specialArg1Values = [
        "qiAutoAtkFactor",
        "qiAutoDefFactor",
        "qiActiveAtkFactor",
        "qiActiveDefFactor",
      ];
      const isSpecialArg1 = specialArg1Values.includes(effectData.arg1);

      // 使用统一的缓存键保存所有参数
      const cacheKey = "calc_params_all";
      let cachedValues = {};
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          cachedValues = JSON.parse(cached);
        }
      } catch (e) {
        console.warn("Failed to load cached values:", e);
      }

      let inputsHtml = '<h6>计算参数</h6><div class="row g-2 mb-2">';
      allVars.forEach((v) => {
        let defVal = 0;
        if (cachedValues[v] !== undefined) {
          defVal = cachedValues[v];
        } else if (defaultParams && defaultParams[v] !== undefined) {
          defVal = defaultParams[v];
        }
        const labelName = calcParamNames[v] ? calcParamNames[v] : v;

        // 检查是否为选择框参数（仅在 calcParamNames 中未定义时才匹配）
        const selectConfig =
          !calcParamNames[v] &&
          calcSelectParams.find((cfg) => cfg.pattern.test(v));
        if (selectConfig) {
          const selectLabel = selectConfig.label;
          const selectedDefault =
            cachedValues[v] !== undefined
              ? cachedValues[v]
              : selectConfig.default;
          const optionsHtml = selectConfig.options
            .map(
              (opt) =>
                `<option value="${opt.value}"${opt.value == selectedDefault ? " selected" : ""}>${opt.label}</option>`,
            )
            .join("");
          inputsHtml += `
            <div class="col-4">
              <label class="form-label mb-0" style="font-size: 0.8rem;" title="${v}">${selectLabel}</label>
              <select class="form-select form-select-sm calc-input" data-var="${v}">${optionsHtml}</select>
            </div>`;
        } else {
          inputsHtml += `
            <div class="col-4">
              <label class="form-label mb-0" style="font-size: 0.8rem;" title="${v}">${labelName}</label>
              <input type="number" class="form-control form-control-sm calc-input" data-var="${v}" value="${defVal}">
            </div>`;
        }
      });
      inputsHtml +=
        '</div><div class="mt-2"><button type="button" class="btn btn-primary btn-sm" id="calcButton">计算</button></div><hr><div id="calcResults"></div>';
      calcContainer.innerHTML = inputsHtml;

      modalBody.insertBefore(calcContainer, contentElement);

      const updateResults = () => {
        const values = {};
        calcContainer.querySelectorAll(".calc-input").forEach((input) => {
          values[input.dataset.var] = parseFloat(input.value) || 0;
        });

        // z2、z3 不在输入框中，直接从 defaultParams 注入供计算使用
        if (defaultParams["z2"] !== undefined) {
          values["z2"] = defaultParams["z2"];
        }
        if (defaultParams["z3"] !== undefined) {
          values["z3"] = defaultParams["z3"];
        }

        // 保存参数值到缓存（保留其他参数，不保存z开头和cost参数）
        try {
          const valuesToSave = Object.entries(values)
            .filter(([key]) => !/^z\d+$/.test(key) && key !== "cost")
            .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
          const updatedValues = { ...cachedValues, ...valuesToSave };
          localStorage.setItem(cacheKey, JSON.stringify(updatedValues));
        } catch (e) {
          console.warn("Failed to save cached values:", e);
        }

        const resultsDiv = calcContainer.querySelector("#calcResults");
        let resultsHtml = "";

        // 定义参数标签映射关系
        const paramLabelMap = {
          default: {
            arg1: "计算结果",
            arg2: "计算结果",
          },
          汲取: {
            arg2: "消去内力",
            arg3: "回复内力",
          },
        };
        const effectType = effectData.type || "default";
        const currentLabelMap =
          paramLabelMap[effectType] || paramLabelMap.default;

        // 检查当前effectType是否在映射关系中
        const hasTypeMapping = effectType in paramLabelMap;

        // 先计算所有结果，用于后续处理
        const allResults = {};
        compiledFormulas.forEach((f) => {
          try {
            const argNames = Object.keys(values);
            const argVals = Object.values(values);
            const funcBody = `
                const math = Math;
                const min = Math.min;
                const max = Math.max;
                const abs = Math.abs;
                const floor = Math.floor;
                const ceil = Math.ceil;
                ${f.jsScript}
              `;
            const func = new Function(
              ..._BLOCKED_GLOBALS,
              ...argNames,
              funcBody,
            );
            let res = func(
              ..._BLOCKED_GLOBALS.map(() => undefined),
              ...argVals,
            );
            if (typeof res === "number") {
              res = parseFloat(res.toFixed(4));
            }
            allResults[f.key] = res;
          } catch (e) {
            allResults[f.key] = null;
          }
        });

        // 计算持续时间 t（所有类型均尝试解析）
        let durationT = 0;
        if (effectData.duration !== undefined) {
          try {
            const durScript = String(effectData.duration);
            // 合并输入框参数与上层传入的z参数（z参数优先使用defaultParams）
            const durValues = { ...values };
            Object.keys(defaultParams).forEach((k) => {
              if (/^z\d+$/.test(k)) {
                durValues[k] = defaultParams[k];
              }
            });
            const argNames = Object.keys(durValues);
            const argVals = Object.values(durValues);
            const parsedDur = parseScriptToJS(durScript);
            const funcBody = `
                const math = Math;
                const min = Math.min;
                const max = Math.max;
                const abs = Math.abs;
                const floor = Math.floor;
                const ceil = Math.ceil;
                ${parsedDur}
              `;
            const func = new Function(
              ..._BLOCKED_GLOBALS,
              ...argNames,
              funcBody,
            );
            const durResult = func(
              ..._BLOCKED_GLOBALS.map(() => undefined),
              ...argVals,
            );
            if (typeof durResult === "number" && durResult > 0) {
              durationT = durResult;
            }
          } catch (e) {
            // duration 解析失败则忽略
          }
        }
        const tickCount = durationT > 0 ? Math.ceil(durationT / 2) : 0;

        // 检测特殊arg1类型：arg3不单独展示，而是作为最多生效次数附加到上一条
        // arg3 可能是公式计算结果，也可能直接是数字字面量
        let arg3MaxCount = null;
        if (isSpecialArg1) {
          if (allResults["arg3"] != null) {
            arg3MaxCount = Math.round(allResults["arg3"]);
          } else if (typeof effectData.arg3 === "number") {
            arg3MaxCount = Math.round(effectData.arg3);
          }
        }

        // 生成结果HTML
        let isFirstFormula = true;
        const formulasToRender = compiledFormulas.filter(
          (f) => !(isSpecialArg1 && f.key === "arg3"),
        );
        formulasToRender.forEach((f, renderIndex) => {
          const isLastRendered = renderIndex === formulasToRender.length - 1;
          const res = allResults[f.key];
          if (res === null) {
            resultsHtml += `<div><strong>${f.key}</strong>: <span class="text-danger">计算错误</span></div>`;
          } else {
            // 获取参数标签
            let labelName;
            if (!hasTypeMapping && isFirstFormula && effectData.name) {
              // 当effectType不在映射关系中时，第一个标签优先使用effectData.name
              labelName = effectData.name;
            } else {
              // 其余情况使用映射关系
              labelName = currentLabelMap[f.key] || f.key;
            }

            // 特殊处理：汲取类型下，arg3的结果 = arg3结果 * arg2结果
            let displayRes = res;
            if (
              effectType === "汲取" &&
              f.key === "arg3" &&
              allResults["arg2"] !== null
            ) {
              displayRes = parseFloat((-res * allResults["arg2"]).toFixed(4));
            }

            // 属性变化类型取整
            if (
              effectData.type === "属性变化" &&
              typeof displayRes === "number"
            ) {
              displayRes = Math.round(displayRes);
            }

            resultsHtml += `<div><strong>${labelName}</strong>: ${displayRes}`;

            // 拼装括号内的注释
            const notes = [];
            if (durationT > 0 && effectData.type !== "属性变化") {
              notes.push(`持续 ${durationT} 秒`);
            }
            if (isLastRendered && arg3MaxCount !== null) {
              notes.push(`最多生效 ${arg3MaxCount} 次`);
            }
            if (notes.length > 0) {
              resultsHtml += ` <span class="text-muted" style="font-size:0.85rem;">（${notes.join("，")}）</span>`;
            }
            resultsHtml += `</div>`;

            // 持续时间附加信息（仅属性变化类型且 t > 0）
            if (effectData.type === "属性变化" && durationT > 0) {
              const total = Math.round(displayRes * tickCount);
              const totalNotes = [
                `持续 ${durationT} 秒`,
                `生效 ${tickCount} 次`,
              ];
              if (isLastRendered && arg3MaxCount !== null) {
                totalNotes.push(`最多生效 ${arg3MaxCount} 次`);
              }
              resultsHtml += `<div><strong>总${labelName}</strong>: ${total} <span class="text-muted" style="font-size:0.85rem;">（${totalNotes.join("，")}）</span></div>`;
            }

            isFirstFormula = false;
          }
        });
        resultsDiv.innerHTML = resultsHtml;
      };

      const calcButton = calcContainer.querySelector("#calcButton");
      if (calcButton) {
        calcButton.addEventListener("click", updateResults);
      }
    }
    // }

    contentElement.querySelectorAll(".json-effect-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.stopPropagation();
        const nestedEffectId = e.target.getAttribute("data-effect-id");
        showEffectDetails(nestedEffectId, activeSkillData, defaultParams);
      });
    });

    modalManager.open(effectModal, modalElement);
  } catch (error) {
    console.error("Error showing effect details:", error);
  }
}

// 显示被动技能信息
export function showPassiveSkills(skillId, skillAutoData) {
  const container = document.getElementById("passiveSkillsList"); // 修改为被动技能内容区域的ID
  const passiveSkills = skillAutoData[skillId];

  if (!passiveSkills) {
    container.innerHTML =
      '<div class="alert alert-info">该武学没有关联的被动技能。</div>';
    return;
  }

  let html = "";
  let totalAtk = 0;
  let totalDuration = 0;
  let totalDam = 0;
  let totalZhaoHitRate = 0;
  let count = 0;

  Object.values(passiveSkills).forEach((skill) => {
    totalAtk += skill.atk || 0;
    totalDam += skill.dam || 0;
    totalZhaoHitRate += skill.hitRate || 0;
    totalDuration += (skill.preDuration || 0) + (skill.aftDuration || 0);
    count++;
  });

  let avgAtk = count > 0 ? totalAtk / count : 0;
  let avgDuration = count > 0 ? totalDuration / count : 0;
  let avgDam = count > 0 ? totalDam / count : 0;
  let avgHitRate = count > 0 ? totalZhaoHitRate / count : 0;

  avgAtk = avgAtk.toFixed(2);
  avgDuration = avgDuration.toFixed(2);
  avgDam = avgDam.toFixed(2);
  avgHitRate = avgHitRate.toFixed(2);

  html += `
    <div class="mb-3">
        <h4 class="text-primary">被动技能</h4>
    </div>
    <div class="mb-4">
        <h5>技能基础数据</h5>
        <p>招式平均攻击系数: ${avgAtk}</p>
        <p>招式平均前后摇: ${avgDuration}</p>
        <p>招式平均伤害力: ${avgDam}</p>
        <p>招式平均命中率: ${avgHitRate}</p>
        <div class="table-responsive">
            <table class="table table-sm table-hover">
                <thead>
                    <tr>
                        <th>技能效果</th>
                        <th>描述</th>
                        <th>攻击系数</th>
                        <th>伤害力</th>
                        <th>命中率</th>
                        <th>前后摇</th>
                        <th>伤害类型</th>
                        <th>解锁等级</th>
                    </tr>
                </thead>
                <tbody>`;

  Object.values(passiveSkills).forEach((skill) => {
    html += `
        <tr>
            <td>${skill.skillText}</td>
            <td>${skill.action}</td>
            <td>${skill.atk || 0}</td>
            <td>${skill.dam || 0}</td>
            <td>${skill.hitRate || 0}</td>
            <td>${(skill.preDuration + skill.aftDuration).toFixed(2) || 0}</td>
            <td>${skill.damageType}</td>
            <td>${skill.lv}</td>
        </tr>`;
  });

  html += `
                </tbody>
            </table>
        </div>
    </div>`;

  container.innerHTML = html;
}

/**
 * 从数据行中收集指定前缀的条件（learn 或 use）
 * @param {string} prefix - "learn" 或 "use"
 * @param {Object} dataRow - selectedSkills[0].data
 * @returns {string[]}
 */
function collectConditions(prefix, dataRow) {
  const conditions = [];
  for (let i = 1; i <= 10; i++) {
    const idKey = `${prefix}_id_${i}`;
    const logicKey = `${prefix}_logic_${i}`;
    const typeKey = `${prefix}_type_${i}`;
    const valueKey = `${prefix}_value_${i}`;

    if (
      dataRow[idKey] === undefined ||
      dataRow[logicKey] === undefined ||
      dataRow[valueKey] === undefined
    )
      continue;

    const ids = String(dataRow[idKey]).split(";");
    const logics = String(dataRow[logicKey]).split(";");
    const values = String(dataRow[valueKey]).split(";");
    const typeStr = dataRow[typeKey] || "";

    for (let j = 0; j < ids.length; j++) {
      const rawId = ids[j].trim();
      let logicStr = (logics[j] || logics[0] || "").trim();
      let valueStr = (values[j] || values[0] || "").trim();

      const cnText = conditionToCN(typeStr, rawId, logicStr, valueStr);
      if (cnText) {
        conditions.push(cnText);
      } else {
        if (typeStr === "装备武器") {
          logicStr = "";
          valueStr = "";
        }
        conditions.push(
          `${typeStr} ${getCHAttrName(rawId) || rawId} ${logicStr} ${valueStr}`,
        );
      }
    }
  }
  return conditions;
}

/**
 * 渲染条件卡片 HTML
 * @param {string} label - 卡片标题
 * @param {string[]} conditions - 条件文本数组
 * @param {{ border:string, bg:string, text:string, sep:string }} colors
 * @returns {string} HTML 字符串
 */
function renderConditionCard(label, conditions, colors) {
  let html = `
    <div class="mb-2 rounded overflow-hidden" style="border:1px solid ${colors.border};">
      <div class="px-3 py-1" style="background:${colors.bg};font-size:0.75rem;font-weight:600;color:${colors.text};">${label}</div>
      <div class="px-3 py-2">`;
  conditions.forEach((cond, idx) => {
    const sepStyle =
      idx < conditions.length - 1
        ? `border-bottom:1px solid ${colors.sep};`
        : "";
    html += `<div style="font-size:0.85rem;padding:3px 0;${sepStyle}">${cond}</div>`;
  });
  html += `</div></div>`;
  return html;
}

// 显示主动技能信息
export function showActiveSkills(skillId, activeSkillData, name) {
  const container = document.getElementById("activeSkillsList");
  const skillGroups = findActiveSkills(skillId, activeSkillData, name);
  container.onclick = null;

  if (skillGroups.length === 0) {
    container.innerHTML =
      '<div class="alert alert-info">该武学没有关联的主动技能。</div>';
    return;
  }

  let html = "";

  skillGroups.forEach((group, groupIndex) => {
    const { activeId, baseActive, allActives, name } = group;

    if (groupIndex > 0) {
      html += '<hr class="my-4">';
    }

    const skillType = baseActive.type;
    const typeBadge = skillType
      ? ` <span class="badge ${skillType === "释放" ? "bg-success" : skillType === "攻击" ? "bg-danger" : "bg-secondary"}" style="font-size: 0.65rem; vertical-align: middle;">${skillType}类</span>`
      : "";

    const skillLevel = baseActive.level;
    const levelNames = {
      1: "低级残页",
      2: "中级残页",
      3: "高级残页",
      4: "顶级残页",
    };
    const levelColors = {
      1: "bg-secondary",
      2: "bg-primary",
      3: "bg-success",
      4: "bg-danger",
    };
    const levelBadge =
      skillLevel && levelNames[skillLevel]
        ? ` <span class="badge ${levelColors[skillLevel] || "bg-secondary"}" style="font-size: 0.65rem; vertical-align: middle;">${levelNames[skillLevel]}</span>`
        : "";

    html += `
        <div class="d-flex align-items-center justify-content-between mb-3 pb-2" style="border-bottom:2px solid #e9ecef;">
            <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="fw-bold" style="font-size:1.05rem;color:#0d6efd;">${baseActive.name || activeId}</span>
                ${typeBadge}${levelBadge}
            </div>
            <button class="btn btn-link btn-sm expand-base-btn p-0 ms-3" data-active-id="${activeId}" style="font-size:0.75rem;color:#adb5bd;white-space:nowrap;flex-shrink:0;text-decoration:none;outline:none;box-shadow:none!important;">原始数据 ▾</button>
        </div>
        <pre id="base-data-${activeId}" class="bg-light rounded p-2 mb-3" style="max-height:180px;overflow-y:auto;display:none;font-size:0.72rem;">${JSON.stringify(baseActive, null, 2)}</pre>`;

    const selectedSkills = allActives;

    if (selectedSkills.length > 1) {
      const firstData = selectedSkills[0].data;

      // 学习条件
      const learnConditions = collectConditions("learn", firstData);
      const bookLearnText = getActiveSkillLearnForBookText(activeId);
      if (bookLearnText) learnConditions.unshift(bookLearnText);
      if (learnConditions.length > 0) {
        html += renderConditionCard("学习条件", learnConditions, {
          border: "#fde68a",
          bg: "#fef3c7",
          text: "#92400e",
          sep: "#fef9ec",
        });
      }

      // 使用条件
      const useConditions = collectConditions("use", firstData);
      const methodNum = baseActive.methods;
      if (methodNum !== undefined && methodNum !== null) {
        const methodName = getMethodCN(Number(methodNum));
        if (methodName) useConditions.push("准备在【" + methodName + "】位置");
      }
      if (useConditions.length > 0) {
        html += renderConditionCard("使用条件", useConditions, {
          border: "#bfdbfe",
          bg: "#dbeafe",
          text: "#1e40af",
          sep: "#eff6ff",
        });
      }

      html += `
            <div>
                <h5 style="display:flex;justify-content:space-between;align-items:center;">
                    <span>各重数差异</span>
                    <button class="btn btn-link btn-sm expand-levels-btn p-0" data-skill-id="${activeId}" style="font-size:0.75rem;color:#94a3b8;text-decoration:none;box-shadow:none;">展开 ▾</button>
                </h5>
                <div class="table-responsive">
                    <table class="table table-sm table-hover" data-levels-table="${activeId}">
                        <thead>
                            <tr>
                                <th>重数</th>
                                <th>属性</th>
                            </tr>
                        </thead>
                        <tbody>`;

      selectedSkills.forEach((skill, index) => {
        if (index <= 9) {
          const textParts = [];
          const fieldLabel = {
            desc: "描述",
            pvpcd: "PVP冷却",
            cost: "内力消耗",
          };
          Object.entries(skill.data)
            .filter(([key]) =>
              ["desc", "pvpcd", "cost", "effects"].includes(key),
            )
            .forEach(([key, value]) => {
              if (key === "effects") {
                textParts.push(
                  `主动效果: ${createEffectLinks(value, skill.data.cost)}`,
                );
                // 在主动效果下方追加入场效果与被动效果
                const enterLinks = getEnterEffectLinks(
                  activeSkillData,
                  skill.id,
                );
                const passiveLinks = getPassiveEffectLinks(
                  activeSkillData,
                  skill.id,
                );
                if (enterLinks) {
                  textParts.push(`入场效果: ${enterLinks}`);
                }
                if (passiveLinks) {
                  textParts.push(`被动效果: ${passiveLinks}`);
                }
              } else {
                const label = fieldLabel[key] || key;
                textParts.push(`${label}: ${value}`);
              }
            });
          const skillText = textParts.join("<br>");

          if (skillText) {
            const isHidden = index < 8 ? 'style="display: none;"' : "";
            html += `
                        <tr class="skill-level-row-${activeId}" data-level="${index + 1}" ${isHidden}>
                            <td>第${skill.level}重</td>
                            <td>${skillText}</td>
                        </tr>`;
          }
        }
      });

      html += `
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
  });

  container.innerHTML = html;

  container.onclick = (e) => {
    // 处理基础数据展开按钮
    if (e.target.closest(".expand-base-btn")) {
      e.stopPropagation();
      const btn = e.target.closest(".expand-base-btn");
      const activeId = btn.getAttribute("data-active-id");
      const pre = container.querySelector(`#base-data-${activeId}`);
      const isExpanded = btn.dataset.expanded === "true";
      pre.style.display = isExpanded ? "none" : "block";
      btn.dataset.expanded = !isExpanded;
      btn.textContent = isExpanded ? "原始数据 ▾" : "原始数据 ▴";
      return;
    }

    // 处理各重数差异展开按钮
    if (e.target.closest(".expand-levels-btn")) {
      e.stopPropagation();
      const btn = e.target.closest(".expand-levels-btn");
      const skillId = btn.getAttribute("data-skill-id");
      const rows = container.querySelectorAll(`.skill-level-row-${skillId}`);
      const isExpanded = btn.dataset.expanded === "true";

      rows.forEach((row) => {
        const level = parseInt(row.getAttribute("data-level"));
        // 只折叠第1-8重，第9和第10重始终显示
        if (level <= 8) {
          row.style.display = isExpanded ? "none" : "table-row";
        }
      });

      btn.dataset.expanded = !isExpanded;
      btn.textContent = isExpanded ? "展开 ▾" : "收起 ▴";
      return;
    }

    // 处理效果链接
    const link = e.target.closest(".effect-link");
    if (link) {
      const effectId = link.getAttribute("data-effect-id");
      const zValuesStr = link.getAttribute("data-z");
      const costValue = link.getAttribute("data-cost");
      let defaultParams = {};
      if (zValuesStr) {
        const parts = zValuesStr.split(",");
        parts.forEach((p, idx) => {
          defaultParams[`z${idx + 1}`] = parseFloat(p.trim()) || 0;
        });
      }
      if (costValue !== null) {
        defaultParams["cost"] = parseFloat(costValue) || 0;
      }
      showEffectDetails(effectId, activeSkillData, defaultParams);
    }
  };
}

// 批处理渲染函数
function renderSkillCards(cards, container, startIndex = 0) {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }

  const endIndex = Math.min(startIndex + renderBatchSize, cards.length);

  // 渲染当前批次的卡片
  for (let i = startIndex; i < endIndex; i++) {
    container.appendChild(cards[i]);
  }

  // 如果还有卡片需要渲染，设置定时器继续渲染
  if (endIndex < cards.length) {
    renderTimeout = setTimeout(() => {
      renderSkillCards(cards, container, endIndex);
    }, 50); // 50ms 延迟，让浏览器有时间处理UI更新
  }
}

// 更新技能列表
export function updateSkillList(skillData, matchesFilters) {
  const container = document.getElementById("skillList");
  if (!skillData?.skills || typeof skillData.skills !== "object") {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
      renderTimeout = null;
    }
    renderLoadingState(container);
    return;
  }

  container.innerHTML = "";

  let filteredCount = 0;
  const totalCount = Object.keys(skillData.skills).length;
  const cardsToRender = [];

  Object.entries(skillData.skills)
    .sort((subArrA, subArrB) => {
      const strA = subArrA[1].name; // 提取子数组的[0]成员（字符串）
      const strB = subArrB[1].name;
      return strA.localeCompare(strB); // 字典序比较结果
    })
    .forEach(([id, skill]) => {
      if (
        typeof skill === "object" &&
        skill !== null &&
        matchesFilters(skill)
      ) {
        filteredCount++;
        const col = document.createElement("div");
        col.className = "col-md-4 col-lg-3";

        const card = document.createElement("div");
        card.className = "card h-100";
        card.style.cursor = "pointer";

        card.onclick = async () => {
          const modalElement = document.getElementById("jsonModal");
          const jsonContent = document.getElementById("jsonContent");
          jsonContent.textContent = JSON.stringify(skill, null, 2);
          document.getElementById("jsonModalLabel").textContent =
            `${skill.name || id} - 武学详情`;

          try {
            const activeSkillData = await import("./dataLoader.js").then(
              (module) => module.loadActiveSkillData(),
            );
            showActiveSkills(id, activeSkillData, skill.name);

            // 加载被动技能数据
            const skillAutoData = await import("./dataLoader.js").then(
              (module) => module.loadSkillAutoData(),
            );
            showPassiveSkills(id, skillAutoData);
          } catch (error) {
            console.error("Error loading skill data:", error);
            document.getElementById("activeSkillsList").innerHTML =
              '<div class="alert alert-danger">加载技能数据时出错</div>';
          }

          modalManager.open(jsonModal, modalElement);
        };

        const cardHeader = document.createElement("div");
        cardHeader.className = "card-header";
        cardHeader.textContent = skill.name || id;

        if (skill.mcmrestrict && skill.mcmrestrict.includes(",300")) {
          const jueXueBadge = document.createElement("span");
          jueXueBadge.className = "badge bg-danger jue-xue-badge";
          jueXueBadge.textContent = "绝学";
          cardHeader.appendChild(jueXueBadge);
        }
        if (skill.wxclassify && skill.wxclassify == "zhishi") {
          // 添加"知识"标识
          const zhiShiBadge = document.createElement("span");
          zhiShiBadge.className = "badge bg-danger jue-xue-badge";
          zhiShiBadge.textContent = "知识";
          cardHeader.appendChild(zhiShiBadge);
        }

        const cardBody = document.createElement("div");
        cardBody.className = "card-body";

        let content = "";

        if (skill.dsc) {
          const shortDesc = skill.dsc.replace(/HIW|NOR/g, "").split("\\n")[0];
          content += `<p class="skill-description" style="max-height: 3.6em; overflow-y: auto;">${shortDesc}</p>`;
        }

        if (skill.familyList) {
          content += `<p><strong>门派：</strong><span class="badge bg-info">${skill.familyList}</span></p>`;
        }

        if (skill.methods) {
          content += "<p><strong>武学类型：</strong>";
          const methodArray =
            typeof skill.methods === "string"
              ? skill.methods.split(",")
              : [String(skill.methods)];

          methodArray.forEach((method) => {
            const methodName = getMethodName(method.trim());
            content += `<span class="badge bg-success">${methodName}</span> `;
          });
          content += "</p>";
        }

        if (skill.weapontype) {
          content += "<p><strong>装备类型：</strong>";
          const methodArray =
            typeof skill.weapontype === "string"
              ? skill.weapontype.split(",")
              : [String(skill.weapontype)];

          methodArray.forEach((type) => {
            const Weapontype = getWeapontype(type.trim());
            content += `<span class="badge bg-success">${Weapontype}</span> `;
          });
          content += "</p>";
        }

        content += '<div class="mt-3">';

        const attributes = [
          { key: "potEfficiency", label: "潜能效率" },
          { key: "atk", label: "攻击力系数" },
          { key: "damRate", label: "伤害率系数" },
          { key: "powerAtkRate", label: "加力攻击系数" },
          { key: "powerDamRate", label: "加力伤害系数" },
          { key: "def", label: "防御系数" },
          { key: "parry", label: "招架系数" },
          { key: "hitRate", label: "命中率系数" },
          { key: "dodge", label: "闪避系数" },
          { key: "atkSpd", label: "攻速系数" },
          { key: "neili", label: "内力系数" },
          { key: "HpRate", label: "生命系数" },
          { key: "autoZhaoAtkDamageClass", label: "伤害属性" },
          { key: "zhaoJiaDefDamageClass", label: "招架属性" },
          { key: "zhaoJiaDefDamageParam", label: "招架减伤率" },
        ];

        attributes.forEach((attr) => {
          if (skill[attr.key]) {
            content += `
                    <div class="attribute-row">
                        <span class="attribute-label">${attr.label}：</span>
                        <span class="attribute-value">${["autoZhaoAtkDamageClass", "zhaoJiaDefDamageClass"].includes(attr.key) ? getElementName(skill[attr.key]) : skill[attr.key]}</span>
                    </div>`;
          }
        });

        content += "</div>";

        cardBody.innerHTML = content;

        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        col.appendChild(card);
        cardsToRender.push(col);
      }
    });

  // 开始批处理渲染
  renderSkillCards(cardsToRender, container);
}
