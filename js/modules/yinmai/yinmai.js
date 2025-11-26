import * as pako from '../../../extern/pako_2.0.4_esm.js';

let acupointConfig = {};
let meridianMap = {};
let meridianLinkConfig = {};

// 手动初始化Bootstrap的下拉组件
document.addEventListener('DOMContentLoaded', function () {
    var dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'))
    dropdownElementList.map(function (dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl)
    })
});

document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetch('data/MeridianMapConfig.json.gz')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(gzippedData => {
                const data = pako.inflate(gzippedData, { to: 'string' });
                return JSON.parse(data);
            })
            .then(data => {
                meridianMap = data['玄脉图']; //节点依赖关系
            }),
        fetch('data/AcupointConfig.json.gz')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(gzippedData => {
                const data = pako.inflate(gzippedData, { to: 'string' });
                return JSON.parse(data);
            })
            .then(data => {
                acupointConfig = data['玄脉图'];//窍穴定义
            }),
        fetch('data/MeridianLinkConfig.json.gz')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(gzippedData => {
                const data = pako.inflate(gzippedData, { to: 'string' });
                return JSON.parse(data);
            })
            .then(data => {
                meridianLinkConfig = data['玄络'];//属性加成
            })
    ])
    .then(() => {
        const meridianMapContainer = document.getElementById('meridianMap');
        meridianMapContainer.innerHTML = ''; // Clear loading spinner
        const sortedKeys = Object.keys(meridianMap).sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0], 10);
            const numB = parseInt(b.match(/\d+/)[0], 10);
            return numA - numB;
        });

        // Populate dropdown menu
        const dropdownMenu = document.getElementById('mindItemDropdownMenu');
        sortedKeys.forEach(mindItemKey => {
            const dropdownItem = document.createElement('li');
            const dropdownLink = document.createElement('a');
            dropdownLink.className = 'dropdown-item';
            dropdownLink.href = '#';
            dropdownLink.textContent = `玄络图${mindItemKey.match(/\d+/)[0]}`;
            dropdownLink.dataset.mindItemKey = mindItemKey;
            dropdownItem.appendChild(dropdownLink);
            dropdownMenu.appendChild(dropdownItem);
        });


        dropdownMenu.addEventListener('click', (event) => {
            totalAttributes = {};
            refreshTotalDisplay();
            if (event.target && event.target.matches('a.dropdown-item')) {
                const mindItemKey = event.target.dataset.mindItemKey;
                const mindItem = meridianMap[mindItemKey];
                meridianMapContainer.innerHTML = ''; 
                document.getElementById('meridianLinkTabs').classList.add('d-none'); 
                const mindItemElement = createMindItemElement(mindItem, mindItemKey);
                meridianMapContainer.appendChild(mindItemElement);
            }
        });

 
        if (sortedKeys.length > 0) {
            const firstMindItemKey = sortedKeys[0];
            const firstMindItem = meridianMap[firstMindItemKey];
            const firstMindItemElement = createMindItemElement(firstMindItem, firstMindItemKey);
            meridianMapContainer.appendChild(firstMindItemElement);
        }


        const dropdownButton = document.getElementById('mindItemDropdown');
        const showMeridianLinkButton = document.createElement('button');
        showMeridianLinkButton.className = 'btn btn-secondary ms-2';
        showMeridianLinkButton.textContent = '展示玄络';
        showMeridianLinkButton.addEventListener('click', () => {

            totalAttributes = {};
            refreshTotalDisplay();
            meridianMapContainer.innerHTML = '';
            document.getElementById('meridianLinkTabs').classList.remove('d-none'); 
            const meridianLinkElement = createMeridianLinkElement();
            document.getElementById('zhengji').innerHTML = meridianLinkElement['正基'];
            document.getElementById('zhongdan').innerHTML = meridianLinkElement['中丹'];
            document.getElementById('tongyuan').innerHTML = meridianLinkElement['通元'];
        });
        dropdownButton.parentNode.insertBefore(showMeridianLinkButton, dropdownButton.nextSibling);
    })
    .catch(error => console.error('Error loading JSON files:', error));
});
let totalAttributes = {}; // {属性键: 累计值}

// 效果代码映射函数
function getEffectDisplayName(effectCode) {
    const effectMap = {
        'YMXLFYQHHF': '气血恢复效果',
        'YMXLFYQHHD': '护盾效果', 
        'YMXLFYQHSH': '【耀】闪躲回血效果',
        'YMXLFYQHZH': '【御】招架回血效果',
        'YMXLFYQHFZ': '【震】伤害效果',
        'YMXLFYQHNX': '【凝】回血效果',
        'YMXLFYQHXL': '【卸】减伤效果',
        'YMXLFYQHZG': '【真】承伤效果'
    };
    return effectMap[effectCode] || `特殊效果[${effectCode}]`;
}

//  添加幽冥共贯的特殊处理
function formatProperties(properties) {
    return properties.map(prop => {
        const [propType, attrType, elementId, value] = prop;
        
        // 处理新的 activeEffect 类型
        if (propType === 'activeEffect') {
            const effectName = getEffectDisplayName(attrType);
            return `${effectName}: 8%`; // 固定8%
        }
        
        
        if (attrType === 'atkDamageClass' && elementId === '6') {
            return `阴性毒伤: ${Number(value * 100).toFixed(2)}%`;
        }
        
        
        const element = getElementName(elementId);
        const type = getElementName(attrType) === 'defDamageClass' ? '防御' : '伤害';
        return `${element}${type}: ${Number(value * 100).toFixed(2)}%`;
    }).join(', ');
}

function createMindItemElement(mindItem, mindItemKey) {
    const mindItemElement = document.createElement('div');
    mindItemElement.className = 'col-md-12 mb-3';

   
    const idNumber = mindItemKey.match(/\d+/)[0];
    const nameElement = document.createElement('h5');
    nameElement.textContent = `玄络图${idNumber} - ${mindItem.name}`;
    mindItemElement.appendChild(nameElement);

    const resourceElement = document.createElement('p');
    mindItem.resource.forEach(resource => {
        const resourceName = getResourceName(resource[0]);
        const resourceAmount = resource[1];
        resourceElement.textContent += `需要${resourceName}: ${resourceAmount} `;
    });
    mindItemElement.appendChild(resourceElement);

    const timeElement = document.createElement('p');
    timeElement.textContent = `破境时间: ${formatTime(mindItem.time)}`;
    mindItemElement.appendChild(timeElement);

    // 总属性容器
    const totalAttributeContainer = document.createElement('div');
    totalAttributeContainer.className = 'total-attributes mb-3';
    totalAttributeContainer.innerHTML = '<h6>总属性</h6>';
    mindItemElement.appendChild(totalAttributeContainer);

    // 创建九宫格容器
    const gridContainer = document.createElement('div');
    gridContainer.className = 'meridian-grid'; // 通过CSS定义网格布局
    mindItemElement.appendChild(gridContainer);

    // 生成网格项
    for (let i = 1; i <= 14; i++) {
        const groove = mindItem[`groove${i}`];
        const precondition = mindItem[`precondition${i}`];
        if (!groove) continue;

        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';

        // 添加序号标识
        const orderBadge = document.createElement('span');
        orderBadge.className = 'grid-order-badge';
        orderBadge.textContent = i;
        gridItem.appendChild(orderBadge);

        // 内容部分
        const grooveInfo = acupointConfig[groove];
        if (grooveInfo) {
            const grooveNameElement = document.createElement('h6');
            grooveNameElement.textContent = `窍关${i}: ${grooveInfo.name}`;
            gridItem.appendChild(grooveNameElement);

            // 类型标签
            const typeTag = document.createElement('span');
            typeTag.className = `badge ${getTypeClass(grooveInfo.type)}`;
            typeTag.textContent = grooveInfo.type === 1 ? '参伐' : grooveInfo.type === 2 ? '守御' : '共贯';
            gridItem.appendChild(typeTag);

            // 等级标签
            const classTag = document.createElement('span');
            classTag.className = `badge ${getClassClass(grooveInfo.class)}`;
            classTag.textContent = grooveInfo.class === 1 ? '正基' : grooveInfo.class === 2 ? '中丹' : '通元';
            gridItem.appendChild(classTag);

            // 资源信息
            const resourceWrapper = document.createElement('div');
            resourceWrapper.className = 'resource-wrapper';
            grooveInfo.resource.forEach(resource => {
                const resourceItem = document.createElement('span');
                resourceItem.className = 'resource-item';
                resourceItem.innerHTML = `<i class="bi-coin"></i>${getResourceName(resource[0])}×${resource[1]}`;
                resourceWrapper.appendChild(resourceItem);
            });
            gridItem.appendChild(resourceWrapper);

            // 时间信息
            const timeWrapper = document.createElement('div');
            timeWrapper.className = 'time-wrapper';
            timeWrapper.innerHTML = `<i class="bi-clock-history"></i>${formatTime(grooveInfo.time)}`;
            gridItem.appendChild(timeWrapper);

       
            if (precondition.length > 0) {
                const preconditionWrapper = document.createElement('div');
                preconditionWrapper.className = 'precondition-wrapper mt-2';
                
                const title = document.createElement('div');
                title.className = 'precondition-title text-muted small';
                title.textContent = '前置要求：';
                preconditionWrapper.appendChild(title);

                const content = document.createElement('div');
                content.className = 'precondition-content';
                content.innerHTML = precondition.map(p => `
                    <span class="precondition-item badge bg-light text-dark border me-1">${p}</span>
                `).join('');
                preconditionWrapper.appendChild(content);

                gridItem.appendChild(preconditionWrapper);
            }

            // 按钮部分
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'button-wrapper d-flex justify-content-between align-items-center';

            // 装备按钮
            const installButton = document.createElement('button');
            installButton.className = 'btn btn-primary btn-sm';
            installButton.innerHTML = '<i class="bi-magic"></i> 装备玄络';
            installButton.addEventListener('click', () => {
                const modal = createMeridianLinkModal(grooveInfo.type, grooveInfo.class, gridItem);
                document.body.appendChild(modal);
            });

            // 卸下按钮
            const uninstallButton = document.createElement('button');
            uninstallButton.className = 'btn btn-outline-danger btn-sm';
            uninstallButton.innerHTML = '<i class="bi-trash"></i> 卸下';
            uninstallButton.addEventListener('click', () => {
                if (gridItem.dataset.linkId) {
                    const linkData = meridianLinkConfig[gridItem.dataset.linkId];
                    updateTotalAttributes('remove', linkData);
                    delete gridItem.dataset.linkId;
                    
                    // 即时反馈
                    uninstallButton.innerHTML = '<i class="bi-check2"></i> 已卸下';
                    setTimeout(() => {
                        uninstallButton.innerHTML = '<i class="bi-trash"></i> 卸下';
                    }, 1000);
                }
                const linkId = gridItem.dataset.linkId;
                if (linkId) {
                    const linkData = meridianLinkConfig[linkId];
                    updateTotalAttributes('remove', linkData);
                    delete gridItem.dataset.linkId;
                }
                // 删除属性元素
                gridItem.querySelectorAll('.highlight-property, .highlight-special, .highlight-unlock-conditions').forEach(el => el.remove());
            });

            buttonWrapper.appendChild(installButton);
            buttonWrapper.appendChild(uninstallButton);
            gridItem.appendChild(buttonWrapper);
        }

        gridContainer.appendChild(gridItem);
    }

    return mindItemElement;
}

// 修改 createMeridianLinkModal 函数
function createMeridianLinkModal(xltype, xlclass, grooveElement) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.tabIndex = '-1';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">选择玄络</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <ul class="list-group">
                        ${Object.values(meridianLinkConfig)
                            .filter(link => link.type === xltype && link.class <= xlclass)
                            .map(link => `
                                <li class="list-group-item ${isLinkEquipped(link.id, grooveElement) ? 'disabled' : ''}">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <div>
                                            <span class="badge ${getTypeClass(link.type)} me-1">${link.type === 1 ? '参伐' : link.type === 2 ? '守御' : '共贯'}</span>
                                            <span class="badge ${getClassClass(link.class)}">${link.class === 1 ? '正基' : link.class === 2 ? '中丹' : '通元'}</span>
                                        </div>
                                        <strong>${link.name}</strong>
                                    </div>
                                    <div class="ps-3">
                                        <p class="mb-1 small">解锁条件: ${link.Unlocktext}</p>
                                        <p class="mb-1 small">属性加成: ${formatProperties(link.property)}</p>
                                        ${link.specialproperty.length > 0 ? 
                                            `<p class="mb-1 small">特殊加成: ${formatProperties(link.specialproperty)}</p>` : ''}
                                        ${link.specialtext ? `<p class="mb-1 small text-success"><strong>特殊效果: ${link.specialtext}</strong></p>` : ''}
                                    </div>
                                    <div class="text-end mt-2">
                                        <button class="btn btn-primary btn-sm select-link" 
                                            data-link-id="${link.id}"
                                            ${grooveElement.dataset.linkId ? 'disabled' : ''}>
                                            ${grooveElement.dataset.linkId ? '先卸下' : '装备'}
                                        </button>
                                    </div>
                                </li>
                            `).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;

    // 检查玄络是否已被装备
    function isLinkEquipped(linkId, currentGroove) {
        const gridContainer = currentGroove.closest('.meridian-grid');
        return Array.from(gridContainer.querySelectorAll('.grid-item'))
            .filter(item => item !== currentGroove)
            .some(item => item.dataset.linkId === linkId);
    }

    // 修改装备事件处理
    modal.addEventListener('click', (event) => {
        if (event.target.closest('.select-link')) {
            const button = event.target.closest('.select-link');
            const linkId = button.dataset.linkId;
            
            if (button.disabled) return;

            // 移除旧玄络
            if (grooveElement.dataset.linkId) {
                const prevLink = meridianLinkConfig[grooveElement.dataset.linkId];
                updateTotalAttributes('remove', prevLink);
            }

            // 设置新玄络
            const selectedLink = meridianLinkConfig[linkId];
            grooveElement.dataset.linkId = linkId;
            updateTotalAttributes('add', selectedLink);

            // 更新按钮状态
            button.textContent = '已装备';
            button.disabled = true;
            
            // 关闭模态框
            setTimeout(() => bootstrap.Modal.getInstance(modal).hide(), 1000);
        }
    });

    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();

    // 延迟绑定事件
    modal.addEventListener('shown.bs.modal', () => {
        modal.querySelectorAll('.select-link').forEach(button => {
            button.addEventListener('click', () => {
                const linkId = button.dataset.linkId;
                const selectedLink = meridianLinkConfig[linkId];
                if (selectedLink) {
                    // 删除旧的属性加成和特殊加成元素
                    const existingProperties = grooveElement.querySelectorAll('.highlight-property, .highlight-special, .highlight-unlock-conditions');
                    existingProperties.forEach(el => el.remove());

                    // 创建新的属性加成元素
                    const propertyElement = document.createElement('p');
                    propertyElement.className = 'highlight-property';
                    propertyElement.textContent = `属性加成: ${formatProperties(selectedLink.property)}`;

                    // 创建新的特殊加成元素
                    const specialElement = document.createElement('p');
                    specialElement.className = 'highlight-special';
                    specialElement.textContent = `特殊加成: ${formatProperties(selectedLink.specialproperty)}`;

                    // 解锁条件
                    const unlockConditionsElement = document.createElement('p');
                    unlockConditionsElement.className = 'highlight-unlock-conditions';
                    unlockConditionsElement.textContent = `解锁条件: ${selectedLink.Unlocktext}`;

                    // 插入新元素
                    const lastChild = grooveElement.lastElementChild;
                    if (lastChild) {
                        grooveElement.insertBefore(unlockConditionsElement, lastChild.nextSibling);
                        grooveElement.insertBefore(specialElement, lastChild.nextSibling);
                        grooveElement.insertBefore(propertyElement, lastChild.nextSibling);
                    } else {
                        grooveElement.appendChild(unlockConditionsElement);
                        grooveElement.appendChild(specialElement);
                        grooveElement.appendChild(propertyElement);
                    }

                    // 存储玄络数据到DOM元素
                    grooveElement.dataset.linkId = linkId;
                    // 更新总属性
                    updateTotalAttributes('add', selectedLink);
                }
            });
        });
    });

    return modal;
}

function isConflict(prop, linkData) {
    return linkData.property.some(p => 
        p[1] === prop[1] && 
        p[2] === prop[2] && 
        p[3] * prop[3] < 0
    );
}

// 属性更新方法
function updateTotalAttributes(operation, linkData) {
    const modifier = operation === 'add' ? 1 : -1;
    
    if (operation === 'add' && 
        Object.values(meridianLinkConfig)
            .filter(l => l.id !== linkData.id)
            .some(l => l.property.some(p => isConflict(p, linkData)))
    ) {
        alert('存在冲突属性，无法装备！');
        return;
    }

    // 处理常规属性
    linkData.property.forEach(prop => {
        const [propType, attrType, elementId, value] = prop;
        if (propType === 'damageAttr') {
            const key = `${attrType}_${elementId}`;
            totalAttributes[key] = (totalAttributes[key] || 0) + value * modifier;
        }
    });

    // 处理特殊属性
    linkData.specialproperty.forEach(prop => {
        const [propType, attrType, elementId, value] = prop;
        
        if (propType === 'damageAttr') {
           
            const key = `${attrType}_${elementId}`;
            totalAttributes[key] = (totalAttributes[key] || 0) + value * modifier;
        } else if (propType === 'activeEffect') {
            // 新的特殊效果 - 使用效果代码作为key
            const effectKey = `effect_${attrType}`;
            // 固定8%的效果，直接存储0.08
            totalAttributes[effectKey] = (totalAttributes[effectKey] || 0) + 0.08 * modifier;
        }
    });

    // 立即更新显示
    refreshTotalDisplay();
}

// 修改：属性显示刷新方法 - 添加毒伤的特殊处理
function refreshTotalDisplay() {
    const container = document.querySelector('.total-attributes');
    if (!container) return;

    container.innerHTML = '<h6>总属性</h6>';
    
    Object.entries(totalAttributes).forEach(([key, value]) => {
        if (value <= 0) return;
        
        if (key.startsWith('defDamageClass_') || key.startsWith('atkDamageClass_')) {
            // 常规伤害/防御属性
            const [attrType, elementId] = key.split('_');
            const element = document.createElement('p');
            element.className = 'highlight-property';
            
            const elementName = getElementName(elementId);
            
            // 特殊处理：毒伤属性（属性ID为6）
            if (elementId === '6' && attrType === 'atkDamageClass') {
                element.textContent = `阴性毒伤: ${(value * 100).toFixed(2)}%`;
            } else {
                const typeName = getElementName(attrType) === 'defDamageClass' ? '防御' : '伤害';
                element.textContent = `${elementName}${typeName}: ${(value * 100).toFixed(2)}%`;
            }
            
            container.appendChild(element);
        } else if (key.startsWith('effect_')) {
            // 特殊效果属性
            const [_, effectCode] = key.split('_');
            const element = document.createElement('p');
            element.className = 'highlight-special';
            
            const effectName = getEffectDisplayName(effectCode);
            element.textContent = `${effectName}: ${(value * 100).toFixed(0)}%`;
            container.appendChild(element);
        }
    });
}


function getTypeClass(type) {
    return {
        1: 'bg-danger',
        2: 'bg-primary',
        3: 'bg-success'
    }[type] || 'bg-secondary';
}

function getClassClass(linkClass) {
    return {
        1: 'bg-warning text-dark',
        2: 'bg-info text-dark',
        3: 'bg-dark'
    }[linkClass] || 'bg-secondary';
}

function getResourceName(resourceKey) {
    const currency = {
        money: "碎银",
        gold: "黄金",
        yuanbao: "元宝",
        meiyu: "江湖美誉",
        deadCurrency: "亿冥币",
        mingbi: "亿冥币",
        zjjifen: "功绩",
        yinpiao: "银票",
        spcl: "饰品材料",
        jiaozi: "游字令",
        zhounianjf: "七夕礼券",
        dreamYiYu: "梦内呓语",
        xiangnang: "香囊",
        zongheng: "雪矾",
        molizhu: "墨璃珠",
        amartial: "武学要领",
        dmartial: "功法学识",
        bmartial: "武学心得",
        cmartial: "武学至极",
        xizhaoling: "昔朝令",
    };
    return currency[resourceKey] || resourceKey;
}

function getElementName(elementId) {
    const methodNames = {
        "1": "无性",
        "3": "阳性",
        "5": "阴性",
        "7": "混元",
        "9": "外功",
    };
    return methodNames[elementId] || elementId;
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    return `${hours}小时${minutes}分钟${seconds}秒`;
}

function createMeridianLinkElement() {
    const categories = {
        '正基': [],
        '中丹': [],
        '通元': []
    };

    Object.values(meridianLinkConfig).forEach(link => {
        const category = link.class === 1 ? '正基' : link.class === 2 ? '中丹' : '通元';
        categories[category].push(link);
    });

    const result = {
        '正基': '',
        '中丹': '',
        '通元': ''
    };

    Object.keys(categories).forEach(category => {
        categories[category].forEach(link => {
            const linkElement = document.createElement('div');
            linkElement.className = 'meridian-link';

            const nameElement = document.createElement('h6');
            nameElement.textContent = `名称: ${link.name}`;
            linkElement.appendChild(nameElement);

            const unlockTextElement = document.createElement('p');
            unlockTextElement.textContent = `解锁条件: ${link.Unlocktext}`;
            linkElement.appendChild(unlockTextElement);

            const resourceElement = document.createElement('p');
            resourceElement.textContent = `资源: ${link.resource.length > 0 ? link.resource.map(resource => `${getResourceName(resource[0])}: ${resource[1]}`).join(', ') : '无'}`;
            linkElement.appendChild(resourceElement);

            const propertyElement = document.createElement('p');
            propertyElement.textContent = `属性加成: ${formatProperties(link.property)}`;
            linkElement.appendChild(propertyElement);

            const specialTextElement = document.createElement('p');
            specialTextElement.textContent = `特殊加成: ${formatProperties(link.specialproperty)}`;
            linkElement.appendChild(specialTextElement);

            if (link.specialtext) {
                const specialEffectElement = document.createElement('p');
                specialEffectElement.className = 'text-success';
                specialEffectElement.textContent = `特殊效果: ${link.specialtext}`;
                linkElement.appendChild(specialEffectElement);
            }

            const specialUnlockTextElement = document.createElement('p');
            specialUnlockTextElement.textContent = `特殊加成解锁条件: ${link.SUnlocktext||""}`;
            linkElement.appendChild(specialUnlockTextElement);

            result[category] += linkElement.outerHTML;
        });
    });

    return result;
}