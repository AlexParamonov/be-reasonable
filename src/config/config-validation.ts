/**
 * config-validation.ts — Load-time validation for config files.
 *
 * One runtime schema per known key (single source of truth for rules and
 * warning text). Each invalid value is dropped from the effective config so
 * built-in defaults apply, valid keys are kept, file bytes are untouched, and
 * one loud warning per bad value names the file, key, got, expected, and fix
 * hint. Diagnostics go to a sink the caller supplies, so a read that must stay
 * silent gets silence. Never throws.
 */
import { Type, type TSchema } from "typebox";
import { Check } from "typebox/value";
import { isHidableSkill } from "../skills.ts";
import type { RawConfig, RawModelInvocable } from "./config-io.ts";

/** One known key's runtime rule plus its human-readable expected shape. */
interface KeySpec {
  schema: TSchema;
  expected: string;
}

const BOOL: KeySpec = { schema: Type.Boolean(), expected: "boolean" };
const MAX_CHARS: KeySpec = { schema: Type.Integer({ minimum: 1 }), expected: "whole number of characters, 1 or more" };
const TEXT: KeySpec = { schema: Type.String({ minLength: 1 }), expected: "text" };

/** Runtime schema for every known `beConcise` key. An unknown key is dropped with a warning. */
const BE_CONCISE_KEY_SPECS: Record<string, KeySpec> = {
  enabled: BOOL,
  maxChars: MAX_CHARS,
  message: TEXT,
};

/** Received-kind label for warnings: arrays and null get their own names. */
function describeValue(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (typeof value === "object") return "object";
  return typeof value;
}

/** One loud warning naming file, key, got, expected, and the fix path. */
function formatIncompatibleWarning(filePath: string, keyPath: string, value: unknown, expected: string): string {
  return (
    `[be-reasonable] Incompatible value in ${filePath}: "${keyPath}" is ${describeValue(value)}, ` +
    `expected ${expected}. Set it again in the /be-reasonable-settings menu, or edit or delete the file to fix it.`
  );
}

/** Emit one loud warning for a dropped value. Pure formatting stays in formatIncompatibleWarning. */
function warnIncompatible(reader: LayerReader, keyPath: string, value: unknown, expected: string): void {
  reader.warn(formatIncompatibleWarning(reader.filePath, keyPath, value, expected));
}

/**
 * Where a read's diagnostics go. A read that reports prints them; the bootstrap read hands in a sink that
 * hears nothing, so one config file is spoken about by exactly one load per startup.
 */
export type WarningSink = (message: string) => void;

/** The sink a read uses when its caller did not say otherwise: print. */
function printWarning(message: string): void {
  console.warn(message);
}

/** One file a read is validating, and where its diagnostics go. */
interface LayerReader {
  filePath: string;
  warn: WarningSink;
}

/** Plain-object guard, shared with config-io for its project malformed checks. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Expected-shape label for JSON-object sections. */
const EXPECTED_OBJECT = "object";

/**
 * Check a value against one known key's rule. Never throws: TypeBox is an
 * external call at a file-load boundary, so a missed check warns and drops
 * instead of crashing the load.
 */
function isValidValue(spec: KeySpec, value: unknown): boolean {
  try {
    return Check(spec.schema, value);
  } catch {
    return false;
  }
}

/**
 * Validate one global file layer, dropping invalid values from the result. Pure except for the diagnostics
 * it hands to `warn`. Never throws on bad input: unknown shapes fall back to empty sections.
 */
export function validateRawLayer(raw: unknown, filePath: string, warn: WarningSink = printWarning): RawConfig {
  const reader: LayerReader = { filePath, warn };
  return validateSections(raw, reader);
}

/**
 * Validate one trusted project's override layer. Everything the file carries survives cleaning, because the
 * layer is written back as the file wrote it; `ignoredProjectKeys` names what nothing applies.
 */
export function validateProjectLayer(raw: unknown, filePath: string, warn: WarningSink = printWarning): RawConfig {
  const reader: LayerReader = { filePath, warn };
  return validateSections(raw, reader);
}

function validateSections(raw: unknown, reader: LayerReader): RawConfig {
  const cleaned: RawConfig = {};
  if (!isPlainObject(raw)) {
    warnIncompatible(reader, "(config)", raw, EXPECTED_OBJECT);
    return cleaned;
  }

  for (const key of Object.keys(raw)) {
    if (key !== "beConcise" && key !== "modelInvocable") warnIncompatible(reader, key, raw[key], "a known section");
  }

  if (raw.beConcise !== undefined) {
    const beConcise = cleanBeConciseSection(raw.beConcise, reader);
    if (Object.keys(beConcise).length > 0) cleaned.beConcise = beConcise;
  }

  if (raw.modelInvocable !== undefined) {
    const modelInvocable = cleanModelInvocableSection(raw.modelInvocable, reader);
    if (Object.keys(modelInvocable).length > 0) cleaned.modelInvocable = modelInvocable;
  }

  return cleaned;
}

/** Keep a switch for every shipped skill this file names correctly, warn and drop the rest. */
function cleanModelInvocableSection(section: unknown, reader: LayerReader): RawModelInvocable {
  const kept: RawModelInvocable = {};
  if (!isPlainObject(section)) {
    warnIncompatible(reader, "modelInvocable", section, EXPECTED_OBJECT);
    return kept;
  }
  for (const [key, value] of Object.entries(section)) {
    if (value === undefined) continue;
    if (!isHidableSkill(key)) {
      warnIncompatible(reader, `modelInvocable.${key}`, value, "a skill this extension ships");
      continue;
    }
    if (isValidValue(BOOL, value)) kept[key] = value as boolean;
    else warnIncompatible(reader, `modelInvocable.${key}`, value, BOOL.expected);
  }
  return kept;
}

/** Keep valid `beConcise` settings, warn and drop the rest. */
function cleanBeConciseSection(section: unknown, reader: LayerReader): NonNullable<RawConfig["beConcise"]> {
  const kept: NonNullable<RawConfig["beConcise"]> = {};
  if (!isPlainObject(section)) {
    warnIncompatible(reader, "beConcise", section, EXPECTED_OBJECT);
    return kept;
  }
  for (const [key, value] of Object.entries(section)) {
    if (value === undefined) continue;
    const spec = BE_CONCISE_KEY_SPECS[key];
    if (!spec) {
      warnIncompatible(reader, `beConcise.${key}`, value, "a known setting");
      continue;
    }
    if (isValidValue(spec, value)) kept[key as keyof NonNullable<RawConfig["beConcise"]>] = value as never;
    else warnIncompatible(reader, `beConcise.${key}`, value, spec.expected);
  }
  return kept;
}
