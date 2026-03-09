# Architecture

## 1. 总体定位

StoryFlow Studio 是一个把 **AI 写作引擎** 与 **AI 影视工作台** 融合为统一产品的项目。

它不追求简单拼接两个现有开源项目，而是构建一套新的产品架构：

- 上游：想法输入、参考素材输入
- 中游：故事生成、改编、镜头规划
- 下游：分镜、视频、配音、导出

## 2. 模块边界

### Idea Engine
负责项目初始化与创作起点生成。

### Story Engine
负责世界观、角色、组织、大纲、章节与长期写作资产。

### Adaptation Engine
负责把长文本拆分成 scene / shot，并生成结构化镜头描述。

### Reference Vision Engine
负责从截图、样片、视频抽帧中分析镜头语言、动作与风格特征。

### Asset Engine
负责角色、场景、道具、风格卡和中间生成资产管理。

### Storyboard Engine
负责镜头管理、分镜展示、镜头变体与人工修订。

### Render Engine
负责图像、视频、配音、字幕、导出与异步任务编排。

## 3. 数据主链

```text
IdeaSeed
  -> Outline
  -> Chapter
  -> Scene
  -> Shot
  -> StoryboardFrame
  -> RenderJob
  -> VideoOutput
```

参考素材支线：

```text
ReferenceAsset
  -> VisualAnalysis
  -> StyleProfile
  -> Scene / Shot Adaptation
```

## 4. 前端架构

当前采用 Next.js App Router 作为基础工作台外壳。

页面层按照产品信息架构拆分：
- Dashboard
- Idea Lab
- Story Setup
- Chapter Studio
- Adaptation Lab
- Storyboard
- Render Studio
- Reference Lab
- Assets
- Settings

共享层：
- `components/`：Shell、Sidebar、SectionCard、Pipeline 等
- `lib/`：导航元数据、样例数据、公共常量

## 5. 后端与运行时规划

短期：
- Next.js + Prisma 跑通 MVP 骨架

中期：
- 引入 Redis / BullMQ 管理异步任务
- 引入对象存储管理媒体资产
- 为重模型任务预留外部服务或 worker

长期：
- 形成可替换的多 provider 生成平台
- 对接不同图像、视频、语音和 LLM 能力源

## 6. 设计原则

- 产品统一高于旧项目拼接
- 领域模型统一高于界面搬运
- 先跑通主链，再丰富高级能力
- 保持模块化，便于未来替换 provider 与业务策略
