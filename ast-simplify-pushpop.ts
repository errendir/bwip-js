import { print } from "recast";
import { namedTypes as n } from "ast-types";

import {
  findInTree,
  findLeadingPopsFrom,
  findNextStatement,
  genVariable,
  getPushedValue,
  replace,
} from "./ast-helpers";
import { NodePath } from "ast-types/lib/node-path";

export function simplifyLongDistancePushPops(tree: n.Node) {
  let simplifyCount = 0;

  findInTree(tree, n.AssignmentExpression, (assignmentPath) => {
    if (print(assignmentPath.node.left).code !== "$k[$j++]") return;
    const thisPath = assignmentPath.parentPath as NodePath;
    if (!n.ExpressionStatement.check(thisPath.node)) return;

    // findLeadingPopsFrom
    const leadingPop = findLeadingPopsFrom(thisPath, false)[0];
    if (!leadingPop) return;

    const variableName = genVariable();
    leadingPop.eliminate(variableName);
    replace(
      thisPath,
      `var ${variableName} = ${print(assignmentPath.node.right).code};\n`
    );
    simplifyCount++;
  });

  console.log("simplify long push-pop", simplifyCount);
  // console.log(
  //   "impure calls",
  //   new Map(Array.from(impureCalls.entries()).sort((a, b) => b[1] - a[1]))
  // );
  return simplifyCount;
}

export function simplifyPushPop(tree: n.Node) {
  let pushPopEditCount = 0;
  findInTree(tree, n.ExpressionStatement, (pushPath) => {
    const thisNode = pushPath.node;
    const next = findNextStatement(pushPath);
    if (!next) return;
    const { node, path } = next;

    const pushedValue = getPushedValue(thisNode);
    if (!pushedValue) return;

    // console.log("EXPR", print(pushPath.node).code, print(next.path.node).code);

    const tryVariable = () => {
      if (!n.VariableDeclaration.check(node)) return false;
      const [declr] = node.declarations;
      if (!n.VariableDeclarator.check(declr)) return false;
      const id = declr.id;
      if (!n.Identifier.check(id)) return;

      if (!declr.init || print(declr.init).code !== "$k[--$j]") return;

      //   console.log("pair");
      //   console.log(print(thisNode).code);
      //   console.log(print(node).code);

      pushPath.prune();
      replace(path, `var ${id.name} = ${print(pushedValue).code};\n`);

      pushPopEditCount++;
      return true;
    };

    const tryAssignment = () => {
      if (!n.ExpressionStatement.check(node)) return false;
      if (!n.AssignmentExpression.check(node.expression)) return false;
      if (print(node.expression.right).code !== "$k[--$j]") return;

      //   console.log("pair");
      //   console.log(print(thisNode).code);
      //   console.log(print(node).code);

      pushPath.prune();
      const left = print(node.expression.left).code;
      const right = print(pushedValue).code;
      replace(path, `${left} = ${right};\n`);

      pushPopEditCount++;
      return true;
    };

    function tryRawPop() {
      if (!n.ExpressionStatement.check(node)) return false;
      if (print(node.expression).code === "$j--") {
        pushPath.prune();
        path.prune();

        pushPopEditCount++;
        return true;
      }
      if (
        n.AssignmentExpression.check(node.expression) &&
        node.expression.operator === "-=" &&
        print(node.expression.left).code === "$j" &&
        n.Literal.check(node.expression.right) &&
        typeof node.expression.right.value === "number" &&
        node.expression.right.value > 0
      ) {
        pushPath.prune();
        if (node.expression.right.value === 1) {
          path.prune();
        } else {
          replace(path, `$j -= ${node.expression.right.value - 1};\n`);
        }

        pushPopEditCount++;
        return true;
      }
    }

    tryVariable() || tryAssignment() || tryRawPop();
  });
  console.log("push-pop edit count", pushPopEditCount);
  return pushPopEditCount;
}
