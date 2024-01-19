// Usage npx tsx ast-test.ts ./dist/bwipp.mjs

import { parse, print } from "recast";
import { namedTypes as n, builders as b } from "ast-types";

import * as fs from "node:fs";

import { findInTree, findPathNames, initVariables } from "./ast-helpers";
import {
  simplifyLongDistancePushPops,
  simplifyPushPop,
} from "./ast-simplify-pushpop";
import {
  simplifyBranchesWithCommonPop,
  simplifyBranchesWithCommonPush,
} from "./ast-extract-common-push-pop";
import { simplifyIfForAccumulator } from "./ast-accumulator";
import {
  extractFnParamsAndReturnsInLocalFns,
  extractFnParamsAndReturnsInGlobalFns,
} from "./ast-extract-fn-params-and-returns";
import { inlineConstants } from "./ast-inline-constants";
import { arrayLoad } from "./ast-array-load";
import { removeExtraProps } from "./ast-remove-props";
import { rewriteForall } from "./ast-rewrite-forall";
import { findLocalVars } from "./ast-find-local-vars";
import { extractIntDivision } from "./ast-extract-int-div";
import { printOutTree } from "./ast-printout";

// Load the ast (tree) from the file
// const file = await fs.promises.readFile("./dist/bwipp.mjs", "utf-8");

console.profile("processing");
const fileName = process.argv.slice(-1)[0];
const file = await fs.promises.readFile(fileName, "utf-8");
let tree = parse(file) as n.Node;

initVariables(tree);

// extractIntDivision(tree);

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));
extractFnParamsAndReturnsInGlobalFns(tree);
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (inlineConstants(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (simplifyBranchesWithCommonPop(tree));
while (simplifyBranchesWithCommonPush(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (simplifyIfForAccumulator(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

extractFnParamsAndReturnsInLocalFns(tree);

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));
// The refactored call-sites may now have common pops/pushes in if/else branches
while (simplifyBranchesWithCommonPop(tree));
while (simplifyBranchesWithCommonPush(tree));

while (simplifyIfForAccumulator(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (rewriteForall(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));
while (simplifyIfForAccumulator(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (inlineConstants(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

// findLocalVars(tree);

// DISABLED

console.profileEnd("processing");

while (arrayLoad(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

// if (false) {
//   findInTree(tree, n.FunctionDeclaration, (fnPath) => {
//     const pathNames = findPathNames(fnPath);
//     if (pathNames.length > 5) {
//       return;
//     }

//     findInTree(fnPath.get("body"), n.ExpressionStatement, (idPath) => {
//       if (!n.Identifier.check(idPath.node.expression)) return;
//       if (idPath.node.expression.name !== "inAFT") return;

//       console.log("FOUND", findPathNames(idPath));
//       idPath.insertAfter(b.expressionStatement(b.identifier("REP")));
//     });
//   });
// } else {
//   const paths: NodePath[] = [];
//   findInTree(tree, n.ExpressionStatement, (idPath) => {
//     if (!n.Identifier.check(idPath.node.expression)) return;
//     if (idPath.node.expression.name !== "inAFT") return;

//     paths.push(idPath as any);
//   });

//   for (const idPath of paths) {
//     console.log("FOUND", findPathNames(idPath));
//     // idPath.insertAfter(b.expressionStatement(b.identifier("REP")));
//   }
//   for (const idPath of paths) {
//     console.log("FOUND", findPathNames(idPath));
//     idPath.insertAfter(b.expressionStatement(b.identifier("REP")));
//   }
//   for (const idPath of paths) {
//     console.log("FOUND", findPathNames(idPath));
//     idPath.insertAfter(b.expressionStatement(b.identifier("REP")));
//   }
// }

// // removeExtraProps(tree);

// // while (arrayLoad(tree));
// // while (simplifyPushPop(tree));
// // while (simplifyLongDistancePushPops(tree));

// // TODO: Analyze refactored functions to see if they are stack-pure and if so allow matching push-pops across those gaps

await fs.promises.writeFile(fileName, print(tree).code);
