# StoryFlow Studio

StoryFlow Studio 是一个面向内容创作者的 **AI 导演级创作工作台**。

它的目标不是单点生成小说，也不是单点生成视频，而是把下面这条链路打通：

**想法 / 参考素材 → 故事设定 → 小说 / 剧本 → Scene / Shot → 分镜 → 视频成片**

## 产品方向

核心能力分成两条主线：

### 1. 想法驱动
- 一句话创意
- 关键词 / 题材 / 风格
- 自动生成世界观、角色、大纲、章节
- 自动改编为分镜与视频

### 2. 参考驱动
- 上传截图、参考图、样片或短视频
- 自动解析景别、构图、动作、情绪、节奏与风格
- 把参考镜头语言迁移到原创内容

## 当前仓库状态

当前版本为 **第一版项目骨架**，重点在：
- 信息架构
- 模块划分
- 工作台 UI 外壳
- 基础技术栈
- 文档和数据模型起点

尚未实现完整业务逻辑。

## 技术栈（当前规划）

- Next.js 15
- React 19
- TypeScript
- Prisma
- 预留 Redis / Queue / 对象存储 / 多模型 provider 能力

## 目录结构

```text
app/                  # App Router 页面
components/           # 共享 UI 组件
lib/                  # 元数据、样例数据、公共逻辑
prisma/               # 数据模型
features/             # 预留业务模块目录（后续补）
docs/                 # 架构与路线图文档
PROJECT_PLAN.md       # 完整项目计划
```

## 已创建页面

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

## 推荐开发路线

1. 固定产品信息架构
2. 固定数据主链：Idea → Chapter → Scene → Shot → Render
3. 接入 Story Engine
4. 接入 Reference Vision Engine
5. 接入 Storyboard / Render 链路

## 本地运行

```bash
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

## 后续优先级

- 增加 feature-based 业务目录实现
- 增加 Prisma migration 与 seed
- 接入故事生成工作流
- 接入参考解析工作流
- 接入异步任务与视频渲染
