## 摘要

- 2026-07-28 使用 Node.js 20.19.0 与 npm 10.8.2 完成 `npm ci`。
- 基线 `npm run build` 与 `npm run lint` 均成功；构建产生约 1.91 MB 的单一 JS chunk。
- 当前无测试脚本；lint 有 13 条既有警告。
- `npm audit` 报告 7 项漏洞（4 moderate、3 high），不执行破坏性的 `npm audit fix --force`。
- Supabase JS 与 puppeteer-core 声明 Node.js 22+，Cloudflare 构建运行时需升级或锁定兼容版本。

# 实施前基线

## 环境

| 项目 | 结果 |
|------|------|
| Node.js | 20.19.0 |
| npm | 10.8.2 |
| 安装 | `npm ci` 成功，新增本地 `node_modules`，锁文件未改变 |

## 构建

- 命令：`npm run build`
- 结果：通过。
- Vite：8.1.4。
- 产物：`dist/assets/index-*.js` 约 1,912.72 kB，gzip 约 537.77 kB。
- 风险：Monaco 与全部工具同步打入主包；实施必须使用路由级懒加载和代码分割。

## Lint

- 命令：`npm run lint`
- 结果：退出码 0。
- 既有警告：13 条，主要为未使用的 catch 参数、AuthContext Fast Refresh、Navigation Hook 依赖。
- 目标：重构触达文件不新增警告，并消除相关既有警告。

## 依赖安全

- 总计：7 项（moderate 4、high 3、critical 0）。
- 直接依赖相关：`react-router-dom`、`ip-cidr`；传递依赖相关：`dompurify`、`fast-uri`、`monaco-editor`、`react-router`、`ip-address`。
- React Router 公告针对 RSC action；当前应用为 SPA、不使用 RSC，但仍需记录并评估升级路径。
- `ip-address` 公告涉及 HTML 生成方法；当前工具不应调用任何 HTML 输出方法，仍需保持输入输出为纯文本。
- 不运行 `npm audit fix --force`，避免自动降级或跨 major 修改路由依赖。

## 测试红线

- `package.json` 当前不存在 `test`、`test:coverage` 或 `e2e` 脚本。
- Wave 1 的首个红测应验证测试命令缺失/失败，随后引入 Vitest + Testing Library，覆盖领域迁移、搜索排序与 reducer。
