/**
 * PR #3 浏览器功能测试脚本
 * 测试最新提交 (ccec363) 的新功能
 */

import https from 'https';
import { JSDOM } from 'jsdom';

const TEST_URL = 'https://deploy-preview-3--buzhidao159.netlify.app';

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }

  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function testHTMLStructure() {
  console.log('\n=== 测试用例 7: 伤害属性和招架属性拆分展示 ===\n');

  try {
    const html = await fetchPage(TEST_URL);
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 测试 7.1: 检查伤害属性筛选区域
    const elementFilters = document.getElementById('elementFilters');
    const hasElementSection = !!elementFilters;
    logTest('7.1 伤害属性筛选区域存在', hasElementSection,
      hasElementSection ? '找到 elementFilters 元素' : '未找到 elementFilters 元素');

    // 测试 7.2: 检查招架属性筛选区域
    const zhaojiaFilters = document.getElementById('zhaojiaFilters');
    const hasZhaojiaSection = !!zhaojiaFilters;
    logTest('7.2 招架属性筛选区域存在', hasZhaojiaSection,
      hasZhaojiaSection ? '找到 zhaojiaFilters 元素' : '未找到 zhaojiaFilters 元素');

    // 测试 7.3: 检查标题文本
    const h5Elements = document.querySelectorAll('h5');
    const titles = Array.from(h5Elements).map(el => el.textContent.trim());

    const hasDamageTitle = titles.includes('伤害属性');
    logTest('7.3 伤害属性标题存在', hasDamageTitle,
      hasDamageTitle ? '找到"伤害属性"标题' : `未找到"伤害属性"标题，当前标题: ${titles.join(', ')}`);

    const hasParryTitle = titles.includes('招架属性');
    logTest('7.4 招架属性标题存在', hasParryTitle,
      hasParryTitle ? '找到"招架属性"标题' : `未找到"招架属性"标题，当前标题: ${titles.join(', ')}`);

    // 测试 7.5: 检查清除按钮
    const clearButtons = document.querySelectorAll('.clear-filters');
    const clearTexts = Array.from(clearButtons).map(el => el.textContent.trim());

    const hasElementClear = clearTexts.some(text => text === '清除');
    logTest('7.5 清除按钮存在', hasElementClear,
      hasElementClear ? '找到清除按钮' : '未找到清除按钮');

  } catch (error) {
    logTest('7 HTML结构测试', false, `错误: ${error.message}`);
  }
}

async function testJavaScriptImplementation() {
  console.log('\n=== 测试 JavaScript 实现 ===\n');

  try {
    // 测试 uiManager.js
    const uiManagerCode = await fetchPage(`${TEST_URL}/js/modules/wuxe/uiManager.js`);

    // 测试 8.1: LOAD_STATUS 常量
    const hasLoadStatus = uiManagerCode.includes('LOAD_STATUS');
    logTest('8.1 LOAD_STATUS 常量定义', hasLoadStatus,
      hasLoadStatus ? '找到 LOAD_STATUS 常量' : '未找到 LOAD_STATUS 常量');

    // 测试 8.2: setLoadStatus 函数
    const hasSetLoadStatus = uiManagerCode.includes('export function setLoadStatus');
    logTest('8.2 setLoadStatus 函数导出', hasSetLoadStatus,
      hasSetLoadStatus ? '找到 setLoadStatus 函数' : '未找到 setLoadStatus 函数');

    // 测试 8.3: scheduleRefresh 函数
    const hasScheduleRefresh = uiManagerCode.includes('export function scheduleRefresh');
    logTest('8.3 scheduleRefresh 函数导出', hasScheduleRefresh,
      hasScheduleRefresh ? '找到 scheduleRefresh 函数' : '未找到 scheduleRefresh 函数');

    // 测试 8.4: pendingSearchRequest 机制
    const hasPendingSearch = uiManagerCode.includes('pendingSearchRequest');
    logTest('8.4 pendingSearchRequest 机制', hasPendingSearch,
      hasPendingSearch ? '找到 pendingSearchRequest 机制' : '未找到 pendingSearchRequest 机制');

    // 测试 8.5: zhaojiaMatch 实现
    const hasZhaojiaMatch = uiManagerCode.includes('zhaojiaMatch');
    logTest('8.5 zhaojiaMatch 筛选逻辑', hasZhaojiaMatch,
      hasZhaojiaMatch ? '找到 zhaojiaMatch 逻辑' : '未找到 zhaojiaMatch 逻辑');

    // 测试 wuxue.js
    const wuxueCode = await fetchPage(`${TEST_URL}/js/modules/wuxe/wuxue.js`);

    // 测试 8.6: 搜索节流实现
    const hasThrottle = wuxueCode.includes('setTimeout') && wuxueCode.includes('300');
    logTest('8.6 搜索节流实现 (300ms)', hasThrottle,
      hasThrottle ? '找到 300ms 节流实现' : '未找到 300ms 节流实现');

    // 测试 8.7: zhaojia 筛选器创建
    const hasZhaojiaFilter = wuxueCode.includes('zhaojiaFilters');
    logTest('8.7 zhaojia 筛选器创建', hasZhaojiaFilter,
      hasZhaojiaFilter ? '找到 zhaojiaFilters 创建代码' : '未找到 zhaojiaFilters 创建代码');

    // 测试 8.8: zhaoJiaDefDamageClass 字段使用
    const hasZhaoJiaField = wuxueCode.includes('zhaoJiaDefDamageClass');
    logTest('8.8 zhaoJiaDefDamageClass 字段使用', hasZhaoJiaField,
      hasZhaoJiaField ? '找到 zhaoJiaDefDamageClass 字段' : '未找到 zhaoJiaDefDamageClass 字段');

  } catch (error) {
    logTest('8 JavaScript实现测试', false, `错误: ${error.message}`);
  }
}

async function testSearchThrottle() {
  console.log('\n=== 测试用例 11: 搜索节流功能 ===\n');

  try {
    const wuxueCode = await fetchPage(`${TEST_URL}/js/modules/wuxe/wuxue.js`);

    // 测试 11.1: 搜索输入事件监听
    const hasInputListener = wuxueCode.includes('searchInput.addEventListener("input"');
    logTest('11.1 搜索输入事件监听', hasInputListener,
      hasInputListener ? '找到 input 事件监听器' : '未找到 input 事件监听器');

    // 测试 11.2: 节流定时器
    const hasThrottleTimer = wuxueCode.includes('getSearchThrottleTimer') &&
                             wuxueCode.includes('setSearchThrottleTimer');
    logTest('11.2 节流定时器函数', hasThrottleTimer,
      hasThrottleTimer ? '找到节流定时器函数' : '未找到节流定时器函数');

    // 测试 11.3: 节流延迟时间
    const has300ms = wuxueCode.includes('300');
    logTest('11.3 节流延迟时间 (300ms)', has300ms,
      has300ms ? '找到 300ms 延迟' : '未找到 300ms 延迟');

  } catch (error) {
    logTest('11 搜索节流测试', false, `错误: ${error.message}`);
  }
}

async function testClearFilters() {
  console.log('\n=== 测试用例 12: 清除筛选功能 ===\n');

  try {
    const html = await fetchPage(TEST_URL);
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 测试 12.1: 伤害属性清除按钮
    const elementSection = document.querySelector('#elementFilters');
    const hasElementClear = elementSection &&
                           elementSection.parentElement &&
                           elementSection.parentElement.querySelector('.clear-filters');
    logTest('12.1 伤害属性清除按钮', !!hasElementClear,
      hasElementClear ? '找到伤害属性清除按钮' : '未找到伤害属性清除按钮');

    // 测试 12.2: 招架属性清除按钮
    const zhaojiaSection = document.querySelector('#zhaojiaFilters');
    const hasZhaojiaClear = zhaojiaSection &&
                           zhaojiaSection.parentElement &&
                           zhaojiaSection.parentElement.querySelector('.clear-filters');
    logTest('12.2 招架属性清除按钮', !!hasZhaojiaClear,
      hasZhaojiaClear ? '找到招架属性清除按钮' : '未找到招架属性清除按钮');

    // 测试 12.3: clearFilters 函数调用
    const wuxueCode = await fetchPage(`${TEST_URL}/js/modules/wuxe/wuxue.js`);
    const hasClearFunction = wuxueCode.includes('clearFilters');
    logTest('12.3 clearFilters 函数实现', hasClearFunction,
      hasClearFunction ? '找到 clearFilters 函数' : '未找到 clearFilters 函数');

  } catch (error) {
    logTest('12 清除筛选测试', false, `错误: ${error.message}`);
  }
}

async function testLoadStatusManagement() {
  console.log('\n=== 测试用例 10: 数据加载前搜索不报错 ===\n');

  try {
    const uiManagerCode = await fetchPage(`${TEST_URL}/js/modules/wuxe/uiManager.js`);
    const wuxueCode = await fetchPage(`${TEST_URL}/js/modules/wuxe/wuxue.js`);

    // 测试 10.1: LOAD_STATUS 状态值
    const hasInitial = uiManagerCode.includes('INITIAL: "initial"');
    const hasLoading = uiManagerCode.includes('LOADING: "loading"');
    const hasLoaded = uiManagerCode.includes('LOADED: "loaded"');
    const hasError = uiManagerCode.includes('ERROR: "error"');
    logTest('10.1 LOAD_STATUS 状态值完整', hasInitial && hasLoading && hasLoaded && hasError,
      `INITIAL: ${hasInitial}, LOADING: ${hasLoading}, LOADED: ${hasLoaded}, ERROR: ${hasError}`);

    // 测试 10.2: 加载状态设置
    const hasSetLoading = wuxueCode.includes('setLoadStatus("loading")');
    const hasSetLoaded = wuxueCode.includes('setLoadStatus("loaded")');
    const hasSetError = wuxueCode.includes('setLoadStatus("error")');
    logTest('10.2 加载状态设置调用', hasSetLoading && hasSetLoaded && hasSetError,
      `loading: ${hasSetLoading}, loaded: ${hasSetLoaded}, error: ${hasSetError}`);

    // 测试 10.3: 待处理搜索请求机制
    const hasPendingMechanism = uiManagerCode.includes('pendingSearchRequest') &&
                                uiManagerCode.includes('searchText');
    logTest('10.3 待处理搜索请求机制', hasPendingMechanism,
      hasPendingMechanism ? '找到 pendingSearchRequest 机制' : '未找到 pendingSearchRequest 机制');

    // 测试 10.4: 加载完成后自动执行搜索
    const hasAutoExecute = uiManagerCode.includes('status === LOAD_STATUS.LOADED && pendingSearchRequest');
    logTest('10.4 加载完成后自动执行搜索', hasAutoExecute,
      hasAutoExecute ? '找到自动执行逻辑' : '未找到自动执行逻辑');

  } catch (error) {
    logTest('10 加载状态管理测试', false, `错误: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🚀 开始执行 PR #3 浏览器功能测试...\n');
  console.log(`测试目标: ${TEST_URL}`);
  console.log(`测试时间: ${new Date().toLocaleString()}\n`);

  await testHTMLStructure();
  await testJavaScriptImplementation();
  await testSearchThrottle();
  await testClearFilters();
  await testLoadStatusManagement();

  // 打印测试总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`📈 通过率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // 返回测试结果
  return testResults;
}

// 执行测试
runAllTests().then(results => {
  console.log('\n✨ 测试完成!');
  process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
