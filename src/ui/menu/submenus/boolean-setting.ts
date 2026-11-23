/**
 * boolean-setting.ts — Settings row submenu for one ON/OFF switch that can live in either layer.
 *
 * Level first, then the value: the same two steps every switch in this extension's settings uses, so a
 * write always names the file it landed in.
 */
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { SettingItem } from "@earendil-works/pi-tui";
import { createLevelPickerSubmenu, createTargetSelectSubmenu, type SetTarget } from "./target-select.ts";
import type { Theme } from "../helpers.ts";

export function createBooleanLevelSubmenu(options: {
  ctx: ExtensionCommandContext;
  theme: Theme;
  /** Show the project level (trusted project with a valid or absent config file). */
  projectOffered: boolean;
  /** Names the switch in the notify line. */
  label: string;
  /** The value the row shows now. */
  initial: string;
  onDescription: string;
  offDescription: string;
  onChange: (value: boolean, target: SetTarget) => void;
  onClear: (target: SetTarget) => void;
}): SettingItem["submenu"] {
  const { ctx, theme, label } = options;
  return createTargetSelectSubmenu({
    theme,
    projectOffered: options.projectOffered,
    showClear: true,
    onPick: (target, done) =>
      createLevelPickerSubmenu({
        theme,
        items: [
          { id: "ON", label: "On", currentValue: "", description: options.onDescription },
          { id: "OFF", label: "Off", currentValue: "", description: options.offDescription },
        ],
        onPick: (value) => {
          options.onChange(value === "ON", target);
          ctx.ui.notify(`${label} ${value} (${target})`, "info");
        },
      })(options.initial, done),
    onClear: (target) => {
      options.onClear(target);
      ctx.ui.notify(`${label} cleared (${target})`, "info");
    },
  });
}
