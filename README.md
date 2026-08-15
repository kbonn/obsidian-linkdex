# LinkDex

An Obsidian plugin that scans the active note for relevant terms and wraps whole-word matches in wiki-style links (`[[...]]`).

## Setup

1. Clone this repository.
2. Install dependencies and build:

```bash
npm install
npm run build
```

3. Copy or symlink the plugin into your vault:

```bash
mkdir -p /path/to/vault/.obsidian/plugins/linkdex
ln -s "$(pwd)/main.js" /path/to/vault/.obsidian/plugins/linkdex/main.js
ln -s "$(pwd)/manifest.json" /path/to/vault/.obsidian/plugins/linkdex/manifest.json
```

4. Enable **LinkDex** in Obsidian settings under Community plugins.

## Terms file

Create a file in your vault with one term per line. Blank lines and lines starting with `//` are ignored.

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

Lines starting with `//` are ignored as terms, except the `//Auto Indexed` marker which separates manually maintained terms from auto-managed terms.

Configure the vault-relative path in **Settings → LinkDex → Terms file path** (default: `_index.md`).

## Usage

### Link terms in active file

1. Open a markdown note.
2. Click the link icon in the left sidebar ribbon, or use the **Link terms in active file** hotkey.
3. LinkDex scans the active file and wraps matching terms in `[[...]]`.

### Suggest index terms from vault

1. Run **Suggest index terms from vault** from the command palette, or assign a hotkey in **Settings → Hotkeys**.
2. LinkDex scans all markdown note names in your vault and compares them against your index file and any terms you previously marked as "Don't Suggest Again".
3. A modal lists remaining note names with two checkbox columns:
   - **Add** — append the term to the `//Auto Indexed` section of your index file
   - **Don't Suggest Again** — hide the term from future suggestion runs
4. Click **Add to Index** to apply your selections.

Added terms are merged into the `//Auto Indexed` section in alphabetical order without duplication. Manual terms above the `//Auto Indexed` marker are preserved unchanged.

Matching rules:

- Whole words only
- Case-insensitive
- Longer multi-word terms are matched before shorter overlapping terms
- Existing `[[wikilinks]]`, markdown links, fenced code blocks, and inline code are left unchanged

## Development

```bash
npm run dev
```

This watches `main.ts` and rebuilds `main.js`.
