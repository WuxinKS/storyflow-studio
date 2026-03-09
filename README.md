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

当前版本已不是单纯骨架，已经具备一条可工作的主链：
- Story Engine 分层生成与重生
- 角色工作台：锁定字段 + 局部重生
- 视觉圣经：锁定字段 + 局部重生
- Adaptation 生成 5 scenes / 20 shots
- Timeline v1：情绪曲线、节奏提示、手动修时
- Assets v1：手动录入资产并关联角色 / 场景 / 镜头
- QA v1：成熟度等级、阻断项、sync stale 检查
- Render 执行链：真实 provider endpoint 接口 + mock fallback + 导出包

当前仍可继续深化 provider 接入与产品打磨，但核心工作台已经可以演示、验证和交付。

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
features/             # 业务领域模块（Story / Adaptation / Render 等）
docs/                 # 架构与路线图文档
PROJECT_PLAN.md       # 完整项目计划
```

## 已创建页面

- 总览
- 创意工坊
- 故事设定
- 章节工作台
- Adaptation Lab
- 分镜板
- 生成工作台
- Reference Lab
- Assets
- Settings

## 推荐开发路线

1. 固定产品信息架构
2. 固定数据主链：Idea → Chapter → Scene → Shot → Render
3. 接入 Story Engine
4. 接入 Reference Vision Engine
5. 接入分镜板 / 生成链路

## 本地运行

```bash
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

## 环境变量补充

```bash
STORYFLOW_LLM_BASE_URL=""
STORYFLOW_LLM_API_KEY=""
STORYFLOW_LLM_MODEL="gpt-5.4"
STORYFLOW_IMAGE_PROVIDER_URL=""
STORYFLOW_VOICE_PROVIDER_URL=""
STORYFLOW_VIDEO_PROVIDER_URL=""
STORYFLOW_PROVIDER_API_KEY=""
STORYFLOW_PROVIDER_AUTH_HEADER="Authorization"
```

说明：
- 未配置 `STORYFLOW_LLM_*` 时，故事 / 角色 / 视觉链路会优先走内置 fallback 模板
- 未配置 `STORYFLOW_*_PROVIDER_URL` 时，Render 执行链会自动回退为 mock，并继续生成请求 / 响应工件与交付包
- `STORYFLOW_PROVIDER_AUTH_HEADER` 默认为 `Authorization`，可按 provider 要求改成自定义 header

## 后续优先级

- 为真实图像 / 配音 / 视频 provider 配置生产 endpoint
- 继续补强 reference 分析能力
- 增加更细的项目版本管理与团队协作
- 为资产和时间线增加批量编辑体验
- 继续完善导出与发布模板
