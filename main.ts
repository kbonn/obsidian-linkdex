import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Vault,
} from "obsidian";

interface AutoLinkSettings {
	termsFilePath: string;
}

const DEFAULT_SETTINGS: AutoLinkSettings = {
	termsFilePath: "terms.txt",
};

type SegmentType = "text" | "code" | "wikilink" | "markdown-link";

interface Segment {
	type: SegmentType;
	value: string;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isInsideWikilink(str: string, matchIndex: number): boolean {
	const before = str.slice(0, matchIndex);
	const lastOpen = before.lastIndexOf("[[");
	if (lastOpen === -1) {
		return false;
	}
	const lastClose = before.lastIndexOf("]]");
	return lastOpen > lastClose;
}

export async function loadTerms(
	vault: Vault,
	path: string
): Promise<string[] | null> {
	const file = vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		return null;
	}

	const content = await vault.read(file);
	const terms = content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.sort((a, b) => b.length - a.length);

	return terms;
}

export function segmentContent(content: string): Segment[] {
	const segments: Segment[] = [];
	let i = 0;

	while (i < content.length) {
		if (content.startsWith("```", i)) {
			const end = content.indexOf("```", i + 3);
			if (end !== -1) {
				const endPos = end + 3;
				segments.push({ type: "code", value: content.slice(i, endPos) });
				i = endPos;
				continue;
			}
		}

		if (content[i] === "`") {
			const end = content.indexOf("`", i + 1);
			if (end !== -1) {
				segments.push({ type: "code", value: content.slice(i, end + 1) });
				i = end + 1;
				continue;
			}
		}

		if (content.startsWith("[[", i)) {
			const end = content.indexOf("]]", i + 2);
			if (end !== -1) {
				const endPos = end + 2;
				segments.push({ type: "wikilink", value: content.slice(i, endPos) });
				i = endPos;
				continue;
			}
		}

		if (content[i] === "[") {
			const closeBracket = content.indexOf("]", i + 1);
			if (closeBracket !== -1 && content[closeBracket + 1] === "(") {
				const closeParen = content.indexOf(")", closeBracket + 2);
				if (closeParen !== -1) {
					const endPos = closeParen + 1;
					segments.push({
						type: "markdown-link",
						value: content.slice(i, endPos),
					});
					i = endPos;
					continue;
				}
			}
		}

		let j = i + 1;
		while (j < content.length) {
			if (content.startsWith("```", j)) {
				break;
			}
			if (content[j] === "`") {
				break;
			}
			if (content.startsWith("[[", j)) {
				break;
			}
			if (content[j] === "[") {
				break;
			}
			j++;
		}

		segments.push({ type: "text", value: content.slice(i, j) });
		i = j;
	}

	return segments;
}

export function linkTermsInSegment(
	text: string,
	terms: string[]
): { text: string; count: number } {
	let result = text;
	let count = 0;

	for (const term of terms) {
		const escaped = escapeRegex(term);
		const regex = new RegExp(`\\b(${escaped})\\b`, "gi");

		result = result.replace(regex, (match, _captured, offset) => {
			if (isInsideWikilink(result, offset)) {
				return match;
			}
			count++;
			return `[[${match}]]`;
		});
	}

	return { text: result, count };
}

export function processNote(
	content: string,
	terms: string[]
): { content: string; count: number } {
	const segments = segmentContent(content);
	let totalCount = 0;

	const processed = segments.map((segment) => {
		if (segment.type !== "text") {
			return segment.value;
		}

		const { text, count } = linkTermsInSegment(segment.value, terms);
		totalCount += count;
		return text;
	});

	return { content: processed.join(""), count: totalCount };
}

export default class AutoLinkPlugin extends Plugin {
	settings: AutoLinkSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new AutoLinkSettingTab(this.app, this));
		this.addRibbonIcon("link", "Auto link terms in active file", () => {
			void this.linkTermsInActiveFile();
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async linkTermsInActiveFile() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			new Notice("No active markdown file.");
			return;
		}

		const terms = await loadTerms(this.app.vault, `${this.settings.termsFilePath}.md`);
		if (terms === null) {
			new Notice(`Terms file not found: ${this.settings.termsFilePath}`);
			return;
		}
		if (terms.length === 0) {
			new Notice(`Terms file is empty: ${this.settings.termsFilePath}`);
			return;
		}

		const editor = view.editor;
		const original = editor.getValue();
		const { content, count } = processNote(original, terms);

		if (content === original) {
			new Notice("No changes");
			return;
		}

		editor.setValue(content);
		new Notice(count === 1 ? "Linked 1 term" : `Linked ${count} terms`);
	}
}

class AutoLinkSettingTab extends PluginSettingTab {
	plugin: AutoLinkPlugin;

	constructor(app: App, plugin: AutoLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Auto Link settings" });

		new Setting(containerEl)
			.setName("Terms file path")
			.setDesc("Vault-relative path to the terms file. One term per line.")
			.addText((text) =>
				text
					.setPlaceholder("terms")
					.setValue(this.plugin.settings.termsFilePath)
					.onChange(async (value) => {
						this.plugin.settings.termsFilePath = value.trim() || "terms";
						await this.plugin.saveSettings();
					})
			);
	}
}
