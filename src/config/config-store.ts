/**
 * config-store.ts — Deep module owning persisted config + per-session overrides.
 *
 * - Reads return defaults baked in (no `?? 1200` at call sites).
 * - Each persisted mutate method is mutate + persist, so a write cannot be forgotten.
 * - Effective config resolves session overrides → project file → global file → built-in defaults.
 *   Mutations target one layer; each file stores only its own keys and the merged config is never
 *   written back.
 *
 * Lifecycle: per-session. `reload()` re-reads disk and resets session overrides at session_start.
 */

import {
  createConfigIO,
  mergeDefaults,
  mergeLayers,
  type ConfigIO,
  type ConfigTarget,
  type ProjectLayerStatus,
  type RawBeConcise,
  type RawConfig,
  type BeReasonableConfig,
} from "./config-io.ts";

export type { ConfigIO, ConfigTarget, ProjectLayerStatus, RawConfig } from "./config-io.ts";

export const fileConfigIO: ConfigIO = createConfigIO();

export class ConfigStore {
  private globalRaw: RawConfig;
  private projectRaw: RawConfig | null;
  private projectStatus: ProjectLayerStatus;
  private config: BeReasonableConfig;
  private io: ConfigIO;
  private sessionBeConcise: RawBeConcise = {};

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

  get beConcise(): BeReasonableConfig["beConcise"] {
    return { ...this.config.beConcise, ...this.sessionBeConcise };
  }

  // ── Mutations ───────────────────────────────────────────────

  /** The switch is global or session-only: a project file may not turn the extension on or off. */
  setBeConciseEnabled(enabled: boolean | undefined, target: "global" | "session"): void {
    this.applyBeConciseWrite(target, (layer) => {
      if (enabled === undefined) delete layer.enabled;
      else layer.enabled = enabled;
    });
  }

  setBeConciseMaxChars(maxChars: number | undefined, target: ConfigTarget): void {
    this.applyBeConciseWrite(target, (layer) => {
      if (maxChars === undefined) delete layer.maxChars;
      else layer.maxChars = maxChars;
    });
  }

  /** The wording is global: it is the instruction sent on every trigger, not a per-project value. */
  setBeConciseMessage(message: string | undefined, target: "global"): void {
    this.applyBeConciseWrite(target, (layer) => {
      if (message === undefined) delete layer.message;
      else layer.message = message;
    });
  }

  private applyBeConciseWrite(target: ConfigTarget, write: (layer: RawBeConcise) => void): void {
    if (target === "session") {
      write(this.sessionBeConcise);
      return;
    }
    const layer = this.layerFor(target);
    if (!layer) return;
    layer.beConcise ??= {};
    write(layer.beConcise);
    this.commitLayer(target, layer);
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /** Re-read disk and reset session overrides. Called at session_start. */
  reload(): void {
    const loaded = this.io.load();
    this.globalRaw = loaded.global;
    this.projectRaw = loaded.project;
    this.projectStatus = loaded.projectStatus;
    this.rebuildEffective();
    this.sessionBeConcise = {};
  }

  // ── Private helpers ────────────────────────────────────────────

  /**
   * The raw layer a persisted mutation targets. The project layer is created
   * empty on first access in a trusted project without a file (the first write
   * creates the file); when the project target is unavailable (untrusted or
   * malformed) the mutation is refused with a warning.
   */
  private layerFor(target: "global" | "project"): RawConfig | null {
    if (target === "global") return this.globalRaw;
    if (this.projectRaw) return this.projectRaw;
    if (this.projectStatus === "absent") {
      this.projectRaw = {};
      return this.projectRaw;
    }
    console.warn(`[be-reasonable] Project config target unavailable (${this.projectStatus}); change ignored`);
    return null;
  }

  private commitLayer(target: "global" | "project", layer: RawConfig): void {
    if (target === "global") this.io.saveGlobal(layer);
    else this.io.saveProject(layer);
    this.rebuildEffective();
  }

  private rebuildEffective(): void {
    this.config = mergeDefaults(mergeLayers(this.globalRaw, this.projectRaw));
  }
}
