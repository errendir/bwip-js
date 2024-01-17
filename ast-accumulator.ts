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

export function simplifyIfForAccumulator(tree: n.Node) {
  let editCount = 0;
  findInTree(tree, n.Statement, (ifForPath) => {
    if (
      !n.IfStatement.check(ifForPath.node) &&
      !n.ForStatement.check(ifForPath.node) &&
      !n.ForOfStatement.check(ifForPath.node)
    )
      return;
    // TODO: Handle the if else statements too
    if (n.IfStatement.check(ifForPath.node) && ifForPath.node.alternate) return;

    const prevStmt = findPrevStatement(ifForPath);
    if (!prevStmt) return;
    if (!n.ExpressionStatement.check(prevStmt.node)) return;

    const pushedValue = getPushedValue(prevStmt.node);
    if (!pushedValue) return;

    const bodyPath = n.IfStatement.check(ifForPath.node)
      ? ifForPath.get("consequent")
      : n.ForStatement.check(ifForPath.node)
      ? ifForPath.get("body")
      : ifForPath.get("body");

    // TODO: Analyze one-liner blocks too
    if (!n.BlockStatement.check(bodyPath.node)) return;
    const { leadingPops, trailingPushes } =
      findLeadingPopsAndTrailingPushes(bodyPath);

    if (leadingPops.length > 0 && trailingPushes.length > 0) {
      const variableName = genVariable();
      replace(
        prevStmt.path,
        `var ${variableName} = ${print(pushedValue).code}\n`
      );
      leadingPops[0].eliminate(variableName);
      const lastPush = trailingPushes.slice(-1)[0]!;
      replace(lastPush.path, `${variableName} = ${print(lastPush.val).code}\n`);
      insertAfter(ifForPath, `$k[$j++] = ${variableName}\n`);
      editCount++;
    }
  });
  console.log("if/for accumulators simplification", editCount);
  return editCount;
}
