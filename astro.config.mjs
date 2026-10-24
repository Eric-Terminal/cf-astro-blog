// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "server",
	// 升级编译器后继续保留行内元素之间的空格，避免正文排版发生变化。
	compressHTML: true,
	prefetch: {
		prefetchAll: true,
		defaultStrategy: "viewport",
	},
	adapter: cloudflare(),
	site: "https://blog.ericterminal.com",
	vite: {
		build: {
			// Lightning CSS 会在 WebKit 声明后误删标准 backdrop-filter，导致生产环境玻璃失效。
			// 保持升级前的 CSS 压缩器，保留两种声明：https://github.com/parcel-bundler/lightningcss/issues/1327
			cssMinify: "esbuild",
		},
		resolve: {
			alias: {
				"@": "/src",
			},
		},
	},
});
