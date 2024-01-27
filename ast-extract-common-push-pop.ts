import { print } from "recast";
import { namedTypes as n } from "ast-types";

import {
  findFunctionBody,
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findLeadingPopsFrom,
  findNextStatement,
  genVariable,
  insertAfter,
  insertBefore,
  isExitingBlock,
  replace,
} from "./ast-helpers";
import { NodePath } from "ast-types/lib/node-path";
import { printOutTree } from "./ast-printout";

export function simplifyBranchesWithCommonPush(tree: n.Node) {
  let editCount = 0;
  findInTree(tree, n.IfStatement, (ifPath) => {
    if (!ifPath.node.alternate) return;
    if (!n.BlockStatement.check(ifPath.node.consequent)) return;
    if (!n.BlockStatement.check(ifPath.node.alternate)) return;

    const { trailingPushes: p1 } = findLeadingPopsAndTrailingPushes(
      ifPath.get("consequent")
    );
    const { trailingPushes: p2 } = findLeadingPopsAndTrailingPushes(
      ifPath.get("alternate")
    );

    const commonLength = Math.min(p1.length, p2.length);
    const p1_ = p1.slice(-commonLength);
    const p2_ = p2.slice(-commonLength);
    const data = Array.from(new Array(commonLength), (_, i) => ({
      push1: p1_[i],
      push2: p2_[i],
      variableName: genVariable(),
    }));

    for (const { push1, push2, variableName } of data) {
      insertBefore(ifPath, `var ${variableName};\n`);
      replace(push1.path, `${variableName} = ${print(push1.val).code};\n`);
      replace(push2.path, `${variableName} = ${print(push2.val).code};\n`);
    }
    for (const { variableName } of data.slice().reverse()) {
      insertAfter(ifPath, `$k[$j++] = ${variableName};\n`);
    }

    editCount += commonLength;
  });

  console.log("both branches common push", editCount);
  return editCount;
}

// function isExitingBlock(
//   blockPath: NodePath<n.BlockStatement>,
//   onlyThrows = false
// ) {
//   if (!n.BlockStatement.check(blockPath.node))
//     throw new Error("Please only pass paths to block statements");
//   const ret = isExitingBlock_(blockPath, onlyThrows);
//   printOutTree(blockPath.node, "");
//   console.log("isExitingBlock", ret);
//   return ret;
// }

export function simplifyExitingBranchesWithCommonPop(tree: n.Node) {
  let editCount = 0;
  findInTree(tree, n.IfStatement, (ifPath) => {
    if (!n.BlockStatement.check(ifPath.node.consequent)) return;
    if (ifPath.node.alternate) return;
    if (!isExitingBlock(ifPath.get("consequent"))) return;

    const afterStatement = findNextStatement(ifPath);
    if (!afterStatement) return;

    function analyze(path: NodePath) {
      return findLeadingPopsFrom(path, true)[0];
    }

    const firstPopOn1 = analyze(ifPath.get("consequent").get("body").get(0));
    const firstPopOn2 = analyze(afterStatement.path);

    if (firstPopOn1 && firstPopOn2) {
      // console.log("REPLACING", findPathNames(expr));
      const variableName = genVariable();
      insertBefore(ifPath, `var ${variableName} = $k[--$j];\n`);
      firstPopOn1.eliminate(variableName);
      firstPopOn2.eliminate(variableName);
      editCount++;
    }
  });
  console.log(`both branches common pop`, editCount);
  return editCount;
}

export function simplifyBranchesWithCommonPop(tree: n.Node) {
  let editCount = 0;
  findInTree(tree, n.IfStatement, (ifPath) => {
    if (!ifPath.node.alternate) return;
    if (!n.BlockStatement.check(ifPath.node.consequent)) return;
    if (!n.BlockStatement.check(ifPath.node.alternate)) return;

    function analyze(path: NodePath) {
      return findLeadingPopsAndTrailingPushes(path).leadingPops[0];
    }

    const firstPopOn1 = analyze(ifPath.get("consequent"));
    const firstPopOn2 = analyze(ifPath.get("alternate"));

    if (firstPopOn1 && firstPopOn2) {
      // console.log("REPLACING", findPathNames(expr));
      const variableName = genVariable();
      insertBefore(ifPath, `var ${variableName} = $k[--$j];\n`);
      firstPopOn1.eliminate(variableName);
      firstPopOn2.eliminate(variableName);
      editCount++;
    }
  });
  console.log(`both branches common pop`, editCount);
  return editCount;
}
