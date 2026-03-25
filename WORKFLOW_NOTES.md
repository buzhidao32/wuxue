# GitHub Actions Capacitor 打包说明

## 当前已添加的工作流

仓库中已新增 GitHub Actions 工作流：

- `.github/workflows/capacitor-mobile-build.yml`

这个工作流用于构建：

- Android
- iOS

## 工作流做了什么

### Android

工作流会执行：

1. `npm ci`
2. `npm run build`
3. `npx cap sync android`
4. 使用 `Gradle` 构建：
   - `debug APK`
   - `release APK`
   - `release AAB`
5. 将产物上传为 `android-artifacts`

### iOS

工作流会执行：

1. `npm ci`
2. `npm run build`
3. 如果仓库里没有 `ios/` 目录，则执行 `npx cap add ios`
4. `npx cap sync ios`
5. `pod install`
6. 使用 `xcodebuild` 做无签名构建
7. 将产物上传为 `ios-artifacts`

## 现在怎么用

### 触发方式

支持以下方式触发：

- 手动触发：`Actions` -> `Capacitor Mobile Build` -> `Run workflow`
- 自动触发：
  - 推送到 `main`
  - 推送到 `master`
  - 创建或更新 `pull request`

### 使用步骤

1. 先把当前修改提交到 Git
2. 推送到 GitHub 仓库
3. 打开 GitHub 仓库页面
4. 进入 `Actions`
5. 选择 `Capacitor Mobile Build`
6. 运行后在 `Artifacts` 中下载构建结果

## 关于 iOS 不签名

当前 iOS 工作流是“不签名构建”。

这意味着：

- 可以用于 CI 编译检查
- 可以验证 Capacitor iOS 工程是否能正常构建
- 可以生成用于模拟器的构建产物

这也意味着：

- 不能安装到真实 iPhone
- 不能导出可分发的 `ipa`
- 不能上架 App Store
- 不能用于 TestFlight

结论：

- 如果只是想检查项目能不能编译，通过当前方案就够了
- 只要想装到真机，就必须做签名

## 关于签名是否要付费

之前讨论的结论是：

- 免费 Apple ID 可以做非常有限的个人调试签名
- 但如果你明确选择“不签名”，那当前 workflow 只保留编译检查意义

## 本地 Android Studio 生成的 APK 要不要删

当前检测到本地已有构建产物：

- `wuxue-app/android/app/release/app-release.apk`

建议：

- 删除
- 至少不要提交到 Git

原因：

- 这是构建产物，不是源码
- GitHub Actions 会重新生成
- 提交这类文件只会让仓库变大、变乱

## 后续建议

后面继续整理时，建议补一个 `.gitignore`，至少忽略这些内容：

```gitignore
*.apk
*.aab
android/app/build/
ios/build/
```

如果后面要继续推进，下一步建议优先做：

1. 删除本地已有 APK 构建产物
2. 补 `.gitignore`
3. 提交当前 workflow
4. 推送后在 GitHub 上实际跑一次

## 当前结论

现在仓库已经有一套可用的 GitHub Actions 方案：

- Android 可以自动打包并上传产物
- iOS 当前只做无签名编译检查

这套方案适合现在这个阶段继续往前推进。
