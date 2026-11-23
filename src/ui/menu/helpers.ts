/**
 * helpers.ts — Shared helpers for menu modules:
 * theme builders for SettingsList/SelectList, numeric validation,
 * separator-skip installation.
 */
import type { SettingsListTheme } from "@earendil-works/pi-tui";

/** The theme members this layer paints with: pi passes more, these two are all a menu needs. */
export type Theme = { fg(color: string, text: string): string; bold(text: string): string };

/**
 * Item id that marks a separator/section-header row in SettingsList/SelectList
 * item arrays. Menus push these; the separator-skip mechanism (installSeparatorSkip)
 * keeps the cursor from landing on them.
 */
export const SEPARATOR_ID = "__sep__";
/**
 * Install separator-skip on a SelectList/SettingsList instance so navigation
 * never leaves the cursor on a SEPARATOR_ID row.
 *
 * pi-tui stores selectedIndex as a plain own property and writes it directly
 * on up/down (with wrap-around), so overriding it with a symbol-backed
 * get/set pair intercepts every navigation write. On a separator write the
 * setter searches in the travel direction first, falls back to the opposite
 * direction, and stays put if everything is a separator. The search uses
 * list.items; no caller filters items, so it matches filteredItems.
 */
export function installSeparatorSkip(list: any): void {
  if (!Array.isArray(list.items)) return;
  const rawIndex = Symbol("rawIndex");
  const isSep = (item: any) => item?.value === SEPARATOR_ID || item?.id === SEPARATOR_ID;
  // Starting just past `start`, walk in `step` direction and return the
  // first non-separator index (or an out-of-bounds sentinel if none).
  const firstNonSepFrom = (items: any[], start: number, step: number): number => {
    let next = start + step;
    while (next >= 0 && next < items.length && isSep(items[next])) next += step;
    return next;
  };
  const inBounds = (items: any[], i: number) => i >= 0 && i < items.length;
  // Read the current selection before defineProperty: afterwards, reading
  // selectedIndex goes through the new getter and returns the not-yet-seeded
  // rawIndex (undefined) instead of the real value.
  const initialIndex = list.selectedIndex ?? 0;
  Object.defineProperty(list, "selectedIndex", {
    get() {
      return list[rawIndex];
    },
    set(idx) {
      const items = list.items;
      const cur = list[rawIndex];
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      if (!isSep(items[clamped])) {
        list[rawIndex] = clamped;
        return;
      }
      // Landed on a separator: search in the travel direction first,
      // fall back to the opposite direction so the cursor always ends on
      // a real item (or stays put if everything is a separator).
      const step = idx > cur ? 1 : -1;
      const fwd = firstNonSepFrom(items, clamped, step);
      const back = firstNonSepFrom(items, clamped, -step);
      if (inBounds(items, fwd)) list[rawIndex] = fwd;
      else if (inBounds(items, back)) list[rawIndex] = back;
      else list[rawIndex] = clamped;
    },
    configurable: true,
  });
  list[rawIndex] = initialIndex;
}
/** Build a SettingsListTheme from a pi-coding-agent Theme. */
export function buildSettingsListTheme(theme: Theme): SettingsListTheme {
  return {
    label: (text, selected) => (selected ? theme.fg("accent", text) : text),
    value: (text, selected) => (selected ? theme.fg("accent", text) : theme.fg("muted", text)),
    description: (text) => theme.fg("dim", text),
    // Use "→ " (2 chars) to match non-selected prefix "  " (2 spaces)
    // This prevents menu items from shifting left/right when cursor moves
    cursor: theme.fg("accent", "→ "),
    hint: (text) => theme.fg("dim", text),
  };
}

/**
 * Pure numeric validation. Returns parsed number ≥ min, or undefined.
 */
export function validateNumeric(value: string, min: number): number | undefined {
  const trimmed = value.trim();
  // Accept integers and decimals (e.g. 0.5 for 30 seconds)
  if (!/^\d*\.?\d+$/.test(trimmed)) return undefined;
  const parsed = parseFloat(trimmed);
  if (parsed < min) return undefined;
  return parsed;
}

/**
 * Build a SelectListTheme from a pi-coding-agent Theme.
 * Produces the same visual style as buildSettingsListTheme: → cursor, accent colors, muted descriptions.
 */
export function buildSelectListTheme(theme: Theme): import("@earendil-works/pi-tui").SelectListTheme {
  return {
    selectedPrefix: () => theme.fg("accent", "→ "),
    selectedText: (text) => theme.fg("accent", text),
    description: (text) => theme.fg("muted", text),
    scrollInfo: (text) => theme.fg("dim", text),
    noMatch: (text) => theme.fg("dim", text),
  };
}
