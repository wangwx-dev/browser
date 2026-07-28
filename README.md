# Dev Workbench

一个面向个人使用的开发工作台：把常用网站导航、收藏、最近使用和日常开发工具集中到一个响应式 Web 应用中。前端部署在 Cloudflare Pages，认证和导航数据读取由 Supabase 提供。

> 当前仓库完成的是代码重构与本地质量建设，不代表已经验证生产 Supabase、生产 RLS 或 Cloudflare 线上部署。导航远端写入和公开注册默认关闭。

## 主要功能

- 工作台首页：展示收藏、最近使用、导航分组和常用工具。
- 命令面板：使用 `Ctrl/Cmd + K` 搜索网站、工具和命令，支持键盘选择与焦点恢复。
- 导航管理：新增、编辑、删除分类与网站，拖拽排序、跨分类移动，并提供移动端按钮操作和 7 秒撤销。
- 本地优先：登录后先从 IndexedDB 恢复个人草稿；网络失败不会丢弃当前本地修改。
- 同步反馈：展示只读、待同步、同步中、离线、失败和冲突等状态；启用远端 writer 后支持重试和冲突取舍。
- 响应式界面：桌面侧栏、移动端导航和适配窄屏的工具布局。
- 13 个内置工具：网络/IP、证书与 RSA、SQL/进制转换、JSON/YAML、Docker Compose、文本处理、Diff、URL/Base64/JWT、Cron/时间戳、Mock 数据/UUID、Hash/Bcrypt、命令备忘录、二维码/多媒体。

安全相关工具尽量在浏览器本地完成计算。随机密码、RSA 和 HMAC 使用 Web Crypto；JWT 页面只解码 Header/Payload，**不验签，也不证明 Token 可信或有效**。

## 技术架构

| 层次 | 实现 |
| --- | --- |
| UI 与路由 | React 19、TypeScript、React Router、Vite 8；页面与工具按路由懒加载 |
| 领域逻辑 | 强类型 `NavConfigV2`、旧导航数据适配、搜索评分、导航变更与冲突状态 |
| 本地持久化 | IndexedDB 数据库 `dev-workbench`，保存工作区草稿、UI 偏好和冲突备份 |
| 远端服务 | Supabase Auth 与 `user_nav_configs`；读取默认可用，写入受独立开关保护 |
| 托管 | Cloudflare Pages 静态站点；无顶层 `404.html` 时使用 Pages 原生 SPA fallback，`public/_headers` 提供 CSP 与安全响应头，`wrangler.jsonc` 固定本地/CI 兼容日期 |
| 质量门禁 | Oxlint、Vitest、Testing Library、TypeScript 构建、生产依赖审计 |

应用没有自建服务端代理。浏览器只应持有 Supabase 的公开 anon/publishable key，绝不能放入 `service_role` 或 `sb_secret_...` 密钥。

## 环境要求

- Node.js 22（仓库包含 `.nvmrc`，`package.json` 要求 `>=22`）
- npm
- 一个已配置的 Supabase 项目

复制示例配置：

```bash
cp .env.example .env.local
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env.local
```

环境变量均由 Vite 在构建时写入浏览器 bundle，因此必须视为公开配置。

| 变量 | 必需 | 默认/建议 | 说明 |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | 是 | 无 | Supabase 项目的 HTTPS URL，不接受占位地址 |
| `VITE_SUPABASE_ANON_KEY` | 是 | 无 | 浏览器公开 anon/publishable key；代码也兼容 `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `VITE_ALLOW_SIGN_UP` | 否 | `false` | 只有精确设置为 `true` 才显示注册入口 |
| `VITE_ENABLE_NAV_V2_WRITE` | 否 | `false` | 只有精确设置为 `true` 才允许向 Supabase 写导航文档 |

`.env` 和 `.env.*` 已被 Git 忽略（仅 `.env.example` 例外）。不要提交真实项目配置，更不要提交任何 Supabase secret/service-role key。

## 本地开发

```bash
git clone https://github.com/wangwx-dev/browser.git
cd browser
npm ci
npm run dev
```

常用命令：

```bash
npm run lint
npm test -- --run
npm run coverage
npm run build
npm run preview
npm audit --omit=dev
```

`npm run coverage` 会统计 `src` 下全部可执行生产代码，并要求 statements 80%、branches 75%、functions 80%、lines 80%。CI 会直接执行这项覆盖率门禁，而不是只跑无覆盖率的测试。提交或部署前至少应通过 lint、全量测试和生产构建，并审阅依赖审计结果；不要用 `--force` 盲目降级或升级依赖。

## Supabase 前置条件

仓库不包含、也不会自动执行 SQL、migration 或 RLS 变更。启用生产环境前，需要由项目维护者在非生产副本中核验以下契约：

| 字段/能力 | 客户端假设 |
| --- | --- |
| `user_nav_configs.user_id` | UUID；每个用户至多一行，并有可靠的唯一约束；如使用外键，应指向正确的认证用户 |
| `user_nav_configs.nav_data` | 可存 JSON/JSONB；读取兼容旧数组和 V2 文档，启用 writer 后写回 V2 文档 |
| `user_nav_configs.updated_at` | 非空、可解析的时间版本；条件更新依赖 `user_id + updated_at` 做 CAS 冲突检测 |
| RLS | 已登录用户只能 SELECT/INSERT/UPDATE 自己的行；匿名访问和跨用户访问必须失败 |

正式开启 writer 前，至少要完成：

1. 在非生产 Supabase 上确认字段类型、唯一约束、外键和 `updated_at` 行为。
2. 用匿名、用户 A、用户 B 验证 RLS，保留读取、插入、更新和跨用户拒绝的证据。
3. 验证旧 `nav_data` 可读取，V2 写入、重复提交、并发冲突和恢复路径符合预期。
4. 备份现有数据并制定回滚方案。
5. 通过评审后，才在目标构建中将 `VITE_ENABLE_NAV_V2_WRITE` 改为 `true`。

当前 GitHub Actions 工作流把 `VITE_ENABLE_NAV_V2_WRITE` 固定为 `false`，因此仅修改 Cloudflare/GitHub 变量不会开启生产写入。这个保护应在上述证据齐备后通过一次独立、可审查的代码变更解除。

### 私人站点的注册设置

`VITE_ALLOW_SIGN_UP=false` 只隐藏前端注册入口，**不是安全边界**。自用部署还必须在 Supabase Dashboard 的 Auth 设置中关闭公开注册，并确认只保留自己的账号。若 Supabase 后台仍允许注册，隐藏按钮不能阻止他人直接调用公开认证 API。

## Cloudflare Pages 部署

仓库已提供 `.github/workflows/cloudflare-pages.yml`：Pull Request 运行质量门禁，推送到 `main` 在门禁通过后构建并部署 `dist`。默认 Pages 项目名为 `browser-navigation`；若实际项目名不同，应先修改工作流中的 `--project-name`。

在 GitHub 仓库配置：

- Repository variables：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
- Repository secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
- 可选但建议：为 `production` environment 配置保护规则

Cloudflare API Token 只授予部署该 Pages 项目所需的最小权限。工作流使用 Node 22 和 Wrangler，将 `dist` 发布到 `main` 分支对应的生产环境。

首次上线和每次安全头变更后，仍需在真实 Pages 域名验证：

- `/navigation`、`/tools/json` 等深链刷新能返回 SPA，而不是 404。
- `_headers` 中的 CSP、安全响应头和缓存策略实际生效。
- 浏览器只连接预期的 Supabase 域名，没有意外 CDN、字体或工具输入上传请求。
- 登录、退出、离线恢复和窄屏布局正常。

本仓库当前不声称这些生产验证已经完成。

## 隐私与安全边界

- 工具输入和计算默认留在当前浏览器；认证和工作区远端读取会连接配置的 Supabase。
- IndexedDB 是本地持久化，不是加密保险箱。同一浏览器配置文件、设备管理员或恶意扩展可能访问其中的数据，不要长期保存生产密钥或高敏感内容。
- 导航中的外部图标可能向其图片域名发起请求；打开网站会离开本站，并受目标站点隐私策略约束。
- RSA 私钥、HMAC 密钥、JWT 和证书内容仍可能因剪贴板、截图、浏览器扩展或设备泄露而暴露；用完应清空。
- JWT 工具不验签；Hash、编码和格式转换也不等于加密或安全存储。
- CSP 和响应头降低常见 Web 风险，但不能替代 Supabase RLS、最小权限、账号安全和依赖更新。

## 当前发布阻塞

在以下证据齐备前，不应开启远端 writer 或宣称生产可发布：

- `user_id` 唯一约束、字段类型、外键和 `updated_at` 行为尚未从目标 Supabase 得到证据。
- RLS 的匿名拒绝和双用户隔离尚未在目标 Supabase 验证。
- Supabase 后台是否已关闭公开注册尚未验证。
- Cloudflare Pages 的生产部署、深链和响应头尚未在真实域名验证。

更详细的实施状态与发布门禁见 `.boss/dev-workbench-refactor/tasks.md` 和 `.boss/dev-workbench-refactor/tech-review.md`。
