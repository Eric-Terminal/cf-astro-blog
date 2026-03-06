const slugInput = document.getElementById("slug");
const titleInput = document.getElementById("title");
const tagIdsInput = document.getElementById("tagIds");

function updateSlugFromTitle() {
	if (!(titleInput instanceof HTMLInputElement)) {
		return;
	}

	if (!(slugInput instanceof HTMLInputElement)) {
		return;
	}

	if (slugInput.dataset.manual === "true") {
		return;
	}

	slugInput.value = titleInput.value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function updateTagIds() {
	if (!(tagIdsInput instanceof HTMLInputElement)) {
		return;
	}

	const checkedValues = Array.from(
		document.querySelectorAll("input[data-tag-checkbox='true']"),
	)
		.filter(
			(node): node is HTMLInputElement =>
				node instanceof HTMLInputElement && node.checked,
		)
		.map((node) => node.value);

	tagIdsInput.value = checkedValues.join(",");
}

titleInput?.addEventListener("input", updateSlugFromTitle);

slugInput?.addEventListener("input", () => {
	if (slugInput instanceof HTMLInputElement) {
		slugInput.dataset.manual = "true";
	}
});

for (const checkbox of document.querySelectorAll("input[data-tag-checkbox='true']")) {
	checkbox.addEventListener("change", updateTagIds);
}

for (const button of document.querySelectorAll("button[data-copy-value]")) {
	button.addEventListener("click", async () => {
		const value = button.getAttribute("data-copy-value") ?? "";
		if (!value) {
			return;
		}

		await navigator.clipboard.writeText(value);
	});
}

for (const form of document.querySelectorAll("form[data-confirm-message]")) {
	form.addEventListener("submit", (event) => {
		const message = form.getAttribute("data-confirm-message");
		if (message && !window.confirm(message)) {
			event.preventDefault();
		}
	});
}
