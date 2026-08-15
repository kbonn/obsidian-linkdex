# LinkDex

LinkDex helps you build and maintain a glossary of linkable terms, then automatically wraps matching words in your notes with wiki-style links (`[[...]]`).

## Installation

1. Open **Settings → Community plugins**.
2. Turn off **Restricted mode** if it is enabled.
3. Click **Browse**, search for **LinkDex**, and click **Install**.
4. Enable LinkDex from the **Community plugins** list.

LinkDex requires Obsidian 1.13.0 or later.

## Index file setup

LinkDex reads terms from a vault index file. By default, that file is `_index.md`.

Create the file in your vault with one term per line. Blank lines and lines starting with `//` are ignored as terms.

Example `_index.md`:

```text
// Glossary
machine learning
API
Obsidian

//Auto Indexed
Daily Notes
Project Alpha
```

- Lines above `//Auto Indexed` are manual terms you maintain yourself.
- Lines below `//Auto Indexed` are managed by LinkDex when you use the suggest workflow.

Set the index file path in **Settings → LinkDex → Terms file path**. Use a dedicated index file. LinkDex reads and writes this file when suggesting terms.

## Basic usage

### Link terms in the active note

1. Open a markdown note.
2. Run **Link terms in active file**, or click the link icon in the left ribbon.
3. LinkDex scans the open note and wraps matching index terms in `[[...]]`.

LinkDex matches whole words only, ignores case, prefers longer multi-word terms first, and skips existing wikilinks, markdown links, fenced code blocks, and inline code.

## Hotkeys

Both commands can be assigned hotkeys in **Settings → Hotkeys**:

| Command | What it does |
| --- | --- |
| **Link terms in active file** | Wrap matching index terms in the current note |
| **Suggest index terms from vault** | Open the term suggestion modal |

To assign a hotkey:

1. Open **Settings → Hotkeys**.
2. Search for `LinkDex` or the command name.
3. Click the plus icon next to the command and press your preferred key combination.

## Auto index suggestions

Use **Suggest index terms from vault** to build your index from note titles already in your vault.

1. Run the command from the command palette or via a hotkey.
2. LinkDex collects markdown note names from your vault and removes:
   - Terms already in your index file
   - Terms you previously marked **Don't suggest again**
3. A modal lists the remaining note names with two checkbox columns:
   - **Add** — append the term to the `//Auto Indexed` section of your index file
   - **Don't suggest again** — hide the term from future suggestion runs
4. Click **Add to index** to apply your selections.

Added terms are merged into the `//Auto Indexed` section in alphabetical order without duplication. Manual terms above the marker are preserved unchanged.

## Development

For local development, clone this repository, run `npm install`, then `npm run dev` or `npm run build`.

## License

LinkDex is licensed under the GNU General Public License v3.0 or later. See [LICENSE](LICENSE).
