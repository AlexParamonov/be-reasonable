/**
 * menus.test.ts — Tests for the dispatcher (showSettingsMenu).
 *
 * Uses SelectList via ctx.ui.custom (not ctx.ui.select).
 * Each iteration creates a fresh SelectList; submenu closes it before opening.
 */

import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import type { SelectItem } from "@earendil-works/pi-tui";
import { createMockCtx, type ComponentFactory } from "../../menu-test-helpers.js";
import { memIO } from "../../config/config-store-helpers.js";
import { ConfigStore } from "../../../src/config/config-store.js";

// Capture SelectList constructor calls from pi-tui
let selectListCalls: Array<{
  items: SelectItem[];
  onSelect?: (item: SelectItem) => void;
  onCancel?: () => void;
}> = [];

vi.mock("@earendil-works/pi-tui", () => ({
  SelectList: class MockSelectList {
    items: SelectItem[];
    maxVisible: number;
    onSelect?: (item: SelectItem) => void;
    onCancel?: () => void;
    constructor(items: SelectItem[], maxVisible: number, _theme: unknown) {
      this.items = items;
      this.maxVisible = maxVisible;
      selectListCalls.push(this);
    }
  },
  Input: class MockInput {},
}));

vi.mock("../../../src/ui/menu/menu-be-concise.js", () => ({
  showBeConciseSettingsMenu: vi.fn(),
}));

vi.mock("../../../src/ui/menu/menu-skills.js", () => ({
  showSkillsSettingsMenu: vi.fn(),
}));

// Import AFTER mock setup
import { showSettingsMenu } from "../../../src/ui/menu/menus.js";
import { showBeConciseSettingsMenu } from "../../../src/ui/menu/menu-be-concise.js";
import { showSkillsSettingsMenu } from "../../../src/ui/menu/menu-skills.js";

/** Pick an entry from the rendered list, then escape the dispatcher. */
function ctxChoosing(value: string | undefined) {
  let callCount = 0;
  return createMockCtx([], [], [], {
    ui: {
      custom: vi.fn(async (factory: ComponentFactory) => {
        factory(
          { terminal: { rows: 40 } },
          { fg: (_c: string, t: string) => t, bold: (t: string) => t },
          null,
          () => {},
        );
        callCount++;
        if (callCount === 1) return value;
        return undefined;
      }),
    },
  });
}

describe("showSettingsMenu — SelectList dispatcher", () => {
  beforeEach(() => {
    selectListCalls = [];
    vi.clearAllMocks();
  });

  it("uses ctx.ui.custom (not ctx.ui.select)", async () => {
    const store = new ConfigStore(memIO().io);
    const ctx = createMockCtx();
    await showSettingsMenu(ctx, store);
    expect(ctx.ui.custom).toHaveBeenCalled();
    expect(ctx.ui.select).not.toHaveBeenCalled();
  });

  it("shows the settings entries this extension offers", async () => {
    const store = new ConfigStore(memIO().io);
    await showSettingsMenu(createMockCtx(), store);
    expect(selectListCalls.length).toBe(1);
    expect(selectListCalls[0].items.map((i) => i.value)).toEqual(["be-concise", "skills"]);
  });

  it("Escape closes the menu", async () => {
    const store = new ConfigStore(memIO().io);
    const ctx = createMockCtx();
    await showSettingsMenu(ctx, store);
    // undefined terminates the loop: no re-invocation after the first menu
    expect(ctx.ui.custom).toHaveBeenCalledTimes(1);
  });

  it("opens be-concise settings with the caller's store", async () => {
    const store = new ConfigStore(memIO().io);
    const ctx = ctxChoosing("be-concise");
    await showSettingsMenu(ctx, store);
    // Dispatch ran (2nd call = be-concise menu) and the loop re-invoked after it
    expect(ctx.ui.custom).toHaveBeenCalledTimes(2);
    expect(showBeConciseSettingsMenu).toHaveBeenCalledWith(ctx, store);
  });

  it("opens skills settings with the caller's store", async () => {
    const store = new ConfigStore(memIO().io);
    const ctx = ctxChoosing("skills");
    await showSettingsMenu(ctx, store);
    expect(ctx.ui.custom).toHaveBeenCalledTimes(2);
    expect(showSkillsSettingsMenu).toHaveBeenCalledWith(ctx, store);
  });
});
