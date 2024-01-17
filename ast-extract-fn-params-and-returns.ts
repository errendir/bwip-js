import { print } from "recast";
import { namedTypes as n } from "ast-types";

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

export function extractFnParamsAndReturns(tree: n.Node) {
  let editCount = 0;

  // Find all the top level functions and go through each one by one
  findInTree(tree, n.FunctionDeclaration, (fnPath) => {
    const pathNames = findPathNames(fnPath);
    if (pathNames.length > 5) {
      // The function is not top-level
      return;
    }

    // The functions whose names also show up as string literals can be dynamically accessed, we must be careful optimizing them
    const strLiterals = new Set<string>();
    findInTree(fnPath, n.Literal, (strLit) => {
      if (typeof strLit.node.value !== "string") return;
      strLiterals.add(strLit.node.value);
    });

    const innerFnPaths: {
      fnPath: NodePath<n.ExpressionStatement>;
      fnBody: NodePath<n.BlockStatement>;
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

      if (innerFnPath.node.expression.right.params.length > 0) {
        console.log("Function already has parameters, skipping...", rawFnName);
      }

      if (strLiterals.has(betterFnName)) {
        console.log(
          "TODO: Don't give up on dynamically referenced fn",
          betterFnName
        );
        return;
      }

      innerFnPaths.push({
        fnPath: innerFnPath,
        fnBody: innerFnPath.get("expression").get("right").get("body"),
        oldFnName: rawFnName,
        newFnName: betterFnName,
      });
    });

    editCount += processFunctionsInScope(fnPath, innerFnPaths);
  });
  return editCount;
}

function processFunctionsInScope(
  scope: NodePath,
  innerFnPaths: {
    fnPath: NodePath<n.ExpressionStatement>;
    fnBody: NodePath<n.BlockStatement>;
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
    ({ fnPath: innerFnPath, fnBody, oldFnName, newFnName }) => {
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
        replace(
          trailingPushes[0].path,
          `return ${print(trailingPushes[0].val).code};\n`
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

      // Alternative, bugs out
      replace(
        innerFnPath,
        `var ${newFnName} = function(${newArguments
          .map((a) => a.variableName)
          .join(", ")}) ` +
          print(fnBody.node).code +
          ";\n"
      );
    }
  );

  // Replace all the call sites of the processed functions
  findInTree(scope.node, n.ExpressionStatement, (callPath) => {
    if (!n.CallExpression.check(callPath.node.expression)) return;
    const fnName = print(callPath.node.expression.callee).code;
    const arity = fnNameToArityMap.get(fnName);
    if (!arity) return;

    const varNames = Array.from(new Array(arity.inCount), (_, i) =>
      genVariable()
    );
    for (const varName of varNames) {
      insertBefore(callPath, `var ${varName} = $k[--$j];\n`);
    }

    // if (arity.outCount > 0) {
    //   const tmpVar = genVariable();
    //   replace(callPath, `var ${tmpVar} = ${fnName}(${varNames.join(", ")});\n`);
    //   insertAfter(callPath, `$k[$j++] = ${tmpVar};\n`);
    // } else {
    //   replace(callPath, `${fnName}(${varNames.join(", ")});\n`);
    // }

    // Alternative
    const varString = varNames.join(", ");
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
