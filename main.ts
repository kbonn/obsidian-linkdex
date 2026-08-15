import {
	App,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Vault,
} from "obsidian";

const AUTO_INDEX_MARKER = "//Auto Indexed";
const INDEX_COMMENT_PREFIX = "//";

interface LinkDexSettings {
	termsFilePath: string;
	dontSuggestAgain: string[];
}

const DEFAULT_SETTINGS: LinkDexSettings = {
	termsFilePath: "_index.md",
	dontSuggestAgain: [],
};

interface ParsedIndexFile {
	manualSection: string;
	autoTerms: string[];
	allTerms: string[];
}

type SegmentType = "text" | "code" | "wikilink" | "markdown-link";

interface Segment {
	type: SegmentType;
	value: string;
}

function isIndexCommentLine(line: string): boolean {
	return line.startsWith(INDEX_COMMENT_PREFIX);
}

function extractTermsFromLines(lines: string[]): string[] {
	return lines
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !isIndexCommentLine(line));
}

export function parseIndexFile(content: string): ParsedIndexFile {
	const lines = content.split("\n");
	const markerIndex = lines.findIndex((line) => line.trim() === AUTO_INDEX_MARKER);

	if (markerIndex === -1) {
		const allTerms = extractTermsFromLines(lines);
		return { manualSection: content, autoTerms: [], allTerms };
	}

	const manualSection = lines.slice(0, markerIndex).join("\n");
	const autoTerms = extractTermsFromLines(lines.slice(markerIndex + 1));
	const manualTerms = extractTermsFromLines(lines.slice(0, markerIndex));
	const allTerms = [...manualTerms, ...autoTerms];

	return { manualSection, autoTerms, allTerms };
}

export function buildVaultList(vault: Vault, excludePath: string): string[] {
	const excludeBasename = excludePath.replace(/\.md$/i, "").split("/").pop() ?? "";
	const seen = new Set<string>();
	const terms: string[] = [];

	for (const file of vault.getMarkdownFiles()) {
		if (file.path === excludePath) {
			continue;
		}

		const basename = file.basename;
		const key = basename.toLowerCase();
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		if (basename.toLowerCase() !== excludeBasename.toLowerCase()) {
			terms.push(basename);
		}
	}

	return terms.sort((a, b) => a.localeCompare(b));
}

export function filterVaultList(
	vaultList: string[],
	existingTerms: string[],
	dontSuggestAgain: string[]
): string[] {
	const excluded = new Set(
		[...existingTerms, ...dontSuggestAgain].map((term) => term.toLowerCase())
	);

	return vaultList.filter((term) => !excluded.has(term.toLowerCase()));
}

export function mergeAutoTerms(existingAuto: string[], newTerms: string[]): string[] {
	const seen = new Set<string>();
	const merged: string[] = [];

	for (const term of [...existingAuto, ...newTerms]) {
		const key = term.toLowerCase();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		merged.push(term);
	}

	return merged.sort((a, b) => a.localeCompare(b));
}

export function formatIndexFile(manualSection: string, autoTerms: string[]): string {
	const trimmedManual = manualSection.replace(/\n+$/, "");
	const autoSection = autoTerms.join("\n");

	if (autoTerms.length === 0) {
		return trimmedManual.length > 0 ? `${trimmedManual}\n` : "";
	}

	if (trimmedManual.length === 0) {
		return `${AUTO_INDEX_MARKER}\n${autoSection}\n`;
	}

	return `${trimmedManual}\n\n${AUTO_INDEX_MARKER}\n${autoSection}\n`;
}

export async function writeAutoIndexedTerms(
	vault: Vault,
	path: string,
	newTerms: string[]
): Promise<boolean> {
	const file = vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		return false;
	}

	const content = await vault.read(file);
	const { manualSection, autoTerms } = parseIndexFile(content);
	const mergedAutoTerms = mergeAutoTerms(autoTerms, newTerms);
	await vault.modify(file, formatIndexFile(manualSection, mergedAutoTerms));
	return true;
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
	const { allTerms } = parseIndexFile(content);
	return allTerms.sort((a, b) => b.length - a.length);
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

class SuggestTermsModal extends Modal {
	private readonly terms: string[];
	private readonly plugin: LinkDexPlugin;
	private readonly addSelections = new Map<string, boolean>();
	private readonly skipSelections = new Map<string, boolean>();

	constructor(app: App, plugin: LinkDexPlugin, terms: string[]) {
		super(app);
		this.plugin = plugin;
		this.terms = terms;
		for (const term of terms) {
			this.addSelections.set(term, false);
			this.skipSelections.set(term, false);
		}
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		titleEl.setText("Suggest Index Terms");

		const tableContainer = contentEl.createDiv({ cls: "linkdex-suggest-table-container" });
		tableContainer.style.maxHeight = "400px";
		tableContainer.style.overflowY = "auto";

		const table = tableContainer.createEl("table", { cls: "linkdex-suggest-table" });
		const headerRow = table.createEl("tr");
		headerRow.createEl("th", { text: "Term" });
		headerRow.createEl("th", { text: "Add" });
		headerRow.createEl("th", { text: "Don't Suggest Again" });

		for (const term of this.terms) {
			const row = table.createEl("tr");
			row.createEl("td", { text: term });

			const addCell = row.createEl("td");
			const addCheckbox = addCell.createEl("input", { type: "checkbox" });
			addCheckbox.addEventListener("change", () => {
				this.addSelections.set(term, addCheckbox.checked);
				if (addCheckbox.checked) {
					this.skipSelections.set(term, false);
					skipCheckbox.checked = false;
				}
			});

			const skipCell = row.createEl("td");
			const skipCheckbox = skipCell.createEl("input", { type: "checkbox" });
			skipCheckbox.addEventListener("change", () => {
				this.skipSelections.set(term, skipCheckbox.checked);
				if (skipCheckbox.checked) {
					this.addSelections.set(term, false);
					addCheckbox.checked = false;
				}
			});
		}

		const footer = contentEl.createDiv({ cls: "linkdex-suggest-footer" });
		footer.style.marginTop = "1em";

		const addButton = footer.createEl("button", { text: "Add to Index", cls: "mod-cta" });
		addButton.addEventListener("click", () => {
			void this.handleSubmit();
		});
	}

	private async handleSubmit(): Promise<void> {
		const termsToAdd = this.terms.filter((term) => this.addSelections.get(term));
		const termsToSkip = this.terms.filter((term) => this.skipSelections.get(term));

		if (termsToAdd.length === 0 && termsToSkip.length === 0) {
			this.close();
			return;
		}

		if (termsToSkip.length > 0) {
			const existing = new Set(
				this.plugin.settings.dontSuggestAgain.map((term) => term.toLowerCase())
			);
			for (const term of termsToSkip) {
				if (!existing.has(term.toLowerCase())) {
					this.plugin.settings.dontSuggestAgain.push(term);
					existing.add(term.toLowerCase());
				}
			}
			await this.plugin.saveSettings();
		}

		if (termsToAdd.length > 0) {
			const success = await writeAutoIndexedTerms(
				this.app.vault,
				this.plugin.settings.termsFilePath,
				termsToAdd
			);
			if (!success) {
				new Notice(`Terms file not found: ${this.plugin.settings.termsFilePath}`);
				return;
			}
		}

		const messages: string[] = [];
		if (termsToAdd.length === 1) {
			messages.push("Added 1 term to index");
		} else if (termsToAdd.length > 1) {
			messages.push(`Added ${termsToAdd.length} terms to index`);
		}
		if (termsToSkip.length === 1) {
			messages.push("1 marked don't suggest again");
		} else if (termsToSkip.length > 1) {
			messages.push(`${termsToSkip.length} marked don't suggest again`);
		}

		new Notice(messages.join("; "));
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export default class LinkDexPlugin extends Plugin {
	settings: LinkDexSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new LinkDexSettingTab(this.app, this));
		this.addCommand({
			id: "linkdex-terms",
			name: "Link terms in active file",
			callback: () => {
				void this.linkTermsInActiveFile();
			},
		});
		this.addCommand({
			id: "linkdex-suggest-terms",
			name: "Suggest index terms from vault",
			callback: () => {
				void this.suggestIndexTerms();
			},
		});
		this.addRibbonIcon("link", "Link terms in active file", () => {
			void this.linkTermsInActiveFile();
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (!Array.isArray(this.settings.dontSuggestAgain)) {
			this.settings.dontSuggestAgain = [];
		}
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

		const terms = await loadTerms(this.app.vault, this.settings.termsFilePath);
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

	async suggestIndexTerms() {
		const file = this.app.vault.getAbstractFileByPath(this.settings.termsFilePath);
		if (!(file instanceof TFile)) {
			new Notice(`Terms file not found: ${this.settings.termsFilePath}`);
			return;
		}

		const content = await this.app.vault.read(file);
		const { allTerms } = parseIndexFile(content);
		const vaultList = buildVaultList(this.app.vault, this.settings.termsFilePath);
		const filtered = filterVaultList(
			vaultList,
			allTerms,
			this.settings.dontSuggestAgain
		);

		if (filtered.length === 0) {
			new Notice("No new terms to suggest.");
			return;
		}

		new SuggestTermsModal(this.app, this, filtered).open();
	}
}

class LinkDexSettingTab extends PluginSettingTab {
	plugin: LinkDexPlugin;

	constructor(app: App, plugin: LinkDexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "LinkDex settings" });

		new Setting(containerEl)
			.setName("Terms file path")
			.setDesc("Vault-relative path to the terms file. One term per line.")
			.addText((text) =>
				text
					.setPlaceholder("_index.md")
					.setValue(this.plugin.settings.termsFilePath)
					.onChange(async (value) => {
						this.plugin.settings.termsFilePath = value.trim() || "_index.md";
						await this.plugin.saveSettings();
					})
			);
	}
}
