/**
 * config-store.ts — Deep module owning persisted config + per-session overrides.
 *
 * - Reads return defaults baked in (no `?? 700` at call sites).
 * - Each persisted mutate method is mutate + persist, so a write cannot be forgotten.
 * - Effective config resolves project file → global file → built-in defaults. A mutation writes one
 *   layer, which keeps only its own keys; the merged config is never written back.
 *
 * Lifecycle: per-session. `reload()` re-reads disk at session_start.
 */

import {
  createConfigIO,
  mergeDefaults,
  mergeLayers,
  type ConfigIO,
  type ConfigTarget,
  type ProjectLayerStatus,
  type RawConfig,
  type BeReasonableConfig,
} from "./config-io.ts";
import { HIDABLE_SKILLS, type HidableSkill } from "../skills.ts";

export type { ConfigIO, ConfigTarget, ProjectLayerStatus, RawConfig } from "./config-io.ts";

export const fileConfigIO: ConfigIO = createConfigIO();

export class ConfigStore {
  private globalRaw: RawConfig;
  private projectRaw: RawConfig | null;
  private projectStatus: ProjectLayerStatus;
  private config: BeReasonableConfig;
  private io: ConfigIO;

  constructor(io: ConfigIO = fileConfigIO) {
    this.io = io;
    // session_start reloads these layers and reports what it finds there; a reporting read here
    // would print the same diagnostics twice per Pi start.
    const loaded = io.load({ report: false });
    this.globalRaw = loaded.global;
    this.projectRaw = loaded.project;
    this.projectStatus = loaded.projectStatus;
    this.config = mergeDefaults(mergeLayers(this.globalRaw, this.projectRaw));
  }

  /**
   * Point persistence at a project's `.pi` directory (or back to global-only
   * when undefined). Does not reload; session_start follows with reload().
   */
  setProjectDir(projectDir: string | undefined): void {
    this.io = createConfigIO(projectDir);
  }

  // ── Reads ──────────────────────────────────────────────────────

  /** True when the project layer may be written: trusted project, valid or absent file. */
  get projectTargetOffered(): boolean {
    return this.projectStatus === "loaded" || this.projectStatus === "absent";
  }

  /** True when the project file itself sets this key, which is what the menu tags. */
  setInProject(section: "beConcise" | "modelInvocable", key: string): boolean {
    return (this.projectRaw?.[section] as Record<string, unknown> | undefined)?.[key] !== undefined;
  }

  get beConcise(): BeReasonableConfig["beConcise"] {
    return this.config.beConcise;
  }

  /** Whether the model is shown each shipped skill in its skill listing. */
  get modelInvocable(): Record<HidableSkill, boolean> {
    return this.config.modelInvocable;
  }

  /** Shipped skills the model must not be shown, in the order the settings menu lists them. */
  get hiddenFromModel(): HidableSkill[] {
    return HIDABLE_SKILLS.filter((name) => !this.config.modelInvocable[name]);
  }

  // ── Mutations ───────────────────────────────────────────────

  setBeConciseEnabled(enabled: boolean | undefined, target: ConfigTarget): void {
    this.applyWrite("beConcise", "enabled", enabled, target);
  }

  setBeConciseMaxChars(maxChars: number | undefined, target: ConfigTarget): void {
    this.applyWrite("beConcise", "maxChars", maxChars, target);
  }

  setBeConciseMessage(message: string | undefined, target: ConfigTarget): void {
    this.applyWrite("beConcise", "message", message, target);
  }

  /** Show or hide one shipped skill to the model; undefined clears the layer's switch. */
  setModelInvocable(skill: HidableSkill, value: boolean | undefined, target: ConfigTarget): void {
    this.applyWrite("modelInvocable", skill, value, target);
  }

  /**
   * Set or clear one key of one raw layer, then persist that layer alone: a layer keeps only its own keys,
   * so no merged or default value is ever written back.
   */
  private applyWrite(section: "beConcise" | "modelInvocable", key: string, value: unknown, target: ConfigTarget): void {
    const layer = this.layerFor(target);
    if (!layer) return;
    const raw = (layer[section] ??= {}) as Record<string, unknown>;
    if (value === undefined) delete raw[key];
    else raw[key] = value;
    if (target === "global") this.io.saveGlobal(layer);
    else this.io.saveProject(layer);
    this.rebuildEffective();
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /** Re-read disk. Called at session_start. */
  reload(): void {
    const loaded = this.io.load();
    this.globalRaw = loaded.global;
    this.projectRaw = loaded.project;
    this.projectStatus = loaded.projectStatus;
    this.rebuildEffective();
  }

  // ── Private helpers ────────────────────────────────────────────

  /**
   * The raw layer a persisted mutation targets. The project layer is created
   * empty on first access in a trusted project without a file (the first write
   * creates the file); when it is unavailable (untrusted or malformed) the
   * mutation is refused with a warning.
   */
  private layerFor(target: ConfigTarget): RawConfig | null {
    if (target === "global") return this.globalRaw;
    if (this.projectRaw) return this.projectRaw;
    if (this.projectStatus === "absent") {
      this.projectRaw = {};
      return this.projectRaw;
    }
    console.warn(`[be-reasonable] Project config target unavailable (${this.projectStatus}); change ignored`);
    return null;
  }

  private rebuildEffective(): void {
    this.config = mergeDefaults(mergeLayers(this.globalRaw, this.projectRaw));
  }
}
