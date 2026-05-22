/**
 * Attempts to repair truncated JSON by closing unterminated strings,
 * arrays, and objects. This is needed when LLM streaming responses
 * get cut off before the JSON is complete (e.g., hitting max_tokens).
 */
export function repairJSON(input: string): string {
  let text = input.trim();
  if (!text) return text;

  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Extract from first { or [ to end
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let startChar = '{';
  let startIdx = firstBrace;
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startChar = '[';
    startIdx = firstBracket;
  }
  if (startIdx === -1) return text;

  // Try to find matching end
  const lastBrace = text.lastIndexOf(startChar === '{' ? '}' : ']');
  if (lastBrace > startIdx) {
    const candidate = text.slice(startIdx, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate; // Already valid
    } catch {
      // Fall through to repair
    }
  }

  text = text.slice(startIdx);

  // Walk the string to figure out what's open
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  let i = 0;
  let lastGoodPos = 0;

  for (; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (inString) {
      if (ch === '"') {
        inString = false;
        lastGoodPos = i;
      }
      continue;
    }

    // Not in string
    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      stack.push('}');
      lastGoodPos = i;
    } else if (ch === '[') {
      stack.push(']');
      lastGoodPos = i;
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
        lastGoodPos = i;
      }
    } else if (ch === ',' || ch === ':') {
      lastGoodPos = i;
    }
  }

  let repaired = text;

  // Close unterminated string
  if (inString) {
    // Truncate trailing incomplete escape sequences
    if (repaired.endsWith('\\')) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  }

  // Remove trailing comma or colon (invalid at end of object/array)
  repaired = repaired.replace(/[,:]\s*$/, '');

  // If we ended mid-value after a colon (like "key": ), add null
  if (/:\s*$/.test(repaired)) {
    repaired += 'null';
  }

  // Close all open brackets/braces
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  // Validate the repair worked
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    // Last resort: try to find the largest valid JSON prefix
    // by progressively removing content from the end
    for (let trimPos = repaired.length - 1; trimPos > 0; trimPos--) {
      const ch = repaired[trimPos];
      if (ch === '}' || ch === ']') {
        try {
          const candidate = repaired.slice(0, trimPos + 1);
          JSON.parse(candidate);
          return candidate;
        } catch {
          continue;
        }
      }
    }
    // Nothing worked — return original and let caller handle the error
    return text;
  }
}
