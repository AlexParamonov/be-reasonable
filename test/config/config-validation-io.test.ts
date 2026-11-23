/**
 * config-validation-io.test.ts — Load-time validation through the real
 * file read path: bad values warn once per key, drop from the effective
 * config, keep valid keys, and leave file bytes unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const MOCK_AGENT_DIR = mkdtempSync(join(tmpdir(), "be-reasonable-validate-global-"));
const GLOBAL_CONFIG_PATH = join(MOCK_AGENT_DIR, "be-reasonable.json");

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getAgentDir: () => MOCK_AGENT_DIR,
}));

const { createConfigIO, loadConfig, mergeDefaults, mergeLayers } = await import("../../src/config/config-io.js");
const { ConfigStore } = await import("../../src/config/config-store.js");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "be-reasonable-validate-project-"));
  rmSync(GLOBAL_CONFIG_PATH, { force: true });
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(MOCK_AGENT_DIR, { recursive: true, force: true });
});

function writeGlobal(config: unknown): void {
  writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config));
}

function writeProject(config: unknown): void {
  writeFileSync(join(projectDir, "be-reasonable.json"), JSON.stringify(config));
}

describe("load-time validation — global layer", () => {
  it("warns on a message that is not text, drops it and keeps valid keys", () => {
    writeGlobal({ beConcise: { message: { text: "x" }, maxChars: 900 } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loaded = createConfigIO().load();
      expect(loaded.global.beConcise).toEqual({ maxChars: 900 });
      expect(warn).toHaveBeenCalledOnce();
      const msg = warn.mock.calls[0][0] as string;
      expect(msg).toContain(GLOBAL_CONFIG_PATH);
      expect(msg).toContain("beConcise.message");
      expect(msg).toContain("object");
      expect(msg).toContain("text");
      expect(msg).toContain("/be-reasonable");
      expect(msg).toContain("edit or delete");
    } finally {
      warn.mockRestore();
    }
  });

  it("warns on a mistyped bound and keeps valid keys", () => {
    writeGlobal({ beConcise: { maxChars: "many", enabled: true } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loaded = createConfigIO().load();
      expect(loaded.global.beConcise).toEqual({ enabled: true });
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain("beConcise.maxChars");
    } finally {
      warn.mockRestore();
    }
  });

  it("leaves file bytes unchanged after load with bad values", () => {
    const raw = { beConcise: { message: { text: "x" }, maxChars: 900 } };
    writeGlobal(raw);
    const before = readFileSync(GLOBAL_CONFIG_PATH, "utf-8");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      createConfigIO().load();
    } finally {
      warn.mockRestore();
    }
    expect(readFileSync(GLOBAL_CONFIG_PATH, "utf-8")).toBe(before);
  });

  it("effective config falls back to defaults for dropped keys", () => {
    writeGlobal({ beConcise: { maxChars: "many", message: "Shorter." } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const config = loadConfig();
      expect(config.beConcise.maxChars).toBe(700);
      expect(config.beConcise.message).toBe("Shorter.");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("load-time validation — project layer", () => {
  it("warns on a switch the project file carries and stays loaded", () => {
    writeGlobal({ beConcise: { maxChars: 900 } });
    writeProject({ beConcise: { enabled: "yes" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loaded = createConfigIO(projectDir).load();
      expect(loaded.projectStatus).toBe("loaded");
      expect(loaded.project?.beConcise ?? {}).toEqual({});
      expect(warn).toHaveBeenCalledOnce();
      const msg = warn.mock.calls[0][0] as string;
      expect(msg).toContain(join(projectDir, "be-reasonable.json"));
      expect(msg).toContain("beConcise.enabled");
    } finally {
      warn.mockRestore();
    }
  });

  it("project file bytes stay unchanged after load with bad values", () => {
    writeProject({ beConcise: { enabled: "yes" } });
    const projectPath = join(projectDir, "be-reasonable.json");
    const before = readFileSync(projectPath, "utf-8");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      createConfigIO(projectDir).load();
    } finally {
      warn.mockRestore();
    }
    expect(readFileSync(projectPath, "utf-8")).toBe(before);
  });

  it("merged layers fall back to global when the project key is dropped", () => {
    writeGlobal({ beConcise: { maxChars: 900 } });
    writeProject({ beConcise: { maxChars: "many" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loaded = createConfigIO(projectDir).load();
      const merged = mergeLayers(loaded.global, loaded.project);
      expect(mergeDefaults(merged).beConcise.maxChars).toBe(900);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("load-time validation — the store", () => {
  it("a dropped value reads as the built-in default through the store", () => {
    writeGlobal({ beConcise: { enabled: "yes", maxChars: 900 } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loaded = createConfigIO().load();
      const store = new ConfigStore({
        load: () => ({ global: loaded.global, project: null, projectStatus: "untrusted" }),
        saveGlobal: () => {},
        saveProject: () => {},
      });
      expect(store.beConcise.enabled).toBe(false);
      expect(store.beConcise.maxChars).toBe(900);
    } finally {
      warn.mockRestore();
    }
  });
});
