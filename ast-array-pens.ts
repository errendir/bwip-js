import { print } from "recast";
import { namedTypes as n, builders as b } from "ast-types";

import {
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findLeadingPopsFrom,
  findLeftRight,
  findNextStatement,
  findPrevStatement,
  findRightNode,
  findRightPath,
  genVariable,
  getPushedValue,
  insertAfter,
  isCallStackPure,
  isJMinusEquals,
  isJMinusMinus,
  isStatementStackPure,
  iterateOverStackPureExpressions,
  reparseExpression,
  replace,
} from "./ast-helpers";
import { NodePath } from "ast-types/lib/node-path";
import { printOutTree } from "./ast-printout";

type StackOutcome =
  | {
      type: "push";
      subtype: "aload" | "forall" | "direct" | "other";
      elementCount: number | null;
      redirect: (variableName: string) => void;
    }
  | {
      type: "pop";
      subtype: "astore" | "a()" | "direct" | "other";
      elementCount: number | null;
      redirect: (variableName: string) => void;
    }
  | { type: "unpredictable" }
  | { type: "no-effect"; redirect: (variableName: string) => void };

function computeMinStackSizeAfter(
  stackOutcomes: StackOutcome[]
): number | null {
  let minStackSize = 0;
  for (const outcome of stackOutcomes) {
    if (outcome.type === "unpredictable") return null;
    if (outcome.type === "push") {
      minStackSize += outcome.elementCount ?? 0;
    }
    if (outcome.type === "pop") {
      // We do not allow stack to be read below its guaranteed size
      if (outcome.elementCount === null) return null;
      if (minStackSize < outcome.elementCount) return null;
      minStackSize -= outcome.elementCount;
    }
  }

  return minStackSize;
}

function analyzeFlatStackOutcome(stmtPath: NodePath): StackOutcome {
  if (isStatementStackPure(stmtPath))
    return { type: "no-effect", redirect() {} };

  const node = stmtPath.node;

  if (n.VariableDeclaration.check(node)) {
    const leftRight = findLeftRight(node);
    if (leftRight?.right === "$k[--$j]") {
      return {
        type: "pop",
        subtype: "direct",
        elementCount: 1,
        redirect: (variableName: string) => {
          replace(stmtPath, `${leftRight.fullLeft} = ${variableName}.pop();\n`);
        },
      };
    }
  }

  if (n.ExpressionStatement.check(node)) {
    if (n.CallExpression.check(node.expression)) {
      if (print(node.expression.callee).code === "$aload") {
        const elementCount = findArraySize(node.expression.arguments[0]);
        const arg = print(node.expression.arguments[0]).code;
        return {
          type: "push",
          subtype: "aload",
          elementCount,
          redirect: (variableName) => {
            replace(stmtPath, `${variableName}.push(...$aload_it(${arg}));\n`);
          },
          // expr: print(node.expression.arguments[0]).code,
        };
      }
      if (
        print(node.expression.callee).code === "$forall" &&
        node.expression.arguments.length === 1
      ) {
        const arg = print(node.expression.arguments[0]).code;
        return {
          type: "push",
          subtype: "forall",
          elementCount: null,
          redirect: (variableName) => {
            replace(stmtPath, `${variableName}.push(...$forall_it(${arg}));\n`);
          },
          // expr: print(node.expression.arguments[0]).code,
        };
      }
      return { type: "unpredictable" };
    }
    if (isJMinusMinus(stmtPath.get("expression"))) {
      return {
        type: "pop",
        subtype: "direct",
        elementCount: 1,
        redirect: (variableName) => stmtPath.replace(makePopExpr(variableName)),
      };
    }
    const jMinusEquals = isJMinusEquals(stmtPath.get("expression"));
    if (jMinusEquals !== null) {
      return {
        type: "pop",
        subtype: "direct",
        elementCount: jMinusEquals,
        redirect: (variableName) => stmtPath.replace(makePopExpr(variableName)),
      };
    }
    if (print(node.expression).code === "$k[--$j]") {
      return {
        type: "pop",
        subtype: "direct",
        elementCount: 1,
        redirect: (variableName: string) => {
          stmtPath.prune();
        },
      };
    }
    if (n.AssignmentExpression.check(node.expression)) {
      if (print(node.expression.right).code === "$k[--$j]") {
        return {
          type: "pop",
          subtype: "direct",
          elementCount: 1,
          redirect: (variableName: string) => {
            stmtPath
              .get("expression")
              .get("right")
              .replace(makePopExpr(variableName));
          },
        };
      }

      if (print(node.expression.left).code !== "$k[$j++]")
        return { type: "unpredictable" };
      const right = print(node.expression.right).code;

      // The middle element cannot be Infinity since `$a()` only loads from the first Infinity, see TEST_INFINITY_ARRAY
      if (right === "Infinity") return { type: "unpredictable" };

      return {
        type: "push",
        subtype: "direct",
        elementCount: 1,
        redirect: (variableName: string) => {
          replace(stmtPath, `${variableName}.push(${right});\n`);
        },
      };
    }
  }

  if (n.BlockStatement.check(node)) {
    const outcomes: StackOutcome[] = [];
    for (let i = 0; i < node.body.length; ++i) {
      outcomes.push(analyzeFlatStackOutcome(stmtPath.get("body").get(i)));
    }
    const minStackSize = computeMinStackSizeAfter(outcomes);
    if (minStackSize === null) return { type: "unpredictable" };
    const redirect = (variableName: string) => {
      for (const o of outcomes) {
        if (o.type === "pop") o.redirect(variableName);
        if (o.type === "push") o.redirect(variableName);
        if (o.type === "no-effect") o.redirect(variableName);
      }
    };
    if (minStackSize > 0) {
      return { type: "push", subtype: "other", elementCount: null, redirect };
    }
    if (minStackSize < 0) {
      return { type: "pop", subtype: "other", elementCount: null, redirect };
    }
    return { type: "no-effect", redirect };
  }
  if (n.ForStatement.check(node) || n.ForOfStatement.check(node)) {
    return analyzeFlatStackOutcome(stmtPath.get("body"));
  }
  if (n.IfStatement.check(node)) {
    node.alternate;
    const side1: StackOutcome = analyzeFlatStackOutcome(
      stmtPath.get("consequent")
    );
    const side2: StackOutcome = node.alternate
      ? analyzeFlatStackOutcome(stmtPath.get("alternate"))
      : { type: "no-effect", redirect() {} };

    if (side1.type === "unpredictable" || side2.type === "unpredictable")
      return { type: "unpredictable" };

    if (side1.type === "push" && side2.type === "push")
      return {
        type: "push",
        subtype: "other",
        elementCount: Math.min(
          side1.elementCount ?? 0,
          side2.elementCount ?? 0
        ),
        redirect: (variableName: string) => {
          side1.redirect(variableName);
          side2.redirect(variableName);
        },
      };

    if (side1.type === "pop" && side2.type === "pop")
      return {
        type: "pop",
        subtype: "other",
        elementCount: Math.min(
          side1.elementCount ?? 0,
          side2.elementCount ?? 0
        ),
        redirect: (variableName: string) => {
          side1.redirect(variableName);
          side2.redirect(variableName);
        },
      };

    return { type: "unpredictable" };
  }

  const rightPath = findRightPath(stmtPath);
  if (rightPath && n.CallExpression.check(rightPath.node)) {
    if (isCallStackPure(rightPath)) {
      const pops: ((varName: string) => void)[] = [];
      for (let i = 0; i < rightPath.node.arguments.length; ++i) {
        for (const expr of iterateOverStackPureExpressions(
          rightPath.get("arguments").get(i),
          true,
          true
        )) {
          if (print(expr.node).code === "$k[--$j]") {
            pops.push((varName: string) => {
              expr.replace(makePopExpr(varName));
            });
          }
        }
      }
      return {
        type: "pop",
        subtype: "other",
        elementCount: pops.length,
        redirect: (varName: string) => {
          for (const o of pops) o(varName);
        },
      };
    }
  }

  // console.error("CANNOT ANALYZE");
  // printOutTree(stmtPath.node, "");
  return { type: "unpredictable" };
}

function makePopExpr(variableName: string) {
  return b.callExpression(
    b.memberExpression(b.identifier(variableName), b.identifier("pop")),
    []
  );
}

function findArraySize(node: n.Node) {
  if (
    n.CallExpression.check(node) &&
    print(node.callee).code === "$geti" &&
    node.arguments[2] &&
    n.Literal.check(node.arguments[2]) &&
    typeof node.arguments[2].value === "number"
  ) {
    return node.arguments[2].value;
  }
  return null;
}

export function arrayPens(tree: n.Node) {
  let editCount = 0;

  findInTree(tree, n.ExpressionStatement, (thisPath) => {
    const thisNode = thisPath.node;
    if (!print(thisNode).code.includes("$k[$j++] = Infinity;")) return;

    let ending: NodePath | null = null;
    const outcomes: StackOutcome[] = [];
    let currentStmt: ReturnType<typeof findNextStatement> = {
      node: thisPath.node,
      path: thisPath,
    };
    while ((currentStmt = findNextStatement(currentStmt.path)) !== null) {
      if (isEnding(currentStmt.node)) {
        ending = currentStmt.path;
        break;
      }

      // console.log("ANALYZING", print(currentStmt.node).code);
      const outcome = analyzeFlatStackOutcome(currentStmt.path);
      // console.log({ outcome });
      outcomes.push(outcome);

      const minStackSize = computeMinStackSizeAfter(outcomes);
      if (minStackSize === null) {
        break;
      }
    }

    if (!ending) return;

    const variableName = "ap_" + genVariable();
    replace(thisPath, `const ${variableName} = [];\n`);
    for (const outcome of outcomes) {
      if (outcome.type === "pop") outcome.redirect(variableName);
      if (outcome.type === "push") outcome.redirect(variableName);
      if (outcome.type === "no-effect") outcome.redirect(variableName);
    }
    const { fullLeft, right } = findLeftRight(ending.node)!;
    replace(ending, `${fullLeft} = $a(${variableName});\n`);
    editCount++;
  });

  function isEnding(node: any) {
    const leftRight = findLeftRight(node);
    return !!leftRight && leftRight.right === "$a()";
  }

  console.log("move the array creation off-stack", editCount);
  return editCount;
}
