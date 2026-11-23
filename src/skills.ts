/**
 * skills.ts — The shipped skills whose model visibility this extension's settings switch.
 *
 * Order is the settings menu's order. `shownByDefault` is what a layer that says nothing means, and it is what
 * each skill shipped as before the switch existed. A skill that ships `disable-model-invocation: true` in its
 * own SKILL.md cannot be switched on from here: pi applies the file's flag after our filter, so `be-concise`
 * is not listed at all - it stays out of the listing on purpose, and its trim request is the plain words the
 * model answers without loading anything.
 */
export const HIDABLE_SKILLS = [
  { name: "be-reasonable", shownByDefault: true },
  { name: "maintain-changelog", shownByDefault: false },
  { name: "maintain-tests", shownByDefault: true },
] as const;

/** Name of a shipped skill, exactly as pi's skill listing names it. */
export type HidableSkill = (typeof HIDABLE_SKILLS)[number]["name"];

/** True when `key` names a skill whose visibility this extension offers to switch. */
export function isHidableSkill(key: string): key is HidableSkill {
  return HIDABLE_SKILLS.some((skill) => skill.name === key);
}

/** The one skill whose moment the prompt itself names, because a listing alone loses to task momentum. */
export const BE_REASONABLE_SKILL: HidableSkill = "be-reasonable";
