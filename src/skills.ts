/**
 * skills.ts — The shipped skills whose model visibility this extension's settings switch.
 *
 * Only a skill pi shows the model can be hidden from it here. `be-concise` and `maintain-changelog` ship
 * `disable-model-invocation: true` in their own SKILL.md, which pi applies after our filter, so a switch here
 * could never show them, and `be-concise` is meant to stay out of the listing: its trim request is the plain
 * words the model answers directly.
 */
export const HIDABLE_SKILLS = ["be-reasonable", "maintain-tests"] as const;

/** Name of a shipped skill, exactly as pi's skill listing names it. */
export type HidableSkill = (typeof HIDABLE_SKILLS)[number];

/** True when `key` names a skill whose visibility this extension offers to switch. */
export function isHidableSkill(key: string): key is HidableSkill {
  return (HIDABLE_SKILLS as readonly string[]).includes(key);
}
