/**
 * be-concise.test.ts — When a reply earns a trim request. The bound counts prose only, so a dense answer
 * whose length is code or a table is left alone, and one reply is never trimmed twice.
 */

import { describe, expect, it } from "vite-plus/test";
import { proseLength, shouldRequestTrim } from "../src/be-concise.js";
import type { BeReasonableConfig } from "../src/config/config-io.js";

function settings(overrides: Partial<BeReasonableConfig["beConcise"]> = {}): BeReasonableConfig {
  return {
    beConcise: { enabled: true, maxChars: 6, message: "Cut it.", ...overrides },
  };
}

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
    expect(shouldRequestTrim({ text: "abcdefg", config: settings(), alreadyTrimmed: false })).toBe(true);
  });

  it("stays quiet when the prose is exactly at the bound", () => {
    expect(shouldRequestTrim({ text: "abcdef", config: settings(), alreadyTrimmed: false })).toBe(false);
  });

  it("stays quiet while the setting is off", () => {
    const config = settings({ enabled: false });
    expect(shouldRequestTrim({ text: "abcdefg", config, alreadyTrimmed: false })).toBe(false);
  });

  it("stays quiet when the answer is already the reply to a trim request", () => {
    expect(shouldRequestTrim({ text: "abcdefg", config: settings(), alreadyTrimmed: true })).toBe(false);
  });
});
