import assert from "node:assert/strict";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { build } from "astro";
import astroConfig from "../../astro.config.mjs";

test("生产构建保留玻璃面板与文章卡片的标准模糊声明", async () => {
	const root = await mkdtemp(join(tmpdir(), "cf-blog-glass-"));
	try {
		await mkdir(join(root, "src/pages"), { recursive: true });
		await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
		await writeFile(join(root, "package.json"), '{"type":"module"}');
		// 使用真实样式和项目构建配置，覆盖仅在生产压缩时删声明的回归。
		await writeFile(
			join(root, "src/pages/index.astro"),
			`---
import ${JSON.stringify(resolve("src/styles/global.css"))};
import ${JSON.stringify(resolve("src/styles/post-card.css"))};
---
<html lang="zh-CN"><head><title>玻璃构建回归</title></head><body>
<section class="glass-panel">面板</section>
<article class="post-card glass-panel">文章卡片</article>
</body></html>`,
		);
		await build({
			root,
			configFile: false,
			logLevel: "silent",
			build: { inlineStylesheets: "never" },
			vite: astroConfig.vite,
		});
		const assets = join(root, "dist/_astro");
		const files = (await readdir(assets)).filter((name) =>
			name.endsWith(".css"),
		);
		assert.ok(files.length > 0, "生产构建应生成 CSS 文件");
		const css = (
			await Promise.all(
				files.map((name) => readFile(join(assets, name), "utf8")),
			)
		).join("\n");
		for (const selector of ["\\.glass-panel::?after", "\\.post-card"]) {
			for (const property of ["backdrop-filter", "-webkit-backdrop-filter"]) {
				assert.ok(
					new RegExp(
						`${selector}\\s*\\{[^}]*[;{]\\s*${property}\\s*:\\s*blur\\(`,
						"u",
					).test(css),
					`生产 CSS 的 ${selector} 必须保留 ${property} 模糊声明`,
				);
			}
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
