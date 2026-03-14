import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

describe("Pagefind 搜索集成", () => {
	test("搜索页接入客户端检索脚本与结果容器", async () => {
		const source = await readFile("src/pages/search.astro", "utf8");
		const searchScript = await readFile("public/pagefind-search.js", "utf8");

		assert.ok(source.includes("pagefind-search.js"));
		assert.ok(source.includes("pagefind-search-results"));
		assert.ok(source.includes("Pagefind"));
		assert.ok(searchScript.includes("搜索索引为空"));
		assert.ok(searchScript.includes("history.pushState"));
		assert.ok(searchScript.includes("buildSearchHref"));
		assert.ok(searchScript.includes("updateAddressBar(state, { mode: \"push\" })"));
		assert.match(
			searchScript,
			/form\.addEventListener\("submit",\s*async \(event\) => \{[\s\S]*updateAddressBar\(state,\s*\{\s*mode:\s*"push"\s*\}\);[\s\S]*performSearch\(context,\s*state\);[\s\S]*\}\);/u,
		);
	});

	test("索引构建脚本支持自动、本地与远端模式", async () => {
		const source = await readFile("scripts/build-pagefind-index.mjs", "utf8");

		assert.ok(source.includes('"auto"'));
		assert.ok(source.includes("--remote"));
		assert.ok(source.includes("--local"));
		assert.ok(source.includes("本地 D1 未读取到文章"));
		assert.ok(source.includes("pagefind-meta.json"));
		assert.ok(source.includes("npx"));
		assert.ok(source.includes("pagefind"));
	});

	test("package scripts 暴露 Pagefind 构建命令", async () => {
		const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
			scripts?: Record<string, string>;
		};

		assert.equal(
			packageJson.scripts?.["search:index:auto"],
			"node scripts/build-pagefind-index.mjs",
		);
		assert.equal(
			packageJson.scripts?.["search:index:local"],
			"node scripts/build-pagefind-index.mjs --local",
		);
		assert.equal(
			packageJson.scripts?.["search:index:remote"],
			"node scripts/build-pagefind-index.mjs --remote",
		);
		assert.match(packageJson.scripts?.build ?? "", /search:index:auto/u);
		assert.match(packageJson.scripts?.deploy ?? "", /search:index:remote/u);
	});
});
