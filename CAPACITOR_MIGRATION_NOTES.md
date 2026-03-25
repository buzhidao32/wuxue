# Capacitor 接入问题记录

## 目标

将当前静态网页项目接入 Capacitor，产出：

- Android 安装包
- iOS 构建产物
- GitHub Actions 自动构建与发版流程

本文档记录本次接入过程中遇到的问题、原因和最终处理方式，方便后续继续推进 iOS 真机签名与发版。

## 当前项目结构

已新增 Capacitor 包装层目录：

- `wuxue-app/`

关键文件：

- `wuxue-app/package.json`
- `wuxue-app/capacitor.config.json`
- `wuxue-app/scripts/build-web.mjs`
- `.github/workflows/capacitor-mobile-build.yml`

## 已完成的事情

### 1. 将静态网页包进 Capacitor

当前仓库原本不是标准 Capacitor 项目，只是静态页面和资源：

- `index.html`
- `calc.html`
- `yinmai.html`
- `css/`
- `js/`
- `data/`
- `static/`

处理方式：

- 新建 `wuxue-app`
- 用 `build-web.mjs` 将根目录网页资源复制到 `wuxue-app/www`
- 使用 Capacitor 生成 Android 原生工程

### 2. GitHub Actions 已接通

当前 workflow 文件：

- `.github/workflows/capacitor-mobile-build.yml`

支持：

- `push main/master` 时构建
- `push v* tag` 时自动发 Release

Release 当前会上传：

- Android `release apk`
- Android `release aab`
- iOS `App-simulator.zip`

## 本次遇到的问题与解决

### 问题 1：GitHub HTTPS 推送认证失败

现象：

```text
Invalid username or token. Password authentication is not supported for Git operations.
```

原因：

- GitHub 不支持账号密码直接做 Git 推送
- 必须使用 PAT 或 SSH

处理：

- 保持远程仓库为 HTTPS
- 使用 GitHub PAT 作为密码
- 在 Windows 凭据管理器清除旧 GitHub 凭据

### 问题 2：workflow 指向了不存在的 `wuxue-app`

现象：

- 原 workflow 里写死 `APP_DIR: wuxue-app`
- 但仓库里原本没有这个目录

原因：

- workflow 假定项目已经是 Capacitor 结构

处理：

- 新建 `wuxue-app`
- 增加 `package.json`
- 增加 `capacitor.config.json`
- 增加静态资源构建脚本

### 问题 3：Android GitHub Actions 构建报 `invalid source release: 21`

现象：

```text
Execution failed for task ':capacitor-android:compileDebugJavaWithJavac'
error: invalid source release: 21
```

原因：

- Capacitor 7 生成的 Android 工程要求 JDK 21
- workflow 原来使用的是 Java 17

处理：

- 将 workflow 中的 `JAVA_VERSION` 改为 `21`

### 问题 4：APK 安装时报 `package info is null`

现象：

- APK 能下载
- 安装时报错或无法解析

原因：

- 生成的是未签名或不适合安装的 `release apk`
- Android 正式包必须正确签名

处理：

- 给 Android 接入正式签名流程
- workflow 通过 GitHub Secrets 解码 keystore
- Gradle 从环境变量读取签名参数

当前 Android 签名依赖以下 secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

参考文档：

- `ANDROID_SIGNING.md`
- `GITHUB_SECRETS_ANDROID.md`

### 问题 5：APK 中页面提示“加载数据失败”

现象：

- APK 可以打开
- 页面加载数据失败

原因：

- 原数据文件是 `data/*.json.gz`
- 代码依赖浏览器的 `DecompressionStream('gzip')` 解压
- Android WebView 下这条路径不稳定

处理：

- `build-web.mjs` 在构建 Capacitor 包时自动解压 `data/*.json.gz`
- 在 `wuxue-app/www/data/` 中生成未压缩的 `*.json`
- 运行时代码优先读取 `.json`

关键修改：

- `js/db.js`
- `wuxue-app/scripts/build-web.mjs`

### 问题 6：Android 构建报 `Duplicate resources`

现象：

```text
Execution failed for task ':app:mergeReleaseAssets'
Error: Duplicate resources
```

原因：

- Capacitor 构建目录里同时存在：
  - `skill.json`
  - `skill.json.gz`
- Android 资源合并时把它们判定为重复资源

处理：

- 构建时解压生成 `.json`
- 同时删除 `www/data/*.json.gz`
- 保证 APK 内只保留 `.json`

最终结果：

- Android APK 直接加载 JSON
- 不再依赖 gzip 解压
- 不再出现资源冲突

## 当前 Android 侧状态

目前 Android 已可用：

- 可以通过 GitHub Actions 构建
- 可以生成 signed release APK
- APK 安装后可正常加载数据
- 支持推送 tag 自动发 Release

## 当前 iOS 侧状态

目前 iOS 还只是“无签名模拟器构建”，不是正式真机安装包。

当前 workflow 的 iOS 部分：

- 自动创建 `ios` 平台
- `npx cap sync ios`
- `pod install`
- `xcodebuild` 无签名模拟器构建
- 输出 `App-simulator.zip`

这意味着：

- 可以做 CI 编译检查
- 可以保留模拟器产物
- 不能安装到真机
- 不能生成正式 `ipa`
- 不能上传 TestFlight

## 后续 iOS 要做什么

要把 iOS 也做成正式可安装/可分发，需要补齐签名链路。

需要准备：

- Apple Developer 账号
- iOS Distribution 证书 `.p12`
- 证书密码
- Provisioning Profile
- App Store Connect API Key（如需上传 TestFlight）

建议的 GitHub Secrets：

- `IOS_CERTIFICATE_P12_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `IOS_KEYCHAIN_PASSWORD`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY_BASE64`

参考文档：

- `IOS_SIGNING.md`

## 继续推进 iOS 时的建议顺序

1. 先确认 iOS 的 `Bundle Identifier` 与 Apple 后台一致
2. 准备签名证书和描述文件
3. 在 GitHub 配置 iOS secrets
4. 修改 workflow：
   - 导入证书
   - 安装 provisioning profile
   - `xcodebuild archive`
   - 导出 `ipa`
5. 再决定是否自动上传：
   - GitHub Release
   - TestFlight

## 额外注意

- `wuxue-release.jks` 不要提交到 Git
- `keystore.base64` 不要提交到 Git
- Android keystore 必须妥善保存，后续升级包必须继续使用同一份签名
- 当前 HTML 中的埋点代码没有删除

## 当前结论

本次 Android 接入已经打通，主要问题都已解决：

- Capacitor 结构已建立
- GitHub Actions 已可用
- Android 签名已接入
- 数据加载问题已修复
- Release 自动发版已打通

后续重点只剩下：

- iOS 真机签名
- iOS `ipa` 导出
- iOS 正式分发流程
