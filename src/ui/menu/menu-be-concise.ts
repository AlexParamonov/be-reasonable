/**
 * menu-be-concise.ts — Be concise settings menu concern.
 *
 * Single flat SettingsList.
 *
 * Exports:
 *   - showBeConciseSettingsMenu
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { SettingsList, type SettingItem } from "@earendil-works/pi-tui";
import { buildSettingsListTheme } from "./helpers.ts";
import { createInputSubmenu, createNumericSubmenu } from "./submenus/numeric-input.ts";
import { SettingsListWrapper } from "./wrappers/settings-list.ts";
import type { ConfigStore } from "../../config/config-store.ts";

/**
 * Build the flat item list.
 */
function buildItems(ctx: ExtensionCommandContext, store: ConfigStore): SettingItem[] {
  const items: SettingItem[] = [
    {
      id: "enabled",
      label: "Ask for a shorter answer",
      currentValue: store.beConcise.enabled ? "ON" : "OFF",
      values: ["ON", "OFF"],
      description: "When ON, a final answer whose prose passes the bound gets one trim request.",
    },
    {
      id: "maxChars",
      label: "Answer prose bound (chars)",
      currentValue: String(store.beConcise.maxChars),
      submenu: createNumericSubmenu(ctx, { min: 1 }, (parsed) => {
        store.setBeConciseMaxChars(parsed);
        ctx.ui.notify(`Answer prose bound set to ${parsed} chars`, "info");
      }),
      description: "Characters of prose allowed before a trim is requested; code blocks and tables are not counted.",
    },
    {
      id: "message",
      label: "Trim request",
      currentValue: store.beConcise.message,
      submenu: createInputSubmenu(ctx, { required: true }),
      description: "The instruction sent to the model when the bound is passed.",
    },
  ];
  return items;
}

function buildOnChange(ctx: ExtensionCommandContext, store: ConfigStore) {
  return (id: string, newValue: string) => {
    switch (id) {
      case "enabled":
        store.setBeConciseEnabled(newValue === "ON");
        ctx.ui.notify(`Be concise ${newValue}`, "info");
        break;
      case "maxChars":
        // Handled by numeric submenus, not onChange
        break;
      case "message":
        store.setBeConciseMessage(newValue);
        ctx.ui.notify("Trim request updated", "info");
        break;
    }
  };
}

export async function showBeConciseSettingsMenu(ctx: ExtensionCommandContext, store: ConfigStore): Promise<void> {
  let rebuild: ((items: SettingItem[]) => void) | undefined;

  await ctx.ui.custom((_tui, theme, _kb, done) => {
    const items = buildItems(ctx, store);
    const onChange = buildOnChange(ctx, store);
    const settingsList = new SettingsList(
      items,
      15,
      buildSettingsListTheme(theme),
      (id, newValue) => {
        onChange(id, newValue);
        // Submenu-driven rows rebuild to refresh value; toggle
        // rows update in place via SettingsList.
        if (items.some((i) => i.id === id && i.submenu)) rebuild?.(buildItems(ctx, store));
      },
      () => done(undefined),
    );
    return new SettingsListWrapper(settingsList, {
      title: "Be concise settings",
      theme,
      onCancel: () => done(undefined),
      onRebuild: (r) => {
        rebuild = r;
      },
    });
  });
}
