function appendTerminalLine(logNode, text, type) {
	if (!(logNode instanceof HTMLElement)) {
		return;
	}

	const line = document.createElement("p");
	line.className = `terminal-line terminal-line-${type}`;
	line.textContent = String(text ?? "");
	logNode.appendChild(line);
	logNode.scrollTop = logNode.scrollHeight;
}

function appendTerminalBlock(logNode, text, type) {
	const lines = String(text ?? "").replaceAll("\r", "").split("\n");
	if (lines.length === 0) {
		appendTerminalLine(logNode, "", type);
		return;
	}

	for (const line of lines) {
		appendTerminalLine(logNode, line, type);
	}
}

function trimTerminalLines(logNode, limit = 160) {
	if (!(logNode instanceof HTMLElement)) {
		return;
	}

	while (logNode.children.length > limit) {
		logNode.firstElementChild?.remove();
	}
}

function initNotFoundTerminal() {
	const root = document.querySelector("[data-not-found-terminal='true']");
	if (!(root instanceof HTMLElement)) {
		return;
	}

	if (root.dataset.terminalReady === "true") {
		return;
	}
	root.dataset.terminalReady = "true";

	const logNode = root.querySelector("[data-terminal-log='true']");
	const formNode = root.querySelector("[data-terminal-form='true']");
	const inputNode = root.querySelector("[data-terminal-input='true']");
	const aiEndpoint = root.dataset.aiEndpoint || "/api/ai/terminal-404";
	const missingPath = root.dataset.missingPath || "/";
	const cwd = normalizeTerminalPath(missingPath);
	const promptPrefix = `guest@404:${cwd}$`;

	if (
		!(logNode instanceof HTMLElement) ||
		!(formNode instanceof HTMLFormElement) ||
		!(inputNode instanceof HTMLInputElement)
	) {
		return;
	}

	const setPendingState = (pending) => {
		if (pending) {
			formNode.dataset.pending = "true";
		} else {
			delete formNode.dataset.pending;
		}
		inputNode.disabled = pending;
	};

	appendTerminalLine(
		logNode,
		"提示：输入 clear 或 cls 可清屏。",
		"system",
	);
	trimTerminalLines(logNode);
	inputNode.focus();

	formNode.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (formNode.dataset.pending === "true") {
			return;
		}

		const command = inputNode.value.trim();
		if (!command) {
			return;
		}

		appendTerminalLine(logNode, `${promptPrefix} ${command}`, "command");
		inputNode.value = "";

		if (command.toLowerCase() === "clear" || command.toLowerCase() === "cls") {
			logNode.innerHTML = "";
			appendTerminalLine(
				logNode,
				`[404] 未找到路径：${missingPath}`,
				"system",
			);
			appendTerminalLine(logNode, "终端已清屏。", "system");
			inputNode.focus();
			return;
		}

		setPendingState(true);
		appendTerminalLine(logNode, "...正在连接外接 AI 终端...", "system");

		try {
			const response = await fetch(aiEndpoint, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "same-origin",
				body: JSON.stringify({
					message: command,
					cwd,
				}),
			});

			logNode.lastElementChild?.remove();

			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				appendTerminalLine(
					logNode,
					`[error] ${payload?.error || `请求失败（${response.status}）`}`,
					"error",
				);
				return;
			}

			const reply = String(payload?.reply ?? "").trim();
			if (!reply) {
				appendTerminalLine(logNode, "(无输出)", "system");
				return;
			}

			if (reply === "TERMINAL_CLEAR") {
				logNode.innerHTML = "";
				appendTerminalLine(logNode, "终端已清屏。", "system");
				return;
			}

			appendTerminalBlock(logNode, reply, "output");
			trimTerminalLines(logNode);
		} catch (error) {
			logNode.lastElementChild?.remove();
			appendTerminalLine(
				logNode,
				`[error] ${error instanceof Error ? error.message : "网络异常，请稍后重试"}`,
				"error",
			);
		} finally {
			setPendingState(false);
			inputNode.focus();
		}
	});
}

function normalizeTerminalPath(pathname) {
	const raw = String(pathname ?? "").trim();
	if (!raw) {
		return "/";
	}

	let normalized = raw.startsWith("/") ? raw : `/${raw}`;
	normalized = normalized.replaceAll(/\/+/g, "/");
	if (normalized.length > 180) {
		return `${normalized.slice(0, 177)}...`;
	}
	return normalized;
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initNotFoundTerminal, {
		once: true,
	});
} else {
	initNotFoundTerminal();
}

document.addEventListener("astro:page-load", initNotFoundTerminal);
