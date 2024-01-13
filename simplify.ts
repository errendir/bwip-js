// Usage: npx jscodeshift -t simplify.ts --extensions=mjs dist/bwipp.mjs

/**
 * This script replaces all occurances of:
 * var _1f = $k[--$j]; //#299
 * $k[$j++] = _1f; //#302
 *
 * with just a "peek" operation
 * var _1f = $k[$j - 1]; //#299
 */

/**
We need the following extra functions in the global scope

function* $aload_it(a) {
    for (let i=a.o; i<a.length; ++i) {
        yield a.b[a.o + i];
    }
}

function* $forall_it(o) {
    if (o instanceof Uint8Array) {
        for (var i = 0, l = o.length; i < l; i++) {
            yield o[i];
        }
    } else if (o instanceof Array) {
        // The array may be a view.
        for (var a = o.b, i = o.o, l = o.o + o.length; i < l; i++) {
            yield a[i];
        }
    } else if (typeof o === 'string') {
        for (var i = 0, l = o.length; i < l; i++) {
            yield o.charCodeAt(i);
        }
    } else if (o instanceof Map) {
        for (var keys = o.keys(), i = 0, l = o.size; i < l; i++) {
            var id = keys.next().value;
            yield id;
            yield o.get(id);
        }
    } else {
        for (var id in o) {
            yield id;
            yield o[id];
        }
    }
}

function $forall(o, cb) {
    if (o instanceof Uint8Array) {
        for (var i = 0, l = o.length; i < l; i++) {
            $k[$j++] = o[i];
            if (cb && cb()) break;
        }
    } else if (o instanceof Array) {
        // The array may be a view.
        for (var a = o.b, i = o.o, l = o.o + o.length; i < l; i++) {
            $k[$j++] = a[i];
            if (cb && cb()) break;
        }
    } else if (typeof o === 'string') {
        for (var i = 0, l = o.length; i < l; i++) {
            $k[$j++] = o.charCodeAt(i);
            if (cb && cb()) break;
        }
    } else if (o instanceof Map) {
        for (var keys = o.keys(), i = 0, l = o.size; i < l; i++) {
            var id = keys.next().value;
            $k[$j++] = id;
            $k[$j++] = o.get(id);
            if (cb && cb()) break;
        }
    } else {
        for (var id in o) {
            $k[$j++] = id;
            $k[$j++] = o[id];
            if (cb && cb()) break;
        }
    }
}

 * 
 */

import { namedTypes as n, visit } from "ast-types";
import { StatementKind } from "ast-types/gen/kinds";
import { NodePath } from "ast-types/lib/node-path";

import core, { ASTNode, ASTPath, Collection, Transform } from "jscodeshift";

function findPrevStatement(firstPath: ASTPath<any>) {
  return findStatement(firstPath, -1);
}
function findNextStatement(firstPath: ASTPath<any>) {
  return findStatement(firstPath, +1);
}

function findStatement(firstPath: ASTPath<any>, delta: number) {
  const thisNode = firstPath.node;
  const parentNode = firstPath.parent.node;
  if (!n.BlockStatement.check(parentNode)) return null;
  const childIndex = parentNode.body.indexOf(thisNode);

  if (childIndex === -1) throw new Error("WAT?");
  if (childIndex + delta >= parentNode.body.length || childIndex + delta < 0)
    return null;

  const node = parentNode.body[childIndex + delta];
  const path: ASTPath = firstPath.parentPath.get(childIndex + delta);

  return { node: node, path: path };
}

function findPathNames(path: NodePath) {
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
  {
    callee: "$a",
    extraTest(node: n.CallExpression) {
      return node.arguments.length === 1;
    },
  },
];

const impureCalls = new Map<string, number>();
function isCallStackPure(api: core.API, callExpr: n.CallExpression) {
  const j = api.jscodeshift;
  const callee = j(callExpr.callee).toSource();
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

function* iterateOverStackPureExpressions(
  api: core.API,
  afterStatement: ASTPath<any>,
  includeThisStatement = false,
  justThisStatement = false
) {
  const j = api.jscodeshift;

  for (const expr of iterateOverExpressions(
    api,
    afterStatement,
    includeThisStatement,
    justThisStatement
  )) {
    if (n.CallExpression.check(expr.node)) {
      if (!isCallStackPure(api, expr.node)) break;
    }
    yield expr;
  }
}

function isStatementStackPure(api: core.API, stmt: ASTPath) {
  const j = api.jscodeshift;
  // console.log("ANALYZING", j(stmt.node).toSource());

  // TODO: Actually analyze the if/for statements, they could be stack pure after simplifications
  if (n.ForStatement.check(stmt.node)) return false;
  if (n.IfStatement.check(stmt.node)) return false;

  for (const expr of iterateOverExpressions(api, stmt, true, true)) {
    if (n.CallExpression.check(expr.node)) {
      if (!isCallStackPure(api, expr.node)) {
        return false;
      }
    }

    const source = j(expr.node as ASTNode).toSource();
    if (source === "$k[$j++]") {
      return false;
    }
    if (source === "$k[--$j]") {
      return false;
    }
  }
  return true;
}

/** Takes a path to some statement */
function* iterateOverExpressions(
  api: core.API,
  afterStatement: ASTPath<any>,
  includeThisStatement = false,
  justThisStatement = false
) {
  const j = api.jscodeshift;

  let currentStmt = includeThisStatement
    ? { path: afterStatement, node: afterStatement.node }
    : findNextStatement(afterStatement);

  while (currentStmt !== null) {
    const exprs: NodePath<n.Expression>[] = [];
    // console.log("ROOT PATH", findPathNames(currentStmt.path).join("."));

    function* visitExprs(node: n.ASTNode, prefixPath: ASTPath) {
      visit(node, {
        visitExpression(path) {
          // console.log("EXPR", j(path.node as any).toSource(), path.node.type);
          exprs.push(joinPaths(prefixPath, path));
          this.traverse(path);
        },
      });
      yield* exprs;
    }

    if (n.IfStatement.check(currentStmt.node)) {
      yield* visitExprs(currentStmt.node.test, currentStmt.path.get("test"));
      return;
    }
    if (n.ForStatement.check(currentStmt.node) && currentStmt.node.init) {
      yield* visitExprs(currentStmt.node.init, currentStmt.path.get("init"));
      return;
    }

    yield* visitExprs(currentStmt.node, currentStmt.path);

    currentStmt = justThisStatement
      ? null
      : findNextStatement(currentStmt.path);
  }
}

function findLeadingPopsAndTrailingPushes(
  api: core.API,
  path: NodePath<n.BlockStatement>
) {
  const j = api.jscodeshift;

  const leadingPops: NodePath[] = [];
  const trailingPushes: { path: NodePath; val: ASTNode }[] = [];

  for (const expr of iterateOverStackPureExpressions(
    api,
    path.get("body").get(0),
    true
  )) {
    if (j(expr.node as any).toSource() === "$k[$j++]") {
      break;
    }

    if (j(expr.node as ASTNode).toSource() === "$k[--$j]") {
      // console.log("FOUND LEADING POP");
      leadingPops.push(expr);
    }
  }

  const lastStmt: ASTPath = path.get("body").get(path.node.body.length - 1);
  let line: { node: ASTNode; path: ASTPath } | null = {
    node: lastStmt.node,
    path: lastStmt,
  };
  while (line !== null) {
    if (n.ExpressionStatement.check(line.node)) {
      const pushedValue = getPushedValue(api, line.node);
      if (pushedValue) {
        // console.log("FOUND TRAILING PUSH", j(line.node).toSource());
        trailingPushes.unshift({ path: line.path, val: pushedValue });
      } else {
        if (!isStatementStackPure(api, line.path)) break;
      }
    } else {
      if (!isStatementStackPure(api, line.path)) break;
    }
    line = findPrevStatement(line.path);
  }

  return { leadingPops, trailingPushes };
}

// function analyzePureInnerFunction(api: core.API, src: Collection<any>) {

function analyzePureInnerFunctions(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;

  // Find all the top level functions and go through each one by one
  src.find(j.FunctionDeclaration).forEach((fnPath) => {
    const pathNames = findPathNames(fnPath);
    if (pathNames.length > 4) {
      // The function is not top-level
      return;
    }

    // The functions whose names also show up as string literals can be dynamically accessed, we must be careful optimizing them
    const strLiterals = new Set<string>();
    j(fnPath.node)
      .find(j.Literal)
      .forEach((strLit) => {
        if (typeof strLit.node.value !== "string") return;
        strLiterals.add(strLit.node.value);
      });

    console.log({ strLiterals });

    const fnNameToArityMap = new Map<
      string,
      { betterFnName: string; inCount: number; outCount: number }
    >();

    j(fnPath.node)
      .find(j.ExpressionStatement)
      .forEach((innerFnPath) => {
        if (!n.AssignmentExpression.check(innerFnPath.node.expression)) return;
        if (!n.FunctionExpression.check(innerFnPath.node.expression.right))
          return;

        const rawFnName = j(innerFnPath.node.expression.left).toSource();
        if (!rawFnName.startsWith("$_."))
          throw new Error("Unexpected fn name " + rawFnName);
        const betterFnName = rawFnName.replace("$_.", "");

        if (innerFnPath.node.expression.right.params.length > 0) {
          console.log(
            "Function already has parameters, skipping...",
            rawFnName
          );
        }

        if (strLiterals.has(betterFnName)) {
          console.log(
            "TODO: Don't give up on dynamically referenced fn",
            betterFnName
          );
          return;
        }

        let { leadingPops, trailingPushes } = findLeadingPopsAndTrailingPushes(
          api,
          innerFnPath.get("expression").get("right").get("body")
        );

        console.log(
          "Found inner fn declaration with arity",
          rawFnName,
          leadingPops.length,
          trailingPushes.length
        );

        if (trailingPushes.length > 1) {
          console.log(
            "Cannot handle returning multiple values in fn (returning only the last one)",
            rawFnName
          );
          trailingPushes = trailingPushes.slice(-1);
        }

        fnNameToArityMap.set(rawFnName, {
          betterFnName,
          inCount: leadingPops.length,
          outCount: trailingPushes.length,
        });

        if (trailingPushes[0]) {
          trailingPushes[0].path.replace(
            `return ${j(trailingPushes[0].val).toSource()}` as any
          );
        }

        const newArguments = leadingPops.map((popExpr) => {
          const variableName = genVariable();
          popExpr.replace(`${variableName}` as any);
          return { popExpr, variableName };
        });

        innerFnPath
          .get("expression")
          .get("right")
          .get("params")
          .replace(newArguments.map((a) => a.variableName));

        // Alternative, bugs out
        // innerFnPath.replace(
        //   (`var ${betterFnName} = function(${newArguments
        //     .map((a) => a.variableName)
        //     .join(", ")}) ` +
        //     j(innerFnPath.node.expression.right.body).toSource()) as any
        // );
      });

    // Replace all the call sites of the processed functions
    j(fnPath.node)
      .find(j.ExpressionStatement)
      .forEach((callPath) => {
        if (!n.CallExpression.check(callPath.node.expression)) return;
        const fnName = j(callPath.node.expression.callee).toSource();
        const arity = fnNameToArityMap.get(fnName);
        if (!arity) return;

        const varNames = Array.from(new Array(arity.inCount), (_, i) =>
          genVariable()
        );
        for (const varName of varNames) {
          callPath.insertBefore(`var ${varName} = $k[--$j]`);
        }

        if (arity.outCount > 0) {
          const tmpVar = genVariable();
          callPath.replace(
            `var ${tmpVar} = ${fnName}(${varNames.join(", ")})` as any
          );
          callPath.insertAfter(`$k[$j++] = ${tmpVar};` as any);
        } else {
          callPath.replace(`${fnName}(${varNames.join(", ")})` as any);
        }

        // Alternative
        // const varString = varNames.join(", ");
        // if (arity.outCount > 0) {
        //     const tmpVar = genVariable();
        //     callPath.replace(
        //     `var ${tmpVar} = ${arity.betterFnName}(${varString});` as any
        //     );
        //     callPath.insertAfter(`$k[$j++] = ${tmpVar};` as any);
        // } else {
        //     callPath.replace(`${arity.betterFnName}(${varString});` as any);
        // }
      });
  });
}

function simplifyIfForAccumulator(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;

  let editCount = 0;
  src.find(j.Statement).forEach((ifForPath) => {
    if (
      !n.IfStatement.check(ifForPath.node) &&
      !n.ForStatement.check(ifForPath.node)
    )
      return;
    // TODO: Handle the if else statements too
    if (n.IfStatement.check(ifForPath.node) && ifForPath.node.alternate) return;

    const prevStmt = findPrevStatement(ifForPath);
    if (!prevStmt) return;
    if (!n.ExpressionStatement.check(prevStmt.node)) return;

    const pushedValue = getPushedValue(api, prevStmt.node);
    if (!pushedValue) return;

    const bodyPath = n.IfStatement.check(ifForPath.node)
      ? ifForPath.get("consequent")
      : ifForPath.get("body");

    // TODO: Analyze one-liner blocks too
    if (!n.BlockStatement.check(bodyPath.node)) return;
    const { leadingPops, trailingPushes } = findLeadingPopsAndTrailingPushes(
      api,
      bodyPath
    );

    if (leadingPops.length > 0 && trailingPushes.length > 0) {
      const variableName = genVariable();
      prevStmt.path.replace(
        `var ${variableName} = ${j(pushedValue).toSource()}` as any
      );
      leadingPops[0].replace(`${variableName}` as any);
      const lastPush = trailingPushes.slice(-1)[0]!;
      lastPush.path.replace(
        `${variableName} = ${j(lastPush.val).toSource()}` as any
      );
      ifForPath.insertAfter(`$k[$j++] = ${variableName}`);
      editCount++;
    }
  });
  console.log("if/for accumulators simplification", editCount);
}

function simplifyBranchesWithCommonPush(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;

  let editCount = 0;
  src.find(j.IfStatement).forEach((ifPath) => {
    if (!ifPath.node.alternate) return;
    if (!n.BlockStatement.check(ifPath.node.consequent)) return;
    if (!n.BlockStatement.check(ifPath.node.alternate)) return;

    const { trailingPushes: p1 } = findLeadingPopsAndTrailingPushes(
      api,
      ifPath.get("consequent")
    );
    const { trailingPushes: p2 } = findLeadingPopsAndTrailingPushes(
      api,
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
      ifPath.insertBefore(`var ${variableName}`);
      push1.path.replace(`${variableName} = ${j(push1.val).toSource()}` as any);
      push2.path.replace(`${variableName} = ${j(push2.val).toSource()}` as any);
    }
    for (const { variableName } of data.slice().reverse()) {
      ifPath.insertAfter(`$k[$j++] = ${variableName}`);
    }

    editCount += commonLength;
  });

  console.log("both branches common push", editCount);
}

function simplifyBranchesWithCommonPop(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;

  let editCount = 0;
  src.find(j.IfStatement).forEach((ifPath) => {
    if (!ifPath.node.alternate) return;
    if (!n.BlockStatement.check(ifPath.node.consequent)) return;
    if (!n.BlockStatement.check(ifPath.node.alternate)) return;

    function analyze(path: ASTPath) {
      const iter1 = iterateOverStackPureExpressions(
        api,
        path.get("body").get(0),
        true
      );
      let eliminateFn: null | ((variableName: string) => void) = null;
      for (const expr of iter1) {
        // We cannot propagate through another push
        const exprString = j(expr.node as ASTNode).toSource();
        if (exprString === "$k[$j++]") {
          break;
        }

        // Expressions of the `$j--` form
        if (
          n.UpdateExpression.check(expr.node) &&
          expr.node.operator === "--" &&
          j(expr.node.argument).toSource() === "$j"
        ) {
          eliminateFn = () => expr.prune();
        }

        // Expressions of the `$j -= XX` form
        if (
          n.AssignmentExpression.check(expr.node) &&
          expr.node.operator === "-=" &&
          j(expr.node.left).toSource() === "$j" &&
          n.Literal.check(expr.node.right) &&
          typeof expr.node.right.value === "number" &&
          expr.node.right.value > 0
        ) {
          const val = expr.node.right.value;
          eliminateFn = (variableName: string) => {
            if (val === 1) {
              expr.prune();
            } else {
              expr.replace(`$j -= ${val - 1}` as any);
            }
          };
        }

        if (exprString === "$k[--$j]") {
          eliminateFn = (variableName: string) =>
            expr.replace(`${variableName}` as any);
          break;
        }
      }
      return eliminateFn;
    }

    const firstPopOn1 = analyze(ifPath.get("consequent"));
    const firstPopOn2 = analyze(ifPath.get("alternate"));

    if (firstPopOn1 && firstPopOn2) {
      // console.log("REPLACING", findPathNames(expr));
      const variableName = genVariable();
      ifPath.insertBefore(`var ${variableName} = $k[--$j]` as any);
      firstPopOn1(variableName);
      firstPopOn2(variableName);
      editCount++;
    }
  });
  console.log(`both branches common pop`, editCount);
}

function getVariableDecl(node: n.ASTNode) {
  if (!n.VariableDeclaration.check(node)) return null;
  const declr = node.declarations[0];
  if (!n.VariableDeclarator.check(declr)) return null;
  if (!declr || !n.Identifier.check(declr.id)) return null;

  const name = declr.id.name;
  return { name, init: declr.init };
}

let freeVariable: number | null = null;
const genVariable = () => {
  if (freeVariable === null) throw new Error("UNINITIALIZED");
  const variable = `__${freeVariable.toString(36)}`;
  freeVariable++;
  return variable;
};

function simplifyLongDistancePushPops(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;

  let simplifyCount = 0;

  src.find(j.ExpressionStatement).forEach((thisPath) => {
    if (!n.AssignmentExpression.check(thisPath.node.expression)) return;
    if (j(thisPath.node.expression.left).toSource() !== "$k[$j++]") return;

    for (const expr of iterateOverStackPureExpressions(api, thisPath)) {
      // We cannot propagate through another push
      if (j(expr.node as any).toSource() === "$k[$j++]") {
        break;
      }

      if (j(expr.node as ASTNode).toSource() === "$k[--$j]") {
        // console.log("REPLACING", findPathNames(expr));
        const variableName = genVariable();
        expr.replace(variableName as any);
        thisPath.replace(
          `var ${variableName} = ${j(
            thisPath.node.expression.right
          ).toSource()}` as any
        );
        simplifyCount++;
        break;
      }
    }
  });

  console.log("simplify long push-pop", simplifyCount);
  // console.log(
  //   "impure calls",
  //   new Map(Array.from(impureCalls.entries()).sort((a, b) => b[1] - a[1]))
  // );
}

function inlineInfinities(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;

  let possibleCount = 0;
  let editCount = 0;
  src.find(j.VariableDeclaration).forEach((thisPath) => {
    const variableDecl = getVariableDecl(thisPath.node);
    if (
      !variableDecl ||
      !variableDecl.init ||
      j(variableDecl.init).toSource() !== "Infinity"
    )
      return;

    let next = findNextStatement(thisPath);
    while (true) {
      if (!next) break;
      const { node, path } = next;

      // Stop on statements we cannot analyze in-depth yet
      if (n.IfStatement.check(node)) break;
      if (n.WhileStatement.check(node)) break;
      if (n.ForStatement.check(node)) break;
      if (n.ForAwaitStatement.check(node)) break;

      // Stop on redeclaration or reassignment of the same variable
      const leftRight = findLeftRight(api, node);
      if (leftRight && leftRight.left === variableDecl.name) {
        break;
      }

      // console.log("node", j(node).toSource());

      if (leftRight && leftRight.right === variableDecl.name) {
        next = findNextStatement(path);
        path.replace(
          `${leftRight.prefix ? leftRight.prefix + " " : ""}${
            leftRight.left
          } = Infinity;` as any
        );
      } else {
        next = findNextStatement(path);
      }

      // if (!n.AssignmentExpression.check(node.expression)) continue;
      // if (j(node.expression.right).toSource() !== "$k[--$j]") return;

      // // console.log("pair");
      // // console.log(j(thisNode).toSource());
      // // console.log(j(node).toSource());

      // thisPath.prune();
      // const left = j(node.expression.left).toSource();
      // const right = j(value).toSource();
      // path.replace(`${left} = ${right};` as any);
    }

    possibleCount++;
    thisPath.replace(("//" + j(thisPath).toSource()) as any);

    // Check if the variable has been fully eliminated
    const identifiers: n.Identifier[] = [];
    j(thisPath.parent.node)
      .find(j.Identifier)
      .forEach((id) => identifiers.push(id.node));
    const ids = new Set(identifiers.map((id) => id.name));

    if (ids.has(variableDecl.name)) {
      // We must keep it, there is some other reference
      console.log("KEEPING", variableDecl.name);
      thisPath.replace(j(thisPath).toSource() as any);
    } else {
      editCount++;
      thisPath.prune();
    }
  });
  console.log("inline-infinity edit count", editCount, "out of", possibleCount);
}

function getPushedValue(api: core.API, node: n.ExpressionStatement) {
  const j = api.jscodeshift;

  if (!n.AssignmentExpression.check(node.expression)) return null;
  if (!j(node).toSource().includes("$k[$j++] = ")) return null;

  return node.expression.right;
}

function simplifyPushPop(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;

  let pushPopEditCount = 0;
  src.find(j.ExpressionStatement).forEach((thisPath) => {
    const thisNode = thisPath.node;
    const next = findNextStatement(thisPath);
    if (!next) return;
    const { node, path } = next;

    const pushedValue = getPushedValue(api, thisNode);
    if (!pushedValue) return;

    const tryVariable = () => {
      if (!n.VariableDeclaration.check(node)) return false;
      const [declr] = node.declarations;
      if (!n.VariableDeclarator.check(declr)) return false;
      const id = declr.id;
      if (!n.Identifier.check(id)) return;

      if (!declr.init || j(declr.init).toSource() !== "$k[--$j]") return;

      // console.log("pair");
      // console.log(j(thisNode).toSource());
      // console.log(j(node).toSource());

      thisPath.prune();
      path.replace(`var ${id.name} = ${j(pushedValue).toSource()}` as any);

      pushPopEditCount++;
      return true;
    };

    const tryAssignment = () => {
      if (!n.ExpressionStatement.check(node)) return false;
      if (!n.AssignmentExpression.check(node.expression)) return false;
      if (j(node.expression.right).toSource() !== "$k[--$j]") return;

      // console.log("pair");
      // console.log(j(thisNode).toSource());
      // console.log(j(node).toSource());

      thisPath.prune();
      const left = j(node.expression.left).toSource();
      const right = j(pushedValue).toSource();
      path.replace(`${left} = ${right};` as any);

      pushPopEditCount++;
      return true;
    };

    function tryRawPop() {
      if (!n.ExpressionStatement.check(node)) return false;
      if (j(node.expression).toSource() !== "$j--") return;

      // console.log("pair");
      // console.log(j(thisNode).toSource());
      // console.log(j(node).toSource());

      thisPath.prune();
      path.prune();

      pushPopEditCount++;
      return true;
    }

    tryVariable() || tryAssignment() || tryRawPop();
  });
  console.log("push-pop edit count", pushPopEditCount);
}

function arrayLoad(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;

  let editCount = 0;
  src.find(j.ExpressionStatement).forEach((thisPath) => {
    const thisNode = thisPath.node;
    if (!j(thisNode).toSource().includes("$k[$j++] = Infinity;")) return;

    const statements: {
      path: ASTPath<any>;
      data:
        | { type: "aload"; expr: string }
        | { type: "forall"; expr: string }
        | { type: "element"; expr: string };
    }[] = [];

    let ending: ReturnType<typeof findNextStatement> | null = null;
    let next: ReturnType<typeof findNextStatement>;
    let currentPath: ASTPath<any> = thisPath;
    while ((next = findNextStatement(currentPath)) !== null) {
      if (isEnding(next.node)) {
        ending = next;
        break;
      }

      // console.log("Taking", j(next.node).toSource());
      const data = isValidMiddle(next.node);
      if (!data) {
        break;
      }
      statements.push({ path: next.path, data });
      currentPath = next.path;
    }

    function isValidMiddle(node: any) {
      if (!n.ExpressionStatement.check(node)) return null;
      if (n.CallExpression.check(node.expression)) {
        if (j(node.expression.callee).toSource() === "$aload") {
          return {
            type: "aload" as const,
            expr: j(node.expression.arguments[0]).toSource(),
          };
        }
        if (
          j(node.expression.callee).toSource() === "$forall" &&
          node.expression.arguments.length === 1
        ) {
          return {
            type: "forall" as const,
            expr: j(node.expression.arguments[0]).toSource(),
          };
        }
        return null;
      }
      if (n.AssignmentExpression.check(node.expression)) {
        if (j(node.expression.left).toSource() !== "$k[$j++]") return null;
        const right = j(node.expression.right).toSource();

        // The middle element cannot be Infinity since `$a()` only loads from the first Infinity, see TEST_INFINITY_ARRAY
        if (right === "Infinity") return null;

        return {
          type: "element" as const,
          expr: right,
        };
      }
      return null;
    }

    function isEnding(node: any) {
      const leftRight = findLeftRight(api, node);
      return !!leftRight && leftRight.right === "$a()";
    }

    if (!ending || statements.length === 0) return;

    // console.log("FOUND");
    // for (const st of statements) {
    //   console.log(j(st.node).toSource());
    // }

    thisPath.prune();
    for (const st of statements) {
      st.path.prune();
    }

    const { prefix, left } = findLeftRight(api, ending.node)!;
    const right = `$a([${statements
      .map(({ data }) =>
        data.type === "element"
          ? data.expr
          : data.type === "aload"
          ? `...$aload_it(${data.expr})`
          : `...$forall_it(${data.expr})`
      )
      .join(",")}])`;
    ending.path.replace(
      `${prefix ? prefix + " " : ""}${left} = ${right}` as any
    );

    editCount++;
  });
  console.log("array edit count", editCount);
}

function simplifyPeek(api: core.API, src: Collection<any>) {
  const j = api.jscodeshift;
  let peekEditCount = 0;
  src.find(j.VariableDeclaration).forEach((thisPath) => {
    const thisNode = thisPath.node;
    const next = findNextStatement(thisPath);

    if (!next) return;
    const { node, path } = next;

    if (!n.ExpressionStatement.check(node)) return;
    if (!n.AssignmentExpression.check(node.expression)) return;
    if (!j(thisNode).toSource().includes("= $k[--$j];")) return;

    const [declr] = thisNode.declarations;
    if (!n.VariableDeclarator.check(declr)) return;
    const id = declr.id;
    if (!n.Identifier.check(id)) return;

    if (!j(node).toSource().startsWith(`$k[$j++] = ${id.name};`)) return;

    // console.log(j(thisNode).toSource());
    // console.log(j(node).toSource());

    thisPath.replace(`var ${id.name} = $k[$j - 1];` as any);
    //   path.replace(j(node).toSource() + "// BLAM2!");
    path.prune();
    peekEditCount++;
  });

  console.log("peek edit count", peekEditCount);
}

const transformer: Transform = function transformer(file, api) {
  const j = api.jscodeshift;

  //   console.log("file.source", file.source);

  let src = j(file.source);

  // TODO: Optimize
  const reload = () => {
    // console.log("BEFORE RELOAD");
    // src.find(j.FunctionDeclaration).replaceWith((n) => j(n.node).toSource());
    src = j(src.toSource());
    // console.log("AFTER RELOAD");
  };

  const allVarsRaw = Array.from(file.source.matchAll(/var __([^=\s_]+)/g));
  const allVars = allVarsRaw.map((v) => parseInt(v[1], 16));
  const maxVar = Math.max(...allVars, 0);
  if (isNaN(maxVar))
    throw new Error(
      "Incorrect max var! " + allVarsRaw.map((v) => v[0]).join(",")
    );
  freeVariable = maxVar + 1;

  simplifyBranchesWithCommonPop(api, src);
  reload();
  simplifyBranchesWithCommonPop(api, src);
  reload();
  simplifyBranchesWithCommonPop(api, src);
  reload();
  simplifyPushPop(api, src);
  reload();

  simplifyBranchesWithCommonPush(api, src);
  reload();
  simplifyBranchesWithCommonPush(api, src);
  reload();
  simplifyPushPop(api, src);
  reload();

  simplifyIfForAccumulator(api, src);
  reload();
  simplifyIfForAccumulator(api, src);
  reload();

  // // Three rounds of the push-pop simplification
  simplifyPushPop(api, src);
  reload();

  analyzePureInnerFunctions(api, src);
  reload();
  simplifyPushPop(api, src);
  reload();
  simplifyPushPop(api, src);
  reload();
  simplifyPushPop(api, src);
  reload();
  simplifyPushPop(api, src);
  reload();
  simplifyLongDistancePushPops(api, src);
  reload();
  simplifyLongDistancePushPops(api, src);
  reload();
  simplifyLongDistancePushPops(api, src);
  reload();

  // Inlining Infinities enables more push-pop optimization
  inlineInfinities(api, src);
  reload();
  simplifyPushPop(api, src);
  reload();
  simplifyLongDistancePushPops(api, src);
  reload();

  // // Reload the file
  // src = j(src.toSource());

  // simplifyPushPop(api, src);
  // simplifyPushPop(api, src);

  // // Reload the file
  // src = j(src.toSource());

  // // arrayLoad(api, src);
  // // arrayLoad(api, src);

  // // Reload the file
  // // src = j(src.toSource());
  // reload();

  // simplifyBranchesWithCommonPop(api, src);
  // reload();
  // simplifyPushPop(api, src);
  // reload();
  // // simplifyLongDistancePushPops(api, src);
  // // reload();

  // simplifyLongDistancePushPops(api, src);
  // reload();
  // simplifyLongDistancePushPops(api, src);
  // reload();
  // simplifyLongDistancePushPops(api, src);
  // reload();
  // simplifyLongDistancePushPops(api, src);
  // reload();
  // simplifyLongDistancePushPops(api, src);
  // reload();
  // simplifyLongDistancePushPops(api, src);
  // // simplify long push-pop 902
  // // simplify long push-pop 5
  // // simplify long push-pop 0

  // This one is done at the end since it can block other simplifications
  // simplifyPeek(api, src);

  return src.toSource();
};

function findLeftRight(api: core.API, node: StatementKind) {
  const j = api.jscodeshift;

  if (
    n.ExpressionStatement.check(node) &&
    n.AssignmentExpression.check(node.expression)
  ) {
    return {
      prefix: "",
      left: j(node.expression.left).toSource(),
      right: j(node.expression.right).toSource(),
    };
  }
  if (n.VariableDeclaration.check(node)) {
    const declr = node.declarations[0];
    if (!n.VariableDeclarator.check(declr)) return null;
    if (!declr.init) return null;
    return {
      prefix: "var",
      left: j(declr.id).toSource(),
      right: j(declr.init).toSource(),
    };
  }
  return null;
}

export default transformer;
