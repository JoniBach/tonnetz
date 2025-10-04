/**
 * jscodeshift transform that alphabetically sorts all top-level function
 * declarations in a TypeScript file by their name.
 *
 * Usage:
 *   npx jscodeshift -t sort-functions-alphabetically.ts path/to/file.ts
 */

import { API, FileInfo, JSCodeshift } from 'jscodeshift';

export default function transformer(file: FileInfo, api: API) {
	const j: JSCodeshift = api.jscodeshift;
	const root = j(file.source);

	// Find all top-level function declarations (not inside other functions/classes)
	const body = root.get().value.program.body;
	const functionDecls = body.filter((node: any) => node.type === 'FunctionDeclaration' && node.id);

	if (functionDecls.length === 0) return file.source;

	// Extract function declarations and others separately
	const functions = functionDecls.map((node: any) => node);
	const others = body.filter((node: any) => !functions.includes(node));

	// Sort functions alphabetically by name
	functions.sort((a: any, b: any) =>
		a.id.name.localeCompare(b.id.name, 'en', { sensitivity: 'base' })
	);

	// Replace file body with sorted functions followed by the rest
	root.get().value.program.body = [...functions, ...others];

	return root.toSource({ quote: 'single', trailingComma: true });
}
