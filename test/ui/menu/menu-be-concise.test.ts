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

// Mock only the heavy deps of helpers.js (searchable-select pulls in pi-tui
// components the partial pi-tui mock doesn't provide).
vi.mock("../../../src/ui/searchable-select.js", () => ({
  SearchableSelectDialog: class MockSearchableSelectDialog {},
}));

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
function makeStore(global: RawConfig = {}) {
  const mem = memIO({ global });
  return { store: new ConfigStore(mem.io), saved: mem };
}

/** Open the menu and hand back the row plus the captured Input it built. */
async function openWithSubmenu(id: string, store: ConfigStore, initialValue?: string) {
  const ctx = createMockCtx();
  await showBeConciseSettingsMenu(ctx, store);
  const item = settingsListCalls[0].items.find((i) => i.id === id)!;
  const done = vi.fn();
  const component = item.submenu!(initialValue ?? item.currentValue, done) as unknown as {
    onSubmit?: (value: string) => void;
  };
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

  it("enabled onChange writes the store and the global layer", async () => {
    const { store, saved } = makeStore();
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    settingsListCalls[0].onChange("enabled", "ON");
    expect(store.beConcise.enabled).toBe(true);
    expect(saved.global()).toEqual({ beConcise: { enabled: true } });
    expect(ctx.ui.notify).toHaveBeenCalledWith("Be concise ON", "info");
  });

  it("maxChars shows the bound and opens a numeric submenu", async () => {
    const { store } = makeStore({ beConcise: { maxChars: 800 } });
    const { item, component } = await openWithSubmenu("maxChars", store);
    expect(item.currentValue).toBe("800");
    expect(inputInstances.length).toBe(1);
    component.onSubmit?.("500");
    expect(store.beConcise.maxChars).toBe(500);
  });

  it("maxChars submenu keeps the bound when input is invalid", async () => {
    const { store } = makeStore({ beConcise: { maxChars: 800 } });
    const { ctx, done, component } = await openWithSubmenu("maxChars", store);
    component.onSubmit?.("0");
    expect(store.beConcise.maxChars).toBe(800);
    expect(done).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith("Invalid value — must be a number ≥ 1", "error");
  });

  it("message onChange writes the wording and the global layer", async () => {
    const { store, saved } = makeStore();
    const ctx = createMockCtx();
    await showBeConciseSettingsMenu(ctx, store);
    settingsListCalls[0].onChange("message", "Shorter.");
    expect(store.beConcise.message).toBe("Shorter.");
    expect(saved.global()).toEqual({ beConcise: { message: "Shorter." } });
  });

  it("message submenu refuses empty wording", async () => {
    const { store } = makeStore({ beConcise: { message: "Keep me." } });
    const { ctx, done, component } = await openWithSubmenu("message", store);
    component.onSubmit?.("   ");
    expect(done).not.toHaveBeenCalled();
    expect(store.beConcise.message).toBe("Keep me.");
    expect(ctx.ui.notify).toHaveBeenCalledWith("Cannot be empty", "error");
  });
});
