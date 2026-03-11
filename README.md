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
- 镜头级参考绑定：参考素材可直接绑定到分场 / 镜头并进入分镜、渲染与导出链
- 交付中心：集中回看 bundle、manifest、payload 与 zip 归档
- 运行诊断台：集中查看 Provider request / response 工件、媒体索引与定向参考注入情况
- 生成工作台载荷预检：直接在页面上预览 image / voice / video payload 中的定向参考、情绪与时长字段

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
- 运行诊断台
- 交付中心
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
STORYFLOW_LLM_TIMEOUT_MS="180000"
STORYFLOW_IMAGE_PROVIDER_URL=""
STORYFLOW_IMAGE_PROVIDER_NAME=""
STORYFLOW_IMAGE_PROVIDER_MODEL=""
STORYFLOW_VOICE_PROVIDER_URL=""
STORYFLOW_VOICE_PROVIDER_NAME=""
STORYFLOW_VOICE_PROVIDER_MODEL=""
STORYFLOW_VIDEO_PROVIDER_URL=""
STORYFLOW_VIDEO_PROVIDER_NAME=""
STORYFLOW_VIDEO_PROVIDER_MODEL=""
STORYFLOW_PROVIDER_API_KEY=""
STORYFLOW_PROVIDER_AUTH_HEADER="Authorization"
STORYFLOW_PROVIDER_AUTH_SCHEME="Bearer"
STORYFLOW_PROVIDER_TIMEOUT_MS="300000"
STORYFLOW_IMAGE_PROVIDER_API_KEY=""
STORYFLOW_IMAGE_PROVIDER_AUTH_HEADER=""
STORYFLOW_IMAGE_PROVIDER_AUTH_SCHEME=""
STORYFLOW_IMAGE_PROVIDER_TIMEOUT_MS=""
STORYFLOW_VOICE_PROVIDER_API_KEY=""
STORYFLOW_VOICE_PROVIDER_AUTH_HEADER=""
STORYFLOW_VOICE_PROVIDER_AUTH_SCHEME=""
STORYFLOW_VOICE_PROVIDER_TIMEOUT_MS=""
STORYFLOW_VIDEO_PROVIDER_API_KEY=""
STORYFLOW_VIDEO_PROVIDER_AUTH_HEADER=""
STORYFLOW_VIDEO_PROVIDER_AUTH_SCHEME=""
STORYFLOW_VIDEO_PROVIDER_TIMEOUT_MS=""
```

说明：
- 未配置 `STORYFLOW_LLM_*` 时，故事 / 角色 / 视觉链路会优先走内置 fallback 模板
- 未配置 `STORYFLOW_*_PROVIDER_URL` 时，Render 执行链会自动回退为 mock，并继续生成请求 / 响应工件与交付包
- 建议同时配置 `STORYFLOW_*_PROVIDER_NAME` 与 `STORYFLOW_*_PROVIDER_MODEL`，设置页、QA、生成工作台和运行诊断会直接显示供应商与模型
- `STORYFLOW_PROVIDER_AUTH_HEADER` / `STORYFLOW_PROVIDER_AUTH_SCHEME` / `STORYFLOW_PROVIDER_TIMEOUT_MS` 是共享默认值
- 若某个 Provider 需要独立鉴权或独立超时，可单独配置 `STORYFLOW_IMAGE_*` / `STORYFLOW_VOICE_*` / `STORYFLOW_VIDEO_*`
- `*_AUTH_SCHEME` 默认为 `Bearer`；若希望直接发送原始 key，可填 `raw`
- `STORYFLOW_LLM_TIMEOUT_MS` 默认 180000；各类 Provider 默认超时 300000，可按 Provider 单独覆盖

## 后续优先级

- 为真实图像 / 配音 / 视频 provider 配置生产 endpoint
- 继续补强 reference 分析能力
- 增加更细的项目版本管理与团队协作
- 为资产和时间线增加批量编辑体验
- 继续完善导出与发布模板
