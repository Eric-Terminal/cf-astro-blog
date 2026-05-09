# 上线后维护手册

本文用于记录生产环境的发布与数据库迁移规范，确保任意维护者在无额外上下文时也能独立执行。

## 1. 日常改动是否需要迁移数据库

### 只改前端/接口逻辑（不改表结构）

- 可以直接 `push`，Cloudflare 会自动构建和部署。
- 不需要执行 `npm run db:migrate:remote`。

常见场景：

- 页面样式、文案、交互调整。
- 新增接口逻辑但不新增/修改 D1 表结构。
- 变量、绑定、路由、权限文案调整。

### 改了数据库结构（新增表/字段/索引）

- 仅 `push` 不够，必须额外执行一次远程迁移：

```bash
npm run db:migrate:remote
```

常见场景：

- `drizzle/*.sql` 新增了 migration 文件。
- 表结构发生变化（例如新增字段、索引、约束）。

## 2. 标准发布流程（建议固定执行）

1. 本地改代码并提交，推送到 `main`。
2. 等 Cloudflare 自动部署成功。
3. 若本次包含数据库结构改动，执行 `npm run db:migrate:remote`。
4. 手动验证核心链路：后台登录、文章读写、媒体上传、友链申请。

## 3. 运行时配置要点

以下内容必须配置在 Cloudflare 项目的运行时环境（Production/Preview）：

- `ADMIN_GITHUB_LOGIN`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `JWT_SECRET`
- `SITE_URL`
- `TURNSTILE_SITE_KEY`（若启用 Turnstile）
- `TURNSTILE_SECRET_KEY`（若启用 Turnstile）

资源绑定名必须保持一致：

- D1: `DB`
- KV: `SESSION`
- R2: `MEDIA_BUCKET`

## 4. 常见问题排查

### 登录页显示“允许访问账号：未配置”

- 优先检查 `ADMIN_GITHUB_LOGIN` 是否配置在运行时环境。
- 检查变量名是否有前后空白字符。

### 友链申请页提示“未配置 Turnstile Site Key”

- 检查 `TURNSTILE_SITE_KEY` 是否已配置。
- 如果仓库 `wrangler.jsonc` 里把该值写成空字符串，部署时会覆盖线上值。

## 5. 说明

- D1 的业务数据不会因为普通代码部署被清空。
- 仅在执行 migration 时才会发生结构变更。

==你好==