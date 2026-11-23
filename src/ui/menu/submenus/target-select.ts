/**
 * target-select.ts — Shared target-level picker (global/project).
 *
 * Used by the settings menus whenever a value can live in more than one layer.
 * The project entry is offered only when the store says the project target is
 * available.
 */

import { SettingsList, type Component, type SettingItem } from "@earendil-works/pi-tui";
import { buildSettingsListTheme, type Theme } from "../helpers.ts";

/** The layer a set or clear applies to. */
export type SetTarget = "global" | "project";

/** Level entries with per-context persistence notes (set vs clear pickers). */
const LEVEL_ENTRIES: Record<SetTarget, { label: string; setDescription: string; clearDescription: string }> = {
  global: {
    label: "Global",
    setDescription: "Saves to the global config file",
    clearDescription: "Removes from the global config file",
  },
  project: {
    label: "Project",
    setDescription: "Saves to the project config file",
    clearDescription: "Removes from the project config file",
  },
};

/** Level row with the description matching the picker's action. */
function levelItem(target: SetTarget, clearMode: boolean): SettingItem {
  const entry = LEVEL_ENTRIES[target];
  return {
    id: target,
    label: entry.label,
    currentValue: "",
    description: clearMode ? entry.clearDescription : entry.setDescription,
  };
}

/**
 * Level rows for a level picker: the offered levels (with the description
 * matching the picker's action) plus an optional "Clear..." row. Clear mode
 * flips the notes to "Removes from..." (see LEVEL_ENTRIES).
 */
function buildLevelItems(options: {
  /** Which levels get a row. */
  offered: { global: boolean; project: boolean };
  /** Description wording: set ("Saves to...") vs clear ("Removes from..."). */
  clearMode?: boolean;
  includeClear?: boolean;
}): SettingItem[] {
  const items: SettingItem[] = [];
  if (options.offered.global) items.push(levelItem("global", options.clearMode === true));
  if (options.offered.project) items.push(levelItem("project", options.clearMode === true));
  if (options.includeClear) items.push({ id: "clear", label: "Clear...", currentValue: "" });
  return items;
}

/**
 * SettingsList-based level picker: bare rows with the selected row's
 * description at the bottom, like the main settings menus. Enter/Space on a
 * row routes through onPick: a returned Component chains as the picker's own
 * submenu (SettingsList manages it); a void return completes the pick.
 */
export function createLevelPickerSubmenu(options: {
  theme: Theme;
  items: SettingItem[];
  onPick: (id: string, done: (selectedValue?: string) => void) => Component | void;
}): (currentValue: string, done: (selectedValue?: string) => void) => Component {
  return (_currentValue, done) => {
    const items = options.items.map((item) => ({
      ...item,
      submenu: (cv: string, subDone: (selectedValue?: string) => void): Component => {
        const next = options.onPick(item.id, subDone);
        if (next) return next;
        // No chained step: the pick completes immediately.
        subDone(item.id);
        return null as unknown as Component;
      },
    }));
    const list = new SettingsList(
      items,
      items.length,
      buildSettingsListTheme(options.theme),
      (_id, value) => done(value),
      () => done(),
    );
    // The wrapper reads these two duck-typed members: focused marks the picker
    // as a submenu; getActive exposes the chained step for j/k letter handling.
    const picker = list as SettingsList & { focused: boolean; getActive(): Component | null };
    picker.focused = true;
    picker.getActive = () => (list as any).submenuComponent ?? null;
    return picker;
  };
}

export interface TargetSelectSubmenuOptions {
  theme: Theme;
  /** Show the project entry (trusted project with a valid or absent config file). */
  projectOffered: boolean;
  /** Append a "Clear..." entry that opens a nested per-level clear picker. Default: false. */
  showClear?: boolean;
  /**
   * Apply the pick. Return a Component to chain into (value input, confirm);
   * return void to close the submenu (the settings list rebuilds).
   */
  onPick: (target: SetTarget, done: (selectedValue?: string) => void) => Component | void;
  /** Clear the key at the picked level; required when showClear is set. */
  onClear?: (target: SetTarget) => void;
}

export function createTargetSelectSubmenu(
  options: TargetSelectSubmenuOptions,
): (currentValue: string, done: (selectedValue?: string) => void) => Component {
  const clearMode = options.showClear === true;
  const items = buildLevelItems({
    offered: { global: true, project: options.projectOffered },
    clearMode,
    includeClear: options.showClear === true,
  });

  return createLevelPickerSubmenu({
    theme: options.theme,
    items,
    onPick: (id, subDone) => {
      if (id === "clear") {
        // "Clear..." routes to a nested per-level picker.
        return createClearPickerSubmenu({
          theme: options.theme,
          projectOffered: options.projectOffered,
          onClear: (target) => options.onClear?.(target),
        })("", subDone);
      }
      return options.onPick(id as SetTarget, subDone);
    },
  });
}

/**
 * Nested per-level clear picker ("Clear..." → pick a level).
 */
function createClearPickerSubmenu(options: {
  theme: Theme;
  projectOffered: boolean;
  onClear: (target: SetTarget) => void;
}): (currentValue: string, done: (selectedValue?: string) => void) => Component {
  return createTargetSelectSubmenu({
    theme: options.theme,
    projectOffered: options.projectOffered,
    onPick: (target) => options.onClear(target),
  });
}
