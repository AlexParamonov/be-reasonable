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
import { buildSettingsListTheme, sourceTag, type Theme } from "./helpers.ts";
import { createInputSubmenu, createNumericSubmenu } from "./submenus/numeric-input.ts";
import { createBooleanLevelSubmenu } from "./submenus/boolean-setting.ts";
import { createTargetSelectSubmenu, type SetTarget } from "./submenus/target-select.ts";
import { SettingsListWrapper } from "./wrappers/settings-list.ts";
import type { ConfigStore } from "../../config/config-store.ts";

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
  };

  // The switch step reports its own write; the two value steps below name their clear here.
  const clearAndNotify = (target: SetTarget) => {
    clear(target);
    ctx.ui.notify(`${label} cleared (${target})`, "info");
  };

  if (key === "enabled") {
    return createBooleanLevelSubmenu({
      ctx,
      theme,
      projectOffered: store.projectTargetOffered,
      label,
      initial,
      onDescription: "Ask once the answer passes the bound.",
      offDescription: "Never ask on your behalf.",
      onChange: (value, target) => store.setBeConciseEnabled(value, target),
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
      onClear: clearAndNotify,
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
    onClear: clearAndNotify,
  });
}

/**
 * Build the flat item list.
 */
function buildItems(ctx: ExtensionCommandContext, store: ConfigStore, theme: Theme): SettingItem[] {
  const { enabled, maxChars, message } = store.beConcise;
  const rows = [
    {
      key: "enabled",
      label: "Ask for a shorter answer",
      notify: "Be concise",
      value: enabled ? "ON" : "OFF",
      description: "When ON, a final answer whose prose passes the bound gets one trim request.",
    },
    {
      key: "maxChars",
      label: "Answer prose bound (chars)",
      notify: "Answer prose bound",
      value: String(maxChars),
      description: "Characters of prose allowed before a trim is requested; code blocks and tables are not counted.",
    },
    {
      key: "message",
      label: "Trim request",
      notify: "Trim request",
      value: message,
      description: "The instruction sent to the model when the bound is passed.",
    },
  ] as const;

  return rows.map((row) => ({
    id: row.key,
    label: row.label,
    currentValue: `${row.value}${sourceTag(store, "beConcise", row.key)}`,
    submenu: levelSubmenu(ctx, store, theme, row.key, row.notify, row.value),
    description: row.description,
  }));
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
