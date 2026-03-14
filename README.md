# Cloudflare Astro 站点模板

这是一个基于 `Astro + Hono + Cloudflare Workers` 的站点模板，内置公开页面、后台文章管理、媒体管理和访问统计能力。

当前版本已包含以下安全能力。

- 公开页面 Markdown 渲染会转义原始 HTML，并限制危险链接协议。
- 后台模板统一做 HTML 与属性转义，降低管理员侧存储型 XSS 风险。
- 后台会话基于 `JWT + KV`，支持服务端撤销与密码变更失效。
- 后台写操作统一使用 CSRF 校验。
- 登录限流使用 KV 存储，存储异常时拒绝继续登录，避免 fail-open。
- 媒体上传仅接受受控图片类型，并使用 `UUID + 白名单扩展名` 作为对象键名。

## 技术栈

| 分层 | 技术 |
| --- | --- |
| 前台页面 | `Astro` |
| 后台与接口 | `Hono` |
| 数据库 | `Cloudflare D1` + `Drizzle ORM` |
| 会话与限流 | `Cloudflare KV` |
| 媒体文件 | `Cloudflare R2` |
| 运行时 | `Cloudflare Workers` |
| 检查与格式化 | `Biome` |
| 测试 | `tsx + node:test` |

## 目录结构

```text
src/
├── admin/                  # 后台子应用、认证中间件和 HTML 模板
├── db/                     # Drizzle schema
├── layouts/                # 公共布局
├── lib/                    # 安全工具、数据库访问与共享类型
├── pages/                  # Astro 页面与 API 入口
└── styles/                 # 全局样式
public/
├── admin.js                # 后台交互脚本
└── theme.js                # 主题初始化脚本
scripts/
├── hash-password.mjs       # 生成后台密码哈希
└── seed.sql                # 示例数据
tests/
├── integration/            # 路由与认证基础行为测试
└── unit/                   # schema 与安全工具测试
```

## 本地开发

推荐使用 `Node.js 22+` 和 `npm`。

```bash
git clone https://github.com/Eric-Terminal/cf-astro-blog-starter.git
cd cf-astro-blog-starter
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

如需生成后台密码哈希，可执行以下命令。

```bash
npm run hash:password -- 你的密码
```

输出格式为 `pbkdf2_sha256$迭代次数$盐值$哈希值`，可填入 `ADMIN_PASSWORD_HASH`。

## Cloudflare 绑定

| 绑定名 | 类型 | 作用 |
| --- | --- | --- |
| `DB` | D1 | 存放文章、分类、标签和统计数据 |
| `MEDIA_BUCKET` | R2 | 存放后台上传的图片资源 |
| `SESSION` | KV | 存放后台会话和登录限流状态 |
| `JWT_SECRET` | Secret | 用于签发后台会话令牌 |
| `ADMIN_GITHUB_LOGIN` | Variable | 允许登录后台的 GitHub 用户名 |
| `GITHUB_OAUTH_CLIENT_ID` | Variable | GitHub OAuth 客户端 ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | Secret | GitHub OAuth 客户端密钥 |
| `TURNSTILE_SECRET_KEY` | Secret，可选 | 开启登录页与友链申请的人机验证时使用 |
| `TURNSTILE_SITE_KEY` | Variable，可选 | 登录页/友链申请页渲染 Turnstile 时使用 |
| `MCP_BEARER_TOKEN` | Secret，可选 | `/api/mcp` 的 Bearer 鉴权令牌（不使用 OAuth） |

## Cloudflare Dashboard 关联仓库部署

如果仓库是开源的，请把所有真实密钥都放在 Cloudflare 项目后台，不要提交到 Git 仓库。

进入 Cloudflare 项目后，在 `Settings -> Variables and Secrets` 分别为 `Production` 与 `Preview` 环境配置下表。

| 名称 | 类型 | 是否必填 | 建议放置 | 说明 |
| --- | --- | --- | --- | --- |
| `JWT_SECRET` | Secret | 是 | Cloudflare Secret | 后台会话签名密钥 |
| `ADMIN_GITHUB_LOGIN` | Variable | 是 | Cloudflare Variable | 允许登录后台的 GitHub 用户名 |
| `GITHUB_OAUTH_CLIENT_ID` | Variable | 是 | Cloudflare Variable | GitHub OAuth 应用 Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | Secret | 是 | Cloudflare Secret | GitHub OAuth 应用 Client Secret |
| `GITHUB_OAUTH_REDIRECT_URI` | Variable | 否 | Cloudflare Variable | 可选，留空会按当前域名自动推导回调地址 |
| `TURNSTILE_SITE_KEY` | Variable | 否 | Cloudflare Variable | 可选，登录页与友链申请页验证码站点 Key |
| `TURNSTILE_SECRET_KEY` | Secret | 否 | Cloudflare Secret | 可选，登录页与友链申请验证码服务端密钥 |
| `AUTO_DEPLOY_WEBHOOK_URL` | Variable | 否 | Cloudflare Variable | 可选，后台发布公开文章后触发外部部署钩子 |
| `AUTO_DEPLOY_WEBHOOK_SECRET` | Secret | 否 | Cloudflare Secret | 可选，部署钩子鉴权令牌（请求头 `x-deploy-token`） |
| `MCP_BEARER_TOKEN` | Secret | 否 | Cloudflare Secret | 可选，对外 MCP 端点 `/api/mcp` 的 Bearer 鉴权令牌 |
| `MCP_RATE_LIMIT_PER_MINUTE` | Variable | 否 | Cloudflare Variable | 可选，MCP 每分钟每 IP 限流，默认 `30` |
| `MCP_AUTH_FAIL_LIMIT_PER_MINUTE` | Variable | 否 | Cloudflare Variable | 可选，MCP 鉴权失败每分钟每 IP 上限，默认 `20` |
| `MCP_AUTH_BLOCK_SECONDS` | Variable | 否 | Cloudflare Variable | 可选，触发鉴权失败封禁后的封禁秒数，默认 `3600` |
| `SITE_NAME` | Variable | 建议 | Cloudflare Variable | 站点名称 |
| `SITE_URL` | Variable | 建议 | Cloudflare Variable | 站点主域名 |

资源绑定也需要在 Cloudflare 项目中配置完成：`DB`（D1）、`MEDIA_BUCKET`（R2）和 `SESSION`（KV）。

本地开发继续使用 `.dev.vars`，仓库只保留 `.dev.vars.example` 模板，真实值不要入库。

如果使用 Cloudflare Dashboard 的 Git 自动部署流程，一般不需要在 GitHub 仓库里配置 Cloudflare API Token。
只有改用 GitHub Actions + Wrangler 自行发布时，才需要把 Token 放到 GitHub Secrets。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 生成生产构建 |
| `npm run preview` | 构建后用 Wrangler 本地预览 |
| `npm run search:index:auto` | 优先读取本地 D1，若为空自动回退远端 D1 |
| `npm run search:index:local` | 读取本地 D1 并生成 Pagefind 索引 |
| `npm run search:index:remote` | 读取远端 D1 并生成 Pagefind 索引 |
| `npm run check` | 运行类型检查和 Biome 检查 |
| `npm run lint` | 运行 Biome lint |
| `npm run format` | 格式化源码、脚本和测试 |
| `npm test` | 运行自动化测试 |
| `npm run db:migrate:local` | 应用本地 D1 迁移 |
| `npm run db:migrate:remote` | 应用线上 D1 迁移 |

## SEO 与订阅

- `sitemap.xml`：由 `src/pages/sitemap.xml.ts` 动态输出，包含公开页面和可见文章。
- `rss.xml`：由 `src/pages/rss.xml.ts` 动态输出，默认收录最近 30 篇公开文章。
- `robots.txt`：由 `src/pages/robots.txt.ts` 输出，允许公开页面抓取，屏蔽后台登录与管理相关路径（`/api/auth`、`/api/admin`、`/admin`）。
- `webmention`：由 `src/admin/routes/webmention.ts` 提供接收端点 `/api/webmention`，通过 `source/target` 校验后写入待审核队列；后台在 `/api/admin/mentions` 进行审核。

## Pagefind 搜索

- 搜索页改为浏览器端 Pagefind 检索，不再依赖服务端搜索 API 查询正文。
- 索引生成脚本为 `scripts/build-pagefind-index.mjs`，会从 D1 拉取公开文章并输出：
  - `public/pagefind/`（Pagefind 索引文件）
  - `public/pagefind-meta.json`（分类、标签与文章元数据）
- `npm run build` 会默认先执行 `search:index:auto`（本地为空时自动回退远端），避免误发布空索引。
- `npm run deploy` 会在发布前执行远端索引构建，保证线上搜索与远端 D1 一致。

## 发布后自动重建索引（可选）

- 默认情况下，后台“发布文章”只会写入 D1，不会自动触发部署。
- 如需自动重建 Pagefind 索引，可配置 `AUTO_DEPLOY_WEBHOOK_URL`（可选附带 `AUTO_DEPLOY_WEBHOOK_SECRET`）。
- 当后台发生会影响公开可见内容的操作（创建/更新/删除已公开文章、取消已生效的定时发布）时，系统会向该钩子发送 `POST` 请求。
- 该钩子建议对接到你的 CI/CD（例如 GitHub Actions 的触发入口），在流水线中执行 `npm run deploy`。
- 当 `AUTO_DEPLOY_WEBHOOK_URL` 指向 GitHub `repository_dispatch` 接口（`https://api.github.com/repos/<owner>/<repo>/dispatches`）时：
  - 会自动发送 `Authorization: Bearer <AUTO_DEPLOY_WEBHOOK_SECRET>`；
  - 请求体会自动包装为 `{ event_type, client_payload }`；
  - `event_type` 默认 `rebuild-search-index`，可通过 `AUTO_DEPLOY_GITHUB_EVENT_TYPE` 覆盖。
- 配套的 GitHub Actions 工作流见 `.github/workflows/auto-deploy-from-admin.yml`，执行顺序如下：
  - 优先使用仓库 Secret `CLOUDFLARE_API_TOKEN`（推荐，最稳定）；
  - 若未配置 `CLOUDFLARE_API_TOKEN`，则尝试使用 `CLOUDFLARE_REFRESH_TOKEN` 动态换取 Access Token；
  - 若换取成功且返回新的 refresh token，会自动回写 `CLOUDFLARE_REFRESH_TOKEN`（需要额外配置 `GH_ADMIN_TOKEN`，且具备仓库 secrets 写权限）。
- 当 Cloudflare 凭据缺失或 refresh token 失效时，工作流会记录“已跳过部署”的原因，不再直接失败。

## MCP 发帖（HTTP + Streamable）

- 端点：`/api/mcp`（MCP Streamable HTTP）。
- 鉴权：`Authorization: Bearer <MCP_BEARER_TOKEN>`，不走 OAuth。
- 第一版内置工具：`create_post`。
  - 必填参数：`title`、`content`、`authorName`。
  - 可选参数：`excerpt`、`categoryName`、`tagNames`、`metaTitle`、`metaDescription`、`metaKeywords` 等。
  - 兼容别名：`summary`、`category`、`tags`、`seoTitle`、`seoDescription`、`seoKeywords`，以及 `seo` 对象（`{ title, description, keywords, canonicalUrl }`）。
  - 默认 `status=published`（可显式传 `draft` 或 `scheduled`）。
- 读帖子工具：
  - `list_posts`：按状态/关键词读取文章列表，支持 `limit` 与 `includeContent`。
  - `get_post`：按 `id` 或 `slug` 读取单篇文章详情。
- 安全策略：
  - 若未配置 `MCP_BEARER_TOKEN` 或鉴权失败，端点统一返回 `404 Not Found`，降低被扫描识别价值。
  - 默认启用每分钟每 IP 限流（可通过 `MCP_RATE_LIMIT_PER_MINUTE` 调整）。
  - 对错误 Bearer 进行按 IP 失败计数，超过阈值后临时封禁（`MCP_AUTH_FAIL_LIMIT_PER_MINUTE` / `MCP_AUTH_BLOCK_SECONDS`）。
  - 后台外观页提供 MCP 开关（`启用 MCP 接口（/api/mcp）`），关闭后端点统一返回 `404`。

## 部署前检查

1. 先确认 `JWT_SECRET`、`ADMIN_GITHUB_LOGIN`、`GITHUB_OAUTH_CLIENT_ID`、`GITHUB_OAUTH_CLIENT_SECRET` 已配置。
2. 如果启用了 Turnstile，要同时配置 `TURNSTILE_SITE_KEY` 与 `TURNSTILE_SECRET_KEY`。
3. 如果要启用媒体管理，确认 `MEDIA_BUCKET` 已绑定。
4. 上线前执行 `npm run check` 和 `npm test`。

## 上线后维护速查

- 只改 UI/交互/接口逻辑（不改 D1 表结构）时，直接 `push` 即可触发自动部署。
- 改了数据库结构（新增表/字段/索引）时，部署后必须执行 `npm run db:migrate:remote`。
- 完整维护流程与故障排查请查看：[docs/maintenance-guide.md](docs/maintenance-guide.md)。

## 许可证

项目使用 [MIT](LICENSE) 许可证。
