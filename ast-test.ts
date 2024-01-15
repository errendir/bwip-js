// Usage npx tsx ast-test.ts ./dist/bwipp.mjs

import { parse, print } from "recast";
import { namedTypes as n } from "ast-types";

import * as fs from "node:fs";

import { initVariables } from "./ast-helpers";
import {
  simplifyLongDistancePushPops,
  simplifyPushPop,
} from "./ast-simplify-pushpop";
import {
  simplifyBranchesWithCommonPop,
  simplifyBranchesWithCommonPush,
} from "./ast-extract-common-push-pop";
import { simplifyIfForAccumulator } from "./ast-accumulator";
import { extractFnParamsAndReturns } from "./ast-extract-fn-params-and-returns";
import { inlineConstants } from "./ast-inline-constants";
import { arrayLoad } from "./ast-array-load";
import { removeExtraProps } from "./ast-remove-props";
import { rewriteForall } from "./ast-rewrite-forall";

// Load the ast (tree) from the file
// const file = await fs.promises.readFile("./dist/bwipp.mjs", "utf-8");

const fileName = process.argv.slice(-1)[0];
const file = await fs.promises.readFile(fileName, "utf-8");
let tree = parse(file) as n.Node;

initVariables(file);

// while (simplifyBranchesWithCommonPop(tree));
// while (simplifyBranchesWithCommonPush(tree));
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

// // // tree = parse(print(tree).code);

while (simplifyPushPop(tree));
while (simplifyLongDistancePushPops(tree));
// while (simplifyIfForAccumulator(tree));
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

// extractFnParamsAndReturns(tree);
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));
// // The refactored call-sites may now have common pops/pushes in if/else branches
// while (simplifyBranchesWithCommonPop(tree));
// while (simplifyBranchesWithCommonPush(tree));

// while (simplifyIfForAccumulator(tree));
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

// while (inlineConstants(tree));
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

// while (arrayLoad(tree));
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

// while (arrayLoad(tree));
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

// while (rewriteForall(tree));
// while (simplifyPushPop(tree));
// while (simplifyLongDistancePushPops(tree));

// removeExtraProps(tree);

// TODO: Analyze refactored functions to see if they are stack-pure and if so allow matching push-pops across those gaps

await fs.promises.writeFile(fileName, print(tree).code);
