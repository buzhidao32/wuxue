# 数据更新说明

本文档说明：当项目中的数据文件更新后，网页端和安卓端分别应该怎么处理。

## 数据位置

当前数据目录：

- `data/`

主要文件包括：

- `skill.json.gz`
- `activeZhao.json.gz`
- `skillAuto.json.gz`
- `MeridianMapConfig.json.gz`
- `AcupointConfig.json.gz`
- `MeridianLinkConfig.json.gz`
- `unlockConditionConfig.json.gz`
- `version.json`

## 网页端怎么更新

如果只是网页端要使用最新数据：

1. 修改根目录 `data/` 下的数据文件
2. 同步更新 `data/version.json`
3. 提交代码并部署网页

网页端直接读取根目录下的数据文件，所以不需要额外执行 Capacitor 或 Android 相关命令。

## 安卓端怎么更新

安卓端不会直接读取仓库根目录的 `data/`，而是读取打包进 APK 的资源文件。

因此改完数据后，必须重新生成 Capacitor 资源并重新打包 APK。

本地更新命令：

```powershell
Set-Location D:\Desktop\fzjh_backup\Special_Package\wuxue-main\wuxue-app
npm run build
npx cap sync android
```

这两步会完成：

- 将根目录最新网页资源复制到 `wuxue-app/www`
- 将 `data/*.json.gz` 解压成 APK 使用的 `.json`
- 同步到 Android 工程资源目录

## GitHub Actions 发安卓版时怎么更新

如果安卓包是通过 GitHub Actions 发版：

1. 修改根目录 `data/`
2. 更新 `data/version.json`
3. 提交并推送到 `main`
4. 打新 tag
5. 推送 tag

示例：

```powershell
git add data
git commit -m "Update game data"
git push origin main
git tag v1.0.3
git push origin v1.0.3
```

workflow 会自动执行：

- `npm run build`
- `npx cap sync android`
- Android 打包
- 上传 Release 包

## 为什么要改 version.json

代码里有缓存逻辑，会根据 `version.json` 判断是否刷新本地缓存。

如果只改了数据，但没改 `version.json`：

- 网页端可能继续读取旧缓存
- 安卓端也可能继续读取缓存内容

因此每次数据更新，建议同步更新：

- `data/version.json`

## 最短更新流程

如果以后只是“改数据并发新版安卓包”，最短流程如下：

1. 修改 `data/` 下的数据文件
2. 修改 `data/version.json`
3. 提交并推送到 `main`
4. 打新 tag
5. 推送 tag

示例：

```powershell
git add data
git commit -m "Update data"
git push origin main
git tag v1.0.3
git push origin v1.0.3
```
