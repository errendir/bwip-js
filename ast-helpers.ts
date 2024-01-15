import { parse, print } from "recast";
import { namedTypes as n, visit } from "ast-types";
import { NodePath } from "ast-types/lib/node-path";

import { Type } from "ast-types/lib/types";

export function findInTree<N>(
  tree: n.Node,
  nodeType: Type<N>,
  callback: (path: NodePath<N>) => void
) {
  visit(tree, {
    visitNode(path) {
      if (nodeType.check(path.node)) {
        callback(path as any);
      }
      this.traverse(path);
    },
  });
}

let freeVariable: number | null = null;
export const initVariables = (source: string) => {
  const allVarsRaw = Array.from(source.matchAll(/var __([^=\s_]+)/g));
  const allVars = allVarsRaw.map((v) => parseInt(v[1], 36));
  const maxVar = Math.max(...allVars, 0);
  if (isNaN(maxVar))
    throw new Error(
      "Incorrect max var! " + allVarsRaw.map((v) => v[0]).join(",")
    );
  freeVariable = maxVar + 1;
};
export const genVariable = () => {
  if (freeVariable === null) throw new Error("UNINITIALIZED");
  const variable = `__${freeVariable.toString(36)}`;
  freeVariable++;
  return variable;
};

export function findPrevStatement(firstPath: NodePath<any>) {
  return findStatement(firstPath, -1);
}
export function findNextStatement(firstPath: NodePath<any>) {
  return findStatement(firstPath, +1);
}

function findStatement(firstPath: NodePath<any>, delta: number) {
  const thisNode = firstPath.node;
  const parentNode = firstPath.parent.node;
  if (!n.BlockStatement.check(parentNode)) return null;
  const childIndex = parentNode.body.indexOf(thisNode);

  if (childIndex === -1) throw new Error("WAT?");
  if (childIndex + delta >= parentNode.body.length || childIndex + delta < 0)
    return null;

  const node = parentNode.body[childIndex + delta];
  const path: NodePath = firstPath.parentPath.get(childIndex + delta);

  return { node: node, path: path };
}

export function findPathNames(path: NodePath) {
  const names: string[] = [];
  let curPath: NodePath | null = path;
  while (curPath !== null) {
    names.unshift(curPath.name);
    curPath = curPath.parentPath;
  }
  return names;
}

function joinPaths(path1: NodePath, path2: NodePath) {
  const names = findPathNames(path2).slice(2);
  for (const name of names) {
    path1 = path1.get(name);
  }
  return path1;
}

/** Takes a path to some statement */
function* iterateOverExpressions(
  afterStatement: NodePath<any>,
  includeThisStatement = false,
  justThisStatement = false
) {
  let currentStmt = includeThisStatement
    ? { path: afterStatement, node: afterStatement.node }
    : findNextStatement(afterStatement);

  while (currentStmt !== null) {
    const exprs: NodePath<n.Expression>[] = [];
    // console.log(
    //   "ANALYZING",
    //   findPathNames(currentStmt.path),
    //   print(currentStmt.node).code
    // );

    function* visitExprs(node: n.Node, prefixPath: NodePath) {
      visit(node, {
        visitExpression(path) {
          // console.log("EXPR", j(path.node as any).toSource(), path.node.type);
          exprs.push(joinPaths(prefixPath, path as any));
          this.traverse(path);
        },
      });
      yield* exprs;
    }

    if (n.IfStatement.check(currentStmt.node)) {
      yield* visitExprs(currentStmt.node.test, currentStmt.path.get("test"));
      if (!isStatementStackPure(currentStmt.path.get("consequent"))) return;
      if (
        currentStmt.node.alternate &&
        !isStatementStackPure(currentStmt.path.get("alternate"))
      )
        return;
    }
    if (n.ForStatement.check(currentStmt.node)) {
      if (currentStmt.node.init) {
        yield* visitExprs(currentStmt.node.init, currentStmt.path.get("init"));
      }
      if (!isStatementStackPure(currentStmt.path.get("body"))) return;
    }

    yield* visitExprs(currentStmt.node, currentStmt.path);

    currentStmt = justThisStatement
      ? null
      : findNextStatement(currentStmt.path);
  }
}

function isStatementStackPure(stmt: NodePath) {
  //   console.log("ANALYZING", findPathNames(stmt), print(stmt.node).code);

  if (n.BlockStatement.check(stmt.node)) {
    // console.log("BLOCK_STMT", print(stmt.node).code);
    for (let i = 0; i < stmt.node.body.length; ++i) {
      //   console.log("BLOCK_LINE_STMT", print(stmt.get("body").get(i).node).code);
      if (!isStatementStackPure(stmt.get("body").get(i))) return false;
    }
    return true;
  }

  if (n.ForStatement.check(stmt.node)) {
    // TODO: Actually analyze the `init` part
    return isStatementStackPure(stmt.get("body"));
  }
  if (n.IfStatement.check(stmt.node)) {
    // TODO: Actually analyze the `test` part
    // console.log("IF_STMT", print(stmt.get("consequent")).code);
    if (!isStatementStackPure(stmt.get("consequent"))) return false;
    return true;
    // return (
    //   isStatementStackPure(stmt.get("consequent")) &&
    //   (!stmt.node.alternate || isStatementStackPure(stmt.get("alternate")))
    // );
  }

  for (const expr of iterateOverExpressions(stmt, true, true)) {
    if (n.CallExpression.check(expr.node)) {
      if (!isCallStackPure(expr.node)) {
        return false;
      }
    }

    const source = print(expr.node).code;
    if (source === "$k[$j++]") {
      return false;
    }
    if (source === "$k[--$j]") {
      return false;
    }
  }
  return true;
}

const knownStackPureFunctions = [
  "$s",
  "$z",
  "$strcpy",
  "$arrcpy",
  "$cvi",
  "$cvrs",
  "$cvx",
  "$get",
  "$put",
  "$geti",
  "$puti",
  "$type",
  "$eq",
  "$ne",
  "$lt",
  "$le",
  "$gt",
  "$ge",
  "$an",
  "$or",
  "$xo",
  "$nt",
  "$f",
  "$forall_it",
  "$aload_it",
  // TODO: Add the rest of those functions
  "$$.setcolor",
  "$$.moveto",
  "$$.lineto",
  "$$.closepath",
  "$$.fill",
  "$$.newpath",
  "$$.arc",
  "$$.save",
  "$$.translate",
  "$$.scale",
  {
    callee: "$a",
    extraTest(node: n.CallExpression) {
      return node.arguments.length === 1;
    },
  },
];

const impureCalls = new Map<string, number>();
function isCallStackPure(callExpr: n.CallExpression) {
  const callee = print(callExpr.callee as any).code;
  const isStackPure = knownStackPureFunctions.find((t) =>
    typeof t === "string"
      ? t === callee
      : t.callee === callee && t.extraTest(callExpr)
  );
  if (!isStackPure) {
    impureCalls.set(callee, (impureCalls.get(callee) ?? 0) + 1);
  }
  return isStackPure;
}

export function* iterateOverStackPureExpressions(
  afterStatement: NodePath<any>,
  includeThisStatement = false,
  justThisStatement = false
) {
  for (const expr of iterateOverExpressions(
    afterStatement,
    includeThisStatement,
    justThisStatement
  )) {
    // We cannot propagate through another push
    if (print(expr.node as any).code === "$k[$j++]") {
      break;
    }

    if (n.CallExpression.check(expr.node)) {
      if (!isCallStackPure(expr.node)) break;
    }
    yield expr;
  }
}

export function findLeadingPopsFrom(
  line: NodePath<n.Statement>,
  includeThisStatement: boolean
) {
  const leadingPops: {
    count: number;
    eliminate: (variableName: string) => void;
  }[] = [];

  let skipMinusMinusJ = false;
  for (const expr of iterateOverStackPureExpressions(
    line,
    includeThisStatement
  )) {
    const eliminatePop = findPopEliminate(expr);
    if (eliminatePop) {
      // We cannot predict if the stack peeks will use the top pushed element or not
      // So we don't look past them, otherwise eliminating top pops may not be safe
      if (eliminatePop.isStackPeek) {
        break;
      }
      if (eliminatePop.isMinusMinusJ && skipMinusMinusJ) {
        skipMinusMinusJ = false;
        continue;
      }
      if (eliminatePop.skipMinusMinusJ) {
        skipMinusMinusJ = true;
      }
      // console.log("FOUND LEADING POP", print(expr.node).code);
      leadingPops.push(eliminatePop);
    }
  }

  return leadingPops;
}

export function findLeadingPopsAndTrailingPushes(
  path: NodePath<n.BlockStatement>
) {
  const leadingPops = findLeadingPopsFrom(path.get("body").get(0), true);
  const trailingPushes: { path: NodePath; val: n.Node }[] = [];

  const lastStmt: NodePath = path.get("body").get(path.node.body.length - 1);
  let line: { node: n.Node; path: NodePath } | null = {
    node: lastStmt.node,
    path: lastStmt,
  };
  while (line !== null) {
    if (n.ExpressionStatement.check(line.node)) {
      const pushedValue = getPushedValue(line.node);
      if (pushedValue) {
        // console.log("FOUND TRAILING PUSH", j(line.node).toSource());
        trailingPushes.unshift({ path: line.path, val: pushedValue });
      } else {
        if (!isStatementStackPure(line.path)) break;
      }
    } else {
      if (!isStatementStackPure(line.path)) break;
    }
    line = findPrevStatement(line.path);
  }

  return { leadingPops, trailingPushes };
}

function findPopEliminate(expr: NodePath) {
  const exprString = print(expr.node as n.Node).code;
  if (exprString === "$k[--$j]") {
    return {
      count: 1,
      skipMinusMinusJ: true,
      eliminate: (variableName: string) => replace(expr, `${variableName}`),
    };
  }

  // Expressions of the `$j--` form
  if (
    n.UpdateExpression.check(expr.node) &&
    expr.node.operator === "--" &&
    print(expr.node.argument).code === "$j"
  ) {
    return {
      count: 1,
      isMinusMinusJ: true,
      eliminate: (variableName: string) => expr.prune(),
    };
  }

  // Expressions of the `$j -= XX` form
  if (
    n.AssignmentExpression.check(expr.node) &&
    expr.node.operator === "-=" &&
    print(expr.node.left).code === "$j" &&
    n.Literal.check(expr.node.right) &&
    typeof expr.node.right.value === "number" &&
    expr.node.right.value > 0
  ) {
    const val = expr.node.right.value;
    const eliminate = (variableName: string) => {
      if (val === 1) {
        expr.prune();
      } else {
        replace(expr, `$j -= ${val - 1};\n`);
      }
    };
    return { count: val, eliminate };
  }

  if (
    n.MemberExpression.check(expr.node) &&
    print(expr.node.object).code === "$k"
  ) {
    const index = print(expr.node.property).code;
    return {
      count: 0,
      eliminate: () => {
        replace(expr, `$k[${index} + 1]`);
      },
      isStackPeek: true,
    };
  }
}

export function getPushedValue(node: n.ExpressionStatement) {
  if (!n.AssignmentExpression.check(node.expression)) return null;
  if (!print(node).code.includes("$k[$j++] = ")) return null;

  return node.expression.right;
}

export function replace(path: NodePath, rawCode: string) {
  const ast = (parse(`${rawCode}`) as n.File).program.body;
  path.replace(...ast);
}

export function insertBefore(path: NodePath, rawCode: string) {
  const ast = (parse(`${rawCode}`) as n.File).program.body;
  path.insertBefore(...ast);
}

export function insertAfter(path: NodePath, rawCode: string) {
  const ast = (parse(`${rawCode}`) as n.File).program.body;
  path.insertAfter(...ast);
}

export function findLeftRight(node: n.Statement) {
  if (
    n.ExpressionStatement.check(node) &&
    n.AssignmentExpression.check(node.expression)
  ) {
    return {
      fullLeft: print(node.expression.left).code,
      left: print(node.expression.left).code,
      right: print(node.expression.right).code,
    };
  }
  if (n.VariableDeclaration.check(node)) {
    const declr = node.declarations[0];
    if (!n.VariableDeclarator.check(declr)) return null;
    if (!declr.init) return null;
    return {
      fullLeft: `var ${print(declr.id).code}`,
      left: print(declr.id).code,
      right: print(declr.init).code,
    };
  }
  return null;
}
