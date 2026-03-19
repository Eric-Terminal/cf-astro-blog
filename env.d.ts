/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
	DB: D1Database;
	MEDIA_BUCKET: R2Bucket;
	SESSION: KVNamespace;
	ASSETS: Fetcher;

	SITE_NAME: string;
	SITE_URL: string;
	TURNSTILE_SITE_KEY: string;
	AUTO_DEPLOY_WEBHOOK_URL?: string;
	AUTO_DEPLOY_WEBHOOK_SECRET?: string;
	AUTO_DEPLOY_GITHUB_EVENT_TYPE?: string;

	JWT_SECRET: string;
	ADMIN_USERNAME: string;
	ADMIN_GITHUB_LOGIN: string;
	ADMIN_PASSWORD_HASH: string;
	TURNSTILE_SECRET_KEY: string;
	GITHUB_OAUTH_CLIENT_ID: string;
	GITHUB_OAUTH_CLIENT_SECRET: string;
	GITHUB_OAUTH_REDIRECT_URI: string;
	AI_INTERNAL_API_KEY?: string;
	AI_PUBLIC_API_KEY?: string;
	PUBLIC_AI_RATE_LIMIT_PER_MINUTE?: string;
	PUBLIC_AI_DAILY_LIMIT_PER_IP?: string;
	MCP_BEARER_TOKEN?: string;
	MCP_RATE_LIMIT_PER_MINUTE?: string;
	MCP_AUTH_FAIL_LIMIT_PER_MINUTE?: string;
	MCP_AUTH_BLOCK_SECONDS?: string;
}

declare namespace App {
	interface Locals extends Runtime {}
}
