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

export function removeExtraProps(tree: n.Node) {
  let editCount = 0;

  // Find all the top level functions and go through each one by one
  findInTree(tree, n.FunctionDeclaration, (fnPath) => {
    const pathNames = findPathNames(fnPath);
    if (pathNames.length > 5) {
      // The function is not top-level
      return;
    }

    editCount += processVariablesInScope(fnPath);
  });
  console.log("removed variables from the $_. scope", editCount);
}

const rejectlist = [
  "barcode",
  "ctrl",
  "eci",
  "fncvals",
  "hasOwnProperty",
  "j",
  "msg",
  "parse",
  "parsefnc",
  "parseonly",

  "dontdraw",
  "format",
  "version",
  "eclevel",
  "parse",
  "parsefnc",
  "mask",
  "ctrl",
  "bwipjs_dontdraw",
  // The ones manually added in the bwipp_parseinput
  "msg",
  "j",

  // Remove this one
  "pixs",
  "Kexcl",
];

const allowlist = [
  // "modeBNbeforeK"
  // "inkspreadh",
  // "up",
  "pixy",
  // "msglen",
  // "AbeforeB",
  // "modeBAbeforeN",
  // "cclen",
  // "x",
  // "i",
  // "n4",
  // "fmtvalsrmqr2",
];

const fnIgnorelist = [
  "bwipp_parseinput",
  "bwipp_renmatrix",
  "bwipp_loadctx",
  "bwipp_processoptions",
];

function processVariablesInScope(scope: NodePath<n.FunctionDeclaration>) {
  const fnName = scope.node.id && print(scope.node.id).code;
  if (fnIgnorelist.includes(fnName!)) return 0;
  console.log("Processing top function", fnName);
  let editCount = 0;
  // The functions whose names also show up as string literals can be dynamically accessed, we must be careful optimizing them
  const strLiterals = new Set<string>();
  findInTree(scope.node, n.Literal, (strLit) => {
    if (typeof strLit.node.value !== "string") return;
    strLiterals.add(strLit.node.value);
  });

  const allVarsToAdd: { oldName: string; newName: string }[] = [];
  findInTree(scope.node, n.ExpressionStatement, (assigExpr) => {
    const leftRight = findLeftRight(assigExpr.node);
    if (!leftRight) return;

    if (!leftRight.left.startsWith("$_.")) return;

    const oldName = leftRight.left.replace("$_.", "");
    // If the variable is potentially dynamically referenced, don't change it to a var
    if (strLiterals.has(oldName)) return;

    if (rejectlist.includes(oldName)) return;
    // if (!allowlist.includes(oldName)) return;
    // if (Math.random() > 0.03) return;

    console.log("REFACTORING", oldName);

    const newName = "__var_" + oldName;
    allVarsToAdd.push({ oldName, newName });

    replace(assigExpr, `${newName} = ${leftRight.right};\n`);

    editCount++;
  });

  if (allVarsToAdd.length > 0) {
    insertBefore(
      // scope.get("body").get("body").get(0),
      scope,
      `var ${allVarsToAdd.map((t) => t.newName).join(",")};`
    );
  }

  findInTree(scope.node, n.MemberExpression, (mmbrExpr) => {
    // console.log(
    //   "MEMBER",
    //   print(mmbrExpr.node.object).code,
    //   print(mmbrExpr.node).code
    // );
    if (print(mmbrExpr.node.object).code !== "$_") return;
    if (!n.Identifier.check(mmbrExpr.node.property)) return;

    const oldName = print(mmbrExpr.node.property).code;
    if (!allVarsToAdd.find((t) => t.oldName === oldName)) return;

    replace(mmbrExpr, "__var_" + oldName);
  });

  // // Initalize the vars to their parent values after context load
  // for (const varName of allVarsToAdd) {
  //   insertBefore(
  //     scope.get("body").get("body").get(0),
  //     `var ${varName.newName} = $_.${varName.oldName};\n`
  //   );
  // }

  return editCount;
}
