import { parse, print } from "recast";
import {
  namedTypes as n,
  builders as b,
  visit,
  Visitor,
  PathVisitor,
  Path,
} from "ast-types";
import { NodePath } from "ast-types/lib/node-path";

import { Type } from "ast-types/lib/types";
import { ExpressionKind } from "ast-types/lib/gen/kinds";
import { printOutTree } from "./ast-printout";

export function findInTree<N>(
  tree: n.Node | NodePath,
  nodeType: Type<N>,
  callback: (path: NodePath<N>) => void
) {
  if (!n.Node.check(tree) && tree.node !== tree.value) {
    throw new Error("Please provide only paths to nodes");
  }
  // visit actually does take the path argument! the types are wrong
  visit(tree as any, {
    ["visit" + nodeType.toString()]: function (path) {
      if (!nodeType.check(path.node)) throw new Error("BROKEN!");
      callback(path);
      this.traverse(path);
    },
  });
}

// export function findInTree<N>(
//   tree: n.Node | NodePath,
//   nodeType: Type<N>,
//   callback: (path: NodePath<N>) => void
// ) {
//   if (!n.Node.check(tree) && tree.node !== tree.value) {
//     throw new Error("Please provide only paths to nodes");
//   }
//   const treeNode = n.Node.check(tree) ? tree : tree.node;
//   const pathToPrepend = n.Node.check(tree) ? null : tree;
//   visit(treeNode, {
//     ["visit" + nodeType.toString()]: function (path) {
//       if (!nodeType.check(path.node)) throw new Error("BROKEN!");
//       const fullPath = pathToPrepend ? joinPaths(pathToPrepend, path) : path;
//       callback(fullPath as any);
//       this.traverse(path);
//     },
//   });
// }

let freeVariable: number | null = null;
export const initVariables = (tree: n.Node) => {
  const allVarsRaw: string[] = [];
  findInTree(tree, n.VariableDeclarator, (id) => {
    if (!n.Identifier.check(id.node.id)) return;
    const match = id.node.id.name.match(/x([^=\s_]+)/);
    if (match) allVarsRaw.push(match[1]);
  });

  const allVars = allVarsRaw.map((v) => parseInt(v, 36));
  const maxVar = Math.max(...allVars, 0);
  if (isNaN(maxVar))
    throw new Error(
      "Incorrect max var! " + allVarsRaw.map((v) => v![0]).join(",")
    );
  freeVariable = maxVar + 1;
};
export const genVariable = () => {
  if (freeVariable === null) throw new Error("UNINITIALIZED");
  const variable = `x${freeVariable.toString(36)}`;
  freeVariable++;
  return variable;
};
export const reportVariableCount = () => {
  console.log("Generated", freeVariable, "variables");
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

function findRoot(path: NodePath) {
  let curPath: NodePath = path;
  while (true) {
    if (!curPath.parentPath || !curPath.parentPath.node) return curPath.node;
    curPath = curPath.parentPath;
  }
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

    function* visitExprs(nodePath: NodePath<n.Statement>) {
      // In a call expression visit the args first before visiting the entire call
      if (
        n.ExpressionStatement.check(nodePath.node) &&
        n.CallExpression.check(nodePath.node.expression)
      ) {
        yield* visitExprs(nodePath.get("expression").get("callee"));
        const args = nodePath.node.expression.arguments;
        for (let i = 0; i < args.length; ++i) {
          yield* visitExprs(nodePath.get("expression").get("arguments").get(i));
        }
        yield nodePath.get("expression");
        return;
      }
      visit(nodePath as any, {
        visitExpression(path) {
          // console.log("EXPR", j(path.node as any).toSource(), path.node.type);

          // Don't go into function expressions, we assume they are not indirectly called
          if (n.FunctionExpression.check(path.node)) return false;

          exprs.push(path);
          this.traverse(path);
        },
      });
      yield* exprs;
    }

    if (n.IfStatement.check(currentStmt.node)) {
      yield* visitExprs(currentStmt.path.get("test"));
      if (!isStatementStackPure(currentStmt.path.get("consequent"))) return;
      if (
        currentStmt.node.alternate &&
        !isStatementStackPure(currentStmt.path.get("alternate"))
      )
        return;
    } else if (n.ForStatement.check(currentStmt.node)) {
      if (currentStmt.node.init) {
        yield* visitExprs(currentStmt.path.get("init"));
      }
      if (!isStatementStackPure(currentStmt.path.get("body"))) return;
    } else if (n.ForOfStatement.check(currentStmt.node)) {
      if (currentStmt.node.right) {
        yield* visitExprs(currentStmt.path.get("right"));
      }
      if (!isStatementStackPure(currentStmt.path.get("body"))) return;
    } else if (n.FunctionDeclaration.check(currentStmt.node)) {
      // Noop, function declaration itself does nothing
    } else {
      yield* visitExprs(currentStmt.path);
    }

    currentStmt = justThisStatement
      ? null
      : findNextStatement(currentStmt.path);
  }
}

export function isExpressionStackPure(
  expr: NodePath<n.Expression | n.VariableDeclaration>
) {
  for (const subExpr of expressionsInEvalWeakOrder(expr)) {
    if (!isSubexpressionStackPure(subExpr)) return false;
  }
  return true;
}

function isSubexpressionStackPure(
  expr: NodePath<n.Expression | n.VariableDeclaration>
) {
  if (n.CallExpression.check(expr.node)) {
    if (!isCallStackPure(expr as any)) {
      return false;
    }
  }

  const source = print(expr.node).code;
  if (source === "$k[$j++]") return false;
  if (source === "$k[--$j]") return false;
  if (isJMinusEquals(expr) !== null) return false;
  if (isJMinusMinus(expr)) return false;

  // Peek expressions are not stack pure
  if (
    n.MemberExpression.check(expr.node) &&
    print(expr.node.object).code === "$k"
  ) {
    return false;
  }

  return true;
}

export function isStatementStackPure(stmt: NodePath) {
  // console.log("ANALYZING", findPathNames(stmt), print(stmt.node).code);
  // printOutTree(stmt.node, "")

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
  } else if (n.ForOfStatement.check(stmt.node)) {
    // TODO: Actually analyze the `init` part
    return isStatementStackPure(stmt.get("body"));
  } else if (n.ForInStatement.check(stmt.node)) {
    // TODO: Actually analyze the `init` part
    return isStatementStackPure(stmt.get("body"));
  } else if (n.WhileStatement.check(stmt.node)) {
    // TODO: Actually analyze the `init` part
    return isStatementStackPure(stmt.get("body"));
  } else if (n.IfStatement.check(stmt.node)) {
    // TODO: Actually analyze the `test` part
    // console.log("IF_STMT", print(stmt.get("consequent")).code);
    if (!isStatementStackPure(stmt.get("consequent"))) return false;
    return true;
    // return (
    //   isStatementStackPure(stmt.get("consequent")) &&
    //   (!stmt.node.alternate || isStatementStackPure(stmt.get("alternate")))
    // );
  } else if (
    n.BreakStatement.check(stmt.node) ||
    n.EmptyStatement.check(stmt.node) ||
    n.ContinueStatement.check(stmt.node) ||
    n.FunctionDeclaration.check(stmt.node)
  ) {
    return true;
  }

  if (
    n.VariableDeclaration.check(stmt.node) ||
    n.ExpressionStatement.check(stmt.node) ||
    n.ReturnStatement.check(stmt.node) ||
    n.ThrowStatement.check(stmt.node)
  ) {
    for (const expr of iterateOverExpressions(stmt, true, true)) {
      if (!isSubexpressionStackPure(expr)) return false;
    }
    return true;
  }

  printOutTree(stmt.node, "");
  throw new Error("Cannot analyze the node for stack purity");
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
  "$id",
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
  "$$.show",
  "$$.selectfont",
  "$$.stringwidth",
  "$$.charpath",
  "$$.restore",
  "$$.currpos",
  "$$.pathbbox",

  "Object.create",
  "Object.getPrototypeOf",
  "bwipp_loadctx",

  {
    callee: "$a",
    extraTest(node: n.CallExpression) {
      return node.arguments.length === 1;
    },
  },
];

const knowStackImpureFunctions = [
  "$d",
  "$forall",
  "$aload",
  "$search",
  "$cleartomark",
  "$counttomark",
  "$astore",

  // Parts of header functions which probably should just be skipped
  "$k.splice",
];

export function findFunctionBody(
  path: NodePath,
  fnName: string
): NodePath | undefined {
  let scopePath: NodePath | null = path;
  while (scopePath !== null) {
    if (
      !n.BlockStatement.check(scopePath.value) &&
      !n.Program.check(scopePath.value)
    ) {
      scopePath = scopePath.parentPath;
      continue;
    }
    const body = scopePath.node.body;
    for (let i = 0; i < body.length; ++i) {
      const stmtNode = body[i];
      if (n.FunctionDeclaration.check(stmtNode)) {
        if (stmtNode.id && print(stmtNode.id).code === fnName) {
          return scopePath.get("body").get(i).get("body");
        }
      }
      const leftStr = findAssignemntOrDeclLeft(stmtNode);
      if (leftStr === fnName) {
        const rightNode = findRightNode(stmtNode);
        if (!rightNode) throw new Error("Something is wrong");
        if (
          n.FunctionExpression.check(rightNode) ||
          n.ArrowFunctionExpression.check(rightNode)
        ) {
          return findRightPath(scopePath.get("body").get(i))!.get("body");
        }
      }
    }
    scopePath = scopePath.parentPath;
  }
}

const impureCalls = new Map<string, number>();
export function isCallStackPure(callExpr: NodePath<n.CallExpression>) {
  const callee = print(callExpr.node.callee as any).code;
  const knowStackPurity = knownStackPureFunctions.find((t) =>
    typeof t === "string" ? t === callee : t.callee === callee
  );
  if (knowStackPurity) {
    return typeof knowStackPurity === "string"
      ? true
      : knowStackPurity.extraTest(callExpr.node);
  }

  // Deal with the push/pop functions on array pens generated by the ast-array-pens refactor
  if (callee === "$k.push") return false;
  if (callee.endsWith(".push")) return true;
  if (callee === "$k.pop") return false;
  if (callee.endsWith(".pop")) return true;

  if (knowStackImpureFunctions.includes(callee)) return false;

  // // Dev helper: This makes sure all the paths passed to the `isCallStackPure` are globally rooted
  // const root = findRoot(callExpr);
  // if (root.type !== "File") {
  //   console.log(findPathNames(callExpr).join("__"), root.type);
  //   throw new Error("INCORRECT PATH!");
  // }

  // Attempt to find the body of the function and identify if it's stack pure
  const functionBody = findFunctionBody(callExpr.parentPath, callee);
  if (functionBody && isStatementStackPure(functionBody)) {
    // console.log("SKIPPING OVER STACK PURE FUNCTION!", callee);
    return true;
  }

  impureCalls.set(callee, (impureCalls.get(callee) ?? 0) + 1);
  return false;
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
      if (!isCallStackPure(expr as any)) break;
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
  const trailingPushes = findTrailingPushes(
    path.get("body").get(path.node.body.length - 1),
    true
  );

  return { leadingPops, trailingPushes };
}

export function findTrailingPushes(
  from: NodePath<n.Statement, any>,
  includeThisStatement: boolean
) {
  const trailingPushes: { path: NodePath; val: ExpressionKind }[] = [];

  let line: { node: n.Node; path: NodePath } | null = {
    node: from.node,
    path: from,
  };
  if (!includeThisStatement) {
    line = findPrevStatement(line.path);
  }
  while (line !== null) {
    if (n.ExpressionStatement.check(line.node)) {
      const pushedValue = getPushedValue(line.node);
      if (pushedValue) {
        // console.log("FOUND TRAILING PUSH", print(line.node).code);
        trailingPushes.unshift({ path: line.path, val: pushedValue });
      } else {
        if (!isStatementStackPure(line.path)) break;
      }
    } else {
      if (!isStatementStackPure(line.path)) break;
    }
    line = findPrevStatement(line.path);
  }
  return trailingPushes;
}

export function isJMinusMinus(expr: NodePath<n.Expression>) {
  return (
    n.UpdateExpression.check(expr.node) &&
    expr.node.operator === "--" &&
    print(expr.node.argument).code === "$j"
  );
}

export function isJMinusEquals(expr: NodePath<n.Expression>) {
  if (
    n.AssignmentExpression.check(expr.node) &&
    expr.node.operator === "-=" &&
    print(expr.node.left).code === "$j" &&
    n.Literal.check(expr.node.right) &&
    typeof expr.node.right.value === "number"
  ) {
    return expr.node.right.value;
  }
  return null;
}

function findPopEliminate(expr: NodePath<n.Expression>) {
  const exprString = print(expr.node as n.Node).code;
  if (exprString === "$k[--$j]") {
    return {
      count: 1,
      skipMinusMinusJ: true,
      eliminate: (variableName: string) => {
        expr.replace(b.identifier(variableName));
        expr.parentPath && cleanupMembershipExpression(expr.parentPath);
      },
    };
  }

  // Expressions of the `$j--` form
  if (isJMinusMinus(expr)) {
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
        // replace(expr, `$j -= ${val - 1};\n`);
        expr.replace(
          b.assignmentExpression("-=", b.identifier("$j"), b.literal(val - 1))
        );
      }
    };
    return { count: val, eliminate };
  }

  if (
    n.MemberExpression.check(expr.node) &&
    print(expr.node.object).code === "$k"
  ) {
    const indexNode = expr.node.property;
    const index = print(indexNode).code;
    return {
      count: 0,
      eliminate: () => {
        // replace(expr, `$k[${index} + 1]`);
        expr.replace(
          b.memberExpression(
            b.identifier("$k"),
            b.binaryExpression("+", indexNode, b.literal(1)),
            true
          )
        );
      },
      isStackPeek: true,
    };
  }
}

export function getPushedValue(node: n.ExpressionStatement) {
  if (!n.AssignmentExpression.check(node.expression)) return null;
  if (!print(node.expression.left).code.includes("$k[$j++]")) return null;

  return node.expression.right;
}

const tracker = new WeakMap<any, string>();

export function findNodeCreator(node: NodePath) {
  const val = tracker.get(node);
  if (val) return val;
  for (const par of findAllParents(node).reverse()) {
    const val = tracker.get(par.value);
    if (val) return val;
  }
  return null;
}

export function replace(path: NodePath, rawCode: string) {
  const ast = (parse(`${rawCode}`) as n.File).program.body;
  tracker.set(ast, new Error().stack ?? "");
  return path.replace(...ast);
}

export function insertBefore(path: NodePath, rawCode: string) {
  const ast = (parse(`${rawCode}`) as n.File).program.body;
  tracker.set(ast, new Error().stack ?? "");
  path.insertBefore(...ast);
}

export function insertAfter(path: NodePath, rawCode: string) {
  const ast = (parse(`${rawCode}`) as n.File).program.body;
  tracker.set(ast, new Error().stack ?? "");
  path.insertAfter(...ast);
}

export function reparseExpression(path: NodePath) {
  return path.replace(parse(print(path.node).code).program.body[0].expression);
}

export function reparseParentStatemet(path: NodePath) {
  while (!n.Statement.check(path.value) && !!path) {
    path = path.parentPath;
  }
  if (!path) return;
  const [newpath] = path.replace(parse(print(path.value).code).program.body[0]);
}

export function findRightPath(nodePath: NodePath): NodePath | null {
  const node = nodePath.node;
  if (
    n.ExpressionStatement.check(node) &&
    n.AssignmentExpression.check(node.expression)
  ) {
    return nodePath.get("expression").get("right");
  }
  if (n.VariableDeclaration.check(node)) {
    const declr = node.declarations[0];
    if (!n.VariableDeclarator.check(declr)) return null;
    if (!declr.init) return null;
    return nodePath.get("declarations").get(0).get("init");
  }
  return null;
}

function findAssignemntOrDeclLeft(node: n.Statement) {
  if (
    n.ExpressionStatement.check(node) &&
    n.AssignmentExpression.check(node.expression)
  ) {
    return print(node.expression.left).code;
  }
  if (n.VariableDeclaration.check(node)) {
    const declr = node.declarations[0];
    if (!n.VariableDeclarator.check(declr)) return null;
    if (!declr.init) return null;
    return print(declr.id).code;
  }
  return null;
}

export function findRightNode(node: n.Statement) {
  if (
    n.ExpressionStatement.check(node) &&
    n.AssignmentExpression.check(node.expression)
  ) {
    return node.expression.right;
  }
  if (n.VariableDeclaration.check(node)) {
    const declr = node.declarations[0];
    if (!n.VariableDeclarator.check(declr)) return null;
    if (!declr.init) return null;
    return declr.init;
  }
  return null;
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

export function cleanupMembershipExpression(path: NodePath) {
  if (!n.MemberExpression.check(path.node)) return;

  // Reparse the node since to normalize the type of the property
  const [newPath] = reparseExpression(path);

  if (
    n.Literal.check(newPath.node.property) &&
    typeof newPath.node.property.value === "string" &&
    canBeUsedAsSimpleMemberProperty(newPath.node.property.value)
  ) {
    console.log("Cleaning up membership expression", print(newPath.node).code);
    newPath.node.computed = false;
    newPath.node.property = b.identifier(newPath.node.property.value);
  }
}

function canBeUsedAsSimpleMemberProperty(str: string) {
  const simpleStr = str.replace(/^"/, "").replace(/"$/, "");
  try {
    eval(`({}).${simpleStr}`);
  } catch (err) {
    return false;
  }
  return true;
}

export function findAllParents(node: NodePath) {
  const parents: NodePath[] = [];
  let path: NodePath | null = node;
  while (path !== null) {
    parents.push(path);
    path = path.parentPath;
  }
  return parents.reverse();
}

export function findPotentialDynamicAccessLiterals(tree: n.Node) {
  // The functions whose names also show up as string literals can be dynamically accessed, we must be careful optimizing them
  // We can safetly ignore the literals that only appear as the first or second parameter to $eq(...)
  const strLiterals = new Set<string>();
  findInTree(tree, n.Literal, (strLit) => {
    if (typeof strLit.node.value !== "string") return;
    const parentNode = strLit.parentPath.node;
    if (
      parentNode &&
      n.CallExpression.check(parentNode) &&
      n.Identifier.check(parentNode.callee)
    ) {
      if (parentNode.callee.name === "$eq") return;
      if (parentNode.callee.name === "$ne") return;
      if (parentNode.callee.name === "bwipp_raiseerror") return;
    }
    if (
      parentNode &&
      n.NewExpression.check(parentNode) &&
      n.Identifier.check(parentNode.callee) &&
      parentNode.callee.name === "Error"
    ) {
      return;
    }
    if (
      parentNode &&
      n.BinaryExpression.check(parentNode) &&
      (parentNode.operator === "==" || parentNode.operator === "===")
    ) {
      return;
    }
    strLiterals.add(strLit.node.value);
  });
  return strLiterals;
}

export function* expressionsInEvalWeakOrder(
  exprStmt: NodePath
): Generator<NodePath> {
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
  } else if (n.ThisExpression.check(exprStmt.node)) {
    yield exprStmt;
  } else {
    console.log(exprStmt.node.type, printOutTree(exprStmt.node, ""));
    throw new Error("UNKNOWN EXPR");
  }
}

/** Existing block is a block always ending with a throw, return or break */
export function isExitingBlock(
  blockPath: NodePath<n.BlockStatement>,
  onlyThrows = false
) {
  for (let i = 0; i < blockPath.node.body.length; ++i) {
    const stmtPath: NodePath = blockPath.get("body").get(i);
    if (
      onlyThrows
        ? n.ThrowStatement.check(stmtPath.node)
        : n.ThrowStatement.check(stmtPath.node) ||
          n.ReturnStatement.check(stmtPath.node) ||
          n.BreakStatement.check(stmtPath.node)
    ) {
      return true;
    } else if (n.IfStatement.check(stmtPath.node)) {
      let bothExit =
        n.BlockStatement.check(stmtPath.node.consequent) &&
        isExitingBlock(stmtPath.get("consequent"));

      if (stmtPath.node.alternate) {
        bothExit =
          bothExit &&
          n.BlockStatement.check(stmtPath.node.consequent) &&
          isExitingBlock(stmtPath.get("alternate"));
      }

      if (bothExit) return true;
    } else if (
      n.ExpressionStatement.check(stmtPath.node) &&
      n.CallExpression.check(stmtPath.node.expression)
    ) {
      const fnName = print(stmtPath.node.expression.callee).code;
      const fnBody = findFunctionBody(stmtPath, fnName);
      const isExiting = !!fnBody && isExitingBlock(fnBody, true);
      if (isExiting) return true;
    }
  }

  return false;
}
