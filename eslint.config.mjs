import obsidianmd from "eslint-plugin-obsidianmd";
import tsparser from "@typescript-eslint/parser";

export default [
	{
		ignores: [
			"main.js",
			"node_modules/**",
			"eslint.config.mjs",
			"esbuild.config.mjs",
			"scripts/**",
		],
	},
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
		rules: {
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					brands: ["LinkDex"],
					acronyms: ["API"],
				},
			],
		},
	},
];
