import { print } from "recast";
import { namedTypes as n, builders as b } from "ast-types";

import {
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findPrevStatement,
  genVariable,
  getPushedValue,
  insertAfter,
  replace,
  findTrailingPushes,
  isStatementStackPure,
  isExpressionStackPure,
} from "./ast-helpers";
import { NodePath } from "ast-types/lib/node-path";
import { printOutTree } from "./ast-printout";

export function simplifyIfForAccumulator(tree: n.Node) {
  let editCount = 0;
  findInTree(tree, n.Statement, (ifForPath) => {
    if (
      !n.IfStatement.check(ifForPath.node) &&
      !n.ForStatement.check(ifForPath.node) &&
      !n.ForOfStatement.check(ifForPath.node)
    ) {
      return;
    }
    if (n.IfStatement.check(ifForPath.node)) {
      // The if else statements are handled by extract common push/pop refactor first
      if (ifForPath.node.alternate) return;
      if (!isExpressionStackPure(ifForPath.get("test"))) return;
    }

    const pushesBehind = findTrailingPushes(ifForPath, false);
    if (pushesBehind.length === 0) return;
    const accPush = pushesBehind.slice(-1)[0];

    const bodyPath: NodePath = n.IfStatement.check(ifForPath.node)
      ? ifForPath.get("consequent")
      : n.ForStatement.check(ifForPath.node)
      ? ifForPath.get("body")
      : ifForPath.get("body");

    // TODO: Analyze one-liner blocks too
    if (!n.BlockStatement.check(bodyPath.node)) return;

    const refactorFn = refactorSingleAccumulatorPopPush(bodyPath);
    if (refactorFn) {
      const variableName = genVariable();
      insertAfter(ifForPath, `$k[$j++] = ${variableName};\n`);
      refactorFn(variableName);
      replace(
        accPush.path,
        `var ${variableName} = ${print(accPush.val).code}\n`
      );
      editCount++;
    }
  });
  console.log("if/for accumulators simplification", editCount);
  return editCount;
}

function refactorSingleAccumulatorPopPush(
  bodyPath: NodePath<n.BlockStatement>
): ((variableName: string) => void) | null {
  // console.log("TRYING FROM", bodyPath.node.type, bodyPath.value);
  // printOutTree(bodyPath.node, "");
  const { leadingPops, trailingPushes } =
    findLeadingPopsAndTrailingPushes(bodyPath);

  if (leadingPops.length > 0 && trailingPushes.length > 0) {
    return (variableName: string) => {
      const lastPush = trailingPushes.slice(-1)[0]!;
      // replace(
      //   lastPush.path,
      //   `${variableName} = ${print(lastPush.val).code};\n`
      // );
      lastPush.path.replace(
        b.expressionStatement(
          b.assignmentExpression("=", b.identifier(variableName), lastPush.val)
        )
      );
      leadingPops[0].eliminate(variableName);
    };
  }
  // Only continue with deeper refactor if the top level block doesn't have leading and trailing pushes
  if (leadingPops.length > 0 || trailingPushes.length > 0) return null;

  const subRefactors: ((variableName: string) => void)[] = [];
  // Find all the internal block (ifs or fors) with a leading pop and a trailing push
  for (let i = 0; i < bodyPath.node.body.length; ++i) {
    const stmtPath: NodePath = bodyPath.get("body").get(i);
    if (isStatementStackPure(stmtPath)) {
      continue;
    } else if (
      n.IfStatement.check(stmtPath.node) &&
      isExpressionStackPure(stmtPath.get("test"))
    ) {
      const refactorFn = refactorSingleAccumulatorPopPush(
        stmtPath.get("consequent")
      );
      if (!refactorFn) return null;
      subRefactors.push(refactorFn);
    } else if (
      n.ForOfStatement.check(stmtPath.node) &&
      isExpressionStackPure(stmtPath.get("right"))
    ) {
      const refactorFn = refactorSingleAccumulatorPopPush(stmtPath.get("body"));
      if (!refactorFn) return null;
      subRefactors.push(refactorFn);
    } else if (
      n.ForStatement.check(stmtPath.node) &&
      (!stmtPath.node.init || isExpressionStackPure(stmtPath.get("init"))) &&
      (!stmtPath.node.test || isExpressionStackPure(stmtPath.get("test"))) &&
      (!stmtPath.node.update || isExpressionStackPure(stmtPath.get("update")))
    ) {
      const refactorFn = refactorSingleAccumulatorPopPush(stmtPath.get("body"));
      if (!refactorFn) return null;
      subRefactors.push(refactorFn);
    } else {
      // console.error("Cannot analyze statement type", stmtPath.node.type);
      return null;
    }
  }
  return (variableName) => {
    for (const ref of subRefactors.toReversed()) ref(variableName);
  };
}
