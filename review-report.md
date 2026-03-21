# 博客安全审计报告（blog.ericterminal.com）

## 审计信息

- 审计日期：2026-03-22（Asia/Shanghai）
- 审计对象：
  - 线上站点：`https://blog.ericterminal.com/`
  - 源码目录：`/Users/Eric/Dev/TypeScript/cf-astro-blog`
- 审计方式：
  - 黑盒检测（HTTP 头、公开接口、访问控制、基础攻击面）
  - 白盒审计（认证授权、输入校验、SSRF、XSS、依赖风险、限流策略）
  - 依赖漏洞扫描（`npm audit --omit=dev --registry=https://registry.npmjs.org --json`）

## 整改状态（2026-03-22）

- 已完成修复：F-01（头像代理 SSRF/SVG）、F-02（依赖漏洞）、F-03（公开 AI 同源校验与 `/chat` 人机校验）、F-04（JWT 密钥强度校验）。
- 风险接受：`/ai/terminal-404` 当前不启用 Turnstile，依赖同源校验 + IP 限流控制成本与滥用面。
- 已验证：`npm audit --omit=dev --registry=https://registry.npmjs.org` 输出 `found 0 vulnerabilities`。
- 待选优化：F-05（健康检查最小化）可按运维需求决定是否收敛。

## 结论摘要

整体安全基线较好（后台鉴权、CSRF、防护头、Markdown 安全渲染均到位），但存在 **1 个高优先级问题** 和 **若干中低优先级风险**，建议先修复头像代理相关问题，再处理依赖升级与公开 AI 端点风控。

- 高风险：1
- 中风险：2
- 低风险：2

---

## 详细发现

## [高] F-01 头像代理存在 SSRF 绕过面，并允许代理 SVG（潜在脚本执行面）

- 位置：`src/admin/routes/friend-links.ts`
  - 目标校验：`validateAvatarTarget`（第 105-126 行）
  - 拉取实现：`fetch(..., { redirect: "follow" })`（第 313-321 行）
  - 类型放行：`content-type` 仅判断 `startsWith("image/")`（第 327-334 行）

### 问题说明

1. 初始 URL 会做私网/本地校验，但 **重定向链路未逐跳复验**（`redirect: "follow"`），可被“外网地址 -> 内网地址”重定向绕过策略。  
2. 仅按 `hostname` 字符串判断是否私网，未进行解析后 IP 复验，存在 DNS Rebinding 风险面。  
3. 代理接口接受并回传 `image/svg+xml`，在同源上下文中若被直接访问/嵌入不当，可能扩展为脚本执行载体。

### 复现证据

- 直接私网地址会被拦截（符合预期）：
  - `GET /api/friend-links/avatar?url=http://127.0.0.1/` -> `400 头像地址不允许使用本地或内网主机`
- 通过外站重定向到私网时未在业务层拦截（返回 502 而非 400 拦截）：
  - `GET /api/friend-links/avatar?url=https://httpbin.org/redirect-to?url=http://127.0.0.1/` -> `502 头像暂时不可用`
- SVG 可被代理返回：
  - `GET /api/friend-links/avatar?url=https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/github.svg`
  - 返回 `200` 且 `content-type: image/svg+xml`

### 修复建议（优先级 P0）

1. 改为 `redirect: "manual"`，每一跳 `Location` 都重新执行 `validateAvatarTarget`。  
2. 新增“解析后 IP 校验”与“最终连接地址校验”（防 DNS Rebinding）。  
3. 头像代理白名单建议仅允许 `image/jpeg|png|webp|avif|gif`，**禁用 SVG**；如必须支持 SVG，需做净化与下载头隔离（例如强制 `Content-Disposition: attachment`）。

---

## [中] F-02 依赖库存在已知漏洞（含高危）

### 证据

执行命令：

```bash
npm audit --omit=dev --registry=https://registry.npmjs.org --json
```

结果摘要：

- 总计：7 个漏洞（高危 4 / 中危 3）
- 重点包：
  - `hono`（直接依赖，当前 `^4.11.6`，建议升级到 `>=4.12.7`）
  - `@astrojs/cloudflare` 链路涉及 `wrangler/miniflare/undici`（含高危公告）
  - `h3`、`devalue`（传递依赖）

### 影响说明

部分漏洞在开发链路/构建链路中触发，部分与运行时框架组件相关。即使短期不可直接利用，也会提升整体供应链与维护风险。

### 修复建议（优先级 P1）

1. 升级 `hono` 至安全版本。  
2. 升级 `@astrojs/cloudflare` 与 `wrangler` 到已修复区间。  
3. 升级后重新执行 `npm audit` + 回归测试，确认无新破坏。

---

## [中] F-03 公开 AI 终端接口可被非浏览器来源直接调用，且限流计数非原子

- 位置：`src/admin/routes/public-ai.ts`
  - `isSameOriginRequest` 对缺失 `Origin` 的请求直接放行（第 123-127 行）
  - `/terminal-404` 未启用 Turnstile（第 546-553 行，`requireTurnstile: false`）
  - 限流计数为 KV 的 `get + put` 非原子更新（第 339-350 行）

### 问题说明

- 黑盒验证表明命令行可直接调用 `/api/ai/terminal-404` 并得到 200 返回。  
- 已有限流，但并发场景下非原子计数存在误差；攻击者通过 IP 轮换仍可放大调用成本。

### 修复建议（优先级 P1）

1. 终端接口也启用人机校验，或追加签名令牌/一次性挑战。  
2. `Origin` 缺失默认不放行（仅对白名单场景放行）。  
3. 限流迁移到原子计数方案（Durable Object/专用限流服务/D1 原子事务计数）。

---

## [低] F-04 JWT 密钥未做强制强度校验（配置失误风险）

- 位置：`src/admin/middleware/auth.ts`
  - `getJwtSecret` 直接接受任意字符串（第 61-63 行）
  - `createToken/verifyToken` 直接使用 `env.JWT_SECRET`（第 155-180 行）

### 风险说明

若部署时误配置为空或弱密钥，可能导致会话令牌可伪造风险上升。

### 修复建议（优先级 P2）

- 启动时强制校验密钥长度与熵（例如最少 32 字节随机值），不满足则拒绝启动。

---

## [低] F-05 健康检查端点暴露运行时间戳（信息最小化）

- 位置：`GET /api/health`
- 当前返回 `status + timestamp`。

### 修复建议（优先级 P3）

- 若无外部依赖该字段，可仅返回静态健康状态，减少可观测信息。

---

## 正向安全项（做得好的地方）

1. 安全响应头较完整：CSP、X-Frame-Options、Referrer-Policy、Permissions-Policy、COOP、HSTS（线上由 Cloudflare 注入）均已生效。  
2. 后台会话 Cookie 设置合理：`HttpOnly + Secure + SameSite=Strict`。  
3. 后台关键写操作普遍启用 CSRF 校验。  
4. Webmention 路由对重定向链路有逐跳校验，且能拦截跳转到私网地址。  
5. Markdown 渲染器对原始 HTML、危险协议链接有防护。  
6. 未发现源码/配置文件直接暴露（`.git`、`package.json`、`.dev.vars` 等线上均 404）。

## 建议修复顺序

1. **P0：先修头像代理 SSRF/SVG 问题（F-01）**  
2. **P1：依赖升级 + 公开 AI 接口风控增强（F-02, F-03）**  
3. P2/P3：配置强校验与信息最小化（F-04, F-05）

## 备注

- 本次审计以“源码 + 线上 HTTP 行为”为主，未包含侵入式漏洞利用（如后台凭证验证、真实内网探测、社会工程等）。
- 若你希望，我可以下一步直接按 P0/P1 给出最小改动补丁并附带回归测试。
