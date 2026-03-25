# Android 数据热更新说明

当前 Android 端采用的是“仅数据热更新”方案，不更新页面代码，只更新数据文件。

## 目标

Android 端运行时按下面顺序尝试获取最新数据：

1. Netlify 镜像站
2. GitHub Pages 站点
3. jsDelivr CDN
4. APK 内置数据

这样做的目的：

- 某一个站点访问失败时，不会直接误判成“没有更新”
- 有网络时尽量使用线上最新数据
- 没网络时仍然能用 APK 自带数据兜底

## 当前远程数据源顺序

定义位置：

- `js/runtimeConfig.js`

当前顺序：

1. `https://buzhidao159.netlify.app/`
2. `https://buzhidao32.github.io/wuxue/`
3. `https://cdn.jsdelivr.net/gh/buzhidao32/wuxue@main/`

## 更新逻辑

Android 原生 App 运行时：

- 优先请求远程 `data/version.json`
- 如果远程版本比本地缓存新，则下载最新 JSON 数据并写入 IndexedDB 缓存
- 页面优先读取缓存
- 如果远程源全部失败，则回退使用 APK 内置数据

网页端仍然保持原来的同源加载方式，不受 Android 热更新策略影响。

## 依赖文件

主要实现文件：

- `js/runtimeConfig.js`
- `js/db.js`
- `js/modules/wuxe/dataLoader.js`

## 以后如果要改远程源

只需要改：

- `js/runtimeConfig.js`

修改 `DEFAULT_REMOTE_BASE_URLS` 数组顺序即可。

## 以后更新数据时怎么做

1. 更新仓库中的 `data/`
2. 更新 `data/version.json`
3. 部署网页端数据源
4. Android 用户下次打开 App 时会自动检查并更新缓存

如果同时还要发新 APK，再额外重新打包即可。
