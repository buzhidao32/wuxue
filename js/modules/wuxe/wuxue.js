// 主文件
import { loadSkillData, loadSkillAutoData, loadActiveSkillData, getUniqueValues } from './dataLoader.js';
import { initModals, createFilterBadges, clearFilters, matchesFilters, toggleFilter } from './uiManager.js'; // 确保导入 toggleFilter 函数
import { updateSkillList } from './skillDisplay.js';

// 导出 skillData
export let skillData = null;

// 初始化页面
async function initializePage() {
    try {
        // 初始化所有Modal
        initModals();

        // 加载技能数据
        skillData = await loadSkillData();

        // 加载主动技能数据
        await loadActiveSkillData();

        // 加载被动技能数据
        const skillAutoData = await loadSkillAutoData();

        // 创建门派过滤器
        const families = getUniqueValues(skillData.skills, 'familyList');
        createFilterBadges('familyFilters', families, 'family');

        // 创建武学属性过滤器
        const elements = getUniqueValues(skillData.skills, 'zhaoJiaDefDamageClass');
        createFilterBadges('elementFilters', elements, 'element');

        // 创建武学类型过滤器
        const methods = getUniqueValues(skillData.skills, 'methods');
        createFilterBadges('methodsFilters', methods, 'methods');

        // 添加搜索监听器
        document.getElementById('searchInput').addEventListener('input', () => {
            updateSkillList(skillData, matchesFilters);
        });

        // 检查URL参数并自动搜索
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
            document.getElementById('searchInput').value = query;
            updateSkillList(skillData, matchesFilters);
        }

        // 初始显示技能列表
        updateSkillList(skillData, matchesFilters);

        // 添加清除过滤器的事件处理
        window.clearFilters = (filterType) => {
            clearFilters(filterType);
            updateSkillList(skillData, matchesFilters);
        };
    } catch (error) {
        console.error('Error initializing page:', error);
    }
}

// 页面加载完成后开始初始化
document.addEventListener('DOMContentLoaded', initializePage);

// 确保 toggleFilter 函数在全局作用域中可用
window.toggleFilter = toggleFilter;