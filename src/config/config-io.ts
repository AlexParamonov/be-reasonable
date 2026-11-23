/**
 * config-io.ts — Config persistence (read/write) with override layers.
 *
 * Atomic writes: write to .tmp then rename.
 * Loaded at session_start; saved on every /be-reasonable menu mutation.
 *
 * Two layers: the global file ~/.pi/agent/be-reasonable.json and a trusted
 * project's .pi/be-reasonable.json. The project layer may carry the bound,
 * beConcise.maxChars - never whether the trim runs, nor the words it sends. The
 * effective config merges project over global over built-in defaults. Each file
 * stores only its own keys; the merged config is never written back. What a
 * project setting may change is decided once by `isProjectAllowedBeConciseKey`,
 * which drives the merge and the one load-time warning that names every key left
 * out; the layer keeps the file's own keys, so an inert setting is named rather
 * than erased. A malformed project file is never overwritten, and only a
 * reporting read speaks.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { isPlainObject, validateProjectLayer, validateRawLayer } from "./config-validation.ts";
import type { WarningSink } from "./config-validation.ts";

/** File name of the config in both the global agent dir and a project's .pi dir. */
const CONFIG_FILE_NAME = "be-reasonable.json";
const CONFIG_DIR = getAgentDir();
const CONFIG_PATH = path.join(CONFIG_DIR, CONFIG_FILE_NAME);

export const DEFAULT_BE_CONCISE: BeConciseConfig = {
  enabled: false,
  maxChars: 1200,
  message:
    "Cut that answer to what changes what I do next: verdict first, then only the evidence, decisions " +
    "and risks I would otherwise re-ask for. Keep tables and commands that carry the answer.",
};

/** A layer a persisted mutation can target. */
export type ConfigTarget = "session" | "global" | "project";

/** State of the project layer for the current IO instance. */
export type ProjectLayerStatus = "untrusted" | "absent" | "loaded" | "malformed";

/** Raw `beConcise` section as stored in a config file. */
export interface RawBeConcise {
  enabled?: boolean;
  maxChars?: number;
  message?: string;
}

export interface BeConciseConfig {
  enabled: boolean;
  maxChars: number;
  message: string;
}

export interface BeReasonableConfig {
  beConcise: BeConciseConfig;
}

/** Raw config file contents: only the keys that file carries. */
export interface RawConfig {
  beConcise?: RawBeConcise;
}

/** Result of a load: the two raw layers plus the project layer's status. */
export interface LoadedConfig {
  global: RawConfig;
  project: RawConfig | null;
  projectStatus: ProjectLayerStatus;
}

/** Persistence port consumed by ConfigStore. */
export interface ConfigIO {
  load(options?: ConfigLoadOptions): LoadedConfig;
  saveGlobal(config: RawConfig): void;
  saveProject(config: RawConfig): void;
}

/**
 * How a read treats what it found. Every read reports what it warns about except the one that builds the
 * shell's store at extension load, which session_start reads again - so a config file's diagnostics are
 * printed once per Pi start rather than twice.
 */
export interface ConfigLoadOptions {
  report?: boolean;
}

/** `beConcise` keys a project file may set. */
export const PROJECT_ALLOWED_BE_CONCISE_KEYS = new Set(["maxChars"]);

/** True when a project file may carry this `beConcise` key. */
export function isProjectAllowedBeConciseKey(key: string): boolean {
  return PROJECT_ALLOWED_BE_CONCISE_KEYS.has(key);
}

const PROJECT_KEYS_ARE_GLOBAL =
  "A project may set only beConcise.maxChars: whether the trim runs, and what it says, are global settings.";

/** A read that reports: the diagnostics reach the operator. */
const logWarning: WarningSink = (message) => {
  console.warn(message);
};

/** The bootstrap read's sink: session_start loads the same layers again and reports them there. */
const silent: WarningSink = () => {};

/** A project layer's settings that the effective config cannot use, spelled as the file spells them. */
function ignoredProjectKeys(project: RawConfig): string[] {
  return Object.keys(project.beConcise ?? {})
    .filter((key) => !isProjectAllowedBeConciseKey(key))
    .map((key) => `beConcise.${key}`);
}

/**
 * One warning naming every project key with no effect, never a value. True when it warned, which is
 * how the loader keeps it to one per load rather than one per merge that happens to drop the key. A silent
 * read neither warns nor consumes that state, so the read that reports still names the keys.
 */
function warnIgnoredProjectKeys(projectPath: string, project: RawConfig, warn: WarningSink): boolean {
  const listed = ignoredProjectKeys(project);
  if (listed.length === 0) return false;
  warn(
    `[be-reasonable] Ignoring keys in project config ${projectPath}: ${listed.join(", ")} ${PROJECT_KEYS_ARE_GLOBAL}`,
  );
  return true;
}

/** Read + validate the project file. null = absent, "malformed" = invalid. */
type ProjectRead = RawConfig | "malformed" | null;

/**
 * Create a ConfigIO. With a trusted project's `.pi` directory the project file
 * (when present and valid) is an override layer over the global file; each
 * save touches only its own layer. A malformed project file is never written;
 * without a project dir the project layer is untrusted and unavailable.
 */
export function createConfigIO(projectDir?: string): ConfigIO {
  const projectPath = projectDir ? path.join(projectDir, CONFIG_FILE_NAME) : null;
  let projectStatus: ProjectLayerStatus = projectDir ? "absent" : "untrusted";
  let projectRaw: RawConfig | null = null;
  let ignoredKeysWarned = false;

  return {
    load: ({ report = true }: ConfigLoadOptions = {}) => {
      const warn = report ? logWarning : silent;
      const global = readGlobalRaw(warn);
      if (projectPath) {
        const read = readProjectRaw(projectPath, warn);
        if (read === null) {
          projectRaw = null;
          projectStatus = "absent";
        } else if (read === "malformed") {
          projectRaw = null;
          projectStatus = "malformed";
        } else {
          projectRaw = read;
          projectStatus = "loaded";
          if (report && !ignoredKeysWarned && warnIgnoredProjectKeys(projectPath, read, warn)) {
            ignoredKeysWarned = true;
          }
        }
      } else {
        projectRaw = null;
        projectStatus = "untrusted";
      }
      return { global, project: projectRaw, projectStatus };
    },
    saveGlobal: (config) => {
      writeJsonAtomic(CONFIG_PATH, config);
    },
    saveProject: (config) => {
      if (!projectPath || projectStatus === "malformed" || projectStatus === "untrusted") {
        console.warn(`[be-reasonable] Refusing to write project config (${projectStatus}); change not saved`);
        return;
      }
      writeJsonAtomic(projectPath, config);
    },
  };
}

/**
 * Read config from disk (global file only). Merges loaded values over
 * defaults so the result is always a complete BeReasonableConfig. Used outside
 * the store; the store loads both layers via ConfigIO.
 */
export function loadConfig(): BeReasonableConfig {
  return mergeDefaults(readGlobalRaw(logWarning));
}

/**
 * Merge the two raw layers into one raw config: project keys win, absent keys
 * inherit from global. Project keys the layer cannot set are dropped here and
 * named once by the load warning (`ignoredProjectKeys`). Pure — no I/O, and no
 * warning of its own: the store merges again after every mutation, and only a
 * load may report.
 */
export function mergeLayers(global: RawConfig, project: RawConfig | null): RawConfig {
  const beConcise: Record<string, unknown> = { ...global.beConcise };
  for (const [key, value] of Object.entries(project?.beConcise ?? {})) {
    if (isProjectAllowedBeConciseKey(key)) beConcise[key] = value;
  }
  return Object.keys(beConcise).length > 0 ? { beConcise: beConcise as RawBeConcise } : {};
}

/** Bake hardcoded defaults into a raw config. */
export function mergeDefaults(raw: RawConfig): BeReasonableConfig {
  const beConcise = raw.beConcise ?? {};
  return {
    beConcise: {
      enabled: beConcise.enabled ?? DEFAULT_BE_CONCISE.enabled,
      maxChars: beConcise.maxChars ?? DEFAULT_BE_CONCISE.maxChars,
      message: beConcise.message ?? DEFAULT_BE_CONCISE.message,
    },
  };
}

// ── Load ─────────────────────────────────────────────────────────────

/** Read the global file; any failure (missing, malformed) reads as {} — as today. */
function readGlobalRaw(warn: WarningSink): RawConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
  // Per-value validation: drop bad values with a warning, keep valid keys.
  return validateRawLayer(parsed, CONFIG_PATH, warn);
}

/**
 * Read the project file; missing = absent, unreadable/invalid = malformed + warning. The cleaned layer
 * keeps the file's own keys so the load warning can name what nothing applies. File bytes stay untouched.
 */
function readProjectRaw(projectPath: string, warn: WarningSink): ProjectRead {
  if (!fs.existsSync(projectPath)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(projectPath, "utf-8"));
  } catch (err) {
    warn(`[be-reasonable] Ignoring malformed project config ${projectPath}: ${String(err)}`);
    return "malformed";
  }
  if (!isPlainObject(parsed)) {
    warn(`[be-reasonable] Ignoring malformed project config ${projectPath}: not a JSON object`);
    return "malformed";
  }
  const raw = parsed as RawConfig;
  if (raw.beConcise !== undefined && !isPlainObject(raw.beConcise)) {
    return malformedSection(projectPath, "beConcise", warn);
  }
  return validateProjectLayer(raw, projectPath, warn);
}

function malformedSection(projectPath: string, section: string, warn: WarningSink): "malformed" {
  warn(`[be-reasonable] Ignoring malformed project config ${projectPath}: "${section}" is not a JSON object`);
  return "malformed";
}

// ── Save ─────────────────────────────────────────────────────────────

/** Write JSON atomically: tmp file in the same directory, then rename. */
function writeJsonAtomic(filePath: string, config: unknown): void {
  const tmpPath = filePath + ".tmp";
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`[be-reasonable] Failed to save config: ${String(err)}`);
  }
}
