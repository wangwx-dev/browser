## 摘要

- 默认分支和当前分支均为 `main`，初始业务代码干净；当前仅 `.boss/` 规划产物未跟踪。
- 项目是 npm 管理的 React/Vite 单页应用，只有 `build` 和 `lint` 脚本，尚无自动化测试或 CI。
- Supabase 真实 schema、RLS 策略和迁移记录不在仓库内，任何数据库变更都必须视为高风险并单独确认。
- Cloudflare Pages 配置文件缺失；仅存在 Pages Function 代理，前端当前仍直接连接硬编码的 Supabase URL。
- 现有导航数据为无 ID 的嵌套 JSON，跨分类拖拽与并发保存存在覆盖和索引错配风险。

# Repo Preflight

## Git

- 远程：`origin https://github.com/wangwx-dev/browser.git`
- 远程默认分支：`origin/main`
- 当前分支：`main`
- 初始未提交业务变更：无；流水线创建后 `.boss/` 为未跟踪文件。

## CI/CD 与部署

- 未发现 `.github/workflows/`、`.gitlab-ci.yml`、`.circleci/config.yml`、`wrangler.toml`、`vercel.json` 或 `netlify.toml`。
- 用户明确说明部署于 Cloudflare；仓库存在 `functions/api/supabase/[[path]].ts`，符合 Cloudflare Pages Functions 目录约定。
- 未发现 SPA fallback 配置；生产环境深层路由刷新行为需验证。
- Cloudflare 项目名、生产 URL、构建命令和环境变量配置：`unknown`，已检查仓库根目录与部署配置标志文件。

## 包管理、脚本与运行环境

- Node.js：`v20.19.0`，满足 Vite 8 的最低要求。
- npm：`10.8.2`；锁文件：`package-lock.json` v3。
- 安装命令：`npm ci`。
- 构建：`npm run build` → `tsc -b && vite build`。
- Lint：`npm run lint` → `oxlint`。
- `test`、`typecheck`、`e2e`、`coverage` 脚本均不存在。
- `node_modules` 当前不存在；尚未执行依赖安装。

## 测试与自动化

- 单元测试：未配置。
- 组件/集成测试：未配置。
- E2E：未配置。
- 锁文件存在 `puppeteer-core`（业务依赖）但没有测试入口，不能视为 E2E 框架。
- 基线质量只能在安装依赖后通过 build/lint 建立；新增核心交互应补充测试框架与可重复脚本。

## 契约与数据

- 唯一可确认的 Supabase 表：`user_nav_configs`。
- 可确认字段：`user_id`、`nav_data`、`updated_at`；来自 `src/pages/Navigation.tsx` 的 select/upsert。
- `nav_data` 当前契约：分类数组，每项包含 `category` 和 `links`；链接包含 `name`、`url`、`desc`、`icon`。
- schema 类型、唯一约束、外键、RLS 策略、行级访问隔离、分页限制：`unknown`；仓库无 SQL、migration、生成类型或 Supabase 配置。
- 当前代码假设 `user_id` 可 `onConflict` 且每个用户恰有一行，但数据库证据缺失。

## 业务常量与状态

- 导航同步状态：`idle | syncing | success | error`。
- 初始导航：3 个分类、8 个默认网站，来自 `src/data.json`。
- 工具目录：13 个工具页，静态定义在 `src/components/Sidebar.tsx` 和 `src/main.tsx`。
- 登录方式：邮箱/密码；密码输入最小长度 6。
- 链接元数据通过第三方 `https://api.microlink.io` 获取；图标回退使用 Google favicon 与 ui-avatars，存在隐私、可用性和 CSP 依赖。
- 多个敏感开发工具在浏览器本地计算；产品必须明确哪些输入会访问第三方服务。

## 访问控制与安全入口

- 路由层只有导航首页在页面内部检查用户；所有工具页在 `App` 下可公开访问。
- Supabase URL 与 publishable/anon key 存在源码硬编码回退；环境变量配置检测实际无法发现错误 URL，因为固定 URL 总是被采用。
- Auth 初始化缺少错误状态与超时处理。
- Pages Function 代理会转发调用方大部分请求头，目标 host 固定；前端当前没有使用该代理。
- RLS 是否确保用户只能访问自己的配置：`unknown`，不能以客户端 `.eq('user_id', user.id)` 代替数据库访问控制证据。

## 路由、迁移与高风险事项

- 路由使用 BrowserRouter；未配置 not-found 路由或 Cloudflare SPA fallback。
- 当前数据为嵌套 JSON 且链接以 URL 充当拖拽 ID；重复 URL、分类重名、搜索过滤后的索引会导致错误操作风险。
- Supabase 新表、字段、RLS、回填、删除或 JSON 结构升级均属于高 Blast Radius；必须提供 SQL、向后兼容/回滚方案并取得用户确认。
- 第一 Evidence Wave 应避免破坏性数据库变更，优先通过兼容旧 `nav_data` 的客户端适配层实现新体验。
