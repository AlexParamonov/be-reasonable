/**
 * be-concise.ts — Decide whether a reply is long enough in prose to ask for a trim.
 *
 * Only prose counts. A table or a code block is the answer, not padding, and counting it would trim the
 * densest replies hardest. One reply is answered once: a second request after an already-shortened answer
 * is a loop that costs a turn per round.
 */
import type { BeConciseConfig } from "./config/config-io.ts";

/** A fenced block, closed or left open to the end of the message. */
const FENCE = /```[\s\S]*?(?:```|$)/g;
/** A markdown table row, including its separator row. */
const TABLE_ROW = /^\s*\|.*\|?\s*$/;

/** Characters of prose in a reply: fenced blocks and table rows removed, whitespace collapsed. */
export function proseLength(text: string): number {
  return text
    .replace(FENCE, " ")
    .split("\n")
    .filter((line) => !TABLE_ROW.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim().length;
}

export interface TrimInput {
  /** The reply the model just produced. */
  text: string;
  beConcise: BeConciseConfig;
  /** The reply is the answer to the trim request already sent for it. */
  alreadyTrimmed: boolean;
}

export function shouldRequestTrim({ text, beConcise, alreadyTrimmed }: TrimInput): boolean {
  if (!beConcise.enabled || alreadyTrimmed) return false;
  return proseLength(text) > beConcise.maxChars;
}
