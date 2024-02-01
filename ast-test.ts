// Usage npx tsx ast-test.ts ./dist/bwipp.mjs

import { parse, print } from "recast";
import { namedTypes as n, builders as b } from "ast-types";

import * as fs from "node:fs";

import {
  findInTree,
  findPathNames,
  initVariables,
  reportVariableCount,
} from "./ast-helpers";
import {
  simplifyLongDistancePushPops,
  simplifyPushPop,
} from "./ast-simplify-pushpop";
import {
  simplifyBranchesWithCommonPop,
  simplifyBranchesWithCommonPush,
  simplifyExitingBranchesWithCommonPop,
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
import { delayPropertyAssignment } from "./ast-delay-property-assignment";
import { extractIntDivision } from "./ast-extract-int-div";
import { printOutTree } from "./ast-printout";
import { arrayPens } from "./ast-array-pens";
import { removeUnusedProps } from "./ast-remove-unused-props";
import { removeUnusedVars, simplifyVariables } from "./ast-simplify-variables";

// Load the ast (tree) from the file
// const file = await fs.promises.readFile("./dist/bwipp.mjs", "utf-8");

console.profile("processing");
const fileName = process.argv.slice(-1)[0];
const file = await fs.promises.readFile(fileName, "utf-8");
let tree = parse(file) as n.Node;

initVariables(tree);

extractIntDivision(tree);

// We want to start all the refactoring by rewriting $forall(xyz, callback) into a proper loop
// This makes other refactors simpler since we don't have to worry about callback order
// For example: rewriteForall refactor is required before the delayPropertyAssignment since
// delayPropertyAssignment assumes there is no indirect unknown call anywhere
rewriteForall(tree);

const accumulatorRound = (tree: n.Node) => {
  while (simplifyPushPop(tree));
  while (simplifyLongDistancePushPops(tree));
  return simplifyIfForAccumulator(tree);
};
while (accumulatorRound(tree));
while (simplifyBranchesWithCommonPop(tree));
while (simplifyExitingBranchesWithCommonPop(tree));
while (simplifyBranchesWithCommonPush(tree));
while (accumulatorRound(tree));

extractFnParamsAndReturnsInGlobalFns(tree);

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (inlineConstants(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (simplifyBranchesWithCommonPop(tree));
while (simplifyExitingBranchesWithCommonPop(tree));
while (simplifyBranchesWithCommonPush(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (accumulatorRound(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (inlineConstants(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (rewriteForall(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (arrayPens(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (accumulatorRound(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

extractFnParamsAndReturnsInLocalFns(tree);

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));
// The refactored call-sites may now have common pops/pushes in if/else branches
while (simplifyBranchesWithCommonPop(tree));
while (simplifyExitingBranchesWithCommonPop(tree));
while (simplifyBranchesWithCommonPush(tree));

while (accumulatorRound(tree));

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));
while (accumulatorRound(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (inlineConstants(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (arrayPens(tree));
while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

while (accumulatorRound(tree));

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));

delayPropertyAssignment(tree);
delayPropertyAssignment(tree);

// This is enabled by delayPropertyAssignment
removeUnusedProps(tree);

simplifyVariables(tree);
removeUnusedVars(tree);

// DISABLED SINCE IT POLLUTES THE GLOBAL NAMESPACE TOO MUCH
// removeExtraProps(tree);

console.profileEnd("processing");
reportVariableCount();

// while (arrayLoad(tree));
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

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

// // while (arrayLoad(tree));
// // while (simplifyPushPop(tree));
// // while (simplifyLongDistancePushPops(tree));

// // TODO: Analyze refactored functions to see if they are stack-pure and if so allow matching push-pops across those gaps

await fs.promises.writeFile(fileName, print(tree).code);
