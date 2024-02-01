import { print } from "recast";
import { namedTypes as n, builders as b } from "ast-types";

import {
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findPrevStatement,
  genVariable,
  getPushedValue,
  insertAfter,
  replace,
  findTrailingPushes,
  isStatementStackPure,
  isExpressionStackPure,
  findNextStatement,
} from "./ast-helpers";
import { NodePath } from "ast-types/lib/node-path";
import { printOutTree } from "./ast-printout";
import { ExpressionKind } from "ast-types/lib/gen/kinds";

export function simplifyVariables(tree: n.Node) {
  findInTree(tree, n.VariableDeclaration, (varPath) => {
    const declr = varPath.node.declarations[0];
    if (!n.VariableDeclarator.check(declr)) return;
    if (!n.Identifier.check(declr.id)) return;
    const variableName = declr.id.name;

    // Only continue if the variable is initialized with nothing or a direct reference to another variable
    if (declr.init && !n.Identifier.check(declr.init)) return;
    let currentHeldValue = declr.init?.name ?? null;

    // Don't process the ___e variables since they are not globally unique and nested loops may get incorrect inlinings
    if (currentHeldValue === "___e") return;

    // We assume there are no assignemnt expressions deep in the statements
    // This is not true for the loop variables, so we skip them above
    function rewriteInExpression(expr: NodePath) {
      findInTree(expr, n.Identifier, (idPath) => {
        if (idPath.node.name !== variableName) return;
        if (currentHeldValue) {
          idPath.replace(b.identifier(currentHeldValue));
        } else {
          printOutTree(idPath.parentPath.node, "");
          throw new Error(
            "Variable was used before it was initialized! " + variableName
          );
        }
      });
    }

    function iterateOverStatements(
      from: NodePath<n.Statement>,
      includeThisStatement = false,
      allowReassignemnt = true
    ): boolean {
      let oldStmt = from;
      let currentStmt = includeThisStatement
        ? from
        : findNextStatement(oldStmt)?.path;
      while (true) {
        if (!currentStmt) return true;

        if (currentStmt.node !== currentStmt.value) {
          printOutTree(currentStmt.parentPath.node, "");
          throw new Error("Please provide only paths to nodes");
        }

        if (
          n.ExpressionStatement.check(currentStmt.node) &&
          n.AssignmentExpression.check(currentStmt.node.expression) &&
          n.Identifier.check(currentStmt.node.expression.left)
        ) {
          const leftVarName = currentStmt.node.expression.left.name;
          const rightExpr = currentStmt.node.expression.right;
          if (leftVarName === variableName) {
            // Re-assignment cannot be propagated to the outside block
            if (!allowReassignemnt) return false;
            // UNTRACKABLE!
            if (!n.Identifier.check(rightExpr)) return false;
            // Don't process the ___e variables since they are not globally unique and nested loops may get incorrect inlinings
            if (rightExpr.name === "___e") return false;
            currentHeldValue = rightExpr.name;
          }
        } else if (n.ExpressionStatement.check(currentStmt.node)) {
          rewriteInExpression(currentStmt.get("expression"));
        } else if (n.VariableDeclaration.check(currentStmt.node)) {
          for (let i = 0; i < currentStmt.node.declarations.length; ++i) {
            rewriteInExpression(currentStmt.get("declarations").get(i));
          }
        } else if (n.BlockStatement.check(currentStmt.node)) {
          if (currentStmt.node.body.length > 0) {
            const canContinue = iterateOverStatements(
              currentStmt.get("body").get(0),
              true,
              false
            );
            if (!canContinue) return false;
          }
        } else if (n.IfStatement.check(currentStmt.node)) {
          rewriteInExpression(currentStmt.get("test"));
          const ret1 = iterateOverStatements(
            currentStmt.get("consequent"),
            true,
            false
          );
          if (!ret1) return false;
          if (currentStmt.node.alternate) {
            const ret2 = iterateOverStatements(
              currentStmt.get("alternate"),
              true,
              false
            );
            if (!ret2) return false;
          }
        } else if (n.ForStatement.check(currentStmt.node)) {
          currentStmt.node.init && rewriteInExpression(currentStmt.get("init"));
          // We do not rewrite the test since the var might have been modified in the body of the loop
          const ret1 = iterateOverStatements(
            currentStmt.get("body"),
            true,
            false
          );
          if (!ret1) return false;
        } else if (
          n.ForOfStatement.check(currentStmt.node) ||
          n.ForInStatement.check(currentStmt.node)
        ) {
          rewriteInExpression(currentStmt.get("right"));
          if (n.BlockStatement.check(currentStmt.get("body").node)) {
            const ret1 = iterateOverStatements(
              currentStmt.get("body"),
              true,
              false
            );
            if (!ret1) return false;
          }
        } else if (
          n.ReturnStatement.check(currentStmt.node) ||
          n.ThrowStatement.check(currentStmt.node)
        ) {
          currentStmt.node.argument &&
            rewriteInExpression(currentStmt.get("argument"));
        } else if (
          n.BreakStatement.check(currentStmt.node) ||
          n.ContinueStatement.check(currentStmt.node) ||
          n.FunctionDeclaration.check(currentStmt.node) ||
          n.EmptyStatement.check(currentStmt.node)
        ) {
          // NOOP
        } else {
          console.log("TREE");
          printOutTree(from.parentPath.parentPath.parentPath.node, "");
          throw new Error("Cannot handle node " + currentStmt.node.type);
        }

        currentStmt = findNextStatement(currentStmt)?.path;
      }
    }
    iterateOverStatements(varPath);
  });
}

// Find variables that are only assigned to (never read) and remove them. Keep the side-effects of the assignments expressions
export function removeUnusedVars(tree: n.Node) {
  const accessesByVar = new Map<
    string,
    {
      reads: number;
      writes: { path: NodePath; right: ExpressionKind | null | undefined }[];
    }
  >();
  const getAccesses = (varName: string) => {
    if (accessesByVar.has(varName)) return accessesByVar.get(varName)!;
    const accesses = { reads: 0, writes: [] };
    accessesByVar.set(varName, accesses);
    return accesses;
  };

  findInTree(tree, n.Identifier, (idPath) => {
    // Ignore the property of the non-computed member expression. That's not a real identifier
    if (
      idPath.name === "property" &&
      n.MemberExpression.check(idPath.parentPath.value) &&
      idPath.parentPath.value.computed === false
    ) {
      return;
    }

    const accesses = getAccesses(idPath.node.name);
    const parent = idPath.parentPath.value;

    if (idPath.name === "left" && n.AssignmentExpression.check(parent)) {
      console.log(idPath.parentPath.parentPath.value.type);
      accesses.writes.push({
        path: idPath.parentPath.parentPath,
        right: parent.right,
      });
    } else if (idPath.name === "id" && n.VariableDeclarator.check(parent)) {
      // console.log(idPath.parentPath.parentPath.parentPath.value.type)
      accesses.writes.push({
        path: idPath.parentPath.parentPath.parentPath,
        right: parent.init,
      });
    } else {
      accesses.reads += 1;
    }
  });

  for (const [varName, accesses] of accessesByVar.entries()) {
    if (accesses.reads !== 0) continue;
    console.log("REMOVING", varName);

    // Give up on the variables declared in the for loops
    if (accesses.writes.some((w) => n.ForStatement.check(w.path.value))) return;

    for (const write of accesses.writes) {
      if (n.Identifier.check(write.right) || !write.right) {
        write.path.replace(b.emptyStatement());
      } else {
        write.path.replace(b.expressionStatement(write.right));
      }
    }
  }
}
