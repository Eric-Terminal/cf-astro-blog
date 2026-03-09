(function initAnalyticsTracking() {
	if (typeof window === "undefined") {
		return;
	}

	if (window.__ET_ANALYTICS_INITIALIZED__) {
		return;
	}
	window.__ET_ANALYTICS_INITIALIZED__ = true;

	const SESSION_KEY = "et_analytics_session_id";
	const LAST_TOUCH_KEY = "et_analytics_last_touch_at";
	const PAGE_MARK_PREFIX = "et_analytics_last_page:";
	const SESSION_TOUCH_INTERVAL_MS = 10 * 60 * 1000;
	const PAGE_DEDUP_INTERVAL_MS = 3000;

	const doNotTrack =
		navigator.doNotTrack === "1" ||
		window.doNotTrack === "1" ||
		navigator.globalPrivacyControl === true;
	if (doNotTrack) {
		return;
	}

	function createSessionId() {
		if (window.crypto?.randomUUID) {
			return window.crypto.randomUUID().replaceAll("-", "");
		}

		const randomPart = Math.random().toString(36).slice(2);
		return `${Date.now().toString(36)}${randomPart}`.slice(0, 32);
	}

	function getSessionId() {
		try {
			const existing = localStorage.getItem(SESSION_KEY);
			if (existing && /^[a-z0-9_-]{16,64}$/i.test(existing)) {
				return existing;
			}

			const next = createSessionId();
			localStorage.setItem(SESSION_KEY, next);
			return next;
		} catch {
			return createSessionId();
		}
	}

	function shouldTouchSession(now) {
		try {
			const raw = localStorage.getItem(LAST_TOUCH_KEY);
			const lastTouch = raw ? Number(raw) : 0;
			if (!Number.isFinite(lastTouch) || now - lastTouch >= SESSION_TOUCH_INTERVAL_MS) {
				localStorage.setItem(LAST_TOUCH_KEY, String(now));
				return true;
			}
		} catch {
			return true;
		}

		return false;
	}

	function shouldTrackPage(pageUrl, now) {
		const key = `${PAGE_MARK_PREFIX}${pageUrl}`;
		try {
			const raw = sessionStorage.getItem(key);
			const last = raw ? Number(raw) : 0;
			if (Number.isFinite(last) && now - last < PAGE_DEDUP_INTERVAL_MS) {
				return false;
			}

			sessionStorage.setItem(key, String(now));
			return true;
		} catch {
			return true;
		}
	}

	function collectPayload() {
		const now = Date.now();
		const pageUrl = `${window.location.pathname}${window.location.search}`;
		if (!shouldTrackPage(pageUrl, now)) {
			return null;
		}

		const params = new URLSearchParams(window.location.search);
		return {
			sessionId: getSessionId(),
			pageUrl,
			pageTitle: document.title || null,
			referrer: document.referrer || null,
			utmSource: params.get("utm_source"),
			utmMedium: params.get("utm_medium"),
			utmCampaign: params.get("utm_campaign"),
			touchSession: shouldTouchSession(now),
		};
	}

	function sendPayload(payload) {
		const body = JSON.stringify(payload);
		if (navigator.sendBeacon) {
			const blob = new Blob([body], { type: "application/json" });
			if (navigator.sendBeacon("/api/analytics/track", blob)) {
				return;
			}
		}

		void fetch("/api/analytics/track", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "same-origin",
			keepalive: true,
			body,
		});
	}

	function trackPageView() {
		const payload = collectPayload();
		if (!payload) {
			return;
		}

		sendPayload(payload);
	}

	document.addEventListener("astro:page-load", trackPageView);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", trackPageView, { once: true });
		return;
	}

	trackPageView();
})();
