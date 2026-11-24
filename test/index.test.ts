/** Extension behavior through Pi's event boundaries, using in-memory session projections. */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vite-plus/test";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  convertToLlm,
  SessionManager,
  type AgentBeforeSettleEvent,
  type BoundaryResult,
  type BoundaryState,
  type ExtensionAPI,
  type ExtensionContext,
  type TurnEndEvent,
} from "@earendil-works/pi-coding-agent";
import { assistant, toolCallAnswer, toolResult } from "./concise-fixtures.js";

const MOCK_AGENT_DIR = mkdtempSync(join(tmpdir(), "be-reasonable-ext-global-"));
const GLOBAL_CONFIG_PATH = join(MOCK_AGENT_DIR, "be-reasonable.json");

vi.mock(import("@earendil-works/pi-coding-agent"), async (importOriginal) => ({
  ...(await importOriginal()),
  getAgentDir: () => MOCK_AGENT_DIR,
}));

vi.mock("../src/ui/menu/menus.js", () => ({
  showSettingsMenu: vi.fn(),
}));

const { default: beReasonable } = await import("../src/index.js");

const TRIM_MESSAGE = "Cut it.";
const PROMPT = "Ship it?";
const LONG = "Verdict: ship it. " + "detail ".repeat(20);
const SHORT = "Verdict: ship it.";

function longAnswer(prompt = PROMPT): SessionManager {
  const session = SessionManager.inMemory();
  session.appendMessage({ role: "user", content: prompt, timestamp: 0 });
  session.appendMessage(assistant(LONG));
  return session;
}

function startTrim(wording = TRIM_MESSAGE) {
  const session = longAnswer();
  const request = session.appendCustomMessageEntry("be-concise", wording, true);
  return { session, request };
}

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
type FakeHandler = (event: unknown, ctx: ExtensionContext) => BoundaryResult | void | Promise<BoundaryResult | void>;

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

async function startExtension(ctx = createFakeCtx()) {
  const fake = createFakePi();
  beReasonable(fake.pi);
  await fake.handlers.get("session_start")?.({}, ctx);
  return { ...fake, ctx };
}

type RunningExtension = Awaited<ReturnType<typeof startExtension>>;

function boundaryState(session: SessionManager, outcome: BoundaryState["outcome"]): BoundaryState {
  const { entries, messages } = session.buildSessionProjection();
  return {
    outcome,
    entries: [],
    continue: false,
    context: {
      contextEntries: entries,
      contextMessages: messages,
      llmMessages: convertToLlm(messages),
      pendingMessages: [],
      canContinue: false,
    },
  };
}

function beforeSettle(
  session: SessionManager,
  outcome: BoundaryState["outcome"] = "completed",
): AgentBeforeSettleEvent {
  return { type: "agent_before_settle", ...boundaryState(session, outcome) };
}

async function dispatchBoundary(
  { handlers, ctx }: RunningExtension,
  session: SessionManager,
  event: AgentBeforeSettleEvent | TurnEndEvent,
) {
  const drafts = (await handlers.get(event.type)?.(event, ctx))?.entries ?? [];
  for (const draft of drafts) {
    if (draft.type !== "context_edit") throw new Error(`Unexpected boundary draft: ${draft.type}`);
    session.appendContextEdit(draft.targetId, draft.replacement);
  }
  return drafts;
}

async function endTurn(
  extension: RunningExtension,
  session: SessionManager,
  message = assistant(SHORT),
  toolResults: TurnEndEvent["toolResults"] = [],
) {
  const messageEntryId = session.appendMessage(message);
  const toolResultEntryIds = toolResults.map((result) => session.appendMessage(result));
  const outcome = message.stopReason === "error" ? "error" : message.stopReason === "aborted" ? "aborted" : "completed";
  const drafts = await dispatchBoundary(extension, session, {
    type: "turn_end",
    ...boundaryState(session, outcome),
    turnIndex: 0,
    message,
    toolResults,
    messageEntryId,
    toolResultEntryIds,
  });
  return { drafts, messageEntryId, toolResultEntryIds };
}

async function settle(extension: RunningExtension, session: SessionManager, aborted = false) {
  const drafts = await dispatchBoundary(extension, session, beforeSettle(session));
  await extension.handlers.get("agent_settled")?.({ aborted }, extension.ctx);
  return drafts;
}

function hides(...ids: string[]) {
  return ids.map((targetId) => ({ type: "context_edit", targetId, replacement: null }));
}

/** One run's prompt options, as pi hands them to before_agent_start, and the skill names it lists. */
function runOptions(skillNames: string[]): {
  systemPromptOptions: { skills: { name: string }[]; sections: Record<string, string> };
} {
  return { systemPromptOptions: { skills: skillNames.map((name) => ({ name })), sections: {} } };
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
    writeConfig({ modelInvocable: { "maintain-tests": false, "maintain-changelog": true } });
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

  it("keeps the listing whole when every switch is on", async () => {
    writeConfig({ modelInvocable: { "be-reasonable": true, "maintain-changelog": true, "maintain-tests": true } });
    const { pi, handlers } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);
    const event = runOptions(ALL_SKILLS);

    await handlers.get("before_agent_start")?.(event, ctx);

    expect(event.systemPromptOptions.skills.map((s) => s.name)).toEqual(ALL_SKILLS);
  });

  it("reminds the model to apply be-reasonable before it calls work done", async () => {
    const { pi, handlers } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);
    const event = runOptions(ALL_SKILLS);

    await handlers.get("before_agent_start")?.(event, ctx);

    expect(Object.values(event.systemPromptOptions.sections).join(" ")).toContain("be-reasonable");
  });

  it("adds no reminder for a skill the model is not shown", async () => {
    writeConfig({ modelInvocable: { "be-reasonable": false } });
    const { pi, handlers } = createFakePi();
    beReasonable(pi);
    const ctx = createFakeCtx();
    await handlers.get("session_start")?.({}, ctx);
    const event = runOptions(ALL_SKILLS);

    await handlers.get("before_agent_start")?.(event, ctx);

    expect(event.systemPromptOptions.sections).toEqual({});
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
    const extension = await startExtension();

    expect(await settle(extension, longAnswer())).toEqual([]);

    expect(extension.sent).toEqual([
      { message: { customType: "be-concise", content: TRIM_MESSAGE, display: true }, options: { triggerTurn: true } },
    ]);
  });

  it("does not ask again once the full answer is back at the end of the context", async () => {
    const extension = await startExtension();
    const { session } = startTrim();
    await endTurn(extension, session);

    await settle(extension, session);

    expect(extension.sent).toEqual([]);
  });

  it("recognises a tagged request with earlier wording across tool and system entries", async () => {
    const extension = await startExtension();
    const { session } = startTrim("Earlier wording");
    const call = toolCallAnswer();
    call.content.unshift({ type: "text", text: LONG });
    session.appendMessage(call);
    session.appendMessage(toolResult());
    session.appendMessage({ role: "system", content: "A system patch", timestamp: 0 });

    await settle(extension, session);

    expect(extension.sent).toEqual([]);
  });

  it("asks once for a later long answer after a previous exchange was hidden", async () => {
    const extension = await startExtension();
    const { session } = startTrim();
    await endTurn(extension, session);
    session.appendCustomMessageEntry("notification", "Subagent finished.", true);
    session.appendMessage(assistant(LONG));
    await settle(extension, session);

    session.appendCustomMessageEntry("be-concise", TRIM_MESSAGE, true);
    await endTurn(extension, session);
    await settle(extension, session);

    expect(extension.sent).toHaveLength(1);
  });

  it("does not mistake a human message for the extension request even when its text matches", async () => {
    const extension = await startExtension();

    await settle(extension, longAnswer(TRIM_MESSAGE));

    expect(extension.sent).toHaveLength(1);
  });

  it("stays quiet while the user has a message queued", async () => {
    const extension = await startExtension(createFakeCtx({ hasPendingMessages: () => true }));

    await settle(extension, longAnswer());

    expect(extension.sent).toEqual([]);
  });

  it("stays quiet when the answer was interrupted", async () => {
    const extension = await startExtension();

    await settle(extension, longAnswer(), true);

    expect(extension.sent).toEqual([]);
  });

  it("measures the answer that settled, not a longer one before it", async () => {
    const extension = await startExtension();
    const session = longAnswer();
    await dispatchBoundary(extension, session, beforeSettle(session));

    session.appendMessage(assistant(SHORT));
    await settle(extension, session);

    expect(extension.sent).toEqual([]);
  });

  it("drops a pending request when a new session starts", async () => {
    const extension = await startExtension();
    const session = longAnswer();
    await dispatchBoundary(extension, session, beforeSettle(session));

    const { handlers, ctx, sent } = extension;
    await handlers.get("session_start")?.({}, ctx);
    await handlers.get("agent_settled")?.({ aborted: false }, ctx);

    expect(sent).toEqual([]);
  });

  it.each(["stop", "aborted"] as const)("hides the exchange at turn end on %s", async (stopReason) => {
    const extension = await startExtension();
    const { session, request } = startTrim();
    const call = session.appendMessage(toolCallAnswer());
    const result = session.appendMessage(toolResult());

    const { drafts, messageEntryId } = await endTurn(extension, session, assistant(SHORT, { stopReason }));

    expect(drafts).toEqual(hides(request, call, result, messageEntryId));
    expect(await dispatchBoundary(extension, session, beforeSettle(session))).toEqual([]);
    session.appendMessage({ role: "user", content: "What else?", timestamp: 0 });
    expect(beforeSettle(session).context.llmMessages).toEqual([
      { role: "user", content: PROMPT, timestamp: 0 },
      assistant(LONG),
      { role: "user", content: "What else?", timestamp: 0 },
    ]);
  });

  it("keeps the request available for a retry, then hides a final error before settle", async () => {
    const extension = await startExtension();
    const { session, request } = startTrim();

    const { drafts, messageEntryId } = await endTurn(extension, session, assistant("", { stopReason: "error" }));

    expect(drafts).toEqual([]);
    expect(await dispatchBoundary(extension, session, beforeSettle(session, "error"))).toEqual(
      hides(request, messageEntryId),
    );
    await extension.handlers.get("agent_settled")?.({ aborted: false }, extension.ctx);
    expect(extension.sent).toEqual([]);
  });

  it("waits until settle to hide a tool batch that ended the run", async () => {
    const extension = await startExtension();
    const { session, request } = startTrim();

    const { drafts, messageEntryId, toolResultEntryIds } = await endTurn(extension, session, toolCallAnswer(), [
      toolResult(),
    ]);

    expect(drafts).toEqual([]);
    expect(await settle(extension, session)).toEqual(hides(request, messageEntryId, ...toolResultEntryIds));
  });

  it.each([
    [
      "user message",
      (session: SessionManager) => session.appendMessage({ role: "user", content: "Keep me", timestamp: 0 }),
    ],
    [
      "other extension message",
      (session: SessionManager) => session.appendCustomMessageEntry("notification", "Keep me", true),
    ],
    [
      "hidden other extension message",
      (session: SessionManager) => {
        const other = session.appendCustomMessageEntry("notification", "Keep me", true);
        session.appendContextEdit(other, null);
      },
    ],
    [
      "bash output",
      (session: SessionManager) =>
        session.appendMessage({
          role: "bashExecution",
          command: "pwd",
          output: "/tmp",
          exitCode: 0,
          cancelled: false,
          truncated: false,
          timestamp: 0,
        }),
    ],
    ["branch summary", (session: SessionManager) => session.branchWithSummary(session.getLeafId(), "Branch summary")],
    [
      "compaction",
      (session: SessionManager, request: string) => {
        session.appendCompaction("Older summary", request, 0);
        session.appendCompaction("Current summary", request, 0);
      },
    ],
  ] as const)("stops hiding at the %s", async (_name, appendBarrier) => {
    const extension = await startExtension();
    const { session, request } = startTrim();
    const partial = session.appendMessage(assistant("Trimmed output so far"));
    appendBarrier(session, request);

    expect((await endTurn(extension, session)).drafts).toEqual(hides(request, partial));
  });

  it("straightens old exchanges and finishes interrupted edits without hiding anything twice", async () => {
    const extension = await startExtension();
    const { session, request } = startTrim();
    const first = session.appendMessage(assistant(SHORT));
    session.appendMessage({ role: "user", content: "What else?", timestamp: 0 });
    session.appendMessage(assistant(LONG));
    const secondRequest = session.appendCustomMessageEntry("be-concise", "Older wording", true);
    const second = session.appendMessage(assistant(SHORT));
    session.appendMessage({ role: "user", content: "And then?", timestamp: 0 });
    session.appendMessage(assistant(LONG));
    const interruptedRequest = session.appendCustomMessageEntry("be-concise", TRIM_MESSAGE, true);
    const alreadyHidden = session.appendMessage(assistant("Earlier omitted output"));
    session.appendContextEdit(interruptedRequest, null);
    session.appendContextEdit(alreadyHidden, null);
    session.appendCustomEntry("metadata");
    session.appendLabelChange(interruptedRequest, "trim");
    session.appendThinkingLevelChange("low");
    session.appendMessage({ role: "system", content: "A system patch", timestamp: 0 });
    const lastReply = assistant(SHORT);
    session.appendUsage("cache_warm", lastReply.provider, lastReply.model, lastReply.usage);
    const last = session.appendMessage(lastReply);

    expect(await settle(extension, session)).toEqual(hides(request, first, secondRequest, second, last));
    expect(await dispatchBoundary(extension, session, beforeSettle(session))).toEqual([]);
  });
});
