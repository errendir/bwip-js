import { print, parse } from "recast";
import { namedTypes as n, builders as b } from "ast-types";

import {
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findPathNames,
  genVariable,
  insertAfter,
  insertBefore,
  replace,
} from "./ast-helpers";

import { NodePath } from "ast-types/lib/node-path";

function findPotentialDynamicAccessLiterals(tree: n.Node) {
  // The functions whose names also show up as string literals can be dynamically accessed, we must be careful optimizing them
  // We can safetly ignore the literals that only appear as the first or second parameter to $eq(...)
  const strLiterals = new Set<string>();
  findInTree(tree, n.Literal, (strLit) => {
    if (typeof strLit.node.value !== "string") return;
    if (
      strLit.parentPath.node &&
      n.CallExpression.check(strLit.parentPath.node) &&
      n.Identifier.check(strLit.parentPath.node.callee) &&
      strLit.parentPath.node.callee.name === "$eq"
    ) {
      // console.log("SKIP",strLit.node.value,print(strLit.parentPath.node).code);
      return;
    }
    strLiterals.add(strLit.node.value);
  });
  return strLiterals;
}

export function extractFnParamsAndReturnsInGlobalFns(tree: n.Node) {
  let editCount = 0;

  const strLiterals = findPotentialDynamicAccessLiterals(tree);
  console.log({ strLiterals });

  const exportedIds = new Set<string>();
  // Don't refactor the global functions that are being exported
  findInTree(tree, n.ExportNamedDeclaration, (expPath) => {
    findInTree(expPath, n.Identifier, (idPath) => {
      exportedIds.add(idPath.node.name);
    });
  });

  const innerFnPaths: {
    fnPath: NodePath<n.Statement>;
    fnBody: NodePath<n.BlockStatement>;
    fnOldArgs: string;
    oldFnName: string;
    newFnName: string;
  }[] = [];

  // Find all the top level functions and go through each one by one
  findInTree(tree, n.FunctionDeclaration, (fnPath) => {
    const pathNames = findPathNames(fnPath);
    if (pathNames.length > 5) {
      // The function is not top-level
      console.log("SKIPPING", print(fnPath.node.id!).code);
      return;
    }

    if (!fnPath.node.id) throw new Error("Unknow fn");
    const name = print(fnPath.node.id).code;

    if (strLiterals.has(name)) {
      console.log("Skipping a potentially dynamically called fn", name);
      return;
    }
    if (exportedIds.has(name)) {
      console.log("Skipping an exported fn", name);
      return;
    }

    innerFnPaths.push({
      fnPath,
      fnBody: fnPath.get("body"),
      fnOldArgs: fnPath.node.params.map((p) => print(p).code).join(","),
      oldFnName: name,
      newFnName: name,
    });
  });

  console.log(innerFnPaths.map((m) => m.newFnName));

  return processFunctionsInScope(
    tree,
    innerFnPaths.filter(({ oldFnName }) =>
      // !["$aload_it", "$forall_it", "bwipp_loadctx"].includes(oldFnName)
      ["bwipp_raiseerror", "$astore"].includes(oldFnName)
    )
  );
}

export function extractFnParamsAndReturnsInLocalFns(tree: n.Node) {
  let editCount = 0;

  // Find all the top level functions and go through each one by one
  findInTree(tree, n.FunctionDeclaration, (fnPath) => {
    const pathNames = findPathNames(fnPath);
    if (pathNames.length > 5) {
      // The function is not top-level
      return;
    }

    const strLiterals = findPotentialDynamicAccessLiterals(tree);

    const innerFnPaths: {
      fnPath: NodePath<n.Statement>;
      fnBody: NodePath<n.BlockStatement>;
      fnOldArgs: string;
      oldFnName: string;
      newFnName: string;
    }[] = [];
    findInTree(fnPath, n.ExpressionStatement, (innerFnPath) => {
      if (!n.AssignmentExpression.check(innerFnPath.node.expression)) return;
      if (!n.FunctionExpression.check(innerFnPath.node.expression.right))
        return;

      let rawFnName: string;
      let betterFnName: string;
      rawFnName = print(innerFnPath.node.expression.left).code;
      if (!rawFnName.startsWith("$_."))
        throw new Error("Unexpected fn name " + rawFnName);
      betterFnName = rawFnName.replace("$_.", "");

      if (strLiterals.has(betterFnName)) {
        console.log(
          "TODO: Don't give up on dynamically referenced fn",
          betterFnName
        );
        return;
      }

      // if (Math.random() > 0.1) return;

      innerFnPaths.push({
        fnPath: innerFnPath,
        fnBody: innerFnPath.get("expression").get("right").get("body"),
        fnOldArgs: "",
        oldFnName: rawFnName,
        newFnName: betterFnName,
      });
    });

    console.log(innerFnPaths.map(({ fnBody, fnPath, ...rest }) => rest));

    editCount += processFunctionsInScope(
      fnPath,
      innerFnPaths
      // innerFnPaths.filter(({ newFnName }) => newFnName === "NbeforeB")
    );
  });
  return editCount;
}

function processFunctionsInScope(
  scope: NodePath | n.Node,
  innerFnPaths: {
    fnPath: NodePath<n.Statement>;
    fnBody: NodePath<n.BlockStatement>;
    fnOldArgs: string;
    oldFnName: string;
    newFnName: string;
  }[]
) {
  let editCount = 0;

  const fnNameToArityMap = new Map<
    string,
    { newFnName: string; inCount: number; outCount: number }
  >();

  innerFnPaths.forEach(
    ({ fnPath: innerFnPath, fnBody, fnOldArgs, oldFnName, newFnName }) => {
      let { leadingPops, trailingPushes } =
        findLeadingPopsAndTrailingPushes(fnBody);

      console.log(
        "Found inner fn declaration with arity",
        oldFnName,
        leadingPops.length,
        trailingPushes.length
      );

      if (trailingPushes.length > 1) {
        console.log(
          "Cannot handle returning multiple values in fn (returning only the last one)",
          oldFnName
        );
        trailingPushes = trailingPushes.slice(-1);
      }

      fnNameToArityMap.set(oldFnName, {
        newFnName,
        inCount: leadingPops.length,
        outCount: trailingPushes.length,
      });

      if (trailingPushes[0]) {
        trailingPushes[0].path.replace(
          b.returnStatement(trailingPushes[0].val)
        );
      }

      const newArguments = leadingPops.map((leadingPop) => {
        const variableName = genVariable();
        leadingPop.eliminate(variableName);
        if (leadingPop.count > 1)
          throw new Error(
            "TODO: Implement this - arity needs to correctly reflect how many pops are made"
          );
        return { variableName };
      });

      editCount++;

      // innerFnPath
      //   .get("expression")
      //   .get("right")
      //   .get("params")
      //   .replace(newArguments.map((a) => a.variableName));

      const args = [
        ...newArguments.map((a) => a.variableName),
        ...(fnOldArgs ? [fnOldArgs] : []),
      ].join(",");
      replace(
        innerFnPath,
        `\nfunction ${newFnName}(${args}) ` + print(fnBody.node).code + ";\n"
      );
    }
  );

  // Replace all the call sites of the processed functions
  findInTree(scope, n.ExpressionStatement, (callPath) => {
    if (!n.CallExpression.check(callPath.node.expression)) return;
    const fnName = print(callPath.node.expression.callee).code;
    const arity = fnNameToArityMap.get(fnName);
    if (!arity) return;

    if (!callPath.value) throw new Error("Broken value");

    const varNames = Array.from(new Array(arity.inCount), (_, i) =>
      genVariable()
    );
    for (const varName of varNames) {
      insertBefore(callPath, `var ${varName} = $k[--$j];\n`);
      // callPath.insertBefore(
      //   b.variableDeclaration("var", [
      //     b.variableDeclarator(
      //       b.identifier(varName),
      //       parse("$k[--$j]").program.body[0].expression
      //     ),
      //   ])
      // );
    }

    const varString = [
      ...varNames,
      ...callPath.node.expression.arguments.map((ar) => print(ar).code),
    ].join(",");
    if (arity.outCount > 0) {
      const tmpVar = genVariable();
      replace(callPath, `var ${tmpVar} = ${arity.newFnName}(${varString});\n`);
      insertAfter(callPath, `$k[$j++] = ${tmpVar};\n`);
    } else {
      replace(callPath, `${arity.newFnName}(${varString});\n`);
    }
  });

  return editCount;
}
