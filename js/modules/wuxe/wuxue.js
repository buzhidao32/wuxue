// 主文件
import {
  loadSkillData,
  loadSkillAutoData,
  loadActiveSkillData,
  loadBookSkillUnlockData,
  getUniqueValues,
} from "./dataLoader.js";
import {
  initModals,
  createFilterBadges,
  clearFilters,
  matchesFilters,
  toggleFilter,
  buildSearchIndex,
  setLoadStatus,
  scheduleRefresh,
  getSearchThrottleTimer,
  setSearchThrottleTimer,
} from "./uiManager.js";
import { updateSkillList } from "./skillDisplay.js";

export let skillData = null;
export let activeSkillData = null;

function refreshSkillList() {
  scheduleRefresh();
}

async function initializePage() {
  try {
    initModals();

    createFilterBadges("familyFilters", [], "family");
    createFilterBadges("elementFilters", [], "element");
    createFilterBadges("zhaojiaFilters", [], "zhaojia");
    createFilterBadges("methodsFilters", [], "methods");

    const searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", () => {
      const timer = getSearchThrottleTimer();
      if (timer) {
        clearTimeout(timer);
      }
      setSearchThrottleTimer(setTimeout(() => {
        refreshSkillList();
      }, 300));
    });

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get("q");
    if (query) {
      searchInput.value = query;
    }

    window.clearFilters = (filterType) => {
      clearFilters(filterType);
      const timer = getSearchThrottleTimer();
      if (timer) {
        clearTimeout(timer);
      }
      setSearchThrottleTimer(setTimeout(() => {
        refreshSkillList();
      }, 100));
    };

    setLoadStatus("loading");

    loadSkillData()
      .then((data1) => {
        skillData = data1;

        setLoadStatus("loaded");

        refreshSkillList();

        Promise.all([
          loadActiveSkillData(),
          loadSkillAutoData(),
          loadBookSkillUnlockData(),
        ])
          .then(([data2]) => {
            activeSkillData = data2;

            buildSearchIndex(skillData, activeSkillData);

            const currentSearchInput = document.getElementById("searchInput");
            if (currentSearchInput?.value.trim()) {
              refreshSkillList();
            }

            const families = getUniqueValues(skillData.skills, "familyList");
            createFilterBadges("familyFilters", families, "family");
            const elements = getUniqueValues(
              skillData.skills,
              "autoZhaoAtkDamageClass",
            );
            createFilterBadges("elementFilters", elements, "element");
            const zhaojiaValues = getUniqueValues(
              skillData.skills,
              "zhaoJiaDefDamageClass",
            );
            createFilterBadges("zhaojiaFilters", zhaojiaValues, "zhaojia");
            const methods = getUniqueValues(skillData.skills, "methods");
            createFilterBadges("methodsFilters", methods, "methods");
          })
          .catch((error) => {
            console.error("加载附加数据失败:", error);
          });
      })
      .catch((error) => {
        setLoadStatus("error");
        console.error("加载核心数据失败:", error);
      });
  } catch (error) {
    setLoadStatus("error");
    console.error("页面初始化失败:", error);
  }
}

document.addEventListener("DOMContentLoaded", initializePage);
window.toggleFilter = toggleFilter;
