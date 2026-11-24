/**
 * be-concise.test.ts — When a reply earns a trim request. The bound counts prose only, so a dense answer
 * whose length is code or a table is left alone, and one reply is never trimmed twice.
 */

import { describe, expect, it } from "vite-plus/test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { proseLength, shouldRequestTrim } from "../src/be-concise.js";
import { trimContextEdits } from "../src/be-concise-context.js";
import { assistant, toolResult } from "./concise-fixtures.js";
import type { BeConciseConfig } from "../src/config/config-io.js";

function settings(overrides: Partial<BeConciseConfig> = {}): BeConciseConfig {
  return { enabled: true, maxChars: 6, message: "Cut it.", ...overrides };
}

describe("trim context edits", () => {
  it("omits the request and the whole model reply, including tool results", () => {
    const session = SessionManager.inMemory();
    session.appendMessage(assistant("Full answer"));
    const request = session.appendCustomMessageEntry("be-concise", "Cut it.", true);
    const call = session.appendMessage(
      assistant("", {
        content: [{ type: "toolCall", id: "call", name: "read", arguments: {} }],
        stopReason: "toolUse",
      }),
    );
    const result = session.appendMessage(toolResult());
    const reply = session.appendMessage(assistant("Short answer"));

    expect(trimContextEdits(session.buildSessionProjection().entries)).toEqual([
      { type: "context_edit", targetId: request, replacement: null },
      { type: "context_edit", targetId: call, replacement: null },
      { type: "context_edit", targetId: result, replacement: null },
      { type: "context_edit", targetId: reply, replacement: null },
    ]);
  });
});

describe("proseLength", () => {
  it("measures an answer that carries a code block by its prose only", () => {
    expect(proseLength("Verdict line.\n\n```sh\nmake test\n```\n")).toBe(13);
  });

  it("measures an answer that carries a table by its prose only", () => {
    expect(proseLength("Verdict line.\n\n| a | b |\n|---|---|\n| 1 | 2 |")).toBe(13);
  });

  it("treats everything after an unclosed fence as code", () => {
    expect(proseLength("Verdict line.\n\n```sh\nmake test")).toBe(13);
  });
});

describe("shouldRequestTrim", () => {
  it("requests a trim once the prose passes the bound", () => {
    expect(shouldRequestTrim({ text: "abcdefg", beConcise: settings(), alreadyTrimmed: false })).toBe(true);
  });

  it("stays quiet when the prose is exactly at the bound", () => {
    expect(shouldRequestTrim({ text: "abcdef", beConcise: settings(), alreadyTrimmed: false })).toBe(false);
  });

  it("stays quiet while the setting is off", () => {
    const beConcise = settings({ enabled: false });
    expect(shouldRequestTrim({ text: "abcdefg", beConcise, alreadyTrimmed: false })).toBe(false);
  });

  it("stays quiet when the answer is already the reply to a trim request", () => {
    expect(shouldRequestTrim({ text: "abcdefg", beConcise: settings(), alreadyTrimmed: true })).toBe(false);
  });
});
