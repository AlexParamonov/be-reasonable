/**
 * menu-skills.test.ts — Tests for showSkillsSettingsMenu.
 *
 * One row per shipped skill, each switching whether the model is shown it, written to the level the user
 * picks. Rows and their labels are presentation; the switch a row writes and the layer it lands in are not.
 */

import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import type { Component, SettingItem, SettingsListTheme } from "@earendil-works/pi-tui";
import { createMockCtx } from "../../menu-test-helpers.js";
import { memIO } from "../../config/config-store-helpers.js";
import { ConfigStore, type RawConfig } from "../../../src/config/config-store.js";
import type { SettingsListWrapperOptions } from "../../../src/ui/menu/wrappers/settings-list.js";

let settingsListCalls: Array<{ items: SettingItem[] }> = [];
let wrapperCalls: Array<{ title: string }> = [];

vi.mock("@earendil-works/pi-tui", () => ({
  SettingsList: class MockSettingsList {
    items: SettingItem[];
    constructor(items: SettingItem[], _maxVisible: number, _theme: SettingsListTheme) {
      this.items = items;
      settingsListCalls.push({ items });
    }
  },
}));

vi.mock("../../../src/ui/menu/wrappers/settings-list.js", () => ({
  SettingsListWrapper: class MockSettingsListWrapper {
    constructor(_list: Component, options: SettingsListWrapperOptions) {
      wrapperCalls.push({ title: options.title });
    }
  },
}));

import { showSkillsSettingsMenu } from "../../../src/ui/menu/menu-skills.js";

function makeStore(
  global: RawConfig = {},
  layer: { project?: RawConfig | null; projectStatus?: "untrusted" | "absent" | "loaded" | "malformed" } = {},
) {
  const mem = memIO({ global, ...layer });
  return { store: new ConfigStore(mem.io), saved: mem };
}

type Picker = { items: Array<{ id: string; submenu?: (cv: string, done: (v?: string) => void) => unknown }> };

/** Open a row's level picker at one level and hand back its ON/OFF step. */
async function openValueStep(id: string, store: ConfigStore, level: "global" | "project") {
  const ctx = createMockCtx();
  await showSkillsSettingsMenu(ctx, store);
  const row = settingsListCalls[0].items.find((i) => i.id === id)!;
  const picker = row.submenu!(row.currentValue, vi.fn()) as unknown as Picker;
  const step = picker.items.find((i) => i.id === level)!.submenu!;
  return { ctx, row, component: step(row.currentValue, vi.fn()) as unknown as Picker };
}

describe("showSkillsSettingsMenu", () => {
  beforeEach(() => {
    settingsListCalls = [];
    wrapperCalls = [];
  });

  it("shows each shipped skill's switch, tagged where the project sets it", async () => {
    const { store } = makeStore(
      { modelInvocable: { "be-reasonable": false } },
      { project: { modelInvocable: { "maintain-tests": false } }, projectStatus: "loaded" },
    );
    const ctx = createMockCtx();
    await showSkillsSettingsMenu(ctx, store);

    const rows = settingsListCalls[0].items;
    expect(rows.map((r) => r.id)).toEqual(["be-reasonable", "maintain-tests"]);
    expect(rows.map((r) => r.currentValue)).toEqual(["OFF", "OFF [project]"]);
  });

  it("writes the switch to the level picked, leaving the other layer alone", async () => {
    const { store, saved } = makeStore({}, { project: {}, projectStatus: "loaded" });
    const { ctx, component } = await openValueStep("maintain-tests", store, "project");

    component.items.find((i) => i.id === "ON")!.submenu!("", vi.fn());

    expect(store.modelInvocable["maintain-tests"]).toBe(true);
    expect(saved.project()).toEqual({ modelInvocable: { "maintain-tests": true } });
    expect(saved.global()).toEqual({});
    expect(ctx.ui.notify).toHaveBeenCalledWith("maintain-tests ON (project)", "info");
  });

  it("clears one level's switch without touching the other", async () => {
    const { store, saved } = makeStore(
      { modelInvocable: { "be-reasonable": false } },
      { project: { modelInvocable: { "be-reasonable": true } }, projectStatus: "loaded" },
    );
    const ctx = createMockCtx();
    await showSkillsSettingsMenu(ctx, store);

    const row = settingsListCalls[0].items.find((i) => i.id === "be-reasonable")!;
    const picker = row.submenu!("ON [project]", vi.fn()) as unknown as Picker;
    const levels = picker.items.find((i) => i.id === "clear")!.submenu!("", vi.fn()) as unknown as Picker;
    levels.items.find((i) => i.id === "global")!.submenu!("", vi.fn());

    expect(saved.global()).toEqual({ modelInvocable: {} });
    expect(store.modelInvocable["be-reasonable"]).toBe(true);
    expect(ctx.ui.notify).toHaveBeenCalledWith("be-reasonable cleared (global)", "info");
  });

  it("offers no project level when no project layer can be written", async () => {
    const { store } = makeStore();
    const ctx = createMockCtx();
    await showSkillsSettingsMenu(ctx, store);
    const row = settingsListCalls[0].items.find((i) => i.id === "be-reasonable")!;
    expect((row.submenu!("ON", vi.fn()) as unknown as Picker).items.map((i) => i.id)).toEqual(["global", "clear"]);
  });
});
