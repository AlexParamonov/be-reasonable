/**
 * bootstrap-reporting.test.ts — which read of the config files speaks.
 *
 * The shell builds a loading ConfigStore at extension load so the tools can be registered, and
 * session_start then reloads the same files. One config file must therefore be reported by exactly one
 * of those reads, or every bad value is printed twice on every Pi start.
 */
import { describe, it, expect, vi, afterEach, afterAll, beforeEach } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const MOCK_AGENT_DIR = mkdtempSync(join(tmpdir(), "be-reasonable-bootstrap-"));
const GLOBAL_CONFIG_PATH = join(MOCK_AGENT_DIR, "be-reasonable.json");

beforeEach(() => {
  vi.resetModules();
  vi.doMock("@earendil-works/pi-coding-agent", () => ({ getAgentDir: () => MOCK_AGENT_DIR }));
});

afterEach(() => {
  vi.doUnmock("@earendil-works/pi-coding-agent");
  rmSync(GLOBAL_CONFIG_PATH, { force: true });
});

afterAll(() => {
  rmSync(MOCK_AGENT_DIR, { recursive: true, force: true });
});

/** Every console.warn message the action printed, in order. */
async function warningsOf(action: () => unknown): Promise<string[]> {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    await action();
    return warn.mock.calls.map((call) => String(call[0]));
  } finally {
    warn.mockRestore();
  }
}

describe("the one read that reports", () => {
  it("prints a bad global value once: silently when the store is built, loudly when session_start reloads", async () => {
    writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify({ beConcise: { maxChars: "many" } }));

    const built = await warningsOf(async () => {
      const { ConfigStore } = await import("../../src/config/config-store.js");
      return new ConfigStore();
    });
    expect(built).toEqual([]);

    const { ConfigStore } = await import("../../src/config/config-store.js");
    const store = new ConfigStore();
    const atSessionStart = await warningsOf(async () => {
      store.setProjectDir(undefined);
      store.reload();
    });

    expect(atSessionStart).toHaveLength(1);
    expect(atSessionStart[0]).toContain("beConcise.maxChars");
  });

  it("reports a read that did not say otherwise, and none that asked for silence", async () => {
    writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify({ beConcise: { maxChars: "many" } }));
    const { createConfigIO } = await import("../../src/config/config-io.js");
    const io = createConfigIO();

    expect(await warningsOf(() => io.load({ report: false }))).toEqual([]);
    expect(await warningsOf(() => io.load())).toHaveLength(1);
  });
});
