import { print } from "recast";
import { namedTypes as n, builders as b } from "ast-types";

import {
  findAllParents,
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findPrevStatement,
  genVariable,
  getPushedValue,
  insertAfter,
  replace,
} from "./ast-helpers";

export function extractIntDivision(tree: n.Node) {
  let editCount = 0;
  findInTree(tree, n.UnaryExpression, (exprPath) => {
    // Don't refactor the $id function itself
    if (
      findAllParents(exprPath).some(
        (p) => n.FunctionDeclaration.check(p.node) && p.node.id?.name === "$id"
      )
    )
      return;

    // Look for ~~(a / b) expressions
    if (exprPath.node.operator !== "~") return;
    if (!n.UnaryExpression.check(exprPath.node.argument)) return;
    if (exprPath.node.argument.operator !== "~") return;
    if (!n.BinaryExpression.check(exprPath.node.argument.argument)) return;
    if (exprPath.node.argument.argument.operator !== "/") return;

    const division = exprPath.node.argument.argument;

    exprPath.replace(
      b.callExpression(b.identifier("$id"), [division.left, division.right])
    );
    // replace(
    //   exprPath,
    //   `$id(${print(division.left).code}, ${print(division.right).code})`
    // );
    editCount++;
  });
  console.log("replaced integer divisions", editCount);
  return editCount;
}
