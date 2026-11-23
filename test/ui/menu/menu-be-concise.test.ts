/**
 * menu-be-concise.test.ts — Tests for showBeConciseSettingsMenu.
 *
 * Single flat SettingsList.
 */

import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import type { Component, SettingItem, SettingsListTheme } from "@earendil-works/pi-tui";
import { createMockCtx } from "../../menu-test-helpers.js";
import { memIO } from "../../config/config-store-helpers.js";
import { ConfigStore, type RawConfig } from "../../../src/config/config-store.js";
import type { SettingsListWrapperOptions } from "../../../src/ui/menu/wrappers/settings-list.js";

// Capture constructor calls
let settingsListCalls: Array<{
  items: SettingItem[];
  onChange: (id: string, newValue: string) => void;
  onCancel: () => void;
}> = [];
let wrapperCalls: Array<{ title: string }> = [];
let inputInstances: Array<{
  value: string;
  onSubmit?: (value: string) => void;
  onEscape?: () => void;
  setValue: (v: string) => void;
  getValue: () => string;
}> = [];

vi.mock("@earendil-works/pi-tui", () => ({
  SettingsList: class MockSettingsList {
    items: SettingItem[];
    constructor(
      items: SettingItem[],
      _maxVisible: number,
      _theme: SettingsListTheme,
      onChange: (id: string, newValue: string) => void,
      onCancel: () => void,
    ) {
      this.items = items;
      settingsListCalls.push({ items, onChange, onCancel });
    }
  },
  Input: class MockInput {
    value = "";
    onSubmit?: (value: string) => void;
    onEscape?: () => void;
    setValue(v: string) {
      this.value = v;
    }
    getValue() {
      return this.value;
    }
    constructor() {
      inputInstances.push(this);
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

// Import AFTER mock setup
import { showBeConciseSettingsMenu } from "../../../src/ui/menu/menu-be-concise.js";

function resetState() {
  settingsListCalls = [];
  wrapperCalls = [];
  inputInstances = [];
}

/** Real store over in-memory layers, so a menu write is checked where it lands. */
function makeStore(
  global: RawConfig = {},
  layer: { project?: RawConfig | null; projectStatus?: "untrusted" | "absent" | "loaded" | "malformed" } = {},
) {
  const mem = memIO({ global, ...layer });
  return { store: new ConfigStore(mem.io), saved: mem };
}

/** The rows of a mocked SettingsList, which is what every picker in this menu returns. */
type Picker = { items: Array<{ id: string; submenu?: (cv: string, done: (v?: string) => void) => unknown }> };

/** Open the menu, drive a row's level picker to one level, and hand back its value step. */
async function openValueStep(id: string, store: ConfigStore, level: "global" | "project" = "global") {
  const ctx = createMockCtx();
  await showBeConciseSettingsMenu(ctx, store);
  const item = settingsListCalls[0].items.find((i) => i.id === id)!;
  const done = vi.fn();
  const picker = item.submenu!(item.currentValue, done) as unknown as {
    items: Array<{ id: string; submenu?: (cv: string, done: (v?: string) => void) => unknown }>;
  };
  const step = picker.items.find((i) => i.id === level)!.submenu!;
  const component = step(item.currentValue, vi.fn()) as unknown as { onSubmit?: (value: string) => void };
  return { ctx, item, done, component };
}

describe("showBeConciseSettingsMenu — flat SettingsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
  });

  it("uses ctx.ui.custom (not ctx.ui.select)", async () => {
    const { store } = makeStore();
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    expect(ctx.ui.custom).toHaveBeenCalled();
    expect(ctx.ui.select).not.toHaveBeenCalled();
  });

  it("tags a value the project layer provides with its source", async () => {
    const { store } = makeStore(
      { beConcise: { maxChars: 800 } },
      { project: { beConcise: { maxChars: 500 } }, projectStatus: "loaded" },
    );
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    const items = settingsListCalls[0].items;
    expect(items.find((i) => i.id === "maxChars")!.currentValue).toBe("500 [project]");
    expect(items.find((i) => i.id === "message")!.currentValue).toBe("Be concise");
  });

  it("offers no project level when no project layer can be written", async () => {
    const { store } = makeStore();
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    const row = settingsListCalls[0].items.find((i) => i.id === "maxChars")!;
    expect((row.submenu!("800", vi.fn()) as unknown as Picker).items.map((i) => i.id)).toEqual(["global", "clear"]);
  });

  it("has the three be-concise items", async () => {
    const { store } = makeStore();
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    expect(settingsListCalls.length).toBe(1);
    expect(settingsListCalls[0].items.map((i) => i.id)).toEqual(["enabled", "maxChars", "message"]);
  });

  it("wraps in SettingsListWrapper with title 'Be concise settings'", async () => {
    const { store } = makeStore();
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    expect(wrapperCalls).toContainEqual({ title: "Be concise settings" });
  });

  it("enabled shows the store value", async () => {
    const { store } = makeStore({ beConcise: { enabled: true } });
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    expect(settingsListCalls[0].items.find((i) => i.id === "enabled")!.currentValue).toBe("ON");
  });

  it("writes the bound to the level picked, leaving the other layer alone", async () => {
    const { store, saved } = makeStore(
      { beConcise: { maxChars: 800 } },
      { project: { beConcise: {} }, projectStatus: "loaded" },
    );
    const { component } = await openValueStep("maxChars", store, "project");
    component.onSubmit?.("500");
    expect(store.beConcise.maxChars).toBe(500);
    expect(saved.project()).toEqual({ beConcise: { maxChars: 500 } });
    expect(saved.global()).toEqual({ beConcise: { maxChars: 800 } });
  });

  it("writes the switch to the level picked", async () => {
    const { store, saved } = makeStore({}, { project: { beConcise: {} }, projectStatus: "loaded" });
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    const row = settingsListCalls[0].items.find((i) => i.id === "enabled")!;

    const picker = row.submenu!("OFF", vi.fn()) as unknown as Picker;
    const values = picker.items.find((i) => i.id === "project")!.submenu!("OFF", vi.fn()) as unknown as Picker;
    values.items.find((i) => i.id === "ON")!.submenu!("", vi.fn());

    expect(store.beConcise.enabled).toBe(true);
    expect(saved.project()).toEqual({ beConcise: { enabled: true } });
    expect(ctx.ui.notify).toHaveBeenCalledWith("Be concise ON (project)", "info");
  });

  it("clears one level from the picker without touching the other", async () => {
    const { store, saved } = makeStore(
      { beConcise: { maxChars: 800 } },
      { project: { beConcise: { maxChars: 500 } }, projectStatus: "loaded" },
    );
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    const row = settingsListCalls[0].items.find((i) => i.id === "maxChars")!;

    const picker = row.submenu!("500 [project]", vi.fn()) as unknown as Picker;
    const levels = picker.items.find((i) => i.id === "clear")!.submenu!("", vi.fn()) as unknown as Picker;
    levels.items.find((i) => i.id === "project")!.submenu!("", vi.fn());

    expect(saved.project()).toEqual({ beConcise: {} });
    expect(store.beConcise.maxChars).toBe(800);
    expect(ctx.ui.notify).toHaveBeenCalledWith("Answer prose bound cleared (project)", "info");
  });

  it("maxChars shows the bound and opens a numeric submenu", async () => {
    const { store } = makeStore({ beConcise: { maxChars: 800 } });
    const { item, component } = await openValueStep("maxChars", store);
    expect(item.currentValue).toBe("800");
    expect(inputInstances.length).toBe(1);
    component.onSubmit?.("500");
    expect(store.beConcise.maxChars).toBe(500);
  });

  it("maxChars submenu keeps the bound when input is invalid", async () => {
    const { store } = makeStore({ beConcise: { maxChars: 800 } });
    const { ctx, done, component } = await openValueStep("maxChars", store);
    component.onSubmit?.("0");
    expect(store.beConcise.maxChars).toBe(800);
    expect(done).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith("Invalid value — must be a number ≥ 1", "error");
  });

  it("writes the wording to the level picked", async () => {
    const { store, saved } = makeStore({}, { project: { beConcise: {} }, projectStatus: "loaded" });
    const { component } = await openValueStep("message", store, "project");
    component.onSubmit?.("Shorter.");
    expect(store.beConcise.message).toBe("Shorter.");
    expect(saved.project()).toEqual({ beConcise: { message: "Shorter." } });
  });

  it("message submenu refuses empty wording", async () => {
    const { store } = makeStore({ beConcise: { message: "Keep me." } });
    const { ctx, done, component } = await openValueStep("message", store);
    component.onSubmit?.("   ");
    expect(done).not.toHaveBeenCalled();
    expect(store.beConcise.message).toBe("Keep me.");
    expect(ctx.ui.notify).toHaveBeenCalledWith("Cannot be empty", "error");
  });
});
