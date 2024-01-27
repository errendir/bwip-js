import { print } from "recast";
import { namedTypes as n, builders as b } from "ast-types";

import {
  findAllParents,
  findFunctionBody,
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findLeftRight,
  findNextStatement,
  findPathNames,
  findPotentialDynamicAccessLiterals,
  findRightNode,
  findRightPath,
  genVariable,
  insertAfter,
  insertBefore,
  replace,
} from "./ast-helpers";
import { NodePath } from "ast-types/lib/node-path";
import { printOutTree } from "./ast-printout";

function findAllReachableFns(body: NodePath<n.BlockStatement>) {
  const fnBodies: NodePath<n.BlockStatement>[] = [];
  findInTree(body, n.CallExpression, (callPath) => {
    const fnBody = findFunctionBody(callPath, print(callPath.node.callee).code);
    if (fnBody) {
      fnBodies.push(fnBody);
    }
  });
  return fnBodies;
}

// Certain refactors we want to only perform starting from the "top-level" functions
const topLevelCallFns = ["bwipp_qrcode"];

export function removeUnusedVars(tree: n.Node) {
  let editCount = 0;

  // Find all the top level functions and go through each one by one
  findInTree(tree, n.FunctionDeclaration, (fnPath) => {
    const pathNames = findPathNames(fnPath);
    if (pathNames.length > 5) {
      // The function is not top-level
      return;
    }
    if (
      !fnPath.node.id ||
      !topLevelCallFns.includes(print(fnPath.node.id).code)
    ) {
      return;
    }

    editCount += removeUnusedVarsInOneTopLevelFn(fnPath);
  });
  console.log("removed variables from the $_. scope", editCount);

  return editCount;
}

function removeUnusedVarsInOneTopLevelFn(
  fnPath: NodePath<n.FunctionDeclaration>
) {
  let editCount = 0;
  const allReachableFns = Array.from(
    new Set([fnPath.get("body"), ...findAllReachableFns(fnPath.get("body"))])
  );
  console.log(
    "All fns reachable from",
    print(fnPath.node.id!).code,
    allReachableFns.map((fn) => print(fn.parentPath.node.id).code)
  );

  const strLiterals = new Set<string>();
  for (const fnBody of allReachableFns) {
    for (const lit of findPotentialDynamicAccessLiterals(fnBody)) {
      strLiterals.add(lit);
    }
  }
  console.log(
    "All potential dynamic calls",
    strLiterals.size,
    ...Array.from(strLiterals).map((str) => JSON.stringify(str))
  );

  const opsByVarName: Map<
    string,
    {
      reads: { path: NodePath; scopeFnBody: NodePath }[];
      writes: { path: NodePath; scopeFnBody: NodePath }[];
    }
  > = new Map();

  for (const fnBody of allReachableFns) {
    visitParamAssignments(fnBody, ({ stmtPath, originalVarName, varName }) => {
      // We don't remove the $_.xyz = ... assignemnts for vars that can be dynamically called via $_[sth]
      if (strLiterals.has(varName)) return;

      const ops = opsByVarName.get(varName) ?? {
        reads: [],
        writes: [],
      };
      ops.writes.push({ path: stmtPath, scopeFnBody: fnBody });
      opsByVarName.set(varName, ops);
    });

    findInTree(fnBody, n.MemberExpression, (mmbrPath) => {
      if (print(mmbrPath.node.object).code !== "$_") return;
      if (mmbrPath.node.computed) return;

      const isLeftSideOfAssignemnt =
        n.AssignmentExpression.check(mmbrPath.parentPath.node) &&
        mmbrPath.parentPath.node.left === mmbrPath.node;
      if (isLeftSideOfAssignemnt) return;
      const varName = print(mmbrPath.node.property).code;

      const ops = opsByVarName.get(varName) ?? {
        reads: [],
        writes: [],
      };
      ops.reads.push({ path: mmbrPath, scopeFnBody: fnBody });
      opsByVarName.set(varName, ops);
    });
  }

  // Go through all the variables without reads
  const varsToDelete = new Set<string>();
  for (const [varName, ops] of opsByVarName.entries()) {
    if (ops.reads.length > 0) continue;
    varsToDelete.add(varName);
  }
  varsToDelete.size > 0 &&
    console.log("Deleting writes without reads for", ...varsToDelete);

  for (const fnBody of allReachableFns) {
    for (const fnBody of allReachableFns) {
      visitParamAssignments(
        fnBody,
        ({ stmtPath, originalVarName, varName }) => {
          if (varsToDelete.has(varName)) {
            editCount++;
            stmtPath.prune();
          }
        }
      );
    }
  }

  console.log(
    "FN",
    print(fnPath.node.id!).code,

    ...Array.from(opsByVarName.entries()).map(([key, val]) => [
      key,
      { w: val.writes.length, r: val.reads.length },
    ])
  );

  return editCount;
}

function visitParamAssignments(
  fnBody: NodePath,
  callback: (data: {
    varName: string;
    originalVarName: string;
    stmtPath: NodePath;
  }) => void
) {
  findInTree(fnBody, n.ExpressionStatement, (stmtPath) => {
    if (!n.AssignmentExpression.check(stmtPath.node.expression)) return;
    const leftRight = findLeftRight(stmtPath.node);
    if (!leftRight) throw new Error("WAT?");
    if (!leftRight.left.startsWith("$_.")) return;
    const originalVarName = leftRight.left;
    const varName = leftRight.left.replace("$_.", "");

    callback({ varName, originalVarName, stmtPath });
  });
}
