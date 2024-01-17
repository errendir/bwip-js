import { print } from "recast";
import { namedTypes as n } from "ast-types";

import {
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
    // Look for ~~(a / b) expressions
    if (exprPath.node.operator !== "~") return;
    if (!n.UnaryExpression.check(exprPath.node.argument)) return;
    if (exprPath.node.argument.operator !== "~") return;
    if (!n.BinaryExpression.check(exprPath.node.argument.argument)) return;
    if (exprPath.node.argument.argument.operator !== "/") return;

    const division = exprPath.node.argument.argument;

    replace(
      exprPath,
      `$id(${print(division.left).code}, ${print(division.right).code})`
    );
    editCount++;
  });
  console.log("replaced integer divisions", editCount);
  return editCount;
}
