---
title: Hello, World!
slug: hello-world
status: draft
excerpt: 这是一篇通过本地 Markdown 文件发布的示例文章。
authorName: Admin
tags:
  - 示例
  - 入门
isPinned: false
---

这是一篇通过 **本地 Markdown 文件** 发布到网站的示例文章。

<!-- more -->

## skill本地编写博客的工作流程

1. 在 `content/posts/` 目录下创建 `.md` 文件
2. 用 YAML frontmatter 设置标题、状态、分类和标签等信息

## Frontmatter 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | string | 正文第一个 `# 标题` | 文章标题 |
| `slug` | string | 从 title 自动生成 | URL 路径别名 |
| `status` | `draft` / `published` / `scheduled` | `draft` | 发布状态 |
| `publishedAt` | date | 同步时间 | 发布日期 |
| `excerpt` | string | 空 | 文章摘要 |
| `authorName` | string | `Admin` | 作者署名 |
| `category` | string | 空 | 分类名（自动创建新分类） |
| `tags` | string[] | `[]` | 标签列表（自动创建新标签） |
| `metaTitle` | string | 空 | 自定义 SEO 标题 |
| `metaDescription` | string | 空 | 自定义 SEO 描述 |
| `metaKeywords` | string | 空 | SEO 关键词 |
| `canonicalUrl` | string | 空 | 规范链接 |
| `featuredImageKey` | string | 空 | R2 封面图 key |
| `isPinned` | boolean | `false` | 是否在首页置顶 |
| `pinnedOrder` | number | `100` | 置顶排序（越小越靠前） |
