import { print, parse } from "recast";
import { namedTypes as n, builders as b, NodePath } from "ast-types";

import {
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findLeftRight,
  findPathNames,
  genVariable,
  insertAfter,
  insertBefore,
  replace,
} from "./ast-helpers";

export function rewriteForall(tree: n.Node) {
  let editCount = 0;

  findInTree(tree, n.ExpressionStatement, (forallCall) => {
    if (!n.CallExpression.check(forallCall.node.expression)) return;
    if (print(forallCall.node.expression.callee).code !== "$forall") return;
    if (forallCall.node.expression.arguments.length !== 2) return;

    const arg1 = forallCall.node.expression.arguments[0];
    if (n.SpreadElement.check(arg1)) throw new Error("Unexpected $forall arg");
    const bodyFn = forallCall.node.expression.arguments[1];
    if (!n.FunctionExpression.check(bodyFn))
      throw new Error("Unexpected $forall body");

    // if (Math.random() > 0.2) return;

    editCount++;
    forallCall.replace(
      b.forOfStatement(
        b.variableDeclaration("const", [
          b.variableDeclarator(b.identifier("___e")),
        ]),
        b.callExpression(b.identifier("$forall_it"), [arg1]),
        bodyFn.body
      )
    );

    insertBefore(
      new NodePath(bodyFn).get("body").get("body").get(0),
      `$k[$j++] = ___e;\n`
    );
  });

  console.log("replaced $forall with a callback with a loop", editCount);
  return editCount;
}
