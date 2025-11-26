// 武学展示逻辑模块
import { findActiveSkills, getMethodName, getElementName, getWeapontype, skillData } from './dataLoader.js';
import { modalManager, effectModal } from './uiManager.js';

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
export function createEffectLinks(effectsStr) {
    if (!effectsStr) return effectsStr;
    const effectIds = parseEffects(effectsStr);
    let result = effectsStr;
    const processedIds = new Set(); // 添加一个Set来存储已经处理过的效果ID
    effectIds.forEach(id => {
        if (!processedIds.has(id)) { // 检查是否已经处理过该效果ID
            result = result.replace(
                new RegExp(`"${id}"`, 'g'), // 使用正则表达式全局替换
                `<span class="effect-link" data-effect-id="${id}" style="color: #007bff; text-decoration: underline; cursor: pointer;">"${id}"</span>`
            );
            processedIds.add(id); // 标记该效果ID已处理
        }
    });
    return result;
}

// 检查字符串是否可能是效果ID
function isPotentialEffectId(str) {
    return typeof str === 'string' && /^[A-Z0-9]+$/.test(str) && str.length >= 2;
}

// 递归处理JSON对象中的效果ID
function processEffectIds(obj, currentId, processedIds = new Set()) {
    if (!obj) return obj;
    
    if (processedIds.has(currentId)) return obj;
    processedIds.add(currentId);
    
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('arg') && isPotentialEffectId(value) && value !== currentId) {
            result[key] = `<span class="effect-link json-effect-link" data-effect-id="${value}" style="color: #007bff; text-decoration: underline; cursor: pointer;">${value}</span>`;
        } else if (typeof value === 'object' && value !== null) {
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
        .replace(/"<span/g, '<span')
        .replace(/<\/span>"/g, '</span>');
}

// 显示效果详情
export function showEffectDetails(effectId, activeSkillData) {
    if (!activeSkillData?.Effect?.[effectId]) {
        console.log('Effect not found:', effectId);
        return;
    }

    try {
        const effectData = activeSkillData.Effect[effectId];
        const modalElement = document.getElementById('effectModal');
        document.getElementById('effectModalLabel').textContent = `效果详情: ${effectId}`;
        
        const contentElement = document.getElementById('effectContent');
        contentElement.innerHTML = jsonToHtmlWithEffectLinks(effectData, effectId);
        
        contentElement.querySelectorAll('.json-effect-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                const nestedEffectId = e.target.getAttribute('data-effect-id');
                showEffectDetails(nestedEffectId, activeSkillData);
            });
        });
        
        modalManager.open(effectModal, modalElement);
    } catch (error) {
        console.error('Error showing effect details:', error);
    }
}

// 显示被动技能信息
export function showPassiveSkills(skillId, skillAutoData) {
    const container = document.getElementById('passiveSkillsList'); // 修改为被动技能内容区域的ID
    const passiveSkills = skillAutoData[skillId];
    
    if (!passiveSkills) {
        container.innerHTML = '<div class="alert alert-info">该武学没有关联的被动技能。</div>';
        return;
    }

    let html = '';
    let totalAtk = 0;
    let totalDuration = 0;
    let totalDam = 0;
    let totalZhaoHitRate = 0;
    let count = 0;

    Object.values(passiveSkills).forEach(skill => {
        totalAtk += skill.atk || 0;
        totalDam += skill.dam || 0;
        totalZhaoHitRate += skill.hitRate || 0;
        totalDuration += (skill.preDuration || 0) + (skill.aftDuration || 0);
        count++;
    });

    let avgAtk = count > 0 ? (totalAtk / count) : 0;
    let avgDuration = count > 0 ? (totalDuration / count) : 0;
    let avgDam = count > 0 ? (totalDam / count) : 0;
    let avgHitRate = count > 0 ? (totalZhaoHitRate / count) : 0;

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

    Object.values(passiveSkills).forEach(skill => {
        html += `
        <tr>
            <td>${skill.skillText}</td>
            <td>${skill.action}</td>
            <td>${skill.atk || 0}</td>
            <td>${skill.dam || 0}</td>
            <td>${skill.hitRate || 0}</td>
            <td>${(skill.preDuration+skill.aftDuration).toFixed(2) || 0}</td>
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
    const container = document.getElementById('activeSkillsList');
    const skillGroups = findActiveSkills(skillId, activeSkillData, name);
    
    if (skillGroups.length === 0) {
        container.innerHTML = '<div class="alert alert-info">该武学没有关联的主动技能。</div>';
        return;
    }

    let html = '';
    
    skillGroups.forEach((group, groupIndex) => {
        const {activeId, baseActive, allActives, name} = group;
        
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
                    if (selectedSkills[0].data[useIdKey] && selectedSkills[0].data[useTypeKey] && selectedSkills[0].data[useValueKey]) {
                        const boundactiveId = selectedSkills[0].data[useIdKey].split(' or ');
                        const boundMethodId = selectedSkills[0].data[useValueKey];
                        if (boundMethodId == "是") {
                            boundactiveId.forEach((id) => {
                                const boundSkillName = skillData.skills[id] ?.name ?? id;

                                html += `
                                <tr>
                                    <td> <strong>准备 ${boundSkillName}</td>
                                </tr>`;
                            });
                        }
                        else {
                            boundactiveId.forEach((id) => {
                                const boundSkillName = skillData.skills[id] ?.name ?? id;

                                html += `
                                <tr>
                                    <td> <strong>准备 ${boundSkillName} 为 ${getMethodName(boundMethodId)}</td>
                                </tr>`;
                            });
                        }
                    }
                    
                }
                // 主动准备位置条件
                if (selectedSkills[0].data['methods']) {
                    html += `
                        <tr>
                            <td> <strong>准备 ${name} 为 ${getMethodName(selectedSkills[0].data['methods'])}</td>
                        </tr>`;
                }
             html += `
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h5>各重数差异</h5>
                <div class="table-responsive">
                    <table class="table table-sm table-hover">
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
                        .filter(([key, value]) => ['desc', 'pvpcd', 'cost', 'effects'].includes(key))
                        .map(([key, value]) => {
                            if (key === 'effects') {
                                return `${key}: ${createEffectLinks(value)}`;
                            }
                            return `${key}: ${value}`;
                        })
                        .join('<br>');

                    
                    if (skillText) {
                        html += `
                        <tr>
                            <td>第${skill.level}重</td>
                            <td>${skillText}</td>
                        </tr>`;
                    }
                };
            });

            html += `
                        </tbody>
                    </table>
                </div>
            </div>`;
        }
    });
    
    container.innerHTML = html;

    container.addEventListener('click', (e) => {
        const link = e.target.closest('.effect-link');
        if (link) {
            const effectId = link.getAttribute('data-effect-id');
            showEffectDetails(effectId, activeSkillData);
        }
    });
}

// 更新技能列表
export function updateSkillList(skillData, matchesFilters) {
    const container = document.getElementById('skillList');
    container.innerHTML = '';
    
    let filteredCount = 0;
    const totalCount = Object.keys(skillData.skills).length;
    
    Object.entries(skillData.skills).sort((subArrA, subArrB) => {
        const strA = subArrA[1].name; // 提取子数组的[0]成员（字符串）
        const strB = subArrB[1].name;
        return strA.localeCompare(strB); // 字典序比较结果
      }).forEach(([id, skill]) => {
        if (typeof skill === 'object' && skill !== null && matchesFilters(skill)) {
            filteredCount++;
            const col = document.createElement('div');
            col.className = 'col-md-4 col-lg-3';
            
            const card = document.createElement('div');
            card.className = 'card h-100';
            card.style.cursor = 'pointer';
            
            card.onclick = async () => {
                const modal = new bootstrap.Modal(document.getElementById('jsonModal'));
                const jsonContent = document.getElementById('jsonContent');
                jsonContent.textContent = JSON.stringify(skill, null, 2);
                document.getElementById('jsonModalLabel').textContent = `${skill.name || id} - 武学详情`;
                
                try {
                    console.log('Loading active skill data for skill:', id);
                    const activeSkillData = await import('./dataLoader.js').then(module => module.loadActiveSkillData());
                    console.log('Loaded activeSkillData:', activeSkillData ? 'success' : 'null');
                    showActiveSkills(id, activeSkillData, skill.name);
                    
                    // 加载被动技能数据
                    const skillAutoData = await import('./dataLoader.js').then(module => module.loadSkillAutoData());
                    console.log('Loaded skillAutoData:', skillAutoData ? 'success' : 'null');
                    showPassiveSkills(id, skillAutoData);
                } catch (error) {
                    console.error('Error loading skill data:', error);
                    document.getElementById('activeSkillsList').innerHTML = 
                        '<div class="alert alert-danger">加载技能数据时出错</div>';
                }
                
                modal.show();
            };
            
            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            cardHeader.textContent = skill.name || id;
            
            if (skill.mcmrestrict && skill.mcmrestrict.includes(',300')) {
                const jueXueBadge = document.createElement('span');
                jueXueBadge.className = 'badge bg-danger jue-xue-badge';
                jueXueBadge.textContent = '绝学';
                cardHeader.appendChild(jueXueBadge);
            }
            if (skill.wxclassify && skill.wxclassify == 'zhishi') { // 添加“知识”标识
                const zhiShiBadge = document.createElement('span');
                zhiShiBadge.className = 'badge bg-danger jue-xue-badge';
                zhiShiBadge.textContent = '知识';
                cardHeader.appendChild(zhiShiBadge);
            }
            
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';
            
            let content = '';
            
            if (skill.dsc) {
                const shortDesc = skill.dsc.replace(/HIW|NOR/g, '').split('\\n')[0];
                content += `<p class="skill-description" style="max-height: 3.6em; overflow-y: auto;">${shortDesc}</p>`;
            }
            
            if (skill.familyList) {
                content += `<p><strong>门派：</strong><span class="badge bg-info">${skill.familyList}</span></p>`;
            }
            
            if (skill.methods) {
                content += '<p><strong>武学类型：</strong>';
                const methodArray = typeof skill.methods === 'string' 
                    ? skill.methods.split(',') 
                    : [String(skill.methods)];
                    
                methodArray.forEach(method => {
                    const methodName = getMethodName(method.trim());
                    content += `<span class="badge bg-success">${methodName}</span> `;
                });
                content += '</p>';
            }
            
            if (skill.weapontype) {
                content += '<p><strong>装备类型：</strong>';
                const methodArray = typeof skill.weapontype === 'string' 
                    ? skill.weapontype.split(',') 
                    : [String(skill.weapontype)];
                
                methodArray.forEach(type => {
                    const Weapontype = getWeapontype(type.trim());
                    content += `<span class="badge bg-success">${Weapontype}</span> `;
                });
                content += '</p>';
            }
            
            content += '<div class="mt-3">';
            
            const attributes = [
                { key: 'potEfficiency', label: '潜能效率' },
                { key: 'atk', label: '攻击力系数' },
                { key: 'damRate', label: '伤害率系数' },
                { key: 'powerAtkRate', label: '加力攻击系数' },
                { key: 'powerDamRate', label: '加力伤害系数' },
                { key: 'def', label: '防御系数' },
                { key: 'parry', label: '招架系数' },
                { key: 'hitRate', label: '命中率系数' },
                { key: 'dodge', label: '闪避系数' },
                { key: 'atkSpd', label: '攻速系数' },
                { key: 'neili', label: '内力系数' },
                { key: 'HpRate', label: '生命系数' },
                { key: 'zhaoJiaDefDamageClass', label: '伤害/招架类型' },
                { key: 'zhaoJiaDefDamageParam', label: '招架减伤率' }
            ];

            attributes.forEach(attr => {
                if (skill[attr.key]) {
                    content += `
                    <div class="attribute-row">
                        <span class="attribute-label">${attr.label}：</span>
                        <span class="attribute-value">${attr.key === "zhaoJiaDefDamageClass" ? getElementName(skill[attr.key]) : skill[attr.key]}</span>
                    </div>`;
                }
            });

            content += '</div>';
            
            cardBody.innerHTML = content;
            
            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            col.appendChild(card);
            container.appendChild(col);
        }
    });
}
