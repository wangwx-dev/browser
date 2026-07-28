---
type: tech-review
outputFor: [scrum-master, frontend, backend, qa, devops]
dependencies: [prd, architecture, ui-spec, ui-design]
lastUpdated: 2026-07-28
---

# 技术评审与发布就绪度

## 结论

**代码重构有条件通过，生产发布尚未通过。**

客户端架构、导航领域模型、本地优先存储、同步状态、安全工具和 Cloudflare 配置已经落地，原先“无测试、单包过大、环境变量硬编码、原生 prompt/confirm、Monaco/CDN 依赖”等事实已经过时。当前可以继续做本地与受控环境验收，但不能声称目标 Supabase 的 schema/RLS 或 Cloudflare 生产部署已经验证。

## 当前实现事实

| 维度 | 当前事实 | 评审 |
| --- | --- | --- |
| 技术栈 | React 19、TypeScript 6、Vite 8、React Router BrowserRouter SPA | 通过 |
| 页面加载 | Dashboard、Navigation 和 13 个工具页懒加载；framework 与 Supabase 独立分组 | 通过 |
| 工具编辑器 | 使用仓库内轻量 `CodeEditor` 与本地行级 Diff，不再加载 Monaco/CDN | 通过 |
| 数据模型 | 强类型 `NavConfigV2`，稳定 UUID，兼容旧数组，解析与变更逻辑独立于 UI | 通过 |
| 本地可靠性 | IndexedDB 保存草稿、偏好和冲突备份；本地提交先于远端同步 | 通过（客户端） |
| 远端并发 | single-flight、串行保存、`user_id + updated_at` 条件更新、显式冲突决策 | 有条件通过；依赖真实 schema 契约 |
| 认证 | Supabase Auth；前端默认只显示登录，注册开关默认关闭 | 有条件通过；后台注册策略未验证 |
| 远端写入 | repository 写路径已实现，但 `.env.example` 与 CI 均默认 `false` | 符合当前安全策略 |
| 测试 | 25 个文件、276 项领域/服务/Context/组件/页面测试全部通过；全源码 coverage 阈值通过 | 通过 |
| Cloudflare | Wrangler Actions、SPA fallback、CSP/安全头、静态缓存规则已配置 | 待真实 Pages 域名验证 |
| 外部请求 | 工具注册表均标记 local-only；应用仍会连接 Supabase，并可能加载用户配置的外部图标 | 边界清晰，需线上网络复核 |

## 已落实的关键决策

1. 工作区页面不直接操作 Supabase 数据表；导航远端访问集中在 workspace repository/gateway，认证调用保留在 Auth 边界。
2. 旧 `nav_data` 数组只做兼容读取和稳定适配，领域层统一使用 V2 文档。
3. 用户修改先持久化到 IndexedDB，再进入可重试的远端队列；失败保留本地版本。
4. 远端更新以 `updated_at` 为版本令牌；版本不匹配进入冲突流程，不静默覆盖。
5. 工具、路由、侧栏、Dashboard 和命令面板复用同一 registry。
6. 工具页统一复制、清空、示例、成功/失败反馈和无障碍语义。
7. 随机密码、RSA 与 HMAC 使用 Web Crypto；JWT 只解码不验签。
8. Supabase 只接受构建时公开 URL/key；secret/service-role key 会被客户端配置校验拒绝。
9. Cloudflare CI 使用 Node 22，执行 lint、全源码 coverage 门禁、生产依赖审计和 build 后才部署 `main`；Wrangler Action 固定到已审阅的 v4.0.0 提交。
10. writer 与注册入口采用独立的显式 `=== 'true'` 开关，默认关闭。

## 未解决风险

### P0：Supabase 数据与访问控制证据缺失

仓库只能证明客户端假设，无法证明目标项目实际满足：

- `user_id` 唯一且每用户至多一行。
- `nav_data` 类型和容量适合 V2 文档。
- `updated_at` 非空、单调且不会被触发器以意外方式改写。
- 外键、删除级联和账号生命周期符合预期。
- RLS 对 owner 的 SELECT/INSERT/UPDATE 正确，同时拒绝匿名与跨用户访问。

影响：`.maybeSingle()`、首次 insert 的唯一冲突处理和 CAS 都依赖这些条件。证据缺失时必须保持 writer 关闭。

### P0：隐藏注册不是访问控制

`VITE_ALLOW_SIGN_UP=false` 只移除 UI 入口。攻击者仍可直接调用 Supabase Auth 的公开接口，因此私人站点必须在 Supabase Dashboard 后台关闭公开注册，并核对现有账号。

### P1：本地存储不是加密存储

IndexedDB 草稿按用户 ID 分区，但未进行静态加密。设备用户、浏览器扩展或同一浏览器配置文件中的恶意代码可能读取数据。不得把导航工作区当作密码库或密钥保险箱。

### P1：线上托管行为未验证

Wrangler 本地 Pages 验收已验证原生 SPA fallback 与 `_headers` 配置；真实 Cloudflare Pages 响应仍是证明生产深链、CSP、缓存和安全头生效的必要证据。当前没有生产部署或真实域名验收证据。

### P1：依赖审计仍有高危条目

2026-07-28 的 `npm audit --omit=dev` 报告 2 个 high、0 个 critical，均由 React Router 的 RSC Mode 公告链路产生。本项目当前是 BrowserRouter SPA，未启用 RSC action 模式，因此公告所述路径在当前架构中不可达；这不是“零风险”结论，仍应跟踪兼容修复并在升级后回归路由与认证。

### P2：外部图片与剪贴板边界

工具输入默认本地处理，但导航图标可以引用外部 HTTPS 图片，打开网站也会离开本站；复制私钥、JWT 或其他结果会把数据放入系统剪贴板。产品文案与验收不能把这些行为描述为绝对离线或绝对私密。

## 发布前验证矩阵

| 门禁 | 方法 | 通过标准 | 当前状态 |
| --- | --- | --- | --- |
| 静态质量 | `npm run lint` | 0 warning、0 error | 通过 |
| 单元/组件测试 | `npm test -- --run` | 全部通过，无随机失败 | 25 文件、276 项通过 |
| 覆盖率 | `npm run coverage` | statements/functions/lines 80%，branches 75% | 82.63% / 76.01% / 85.11% / 85.01%，通过 |
| 构建 | `npm run build` | Node 22+ 下成功，无意外大首屏回归 | Node 24.14 通过；CI 固定 Node 22；入口 26.11 kB gzip |
| 依赖审计 | `npm audit --omit=dev` | 无 critical；所有剩余项有适用性说明和跟踪计划 | 2 high 已记录，0 critical |
| 浏览器验收 | 干净会话 + 桌面/平板/360px | 核心流程通过，无横向溢出和未解释 console error | 通过；最终 console 0 error / 0 warning |
| Supabase schema | 非生产项目检查 | 字段、唯一约束、外键、时间版本符合契约 | 未验证，阻塞 |
| Supabase RLS | 匿名 + 用户 A/B 测试 | owner 可用，匿名和跨用户均拒绝 | 未验证，阻塞 |
| Cloudflare | Wrangler/真实 Pages 域名 | 深链、头部、CSP、缓存和网络边界符合预期 | Wrangler 本地通过；真实 Pages 域名未验证，仍阻塞生产发布 |
| 注册策略 | Supabase Dashboard + 直接 API 负向测试 | 公开注册关闭 | 未验证，阻塞 |

## 开启 writer 的必要条件

必须全部满足后，才能提交一个独立变更把 `VITE_ENABLE_NAV_V2_WRITE` 设为 `true`：

1. 非生产 Supabase 的 schema、唯一约束、外键和 `updated_at` 证据已归档。
2. 匿名、用户 A/B 的 RLS 读写隔离测试全部通过。
3. 旧数据兼容、首次写入、连续写入、并发冲突、离线重试和冲突恢复通过。
4. 现有生产数据已有可恢复备份和明确回滚方案。
5. 最终 lint、test、coverage、build 与浏览器验收通过。
6. Cloudflare 预览环境验证通过，且变更经过人工评审。

任何条件缺失都应保持 writer 关闭；本轮不执行 SQL、migration、RLS 修改或生产写入。

## 最终意见

当前成果可作为“代码重构完成、发布验证待办”的候选版本。它解决了客户端结构、交互、安全提示、本地可靠性和构建交付的大部分问题，但生产可信度仍取决于 Supabase 与 Cloudflare 的外部证据。最终交付说明必须保留这些阻塞，不能把本地测试通过等同于生产数据隔离或线上部署通过。
