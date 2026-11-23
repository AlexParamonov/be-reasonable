/**
 * config-store.ts — Deep module owning persisted config + per-session overrides.
 *
 * - Reads return defaults baked in (no `?? 700` at call sites).
 * - Each persisted mutate method is mutate + persist, so a write cannot be forgotten.
 * - Effective config resolves project file → global file → built-in defaults. A mutation writes the
 *   global file, which keeps only its own keys; the merged config is never written back.
 *
 * Lifecycle: per-session. `reload()` re-reads disk at session_start.
 */

import {
  createConfigIO,
  mergeDefaults,
  mergeLayers,
  type ConfigIO,
  type ProjectLayerStatus,
  type RawBeConcise,
  type RawConfig,
  type BeReasonableConfig,
} from "./config-io.ts";

export type { ConfigIO, ProjectLayerStatus, RawConfig } from "./config-io.ts";

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

  get beConcise(): BeReasonableConfig["beConcise"] {
    return this.config.beConcise;
  }

  // ── Mutations ───────────────────────────────────────────────

  /** The switch is global: a project file may not turn the extension on or off. */
  setBeConciseEnabled(enabled: boolean | undefined): void {
    this.applyBeConciseWrite((layer) => {
      if (enabled === undefined) delete layer.enabled;
      else layer.enabled = enabled;
    });
  }

  setBeConciseMaxChars(maxChars: number | undefined): void {
    this.applyBeConciseWrite((layer) => {
      if (maxChars === undefined) delete layer.maxChars;
      else layer.maxChars = maxChars;
    });
  }

  /** The wording is global: it is the instruction sent on every trigger, not a per-project value. */
  setBeConciseMessage(message: string | undefined): void {
    this.applyBeConciseWrite((layer) => {
      if (message === undefined) delete layer.message;
      else layer.message = message;
    });
  }

  private applyBeConciseWrite(write: (layer: RawBeConcise) => void): void {
    this.globalRaw.beConcise ??= {};
    write(this.globalRaw.beConcise);
    this.io.saveGlobal(this.globalRaw);
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

  private rebuildEffective(): void {
    this.config = mergeDefaults(mergeLayers(this.globalRaw, this.projectRaw));
  }
}
