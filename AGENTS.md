# Repository Guidelines

## 项目结构与模块组织

本项目是 Vue 3 + Vite + TypeScript 前端应用，源码位于 `src/`。

- `src/main.ts`：应用入口，注册 Vue、Pinia、Vue Router 和 Ant Design Vue。
- `src/router/`：路由配置。
- `src/stores/`：Pinia 状态管理，包含持久化用户状态。
- `src/api/`：按业务域拆分的接口封装，例如 `problem.ts`、`user.ts`、`live.ts`。
- `src/utils/`：通用工具，包括 Axios 请求封装和验证码逻辑。
- `src/views/`：路由页面，按 `login`、`chat`、`code`、`main` 等功能分组。
- `src/components/`：复用组件；`src/components/live/` 放直播相关组件。
- `src/assets/`：图片和 SVG 资源；`public/` 放静态文件；`dist/` 是构建产物，不要手动修改。

## 构建、测试与开发命令

使用 npm，并以仓库中的 `package-lock.json` 为准。

```bash
npm run dev
```
启动 Vite 开发服务。当前配置监听 `0.0.0.0`，端口为 `80`，并将 `/api` 代理到 `http://127.0.0.1:8088`。

```bash
npm run build
```
执行生产构建，输出到 `dist/`。

```bash
npm run preview
```
本地预览生产构建结果。

当前 `package.json` 未配置测试脚本。

## 代码风格与命名约定

优先使用 Vue 单文件组件和 `<script setup>`。新增代码优先使用 TypeScript。`src/` 内部导入使用 `@` 别名，例如 `@/utils/request`。

Vue、TypeScript、CSS、JSON 使用两个空格缩进。组件在导出或模板引用时使用 PascalCase。API 文件按业务域命名，例如 `statistic.ts`、`class.ts`、`live.ts`。

部分现有文件存在中文乱码。修改这些文件时避免无关重写，除非任务明确要求修复编码。

## 测试指南

当前未安装测试框架。若新增测试，建议使用 Vitest + Vue Test Utils。测试文件可就近放置，或放在 `src/__tests__/`，命名示例：`ComponentName.spec.ts`。

提交前至少运行：

```bash
npm run build
```

## 提交与 Pull Request 规范

由于当前用户未将仓库标记为 Git safe directory，无法读取提交历史。提交信息建议使用简洁祈使句，例如 `fix login redirect` 或 `add class detail loading state`。

PR 应包含变更摘要、影响模块、验证步骤；涉及界面变化时附截图或录屏；涉及接口契约变化时明确说明。

## 安全与配置提示

不要提交 `.env` 中的敏感信息。接口代理行为应与 `vite.config.ts` 保持一致。认证 token、指纹等请求头由 Axios 拦截器注入，修改相关逻辑时需要重点检查登录和接口调用流程。
