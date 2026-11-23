/**
 * menu-skills.ts — Skills settings menu concern: which shipped skills the model is shown.
 *
 * Single flat SettingsList, one row per shipped skill. Switching a row off leaves the skill reachable
 * through its own command; it only leaves the model's skill listing.
 *
 * Exports:
 *   - showSkillsSettingsMenu
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { SettingsList, type SettingItem } from "@earendil-works/pi-tui";
import { buildSettingsListTheme, sourceTag, type Theme } from "./helpers.ts";
import { createBooleanLevelSubmenu } from "./submenus/boolean-setting.ts";
import { SettingsListWrapper } from "./wrappers/settings-list.ts";
import { HIDABLE_SKILLS } from "../../skills.ts";
import type { ConfigStore } from "../../config/config-store.ts";

function buildItems(ctx: ExtensionCommandContext, store: ConfigStore, theme: Theme): SettingItem[] {
  return HIDABLE_SKILLS.map((skill) => {
    const shown = store.modelInvocable[skill];
    return {
      id: skill,
      label: skill,
      currentValue: `${shown ? "ON" : "OFF"}${sourceTag(store, "modelInvocable", skill)}`,
      submenu: createBooleanLevelSubmenu({
        ctx,
        theme,
        projectOffered: store.projectTargetOffered,
        label: skill,
        initial: shown ? "ON" : "OFF",
        onDescription: "The model is shown it and may load it on its own.",
        offDescription: "Only you reach it, and only by name.",
        onChange: (value, target) => store.setModelInvocable(skill, value, target),
        onClear: (target) => store.setModelInvocable(skill, undefined, target),
      }),
      description: `Switch off to leave it out of the model's listing. /skill:${skill} runs it either way.`,
    };
  });
}

export async function showSkillsSettingsMenu(ctx: ExtensionCommandContext, store: ConfigStore): Promise<void> {
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
      title: "Skills settings",
      theme,
      onCancel: () => done(undefined),
      onRebuild: (r) => {
        rebuild = r;
      },
    });
  });
}
