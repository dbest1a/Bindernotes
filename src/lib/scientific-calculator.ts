export type AngleMode = "rad" | "deg";

type EvalOptions = {
  angleMode: AngleMode;
  ans?: number;
  functions?: Record<string, string>;
};

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: string }
  | { type: "leftParen" }
  | { type: "rightParen" }
  | { type: "comma" };

type OutputToken =
  | Token
  | { type: "function"; value: string }
  | { type: "operator"; value: string };

type EvalSuccess = {
  ok: true;
  value: number;
  formatted: string;
};

type EvalFailure = {
  ok: false;
  error: string;
};

export type EvalResult = EvalSuccess | EvalFailure;
export type FunctionDefinition = {
  name: string;
  expression: string;
};

const precedence: Record<string, number> = {
  "u+": 4,
  "u-": 4,
  "^": 3,
  "*": 2,
  "/": 2,
  "+": 1,
  "-": 1,
};

const rightAssociative = new Set(["^", "u+", "u-"]);
const builtInFunctions = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "root",
  "ln",
  "log",
  "abs",
]);
const functionDefinitionPattern =
  /^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\(\s*x\s*\)\s*=\s*(.+)\s*$/;

export function evaluateScientificExpression(
  expression: string,
  options: EvalOptions,
): EvalResult {
  try {
    const normalized = expandSavedFunctions(expression, options.functions ?? {});
    const tokens = insertImplicitMultiplication(tokenize(normalized));
    const rpn = toRpn(tokens);
    const value = evaluateRpn(rpn, options);

    if (!Number.isFinite(value)) {
      return { ok: false, error: "Result is not a finite number." };
    }

    return {
      ok: true,
      value,
      formatted: formatResult(value),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not evaluate expression.",
    };
  }
}

export function parseFunctionDefinition(expression: string): FunctionDefinition | null {
  const match = expression.match(functionDefinitionPattern);
  if (!match) {
    return null;
  }

  return {
    name: match[1],
    expression: match[2].trim(),
  };
}

export function prepareExpressionForGraph(
  expression: string,
  functions: Record<string, string> = {},
) {
  const normalized = expression.trim();
  if (!normalized) {
    return null;
  }

  const definition = parseFunctionDefinition(normalized);
  const graphable = expandSavedFunctions(definition?.expression ?? normalized, functions);

  if (definition) {
    return `y=${graphable}`;
  }

  if (graphable.includes("=")) {
    return graphable;
  }

  return `y=${graphable}`;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const current = expression[index];

    if (/\s/.test(current)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(current)) {
      let end = index + 1;
      while (end < expression.length && /[0-9.]/.test(expression[end])) {
        end += 1;
      }

      const value = Number(expression.slice(index, end));
      if (Number.isNaN(value)) {
        throw new Error("Invalid number.");
      }

      tokens.push({ type: "number", value });
      index = end;
      continue;
    }

    if (/[a-zA-Z]/.test(current)) {
      let end = index + 1;
      while (end < expression.length && /[a-zA-Z0-9_]/.test(expression[end])) {
        end += 1;
      }

      tokens.push({
        type: "identifier",
        value: expression.slice(index, end).toLowerCase(),
      });
      index = end;
      continue;
    }

    if ("+-*/^".includes(current)) {
      tokens.push({ type: "operator", value: current });
      index += 1;
      continue;
    }

    if (current === "(") {
      tokens.push({ type: "leftParen" });
      index += 1;
      continue;
    }

    if (current === ")") {
      tokens.push({ type: "rightParen" });
      index += 1;
      continue;
    }

    if (current === ",") {
      tokens.push({ type: "comma" });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported character "${current}".`);
  }

  return tokens;
}

function insertImplicitMultiplication(tokens: Token[]) {
  const nextTokens: Token[] = [];

  tokens.forEach((token, index) => {
    const previous = nextTokens[nextTokens.length - 1];
    const upcoming = tokens[index];

    if (shouldInsertMultiply(previous, upcoming, tokens[index + 1])) {
      nextTokens.push({ type: "operator", value: "*" });
    }

    nextTokens.push(token);
  });

  return nextTokens;
}

function shouldInsertMultiply(previous: Token | undefined, current: Token, next: Token | undefined) {
  if (!previous) {
    return false;
  }

  const previousEndsValue =
    previous.type === "number" ||
    previous.type === "rightParen" ||
    previous.type === "identifier";

  const currentStartsValue =
    current.type === "number" ||
    current.type === "leftParen" ||
    current.type === "identifier";

  if (!previousEndsValue || !currentStartsValue) {
    return false;
  }

  if (
    previous.type === "identifier" &&
    current.type === "leftParen" &&
    builtInFunctions.has(previous.value)
  ) {
    return false;
  }

  if (
    current.type === "identifier" &&
    next?.type === "leftParen" &&
    builtInFunctions.has(current.value)
  ) {
    return true;
  }

  return true;
}

function toRpn(tokens: Token[]) {
  const output: OutputToken[] = [];
  const operators: OutputToken[] = [];
  let previous: Token | undefined;

  tokens.forEach((token, index) => {
    const next = tokens[index + 1];

    if (token.type === "number") {
      output.push(token);
      previous = token;
      return;
    }

    if (token.type === "identifier") {
      if (next?.type === "leftParen" && builtInFunctions.has(token.value)) {
        operators.push({ type: "function", value: token.value });
      } else {
        output.push(token);
      }
      previous = token;
      return;
    }

    if (token.type === "comma") {
      while (operators.length && operators[operators.length - 1]?.type !== "leftParen") {
        output.push(operators.pop() as OutputToken);
      }
      previous = token;
      return;
    }

    if (token.type === "leftParen") {
      operators.push(token);
      previous = token;
      return;
    }

    if (token.type === "rightParen") {
      while (operators.length && operators[operators.length - 1]?.type !== "leftParen") {
        output.push(operators.pop() as OutputToken);
      }

      if (!operators.length) {
        throw new Error("Mismatched parentheses.");
      }

      operators.pop();
      if (operators[operators.length - 1]?.type === "function") {
        output.push(operators.pop() as OutputToken);
      }
      previous = token;
      return;
    }

    if (token.type === "operator") {
      const unary =
        !previous || previous.type === "operator" || previous.type === "leftParen" || previous.type === "comma";
      const operator = unary ? `u${token.value}` : token.value;

      while (operators.length) {
        const top = operators[operators.length - 1];

        if (top.type === "leftParen") {
          break;
        }

        if (top.type === "function") {
          output.push(operators.pop() as OutputToken);
          continue;
        }

        if (top.type === "operator") {
          const higher =
            precedence[top.value] > precedence[operator] ||
            (precedence[top.value] === precedence[operator] && !rightAssociative.has(operator));
          if (higher) {
            output.push(operators.pop() as OutputToken);
            continue;
          }
        }

        break;
      }

      operators.push({ type: "operator", value: operator });
      previous = { type: "operator", value: operator };
    }
  });

  while (operators.length) {
    const token = operators.pop() as OutputToken;
    if (token.type === "leftParen") {
      throw new Error("Mismatched parentheses.");
    }
    output.push(token);
  }

  return output;
}

function evaluateRpn(tokens: OutputToken[], options: EvalOptions) {
  const stack: number[] = [];
  const constants = {
    ans: options.ans ?? 0,
    e: Math.E,
    pi: Math.PI,
  };

  tokens.forEach((token) => {
    if (token.type === "number") {
      stack.push(token.value);
      return;
    }

    if (token.type === "identifier") {
      const value = constants[token.value as keyof typeof constants];
      if (typeof value !== "number") {
        throw new Error(`Unknown symbol "${token.value}".`);
      }
      stack.push(value);
      return;
    }

    if (token.type === "function") {
      applyFunction(stack, token.value, options.angleMode);
      return;
    }

    if (token.type === "operator") {
      applyOperator(stack, token.value);
    }
  });

  if (stack.length !== 1) {
    throw new Error("Expression could not be evaluated.");
  }

  return stack[0];
}

function applyOperator(stack: number[], operator: string) {
  if (operator === "u+" || operator === "u-") {
    const value = stack.pop();
    if (value === undefined) {
      throw new Error("Missing value.");
    }
    stack.push(operator === "u-" ? -value : value);
    return;
  }

  const right = stack.pop();
  const left = stack.pop();
  if (left === undefined || right === undefined) {
    throw new Error("Missing values.");
  }

  switch (operator) {
    case "+":
      stack.push(left + right);
      return;
    case "-":
      stack.push(left - right);
      return;
    case "*":
      stack.push(left * right);
      return;
    case "/":
      stack.push(left / right);
      return;
    case "^":
      stack.push(left ** right);
      return;
    default:
      throw new Error(`Unsupported operator "${operator}".`);
  }
}

function applyFunction(stack: number[], name: string, angleMode: AngleMode) {
  const unary = () => {
    const value = stack.pop();
    if (value === undefined) {
      throw new Error(`Missing value for ${name}.`);
    }
    return value;
  };

  switch (name) {
    case "sin":
      stack.push(Math.sin(toRadians(unary(), angleMode)));
      return;
    case "cos":
      stack.push(Math.cos(toRadians(unary(), angleMode)));
      return;
    case "tan":
      stack.push(Math.tan(toRadians(unary(), angleMode)));
      return;
    case "asin":
      stack.push(fromRadians(Math.asin(unary()), angleMode));
      return;
    case "acos":
      stack.push(fromRadians(Math.acos(unary()), angleMode));
      return;
    case "atan":
      stack.push(fromRadians(Math.atan(unary()), angleMode));
      return;
    case "sqrt":
      stack.push(Math.sqrt(unary()));
      return;
    case "ln":
      stack.push(Math.log(unary()));
      return;
    case "log":
      stack.push(Math.log10(unary()));
      return;
    case "abs":
      stack.push(Math.abs(unary()));
      return;
    case "root": {
      const radicand = stack.pop();
      const degree = stack.pop();
      if (degree === undefined || radicand === undefined) {
        throw new Error("root(degree, value) needs two arguments.");
      }
      stack.push(radicand ** (1 / degree));
      return;
    }
    default:
      throw new Error(`Unsupported function "${name}".`);
  }
}

function toRadians(value: number, angleMode: AngleMode) {
  if (angleMode === "deg") {
    return (value * Math.PI) / 180;
  }

  return value;
}

function fromRadians(value: number, angleMode: AngleMode) {
  if (angleMode === "deg") {
    return (value * 180) / Math.PI;
  }

  return value;
}

function formatResult(value: number) {
  const normalized = Math.abs(value) < 1e-12 ? 0 : value;
  if (Number.isInteger(normalized)) {
    return normalized.toString();
  }

  return Number(normalized.toPrecision(12)).toString();
}

function expandSavedFunctions(
  expression: string,
  functions: Record<string, string>,
  depth = 0,
): string {
  if (depth > 8) {
    throw new Error("Function expansion is too deep.");
  }

  let result = "";
  let index = 0;

  while (index < expression.length) {
    const current = expression[index];
    if (!/[a-zA-Z]/.test(current)) {
      result += current;
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < expression.length && /[a-zA-Z0-9_]/.test(expression[end])) {
      end += 1;
    }

    const name = expression.slice(index, end);
    const parenIndex = skipWhitespace(expression, end);
    const body = functions[name];

    if (!body || expression[parenIndex] !== "(") {
      result += expression.slice(index, end);
      index = end;
      continue;
    }

    const closingParen = findMatchingParen(expression, parenIndex);
    const argument = expression.slice(parenIndex + 1, closingParen);
    const expandedArgument = expandSavedFunctions(argument, functions, depth + 1);
    const substituted = body.replace(/\bx\b/g, `(${expandedArgument})`);
    result += `(${expandSavedFunctions(substituted, functions, depth + 1)})`;
    index = closingParen + 1;
  }

  return result;
}

function skipWhitespace(expression: string, index: number) {
  let next = index;
  while (next < expression.length && /\s/.test(expression[next])) {
    next += 1;
  }
  return next;
}

function findMatchingParen(expression: string, index: number) {
  let depth = 0;

  for (let cursor = index; cursor < expression.length; cursor += 1) {
    if (expression[cursor] === "(") {
      depth += 1;
    } else if (expression[cursor] === ")") {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }
  }

  throw new Error("Mismatched parentheses.");
}
