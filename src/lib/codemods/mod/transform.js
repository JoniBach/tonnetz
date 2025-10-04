export default function transformer(file, api) {
	const j = api.jscodeshift;
	const root = j(file.source);

	// Keep track of functions we touched
	const rewrittenFunctions = new Set();

	// --- Step 1: Rewrite function declarations ---
	root.find(j.FunctionDeclaration).forEach((path) => {
		const usesGlobal = j(path).find(j.Identifier, { name: 'tonnetzSystemState' }).size() > 0;
		if (usesGlobal) {
			const id = path.value.id?.name;
			if (id) rewrittenFunctions.add(id);

			if (
				!path.value.params.some((p) => p.type === 'Identifier' && p.name === 'tonnetzSystemState')
			) {
				// Add tonnetzSystemState as the **last** param
				path.value.params.push(j.identifier('tonnetzSystemState'));
			}
		}
	});

	// --- Step 2: Rewrite function expressions assigned to consts ---
	root.find(j.VariableDeclarator, { init: { type: 'FunctionExpression' } }).forEach((path) => {
		const func = path.value.init;
		const name = path.value.id?.name;
		const usesGlobal = j(func).find(j.Identifier, { name: 'tonnetzSystemState' }).size() > 0;
		if (usesGlobal) {
			if (name) rewrittenFunctions.add(name);

			if (!func.params.some((p) => p.type === 'Identifier' && p.name === 'tonnetzSystemState')) {
				func.params.push(j.identifier('tonnetzSystemState'));
			}
		}
	});

	// --- Step 3: Rewrite call sites ---
	root.find(j.CallExpression).forEach((path) => {
		const callee = path.value.callee;
		if (callee.type === 'Identifier' && rewrittenFunctions.has(callee.name)) {
			const alreadyPassed =
				path.value.arguments.some(
					(arg) => arg.type === 'Identifier' && arg.name === 'tonnetzSystemState'
				) || false;

			if (!alreadyPassed) {
				// Add as last argument
				path.value.arguments.push(j.identifier('tonnetzSystemState'));
			}
		}
	});

	return root.toSource({ quote: 'single' });
}
