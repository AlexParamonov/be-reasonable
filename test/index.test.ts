/**
 * index.test.ts — When the extension asks for a shorter answer.
 *
 * The seam is the extension's own event handlers: a fake Pi API records what it sends, and the config
 * comes from a real config file in a temp agent dir. The request is a follow-up, so it reaches the
 * model only once Pi has stopped running on its own.
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const MOCK_AGENT_DIR = mkdtempSync(join(tmpdir(), "be-reasonable-ext-global-"));
const GLOBAL_CONFIG_PATH = join(MOCK_AGENT_DIR, "be-reasonable.json");

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getAgentDir: () => MOCK_AGENT_DIR,
}));

vi.mock("../src/ui/menu/menus.js", () => ({
  showSettingsMenu: vi.fn(),
}));

const { default: beReasonable } = await import("../src/index.js");

const TRIM_MESSAGE = "Cut it.";
const LONG = "Verdict: ship it. " + "detail ".repeat(20);
const SHORT = "Verdict: ship it.";

function writeConfig(): void {
  writeFileSync(
    GLOBAL_CONFIG_PATH,
    JSON.stringify({ beConcise: { enabled: true, maxChars: 20, message: TRIM_MESSAGE } }),
  );
}

interface Sent {
  message: { customType: string; content: string; display: boolean };
  options?: { triggerTurn?: boolean; deliverAs?: string };
}

type FakeEvent = Record<string, unknown>;
type FakeHandler = (event: FakeEvent, ctx: ExtensionContext) => Promise<unknown>;

/** Fake Pi API: records registered handlers and every message the extension sends. */
function createFakePi() {
  const handlers = new Map<string, FakeHandler>();
  const commands = new Map<string, { handler: (args: string, ctx: ExtensionContext) => Promise<void> }>();
  const sent: Sent[] = [];
  const pi = {
    on: (event: string, handler: FakeHandler) => {
      handlers.set(event, handler);
    },
    registerCommand: (name: string, command: { handler: (args: string, ctx: ExtensionContext) => Promise<void> }) => {
      commands.set(name, command);
    },
    sendMessage: (message: Sent["message"], options?: Sent["options"]) => {
      sent.push({ message, options });
    },
  } as unknown as ExtensionAPI;
  return { pi, handlers, commands, sent };
}

function createFakeCtx(overrides: Partial<Pick<ExtensionContext, "hasPendingMessages">> = {}): ExtensionContext {
  return {
    cwd: MOCK_AGENT_DIR,
    isProjectTrusted: () => false,
    hasPendingMessages: () => false,
    ...overrides,
  } as unknown as ExtensionContext;
}

/** One settled answer: the settle boundary sees the text, then Pi stops running on its own. */
async function settle(
  handlers: Map<string, FakeHandler>,
  text: string,
  ctx: ExtensionContext,
  settled: { aborted: boolean } = { aborted: false },
): Promise<void> {
  await handlers.get("agent_before_settle")?.(beforeSettle(text), ctx);
  await handlers.get("agent_settled")?.(settled, ctx);
}

function beforeSettle(text: string): FakeEvent {
  return {
    outcome: "completed",
    entries: [],
    context: { llmMessages: [{ role: "assistant", content: [{ type: "text", text }] }] },
  };
}

describe("be-concise extension", () => {
  beforeEach(() => {
    writeConfig();
  });

  afterEach(() => {
    rmSync(GLOBAL_CONFIG_PATH, { force: true });
  });

  afterAll(() => {
    rmSync(MOCK_AGENT_DIR, { recursive: true, force: true });
  });

  it("opens the settings menu from /be-reasonable-settings", async () => {
    const { showSettingsMenu } = await import("../src/ui/menu/menus.js");
    const { pi, commands } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();

    await commands.get("be-reasonable-settings")?.handler("", ctx);

    expect(showSettingsMenu).toHaveBeenCalledWith(ctx, expect.objectContaining({ beConcise: expect.anything() }));
  });

  it("asks for one shorter answer once the long answer settles", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    await settle(handlers, LONG, ctx);

    expect(sent).toHaveLength(1);
    expect(sent[0].message.content).toBe(TRIM_MESSAGE);
    expect(sent[0].options).toEqual({ triggerTurn: true });
  });

  it("asks once per prompt: an answer that is still long gets no second request", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    await settle(handlers, LONG, ctx);
    await settle(handlers, LONG, ctx);

    expect(sent).toHaveLength(1);
  });

  it("stays quiet while the user has a message queued", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx({ hasPendingMessages: () => true });
    await handlers.get("session_start")?.({}, ctx);

    await settle(handlers, LONG, ctx);

    expect(sent).toHaveLength(0);
  });

  it("stays quiet when the answer was interrupted", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    await settle(handlers, LONG, ctx, { aborted: true });

    expect(sent).toHaveLength(0);
  });

  it("measures the answer that settled, not a longer one before it", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    await handlers.get("agent_before_settle")?.(beforeSettle(LONG), ctx);
    await handlers.get("agent_before_settle")?.(beforeSettle(SHORT), ctx);
    await handlers.get("agent_settled")?.({ aborted: false }, ctx);

    expect(sent).toHaveLength(0);
  });

  it("asks again for the next prompt", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    await settle(handlers, LONG, ctx);
    await handlers.get("input")?.({ text: "next question" }, ctx);
    await settle(handlers, LONG, ctx);

    expect(sent).toHaveLength(2);
  });
});
