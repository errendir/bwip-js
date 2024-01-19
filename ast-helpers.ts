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
  const identifiers: string[] = [];
  findInTree(tree, n.Identifier, (id) => identifiers.push(id.node.name));

  const allVarsRaw = identifiers
    .map((id) => id.match(/_v([^=\s_]+)/))
    .filter((m) => !!m);
  const allVars = allVarsRaw.map((v) => parseInt(v![1], 36));
  const maxVar = Math.max(...allVars, 0);
  if (isNaN(maxVar))
    throw new Error(
      "Incorrect max var! " + allVarsRaw.map((v) => v![0]).join(",")
    );
  freeVariable = maxVar + 1;
};
export const genVariable = () => {
  if (freeVariable === null) throw new Error("UNINITIALIZED");
  const variable = `_v${freeVariable.toString(36)}`;
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

function findRoot(path: NodePath) {
  let curPath: NodePath = path;
  while (true) {
    if (!curPath.parentPath || !curPath.parentPath.node) return curPath.node;
    curPath = curPath.parentPath;
  }
}

function joinPaths(path1: NodePath, path2: NodePath) {
  console.log("pathNames1", findPathNames(path1));
  console.log("pathNames2", findPathNames(path2));
  const names = findPathNames(path2).slice(2);
  const totalPath = findPathNames(path1);

  let newPath = path1;
  for (const name of names) {
    newPath = newPath.get(name);
    totalPath.push(name);
    if (newPath.value === undefined) {
      console.log("root1");
      printOutTree(findAllParents(path1)[1].value, "");
      console.log("root2");
      printOutTree(findAllParents(path2)[1].value, "");
      throw new Error("There is nothing at the path " + totalPath.join(", "));
    }
  }
  return newPath;
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

    function* visitExprs(nodePath: NodePath) {
      visit(nodePath as any, {
        visitExpression(path) {
          // console.log("EXPR", j(path.node as any).toSource(), path.node.type);
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
    }
    if (n.ForStatement.check(currentStmt.node)) {
      if (currentStmt.node.init) {
        yield* visitExprs(currentStmt.path.get("init"));
      }
      if (!isStatementStackPure(currentStmt.path.get("body"))) return;
    }
    if (n.ForOfStatement.check(currentStmt.node)) {
      if (currentStmt.node.right) {
        yield* visitExprs(currentStmt.path.get("right"));
      }
      if (!isStatementStackPure(currentStmt.path.get("body"))) return;
    }

    yield* visitExprs(currentStmt.path);

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
      if (!isCallStackPure(expr as any)) {
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

function findFunctionBody(
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
          return findRightPath(scopePath.get("body").get(i)).get("body");
        }
      }
    }
    scopePath = scopePath.parentPath;
  }
}

const impureCalls = new Map<string, number>();
function isCallStackPure(callExpr: NodePath<n.CallExpression>) {
  const callee = print(callExpr.node.callee as any).code;
  const knowStackPurity = knownStackPureFunctions.find((t) =>
    typeof t === "string" ? t === callee : t.callee === callee
  );
  if (knowStackPurity) {
    return typeof knowStackPurity === "string"
      ? true
      : knowStackPurity.extraTest(callExpr.node);
  }

  if (knowStackImpureFunctions.includes(callee)) return false;

  // console.log("CHECKING", callee);

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
  const trailingPushes: { path: NodePath; val: ExpressionKind }[] = [];

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

function findRightPath(nodePath: NodePath) {
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
