# StoryFlow Studio — 开发任务总表（给 Codex 直接接手）

更新时间：2026-03-10 10:40（Asia/Shanghai）
项目路径：`/Users/hema/.openclaw/workspace/storyflow-studio`

---

> 2026-03-10 追加状态：P0-1 / P1-1 / P1-2 / P1-3 / P2-1 / P2-2 / P2-3 / P3-1 主体功能已落地；当前重点转为前端中文化、设置页运行时可视化、工程复验与 GitHub 发布闭环。

## 0. 项目目标

把 StoryFlow Studio 从原型推进成一个真正的「一句话生成影视作品」工作台。

目标主链：

`一句话 premise → Story Engine → Character → Visual Bible → Adaptation → Storyboard → Render → Exports`

当前要求：
- 后端字段 / 接口 / JSON key 一律英文
- 前端页面和用户可见文案一律中文
- 内容生成默认走 `gpt-5.4`
- 尽量不迁库，优先复用现有 Prisma 结构
- 优先做“可工作、可验证、可交付”，再做精修

---

## 1. 当前已完成（可视为已有基础）

### 1.1 主链功能
- Story Engine v0 已落地
  - synopsis
  - beat sheet
  - scene seeds
- Story Engine 已支持分层重生
  - `generate`
  - `generate-synopsis`
  - `generate-beats`
  - `generate-scenes`
- Character v1 已落地
  - 自动生成角色草案
  - 手动修订保存（覆盖保存）
- Visual Bible v1 已落地
  - 自动生成视觉圣经
  - 手动修订保存（覆盖保存）
- Adaptation 已稳定到
  - `5 scenes`
  - `20 shots`
- Storyboard 页面已存在
- Render 页面已存在
- Render exports 已存在
  - presets
  - provider payloads
  - production bundle

### 1.2 基础工作台模块
- Asset v0 已落地
  - 聚合角色 / 视觉圣经 / scene / reference 为资产卡
- Timeline v0 已落地
  - 基于 shot taxonomy 估算时长
  - 展示全片 / 分场 / 分镜头时间结构
- QA v0 已落地
  - 结构检查
  - taxonomy 检查
  - 角色命名检查
  - 视觉圣经检查
  - render job 检查
  - export 检查

### 1.3 稳定性与规则
- shot taxonomy 已抽到公共模块
  - `lib/shot-taxonomy.ts`
- Adaptation / Render / Storyboard / Render Studio 已接 taxonomy 统一逻辑
- sync service v0 已落地
  - `features/sync/service.ts`
- sync notice 已接到：
  - Adaptation 页面
  - Render 页面

---

## 2. 当前明确未完成 / 半完成

---

### P0-1. 补完上游三页的同步提醒卡（当前最直接未收尾项）

**状态：半完成**

#### 已完成
以下文件已经接入 `getSyncStatus(...)` 并取得 `syncStatus`：
- `components/story-setup-data.tsx`
- `components/character-studio-data.tsx`
- `components/visual-bible-data.tsx`

#### 未完成
还没有把同步提醒卡真正渲染到页面 JSX 中。

#### 目标
在这三页都补出类似 Adaptation / Render 的提醒卡：
- Story Setup：提醒“改故事会影响 Character / Visual / Adaptation / Render”
- Character Studio：提醒“角色已更新，建议刷新 Adaptation / Render”
- Visual Bible：提醒“视觉已更新，建议刷新 Render / 导出”

#### 建议做法
在每页主内容上方或说明卡后面，增加：
- `sync notice`
- 标题（如：当前链路基本同步 / 建议刷新下游）
- 文案来自 `syncStatus.notices.join(' / ')`

#### 涉及文件
- `components/story-setup-data.tsx`
- `components/character-studio-data.tsx`
- `components/visual-bible-data.tsx`
- 可复用：`features/sync/service.ts`

#### 验收标准
- 三页都能显示提醒卡
- 不报错
- 文案与 Adaptation / Render 页保持一致风格

---

### P0-2. 工程复验闭环

**状态：未完成**

#### 目标
补齐这一轮多次改动后的完整工程校验：
- `npm run typecheck`
- `npm run build`

#### 原因
最近连续改了：
- Story Engine
- Character
- Visual Bible
- Asset
- Timeline
- QA
- sync service
- 多个 page / component

但还没有一组新的完整校验结果。

#### 验收标准
- typecheck 通过
- build 通过
- 如果报错，逐项修完并记录原因

---

### P1-1. Character 锁定机制 v2

**状态：未开始（当前只有手动修订保存，没有锁定）**

#### 当前已有
- Character 自动生成
- Character 手动编辑
- Character 覆盖保存

#### 还缺
- 锁定角色名
- 锁定角色 role / archetype / goal / conflict
- 再生成时保护已锁定字段
- 局部重生某个角色

#### 建议方案（不迁库优先）
先把“锁定信息”写入同一份 `Character Drafts` 序列化文本里，例如增加：
- `LockedName: true`
- `LockedGoal: true`
- `LockedVisualAnchor: false`

或新增 Outline：
- `Character Locks`

#### 涉及文件
- `features/characters/service.ts`
- `components/character-editor.tsx`
- `components/character-studio-data.tsx`
- `app/api/characters/route.ts`

#### 验收标准
- 用户可锁定角色关键字段
- 再次 generate 时锁定字段不被覆盖
- 页面能看出哪些字段已锁定

---

### P1-2. Visual Bible 锁定 / 局部控制 v2

**状态：未开始（当前只有手动修订保存，没有锁定）**

#### 当前已有
- Visual Bible 自动生成
- Visual Bible 手动编辑
- Visual Bible 覆盖保存

#### 还缺
- 锁定 `palette`
- 锁定 `lighting`
- 锁定 `lensLanguage`
- 锁定 `motionLanguage`
- 局部重生某一块，而不是整份覆盖

#### 建议方案（不迁库优先）
和 Character 类似，先把锁定元信息写回同一份序列化文本，或单独用 Outline 记录。

#### 涉及文件
- `features/visual/service.ts`
- `components/visual-bible-editor.tsx`
- `components/visual-bible-data.tsx`
- `app/api/visual/route.ts`

#### 验收标准
- 可锁定视觉关键字段
- 再生成时锁定字段不被覆盖
- 页面能显示锁定状态

---

### P1-3. Sync notice 完整闭环 + QA 联动

**状态：v0 已有，未完整闭环**

#### 当前已有
- sync service
- Adaptation 提醒
- Render 提醒

#### 还缺
- Story / Character / Visual 提醒卡展示
- QA 中增加“是否存在下游过期状态”检查项
- 更清晰的影响说明：
  - Story 改了影响谁
  - Character 改了影响谁
  - Visual 改了影响谁

#### 涉及文件
- `features/sync/service.ts`
- `features/qa/service.ts`
- `components/qa-panel-data.tsx`
- 相关上游页面组件

#### 验收标准
- 全链页面都能看到同步提醒
- QA 能提示“链路过期”问题

---

### P2-1. Asset v1（从聚合浏览升级为可操作资产系统）

**状态：v0 已完成，v1 未开始**

#### 当前已有
- 资产聚合页
- 聚合角色 / 风格 / 场景 / reference 资产卡

#### 还缺
- 手动新增资产
- 资产分类更明确
  - character
  - scene
  - prop
  - style-board
  - reference-image
- 资产与 project / scene / shot / character 的关联
- 后续 Render 能消费资产信息

#### 建议方案（仍优先不迁库）
先继续复用 Outline 或 Reference 表，做一版“资产条目录入”，等 schema 稳定再迁库。

#### 涉及文件（建议新增）
- `features/assets/service.ts`（已存在，继续扩展）
- `components/assets-data.tsx`
- 新增：`components/asset-editor.tsx`
- 如需 API：`app/api/assets/route.ts`

#### 验收标准
- 可新增/保存资产条目
- 页面可显示资产来源和关联目标
- 资产不再只是自动聚合结果

---

### P2-2. Timeline v1（从估算视图升级为节奏工具）

**状态：v0 已完成，v1 未开始**

#### 当前已有
- 估算时长
- 场景时长
- 镜头时长
- 全片总时长

#### 还缺
- 情绪曲线
- 高潮点标记
- 节奏异常提示
- 手动修正 shot duration
- 关键场 / 缓冲场 / 冲突峰值标记

#### 涉及文件
- `features/timeline/service.ts`
- `components/timeline-data.tsx`
- `app/timeline/page.tsx`

#### 验收标准
- 不只是显示时间，还能指出节奏问题
- 支持人工微调时长（哪怕先用内存/文本保存）

---

### P2-3. QA v1（发布检查升级）

**状态：v0 已完成，v1 未开始**

#### 当前已有
- 结构检查
- taxonomy 检查
- 角色/视觉/render/export 检查
- 发布状态卡

#### 还缺
- 成熟度等级
  - 草稿可用
  - 内测可用
  - 可交付
- sync stale 检查纳入 QA
- 更明确的失败项分组
- 更明确的“阻断交付”项

#### 涉及文件
- `features/qa/service.ts`
- `components/qa-panel-data.tsx`
- `app/qa-panel/page.tsx`

#### 验收标准
- QA 能输出等级
- QA 能指出是否因过期链路而不可交付

---

### P3-1. 真正的 provider 深接 / render 执行链

**状态：未开始**

#### 当前已有
- render preset
- provider payload
- production bundle
- render jobs 占位

#### 还缺
- 真正 provider 调用
- 执行结果回写
- job 生命周期更完整
- 重试 / 失败状态管理

#### 涉及文件
- `features/render/service.ts`
- `app/api/render/route.ts`
- 可能新增 provider client

#### 验收标准
- 不只是导出 payload，而是真正能驱动执行

---

## 3. 推荐给 Codex 的执行顺序

### 第一阶段（先收尾当前半成品）
1. 补完 Story / Character / Visual 三页 sync notice 卡片
2. 跑 `npm run typecheck`
3. 跑 `npm run build`
4. 修掉这轮工程错误

### 第二阶段（补控制力）
5. Character 锁定机制 v2
6. Visual Bible 锁定机制 v2
7. sync + QA 联动

### 第三阶段（补工具化）
8. Asset v1
9. Timeline v1
10. QA v1

### 第四阶段（补执行链）
11. provider 深接 / render 执行链

---

## 4. 直接给 Codex 的任务提示词（可复制）

### 任务 A：补完上游三页同步提醒卡

```txt
Project: /Users/hema/.openclaw/workspace/storyflow-studio

Goal:
Finish the sync notice UI wiring for the upstream pages.

Context:
- sync status service already exists at features/sync/service.ts
- Adaptation and Render pages already render sync notice cards
- These files already import and await getSyncStatus(project.id), but do not render the card yet:
  - components/story-setup-data.tsx
  - components/character-studio-data.tsx
  - components/visual-bible-data.tsx

Requirements:
- Add visible sync notice cards to the 3 pages above
- Keep frontend copy fully Chinese
- Reuse the same tone/style as adaptation-data.tsx and render-studio-data.tsx
- Story page should explain that story changes may affect character / visual / adaptation / render
- Character page should explain that character changes may require refreshing adaptation / render
- Visual page should explain that visual changes may require refreshing render / exports
- Do not introduce DB migration

Validation:
- npm run typecheck
- npm run build

Deliverable:
- modified file list
- short summary of what changed
- any remaining issues
```

---

### 任务 B：Character 锁定机制 v2

```txt
Project: /Users/hema/.openclaw/workspace/storyflow-studio

Goal:
Implement Character lock mechanism v2 without DB migration.

Current state:
- Character v1 already supports generate + manual save
- API route exists at app/api/characters/route.ts
- service exists at features/characters/service.ts
- editor exists at components/character-editor.tsx

Requirements:
- Add lock support for key fields (at least name / role / goal / conflict)
- Locked fields must not be overwritten by regenerate
- UI should display lock state clearly in Chinese
- Preserve existing Character Drafts compatibility as much as possible
- No Prisma migration for this iteration

Validation:
- npm run typecheck
- npm run build

Deliverable:
- implementation summary
- affected files
- exact lock behavior
```

---

### 任务 C：Visual Bible 锁定机制 v2

```txt
Project: /Users/hema/.openclaw/workspace/storyflow-studio

Goal:
Implement Visual Bible lock mechanism v2 without DB migration.

Current state:
- Visual Bible v1 already supports generate + manual save
- API route exists at app/api/visual/route.ts
- service exists at features/visual/service.ts
- editor exists at components/visual-bible-editor.tsx

Requirements:
- Add lock support for palette / lighting / lensLanguage / motionLanguage
- Locked fields must be preserved across regenerate
- UI must be Chinese
- No DB migration for now

Validation:
- npm run typecheck
- npm run build

Deliverable:
- implementation summary
- affected files
- exact lock behavior
```

---

## 5. 当前明确风险 / 注意事项

1. 最近多轮开发后，新的 `typecheck/build` 还没有形成完整闭环，必须补。
2. 不要再继续空转在“syncStatus 已取到但 JSX 没插”的半完成态。
3. 优先保持“不迁库”，除非 Codex 判断某个功能做不干净，需要明确提出。
4. 如果要做锁定机制，先选“兼容当前序列化格式”的方案，不要直接大改 schema。
5. 所有前端文案保持中文；接口/键名保持英文。

---

## 6. 给开发者的真实现状一句话

当前项目已经完成了从一句话到导出的主链骨架，但仍有若干“半完成收尾项”和“控制力不足项”；下一步最值得做的是先收掉 sync notice 上游闭环，再补锁定机制和工程复验。
