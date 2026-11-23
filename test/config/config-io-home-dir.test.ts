/**
 * config-io-home-dir.test.ts — Verifies CONFIG_DIR uses getAgentDir()
 * instead of process.env.HOME, so it works on Windows.
 */

import { describe, it, expect, vi, afterEach, afterAll } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

// Per-run temp dir: loadConfig() must never read a real user config file,
// on any OS. A fresh mkdtemp directory guarantees the defaults test below
// does not depend on the machine's filesystem state.
const MOCK_AGENT_DIR = mkdtempSync(join(tmpdir(), "be-reasonable-config-"));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getAgentDir: () => MOCK_AGENT_DIR,
}));

// Import after mock is set up
const { loadConfig } = await import("../../src/config/config-io.js");

afterEach(() => {
  rmSync(join(MOCK_AGENT_DIR, "be-reasonable.json"), { force: true });
});

afterAll(() => {
  rmSync(MOCK_AGENT_DIR, { recursive: true, force: true });
});

describe("config-io home directory resolution", () => {
  it("reads the global file from getAgentDir()", () => {
    writeFileSync(join(MOCK_AGENT_DIR, "be-reasonable.json"), '{"beConcise":{"enabled":true}}');

    expect(loadConfig().beConcise.enabled).toBe(true);
  });
});

describe("loadConfig defaults", () => {
  it("bakes in the built-in settings when no config file exists", () => {
    const config = loadConfig();
    expect(config.beConcise.enabled).toBe(false);
    expect(config.beConcise.maxChars).toBe(1200);
  });
});
