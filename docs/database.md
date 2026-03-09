# Database Guide

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

默认使用本地 PostgreSQL：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/storyflow_studio?schema=public"
```

## Prisma 初始化

生成 Prisma Client：

```bash
npx prisma generate
```

创建第一版迁移：

```bash
npx prisma migrate dev --name init
```

打开 Prisma Studio：

```bash
npx prisma studio
```

## 当前模型说明

当前 schema 先覆盖最核心链路：
- Project
- IdeaSeed
- Outline
- Chapter
- Scene
- Shot
- ReferenceAsset
- RenderJob

后续可继续扩展：
- Character
- Faction
- StoryboardFrame
- VoiceProfile
- PromptTemplate
- WorkflowRun
