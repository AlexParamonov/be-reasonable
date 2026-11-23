/**
 * config-store-helpers.ts — Shared fakes for ConfigStore tests.
 *
 * In-memory ConfigIO over two raw layers, recording every global save, and minimalIO() whose load
 * returns empty layers.
 */

import type { ConfigIO, RawConfig, ProjectLayerStatus } from "../../src/config/config-io.js";

/** In-memory ConfigIO over two raw layers, recording per-layer saves. */
export function memIO(
  opts: {
    global?: RawConfig;
    project?: RawConfig | null;
    projectStatus?: ProjectLayerStatus;
  } = {},
): {
  io: ConfigIO;
  saves: Array<{ layer: "global"; config: RawConfig }>;
  global: () => RawConfig;
  project: () => RawConfig | null;
} {
  const state: { global: RawConfig; project: RawConfig | null; projectStatus: ProjectLayerStatus } = {
    global: opts.global ?? {},
    project: opts.project === undefined ? null : opts.project,
    projectStatus: opts.projectStatus ?? "untrusted",
  };
  const saves: Array<{ layer: "global"; config: RawConfig }> = [];
  return {
    io: {
      load: () => ({
        global: structuredClone(state.global),
        project: state.project ? structuredClone(state.project) : null,
        projectStatus: state.projectStatus,
      }),
      saveGlobal: (config) => {
        state.global = structuredClone(config);
        saves.push({ layer: "global", config: structuredClone(config) });
      },
    },
    saves,
    global: () => state.global,
    project: () => state.project,
  };
}

/** ConfigIO whose load() returns empty raw layers: the store's defaults merge
 * and its own `??` fallbacks are what get exercised (not a fixture). */
export function minimalIO(): ConfigIO {
  return {
    load: () => ({ global: {}, project: null, projectStatus: "untrusted" }),
    saveGlobal: () => {},
  };
}
