# Cloudflare Astro 站点模板喵

这是一个基于 `Astro + Hono + Cloudflare Workers` 的站点模板，内置公开页面、后台文章管理、媒体管理和访问统计能力喵

当前版本已经补上了这几类关键安全能力喵

- 公开页面的 Markdown 渲染会转义原始 HTML，并限制危险链接协议喵
- 后台模板统一做 HTML 与属性转义，避免管理员侧存储型 XSS 喵
- 后台会话改为 `JWT + KV 会话记录`，支持服务端撤销和密码变更失效喵
- 所有后台写操作都加上了 CSRF 校验喵
- 登录限流改为 KV 存储，并在存储异常时拒绝继续登录，避免 fail-open 喵
- 媒体上传只接受受控图片类型，并且对象键名改成 `UUID + 白名单扩展名` 喵

## 技术栈喵

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

## 目录结构喵

```text
src/
├── admin/                  # 后台子应用、认证中间件和 HTML 模板喵
├── db/                     # Drizzle schema 喵
├── layouts/                # 公共布局喵
├── lib/                    # 安全工具、数据库访问与共享类型喵
├── pages/                  # Astro 页面与 API 入口喵
└── styles/                 # 全局样式喵
public/
├── admin.js                # 后台交互脚本喵
└── theme.js                # 主题初始化脚本喵
scripts/
├── hash-password.mjs       # 生成后台密码哈希喵
└── seed.sql                # 示例数据喵
tests/
├── integration/            # 路由与认证基础行为测试喵
└── unit/                   # schema 与安全工具测试喵
```

## 本地开发喵

推荐使用 `Node.js 22+` 和 `npm` 喵

```bash
git clone https://github.com/h1n054ur/cf-astro-blog-starter.git
cd cf-astro-blog-starter
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

如果你需要生成后台密码哈希，执行下面的命令即可喵

```bash
npm run hash:password -- 你的密码
```

输出格式为 `pbkdf2_sha256$迭代次数$盐值$哈希值`，把整行填进 `ADMIN_PASSWORD_HASH` 即可喵

## Cloudflare 绑定喵

| 绑定名 | 类型 | 作用 |
| --- | --- | --- |
| `DB` | D1 | 存放文章、分类、标签和统计数据喵 |
| `MEDIA_BUCKET` | R2 | 存放后台上传的图片资源喵 |
| `SESSION` | KV | 存放后台会话和登录限流状态喵 |
| `JWT_SECRET` | Secret | 用于签发后台会话令牌喵 |
| `ADMIN_USERNAME` | Secret | 后台用户名喵 |
| `ADMIN_PASSWORD_HASH` | Secret | 后台密码的 PBKDF2 哈希喵 |
| `TURNSTILE_SECRET_KEY` | Secret，可选 | 开启登录人机验证时使用喵 |
| `TURNSTILE_SITE_KEY` | Variable，可选 | 登录页渲染 Turnstile 时使用喵 |

## 常用命令喵

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器喵 |
| `npm run build` | 生成生产构建喵 |
| `npm run preview` | 构建后用 Wrangler 本地预览喵 |
| `npm run check` | 运行类型检查和 Biome 检查喵 |
| `npm run lint` | 运行 Biome lint 喵 |
| `npm run format` | 格式化源码、脚本和测试喵 |
| `npm test` | 运行自动化测试喵 |
| `npm run db:migrate:local` | 应用本地 D1 迁移喵 |
| `npm run db:migrate:remote` | 应用线上 D1 迁移喵 |

## 部署前检查喵

1. 先确认 `JWT_SECRET`、`ADMIN_USERNAME` 和 `ADMIN_PASSWORD_HASH` 都已经配置喵
2. 如果启用了 Turnstile，要同时配置 `TURNSTILE_SITE_KEY` 与 `TURNSTILE_SECRET_KEY` 喵
3. 如果要启用媒体管理，确认 `MEDIA_BUCKET` 已经绑定喵
4. 上线前执行 `npm run check` 和 `npm test` 喵

## 许可证喵

项目使用 [MIT](LICENSE) 许可证喵
