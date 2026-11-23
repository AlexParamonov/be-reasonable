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
import { createLevelPickerSubmenu, createTargetSelectSubmenu, type SetTarget } from "./submenus/target-select.ts";
import { SettingsListWrapper } from "./wrappers/settings-list.ts";
import type { ConfigStore } from "../../config/config-store.ts";
import type { Theme } from "../types.ts";

/** The tag a row carries when the project file provides its value. */
function sourceTag(store: ConfigStore, key: "enabled" | "maxChars" | "message"): string {
  return store.layerCarries(key).project ? " [project]" : "";
}

/** Pick the level first, then the value: every write names the layer it landed in. */
function levelSubmenu(
  ctx: ExtensionCommandContext,
  store: ConfigStore,
  theme: Theme,
  key: "enabled" | "maxChars" | "message",
  label: string,
  initial: string,
): SettingItem["submenu"] {
  const clear = (target: SetTarget) => {
    if (key === "enabled") store.setBeConciseEnabled(undefined, target);
    if (key === "maxChars") store.setBeConciseMaxChars(undefined, target);
    if (key === "message") store.setBeConciseMessage(undefined, target);
    ctx.ui.notify(`${label} cleared (${target})`, "info");
  };

  if (key === "enabled") {
    return createTargetSelectSubmenu({
      theme,
      projectOffered: store.projectTargetOffered,
      showClear: true,
      onPick: (target, done) =>
        createLevelPickerSubmenu({
          theme,
          items: [
            { id: "ON", label: "On", currentValue: "", description: "Ask once the answer passes the bound." },
            { id: "OFF", label: "Off", currentValue: "", description: "Never ask on your behalf." },
          ],
          onPick: (value) => {
            store.setBeConciseEnabled(value === "ON", target);
            ctx.ui.notify(`${label} ${value} (${target})`, "info");
          },
        })(initial, done),
      onClear: clear,
    });
  }

  if (key === "maxChars") {
    return createTargetSelectSubmenu({
      theme,
      projectOffered: store.projectTargetOffered,
      showClear: true,
      onPick: (target, done) =>
        createNumericSubmenu(ctx, { min: 1 }, (parsed) => {
          store.setBeConciseMaxChars(parsed, target);
          ctx.ui.notify(`${label} set to ${parsed} chars (${target})`, "info");
        })(initial, done),
      onClear: clear,
    });
  }

  return createTargetSelectSubmenu({
    theme,
    projectOffered: store.projectTargetOffered,
    showClear: true,
    onPick: (target, done) =>
      createInputSubmenu(ctx, { required: true })(initial, (value) => {
        if (value !== undefined) {
          store.setBeConciseMessage(value, target);
          ctx.ui.notify(`${label} updated (${target})`, "info");
        }
        done(value);
      }),
    onClear: clear,
  });
}

/**
 * Build the flat item list.
 */
function buildItems(ctx: ExtensionCommandContext, store: ConfigStore, theme: Theme): SettingItem[] {
  const enabled = store.beConcise.enabled ? "ON" : "OFF";
  const maxChars = String(store.beConcise.maxChars);
  const message = store.beConcise.message;
  const enabledValue = `${enabled}${sourceTag(store, "enabled")}`;
  const boundValue = `${maxChars}${sourceTag(store, "maxChars")}`;
  const messageValue = `${message}${sourceTag(store, "message")}`;
  const items: SettingItem[] = [
    {
      id: "enabled",
      label: "Ask for a shorter answer",
      currentValue: enabledValue,
      submenu: levelSubmenu(ctx, store, theme, "enabled", "Be concise", enabled),
      description: "When ON, a final answer whose prose passes the bound gets one trim request.",
    },
    {
      id: "maxChars",
      label: "Answer prose bound (chars)",
      currentValue: boundValue,
      submenu: levelSubmenu(ctx, store, theme, "maxChars", "Answer prose bound", maxChars),
      description: "Characters of prose allowed before a trim is requested; code blocks and tables are not counted.",
    },
    {
      id: "message",
      label: "Trim request",
      currentValue: messageValue,
      submenu: levelSubmenu(ctx, store, theme, "message", "Trim request", message),
      description: "The instruction sent to the model when the bound is passed.",
    },
  ];
  return items;
}

export async function showBeConciseSettingsMenu(ctx: ExtensionCommandContext, store: ConfigStore): Promise<void> {
  let rebuild: ((items: SettingItem[]) => void) | undefined;

  await ctx.ui.custom((_tui, theme, _kb, done) => {
    const items = buildItems(ctx, store, theme);
    const settingsList = new SettingsList(
      items,
      15,
      buildSettingsListTheme(theme),
      (id) => {
        // Every write happened in the row's submenu; rebuild only refreshes the shown value.
        if (items.some((i) => i.id === id && i.submenu)) rebuild?.(buildItems(ctx, store, theme));
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
