// 武学展示逻辑模块
import {
  findActiveSkills,
  getMethodName,
  getElementName,
  getWeapontype,
  skillData,
} from "./dataLoader.js";
import { modalManager, effectModal } from "./uiManager.js";
import { calcParamNames, calcSelectParams } from "./calcNames.js";

// 渲染优化参数
const renderBatchSize = 20; // 每次渲染的卡片数量
let renderTimeout = null; // 渲染超时定时器

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
function isPotentialEffectId(str) {
  return typeof str === "string" && /^[A-Z0-9]+$/.test(str) && str.length >= 2;
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
    console.log(effectData);

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
            (/\bz\d+\b/.test(val) || val.includes("return"))
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

      allVars = Array.from(allVars);

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

        // 检查是否为选择框参数
        const selectConfig = calcSelectParams.find((cfg) =>
          cfg.pattern.test(v),
        );
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
            const func = new Function(...argNames, funcBody);
            let res = func(...argVals);
            if (typeof res === "number") {
              res = parseFloat(res.toFixed(4));
            }
            allResults[f.key] = res;
          } catch (e) {
            allResults[f.key] = null;
          }
        });

        // 生成结果HTML
        let isFirstFormula = true;
        compiledFormulas.forEach((f) => {
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

            resultsHtml += `<div><strong>${labelName}</strong>: ${displayRes}</div>`;
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

// 显示主动技能信息
export function showActiveSkills(skillId, activeSkillData, name) {
  const container = document.getElementById("activeSkillsList");
  const skillGroups = findActiveSkills(skillId, activeSkillData, name);

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

    html += `
        <div class="mb-3">
            <h4 class="text-primary">${baseActive.name || activeId}</h4>
        </div>`;

    html += `
        <div class="mb-4">
            <h5>技能基础数据</h5>
            <pre style="max-height: 200px; overflow-y: auto;">${JSON.stringify(baseActive, null, 2)}</pre>
        </div>`;

    // 根据技能ID格式筛选第一重和第十重
    // const selectedSkills = allActives.filter(skill => {
    //     const activeId = skill.id;
    //     const isLevel1 = /^[a-zA-Z]+$/.test(activeId);
    //     const isLevel10 = /^[a-zA-Z]+10$/.test(activeId);
    //     return isLevel1 || isLevel10;
    // });
    const selectedSkills = allActives;

    if (selectedSkills.length > 1) {
      html += `
            <div>
                <h5>绑定武学</h5>
                <div class="table-responsive">
                    <table class="table table-sm table-hover">
                        <thead>
                            <tr>
                                <th>绑定武学</th>
                            </tr>
                        </thead>
                        <tbody>`;
      // 检查 use_id_2, use_id_3, use_id_4 等字段
      for (let i = 2; i <= 4; i++) {
        const useIdKey = `use_id_${i}`;
        const useTypeKey = `use_type_${i}`;
        const useValueKey = `use_value_${i}`;
        if (
          selectedSkills[0].data[useIdKey] &&
          selectedSkills[0].data[useTypeKey] &&
          selectedSkills[0].data[useValueKey]
        ) {
          const boundactiveId = selectedSkills[0].data[useIdKey].split(" or ");
          const boundMethodId = selectedSkills[0].data[useValueKey];
          if (boundMethodId == "是") {
            boundactiveId.forEach((id) => {
              const boundSkillName = skillData.skills[id]?.name ?? id;

              html += `
                                <tr>
                                    <td> <strong>准备 ${boundSkillName}</td>
                                </tr>`;
            });
          } else {
            boundactiveId.forEach((id) => {
              const boundSkillName = skillData.skills[id]?.name ?? id;

              html += `
                                <tr>
                                    <td> <strong>准备 ${boundSkillName} 为 ${getMethodName(boundMethodId)}</td>
                                </tr>`;
            });
          }
        }
      }
      // 主动准备位置条件
      if (selectedSkills[0].data["methods"]) {
        html += `
                        <tr>
                            <td> <strong>准备 ${name} 为 ${getMethodName(selectedSkills[0].data["methods"])}</td>
                        </tr>`;
      }
      html += `
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h5>各重数差异
                    <button class="btn btn-sm btn-outline-primary expand-levels-btn" data-skill-id="${activeId}" style="font-size: 0.75rem; margin-left: 10px;">展开</button>
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
          const skillText = Object.entries(skill.data)
            .filter(([key, value]) =>
              ["desc", "pvpcd", "cost", "effects"].includes(key),
            )
            .map(([key, value]) => {
              if (key === "effects") {
                return `${key}: ${createEffectLinks(value, skill.data.cost)}`;
              }
              return `${key}: ${value}`;
            })
            .join("<br>");

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

  // 为展开按钮添加事件处理
  container.querySelectorAll(".expand-levels-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const skillId = e.target.getAttribute("data-skill-id");
      const rows = container.querySelectorAll(`.skill-level-row-${skillId}`);
      const isExpanded = e.target.dataset.expanded === "true";

      rows.forEach((row) => {
        const level = parseInt(row.getAttribute("data-level"));
        // 只折叠第1-8重，第9和第10重始终显示
        if (level <= 8) {
          row.style.display = isExpanded ? "none" : "table-row";
        }
      });

      e.target.dataset.expanded = !isExpanded;
      e.target.textContent = isExpanded ? "展开" : "折叠";
    });
  });

  container.addEventListener("click", (e) => {
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
  });
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
          const modal = new bootstrap.Modal(
            document.getElementById("jsonModal"),
          );
          const jsonContent = document.getElementById("jsonContent");
          jsonContent.textContent = JSON.stringify(skill, null, 2);
          document.getElementById("jsonModalLabel").textContent =
            `${skill.name || id} - 武学详情`;

          try {
            console.log("Loading active skill data for skill:", id);
            const activeSkillData = await import("./dataLoader.js").then(
              (module) => module.loadActiveSkillData(),
            );
            console.log(
              "Loaded activeSkillData:",
              activeSkillData ? "success" : "null",
            );
            showActiveSkills(id, activeSkillData, skill.name);

            // 加载被动技能数据
            const skillAutoData = await import("./dataLoader.js").then(
              (module) => module.loadSkillAutoData(),
            );
            console.log(
              "Loaded skillAutoData:",
              skillAutoData ? "success" : "null",
            );
            showPassiveSkills(id, skillAutoData);
          } catch (error) {
            console.error("Error loading skill data:", error);
            document.getElementById("activeSkillsList").innerHTML =
              '<div class="alert alert-danger">加载技能数据时出错</div>';
          }

          // modal.show();
          // 武学窗口也使用模态框管理器打开，以修复第一次点击打开效果详情时被武学窗口挡住的问题
          modalManager.open(modal, document.getElementById("jsonModal"));
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
          { key: "zhaoJiaDefDamageClass", label: "伤害/招架类型" },
          { key: "zhaoJiaDefDamageParam", label: "招架减伤率" },
        ];

        attributes.forEach((attr) => {
          if (skill[attr.key]) {
            content += `
                    <div class="attribute-row">
                        <span class="attribute-label">${attr.label}：</span>
                        <span class="attribute-value">${attr.key === "zhaoJiaDefDamageClass" ? getElementName(skill[attr.key]) : skill[attr.key]}</span>
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
