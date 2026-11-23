/**
 * config-io-project-file.test.ts — Project config as an override layer
 * (ADR-0008): the project file's model/concurrency keys merge over the global
 * file; absent keys inherit. Unknown keys are ignored with a warning, a
 * malformed file is never written, and per-layer saves touch only their layer.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

// Per-run temp dirs: must never read a real user config file.
const MOCK_AGENT_DIR = mkdtempSync(join(tmpdir(), "be-reasonable-global-"));
const GLOBAL_CONFIG_PATH = join(MOCK_AGENT_DIR, "be-reasonable.json");

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getAgentDir: () => MOCK_AGENT_DIR,
}));

// Import after mock is set up
const { createConfigIO, loadConfig, mergeLayers, mergeDefaults } = await import("../../src/config/config-io.js");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "be-reasonable-project-"));
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

/** Write raw text (e.g. malformed JSON) to the project file. */
function writeProjectRaw(text: string): void {
  writeFileSync(join(projectDir, "be-reasonable.json"), text);
}

function readProjectFile(): unknown {
  return JSON.parse(readFileSync(join(projectDir, "be-reasonable.json"), "utf-8"));
}

describe("createConfigIO load — two-layer override model", () => {
  it("returns the raw global and project layers with status loaded", () => {
    writeGlobal({ beConcise: { enabled: true, maxChars: 900 } });
    writeProject({ beConcise: { maxChars: 2500 } });

    const loaded = createConfigIO(projectDir).load();

    expect(loaded.projectStatus).toBe("loaded");
    expect(loaded.global).toEqual({ beConcise: { enabled: true, maxChars: 900 } });
    expect(loaded.project).toEqual({ beConcise: { maxChars: 2500 } });
  });

  it("reports untrusted and no project layer when created without a project dir", () => {
    const loaded = createConfigIO().load();

    expect(loaded.projectStatus).toBe("untrusted");
    expect(loaded.project).toBeNull();
    expect(loaded.global).toEqual({});
  });

  it("reports absent when the trusted project has no config file yet", () => {
    const loaded = createConfigIO(projectDir).load();

    expect(loaded.projectStatus).toBe("absent");
    expect(loaded.project).toBeNull();
  });

  it("an empty project file is inert: loaded as an empty layer", () => {
    writeProject({});

    const loaded = createConfigIO(projectDir).load();

    expect(loaded.projectStatus).toBe("loaded");
    expect(loaded.project).toEqual({});
  });

  it("ignores a malformed JSON project file with a warning; status malformed", () => {
    writeGlobal({ beConcise: { maxChars: 900 } });
    writeProjectRaw("{ not json !!");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loaded = createConfigIO(projectDir).load();
      expect(loaded.projectStatus).toBe("malformed");
      expect(loaded.project).toBeNull();
      // The global layer still loads.
      expect(loaded.global).toEqual({ beConcise: { maxChars: 900 } });
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("treats structurally invalid project files as malformed", () => {
    const violations = [{ beConcise: "nope" }, [1, 2], "text", 42, null];
    for (const bad of violations) {
      writeProject(bad);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const loaded = createConfigIO(projectDir).load();
        expect(loaded.projectStatus).toBe("malformed");
        expect(loaded.project).toBeNull();
      } finally {
        warn.mockRestore();
      }
    }
  });

  it("warns once about project settings with no effect, per IO instance", () => {
    // enabled is a global-only setting: not allowed in the project file.
    writeProject({ beConcise: { maxChars: 2500, enabled: true } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const io = createConfigIO(projectDir);
      io.load();
      io.load();
      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("beConcise.enabled"));
    } finally {
      warn.mockRestore();
    }
  });

  it("warns about a global-only setting carried by the project file and ignores its value", () => {
    writeGlobal({ beConcise: { enabled: true } });
    writeProject({ beConcise: { enabled: false } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const loaded = createConfigIO(projectDir).load();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("beConcise.enabled"));
      expect(mergeLayers(loaded.global, loaded.project).beConcise!.enabled).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it("does not warn for a project file that carries only the bound", () => {
    writeProject({ beConcise: { maxChars: 2500 } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      createConfigIO(projectDir).load();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("mergeLayers — project over global, per key", () => {
  it("project settings override global; absent keys inherit", () => {
    const merged = mergeLayers({ beConcise: { enabled: true, maxChars: 900 } }, { beConcise: { maxChars: 2500 } });

    expect(merged.beConcise).toEqual({ enabled: true, maxChars: 2500 });
  });

  it("drops project settings that are not the bound", () => {
    const merged = mergeLayers(
      { beConcise: { enabled: false, maxChars: 900 } },
      { beConcise: { maxChars: 2500, enabled: true, message: "project wording" } },
    );

    expect(merged.beConcise).toEqual({ enabled: false, maxChars: 2500 });
  });

  it("with no project layer, the global layer passes through", () => {
    expect(mergeLayers({ beConcise: { maxChars: 900 } }, null)).toEqual({ beConcise: { maxChars: 900 } });
  });

  it("empty layers merge to no section at all", () => {
    expect(mergeLayers({}, {})).toEqual({});
  });
});

describe("mergeDefaults / loadConfig", () => {
  it("bakes built-in defaults for absent keys", () => {
    const config = mergeDefaults({ beConcise: { maxChars: 500 } });

    expect(config.beConcise.maxChars).toBe(500);
    expect(config.beConcise.enabled).toBe(false);
    expect(config.beConcise.message.length).toBeGreaterThan(0);
  });

  it("loadConfig merges only the global file", () => {
    writeGlobal({ beConcise: { enabled: true, maxChars: 900 } });
    writeProject({ beConcise: { maxChars: 2500 } });

    expect(loadConfig()).toEqual(mergeDefaults({ beConcise: { enabled: true, maxChars: 900 } }));
  });
});

describe("createConfigIO save — per-layer writes", () => {
  it("saveGlobal writes only the global file, leaving the project file untouched", () => {
    writeGlobal({ beConcise: { maxChars: 900 } });
    writeProject({ beConcise: { maxChars: 2500 } });
    const io = createConfigIO(projectDir);
    io.load();

    io.saveGlobal({ beConcise: { maxChars: 1500 } });

    expect(JSON.parse(readFileSync(GLOBAL_CONFIG_PATH, "utf-8"))).toEqual({ beConcise: { maxChars: 1500 } });
    expect(readProjectFile()).toEqual({ beConcise: { maxChars: 2500 } });
  });

  it("saveProject writes only the project file, leaving the global file untouched", () => {
    writeGlobal({ beConcise: { enabled: true, maxChars: 900 } });
    writeProject({ beConcise: { maxChars: 2500 } });
    const io = createConfigIO(projectDir);
    io.load();

    io.saveProject({ beConcise: { maxChars: 3000 } });

    expect(readProjectFile()).toEqual({ beConcise: { maxChars: 3000 } });
    expect(JSON.parse(readFileSync(GLOBAL_CONFIG_PATH, "utf-8"))).toEqual({
      beConcise: { enabled: true, maxChars: 900 },
    });
  });

  it("the first saveProject in a trusted project without a file creates it", () => {
    const io = createConfigIO(projectDir);
    io.load();

    io.saveProject({ beConcise: { maxChars: 2500 } });

    expect(readProjectFile()).toEqual({ beConcise: { maxChars: 2500 } });
  });

  it("saveProject refuses to write a malformed project file; bytes untouched", () => {
    writeProjectRaw("{ not json !!");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const io = createConfigIO(projectDir);
      io.load();

      io.saveProject({ beConcise: { maxChars: 2500 } });

      expect(readFileSync(join(projectDir, "be-reasonable.json"), "utf-8")).toBe("{ not json !!");
      // One warning for the malformed load, one for the refused save.
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  it("saveProject without a trusted project dir writes nothing", () => {
    const io = createConfigIO();
    io.load();

    io.saveProject({ beConcise: { maxChars: 2500 } });

    expect(existsSync(join(projectDir, "be-reasonable.json"))).toBe(false);
  });
});
