import { print } from "recast";
import { namedTypes as n } from "ast-types";

import {
  findInTree,
  findLeftRight,
  findNextStatement,
  replace,
} from "./ast-helpers";

function getVariableDecl(node: n.ASTNode) {
  if (!n.VariableDeclaration.check(node)) return null;
  const declr = node.declarations[0];
  if (!n.VariableDeclarator.check(declr)) return null;
  if (!declr || !n.Identifier.check(declr.id)) return null;

  const name = declr.id.name;
  return { name, init: declr.init };
}

export function inlineConstants(tree: n.Node) {
  let possibleCount = 0;
  let editCount = 0;
  findInTree(tree, n.VariableDeclaration, (thisPath) => {
    // Ignore the declaration in the for loop `init`s: they are likely to be mutated
    if (n.ForStatement.check(thisPath.parentPath.node)) return;

    const variableDecl = getVariableDecl(thisPath.node);
    if (!variableDecl || !variableDecl.init) return;

    // Don't inline BWIPP_VERSION
    if (variableDecl.name === "BWIPP_VERSION") return;

    const litValue = print(variableDecl.init).code;
    if (litValue !== "Infinity" && !n.Literal.check(variableDecl.init)) return;

    let next = findNextStatement(thisPath);
    while (true) {
      if (!next) break;
      const { node, path } = next;

      // Stop on statements we cannot analyze in-depth yet
      if (n.IfStatement.check(node)) break;
      if (n.WhileStatement.check(node)) break;
      if (n.ForStatement.check(node)) break;
      if (n.ForAwaitStatement.check(node)) break;

      // Stop on redeclaration or reassignment of the same variable
      const leftRight = findLeftRight(node);
      if (leftRight && leftRight.left === variableDecl.name) {
        break;
      }

      findInTree(node, n.Identifier, (idPath) => {
        if (idPath.node.name === variableDecl.name) {
          replace(idPath, litValue);
        }
      });

      next = findNextStatement(path);

      //   if (!n.ExpressionStatement.check(node)) continue;
      //   if (!n.AssignmentExpression.check(node.expression)) continue;
      //   if (print(node.expression.right).code !== "$k[--$j]") return;

      // console.log("pair");
      // console.log(j(thisNode).toSource());
      // console.log(j(node).toSource());
    }
    possibleCount++;

    const originalDeclaration = print(thisPath.node).code;
    // Temporarily comment out the original declaration to make sure we don't count that identifier
    replace(thisPath, "throw new Error('this cannot be left in code');\n");

    // Check if the variable has been fully eliminated
    const identifiers: n.Identifier[] = [];
    findInTree(thisPath.parent.node, n.Identifier, (id) =>
      identifiers.push(id.node)
    );
    const ids = new Set(identifiers.map((id) => id.name));
    // console.log({ ids });

    if (ids.has(variableDecl.name)) {
      // We must keep it, there is some other reference
      //   console.log("KEEPING", variableDecl.name);
      replace(thisPath, originalDeclaration + ";\n");
    } else {
      editCount++;
      thisPath.prune();
    }
  });
  console.log(
    "literal-inlining edit count",
    editCount,
    "out of",
    possibleCount
  );
  return editCount;
}
