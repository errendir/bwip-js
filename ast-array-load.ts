import { print } from "recast";
import { namedTypes as n } from "ast-types";

import {
  findInTree,
  findLeadingPopsAndTrailingPushes,
  findLeftRight,
  findNextStatement,
  findPrevStatement,
  genVariable,
  getPushedValue,
  insertAfter,
  replace,
} from "./ast-helpers";
import { NodePath } from "ast-types/lib/node-path";

export function arrayLoad(tree: n.Node) {
  let editCount = 0;
  findInTree(tree, n.ExpressionStatement, (thisPath) => {
    const thisNode = thisPath.node;
    if (!print(thisNode).code.includes("$k[$j++] = Infinity;")) return;

    const statements: {
      path: NodePath<any>;
      data:
        | { type: "aload"; expr: string }
        | { type: "forall"; expr: string }
        | { type: "element"; expr: string };
    }[] = [];

    let ending: ReturnType<typeof findNextStatement> | null = null;
    let next: ReturnType<typeof findNextStatement>;
    let currentPath: NodePath<any> = thisPath;
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
        if (print(node.expression.callee).code === "$aload") {
          return {
            type: "aload" as const,
            expr: print(node.expression.arguments[0]).code,
          };
        }
        if (
          print(node.expression.callee).code === "$forall" &&
          node.expression.arguments.length === 1
        ) {
          return {
            type: "forall" as const,
            expr: print(node.expression.arguments[0]).code,
          };
        }
        return null;
      }
      if (n.AssignmentExpression.check(node.expression)) {
        if (print(node.expression.left).code !== "$k[$j++]") return null;
        const right = print(node.expression.right).code;

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
      const leftRight = findLeftRight(node);
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

    const { fullLeft } = findLeftRight(ending.node)!;
    const right = `$a([${statements
      .map(({ data }) =>
        data.type === "element"
          ? data.expr
          : data.type === "aload"
          ? `...$aload_it(${data.expr})`
          : `...$forall_it(${data.expr})`
      )
      .join(",")}])`;
    replace(ending.path, `${fullLeft} = ${right};\n`);

    editCount++;
  });
  console.log("array edit count", editCount);
  return editCount;
}
