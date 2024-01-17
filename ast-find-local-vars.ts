import { print } from "recast";
import { namedTypes as n } from "ast-types";

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
import { NodePath } from "ast-types/lib/node-path";

export function findLocalVars(tree: n.Node) {
  let editCount = 0;

  // Find all the top level functions and go through each one by one
  findInTree(tree, n.FunctionDeclaration, (fnPath) => {
    const pathNames = findPathNames(fnPath);
    if (pathNames.length > 5) {
      // The function is not top-level
      return;
    }

    editCount += processLocalVariablesInScope(fnPath);
  });
  console.log("removed variables from the $_. scope", editCount);

  return editCount;
}

function processLocalVariablesInScope(scope: NodePath) {
  let editCount = 0;

  const dataByVariable = new Map<
    string,
    { writes: NodePath[]; reads: NodePath[] }
  >();
  findInTree(scope, n.ExpressionStatement, (stmtPath) => {
    if (isInDefinerBlock(stmtPath)) return;
    if (!n.AssignmentExpression.check(stmtPath.node.expression)) return;
    const leftRight = findLeftRight(stmtPath.node);
    if (!leftRight) throw new Error("WAT?");
    if (!leftRight.left.startsWith("$_.")) return;
    const varName = leftRight.left.replace("$_.", "");

    const data = dataByVariable.get(varName) ?? { writes: [], reads: [] };
    dataByVariable.set(varName, data);

    data.writes.push(stmtPath);
  });

  findInTree(scope, n.MemberExpression, (mmbrPath) => {
    const varName = print(mmbrPath.node).code.replace("$_.", "");

    const data = dataByVariable.get(varName);
    if (!data) return;

    if (
      data.writes.some((write) =>
        isChild(write.get("expression").get("left"), mmbrPath.node)
      )
    ) {
      return;
    }

    data.reads.push(mmbrPath);
  });

  for (const [variableName, { reads, writes }] of dataByVariable.entries()) {
    console.log(variableName);
    let allReadsOK = true;
    for (const mmbrPath of reads) {
      const overwhelmingWrite = writes.find(
        (write) => determineEvalOrder(write, mmbrPath) === "correct-order"
      );
      if (!overwhelmingWrite) allReadsOK = false;
      // console.log("HAS OW", !!overwhelmingWrite);
    }
    console.log({ allReadsOK, readCount: reads.length });
  }

  // console.log(
  //   "dataByVariable",
  //   dataByVariable.get("blim")?.reads.map((r) => findPathNames(r))
  // );

  return editCount;
}

function isInDefinerBlock(path: NodePath) {
  return findAllParents(path).some((parentPath) => {
    if (!n.BlockStatement.check(parentPath.node)) return false;

    return parentPath.node.body.some(
      (stmt) =>
        n.ForInStatement.check(stmt) &&
        print(stmt.right).code === "$_" &&
        print(stmt.left).code === "var id"
    );
  });
}

function isChild(parent: NodePath, node: n.Node) {
  if (parent.node === node) return true;
  let found = false;
  findInTree(parent, n.Node, (n) => (found = n.node === node));
  return found;
}

function findAllParents(node: NodePath) {
  const parents: NodePath[] = [];
  let path: NodePath | null = node;
  while (path !== null) {
    parents.push(path);
    path = path.parentPath;
  }
  return parents.reverse();
}

function findCommonParent(node1: NodePath, node2: NodePath) {
  const parents1 = findAllParents(node1);
  const parents2 = findAllParents(node2);

  if (parents1[0] !== parents2[0])
    throw new Error("Two nodes without a common ancestor!");

  for (let i = 1; i < parents1.length && i < parents2.length; ++i) {
    if (parents1[i] !== parents2[i]) {
      return parents1[i - 1];
    }
  }
  return parents1.length < parents2.length
    ? parents1[parents1.length - 1]
    : parents2[parents2.length - 1];
}

function determineEvalOrder(node1: NodePath, node2: NodePath) {
  const parents1 = findAllParents(node1);
  const parents2 = findAllParents(node2);

  const commonParent = findCommonParent(node1, node2);
  const nextPaths1 = parents1.slice(parents1.indexOf(commonParent) + 1);
  const nextPaths2 = parents2.slice(parents2.indexOf(commonParent) + 1);

  if (
    nextPaths1.some(
      (p) =>
        n.FunctionDeclaration.check(p.node) ||
        n.FunctionExpression.check(p.node)
    )
  )
    return "cannot-determine" as const;
  if (
    nextPaths2.some(
      (p) =>
        n.FunctionDeclaration.check(p.node) ||
        n.FunctionExpression.check(p.node)
    )
  )
    return "cannot-determine" as const;

  if (n.IfStatement.check(commonParent.node))
    return "cannot-determine" as const;

  // console.log(
  //   "commonParent.node",
  //   print(commonParent.node).code,
  //   commonParent.node.type,
  //   nextPaths1[0].name,
  //   nextPaths2[0].name
  // );
  if (n.BlockStatement.check(commonParent.node)) {
    if (
      typeof nextPaths1[0].name === "number" &&
      typeof nextPaths2[0].name === "number"
    ) {
      if (nextPaths1[0].name < nextPaths2[0].name) {
        return "correct-order";
      } else {
        return "wrong-order";
      }
    }
  }
}
