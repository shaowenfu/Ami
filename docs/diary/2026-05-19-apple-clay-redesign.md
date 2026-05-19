# 开发日志 - Ami 前端 Apple Clay 重设计

## 2026-05-19

### 动机

今天我把 Ami 的前端从“依据三张旧 UI 图还原”的路线，切换到了新的 Apple Clay 视觉方向。

这个决定很关键：Ami 不是一个普通工具箱，也不是一个纯聊天壳子。它更像一个放在亲密关系中间的温柔协作者，既要让人觉得安全、轻盈、可信，又不能太像冷冰冰的管理软件。所以我放弃了旧图里的直接还原思路，重新围绕“亲密关系陪伴、温柔协作、长期成长”来组织视觉和交互。

我最终采用的方向是 Apple Clay：用苹果式的克制、清透和秩序打底，再叠加柔和的 clay 体积感，让界面既有情绪温度，又不显得幼稚或过度糖果化。

### 主要工作

#### 1. 先建立统一视觉系统

我没有继续在页面里堆一次性样式，而是先沉淀了一层设计基础：

- `theme/appleClay.ts`：集中定义颜色、圆角、字体和阴影语义
- `styles/global.css`：替换旧的 Obsidian/Solar 变量，改成 Ami 专属的柔和浅色画布
- `tailwind.config.js`：补齐 clay 色板和字体语义

这一步的目标是让之后的界面不是“页面各画各的”，而是能从一个共同的审美系统里长出来。

颜色上我刻意避开了单一紫色主导，改成 mist lavender、warm pink、apricot、celadon、sky blue、soft ink 这一组低饱和关系感配色。紫色仍然保留为主操作色，但它不再压住整个应用。

#### 2. 抽出 Apple Clay 通用组件

我新增了 `components/AppleClay.tsx` 和 `components/ToolCard.tsx`，把这轮需要反复出现的 UI 语言收进组件里：

- `SoftBackground`：柔和背景色块，承接 Apple Clay 氛围
- `ClaySurface`：通用 clay 卡片和可点击容器
- `ClayButton`：带按压缩放和阴影反馈的按钮
- `ClayInput`：内凹感输入框
- `ClaySegmentedControl`：聊天模式切换
- `ClayModal`：工具详情底部弹窗
- `RelationshipAvatar` / `GeneratedAsset`：统一引用生成式视觉资产
- `CheckPill`：筛选、心情、标签选择控件

我特别注意了按压反馈。这个应用的交互应该像轻轻按到一块柔软材料上，而不是普通网页按钮那种变色反馈。所以按钮、卡片、chip 都有轻微 squish 或浮起效果。

#### 3. 用 imagegen 生成项目资产

我使用 `imagegen` 生成了一张 Apple Clay 风格的资产表，里面包括：

- Ami 机器人
- 情侣头像
- 回忆胶囊
- 约会日历

生成后的原图放在 Codex 的 generated_images 目录里，我把项目需要引用的版本复制到了 `Amiapp/assets/generated/`。随后我发现直接裁剪整张资产表会导致头像位置不稳定，有些地方出现空白或边角，于是又把它切成四张独立 PNG：

- `ami-mascot.png`
- `couple-avatar.png`
- `memory-capsule.png`
- `date-calendar.png`

这一步让头像、工具卡片和资料页插画都更稳定，也更适合后续复用。

#### 4. 建立 Zustand mock store

为了让界面不是纯静态图，我新增了 `store/useAmiMockStore.ts`，把前端演示状态集中管理起来。

这次我定义并实现了这些核心数据和动作：

- 聊天：`ChatMessage`、`ChatMode`、`sendMessage`、`toggleReaction`、`setChatMode`
- 工具：`ToolFeature`、`openTool`、`closeTool`
- 愿望：`WishItem`、`addWish`、`toggleWish`
- 情绪：`MoodEntry`、`setTodayMood`
- 纪念日：`Anniversary`
- 时光：`RelationshipMoment`、`setMomentFilter`、`toggleMomentSaved`
- 资料设置：`ProfileSetting`、`toggleProfileSetting`
- 约会与复盘：`acceptDatePlan`、`saveConflictReflection`

这个 store 让四个 Tab 之间有了真实联动。例如在工具箱里新增愿望，会进入 mock 状态；约会计划确认后，资料页也会看到“已确认”的状态；心情切换会更新个人页的今日心情卡片。

#### 5. 重做四个 Tab 页面

我保留了 Expo Router 的四个主页面结构：

- `/chat`
- `/tools`
- `/moments`
- `/profile`

但页面内容都换成了新的 Apple Clay 版本。

聊天页支持 Agent/三人群聊切换、快捷回复、输入 mock 消息、AI typing 状态、reaction、约会计划确认。

工具箱页支持打开每个工具的底部详情面板。纪念日、愿望清单、情绪记录、约会计划、冲突复盘、关系时间线都有各自的最小交互闭环。

时光页支持按类型筛选关系瞬间，也能收藏/取消收藏条目。

我的页面支持心情切换、关系统计、当前约会计划状态和通知/隐私/温柔提醒开关。

#### 6. 修复 Web 宽屏预览问题

移动端截图看起来稳定后，我又用 `1280x900` 桌面尺寸做了一轮截图。这里暴露出一个真实问题：React Native Web 会把移动端布局横向拉满，聊天流和工具卡片会被摊到整屏宽度。

因为 Ami 当前明确是 portrait mobile app，我在 `app/_layout.tsx` 里给 Web/大屏预览加了居中的移动画布约束，最大宽度控制在 480px。这样桌面浏览器也会以手机壳式画布预览，而不是错误地把移动端页面当桌面页面铺开。

### 验证

我完成了三层验证：

1. 类型检查：`npx tsc --noEmit` 通过。
2. Playwright 截图：分别检查了移动端 `393x852` 和桌面端 `1280x900` 的 chat、tools、moments、profile 页面。
3. in-app browser 交互 smoke：验证了发送消息、打开工具、添加愿望、筛选时光、切换心情这些关键路径。

截图验证中我做过一次返工：生成资产从整张图裁剪改为四张独立 PNG。这个小问题如果不修，会让界面的精致感打折，所以我宁愿多走一步。

### 经验和思考

这次最重要的收获是：UI/UX 驱动不等于先画静态页面，而是先把产品的情绪定位、视觉系统、交互反馈和数据流雏形一起定住。

如果只做静态还原，界面很容易漂亮但空。Ami 这种产品尤其需要“动作之后有回应”：我发一句话，Ami 要有 typing；我确认约会，资料页要同步状态；我记录愿望，时光里要多一个关系瞬间。这些小联动会让用户相信 Ami 真的是一个陪在关系里的伙伴。

我也更明确了下一步的方向：现在前端已经有了一个可交互的 Apple Clay 壳子，后续就可以继续沿着真实数据流往下走，比如把聊天接入后端、把愿望和时光持久化、把关系状态从 mock 推进到真实模型。

今天这轮工作让 Ami 从“有页面”向“有气质、有手感、有关系记忆的产品原型”迈了一步。
