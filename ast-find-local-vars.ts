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
  findRightNode,
  findRightPath,
  genVariable,
  insertAfter,
  insertBefore,
  replace,
} from "./ast-helpers";
import { NodePath } from "ast-types/lib/node-path";
import { printOutTree } from "./ast-printout";

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

function* expressionsInEvalWeakOrder(exprStmt: NodePath): Generator<NodePath> {
  if (n.Identifier.check(exprStmt.node)) {
    yield exprStmt;
  } else if (n.VariableDeclaration.check(exprStmt.node)) {
    // We allow variable declaration here since it may be a part of the for loop init
    const declrs = exprStmt.node.declarations;
    for (let i = 0; i < declrs.length; ++i) {
      const declr = declrs[i];
      if (n.VariableDeclarator.check(declr) && declr.init) {
        yield* expressionsInEvalWeakOrder(
          exprStmt.get("declarations").get(i).get("init")
        );
      }
    }
  } else if (n.Literal.check(exprStmt.node)) {
    yield exprStmt;
  } else if (n.ConditionalExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("test"));
    yield* expressionsInEvalWeakOrder(exprStmt.get("consequent"));
    yield* expressionsInEvalWeakOrder(exprStmt.get("alternate"));
    yield exprStmt;
  } else if (n.AssignmentExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("right"));
    // WARNING: There could technically be a read on the left as well
    yield exprStmt;
  } else if (n.NewExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("callee"));
    for (let i = 0; i < exprStmt.node.arguments.length; ++i) {
      yield* expressionsInEvalWeakOrder(exprStmt.get("arguments").get(i));
    }
    yield exprStmt;
  } else if (n.MemberExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("object"));
    yield* expressionsInEvalWeakOrder(exprStmt.get("property"));
    yield exprStmt;
  } else if (n.LogicalExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("left"));
    yield* expressionsInEvalWeakOrder(exprStmt.get("right"));
    yield exprStmt;
  } else if (n.BinaryExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("left"));
    yield* expressionsInEvalWeakOrder(exprStmt.get("right"));
    yield exprStmt;
  } else if (n.UnaryExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("argument"));
    yield exprStmt;
  } else if (n.UpdateExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("argument"));
    yield exprStmt;
  } else if (n.ArrayExpression.check(exprStmt.node)) {
    for (let i = 0; i < exprStmt.node.elements.length; ++i) {
      yield* expressionsInEvalWeakOrder(exprStmt.get("elements").get(i));
    }
    yield exprStmt;
  } else if (n.SpreadElement.check(exprStmt.node)) {
    exprStmt.node.argument;
    yield* expressionsInEvalWeakOrder(exprStmt.get("argument"));
    yield exprStmt;
  } else if (n.FunctionExpression.check(exprStmt.node)) {
    yield exprStmt;
  } else if (n.CallExpression.check(exprStmt.node)) {
    yield* expressionsInEvalWeakOrder(exprStmt.get("callee"));
    for (let i = 0; i < exprStmt.node.arguments.length; ++i) {
      yield* expressionsInEvalWeakOrder(exprStmt.get("arguments").get(i));
    }
    yield exprStmt;
  } else {
    console.log(exprStmt.node.type, printOutTree(exprStmt.node, ""));
    throw new Error("UNKNOWN EXPR");
  }
}

const dynamicFnsList = new Set(["bwipp_processoptions", "bwipp_parseinput"]);
// prettier-ignore
const fnsPureInAllVars = new Set([
  "$search", "$forall", "$d", "$a", "$s", "$z", "$strcpy", "$arrcpy", "$cvi", "$cvrs", "$cvx", "$get", "$put", "$geti", "$puti", "$type", "$eq", "$ne", "$lt", "$le", "$gt", "$ge", "$an", "$or", "$xo", "$nt", "$f",
  "$forall_it", "$aload_it", "$id",
  // TODO: Add the rest of those functions
  "$$.setcolor","$$.moveto","$$.lineto","$$.closepath","$$.fill","$$.newpath","$$.arc","$$.save","$$.translate","$$.scale","$$.show","$$.selectfont","$$.stringwidth","$$.charpath","$$.restore","$$.currpos","$$.pathbbox",
]);

// const cache = new Map<Node, boolean>();
function isFnPureInVar(
  callPath: NodePath<n.CallExpression>,
  varName: string
): "pure" | "impure" | "unknowable" {
  const fnName = print(callPath.node.callee).code;
  if (dynamicFnsList.has(fnName)) return "impure";
  if (fnsPureInAllVars.has(fnName)) return "pure";

  // All the Math functions are pure
  if (fnName.startsWith("Math.")) return "pure";
  if (fnName.endsWith(".keys")) return "pure";
  // All the array pushes are pure in any variable
  if (fnName.endsWith(".push") && !fnName.startsWith("$_.")) return "pure";

  const fnBody = findFunctionBody(callPath, fnName);
  if (!fnBody) {
    return "unknowable";
  } else {
    // if (cache.has(fnBody.node)) {
    //   return cache.get(fnBody.node)!;
    // }
    const fnBodyCode = print(fnBody.node).code;
    const isPureInVar = !fnBodyCode.includes(varName);
    // console.log("SEARCHING FOR ", varName, " IN ", fnBodyCode, isPureInVar);
    // cache.set(fnBody.node, isPureInVar);
    return isPureInVar ? "pure" : "impure";
  }
}

type VarAccess =
  | { type: "read"; path: NodePath; forDepth: number }
  | { type: "write"; path: NodePath; forDepth: number }
  | { type: "dynamic-read" }
  | { type: "dynamic-write" }
  | { type: "undetermined" }
  | {
      type: "call";
      isPureInVar: "pure" | "impure" | "unknowable";
      path: NodePath;
    }
  | { type: "early-exit"; path: NodePath };

function* findReadsAndWritesIn(
  stmtPath: NodePath,
  varName: string
): Generator<VarAccess> {
  // console.log("STARTING FROM", print(stmtPath.node).code);

  const processRootExpression = function* (
    path: NodePath
  ): Generator<VarAccess> {
    for (const exprPath of expressionsInEvalWeakOrder(path)) {
      if (print(exprPath.node).code === varName) {
        yield { type: "read", path: exprPath, forDepth: 0 };
      } else if (n.CallExpression.check(exprPath.node)) {
        const isPureInVar = isFnPureInVar(exprPath, varName);
        yield { type: "call", isPureInVar, path: exprPath };
      }
    }
  };

  const leftRight = findLeftRight(stmtPath.node);
  if (leftRight) {
    // Check if it's read:
    const right = findRightPath(stmtPath)!;
    yield* processRootExpression(right);

    // Check if it's write
    if (leftRight.left === varName) {
      yield { type: "write", path: stmtPath, forDepth: 0 };
    }
  } else if (n.VariableDeclaration.check(stmtPath.node)) {
    // Empty variable declaration, `findLeftRight` already took care of the ones with the initializer
  } else if (n.FunctionDeclaration.check(stmtPath.node)) {
  } else if (n.EmptyStatement.check(stmtPath.node)) {
  } else if (
    n.BreakStatement.check(stmtPath.node) ||
    n.ReturnStatement.check(stmtPath.node)
  ) {
    yield { type: "early-exit", path: stmtPath };
  } else if (n.ExpressionStatement.check(stmtPath.node)) {
    yield* processRootExpression(stmtPath.get("expression"));
  } else if (n.BlockStatement.check(stmtPath.node)) {
    const body = stmtPath.node.body;
    for (let i = 0; i < body.length; ++i) {
      yield* findReadsAndWritesIn(stmtPath.get("body").get(i), varName);
    }
  } else if (n.ForStatement.check(stmtPath.node)) {
    if (stmtPath.node.init) yield* processRootExpression(stmtPath.get("init"));
    if (stmtPath.node.test) yield* processRootExpression(stmtPath.get("test"));
    for (const v of findReadsAndWritesIn(stmtPath.get("body"), varName)) {
      if (v.type === "early-exit") continue;
      yield v.type === "read" || v.type === "write"
        ? { ...v, forDepth: v.forDepth + 1 }
        : v;
    }
    if (stmtPath.node.update)
      yield* processRootExpression(stmtPath.get("update"));
  } else if (n.ForOfStatement.check(stmtPath.node)) {
    yield* processRootExpression(stmtPath.get("right"));
    // Ignore the early exits from the body of the for loop since they are not early-exits past the
    // first variable write
    for (const v of findReadsAndWritesIn(stmtPath.get("body"), varName)) {
      if (v.type === "early-exit") continue;
      yield v.type === "read" || v.type === "write"
        ? { ...v, forDepth: v.forDepth + 1 }
        : v;
    }
  } else if (n.ForInStatement.check(stmtPath.node)) {
    // yield* processRootExpression(stmtPath.get("right"));
    yield { type: "undetermined" };
  } else if (n.IfStatement.check(stmtPath.node)) {
    yield* processRootExpression(stmtPath.get("test"));
    yield* findReadsAndWritesIn(stmtPath.get("consequent"), varName);
    if (stmtPath.node.alternate) {
      yield* findReadsAndWritesIn(stmtPath.get("alternate"), varName);
    }
  } else {
    console.log("Unknown statement", stmtPath.node.type);
    console.log(print(stmtPath.node).code);
    printOutTree(stmtPath.node, "");
    throw new Error("Unknown statement");
  }
}

function processLocalVariablesInScope(scope: NodePath) {
  let editCount = 0;

  findInTree(scope, n.ExpressionStatement, (stmtPath) => {
    if (isInDefinerBlock(stmtPath)) return;
    if (!n.AssignmentExpression.check(stmtPath.node.expression)) return;
    const leftRight = findLeftRight(stmtPath.node);
    if (!leftRight) throw new Error("WAT?");
    if (!leftRight.left.startsWith("$_.")) return;
    const originalVarName = leftRight.left;
    const varName = leftRight.left.replace("$_.", "");

    const nextStmt = findNextStatement(stmtPath);
    if (!nextStmt) return;

    const findRefactoringRange = () => {
      const varAccesses: VarAccess[] = [];
      let lastStmt = nextStmt.path;
      let currentStmt: NodePath | null = nextStmt.path;
      const isRefactoringWorthIt = () => {
        const score = varAccesses
          .map<number>((t) =>
            t.type === "read" || t.type === "write" ? 1 * (t.forDepth + 1) : 0
          )
          .reduce((a, b) => a + b, 0);
        return score > 1;
      };
      while (currentStmt !== null) {
        const provisionalVarAccesses: VarAccess[] = [];
        for (const varAccess of findReadsAndWritesIn(
          currentStmt,
          originalVarName
        )) {
          if (varAccess.type === "call" && varAccess.isPureInVar !== "pure") {
            const worthIt = isRefactoringWorthIt();
            console.log(
              `${worthIt ? "Stopping refactor" : "Giving up"} due to ${
                varAccess.isPureInVar
              } call (with respect to the ${originalVarName} var)`,
              print(varAccess.path.node).code
            );
            return { proceed: worthIt, varAccesses, lastStmt };
          }
          // console.log("CONSIDERING", print(currentStmt.node).code);
          provisionalVarAccesses.push(varAccess);
        }
        varAccesses.push(...provisionalVarAccesses);
        lastStmt = currentStmt;
        currentStmt = findNextStatement(currentStmt)?.path ?? null;
      }

      const worthIt = isRefactoringWorthIt();
      console.log(
        `Refactoring due to ${originalVarName} all the way to the bottom!`
      );
      return { proceed: worthIt, varAccesses, lastStmt };
    };

    const { proceed, varAccesses, lastStmt } = findRefactoringRange();

    if (!proceed) return;

    // console.log(
    //   originalVarName,
    //   varAccesses.map((r) => r.type)
    //   // readWrites.map((vv) => {
    //   //   type DistrKeyof<T> = T extends any ? keyof T : never;
    //   //   type V = VarAccess & {
    //   //     [k in DistrKeyof<VarAccess>]: undefined;
    //   //   };
    //   //   const vvv = vv as VarAccess & {
    //   //     [k: string]: undefined;
    //   //   };
    //   //   return {
    //   //     type: vv.type,
    //   //     isPureInVar: vvv.isPureInVar,
    //   //     path: vvv.path ? findPathNames(vvv.path).join(".") : null,
    //   //     code: vvv.path ? print(vvv.path.node).code : null,
    //   //   };
    //   // })
    // );

    // TODO: Improve this
    const impureCall = varAccesses.find(
      (rw) => rw.type === "call" && rw.isPureInVar !== "pure"
    ) as (VarAccess & { type: "call" }) | undefined;
    if (impureCall) {
      console.log(
        `Giving up due to ${impureCall.isPureInVar} call (with respect to the ${originalVarName} var)`,
        print(impureCall.path.node).code
      );
      return;
    }

    editCount++;
    const newTmpVarName = genVariable();

    const rightNode = findRightNode(stmtPath.node);
    stmtPath.replace(
      b.variableDeclaration("var", [
        b.variableDeclarator(b.identifier(newTmpVarName), rightNode),
      ])
    );

    for (const op of varAccesses) {
      if (op.type === "early-exit") {
        op.path.insertBefore(makeDumpBackStmt());
      }
      if (op.type === "read") {
        op.path.replace(b.identifier(newTmpVarName));
      }
      if (op.type === "write") {
        const rightNode = findRightNode(op.path.node);
        op.path.replace(
          b.expressionStatement(
            b.assignmentExpression("=", b.identifier(newTmpVarName), rightNode!)
          )
        );
      }
    }

    lastStmt.insertAfter(makeDumpBackStmt());

    function makeDumpBackStmt() {
      return b.expressionStatement(
        b.assignmentExpression(
          "=",
          b.memberExpression(b.identifier("$_"), b.identifier(varName)),
          b.identifier(newTmpVarName)
        )
      );
    }
  });

  return editCount;
}

function processLocalVariablesInScope__(scope: NodePath) {
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
