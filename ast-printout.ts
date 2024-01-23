import { parse, print } from "recast";
import { namedTypes as n, builders as b, visit } from "ast-types";
import { NodePath } from "ast-types/lib/node-path";

import { Type } from "ast-types/lib/types";
import { ExpressionKind } from "ast-types/lib/gen/kinds";

export function printOutTree(tree: n.Node, prefix: string, indent = 0) {
  const prefixStr = "\t".repeat(indent) + prefix + " ";
  if (tree === null) {
    console.log(prefixStr + "INCORRECT null!");
    return;
  }
  function reindent(str: string) {
    return str
      .split("\n")
      .map((line) => "\t".repeat(indent) + line)
      .join("\n");
  }

  if (n.File.check(tree)) {
    return printOutTree(tree.program, "", indent);
  }
  if (n.Program.check(tree) || n.BlockStatement.check(tree)) {
    for (let i = 0; i < tree.body.length; ++i) {
      printOutTree(tree.body[i], `${i}`, indent + 1);
    }
    return;
  }
  if (n.ExpressionStatement.check(tree)) {
    console.log(prefixStr + tree.type + print(tree).code);
    return printOutTree(tree.expression, "expr", indent + 1);
  }

  if (
    n.CallExpression.check(tree) ||
    n.BinaryExpression.check(tree) ||
    n.UnaryExpression.check(tree) ||
    n.ConditionalExpression.check(tree) ||
    n.UpdateExpression.check(tree)
  ) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code + " <more>"));
    return;
  }
  if (n.Identifier.check(tree) || n.Literal.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    return;
  }
  if (n.EmptyStatement.check(tree)) {
    console.log(prefixStr + tree.type + print(tree).code);
    return;
  }
  if (n.AssignmentExpression.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    printOutTree(tree.left, "left", indent + 1);
    printOutTree(tree.right, "right", indent + 1);
    return;
  }
  if (n.LogicalExpression.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    printOutTree(tree.left, "left", indent + 1);
    printOutTree(tree.right, "right", indent + 1);
    return;
  }
  // Expressions
  if (n.MemberExpression.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    printOutTree(tree.object, "object", indent + 1);
    printOutTree(tree.property, "property", indent + 1);
    return;
  }
  if (n.ArrayExpression.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    for (let i = 0; i < tree.elements.length; ++i) {
      printOutTree(tree.elements[i]!, `${i}`, indent + 1);
    }
    return;
  }
  if (n.ObjectExpression.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    for (let i = 0; i < tree.properties.length; ++i) {
      printOutTree(tree.properties[i]!, `${i}`, indent + 1);
    }
    return;
  }
  if (n.NewExpression.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    printOutTree(tree.callee, "callee", indent + 1);
    for (let i = 0; i < tree.arguments.length; ++i) {
      printOutTree(tree.arguments[i]!, `arguments.${i}`, indent + 1);
    }

    return;
  }

  if (n.VariableDeclaration.check(tree)) {
    console.log(prefixStr + tree.type + print(tree).code);
    for (let i = 0; i < tree.declarations.length; ++i) {
      printOutTree(tree.declarations[i], `${i}`, indent + 1);
    }
    return;
  }
  if (n.VariableDeclarator.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    printOutTree(tree.id, "id", indent + 1);
    tree.init && printOutTree(tree.init, "init", indent + 1);
    return;
  }
  if (
    n.FunctionDeclaration.check(tree) ||
    n.FunctionExpression.check(tree) ||
    n.ArrowFunctionExpression.check(tree)
  ) {
    console.log(
      prefixStr + tree.type + " " + (tree.id ? print(tree.id).code : "")
    );
    // console.log(reindent(print(tree).code));
    printOutTree(tree.body, "body", indent + 1);
    return;
  }
  if (n.ForStatement.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    tree.init && printOutTree(tree.init, "init", indent + 1);
    tree.test && printOutTree(tree.test, "test", indent + 1);
    tree.update && printOutTree(tree.update, "update", indent + 1);
    printOutTree(tree.body, "body", indent + 1);
    return;
  }
  if (n.ForOfStatement.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    tree.left && printOutTree(tree.left, "left", indent + 1);
    tree.right && printOutTree(tree.right, "right", indent + 1);
    printOutTree(tree.body, "body", indent + 1);
    return;
  }
  if (n.ForInStatement.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    tree.left && printOutTree(tree.left, "left", indent + 1);
    tree.right && printOutTree(tree.right, "right", indent + 1);
    printOutTree(tree.body, "body", indent + 1);
    return;
  }
  if (n.IfStatement.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    tree.test && printOutTree(tree.test, "test", indent + 1);
    printOutTree(tree.consequent, "consequent", indent + 1);
    tree.alternate && printOutTree(tree.alternate, "alternate", indent + 1);
    return;
  }
  if (n.ReturnStatement.check(tree)) {
    console.log(prefixStr + tree.type);
    console.log(reindent(print(tree).code));
    tree.argument && printOutTree(tree.argument, "argument", indent + 1);
    return;
  }
  if (n.BreakStatement.check(tree)) {
    console.log(prefixStr + tree.type);
    return;
  }

  throw new Error("Unknown node type " + tree.type);
}
