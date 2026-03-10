// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "server",
	prefetch: {
		prefetchAll: true,
		defaultStrategy: "viewport",
	},
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
	site: "https://blog.ericterminal.com",
	vite: {
		resolve: {
			alias: {
				"@": "/src",
			},
		},
	},
});
