---
name: new-post
description: 'Create a new blog post markdown file with standard frontmatter for this Astro blog. Use when: user wants to write, create, add, or generate a new blog post, article, or markdown file.'
argument-hint: 'Provide the article title to generate frontmatter'
---

# New Blog Post

## When to Use
- User says "create a new post" / "write an article" / "新建文章" / "新建博客"
- User provides an article title and wants frontmatter generated
- User wants a `.md` file created in `content/posts/` with proper YAML frontmatter

## Procedure

### 1. Ask for Required Info

Only ask the user for the **title** (required). Everything else is auto-generated:
- Status defaults to `published`, with current time as `publishedAt`
- Author defaults to `Kiwi`
- Tags and category left empty (auto-created during sync)
- If the user volunteers extra info (like tags or category), include it

### 2. Generate Frontmatter

Generate ALL 15 fields from the Frontmatter 字段说明 table with these auto-generated defaults:

| Field | Auto-generated value |
|-------|---------------------|
| `title` | User-provided title |
| `slug` | Auto-generated from title: lowercase, replace non-alphanumeric with hyphens |
| `status` | `published` |
| `publishedAt` | Current UTC time in ISO format (`YYYY-MM-DDTHH:mm:ssZ`) |
| `excerpt` | Empty string `''` |
| `authorName` | `Kiwi` |
| `category` | Empty string `''` |
| `tags` | Empty list `[]` |
| `metaTitle` | Empty string `''` |
| `metaDescription` | Empty string `''` |
| `metaKeywords` | Empty string `''` |
| `canonicalUrl` | Empty string `''` |
| `featuredImageKey` | Empty string `''` |
| `isPinned` | `false` |
| `pinnedOrder` | `100` |

### 3. Create the File

- File path: `content/posts/<slug>.md`
- Include ALL 15 frontmatter fields. Keep empty fields as empty strings (e.g. `excerpt: ''`). Keep empty arrays as `tags: []`.
- Add a blank `<!-- more -->` comment after the introductory paragraph for the excerpt break
- Suggest the user fill in the body content

### 4. Frontmatter Template

```markdown
---
title: {{title}}
slug: {{slug}}
status: {{status}}
publishedAt: {{publishedAt}}
excerpt: {{excerpt}}
authorName: {{authorName}}
category: {{category}}
tags:
  - {{tag1}}
  - {{tag2}}
metaTitle: {{metaTitle}}
metaDescription: {{metaDescription}}
metaKeywords: {{metaKeywords}}
canonicalUrl: {{canonicalUrl}}
featuredImageKey: {{featuredImageKey}}
isPinned: {{isPinned}}
pinnedOrder: {{pinnedOrder}}
---

{{Write your introduction here.}}

<!-- more -->

{{Write the rest of your content here.}}
```

**Important**: All 15 fields must be present in the frontmatter. Do not omit any field.

### 5. Slug Generation Rule

From title to slug:
1. Convert to lowercase
2. Replace runs of non-letter/non-number characters with hyphens
3. Remove leading/trailing hyphens
4. Truncate to 120 characters
5. Example: `"Hello World! 2024"` → `hello-world-2024`
