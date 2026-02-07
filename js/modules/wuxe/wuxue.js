// 主文件
import { loadSkillData, loadSkillAutoData, loadActiveSkillData, getUniqueValues } from './dataLoader.js';
import { initModals, createFilterBadges, clearFilters, matchesFilters, toggleFilter } from './uiManager.js';
import { updateSkillList } from './skillDisplay.js';

export let skillData = null;
export let activeSkillData = null;

async function initializePage() {
    try {
        initModals();

        createFilterBadges('familyFilters', [], 'family');
        createFilterBadges('elementFilters', [], 'element');
        createFilterBadges('methodsFilters', [], 'methods');

        document.getElementById('searchInput').addEventListener('input', () => {
            updateSkillList(skillData, matchesFilters);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
            document.getElementById('searchInput').value = query;
        }

        window.clearFilters = (filterType) => {
            clearFilters(filterType);
            updateSkillList(skillData, matchesFilters);
        };

        // 优先加载核心数据
        loadSkillData().then(data1 => {
            skillData = data1;
            
            // 立即更新技能列表
            updateSkillList(skillData, matchesFilters);
            
            // 并行加载其他数据
            Promise.all([
                loadActiveSkillData(),
                loadSkillAutoData()
            ]).then(([data2]) => {
                activeSkillData = data2;
                
                // 更新过滤条件等
                const families = getUniqueValues(skillData.skills, 'familyList');
                createFilterBadges('familyFilters', families, 'family');
                const elements = getUniqueValues(skillData.skills, 'zhaoJiaDefDamageClass');
                createFilterBadges('elementFilters', elements, 'element');
                const methods = getUniqueValues(skillData.skills, 'methods');
                createFilterBadges('methodsFilters', methods, 'methods');
            }).catch(error => {
                console.error('加载附加数据失败:', error);
            });
        }).catch(error => {
            console.error('加载核心数据失败:', error);
        });

    } catch (error) {
        console.error('页面初始化失败:', error);
    }
}

document.addEventListener('DOMContentLoaded', initializePage);
window.toggleFilter = toggleFilter;
