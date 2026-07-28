---
type: architecture
outputFor: [tech-lead, scrum-master, frontend, backend, devops]
dependencies: [prd]
---

# 系统架构文档：个人开发工作台重构

## 摘要

- **架构模式**：保留 React 19 + Vite 8 模块化 SPA、React Router、Supabase 和 Cloudflare Pages，不引入独立业务后端或技术栈重写。
- **核心边界**：页面只调用用例与仓储端口；Supabase、IndexedDB、同步、搜索和工具懒加载均由独立适配层承担，组件禁止散落直查数据库。
- **数据决策**：以稳定 UUID 和强类型 NavConfigV2 替代弱类型数组，双读 v1/v2、分阶段启用 v2 写入；收藏与最近使用随版本文档同步。
- **可靠性决策**：修改先乐观更新并写用户隔离的 IndexedDB 草稿，再经单飞队列、条件更新和指数退避同步；冲突必须由用户选择。
- **发布门禁**：生产 schema/RLS 未知，第一阶段不做数据库迁移；RLS 双用户隔离、Cloudflare 深链、环境变量、错误边界和自动化测试全部通过后才发布。

## 文档信息

- 功能名称：个人开发工作台重构
- 版本：1.0
- 创建日期：2026-07-24
- 作者：Architect Agent
- 范围：PRD P0；P1/P2 仅保留扩展点

---

## 1. 技术调研与选型

### 1.1 已确认事实

- 工程为单仓库 React 19.2、React Router 7.18、Vite 8.1、TypeScript 6 SPA。
- 远端使用 Supabase Auth/Postgres；仓库只证明 user_nav_configs 的 user_id、nav_data、updated_at 三个字段。
- Navigation.tsx 以 any[] 整包 upsert，并以 URL、分类名和数组索引承担身份或操作定位。

### 1.2 三种总体方案

| 方案 | 做法 | 优点 | 缺点/风险 | 结论 |
|------|------|------|-----------|------|
| A. 现有 SPA 内部分层 | 增加领域模型、仓储端口、IndexedDB 草稿和同步状态机 | 可渐进交付、无需迁移、复用现有栈 | 整包 JSON 并发能力仍受现表限制 | **采用** |
| B. 查询缓存框架主导 | 引入 TanStack Query/Zustand 等管理远端缓存和全局状态 | 常规缓存成熟 | 仍不能自动解决离线草稿、整包冲突和 v1 迁移，新增依赖 | 暂不采用 |
| C. 服务端规范化 | 分类、网站、收藏、最近拆表并增加 RPC/Edge Function | 约束和细粒度并发最佳 | schema/RLS 未知，迁移爆炸半径高 | **后续可选，须单独确认** |

### 1.3 本地持久化比较

| 方案 | 事务/容量 | 主线程 | 依赖 | 决策 |
|------|-----------|--------|------|------|
| localStorage | 无事务、容量有限 | 同步 | 无 | 不用于可靠草稿 |
| 原生 IndexedDB | 事务、结构化数据 | 异步 | 无 | **采用** |
| Dexie | IndexedDB 封装、易用 | 异步 | 新增 | 复杂度失控时复评 |

### 1.4 结论

- 不改为 SSR、Next.js 或微服务；这是登录后的个人工具 SPA，SEO 与服务拆分没有收益。
- 不先引入通用状态库；使用不可变 reducer、窄 Context、领域服务和可替换仓储。
- 搜索采用确定性轻量评分器，不引入 Fuse.js/MiniSearch；约 600 条目标可在主线程满足指标。
- 实体使用 crypto.randomUUID() 一次生成并持久化，永不从可变 URL、名称或索引推导。
- 实施时以 React 懒加载、MDN IndexedDB/randomUUID、Supabase RLS/PostgREST 和 Cloudflare Pages 重写的官方文档为准，并在锁定版本的预览环境复验。

---

## 2. 架构概述

### 2.1 架构类型

采用“模块化前端单体 + 托管 BaaS”：

- Cloudflare Pages 提供静态托管、CDN、SPA 回退和可选受限代理。
- React 负责表现层、应用用例和本地优先同步编排。
- Supabase Auth 负责会话，Postgres/RLS 是远端个人数据安全边界。
- IndexedDB 是待同步草稿与恢复层，不是新的云端权威库。

### 2.2 系统架构图

~~~mermaid
flowchart TB
    U["已认证用户"] --> S["AppShell / AuthGate / ErrorBoundary"]
    S --> H["首页与导航 UI"]
    S --> C["命令面板"]
    S --> T["统一工具壳"]
    H --> A["工作区用例 / WorkspaceStore"]
    C --> I["统一命令索引"]
    T --> R["工具注册表 / 懒加载"]
    A --> D["NavConfigV2 / reducer / 同步状态机"]
    D --> L["LocalDraftRepository"]
    D --> W["WorkspaceRepository"]
    L --> IDB[("IndexedDB")]
    W --> SDK["Supabase JS"]
    SDK --> AUTH["Supabase Auth"]
    SDK --> DB[("user_nav_configs + RLS")]
    CF["Cloudflare Pages"] --> S
    P["可选受限 Pages Function"] -.-> SDK
~~~

### 2.3 设计原则

1. 先部署双读，再开启 v2 写；回滚版本必须能读取线上数据。
2. 修改先入内存并尽快落本地，远端失败不回滚用户刚完成的操作。
3. 单行 JSON 的排序、删除冲突不自动合并，避免静默丢数据。
4. 工具注册表是工具元数据唯一来源，WorkspaceStore 是个人状态唯一来源。
5. 搜索词、工具输入和敏感结果默认只在内存，不持久化、不上传。

### 2.4 技术栈

| 层级 | 技术 | 约束 | 用途 |
|------|------|------|------|
| UI | React / React DOM | 19.2.x | 组件、Context、Suspense、错误边界 |
| 路由 | React Router DOM | 7.18.x | 受保护路由、工具懒加载、404 |
| 构建 | Vite | 8.1.x | SPA 构建与分包 |
| 类型 | TypeScript | 6.0.x strict | 领域契约 |
| 交互 | dnd-kit | 现有版本 | 指针/键盘排序 |
| 本地数据 | IndexedDB | 原生 | 草稿、同步元数据、冲突备份 |
| 认证/远端 | Supabase JS/Auth/Postgres | 2.110.x；schema 待核验 | 会话与个人配置 |
| 托管 | Cloudflare Pages | Node 20.19+ 构建 | CDN、SPA、预览 |
| 测试 | Vitest、RTL、Playwright | 实施阶段添加 | 单元、组件、E2E |

---

## 3. 分层与目录

### 3.1 依赖方向

~~~text
app / pages / feature-ui
          ↓
feature application（用例、store、selectors）
          ↓
feature domain（类型、纯函数、状态机、端口）
          ↑
infrastructure（Supabase、IndexedDB、浏览器 API）
~~~

- domain 不导入 React、Supabase 或浏览器存储实现。
- application 只依赖 domain，不直接导入 Supabase。
- infrastructure 实现端口，不反向引用具体页面。
- shared 只放跨功能稳定原语，不得成为无边界杂物目录。
- 工具页通过 ToolShell 接入；注册表可持有动态 import，不持有个人数据。

### 3.2 目标目录

~~~text
browser/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── AppProviders.tsx
│   │   ├── AppShell.tsx
│   │   └── errors/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── AuthGate.tsx
│   │   │   ├── auth.types.ts
│   │   │   └── safeReturnTo.ts
│   │   ├── workspace/
│   │   │   ├── domain/
│   │   │   │   ├── nav-config.ts
│   │   │   │   ├── nav-config.adapter.ts
│   │   │   │   ├── workspace.reducer.ts
│   │   │   │   ├── sync-machine.ts
│   │   │   │   └── repositories.ts
│   │   │   ├── application/
│   │   │   │   ├── WorkspaceProvider.tsx
│   │   │   │   ├── workspace.service.ts
│   │   │   │   └── selectors.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── indexeddb-draft.repository.ts
│   │   │   │   └── supabase-workspace.repository.ts
│   │   │   └── ui/
│   │   ├── commands/
│   │   │   ├── command.types.ts
│   │   │   ├── command-index.ts
│   │   │   └── CommandPalette.tsx
│   │   └── tools/
│   │       ├── tool.types.ts
│   │       ├── tool-registry.ts
│   │       ├── ToolShell.tsx
│   │       └── pages/
│   ├── shared/
│   │   ├── config/env.ts
│   │   ├── errors/app-error.ts
│   │   ├── browser/clipboard.ts
│   │   ├── security/safe-url.ts
│   │   └── ui/
│   ├── lib/supabase.ts
│   └── main.tsx
├── public/_headers
├── wrangler.jsonc
├── tests/integration/
├── tests/e2e/
└── package.json
~~~

---

## 4. NavConfigV2 与 v1 兼容

### 4.1 强类型契约

~~~typescript
type UUID = string & { readonly __brand: 'UUID' }
type ISODateTime = string & { readonly __brand: 'ISODateTime' }
type ToolId = string & { readonly __brand: 'ToolId' }
type JsonValue =
  | null | boolean | number | string
  | JsonValue[] | { [key: string]: JsonValue }

interface NavConfigV2 {
  schemaVersion: 2
  configId: UUID
  revision: number
  updatedAt: ISODateTime
  categories: NavCategoryV2[]
  favorites: FavoriteV2[]
  recents: RecentV2[]
  extensions?: Record<string, JsonValue>
}

interface NavCategoryV2 {
  id: UUID
  name: string
  order: number
  links: NavLinkV2[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
  extensions?: Record<string, JsonValue>
}

interface NavLinkV2 {
  id: UUID
  name: string
  url: string
  description: string
  icon?: string
  order: number
  createdAt: ISODateTime
  updatedAt: ISODateTime
  extensions?: Record<string, JsonValue>
}

type ResourceRefV2 =
  | { kind: 'site'; id: UUID }
  | { kind: 'tool'; id: ToolId }

interface FavoriteV2 {
  ref: ResourceRefV2
  createdAt: ISODateTime
}

interface RecentV2 {
  ref: ResourceRefV2
  openedAt: ISODateTime
}

interface NavCategoryV1 {
  category?: unknown
  links?: unknown
  [key: string]: unknown
}
type NavConfigV1 = NavCategoryV1[]
~~~

链接归属由嵌套关系确定，不重复保存 categoryId。每次排序后，reducer 将同级 order 归一为连续整数。

### 4.2 稳定 ID

- 分类、网站、配置创建时生成 UUID，随后同时写本地草稿和远端文档。
- URL、名称、分类名称的编辑和跨分类移动不得改变 ID。
- 工具使用注册表常量 ID，例如 tool.json；路由变化不改变工具 ID。
- React key、dnd-kit ID、撤销、收藏、最近与去重全部使用稳定 ID。
- 禁止 URL、分类名、数组索引或文案充当领域 ID。

### 4.3 v1 适配

parseRemoteDocument(raw) 返回 valid-v2、adapted-v1 或 invalid：

1. v2 先做运行时结构校验，不能仅信任 TypeScript 声明。
2. 顶层旧数组逐项映射 category → name、desc → description。
3. 每个旧实体只生成一次 UUID，并立即存入同一份本地 v2 草稿；重渲染、重试、刷新均复用。
4. 危险 URL 不进入可执行索引；未知安全 JSON 放入 extensions 或迁移报告，禁止静默覆盖。
5. favorites、recents 初始为空，revision 从 1 开始，适配使用统一时间戳。
6. 完整 v2 先写 IndexedDB，再允许远端写；本地落盘失败时转只读并提示恢复。
7. 远端非法时不得用空数组覆盖；有当前 UID 缓存则展示缓存，否则进入可恢复错误页。

### 4.4 双读、写入与回滚

- **阶段 A**：部署 v1/v2 双读，远端继续写 v1，v2 只做本地 shadow 验证。
- **阶段 B**：验证生产数据副本、预览、缓存恢复后，以构建开关启用 v2 远端写。
- **阶段 C**：稳定后删除 v1 写路径，但长期保留 v1 读取/导入适配器。
- 回滚目标必须是阶段 A 双读版本，不得回滚到只认识数组的旧构建。
- 切换前取得远端备份或可下载备份，绝不以清空数据恢复。

### 4.5 收藏与最近

- 收藏以 kind + id 唯一，toggle 幂等；全部入口从同一 selector 读取。
- 最近使用以 kind + id 去重、按 openedAt 倒序，持久层最多 20，首页最多 10。
- 网站在 URL 校验通过且浏览器接受打开动作后记录；工具在路由成功后记录。
- 删除资源后 selector 立即过滤悬空引用，并在下一次提交清理。
- 只保存资源引用和时间，不保存搜索词、工具输入或结果。
- P0 放入同一 NavConfigV2 文档跨设备同步，不新增生产表。

---

## 5. 本地草稿与同步状态机

### 5.1 IndexedDB

数据库名 dev-workbench，schema 版本独立于 NavConfigV2：

| Store | Key | 内容 | 用途 |
|-------|-----|------|------|
| workspaceDrafts | auth.uid | document、baseRemoteVersion、dirty、mutationId、savedAt | 刷新恢复 |
| conflictBackups | auth.uid + backupId | 本地/远端快照、时间 | 冲突后恢复 |
| uiPreferences | auth.uid | 非敏感设备偏好 | 本地界面状态 |

- 仅认证完成后按当前 UID 访问；匿名态不得枚举或展示缓存。
- 登出先清内存。存在 dirty 时提供取消、重试、明确保留设备草稿、丢弃草稿四种选择。
- 冲突备份保留 7 天或最近 5 份，先到上限者生效。

### 5.2 状态

~~~typescript
type SyncState =
  | { tag: 'booting' }
  | { tag: 'loading'; cached: boolean }
  | { tag: 'synced'; remoteVersion: string }
  | { tag: 'dirty'; localRevision: number }
  | { tag: 'syncing'; attempt: number; mutationId: UUID }
  | { tag: 'offline'; attempt: number }
  | { tag: 'retryWait'; attempt: number; retryAt: number }
  | { tag: 'failed'; error: SyncError }
  | { tag: 'conflict'; local: Snapshot; remote: Snapshot }
  | { tag: 'fatal'; error: AppError }
~~~

| 状态 | 用户文案 | 操作 |
|------|----------|------|
| booting/loading | 正在载入 | 超过 10 秒重试 |
| synced | 已同步 | 正常编辑 |
| dirty | 待同步 | 立即同步、继续编辑 |
| syncing | 同步中 | 可继续编辑 |
| offline | 离线，已保存在本机 | 继续编辑、重试 |
| retryWait/failed | 同步失败 | 立即重试 |
| conflict | 发现其他设备修改 | 保留本地、使用云端 |
| fatal | 无法安全保存 | 重试本地存储、导出 |

### 5.3 启动与写入协议

1. AuthGate 得到用户后并行读取该 UID 的 IndexedDB 与远端。
2. 有缓存可先渲染并标注状态；远端未完成前不能误显示空配置。
3. 本地 clean 时采用合法远端；本地 dirty 且 remoteVersion 等于 base 时进入同步。
4. 本地 dirty 且远端版本不同则进入 conflict，不按客户端时间自动选赢家。
5. UI mutation 生成 mutationId，reducer 立即更新，再以单个 IDB 事务保存文档和元数据。
6. 同步队列 single-flight；400–800ms 连续操作合并最新远端快照，但每次本地落盘不可跳过。
7. 成功后以响应 updated_at 为新 base；若期间 revision 已变化，立即发送最新快照。
8. 旧响应只确认对应 revision，绝不能覆盖更新后的内存。

### 5.4 条件写与错误

读取只选择 nav_data、updated_at，按 user_id = auth.uid，期望零或一行。

已有行以 user_id + expected updated_at 条件更新并要求返回一行。零行后重读：

- 版本变化：conflict。
- 会话失效：unauthorized，清内存并登录。
- RLS/权限错误：forbidden，不得退化成插入或空数据。
- 网络/5xx：retryable，保留草稿。

无行时才尝试插入；唯一冲突重读并进入 conflict。上线前必须证明 user_id 唯一，因为仓库当前只有 onConflict 假设。updated_at 是第一阶段版本令牌；无法证明条件更新语义的环境不得开启 v2 writer。

### 5.5 重试与冲突

- 可重试错误用带抖动指数退避：约 1、2、4、8、16 秒，封顶 30 秒；5 次后停在 failed。
- online 事件可快速重试；navigator.onLine 只是提示，实际请求才决定联网状态。
- 认证、RLS、4xx 校验和解析错误不自动重试。
- 多标签用 BroadcastChannel 通知；clean 标签采用新快照，dirty 标签进入冲突，条件写是最终防线。
- “保留本地”先取最新远端作为新 base 再条件写；再次变化仍冲突。
- “使用云端”先备份本地，再替换文档和清 dirty。
- P0 不对排序、删除、重命名做字段级自动合并。

---

## 6. 工具注册表与统一搜索

### 6.1 注册表

~~~typescript
interface ToolDefinition {
  id: ToolId
  path: string
  title: string
  aliases: readonly string[]
  description: string
  category: string
  iconKey: string
  keywords: readonly string[]
  privacy: 'local-only' | 'external-explicit'
  capabilities: {
    run: boolean
    copy: boolean
    clear: boolean
    example: boolean
    sensitiveInput: boolean
  }
  load: () => Promise<{ default: React.ComponentType }>
}
~~~

- TOOL_REGISTRY 生成路由、桌面/移动导航、首页、命令索引和 13 类工具冒烟清单。
- 初始化时断言 ID/path 唯一；重复值在开发与 CI 直接失败。
- load 使用动态 import；iconKey 通过内部映射解析，组件不进入持久化数据。
- ToolShell 统一标题、隐私提示、操作、loading、空/成功/错误结果和 Ctrl/Command+Enter。

### 6.2 命令与评分

网站和工具转换为只读 Command；执行器按 open-site、open-tool、workspace-action 分派，搜索 UI 不直接操作窗口、路由或 store。

- 规范化：Unicode NFKC、trim、小写、连续空白折叠。
- 字段：网站名称/描述/URL/分类；工具标题/别名/描述/分类/关键词。
- 排序：名称精确 > 名称前缀 > 别名前缀 > 名称包含 > 分类/URL > 描述。
- 收藏固定加权，最近按离散时间桶加权；同分按类型、原 order、稳定 ID。
- 以 ID 去重；CRUD 后 1 秒内更新；600 项查询 p95 小于 100ms。
- 搜索词仅在内存，不写日志、IDB、Supabase 或分析服务。

### 6.3 命令面板

- 非编辑状态监听 Ctrl/Command+K，不劫持 input、textarea、select 或 contenteditable；轻量 CodeEditor 使用原生 textarea。
- 使用 dialog/combobox/listbox 语义，支持方向键、Enter、Esc、焦点圈定与归还。
- 空查询显示收藏、最近和常用工具；无结果显示清除与新增网站。
- 移动端全屏，软键盘弹出后结果与主操作仍可达。

---

## 7. 认证、配置与错误

### 7.1 认证

- AuthState 区分 initializing、authenticated、anonymous、error。
- /login 唯一公开；首页和全部工具在 AuthGate 下。
- returnTo 只接受以单个 / 开头的同源 path/search/hash，拒绝协议和双斜线。
- 初始化显示骨架，不闪现个人缓存；会话失效时停止同步、清内存并跳登录。
- Supabase token 由 SDK 管理，业务代码不得输出、复制或记录。

### 7.2 环境变量

| 变量 | 作用域 | 要求 |
|------|--------|------|
| VITE_SUPABASE_URL | 客户端公开 | 必填 HTTPS；无硬编码回退 |
| VITE_SUPABASE_ANON_KEY 或 publishable key | 客户端公开 | 禁止 service role |
| SUPABASE_UPSTREAM_ORIGIN | Function 服务端，可选 | 仅代理启用时，固定主机 |
| VITE_ENABLE_NAV_V2_WRITE | 构建时 | 阶段 A 默认 false |

VITE_ 会进入客户端包，不能存秘密。env.ts 校验缺失、协议和占位值；Preview/Production 分别配置与验证。

### 7.3 错误边界

- 根边界保护应用壳；路由边界隔离单个工具；数据区分加载、空、过滤无结果、离线、权限与解析失败。
- 异步/事件错误由仓储返回 AppError 判别联合，不能依赖 React 边界捕获。
- 错误码至少含 CONFIG_INVALID、AUTH_EXPIRED、FORBIDDEN、NETWORK、REMOTE_CONFLICT、DATA_INVALID、LOCAL_STORAGE_FAILED、UNKNOWN。
- 生产日志只含错误码、匿名关联 ID 和阶段；不展示堆栈、token、URL 清单或工具输入。

---

## 8. 数据访问与生产未知项

### 8.1 仓储端口

~~~typescript
interface WorkspaceRepository {
  load(userId: string): Promise<RemoteLoadResult>
  save(input: {
    userId: string
    document: NavConfigV2
    expectedRemoteVersion: string | null
    mutationId: UUID
  }): Promise<RemoteSaveResult>
}

type RemoteSaveResult =
  | { kind: 'saved'; snapshot: RemoteSnapshot }
  | { kind: 'conflict'; remote: RemoteSnapshot }
  | { kind: 'retryable'; error: AppError }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden'; error: AppError }
~~~

组件不得出现 from(user_nav_configs)。表名、字段、PostgREST 查询和错误映射只存在于 Supabase 适配器。

### 8.2 Pages Function

- 默认直连 Supabase，减少自建代理的认证头、CORS、缓存和错误风险。
- 如必须代理，只允许 auth/v1、rest/v1 必要路径/方法，upstream 来自服务端固定 allowlist。
- 只转发 Authorization、apikey、Content-Type、必要 Prefer/Range；删除 Cookie、Host 和目标覆盖头。
- 禁止目标 URL 参数、service role 和认证响应缓存；限制 body，代理中不加入领域逻辑。

### 8.3 第一阶段发布门禁

只读核验，不执行 schema 变更：

- user_id 是否唯一并正确关联 auth.users.id。
- nav_data 是否为足够容量的 JSON/JSONB。
- updated_at 类型、精度、默认值、触发器和条件更新行为。
- RLS 是否启用，select/insert/update/delete 是否都约束 user_id = auth.uid()。
- 两个测试账号是否互不可读写，匿名是否不可访问。

**后续可选且必须单独确认**：独立 version 列、服务端时间、拆表或 RPC。相关 SQL、回填、RLS、备份与回滚必须另立变更单并由用户确认；本文不授权执行，也不提供可运行 SQL。

---

## 9. Cloudflare Pages、性能与安全

### 9.1 部署与 SPA fallback

| 项目 | 约定 |
|------|------|
| 安装 | npm ci |
| 构建 | npm run build |
| 输出 | dist |
| Node | 22 或更高版本（与 package.json、CI 和 Wrangler 保持一致） |
| 流程 | Preview 验证后人工批准生产 |

- 不提供顶层 `404.html` 或循环 `_redirects` 规则，使用 Cloudflare Pages 原生 SPA fallback。
- 验证 /tools/json、/tools/diff 及未知前端路由刷新；React Router 仍需 * NotFound。
- 客户端直接连接配置的 Supabase 项目，不保留宽泛的 Pages Function 代理。
- hashed 资源长期 immutable；index.html 短缓存/重新验证，避免旧壳引用已删除 chunk。

### 9.2 安全与隐私

- RLS 才是授权边界，客户端 user_id 过滤不能替代 RLS。
- URL 只允许 http/https；拒绝 javascript、data、file；外链使用 noopener,noreferrer。
- 图标失败回退本地图标；元数据识别需按钮触发，并披露服务、目的和发送 URL。
- JWT、密码、私钥、工具输入/结果不写日志、IDB、Supabase 或错误上报。
- local-only 工具不得发网络请求；外部 API 工具执行前标识目标和发送字段。
- 不接第三方行为分析；未来引入须单独披露与提供关闭方式。
- 配置 CSP、Referrer-Policy、nosniff、Permissions-Policy；connect-src 仅自身和 Supabase。

### 9.3 懒加载与性能

- 主包只含应用壳、AuthGate、首页骨架、命令框架和工具元数据。
- 13 个工具全部动态 import；轻量 CodeEditor 随具体工具加载，加密与媒体依赖保持路由级懒加载。
- Suspense 使用稳定骨架，chunk 失败可重试；Save-Data/慢网络不预取。
- 搜索索引只在数据变化时重建，可用 useDeferredValue；600 项不启 Worker。
- Workspace Context 拆 state/dispatch 并使用窄 selector；拖拽结束才提交语义 mutation。

| 指标 | 门槛 |
|------|------|
| LCP p95 | 不超过 2.5 秒 |
| INP | 不超过 200ms |
| 600 项搜索 p95 | 小于 100ms |
| 本地 mutation 可见 | 小于 100ms |
| 同步状态可见 | 小于 150ms |

---

## 10. 测试架构与交付

### 10.1 测试分层

| 层级 | 工具 | 重点 |
|------|------|------|
| 单元 | Vitest | adapter、reducer、状态机、评分、URL |
| 组件 | React Testing Library/user-event | 命令面板、AuthGate、Dialog、同步与工具壳 |
| 集成 | fake-indexeddb + Supabase stub/MSW | 恢复、串行写、重试、冲突、会话失效 |
| E2E | Playwright | 登录、CRUD/撤销、搜索、移动端、深链、13 工具 |
| 安全集成 | 独立测试 Supabase | 双用户 RLS、匿名拒绝、条件写 |

测试依赖和 scripts 在实施阶段统一加入 package.json；架构阶段不修改依赖。

### 10.2 核心用例

- v1 同名分类、重复 URL、缺失/未知字段、危险协议得到确定适配结果。
- v1 生成 UUID 在重渲染、刷新、失败重试、远端重读后稳定。
- 编辑 URL/名称不改 ID；跨分类移动不丢收藏/最近；最近去重并截断 20。
- StrictMode 不造成重复初始化、插入或最近记录。
- 离线修改刷新恢复；5xx 退避；认证/RLS/4xx 不重试。
- 保存期间继续编辑时旧响应不覆盖新 revision。
- 两客户端同 base 写入时第二个冲突，两种用户决策均保留恢复路径。
- IDB 失败、首读失败、有/无缓存分别显示正确状态。
- 命令面板键盘、焦点、排序和输入区快捷键隔离通过。
- 360/768/1440px 无页面级横向溢出，触控目标至少 44×44px。
- 13 类工具完成加载、适用的示例/执行/复制/清空/错误态冒烟。
- Preview 直接刷新工具深链，API 路径不被 fallback 吞掉。

### 10.3 CI 门禁

1. npm ci 使用锁文件。
2. Oxlint、TypeScript production build 通过。
3. 领域单元、组件和集成测试通过。
4. Playwright 至少运行 Chromium 桌面和 360px 主流程；发布候选补 Firefox/WebKit。
5. Vite production build、chunk 检查和 Cloudflare Preview 冒烟通过。
6. RLS 双用户证据缺失时阻止生产发布。

### 10.4 实施顺序

1. 建立类型、v1/v2 adapter、工具注册表与测试基线，不改变远端格式。
2. 抽 Supabase 仓储与 AuthGate，消除页面直查，补配置和错误边界。
3. 加入 IDB 草稿、同步状态机、重试和冲突 UI，以 v1 writer 验证。
4. 完成首页、命令面板、收藏/最近、CRUD/撤销与移动端壳。
5. 13 个工具接入 ToolShell 和动态路由。
6. 部署阶段 A，备份并验证数据副本、Preview、深链和 RLS。
7. 经单独批准开启 v2 writer，保留阶段 A 回滚构建。

### 10.5 决策与风险

| 决策/风险 | 处理 |
|-----------|------|
| 保留现有技术栈 | 已采纳，降低迁移与工具回退风险 |
| 原生 IndexedDB | 已采纳，无新增运行时依赖 |
| v2 继续放 nav_data | 有条件采纳，须双读与条件写验证 |
| updated_at 不可靠 | writer 默认关闭；验证失败不得启用 |
| RLS 未知 | 双用户/匿名发布门禁 |
| 旧构建不识 v2 | 先部署双读，回滚只回阶段 A |
| 多标签/设备冲突 | BroadcastChannel、single-flight、条件写、人工决策 |
| 工具拆分回退 | 注册表清单、分批迁移、13 类冒烟 |

### 10.6 完成定义

- 端口、状态、目录和数据契约可直接拆成开发任务。
- 第一阶段无建表、删字段、生产迁移或可执行 SQL。
- 全部 P0 横切需求有明确模块、失败路径和验证方式。
- 所有依赖未知生产状态的能力均有开关或阻断门禁。

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2026-07-24 | Architect Agent | 基于现有项目形成可执行的 P0 重构架构 |
