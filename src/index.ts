/**
 * index.ts — Extension entry: watch the final answer and ask for a trim when its prose passes the bound.
 *
 * The bound is read at `agent_before_settle`, where the run's answer can still be seen, and the request is
 * sent at `agent_settled`, where Pi has stopped continuing on its own: that is the final answer, and a
 * message from the middle of a task is never cut short.
 */
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { ConfigStore } from "./config/config-store.ts";
import { showSettingsMenu } from "./ui/menu/menus.ts";
import { BE_REASONABLE_SKILL } from "./skills.ts";
import { shouldRequestTrim } from "./be-concise.ts";

const TRIM_TYPE = "be-concise";

function lastText(messages: readonly { role: string; content: unknown }[], role: string): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== role) continue;
    if (typeof message.content === "string") return message.content;
    const parts = Array.isArray(message.content) ? message.content : [];
    return parts
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "",
      )
      .join("");
  }
  return "";
}

export default function (pi: ExtensionAPI) {
  const store = new ConfigStore();

  pi.registerCommand("be-reasonable-settings", {
    description: "Configure be-reasonable: be concise settings, skill visibility",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await showSettingsMenu(ctx, store);
    },
  });

  let trimWanted = false;

  pi.on("session_start", async (_event, ctx) => {
    store.setProjectDir(ctx.isProjectTrusted() ? join(ctx.cwd, ".pi") : undefined);
    store.reload();
    trimWanted = false;
  });

  pi.on("before_agent_start", (event) => {
    const options = event.systemPromptOptions;
    // Pi re-normalizes these options for every run, skills and sections included, so both edits belong to the
    // run and a settings change needs no reload. Neither can name a skill this extension does not ship:
    // hiddenFromModel reads its own list.
    const hidden = new Set<string>(store.hiddenFromModel);
    if (hidden.size > 0) options.skills = options.skills.filter((skill) => !hidden.has(skill.name));
    // A listing alone loses to the momentum of finishing the task in front of the model, so name the moment.
    // It rides a custom section, not promptGuidelines: pi builds the rules section only when no custom system
    // prompt is configured, and a custom prompt is a normal way to run pi.
    if (!hidden.has(BE_REASONABLE_SKILL)) {
      options.sections.be_reasonable = `Before reporting work complete, load the ${BE_REASONABLE_SKILL} skill and apply it to the change.`;
    }
  });

  pi.on("agent_before_settle", async (event) => {
    if (event.outcome !== "completed") {
      trimWanted = false;
      return;
    }
    const { llmMessages } = event.context;
    trimWanted = shouldRequestTrim({
      text: lastText(llmMessages, "assistant"),
      beConcise: store.beConcise,
      // Pi hands the model our request as a user message with exactly this text (messages.js convertToLlm).
      alreadyTrimmed: lastText(llmMessages, "user") === store.beConcise.message,
    });
  });

  pi.on("agent_settled", async (event, ctx) => {
    if (!trimWanted || event.aborted) return;
    trimWanted = false;
    // The user already has a message waiting: it will steer the answer, so a trim request is noise.
    if (ctx.hasPendingMessages()) return;
    pi.sendMessage(
      { customType: TRIM_TYPE, content: store.beConcise.message, display: true },
      // No deliverAs: the host queues only while streaming, and Pi empties those queues on Esc, dropping
      // an extension's message without a trace. Idle with triggerTurn it defers past the settled handlers
      // and starts its own run (agent-session.js sendCustomMessage).
      { triggerTurn: true },
    );
  });
}
