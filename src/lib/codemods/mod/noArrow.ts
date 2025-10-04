/**
 * jscodeshift transform: convert arrow functions to regular functions.
 * - Preserves `async`.
 * - Converts `const name = () => {}` into `function name() {}` (including exported consts).
 * - If a var-declaration has multiple declarators, keeps the other declarators.
 *
 * Usage:
 *   npx jscodeshift -t arrow-to-function-fixed2.ts <files...> --parser=ts --extensions=ts,tsx
 * Try preview first:
 *   npx jscodeshift -t arrow-to-function-fixed2.ts src/ --parser=ts --extensions=ts,tsx --dry
 */

import { API, FileInfo, JSCodeshift } from 'jscodeshift';

export default function transformer(file: FileInfo, api: API) {
	const j: JSCodeshift = api.jscodeshift;
	const root = j(file.source);

	root.find(j.ArrowFunctionExpression).forEach((arrowPath) => {
		const { params, body, async } = arrowPath.node;

		// Build a block body (wrap single-expression arrows)
		const newBody =
			body.type === 'BlockStatement' ? body : j.blockStatement([j.returnStatement(body)]);

		// Simple function expression fallback for inline cases
		const makeFunctionExpression = (id: any = null) =>
			j.functionExpression(id, params, newBody, false, async);

		// Helper: find nearest ancestor node path of a given type
		const findAncestor = (p: any, type: string) => {
			let cur = p.parentPath;
			while (cur) {
				if (cur.node && cur.node.type === type) return cur;
				cur = cur.parentPath;
			}
			return null;
		};

		// 1) If arrow is the declaration init of a VariableDeclarator, try to produce a FunctionDeclaration
		const varDeclaratorPath = findAncestor(arrowPath, 'VariableDeclarator');
		if (
			varDeclaratorPath &&
			varDeclaratorPath.node.id &&
			varDeclaratorPath.node.id.type === 'Identifier'
		) {
			const nameId = varDeclaratorPath.node.id;
			const varDeclPath = varDeclaratorPath.parentPath; // VariableDeclaration
			if (varDeclPath && varDeclPath.node && varDeclPath.node.type === 'VariableDeclaration') {
				const varDeclNode = varDeclPath.node;

				// Create a function declaration preserving async
				const funcDecl = j.functionDeclaration(
					j.identifier(nameId.name),
					params,
					newBody,
					false, // generator
					async
				);

				// If the variable declaration is wrapped by `export ...`
				const possibleExportPath = varDeclPath.parentPath;
				if (
					possibleExportPath &&
					possibleExportPath.node &&
					possibleExportPath.node.type === 'ExportNamedDeclaration'
				) {
					// export const foo = ...
					j(possibleExportPath).replaceWith(j.exportNamedDeclaration(funcDecl, []));
					return;
				}

				// If the variable declaration contains exactly this declarator -> replace the whole var decl
				if (varDeclNode.declarations.length === 1) {
					j(varDeclPath).replaceWith(funcDecl);
					return;
				}

				// If there are multiple declarators, keep the remaining declarators and insert the function after
				const remaining = varDeclNode.declarations.filter((d) => d !== varDeclaratorPath.node);
				const remainingVarDecl = j.variableDeclaration(varDeclNode.kind, remaining);
				j(varDeclPath).replaceWith([remainingVarDecl, funcDecl]);
				return;
			}
		}

		// 2) Export default arrow: `export default () => {}` -> `export default function () {}`
		const exportDefaultPath = findAncestor(arrowPath, 'ExportDefaultDeclaration');
		if (exportDefaultPath && exportDefaultPath.node.declaration === arrowPath.node) {
			const funcDecl = j.functionDeclaration(null, params, newBody, false, async);
			j(exportDefaultPath).replaceWith(j.exportDefaultDeclaration(funcDecl));
			return;
		}

		// 3) If it's an assignment expression right-hand side: obj.x = () => {} or foo = () => {}
		const assignPath = findAncestor(arrowPath, 'AssignmentExpression');
		if (assignPath && assignPath.node.right === arrowPath.node) {
			const left = assignPath.node.left;
			// If it's a simple top-level `foo = () => {}` expression statement, convert to function declaration if left is Identifier
			if (
				left.type === 'Identifier' &&
				assignPath.parentPath &&
				assignPath.parentPath.node &&
				assignPath.parentPath.node.type === 'ExpressionStatement' &&
				assignPath.parentPath.parentPath &&
				assignPath.parentPath.parentPath.node &&
				assignPath.parentPath.parentPath.node.type === 'Program'
			) {
				// create function declaration: function foo() {}
				const funcDecl = j.functionDeclaration(
					j.identifier(left.name),
					params,
					newBody,
					false,
					async
				);
				j(assignPath.parentPath).replaceWith(funcDecl);
				return;
			}

			// Otherwise, keep assignment but replace RHS with function expression
			j(arrowPath).replaceWith(makeFunctionExpression(null));
			return;
		}

		// 4) Fallback: inline callback or property initializer etc. Replace arrow with function expression
		j(arrowPath).replaceWith(makeFunctionExpression(null));
	});

	return root.toSource({ quote: 'single', trailingComma: true });
}
