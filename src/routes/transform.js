export default function transformer(file, api) {
	const j = api.jscodeshift;

	return j(file.source)
		.find(j.ArrowFunctionExpression)
		.replaceWith((p) => {
			const body = j.BlockStatement.check(p.value.body)
				? p.value.body
				: j.blockStatement([j.returnStatement(p.value.body)]);

			return j.functionExpression(
				null, // no name (anonymous)
				p.value.params, // keep params
				body, // new body
				false, // generator = false
				p.value.async // preserve async
			);
		})
		.toSource({ quote: 'single' });
}
