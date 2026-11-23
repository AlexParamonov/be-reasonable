/**
 * menus.ts — /be-reasonable-settings command dispatcher.
 *
 * Uses SelectList from @earendil-works/pi-tui via ctx.ui.custom.
 * Each iteration creates a fresh SelectList; submenu closes it before opening.
 * No nested ctx.ui.custom calls.
 *
 * Module structure:
 *   - helpers.ts: shared helpers (buildSettingsListTheme, buildSelectListTheme, validateNumeric)
 *   - menu-be-concise.ts: showBeConciseSettingsMenu
 *   - menu-skills.ts: showSkillsSettingsMenu
 *   - menus.ts (this file): dispatcher — settings menu
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { SelectList, type SelectItem } from "@earendil-works/pi-tui";
import { buildSelectListTheme } from "./helpers.ts";
import { SettingsListWrapper } from "./wrappers/settings-list.ts";
import { showBeConciseSettingsMenu } from "./menu-be-concise.ts";
import { showSkillsSettingsMenu } from "./menu-skills.ts";
import type { ConfigStore } from "../../config/config-store.ts";

/**
 * Render `items` as a titled SelectList and dispatch the chosen value.
 * Re-loops after each dispatch until the user cancels (Esc or Back).
 * Each iteration builds a fresh list so state never leaks between visits.
 */
async function runSelectMenu(
  ctx: ExtensionCommandContext,
  title: string,
  items: SelectItem[],
  dispatch: (choice: string) => Promise<void>,
): Promise<void> {
  while (true) {
    const choice = await ctx.ui.custom<string | undefined>((_tui, theme, _kb, done) => {
      const list = new SelectList([...items], 10, buildSelectListTheme(theme));
      list.onSelect = (item) => done(item.value);
      return new SettingsListWrapper(list, { title, theme, onCancel: () => done(undefined) });
    });
    if (choice === undefined) return;
    await dispatch(choice);
  }
}

export async function showSettingsMenu(ctx: ExtensionCommandContext, store: ConfigStore): Promise<void> {
  const items: SelectItem[] = [
    {
      value: "be-concise",
      label: "Be concise",
      description: "Ask for a shorter answer when the final one runs long",
    },
    {
      value: "skills",
      label: "Skills",
      description: "Switch which skills this extension ships the model is shown",
    },
  ];

  await runSelectMenu(ctx, "Settings", items, async (choice) => {
    switch (choice) {
      case "be-concise":
        await showBeConciseSettingsMenu(ctx, store);
        break;
      case "skills":
        await showSkillsSettingsMenu(ctx, store);
        break;
    }
  });
}
