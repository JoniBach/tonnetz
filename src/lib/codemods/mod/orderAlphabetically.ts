import { API, FileInfo } from 'jscodeshift';

export default function transformer(file: FileInfo, api: API) {
	const j = api.jscodeshift;
	const root = j(file.source);

	// Find all top-level function declarations
	const funcDecls = root.find(j.FunctionDeclaration).nodes();

	if (funcDecls.length === 0) return null;

	// Sort alphabetically by function name
	funcDecls.sort((a, b) => {
		const nameA = a.id?.name ?? '';
		const nameB = b.id?.name ?? '';
		return nameA.localeCompare(nameB);
	});

	// Remove original function declarations
	root.find(j.FunctionDeclaration).remove();

	// Insert sorted functions at the top
	const programNode = root.get().node; // safer access
	if (programNode.type === 'File' && programNode.program?.body) {
		programNode.program.body = [...funcDecls, ...programNode.program.body];
	} else if (programNode.type === 'Program' && programNode.body) {
		programNode.body = [...funcDecls, ...programNode.body];
	} else {
		console.error('Unexpected AST structure:', programNode.type);
		return null;
	}

	return root.toSource({ quote: 'single', trailingComma: true });
}
