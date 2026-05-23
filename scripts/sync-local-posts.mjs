import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import matter from "gray-matter";

const POSTS_DIR = join(process.cwd(), "content", "posts");
const SLUG_SEGMENT_RE = /[^\p{Letter}\p{Number}]+/gu;
const SLUG_VALID_RE = /^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u;
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

function resolveMode() {
  const arg = process.argv.find((a) => a === "--local" || a === "--remote");
  return arg === "--local" ? "local" : "remote";
}

function runD1(command, mode) {
  const modeFlag = mode === "remote" ? "--remote" : "--local";
  const stdout = execFileSync(
    NPX,
    ["wrangler", "d1", "execute", "DB", modeFlag, "--command", command, "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );

  const jsonStart = stdout.indexOf("[");
  const jsonEnd = stdout.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error("wrangler 输出中未找到可解析的 JSON 结果: " + stdout.slice(0, 500));
  }

  const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
  const rows = Array.isArray(parsed) ? parsed[0]?.results : [];
  return Array.isArray(rows) ? rows : [];
}

function escapeSql(value) {
  return String(value ?? "").replaceAll("'", "''");
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${escapeSql(value)}'`;
}

function sqlInt(value, fallback = "NULL") {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : fallback;
}

function buildSlug(title) {
  const normalized = String(title ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replaceAll(SLUG_SEGMENT_RE, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  if (SLUG_VALID_RE.test(normalized)) {
    return normalized.slice(0, 120).replaceAll(/-+$/g, "") || "post";
  }

  const uuid = crypto.randomUUID().slice(0, 8);
  return `post-${uuid}`;
}

function resolveSlug(slug, title, existingSlugs) {
  let base = slug || buildSlug(title);
  base = base.slice(0, 116);
  let candidate = base;
  let suffix = 2;
  while (existingSlugs.has(candidate) && suffix < 120) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  if (existingSlugs.has(candidate)) {
    candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`;
  }
  existingSlugs.add(candidate);
  return candidate;
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function collectPosts() {
  if (!existsSync(POSTS_DIR)) {
    console.log(`目录不存在: ${POSTS_DIR}`);
    return [];
  }

  const files = readdirSync(POSTS_DIR).filter(
    (f) => extname(f) === ".md" || extname(f) === ".mdx",
  );

  if (files.length === 0) {
    console.log("content/posts/ 中没有找到 .md 文件。");
    return [];
  }

  const posts = [];
  const localSlugSet = new Set();

  for (const file of files) {
    const raw = readFileSync(join(POSTS_DIR, file), "utf8");
    let data, content;
    try {
      const parsed = matter(raw);
      data = parsed.data;
      content = parsed.content;
    } catch (err) {
      console.error(`[跳过] ${file}: YAML frontmatter 解析失败 — ${err.message}`);
      continue;
    }

    const title =
      data.title?.trim() ||
      (content.match(/^#\s+(.+)$/m)?.[1]?.trim()) ||
      basename(file, extname(file));

    const slug = resolveSlug(data.slug || null, title, localSlugSet);

    let status = ["draft", "published", "scheduled"].includes(data.status)
      ? data.status
      : "draft";

    let publishedAt = null;
    let publishAt = null;

    if (status === "published") {
      publishedAt = parseDate(data.publishedAt || data.date) || new Date().toISOString();
      publishAt = publishedAt;
    } else if (status === "scheduled") {
      publishAt = parseDate(data.publishAt);
      if (!publishAt) {
        console.warn(`[警告] ${file}: status=scheduled 但缺少有效的 publishAt，降级为 published`);
        status = "published";
        publishedAt = new Date().toISOString();
        publishAt = publishedAt;
      }
    }

    const tagNames = Array.isArray(data.tags)
      ? data.tags.map((t) => String(t).trim()).filter(Boolean)
      : [];

    posts.push({
      file,
      slug,
      title,
      content: content.trim() || "",
      status,
      publishedAt,
      publishAt,
      excerpt: data.excerpt?.trim().slice(0, 200) || null,
      authorName: data.authorName?.trim().slice(0, 120) || "Admin",
      categoryName: data.category?.trim() || null,
      tagNames,
      metaTitle: data.metaTitle?.trim().slice(0, 200) || null,
      metaDescription: data.metaDescription?.trim().slice(0, 160) || null,
      metaKeywords: data.metaKeywords?.trim().slice(0, 200) || null,
      canonicalUrl: data.canonicalUrl?.trim() || null,
      featuredImageKey: data.featuredImageKey?.trim() || null,
      isPinned: data.isPinned === true ? 1 : 0,
      pinnedOrder: Number.isInteger(data.pinnedOrder) && data.pinnedOrder >= 1 && data.pinnedOrder <= 9999
        ? data.pinnedOrder
        : 100,
    });
  }

  return posts;
}

function lookupOrCreateCategory(name, mode) {
  const escaped = escapeSql(name);
  let rows = runD1(`SELECT id FROM blog_categories WHERE name = '${escaped}' LIMIT 1`, mode);
  if (rows.length > 0) return rows[0].id;

  const slug = buildSlug(name);
  const now = new Date().toISOString();
  runD1(
    `INSERT INTO blog_categories (name, slug, created_at, updated_at) VALUES ('${escapeSql(name)}', '${escapeSql(slug)}', '${escapeSql(now)}', '${escapeSql(now)}')`,
    mode,
  );
  rows = runD1(`SELECT id FROM blog_categories WHERE name = '${escaped}' LIMIT 1`, mode);
  if (rows.length > 0) {
    console.log(`  [创建分类] "${name}" (slug: ${slug})`);
    return rows[0].id;
  }
  return null;
}

function lookupOrCreateTag(name, mode) {
  const escaped = escapeSql(name);
  let rows = runD1(`SELECT id FROM blog_tags WHERE name = '${escaped}' LIMIT 1`, mode);
  if (rows.length > 0) return rows[0].id;

  const slug = buildSlug(name);
  const now = new Date().toISOString();
  runD1(
    `INSERT INTO blog_tags (name, slug, created_at) VALUES ('${escapeSql(name)}', '${escapeSql(slug)}', '${escapeSql(now)}')`,
    mode,
  );
  rows = runD1(`SELECT id FROM blog_tags WHERE name = '${escaped}' LIMIT 1`, mode);
  if (rows.length > 0) {
    console.log(`  [创建标签] "${name}" (slug: ${slug})`);
    return rows[0].id;
  }
  return null;
}

function syncPostTags(postId, tagNames, mode) {
  // Delete existing tag associations
  runD1(`DELETE FROM blog_post_tags WHERE post_id = ${postId}`, mode);

  // Insert new tag associations
  for (const name of tagNames) {
    const tagId = lookupOrCreateTag(name, mode);
    if (tagId !== null) {
      runD1(
        `INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id) VALUES (${postId}, ${tagId})`,
        mode,
      );
    }
  }
}

function sync() {
  const mode = resolveMode();
  const modeLabel = mode === "remote" ? "远程 D1" : "本地 D1";
  console.log(`同步模式: ${modeLabel}`);
  console.log(`目录: ${POSTS_DIR}\n`);

  const posts = collectPosts();
  if (posts.length === 0) {
    console.log("没有需要同步的文章。");
    return;
  }

  // Batch-check which slugs already exist in D1
  const slugList = posts.map((p) => `'${escapeSql(p.slug)}'`).join(", ");
  const existingRows = runD1(
    `SELECT slug FROM blog_posts WHERE slug IN (${slugList})`,
    mode,
  );
  const existingSlugSet = new Set(existingRows.map((r) => r.slug));

  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;

  for (const post of posts) {
    const exists = existingSlugSet.has(post.slug);
    const action = exists ? "更新" : "新建";

    // Resolve category ID
    const categoryId = post.categoryName
      ? lookupOrCreateCategory(post.categoryName, mode)
      : null;

    if (exists) {
      // UPDATE existing post
      runD1(
        [
          "UPDATE blog_posts SET",
          `title = ${sqlString(post.title)},`,
          `content = ${sqlString(post.content)},`,
          `excerpt = ${sqlString(post.excerpt)},`,
          `status = ${sqlString(post.status)},`,
          `publish_at = ${sqlString(post.publishAt)},`,
          `published_at = ${sqlString(post.publishedAt)},`,
          `featured_image_key = ${sqlString(post.featuredImageKey)},`,
          `is_pinned = ${post.isPinned},`,
          `pinned_order = ${post.pinnedOrder},`,
          `meta_title = ${sqlString(post.metaTitle)},`,
          `meta_description = ${sqlString(post.metaDescription)},`,
          `meta_keywords = ${sqlString(post.metaKeywords)},`,
          `canonical_url = ${sqlString(post.canonicalUrl)},`,
          `category_id = ${categoryId !== null ? categoryId : "NULL"},`,
          `author_name = ${sqlString(post.authorName)},`,
          `updated_at = ${sqlString(now)}`,
          `WHERE slug = ${sqlString(post.slug)}`,
        ].join(" "),
        mode,
      );
      updated++;
    } else {
      // INSERT new post
      runD1(
        [
          "INSERT INTO blog_posts",
          "(title, slug, content, excerpt, status, publish_at, published_at, featured_image_key, is_pinned, pinned_order, meta_title, meta_description, meta_keywords, canonical_url, category_id, author_name, created_at, updated_at)",
          "VALUES",
          `(${sqlString(post.title)}, ${sqlString(post.slug)}, ${sqlString(post.content)}, ${sqlString(post.excerpt)}, ${sqlString(post.status)}, ${sqlString(post.publishAt)}, ${sqlString(post.publishedAt)}, ${sqlString(post.featuredImageKey)}, ${post.isPinned}, ${post.pinnedOrder}, ${sqlString(post.metaTitle)}, ${sqlString(post.metaDescription)}, ${sqlString(post.metaKeywords)}, ${sqlString(post.canonicalUrl)}, ${categoryId !== null ? categoryId : "NULL"}, ${sqlString(post.authorName)}, ${sqlString(now)}, ${sqlString(now)})`,
        ].join(" "),
        mode,
      );
      inserted++;
    }

    // Fetch post ID for tag sync (only if tags are present)
    if (post.tagNames.length > 0) {
      const rows = runD1(
        `SELECT id FROM blog_posts WHERE slug = ${sqlString(post.slug)}`,
        mode,
      );
      if (rows.length > 0) {
        syncPostTags(rows[0].id, post.tagNames, mode);
      }
    }

    console.log(`  [${action}] ${post.file} → slug="${post.slug}" (${post.status})`);
  }

  console.log(`\n完成: ${inserted} 篇新建, ${updated} 篇更新, 共 ${posts.length} 篇`);
}

sync().catch((err) => {
  console.error("同步失败:", err);
  process.exit(1);
});
