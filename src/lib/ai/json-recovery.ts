import type { z } from "zod";

export class AiResponseValidationError extends Error {
  readonly userMessage =
    "AI 응답 형식을 확인할 수 없습니다. 기존 데이터는 보존되었습니다. 잠시 후 다시 시도해 주세요.";

  constructor(
    message: string,
    readonly causeDetails?: unknown,
  ) {
    super(message);
    this.name = "AiResponseValidationError";
  }
}

function unwrapCodeFence(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function findBalancedJson(input: string): string | undefined {
  const objectStart = input.indexOf("{");
  const arrayStart = input.indexOf("[");
  const start =
    objectStart < 0
      ? arrayStart
      : arrayStart < 0
        ? objectStart
        : Math.min(objectStart, arrayStart);
  if (start < 0) return undefined;

  const open = input[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return input.slice(start, index + 1);
    }
  }
  return undefined;
}

function conservativeRepair(input: string): string {
  return input
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/^\uFEFF/, "");
}

export function parseAndValidateJson<T>(
  raw: string,
  schema: z.ZodType<T>,
): T {
  const unwrapped = unwrapCodeFence(raw);
  const balanced = findBalancedJson(unwrapped);
  const candidates = [
    unwrapped,
    balanced,
    conservativeRepair(unwrapped),
    balanced ? conservativeRepair(balanced) : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  let lastError: unknown;
  for (const candidate of [...new Set(candidates)]) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const validated = schema.safeParse(parsed);
      if (validated.success) return validated.data;
      lastError = validated.error;
    } catch (error) {
      lastError = error;
    }
  }

  throw new AiResponseValidationError(
    "Provider returned invalid structured JSON.",
    lastError,
  );
}
