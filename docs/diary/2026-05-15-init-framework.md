# 开发日志 — Amiapp 最小框架搭建

## 2026-05-15

### 动机

我需要在 Ami 项目中快速搭建一个 React Native + Expo 的移动端基础框架。直接参考 datumia 项目的架构——两年前搭过一次，经验还在，但版本号和技术细节已经生疏了。这次用 `create-expo-app@latest` 从零开始，瞄准几个核心目标：

1. expo-router 文件路由，不要手写导航
2. NativeWind 做样式，用 Tailwind class 写 React Native
3. Zustand + AsyncStorage 做持久化状态
4. TypeScript strict 模式，路径别名 `@/*`

### 操作记录

#### 1. 项目初始化

执行 `npx create-expo-app@latest Amiapp --template blank-typescript@latest`，直接在 Ami 目录下生成了最小骨架。

意料之外的事：模板自动拉下来的不是计划中的 Expo SDK 52，而是 SDK 54（React Native 0.81）。这是 `@latest` 的副作用——计划写的时候 SDK 52 还是最新，实际执行时已经升到了 54。

#### 2. 依赖安装遇到 React 版本冲突

SDK 54 模板自带 React 19，但计划指定的 `react-native-web@~0.19.13`、`@types/react@~18.3.12` 等包要求 React 18。npm 直接报 `ERESOLVE` 拒绝安装。

尝试用 `--legacy-peer-deps` 绕过去，结果 Metro bundler 启动后报了一大串版本不匹配警告——expo-router 期望 `~6.0.23`，我装的是 `~3.5.23`；react-native-reanimated 期望 `~4.1.1`，装的是 `~3.16.1`。

权衡了一下：与其逐个升级到 SDK 54 的新版（datumia 也没验证过这些组合），不如把 expo 降回到 SDK 52，这样 datumia 的包版本可以原样复用，减少不确定性。

```bash
npm install expo@~52.0.0 react-native@0.76.9 \
  expo-router@~3.5.23 expo-linking@^8.0.11 \
  # ... 其他包按 datumia 版本
```

降级后仍然有两个次要版本警告（expo-linking 和 expo-router 的 patch 版本差了一丁点），但 Metro bundler 能正常启动，web bundle 编译输出 655 modules 无报错。这两个警告在 datumia 项目里也存在，属于非阻塞问题。

#### 3. TypeScript 配置踩坑

第一个坑：SDK 54 自带的 `expo/tsconfig.base` 使用了 `module: "preserve"` + `customConditions: ["react-native"]`。TypeScript 5.3.3 不认识 `"preserve"`（5.4 才引入），直接报了 `TS6046: Argument for '--module' option must be...`。

我的 tsconfig.json 通过 extends 继承了这个不兼容的 base，即使 override 了 `module` 也无效——因为错误是在解析 base 文件时抛出的，根本等不到 override。

尝试方案：
- 把 `module` override 成 `"esnext"`，失败——base 文件的解析错误先触发
- 去掉 `extends`，手动复制 base 的所有字段，成功

第二个坑：降级到 Expo SDK 52 后，base 的 `moduleResolution` 变成了 `"node"`（不再有 `"preserve"` 和 `customConditions`），`extends` 又重新安全了。于是把 tsconfig 改回 datumia 的版本——extends expo/tsconfig.base + 自己的 override。

第三个坑：启动 `npx expo start` 时，Expo CLI 偷偷把我去掉的 `"extends": "expo/tsconfig.base"` 又加回去了，还附带了一条系统提醒。不过 SDK 52 的 base 没问题，这次加上去反而正确了。

#### 4. 配置文件逐个创建

按 datumia 的结构照搬了以下文件：

- **babel.config.js**：`babel-preset-expo` + `nativewind/babel` + `react-native-worklets/plugin`
- **metro.config.js**：`withNativeWind` 包装，入口指向 `./styles/global.css`
- **tailwind.config.js**：`nativewind/preset`，extend 里定义了语义化 CSS 变量
- **nativewind-env.d.ts**：一行 reference types，NativeWind 的类型声明
- **app.json**：scheme、plugins（expo-router、expo-asset）、typedRoutes 实验开关

这些都是纯配置，没有业务逻辑，但少一个都跑不起来。

#### 5. 创建源码骨架

先删掉了模板自带的 `App.tsx` 和 `index.ts`——因为入口已经改成 `expo-router/entry`，保留它们会误导人。

创建了三个源码文件：
- `styles/global.css`：Tailwind 三件套（@tailwind base/components/utilities）+ `:root` 下的主题 CSS 变量，直接从 datumia 复制
- `app/_layout.tsx`：`Stack` 导航的根布局，隐藏 header，背景用 `bg-background`
- `app/index.tsx`：极简欢迎页，一个居中卡片展示应用名和标语

以及七个带 `.gitkeep` 的空骨架目录：components、hooks、types、utils、stores、constants、assets——为后续开发留好位置。

#### 6. 验证

- `npx tsc --noEmit`：✓ 通过，0 错误
- Metro bundler 启动：✓ `Waiting on http://localhost:8081`
- Web bundle：✓ `Web Bundled 6268ms node_modules/expo-router/entry.js (655 modules)`
- HTTP 响应：✓ `curl localhost:8081` 返回包含 `<title>Ami</title>` 的 HTML

ngrok tunnel 模式暂时失败（`remote gone away`），可能是 ngrok 版本需要 auth token 或者 WSL 网络配置问题。这留到真机调试时再处理，不影响项目骨架的完整性。

### 经验与思考

1. **版本锁定的价值**：`create-expo-app@latest` 是个双刃剑——一键创建很方便，但 SDK 版本不受控。计划里写 "SDK 52"，实际拿到 54，最后还得手动降回来。以后要么锁定模板版本，要么初始化后立刻检查 Expo 版本再对齐依赖。

2. **extends 的坑**：TypeScript 的 `extends` 解析发生在 override 之前，如果 base 文件本身语法不兼容当前 TS 版本，override 救不了。SDK 52 → 54 → 52 的来回让我反复修改 tsconfig，最终发现 SDK 52 的 base 就是最简单的 `moduleResolution: "node"`。

3. **datumia 作为参考蓝本**：因为有一个已经跑通的项目作对照，版本选择、配置细节、主题变量都有现成答案，省了大量试错时间。NativeWind 的 `withNativeWind` 和 `nativewind-env.d.ts` 这种不太显眼的文件，没有参考很容易漏掉。

4. **Non-goals 的约束力**：明确不做什么和确定做什么一样重要。这次刻意不引入多主题切换、登录认证、Tab 导航，把精力集中在最小可行骨架上。后续每次加新功能都可以从当前这个干净起点出发。
