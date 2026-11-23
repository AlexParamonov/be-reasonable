/**
 * index.test.ts — When the extension asks for a shorter answer.
 *
 * The seam is the extension's own event handlers: a fake Pi API records what it sends, and the config
 * comes from a real config file in a temp agent dir. A test hands the settle boundary the conversation
 * Pi hands it, the user messages of the turn and the answer that settled, because the request reads it.
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
const PROMPT = "Ship it?";
const NOTIFICATION = "Subagent finished.";
const LONG = "Verdict: ship it. " + "detail ".repeat(20);
const SHORT = "Verdict: ship it.";

/** A settled long answer to a prompt, the shortest conversation that earns a request. */
const ASKED: Turn[] = [
  { role: "user", text: PROMPT },
  { role: "assistant", text: LONG },
];

function writeConfig(extra: Record<string, unknown> = {}): void {
  writeFileSync(
    GLOBAL_CONFIG_PATH,
    JSON.stringify({ beConcise: { enabled: true, maxChars: 20, message: TRIM_MESSAGE }, ...extra }),
  );
}

interface Sent {
  message: { customType: string; content: string; display: boolean };
  options?: { triggerTurn?: boolean; deliverAs?: string };
}
type FakeEvent = Record<string, unknown>;
type FakeHandler = (event: FakeEvent, ctx: ExtensionContext) => Promise<unknown>;

/** One message of the conversation the settle boundary sees. */
interface Turn {
  role: "user" | "assistant";
  text: string;
}

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

/** One settled answer: the settle boundary sees the conversation, then Pi stops running on its own. */
async function settle(
  handlers: Map<string, FakeHandler>,
  conversation: Turn[],
  ctx: ExtensionContext,
  settled: { aborted: boolean } = { aborted: false },
): Promise<void> {
  await handlers.get("agent_before_settle")?.(beforeSettle(conversation), ctx);
  await handlers.get("agent_settled")?.(settled, ctx);
}

function beforeSettle(conversation: Turn[]): FakeEvent {
  return {
    outcome: "completed",
    entries: [],
    context: { llmMessages: conversation.map(({ role, text }) => ({ role, content: [{ type: "text", text }] })) },
  };
}

/** One run's prompt options, as pi hands them to before_agent_start, and the skill names it lists. */
function runOptions(skillNames: string[]): { systemPromptOptions: { skills: { name: string }[] } } {
  return { systemPromptOptions: { skills: skillNames.map((name) => ({ name })) } };
}

const ALL_SKILLS = ["be-reasonable", "maintain-changelog", "maintain-tests", "be-concise", "my-own-skill"];

// Every test writes its own global config file and leaves none behind, so no test sees another's layers.
beforeEach(() => {
  writeConfig();
});

afterEach(() => {
  rmSync(GLOBAL_CONFIG_PATH, { force: true });
});

describe("what the model is shown", () => {
  it("drops a skill the config hides from the model's listing", async () => {
    writeConfig({ modelInvocable: { "maintain-tests": false } });
    const { pi, handlers } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);
    const event = runOptions(ALL_SKILLS);

    await handlers.get("before_agent_start")?.(event, ctx);

    expect(event.systemPromptOptions.skills.map((s) => s.name)).toEqual([
      "be-reasonable",
      "maintain-changelog",
      "be-concise",
      "my-own-skill",
    ]);
  });

  it("keeps the listing whole when nothing is hidden", async () => {
    const { pi, handlers } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);
    const event = runOptions(ALL_SKILLS);

    await handlers.get("before_agent_start")?.(event, ctx);

    expect(event.systemPromptOptions.skills.map((s) => s.name)).toEqual(ALL_SKILLS);
  });
});

describe("be-concise extension", () => {
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

    await settle(handlers, ASKED, ctx);

    expect(sent).toHaveLength(1);
    expect(sent[0].message.content).toBe(TRIM_MESSAGE);
    expect(sent[0].options).toEqual({ triggerTurn: true });
  });

  it("stays quiet on the answer our own request started", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);
    await settle(handlers, ASKED, ctx);

    await settle(handlers, [...ASKED, { role: "user", text: TRIM_MESSAGE }, { role: "assistant", text: LONG }], ctx);

    expect(sent).toHaveLength(1);
  });

  it("asks again when a later run of the same prompt answers long", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);
    await settle(handlers, ASKED, ctx);

    await settle(handlers, [...ASKED, { role: "user", text: NOTIFICATION }, { role: "assistant", text: LONG }], ctx);

    expect(sent).toHaveLength(2);
  });

  it("stays quiet when the human typed the trim request themselves", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    await settle(
      handlers,
      [
        { role: "user", text: TRIM_MESSAGE },
        { role: "assistant", text: LONG },
      ],
      ctx,
    );

    expect(sent).toHaveLength(0);
  });

  it("stays quiet while the user has a message queued", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx({ hasPendingMessages: () => true });
    await handlers.get("session_start")?.({}, ctx);

    await settle(handlers, ASKED, ctx);

    expect(sent).toHaveLength(0);
  });

  it("stays quiet when the answer was interrupted", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    await settle(handlers, ASKED, ctx, { aborted: true });

    expect(sent).toHaveLength(0);
  });

  it("measures the answer that settled, not a longer one before it", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    const prompt: Turn[] = [{ role: "user", text: PROMPT }];

    await handlers.get("agent_before_settle")?.(beforeSettle([...prompt, { role: "assistant", text: LONG }]), ctx);
    await handlers.get("agent_before_settle")?.(beforeSettle([...prompt, { role: "assistant", text: SHORT }]), ctx);
    await handlers.get("agent_settled")?.({ aborted: false }, ctx);

    expect(sent).toHaveLength(0);
  });

  it("drops a pending request when a new session starts", async () => {
    const { pi, handlers, sent } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);

    await handlers.get("agent_before_settle")?.(beforeSettle(ASKED), ctx);
    await handlers.get("session_start")?.({}, ctx);
    await handlers.get("agent_settled")?.({ aborted: false }, ctx);

    expect(sent).toHaveLength(0);
  });
});
