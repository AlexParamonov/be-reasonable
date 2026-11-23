/**
 * config-store.test.ts — ConfigStore core semantics.
 *
 * Interface is the test surface: an in-memory ConfigIO (shared helpers in config-store-helpers.ts).
 * The effective config resolves project → global → defaults, and a mutation writes the global
 * layer only.
 */

import { describe, it, expect, vi } from "vite-plus/test";
import { ConfigStore } from "../../src/config/config-store.js";
import { memIO, minimalIO } from "./config-store-helpers.js";

/* ------------------------------------------------------------------ */
/*  Reads & defaults                                                   */
/* ------------------------------------------------------------------ */

describe("ConfigStore reads", () => {
  it("bakes in defaults when the layers carry no values", () => {
    // The loaded layers carry no values, so the assertions below pin the
    // defaults merge — deleting a default must fail this test.
    const store = new ConfigStore(minimalIO());
    expect(store.beConcise.enabled).toBe(false);
    expect(store.beConcise.maxChars).toBe(700);
    expect(store.beConcise.message).toBe("Be concise");
  });

  it("returns configured values when present", () => {
    const { io } = memIO({ global: { beConcise: { enabled: true, maxChars: 900, message: "Cut it." } } });
    const store = new ConfigStore(io);
    expect(store.beConcise).toEqual({ enabled: true, maxChars: 900, message: "Cut it." });
  });
});

/* ------------------------------------------------------------------ */
/*  Override layers                                                    */
/* ------------------------------------------------------------------ */

describe("ConfigStore override layers", () => {
  it("effective settings merge project over global for every key", () => {
    const { io } = memIO({
      global: { beConcise: { enabled: true, maxChars: 900, message: "Global wording" } },
      project: { beConcise: { maxChars: 2500, enabled: false } },
      projectStatus: "loaded",
    });
    const store = new ConfigStore(io);
    expect(store.beConcise).toEqual({ enabled: false, maxChars: 2500, message: "Global wording" });
  });

  it("an empty project layer is inert: effective settings equal global-only", () => {
    const base = { global: { beConcise: { enabled: true, maxChars: 900 } } };
    const withEmpty = new ConfigStore(memIO({ ...base, project: {}, projectStatus: "loaded" }).io);
    const without = new ConfigStore(memIO({ ...base, project: null, projectStatus: "absent" }).io);
    expect(withEmpty.beConcise).toEqual(without.beConcise);
  });

  it("projectTargetOffered follows the project layer status", () => {
    expect(new ConfigStore(memIO().io).projectTargetOffered).toBe(false);
    expect(new ConfigStore(memIO({ projectStatus: "absent" }).io).projectTargetOffered).toBe(true);
    expect(new ConfigStore(memIO({ project: {}, projectStatus: "loaded" }).io).projectTargetOffered).toBe(true);
    expect(new ConfigStore(memIO({ projectStatus: "malformed" }).io).projectTargetOffered).toBe(false);
  });

  it("a project mutation writes only the project layer and overrides the global value", () => {
    const { io, saves, global } = memIO({
      global: { beConcise: { maxChars: 900 } },
      project: { beConcise: {} },
      projectStatus: "loaded",
    });
    const store = new ConfigStore(io);
    store.setBeConciseMaxChars(2500, "project");
    expect(saves).toHaveLength(1);
    expect(saves[0].layer).toBe("project");
    expect(saves[0].config).toEqual({ beConcise: { maxChars: 2500 } });
    expect(global()).toEqual({ beConcise: { maxChars: 900 } });
    expect(store.beConcise.maxChars).toBe(2500);
  });

  it("mutating the project layer without a trusted project is refused with a warning", () => {
    const { io, saves } = memIO({ projectStatus: "untrusted" });
    const store = new ConfigStore(io);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      store.setBeConciseMaxChars(2500, "project");
      expect(saves).toHaveLength(0);
      expect(store.beConcise.maxChars).toBe(700);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain("Project config target unavailable");
    } finally {
      warn.mockRestore();
    }
  });

  it("mutating the project layer when the file is malformed is refused; nothing is saved", () => {
    const { io, saves } = memIO({ projectStatus: "malformed" });
    const store = new ConfigStore(io);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      store.setBeConciseMaxChars(2500, "project");
      expect(saves).toHaveLength(0);
      expect(store.beConcise.maxChars).toBe(700);
    } finally {
      warn.mockRestore();
    }
  });

  it("the first project write in a trusted project without a file creates the layer", () => {
    const { io, saves, project } = memIO({ projectStatus: "absent" });
    const store = new ConfigStore(io);
    store.setBeConciseMaxChars(2500, "project");
    expect(saves).toHaveLength(1);
    expect(saves[0].layer).toBe("project");
    expect(project()).toEqual({ beConcise: { maxChars: 2500 } });
    expect(store.beConcise.maxChars).toBe(2500);
  });

  it("global writes leave the project file untouched and never carry merged or default values", () => {
    const { io, saves, project } = memIO({
      global: { beConcise: { maxChars: 900 } },
      project: { beConcise: { message: "Project wording" } },
      projectStatus: "loaded",
    });
    const store = new ConfigStore(io);
    store.setBeConciseMessage("Global wording", "global");
    expect(saves).toHaveLength(1);
    expect(saves[0].layer).toBe("global");
    expect(saves[0].config).toEqual({ beConcise: { maxChars: 900, message: "Global wording" } });
    // No baked defaults, no project keys: the merged config is never written.
    expect("enabled" in saves[0].config.beConcise!).toBe(false);
    expect(project()).toEqual({ beConcise: { message: "Project wording" } });
  });
});

describe("ConfigStore lifecycle", () => {
  it("reload re-reads disk", () => {
    const { io, global } = memIO({ global: { beConcise: { maxChars: 900 } } });
    const store = new ConfigStore(io);
    global().beConcise!.maxChars = 700;
    store.reload();

    expect(store.beConcise.maxChars).toBe(700);
  });
});
