# Development Guide

## 当前状态

项目已经具备：
- Next.js 15 + React 19 + TypeScript
- App Router 工作台骨架
- 基础页面与导航
- Prisma 初版 schema
- feature-based 模块占位

## 推荐开发顺序

1. `Idea Lab`：完成项目创建表单与初始输入收集
2. `Story Setup`：接世界观 / 角色 / 大纲卡片
3. `Chapter Studio`：接章节编辑与 mock 输出
4. `Adaptation Lab`：把章节 mock 转成 scene / shot 列表
5. `Reference Lab`：接参考图分析结果面板

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npx prisma generate
npx prisma migrate dev --name init
```
