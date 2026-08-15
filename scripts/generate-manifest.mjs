import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const manifestPath = path.join(rootDir, "manifest.json");

const existing = fs.existsSync(manifestPath)
	? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
	: {};

const manifest = {
	id: "linkdex",
	name: "LinkDex",
	version: pkg.version,
	minAppVersion: existing.minAppVersion ?? "1.0.0",
	description: pkg.description,
	author: existing.author ?? "kbonn",
	authorUrl: existing.authorUrl ?? "https://github.com/kbonn",
	isDesktopOnly: existing.isDesktopOnly ?? false,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
console.log(`Wrote ${path.relative(process.cwd(), manifestPath)}`);
