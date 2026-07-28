---
type: tasks
outputFor: [frontend, backend, qa, devops]
dependencies: [prd, tech-review]
lastUpdated: 2026-07-28
---

# 个人开发工作台重构：实施状态

## 范围与约束

- 产品定位：单人自用的开发工作台。
- 本轮允许：前端重构、本地数据层、只读 Supabase 集成、安全与质量配置、文档。
- 本轮禁止：生产部署、Supabase 写入验证、SQL、migration、RLS 变更及不可逆数据操作。
- 默认保护：`VITE_ENABLE_NAV_V2_WRITE=false`，`VITE_ALLOW_SIGN_UP=false`。
- 交付口径：代码完成不等于生产发布完成；目标 Supabase 与 Cloudflare 的验证必须有独立证据。

## 任务状态

| ID | 任务 | 状态 | 当前证据/结果 |
| --- | --- | --- | --- |
| T-001 | 测试与工程脚手架 | 已完成 | Vitest、jsdom、Testing Library、coverage、Oxlint 和 Node 22 已配置 |
| T-002 | Workspace 领域模型与 v1 适配 | 已完成 | `NavConfigV2`、稳定 UUID、旧数组解析、规范化与序列化均有单元测试 |
| T-003 | 工具注册表与搜索评分 | 已完成 | 13 个工具由单一 registry 驱动，支持别名、分类、收藏和最近加权 |
| T-004 | Workspace Context 与本地存储 | 已完成 | IndexedDB 草稿、偏好、冲突备份、本地优先提交和失败恢复已实现 |
| T-005 | App Shell 与响应式导航 | 已完成 | 桌面侧栏、移动端入口、同步状态、登录用户操作已整合 |
| T-006 | Dashboard 与 Command Palette | 已完成 | 首页收藏/最近/分组、`Ctrl/Cmd+K`、键盘选择、焦点生命周期和响应式布局已通过自动化及浏览器验收 |
| T-007 | 路由与懒加载 | 已完成 | Dashboard、Navigation 和工具页按路由加载，包含认证门禁、404 与错误边界 |
| T-008 | Supabase repository 与公开配置 | 已完成（代码） | 环境变量校验、v1/v2 读取、结构化错误、single-flight 和 CAS 写入路径已实现；生产契约未验证 |
| T-009 | Navigation CRUD、排序和撤销 | 已完成 | 分类/网站增删改、拖拽排序、跨分类移动、移动端替代操作、自定义 Dialog 和 7 秒撤销已实现 |
| T-010 | 同步状态、重试与冲突处理 | 已完成（writer 关闭） | 本地优先、重试、冲突备份与本地/远端选择已实现；默认构建不会远端写入 |
| T-011 | 统一工具壳与安全改造 | 已完成 | 复制/清空/示例/反馈统一；Web Crypto 随机数、RSA/HMAC；JWT 明示不验签；移除 Monaco/CDN/Google Fonts |
| T-012 | Cloudflare 与最终交付 | 仓库交付已完成，生产验证阻塞 | CI 已改用固定提交的 Wrangler Action v4，并执行 coverage 门禁；`wrangler.jsonc`、Pages 原生 SPA fallback、`_headers`、分包和 README 已配置。本地 Wrangler 验收通过，真实 Pages 与生产 Supabase 验收仍未执行 |

## 最终质量门禁

交付前应在没有并行代码写入的稳定工作树上依次执行：

```bash
npm run lint
npm test -- --run
npm run coverage
npm run build
npm audit --omit=dev
git diff --check
```

2026-07-28 稳定工作树的最终结果：

- `npm run lint`：通过，0 warning、0 error。
- `npm test -- --run`：25 个测试文件、276 项测试全部通过。
- `npm run coverage`：statements 82.63%、branches 76.01%、functions 85.11%、lines 85.01%，全源码阈值通过。
- `npm run build`：Node 24.14 本地通过；CI 固定 Node 22；入口脚本约 79.01 kB raw / 26.11 kB gzip。
- `npm audit --omit=dev --audit-level=critical`：通过；普通生产依赖审计仍有 2 个 React Router RSC high、0 critical，适用性见技术评审。
- `git diff --check`：通过。
- Wrangler 4.114 本地 Pages 冒烟：主页、导航、工具深链及未知路由均为同一 SPA 200；CSP、安全头、HTML 禁缓存和哈希资源 immutable 均生效。

浏览器验收至少覆盖：

- 登录、退出、受保护路由和安全的 `returnTo`。
- 命令面板搜索、键盘选择、Esc 关闭、焦点恢复及输入框快捷键避让。
- 导航分类与网站的新增、编辑、删除、排序、跨分类移动和 7 秒撤销。
- IndexedDB 恢复、离线状态、重试和 writer 关闭提示。
- Data、Security、Encode、JSON、Docker、Diff 等高风险/高频工具。
- 360px、768px 和桌面宽度，无意外横向滚动。
- 干净浏览器会话中无未解释的 console error 和意外第三方请求。

## 生产发布门禁

以下项目仍是阻塞项，不能因本地 build/test 通过而关闭：

- [ ] 确认 `user_nav_configs.user_id` 为 UUID，且每用户至多一行并有唯一约束。
- [ ] 确认 `nav_data` 的实际类型可安全保存 V2 JSON 文档。
- [ ] 确认 `updated_at` 非空、可解析，并能可靠承担 CAS 版本令牌。
- [ ] 确认外键行为与账号删除策略符合预期。
- [ ] 在非生产项目验证 owner SELECT/INSERT/UPDATE，以及匿名和用户 A/B 跨用户拒绝。
- [ ] 备份真实数据，并验证旧数据读取、V2 写入、冲突与回滚。
- [ ] 在 Supabase 后台关闭公开注册；不能只依赖 `VITE_ALLOW_SIGN_UP=false`。
- [ ] 在真实 Cloudflare Pages 域名验证 SPA 深链、CSP、安全头、缓存和网络请求。
- [ ] 经过独立评审后，再以单独变更考虑开启 `VITE_ENABLE_NAV_V2_WRITE=true`。

## 已知非阻塞跟踪项

- `npm audit --omit=dev` 当前仍报告 React Router 的 2 个 high 条目。公告针对 RSC Mode；本项目使用 BrowserRouter SPA，未启用 RSC action 路径，但仍需跟踪上游修复，不能宣称依赖零风险。
- IndexedDB 不加密，适合个人工作区草稿，不适合长期保存生产密钥。
- 外部导航图标会产生到图片来源域名的请求；这与“工具输入本地处理”是不同边界。

## Stop Conditions

- 任一 lint、test、coverage 或 build 门禁失败时，不进入生产部署。
- 远端同步可能覆盖较新的本地数据、CAS 失效或冲突备份失败时，writer 保持关闭。
- 没有 schema/RLS 双用户证据时，不执行 SQL，不修改 RLS，不开启生产写入。
- Supabase 后台仍允许公开注册时，不把站点视为私人访问环境。
- Cloudflare 真实域名未验证时，只能声明“仓库配置完成”，不能声明“部署验收通过”。
